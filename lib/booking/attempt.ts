import type { AppState, BookingRequest, Candidate, BookingAttempt } from "@/lib/storage/types";

function confirmationCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function attemptBooking(
  state: AppState,
  req: BookingRequest,
  candidate: Candidate | undefined
): { nextState: AppState; result: BookingAttempt } {
  if (!candidate) {
    return {
      nextState: state,
      result: { outcome: "unavailable", reason: "No candidates matched the request." },
    };
  }

  const restaurant = state.restaurants.find((r) => r.id === candidate.restaurantId);
  if (!restaurant) {
    return {
      nextState: state,
      result: { outcome: "failed_gracefully", reason: "Restaurant record missing." },
    };
  }

  if (restaurant.requiresPhoneConfirmation) {
    return {
      nextState: state,
      result: { outcome: "phone_only", reason: "This venue requires phone confirmation." },
    };
  }

  const chosenTime = candidate.availableTimes[0];
  if (!chosenTime) {
    return {
      nextState: state,
      result: { outcome: "unavailable", reason: "No open slots remained." },
    };
  }

  const nextState: AppState = {
    ...state,
    slots: state.slots.map((slot) =>
      slot.restaurantId === candidate.restaurantId &&
      slot.date === req.date &&
      slot.time === chosenTime &&
      slot.partySize === req.partySize
        ? { ...slot, available: false }
        : slot
    ),
  };

  return {
    nextState,
    result: {
      outcome: "confirmed",
      restaurantId: candidate.restaurantId,
      time: chosenTime,
      confirmationCode: confirmationCode(),
    },
  };
}
