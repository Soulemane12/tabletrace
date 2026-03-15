"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentRun, ToolStep, AutomationCompletion } from "@/lib/storage/types";
import { loadState } from "@/lib/storage/store";

const VOICE_BASE = process.env.NEXT_PUBLIC_VOICE_SERVER_BASE ?? "http://localhost:8787";

type TranscriptEntry = { speaker: "user" | "assistant" | "system"; text: string; at: string };
type VoiceSession = {
  runId: string;
  callStatus: string;
  transcript: TranscriptEntry[];
  postCallOutcome?: any;
  callSid?: string;
};

const OUTCOME_META: Record<string, { label: string; classes: string; dot: string }> = {
  confirmed:               { label: "Confirmed",            classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
  clarification_required:  { label: "Clarification needed", classes: "bg-amber-500/10 text-amber-400 border-amber-500/20",    dot: "bg-amber-400" },
  phone_only:              { label: "Phone only",            classes: "bg-sky-500/10 text-sky-400 border-sky-500/20",           dot: "bg-sky-400" },
  unavailable:             { label: "Unavailable",           classes: "bg-red-500/10 text-red-400 border-red-500/20",           dot: "bg-red-400" },
  policy_blocked:          { label: "Policy blocked",        classes: "bg-orange-500/10 text-orange-400 border-orange-500/20",  dot: "bg-orange-400" },
  needs_user_confirmation: { label: "Needs confirmation",    classes: "bg-violet-500/10 text-violet-400 border-violet-500/20", dot: "bg-violet-400" },
  failed_gracefully:       { label: "Failed",                classes: "bg-zinc-500/10 text-zinc-400 border-zinc-700",          dot: "bg-zinc-500" },
};

const CALL_STATUS_META: Record<string, { label: string; color: string; pulse: boolean }> = {
  not_started:          { label: "Not started",       color: "bg-zinc-500",   pulse: false },
  calling_user:         { label: "Calling…",          color: "bg-amber-400",  pulse: true  },
  in_progress:          { label: "Call in progress",  color: "bg-sky-400",    pulse: true  },
  completed_after_call: { label: "User confirmed",    color: "bg-emerald-400",pulse: false },
  user_cancelled:       { label: "User cancelled",    color: "bg-amber-400",  pulse: false },
  call_failed:          { label: "Call failed",       color: "bg-red-400",    pulse: false },
};

const STEP_META: Record<ToolStep["type"], { label: string; dot: string }> = {
  parse_request:       { label: "Parse Request",      dot: "bg-indigo-400" },
  get_context:         { label: "Get Context",         dot: "bg-zinc-500" },
  search_restaurants:  { label: "Search Restaurants",  dot: "bg-sky-400" },
  rank_options:        { label: "Rank Options",         dot: "bg-violet-400" },
  choose_candidate_ai: { label: "AI Choice",           dot: "bg-fuchsia-400" },
  validate_choice:     { label: "Validate Choice",     dot: "bg-orange-400" },
  attempt_booking:     { label: "Attempt Booking",     dot: "bg-emerald-400" },
  evidence_check:      { label: "Evidence Check",      dot: "bg-rose-400" },
  evaluate_run:        { label: "Evaluate Run",        dot: "bg-amber-400" },
};

function OutcomeBadge({ outcome }: { outcome: string }) {
  const meta = OUTCOME_META[outcome] ?? OUTCOME_META.failed_gracefully;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${meta.classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function scoreColor(value: number): string {
  return value >= 80 ? "text-emerald-400" : value >= 60 ? "text-amber-400" : "text-red-400";
}

const AUTOMATION_META: Record<AutomationCompletion, { label: string; classes: string; dot: string }> = {
  completed:           { label: "Completed",           classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
  handoff_required:    { label: "Handoff required",    classes: "bg-amber-500/10 text-amber-400 border-amber-500/20",    dot: "bg-amber-400" },
  needs_clarification: { label: "Needs clarification", classes: "bg-sky-500/10 text-sky-400 border-sky-500/20",           dot: "bg-sky-400" },
  blocked:             { label: "Blocked",              classes: "bg-red-500/10 text-red-400 border-red-500/20",           dot: "bg-red-400" },
  no_valid_candidate:  { label: "No candidate",         classes: "bg-zinc-500/10 text-zinc-400 border-zinc-700",           dot: "bg-zinc-500" },
};

function AutomationBadge({ status }: { status: AutomationCompletion }) {
  const meta = AUTOMATION_META[status] ?? AUTOMATION_META.blocked;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${meta.classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-red-500";
  const textColor = value >= 80 ? "text-emerald-400" : value >= 60 ? "text-amber-400" : "text-red-400";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">{label}</span>
        <span className={`text-xs font-mono font-semibold ${textColor}`}>{value}</span>
      </div>
      <div className="h-1 rounded-full bg-zinc-800">
        <div className={`h-1 rounded-full ${color} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function TimelineStep({ step, isLast }: { step: ToolStep; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const meta = STEP_META[step.type];
  const time = new Date(step.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className="relative flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${meta.dot}`} />
        {!isLast && <div className="w-px flex-1 bg-zinc-800 mt-1" />}
      </div>
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-zinc-300">{meta.label}</span>
          <span className="text-xs text-zinc-600 font-mono">{time}</span>
        </div>
        <button onClick={() => setExpanded((v) => !v)} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
          {expanded ? "hide output ↑" : "show output ↓"}
        </button>
        {expanded && (
          <pre className="mt-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg p-3 overflow-auto text-zinc-400 leading-relaxed">
            {JSON.stringify(step.output, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function VoiceCallPanel({ session }: { session: VoiceSession }) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const statusMeta = CALL_STATUS_META[session.callStatus] ?? CALL_STATUS_META.not_started;

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [session.transcript]);

  return (
    <div className="bg-zinc-900 border border-sky-500/20 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-sky-400">Voice call</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.color} ${statusMeta.pulse ? "animate-pulse" : ""}`} />
          <span className="text-xs text-zinc-400">{statusMeta.label}</span>
        </div>
      </div>

      {/* Post-call outcome */}
      {session.postCallOutcome && (
        <div className={`px-4 py-2.5 border-b border-zinc-800 text-xs font-medium ${
          session.callStatus === "completed_after_call" ? "text-emerald-400" :
          session.callStatus === "user_cancelled" ? "text-amber-400" : "text-red-400"
        }`}>
          {session.callStatus === "completed_after_call" && "User confirmed — candidate accepted"}
          {session.callStatus === "user_cancelled" && "User cancelled the booking"}
          {session.callStatus === "call_failed" && "Call ended unexpectedly"}
        </div>
      )}

      {/* Transcript */}
      {session.transcript.length > 0 ? (
        <div ref={transcriptRef} className="p-4 space-y-3 max-h-64 overflow-y-auto">
          {session.transcript.map((entry, i) => (
            <div key={i} className="flex gap-2.5">
              <span className={`text-xs font-medium shrink-0 w-6 mt-0.5 ${
                entry.speaker === "user" ? "text-zinc-400" : "text-sky-400"
              }`}>
                {entry.speaker === "user" ? "You" : "AI"}
              </span>
              <p className="text-xs text-zinc-300 leading-relaxed">{entry.text}</p>
            </div>
          ))}
          {(session.callStatus === "calling_user" || session.callStatus === "in_progress") && (
            <div className="flex gap-2.5">
              <span className="text-xs font-medium shrink-0 w-6 text-sky-400">AI</span>
              <span className="flex gap-1 mt-1">
                <span className="w-1 h-1 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-1 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1 h-1 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-4 text-xs text-zinc-600">
          {session.callStatus === "calling_user" ? "Dialing…" : "Waiting for transcript…"}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [voiceSessions, setVoiceSessions] = useState<Record<string, VoiceSession>>({});

  useEffect(() => {
    setMounted(true);
    const state = loadState();
    setRuns(state.runs);
    setSelectedRunId(state.runs[0]?.id ?? null);
  }, []);

  // Poll voice server for live session data
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${VOICE_BASE}/sessions`);
        if (!res.ok) return;
        const data = await res.json();
        setVoiceSessions(data);
      } catch {
        // voice server not running, ignore
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;
  const selectedVoice = selectedRunId ? voiceSessions[selectedRunId] : null;

  // Merge voice outcome on top of the baked evaluation scores
  const displayEval = (() => {
    if (!selectedRun?.evaluation) return null;
    const base = selectedRun.evaluation;
    if (!selectedVoice) return base;

    if (selectedVoice.callStatus === "completed_after_call") {
      const taskCompletionScore = 100;
      const fulfillmentScore = Math.round((taskCompletionScore + (base.softPreferenceSatisfactionScore ?? 100)) / 2);
      const overallScore = Math.round((( base.safetyScore ?? base.overallScore) + fulfillmentScore) / 2);
      return {
        ...base,
        taskCompletionScore,
        fulfillmentScore,
        overallScore,
        automationCompletion: "completed" as const,
        notes: [...base.notes, "Voice handoff completed — user confirmed the candidate on the call."],
      };
    }

    if (selectedVoice.callStatus === "user_cancelled") {
      const taskCompletionScore = 0;
      const fulfillmentScore = Math.round((taskCompletionScore + (base.softPreferenceSatisfactionScore ?? 100)) / 2);
      const overallScore = Math.round(((base.safetyScore ?? base.overallScore) + fulfillmentScore) / 2);
      return {
        ...base,
        taskCompletionScore,
        fulfillmentScore,
        overallScore,
        automationCompletion: "blocked" as const,
        notes: [...base.notes, "User cancelled during voice handoff — booking not completed."],
      };
    }

    return base;
  })();

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-3rem)]">

      {/* Runs list */}
      <section className="flex flex-col gap-3 min-h-0">
        <div className="flex items-center justify-between shrink-0">
          <h1 className="text-sm font-medium text-zinc-400">Runs</h1>
          <span className="text-xs text-zinc-600">{runs.length} total</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {runs.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
              <p className="text-sm text-zinc-600">No runs yet.</p>
              <p className="text-xs text-zinc-700 mt-1">Go to Book to run the agent.</p>
            </div>
          ) : (
            runs.map((run) => {
              const isSelected = run.id === selectedRunId;
              const voice = voiceSessions[run.id];
              const isLive = voice?.callStatus === "calling_user" || voice?.callStatus === "in_progress";
              return (
                <button
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  className={`w-full text-left rounded-xl p-3.5 space-y-2.5 transition-colors border ${
                    isSelected ? "bg-zinc-800 border-zinc-700" : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed flex-1">{run.rawInput}</p>
                    {isLive && (
                      <span className="shrink-0 flex items-center gap-1 text-xs text-sky-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    {run.finalOutcome && <OutcomeBadge outcome={run.finalOutcome.outcome} />}
                    <div className="flex items-center gap-2">
                      {voice && !isLive && voice.callStatus !== "not_started" && (
                        <span className={`text-xs font-medium ${
                          voice.callStatus === "completed_after_call" ? "text-emerald-400" :
                          voice.callStatus === "user_cancelled" ? "text-amber-400" : "text-zinc-500"
                        }`}>
                          {voice.callStatus === "completed_after_call" ? "✓ confirmed" :
                           voice.callStatus === "user_cancelled" ? "cancelled" : "call ended"}
                        </span>
                      )}
                      {run.evaluation && (
                        run.finalOutcome?.outcome === "confirmed" ? (
                          <span className={`text-xs font-mono font-semibold ${scoreColor(run.evaluation.overallScore)}`}>
                            {run.evaluation.overallScore}
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-600">S</span>
                            <span className={`text-xs font-mono font-semibold ${scoreColor(run.evaluation.safetyScore ?? run.evaluation.overallScore)}`}>
                              {run.evaluation.safetyScore ?? run.evaluation.overallScore}
                            </span>
                            <span className="text-xs text-zinc-700">/</span>
                            <span className="text-xs text-zinc-600">F</span>
                            <span className={`text-xs font-mono font-semibold ${scoreColor(run.evaluation.fulfillmentScore ?? run.evaluation.overallScore)}`}>
                              {run.evaluation.fulfillmentScore ?? run.evaluation.overallScore}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Scorecard */}
      <section className="flex flex-col gap-3 min-h-0">
        <h2 className="text-sm font-medium text-zinc-400 shrink-0">Scorecard</h2>

        {displayEval && selectedRun ? (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">

            {/* Status + split scores */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                {selectedRun.finalOutcome && <OutcomeBadge outcome={selectedRun.finalOutcome.outcome} />}
                {displayEval.automationCompletion && (
                  <AutomationBadge status={displayEval.automationCompletion} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Safety</div>
                  <div className={`text-3xl font-mono font-bold ${scoreColor(displayEval.safetyScore ?? displayEval.overallScore)}`}>
                    {displayEval.safetyScore ?? displayEval.overallScore}
                    <span className="text-sm text-zinc-600 font-normal">/100</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Fulfillment</div>
                  <div className={`text-3xl font-mono font-bold transition-all duration-700 ${scoreColor(displayEval.fulfillmentScore ?? displayEval.overallScore)}`}>
                    {displayEval.fulfillmentScore ?? displayEval.overallScore}
                    <span className="text-sm text-zinc-600 font-normal">/100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Voice call status card — shown whenever there's a session */}
            {selectedVoice && <VoiceCallPanel session={selectedVoice} />}

            {/* Safety scores */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Safety & correctness</div>
              <ScoreBar label="Hallucination" value={displayEval.hallucinationScore} />
              <ScoreBar label="Reasoning grounding" value={displayEval.reasoningGroundingScore ?? 100} />
              <ScoreBar label="Policy compliance" value={displayEval.policyComplianceScore} />
              <ScoreBar label="Hard constraints" value={displayEval.constraintSatisfactionScore} />
              <ScoreBar label="Escalation quality" value={displayEval.escalationQualityScore} />
            </div>

            {/* Fulfillment scores */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Task fulfillment</div>
              <ScoreBar label="Task completion" value={displayEval.taskCompletionScore ?? 100} />
              <ScoreBar label="Soft preferences" value={displayEval.softPreferenceSatisfactionScore ?? 100} />
            </div>

            {displayEval.notes.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Notes</div>
                {displayEval.notes.map((note, i) => (
                  <div key={i} className={`flex gap-2 text-xs ${i === displayEval.notes.length - 1 && selectedVoice ? "text-sky-400/80" : "text-zinc-400"}`}>
                    <span className="text-zinc-600 shrink-0">—</span>
                    {note}
                  </div>
                ))}
              </div>
            )}

            {(displayEval.unsupportedClaims ?? []).length > 0 && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-2">
                <div className="text-xs text-red-400 uppercase tracking-wider mb-3">Unsupported claims</div>
                {(displayEval.unsupportedClaims ?? []).map((claim, i) => (
                  <div key={i} className="flex gap-2 text-xs text-red-300/80">
                    <span className="text-red-500/50 shrink-0">!</span>
                    {claim}
                  </div>
                ))}
              </div>
            )}

            {(displayEval.unsupportedReasoning ?? []).length > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-2">
                <div className="text-xs text-amber-400 uppercase tracking-wider mb-3">Ungrounded reasoning</div>
                {(displayEval.unsupportedReasoning ?? []).map((r, i) => (
                  <div key={i} className="flex gap-2 text-xs text-amber-300/80">
                    <span className="text-amber-500/50 shrink-0">~</span>
                    {r}
                  </div>
                ))}
              </div>
            )}

            {(() => {
              const choiceStep = selectedRun.steps.find((s) => s.type === "choose_candidate_ai");
              const choice = choiceStep?.output as { rationale?: string[]; shouldEscalate?: boolean; escalationReason?: string | null } | null;
              if (!choice?.rationale?.length) return null;
              return (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">AI choice rationale</div>
                  {choice.rationale.map((r, i) => (
                    <div key={i} className="flex gap-2 text-xs text-zinc-400">
                      <span className="text-indigo-500/60 shrink-0">→</span>
                      {r}
                    </div>
                  ))}
                  {choice.shouldEscalate && choice.escalationReason && (
                    <div className="mt-2 pt-2 border-t border-zinc-800 text-xs text-amber-400">
                      Escalation: {choice.escalationReason}
                    </div>
                  )}
                </div>
              );
            })()}

            {selectedRun.parsedRequest && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Parsed request</div>
                {[
                  ["Date", selectedRun.parsedRequest.date],
                  ["Party size", String(selectedRun.parsedRequest.partySize)],
                  ["Neighborhood", selectedRun.parsedRequest.neighborhood || "—"],
                  ["Budget", `$${selectedRun.parsedRequest.maxPricePerPerson}/person`],
                  ["Window", `${selectedRun.parsedRequest.timeWindowStart} – ${selectedRun.parsedRequest.timeWindowEnd}`],
                  ["Required", selectedRun.parsedRequest.requiredFeatures.join(", ") || "—"],
                  ["Excluded", selectedRun.parsedRequest.excludedCuisines.join(", ") || "—"],
                  ["Ambiguity", selectedRun.parsedRequest.ambiguityFlags.join(", ") || "none"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-start gap-4">
                    <span className="text-xs text-zinc-600 shrink-0">{label}</span>
                    <span className="text-xs text-zinc-300 text-right font-mono">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <p className="text-sm text-zinc-600">Select a run to see scores.</p>
          </div>
        )}
      </section>

      {/* Timeline */}
      <section className="flex flex-col gap-3 min-h-0">
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-sm font-medium text-zinc-400">Timeline</h2>
          {selectedRun && (
            <span className="text-xs text-zinc-600">{selectedRun.steps.length} steps</span>
          )}
        </div>

        {selectedRun ? (
          <div className="flex-1 overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-xl p-4 pr-3">
            {selectedRun.steps.map((step, i) => (
              <TimelineStep
                key={step.id}
                step={step}
                isLast={i === selectedRun.steps.length - 1 && !selectedVoice}
              />
            ))}

            {/* Voice call steps appended live to the timeline */}
            {selectedVoice && (
              <>
                <div className="relative flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-px h-4 bg-zinc-800" />
                  </div>
                </div>
                <div className="relative flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full shrink-0 mt-1 bg-sky-400 ${
                      selectedVoice.callStatus === "calling_user" || selectedVoice.callStatus === "in_progress"
                        ? "animate-pulse" : ""
                    }`} />
                    {selectedVoice.transcript.length > 0 && <div className="w-px flex-1 bg-zinc-800 mt-1" />}
                  </div>
                  <div className="pb-4 flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-zinc-300">Voice Call</span>
                      <span className={`text-xs font-medium ${
                        selectedVoice.callStatus === "completed_after_call" ? "text-emerald-400" :
                        selectedVoice.callStatus === "user_cancelled" ? "text-amber-400" :
                        selectedVoice.callStatus === "in_progress" || selectedVoice.callStatus === "calling_user" ? "text-sky-400" :
                        "text-zinc-500"
                      }`}>
                        {CALL_STATUS_META[selectedVoice.callStatus]?.label ?? selectedVoice.callStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedVoice.transcript.map((entry, i) => (
                  <div key={i} className="relative flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
                        entry.speaker === "user" ? "bg-zinc-500" : "bg-sky-400/60"
                      }`} />
                      {i < selectedVoice.transcript.length - 1 && (
                        <div className="w-px flex-1 bg-zinc-800/50 mt-1" />
                      )}
                    </div>
                    <div className="pb-3 flex-1 min-w-0">
                      <span className={`text-xs font-medium ${entry.speaker === "user" ? "text-zinc-500" : "text-sky-400/80"}`}>
                        {entry.speaker === "user" ? "You" : "AI"}
                      </span>
                      <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{entry.text}</p>
                    </div>
                  </div>
                ))}

                {(selectedVoice.callStatus === "in_progress" || selectedVoice.callStatus === "calling_user") && (
                  <div className="relative flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 bg-sky-400/40 animate-pulse" />
                    </div>
                    <div className="pb-3 flex gap-1 items-center">
                      <span className="w-1 h-1 rounded-full bg-sky-400/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1 h-1 rounded-full bg-sky-400/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1 h-1 rounded-full bg-sky-400/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <p className="text-sm text-zinc-600">Select a run to see the timeline.</p>
          </div>
        )}
      </section>
    </main>
  );
}
