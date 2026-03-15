import { zodTextFormat } from "openai/helpers/zod";
import { openai } from "@/lib/server/openai";
import { z } from "zod";

const EvalExplanationSchema = z.object({
  notes: z.array(z.string()),
  extraObservations: z.array(z.string()).default([]),
});

export async function explainEvaluationAI(input: {
  parsedRequest: unknown;
  chosenCandidate: unknown;
  chosenRestaurant?: unknown;
  finalOutcome: unknown;
  deterministicScores: {
    hallucinationScore: number;
    policyComplianceScore: number;
    constraintSatisfactionScore: number;
    escalationQualityScore: number;
    unsupportedClaims: string[];
  };
}) {
  const response = await openai.responses.parse({
    model: "gpt-4o",
    input: [
      {
        role: "system",
        content:
          "Explain this booking-agent run briefly using only the provided facts. " +
          "Rules: " +
          "1) A confirmed booking is correct when requiresPhoneConfirmation is false — do not treat this as suspicious. " +
          "2) Do not invent unsupported claims. " +
          "3) If deterministicScores.unsupportedClaims is empty, do not imply hallucination occurred. " +
          "4) If deterministicScores.unsupportedReasoning has entries, note that the choice was correct but some rationale was ungrounded. " +
          "5) Distinguish between: correct outcome with correct reasoning (perfect), correct outcome with flawed reasoning (acceptable), wrong outcome (failure). " +
          "6) When a soft preference was satisfied, cite the explicit field — e.g. 'noiseLevel=low supports the quiet preference'. " +
          "7) Keep notes short and factual. " +
          "8) For phone_only or handoff_required outcomes: do NOT say 'chosen restaurant' or 'final choice'. " +
          "   Say 'best escalation target identified' instead. The booking was NOT completed in text mode. " +
          "   Format: 'Best escalation target identified: [name] meets hard constraints and requires phone confirmation.' " +
          "   Then note 'Booking was not completed in text mode.' " +
          "   Then note any unmet soft preferences separately.",
      },
      {
        role: "user",
        content: JSON.stringify(input),
      },
    ],
    text: {
      format: zodTextFormat(EvalExplanationSchema, "eval_explanation"),
    },
  });

  return response.output_parsed;
}
