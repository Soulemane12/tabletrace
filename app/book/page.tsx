"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AgentRun } from "@/lib/storage/types";
import { loadState, saveState, resetState } from "@/lib/storage/store";

const VOICE_BASE = process.env.NEXT_PUBLIC_VOICE_SERVER_BASE ?? "http://localhost:8787";

const OUTCOME_META: Record<string, { label: string; classes: string; dot: string }> = {
  confirmed:               { label: "Confirmed",           classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
  clarification_required:  { label: "Clarification needed", classes: "bg-amber-500/10 text-amber-400 border-amber-500/20",    dot: "bg-amber-400" },
  phone_only:              { label: "Phone only",           classes: "bg-sky-500/10 text-sky-400 border-sky-500/20",           dot: "bg-sky-400" },
  unavailable:             { label: "Unavailable",          classes: "bg-red-500/10 text-red-400 border-red-500/20",           dot: "bg-red-400" },
  policy_blocked:          { label: "Policy blocked",       classes: "bg-orange-500/10 text-orange-400 border-orange-500/20",  dot: "bg-orange-400" },
  needs_user_confirmation: { label: "Needs confirmation",   classes: "bg-violet-500/10 text-violet-400 border-violet-500/20", dot: "bg-violet-400" },
  failed_gracefully:       { label: "Failed",               classes: "bg-zinc-500/10 text-zinc-400 border-zinc-700",          dot: "bg-zinc-500" },
};

type CallState = {
  status: string;
  transcript: Array<{ speaker: "user" | "assistant" | "system"; text: string; at: string }>;
  postCallOutcome?: any;
};

function OutcomeBadge({ outcome }: { outcome: string }) {
  const meta = OUTCOME_META[outcome] ?? { label: outcome, classes: "bg-zinc-500/10 text-zinc-400 border-zinc-700", dot: "bg-zinc-500" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${meta.classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function getBookingAttemptCandidate(run: AgentRun) {
  const step = run.steps.find((s) => s.type === "attempt_booking");
  if (!step || !step.input || typeof step.input !== "object") return null;
  return step.input as { name?: string; cuisine?: string; avgPricePerPerson?: number };
}

function CallMePanel({
  run,
  callState,
  onCallMe,
}: {
  run: AgentRun;
  callState: CallState | null;
  onCallMe: (phoneNumber: string) => void;
}) {
  const [calling, setCalling] = useState(false);

  const status = callState?.status;
  const isActive = status === "calling_user" || status === "in_progress";
  const isDone =
    status === "completed_after_call" ||
    status === "call_failed" ||
    status === "user_cancelled";

  async function handleCall() {
    if (calling) return;
    setCalling(true);
    try {
      await onCallMe("+13475445527");
    } finally {
      setCalling(false);
    }
  }

  const callStatusLabel: Record<string, string> = {
    calling_user:         "Calling you…",
    in_progress:          "Call in progress",
    completed_after_call: "Call completed",
    call_failed:          "Call failed",
    user_cancelled:       "Cancelled",
  };

  return (
    <div className="bg-zinc-900 border border-sky-500/20 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
        <span className="text-xs font-medium text-sky-400">Phone handoff</span>
        {status && statusLabel(status) && (
          <span className="ml-auto text-xs text-zinc-500">{callStatusLabel[status]}</span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {!status || status === "not_started" ? (
          <>
            <p className="text-sm text-zinc-400">
              The text agent identified the best option but cannot complete this booking automatically.
              Click below and we'll call you to confirm.
            </p>
            <button
              onClick={handleCall}
              disabled={calling}
              className="px-4 py-2 text-xs font-medium bg-sky-500 hover:bg-sky-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg transition-colors"
            >
              {calling ? "Starting…" : "Call me"}
            </button>
          </>
        ) : isActive ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-sm text-zinc-300">{callStatusLabel[status]}</span>
            </div>
            {callState?.transcript && callState.transcript.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {callState.transcript.map((entry, i) => (
                  <div key={i} className={`text-xs ${entry.speaker === "user" ? "text-zinc-300" : "text-sky-400/80"}`}>
                    <span className="text-zinc-600 mr-1.5">{entry.speaker === "user" ? "You" : "AI"}:</span>
                    {entry.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : isDone ? (
          <div className="space-y-3">
            <div className={`text-sm font-medium ${
              status === "completed_after_call" ? "text-emerald-400" :
              status === "user_cancelled" ? "text-amber-400" : "text-red-400"
            }`}>
              {callStatusLabel[status]}
              {callState?.postCallOutcome?.outcome === "completed_after_call" &&
                " — user confirmed the candidate."}
              {callState?.postCallOutcome?.outcome === "user_cancelled" &&
                " — user cancelled the booking."}
            </div>
            {callState?.transcript && callState.transcript.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {callState.transcript.map((entry, i) => (
                  <div key={i} className={`text-xs ${entry.speaker === "user" ? "text-zinc-300" : "text-sky-400/80"}`}>
                    <span className="text-zinc-600 mr-1.5">{entry.speaker === "user" ? "You" : "AI"}:</span>
                    {entry.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function statusLabel(s: string) {
  return ["calling_user", "in_progress", "completed_after_call", "call_failed", "user_cancelled"].includes(s);
}

function ResultCard({ run }: { run: AgentRun }) {
  const outcome = run.finalOutcome;
  if (!outcome) return null;

  const candidate = getBookingAttemptCandidate(run);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
        <OutcomeBadge outcome={outcome.outcome} />
        <Link
          href="/dashboard"
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          View full run →
        </Link>
      </div>

      <div className="p-5 space-y-4">
        {outcome.outcome === "confirmed" && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Restaurant</div>
              <div className="text-sm font-medium text-zinc-100">{candidate?.name ?? outcome.restaurantId}</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Time</div>
              <div className="text-sm font-medium text-zinc-100">{outcome.time}</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Confirmation</div>
              <div className="text-sm font-mono font-semibold text-emerald-400">{outcome.confirmationCode}</div>
            </div>
          </div>
        )}

        {("reason" in outcome) && (
          <p className="text-sm text-zinc-400">{outcome.reason}</p>
        )}

        {run.parsedRequest && (
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 uppercase tracking-wider">Parsed request</div>
            <div className="flex flex-wrap gap-1.5">
              <Chip label={`${run.parsedRequest.partySize} guests`} />
              <Chip label={run.parsedRequest.neighborhood || "no neighborhood"} dim={!run.parsedRequest.neighborhood} />
              <Chip label={`$${run.parsedRequest.maxPricePerPerson}/person`} />
              <Chip label={`after ${run.parsedRequest.timeWindowStart}`} />
              {run.parsedRequest.requiredFeatures.map((f) => <Chip key={f} label={f} accent />)}
              {run.parsedRequest.excludedCuisines.map((c) => <Chip key={c} label={`no ${c}`} warn />)}
              {run.parsedRequest.ambiguityFlags.map((f) => <Chip key={f} label={`⚠ ${f}`} warn />)}
            </div>
          </div>
        )}

        {run.evaluation && (
          outcome.outcome === "confirmed" ? (
            <div className="flex items-center gap-3 pt-1">
              <div className="text-xs text-zinc-500">Score</div>
              <div className={`text-sm font-mono font-semibold ${run.evaluation.overallScore >= 80 ? "text-emerald-400" : run.evaluation.overallScore >= 60 ? "text-amber-400" : "text-red-400"}`}>
                {run.evaluation.overallScore}
              </div>
              <div className="flex-1 h-1 rounded-full bg-zinc-800">
                <div
                  className={`h-1 rounded-full ${run.evaluation.overallScore >= 80 ? "bg-emerald-500" : run.evaluation.overallScore >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${run.evaluation.overallScore}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 pt-1">
              <div className="flex items-center gap-2">
                <div className="text-xs text-zinc-500">Safety</div>
                <div className={`text-sm font-mono font-semibold ${(run.evaluation.safetyScore ?? run.evaluation.overallScore) >= 80 ? "text-emerald-400" : (run.evaluation.safetyScore ?? run.evaluation.overallScore) >= 60 ? "text-amber-400" : "text-red-400"}`}>
                  {run.evaluation.safetyScore ?? run.evaluation.overallScore}
                </div>
              </div>
              <div className="w-px h-3 bg-zinc-800" />
              <div className="flex items-center gap-2">
                <div className="text-xs text-zinc-500">Fulfillment</div>
                <div className={`text-sm font-mono font-semibold ${(run.evaluation.fulfillmentScore ?? run.evaluation.overallScore) >= 80 ? "text-emerald-400" : (run.evaluation.fulfillmentScore ?? run.evaluation.overallScore) >= 60 ? "text-amber-400" : "text-red-400"}`}>
                  {run.evaluation.fulfillmentScore ?? run.evaluation.overallScore}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function Chip({
  label,
  accent,
  warn,
  dim,
}: {
  label: string;
  accent?: boolean;
  warn?: boolean;
  dim?: boolean;
}) {
  const classes = accent
    ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
    : warn
    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
    : dim
    ? "bg-zinc-800/50 text-zinc-600 border-zinc-800"
    : "bg-zinc-800/50 text-zinc-300 border-zinc-700/50";
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs border font-medium ${classes}`}>
      {label}
    </span>
  );
}

const EXAMPLE_PROMPTS = [
  {
    label: "Phone only",
    dot: "bg-sky-400",
    text: "American dinner in SoHo for 4 people tonight at 8pm, budget $75 per person, no Italian, no Japanese",
  },
  {
    label: "Auto-confirmed",
    dot: "bg-emerald-400",
    text: "Italian dinner in SoHo for 4 people tonight at 7:30pm, budget $70 per person, outdoor seating preferred",
  },
  {
    label: "No match",
    dot: "bg-zinc-400",
    text: "Dinner in SoHo for 4 people tonight at 8pm, no Italian, no Japanese, no American, budget $80",
  },
  {
    label: "Budget blocked",
    dot: "bg-orange-400",
    text: "Dinner in SoHo for 4 people tonight at 8pm, max $35 per person",
  },
  {
    label: "Needs clarification",
    dot: "bg-amber-400",
    text: "Book something nice for dinner tonight",
  },
];

export default function HomePage() {
  const [message, setMessage] = useState("");
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [latestRun, setLatestRun] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [callState, setCallState] = useState<CallState | null>(null);
  const activeCallRunId = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const state = loadState();
    setRuns(state.runs);
  }, []);

  // Poll voice server while a call is active
  useEffect(() => {
    const interval = setInterval(async () => {
      const runId = activeCallRunId.current;
      if (!runId) return;

      try {
        const res = await fetch(`${VOICE_BASE}/session/${runId}`);
        if (!res.ok) return;
        const data = await res.json();
        setCallState({ status: data.callStatus, transcript: data.transcript, postCallOutcome: data.postCallOutcome });

        if (["completed_after_call", "call_failed", "user_cancelled"].includes(data.callStatus)) {
          activeCallRunId.current = null;
        }
      } catch {
        // voice server may not be running; ignore
      }
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  async function handleSend() {
    if (!message.trim() || loading) return;
    setLoading(true);
    setCallState(null);
    activeCallRunId.current = null;

    const state = loadState();

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, state }),
      });

      const data = await res.json();

      saveState(data.nextState);
      setRuns(data.nextState.runs);
      setLatestRun(data.run);
      setMessage("");
    } finally {
      setLoading(false);
    }
  }

  async function handleCallMe(phoneNumber: string) {
    if (!latestRun) return;

    // Register run snapshot on voice server
    await fetch(`${VOICE_BASE}/register-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: latestRun.id,
        run: latestRun,
        userPhoneNumber: phoneNumber,
      }),
    });

    // Start the outbound call
    await fetch(`${VOICE_BASE}/start-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: latestRun.id }),
    });

    setCallState({ status: "calling_user", transcript: [] });
    activeCallRunId.current = latestRun.id;
  }

  function handleReset() {
    const state = resetState();
    setRuns(state.runs);
    setLatestRun(null);
    setCallState(null);
    activeCallRunId.current = null;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
  }

  const showCallPanel =
    latestRun?.finalOutcome?.outcome === "phone_only" ||
    latestRun?.finalOutcome?.outcome === "needs_user_confirmation";

  return (
    <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section className="lg:col-span-2 space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Book a table</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Describe what you want in plain English.</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <textarea
            className="w-full bg-transparent px-4 pt-4 pb-2 text-sm text-zinc-100 placeholder-zinc-600 resize-none outline-none min-h-28 disabled:opacity-50"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Book dinner for 4 tonight in SoHo after 7 PM, under $70 each, outdoor if possible, no sushi."
          />
          <div className="px-4 pb-3 flex items-center justify-between">
            <span className="text-xs text-zinc-600">{loading ? "Running agent…" : "⌘ + Enter to run"}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                disabled={loading}
                className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 rounded-md hover:bg-zinc-800 transition-colors disabled:opacity-40"
              >
                Reset data
              </button>
              <button
                onClick={handleSend}
                disabled={!message.trim() || loading}
                className="px-4 py-1.5 text-xs font-medium bg-indigo-500 hover:bg-indigo-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-md transition-colors"
              >
                {loading ? "Running…" : "Run agent"}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex.label}
                onClick={() => setMessage(ex.text)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${ex.dot}`} />
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {latestRun && <ResultCard run={latestRun} />}

        {latestRun && showCallPanel && (
          <CallMePanel
            run={latestRun}
            callState={callState}
            onCallMe={handleCallMe}
          />
        )}
      </section>

      <aside className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-400">Run history</h2>
          <span className="text-xs text-zinc-600">{runs.length} runs</span>
        </div>

        {runs.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <p className="text-sm text-zinc-600">No runs yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => {
              const meta = run.finalOutcome
                ? (OUTCOME_META[run.finalOutcome.outcome] ?? OUTCOME_META.failed_gracefully)
                : null;
              return (
                <button
                  key={run.id}
                  onClick={() => { setLatestRun(run); setCallState(null); activeCallRunId.current = null; }}
                  className="w-full text-left bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-3.5 space-y-2 transition-colors group"
                >
                  <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed group-hover:text-zinc-100 transition-colors">
                    {run.rawInput}
                  </p>
                  <div className="flex items-center justify-between">
                    {meta && (
                      <span className={`inline-flex items-center gap-1 text-xs ${meta.classes.split(" ").filter(c => c.startsWith("text-")).join(" ")}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    )}
                    {run.evaluation && (
                      run.finalOutcome?.outcome === "confirmed" ? (
                        <span className={`text-xs font-mono font-semibold ${run.evaluation.overallScore >= 80 ? "text-emerald-400" : run.evaluation.overallScore >= 60 ? "text-amber-400" : "text-red-400"}`}>
                          {run.evaluation.overallScore}
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-zinc-500">
                          S{run.evaluation.safetyScore ?? run.evaluation.overallScore} / F{run.evaluation.fulfillmentScore ?? run.evaluation.overallScore}
                        </span>
                      )
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </aside>
    </main>
  );
}
