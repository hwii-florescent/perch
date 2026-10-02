/**
 * NoSessionPanel.tsx — the home screen: what the main area shows when no
 * session is open (`sessionId === null`), e.g. after the last tab of a
 * workspace is closed or its agent and shell exit. Modelled on Orca's: the
 * app name, a one-line hint, the two ways in, and the shortcuts worth knowing.
 *
 * With a workspace focused (clicking one that has no sessions, see
 * `openEmptyWorkspace` in WorkspaceOverview.tsx) it is that workspace's start
 * picker instead: one button per agent, and a pointer to the Settings default
 * that skips this page.
 *
 * Disconnected is a different situation and gets its own message: nothing
 * can be started until the socket is back.
 */
import { useState } from "react";
import { usePerchStore, effectiveActiveProject } from "../store";
import { NewSessionPopover } from "../Sidebar";
import { useAgentChoices } from "./AgentPicker";

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
  const workspace = usePerchStore((s) => s.workspaces.find((candidate) => candidate.id === s.activeWorkspaceId));
  const projects = usePerchStore((s) => s.workspaceProjects);

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

  if (workspace) {
    // A project's own checkout goes by the project's name ("Chats", not "scratch").
    const projectName = projects.find((p) => p.id === workspace.projectId && p.path === workspace.path)?.name;
    return <WorkspaceStart hostId={workspace.hostId} name={workspace.name || projectName || basename(workspace.path)} path={workspace.path} />;
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

function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

/** The focused workspace's start picker: what to open in it. */
function WorkspaceStart({ hostId, name, path }: { hostId: string; name: string; path: string }) {
  const createSessionOnHost = usePerchStore((s) => s.createSessionOnHost);
  const setSettingsOpen = usePerchStore((s) => s.setSettingsOpen);
  const { choices } = useAgentChoices(hostId);
  return (
    <div className="no-session home" data-testid="no-session-panel">
      <div className="home__card">
        <h1 className="home__name home__name--workspace">{name}</h1>
        <p className="home__hint" title={path}>{path}</p>
        <p className="home__hint">What do you want to open?</p>
        <div className="home__actions">
          {choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className="home__action"
              data-testid={`workspace-start-${choice.id}`}
              onClick={() => createSessionOnHost(hostId, path, choice.id)}
            >
              {choice.label}
            </button>
          ))}
        </div>
        <button type="button" className="home__link" onClick={() => setSettingsOpen(true)}>
          Open one automatically: Settings → Empty workspace opens
        </button>
      </div>
    </div>
  );
}
