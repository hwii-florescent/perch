/**
 * WorktreeMenu.tsx — Wave 2: git worktree management, ported from herdr.
 *
 * Rendered in each sidebar project header (the `(hostId, cwd)` group row) as
 * a small branch-glyph button, but only when that project's cwd is inside a
 * git repo — signalled by the presence of `workspaceGit[projectKey].branch`,
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
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePerchStore } from "../store";
import { ConfirmDialog } from "./ConfirmDialog";
import type { WorktreeEntry } from "@perch/shared";

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

function basename(p: string): string {
  const parts = p.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || p;
}

export interface WorktreeMenuProps {
  hostId: string;
  /** The project group's cwd — used as the repo path for every git call. */
  cwd: string;
  /** `${hostId}:${cwd}` — the shared project key (store cache + leader,W). */
  projectKey: string;
}

export function WorktreeMenu({ hostId, cwd, projectKey }: WorktreeMenuProps) {
  const cached = usePerchStore((s) => s.worktrees[projectKey]);
  const listWorktrees = usePerchStore((s) => s.listWorktrees);
  const createWorktree = usePerchStore((s) => s.createWorktree);
  const removeWorktree = usePerchStore((s) => s.removeWorktree);
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
  const [newBranch, setNewBranch] = useState(true);
  const [customPath, setCustomPath] = useState("");
  const [pathTouched, setPathTouched] = useState(false);
  /** Pending removal: the target, plus whether the dirty guard already
   * tripped (→ show the force-flavored confirmation). */
  const [pendingRemove, setPendingRemove] = useState<
    { path: string; force: boolean; guardMessage?: string } | null
  >(null);

  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const branchInputRef = useRef<HTMLInputElement>(null);

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
    openMenu();
  }, [menuRequest, projectKey, clearWorktreeMenuRequest, openMenu]);

  // Dismiss on outside click / Escape (same contract as SessionMenu). Skipped
  // while a ConfirmDialog is up so its own backdrop owns those interactions.
  useEffect(() => {
    if (!open || pendingRemove) return;
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
  }, [open, pendingRemove]);

  useEffect(() => {
    if (showCreateForm) branchInputRef.current?.focus();
  }, [showCreateForm]);

  // Keep the path preview in sync with the branch until the user edits it.
  useEffect(() => {
    if (pathTouched || !defaultRoot) return;
    setCustomPath(branch.trim() ? `${defaultRoot}/${branchToPathSlug(branch.trim())}` : "");
  }, [branch, defaultRoot, pathTouched]);

  function handleBtnClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    openMenu();
  }

  function handleOpenWorktree(entry: WorktreeEntry) {
    setOpen(false);
    createSessionOnHost(hostId, entry.path, undefined);
  }

  async function submitCreate() {
    const trimmed = branch.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setError(null);
    const reply = await createWorktree(
      hostId,
      cwd,
      trimmed,
      newBranch,
      customPath.trim() || undefined,
    );
    setCreating(false);
    if (reply.type === "worktree.error") {
      setError(reply.message);
      return;
    }
    setShowCreateForm(false);
    setBranch("");
    setPathTouched(false);
    refresh();
  }

  async function submitRemove() {
    if (!pendingRemove) return;
    const { path, force } = pendingRemove;
    setPendingRemove(null);
    setError(null);
    const reply = await removeWorktree(hostId, cwd, path, force);
    if (reply.type === "worktree.error") {
      if (reply.dirty && !force) {
        // herdr's force_confirmation escalation — re-open the confirmation in
        // its force flavor, carrying git's own guard message.
        setPendingRemove({ path, force: true, guardMessage: reply.message });
        return;
      }
      setError(reply.message);
      return;
    }
    refresh();
  }

  const popover = open
    ? createPortal(
        <div
          className="worktree-menu__popover"
          role="dialog"
          aria-label="Git worktrees"
          data-testid={`worktree-popover-${hostId}-${cwd}`}
          ref={popoverRef}
          style={popoverStyle}
        >
          <div className="worktree-menu__header">
            <span className="worktree-menu__title">Worktrees</span>
            <span className="worktree-menu__repo" title={cwd}>
              {basename(cwd)}
            </span>
          </div>

          <div className="worktree-menu__list">
            {loading && entries.length === 0 ? (
              <div className="worktree-menu__empty">Loading…</div>
            ) : entries.length === 0 ? (
              <div className="worktree-menu__empty">No worktrees</div>
            ) : (
              entries.map((entry) => (
                <div
                  className="worktree-menu__entry"
                  key={entry.path}
                  data-testid={`worktree-entry-${entry.path}`}
                >
                  <div className="worktree-menu__entry-body">
                    <div className="worktree-menu__entry-branch">
                      {entry.branch ?? `(detached ${entry.head?.slice(0, 7) ?? "?"})`}
                      {entry.isPrimary && (
                        <span
                          className="worktree-menu__badge"
                          data-testid={`worktree-primary-${entry.path}`}
                        >
                          primary
                        </span>
                      )}
                      {entry.isDirty && (
                        <span
                          className="worktree-menu__badge worktree-menu__badge--dirty"
                          data-testid={`worktree-dirty-${entry.path}`}
                          title="Uncommitted or untracked changes"
                        >
                          dirty
                        </span>
                      )}
                    </div>
                    <div className="worktree-menu__entry-path" title={entry.path}>
                      {entry.path}
                    </div>
                  </div>
                  <div className="worktree-menu__entry-actions">
                    <button
                      type="button"
                      className="worktree-menu__action"
                      data-testid={`worktree-open-${entry.path}`}
                      onClick={() => handleOpenWorktree(entry)}
                      title="New CLI session in this worktree"
                    >
                      Open
                    </button>
                    {!entry.isPrimary && (
                      <button
                        type="button"
                        className="worktree-menu__action worktree-menu__action--danger"
                        data-testid={`worktree-remove-${entry.path}`}
                        onClick={() => setPendingRemove({ path: entry.path, force: false })}
                        title="Remove this worktree"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {error && (
            <div className="worktree-menu__error" data-testid="worktree-error">
              {error}
            </div>
          )}

          <div className="worktree-menu__divider" />

          {showCreateForm ? (
            <div className="worktree-menu__form">
              <input
                type="text"
                ref={branchInputRef}
                className="worktree-menu__input"
                data-testid="worktree-branch-input"
                placeholder="branch name"
                aria-label="Branch name"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") void submitCreate();
                }}
              />
              <label className="worktree-menu__checkbox">
                <input
                  type="checkbox"
                  data-testid="worktree-new-branch"
                  checked={newBranch}
                  onChange={(e) => setNewBranch(e.target.checked)}
                />
                new branch
              </label>
              <input
                type="text"
                className="worktree-menu__input"
                data-testid="worktree-path-input"
                aria-label="Checkout path"
                placeholder={defaultRoot ? `${defaultRoot}/<branch>` : "custom path (optional)"}
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
              <div className="worktree-menu__form-actions">
                <button
                  type="button"
                  className="worktree-menu__action"
                  data-testid="worktree-create-cancel"
                  disabled={creating}
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="worktree-menu__submit"
                  data-testid="worktree-create-submit"
                  disabled={!branch.trim() || creating}
                  onClick={() => void submitCreate()}
                >
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="worktree-menu__new-btn"
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
        className="worktree-menu__btn"
        ref={btnRef}
        data-testid={`worktree-menu-${hostId}-${cwd}`}
        onClick={handleBtnClick}
        title="Git worktrees"
        aria-label="Git worktrees"
        aria-expanded={open}
      >
        ⑂
      </button>
      {popover}
      {pendingRemove && (
        <ConfirmDialog
          message={
            pendingRemove.force
              ? `${pendingRemove.guardMessage ?? "This worktree has uncommitted changes."}\n\nForce remove ${pendingRemove.path}?`
              : `Remove the worktree at ${pendingRemove.path}? The branch itself is kept.`
          }
          confirmLabel={pendingRemove.force ? "Force remove" : "Remove"}
          onConfirm={() => void submitRemove()}
          onCancel={() => setPendingRemove(null)}
        />
      )}
    </>
  );
}
