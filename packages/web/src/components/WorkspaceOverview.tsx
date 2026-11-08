import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";
import { ADD_PROJECT_EVENT } from "../appEvents";
import { requestCloseSession } from "../closeGuard";
import { createPortal } from "react-dom";
import { canReorderHost, usePerchStore, type WorkspaceProject, type WorkspaceRecord } from "../store";
import { isNestedIn, nestUnderLeads, orderBy, orderProjects, stepTarget, writeScope } from "../sidebarOrder";
import { certaintyNote, needsYou, reasonLabel, useAttention } from "../attention";
import { discloseSessions, groupByStatus, holdFinished, listedInSidebar, sectionOf, STATUS_LABELS, STATUS_SECTIONS, topSection, type StatusSection } from "../statusView";
import { openNextAttention } from "../attention";
import { StatusDot } from "./StatusDot";
import { DOT_GLYPH, sessionDotState, type AgentDotState } from "../statusDot";
import { menuDivider, menuItem, menuPanel } from "./ui/menu";
import { GHOST_BUTTON } from "./ui/icon-button";
import { button } from "./ui/button";
import { segment } from "./ui/segment";
import { Chevron } from "./ui/chevron";
import { Dialog } from "./ui/dialog";
import { EllipsisIcon, PlusIcon } from "./ui/icons";
import { rowAction } from "./ui/row-action";
import { SELECT } from "./ui/settings";
import { Select } from "./ui/select";
import { cn } from "../lib/cn";
import { WorktreeMenu } from "./WorktreeMenu";
import { ConfirmDialog } from "./ConfirmDialog";
import { InstructionsDialog } from "./InstructionsDialog";
import { instructionsAvailable, type InstructionsScope } from "../instructions";
import { MemoryDialog } from "./MemoryDialog";
import { memoryAvailable } from "../memory";
import { DirectoryBrowser } from "./DirectoryBrowser";
import { NewSessionPopover } from "../Sidebar";
import type { SessionSummary, WorktreeJob } from "@perch/shared";
import { isChatsProject, navigateToWorkspace as goToWorkspace, newScratchpad, orderedNests, sessionsForWorkspace, workspacesForProject } from "../workspaceNav";
import { chatsInStripOrder, moveChat, workspaceTabs } from "../workspaceTabs";
import { moveBeside, TAB_ORDER_EVENT } from "../tabOrder";
import { beginSlideDrag } from "../slideDrag";
import { useNestShortcutHints } from "../keybinds";
import { TabSplitMenu } from "./TabSplitMenu";
import { useFileTabs } from "../fileTabs";
import { inboundMenuItems } from "../inbound";

// Sidebar project list. A few tokens stay as hooks: e2e and the harness select on
// `workspace-project`, `workspace-entry`, `workspace-entry__button(--active)`,
// `workspace-project__workspaces`, `workspace-entry__sessions` and `workspace-overview__add-form`.
const FOCUS = "focus-visible:[outline:1px_solid_var(--overlay-1)] focus-visible:[outline-offset:-1px]";
const ROW_BTN = "flex w-full min-w-0 items-center text-left [border:0] [font-family:inherit]";
const SESSION = `${ROW_BTN} min-h-8 flex-1 cursor-pointer gap-2 rounded-ui bg-transparent px-[0.65rem] py-1 text-[13px] min-[701px]:text-[12px] ${FOCUS}`;
const SESSION_TITLE = "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap";
const RENAME = "mx-[0.3rem] my-1 w-[calc(100%_-_0.6rem)] rounded-ui bg-surface-0 px-[0.3rem] focus:[outline:1px_solid_var(--accent)] py-[0.2rem] text-[0.76rem] text-fg [font-family:inherit] [font-weight:inherit] [line-height:inherit]";
const DOT = "shrink-0 text-[0.58rem] text-subtext-0";
const ENTRY_BTN = `workspace-entry__button ${ROW_BTN} min-h-8 cursor-pointer gap-[0.45rem] rounded-ui py-[3px] pr-3 pl-3 text-fg ${FOCUS}`;
const STRONG = "overflow-hidden text-[14px] font-semibold text-ellipsis whitespace-nowrap text-fg min-[701px]:text-[12.5px] min-[701px]:font-medium";
const WORKSPACE_TITLE = "min-w-0 overflow-hidden text-[13px] font-medium text-ellipsis whitespace-nowrap min-[701px]:text-[12px]";
const WORKSPACE_TREE = "workspace-tree flex flex-col gap-[2px]";
const SPAN = "overflow-hidden text-[12px] text-ellipsis whitespace-nowrap text-subtext-0";
const BODY = "grid min-w-0 flex-1 gap-[0.1rem]";
const JOB_ACTION = button({ size: "xs" });
const RESTORE = button({ size: "xs", tone: "warn", className: "mt-0 mr-[0.3rem] mb-[0.3rem] ml-[0.5rem]" });
// Glyph buttons at the end of a row (ui/row-action.ts).
const PROJECT_ICON = rowAction({ reveal: "project" });
const SESSION_CLOSE = rowAction({ reveal: "session" });
const HEADER_PLUS = PROJECT_ICON;

/** A sub-session's row sits under its lead's, set in with a rule: the family reads as one group. */
const NESTED_ROW = "ml-4 border-l border-surface-1";

function basename(path: string): string {
  const parts = path.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || path;
}

type MenuItem = { label: string; testId: string; onSelect: () => void; danger?: boolean } | "divider";

/** Right-click / ⋯ menu for a project or workspace row (Orca's sidebar
 * context menu, trimmed to what perch does). Same look and dismiss rules as
 * `PaneContextMenu`. */
function RowMenu({ x, y, label, items, onClose }: { x: number; y: number; label: string; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const click = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) onClose(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);
  const height = items.length * (window.innerWidth <= 700 ? 44 : 30);
  return createPortal(
    <div
      className={menuPanel}
      role="menu"
      aria-label={label}
      data-testid="row-menu"
      ref={ref}
      style={{ position: "fixed", zIndex: 9999, minWidth: 180, left: Math.min(x, window.innerWidth - 188), top: Math.max(8, Math.min(y, window.innerHeight - height - 8)) }}
    >
      {items.map((item, index) => item === "divider" ? (
        <div key={index} className={menuDivider} />
      ) : (
        <button
          key={item.testId}
          type="button"
          role="menuitem"
          className={cn(menuItem({ danger: !!item.danger }), "max-[700px]:min-h-11")}
          data-testid={item.testId}
          onClick={() => { onClose(); item.onSelect(); }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

/** The phone's right-click: hold a row for half a second. Spread the result on
 * the row; the click that ends the hold is swallowed so it doesn't also navigate.
 * Touch/pen only, a mouse keeps its real contextmenu. Scrolling cancels it
 * (pointercancel), as does moving more than a few pixels. */
let heldTimer: number | undefined;
let held = false;
function longPress(open: (x: number, y: number) => void) {
  const cancel = () => window.clearTimeout(heldTimer);
  let from = { x: 0, y: 0 };
  return {
    onPointerDown: (event: React.PointerEvent) => {
      held = false;
      if (event.pointerType === "mouse") return;
      cancel();
      from = { x: event.clientX, y: event.clientY };
      heldTimer = window.setTimeout(() => { held = true; open(from.x, from.y); }, 450);
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (Math.hypot(event.clientX - from.x, event.clientY - from.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onClickCapture: (event: React.MouseEvent) => {
      if (!held) return;
      held = false;
      event.stopPropagation();
      event.preventDefault();
    },
  };
}
/** Stops iOS from selecting text / showing its callout while a row is held. */
const HOLDABLE = "select-none [-webkit-touch-callout:none]";

function copyText(text: string) {
  void navigator.clipboard?.writeText(text).catch(() => { /* no clipboard: nothing to do */ });
}

const COLLAPSED_KEY = "perch.sidebar.collapsedProjects";
function readCollapsed(): string[] {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]") as string[]; } catch { return []; }
}

/** How the sidebar lists work. "project" is the tree (Project → Workspace → Session), the default; the
 * others are flat views of the same chats. A saved "workspace" (the retired two-section layout) reads as the tree. */
type Organize = "project" | "status" | "list";
const ORGANIZE_KEY = "perch.sidebar.organize";
const ORGANIZE_LABELS: Record<Organize, string> = { project: "By project", status: "By status", list: "In one list" };
function readOrganize(): Organize {
  try {
    const saved = localStorage.getItem(ORGANIZE_KEY);
    return saved === "status" || saved === "list" ? saved : "project";
  } catch { return "project"; }
}
/** The tree's order: the core's (manual, with drag and favourites) or by what needs you (no drag). */
const SORT_KEY = "perch.sidebar.sort";
const ACTIVE_ONLY_KEY = "perch.sidebar.activeOnly";
const SHOW_TERMINALS_KEY = "perch.sidebar.showTerminals";
function readFlag(key: string, on: string): boolean {
  try { return localStorage.getItem(key) === on; } catch { return false; }
}
function saveFlag(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* per-viewer convenience */ }
}

/** The ring colours the rest of the app uses for a state, so a section reads the same as a dot elsewhere. */
const SECTION_STATE: Record<StatusSection, AgentDotState> = { needs: "blocked", done: "done", working: "working", idle: "idle" };

/** A section's heading in By status: the state's colour as a dot (hollow for Idle, as its ring is) on a faint
 * wash of the same colour, with the label in full text colour so contrast never depends on the hue. */
function SectionHeading({ section, title, count, note, countLabel, testId }: { section?: StatusSection; title: string; count: number; note?: string; countLabel: string; testId: string }) {
  const color = section ? DOT_GLYPH[SECTION_STATE[section]].color : undefined;
  return (
    <div
      className={cn("mt-1.5 mb-0.5 flex items-center gap-2 rounded-ui px-3 py-[3px] text-[13px] font-semibold text-fg min-[701px]:text-[12px]", !color && "bg-surface-0")}
      style={color ? { backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)` } : undefined}
      data-testid={testId}
    >
      {/* Hollow for Idle (its ring) and for the neutral sections (no state is claimed). */}
      <span className={cn("size-2 shrink-0 rounded-full", (!color || section === "idle") && "border-[1.5px] border-overlay-1 bg-transparent")} style={color ? (section === "idle" ? { borderColor: color } : { backgroundColor: color }) : undefined} aria-hidden="true" />
      <span>{title}</span>
      <span className="font-medium text-subtext-0 tabular-nums" aria-label={countLabel}>{count}</span>
      {note && <span className="min-w-0 truncate text-[0.62rem] font-normal text-subtext-0">{note}</span>}
    </div>
  );
}

/** The mark that says a line is a project (the tree's folder), so it reads apart from the chats under it. */
function FolderMark() {
  return (
    <svg className="mr-1.5 h-3 w-3 shrink-0 text-subtext-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M2 5V4a1 1 0 0 1 1-1h3l2 2h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5Z" />
    </svg>
  );
}

/** A folded project's most urgent state: the dot of one session in it, and how many are in that state. */
function Rollup({ sessions, section, testId }: { sessions: SessionSummary[]; section: StatusSection; testId: string }) {
  const lead = sessions[0];
  if (!lead) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1" data-testid={testId} data-section={section} title={`${sessions.length} ${STATUS_LABELS[section].toLowerCase()}`}>
      <StatusDot session={lead} className="h-[16px] w-[16px]" />
      {sessions.length > 1 && <span className="text-[0.62rem] text-subtext-0 tabular-nums">{sessions.length}</span>}
    </span>
  );
}

/** Orca's hidden-worktrees card: worktrees perch discovered but did not
 * create (or that were hidden) stay out of the tree until shown here. */
function HiddenWorktrees({ workspaces, projectId }: { workspaces: WorkspaceRecord[]; projectId: string }) {
  const [open, setOpen] = useState(false);
  const setWorkspaceHidden = usePerchStore((state) => state.setWorkspaceHidden);
  const count = workspaces.length;
  return (
    <div>
      <button
        type="button"
        className={`w-full cursor-pointer pt-1 pr-[0.45rem] pb-1 pl-[1.45rem] text-left text-[0.62rem] text-overlay-1 [background:none] [border:0] [font-family:inherit] hover:text-accent focus-visible:text-accent`}
        aria-expanded={open}
        data-testid={`workspace-hidden-${projectId}`}
        onClick={() => setOpen(!open)}
      >
        {count} hidden worktree{count === 1 ? "" : "s"}
      </button>
      {open && workspaces.map((workspace) => (
        <div className="flex items-center gap-[0.35rem] py-[3px] pr-3 pl-[1.45rem]" key={workspace.id} title={workspace.path}>
          <span className={BODY}>
            <strong className={STRONG}>{workspace.branch || basename(workspace.path)}</strong>
            <span className={SPAN}>{workspace.path}</span>
          </span>
          <button
            type="button"
            className={JOB_ACTION}
            data-testid={`workspace-show-${workspace.id}`}
            onClick={() => setWorkspaceHidden(workspace.id, false)}
          >
            Show
          </button>
        </div>
      ))}
    </div>
  );
}

/** Background worktree creates for one project (`server/worktree_jobs.rs`):
 * Orca's sidebar progress row, with Cancel while running and Retry / Dismiss
 * once a create failed. */
function WorktreeJobRows({ jobs }: { jobs: WorktreeJob[] }) {
  const cancel = usePerchStore((state) => state.cancelWorktreeJob);
  const retry = usePerchStore((state) => state.retryWorktreeJob);
  const dismiss = usePerchStore((state) => state.dismissWorktreeJob);
  return (
    <>
      {jobs.map((job) => {
        const failed = job.status === "failed";
        return (
          <div
            className="workspace-entry relative"
            key={job.jobId}
            data-testid={`worktree-job-${job.branch}`}
            role="status"
          >
            <div className={cn(ENTRY_BTN, "cursor-default bg-transparent")} title={job.path}>
              <span className={cn(DOT, failed && "text-red")} aria-hidden="true">{failed ? "✕" : "◌"}</span>
              <span className={BODY}>
                <strong className={STRONG}>{job.branch}</strong>
                <span className={cn(SPAN, failed && "text-red")} data-testid={`worktree-job-phase-${job.branch}`}>{failed ? "Create failed" : `${job.phase}…`}</span>
              </span>
              {job.status === "running" && (
                <button type="button" className={JOB_ACTION} data-testid={`worktree-job-cancel-${job.branch}`} onClick={() => cancel(job.jobId)}>
                  Cancel
                </button>
              )}
              {failed && (
                <>
                  <button type="button" className={JOB_ACTION} data-testid={`worktree-job-retry-${job.branch}`} onClick={() => retry(job.jobId)}>
                    Retry
                  </button>
                  <button type="button" className={JOB_ACTION} data-testid={`worktree-job-dismiss-${job.branch}`} onClick={() => dismiss(job.jobId)}>
                    Dismiss
                  </button>
                </>
              )}
            </div>
            {failed && (
              <div className="mt-0 mr-[0.3rem] mb-[0.3rem] ml-[1.45rem] overflow-hidden text-[0.6rem] text-red [display:-webkit-box] [overflow-wrap:anywhere] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]" data-testid={`worktree-job-error-${job.branch}`} title={job.error}>
                {job.error}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export interface WorkspaceOverviewProps {
  /** Compact mode is used inside the mobile switcher where the containing
   * panel already owns the title and close affordance. */
  compact?: boolean;
  /** Called after a project/workspace/session is selected by a containing
   * mobile switcher so the navigation panel can close itself. */
  onNavigate?: () => void;
}

export function WorkspaceOverview({ compact = false, onNavigate }: WorkspaceOverviewProps) {
  const nestHints = useNestShortcutHints();
  const showNestHints = nestHints.some(Boolean);
  const numberedNests = orderedNests().slice(0, nestHints.length);
  function nestHint(workspaceId: string) {
    const label = nestHints[numberedNests.findIndex((nest) => nest.id === workspaceId)];
    return label ? <kbd className="pointer-events-none absolute top-[7px] right-3 w-8 text-right text-[11px] leading-[18px] font-semibold text-accent tabular-nums [font-family:inherit]" data-testid={`workspace-shortcut-${workspaceId}`} aria-label={`Jump to workspace: ${label}`}>{label}</kbd> : null;
  }
  const [tabOrderVersion, refreshTabOrder] = useState(0);
  useEffect(() => {
    const refresh = () => refreshTabOrder((version) => version + 1);
    window.addEventListener(TAB_ORDER_EVENT, refresh);
    return () => window.removeEventListener(TAB_ORDER_EVENT, refresh);
  }, []);
  function tabOrderedSessions(workspace: WorkspaceRecord): SessionSummary[] {
    return workspaceTabs({ ...usePerchStore.getState(), activeHostId: workspace.hostId, activeWorkspaceId: workspace.id }, [])
      .flatMap((entry) => entry.kind === "session" && agentIds.has(entry.session.id) ? [entry.session] : []);
  }
  const activeHostId = usePerchStore((state) => state.activeHostId);
  const projects = usePerchStore((state) => state.workspaceProjects);
  const workspaces = usePerchStore((state) => state.workspaces);
  // Agents only unless asked: a plain terminal stays a tab and gets no sidebar row.
  const [showTerminals, setShowTerminals] = useState(() => readFlag(SHOW_TERMINALS_KEY, "1"));
  const allKnownSessions = usePerchStore((state) => state.sessions);
  const agentBySession = usePerchStore((state) => state.cliAgentBySession);
  const sessions = useMemo(() => allKnownSessions.filter((session) => showTerminals || listedInSidebar(session, agentBySession[session.id])), [allKnownSessions, agentBySession, showTerminals]);
  const agentIds = useMemo(() => new Set(sessions.map((session) => session.id)), [sessions]);
  const worktreeJobs = usePerchStore((state) => state.worktreeJobs);
  const activeWorkspaceId = usePerchStore((state) => state.activeWorkspaceId);
  const snapshot = usePerchStore((state) => state.workspaceSnapshotByHost[activeHostId]);
  const fetchWorkspaceSnapshot = usePerchStore((state) => state.fetchWorkspaceSnapshot);
  const createWorkspaceProject = usePerchStore((state) => state.createWorkspaceProject);
  const setActiveHost = usePerchStore((state) => state.setActiveHost);
  const sshHosts = usePerchStore((state) => state.hosts);
  const hostStates = usePerchStore((state) => state.hostStates);
  const connected = usePerchStore((state) => state.connected);
  // The core's project and chat order; no drag or Move without the capability (no local-only order).
  const order = usePerchStore((state) => state.workspaceOrderByHost[state.activeHostId]);
  const [organize, setOrganize] = useState<Organize>(readOrganize);
  // Sorting by attention is a view of the core's order, not a new order: no drag or Move while it is on.
  const [attentionSort, setAttentionSort] = useState(() => readFlag(SORT_KEY, "attention"));
  const [activeOnly, setActiveOnly] = useState(() => readFlag(ACTIVE_ONLY_KEY, "1"));
  const reorderable = usePerchStore((state) => canReorderHost(state, state.activeHostId)) && !attentionSort;
  const setWorkspaceOrder = usePerchStore((state) => state.setWorkspaceOrder);
  // Which host the Add project dialog registers on; starts as the active one.
  const [addHostId, setAddHostId] = useState(activeHostId);
  const focusWorkspace = usePerchStore((state) => state.focusWorkspace);
  const restoreWorkspace = usePerchStore((state) => state.restoreWorkspace);
  const renameWorkspace = usePerchStore((state) => state.renameWorkspace);
  const pinWorkspace = usePerchStore((state) => state.pinWorkspace);
  const setWorkspaceHidden = usePerchStore((state) => state.setWorkspaceHidden);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const openWorkspaceFiles = usePerchStore((state) => state.openWorkspaceFiles);
  const openWorkspaceGitReview = usePerchStore((state) => state.openWorkspaceGitReview);
  const switchSession = usePerchStore((state) => state.switchSession);
  const sessionId = usePerchStore((state) => state.sessionId);
  const createRequest = usePerchStore((state) => state.workspaceProjectCreate);
  const clearCreateRequest = usePerchStore((state) => state.clearWorkspaceProjectCreate);
  const deleteSession = usePerchStore((state) => state.deleteSession);
  const removeWorkspaceProject = usePerchStore((state) => state.removeWorkspaceProject);
  const requestWorktreeMenu = usePerchStore((state) => state.requestWorktreeMenu);
  const [removingProject, setRemovingProject] = useState<WorkspaceProject | null>(null);
  const [memoryFor, setMemoryFor] = useState<{ projectId: string; name: string } | null>(null);
  const [instructionsFor, setInstructionsFor] = useState<{ scope: InstructionsScope; id: string; name: string } | null>(null);
  const renameWorkspaceProject = usePerchStore((state) => state.renameWorkspaceProject);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; label: string; items: MenuItem[] } | null>(null);
  const [tabMenu, setTabMenu] = useState<{ menu: { id: string; x: number; y: number }; entries: ReturnType<typeof workspaceTabs>; extraItems: Exclude<MenuItem, "divider">[] } | null>(null);
  const createSessionOnHost = usePerchStore((state) => state.createSessionOnHost);
  // A folder that isn't a git repo has no worktrees, so its "+" starts a session there.
  const [newSession, setNewSession] = useState<{ project: WorkspaceProject; rect: DOMRect } | null>(null);
  // Collapsed projects hide their workspaces and sessions (per viewer).
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);
  function toggleCollapsed(projectId: string) {
    setCollapsed((current) => {
      const next = current.includes(projectId) ? current.filter((id) => id !== projectId) : [...current, projectId];
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch { /* per-viewer convenience */ }
      return next;
    });
  }

  // Reorder: one operation, move X before/after Y within a group (a project's chats, the
  // favourites). A pointer drag with the mouse (`slideDrag.ts`, the tab strip's too: the row
  // follows the pointer, the others slide aside); Move up/down in the row menus serves the
  // keyboard and the phone. The core keeps the order, so every viewer shows it.
  // A move writes only what it touches: the projects as shown (hidden ones keep their place),
  // or the chats of the moved and target workspaces (`moveChat`). `shown` is the row's siblings.
  // `flip`: the group shows its strip order reversed (Quickchat, newest first), so a move is
  // mirrored back into strip order before it is written and the first drag cannot flip the strips.
  function moveRow(kind: "project" | "session", id: string, target: string, after: boolean, shown: string[], flip = false) {
    if (kind === "project") setWorkspaceOrder(activeHostId, { projects: writeScope(order?.projects, moveBeside(hostProjects.map((project) => project.id), id, target, after)) });
    else moveChat(id, target, flip ? !after : after, flip ? [...shown].reverse() : shown);
  }
  const moveRowNow = useRef(moveRow);
  moveRowNow.current = moveRow;
  /** `zone` marks the item that moves (a chat row, a project's whole block) and its group;
   * `handle.onPointerDown` starts the drag from it (a project's header). A drag slides the
   * group's items (the siblings under one parent) and on release writes the slot it landed in. */
  function dnd(kind: "project" | "session", id: string, group: string, shown: string[] = [], flip = false): { handle: { onPointerDown?: (event: React.PointerEvent) => void }; zone: Record<string, string> } {
    if (!reorderable || compact) return { handle: {}, zone: {} };
    return {
      zone: { "data-reorder-group": group, "data-reorder-id": id },
      handle: {
        onPointerDown: (event) => {
          if (event.pointerType === "touch" || (event.target as HTMLElement).closest("input, textarea")) return;
          const row = (event.currentTarget as HTMLElement).closest<HTMLElement>("[data-reorder-id]");
          const list = row?.parentElement;
          if (!row || !list) return;
          let ids: string[] = [];
          beginSlideDrag(event, {
            axis: "y",
            items: () => {
              const items = [...list.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el.dataset.reorderGroup === group);
              ids = items.map((el) => el.dataset.reorderId!);
              return items;
            },
            from: (items) => items.indexOf(row),
            onMove: (ev, slide) => {
              const box = list.getBoundingClientRect();
              // Off the sidebar sideways, the row goes home and a release changes nothing.
              if (ev.clientX < box.left - 12 || ev.clientX > box.right + 12) slide.rest();
              else slide.apply(slide.slot(ev), ev);
            },
            onEnd: (apply, slide) => {
              if (!apply || slide.to === slide.from) return;
              const others = ids.filter((other) => other !== id);
              const at = slide.to;
              const target = others[at] ?? others[others.length - 1];
              if (target) moveRowNow.current(kind, id, target, at >= others.length, shown, flip);
            },
          });
        },
      },
    };
  }
  /** The row's own press handlers plus its drag, which both need `onPointerDown`. */
  function withDrag<T extends { onPointerDown: (event: React.PointerEvent) => void }>(press: T, handle: { onPointerDown?: (event: React.PointerEvent) => void }): T {
    return { ...press, onPointerDown: (event: React.PointerEvent) => { press.onPointerDown(event); handle.onPointerDown?.(event); } };
  }
  function moveItems(kind: "project" | "session", id: string, siblings: string[], flip = false): MenuItem[] {
    if (!reorderable) return [];
    return ([["up", "Move up", -1], ["down", "Move down", 1]] as const).flatMap(([key, label, step]) => {
      const to = stepTarget(siblings, id, step);
      return to ? [{ label, testId: `workspace-${kind}-move-${key}-${id}`, onSelect: () => moveRow(kind, id, to.target, to.after, siblings, flip) }] : [];
    });
  }
  /** A chat row's wrapper props: drag within `group`, and a menu (right-click or hold) with Move up/down. */
  function sessionRowProps(session: SessionSummary, siblings: SessionSummary[], group: string) {
    const flip = group === "chats" || group.startsWith("status:"); // groups shown newest first
    const { handle, zone } = group === "list" ? { handle: {}, zone: {} } : dnd("session", session.id, group, siblings.map((other) => other.id), flip);
    return {
      ...zone,
      ...withDrag(longPress((x, y) => sessionMenu(session, x, y, siblings, flip)), handle),
      onContextMenu: (event: React.MouseEvent) => {
        event.preventDefault();
        sessionMenu(session, event.clientX, event.clientY, siblings, flip);
      },
    };
  }

  /** Instructions live on the core that owns the folder; a remote project keeps its own there. */
  function instructionsItem(project: WorkspaceProject, scope: InstructionsScope, id: string, name: string, testId: string): MenuItem[] {
    return project.hostId === "local" && instructionsAvailable() ? [{ label: "Instructions…", testId, onSelect: () => setInstructionsFor({ scope, id, name }) }] : [];
  }

  function projectMenu(project: WorkspaceProject): MenuItem[] {
    const projectSessions = sessionsForProject(project.id);
    return [
      { label: "Rename", testId: `workspace-project-rename-${project.id}`, onSelect: () => setRenamingProjectId(project.id) },
      { label: "Copy path", testId: `workspace-project-copy-${project.id}`, onSelect: () => copyText(project.path) },
      ...instructionsItem(project, "project", project.id, project.name || basename(project.path), `workspace-project-instructions-${project.id}`),
      ...(project.hostId === "local" && memoryAvailable() ? [{ label: "Memory…", testId: `workspace-project-memory-${project.id}`, onSelect: () => setMemoryFor({ projectId: project.id, name: project.name || basename(project.path) }) }] : []),
      ...moveItems("project", project.id, visibleProjects.filter((other) => other.favorite === project.favorite).map((other) => other.id)),
      ...(projectSessions.length > 0
        ? [{ label: "Close all sessions", testId: `workspace-project-close-all-${project.id}`, onSelect: () => { for (const session of projectSessions) deleteSession(session.id); } }]
        : []),
      ...singleExtras(project),
      "divider",
      { label: "Remove project", testId: `workspace-project-remove-${project.id}`, danger: true, onSelect: () => setRemovingProject(project) },
    ];
  }

  /** A project with one checkout has no row of its own for it (the project row
   * stands in), so Files and Git for that checkout live on the project menu. */
  function singleWorkspaceOf(project: WorkspaceProject): WorkspaceRecord | undefined {
    if (compact) return undefined;
    const visible = workspacesForProject(workspaces, project.id).filter((w) => !w.hidden);
    const [only] = visible;
    return only && visible.length === 1 && !only.parentWorkspaceId ? only : undefined;
  }
  function singleExtras(project: WorkspaceProject): MenuItem[] {
    const workspace = singleWorkspaceOf(project);
    if (!workspace) return [];
    const open = (tool: "files" | "git") => {
      focusWorkspace(workspace.id);
      if (tool === "files") openWorkspaceFiles(workspace.id);
      else openWorkspaceGitReview(workspace.id);
    };
    return [
      "divider",
      { label: "Files", testId: `workspace-menu-files-${workspace.id}`, onSelect: () => open("files") },
      ...(workspace.branch || project.repoPath ? [{ label: "Git", testId: `workspace-menu-git-${workspace.id}`, onSelect: () => open("git") }] : []),
    ];
  }

  function workspaceMenu(project: WorkspaceProject, workspace: WorkspaceRecord): MenuItem[] {
    const linked = Boolean(workspace.parentWorkspaceId);
    const open = (tool: "files" | "git") => {
      focusWorkspace(workspace.id);
      if (tool === "files") openWorkspaceFiles(workspace.id);
      else openWorkspaceGitReview(workspace.id);
      onNavigate?.();
    };
    return [
      { label: "Rename", testId: `workspace-rename-item-${workspace.id}`, onSelect: () => setRenamingId(workspace.id) },
      { label: "Copy path", testId: `workspace-copy-${workspace.id}`, onSelect: () => copyText(workspace.path) },
      ...(workspace.branch ? [{ label: "Copy branch name", testId: `workspace-copy-branch-${workspace.id}`, onSelect: () => copyText(workspace.branch!) }] : []),
      { label: workspace.pinned ? "Unpin" : "Pin", testId: `workspace-pin-${workspace.id}`, onSelect: () => pinWorkspace(workspace.id, !workspace.pinned) },
      ...instructionsItem(project, "workspace", workspace.id, workspace.name || basename(workspace.path), `workspace-instructions-${workspace.id}`),
      "divider",
      { label: "Files", testId: `workspace-menu-files-${workspace.id}`, onSelect: () => open("files") },
      ...(workspace.branch || project.repoPath ? [{ label: "Git", testId: `workspace-menu-git-${workspace.id}`, onSelect: () => open("git") }] : []),
      ...(linked ? ["divider" as const, { label: "Hide from sidebar", testId: `workspace-hide-${workspace.id}`, onSelect: () => setWorkspaceHidden(workspace.id, true) }] : []),
      ...(linked && project.repoPath
        ? [{ label: "Delete worktree", testId: `workspace-delete-${workspace.id}`, danger: true, onSelect: () => requestWorktreeMenu(`${project.hostId}:${project.repoPath}`, { path: workspace.path, branch: workspace.branch || undefined }) }]
        : []),
    ];
  }

  function sessionRows(list: SessionSummary[], group: string): ReactElement {
    return (
      <div className="workspace-entry__sessions flex flex-col gap-[2px] pt-[2px]">
        {nestUnderLeads(list).map((session) => (
          <div {...sessionRowProps(session, list, group)} className={cn("group/row flex min-w-0 items-stretch rounded-ui", isNestedIn(session, list) && NESTED_ROW, session.id === sessionId ? "bg-surface-1" : "hover:bg-surface-1 focus-within:bg-surface-1")} data-sub-session={isNestedIn(session, list) || undefined} key={session.id}>
            <button
              type="button"
              className={cn(SESSION, "pl-[1.9rem]", session.id === sessionId ? "workspace-entry__session--active text-fg" : "text-subtext-0")}
              aria-current={session.id === sessionId ? "page" : undefined}
              title={session.title || "New session"}
              data-testid={`workspace-session-${session.id}`}
              onClick={() => pickSession(session.id)}
            >
              <StatusDot session={session} className="h-[18px] w-[18px]" />
              <span className={SESSION_TITLE}>{session.title || "New session"}</span>
            </button>
            <button
              type="button"
              className={SESSION_CLOSE}
              data-testid={`workspace-session-close-${session.id}`}
              title="Close session"
              aria-label={`Close ${session.title || "session"}`}
              onClick={() => requestCloseSession(session.id)}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true"><path d="m3 3 6 6m0-6-6 6" /></svg>
            </button>
          </div>
        ))}
      </div>
    );
  }

  function sessionMenu(session: SessionSummary, x: number, y: number, siblings: SessionSummary[], flip = false) {
    const hostId = session.hostId ?? "local";
    const entries = workspaceTabs({ ...usePerchStore.getState(), sessionId: session.id, activeHostId: hostId, activeWorkspaceId: session.workspaceId ?? null, activeProject: { hostId, cwd: session.cwd } }, useFileTabs.getState().tabs);
    setTabMenu({ menu: { id: session.id, x, y }, entries, extraItems: [...moveItems("session", session.id, siblings.map((other) => other.id), flip).filter((item) => item !== "divider"), ...inboundMenuItems(session)] });
  }
  function pickSession(id: string) {
    switchSession(id);
    onNavigate?.();
  }
  function chooseOrganize(next: Organize) {
    setOrganize(next);
    try { localStorage.setItem(ORGANIZE_KEY, next); } catch { /* per-viewer convenience */ }
  }
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");

  // The desktop app can also pick a local folder with the OS dialog, but only
  // when asked for inside the Add project dialog (Orca's "Browse folder").
  const tauriInvoke = (window as { __TAURI_INTERNALS__?: { invoke: (cmd: string, args: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__?.invoke;
  async function browseNative() {
    try {
      const picked = await tauriInvoke?.("plugin:dialog|open", { options: { directory: true, title: "Add project" } });
      if (typeof picked === "string") submitProject(picked);
    } catch { /* cancelled or unavailable: the directory browser below still works */ }
  }
  // The home screen's "Add project" (NoSessionPanel.tsx) starts the same flow.
  useEffect(() => {
    const open = () => { setAddHostId(usePerchStore.getState().activeHostId); setAddOpen(true); };
    window.addEventListener(ADD_PROJECT_EVENT, open);
    return () => window.removeEventListener(ADD_PROJECT_EVENT, open);
  }, []);

  useEffect(() => {
    if (createRequest?.status !== "success") return;
    // The sidebar lists one host at a time: follow the project to its host.
    if (createRequest.hostId !== activeHostId) setActiveHost(createRequest.hostId);
    setName("");
    setAddOpen(false);
    clearCreateRequest();
  }, [clearCreateRequest, createRequest?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const hostProjects = useMemo(
    () => orderProjects(projects
      .filter((project) => project.hostId === activeHostId)
      .sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      }), order?.projects),
    [activeHostId, projects, order?.projects],
  );
  const chatsProject = hostProjects.find(isChatsProject);
  const visibleProjects = hostProjects.filter((project) => !isChatsProject(project));

  function submitProject(path: string) {
    if (!path.trim() || createRequest?.status === "pending") return;
    createWorkspaceProject(path, name, addHostId);
  }

  // A project's chats, workspace by workspace in each strip's order (the core's chat order is in it).
  function sessionsForProject(projectId: string): SessionSummary[] {
    return workspacesForProject(workspaces, projectId).flatMap(tabOrderedSessions);
  }

  function navigateToWorkspace(workspaceId: string) {
    goToWorkspace(workspaceId);
    onNavigate?.();
  }

  // "In one list": every session on this host, projects and Chats alike, newest first.
  // Purely chronological (DECISIONS.md): the core's order does not apply, and there is no drag.
  const allSessions = useMemo(
    () => sessions.filter((session) => (session.hostId ?? "local") === activeHostId).sort((a, b) => b.createdAt - a.createdAt),
    [sessions, activeHostId],
  );
  const listView = (
    <div className="flex flex-col gap-[2px] py-[0.2rem]" data-testid="workspace-session-list">
      {allSessions.length === 0 && <div className="px-[0.3rem] py-2 text-[0.7rem] text-subtext-0">Nothing in Quickchat yet.</div>}
      {allSessions.map((session) => {
        const owner = projects.find((project) => project.id === session.projectId);
        return (
          <div {...sessionRowProps(session, [], "list")} className={cn("group/row flex min-w-0 items-stretch rounded-ui",session.id === sessionId ? "bg-surface-1" : "hover:bg-surface-1 focus-within:bg-surface-1")} key={session.id}>
            <button
              type="button"
              className={cn(SESSION, session.id === sessionId ? "workspace-entry__session--active text-fg" : "text-subtext-0")}
              aria-current={session.id === sessionId ? "page" : undefined}
              data-testid={`workspace-session-${session.id}`}
              title={session.cwd}
              onClick={() => {
                switchSession(session.id);
                onNavigate?.();
              }}
            >
              <StatusDot session={session} className="h-[18px] w-[18px]" />
              <span className={SESSION_TITLE}>{session.title || "New chat"}</span>
              {owner && !isChatsProject(owner) && <span className="min-w-0 max-w-[35%] truncate text-[0.62rem] text-subtext-0" title={owner.name || basename(owner.path)}>{owner.name || basename(owner.path)}</span>}
            </button>
            <button
              type="button"
              className={SESSION_CLOSE}
              data-testid={`workspace-session-close-${session.id}`}
              title="Close chat"
              aria-label={`Close ${session.title || "chat"}`}
              onClick={() => requestCloseSession(session.id)}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true"><path d="m3 3 6 6m0-6-6 6" /></svg>
            </button>
          </div>
        );
      })}
    </div>
  );

  // "By status": the same chats in sections by what they need from you. A chat you are
  // reading stays in Done until you leave it (`holdFinished`), so its row does not jump.
  const attentionEvents = useAttention((state) => state.events);
  const hostReachable = activeHostId === "local" ? connected : hostStates[activeHostId]?.state === "connected";
  const viewedSession = sessions.find((session) => session.id === sessionId);
  const viewedDot = viewedSession && sessionDotState(viewedSession);
  const reading = useRef<{ id: string | null; held: string | null; dot?: AgentDotState }>({ id: null, held: null });
  const held = holdFinished(reading.current.id === sessionId ? reading.current.held : null, sessionId, reading.current.id === sessionId ? reading.current.dot : undefined, viewedDot);
  reading.current = { id: sessionId, held, dot: viewedDot };
  const needsEvents = useMemo(() => new Map(needsYou(attentionEvents).map((event) => [event.sessionId, event])), [attentionEvents]);
  // Within a section: newest first on screen, the mirror of the strips' order (each workspace in its
  // strip's order, then the core's chat order), so a move is mirrored back before it is written and
  // a first move changes nothing else. Built from reversed inputs so chats the core has not listed
  // yet (new ones) sit on top, newest first.
  const statusChats = useMemo(
    () => orderBy([...chatsInStripOrder(usePerchStore.getState(), allSessions)].reverse(), order?.sessions && [...order.sessions].reverse(), (session) => session.id),
    [allSessions, order?.sessions, workspaces, tabOrderVersion], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const statusGroups = useMemo(() => groupByStatus(statusChats, new Set(needsEvents.keys()), held), [statusChats, needsEvents, held]);
  const statusSections: { key: string; title: string; note?: string; list: SessionSummary[] }[] = hostReachable
    ? STATUS_SECTIONS.map((key) => ({ key, title: STATUS_LABELS[key], list: statusGroups[key] })).filter((section) => section.list.length > 0)
    // Not connected: what these chats were doing is unknown. Show them once, as last known, never as Working/Idle/Done.
    : allSessions.length ? [{ key: "offline", title: "Offline: last known", note: activeHostId === "local" ? "Reconnecting…" : `${sshHosts.find((host) => host.id === activeHostId)?.name ?? activeHostId}: ${hostStates[activeHostId]?.state ?? "connecting"}`, list: statusChats }] : [];
  /** The branch or name of a session's workspace, only where its project has several (else the project says it all). */
  function workspaceTag(session: SessionSummary): string | null {
    const own = workspaces.find((candidate) => candidate.id === session.workspaceId);
    if (!own || workspacesForProject(workspaces, own.projectId).filter((w) => !w.hidden).length < 2) return null;
    return own.branch || own.name;
  }
  function needsReason(session: SessionSummary): string {
    const need = needsEvents.get(session.id);
    return need ? [reasonLabel(need), certaintyNote(need)].filter(Boolean).join(" · ") : "Waiting for you";
  }
  /** One chat row of the Sessions section; `detail` is the muted second line (what its group does not already say). */
  function statusRow(session: SessionSummary, list: SessionSummary[], group: string, detail: string) {
    return (
      <div {...sessionRowProps(session, list, group)} className={cn("group/row flex min-w-0 items-stretch rounded-ui", isNestedIn(session, list) && NESTED_ROW, session.id === sessionId ? "bg-surface-1" : "hover:bg-surface-1 focus-within:bg-surface-1")} data-sub-session={isNestedIn(session, list) || undefined} key={session.id}>
        <button
          type="button"
          className={cn(SESSION, "min-h-9 py-0 pl-[1.875rem] min-[701px]:min-h-6", session.id === sessionId ? "workspace-entry__session--active text-fg" : "text-subtext-0")}
          aria-current={session.id === sessionId ? "page" : undefined}
          data-testid={`workspace-session-${session.id}`}
          data-session={session.id}
          title={session.cwd}
          onClick={() => {
            switchSession(session.id);
            onNavigate?.();
          }}
        >
          {/* The section says the state, so the row is just the harness and the name. */}
          <StatusDot plain session={session} className="h-4 w-4" />
          {/* One line: the name, then what it adds (the workspace, or why it needs you), muted. */}
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="min-w-0 shrink-[2] truncate">{session.title || "New chat"}</span>
            {detail && <span className="min-w-0 flex-1 truncate text-[0.62rem] text-subtext-0" data-testid="status-row-detail">{detail}</span>}
          </span>
        </button>
        <button
          type="button"
          className={SESSION_CLOSE}
          data-testid={`workspace-session-close-${session.id}`}
          title="Close chat"
          aria-label={`Close ${session.title || "chat"}`}
          onClick={() => requestCloseSession(session.id)}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true"><path d="m3 3 6 6m0-6-6 6" /></svg>
        </button>
      </div>
    );
  }

  /** `list` split by project, in the order the projects are shown (Quickchat last); others under "Other". */
  function clusterByProject(list: SessionSummary[]): { id: string; name: string; project?: WorkspaceProject; list: SessionSummary[] }[] {
    const shown = [...visibleProjects, ...(chatsProject ? [chatsProject] : [])];
    const known = new Set(shown.map((project) => project.id));
    return [...shown.map((project) => ({ id: project.id, project, name: isChatsProject(project) ? "Quickchat" : project.name || basename(project.path) })), { id: "other", project: undefined, name: "Other" }].flatMap(({ id, name, project }) => {
      const rows = list.filter((session) => (session.projectId && known.has(session.projectId) ? session.projectId : "other") === id);
      return rows.length ? [{ id, name, project, list: rows }] : [];
    });
  }
  /** The "+" at the end of a project line: a worktree menu for a git project, else a new session in its folder. */
  function projectPlus(project: WorkspaceProject, className: string) {
    return project.repoPath ? <WorktreeMenu hostId={project.hostId} cwd={project.repoPath} projectKey={`${project.hostId}:${project.repoPath}`} className={className} /> : (
      <button
        type="button"
        className={cn("worktree-menu__btn", className)}
        data-testid={`workspace-project-new-session-${project.id}`}
        title="New session in this folder"
        aria-label="New session"
        onClick={(event) => setNewSession({ project, rect: event.currentTarget.getBoundingClientRect() })}
      >
        <PlusIcon />
      </button>
    );
  }
  // Projects with no agent chat yet, listed last in By status so none goes missing.
  const emptyProjects = visibleProjects.filter((project) => !sessions.some((session) => session.projectId === project.id));
  function openProject(project: WorkspaceProject) {
    const first = workspacesForProject(workspaces, project.id).find((w) => !w.hidden);
    if (first) navigateToWorkspace(first.id);
  }
  const statusView = (
    <div className="flex flex-col gap-[2px] py-[0.2rem]" data-testid="workspace-status-view">
      {allSessions.length === 0 && <div className="px-[0.3rem] py-2 text-[0.7rem] text-subtext-0">No chats yet.</div>}
      {statusSections.map((section) => (
        <div className="flex flex-col gap-[2px]" key={section.key} data-testid={`status-section-${section.key}`}>
          <SectionHeading section={section.key === "offline" ? undefined : (section.key as StatusSection)} title={section.title} count={section.list.length} note={section.note} countLabel={`${section.list.length} chats`} testId={`status-section-title-${section.key}`} />
          {/* Each section keeps its chats under their project, in the sidebar's project order. */}
          {clusterByProject(section.list).map((cluster) => (
            <div className="flex flex-col" key={cluster.id} data-testid={`status-project-${section.key}-${cluster.id}`}>
              <div className="group/ph flex items-center pr-1 pl-3">
                {cluster.project && !isChatsProject(cluster.project) ? <FolderMark /> : <span className="mr-1.5 w-3 shrink-0" aria-hidden="true" />}
                <span className="min-w-0 flex-1 truncate py-[3px] text-[12.5px] font-medium text-fg" data-testid="status-project-title">{cluster.name}</span>
                {cluster.project && !isChatsProject(cluster.project) && projectPlus(cluster.project, cn(PROJECT_ICON, "size-5"))}
              </div>
              {nestUnderLeads(cluster.list).map((session) => statusRow(session, cluster.list, `status:${section.key}:${cluster.id}`, [workspaceTag(session), section.key === "needs" ? needsReason(session) : null].filter(Boolean).join(" · ")))}
            </div>
          ))}
        </div>
      ))}
      {emptyProjects.length > 0 && (
        <div className="flex flex-col" data-testid="status-no-sessions">
          <SectionHeading title="No sessions" count={emptyProjects.length} countLabel={`${emptyProjects.length} projects`} testId="status-no-sessions-title" />
          {emptyProjects.map((project) => (
            <div className="group/ph flex min-w-0 items-center rounded-ui hover:bg-surface-1" key={project.id} data-testid={`status-empty-project-${project.id}`}>
              <button type="button" className={cn(SESSION, "min-h-9 gap-0 py-0 pl-3 text-fg min-[701px]:min-h-6")} title={project.path} onClick={() => openProject(project)}>
                <FolderMark />
                <span className={cn(SESSION_TITLE, "text-[12.5px] font-medium")}>{project.name || basename(project.path)}</span>
              </button>
              {projectPlus(project, cn(PROJECT_ICON, "size-5"))}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // After the projects, inside their scrolling list (or after the empty state).
  const chatsSection = chatsProject && (() => {
        const chats = sessionsForProject(chatsProject.id);
        // Newest first on screen; the strip (oldest first) stays the stored order.
        const shownChats = [...chats].reverse();
        const chatsCollapsed = collapsed.includes(chatsProject.id);
        return (
          <div className="flex flex-col gap-[2px]" data-testid="workspace-chats">
            <div className="group/ph flex items-stretch rounded-ui hover:bg-surface-1">
              <button
                type="button"
                className="flex min-h-8 flex-1 cursor-pointer items-center gap-[0.35rem] rounded-ui py-1 pr-[0.55rem] pl-[0.75rem] text-left text-[14px] font-semibold text-subtext-0 [background:none] [border:0] [font-family:inherit] [line-height:inherit] hover:text-fg focus-visible:text-fg min-[701px]:pl-4 min-[701px]:text-[0.62rem] min-[701px]:tracking-[0.045em] min-[701px]:uppercase"
                data-testid="workspace-chats-collapse"
                aria-expanded={!chatsCollapsed}
                onClick={() => toggleCollapsed(chatsProject.id)}
              >
                Quickchat
                <Chevron open={!chatsCollapsed} />
              </button>
              {chats.length > 0 && (
                <button
                  type="button"
                  className={PROJECT_ICON}
                  data-testid="workspace-chats-menu"
                  title="Quickchat actions"
                  aria-label="Quickchat actions"
                  aria-haspopup="menu"
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMenu({ x: rect.left, y: rect.bottom + 4, label: "Quickchat actions", items: [
                      { label: "Close all chats", testId: "workspace-chats-close-all", danger: true, onSelect: () => { for (const chat of chats) deleteSession(chat.id); } },
                    ] });
                  }}
                >
                  <EllipsisIcon />
                </button>
              )}
              <button
                type="button"
                className={rowAction()}
                data-testid="workspace-chats-new"
                title="New chat"
                aria-label="New chat"
                onClick={() => {
                  newScratchpad();
                  onNavigate?.();
                }}
              >
                <svg className="mx-auto" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 3H4.5A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13h7a1.5 1.5 0 0 0 1.5-1.5V8M11.2 2.8a1.2 1.2 0 0 1 1.7 1.7L8.5 8.9 6 9.5l.6-2.5z" />
                </svg>
              </button>
            </div>
            {!chatsCollapsed && chats.length > 0 && (
              <div className="flex flex-col gap-[2px] pt-[2px] pr-[0.3rem] pl-[0.4rem]">
                {nestUnderLeads(shownChats).map((session) => (
                  <div {...sessionRowProps(session, shownChats, "chats")} className={cn("group/row flex min-w-0 items-stretch rounded-ui", isNestedIn(session, shownChats) && NESTED_ROW, session.id === sessionId ? "bg-surface-1" : "hover:bg-surface-1 focus-within:bg-surface-1")} data-sub-session={isNestedIn(session, shownChats) || undefined} key={session.id}>
                    <button
                      type="button"
                      className={cn(SESSION, session.id === sessionId ? "workspace-entry__session--active text-fg" : "text-subtext-0")}
                      aria-current={session.id === sessionId ? "page" : undefined}
                      data-testid={`workspace-session-${session.id}`}
                      title={session.title || "New chat"}
                      onClick={() => {
                        switchSession(session.id);
                        onNavigate?.();
                      }}
                    >
                      <StatusDot session={session} className="h-[18px] w-[18px]" />
                      <span className={SESSION_TITLE}>{session.title || "New chat"}</span>
                    </button>
                    <button
                      type="button"
                      className={SESSION_CLOSE}
                      data-testid={`workspace-session-close-${session.id}`}
                      title="Close chat"
                      aria-label={`Close ${session.title || "chat"}`}
                      onClick={() => requestCloseSession(session.id)}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true"><path d="m3 3 6 6m0-6-6 6" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
  })();

  // One tree for everything: Project → Workspace → Session. A workspace lists the sessions that matter
  // (Needs you, Done, Working, the open one) and folds the idle rest into "+N idle"; a folded project says
  // its most urgent state. By status and In one list are flat views of the same chats.
  const needsIds = useMemo(() => new Set(needsEvents.keys()), [needsEvents]);
  const needingCount = hostReachable ? statusGroups.needs.length : 0;
  const [idleOpen, setIdleOpen] = useState<string[]>([]);
  /** The session rows under a workspace row. The open workspace lists all its chats; others fold the idle ones
   * unless the viewer unfolded them. An unreachable host's last-known states are not trusted to hide anything. */
  function workspaceSessionRows(workspace: WorkspaceRecord, list: SessionSummary[]): ReactElement | null {
    const unfolded = workspace.id === activeWorkspaceId || idleOpen.includes(workspace.id) || !hostReachable;
    const { shown, idle } = discloseSessions(list, needsIds, held, sessionId, unfolded);
    if (!shown.length && !idle) return null;
    const toggle = (
      <button
        type="button"
        className={cn("min-h-7 w-full cursor-pointer rounded-ui bg-transparent py-1 pr-3 pl-[1.9rem] text-left text-[0.68rem] text-subtext-0 [border:0] [font-family:inherit] hover:text-fg", FOCUS)}
        aria-expanded={idleOpen.includes(workspace.id)}
        data-testid={`workspace-idle-${workspace.id}`}
        onClick={() => setIdleOpen((current) => (current.includes(workspace.id) ? current.filter((id) => id !== workspace.id) : [...current, workspace.id]))}
      >
        {idle ? `+${idle} idle` : "Hide idle"}
      </button>
    );
    return (
      <>
        {shown.length > 0 && sessionRows(shown, workspace.id)}
        {(idle > 0 || (idleOpen.includes(workspace.id) && workspace.id !== activeWorkspaceId && hostReachable)) && toggle}
      </>
    );
  }
  /** Most urgent section of a workspace's chats, as an index into STATUS_SECTIONS (Idle when nothing is known). */
  function urgency(list: SessionSummary[]): number {
    const top = hostReachable ? topSection(list, needsIds, held) : null;
    return top ? STATUS_SECTIONS.indexOf(top) : STATUS_SECTIONS.length - 1;
  }
  const filtering = activeOnly && hostReachable;
  const workspaceLive = (w: WorkspaceRecord) => !filtering || w.id === activeWorkspaceId || urgency(sessionsForWorkspace(sessions, w)) < STATUS_SECTIONS.length - 1;
  // Projects as shown: those with something live when filtering, and by attention (favourites first) when sorting.
  const shownProjects = visibleProjects
    .filter((project) => !filtering || workspacesForProject(workspaces, project.id).some((w) => !w.hidden && workspaceLive(w)))
    .map((project, at) => ({ project, at, urgent: Math.min(STATUS_SECTIONS.length, ...workspacesForProject(workspaces, project.id).map((w) => urgency(sessionsForWorkspace(sessions, w)))) }))
    .sort((a, b) => (attentionSort ? Number(b.project.favorite) - Number(a.project.favorite) || a.urgent - b.urgent : 0) || a.at - b.at)
    .map((entry) => entry.project);
  const organizeButton = (
    <button
      type="button"
      className={cn(segment(), "grid w-9 place-items-center p-0 min-[701px]:my-[3px] min-[701px]:rounded-ui [@media(max-width:700px)]:h-[2.75rem] [@media(max-width:700px)]:w-[2.75rem] [@media(max-width:700px)]:min-w-[2.75rem]")}
      title="Organize sidebar"
      aria-label="Organize sidebar"
      aria-haspopup="menu"
      data-testid="workspace-organize"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const tick = (on: boolean) => (on ? "✓ " : "   ");
        setMenu({ x: rect.left, y: rect.bottom + 4, label: "Organize sidebar", items: [
          ...(Object.keys(ORGANIZE_LABELS) as Organize[]).map((key) => (
            { label: `${tick(organize === key)}${ORGANIZE_LABELS[key]}`, testId: `workspace-organize-${key}`, onSelect: () => chooseOrganize(key) }
          )),
          "divider" as const,
          { label: `${tick(showTerminals)}Show terminals`, testId: "workspace-show-terminals", onSelect: () => { setShowTerminals(!showTerminals); saveFlag(SHOW_TERMINALS_KEY, showTerminals ? "0" : "1"); } },
          ...(organize === "project" ? [
            "divider" as const,
            { label: `${tick(attentionSort)}Sort by attention`, testId: "workspace-sort-attention", onSelect: () => { setAttentionSort(!attentionSort); saveFlag(SORT_KEY, attentionSort ? "manual" : "attention"); } },
            { label: `${tick(activeOnly)}Show active only`, testId: "workspace-active-only", onSelect: () => { setActiveOnly(!activeOnly); saveFlag(ACTIVE_ONLY_KEY, activeOnly ? "0" : "1"); } },
          ] : []),
        ] });
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3" />
      </svg>
    </button>
  );

  return (
    <section
      className={cn(
        "workspace-overview flex flex-col overflow-hidden",
        // compact = the phone switcher, where the panel owns the bottom edge
        compact ? "min-h-full flex-1" : "min-h-0 flex-1",
      )}
      data-testid="workspace-overview"
      aria-label="Projects and workspaces"
    >
      <div className="flex shrink-0 items-stretch justify-between gap-[0.45rem] pl-[0.75rem] min-[701px]:pr-[3px] min-[701px]:pl-4">
        <div className="flex min-w-0 items-center gap-[0.45rem] py-[0.55rem]">
          <span className="text-[0.72rem] font-bold tracking-[0.08em] text-fg uppercase min-[701px]:text-[0.62rem] min-[701px]:font-semibold min-[701px]:tracking-[0.045em] min-[701px]:text-subtext-0">{organize === "project" ? "Projects" : "Sessions"}</span>
          <span className="text-[0.65rem] whitespace-nowrap text-subtext-0 min-[701px]:hidden">
            {organize !== "project"
              ? `${allSessions.length} session${allSessions.length === 1 ? "" : "s"}`
              : visibleProjects.length ? `${visibleProjects.length} project${visibleProjects.length === 1 ? "" : "s"}` : "No projects"}
          </span>
        </div>
        <div className="flex shrink-0 items-stretch">
          {/* Across every project: how many chats need you, and one click to the next. */}
          {needingCount > 0 && (
            <button
              type="button"
              className={cn("my-[3px] cursor-pointer self-center rounded-ui bg-transparent px-2 py-[0.15rem] text-[0.68rem] font-medium text-accent [border:0] [font-family:inherit] hover:bg-surface-1 [@media(max-width:700px)]:min-h-[2.75rem]", FOCUS)}
              data-testid="workspace-needs-you"
              title="Open the next chat that needs you"
              onClick={() => { openNextAttention(); onNavigate?.(); }}
            >
              {needingCount} need{needingCount === 1 ? "s" : ""} you
            </button>
          )}
          {organizeButton}
          <button
            type="button"
            className={cn(segment(), "gap-1 px-[0.6rem] text-[0.72rem] font-medium min-[701px]:my-[3px] min-[701px]:rounded-ui [@media(max-width:700px)]:min-h-[2.75rem] [@media(max-width:700px)]:px-[0.65rem]")}
            data-testid="workspace-add-project"
            title="Add project"
            aria-label="Add project"
            onClick={() => { setAddHostId(activeHostId); setAddOpen((open) => !open); }}
          >
            <PlusIcon size={12} />
            Add
          </button>
        </div>
      </div>

      {addOpen && (
        <Dialog title="Add project" onClose={() => setAddOpen(false)} testId="workspace-add-form">
          <label className="grid gap-[0.16rem] text-[0.7rem] text-subtext-0">
            <span>Name <em className="text-overlay-1 not-italic">optional</em></span>
            <input
              className="w-full min-w-0 rounded-ui bg-surface-0 px-[0.5rem] py-[0.4rem] text-fg focus:[outline:1px_solid_var(--accent)]"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Project name"
              data-testid="workspace-project-name"
            />
          </label>
          {sshHosts.length > 0 && (
            <label className="grid gap-[0.16rem] text-[0.7rem] text-subtext-0">
              <span>Host</span>
              <Select className={SELECT} testId="workspace-add-host" ariaLabel="Host" value={addHostId} onChange={setAddHostId}
                options={[{ value: "local", label: "This machine" }, ...sshHosts.filter((host) => host.enabled).map((host) => {
                  const state = hostStates[host.id]?.state ?? "connecting";
                  return { value: host.id, label: `${host.name}${state === "connected" ? "" : ` (${state})`}`, disabled: state !== "connected" };
                })]} />
            </label>
          )}
          {tauriInvoke && addHostId === "local" && (
            <button type="button" className={cn(GHOST_BUTTON, "px-[0.6rem] py-[0.4rem] text-left text-[0.8rem] text-fg")} data-testid="workspace-add-browse-native" onClick={() => void browseNative()}>
              Browse folder…
            </button>
          )}
          {/* Same folder picker as "+ New session"; its "Use this folder" registers. */}
          <DirectoryBrowser key={addHostId} hostId={addHostId} onUseFolder={submitProject} />
          {createRequest?.status === "pending" && <span className="text-[0.7rem] text-subtext-0" role="status">Registering folder…</span>}
          {createRequest?.status === "error" && <span className="text-[0.7rem] text-red" role="alert">{createRequest.error || "Could not register this folder."}</span>}
          <div className="flex justify-end">
            <button type="button" className={cn(GHOST_BUTTON, "px-[0.6rem] py-[0.3rem] text-[0.75rem]", FOCUS)} disabled={createRequest?.status === "pending"} onClick={() => setAddOpen(false)}>
              Cancel
            </button>
          </div>
        </Dialog>
      )}

      {snapshot?.state === "loading" && (
        <div className="shrink-0 px-[0.65rem] py-[0.55rem] text-[0.7rem] text-subtext-0" role="status">Loading workspace…</div>
      )}
      {snapshot?.state === "error" && (
        <div className="flex shrink-0 items-center gap-[0.45rem] px-[0.65rem] py-[0.55rem] text-[0.7rem] text-red" role="alert">
          {snapshot.error || "Workspace could not be loaded."}
          <button type="button" className={button({ size: "sm", className: "ml-auto text-inherit hover:text-inherit" })} onClick={() => fetchWorkspaceSnapshot(activeHostId)}>Retry</button>
        </div>
      )}

      {organize === "project" && visibleProjects.length === 0 && snapshot?.state !== "loading" && (
        <div className="grid justify-items-start gap-[0.32rem] px-3 py-[1.1rem] text-[0.68rem] text-subtext-0">
          <span className="text-[1.3rem] leading-none text-accent" aria-hidden="true">＋</span>
          <strong className="text-[0.77rem] text-fg">Add a project</strong>
          <span>A project keeps its workspaces, sessions and files together.</span>
          {!addOpen && (
            <button type="button" className={button({ variant: "soft", size: "sm", className: "mt-[0.18rem] text-fg" })} onClick={() => setAddOpen(true)} data-testid="workspace-empty-add">
              Register folder
            </button>
          )}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto px-[3px] py-[3px] [&>*]:shrink-0" data-testid="project-list">
          {organize !== "project" && !showNestHints ? (organize === "list" ? listView : statusView) : <>
          {shownProjects.map((project) => {
            const allWorkspaces = workspacesForProject(workspaces, project.id);
            const projectWorkspaces = allWorkspaces.filter((w) => !w.hidden);
            const hiddenWorkspaces = allWorkspaces.filter((w) => w.hidden);
            const projectJobs = project.hostId === "local"
              ? worktreeJobs.filter((job) => job.repoPath === project.repoPath || job.repoPath === project.path)
              : [];
            const projectCollapsed = collapsed.includes(project.id) && !showNestHints;
            const single = singleWorkspaceOf(project);
            const shortcutHint = single ? nestHint(single.id) : null;
            const projectSessions = sessionsForProject(project.id);
            // With nothing to fold away, the header opens the checkout instead.
            const collapsible = !single;
            // Folded, a project still says what needs you.
            const foldedTop = projectCollapsed && hostReachable ? topSection(projectSessions, needsIds, held) : null;
            const foldedSessions = foldedTop && foldedTop !== "idle" ? projectSessions.filter((s) => sectionOf(s, needsIds, held) === foldedTop) : [];
            const onHeaderClick = () => (collapsible || !single ? toggleCollapsed(project.id) : navigateToWorkspace(single.id));
            // Reorder inside the favourites or the rest; the whole project is the drop target.
            const projectDnd = dnd("project", project.id, project.favorite ? "favorites" : "projects");
            return (
              <div
                {...projectDnd.zone}
                className="workspace-project flex flex-col gap-[2px]"
                key={project.id}
                data-testid={`workspace-project-${project.id}`}
              >
                <div
                  {...withDrag(longPress((x, y) => setMenu({ x, y, label: "Project actions", items: projectMenu(project) })), renamingProjectId === project.id ? {} : projectDnd.handle)}
                  className={cn("group/ph relative flex cursor-pointer flex-wrap items-stretch rounded-ui hover:bg-surface-1", HOLDABLE, single && "workspace-entry", single && single.id === activeWorkspaceId && (projectCollapsed || projectSessions.length === 0) && "bg-surface-1")}
                  data-testid={single ? `workspace-entry-${single.id}` : undefined}
                  onClick={(event) => {
                    if (renamingProjectId === project.id || (event.target as HTMLElement).closest("button, input, a")) return;
                    onHeaderClick();
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu({ x: event.clientX, y: event.clientY, label: "Project actions", items: projectMenu(project) });
                  }}
                >
                {renamingProjectId === project.id ? (
                  <input
                    className={RENAME}
                    data-testid={`workspace-project-rename-input-${project.id}`}
                    aria-label="Project name"
                    autoFocus
                    defaultValue={project.name || basename(project.path)}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Enter") {
                        renameWorkspaceProject(project.id, event.currentTarget.value);
                        setRenamingProjectId(null);
                      } else if (event.key === "Escape") {
                        setRenamingProjectId(null);
                      }
                    }}
                    onBlur={() => setRenamingProjectId(null)}
                  />
                ) : (
                <button
                  type="button"
                  className={cn(
                    ROW_BTN,
                    "min-h-8 flex-1 cursor-pointer gap-[0.45rem] rounded-ui bg-transparent py-[3px] pr-3 pl-3 text-fg",
                    single && "workspace-entry__button",
                    single && single.id === activeWorkspaceId && "workspace-entry__button--active",
                    FOCUS,
                  )}
                  data-testid={`project-toggle-${project.id}`}
                  aria-expanded={collapsible ? !projectCollapsed : undefined}
                  onClick={onHeaderClick}
                  title={project.path}
                >
                  {collapsible && <Chevron open={!projectCollapsed} size={10} className="-ml-1 hidden shrink-0 text-subtext-0 min-[701px]:block" />}
                  <svg className="h-3 w-3 shrink-0 text-subtext-0" data-testid="project-folder-icon" viewBox="0 0 16 16" fill={project.favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <path d="M2 5V4a1 1 0 0 1 1-1h3l2 2h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5Z" />
                  </svg>
                  <span className="grid min-w-0 gap-[0.1rem]">
                    <strong className={STRONG}>{project.name || basename(project.path)}</strong>
                  </span>
                  {single?.branch && single.branch !== (project.name || basename(project.path)) && <span className={cn(SPAN, "min-w-0 shrink-[3]")}>{single.branch}</span>}
                  {single?.dirty && <span className={DOT} title="Uncommitted changes" aria-label="Uncommitted changes">●</span>}
                  {collapsible && <Chevron open={!projectCollapsed} className="shrink-0 text-subtext-0 min-[701px]:hidden" />}
                  {shortcutHint}
                </button>
                )}
                {foldedTop && foldedSessions.length > 0 && (
                  <span className="flex items-center self-center pr-1"><Rollup sessions={foldedSessions} section={foldedTop} testId={`project-rollup-${project.id}`} /></span>
                )}
                <button
                  type="button"
                  className={cn(PROJECT_ICON, shortcutHint && "invisible")}
                  data-testid={`workspace-project-menu-${project.id}`}
                  title="Project actions"
                  aria-label="Project actions"
                  aria-haspopup="menu"
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMenu({ x: rect.left, y: rect.bottom + 4, label: "Project actions", items: projectMenu(project) });
                  }}
                >
                  <EllipsisIcon />
                </button>
                {projectPlus(project, cn(HEADER_PLUS, shortcutHint && "invisible"))}
                </div>
                {(!projectCollapsed || (single && !collapsible)) && (allWorkspaces.length > 0 || projectJobs.length > 0) && (
                  <div className="workspace-project__workspaces flex flex-col gap-[2px]">
                    {(() => {
                      // Orca's parent nesting: a worktree whose parent is another
                      // linked worktree renders under it; children of the primary
                      // workspace stay top level.
                      const byId = new Map(projectWorkspaces.map((w) => [w.id, w]));
                      const children = new Map<string, WorkspaceRecord[]>();
                      const roots: WorkspaceRecord[] = [];
                      for (const w of projectWorkspaces) {
                        const parent = w.parentWorkspaceId ? byId.get(w.parentWorkspaceId) : undefined;
                        if (parent?.parentWorkspaceId) children.set(parent.id, [...(children.get(parent.id) ?? []), w]);
                        else roots.push(w);
                      }
                      // Active-only keeps a workspace that is open or has something going on, and the parent of one.
                      const keep = (w: WorkspaceRecord): boolean => workspaceLive(w) || (children.get(w.id) ?? []).some(keep);
                      const renderWorkspace = (workspace: WorkspaceRecord, depth: number): ReactElement => {
                      const workspaceActive = workspace.id === activeWorkspaceId;
                      const workspaceSessions = sessionsForWorkspace(sessions, workspace);
                      const nested = (children.get(workspace.id) ?? []).filter(keep);
                      return (
                        <div className="flex flex-col gap-[2px]" data-testid={`workspace-node-${workspace.id}`} key={workspace.id}>
                        <div
                          {...longPress((x, y) => setMenu({ x, y, label: "Workspace actions", items: workspaceMenu(project, workspace) }))}
                          className={cn("workspace-entry group/entry relative cursor-pointer rounded-ui", HOLDABLE)}
                          data-testid={`workspace-entry-${workspace.id}`}
                          onClick={(event) => {
                            if (renamingId === workspace.id || (event.target as HTMLElement).closest("button, input, a")) return;
                            navigateToWorkspace(workspace.id);
                          }}
                          onContextMenu={(event) => {
                            if ((event.target as HTMLElement).closest(".workspace-entry__sessions")) return;
                            event.preventDefault();
                            setMenu({ x: event.clientX, y: event.clientY, label: "Workspace actions", items: workspaceMenu(project, workspace) });
                          }}
                        >
                          {renamingId === workspace.id ? (
                            <input
                              className={RENAME}
                              data-testid={`workspace-rename-${workspace.id}`}
                              aria-label="Workspace name"
                              autoFocus
                              defaultValue={workspace.name || basename(workspace.path)}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                                if (event.key === "Enter") {
                                  renameWorkspace(workspace.id, event.currentTarget.value);
                                  setRenamingId(null);
                                } else if (event.key === "Escape") {
                                  setRenamingId(null);
                                }
                              }}
                              onBlur={() => setRenamingId(null)}
                            />
                          ) : (
                          <div className={cn("flex flex-wrap items-stretch rounded-ui hover:bg-surface-1", workspaceActive && workspaceSessions.length === 0 && "bg-surface-1")}>
                          <button
                            type="button"
                            className={cn(
                              ENTRY_BTN,
                              "flex-1 bg-transparent pr-12",
                              workspaceActive && "workspace-entry__button--active",
                            )}
                            aria-pressed={workspaceActive}
                            onClick={() => navigateToWorkspace(workspace.id)}
                            title={workspace.path}
                          >
                            <svg className="h-3 w-3 shrink-0 text-subtext-0" data-testid="workspace-checkout-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                              {workspace.parentWorkspaceId ? <>
                                <circle cx="4" cy="3" r="1.5" />
                                <circle cx="4" cy="13" r="1.5" />
                                <circle cx="12" cy="3" r="1.5" />
                                <path d="M4 4.5v7M4 9h4a4 4 0 0 0 4-4v-.5" />
                              </> : <path d="M8 3l5 5-5 5-5-5z" />}
                            </svg>
                            <span className={cn(BODY, "flex items-baseline gap-[0.35rem]")}>
                              <strong
                                className={cn(WORKSPACE_TITLE, workspaceActive ? "text-fg" : "text-subtext-0")}
                                title="Double-click to rename"
                                onDoubleClick={(event) => {
                                  event.stopPropagation();
                                  setRenamingId(workspace.id);
                                }}
                              >
                                {workspace.name || basename(workspace.path)}
                              </strong>
                              {/* A branch only when it tells checkouts apart; the path is in the tooltip. */}
                              {workspace.branch && workspace.branch !== (workspace.name || basename(workspace.path)) && <span className={cn(SPAN, "min-w-0 shrink-[3]")}>{workspace.branch}</span>}
                            </span>
                            {workspace.dirty && <span className={DOT} title="Uncommitted changes" aria-label="Uncommitted changes">●</span>}
                            {nestHint(workspace.id)}
                            {/* Only what needs attention; "ready" is the norm. */}
                            {(workspace.pinned || workspace.state === "sleeping") && (
                              <span className="shrink-0 text-[0.58rem] text-subtext-0">
                                {[workspace.pinned && "pinned", workspace.state === "sleeping" && "sleeping"].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </button>
                          </div>
                          )}
                          {workspace.state === "sleeping" && (
                            <button
                              type="button"
                              className={RESTORE}
                              onClick={() => restoreWorkspace(workspace.id)}
                            >
                              Restore
                            </button>
                          )}
                          {workspaceSessions.length > 0 && workspaceSessionRows(workspace, tabOrderedSessions(workspace))}
                        </div>
                        {nested.length > 0 && depth < 8 && (
                          <div className={`${WORKSPACE_TREE} ml-[0.9rem]`} data-testid={`workspace-children-${workspace.id}`}>
                            {nested.map((child) => renderWorkspace(child, depth + 1))}
                          </div>
                        )}
                        </div>
                      );
                      };
                      if (single) {
                        return (
                          <>
                            {single.state === "sleeping" && (
                              <button
                                type="button"
                                className={RESTORE}
                                onClick={() => restoreWorkspace(single.id)}
                              >
                                Restore
                              </button>
                            )}
                            {!projectCollapsed && sessionsForWorkspace(sessions, single).length > 0 && workspaceSessionRows(single, tabOrderedSessions(single))}
                          </>
                        );
                      }
                      return (
                        <div className={WORKSPACE_TREE} data-testid="workspace-tree-root">
                          {(attentionSort
                            ? [...roots].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || urgency(sessionsForWorkspace(sessions, a)) - urgency(sessionsForWorkspace(sessions, b)))
                            : roots
                          ).filter(keep).map((workspace) => renderWorkspace(workspace, 0))}
                        </div>
                      );
                    })()}
                    <WorktreeJobRows jobs={projectJobs} />
                    {hiddenWorkspaces.length > 0 && (
                      <HiddenWorktrees workspaces={hiddenWorkspaces} projectId={project.id} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {chatsSection}
          </>}
      </div>
      {menu && <RowMenu {...menu} onClose={() => setMenu(null)} />}
      {tabMenu && <TabSplitMenu key={tabMenu.menu.id} {...tabMenu} onClose={() => setTabMenu(null)} />}
      {newSession && (
        <NewSessionPopover
          hostId={newSession.project.hostId}
          projectCwds={[newSession.project.path]}
          anchorRect={newSession.rect}
          onClose={() => setNewSession(null)}
          onSelect={(cwd, agent) => createSessionOnHost(newSession.project.hostId, cwd, agent)}
        />
      )}
      {removingProject && (
        <ConfirmDialog
          message={`Remove "${removingProject.name || basename(removingProject.path)}" from perch? Its sessions close (their agents and shells end); the folder and the agents' transcripts stay on disk.`}
          confirmLabel="Remove"
          onConfirm={() => {
            removeWorkspaceProject(removingProject.id);
            setRemovingProject(null);
          }}
          onCancel={() => setRemovingProject(null)}
        />
      )}
      {instructionsFor && (
        <InstructionsDialog {...instructionsFor} onClose={() => setInstructionsFor(null)} />
      )}
      {memoryFor && <MemoryDialog {...memoryFor} onClose={() => setMemoryFor(null)} />}
    </section>
  );
}
