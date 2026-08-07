// First-run tour persistence. Same pattern as lib/apiKeys.ts: per-browser localStorage,
// wrapped in try/catch because storage can be unavailable (private mode, quota). Both
// failure modes err toward NOT showing the tour — a broken tour on every visit is worse
// than a missed one.
const STORAGE_KEY = "promptforge:tour-seen";

/** True once this browser has seen (or skipped) the tour. */
export function hasSeenTour(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markTourSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Storage unavailable — the tour will offer itself again next visit, which is fine.
  }
}
