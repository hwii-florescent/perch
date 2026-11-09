/**
 * Navigator.tsx: the command palette (Cmd+P, Ctrl+K outside a terminal, the leader chord). The screen is
 * `stock:navigator` (`stock-ui/navigator/main.tsx`) or the person's package chosen for it; this file gives it the
 * sessions, the focused workspace's file search, the host's agents and what each row does.
 */
import { useEffect } from "react";
import { effectiveWorkspace, usePerchStore } from "../store";
import { useWorkspaceFilesStore } from "../filesystemStore";
import { useFileTabs } from "../fileTabs";
import { sessionDotState } from "../statusDot";
import { splitActiveTab } from "../tiledPanes";
import { runInWorkspace } from "../runs";
import NavigatorScreen from "../stock-ui/navigator/main";
import { StockRoute } from "./mod-root";

export interface NavigatorProps {
  open: boolean;
  onClose: () => void;
}

export function Navigator({ open, onClose }: NavigatorProps) {
  const sessions = usePerchStore((s) => s.sessions);
  const sessionId = usePerchStore((s) => s.sessionId);
  const hostId = usePerchStore((s) => s.activeHostId);
  const activeProject = usePerchStore((s) => s.activeProject);
  const catalog = usePerchStore((s) => s.agentManifestsByHost[hostId]);
  const connected = usePerchStore((s) => s.connected);
  const workspace = usePerchStore(effectiveWorkspace);
  const supportsSearch = usePerchStore((s) => (workspace?.hostId === "local" ? s.serverInfo?.capabilities : s.workspaceCapabilitiesByHost[workspace?.hostId ?? ""])?.includes("fs.search") === true);
  const search = useWorkspaceFilesStore((s) => workspace ? s.searches[workspace.id] : undefined);
  const supportsRun = usePerchStore((s) => workspace?.hostId === "local" && s.serverInfo?.capabilities?.includes("workspace.run.v1") === true);
  useEffect(() => { if (open && connected) usePerchStore.getState().fetchAgentManifests(hostId); }, [open, connected, hostId]);
  if (!open) return null;
  const current = sessions.find((session) => session.id === sessionId);
  const agentCwd = current?.cwd ?? activeProject?.cwd ?? null;
  const store = usePerchStore.getState;
  const props = {
    open, onClose, connected, supportsSearch, supportsRun, search,
    currentSessionId: sessionId,
    sessions: sessions.map((s) => ({ id: s.id, title: s.title, cwd: s.cwd, hostId: s.hostId, createdAt: s.createdAt, state: sessionDotState(s) })),
    workspace: workspace ? { id: workspace.id, path: workspace.path } : null,
    agents: (catalog?.manifests ?? [])
      .filter((entry) => entry.available && entry.enabled !== false && entry.supportedModes.includes("cli") && entry.capabilities.includes("interactiveTerminal"))
      .map((entry) => ({ id: entry.id, label: entry.displayName })),
    agentCwd,
    terminalCwd: sessionId && current?.cwd ? current.cwd : null,
    actions: {
      switchTo: (id: string) => store().switchSession(id),
      searchFiles: (query: string) => { if (workspace) useWorkspaceFilesStore.getState().searchFiles(workspace.id, query); },
      openFile: (path: string) => { if (workspace) useFileTabs.getState().open(workspace.id, path); },
      newTerminal: () => splitActiveTab("right"),
      startAgent: (agent: string) => { if (agentCwd) store().createSessionOnHost(hostId, agentCwd, agent); },
      manageAgents: () => store().openAgentCatalog(),
      run: async (workspaceId: string, command: string) => {
        const id = await runInWorkspace(workspaceId, command);
        store().startCli(id, "terminal");
        useFileTabs.getState().showSession();
        store().switchSession(id);
      },
    },
  };
  return <StockRoute name="navigator" props={props} stock={NavigatorScreen} />;
}
