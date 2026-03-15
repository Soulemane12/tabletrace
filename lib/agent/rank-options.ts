import type { BookingRequest, AppState, Candidate } from "@/lib/storage/types";

export function rankOptions(state: AppState, req: BookingRequest, candidates: Candidate[]): Candidate[] {
  return candidates
    .map((candidate) => {
      const restaurant = state.restaurants.find((r) => r.id === candidate.restaurantId)!;
      let score = 0;

      if (candidate.neighborhood === req.neighborhood) score += 40;
      if (candidate.avgPricePerPerson <= req.maxPricePerPerson) score += 30;

      // Hard required features: missing one is nearly disqualifying
      if (req.requiredFeatures.includes("outdoor")) {
        if (restaurant.hasOutdoorSeating) score += 20;
        else score -= 100;
      }

      // Soft preferences: bonus if satisfied, no penalty if not
      const wantsOutdoor = req.softPreferences.some((p) =>
        p.toLowerCase().includes("outdoor")
      );
      if (wantsOutdoor && !req.requiredFeatures.includes("outdoor")) {
        if (restaurant.hasOutdoorSeating) score += 15;
      }

      const wantsQuiet = req.softPreferences.some((p) =>
        p.toLowerCase().includes("quiet")
      );
      if (wantsQuiet) {
        if (restaurant.noiseLevel === "low") score += 10;
        else if (restaurant.noiseLevel === "high") score -= 5;
      }

      if (restaurant.requiresPhoneConfirmation) score -= 25;
      if (candidate.availableTimes.includes(req.timeWindowStart)) score += 10;

      score += Math.round((restaurant.rating - 4) * 10);

      return { ...candidate, score };
    })
    .sort((a, b) => b.score - a.score);
}
