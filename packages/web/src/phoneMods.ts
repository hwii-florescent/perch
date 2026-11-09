//! Which of the person's code may run on this device, when it is a phone.
//!
//! A phone (a phone-width window, or any page reached through a relay) keeps its own screens: the phone's stock
//! screens are `stock:mobile-*` (header, switcher, panes, files, terminal keys), and the desktop's screens, layouts
//! and packages never run there. A relay phone keeps its device token in this page's storage, where any code on the
//! page can read it, so even the phone's own screens run a person's copy only after the person turned that on for
//! this phone (Settings > Mods > "Phone screens from my packages"). The choice is this device's storage, not the
//! core's: another phone, or this one after it is paired again, starts with it off.
//!
//! Revoking: switching it off puts Perch's own phone screens back at once (no reload). A phone that loses its pairing
//! (revoked in Settings > Devices on the computer) forgets the choice before it shows the pairing screen, so a new
//! pairing starts with Perch's own screens; the revoked token itself is refused by the core from then on.
import { useSyncExternalStore } from "react";
import { isRelayMode } from "./relay/transport";
import { MOBILE_WIDTH_BREAKPOINT } from "./responsive";

const KEY = "perch.phoneMods";
/** Stock screens drawn only on a phone: `stock:mobile-header`, … */
export const PHONE_SCREEN_PREFIX = "mobile-";
export const isPhoneScreen = (name: string) => name.startsWith(PHONE_SCREEN_PREFIX);

const watchers = new Set<() => void>();
function read(): boolean {
  try { return localStorage.getItem(KEY) === "on"; } catch { return false; }
}

/** Whether the person turned on their packages for this phone's screens. */
export const phoneModsOn = read;

/** Turn this phone's own screens from packages on or off; off is at once. Throws when storage refuses the write,
 * so the switch never shows a state the next load would not have. */
export function setPhoneMods(on: boolean) {
  if (on) localStorage.setItem(KEY, "on");
  else {
    try { localStorage.removeItem(KEY); } catch { /* nothing stored: already off */ }
  }
  watchers.forEach((watch) => watch());
}

const subscribe = (watch: () => void) => {
  watchers.add(watch);
  // Another tab of this phone changing it counts too.
  const onStorage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) watch(); };
  window.addEventListener("storage", onStorage);
  return () => { watchers.delete(watch); window.removeEventListener("storage", onStorage); };
};
export const usePhoneModsOn = () => useSyncExternalStore(subscribe, read, () => false);

/** Phone width, as `responsive.ts` draws the phone's shell (false where the page cannot tell: no `matchMedia`). */
const narrowQuery = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(`(max-width: ${MOBILE_WIDTH_BREAKPOINT}px)`) : null);
const narrow = () => narrowQuery()?.matches ?? false;
const subscribeNarrow = (watch: () => void) => {
  const query = narrowQuery();
  query?.addEventListener?.("change", watch);
  return () => query?.removeEventListener?.("change", watch);
};

/** This page is a phone: phone-width, or reached through a relay (a paired device whose token is in storage). */
export const isPhoneDevice = () => isRelayMode() || narrow();
export function useIsPhoneDevice() {
  return useSyncExternalStore(subscribeNarrow, narrow, () => false) || isRelayMode();
}

/** Whether a person's package may run here for stock screen `name` (`null`: not for a stock screen: a layout block,
 * a docked or hidden package, an overlay). A desktop runs every person's package except on phone screens; a phone runs
 * only a copy chosen for one of its own screens, and only once turned on for this phone. */
export function personCodeAllowed(phone: boolean, optedIn: boolean, name: string | null) {
  if (!phone) return name === null || !isPhoneScreen(name);
  return name !== null && isPhoneScreen(name) && optedIn;
}
