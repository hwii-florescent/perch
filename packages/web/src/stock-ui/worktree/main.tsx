//! Worktrees, the stock screen `stock:worktree`: a git project's "+" (a new workspace on a new git worktree) and its
//! worktree list (open, remove or delete a checkout). The sidebar's project and folder rows and a package's
//! `WorktreeMenu` from `@perch/sdk` place it; or the person's package chosen for it
//! (`perch mod use stock:worktree <id>`) with the same props. Ported from herdr's worktree dialogs.
//!
//! The worktrees, what the host supports and every operation are Perch's (`actions`: list, create, remove, delete a
//! kept branch, open), and so are the guards: a dirty checkout is refused until a second, force-flavored question,
//! and a branch with unmerged commits is kept for review before an explicit delete. The primary checkout is never
//! offered a Remove. The form, its order and wording are this screen's. The questions are `ConfirmDialog` and the
//! dropdowns `Select` from `@perch/sdk`, so copies chosen for those draw them here.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:worktree` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside it
//! (docs/MOD-SDK.md).
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { buttonClass as button, cn, ConfirmDialog, iconButton as ICON_BUTTON, menuItemClass as menuItem, Select, useAgentChoices, type WorktreeEntry, type WorktreePreservedBranch, type WorktreeScreenProps } from "@perch/sdk";

const AGENT_PICKER = "min-h-[32px] [.app--mobile_&]:min-h-[44px] w-full rounded-ui py-[0.3rem] pr-[0.55rem] pl-[0.45rem] text-[0.8rem] text-fg bg-[var(--picker-bg,var(--panel-bg))] [font-family:inherit] focus-visible:[outline:1px_solid_var(--accent)]";
const PlusIcon = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>;
const INPUT = "rounded-ui bg-surface-0 px-2 py-[0.3rem] text-[0.78rem] text-fg [font-family:inherit] focus:[outline:1px_solid_var(--accent)]";
const BADGE = "shrink-0 rounded-ui bg-surface-0 px-[0.28rem] py-0 text-[0.6rem] font-medium text-accent";
// A function, not a constant: `@perch/sdk` may still be loading while this module runs.
const action = () => button({ size: "sm", className: "text-fg" });
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
function slugifyTaskName(name: string): string {
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

export default function WorktreeMenu({ hostId, cwd, className, worktrees: cached, background, startFromSupported, deleteSupported, parentChoices, emptyAgent, request, actions }: WorktreeScreenProps) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
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
    actions.list().then((reply) => {
      setLoading(false);
      setError(reply.error ?? null);
    });
  }, [actions]);

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
    if (!request) return;
    actions.takeRequest();
    if (request.remove) setPendingRemove({ ...request.remove, force: false });
    else {
      openMenu();
      if (request.create) setShowCreateForm(true);
    }
  }, [request, actions, openMenu]);

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

  function handleBtnClick(e: ReactMouseEvent) {
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
    actions.open(entry.path);
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
    const reply = await actions.create({ branch: trimmed, newBranch, path, extra, agent: agent || undefined });
    setCreating(false);
    if (reply.error) {
      setError(reply.error);
      return;
    }
    setShowCreateForm(false);
    setBranch("");
    setTaskName("");
    setStartFrom("");
    setParentId("");
    setAgentPick(null);
    setPathTouched(false);
    if (reply.background) {
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
    const reply = await actions.remove(path, force);
    if (reply.error) {
      if (reply.dirty && !force) {
        // herdr's force_confirmation escalation — re-open the confirmation in
        // its force flavor, carrying git's own guard message.
        setPendingRemove({ path, branch, force: true, guardMessage: reply.error });
        return;
      }
      setError(reply.error);
      return;
    }
    if (reply.preservedBranch) setBranchReview(reply.preservedBranch);
    refresh();
  }

  async function forceDeleteBranch() {
    if (!branchReview) return;
    const { name, head } = branchReview;
    setBranchReview(null);
    const reply = await actions.deleteBranch(name, head);
    if (reply.error) setError(reply.error);
    refresh();
  }

  const popover = open
    ? createPortal(
        <div
          className="w-[min(420px,calc(100vw_-_16px))] overflow-hidden rounded-ui bg-surface-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          role="dialog"
          aria-label="Git worktrees"
          data-testid={`worktree-popover-${hostId}-${cwd}`}
          ref={popoverRef}
          style={popoverStyle}
          // The form inputs stop key propagation, so Escape is caught here.
          onKeyDownCapture={(e) => { if (e.key === "Escape") setOpen(false); }}
        >
          <div className="flex items-baseline justify-between gap-2 px-[0.65rem] pt-[0.4rem] pb-[0.3rem]">
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
                          className={cn(BADGE, "text-yellow")}
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
                      className={action()}
                      data-testid={`worktree-open-${entry.path}`}
                      onClick={() => handleOpenWorktree(entry)}
                      title="New CLI session in this worktree"
                    >
                      Open
                    </button>
                    {!entry.isPrimary && (
                      <button
                        type="button"
                        className={cn(action(), "hover:text-red")}
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
            <div className="px-[0.65rem] py-[0.35rem] text-[0.72rem] whitespace-pre-wrap text-red" data-testid="worktree-error">
              {error}
            </div>
          )}

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
                  <Select
                    freeText
                    className={INPUT}
                    testId="worktree-start-input"
                    placeholder={`start from ${cached?.baseRef ?? "HEAD"} (base ref)`}
                    ariaLabel="Start from: branch, remote branch or commit"
                    title="A local branch, a remote branch (fetched first) or a commit SHA. Empty = the repo's base ref."
                    value={startFrom}
                    onChange={setStartFrom}
                    options={(cached?.refs ?? []).map((ref) => ({ value: ref, label: ref }))}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") void submitCreate();
                    }}
                  />
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
                <Select
                  className={INPUT}
                  testId="worktree-parent-select"
                  ariaLabel="Parent workspace"
                  value={parentId}
                  onChange={setParentId}
                  options={[{ value: "", label: "no parent workspace" }, ...parentChoices.map((w) => ({ value: w.id, label: `nest under ${w.name || basename(w.path)}` }))]}
                />
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
              <Select
                className={cn(AGENT_PICKER, "text-[0.78rem]")}
                testId="worktree-agent-select"
                ariaLabel="Starting pane"
                value={agent}
                onChange={setAgentPick}
                options={[{ value: "", label: "no starting pane" }, ...agentChoices.map((choice) => ({ value: choice.id, label: `start with ${choice.label}` }))]}
              />
              <div className="mt-[0.15rem] flex justify-end gap-[0.35rem]">
                <button
                  type="button"
                  className={action()}
                  data-testid="worktree-create-cancel"
                  disabled={creating}
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={button({ variant: "primary", size: "sm" })}
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
              className={menuItem()}
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
        <PlusIcon />
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
