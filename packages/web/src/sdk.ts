//! `@perch/sdk`, as this page runs it: the public package API whose contract is `perch-sdk.d.ts`
//! (guide: docs/MOD-SDK.md). Each export wraps an existing host service or `components/ui`
//! primitive and owns no state of its own (a copy's state lives in its instance, `mod-runtime.ts`).
//! `tsc` checks the object below against the contract, and `sdk.test.ts` pins its export names to
//! the version, so changing the surface means changing `SDK_VERSION` (`mod-runtime.ts`, which also
//! reads a package's range). `main.tsx` imports this module once, which registers it with the
//! package loader; each package revision's own `@perch/sdk` adds `assetUrl` bound to it.
import type * as Sdk from "@perch/sdk";
import { createElement, lazy, Suspense, useCallback, useContext, useEffect, useId, useMemo, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import { NEW_TAB_EVENT } from "./appEvents";
import { useBrowserPages as useBrowserPageMeta } from "./browserPages";
import { AgentIcon } from "./components/AgentIcon";
import { FileEntryMenu as HostFileEntryMenu } from "./components/FileEntryMenu";
import { PageIcon } from "./components/PageIcon";
import { TabDragLayer } from "./components/TabDragLayer";
import { TabSplitMenu } from "./components/TabSplitMenu";
import { segment } from "./components/ui/segment";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { DirectoryBrowser } from "./components/DirectoryBrowser";
import { HostStateDot } from "./components/HostStateDot";
import { InstructionsDialog } from "./components/InstructionsDialog";
import { MemoryDialog } from "./components/MemoryDialog";
import { SlashPopover } from "./components/SlashPopover";
import { StatusDot } from "./components/StatusDot";
import { WorktreeMenu as HostWorktreeMenu } from "./components/WorktreeMenu";
import { button } from "./components/ui/button";
import { Dialog } from "./components/ui/dialog";
import { Select as HostSelect } from "./components/ui/select";
import { SELECT } from "./components/ui/settings";
import { rowAction } from "./components/ui/row-action";
import { nestSessions, pickFolder, useAddProject, useAddProjectRequest, useHosts, useNavigation, useSessionFolders } from "./navigation";
import { fileTabKey, isBlankBrowser, openBlankBrowser, tabDirectory, useFileTabs } from "./fileTabs";
import { useWorkspaceFilesStore } from "./filesystemStore";
import { fetchTerminalAt, focusInfo, layoutTree, readTerminalAt, runCommand as runAppCommand, sendTerminalAt, terminalRecords } from "./modApp";
import { surfaceLayout } from "./modUi";
import { pinsVersion, subscribePins } from "./pinnedTerminals";
import { drawerPageKey, useDrawerBrowsers } from "./drawerBrowsers";
import { WorkspaceBrowser } from "./components/WorkspaceBrowser";
import { TYPED_COMMANDS } from "./modCommands";
import { usePaneLook as useHostPaneLook } from "./paneLook";
import { NewSessionPopover } from "./components/NewSessionPopover";
import { beginSlideDrag } from "./slideDrag";
import { useSplitSets } from "./splitSets";
import { DOT_GLYPH, sessionDotState } from "./statusDot";
import { beginTabDrag as beginHostTabDrag, useTabDrag } from "./tabDrag";
import { useTabOrderVersion } from "./tabOrder";
import { TAB_PANE_CLASS, tabPaneStates, type TabPaneState } from "./tabPaneState";
import { currentTabs, sessionLabel, tabName, workspaceTabs, type TabEntry } from "./workspaceTabs";
import { computeAnchoredPopoverStyle, useDismissOnOutsideClick } from "./components/popoverPosition";
import { Slot as HostSlot } from "./components/Slot";
import { GHOST_BUTTON, ICON_BUTTON } from "./components/ui/icon-button";
import { currentPrograms, programFor } from "./programs";
import { CloseIcon, EllipsisIcon, GearIcon, PlusIcon } from "./components/ui/icons";
import { glass, TAP_BUTTON } from "./components/ui/glass";
import { menuDivider, menuItem, menuPanel } from "./components/ui/menu";
import { inboundMenuItems } from "./inbound";
import { IS_MAC, formatCombo } from "./keyCombo";
import { keybindEntries, shortcutFor as hostShortcutFor, shortcutLabel as hostShortcutLabel, type ShortcutContext } from "./keybinds";
import { useAgentChoices as useHostAgentChoices } from "./components/AgentPicker";
import { cn } from "./lib/cn";
import { InstanceContext, notifyInstance, registerHostModule, SDK_VERSION, trackOperation } from "./mod-runtime";
import type { SlotName, SlotProps } from "./slots";
import { effectiveActiveProject, effectiveWorkspace, usePerchStore } from "./store";
import { askAgent, contextBridgeAvailable } from "./contextBridge";
import { FileIcon, GitMarker, indexGitDecorations } from "./components/fileDecorations";
import { WorkspaceFileAsset } from "./components/WorkspaceFileAsset";
import { WorkspaceMarkdownPreview } from "./components/WorkspaceMarkdownPreview";
import { assetKind } from "./components/workspaceFileKind";
import { Chevron } from "./components/ui/chevron";
import { EMPTY_GIT_REVIEW_STATE, gitCapabilityForWorkspace, useWorkspaceGitReviewStore } from "./gitReviewStore";
import { newId } from "./ids";
import { modData } from "./modData";
import { useResourceState } from "./resourceState";
import { useNativeChat } from "./chatSession";
import { ChatMarkdown } from "./views/nativeChat/ChatMarkdown";
import { CopyButton } from "./views/nativeChat/CopyButton";
import { scopeSessionId, workspaceRecord } from "./terminalScope";
import { socket } from "./ws";
import { useZoom, zoomReset } from "./zoom";

export function useKeybindings() {
  const overrides = usePerchStore((s) => s.settings?.keybindings);
  // `keybindEntries` reads the overrides from the store itself; they are the dependency.
  return useMemo(() => keybindEntries(), [overrides]);
}

/** The copy the calling component runs in; outside a package there is none. */
function useCopy() {
  const context = useContext(InstanceContext);
  if (!context) throw new Error("useInstance, useInstanceState and useModData work only inside a package's components.");
  return context;
}

export function useInstance(): Sdk.PackageInstance {
  const { instance, revision } = useCopy();
  return useMemo(() => ({
    key: instance.key,
    revision,
    trackOperation: <T,>(work: Promise<T> | (() => Promise<T>)) => trackOperation(instance, work),
  }), [instance, revision]);
}

export function useInstanceState<T>(name: string, initial: T): [T, (next: T | ((previous: T) => T)) => void] {
  const { instance } = useCopy();
  // `initial` counts only while the copy has no value under `name` (as useState's does on first render).
  if (!instance.state.has(name) && !instance.released) instance.state.set(name, initial);
  const subscribe = useCallback((changed: () => void) => {
    instance.listeners.add(changed);
    return () => void instance.listeners.delete(changed);
  }, [instance]);
  const value = useSyncExternalStore(subscribe, () => instance.state.get(name) as T);
  const set = useCallback((next: T | ((previous: T) => T)) => {
    if (instance.released) return;
    const previous = instance.state.get(name) as T;
    const value = typeof next === "function" ? (next as (previous: T) => T)(previous) : next;
    if (Object.is(value, previous)) return;
    instance.state.set(name, value);
    notifyInstance(instance);
  }, [instance, name]);
  return [value, set];
}

/** The durable data of the package the calling component runs in (`modData.ts`), one object per package id. */
export function useModData(): Sdk.ModData {
  const { instance } = useCopy();
  return useMemo(() => modData(instance.modId), [instance.modId]);
}

/** Outside a package's own modules there is no package to name a file of. */
export const assetUrl = (path: string): string => {
  throw new Error(`assetUrl("${path}") works only in a package's own modules (import it from "@perch/sdk" there).`);
};

// ---------------------------------------------------------------------------------------------------------------
// 1.2: the status bar (`stock:status`).

/** What the status bar says about the focused session: its host (else the active one), folder, branch and the
 * agent's context and cost; the workspace's when no session is focused. While a file or review tab is on
 * screen, the folder and branch are that tab's (a file opened from Downloads says Downloads). */
export function useStatusLine(): Sdk.StatusLine {
  const connected = usePerchStore((s) => s.connected);
  const status = usePerchStore((s) => s.status);
  const sessionId = usePerchStore((s) => s.sessionId);
  const knownSession = usePerchStore((s) => s.sessions.find((sess) => sess.id === sessionId));
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const hostId = knownSession?.hostId ?? activeHostId;
  const hostName = usePerchStore((s) => s.hosts.find((h) => h.id === hostId)?.name);
  const hostState = usePerchStore((s) => s.hostStates[hostId]?.state);
  const workspace = usePerchStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId));
  const tab = useFileTabs((s) => s.tabs.find((candidate) => fileTabKey(candidate) === s.active));
  const shown = usePerchStore((s) => tabDirectory(s, tab)?.path);
  const shownBranch = usePerchStore((s) => tabDirectory(s, tab)?.branch);
  return {
    connected, hostId, hostName, hostState, sessionId,
    cwd: shown ?? (status?.cwd || knownSession?.cwd || workspace?.path || ""),
    branch: shown !== undefined ? shownBranch : status?.branch ?? workspace?.branch,
    contextTokens: status?.contextTokens,
    costUsd: status?.costUsd,
  };
}

export const refreshUsage = () => socket.send({ type: "usage.get", force: true });

/** Plan usage as the core last reported it. With `keepFresh`, asks on connect and then every 3 min (the core's
 * cache) while the caller is mounted. */
export function usePlanUsage(options?: { keepFresh?: boolean }): Sdk.PlanUsage {
  const keepFresh = !!options?.keepFresh;
  const connected = usePerchStore((s) => s.connected);
  const usage = usePerchStore((s) => s.usage);
  const updatedAt = usePerchStore((s) => s.usageUpdatedAt);
  const spend = usePerchStore((s) => s.spend);
  const redeemResult = usePerchStore((s) => s.usageRedeemResult);
  useEffect(() => {
    if (!keepFresh || !connected) return;
    const ask = () => socket.send({ type: "usage.get" });
    ask();
    const id = setInterval(ask, 180_000);
    return () => clearInterval(id);
  }, [keepFresh, connected]);
  return { usage, updatedAt, spend, redeemResult };
}

/** Spends one banked reset of `accountId`, once; the answer arrives as `redeemResult` with that account id. */
export const redeemUsageReset = (accountId: string) => {
  usePerchStore.setState({ usageRedeemResult: null });
  socket.send({ type: "usage.redeemReset", accountId });
};

/** A legacy mod's slot (`api.slot`) over `children`; see `slots.ts` for the names and their data. */
export function Slot(props: Parameters<typeof Sdk.Slot>[0]) {
  return createElement(HostSlot, { ...props, name: props.name as SlotName, actions: props.actions as SlotProps["actions"] });
}

// ---------------------------------------------------------------------------------------------------------------
// 1.2: tabs and pane chrome (`stock:tabs`, `stock:pane-header`).

/** One tab of the shown workspace's strip, as `workspaceTabs` orders it (sessions and open resources alike). */
function tabInfo(entry: TabEntry, state: TabPaneState, dirtyKeys: ReadonlySet<string>, pages: Record<string, { url?: string; icon?: string } | undefined>, providers: Record<string, string | undefined>): Sdk.TabInfo {
  if (entry.kind === "session") {
    const s = entry.session;
    return {
      id: s.id, kind: "session", label: sessionLabel(s), title: s.title, state, provider: s.currentProviderId ?? providers[s.id] ?? s.cliProviderId,
      activity: sessionDotState(s), blocked: s.blocked, unseen: s.unseen, dirty: false, preview: false, path: s.cwd,
    };
  }
  const tab = entry.tab;
  const page = tab.kind === "browser" ? pages[entry.id] : undefined;
  return {
    id: entry.id, kind: tab.kind === "review" ? "review" : tab.kind === "browser" ? "browser" : tab.kind === "mod" ? "mod" : "file",
    label: tabName(tab), title: tab.path, state, dirty: dirtyKeys.has(entry.id), preview: !!tab.preview, path: tab.path, workspaceId: tab.workspaceId,
    url: page?.url, icon: page?.icon, blank: isBlankBrowser(tab), mod: tab.mod,
  };
}

/** The shown workspace's strip: its tabs in order with their pane state, and where a new tab opens. */
export function useWorkspaceTabs(): Sdk.WorkspaceTabs {
  const sessionId = usePerchStore((s) => s.sessionId);
  const sessions = usePerchStore((s) => s.sessions);
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const activeProject = usePerchStore((s) => s.activeProject);
  const activeWorkspaceId = usePerchStore((s) => s.activeWorkspaceId);
  const workspaces = usePerchStore((s) => s.workspaces);
  const workspaceOrderByHost = usePerchStore((s) => s.workspaceOrderByHost);
  const tabShape = usePerchStore((s) => (s.settings?.tabShape === "round" ? "round" : "square"));
  const providers = usePerchStore((s) => s.cliAgentBySession);
  const fileTabs = useFileTabs((s) => s.tabs);
  const activeFile = useFileTabs((s) => s.active);
  const sets = useSplitSets((s) => s.sets);
  const zoomedId = useSplitSets((s) => s.zoomedId);
  const draggingId = useTabDrag((s) => (s.drag && !s.drag.overStrip ? s.drag.id : null));
  const pages = useBrowserPageMeta((s) => s.pages);
  // The keys of open files with unsaved changes, as one string so an unrelated keystroke does not re-render.
  const dirty = useWorkspaceFilesStore((s) => fileTabs.filter((tab) => {
    if (tab.kind) return false;
    const document = s.documents[tab.scope ?? tab.workspaceId]?.[tab.path];
    return document != null && document.content !== document.savedContent;
  }).map(fileTabKey).join("\n"));
  // A saved drag order changes the order.
  useTabOrderVersion();
  const nav = { sessions, sessionId, activeHostId, activeProject, activeWorkspaceId, workspaces, workspaceOrderByHost };
  const ws = effectiveWorkspace(nav);
  const project = effectiveActiveProject(nav);
  const entries = workspaceTabs(nav, fileTabs);
  const fileShown = activeFile !== null && entries.some((entry) => entry.id === activeFile);
  const states = tabPaneStates(sets, entries.map((entry) => entry.id), fileShown ? activeFile : sessionId, zoomedId);
  const dirtyKeys = new Set(dirty ? dirty.split("\n") : []);
  return {
    hostId: ws?.hostId ?? project?.hostId ?? activeHostId,
    cwd: ws?.path ?? project?.cwd ?? null,
    workspace: ws ? { id: ws.id, path: ws.path } : null,
    activeId: fileShown ? activeFile : sessionId,
    tabs: entries.map((entry) => tabInfo(entry, states.get(entry.id) ?? "hidden", dirtyKeys, pages, providers)),
    tabShape,
    draggingId,
  };
}

/** Runs an app command, as a key or `perch mod do` would: the typed commands (`perch mod commands`) with their
 * arguments. Throws what the command throws (a missing tab, a bad argument); returns whether one ran. */
export const runCommand = (command: string, args?: Record<string, unknown>): boolean => {
  // The typed commands run here directly, so a package acts the same before the app has wired its keys; the rest
  // (the key table's own commands) go through the app's command bridge.
  const typed = TYPED_COMMANDS[command];
  if (typed) return typed.run(args), true;
  return runAppCommand(command, args);
};

/** Starts dragging tab `id` from a pointer-down: dropped on the strip it moves, on a pane's side it splits. */
export const beginTabDrag = (event: ReactPointerEvent, id: string, label: string) => beginHostTabDrag(event, id, label);

/** Calls `listener` when Perch asks for a new tab (Cmd+T): the strip opens its launcher. */
export function useNewTabRequest(listener: () => void): void {
  useEffect(() => {
    window.addEventListener(NEW_TAB_EVENT, listener);
    return () => window.removeEventListener(NEW_TAB_EVENT, listener);
  }, [listener]);
}

/** A new session on `hostId` in `cwd`, running `agent` (an id from the launcher). */
export const startSession = (hostId: string, cwd: string | undefined, agent: string) => usePerchStore.getState().createSessionOnHost(hostId, cwd, agent);
/** A blank browser tab in the workspace. */
export const openBrowserTab = (workspaceId: string) => void openBlankBrowser(workspaceId);
/** Opens a file of the workspace as a kept tab. */
export const openFileTab = (workspaceId: string, path: string) => useFileTabs.getState().open(workspaceId, path);

/** The open tab menu (`tab.menu`), drawn by Perch for the shown strip; nothing while none is open. It
 * has the sidebar row menu's actions (a session's message choices too), less the sidebar's ordering. */
export function TabMenu(): ReactElement | null {
  const menu = useSplitSets((s) => s.menu);
  const tabs = useWorkspaceTabs().tabs;
  if (!menu) return null;
  const entries = currentTabs().tabs.filter((entry) => tabs.some((tab) => tab.id === entry.id));
  const self = entries.find((entry) => entry.id === menu.id);
  return createElement(TabSplitMenu, { entries, menu, extraItems: self?.kind === "session" ? inboundMenuItems(self.session) : [] });
}

/** The agent launcher for a new tab: `hostId`'s agents, then `extras`, at `anchorRect`. */
export function NewSessionMenu({ projects, cwd, ...props }: Sdk.NewSessionMenuProps): ReactElement {
  // With `projects`, the unscoped picker: the agent, then one of those folders or Quickchat.
  return createElement(NewSessionPopover, { ...props, projectCwds: projects ?? [], fixedCwd: projects ? undefined : cwd ?? "~" });
}

/** The name prompt for a new file in a workspace's root. */
export function NewFilePrompt({ workspaceId, workspacePath, onClose, onOpenFile }: Sdk.NewFilePromptProps): ReactElement {
  return createElement(HostFileEntryMenu, { workspaceId, workspacePath, target: null, x: 0, y: 0, initialStage: "newFile", onClose, onOpenFile, onExpand: () => {}, onRefresh: () => {} });
}

/** How the shown layout draws pane headers (`paneHeaderAt`, `paneHeaderReveal`, `paneHeaderHeight`). */
export function usePaneLook(): Sdk.PaneLook {
  const look = useHostPaneLook();
  return { headerAt: look.headerAt, headerReveal: look.headerReveal, headerHeight: look.headerHeight };
}

/** The color Perch draws an agent's state in (a CSS color). */
export const agentStateColor = (state: Sdk.AgentState) => DOT_GLYPH[state].color;
export { TAB_PANE_CLASS as tabStateClass } from "./tabPaneState";
export const segmentClass = (options?: { active?: boolean }) => segment(options);

// ---------------------------------------------------------------------------------------------------------------
// 1.3: navigation (`stock:sidebar`). The data hooks are `navigation.ts`; actions are typed commands (`runCommand`).

/** A session's mark by id: the host's status dot (its agent and state ring), nothing for an unknown id. */
export function SessionDot({ id, plain, className }: { id: string; plain?: boolean; className?: string }): ReactElement | null {
  const session = usePerchStore((s) => s.sessions.find((candidate) => candidate.id === id));
  return session ? createElement(StatusDot, { session, plain, className }) : null;
}

/** A session's tab menu wherever the session is: its own workspace's strip, as that strip would show it, without
 * selecting it; the caller's rows, then the session's message choices. */
export function SessionMenu({ id, x, y, extraItems = [], onClose }: Sdk.SessionMenuProps): ReactElement | null {
  const [entries] = useState(() => {
    const state = usePerchStore.getState();
    const session = state.sessions.find((candidate) => candidate.id === id);
    if (!session) return null;
    const hostId = session.hostId ?? "local";
    return { session, list: workspaceTabs({ ...state, sessionId: id, activeHostId: hostId, activeWorkspaceId: session.workspaceId ?? null, activeProject: { hostId, cwd: session.cwd } }, useFileTabs.getState().tabs) };
  });
  if (!entries) return null;
  return createElement(TabSplitMenu, { key: id, entries: entries.list, menu: { id, x, y }, onClose, extraItems: [...extraItems, ...inboundMenuItems(entries.session)] });
}

/** A git project's worktree menu and its + button. */
export const WorktreeMenu = ({ hostId, path, className }: { hostId: string; path: string; className?: string }) =>
  createElement(HostWorktreeMenu, { hostId, cwd: path, projectKey: `${hostId}:${path}`, className });
export { DirectoryBrowser as FolderBrowser } from "./components/DirectoryBrowser";
export function Select({ className = SELECT, ...props }: Parameters<typeof Sdk.Select>[0]): ReactElement {
  return createElement(HostSelect, { ...props, className });
}
export const menuItemClass = (options?: { danger?: boolean }) => menuItem(options);
export const rowActionClass = ({ className, ...variants }: { reveal?: "always" | "project" | "session"; tone?: "default" | "danger"; className?: string } = {}) => cn(rowAction(variants), className);
export { button as buttonClass } from "./components/ui/button";
export const beginReorderDrag = (event: ReactPointerEvent, options: Sdk.ReorderDragOptions) => beginSlideDrag(event, options);

// ---------------------------------------------------------------------------------------------------------------
// 1.4: resources (`stock:review`). Draft and pending state a screen must not lose lives in `useResourceState`.

/** Workspace `workspaceId`'s review: `gitReviewStore`'s one state and action set for it, its sessions as packet
 * targets, and Context Bridge's Ask agent where the host offers it. */
export function useGitReview(workspaceId: string): Sdk.GitReview {
  const state = useWorkspaceGitReviewStore((current) => current.workspaces[workspaceId] ?? EMPTY_GIT_REVIEW_STATE);
  const getWorkspaceActions = useWorkspaceGitReviewStore((current) => current.getWorkspaceActions);
  const actions = useMemo(() => getWorkspaceActions(workspaceId), [getWorkspaceActions, workspaceId]);
  const workspace = usePerchStore((current) => workspaceRecord(current, workspaceId));
  const sessions = usePerchStore((current) => current.sessions);
  const ready = usePerchStore((current) => gitCapabilityForWorkspace(workspaceId, current));
  const canAsk = usePerchStore(() => contextBridgeAvailable(workspaceId));
  const targets = useMemo(() => sessions
    .filter((session) => session.workspaceId === workspaceId || scopeSessionId(workspaceId) === session.id || (workspace != null && (session.hostId ?? "local") === workspace.hostId && session.cwd === workspace.path))
    .map((session) => ({ id: session.id, title: session.title || "New session", agent: session.cliProviderId })), [sessions, workspace, workspaceId]);
  // A remote host's workspace has no local row; name it after its sessions' folder.
  const remoteName = useMemo(() => sessions.find((session) => session.workspaceId === workspaceId)?.cwd.replace(/\/+$/, "").split("/").pop(), [sessions, workspaceId]);
  const ask = useMemo(() => (canAsk ? (source: Sdk.ContextSource) => askAgent(workspaceId, source) : undefined), [canAsk, workspaceId]);
  return {
    ready, workspaceName: workspace?.name ?? remoteName, startSnapshot: workspace?.startSnapshot,
    lastAgentTurn: state.lastAgentTurn ?? undefined, agentSessionId: state.agentSessionId,
    status: state.status, statusState: state.statusState, statusError: state.statusError, actionError: state.actionError,
    diff: state.diff, diffState: state.diffState, diffError: state.diffError,
    comments: state.comments, refs: state.refs, batchDelivery: state.batchDelivery,
    sessions: targets, currentRevision: state.diff?.sourceRevision, actions, askAgent: ask,
  };
}

export { FileIcon, GitMarker, newId, useResourceState };

// ---------------------------------------------------------------------------------------------------------------
// 1.5: files (`stock:files`). Listings, drafts, versions, saves and conflicts are `filesystemStore`'s; CodeMirror,
// the media/PDF viewer and the Markdown renderer (its sanitizer fixed) are Perch's engines a screen places.

const EMPTY_TREES: Record<string, Sdk.WorkspaceTreeState> = {};
const EMPTY_DOCUMENTS: Record<string, Sdk.WorkspaceDocumentState> = {};
const EMPTY_PREVIEWS: Record<string, Sdk.WorkspacePreviewState> = {};

/** Workspace `workspaceId`'s files as `filesystemStore` keeps them, its actions bound to it, and (with `git`) the
 * Git marks of its snapshot, refreshed when the root listing arrives. */
export function useWorkspaceFiles(workspaceId: string, options?: { git?: boolean }): Sdk.WorkspaceFiles {
  const withGit = !!options?.git;
  // Shortcut labels follow the person's key settings.
  usePerchStore((state) => state.settings?.keybindings);
  const workspace = usePerchStore((state) => workspaceRecord(state, workspaceId));
  const connected = usePerchStore((state) => state.connected);
  const trees = useWorkspaceFilesStore((state) => state.trees[workspaceId] ?? EMPTY_TREES);
  const documents = useWorkspaceFilesStore((state) => state.documents[workspaceId] ?? EMPTY_DOCUMENTS);
  const previews = useWorkspaceFilesStore((state) => state.previews[workspaceId] ?? EMPTY_PREVIEWS);
  const search = useWorkspaceFilesStore((state) => state.searches[workspaceId]);
  const wrap = useWorkspaceFilesStore((state) => state.wrap);
  const project = usePerchStore((state) => state.workspaceProjects.find((candidate) => candidate.id === workspace?.projectId));
  const isGit = Boolean(workspace?.branch || project?.repoPath);
  const gitReady = usePerchStore((state) => gitCapabilityForWorkspace(workspaceId, state));
  const git = useWorkspaceGitReviewStore((state) => (withGit ? state.workspaces[workspaceId] ?? EMPTY_GIT_REVIEW_STATE : EMPTY_GIT_REVIEW_STATE));
  const decorations = useMemo(() => indexGitDecorations(withGit && gitReady && isGit && git.statusState !== "error" ? git.status?.entries ?? [] : []), [git, gitReady, isGit, withGit]);
  const rootTree = trees[""];
  useEffect(() => {
    if (!withGit || !isGit || !gitReady || rootTree?.state !== "ready") return;
    // ponytail: snapshots refresh on mount/reconnect/tree refresh and Git actions, not a new polling service.
    // If live badges are needed, invalidate the shared store from a core-owned Git watcher.
    const store = useWorkspaceGitReviewStore.getState();
    if (store.workspaces[workspaceId]?.statusState !== "loading") store.refreshStatus(workspaceId);
  }, [gitReady, isGit, rootTree, withGit, workspaceId]);
  const canAsk = usePerchStore(() => contextBridgeAvailable(workspaceId));
  const actions = useMemo<Sdk.WorkspaceFileActions>(() => {
    const store = () => useWorkspaceFilesStore.getState();
    return {
      requestTree: (path = "") => store().requestTree(workspaceId, path),
      searchFiles: (query) => store().searchFiles(workspaceId, query),
      openFile: (path, force) => store().openFile(workspaceId, path, force),
      reloadFile: (path) => store().reloadFile(workspaceId, path),
      requestPreview: (path) => store().requestPreview(workspaceId, path),
      updateDraft: (path, content) => store().updateDraft(workspaceId, path, content),
      saveFile: (path) => store().saveFile(workspaceId, path),
      overwriteFile: (path) => store().overwriteFile(workspaceId, path),
      setWrap: (next) => store().setWrap(next),
    };
  }, [workspaceId]);
  // An editor selection says whether its file has unsaved changes as the store has it when asked.
  const ask = useMemo(() => (canAsk ? (source: Sdk.FilesContextSource) => {
    if (source.kind !== "editor") return askAgent(workspaceId, source);
    const document = useWorkspaceFilesStore.getState().documents[workspaceId]?.[source.path];
    askAgent(workspaceId, { ...source, dirty: document?.content !== document?.savedContent });
  } : undefined), [canAsk, workspaceId]);
  return {
    workspace: workspace ? { id: workspace.id, name: workspace.name, path: workspace.path, hostId: workspace.hostId } : null,
    connected, trees, documents, previews, search, wrap,
    git: { isGit, ready: gitReady, statusState: git.statusState, statusError: git.statusError, decorations },
    actions, askAgent: ask,
  };
}

/** Perch's code editor (CodeMirror), loaded with the first file opened; suspends until then. */
export const CodeEditor = lazy(() => import("./components/CodeEditor").then((module) => ({ default: module.CodeEditor }))) as unknown as typeof Sdk.CodeEditor;
export { WorkspaceFileAsset as FileAsset } from "./components/WorkspaceFileAsset";
export { WorkspaceMarkdownPreview as MarkdownPreview } from "./components/WorkspaceMarkdownPreview";
/** The explorer's entry menu (and the name/delete prompts its actions need) for `target`, or the root for null. */
export function FileEntryMenu(props: Sdk.FileEntryMenuProps): ReactElement {
  return createElement(HostFileEntryMenu, props);
}
export const shortcutLabel = (command: string) => hostShortcutLabel(command);
export { assetKind, Chevron };

// 1.5: the native chat (`stock:chat`). Its state and actions are `chatSession.ts`'s; agent text goes only through
// the fixed `Markdown` (DOMPurify, `perch-ui` as data, links that never navigate Perch).
export { ChatMarkdown as Markdown } from "./views/nativeChat/ChatMarkdown";
export { CopyButton, useNativeChat };

export { terminalRecords as terminals } from "./modApp";
/** `terminals()`, again whenever sessions, terminals, hosts, focus, a pin or this device's order change. */
export function useTerminals(): Sdk.TerminalRecord[] {
  const sessions = usePerchStore((s) => s.sessions);
  const ids = usePerchStore((s) => s.cliTerminalIds);
  const running = usePerchStore((s) => s.terminals);
  const hosts = usePerchStore((s) => s.hostStates);
  const focused = usePerchStore((s) => s.sessionId);
  const connected = usePerchStore((s) => s.connected);
  const pins = useSyncExternalStore(subscribePins, pinsVersion);
  return useMemo(() => terminalRecords(), [sessions, ids, running, hosts, focused, connected, pins]);
}
export const readTerminal = (target: string, lines?: number) => readTerminalAt(target, lines);
export const fetchTerminal = (target: string, lines?: number) => fetchTerminalAt(target, lines);
export const sendToTerminal = (target: string, text: string) => sendTerminalAt(target, text);
export { focusInfo as focus } from "./modApp";
export { layoutTree };

// 1.5: the drawer's browser pages (`drawerBrowsers.ts`, kept across reloads) and the page itself, a native webview in
// the desktop app (`WorkspaceBrowser`): a screen lists, opens and closes pages; the engine is Perch's.
export function useBrowserPages(workspaceId: string): Sdk.BrowserPages {
  const all = useDrawerBrowsers((s) => s.pages);
  const meta = useBrowserPageMeta((s) => s.pages);
  const activeId = useDrawerBrowsers((s) => s.active[workspaceId]);
  const tabCount = useFileTabs((s) => s.tabs.filter((tab) => tab.workspaceId === workspaceId && tab.kind === "browser").length);
  return useMemo(() => {
    const pages = all.filter((page) => page.workspaceId === workspaceId).map((page) => ({
      id: page.id, url: page.url, title: meta[drawerPageKey(page.id)]?.title ?? "", icon: meta[drawerPageKey(page.id)]?.icon,
    }));
    const store = useDrawerBrowsers.getState();
    return {
      pages,
      shownId: (pages.find((page) => page.id === activeId) ?? pages.at(-1))?.id ?? null,
      tabCount,
      open: () => { store.open(workspaceId); return useDrawerBrowsers.getState().active[workspaceId] ?? null; },
      select: (id: string) => store.select(workspaceId, id),
      close: (id: string) => store.close(id),
      closeAll: () => store.closeAll(workspaceId),
      setUrl: (id: string, url: string) => store.setUrl(id, url),
    };
  }, [all, meta, activeId, tabCount, workspaceId]);
}
export function BrowserPage({ pageId, initialUrl, active, onUrl }: { pageId: string; initialUrl: string; active?: boolean; onUrl?: (url: string) => void }): ReactElement {
  return createElement(WorkspaceBrowser, { tabId: drawerPageKey(pageId), initialUrl, active, onUrl });
}

// 1.6: notifications (`stock:toast`). The list, what each says and what opening one does are Perch's; how long one
// stays (paused on hover or focus), how many show and how they look are the screen's.
const NOTIFY_LABEL = { done: "Session finished", blocked: "Needs your attention" } as const;
const dismissNotification = (id: string) => usePerchStore.getState().dismissToast(id);
function openNotification(id: string) {
  const store = usePerchStore.getState();
  const toast = store.toasts.find((candidate) => candidate.id === id);
  if (!toast) return;
  if (toast.action) runAppCommand(toast.action.command, toast.action.args);
  else if (toast.kind !== "usage") store.switchSession(toast.sessionId);
  dismissNotification(id);
}
export function useNotifications(): Sdk.Notifications {
  const toasts = usePerchStore((s) => s.toasts);
  const sessions = usePerchStore((s) => s.sessions);
  // Worded at each render: the program table (programs.json) can rename an agent at any time.
  const items = toasts.map((toast): Sdk.NotificationItem => {
    const session = sessions.find((candidate) => candidate.id === toast.sessionId);
    const kind = toast.kind === "usage" ? "usage" : toast.kind === "blocked" ? "blocked" : "done";
    // "Kiro finished": an agent's program name; a plain terminal or an unknown program stays "Session finished".
    const provider = session?.currentProviderId ?? session?.cliProviderId;
    const program = provider && provider !== "terminal" ? programFor(provider, currentPrograms()) : null;
    const finished = program && program.id !== "program" && program.id !== "shell" ? `${program.name} finished` : NOTIFY_LABEL.done;
    return {
      id: toast.id, kind, level: toast.level, title: toast.title, body: toast.body, icon: toast.icon,
      heading: kind === "usage" ? toast.title : kind === "blocked" ? NOTIFY_LABEL.blocked : finished,
      detail: kind === "usage" ? toast.body ?? "" : toast.title || "(new session)",
      sessionId: toast.sessionId, sessionTitle: session?.title, hasSession: !!session && kind !== "usage",
      timeout: toast.timeout ?? (kind === "blocked" ? 10_000 : 6000),
    };
  });
  return { items, open: openNotification, dismiss: dismissNotification };
}
export { ICON_BUTTON as iconButton } from "./components/ui/icon-button";

// 1.7: the app's dialogs and menus (`stock:dialog`, `stock:select`, `stock:tab-menu`, `stock:launcher`, ...). Each is
// given its data and Perch's actions as props by the host route that opens it (`components/*.tsx`); these are the few
// pieces they share.

/** The agents `hostId` can start (its enabled, installed manifests; a host without discovery offers Claude and
 * Codex), the person's last pick, and Manage agents. Fetched when first asked for while connected. */
export function useAgentChoices(hostId: string): Sdk.AgentChoices {
  const { connected, discovery, catalog, choices } = useHostAgentChoices(hostId);
  const lastChoice = usePerchStore((s) => s.lastAgentChoice);
  return useMemo(() => ({
    connected, discovery, choices, lastChoice,
    state: discovery ? catalog?.state ?? "loading" : "ready",
    error: catalog?.state === "error" ? catalog.error : undefined,
    // Only the two built-in agents are remembered as the default pick (the store's `lastAgentChoice`).
    rememberChoice: (id: string) => { if (id === "claude" || id === "codex") usePerchStore.getState().setLastAgentChoice(id); },
    manage: () => usePerchStore.getState().openAgentCatalog(),
  }), [connected, discovery, catalog, choices, lastChoice]);
}
/** The key binding `event` triggers where `scope` has focus (the person's bindings), or null. */
export function shortcutFor(event: KeyboardEvent, scope?: Sdk.ShortcutScope): Sdk.ShortcutMatch | null {
  const found = hostShortcutFor(event, scope as ShortcutContext | undefined);
  return found ? { id: found.id, scope: found.scope ?? "global" } : null;
}
export { menuDivider as menuDividerClass } from "./components/ui/menu";

// 1.5: layout content inside a package's own view, with the window layout's nodes. Its terminals are Perch's engines
// (`PersistentTerminal`, `PersistentAgentTerminal`), borrowed: one already on screen moves in and back, so a package
// places a live terminal but never owns its input, size or process. LayoutRoot imports back into this file's graph;
// a static import is safe because neither side uses the other before render.
import { LayoutContent } from "./components/LayoutRoot";
export function Layout({ node }: { node: Sdk.LayoutNode }): ReactElement {
  const scope = `package:${useId()}`;
  const key = JSON.stringify(node);
  const checked = useMemo(() => {
    try { return { node: surfaceLayout(JSON.parse(key)) }; } catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
  }, [key]);
  if ("error" in checked) return createElement("div", { role: "alert", className: "p-2 text-[0.8rem] text-red" }, `This layout is not valid: ${checked.error}`);
  return createElement(Suspense, { fallback: null }, createElement(LayoutContent, { node: checked.node, scope }));
}
export { AgentIcon, CloseIcon, cn, ConfirmDialog, Dialog, HostStateDot, InstructionsDialog, MemoryDialog, menuPanel, PageIcon, TabDragLayer, useDismissOnOutsideClick, useZoom };
// 1.9: the composer's autocomplete list (`stock:slash-popover`), as the chat draws it.
export { SlashPopover };
export { nestSessions, pickFolder, useAddProject, useAddProjectRequest, useHosts, useNavigation, useSessionFolders };
export { SDK_VERSION as version } from "./mod-runtime";
// 1.8 settings: BEGIN (the Settings pages' shared parts, `sdkSettings.ts`)
import { settingsSurface } from "./sdkSettings";
export { ModeSwitch, QrCode, SettingRow, SettingsGroup, settingsClass, Switch, useSettingsQuery } from "./sdkSettings";

// ---------------------------------------------------------------------------------------------------------------
// 1.10: the phone's screens (`stock:mobile-*`) and the terminal, dock and browser chrome. Only the look they share is
// new; their data and Perch's actions are props (`perch-sdk.d.ts`).
export { glass as glassClass, TAP_BUTTON as tapButtonClass } from "./components/ui/glass";
export { EllipsisIcon, GearIcon, PlusIcon };
// 1.8 settings: END
export { zoomReset as resetZoom } from "./zoom";
export const keyLabel = (combo: string) => formatCombo(combo);
export { IS_MAC as isMac } from "./keyCombo";
export { GHOST_BUTTON as ghostButton } from "./components/ui/icon-button";
export { computeAnchoredPopoverStyle as anchoredPopoverStyle } from "./components/popoverPosition";

/** The whole surface, as packages import it (`registerHostModule`). Each name is also exported above, so Perch's own
 * code can render a stock screen's source directly (`@perch/sdk` resolves to this file in Vite and Vitest). */
export function sdkSurface(): typeof Sdk {
  return {
  version: SDK_VERSION, useKeybindings, CloseIcon, assetUrl, useInstance, useInstanceState,
  useStatusLine, usePlanUsage, refreshUsage, redeemUsageReset, useZoom, resetZoom: zoomReset, keyLabel,
  isMac: IS_MAC, cn, ghostButton: GHOST_BUTTON, menuPanel, anchoredPopoverStyle: computeAnchoredPopoverStyle, useDismissOnOutsideClick, Slot,
  useWorkspaceTabs, runCommand, beginTabDrag, useNewTabRequest, startSession, openBrowserTab, openFileTab, TabMenu, NewSessionMenu, NewFilePrompt,
  usePaneLook, agentStateColor, tabStateClass: TAB_PANE_CLASS, segmentClass, AgentIcon, PageIcon, TabDragLayer,
  useHosts, useNavigation, nestSessions, useSessionFolders, useAddProject, useAddProjectRequest, pickFolder,
  SessionDot, HostStateDot, SessionMenu, WorktreeMenu, InstructionsDialog, MemoryDialog, FolderBrowser: DirectoryBrowser, Dialog, ConfirmDialog, Select,
  menuItemClass, rowActionClass, buttonClass: button, beginReorderDrag,
  useResourceState, newId, FileIcon, GitMarker, useGitReview,
  terminals: terminalRecords, useTerminals, readTerminal, fetchTerminal, sendToTerminal, layoutTree, focus: focusInfo, useModData,
  useNotifications, iconButton: ICON_BUTTON, useAgentChoices, shortcutFor, menuDividerClass: menuDivider,
  useWorkspaceFiles, CodeEditor, FileAsset: WorkspaceFileAsset, MarkdownPreview: WorkspaceMarkdownPreview, FileEntryMenu, Chevron, assetKind, shortcutLabel,
  useNativeChat, Markdown: ChatMarkdown, CopyButton, Layout, useBrowserPages, BrowserPage, SlashPopover,
  glassClass: glass, tapButtonClass: TAP_BUTTON, GearIcon, PlusIcon, EllipsisIcon,
  // 1.8 settings: BEGIN
  ...settingsSurface,
  // 1.8 settings: END
  };
}
// After the module graph that is evaluating now: this file runs inside an import cycle (stock sources compiled into the
// page import `@perch/sdk`), where `mod-runtime.ts` may not have run yet. No package loads before then.
queueMicrotask(() => registerHostModule("@perch/sdk", sdkSurface));
