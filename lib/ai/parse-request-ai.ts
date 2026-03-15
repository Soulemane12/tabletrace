import { zodTextFormat } from "openai/helpers/zod";
import { openai } from "@/lib/server/openai";
import { BookingRequestSchema } from "./schemas";

export async function parseRequestAI(rawInput: string) {
  const today = new Date().toISOString().split("T")[0];

  const response = await openai.responses.parse({
    model: "gpt-4o",
    input: [
      {
        role: "system",
        content:
          `Extract a restaurant booking request into the required schema. Today's date is ${today}. ` +
          "Resolve relative dates like 'tomorrow' or 'this Friday' into YYYY-MM-DD format. " +
          "Do not invent missing facts. Only add an ambiguity flag if a field is truly missing or unresolvable. " +
          "Times as HH:MM (24h). If the user says 'after 7 PM', set timeWindowStart to '19:00' and timeWindowEnd to '23:00'. " +
          "Always set timeWindowEnd — default to '23:00' if the user does not specify a closing time. " +
          "Cuisines should be lowercase singular (e.g. 'japanese', 'italian'). " +
          "'no sushi' means excludedCuisines includes 'sushi' AND 'japanese'. " +
          "IMPORTANT — hard vs soft constraints: " +
          "requiredFeatures is ONLY for absolute requirements: 'must have outdoor', 'outdoor required', 'wheelchair accessible', 'private dining room required'. " +
          "softPreferences is for wishes and preferences: 'outdoor if possible', 'prefer outdoor', 'quiet if possible', 'ideally outdoor', 'outdoor preferred'. " +
          "The phrase 'outdoor if possible' is a soft preference, NOT a required feature. " +
          "When in doubt, put it in softPreferences.",
      },
      {
        role: "user",
        content: rawInput,
      },
    ],
    text: {
      format: zodTextFormat(BookingRequestSchema, "booking_request"),
    },
  });

  return response.output_parsed;
}
