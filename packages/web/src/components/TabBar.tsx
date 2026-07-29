import { usePerchStore } from "../store";
import type { SessionSummary } from "@perch/shared";

const MAX_TAB_LABEL = 24;

/** Short pill label for a tab. Falls back to "New session" for a session
 * with no user messages yet (title is "" until the first chat.send). */
function tabLabel(session: SessionSummary): string {
  const title = session.title.trim();
  if (!title) return "New session";
  return title.length > MAX_TAB_LABEL ? `${title.slice(0, MAX_TAB_LABEL - 1)}…` : title;
}

/**
 * Tab strip for the sessions that belong to the *active project* — the
 * (hostId, cwd) pair of the currently-active session, the closest existing
 * analog to herdr's Workspace/Tab hierarchy (see Sidebar's
 * `groupSessionsByProject`, which this mirrors but scoped to one group).
 *
 * Clicking a tab reuses the existing `switchSession` action (same as the
 * sidebar); the trailing "+" creates a new session in the same project via
 * `createSessionOnHost`.
 */
export function TabBar() {
  const sessionId = usePerchStore((s) => s.sessionId);
  const sessions = usePerchStore((s) => s.sessions);
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const status = usePerchStore((s) => s.status);
  const switchSession = usePerchStore((s) => s.switchSession);
  const createSessionOnHost = usePerchStore((s) => s.createSessionOnHost);

  const currentSession = sessions.find((s) => s.id === sessionId);
  // A brand-new session has no messages yet, so it doesn't appear in
  // sessions[] (Fix 3 defers its DB row insert until the first chat.send).
  // Fall back to the locally-known cwd (status.update, local-only) so a
  // freshly-created "New session" still resolves to the right project
  // instead of showing an empty tab strip.
  const hostId = currentSession?.hostId ?? activeHostId;
  const cwd = currentSession?.cwd ?? (hostId === "local" ? status?.cwd : undefined) ?? null;

  const tabs = cwd
    ? sessions
        .filter((s) => (s.hostId ?? "local") === hostId && s.cwd === cwd)
        .sort((a, b) => a.createdAt - b.createdAt)
    : currentSession
      ? [currentSession]
      : [];

  return (
    <div className="tab-bar" data-testid="tab-bar">
      {tabs.map((s) => (
        <button
          key={s.id}
          type="button"
          className={s.id === sessionId ? "tab-bar__tab tab-bar__tab--active" : "tab-bar__tab"}
          data-testid={`tab-${s.id}`}
          title={s.title || "New session"}
          onClick={() => switchSession(s.id)}
        >
          {tabLabel(s)}
        </button>
      ))}
      <button
        type="button"
        className="tab-bar__new"
        data-testid="tab-new"
        title="New session in this project"
        aria-label="New session in this project"
        onClick={() => createSessionOnHost(hostId, cwd ?? undefined)}
      >
        {"+"}
      </button>
    </div>
  );
}
