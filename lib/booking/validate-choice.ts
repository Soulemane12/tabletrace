import type { BookingRequest, Candidate, AppState } from "@/lib/storage/types";

export function validateChosenCandidate(
  state: AppState,
  req: BookingRequest,
  candidate: Candidate | undefined
): string | null {
  if (!candidate) return "missing_candidate";

  const restaurant = state.restaurants.find((r) => r.id === candidate.restaurantId);
  if (!restaurant) return "restaurant_not_found";

  if (req.requiredFeatures.includes("outdoor") && !restaurant.hasOutdoorSeating) {
    return "missing_required_outdoor";
  }

  if (req.excludedCuisines.includes(restaurant.cuisine.toLowerCase())) {
    return "excluded_cuisine";
  }

  if (restaurant.avgPricePerPerson > req.maxPricePerPerson) {
    return "over_budget";
  }

  if (restaurant.neighborhood !== req.neighborhood) {
    return "wrong_neighborhood";
  }

  return null;
}
