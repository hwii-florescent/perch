import { openBlankBrowser } from "./fileTabs";
import { usePerchStore } from "./store";

/** The desktop shell raises this for a `perch://open` link (crates/perch-desktop/src/open_url.rs),
 * which the native client's "Open in Perch" sends. It only navigates to a place on a session this
 * window already knows; it never creates, runs or sends anything. */
export const OPEN_EVENT = "perch:open";

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

/** Show the requested place. A session this window does not know is ignored: switching to an
 * unknown id would mint a new session. */
export function openRequested(detail: unknown): void {
  const request = parseOpenRequest(detail);
  if (!request) return;
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

window.addEventListener(OPEN_EVENT, (event) => openRequested((event as CustomEvent<unknown>).detail));
