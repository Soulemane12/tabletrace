import type { AppState } from "@/lib/storage/types";

export function seedAppState(): AppState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    restaurants: [
      {
        id: "r1",
        name: "Luma Terrace",
        neighborhood: "SoHo",
        cuisine: "Italian",
        avgPricePerPerson: 62,
        hasOutdoorSeating: true,
        requiresPhoneConfirmation: false,
        maxPartySize: 6,
        noiseLevel: "medium",
        rating: 4.6,
      },
      {
        id: "r2",
        name: "Sora Garden",
        neighborhood: "SoHo",
        cuisine: "Japanese",
        avgPricePerPerson: 58,
        hasOutdoorSeating: true,
        requiresPhoneConfirmation: false,
        maxPartySize: 4,
        noiseLevel: "low",
        rating: 4.5,
      },
      {
        id: "r3",
        name: "Mercer House",
        neighborhood: "SoHo",
        cuisine: "American",
        avgPricePerPerson: 68,
        hasOutdoorSeating: false,
        requiresPhoneConfirmation: true,
        maxPartySize: 8,
        noiseLevel: "high",
        rating: 4.7,
      },
    ],
    slots: [
      { id: "s1", restaurantId: "r1", date: today, time: "19:30", partySize: 4, available: true },
      { id: "s2", restaurantId: "r1", date: today, time: "20:30", partySize: 4, available: true },
      { id: "s3", restaurantId: "r2", date: today, time: "19:00", partySize: 4, available: true },
      { id: "s4", restaurantId: "r3", date: today, time: "20:00", partySize: 4, available: true },
    ],
    runs: [],
  };
}
