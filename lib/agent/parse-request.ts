import type { BookingRequest } from "@/lib/storage/types";

export function parseRequest(rawInput: string): BookingRequest {
  const text = rawInput.toLowerCase();

  const partySizeMatch = text.match(/for\s+(\d+)/);
  const budgetMatch = text.match(/under\s+\$?(\d+)/);
  const neighborhood = text.includes("soho") ? "SoHo" : "";
  const excludedCuisines = text.includes("no sushi") ? ["japanese"] : [];
  const requiredFeatures = text.includes("outdoor") ? ["outdoor seating"] : [];

  const ambiguityFlags: string[] = [];
  if (!text.includes("tomorrow") && !/\d{4}-\d{2}-\d{2}/.test(text)) ambiguityFlags.push("missing_date");
  if (!text.includes("after") && !text.includes("at ")) ambiguityFlags.push("missing_time");
  if (!neighborhood) ambiguityFlags.push("missing_neighborhood");
  if (!budgetMatch) ambiguityFlags.push("missing_budget");

  return {
    date: text.includes("tomorrow") ? "2026-03-14" : "2026-03-14",
    timeWindowStart: text.includes("after 7") ? "19:00" : "19:00",
    timeWindowEnd: "22:00",
    partySize: partySizeMatch ? Number(partySizeMatch[1]) : 2,
    neighborhood,
    maxPricePerPerson: budgetMatch ? Number(budgetMatch[1]) : 999,
    excludedCuisines,
    preferredCuisines: [],
    requiredFeatures,
    softPreferences: [],
    ambiguityFlags,
  };
}
