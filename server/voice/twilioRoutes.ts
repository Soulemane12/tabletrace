import express from "express";
import http from "http";
import twilio from "twilio";
import { sessions } from "./sessionStore.js";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export function attachTwilioRoutes(app: express.Express) {
  // Start an outbound call to the user's phone
  app.post("/start-call", async (req, res) => {
    const { runId } = req.body as { runId: string };
    const session = sessions.get(runId);
    if (!session) {
      res.status(404).json({ error: "run_not_registered" });
      return;
    }

    const voiceUrl = `${process.env.PUBLIC_HTTP_BASE}/twilio/voice?runId=${encodeURIComponent(runId)}`;

    const call = await client.calls.create({
      to: session.userPhoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER!,
      url: voiceUrl,
    });

    session.callSid = call.sid;
    session.callStatus = "calling_user";

    res.json({ ok: true, callSid: call.sid });
  });

  // Twilio sends form-encoded params to voice webhooks
  app.use("/twilio/voice", express.urlencoded({ extended: false }));

  // Twilio calls this URL when the outbound call is answered
  app.post("/twilio/voice", (req, res) => {
    const signature = (req.header("X-Twilio-Signature") ?? req.header("x-twilio-signature")) || "";
    const fullUrl = `${process.env.PUBLIC_HTTP_BASE}${req.originalUrl}`;

    const valid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN!,
      signature,
      fullUrl,
      req.body as Record<string, string>
    );

    if (!valid) {
      res.status(403).send("invalid signature");
      return;
    }

    const runId = String(req.query.runId ?? "");
    if (!sessions.has(runId)) {
      res.status(404).send("unknown run");
      return;
    }

    const twiml = new twilio.twiml.VoiceResponse();
    const connect = twiml.connect();

    connect.stream({
      url: `${process.env.PUBLIC_WS_BASE}/twilio-media?runId=${encodeURIComponent(runId)}`,
    });

    res.type("text/xml").send(twiml.toString());
  });

  return http.createServer(app);
}
