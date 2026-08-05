/**
 * CliStartPanel.tsx — what CLI mode shows *instead of* a terminal until the
 * user has said where to work.
 *
 * The transport mints a blank session on every WS connect (see ws.ts), and
 * CLI mode used to react to that by immediately spawning `claude --resume`
 * into whatever the server's default cwd happened to be — so opening perch
 * launched an agent in the wrong directory, every time, before the user had
 * done anything. Gating on an explicit choice (see `cliStartedSessions` in
 * store.ts) leaves that blank session with nothing to render, and this is it.
 *
 * Two ways forward, in the order they usually apply:
 *  - the active session already exists and has a cwd (the user clicked into
 *    an old session that predates any CLI use) — offer to start there;
 *  - otherwise pick a project and create a new session, which is
 *    self-starting because the create was user-initiated.
 */
import { useState } from "react";
import type { AgentKind } from "@perch/shared";
import { usePerchStore } from "../store";
import { DirectoryBrowser } from "./DirectoryBrowser";

function basename(path: string): string {
  const parts = path.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || path;
}

export function CliStartPanel({ agent }: { agent: AgentKind }) {
  const sessionId = usePerchStore((s) => s.sessionId);
  const sessions = usePerchStore((s) => s.sessions);
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const startCli = usePerchStore((s) => s.startCli);
  const createSessionOnHost = usePerchStore((s) => s.createSessionOnHost);
  const [browsing, setBrowsing] = useState(false);

  // Only a *listed* session can be resumed in place. The blank connect-time
  // session is deliberately invisible in `sessions` (db.rs hides sessions
  // with no messages and no CLI activity), so this is exactly the "the user
  // picked an existing session" case and never the housekeeping one.
  const current = sessions.find((s) => s.id === sessionId);

  // Distinct project cwds already in use on this host — the same quick-pick
  // the sidebar's "+" offers, so the two entry points agree.
  const projectCwds = Array.from(
    new Set(
      sessions
        .filter((s) => (s.hostId ?? "local") === activeHostId && s.cwd)
        .map((s) => s.cwd),
    ),
  );

  const agentLabel = agent === "claude" ? "Claude" : "Codex";

  return (
    <div className="cli-start" data-testid="cli-start-panel">
      <div className="cli-start__card">
        <h2 className="cli-start__title">Start a {agentLabel} session</h2>
        <p className="cli-start__hint">
          CLI mode runs the real {agent} command in a terminal. Choose the project
          it should run in.
        </p>

        {current?.cwd && (
          <button
            type="button"
            className="cli-start__primary"
            data-testid="cli-start-here"
            onClick={() => startCli(current.id)}
          >
            Start in {basename(current.cwd)}
            <span className="cli-start__cwd">{current.cwd}</span>
          </button>
        )}

        {projectCwds.length > 0 && (
          <div className="cli-start__section">
            <div className="cli-start__section-label">New chat in</div>
            <div className="cli-start__projects">
              {projectCwds.map((cwd, i) => (
                <button
                  key={cwd}
                  type="button"
                  className="cli-start__project"
                  data-testid={`cli-start-project-${i}`}
                  title={cwd}
                  onClick={() => createSessionOnHost(activeHostId, cwd)}
                >
                  {basename(cwd)}
                  <span className="cli-start__cwd">{cwd}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {browsing ? (
          <div className="cli-start__section">
            <div className="cli-start__section-label">Choose a folder</div>
            <DirectoryBrowser
              hostId={activeHostId}
              onUseFolder={(path) => createSessionOnHost(activeHostId, path)}
            />
          </div>
        ) : (
          <button
            type="button"
            className="cli-start__secondary"
            data-testid="cli-start-browse"
            onClick={() => setBrowsing(true)}
          >
            Browse for another folder…
          </button>
        )}
      </div>
    </div>
  );
}
