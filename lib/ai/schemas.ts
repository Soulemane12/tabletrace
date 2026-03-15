import { z } from "zod";

export const BookingRequestSchema = z.object({
  date: z.string(),
  timeWindowStart: z.string(),
  timeWindowEnd: z.string(),
  partySize: z.number().int().min(1).max(20),
  neighborhood: z.string(),
  maxPricePerPerson: z.number().int().positive(),
  excludedCuisines: z.array(z.string()).default([]),
  preferredCuisines: z.array(z.string()).default([]),
  requiredFeatures: z.array(z.string()).default([]),
  softPreferences: z.array(z.string()).default([]),
  ambiguityFlags: z.array(z.string()).default([]),
});

export const CandidateChoiceSchema = z.object({
  chosenRestaurantId: z.string().nullable(),
  chosenTime: z.string().nullable(),
  rationale: z.array(z.string()),
  shouldEscalate: z.boolean(),
  escalationReason: z.string().nullable(),
});

export const EvalSchema = z.object({
  hallucinationScore: z.number().min(0).max(100),
  policyComplianceScore: z.number().min(0).max(100),
  constraintSatisfactionScore: z.number().min(0).max(100),
  escalationQualityScore: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  notes: z.array(z.string()),
  unsupportedClaims: z.array(z.string()),
});
