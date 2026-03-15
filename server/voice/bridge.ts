import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import twilio from "twilio";
import { sessions } from "./sessionStore.js";
import { appendTranscript, finalizeAfterCall, getRunContext } from "./tools.js";

const OPENAI_REALTIME_MODEL = "gpt-4o-realtime-preview";

function buildInstructions(runId: string): string {
  return `
You are the phone bridge for TableTrace, a restaurant booking agent.
You are continuing an existing booking run — do not start a new search.

Rules:
- Be brief and direct. This is a phone call.
- Explain what happened: the text agent found a candidate but could not complete the booking automatically.
- Tell the user which restaurant was identified and why it requires a phone call.
- Never invent restaurant facts, times, prices, or confirmation codes.
- Use get_run_context to retrieve the current run details.
- Ask the user one question: do they want to proceed with this restaurant, or cancel?
- If they accept, call finalize_after_call with action="accept_candidate".
- If they cancel or decline, call finalize_after_call with action="cancel".
- Do not do any replanning. The text agent already ranked and chose the best option.
- The current runId is: ${runId}
`.trim();
}

const TOOLS = [
  {
    type: "function" as const,
    name: "get_run_context",
    description:
      "Get the current TableTrace run context: parsed request, final outcome, and ranked candidates.",
    parameters: {
      type: "object",
      properties: {
        runId: { type: "string", description: "The runId for this call." },
      },
      required: ["runId"],
    },
  },
  {
    type: "function" as const,
    name: "finalize_after_call",
    description: "Record the user's final decision after the phone conversation.",
    parameters: {
      type: "object",
      properties: {
        runId: { type: "string" },
        action: {
          type: "string",
          enum: ["accept_candidate", "cancel"],
          description:
            "accept_candidate if the user wants to proceed, cancel if they want to drop it.",
        },
      },
      required: ["runId", "action"],
    },
  },
];

export function attachBridge(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "", `https://${req.headers.host}`);
    if (url.pathname !== "/twilio-media") {
      socket.destroy();
      return;
    }

    // Twilio signs WebSocket upgrades. Validate using the HTTPS equivalent of the WS URL.
    const signature =
      String(req.headers["x-twilio-signature"] || req.headers["X-Twilio-Signature"] || "");
    const validationUrl = `${process.env.PUBLIC_HTTP_BASE}/twilio-media${url.search}`;

    const valid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN!,
      signature,
      validationUrl,
      {}
    );

    if (!valid) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (twilioWs, req) => {
    const url = new URL(req.url || "", `https://${req.headers.host}`);
    const runId = url.searchParams.get("runId") || "";
    const session = sessions.get(runId);

    if (!session) {
      twilioWs.close();
      return;
    }

    session.callStatus = "in_progress";
    let streamSid = "";

    // Open OpenAI Realtime WebSocket
    const openaiWs = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${OPENAI_REALTIME_MODEL}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1",
        },
      }
    );

    openaiWs.on("open", () => {
      // Configure the session: μ-law/G.711 in both directions, VAD, tools
      openaiWs.send(
        JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["audio", "text"],
            instructions: buildInstructions(runId),
            voice: "alloy",
            input_audio_format: "g711_ulaw",
            output_audio_format: "g711_ulaw",
            input_audio_transcription: { model: "whisper-1" },
            turn_detection: { type: "server_vad" },
            tools: TOOLS,
            tool_choice: "auto",
          },
        })
      );

      // Seed the conversation with the run snapshot so the model has context
      // before the user speaks a single word.
      openaiWs.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "system",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({
                  runId,
                  parsedRequest: session.run.parsedRequest,
                  finalOutcome: session.run.finalOutcome,
                  rankedCandidates:
                    session.run.steps?.find((s: any) => s.type === "rank_options")?.output ?? [],
                }),
              },
            ],
          },
        })
      );

      // Trigger initial AI greeting
      openaiWs.send(JSON.stringify({ type: "response.create" }));
    });

    // Twilio → OpenAI: forward audio chunks
    twilioWs.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as any;

        if (msg.event === "start") {
          streamSid = msg.start.streamSid;
          session.streamSid = streamSid;
          return;
        }

        if (msg.event === "media") {
          if (openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: msg.media.payload,
              })
            );
          }
          return;
        }

        if (msg.event === "stop") {
          if (session.callStatus === "in_progress") {
            session.callStatus = "call_failed";
          }
          openaiWs.close();
        }
      } catch {
        // ignore malformed frames
      }
    });

    // OpenAI → Twilio: handle events
    openaiWs.on("message", async (raw) => {
      try {
        const evt = JSON.parse(raw.toString()) as any;

        // Stream model audio back to the caller
        if (evt.type === "response.audio.delta" && evt.delta && streamSid) {
          if (twilioWs.readyState === WebSocket.OPEN) {
            twilioWs.send(
              JSON.stringify({
                event: "media",
                streamSid,
                media: { payload: evt.delta },
              })
            );
          }
          return;
        }

        // Capture assistant transcript deltas
        if (evt.type === "response.audio_transcript.delta" && evt.delta) {
          await appendTranscript(runId, "assistant", evt.delta);
          return;
        }

        // Capture user transcript from input audio transcription
        if (
          evt.type === "conversation.item.input_audio_transcription.completed" &&
          evt.transcript
        ) {
          await appendTranscript(runId, "user", evt.transcript);
          return;
        }

        // Handle tool calls from response.done
        if (evt.type === "response.done") {
          for (const item of (evt.response?.output as any[]) || []) {
            if (item.type !== "function_call") continue;

            const args = JSON.parse(item.arguments || "{}");
            let result: any = { error: "unknown_tool" };

            if (item.name === "get_run_context") {
              result = await getRunContext({ runId: args.runId || runId });
            } else if (item.name === "finalize_after_call") {
              result = await finalizeAfterCall({
                runId: args.runId || runId,
                action: args.action,
              });
            }

            if (openaiWs.readyState === WebSocket.OPEN) {
              openaiWs.send(
                JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id: item.call_id,
                    output: JSON.stringify(result),
                  },
                })
              );
              openaiWs.send(JSON.stringify({ type: "response.create" }));
            }
          }
        }
      } catch {
        // ignore malformed frames
      }
    });

    // Teardown
    twilioWs.on("close", () => {
      openaiWs.close();
    });

    openaiWs.on("close", () => {
      if (twilioWs.readyState === WebSocket.OPEN) {
        twilioWs.close();
      }
    });

    openaiWs.on("error", (err) => {
      console.error("[openai ws error]", err.message);
      openaiWs.close();
    });
  });
}
