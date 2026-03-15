import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import { sessions } from "./sessionStore.js";
import { appendTranscript, finalizeAfterCall, getRunContext } from "./tools.js";

const OPENAI_REALTIME_MODEL = "gpt-4o-realtime-preview";

function buildInstructions(runId: string): string {
  return `
You are the phone bridge for TableTrace, a restaurant booking agent.
You are continuing an existing booking run — do not start a new search.

When the call starts, immediately do the following in order:
1. Greet the user: "Hi, this is TableTrace."
2. Call get_run_context to load the run details.
3. Explain the situation clearly: "I tried to book [restaurant name] for [party size] people on [date] at [time], but this restaurant requires a phone confirmation — so I wasn't able to complete it automatically."
4. Ask one question: "Would you like to go ahead with [restaurant name], or would you prefer to cancel?"

Rules:
- Speak naturally, like a helpful person on the phone. Use contractions. Keep sentences short.
- Do not list facts robotically. Say it conversationally: "It's at Mercer House — they need a quick phone confirmation to lock it in."
- Pause naturally between sentences. Do not rush.
- Never invent facts — only use data returned by get_run_context.
- If the user says yes, proceed, sure, or anything affirmative → call finalize_after_call with action="accept_candidate".
- If the user says no, cancel, or anything negative → call finalize_after_call with action="cancel".
- If the user seems confused, repeat the key info once more simply, then ask again.
- Do not replan or suggest alternatives. The text agent already chose the best option.
- IMPORTANT: Only call finalize_after_call when the user gives a clear, direct answer — "yes", "go ahead", "proceed", "cancel", "no". Do not act on "thank you", "okay", "sure" alone, or anything ambiguous. If unclear, ask again.
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

function openOpenAI(
  runId: string,
  twilioWs: WebSocket,
  getStreamSid: () => string,
  getSession: () => ReturnType<typeof sessions.get>
): WebSocket {
  const ws = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${OPENAI_REALTIME_MODEL}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1",
      },
    }
  );

  ws.on("open", () => {
    console.log("[bridge] openai ws opened");
    const session = getSession();

    ws.send(JSON.stringify({
      type: "session.update",
      session: {
        modalities: ["audio", "text"],
        instructions: buildInstructions(runId),
        voice: "shimmer",
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.7,
          prefix_padding_ms: 300,
          silence_duration_ms: 800,
        },
        tools: TOOLS,
        tool_choice: "auto",
      },
    }));

    ws.send(JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [{
          type: "input_text",
          text: JSON.stringify({
            runId,
            parsedRequest: session?.run.parsedRequest,
            finalOutcome: session?.run.finalOutcome,
            rankedCandidates:
              session?.run.steps?.find((s: any) => s.type === "rank_options")?.output ?? [],
          }),
        }],
      },
    }));

    ws.send(JSON.stringify({ type: "response.create" }));
  });

  ws.on("message", async (raw) => {
    try {
      const evt = JSON.parse(raw.toString()) as any;

      if (evt.type === "response.audio.delta" && evt.delta) {
        const streamSid = getStreamSid();
        if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
          twilioWs.send(JSON.stringify({
            event: "media",
            streamSid,
            media: { payload: evt.delta },
          }));
        }
        return;
      }

      if (evt.type === "response.audio_transcript.delta" && evt.delta) {
        await appendTranscript(runId, "assistant", evt.delta);
        return;
      }

      if (evt.type === "conversation.item.input_audio_transcription.completed" && evt.transcript) {
        await appendTranscript(runId, "user", evt.transcript);
        return;
      }

      if (evt.type === "response.done") {
        for (const item of (evt.response?.output as any[]) || []) {
          if (item.type !== "function_call") continue;

          const args = JSON.parse(item.arguments || "{}");
          let result: any = { error: "unknown_tool" };

          if (item.name === "get_run_context") {
            result = await getRunContext({ runId: args.runId || runId });
          } else if (item.name === "finalize_after_call") {
            result = await finalizeAfterCall({ runId: args.runId || runId, action: args.action });
          }

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "conversation.item.create",
              item: { type: "function_call_output", call_id: item.call_id, output: JSON.stringify(result) },
            }));
            ws.send(JSON.stringify({ type: "response.create" }));
          }
        }
      }
    } catch {
      // ignore malformed frames
    }
  });

  ws.on("error", (err) => {
    console.error("[openai ws error]", err.message);
  });

  ws.on("close", (code, reason) => {
    console.log("[bridge] openai ws closed", code, reason.toString());
    if (twilioWs.readyState === WebSocket.OPEN) twilioWs.close();
  });

  return ws;
}

export function attachBridge(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "", `https://${req.headers.host}`);
    console.log("[bridge] upgrade request:", url.pathname);
    if (url.pathname !== "/twilio-media") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (twilioWs) => {
    console.log("[bridge] twilio connected, waiting for start event");

    let runId = "";
    let streamSid = "";
    let openaiWs: WebSocket | null = null;

    twilioWs.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as any;

        if (msg.event === "start") {
          streamSid = msg.start.streamSid;
          // runId comes from the custom parameter set in TwiML
          runId = msg.start.customParameters?.runId || "";
          console.log("[bridge] start event, streamSid:", streamSid, "runId:", runId);

          const session = sessions.get(runId);
          if (!session) {
            console.log("[bridge] no session for runId:", runId);
            twilioWs.close();
            return;
          }

          session.callStatus = "in_progress";
          session.streamSid = streamSid;

          openaiWs = openOpenAI(
            runId,
            twilioWs,
            () => streamSid,
            () => sessions.get(runId)
          );
          return;
        }

        if (msg.event === "media") {
          if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({
              type: "input_audio_buffer.append",
              audio: msg.media.payload,
            }));
          }
          return;
        }

        if (msg.event === "stop") {
          const session = sessions.get(runId);
          if (session && session.callStatus === "in_progress") {
            session.callStatus = "call_failed";
          }
          openaiWs?.close();
        }
      } catch {
        // ignore malformed frames
      }
    });

    twilioWs.on("close", () => {
      console.log("[bridge] twilio ws closed");
      openaiWs?.close();
    });
  });
}
