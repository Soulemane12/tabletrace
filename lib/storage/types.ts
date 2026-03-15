export type BookingRequest = {
  date: string;
  timeWindowStart: string;
  timeWindowEnd: string;
  partySize: number;
  neighborhood: string;
  maxPricePerPerson: number;
  excludedCuisines: string[];
  preferredCuisines: string[];
  requiredFeatures: string[];
  softPreferences: string[];
  ambiguityFlags: string[];
};

export type Restaurant = {
  id: string;
  name: string;
  neighborhood: string;
  cuisine: string;
  avgPricePerPerson: number;
  hasOutdoorSeating: boolean;
  requiresPhoneConfirmation: boolean;
  maxPartySize: number;
  noiseLevel: "low" | "medium" | "high";
  rating: number;
};

export type AvailabilitySlot = {
  id: string;
  restaurantId: string;
  date: string;
  time: string;
  partySize: number;
  available: boolean;
};

export type Candidate = {
  restaurantId: string;
  name: string;
  cuisine: string;
  neighborhood: string;
  avgPricePerPerson: number;
  availableTimes: string[];
  hasOutdoorSeating: boolean;
  requiresPhoneConfirmation: boolean;
  noiseLevel: "low" | "medium" | "high";
  explanation: string[];
  warnings: string[];
  score: number;
};

export type BookingAttempt =
  | { outcome: "confirmed"; restaurantId: string; time: string; confirmationCode: string }
  | { outcome: "unavailable"; reason: string }
  | { outcome: "needs_user_confirmation"; reason: string }
  | { outcome: "phone_only"; reason: string }
  | { outcome: "policy_blocked"; reason: string }
  | { outcome: "clarification_required"; reason: string }
  | { outcome: "failed_gracefully"; reason: string };

export type ToolStep = {
  id: string;
  type:
    | "parse_request"
    | "get_context"
    | "search_restaurants"
    | "rank_options"
    | "choose_candidate_ai"
    | "validate_choice"
    | "attempt_booking"
    | "evidence_check"
    | "evaluate_run";
  input: unknown;
  output: unknown;
  success: boolean;
  createdAt: string;
};

export type AutomationCompletion =
  | "completed"
  | "handoff_required"
  | "blocked"
  | "needs_clarification"
  | "no_valid_candidate";

export type EvalScore = {
  // Safety — did the agent behave correctly?
  hallucinationScore: number;
  reasoningGroundingScore: number;
  policyComplianceScore: number;
  constraintSatisfactionScore: number;
  escalationQualityScore: number;
  safetyScore: number;

  // Fulfillment — did the user get what they asked for?
  taskCompletionScore: number;
  softPreferenceSatisfactionScore: number;
  fulfillmentScore: number;

  automationCompletion: AutomationCompletion;
  overallScore: number;

  notes: string[];
  unsupportedClaims: string[];
  unsupportedReasoning: string[];
};

export type AgentRun = {
  id: string;
  rawInput: string;
  parsedRequest: BookingRequest | null;
  finalOutcome: BookingAttempt | null;
  steps: ToolStep[];
  evaluation: EvalScore | null;
  createdAt: string;
};

export type AppState = {
  restaurants: Restaurant[];
  slots: AvailabilitySlot[];
  runs: AgentRun[];
};
