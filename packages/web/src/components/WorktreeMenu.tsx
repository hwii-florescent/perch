/**
 * WorktreeMenu.tsx — Wave 2: git worktree management, ported from herdr.
 *
 * Rendered in each sidebar project header (the `(hostId, cwd)` group row) as
 * its "+" (new workspace), which opens straight on the create form, but only
 * when that project's cwd is inside a git repo — signalled by the presence of `workspaceGit[projectKey].branch`,
 * which the server's background git poll already pushes (`workspace.git`).
 *
 * The popover is portal-rendered (same escape-the-dockview-clipping trick as
 * `ModelChip`/`SessionMenu`/`NewSessionPopover`) and holds three flows, each
 * mapped from a herdr dialog in `reference/herdr/src/ui/dialogs.rs` +
 * `src/app/worktrees.rs`:
 *
 *  - **List** (herdr's `render_open_existing_worktree_overlay`): every
 *    worktree of the repo with its branch, path, a `primary` badge for the
 *    main checkout and a `dirty` marker for checkouts with uncommitted work.
 *  - **Open** (herdr's `open_selected_existing_worktree` → open a workspace
 *    on that checkout): perch's equivalent of "open a workspace on it" is
 *    "create a session whose cwd is it", so this calls `createSessionOnHost`
 *    with the worktree path. The new session then forms (or joins) its own
 *    `(hostId, cwd)` project group in the sidebar — the perch analog of
 *    herdr's per-worktree workspace.
 *  - **New worktree…** (herdr's `WorktreeCreateState` dialog): branch name +
 *    a "new branch" checkbox (default on) + an optional custom path,
 *    prefilled with the server-reported default root and kept in sync with
 *    the branch name until the user edits it by hand (herdr's
 *    `sync_worktree_branch_from_input`).
 *  - **Remove** (herdr's `ConfirmRemoveWorktree` mode): a `ConfirmDialog`,
 *    and — when the server refuses with the dirty guard — a *second*,
 *    force-flavored confirmation carrying the guard message. That two-step
 *    escalation is herdr's `force_confirmation` flag verbatim (see
 *    `handle_worktree_remove_finished`), deliberately preferred over
 *    pre-checking `isDirty` client-side so the guard always reflects the
 *    checkout's state at the moment of removal.
 *
 * The primary checkout is never offered a Remove button (git refuses to
 * remove a main working tree anyway).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import { ICON_BUTTON } from "./ui/icon-button";
import { usePerchStore } from "../store";
import { ConfirmDialog } from "./ConfirmDialog";
import { AGENT_PICKER, useAgentChoices } from "./AgentPicker";
import type { WorktreeEntry, WorktreePreservedBranch } from "@perch/shared";


const INPUT = "rounded-ui border border-overlay-0 bg-surface-1 px-2 py-[0.3rem] text-[0.78rem] text-fg [font-family:inherit] focus:border-accent focus:[outline:none]";
const BADGE = "shrink-0 rounded-ui border border-accent px-[0.28rem] py-0 text-[0.6rem] font-medium text-accent";
const ACTION = "cursor-pointer rounded-ui border border-overlay-0 bg-transparent px-[0.4rem] py-[0.15rem] text-[0.7rem] text-fg [font-family:inherit] [transition:border-color_0.1s_ease,color_0.1s_ease] hover:border-accent hover:text-accent";
/** Mirror of `branch_to_path_slug` in `crates/perch-core/src/worktree.rs`
 * (kept in sync by hand — it exists here only to *preview* the default
 * checkout path in the create form; the server always recomputes the real
 * path, so a drift here is cosmetic, never a correctness bug). */
function branchToPathSlug(branch: string): string {
  let slug = "";
  let lastWasDash = false;
  for (const ch of branch) {
    if (/[a-zA-Z0-9]/.test(ch)) {
      slug += ch.toLowerCase();
      lastWasDash = false;
    } else if (!lastWasDash) {
      slug += "-";
      lastWasDash = true;
    }
  }
  const trimmed = slug.replace(/^-+|-+$/g, "");
  return trimmed || "worktree";
}

/** Mirror of `slugify_task_name` in `worktree.rs` (Orca's
 * `slugifyForWorkspaceName`), used only to preview the derived branch; the
 * server derives the real one and may add a `-2` suffix on conflict. */
export function slugifyTaskName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/([\p{L}\p{N}])'(?=[\p{L}\p{N}])/gu, "$1")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 48)
    .replace(/[-._]+$/g, "");
}

function basename(p: string): string {
  const parts = p.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || p;
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

export interface WorktreeMenuProps {
  hostId: string;
  /** The project group's cwd — used as the repo path for every git call. */
  cwd: string;
  /** `${hostId}:${cwd}` — the shared project key (store cache + leader,W). */
  projectKey: string;
  /** Extra classes for the + trigger (the sidebar project row hides it until hover). */
  className?: string;
}

export function WorktreeMenu({ hostId, cwd, projectKey, className }: WorktreeMenuProps) {
  const cached = usePerchStore((s) => s.worktrees[projectKey]);
  const listWorktrees = usePerchStore((s) => s.listWorktrees);
  const createWorktree = usePerchStore((s) => s.createWorktree);
  const startWorktreeJob = usePerchStore((s) => s.startWorktreeJob);
  // Local hosts that run creates in the background (`worktree.job`): the
  // form closes at once and progress shows as a sidebar row.
  const background = usePerchStore(
    (s) => hostId === "local" && s.serverInfo?.capabilities?.includes("worktree.job") === true,
  );
  // Task name + start-from picker (`worktree.startFrom`); older hosts keep
  // the branch + "new branch" form.
  const hostCaps = usePerchStore((s) =>
    hostId === "local" ? s.serverInfo?.capabilities : s.workspaceCapabilitiesByHost[hostId],
  );
  const startFromSupported = hostCaps?.includes("worktree.startFrom") === true;
  // Delete = checkout + branch, with a review for unmerged work (Orca).
  const deleteSupported = hostCaps?.includes("worktree.delete") === true;
  // Parent workspace choices: this repo's active linked worktrees.
  const projects = usePerchStore((s) => s.workspaceProjects);
  const workspaces = usePerchStore((s) => s.workspaces);
  const parentChoices = useMemo(() => {
    if (!hostCaps?.includes("workspace.nest")) return [];
    const project = projects.find((p) => p.hostId === hostId && p.repoPath === cwd);
    return project
      ? workspaces.filter((w) => w.projectId === project.id && w.parentWorkspaceId && w.state !== "archived" && !w.hidden)
      : [];
  }, [hostCaps, projects, workspaces, hostId, cwd]);
  const removeWorktree = usePerchStore((s) => s.removeWorktree);
  const deleteWorktreeBranch = usePerchStore((s) => s.deleteWorktreeBranch);
  const createSessionOnHost = usePerchStore((s) => s.createSessionOnHost);
  const menuRequest = usePerchStore((s) => s.worktreeMenuRequest);
  const clearWorktreeMenuRequest = usePerchStore((s) => s.clearWorktreeMenuRequest);

  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [branch, setBranch] = useState("");
  const [taskName, setTaskName] = useState("");
  const [startFrom, setStartFrom] = useState("");
  const [parentId, setParentId] = useState("");
  // The pane the new workspace starts with; untouched = Settings' "Empty
  // workspace opens", else none.
  const [agentPick, setAgentPick] = useState<string | null>(null);
  const emptyAgent = usePerchStore((s) => s.settings?.emptyWorkspaceAgent);
  const { choices: agentChoices } = useAgentChoices(hostId);
  const agent = agentPick ?? emptyAgent ?? "";
  const [newBranch, setNewBranch] = useState(true);
  const [customPath, setCustomPath] = useState("");
  const [pathTouched, setPathTouched] = useState(false);
  /** Pending removal: the target, plus whether the dirty guard already
   * tripped (→ show the force-flavored confirmation). */
  const [pendingRemove, setPendingRemove] = useState<
    { path: string; branch?: string; force: boolean; guardMessage?: string } | null
  >(null);
  /** A branch the delete kept because it has unmerged work: reviewed here
   * before an explicit force delete. */
  const [branchReview, setBranchReview] = useState<WorktreePreservedBranch | null>(null);

  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const branchInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const defaultRoot = cached?.defaultRoot ?? "";
  const entries: WorktreeEntry[] = cached?.worktrees ?? [];

  const refresh = useCallback(() => {
    setLoading(true);
    listWorktrees(hostId, cwd).then((reply) => {
      setLoading(false);
      if (reply.type === "worktree.error") setError(reply.message);
      else setError(null);
    });
  }, [listWorktrees, hostId, cwd]);

  const openMenu = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      setPopoverStyle({
        position: "fixed", zIndex: 9999,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.min(420, window.innerWidth - 16) - 8)),
        ...(below >= above ? { top: rect.bottom + 4 } : { bottom: window.innerHeight - rect.top + 4 }),
        maxHeight: Math.max(0, Math.max(above, below)), overflowY: "auto",
      });
    }
    setOpen(true);
    setShowCreateForm(false);
    setError(null);
    refresh();
  }, [refresh]);

  // leader,W (or any other external trigger) asking this project's menu to open.
  useEffect(() => {
    if (!menuRequest || menuRequest.projectKey !== projectKey) return;
    clearWorktreeMenuRequest();
    if (menuRequest.remove) setPendingRemove({ ...menuRequest.remove, force: false });
    else {
      openMenu();
      if (menuRequest.create) setShowCreateForm(true);
    }
  }, [menuRequest, projectKey, clearWorktreeMenuRequest, openMenu]);

  // Dismiss on outside click / Escape (same contract as SessionMenu). Skipped
  // while a ConfirmDialog is up so its own backdrop owns those interactions.
  useEffect(() => {
    if (!open || pendingRemove || branchReview) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, pendingRemove, branchReview]);

  useEffect(() => {
    if (showCreateForm) (startFromSupported ? nameInputRef : branchInputRef).current?.focus();
  }, [showCreateForm, startFromSupported]);

  /** The branch the server will use: the override, else the task-name slug. */
  const effectiveBranch = branch.trim() || (startFromSupported ? slugifyTaskName(taskName) : "");
  // With a task name or branch the server derives the rest; with neither it
  // picks a free "workspace" name. Older hosts still need a branch.
  const canCreate = startFromSupported ? !taskName.trim() || effectiveBranch !== "" : effectiveBranch !== "";

  // Keep the path preview in sync with the branch until the user edits it.
  useEffect(() => {
    if (pathTouched || !defaultRoot) return;
    setCustomPath(effectiveBranch ? `${defaultRoot}/${branchToPathSlug(effectiveBranch)}` : "");
  }, [effectiveBranch, defaultRoot, pathTouched]);

  function handleBtnClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    // The project header's + is "new workspace": open on the create form.
    openMenu();
    setShowCreateForm(true);
  }

  function handleOpenWorktree(entry: WorktreeEntry) {
    setOpen(false);
    createSessionOnHost(hostId, entry.path, undefined);
  }

  async function submitCreate() {
    const trimmed = branch.trim();
    if (!canCreate || creating) return;
    setCreating(true);
    setError(null);
    const extra = startFromSupported
      ? {
          name: taskName.trim() || undefined,
          startFrom: startFrom.trim() || undefined,
          parentWorkspaceId: parentId || undefined,
        }
      : undefined;
    // A path the user never touched is left to the server, which knows the
    // final (possibly suffixed) branch name.
    const path = pathTouched ? customPath.trim() || undefined : undefined;
    const reply = background
      ? await startWorktreeJob(cwd, trimmed, newBranch, path, extra)
      : await createWorktree(hostId, cwd, trimmed, newBranch, path, extra);
    setCreating(false);
    if (reply.type === "worktree.error") {
      setError(reply.message);
      return;
    }
    const createdPath = reply.type === "worktree.job.started" ? reply.job.path : reply.type === "worktree.done" ? reply.path : "";
    if (agent && createdPath) startPaneWhenReady(hostId, createdPath, agent);
    setShowCreateForm(false);
    setBranch("");
    setTaskName("");
    setStartFrom("");
    setParentId("");
    setAgentPick(null);
    setPathTouched(false);
    if (reply.type === "worktree.job.started") {
      setOpen(false);
      return;
    }
    refresh();
  }

  async function submitRemove() {
    if (!pendingRemove) return;
    const { path, branch, force } = pendingRemove;
    setPendingRemove(null);
    setError(null);
    const reply = await removeWorktree(hostId, cwd, path, force, deleteSupported);
    if (reply.type === "worktree.error") {
      if (reply.dirty && !force) {
        // herdr's force_confirmation escalation — re-open the confirmation in
        // its force flavor, carrying git's own guard message.
        setPendingRemove({ path, branch, force: true, guardMessage: reply.message });
        return;
      }
      setError(reply.message);
      return;
    }
    if (reply.type === "worktree.done" && reply.preservedBranch) setBranchReview(reply.preservedBranch);
    refresh();
  }

  async function forceDeleteBranch() {
    if (!branchReview) return;
    const { name, head } = branchReview;
    setBranchReview(null);
    const reply = await deleteWorktreeBranch(hostId, cwd, name, head);
    if (reply.type === "worktree.error") setError(reply.message);
    refresh();
  }

  const popover = open
    ? createPortal(
        <div
          className="w-[min(420px,calc(100vw_-_16px))] overflow-hidden rounded-ui border border-accent bg-panel-bg shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          role="dialog"
          aria-label="Git worktrees"
          data-testid={`worktree-popover-${hostId}-${cwd}`}
          ref={popoverRef}
          style={popoverStyle}
          // The form inputs stop key propagation, so Escape is caught here.
          onKeyDownCapture={(e) => { if (e.key === "Escape") setOpen(false); }}
        >
          <div className="flex items-baseline justify-between gap-2 border-b border-b-overlay-0 px-[0.65rem] pt-[0.4rem] pb-[0.3rem]">
            <span className="text-[0.72rem] font-semibold tracking-[0.04em] text-subtext-0 uppercase">{showCreateForm ? "New workspace" : "Worktrees"}</span>
            <span className="overflow-hidden text-[0.72rem] text-ellipsis whitespace-nowrap text-accent" title={cwd}>
              {basename(cwd)}
            </span>
          </div>

          <div className="max-h-[240px] overflow-y-auto py-[0.15rem]">
            {loading && entries.length === 0 ? (
              <div className="px-[0.65rem] py-[0.45rem] text-[0.76rem] text-subtext-0">Loading…</div>
            ) : entries.length === 0 ? (
              <div className="px-[0.65rem] py-[0.45rem] text-[0.76rem] text-subtext-0">No worktrees</div>
            ) : (
              entries.map((entry) => (
                <div
                  className="worktree-menu__entry flex items-center justify-between gap-2 px-[0.65rem] py-[0.35rem] hover:bg-surface-1"
                  key={entry.path}
                  data-testid={`worktree-entry-${entry.path}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="worktree-menu__entry-branch flex items-center gap-[0.3rem] overflow-hidden text-[0.8rem] font-semibold text-ellipsis whitespace-nowrap text-fg">
                      {entry.branch ?? `(detached ${entry.head?.slice(0, 7) ?? "?"})`}
                      {entry.isPrimary && (
                        <span
                          className={BADGE}
                          data-testid={`worktree-primary-${entry.path}`}
                        >
                          primary
                        </span>
                      )}
                      {entry.isDirty && (
                        <span
                          className={cn(BADGE, "border-yellow text-yellow")}
                          data-testid={`worktree-dirty-${entry.path}`}
                          title="Uncommitted or untracked changes"
                        >
                          dirty
                        </span>
                      )}
                    </div>
                    <div className="worktree-menu__entry-path overflow-hidden text-[0.68rem] text-ellipsis whitespace-nowrap text-subtext-0" title={entry.path}>
                      {entry.path}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className={ACTION}
                      data-testid={`worktree-open-${entry.path}`}
                      onClick={() => handleOpenWorktree(entry)}
                      title="New CLI session in this worktree"
                    >
                      Open
                    </button>
                    {!entry.isPrimary && (
                      <button
                        type="button"
                        className={cn(ACTION, "hover:border-red hover:text-red")}
                        data-testid={`worktree-remove-${entry.path}`}
                        onClick={() => setPendingRemove({ path: entry.path, branch: entry.branch, force: false })}
                        title={deleteSupported ? "Delete this worktree and its branch" : "Remove this worktree"}
                      >
                        {deleteSupported ? "Delete" : "Remove"}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {error && (
            <div className="border-t border-t-overlay-0 px-[0.65rem] py-[0.35rem] text-[0.72rem] whitespace-pre-wrap text-red" data-testid="worktree-error">
              {error}
            </div>
          )}

          <div className="h-px bg-overlay-0" />

          {showCreateForm ? (
            <div className="flex flex-col gap-[0.3rem] px-[0.65rem] py-[0.45rem]">
              {startFromSupported && (
                <>
                  <input
                    type="text"
                    ref={nameInputRef}
                    className={INPUT}
                    data-testid="worktree-name-input"
                    placeholder="task name (optional)"
                    aria-label="Task name"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") void submitCreate();
                    }}
                  />
                  <input
                    type="text"
                    className={INPUT}
                    data-testid="worktree-start-input"
                    list={`worktree-refs-${projectKey}`}
                    placeholder={`start from ${cached?.baseRef ?? "HEAD"} (base ref)`}
                    aria-label="Start from: branch, remote branch or commit"
                    title="A local branch, a remote branch (fetched first) or a commit SHA. Empty = the repo's base ref."
                    value={startFrom}
                    onChange={(e) => setStartFrom(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") void submitCreate();
                    }}
                  />
                  <datalist id={`worktree-refs-${projectKey}`}>
                    {(cached?.refs ?? []).map((ref) => <option key={ref} value={ref} />)}
                  </datalist>
                </>
              )}
              <input
                type="text"
                ref={branchInputRef}
                className={INPUT}
                data-testid="worktree-branch-input"
                placeholder={startFromSupported
                  ? `branch (optional): ${slugifyTaskName(taskName) || "derived from the task name"}`
                  : "branch name"}
                aria-label={startFromSupported ? "Branch name override" : "Branch name"}
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") void submitCreate();
                }}
              />
              {parentChoices.length > 0 && (
                <select
                  className={INPUT}
                  data-testid="worktree-parent-select"
                  aria-label="Parent workspace"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                >
                  <option value="">no parent workspace</option>
                  {parentChoices.map((w) => (
                    <option key={w.id} value={w.id}>nest under {w.name || basename(w.path)}</option>
                  ))}
                </select>
              )}
              {!startFromSupported && (
                <label className="flex cursor-pointer items-center gap-[0.35rem] text-[0.74rem] text-subtext-0">
                  <input
                    type="checkbox"
                    data-testid="worktree-new-branch"
                    checked={newBranch}
                    onChange={(e) => setNewBranch(e.target.checked)}
                  />
                  new branch
                </label>
              )}
              <input
                type="text"
                className={INPUT}
                data-testid="worktree-path-input"
                aria-label="Checkout path"
                placeholder={defaultRoot ? `worktree path (optional): ${defaultRoot}/<branch>` : "worktree path (optional)"}
                value={customPath}
                onChange={(e) => {
                  setPathTouched(true);
                  setCustomPath(e.target.value);
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") void submitCreate();
                }}
              />
              <select
                className={cn(AGENT_PICKER, "text-[0.78rem]")}
                data-testid="worktree-agent-select"
                aria-label="Starting pane"
                value={agent}
                onChange={(e) => setAgentPick(e.target.value)}
              >
                <option value="">no starting pane</option>
                {agentChoices.map((choice) => <option key={choice.id} value={choice.id}>start with {choice.label}</option>)}
              </select>
              <div className="mt-[0.15rem] flex justify-end gap-[0.35rem]">
                <button
                  type="button"
                  className={ACTION}
                  data-testid="worktree-create-cancel"
                  disabled={creating}
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="cursor-pointer rounded-ui bg-accent px-[0.6rem] py-1 text-[0.75rem] font-semibold text-panel-bg [font-family:inherit] [border:none] disabled:cursor-not-allowed disabled:opacity-40"
                  data-testid="worktree-create-submit"
                  disabled={!canCreate || creating}
                  onClick={() => void submitCreate()}
                >
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="block w-full cursor-pointer bg-transparent px-[0.65rem] py-[0.45rem] text-left text-[0.78rem] text-fg [font-family:inherit] [border:none] [transition:background_0.1s_ease] hover:bg-surface-1"
              data-testid="worktree-new"
              onClick={() => {
                setShowCreateForm(true);
                setError(null);
              }}
            >
              + New worktree…
            </button>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        type="button"
        className={cn("worktree-menu__btn", ICON_BUTTON, className)}
        ref={btnRef}
        data-testid={`worktree-menu-${hostId}-${cwd}`}
        onClick={handleBtnClick}
        title="New workspace (a git worktree)"
        aria-label="New workspace"
        aria-expanded={open}
      >
        +
      </button>
      {popover}
      {pendingRemove && (
        <ConfirmDialog
          message={
            pendingRemove.force
              ? `${pendingRemove.guardMessage ?? "This worktree has uncommitted changes."}\n\nForce remove ${pendingRemove.path}?`
              : deleteSupported && pendingRemove.branch
                ? `Delete the worktree at ${pendingRemove.path} and its branch ${pendingRemove.branch}?\n\nA branch with unmerged commits is kept for you to review.`
                : `Remove the worktree at ${pendingRemove.path}? The branch itself is kept.`
          }
          confirmLabel={pendingRemove.force ? "Force remove" : deleteSupported ? "Delete" : "Remove"}
          onConfirm={() => void submitRemove()}
          onCancel={() => setPendingRemove(null)}
        />
      )}
      {branchReview && (
        <ConfirmDialog
          message={`The worktree is gone, but branch ${branchReview.name} was kept: ${branchReview.unmerged} commit${branchReview.unmerged === 1 ? " is" : "s are"} on no other branch or remote.\n\n${branchReview.commits.join("\n")}${branchReview.unmerged > branchReview.commits.length ? "\n…" : ""}\n\nDelete the branch anyway? Those commits would be lost.`}
          confirmLabel="Delete branch"
          cancelLabel="Keep branch"
          onConfirm={() => void forceDeleteBranch()}
          onCancel={() => setBranchReview(null)}
        />
      )}
    </>
  );
}
