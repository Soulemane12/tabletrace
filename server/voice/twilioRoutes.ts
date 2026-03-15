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

  // Webhook sanity check — hit this first before testing the full bridge
  app.post("/twilio/test", (req, res) => {
    res.type("text/xml").send(`<Response><Say>Hello. Your Twilio webhook works.</Say></Response>`);
  });

  // Twilio calls this URL when the outbound call is answered
  app.post("/twilio/voice", (req, res) => {
    const runId = String(req.query.runId ?? "");
    console.log("[twilio/voice] runId:", runId, "known:", sessions.has(runId));

    if (!sessions.has(runId)) {
      // Still say something so the call doesn't just drop silently
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say("Session not found. Please try again.");
      res.type("text/xml").send(twiml.toString());
      return;
    }

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("Connecting you now.");
    const connect = twiml.connect();
    const stream = connect.stream({
      url: `${process.env.PUBLIC_WS_BASE}/twilio-media`,
    });
    stream.parameter({ name: "runId", value: runId });

    res.type("text/xml").send(twiml.toString());
  });

  return http.createServer(app);
}
