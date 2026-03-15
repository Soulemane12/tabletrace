import "dotenv/config";
import express from "express";
import cors from "cors";
import { sessions } from "./sessionStore.js";
import { attachTwilioRoutes } from "./twilioRoutes.js";
import { attachBridge } from "./bridge.js";

const app = express();

app.use(cors());
app.use(express.json());

// Browser registers the current run + user phone number before starting a call.
app.post("/register-run", (req, res) => {
  const { runId, run, userPhoneNumber } = req.body as {
    runId: string;
    run: any;
    userPhoneNumber: string;
  };

  sessions.set(runId, {
    runId,
    run,
    userPhoneNumber,
    callStatus: "not_started",
    transcript: [],
  });

  res.json({ ok: true });
});

// Browser polls this to get live call status + transcript.
app.get("/session/:runId", (req, res) => {
  const session = sessions.get(req.params.runId);
  if (!session) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(session);
});

// Dashboard polls this to get all active sessions.
app.get("/sessions", (req, res) => {
  const all: Record<string, any> = {};
  sessions.forEach((session, runId) => {
    all[runId] = session;
  });
  res.json(all);
});

const server = attachTwilioRoutes(app);
attachBridge(server);

const PORT = Number(process.env.VOICE_PORT ?? 8787);
server.listen(PORT, () => {
  console.log(`Voice server listening on :${PORT}`);
});
