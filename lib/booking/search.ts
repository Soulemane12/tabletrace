import type { AppState, BookingRequest, Candidate } from "@/lib/storage/types";
import { violatesHardConstraints } from "@/lib/policy/rules";

export function searchRestaurants(state: AppState, req: BookingRequest): Candidate[] {
  const candidates: Candidate[] = [];

  for (const restaurant of state.restaurants) {
    const slots = state.slots.filter(
      (slot) =>
        slot.restaurantId === restaurant.id &&
        slot.date === req.date &&
        slot.time >= req.timeWindowStart &&
        slot.time <= req.timeWindowEnd
    );

    const validSlots = slots.filter((slot) => !violatesHardConstraints(req, restaurant, slot));
    if (validSlots.length === 0) continue;

    const explanation: string[] = [];
    const warnings: string[] = [];

    if (restaurant.neighborhood === req.neighborhood) explanation.push("Matches neighborhood");
    if (restaurant.avgPricePerPerson <= req.maxPricePerPerson) explanation.push("Within budget");
    if (restaurant.hasOutdoorSeating) explanation.push("Outdoor seating available");
    if (restaurant.requiresPhoneConfirmation) warnings.push("Requires phone confirmation");

    candidates.push({
      restaurantId: restaurant.id,
      name: restaurant.name,
      cuisine: restaurant.cuisine,
      neighborhood: restaurant.neighborhood,
      avgPricePerPerson: restaurant.avgPricePerPerson,
      availableTimes: validSlots.map((s) => s.time),
      hasOutdoorSeating: restaurant.hasOutdoorSeating,
      requiresPhoneConfirmation: restaurant.requiresPhoneConfirmation,
      noiseLevel: restaurant.noiseLevel,
      explanation,
      warnings,
      score: 0,
    });
  }

  return candidates;
}
