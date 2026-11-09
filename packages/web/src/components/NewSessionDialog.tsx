/**
 * NewSessionDialog.tsx: the keyboard-first "New session" launcher, mounted once in App and opened by
 * NEW_SESSION_EVENT (Cmd+Shift+T, the sidebar's New session button). The screen is `stock:launcher`
 * (`stock-ui/launcher/main.tsx`) or the person's package chosen for it; this file lists the host's projects with the
 * workspace a new tab lands in and binds what each row does.
 */
import { useEffect, useState } from "react";
import { NEW_SESSION_EVENT, requestAddProject } from "../appEvents";
import { openBlankBrowser, useFileTabs } from "../fileTabs";
import { effectiveActiveProject, effectiveWorkspace, usePerchStore } from "../store";
import { isChatsProject, workspacesForProject } from "../workspaceNav";
import Launcher from "../stock-ui/launcher/main";
import { StockRoute } from "./mod-root";

export function NewSessionDialog() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(NEW_SESSION_EVENT, show);
    return () => window.removeEventListener(NEW_SESSION_EVENT, show);
  }, []);
  return open ? <LauncherRoute onClose={() => setOpen(false)} /> : null;
}

function LauncherRoute({ onClose }: { onClose: () => void }) {
  const hostId = usePerchStore((s) => s.activeHostId);
  const allProjects = usePerchStore((s) => s.workspaceProjects);
  const workspaces = usePerchStore((s) => s.workspaces);
  const activeProject = usePerchStore(effectiveActiveProject);
  const activeWorkspace = usePerchStore(effectiveWorkspace);
  // Chats (the scratch workspace) is the launcher's "No project" row: quickchats run in the home folder.
  const projects = allProjects.filter((p) => p.hostId === hostId && !isChatsProject(p)).map((p) => {
    // The workspace a tab lands in: the one on screen if it belongs to the project, else the project's first.
    const ws = activeWorkspace?.projectId === p.id ? activeWorkspace : workspacesForProject(workspaces, p.id)[0];
    return { id: p.id, name: p.name, path: p.path, workspace: ws ? { id: ws.id, path: ws.path } : null };
  });
  const store = usePerchStore.getState;
  const props = {
    hostId, projects, onClose,
    activeProjectId: projects.find((p) => p.path === activeProject?.cwd)?.id ?? null,
    actions: {
      start: (cwd: string, agent: string) => store().createSessionOnHost(hostId, cwd, agent),
      openBrowser: (workspaceId: string) => { store().focusWorkspace(workspaceId); openBlankBrowser(workspaceId); },
      focusWorkspace: (workspaceId: string) => store().focusWorkspace(workspaceId),
      openFile: (workspaceId: string, path: string) => useFileTabs.getState().open(workspaceId, path),
      addProject: requestAddProject,
    },
  };
  return <StockRoute name="launcher" props={props} stock={Launcher} />;
}
