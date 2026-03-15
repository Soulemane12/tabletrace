import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950">

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          Hospitality × Alignment
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-zinc-100 leading-tight mb-6">
          A booking agent that
          <br />
          <span className="text-indigo-400">knows what it can't do.</span>
        </h1>

        <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          TableTrace parses your dinner request, filters restaurants against hard constraints, ranks by preference, and either confirms the booking or hands off cleanly — with a full safety and fulfillment scorecard on every run.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/book"
            className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Try the agent
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
          >
            View dashboard
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-semibold text-zinc-100 mb-3">How it works</h2>
          <p className="text-sm text-zinc-500">Seven deterministic steps. No hallucinated confirmations.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { step: "01", title: "Parse", desc: "Natural language → structured request. Hard constraints separated from soft preferences at parse time.", dot: "bg-indigo-400" },
            { step: "02", title: "Filter & Rank", desc: "Code filters on hard constraints. AI never sees candidates that violate policy.", dot: "bg-sky-400" },
            { step: "03", title: "Choose", desc: "AI picks from valid candidates only, with rationale grounded in raw restaurant fields.", dot: "bg-violet-400" },
            { step: "04", title: "Validate", desc: "Code re-checks the AI's choice before any booking attempt. Policy blocked here, not after.", dot: "bg-emerald-400" },
          ].map(({ step, title, desc, dot }) => (
            <div key={step} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${dot}`} />
                <span className="text-xs text-zinc-600 font-mono">{step}</span>
              </div>
              <div className="text-sm font-semibold text-zinc-100">{title}</div>
              <div className="text-xs text-zinc-500 leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Outcomes */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-semibold text-zinc-100 mb-3">Honest outcomes</h2>
          <p className="text-sm text-zinc-500">The agent never fakes a confirmation. Every terminal state is explicit.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { label: "Confirmed",           classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
            { label: "Phone only",          classes: "bg-sky-500/10 text-sky-400 border-sky-500/20",             dot: "bg-sky-400" },
            { label: "Needs confirmation",  classes: "bg-violet-500/10 text-violet-400 border-violet-500/20",    dot: "bg-violet-400" },
            { label: "Clarification needed",classes: "bg-amber-500/10 text-amber-400 border-amber-500/20",       dot: "bg-amber-400" },
            { label: "Policy blocked",      classes: "bg-orange-500/10 text-orange-400 border-orange-500/20",    dot: "bg-orange-400" },
            { label: "Unavailable",         classes: "bg-red-500/10 text-red-400 border-red-500/20",             dot: "bg-red-400" },
          ].map(({ label, classes, dot }) => (
            <div key={label} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border justify-center ${classes}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
              {label}
            </div>
          ))}
        </div>
      </section>

      {/* Scorecard */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <div className="text-sm font-semibold text-zinc-100">Safety score</div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Did the agent behave correctly? Measures hallucination, reasoning grounding, policy compliance, hard constraint satisfaction, and escalation quality.
            </p>
            <div className="space-y-3 pt-1">
              {[
                { label: "Hallucination", value: 100 },
                { label: "Reasoning grounding", value: 85 },
                { label: "Policy compliance", value: 100 },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">{label}</span>
                    <span className="text-emerald-400 font-mono">{value}</span>
                  </div>
                  <div className="h-1 rounded-full bg-zinc-800">
                    <div className="h-1 rounded-full bg-emerald-500" style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <div className="text-sm font-semibold text-zinc-100">Fulfillment score</div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Did the user get what they asked for? Measures task completion and soft preference satisfaction — separately from whether the agent behaved safely.
            </p>
            <div className="space-y-3 pt-1">
              {[
                { label: "Task completion", value: 65, color: "bg-amber-500", text: "text-amber-400" },
                { label: "Soft preferences", value: 0, color: "bg-red-500", text: "text-red-400" },
              ].map(({ label, value, color, text }) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">{label}</span>
                    <span className={`font-mono ${text}`}>{value}</span>
                  </div>
                  <div className="h-1 rounded-full bg-zinc-800">
                    <div className={`h-1 rounded-full ${color}`} style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-zinc-800">
              <p className="text-xs text-zinc-600">
                Safety 100, Fulfillment 33 — the agent behaved perfectly. The user did not get outdoor seating because no available restaurant had it. That is not a safety failure.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Voice bridge */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="bg-zinc-900 border border-sky-500/20 rounded-xl p-8">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
            </div>
            <div className="space-y-3 flex-1">
              <div className="text-sm font-semibold text-zinc-100">Voice handoff bridge</div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                When the only available option requires phone confirmation, TableTrace doesn't fake a booking or silently fail. It places a real outbound call via Twilio, opens a bidirectional audio stream to OpenAI Realtime, and lets a voice agent explain the situation and confirm the user's decision — all tied to the same run.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {["Twilio outbound call", "Bidirectional Media Stream", "OpenAI Realtime API", "G.711 μ-law audio", "Live transcript", "Run-scoped tools"].map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-md text-xs bg-zinc-800 text-zinc-400 border border-zinc-700">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-zinc-800 py-12 text-center">
        <p className="text-sm text-zinc-500 mb-4">Built for AI Unleashed · Cornell · March 2026</p>
        <Link
          href="/book"
          className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Try the agent →
        </Link>
      </section>

    </div>
  );
}
