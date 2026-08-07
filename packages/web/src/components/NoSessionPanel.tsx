/**
 * NoSessionPanel.tsx — Bug 2 fix. What the chat pane shows when there is
 * genuinely no active session (`sessionId === null`): after deleting the last
 * remaining session, `switchAwayFromActiveSession` (store.ts) correctly falls
 * back to `sessionId: null` when nothing is left to switch to, but the chat
 * view used to render its normal (disabled) composer with a placeholder that
 * just said "Connecting..." — misleading, since the WebSocket is connected
 * and nothing is pending; it was a dead end with no way out.
 *
 * Two distinct situations reach here and must not share a message (per
 * CLAUDE.md's `connected` boolean already existing precisely to distinguish
 * them):
 *  - genuinely disconnected — the composer *was* right to say something like
 *    "Connecting...", just not this unconditionally;
 *  - connected, but with no session open — give the user a real way out
 *    (create one in the active project) rather than a disabled input.
 *
 * Structured the same way as `CliStartPanel` (its closest precedent): a
 * centered card, a title, a one-line hint, and a primary action button.
 *
 * Bug 2/3 fix: also the primary place to pick claude vs codex for the session
 * this button is about to create — this is exactly the "no projects, no
 * session open" repro from the bug report, so it carries the canonical
 * `new-session-agent-{claude,codex}` testids (see `AgentPicker`).
 */
import { useState } from "react";
import type { AgentKind } from "@perch/shared";
import { usePerchStore, effectiveActiveProject } from "../store";
import { AgentPicker } from "./AgentPicker";

function basename(path: string): string {
  const parts = path.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || path;
}

export function NoSessionPanel({ connected }: { connected: boolean }) {
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const createSessionOnHost = usePerchStore((s) => s.createSessionOnHost);
  const project = usePerchStore((s) => effectiveActiveProject(s));
  const lastAgentChoice = usePerchStore((s) => s.lastAgentChoice);
  const setLastAgentChoice = usePerchStore((s) => s.setLastAgentChoice);
  const [selectedAgent, setSelectedAgent] = useState<AgentKind>(lastAgentChoice);

  if (!connected) {
    return (
      <div className="no-session" data-testid="no-session-panel">
        <div className="no-session__card">
          <h2 className="no-session__title">Connecting…</h2>
          <p className="no-session__hint">Waiting for the connection to perch to come back.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="no-session" data-testid="no-session-panel">
      <div className="no-session__card">
        <h2 className="no-session__title">No session open</h2>
        <p className="no-session__hint">
          {project
            ? `Start a new chat in ${basename(project.cwd)}, or pick a session from the sidebar.`
            : "Create a new session to get started, or pick one from the sidebar."}
        </p>
        <AgentPicker
          value={selectedAgent}
          onChange={(a) => {
            setSelectedAgent(a);
            setLastAgentChoice(a);
          }}
        />
        <button
          type="button"
          className="no-session__primary"
          data-testid="no-session-create"
          onClick={() => createSessionOnHost(activeHostId, project?.cwd, selectedAgent)}
        >
          {project ? `New session in ${basename(project.cwd)}` : "New session"}
        </button>
      </div>
    </div>
  );
}
