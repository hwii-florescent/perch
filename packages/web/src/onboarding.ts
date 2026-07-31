/**
 * onboarding.ts — Wave 2 item 11: first-run modal, "seen" flag.
 *
 * Client-only, no protocol involvement: a plain localStorage flag gates
 * whether `Onboarding.tsx` renders on mount. Dismissing it persists the flag
 * so it never shows again on this browser/profile.
 */

const STORAGE_KEY = "perch.onboarding.seen";

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // localStorage unavailable (private mode, SSR, etc.) — default to
    // "seen" so a broken localStorage doesn't nag on every load.
    return true;
  }
}

export function markOnboardingSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore — worst case the modal reappears next launch
  }
}
