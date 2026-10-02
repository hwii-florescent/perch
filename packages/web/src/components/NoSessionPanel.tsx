/**
 * NoSessionPanel.tsx — the home screen: what the main area shows when no
 * session is open (`sessionId === null`), e.g. after the last tab of a
 * workspace is closed or its agent and shell exit. Modelled on Orca's: the
 * app name, a one-line hint, the two ways in, and the shortcuts worth knowing.
 *
 * Disconnected is a different situation and gets its own message: nothing
 * can be started until the socket is back.
 */
import { useState } from "react";
import { usePerchStore, effectiveActiveProject } from "../store";
import { NewSessionPopover } from "../Sidebar";

/** Asks the sidebar's project list to open its "register a folder" form. */
export const ADD_PROJECT_EVENT = "perch:add-project";

const SHORTCUTS: [string, string[]][] = [
  ["New session", ["Ctrl", "Space", "C"]],
  ["Jump to a session", ["Ctrl", "K"]],
  ["Toggle sidebar", ["Ctrl", "Space", "B"]],
  ["All shortcuts", ["?"]],
];

export function NoSessionPanel({ connected }: { connected: boolean }) {
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const createSessionOnHost = usePerchStore((s) => s.createSessionOnHost);
  // The fallback project is derived; subscribe to its scalar path so a
  // disconnect cannot turn repeated snapshot reads into a render loop.
  const projectCwd = usePerchStore((s) => effectiveActiveProject(s)?.cwd);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

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

  function addProject() {
    const state = usePerchStore.getState();
    if (state.sidebarCollapsed) state.toggleSidebar();
    // After the sidebar has rendered, when it was just reopened.
    setTimeout(() => window.dispatchEvent(new Event(ADD_PROJECT_EVENT)));
  }

  return (
    <div className="no-session home" data-testid="no-session-panel">
      <div className="home__card">
        <h1 className="home__name">perch</h1>
        <p className="home__hint">Select a workspace from the sidebar to begin.</p>
        <div className="home__actions">
          <button type="button" className="home__action" data-testid="home-add-project" onClick={addProject}>
            Add project
          </button>
          <button
            type="button"
            className="home__action"
            data-testid="no-session-create"
            onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}
          >
            New session
          </button>
        </div>
        <dl className="home__keys">
          {SHORTCUTS.map(([label, keys]) => (
            <div key={label} className="home__key-row">
              <dt>{label}</dt>
              <dd>{keys.map((key) => <kbd key={key}>{key}</kbd>)}</dd>
            </div>
          ))}
        </dl>
      </div>
      {anchor && (
        <NewSessionPopover
          hostId={activeHostId}
          projectCwds={projectCwd ? [projectCwd] : []}
          anchorRect={anchor}
          onClose={() => setAnchor(null)}
          onSelect={(cwd, agent) => createSessionOnHost(activeHostId, cwd, agent)}
        />
      )}
    </div>
  );
}
