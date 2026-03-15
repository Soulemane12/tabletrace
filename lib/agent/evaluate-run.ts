import type { AgentRun, EvalScore, Restaurant } from "@/lib/storage/types";
import { getEvidenceCheck } from "./evidence-check";
import { explainEvaluationAI } from "@/lib/ai/evaluate-run-ai";

export async function evaluateRun(run: AgentRun, restaurants: Restaurant[] = []): Promise<EvalScore> {
  const evidence = getEvidenceCheck(run, restaurants);

  const searchStep = run.steps.find((s) => s.type === "search_restaurants");
  const aiChoiceStep = run.steps.find((s) => s.type === "choose_candidate_ai");
  const candidates = Array.isArray(searchStep?.output) ? (searchStep!.output as any[]) : [];
  const aiChoice = aiChoiceStep?.output as any | undefined;
  const chosenCandidate =
    aiChoice?.chosenRestaurantId
      ? candidates.find((c: any) => c.restaurantId === aiChoice.chosenRestaurantId)
      : null;
  const chosenRestaurant = chosenCandidate
    ? restaurants.find((r) => r.id === chosenCandidate.restaurantId) ?? null
    : null;

  const explanation = await explainEvaluationAI({
    parsedRequest: run.parsedRequest,
    chosenCandidate,
    chosenRestaurant,
    finalOutcome: run.finalOutcome,
    deterministicScores: evidence,
  });

  const safetyScore = Math.round(
    (evidence.hallucinationScore +
      evidence.reasoningGroundingScore +
      evidence.policyComplianceScore +
      evidence.constraintSatisfactionScore +
      evidence.escalationQualityScore) / 5
  );

  const fulfillmentScore = Math.round(
    (evidence.taskCompletionScore + evidence.softPreferenceSatisfactionScore) / 2
  );

  const overallScore = Math.round((safetyScore + fulfillmentScore) / 2);

  return {
    hallucinationScore: evidence.hallucinationScore,
    reasoningGroundingScore: evidence.reasoningGroundingScore,
    policyComplianceScore: evidence.policyComplianceScore,
    constraintSatisfactionScore: evidence.constraintSatisfactionScore,
    escalationQualityScore: evidence.escalationQualityScore,
    safetyScore,
    taskCompletionScore: evidence.taskCompletionScore,
    softPreferenceSatisfactionScore: evidence.softPreferenceSatisfactionScore,
    fulfillmentScore,
    automationCompletion: evidence.automationCompletion,
    overallScore,
    notes: explanation?.notes ?? [],
    unsupportedClaims: evidence.unsupportedClaims,
    unsupportedReasoning: evidence.unsupportedReasoning,
  };
}
