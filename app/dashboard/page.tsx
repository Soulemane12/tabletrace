"use client";

import { useEffect, useState } from "react";
import type { AgentRun, ToolStep, AutomationCompletion } from "@/lib/storage/types";
import { loadState } from "@/lib/storage/store";

const OUTCOME_META: Record<string, { label: string; classes: string; dot: string }> = {
  confirmed:               { label: "Confirmed",            classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
  clarification_required:  { label: "Clarification needed", classes: "bg-amber-500/10 text-amber-400 border-amber-500/20",    dot: "bg-amber-400" },
  phone_only:              { label: "Phone only",            classes: "bg-sky-500/10 text-sky-400 border-sky-500/20",           dot: "bg-sky-400" },
  unavailable:             { label: "Unavailable",           classes: "bg-red-500/10 text-red-400 border-red-500/20",           dot: "bg-red-400" },
  policy_blocked:          { label: "Policy blocked",        classes: "bg-orange-500/10 text-orange-400 border-orange-500/20",  dot: "bg-orange-400" },
  needs_user_confirmation: { label: "Needs confirmation",    classes: "bg-violet-500/10 text-violet-400 border-violet-500/20", dot: "bg-violet-400" },
  failed_gracefully:       { label: "Failed",                classes: "bg-zinc-500/10 text-zinc-400 border-zinc-700",          dot: "bg-zinc-500" },
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
  completed:          { label: "Completed",          classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
  handoff_required:   { label: "Handoff required",   classes: "bg-amber-500/10 text-amber-400 border-amber-500/20",    dot: "bg-amber-400" },
  needs_clarification:{ label: "Needs clarification",classes: "bg-sky-500/10 text-sky-400 border-sky-500/20",           dot: "bg-sky-400" },
  blocked:            { label: "Blocked",             classes: "bg-red-500/10 text-red-400 border-red-500/20",           dot: "bg-red-400" },
  no_valid_candidate: { label: "No candidate",        classes: "bg-zinc-500/10 text-zinc-400 border-zinc-700",           dot: "bg-zinc-500" },
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
        <div
          className={`h-1 rounded-full ${color} transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
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
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
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

export default function DashboardPage() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const state = loadState();
    setRuns(state.runs);
    setSelectedRunId(state.runs[0]?.id ?? null);
  }, []);

  if (!mounted) return null;

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;

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
              return (
                <button
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  className={`w-full text-left rounded-xl p-3.5 space-y-2.5 transition-colors border ${
                    isSelected
                      ? "bg-zinc-800 border-zinc-700"
                      : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">{run.rawInput}</p>
                  <div className="flex items-center justify-between">
                    {run.finalOutcome && <OutcomeBadge outcome={run.finalOutcome.outcome} />}
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
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Scorecard */}
      <section className="flex flex-col gap-3 min-h-0">
        <h2 className="text-sm font-medium text-zinc-400 shrink-0">Scorecard</h2>

        {selectedRun?.evaluation ? (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">

            {/* Status + split scores */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                {selectedRun.finalOutcome && <OutcomeBadge outcome={selectedRun.finalOutcome.outcome} />}
                {selectedRun.evaluation.automationCompletion && (
                  <AutomationBadge status={selectedRun.evaluation.automationCompletion} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Safety</div>
                  <div className={`text-3xl font-mono font-bold ${scoreColor(selectedRun.evaluation.safetyScore ?? selectedRun.evaluation.overallScore)}`}>
                    {selectedRun.evaluation.safetyScore ?? selectedRun.evaluation.overallScore}
                    <span className="text-sm text-zinc-600 font-normal">/100</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Fulfillment</div>
                  <div className={`text-3xl font-mono font-bold ${scoreColor(selectedRun.evaluation.fulfillmentScore ?? selectedRun.evaluation.overallScore)}`}>
                    {selectedRun.evaluation.fulfillmentScore ?? selectedRun.evaluation.overallScore}
                    <span className="text-sm text-zinc-600 font-normal">/100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Safety scores */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Safety & correctness</div>
              <ScoreBar label="Hallucination" value={selectedRun.evaluation.hallucinationScore} />
              <ScoreBar label="Reasoning grounding" value={selectedRun.evaluation.reasoningGroundingScore ?? 100} />
              <ScoreBar label="Policy compliance" value={selectedRun.evaluation.policyComplianceScore} />
              <ScoreBar label="Hard constraints" value={selectedRun.evaluation.constraintSatisfactionScore} />
              <ScoreBar label="Escalation quality" value={selectedRun.evaluation.escalationQualityScore} />
            </div>

            {/* Fulfillment scores */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Task fulfillment</div>
              <ScoreBar label="Task completion" value={selectedRun.evaluation.taskCompletionScore ?? 100} />
              <ScoreBar label="Soft preferences" value={selectedRun.evaluation.softPreferenceSatisfactionScore ?? 100} />
            </div>

            {selectedRun.evaluation.notes.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Notes</div>
                {selectedRun.evaluation.notes.map((note, i) => (
                  <div key={i} className="flex gap-2 text-xs text-zinc-400">
                    <span className="text-zinc-600 shrink-0">—</span>
                    {note}
                  </div>
                ))}
              </div>
            )}

            {(selectedRun.evaluation.unsupportedClaims ?? []).length > 0 && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-2">
                <div className="text-xs text-red-400 uppercase tracking-wider mb-3">Unsupported claims</div>
                {(selectedRun.evaluation.unsupportedClaims ?? []).map((claim, i) => (
                  <div key={i} className="flex gap-2 text-xs text-red-300/80">
                    <span className="text-red-500/50 shrink-0">!</span>
                    {claim}
                  </div>
                ))}
              </div>
            )}

            {(selectedRun.evaluation.unsupportedReasoning ?? []).length > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-2">
                <div className="text-xs text-amber-400 uppercase tracking-wider mb-3">Ungrounded reasoning</div>
                {(selectedRun.evaluation.unsupportedReasoning ?? []).map((r, i) => (
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
                isLast={i === selectedRun.steps.length - 1}
              />
            ))}
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
