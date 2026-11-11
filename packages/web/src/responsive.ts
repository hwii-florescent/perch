/**
 * responsive.ts — which page is a phone. `App.tsx` swaps the desktop `<Sidebar/>`+`<TabBar/>` chrome for the phone's
 * own screens (`stock:mobile-*`) on a phone, and nothing else decides it.
 *
 * A phone is a narrow window, a touch phone turned sideways (coarse pointer, no hover, little height: a wide but
 * short screen), or any page reached through a relay. Rotating a phone therefore never unlocks the desktop's layout;
 * a tablet, which has the room, and a mouse-driven window keep it.
 *
 * Backed by `matchMedia` (not a resize listener + manual width check) so it fires exactly on crossings and works
 * with the same `page.setViewportSize()`-driven resize events Playwright dispatches.
 */
import { useSyncExternalStore } from "react";
import { isRelayMode } from "./relay/transport";

export const MOBILE_WIDTH_BREAKPOINT = 700;

/** Narrow, or a phone on its side: touch-only input with a short screen. */
export const PHONE_QUERY = `(max-width: ${MOBILE_WIDTH_BREAKPOINT}px), (pointer: coarse) and (hover: none) and (max-height: 500px)`;

const phoneQuery = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(PHONE_QUERY) : null);

const subscribe = (watch: () => void) => {
  const query = phoneQuery();
  // Safari <14 only has the deprecated listener API.
  if (query?.addEventListener) query.addEventListener("change", watch);
  else query?.addListener?.(watch);
  return () => {
    if (query?.removeEventListener) query.removeEventListener("change", watch);
    else query?.removeListener?.(watch);
  };
};

/** This page is a phone (false where the page cannot tell: no `matchMedia`). */
export const isPhoneDevice = () => isRelayMode() || (phoneQuery()?.matches ?? false);

/** A phone proper: reached through a relay, or touch-only input in the phone layout. A narrow mouse-driven window has
 * the phone's layout but is still the computer, so it keeps the computer's settings (`chatMode.ts`). */
const touchQuery = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(pointer: coarse)") : null);
export const isTouchPhone = () => isRelayMode() || (isPhoneDevice() && (touchQuery()?.matches ?? false));
const subscribeTouch = (watch: () => void) => {
  const query = touchQuery();
  query?.addEventListener?.("change", watch);
  const off = subscribe(watch);
  return () => { query?.removeEventListener?.("change", watch); off(); };
};
export function useIsTouchPhone(): boolean {
  return useSyncExternalStore(subscribeTouch, isTouchPhone, () => false);
}

/** `isPhoneDevice`, live as the window crosses the query (resize, rotation, a test's `setViewportSize()`). */
export function useIsMobileWidth(): boolean {
  return useSyncExternalStore(subscribe, isPhoneDevice, () => false);
}
