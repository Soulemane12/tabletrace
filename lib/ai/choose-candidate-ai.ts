import { zodTextFormat } from "openai/helpers/zod";
import { openai } from "@/lib/server/openai";
import { CandidateChoiceSchema } from "./schemas";

export async function chooseCandidateAI({
  parsedRequest,
  candidates,
}: {
  parsedRequest: unknown;
  candidates: unknown;
}) {
  const response = await openai.responses.parse({
    model: "gpt-4o",
    input: [
      {
        role: "system",
        content:
          "Choose the best restaurant candidate using only the explicit fields provided in each candidate object. " +
          "Rules: " +
          "1) A required feature must be explicitly present as a field value to count as satisfied. " +
          "2) Never assume a feature exists because it is not excluded or not mentioned. " +
          "3) Do not invent availability, seating, policies, price, or cuisine details. " +
          "4) If no candidate satisfies all hard constraints, set shouldEscalate to true. " +
          "5) If the chosen candidate has requiresPhoneConfirmation=true, set shouldEscalate to true. " +
          "6) When explaining soft preferences in rationale, cite only explicit field values. " +
          "   - For 'quiet': cite noiseLevel field value (e.g. noiseLevel=low). Do NOT use outdoor seating as a proxy for quietness. " +
          "   - For 'outdoor': cite hasOutdoorSeating=true. " +
          "   - For 'budget': cite avgPricePerPerson <= maxPricePerPerson. " +
          "7) If a soft preference is not supported by an explicit field, state it is unmet or uncertain — do not infer it from unrelated fields.",
      },
      {
        role: "user",
        content: JSON.stringify({ parsedRequest, candidates }),
      },
    ],
    text: {
      format: zodTextFormat(CandidateChoiceSchema, "candidate_choice"),
    },
  });

  return response.output_parsed;
}
