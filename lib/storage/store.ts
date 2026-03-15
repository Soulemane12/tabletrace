"use client";

import { STORAGE_KEYS } from "./keys";
import type { AppState } from "./types";
import { seedAppState } from "@/lib/booking/seed-data";

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadState(): AppState {
  if (!isBrowser()) return seedAppState();

  const raw = window.localStorage.getItem(STORAGE_KEYS.APP_STATE);
  if (!raw) {
    const seeded = seedAppState();
    saveState(seeded);
    return seeded;
  }

  try {
    return JSON.parse(raw) as AppState;
  } catch {
    const seeded = seedAppState();
    saveState(seeded);
    return seeded;
  }
}

export function saveState(state: AppState) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEYS.APP_STATE, JSON.stringify(state));
}

export function resetState() {
  const seeded = seedAppState();
  saveState(seeded);
  return seeded;
}

export function updateState(updater: (prev: AppState) => AppState): AppState {
  const current = loadState();
  const next = updater(current);
  saveState(next);
  return next;
}
