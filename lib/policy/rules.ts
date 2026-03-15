import type { BookingRequest, Restaurant, AvailabilitySlot } from "@/lib/storage/types";

export function normalizeRequiredFeatures(features: string[]): string[] {
  return features.map((f) => {
    const v = f.toLowerCase().trim();
    if (v === "outdoor seating") return "outdoor";
    return v;
  });
}

export function violatesHardConstraints(
  req: BookingRequest,
  restaurant: Restaurant,
  slot: AvailabilitySlot
): string | null {
  if (restaurant.neighborhood !== req.neighborhood) return "wrong_neighborhood";
  if (restaurant.avgPricePerPerson > req.maxPricePerPerson) return "over_budget";
  if (restaurant.maxPartySize < req.partySize) return "party_too_large";
  if (req.excludedCuisines.includes(restaurant.cuisine.toLowerCase())) return "excluded_cuisine";
  if (!slot.available) return "slot_unavailable";
  if (slot.partySize !== req.partySize) return "party_size_slot_mismatch";

  if (
    req.requiredFeatures.includes("outdoor") ||
    req.requiredFeatures.includes("outdoor seating")
  ) {
    if (!restaurant.hasOutdoorSeating) return "missing_required_outdoor";
  }

  return null;
}
