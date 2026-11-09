/**
 * WorktreeMenu.tsx: a git project's "+" (new workspace on a new worktree) and its worktree list. The screen is
 * `stock:worktree` (`stock-ui/worktree/main.tsx`) or the person's package chosen for it; this file gives it the
 * project's worktrees and what the host supports, and binds each operation to the store's `worktree.*` requests
 * (the dirty guard and kept-branch review are the core's answers, passed through).
 */
import { useMemo } from "react";
import type { WorktreeReply } from "../store";
import { usePerchStore } from "../store";
import WorktreeScreen from "../stock-ui/worktree/main";
import { StockRoute } from "./mod-root";

export interface WorktreeMenuProps {
  hostId: string;
  /** The project group's cwd — used as the repo path for every git call. */
  cwd: string;
  /** `${hostId}:${cwd}` — the shared project key (store cache + leader,W). */
  projectKey: string;
  /** Extra classes for the + trigger (the sidebar project row hides it until hover). */
  className?: string;
}

/** Start `agent` in the workspace at `path` once the core has registered it
 * (a background create reports the path before the workspace exists). */
function startPaneWhenReady(hostId: string, path: string, agent: string) {
  const find = () => usePerchStore.getState().workspaces.find((w) => w.hostId === hostId && w.path === path && w.state !== "archived");
  let finished = false;
  let stop = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Unsubscribe before starting: createSessionOnHost updates the store, which
  // would re-enter this listener.
  const check = () => {
    const workspace = find();
    if (!workspace || finished) return;
    finished = true;
    stop();
    clearTimeout(timer);
    const state = usePerchStore.getState();
    state.focusWorkspace(workspace.id);
    state.createSessionOnHost(hostId, path, agent);
  };
  stop = usePerchStore.subscribe(check);
  timer = setTimeout(() => { finished = true; stop(); }, 5 * 60_000);
  check();
}

const answer = (reply: WorktreeReply) => (reply.type === "worktree.error" ? { error: reply.message, dirty: reply.dirty } : {});

export function WorktreeMenu({ hostId, cwd, projectKey, className }: WorktreeMenuProps) {
  const worktrees = usePerchStore((s) => s.worktrees[projectKey]);
  // Local hosts that run creates in the background (`worktree.job`): the form closes at once and progress shows as
  // a sidebar row.
  const background = usePerchStore((s) => hostId === "local" && s.serverInfo?.capabilities?.includes("worktree.job") === true);
  const hostCaps = usePerchStore((s) => (hostId === "local" ? s.serverInfo?.capabilities : s.workspaceCapabilitiesByHost[hostId]));
  const projects = usePerchStore((s) => s.workspaceProjects);
  const workspaces = usePerchStore((s) => s.workspaces);
  const emptyAgent = usePerchStore((s) => s.settings?.emptyWorkspaceAgent);
  const menuRequest = usePerchStore((s) => s.worktreeMenuRequest);
  // Parent workspace choices: this repo's active linked worktrees.
  const parentChoices = useMemo(() => {
    if (!hostCaps?.includes("workspace.nest")) return [];
    const project = projects.find((p) => p.hostId === hostId && p.repoPath === cwd);
    return project ? workspaces.filter((w) => w.projectId === project.id && w.parentWorkspaceId && w.state !== "archived" && !w.hidden).map((w) => ({ id: w.id, name: w.name, path: w.path })) : [];
  }, [hostCaps, projects, workspaces, hostId, cwd]);
  const deleteSupported = hostCaps?.includes("worktree.delete") === true;
  const actions = useMemo(() => {
    const store = usePerchStore.getState;
    return {
      list: () => store().listWorktrees(hostId, cwd).then(answer),
      create: async ({ branch, newBranch, path, extra, agent }: { branch: string; newBranch: boolean; path?: string; extra?: { name?: string; startFrom?: string; parentWorkspaceId?: string }; agent?: string }) => {
        const reply = background
          ? await store().startWorktreeJob(cwd, branch, newBranch, path, extra)
          : await store().createWorktree(hostId, cwd, branch, newBranch, path, extra);
        if (reply.type === "worktree.error") return { error: reply.message };
        const created = reply.type === "worktree.job.started" ? reply.job.path : reply.type === "worktree.done" ? reply.path : "";
        if (agent && created) startPaneWhenReady(hostId, created, agent);
        return { background: reply.type === "worktree.job.started" };
      },
      remove: async (path: string, force: boolean) => {
        const reply = await store().removeWorktree(hostId, cwd, path, force, deleteSupported);
        return { ...answer(reply), preservedBranch: reply.type === "worktree.done" ? reply.preservedBranch : undefined };
      },
      deleteBranch: (branch: string, head: string) => store().deleteWorktreeBranch(hostId, cwd, branch, head).then(answer),
      open: (path: string) => store().createSessionOnHost(hostId, path, undefined),
      takeRequest: () => store().clearWorktreeMenuRequest(),
    };
  }, [hostId, cwd, background, deleteSupported]);
  const props = {
    hostId, cwd, projectKey, className, worktrees, background, deleteSupported, parentChoices, emptyAgent, actions,
    startFromSupported: hostCaps?.includes("worktree.startFrom") === true,
    request: menuRequest && menuRequest.projectKey === projectKey ? menuRequest : null,
  };
  return <StockRoute name="worktree" props={props} stock={WorktreeScreen} />;
}
