import { openBlankBrowser } from "./fileTabs";
import { tauriInvoke } from "./links";
import { usePerchStore } from "./store";

/** The desktop shell raises this for a `perch://open` link (crates/perch-desktop/src/open_url.rs),
 * which the native client's "Open in Perch" sends. It only navigates to a place on a session this
 * window already knows; it never creates, runs or sends anything. A link that launched the app
 * arrives before this page listens, so the shell keeps it and `claimLaunchRequest` asks for it. */
export const OPEN_EVENT = "perch:open";

/** How long a link to a session this window does not know yet waits for the session list. */
export const HOLD_MS = 15_000;

const PLACES = ["files", "changes", "browser", "chat", "settings"] as const;
export type OpenPlace = (typeof PLACES)[number];
export interface OpenRequest { place: OpenPlace; session?: string }

const SESSION_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/** The request in an event's detail, or undefined for anything that is not a known place and,
 * when given, a well-formed session id. */
export function parseOpenRequest(detail: unknown): OpenRequest | undefined {
  if (typeof detail !== "object" || detail === null) return;
  const { place, session } = detail as Record<string, unknown>;
  if (!PLACES.some((known) => known === place)) return;
  if (session === undefined || session === null) return { place: place as OpenPlace };
  return typeof session === "string" && SESSION_ID.test(session) ? { place: place as OpenPlace, session } : undefined;
}

let held: { request: OpenRequest; timer: ReturnType<typeof setTimeout> } | undefined;

function drop(): void {
  if (held) clearTimeout(held.timer);
  held = undefined;
}

/** Whether the request can be shown now: settings always, a place only on a listed session. */
const ready = ({ place, session }: OpenRequest) => place === "settings" || usePerchStore.getState().sessions.some((known) => known.id === session);

/** Show the requested place. A session this window does not know is not switched to (that would
 * mint a new session): the link waits for the session list, which on a cold start has not
 * arrived yet, and is dropped if the session is still unknown after `HOLD_MS`. */
export function openRequested(detail: unknown): void {
  const request = parseOpenRequest(detail);
  if (!request) return;
  drop();
  if (ready(request)) show(request);
  else held = { request, timer: setTimeout(drop, HOLD_MS) };
}

function show(request: OpenRequest): void {
  const state = usePerchStore.getState();
  if (request.place === "settings") return state.setSettingsOpen(true);
  const session = state.sessions.find((candidate) => candidate.id === request.session);
  if (!session) return;
  state.switchSession(session.id);
  const workspaceId = session.workspaceId;
  if (!workspaceId) return;
  // Chat is the session itself, so opening it is all there is to do.
  if (request.place === "files") state.openWorkspaceFiles(workspaceId);
  else if (request.place === "changes") state.openWorkspaceGitReview(workspaceId);
  else if (request.place === "browser") openBlankBrowser(workspaceId);
}

/** Ask the shell for the link that launched the app, once the listener below is in place. */
export function claimLaunchRequest(invoke: typeof tauriInvoke = tauriInvoke): void {
  void invoke?.("open_ready").then(openRequested, () => {});
}

window.addEventListener(OPEN_EVENT, (event) => openRequested((event as CustomEvent<unknown>).detail));
// A held link is shown once its session is listed, and only once.
usePerchStore.subscribe(() => {
  const waiting = held;
  if (!waiting || !ready(waiting.request)) return;
  // Forgotten before it is shown: showing changes the store, which calls this again.
  drop();
  show(waiting.request);
});
claimLaunchRequest();
