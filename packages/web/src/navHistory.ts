/**
 * Back/Forward across this window's places (sessions, files, changes, pages), like a browser's
 * history: it moves by *when you were there*, not by tab position (that is Next/Previous tab).
 * Per window and in memory only; it never starts, stops or relaunches anything. A place that has
 * since closed is skipped, and a jump to a file or terminal is just the existing tab activation.
 */
import { fileTabKey, useFileTabs } from "./fileTabs";
import { effectiveWorkspace, usePerchStore } from "./store";
import { activateTab } from "./workspaceTabs";

/** `id` is a session id or a `fileTabKey`, the same ids the tab strip uses. */
export interface Place { id: string; kind: "session" | "resource" }

const MAX_PLACES = 50;
/** Intermediate states of one tab switch (old session with the new workspace…) must not be recorded. */
const SETTLE_MS = 150;
/** A jump whose session loads asynchronously is not recorded as a new visit while it lands. Arrival
 * ends it at once; this only bounds a jump that never arrives, so a real switch is not lost for long. */
const LAND_MS = 1500;

export class NavHistory {
  private places: Place[] = [];
  private at = -1;

  get current(): Place | undefined { return this.places[this.at]; }

  clear(): void { this.places = []; this.at = -1; }

  /** A visit: forward history is dropped, as in a browser. */
  record(place: Place): void {
    if (this.current?.id === place.id) return;
    this.places.length = this.at + 1;
    this.places.push(place);
    if (this.places.length > MAX_PLACES) this.places.shift();
    this.at = this.places.length - 1;
  }

  /** The nearest place in `dir` that still `exists`; closed ones are skipped. */
  step(dir: 1 | -1, exists: (place: Place) => boolean): Place | undefined {
    for (let i = this.at + dir; i >= 0 && i < this.places.length; i += dir) {
      const place = this.places[i]!;
      if (exists(place)) { this.at = i; return place; }
    }
    return undefined;
  }
}

export const navHistory = new NavHistory();
let timer: ReturnType<typeof setTimeout> | undefined;
let landing: { place: Place; until: number } | null = null;

/** For tests: forget every place and any jump in flight. */
export function resetNavHistory(): void {
  clearTimeout(timer);
  navHistory.clear();
  landing = null;
}

function shown(): Place | null {
  const { sessionId, sessions } = usePerchStore.getState();
  const { active, tabs } = useFileTabs.getState();
  if (active) return tabs.some((tab) => fileTabKey(tab) === active) ? { id: active, kind: "resource" } : null;
  return sessionId && sessions.some((session) => session.id === sessionId) ? { id: sessionId, kind: "session" } : null;
}

/** Record what is on screen now (unless a jump is still landing). */
export function settleNavHistory(): void {
  clearTimeout(timer);
  const place = shown();
  if (!place) return;
  if (landing) {
    if (place.id !== landing.place.id && Date.now() < landing.until) return;
    landing = null;
  }
  navHistory.record(place);
}

function exists(place: Place): boolean {
  return place.kind === "session"
    ? usePerchStore.getState().sessions.some((session) => session.id === place.id)
    : useFileTabs.getState().tabs.some((tab) => fileTabKey(tab) === place.id);
}

function go(dir: 1 | -1): void {
  settleNavHistory(); // the place being left counts as visited
  const place = navHistory.step(dir, exists);
  if (!place) return;
  landing = { place, until: Date.now() + LAND_MS };
  const state = usePerchStore.getState();
  if (place.kind === "session") {
    const session = state.sessions.find((candidate) => candidate.id === place.id);
    if (session) activateTab({ id: session.id, kind: "session", session });
    return;
  }
  const tab = useFileTabs.getState().tabs.find((candidate) => fileTabKey(candidate) === place.id);
  if (!tab) return;
  // Same order as reopening a closed tab: focusing a nest resets the shown file, so focus first.
  if (tab.workspaceId !== effectiveWorkspace(state)?.id) state.focusWorkspace(tab.workspaceId);
  activateTab({ id: place.id, kind: "resource", tab });
}

export const navBack = () => go(-1);
export const navForward = () => go(1);

const later = () => { clearTimeout(timer); timer = setTimeout(settleNavHistory, SETTLE_MS); };
usePerchStore.subscribe((state, previous) => { if (state.sessionId !== previous.sessionId) later(); });
useFileTabs.subscribe((state, previous) => { if (state.active !== previous.active) later(); });

// Mouse back/forward buttons. The WebView would otherwise run its own (empty) page history.
if (typeof window !== "undefined") {
  window.addEventListener("mouseup", (event) => {
    if (event.button !== 3 && event.button !== 4) return;
    event.preventDefault();
    go(event.button === 3 ? -1 : 1);
  });
}
