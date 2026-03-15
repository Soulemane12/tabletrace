import { NextResponse } from "next/server";
import { parseRequestAI } from "@/lib/ai/parse-request-ai";
import { chooseCandidateAI } from "@/lib/ai/choose-candidate-ai";
import { evaluateRun } from "@/lib/agent/evaluate-run";
import { getEvidenceCheck } from "@/lib/agent/evidence-check";
import { searchRestaurants } from "@/lib/booking/search";
import { attemptBooking } from "@/lib/booking/attempt";
import { rankOptions } from "@/lib/agent/rank-options";
import { validateChosenCandidate } from "@/lib/booking/validate-choice";
import { normalizeRequiredFeatures } from "@/lib/policy/rules";
import type { AppState, ToolStep } from "@/lib/storage/types";

function makeStep(
  type: ToolStep["type"],
  input: unknown,
  output: unknown,
  success = true
): ToolStep {
  return {
    id: crypto.randomUUID(),
    type,
    input,
    output,
    success,
    createdAt: new Date().toISOString(),
  };
}

export async function POST(req: Request) {
  const { message, state }: { message: string; state: AppState } = await req.json();

  const run = {
    id: crypto.randomUUID(),
    rawInput: message,
    parsedRequest: null as unknown,
    finalOutcome: null as unknown,
    steps: [] as ToolStep[],
    evaluation: null as unknown,
    createdAt: new Date().toISOString(),
  };

  const parsed = await parseRequestAI(message);

  if (!parsed) {
    return NextResponse.json({ error: "Failed to parse request." }, { status: 500 });
  }

  // Normalize before any downstream use
  parsed.requiredFeatures = normalizeRequiredFeatures(parsed.requiredFeatures);

  run.parsedRequest = parsed;
  run.steps.push(makeStep("parse_request", message, parsed));

  if (parsed.ambiguityFlags.length > 0) {
    run.finalOutcome = {
      outcome: "clarification_required",
      reason: `Missing or unclear fields: ${parsed.ambiguityFlags.join(", ")}`,
    };

    const evidence = getEvidenceCheck(run as any, state.restaurants);
    run.steps.push(makeStep("evidence_check", run.finalOutcome, evidence));

    const evaluation = await evaluateRun(run as any, state.restaurants);
    run.evaluation = evaluation;
    run.steps.push(makeStep("evaluate_run", run.finalOutcome, evaluation));

    return NextResponse.json({
      run,
      nextState: { ...state, runs: [run, ...state.runs] },
    });
  }

  const candidates = searchRestaurants(state, parsed);
  run.steps.push(makeStep("search_restaurants", parsed, candidates));

  const preRanked = rankOptions(state, parsed, candidates);
  run.steps.push(makeStep("rank_options", candidates, preRanked));

  const choice = await chooseCandidateAI({ parsedRequest: parsed, candidates: preRanked });
  run.steps.push(makeStep("choose_candidate_ai", preRanked, choice));

  const chosen =
    choice?.chosenRestaurantId == null
      ? undefined
      : preRanked.find((c) => c.restaurantId === choice.chosenRestaurantId);

  // AI deliberately escalated — honor its judgment with the right outcome label
  if (choice?.shouldEscalate) {
    const reason = choice.escalationReason ?? "Agent could not find a suitable candidate.";
    const isPhoneOnly =
      reason.toLowerCase().includes("phone") ||
      preRanked.some((c) => c.requiresPhoneConfirmation && c.restaurantId === choice.chosenRestaurantId) ||
      (preRanked.length > 0 && preRanked.every((c) => c.requiresPhoneConfirmation));

    run.finalOutcome = isPhoneOnly
      ? { outcome: "phone_only", reason }
      : preRanked.length === 0
      ? { outcome: "unavailable", reason: "No candidates matched the request." }
      : { outcome: "needs_user_confirmation", reason };

    run.steps.push(makeStep("validate_choice", chosen ?? null, { escalated: true, reason }));

    const evidence = getEvidenceCheck(run as any, state.restaurants);
    run.steps.push(makeStep("evidence_check", run.finalOutcome, evidence));

    const evaluation = await evaluateRun(run as any, state.restaurants);
    run.evaluation = evaluation;
    run.steps.push(makeStep("evaluate_run", run.finalOutcome, evaluation));

    return NextResponse.json({
      run,
      nextState: { ...state, runs: [run, ...state.runs] },
    });
  }

  // Gate: code validates AI choice before any booking attempt
  const validationError = validateChosenCandidate(state, parsed, chosen);

  if (validationError) {
    run.finalOutcome = {
      outcome: "policy_blocked",
      reason: `AI chose invalid candidate: ${validationError}`,
    };
    run.steps.push(makeStep("validate_choice", chosen ?? null, { valid: false, reason: validationError }, false));

    const evidence = getEvidenceCheck(run as any, state.restaurants);
    run.steps.push(makeStep("evidence_check", run.finalOutcome, evidence));

    const evaluation = await evaluateRun(run as any, state.restaurants);
    run.evaluation = evaluation;
    run.steps.push(makeStep("evaluate_run", run.finalOutcome, evaluation));

    return NextResponse.json({
      run,
      nextState: { ...state, runs: [run, ...state.runs] },
    });
  }

  run.steps.push(makeStep("validate_choice", chosen ?? null, { valid: true }));

  const { nextState: stateAfterBooking, result } = attemptBooking(state, parsed, chosen);
  run.finalOutcome = result;
  run.steps.push(makeStep("attempt_booking", chosen ?? null, result));

  const evidence = getEvidenceCheck(run as any, state.restaurants);
  run.steps.push(makeStep("evidence_check", result, evidence));

  const evaluation = await evaluateRun(run as any, state.restaurants);
  run.evaluation = evaluation;
  run.steps.push(makeStep("evaluate_run", result, evaluation));

  return NextResponse.json({
    run,
    nextState: { ...stateAfterBooking, runs: [run, ...stateAfterBooking.runs] },
  });
}
