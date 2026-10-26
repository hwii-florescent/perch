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
import { cn } from "../lib/cn";
import { START_ACTION as ACTION, START_HINT as HINT, START_NAME as NAME, START_PANEL as PANEL, StartCard } from "./StartCard";
import { requestAddProject } from "../appEvents";
import perchLogo from "../assets/perch-logo-texture-medium.webp";

// The start card itself is shared with the CLI start panel (`StartCard.tsx`).
const FONT = "[font-family:inherit] [font-weight:inherit] [line-height:inherit]";
const KBD = `min-w-6 rounded-ui border border-overlay-0 bg-surface-0 px-[0.35rem] py-[0.1rem] text-center text-[0.75rem] text-fg ${FONT}`;

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
      <div className={cn(PANEL, "items-start")} data-testid="no-session-panel">
        <div className="flex w-full max-w-[26rem] flex-col gap-3">
          <h2 className="m-0 text-[1rem] font-semibold text-fg">Connecting…</h2>
          <p className="m-0 text-[0.85rem] leading-[1.45] text-subtext-0">Waiting for the connection to perch to come back.</p>
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
    requestAddProject();
  }

  return (
    <div className={cn(PANEL, "items-center")} data-testid="no-session-panel">
      <div className="flex w-full max-w-[24rem] flex-col items-center gap-4">
        <img src={perchLogo} alt="" width={80} height={80} className="rounded-ui" draggable={false} />
        <h1 className={NAME}>perch</h1>
        <p className={HINT}>Select a workspace from the sidebar to begin.</p>
        <div className="flex flex-wrap justify-center gap-[0.6rem]">
          <button type="button" className={ACTION} data-testid="home-add-project" onClick={addProject}>
            Add birdhouse
          </button>
          <button
            type="button"
            className={ACTION}
            data-testid="no-session-create"
            onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}
          >
            New session
          </button>
        </div>
        <dl className="mx-0 mt-4 mb-0 flex w-full flex-col gap-[0.45rem]">
          {SHORTCUTS.map(([label, keys]) => (
            <div key={label} className="flex items-center justify-between gap-4 text-[0.8rem] text-subtext-0">
              <dt>{label}</dt>
              <dd className="m-0 flex gap-1">{keys.map((key) => <kbd key={key} className={KBD}>{key}</kbd>)}</dd>
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
  const { choices } = useAgentChoices(hostId);
  return (
    <StartCard
      name={name}
      path={path}
      choices={choices}
      idPrefix="workspace-start"
      testId="no-session-panel"
      onPick={(agent) => createSessionOnHost(hostId, path, agent)}
    />
  );
}
