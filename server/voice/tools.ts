import { sessions } from "./sessionStore.js";

export async function getRunContext(args: { runId: string }) {
  const session = sessions.get(args.runId);
  if (!session) return { error: "not_found" };

  return {
    runId: session.runId,
    outcome: session.run.finalOutcome,
    parsedRequest: session.run.parsedRequest,
    rankedCandidates:
      session.run.steps?.find((s: any) => s.type === "rank_options")?.output ?? [],
    notes:
      "Continue the existing TableTrace run. Do not invent new restaurants.",
  };
}

export async function finalizeAfterCall(args: {
  runId: string;
  action: "accept_candidate" | "cancel";
}) {
  const session = sessions.get(args.runId);
  if (!session) return { error: "not_found" };

  if (args.action === "accept_candidate") {
    session.callStatus = "completed_after_call";
    session.postCallOutcome = { outcome: "completed_after_call" };
    return { ok: true, postCallOutcome: session.postCallOutcome };
  }

  session.callStatus = "user_cancelled";
  session.postCallOutcome = { outcome: "user_cancelled" };
  return { ok: true, postCallOutcome: session.postCallOutcome };
}

export async function appendTranscript(
  runId: string,
  speaker: "user" | "assistant" | "system",
  text: string
) {
  const session = sessions.get(runId);
  if (!session || !text?.trim()) return;
  session.transcript.push({ speaker, text, at: new Date().toISOString() });
}
