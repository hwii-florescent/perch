//! The sidebar's project list (`WorkspaceOverview`), part of the stock screen `stock:sidebar`. Three ways to see
//! the active host's work, chosen in the organize menu and kept per device: the tree (Project, its workspaces,
//! their sessions; the default), By status (sections by what each chat asks of you, each split by project) and
//! In one list (every chat, newest first). Quickchat sits after the projects. Data and rules come from
//! `useNavigation` (which sessions are listed, order, attention, the chat held in Done while read); actions are
//! typed commands. Everything here is arrangement: folding, menus, drag and keys.
//!
//! Reorder: one operation, move X before/after Y within a group (a project's chats, the favourites). A pointer
//! drag with the mouse (`beginReorderDrag`: the row follows the pointer, the others slide aside); Move up/down in
//! the row menus serves the keyboard and the phone. The core keeps the order, so every screen shows it.
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import {
  beginReorderDrag, buttonClass, cn, ConfirmDialog, Dialog, FolderBrowser, ghostButton, InstructionsDialog, MemoryDialog, nestSessions, NewSessionMenu,
  pickFolder, rowActionClass, runCommand, segmentClass, Select, SessionDot, SessionMenu, startSession, useAddProject, useAddProjectRequest, useHosts, useNavigation,
  WorktreeMenu, type ProjectInfo, type SessionInfo, type StatusSection, type WorkspaceInfo,
} from "@perch/sdk";
import { Chevron, CheckoutIcon, EllipsisIcon, FolderMark, NewChatIcon, OrganizeIcon, PlusIcon, RowCloseIcon } from "./icons";
import {
  BODY, copyText, DOT, ENTRY_BTN, FOCUS, HiddenWorktrees, HOLDABLE, longPress, NESTED_ROW, readFlag, RENAME, RESTORE, Rollup, ROW_BTN, RowMenu, saveFlag,
  SectionHeading, SESSION, SESSION_TITLE, SPAN, StateBadge, STRONG, WORKSPACE_TITLE, WORKSPACE_TREE, WorktreeJobRows, type MenuItem, type OpenMenu,
} from "./parts";

// Glyph buttons at the end of a row.
const PROJECT_ICON = rowActionClass({ reveal: "project" });
const SESSION_CLOSE = rowActionClass({ reveal: "session" });

const COLLAPSED_KEY = "perch.sidebar.collapsedProjects";
function readCollapsed(): string[] {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]") as string[]; } catch { return []; }
}

/** How the sidebar lists work. "project" is the tree (Project → Workspace → Session), the default; the others are
 * flat views of the same chats. A saved "workspace" (the retired two-section layout) reads as the tree. */
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
const SHOW_TERMINALS_KEY = "perch.sidebar.showTerminals";

type Drag = { handle: { onPointerDown?: (event: ReactPointerEvent) => void }; zone: Record<string, string> };

export interface WorkspaceOverviewProps {
  /** Compact mode is used inside the phone's switcher, where the containing panel owns the title and close. */
  compact?: boolean;
  /** Called after a project/workspace/session is chosen, so a containing phone panel can close itself. */
  onNavigate?: () => void;
}

export function WorkspaceOverview({ compact = false, onNavigate }: WorkspaceOverviewProps) {
  const [showTerminals, setShowTerminals] = useState(() => readFlag(SHOW_TERMINALS_KEY, "1"));
  const [organize, setOrganize] = useState<Organize>(readOrganize);
  // Sorting by attention is a view of the core's order, not a new order: no drag or Move while it is on.
  const [attentionSort, setAttentionSort] = useState(() => readFlag(SORT_KEY, "attention"));
  const nav = useNavigation({ showTerminals, sortByAttention: attentionSort });
  const hosts = useHosts();
  const adding = useAddProject();
  const { hostId: activeHostId, reachable, reorderable, projects: shownProjects, quickchat, activeWorkspaceId, activeSessionId: sessionId } = nav;
  const showNestHints = nav.shortcuts;

  // Which host the Add project dialog registers on; starts as the active one.
  const [addHostId, setAddHostId] = useState(activeHostId);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [removingProject, setRemovingProject] = useState<ProjectInfo | null>(null);
  const [memoryFor, setMemoryFor] = useState<{ projectId: string; name: string } | null>(null);
  const [instructionsFor, setInstructionsFor] = useState<{ scope: "project" | "workspace"; id: string; name: string } | null>(null);
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [sessionMenu, setSessionMenu] = useState<{ id: string; x: number; y: number; extraItems: Exclude<MenuItem, "divider">[] } | null>(null);
  // A folder that isn't a git repo has no worktrees, so its "+" starts a session there.
  const [newSession, setNewSession] = useState<{ project: ProjectInfo; rect: DOMRect } | null>(null);
  // Folded projects hide their workspaces and sessions (per viewer).
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);
  function toggleCollapsed(projectId: string) {
    setCollapsed((current) => {
      const next = current.includes(projectId) ? current.filter((id) => id !== projectId) : [...current, projectId];
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch { /* per-viewer convenience */ }
      return next;
    });
  }

  function nestHint(workspace: WorkspaceInfo) {
    const label = workspace.shortcut;
    return label ? <kbd className="pointer-events-none absolute top-[7px] right-3 w-8 text-right text-[11px] leading-[18px] font-semibold text-accent tabular-nums [font-family:inherit]" data-testid={`workspace-shortcut-${workspace.id}`} aria-label={`Jump to workspace: ${label}`}>{label}</kbd> : null;
  }

  // A move writes only what it touches. `shown` is the row's siblings as listed; `flip`: the group shows its
  // strip order reversed (Quickchat and By status, newest first), so a move is mirrored back into strip order
  // before it is written and the first drag cannot flip the strips.
  function moveRow(kind: "project" | "session", id: string, target: string, after: boolean, shown: string[], flip = false) {
    if (kind === "project") runCommand("project.move", { id, target, after });
    else runCommand("session.move", { id, target, after: flip ? !after : after, siblings: flip ? [...shown].reverse() : shown });
  }
  const moveRowNow = useRef(moveRow);
  moveRowNow.current = moveRow;
  /** `zone` marks the item that moves (a chat row, a project's whole block) and its group; `handle.onPointerDown`
   * starts the drag from it (a project's header). On release the slot it landed in is written. */
  function dnd(kind: "project" | "session", id: string, group: string, shown: string[] = [], flip = false): Drag {
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
          beginReorderDrag(event, {
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
              const target = others[slide.to] ?? others[others.length - 1];
              if (target) moveRowNow.current(kind, id, target, slide.to >= others.length, shown, flip);
            },
          });
        },
      },
    };
  }
  /** The row's own press handlers plus its drag, which both need `onPointerDown`. */
  function withDrag<T extends { onPointerDown: (event: ReactPointerEvent) => void }>(press: T, handle: Drag["handle"]): T {
    return { ...press, onPointerDown: (event: ReactPointerEvent) => { press.onPointerDown(event); handle.onPointerDown?.(event); } };
  }
  function moveItems(kind: "project" | "session", id: string, siblings: string[], flip = false): Exclude<MenuItem, "divider">[] {
    if (!reorderable) return [];
    const at = siblings.indexOf(id);
    return ([["up", "Move up", -1], ["down", "Move down", 1]] as const).flatMap(([key, label, step]) => {
      const target = at < 0 ? undefined : siblings[at + step];
      return target ? [{ label, testId: `workspace-${kind}-move-${key}-${id}`, onSelect: () => moveRow(kind, id, target, step > 0, siblings, flip) }] : [];
    });
  }
  function openSessionMenu(session: SessionInfo, x: number, y: number, siblings: SessionInfo[], flip = false) {
    setSessionMenu({ id: session.id, x, y, extraItems: moveItems("session", session.id, siblings.map((other) => other.id), flip) });
  }
  /** A chat row's wrapper props: drag within `group`, and a menu (right-click or hold) with Move up/down. */
  function sessionRowProps(session: SessionInfo, siblings: SessionInfo[], group: string) {
    const flip = group === "chats" || group.startsWith("status:"); // groups shown newest first
    const { handle, zone } = group === "list" ? { handle: {}, zone: {} } : dnd("session", session.id, group, siblings.map((other) => other.id), flip);
    return {
      ...zone,
      ...withDrag(longPress((x, y) => openSessionMenu(session, x, y, siblings, flip)), handle),
      onContextMenu: (event: React.MouseEvent) => {
        event.preventDefault();
        openSessionMenu(session, event.clientX, event.clientY, siblings, flip);
      },
    };
  }
  function pickSession(id: string) {
    runCommand("session.open", { id });
    onNavigate?.();
  }
  function navigateToWorkspace(id: string) {
    runCommand("workspace.open", { id });
    onNavigate?.();
  }
  const closeSession = (id: string) => runCommand("session.request_close", { id });

  /** One chat row. `variant`: the tree's and Quickchat's (state badge), By status's (one line with `detail`), or
   * the flat list's (its project's name, then the badge). */
  function sessionRow(session: SessionInfo, siblings: SessionInfo[], group: string, nested: boolean, variant: "tree" | "status" | "list", detail = "") {
    const active = session.id === sessionId;
    const title = session.title || (variant === "tree" && group !== "chats" ? "New session" : "New chat");
    return (
      <div {...sessionRowProps(session, siblings, group)} className={cn("group/row flex min-w-0 items-stretch rounded-ui", nested && NESTED_ROW, active ? "bg-surface-1" : "hover:bg-surface-1 focus-within:bg-surface-1")} data-sub-session={nested || undefined} key={session.id}>
        <button
          type="button"
          className={cn(SESSION, variant === "status" && "min-h-9 py-0 pl-[1.875rem] min-[701px]:min-h-6", variant === "tree" && group !== "chats" && "pl-[1.9rem]", active ? "workspace-entry__session--active text-fg" : "text-subtext-0")}
          aria-current={active ? "page" : undefined}
          title={variant === "tree" ? title : session.cwd}
          data-testid={`workspace-session-${session.id}`}
          data-session={variant === "status" ? session.id : undefined}
          onClick={() => pickSession(session.id)}
        >
          {variant === "status" ? <>
            {/* The section says the state, so the row is just the harness and the name. */}
            <SessionDot plain id={session.id} className="h-4 w-4" />
            {/* One line: the name, then what it adds (the workspace, or why it needs you), muted. */}
            <span className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="min-w-0 shrink-[2] truncate">{title}</span>
              {detail && <span className="min-w-0 flex-1 truncate text-[0.62rem] text-subtext-0" data-testid="status-row-detail">{detail}</span>}
            </span>
          </> : <>
            <SessionDot plain id={session.id} className="h-[18px] w-[18px]" />
            <span className={SESSION_TITLE}>{title}</span>
            {variant === "list" && session.projectName && <span className="min-w-0 max-w-[35%] truncate text-[0.62rem] text-subtext-0" title={session.projectName}>{session.projectName}</span>}
            {reachable && <StateBadge section={session.section} testId={`session-state-${session.id}`} />}
          </>}
        </button>
        <button
          type="button"
          className={SESSION_CLOSE}
          data-testid={`workspace-session-close-${session.id}`}
          title={variant === "tree" && group !== "chats" ? "Close session" : "Close chat"}
          aria-label={`Close ${session.title || (variant === "tree" && group !== "chats" ? "session" : "chat")}`}
          onClick={() => closeSession(session.id)}
        >
          <RowCloseIcon />
        </button>
      </div>
    );
  }
  function sessionRows(list: SessionInfo[], group: string): ReactElement {
    return (
      <div className="workspace-entry__sessions flex flex-col gap-[2px] pt-[2px]">
        {nestSessions(list).map(({ session, nested }) => sessionRow(session, list, group, nested, "tree"))}
      </div>
    );
  }

  /** Instructions live on the core that owns the folder; a remote project keeps its own there. */
  function instructionsItem(project: ProjectInfo, scope: "project" | "workspace", id: string, name: string, testId: string): MenuItem[] {
    return project.instructions ? [{ label: "Instructions…", testId, onSelect: () => setInstructionsFor({ scope, id, name }) }] : [];
  }
  /** A project with one checkout has no row of its own for it (the project row stands in), so Files and Git for
   * that checkout live on the project menu. */
  function singleWorkspaceOf(project: ProjectInfo): WorkspaceInfo | undefined {
    if (compact) return undefined;
    const [only] = project.workspaces;
    return only && project.workspaces.length === 1 && !only.children.length && !only.linked ? only : undefined;
  }
  function openTool(workspace: WorkspaceInfo, tool: "files" | "git") {
    runCommand("workspace.focus", { id: workspace.id });
    runCommand(tool === "files" ? "workspace.files" : "workspace.git", { id: workspace.id });
  }
  function projectMenu(project: ProjectInfo): MenuItem[] {
    const single = singleWorkspaceOf(project);
    return [
      { label: "Rename", testId: `workspace-project-rename-${project.id}`, onSelect: () => setRenamingProjectId(project.id) },
      { label: "Copy path", testId: `workspace-project-copy-${project.id}`, onSelect: () => copyText(project.path) },
      ...instructionsItem(project, "project", project.id, project.name, `workspace-project-instructions-${project.id}`),
      ...(project.memory ? [{ label: "Memory…", testId: `workspace-project-memory-${project.id}`, onSelect: () => setMemoryFor({ projectId: project.id, name: project.name }) }] : []),
      ...moveItems("project", project.id, nav.projects.filter((other) => other.favorite === project.favorite).map((other) => other.id)),
      ...(project.sessions.length > 0
        ? [{ label: "Close all sessions", testId: `workspace-project-close-all-${project.id}`, onSelect: () => { for (const session of project.sessions) runCommand("session.close", { id: session.id }); } }]
        : []),
      ...(single ? [
        "divider" as const,
        { label: "Files", testId: `workspace-menu-files-${single.id}`, onSelect: () => openTool(single, "files") },
        ...(single.branch || project.repoPath ? [{ label: "Git", testId: `workspace-menu-git-${single.id}`, onSelect: () => openTool(single, "git") }] : []),
      ] : []),
      "divider",
      { label: "Remove project", testId: `workspace-project-remove-${project.id}`, danger: true, onSelect: () => setRemovingProject(project) },
    ];
  }
  function workspaceMenu(project: ProjectInfo, workspace: WorkspaceInfo): MenuItem[] {
    const open = (tool: "files" | "git") => {
      openTool(workspace, tool);
      onNavigate?.();
    };
    return [
      { label: "Rename", testId: `workspace-rename-item-${workspace.id}`, onSelect: () => setRenamingId(workspace.id) },
      { label: "Copy path", testId: `workspace-copy-${workspace.id}`, onSelect: () => copyText(workspace.path) },
      ...(workspace.branch ? [{ label: "Copy branch name", testId: `workspace-copy-branch-${workspace.id}`, onSelect: () => copyText(workspace.branch!) }] : []),
      { label: workspace.pinned ? "Unpin" : "Pin", testId: `workspace-pin-${workspace.id}`, onSelect: () => runCommand("workspace.pin", { id: workspace.id, pinned: !workspace.pinned }) },
      ...instructionsItem(project, "workspace", workspace.id, workspace.name, `workspace-instructions-${workspace.id}`),
      "divider",
      { label: "Files", testId: `workspace-menu-files-${workspace.id}`, onSelect: () => open("files") },
      ...(workspace.branch || project.repoPath ? [{ label: "Git", testId: `workspace-menu-git-${workspace.id}`, onSelect: () => open("git") }] : []),
      ...(workspace.linked ? ["divider" as const, { label: "Hide from sidebar", testId: `workspace-hide-${workspace.id}`, onSelect: () => runCommand("workspace.hide", { id: workspace.id, hidden: true }) }] : []),
      ...(workspace.linked && project.repoPath
        ? [{ label: "Delete worktree", testId: `workspace-delete-${workspace.id}`, danger: true, onSelect: () => runCommand("worktree.remove", { id: workspace.id }) }]
        : []),
    ];
  }
  function chooseOrganize(next: Organize) {
    setOrganize(next);
    saveFlag(ORGANIZE_KEY, next);
  }

  // The home screen's "Add project" and its key start the same flow.
  const activeHostIdRef = useRef(activeHostId);
  activeHostIdRef.current = activeHostId;
  useAddProjectRequest(useCallback(() => { setAddHostId(activeHostIdRef.current); setAddOpen(true); }, []));
  useEffect(() => {
    if (adding.status !== "success") return;
    // The sidebar lists one host at a time: follow the project to its host.
    if (adding.hostId && adding.hostId !== activeHostId) runCommand("host.select", { id: adding.hostId });
    setName("");
    setAddOpen(false);
    adding.clear();
  }, [adding.status]); // eslint-disable-line react-hooks/exhaustive-deps
  function submitProject(path: string) {
    adding.add(path, name, addHostId);
  }
  async function browseNative() {
    const picked = await pickFolder?.("Add project");
    if (picked) submitProject(picked);
  }

  /** The "+" at the end of a project line: a worktree menu for a git project, else a new session in its folder. */
  function projectPlus(project: ProjectInfo, className: string) {
    return project.repoPath ? <WorktreeMenu hostId={project.hostId} path={project.repoPath} className={className} /> : (
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
  function openProject(project: ProjectInfo) {
    const first = project.workspaces[0];
    if (first) navigateToWorkspace(first.id);
  }

  // "In one list": every session on this host, projects and Quickchat alike, newest first. Purely chronological:
  // the core's order does not apply, and there is no drag.
  const listView = (
    <div className="flex flex-col gap-[2px] py-[0.2rem]" data-testid="workspace-session-list">
      {nav.sessions.length === 0 && <div className="px-[0.3rem] py-2 text-[0.7rem] text-subtext-0">No sessions yet.</div>}
      {nav.sessions.map((session) => sessionRow(session, [], "list", false, "list"))}
    </div>
  );

  // Projects with no agent chat yet, listed last in By status so none goes missing.
  const emptyProjects = nav.projects.filter((project) => !project.hasChats);
  const statusView = (
    <div className="flex flex-col gap-[2px] py-[0.2rem]" data-testid="workspace-status-view">
      {nav.sessions.length === 0 && <div className="px-[0.3rem] py-2 text-[0.7rem] text-subtext-0">No chats yet.</div>}
      {nav.status.map((section) => (
        <div className="flex flex-col gap-[2px]" key={section.key} data-testid={`status-section-${section.key}`}>
          <SectionHeading section={section.key === "offline" ? undefined : (section.key as StatusSection)} title={section.title} count={section.sessions.length} note={section.note} countLabel={`${section.sessions.length} chats`} testId={`status-section-title-${section.key}`} />
          {/* Each section keeps its chats under their project, in the sidebar's project order. */}
          {section.projects.map((cluster) => (
            <div className="flex flex-col gap-[2px]" key={cluster.id} data-testid={`status-project-${section.key}-${cluster.id}`}>
              <div className="group/ph flex items-center pr-1 pl-3">
                {cluster.project && !cluster.project.quickchat ? <FolderMark /> : <span className="mr-1.5 w-3 shrink-0" aria-hidden="true" />}
                <span className="min-w-0 flex-1 truncate py-[3px] text-[12.5px] font-medium text-fg" data-testid="status-project-title">{cluster.name}</span>
                {cluster.project && !cluster.project.quickchat && projectPlus(cluster.project, cn(PROJECT_ICON, "size-5"))}
              </div>
              {nestSessions(cluster.sessions).map(({ session, nested }) => sessionRow(session, cluster.sessions, `status:${section.key}:${cluster.id}`, nested, "status",
                [session.workspaceLabel, section.key === "needs" ? session.needReason : null].filter(Boolean).join(" · ")))}
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
                <span className={cn(SESSION_TITLE, "text-[12.5px] font-medium")}>{project.name}</span>
              </button>
              {projectPlus(project, cn(PROJECT_ICON, "size-5"))}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // After the projects, inside their scrolling list.
  const chatsSection = quickchat && (() => {
    const chats = quickchat.sessions;
    // Newest first on screen; the strip (oldest first) stays the stored order.
    const shownChats = [...chats].reverse();
    const chatsCollapsed = collapsed.includes(quickchat.id);
    return (
      <div className="flex flex-col gap-[2px]" data-testid="workspace-chats">
        <div className="group/ph flex items-stretch rounded-ui hover:bg-surface-1">
          <button
            type="button"
            className="flex min-h-8 flex-1 cursor-pointer items-center gap-[0.35rem] rounded-ui py-1 pr-[0.55rem] pl-[0.75rem] text-left text-[14px] font-semibold text-subtext-0 [background:none] [border:0] [font-family:inherit] [line-height:inherit] hover:text-fg focus-visible:text-fg min-[701px]:pl-4 min-[701px]:text-[0.62rem] min-[701px]:tracking-[0.045em] min-[701px]:uppercase"
            data-testid="workspace-chats-collapse"
            aria-expanded={!chatsCollapsed}
            onClick={() => toggleCollapsed(quickchat.id)}
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
                  { label: "Close all chats", testId: "workspace-chats-close-all", danger: true, onSelect: () => { for (const chat of chats) runCommand("session.close", { id: chat.id }); } },
                ] });
              }}
            >
              <EllipsisIcon />
            </button>
          )}
          <button
            type="button"
            className={rowActionClass()}
            data-testid="workspace-chats-new"
            title="New chat"
            aria-label="New chat"
            onClick={() => {
              runCommand("quickchat.new");
              onNavigate?.();
            }}
          >
            <NewChatIcon />
          </button>
        </div>
        {!chatsCollapsed && chats.length > 0 && (
          <div className="flex flex-col gap-[2px] pt-[2px] pr-[0.3rem] pl-[0.4rem]">
            {nestSessions(shownChats).map(({ session, nested }) => sessionRow(session, shownChats, "chats", nested, "tree"))}
          </div>
        )}
      </div>
    );
  })();

  function renderWorkspace(project: ProjectInfo, workspace: WorkspaceInfo): ReactElement {
    const workspaceActive = workspace.id === activeWorkspaceId;
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
              defaultValue={workspace.name}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") {
                  runCommand("workspace.rename", { id: workspace.id, name: event.currentTarget.value });
                  setRenamingId(null);
                } else if (event.key === "Escape") {
                  setRenamingId(null);
                }
              }}
              onBlur={() => setRenamingId(null)}
            />
          ) : (
            <div className={cn("flex flex-wrap items-stretch rounded-ui hover:bg-surface-1", workspaceActive && workspace.sessions.length === 0 && "bg-surface-1")}>
              <button
                type="button"
                className={cn(ENTRY_BTN, "flex-1 bg-transparent pr-12", workspaceActive && "workspace-entry__button--active")}
                aria-pressed={workspaceActive}
                onClick={() => navigateToWorkspace(workspace.id)}
                title={workspace.path}
              >
                <CheckoutIcon linked={workspace.linked} />
                <span className={cn(BODY, "flex items-baseline gap-[0.35rem]")}>
                  <strong
                    className={cn(WORKSPACE_TITLE, workspaceActive ? "text-fg" : "text-subtext-0")}
                    title="Double-click to rename"
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      setRenamingId(workspace.id);
                    }}
                  >
                    {workspace.name}
                  </strong>
                  {/* A branch only when it tells checkouts apart; the path is in the tooltip. */}
                  {workspace.branch && workspace.branch !== workspace.name && <span className={cn(SPAN, "min-w-0 shrink-[3]")}>{workspace.branch}</span>}
                </span>
                {workspace.dirty && <span className={DOT} title="Uncommitted changes" aria-label="Uncommitted changes">●</span>}
                {nestHint(workspace)}
                {/* Only what needs attention; "ready" is the norm. */}
                {(workspace.pinned || workspace.sleeping) && (
                  <span className="shrink-0 text-[0.58rem] text-subtext-0">
                    {[workspace.pinned && "pinned", workspace.sleeping && "sleeping"].filter(Boolean).join(" · ")}
                  </span>
                )}
              </button>
            </div>
          )}
          {workspace.sleeping && (
            <button type="button" className={RESTORE} onClick={() => runCommand("workspace.restore", { id: workspace.id })}>
              Restore
            </button>
          )}
          {workspace.sessions.length > 0 && sessionRows(workspace.sessions, workspace.id)}
        </div>
        {workspace.children.length > 0 && (
          <div className={`${WORKSPACE_TREE} ml-[0.9rem]`} data-testid={`workspace-children-${workspace.id}`}>
            {workspace.children.map((child) => renderWorkspace(project, child))}
          </div>
        )}
      </div>
    );
  }

  function renderProject(project: ProjectInfo): ReactElement {
    const projectCollapsed = collapsed.includes(project.id) && !showNestHints;
    const single = singleWorkspaceOf(project);
    const shortcutHint = single ? nestHint(single) : null;
    // With nothing to fold away, the header opens the checkout instead.
    const collapsible = !single;
    // Folded, a project still says what needs you.
    const foldedTop = projectCollapsed ? project.top : null;
    const foldedCount = foldedTop && foldedTop !== "idle" ? project.sessions.filter((s) => s.section === foldedTop).length : 0;
    const onHeaderClick = () => (single ? navigateToWorkspace(single.id) : toggleCollapsed(project.id));
    // Reorder inside the favourites or the rest; the whole project is the drop target.
    const projectDnd = dnd("project", project.id, project.favorite ? "favorites" : "projects");
    return (
      <div {...projectDnd.zone} className="workspace-project flex flex-col gap-[2px]" key={project.id} data-testid={`workspace-project-${project.id}`}>
        <div
          {...withDrag(longPress((x, y) => setMenu({ x, y, label: "Project actions", items: projectMenu(project) })), renamingProjectId === project.id ? {} : projectDnd.handle)}
          className={cn("group/ph relative flex cursor-pointer flex-wrap items-stretch rounded-ui hover:bg-surface-1", HOLDABLE, single && "workspace-entry", single && single.id === activeWorkspaceId && (projectCollapsed || project.sessions.length === 0) && "bg-surface-1")}
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
              defaultValue={project.name}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") {
                  runCommand("project.rename", { id: project.id, name: event.currentTarget.value });
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
              <FolderMark className="h-3 w-3 shrink-0 text-subtext-0" filled={project.favorite} testId="project-folder-icon" />
              <span className="grid min-w-0 gap-[0.1rem]">
                <strong className={STRONG}>{project.name}</strong>
              </span>
              {single?.branch && single.branch !== project.name && <span className={cn(SPAN, "min-w-0 shrink-[3]")}>{single.branch}</span>}
              {single?.dirty && <span className={DOT} title="Uncommitted changes" aria-label="Uncommitted changes">●</span>}
              {collapsible && <Chevron open={!projectCollapsed} className="shrink-0 text-subtext-0 min-[701px]:hidden" />}
              {shortcutHint}
            </button>
          )}
          {foldedTop && foldedCount > 0 && (
            <span className="flex items-center self-center pr-1"><Rollup count={foldedCount} section={foldedTop} testId={`project-rollup-${project.id}`} /></span>
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
          {projectPlus(project, cn(PROJECT_ICON, shortcutHint && "invisible"))}
        </div>
        {(!projectCollapsed || single) && (project.workspaces.length + project.hidden.length > 0 || project.jobs.length > 0) && (
          <div className="workspace-project__workspaces flex flex-col gap-[2px]">
            {single ? (
              <>
                {single.sleeping && (
                  <button type="button" className={RESTORE} onClick={() => runCommand("workspace.restore", { id: single.id })}>
                    Restore
                  </button>
                )}
                {!projectCollapsed && single.sessions.length > 0 && sessionRows(single.sessions, single.id)}
              </>
            ) : (
              <div className={WORKSPACE_TREE} data-testid="workspace-tree-root">
                {project.workspaces.map((workspace) => renderWorkspace(project, workspace))}
              </div>
            )}
            <WorktreeJobRows jobs={project.jobs} />
            {project.hidden.length > 0 && <HiddenWorktrees workspaces={project.hidden} projectId={project.id} />}
          </div>
        )}
      </div>
    );
  }

  const organizeButton = (
    <button
      type="button"
      className={cn(segmentClass(), "grid w-9 place-items-center p-0 min-[701px]:my-[3px] min-[701px]:rounded-ui [@media(max-width:700px)]:h-[2.75rem] [@media(max-width:700px)]:w-[2.75rem] [@media(max-width:700px)]:min-w-[2.75rem]")}
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
          ] : []),
        ] });
      }}
    >
      <OrganizeIcon />
    </button>
  );

  const projectCount = nav.projects.length;
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
              ? `${nav.sessions.length} session${nav.sessions.length === 1 ? "" : "s"}`
              : projectCount ? `${projectCount} project${projectCount === 1 ? "" : "s"}` : "No projects"}
          </span>
        </div>
        <div className="flex shrink-0 items-stretch">
          {/* Across every project: how many chats need you, and one click to the next. */}
          {nav.needsYou > 0 && (
            <button
              type="button"
              className={cn("my-[3px] cursor-pointer self-center rounded-ui bg-transparent px-2 py-[0.15rem] text-[0.68rem] font-medium text-accent [border:0] [font-family:inherit] hover:bg-surface-1 [@media(max-width:700px)]:min-h-[2.75rem]", FOCUS)}
              data-testid="workspace-needs-you"
              title="Open the next chat that needs you"
              onClick={() => { runCommand("global.needsYou"); onNavigate?.(); }}
            >
              {nav.needsYou} need{nav.needsYou === 1 ? "s" : ""} you
            </button>
          )}
          {organizeButton}
          <button
            type="button"
            className={cn(segmentClass(), "gap-1 px-[0.6rem] text-[0.72rem] font-medium min-[701px]:my-[3px] min-[701px]:rounded-ui [@media(max-width:700px)]:min-h-[2.75rem] [@media(max-width:700px)]:px-[0.65rem]")}
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
          {hosts.list.length > 1 && (
            <label className="grid gap-[0.16rem] text-[0.7rem] text-subtext-0">
              <span>Host</span>
              <Select testId="workspace-add-host" ariaLabel="Host" value={addHostId} onChange={setAddHostId}
                options={[{ value: "local", label: "This machine" }, ...hosts.list.filter((host) => host.id !== "local" && host.enabled).map((host) => {
                  // A host the core has not reported on yet is still connecting.
                  const state = host.state === "disabled" ? "connecting" : host.state;
                  return { value: host.id, label: `${host.name}${state === "connected" ? "" : ` (${state})`}`, disabled: state !== "connected" };
                })]} />
            </label>
          )}
          {pickFolder && addHostId === "local" && (
            <button type="button" className={cn(ghostButton, "px-[0.6rem] py-[0.4rem] text-left text-[0.8rem] text-fg")} data-testid="workspace-add-browse-native" onClick={() => void browseNative()}>
              Browse folder…
            </button>
          )}
          {/* Same folder picker as "+ New session"; its "Use this folder" registers. */}
          <FolderBrowser key={addHostId} hostId={addHostId} onUseFolder={submitProject} />
          {adding.status === "pending" && <span className="text-[0.7rem] text-subtext-0" role="status">Registering folder…</span>}
          {adding.status === "error" && <span className="text-[0.7rem] text-red" role="alert">{adding.error}</span>}
          <div className="flex justify-end">
            <button type="button" className={cn(ghostButton, "px-[0.6rem] py-[0.3rem] text-[0.75rem]", FOCUS)} disabled={adding.status === "pending"} onClick={() => setAddOpen(false)}>
              Cancel
            </button>
          </div>
        </Dialog>
      )}

      {nav.loading && (
        <div className="shrink-0 px-[0.65rem] py-[0.55rem] text-[0.7rem] text-subtext-0" role="status">Loading workspace…</div>
      )}
      {nav.error && (
        <div className="flex shrink-0 items-center gap-[0.45rem] px-[0.65rem] py-[0.55rem] text-[0.7rem] text-red" role="alert">
          {nav.error}
          <button type="button" className={buttonClass({ size: "sm", className: "ml-auto text-inherit hover:text-inherit" })} onClick={() => runCommand("host.refresh", { id: activeHostId })}>Retry</button>
        </div>
      )}

      {organize === "project" && projectCount === 0 && !nav.loading && (
        <div className="grid justify-items-start gap-[0.32rem] px-3 py-[1.1rem] text-[0.68rem] text-subtext-0">
          <span className="text-[1.3rem] leading-none text-accent" aria-hidden="true">＋</span>
          <strong className="text-[0.77rem] text-fg">Add a project</strong>
          <span>A project keeps its workspaces, sessions and files together.</span>
          {!addOpen && (
            <button type="button" className={buttonClass({ variant: "soft", size: "sm", className: "mt-[0.18rem] text-fg" })} onClick={() => setAddOpen(true)} data-testid="workspace-empty-add">
              Register folder
            </button>
          )}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto px-[3px] py-[3px] [&>*]:shrink-0" data-testid="project-list">
        {organize !== "project" && !showNestHints ? (organize === "list" ? listView : statusView) : <>
          {shownProjects.map(renderProject)}
          {chatsSection}
        </>}
      </div>
      {menu && <RowMenu {...menu} onClose={() => setMenu(null)} />}
      {sessionMenu && <SessionMenu key={sessionMenu.id} {...sessionMenu} onClose={() => setSessionMenu(null)} />}
      {newSession && (
        <NewSessionMenu
          hostId={newSession.project.hostId}
          cwd={null}
          projects={[newSession.project.path]}
          anchorRect={newSession.rect}
          onClose={() => setNewSession(null)}
          onSelect={(cwd, agent) => startSession(newSession.project.hostId, cwd, agent)}
        />
      )}
      {removingProject && (
        <ConfirmDialog
          message={`Remove "${removingProject.name}" from perch? Its sessions close (their agents and shells end); the folder and the agents' transcripts stay on disk.`}
          confirmLabel="Remove"
          onConfirm={() => {
            runCommand("project.close", { id: removingProject.id, confirmed: true });
            setRemovingProject(null);
          }}
          onCancel={() => setRemovingProject(null)}
        />
      )}
      {instructionsFor && <InstructionsDialog {...instructionsFor} onClose={() => setInstructionsFor(null)} />}
      {memoryFor && <MemoryDialog {...memoryFor} onClose={() => setMemoryFor(null)} />}
    </section>
  );
}
