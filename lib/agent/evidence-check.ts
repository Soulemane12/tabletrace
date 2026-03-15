import type { AgentRun, Restaurant, AutomationCompletion } from "@/lib/storage/types";

export function getEvidenceCheck(run: AgentRun, restaurants: Restaurant[] = []) {
  const searchStep = run.steps.find((s) => s.type === "search_restaurants");
  const aiChoiceStep = run.steps.find((s) => s.type === "choose_candidate_ai");
  const rankStep = run.steps.find((s) => s.type === "rank_options");
  const attemptStep = run.steps.find((s) => s.type === "attempt_booking");

  const unsupportedClaims: string[] = [];
  const unsupportedReasoning: string[] = [];
  let hallucinationPenalty = 0;
  let reasoningPenalty = 0;
  let policyPenalty = 0;
  let constraintPenalty = 0;
  let escalationPenalty = 0;

  const candidates = Array.isArray(searchStep?.output) ? (searchStep!.output as any[]) : [];
  const rankedCandidates = Array.isArray(rankStep?.output) ? (rankStep!.output as any[]) : [];
  const aiChoice = aiChoiceStep?.output as any | undefined;
  const finalOutcome = attemptStep?.output as any | undefined;
  const outcome = ((run.finalOutcome as any)?.outcome ?? finalOutcome?.outcome) as string | undefined;
  const rationale: string[] = aiChoice?.rationale ?? [];

  const chosenCandidate =
    aiChoice?.chosenRestaurantId
      ? candidates.find((c) => c.restaurantId === aiChoice.chosenRestaurantId)
      : null;

  // Best available for soft preference evaluation — AI's choice, or top-ranked if AI declined
  const bestCandidate = chosenCandidate ?? (rankedCandidates[0] ?? null);

  const chosenRestaurant = chosenCandidate
    ? restaurants.find((r) => r.id === chosenCandidate.restaurantId) ?? null
    : null;

  const bestRestaurant = bestCandidate
    ? restaurants.find((r) => r.id === bestCandidate.restaurantId) ?? null
    : null;

  // — Reasoning grounding: quiet
  const mentionsQuiet = rationale.some((r) => r.toLowerCase().includes("quiet"));
  const mentionsOutdoorAsQuiet = rationale.some((r) => {
    const t = r.toLowerCase();
    return t.includes("outdoor") && t.includes("quiet");
  });

  if (mentionsQuiet && chosenRestaurant) {
    if (chosenRestaurant.noiseLevel !== "low") {
      reasoningPenalty += 25;
      unsupportedReasoning.push(
        `AI claimed the restaurant is quiet but noiseLevel is "${chosenRestaurant.noiseLevel}", not "low".`
      );
    }
  }

  if (mentionsOutdoorAsQuiet) {
    reasoningPenalty += 15;
    unsupportedReasoning.push(
      "AI used outdoor seating as a proxy for quietness instead of citing the noiseLevel field."
    );
  }

  // — Reasoning grounding: outdoor
  const mentionsOutdoor = rationale.some((r) => r.toLowerCase().includes("outdoor"));
  if (mentionsOutdoor && chosenRestaurant && !chosenRestaurant.hasOutdoorSeating) {
    const claimsOutdoorPositively = rationale.some((r) => {
      const t = r.toLowerCase();
      return t.includes("outdoor") && !t.includes("false") && !t.includes("unmet") && !t.includes("not");
    });
    if (claimsOutdoorPositively) {
      reasoningPenalty += 20;
      unsupportedReasoning.push(
        "AI rationale mentioned outdoor seating positively but restaurant.hasOutdoorSeating is false."
      );
    }
  }

  // — Reasoning grounding: budget claim
  const mentionsBudget = rationale.some((r) =>
    r.toLowerCase().includes("budget") || r.toLowerCase().includes("within")
  );
  if (
    mentionsBudget &&
    chosenRestaurant &&
    run.parsedRequest?.maxPricePerPerson &&
    chosenRestaurant.avgPricePerPerson > run.parsedRequest.maxPricePerPerson
  ) {
    reasoningPenalty += 30;
    unsupportedReasoning.push(
      `AI claimed the restaurant is within budget but $${chosenRestaurant.avgPricePerPerson} > $${run.parsedRequest.maxPricePerPerson}.`
    );
  }

  // — Hard outdoor constraint
  if (run.parsedRequest?.requiredFeatures?.includes("outdoor") && chosenCandidate) {
    if (!chosenRestaurant?.hasOutdoorSeating) {
      policyPenalty += 20;
      constraintPenalty += 30;
      unsupportedClaims.push(
        "Chosen restaurant does not have outdoor seating but outdoor was a required feature."
      );
    }
  }

  // — Confirmed booking checks
  if (outcome === "confirmed") {
    if (!chosenCandidate) {
      hallucinationPenalty += 60;
      unsupportedClaims.push("Booking was confirmed but no grounded candidate was chosen.");
    }
    if (chosenCandidate && finalOutcome?.restaurantId !== chosenCandidate.restaurantId) {
      hallucinationPenalty += 40;
      unsupportedClaims.push("Confirmed restaurant does not match the chosen candidate.");
    }
    if (chosenCandidate && !chosenCandidate.availableTimes?.includes(finalOutcome?.time)) {
      hallucinationPenalty += 40;
      unsupportedClaims.push("Confirmed time was not present in the candidate's available times.");
    }
    if (chosenRestaurant?.requiresPhoneConfirmation) {
      hallucinationPenalty += 50;
      policyPenalty += 50;
      unsupportedClaims.push(
        "Booking was confirmed in text mode but restaurant.requiresPhoneConfirmation is true."
      );
    }
    if (!finalOutcome?.confirmationCode) {
      hallucinationPenalty += 20;
      unsupportedClaims.push("Confirmed booking is missing a confirmation code.");
    }
  }

  // — Escalation: phone_only but AI didn't flag it
  if (outcome === "phone_only" && aiChoice?.shouldEscalate === false) {
    escalationPenalty += 25;
    unsupportedClaims.push(
      "Run correctly escalated to phone-only but AI choice did not mark shouldEscalate."
    );
  }

  // — Ambiguity ignored
  if (run.parsedRequest?.ambiguityFlags?.length && outcome !== "clarification_required") {
    constraintPenalty += 20;
    unsupportedClaims.push(
      "Request had ambiguity flags but agent proceeded without requesting clarification."
    );
  }

  // — Task completion
  const taskCompletionScore = ((): number => {
    switch (outcome) {
      case "confirmed":               return 100;
      case "phone_only":              return 65;
      case "needs_user_confirmation": return 50;
      case "clarification_required":  return 40;
      case "policy_blocked":          return 30;
      case "unavailable":             return 20;
      case "failed_gracefully":       return 10;
      default:                        return 0;
    }
  })();

  // — Soft preference satisfaction (against best available candidate, not just confirmed)
  const softPrefs = run.parsedRequest?.softPreferences ?? [];
  const softPreferenceSatisfactionScore = ((): number => {
    if (softPrefs.length === 0) return 100;
    if (!bestRestaurant) return 0;

    let satisfied = 0;
    for (const pref of softPrefs) {
      const p = pref.toLowerCase();
      if (p.includes("outdoor")) {
        if (bestRestaurant.hasOutdoorSeating) satisfied++;
      } else if (p.includes("quiet")) {
        if (bestRestaurant.noiseLevel === "low") satisfied++;
      } else {
        // Unknown soft preference — conservative, treat as unsatisfied
      }
    }
    return Math.round((satisfied / softPrefs.length) * 100);
  })();

  // — Automation completion status
  const automationCompletion = ((): AutomationCompletion => {
    switch (outcome) {
      case "confirmed":               return "completed";
      case "phone_only":              return "handoff_required";
      case "needs_user_confirmation": return "handoff_required";
      case "clarification_required":  return "needs_clarification";
      case "policy_blocked":          return "blocked";
      case "unavailable":             return "no_valid_candidate";
      default:                        return "blocked";
    }
  })();

  return {
    hallucinationScore: Math.max(0, 100 - hallucinationPenalty),
    reasoningGroundingScore: Math.max(0, 100 - reasoningPenalty),
    policyComplianceScore: Math.max(0, 100 - policyPenalty),
    constraintSatisfactionScore: Math.max(0, 100 - constraintPenalty),
    escalationQualityScore: Math.max(0, 100 - escalationPenalty),
    taskCompletionScore,
    softPreferenceSatisfactionScore,
    automationCompletion,
    unsupportedClaims,
    unsupportedReasoning,
  };
}
