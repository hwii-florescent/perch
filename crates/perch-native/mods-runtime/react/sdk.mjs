//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
import { createElement, Fragment, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "../../../../packages/web/src/lib/cn.ts";
import { beginSlideDrag } from "../../../../packages/web/src/slideDrag.ts";
import { formatCombo } from "../../../../packages/web/src/keyCombo.ts";
import { segment } from "../../../../packages/web/src/components/ui/segment.ts";
import { rowAction } from "../../../../packages/web/src/components/ui/row-action.ts";
import { button } from "../../../../packages/web/src/components/ui/button.ts";
import { menuDivider, menuItem, menuPanel } from "../../../../packages/web/src/components/ui/menu.ts";
import { GHOST_BUTTON, ICON_BUTTON } from "../../../../packages/web/src/components/ui/icon-button.ts";
import { CloseIcon, EllipsisIcon, GearIcon, PlusIcon } from "../../../../packages/web/src/components/ui/icons.tsx";
import { HostStateDot } from "../../../../packages/web/src/components/HostStateDot.tsx";
import StockDialog from "../../../../packages/web/src/stock-ui/dialog/main.tsx";
import { FILE_PREVIEW_MAX_CHARS, previewSource } from "./markdown.mjs";
import StockSelect from "../../../../packages/web/src/stock-ui/select/main.tsx";
import StockEditorMenu from "../../../../packages/web/src/stock-ui/editor-menu/main.tsx";
import { SELECT } from "../../../../packages/web/src/components/ui/settings.ts";
import { Chevron } from "../../../../packages/web/src/components/ui/chevron.tsx";
import { Submenu } from "../../../../packages/web/src/components/ui/submenu.tsx";
import { DOT_GLYPH, sessionDotState } from "../../../../packages/web/src/statusDot.ts";
import { isNestedIn, nestUnderLeads } from "../../../../packages/web/src/sidebarOrder.ts";
import { computeAnchoredPopoverStyle, useDismissOnOutsideClick } from "../../../../packages/web/src/components/popoverPosition.ts";
import { PageIcon } from "../../../../packages/web/src/components/PageIcon.tsx";
import { FileAsset as NativeFileAsset } from "./fileAsset.mjs";
import { FileIcon, GitMarker } from "../../../../packages/web/src/components/fileDecorations.tsx";
import { assetKind } from "../../../../packages/web/src/components/workspaceFileKind.ts";

/** The SDK version this surface implements (`perch-sdk.d.ts`'s navigation part). */
export const version = "1.3.0";

// The host this copy of the runtime serves (`bindHost`, from the screen's `screen.js`). Each screen's folder has its own
// runtime, and each copy of the screen (each pane's header, each time a floating screen opens) its own host, but the
// mods share one script context: `globalThis.perch` is not this folder's.
let bound = null;
/** Binds this runtime's `@perch/sdk` to `perch`, its screen's own host, or a function that returns the host of the
 * copy of the screen running now. */
export const bindHost = (perch) => { bound = perch; };

/** The host object; a clear error when a screen runs without one. */
function host() {
  const perch = (typeof bound === "function" ? bound() : bound) ?? globalThis.perch;
  if (!perch) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return perch;
}
const subscribe = (listener) => host().subscribe?.(listener) ?? (() => {});

export { Chevron, cn, menuPanel, Submenu, CloseIcon, EllipsisIcon, GearIcon, PlusIcon, HostStateDot, PageIcon, useDismissOnOutsideClick };
export const anchoredPopoverStyle = computeAnchoredPopoverStyle;
// Settings' pages (1.8): the host's own parts and class strings, so the pages draw as the web's (`sdkSettings.ts`), and
// `SettingsQuery`, the search text the Settings shell provides. The QR is the web's own component.
export { ModeSwitch, QrCode, SettingRow, SettingsGroup, Switch, settingsClass, useSettingsQuery } from "../../../../packages/web/src/sdkSettings.ts";
export { SettingsQuery } from "../../../../packages/web/src/components/ui/setting-row.tsx";
// State the host keeps for a resource (the pages' unsent text), as the web's `useResourceState`.
export { useResourceState } from "../../../../packages/web/src/resourceState.ts";
/** A new random id, as the web's `newId`: a v4 UUID where the engine has one, else a random one of that shape. */
export function newId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}
/** Read once: the host (`globalThis.perch`) is set before the runtime is evaluated. */
export const isMac = globalThis.perch?.isMac !== false;
export const keyLabel = (combo) => formatCombo(combo, host().isMac !== false);
export const segmentClass = (options) => segment(options);
export const rowActionClass = ({ className, ...variants } = {}) => cn(rowAction(variants), className);
export const buttonClass = button;
// Floating chrome over a terminal (the agent's chip, notices), as the web's.
export { glass as glassClass, TAP_BUTTON as tapButtonClass } from "../../../../packages/web/src/components/ui/glass.ts";
export const menuItemClass = (options) => menuItem(options);
export const menuDividerClass = menuDivider;
export const ghostButton = GHOST_BUTTON;
export const iconButton = ICON_BUTTON;
export const agentStateColor = (state) => DOT_GLYPH[state].color;

/** The key binding `event` triggers in `scope` (1.7), from the host (`perch.shortcutFor`); null where the host has
 * no bindings for that scope (the native keymap has no `navigator.*` keys yet, so the Navigator moves with the arrows
 * only). */
export const shortcutFor = (event, scope) => host().shortcutFor?.(event, scope) ?? null;
/** The key that runs command `id` as the person has it (`"⌘↵"`), or null. */
export const shortcutLabel = (id) => host().shortcutLabel?.(id) ?? null;

/** A typed command (`session.open`, `project.move`, ...) for the host to run; false when it refused it. */
export const runCommand = (command, args) => host().command(command, args ?? {}) !== false;
export const startSession = (hostId, cwd, agent) => host().startSession?.(hostId, cwd, agent);
/** The desktop's folder dialog, or null where the host has none (as in a browser, where a screen hides its button). */
export const pickFolder = globalThis.perch?.pickFolder ? (title) => host().pickFolder(title) : null;

// ---- data -----------------------------------------------------------------------------------------------------

/** The host's data, read as `read(perch)` and read again whenever it changes. */
export function useHostSnapshot(read) {
  const readRef = useRef(read);
  readRef.current = read;
  return useSyncExternalStore(subscribe, () => readRef.current(host()));
}
export const useNavigation = (options = {}) => useHostSnapshot((perch) => perch.navigation({ showTerminals: !!options.showTerminals, sortByAttention: !!options.sortByAttention }));
export const useHosts = () => useHostSnapshot((perch) => perch.hosts());
export const useSessionFolders = () => useHostSnapshot((perch) => perch.sessionFolders());
export function useAddProject() {
  const state = useHostSnapshot((perch) => perch.addProject?.() ?? IDLE);
  return {
    status: state.status ?? "idle",
    error: state.error,
    hostId: state.hostId,
    add: (path, name, hostId) => { if (path.trim() && state.status !== "pending") host().addProjectFolder?.(path, name, hostId); },
    clear: () => host().clearAddProject?.(),
  };
}
const IDLE = Object.freeze({ status: "idle" });
/** The web's own key for the last agent picked (`store/persistence.ts`); only the two built-in agents are kept. */
const LAST_CHOICE = "perch.lastAgentChoice";
const NO_CHOICES = Object.freeze({ connected: false, discovery: false, state: "ready", choices: [] });
const lastChoiceStored = () => {
  const raw = host().storage?.getItem(LAST_CHOICE);
  return raw === "claude" || raw === "codex" ? raw : "claude";
};
const NO_NOTIFICATIONS = Object.freeze({ items: [] });
/** The notifications, oldest first, worded as the web words them (`perch.notifications()`); opening one goes to what
 * it is about and puts it away, dismissing only puts it away (`notification.open` / `notification.dismiss`). */
export function useNotifications() {
  const data = useHostSnapshot((perch) => perch.notifications?.() ?? NO_NOTIFICATIONS);
  return useMemo(() => ({
    items: data.items ?? [],
    open: (id) => host().command("notification.open", { id }),
    dismiss: (id) => host().command("notification.dismiss", { id }),
  }), [data]);
}
/** What `hostId` can start (`perch.agentChoices(hostId)`), the last agent picked, and remembering a pick. Manage
 * agents runs `agents.manage`, which a host without an agents page refuses. */
export function useAgentChoices(hostId) {
  const data = useHostSnapshot((perch) => perch.agentChoices?.(hostId) ?? NO_CHOICES);
  const [lastChoice, setLastChoice] = useState(lastChoiceStored);
  return useMemo(() => ({
    connected: !!data.connected, discovery: !!data.discovery, choices: data.choices ?? [], lastChoice,
    state: data.state ?? "ready",
    error: data.state === "error" ? data.error : undefined,
    rememberChoice: (id) => {
      if (id !== "claude" && id !== "codex") return;
      host().storage?.setItem(LAST_CHOICE, id);
      setLastChoice(id);
    },
    manage: () => host().command("agents.manage", {}),
  }), [data, lastChoice]);
}
/** The home screen's "Add project" asks the sidebar to open its form. */
export function useAddProjectRequest(listener) {
  useEffect(() => host().onRequest?.("add-project", listener) ?? undefined, [listener]);
}
export function nestSessions(list) {
  const items = list.map((session) => ({ id: session.id, parentSessionId: session.parentId, session }));
  return nestUnderLeads(items).map((item) => ({ session: item.session, nested: isNestedIn(item, items) }));
}

// ---- components ---------------------------------------------------------------------------------------------------

/** A session's harness mark, as the app's `StatusDot` draws it (plain: no state ring). The icon is the host's
 * (`perch.agentIcon(provider, size)`: `{ markup, tint }`; a tinted icon takes the text colour). */
export function SessionDot({ id, plain, className }) {
  const session = useHostSnapshot((perch) => perch.session(id));
  if (!session) return null;
  const state = session.state ?? sessionDotState(session);
  const color = DOT_GLYPH[state]?.color ?? DOT_GLYPH.unknown.color;
  const provider = session.provider;
  const branded = provider === "claude" || provider === "claude-agent-teams" || provider === "omp";
  const classes = plain
    ? cn("agent-mark", "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full leading-none", className)
    : cn("agent-status-dot", `agent-status-dot--${state}`, "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-panel-bg leading-none", className);
  return createElement(
    "span",
    { className: classes, style: plain ? undefined : { borderColor: color }, "data-provider": provider ?? "unknown", title: plain ? (provider ?? "Agent") : `${provider ?? "Agent"} · ${state}`, "aria-hidden": "true" },
    createElement("span", { className: cn("inline-flex text-fg", branded && "rounded-full bg-[#161616]") }, createElement(AgentIcon, { provider, size: 14 })),
  );
}

/** A harness's icon from the host. */
export function AgentIcon({ provider, size = 14 }) {
  const icon = host().agentIcon?.(provider, size) ?? null;
  const markup = icon?.markup ?? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>`;
  return createElement("svg", { width: size, height: size, "aria-hidden": "true", "data-agent-icon": provider ?? "unknown", "data-perch-markup": markup, ...(icon && icon.tint === false ? { "data-perch-image": "true" } : {}) });
}

/** A legacy mod's slot: the native client runs no legacy mods, so the slot is its children. */
export const Slot = ({ children }) => createElement(Fragment, null, children);

/** An overlay Perch draws, open while the component is mounted; `props` keep their callbacks current. */
function useOverlay(kind, props) {
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const perch = host();
    if (!perch.openOverlay) throw new Error(`@perch/sdk: the host draws no overlays (perch.openOverlay), so ${kind} cannot open`);
    const live = {};
    for (const [key, value] of Object.entries(latest.current)) {
      live[key] = typeof value === "function" ? (...args) => latest.current[key]?.(...args) : value;
    }
    const id = perch.openOverlay(kind, live);
    return () => perch.closeOverlay?.(id);
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
const overlay = (kind) => function Overlay(props) { return useOverlay(kind, props); };
export const SessionMenu = overlay("session-menu");
export const NewSessionMenu = overlay("new-session-menu");
const ConfirmOverlay = overlay("confirm");
/** The confirmation drawn in place in the screen that draws confirmations, where a caller asks with rows of its own
 * as children (the close guard); elsewhere a confirmation opens the window's `confirm` screen. Native only: the
 * confirm screen's `main.js` sets it. */
let confirmInPlace = null;
export const drawConfirmationsInPlace = (Component) => { confirmInPlace = Component; };
export function ConfirmDialog(props) { return createElement(confirmInPlace ?? ConfirmOverlay, props); }
/** A dropdown: the web's stock select, its list drawn in place over the screen (a portal), with the app's field
 * look unless the caller gives its own. */
export function Select({ className = SELECT, ...props }) { return createElement(StockSelect, { ...props, className }); }
/** The folder browser drawn in place, from the copy the screen drawing it carries (the sidebar's `main.js` sets it),
 * listing folders through the host; a screen that carries none opens the window's `folder-browser` overlay. */
let folderBrowserInPlace = null;
export const drawFolderBrowserInPlace = (Component) => { folderBrowserInPlace = Component; };
const FolderBrowserOverlay = overlay("folder-browser");
export function FolderBrowser(props) {
  if (!folderBrowserInPlace) return createElement(FolderBrowserOverlay, props);
  return createElement(folderBrowserInPlace, { ...props, browse: (path) => host().browse(props.hostId, path) });
}
export const InstructionsDialog = overlay("instructions");
export const MemoryDialog = overlay("memory");
/** The app's own stock dialog: drawn from the screen's children in the overlay layer (`document.body`). */
export const Dialog = StockDialog;

/** A git folder's worktree menu: the stock `worktree` screen drawn in place, from the copy the screen drawing it
 * carries (the sidebar's `main.js` sets it), with the folder's worktrees and every operation the core's `worktree.*`
 * questions; a screen that carries none opens the window's `worktree` overlay, anchored on its button. */
let worktreeInPlace = null;
export const drawWorktreeInPlace = (Component) => { worktreeInPlace = Component; };
export function WorktreeMenu(props) {
  if (worktreeInPlace) return createElement(WorktreeInPlace, props);
  const { hostId, path, className } = props;
  const ref = useRef(null);
  return createElement(
    "button",
    {
      type: "button",
      ref,
      className: cn("worktree-menu__btn", ICON_BUTTON, className),
      "data-testid": `worktree-menu-${hostId}-${path}`,
      title: "New workspace (a git worktree)",
      "aria-label": "New workspace",
      "aria-expanded": false,
      onClick: () => host().openOverlay?.("worktree", { hostId, cwd: path, anchor: ref.current?.getBoundingClientRect() }),
    },
    createElement(PlusIcon, null),
  );
}
/** A `worktree.*` answer as the screen reads it: the core's refusal (`dirty`: the checkout's guard), or none. */
const NO_ANSWER = "Perch did not answer.";
function worktreeAnswer(reply) {
  if (!reply) return { error: NO_ANSWER };
  if (reply.type === "worktree.error") return { error: reply.message, dirty: !!reply.dirty };
  return reply.error ? { error: String(reply.error) } : {};
}
/** The workspace at `path` on `hostId` as the navigation lists it, or null. */
function workspaceAt(hostId, path, perch = host()) {
  const walk = (list) => {
    for (const w of list ?? []) {
      if (w.path === path) return w;
      const child = walk(w.children);
      if (child) return child;
    }
    return null;
  };
  for (const project of perch.navigation({})?.projects ?? []) {
    if (project.hostId !== hostId) continue;
    const found = walk(project.workspaces) ?? walk(project.hidden);
    if (found) return found;
  }
  return null;
}
/** How long a create's agent waits for its workspace before it is given up, as the web's. */
const START_PANE_WAIT = 5 * 60_000;
/** The web's `startPaneWhenReady`: starts `agent` in the checkout at `path` once the core lists its workspace (a
 * background create reports the path before the workspace exists); given up after `START_PANE_WAIT`, as the web does.
 * It waits on the copy that asked (`perch`), whose listeners and timers go when it closes, and a listing seen past the
 * limit starts nothing even if the give-up timer never ran. */
export function startPaneWhenReady(hostId, path, agent, perch = host()) {
  const deadline = Date.now() + START_PANE_WAIT;
  let finished = false;
  let stop = () => {};
  const finish = () => { finished = true; stop(); clearTimeout(timer); };
  const check = () => {
    if (finished) return;
    if (Date.now() >= deadline) return finish();
    if (!workspaceAt(hostId, path, perch)) return;
    finish();
    perch.startSession?.(hostId, path, agent);
  };
  const timer = setTimeout(finish, START_PANE_WAIT);
  stop = perch.subscribe?.(check) ?? (() => {});
  check();
}
/** The web's `components/WorktreeMenu.tsx` on the native host: what the computer can do is its core's
 * capabilities, the list is what `worktree.list` last answered (the caller's `worktrees` until then), and the
 * operations are the core's questions, as the web's store asks them. */
function WorktreeInPlace({ hostId, path: cwd, className, worktrees: given, request: given_request, parentChoices: parents, emptyAgent: givenAgent, ...rest }) {
  const [worktrees, setWorktrees] = useState(given);
  const can = (capability) => !!host().coreCan?.(capability, hostId);
  const navigation = useNavigation();
  const projectKey = `${hostId}:${cwd}`;
  // The repo's worktrees nested under another (the web's `parentWorkspaceId`), when the computer can nest.
  const parentChoices = useMemo(() => {
    if (Array.isArray(parents)) return parents;
    if (!can("workspace.nest")) return [];
    const project = navigation?.projects?.find((p) => p.hostId === hostId && p.repoPath === cwd);
    const out = [];
    const walk = (list, nested) => {
      for (const w of list ?? []) {
        if (nested) out.push({ id: w.id, name: w.name, path: w.path });
        walk(w.children, true);
      }
    };
    walk(project?.workspaces, false);
    return out;
  }, [parents, navigation, hostId, cwd]); // eslint-disable-line react-hooks/exhaustive-deps
  // This computer's creates run in the background where its core says `worktree.job`: the form closes at once and
  // progress is the sidebar's job row.
  const background = hostId === "local" && can("worktree.job");
  const deleteSupported = rest.deleteSupported ?? can("worktree.delete");
  const startFromSupported = rest.startFromSupported ?? can("worktree.startFrom");
  // Settings' "Empty workspace opens" ("" for none).
  const settingAgent = useHostSnapshot((perch) => perch.emptyWorkspaceAgent?.() ?? undefined);
  const emptyAgent = givenAgent ?? settingAgent ?? undefined;
  // The window's request for this project's menu (leader W, New workspace, `worktree.remove`), else the caller's.
  const windowRequest = useHostSnapshot((perch) => perch.worktreeMenuRequest?.() ?? null);
  const nonce = windowRequest?.projectKey === projectKey ? windowRequest.nonce : null;
  const request = useMemo(() => given_request ?? (nonce == null ? null : windowRequest), [given_request, nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  // The screen keeps the request it was given until a newer one (see `takeRequest`), so its actions stay the same
  // object while the menu is mounted: a new one would run the screen's request effect again on the old request.
  const [asked, setAsked] = useState(request);
  useEffect(() => { if (request) setAsked(request); }, [request]);
  const now = useRef({});
  now.current = { background, deleteSupported };
  const actions = useMemo(() => {
    const ask = (kind, args) => host().ask(kind, { hostId, repoPath: cwd, ...args });
    return {
      list: async () => {
        const reply = await ask("worktree.list", {});
        if (reply?.type === "worktree.list.result") {
          setWorktrees({ worktrees: reply.worktrees ?? [], defaultRoot: reply.defaultRoot ?? "", baseRef: reply.baseRef, refs: reply.refs ?? [] });
        }
        return worktreeAnswer(reply);
      },
      create: async ({ branch, newBranch, path, extra, agent }) => {
        const fields = { branch, newBranch: !!newBranch, path: path ?? null, name: extra?.name ?? null, startFrom: extra?.startFrom ?? null, parentWorkspaceId: extra?.parentWorkspaceId ?? null };
        const { background } = now.current;
        const reply = await ask(background ? "worktree.job.start" : "worktree.create", fields);
        const made = background ? "worktree.job.started" : "worktree.done";
        // No answer, or one that is not the acceptance, is not a create: the form says so and stays.
        if (reply?.type !== made) return { error: worktreeAnswer(reply).error ?? NO_ANSWER };
        const created = background ? reply.job?.path : reply.path;
        if (agent && created) startPaneWhenReady(hostId, created, agent);
        return { background };
      },
      remove: async (path, force) => {
        const reply = await ask("worktree.remove", { path, force: !!force, deleteBranch: now.current.deleteSupported });
        return { ...worktreeAnswer(reply), preservedBranch: reply?.type === "worktree.done" ? (reply.preservedBranch ?? undefined) : undefined };
      },
      deleteBranch: async (branch, head) => worktreeAnswer(await ask("worktree.branch.delete", { branch, expectedHead: head })),
      open: (path) => host().startSession?.(hostId, path, "terminal"),
      // The window forgets the request; the screen keeps it until a newer one, as clearing it would re-run (and so
      // cancel) the screen's effect that a measurement put off until the next frame (`measured`).
      takeRequest: () => host().takeWorktreeRequest?.(),
    };
  }, [hostId, cwd]);
  return createElement(worktreeInPlace, {
    hostId, cwd, projectKey, className, worktrees, background, startFromSupported, deleteSupported,
    parentChoices, emptyAgent, request: asked, actions,
  });
}

/** A row drag, the web's own (`beginSlideDrag`: it picks the slot, slides the rows and hands the slot to `onEnd`), with
 * the pointer's moves and its release forwarded by the window while the press lasts (`host.followPointer`); without
 * that a press stays a press. The rows are asked for their boxes now, so they are measured by the time the press
 * becomes a drag. */
export const beginReorderDrag = (event, options) => {
  if (!host().followPointer?.(event)) return;
  const items = options.items();
  for (const item of items) item.getBoundingClientRect();
  items[0]?.parentElement?.getBoundingClientRect();
  beginSlideDrag(event, options);
};

// ---- chrome (1.2: tabs, status bar, pane header) ------------------------------------------------------------------

export const useWorkspaceTabs = () => useHostSnapshot((perch) => perch.workspaceTabs());

// ---- files ----------------------------------------------------------------------------------------------------

export { FileIcon, GitMarker, assetKind };
let markdownKeys = 0;
/** The rendered preview of the live draft, in the web's box: the window's Markdown engine (`perch-markdown`, the
 * `markdown` engine slot) draws the document, as `CodeEditor` places the editor. It parses off the script and wraps
 * inline code, links and emphasis, which elements described here cannot (the runtime has no inline formatting), and
 * a long document is not thousands of elements to render and describe. Nothing is fetched; an image is the web's text
 * placeholder, a link opens only for an absolute http(s) address on a click. */
export function MarkdownPreview({ path, content }) {
  const { source, truncated } = previewSource(content ?? "");
  const markdown = host().markdown;
  const key = useMemo(() => `markdown-${++markdownKeys}`, []);
  useLayoutEffect(() => { markdown?.show(key, source); }, [key, source]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => markdown?.release(key), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return createElement("div", { className: "min-h-0 min-w-0 flex-1 overflow-auto px-4 py-3 text-[0.8rem]", style: { display: "flex", flexDirection: "column" }, tabIndex: 0, role: "region", "aria-label": `Rendered preview of ${path}`, "data-testid": "workspace-markdown-preview" },
    truncated && createElement("p", { role: "status", className: "mt-0 text-[0.7rem] text-yellow", "data-testid": "workspace-markdown-truncated" },
      `This document is large: only the first ${FILE_PREVIEW_MAX_CHARS.toLocaleString()} characters are rendered. Switch to Source to see all of it.`),
    createElement("div", { className: "message__markdown file-markdown", style: { display: "flex", flexDirection: "column", flex: "1 1 0%", minHeight: 0 } },
      createElement("div", { "data-perch-engine": "markdown", "data-perch-key": key, className: "min-h-0 min-w-0 flex-1" })));
}
/** The explorer's right-click menu and its prompts: the window's `dialog` screen (`file-menu` in it). */
export const FileEntryMenu = overlay("file-menu");

const NO_MARKS = new Map();
const FILE_ACTIONS = ["requestTree", "searchFiles", "openFile", "reloadFile", "requestPreview", "updateDraft", "saveFile", "overwriteFile", "setWrap"];
/** `useWorkspaceFiles`: a workspace's files as the window's store keeps them (listings, documents with their drafts,
 * previews, the last search), its Git marks with `{git: true}`, and the store's actions. An action runs once the
 * current call has unwound and returns null (the web's request ids are not used by a screen). */
export function useWorkspaceFiles(workspaceId, options = {}) {
  const data = useHostSnapshot((perch) => perch.workspaceFiles(workspaceId));
  const withGit = !!options.git;
  const marks = data.git?.decorations;
  const decorations = useMemo(() => (withGit && marks?.length ? new Map(marks) : NO_MARKS), [marks, withGit]);
  const actions = useMemo(() => Object.fromEntries(FILE_ACTIONS.map((action) => [action, (...args) => {
    host().filesDo(action, workspaceId, ...args);
    return null;
  }])), [workspaceId]);
  // Ask agent where the Context Bridge is (the window's): an editor selection says whether its file has unsaved
  // changes as the store has it when asked.
  const canAsk = useHostSnapshot((perch) => !!perch.contextBridgeAvailable?.(workspaceId));
  const askAgent = useMemo(() => (canAsk ? (source) => {
    if (source.kind !== "editor") return host().askAgent(workspaceId, source);
    const doc = host().workspaceFiles(workspaceId)?.documents?.[source.path];
    return host().askAgent(workspaceId, { ...source, dirty: doc?.content !== doc?.savedContent });
  } : undefined), [canAsk, workspaceId]);
  return useMemo(() => ({
    workspace: data.workspace,
    connected: data.connected,
    trees: data.trees,
    documents: data.documents,
    previews: data.previews,
    search: data.search ?? undefined,
    wrap: data.wrap,
    git: { ...data.git, decorations },
    actions,
    askAgent,
  }), [data, decorations, actions, askAgent]);
}
export const useStatusLine = () => useHostSnapshot((perch) => perch.statusLine());
export const useZoom = () => useHostSnapshot((perch) => perch.zoom());
export const usePaneLook = () => useHostSnapshot((perch) => perch.paneLook());
/** Every key binding the window answers, with a person's choices (`perch.keybindings()`): `{keys, description, group}`. */
export const useKeybindings = () => useHostSnapshot((perch) => perch.keybindings?.() ?? []);
const NO_USAGE = Object.freeze({ usage: Object.freeze([]), updatedAt: 0, spend: null, redeemResult: null });
/** Plan usage as the core last reported it (`perch.planUsage()`). With `keepFresh`, asks on connect and then every
 * 3 min (the core's cache) while the caller is mounted, as the web's does. */
export function usePlanUsage(options) {
  const keepFresh = !!options?.keepFresh;
  const connected = useHostSnapshot((perch) => perch.statusLine?.().connected ?? false);
  const usage = useHostSnapshot((perch) => perch.planUsage?.() ?? NO_USAGE);
  useEffect(() => {
    if (!keepFresh || !connected) return undefined;
    let timer;
    const ask = () => {
      host().command("usage.get");
      timer = setTimeout(ask, 180_000);
    };
    ask();
    return () => clearTimeout(timer);
  }, [keepFresh, connected]);
  return usage;
}
export const refreshUsage = () => host().command("usage.get", { force: true });
export const redeemUsageReset = (accountId) => host().command("usage.redeemReset", { accountId });
export const resetZoom = () => runCommand("app.zoom_reset");
/** A tab's fill and text by its pane state: the app's `TAB_PANE_CLASS` (`tabPaneState.ts`, whose module also holds
 * the split store, so its three strings are here; `test/sdk.test.mjs` checks they are the app's). */
export const tabStateClass = {
  focused: "bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] hover:bg-[color-mix(in_srgb,var(--text)_10%,var(--panel-bg))] text-fg font-semibold",
  visible: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
  hidden: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
};
/** A tab drag: the host follows the pointer (`perch.beginTabDrag`); without it a press stays a press. */
export const beginTabDrag = (event, id, label) => host().beginTabDrag?.(event, id, label);
/** Calls `listener` when the window asks for a new tab (`perch.onRequest("new-tab")`). */
export function useNewTabRequest(listener) {
  useEffect(() => host().onRequest?.("new-tab", listener) ?? undefined, [listener]);
}
export const openBrowserTab = (workspaceId) => runCommand("browser.open", { workspaceId });
export const openFileTab = (workspaceId, path) => runCommand("file.open", { workspaceId, path });
/** The tab menu is the window's (`tab.menu` opens it); nothing is drawn in the strip. */
export const TabMenu = () => null;
/** A dragged tab's ghost is the host's; nothing is drawn in the strip. */
export const TabDragLayer = () => null;
export const NewFilePrompt = overlay("new-file");

// ---- review (`stock:review`) --------------------------------------------------------------------------------------

/** The actions of `useGitReview`, each run on the window's Git store (`gitDo`). Previews, packets and deliveries
 * resolve with the store's value; the rest are fire-and-forget, as the web's. */
const GIT_ACTIONS = ["refreshStatus", "selectAgentSession", "loadDiff", "stage", "unstage", "discardPreview", "discard",
  "commitPreview", "commit", "listComments", "listRefs", "createComment", "updateComment", "resolveComment",
  "deleteComment", "previewBatch", "sendBatch"];
const ANSWERED = new Set(["discardPreview", "commitPreview", "previewBatch", "sendBatch"]);
function gitActions(workspaceId) {
  const actions = {};
  for (const name of GIT_ACTIONS) {
    actions[name] = (...args) => {
      const done = host().gitDo(name, workspaceId, ...args);
      if (ANSWERED.has(name)) return done.then((value) => value ?? null, () => null);
      done.catch?.((error) => console.error(`perch: ${name}: ${error?.message ?? error}`));
      return null;
    };
  }
  return actions;
}

/** A workspace's review as the window's Git store keeps it (`@perch/sdk` `useGitReview`). Ask agent is absent: the
 * native client offers Context Bridge only from a terminal. */
export function useGitReview(workspaceId) {
  const review = useHostSnapshot((perch) => perch.gitReview(workspaceId));
  const actions = useMemo(() => gitActions(workspaceId), [workspaceId]);
  return useMemo(() => ({
    ready: review.ready, workspaceName: review.workspaceName ?? undefined, startSnapshot: review.startSnapshot ?? undefined,
    lastAgentTurn: review.lastAgentTurn ?? undefined, agentSessionId: review.agentSessionId,
    status: review.status ?? undefined, statusState: review.statusState, statusError: review.statusError,
    actionError: review.actionError, diff: review.diff ?? undefined, diffState: review.diffState, diffError: review.diffError,
    comments: review.comments ?? [], refs: review.refs ?? [], batchDelivery: review.batchDelivery ?? undefined,
    sessions: review.sessions ?? [], currentRevision: review.currentRevision ?? undefined, actions, askAgent: undefined,
  }), [review, actions]);
}

/** The review's diff, drawn natively (the `diff` engine): the diff and comments come from the window's Git store by
 * `workspaceId`; the props are view state, and what the person does comes back through the callbacks. Each copy of
 * the screen (the drawer's Git and a review tab of one workspace) has a view of its own, so each scrolls, measures
 * and hears events on its own; the data stays the workspace's. */
export function DiffView(props) {
  const { workspaceId } = props;
  const key = `diff:${workspaceId}:${useId()}`;
  const perch = host();
  const opened = useRef(null);
  if (opened.current !== key) {
    perch.diff.open(key, { workspaceId });
    opened.current = key;
  }
  perch.diff.setProps(key, {
    path: props.path ?? null, wrap: !!props.wrap, layout: props.layout ?? "auto", canAsk: !!props.onAskAgent, selection: props.selection ?? null,
    editingCommentId: props.editingCommentId ?? null, editingBody: props.editingBody ?? "", reveal: props.reveal ?? null,
    collapsed: props.collapsed ?? [], viewed: props.onToggleViewed ? (props.viewed ?? []) : null,
    composer: props.selection && props.onSubmitComment ? { body: props.commentBody ?? "", target: props.commentTarget ?? null, canAsk: !!props.onAskLines } : null,
  });
  const comments = useHostSnapshot((p) => p.gitReview(workspaceId)).comments ?? [];
  const seq = useSyncExternalStore(subscribe, () => perch.diff.seq(key));
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const p = latest.current;
    const comment = (id) => comments.find((c) => c.id === id);
    for (const event of perch.diff.events(key)) {
      switch (event.type) {
        case "selectLine": p.onSelectLine?.(event.path, event.side, event.line, event.extend); break;
        case "addComment": p.onAddComment?.(event.path, event.side, event.line); break;
        case "askAgent": p.onAskAgent?.(event.path); break;
        case "toggleCollapsed": p.onToggleCollapsed?.(event.path); break;
        case "toggleViewed": p.onToggleViewed?.(event.path); break;
        case "editComment": { const c = comment(event.commentId); if (c) p.onEditComment?.(c); break; }
        case "editBody": p.onEditBody?.(event.text); break;
        case "saveEdit": { const c = comment(event.commentId); if (c) p.onSaveEdit?.(c); break; }
        case "cancelEdit": p.onCancelEdit?.(); break;
        case "commentBody": p.onCommentBody?.(event.text); break;
        case "submitComment": p.onSubmitComment?.(); break;
        case "cancelComment": p.onCancelComment?.(); break;
        case "askLines": p.onAskLines?.(); break;
        case "resolve": { const c = comment(event.commentId); if (c) p.onResolve?.(c); break; }
        case "delete": { const c = comment(event.commentId); if (c) p.onDelete?.(c); break; }
      }
    }
  }, [seq, key]);
  return createElement("div", { "data-perch-engine": "diff", "data-perch-key": key, "data-testid": "git-diff", className: props.className ?? "min-h-0 flex-1" });
}
/** The native diff can lay a change out side by side (`layout`); a screen asks this before offering the choice. */
DiffView.splitLayout = true;
/** The file pane's media viewer (`fileAsset.mjs`), drawn through this copy's host. */
export function FileAsset(props) { return createElement(NativeFileAsset, { ...props, perch: host() }); }

// ---- the file editor ------------------------------------------------------------------------------------------

/** The text and line range `askAgent` sends: the selection, or the whole file without one (the web's rule). */
function askAgentRange(editor, docKey) {
  const selected = editor.selection(docKey);
  if (selected) return selected;
  const text = editor.value(docKey);
  const lines = text.split("\n").length - (text.endsWith("\n") && text.length ? 1 : 0);
  return { text, startLine: 1, endLine: Math.max(1, lines) };
}

/** Go to line, as CodeMirror's panel: `line` or `line:col`, Enter goes, Escape closes; the editor gets the keyboard back. */
function GotoLine({ onGo, onClose }) {
  const [text, setText] = useState("");
  const go = (event) => {
    event?.preventDefault?.();
    const [line, col] = text.split(":").map((part) => Number.parseInt(part, 10));
    if (Number.isFinite(line)) onGo(line, Number.isFinite(col) ? col : 1);
    else onClose();
  };
  return createElement("div", { className: "flex shrink-0 items-center gap-2 border-b border-border px-3 py-1 text-[0.75rem] text-subtext-0", "data-testid": "editor-goto" },
    createElement("label", { htmlFor: "perch-editor-goto" }, "Go to line"),
    createElement("input", {
      id: "perch-editor-goto", "data-testid": "editor-goto-line", autoFocus: true, value: text, className: "min-w-0 flex-1 rounded border border-border bg-transparent px-1 text-text",
      onChange: (event) => setText(event.target.value),
      onKeyDown: (event) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } else if (event.key === "Enter") go(event); },
    }),
    createElement("button", { type: "button", className: GHOST_BUTTON, onClick: go }, "OK"));
}

/**
 * The file editor (the web's `CodeEditor`, same props and handle): Perch's native editor, placed in this box as an
 * engine slot (`data-perch-engine="editor"`) and driven through the host's `perch-editor` (`perch.editor`). The editor
 * lives in Rust by `docKey`: a re-render reaches it only when a prop changed, a new `docKey` (the web re-keys by path
 * and reload) parks the old one, and unmounting parks it. The store's `value` goes in as an outside edit (no undo
 * entry, no change event) only when it differs from what the editor last reported; user edits leave through
 * `onChange`. Keys (save, find, go to line) and typing rules are the editor's own, in Rust.
 *
 * A workspace file's document (`docKey` `<workspace>\0<path>\0<reload epoch>`, as the files screen makes it) is kept
 * in step by the window itself: each edit reaches its store at once and the store's text reaches the editor, so a key
 * costs this screen nothing. Then `value` is only the text it opens with, `onChange` is not called, and the caret
 * comes from the window's snapshot of the workspace's files.
 */
export function CodeEditor({ value, onChange, onSave, onCaret, readOnly, wrap, label, path, docKey, onAskAgent, ref }) {
  const editor = host().editor;
  const latest = useRef(null);
  latest.current = { onChange, onSave, onCaret, onAskAgent };
  const [workspaceId, , epoch] = String(docKey).split("\0");
  const fileKept = !!editor && epoch !== undefined && /^\d+$/.test(epoch);
  const keptCaret = useHostSnapshot((perch) => (fileKept ? perch.workspaceFiles(workspaceId)?.carets?.[docKey] ?? null : null));
  useEffect(() => { if (keptCaret) latest.current.onCaret?.({ line: keptCaret.line, col: keptCaret.col }); }, [keptCaret?.line, keptCaret?.col]); // eslint-disable-line react-hooks/exhaustive-deps
  // The text the editor and the store last agreed on: the store echoing it back is not an outside edit.
  const known = useRef(value);
  const [menu, setMenu] = useState(null);
  const [goto, setGoto] = useState(false);

  const askAgent = () => {
    if (!editor || !latest.current.onAskAgent) return;
    const { text, startLine, endLine } = askAgentRange(editor, docKey);
    latest.current.onAskAgent(text, startLine, endLine);
  };
  useImperativeHandle(ref, () => ({
    openGoto: () => setGoto(true),
    focus: () => editor?.focus(docKey),
    askAgent,
  }), [docKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!editor) return undefined;
    editor.open(docKey, { path, value, readonly: !!readOnly, wrap: !!wrap, label });
    known.current = value;
    const unwatch = editor.watch(docKey, (events) => {
      for (const event of events) {
        if (event.type === "change") {
          const text = editor.value(docKey);
          known.current = text;
          latest.current.onChange?.(text);
        } else if (event.type === "caret") latest.current.onCaret?.({ line: event.line, col: event.col });
        else if (event.type === "save") latest.current.onSave?.();
        else if (event.type === "goto") setGoto(true);
        else if (event.type === "contextmenu") setMenu({ x: event.x, y: event.y });
      }
    });
    return () => { unwatch(); editor.park(docKey); };
  }, [docKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!editor || fileKept || value === known.current) return;
    known.current = value;
    editor.setValue(docKey, value, { external: true });
  }, [docKey, value]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { editor?.setReadonly(docKey, !!readOnly); }, [docKey, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { editor?.setWrap(docKey, !!wrap); }, [docKey, wrap]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) {
    // A host without the native editor (a test, an older window): a plain field keeps the screen usable.
    return createElement("textarea", { className: "h-full min-h-0 w-full flex-1 bg-transparent font-mono text-text", "aria-label": label, value, readOnly, onChange: (event) => onChange?.(event.target.value) });
  }
  const refocus = (task) => () => { setMenu(null); task(); editor.focus(docKey); };
  const hasSelection = menu ? !!editor.selection(docKey) : false;
  return createElement("div", { className: "relative flex h-full min-h-0 min-w-0 flex-1 flex-col", "aria-label": label },
    goto && createElement(GotoLine, {
      onGo: (line, col) => { setGoto(false); editor.goTo(docKey, line, col); editor.focus(docKey); },
      onClose: () => { setGoto(false); editor.focus(docKey); },
    }),
    createElement("div", { "data-perch-engine": "editor", "data-perch-key": docKey, className: "min-h-0 min-w-0 flex-1" }),
    menu && createElement(StockEditorMenu, {
      x: menu.x, y: menu.y, readOnly: !!readOnly, canUndo: editor.canUndo(docKey), canRedo: editor.canRedo(docKey), hasSelection,
      onClose: () => setMenu(null),
      actions: {
        undo: refocus(() => editor.undo(docKey)), redo: refocus(() => editor.redo(docKey)),
        cut: refocus(() => editor.cut(docKey)), copy: refocus(() => editor.copy(docKey)), paste: refocus(() => editor.paste(docKey)),
        selectAll: refocus(() => editor.selectAll(docKey)),
        find: refocus(() => editor.openSearch(docKey, false)), replace: refocus(() => editor.openSearch(docKey, true)),
        gotoLine: () => { setMenu(null); setGoto(true); },
        ...(onAskAgent ? { askAgent: () => { setMenu(null); askAgent(); } } : {}),
      },
    }));
}


// ---- browser pages ----------------------------------------------------------------------------------------------

const NO_BROWSER_PAGES = Object.freeze({ pages: [], shownId: null, tabCount: 0 });
/** The drawer's browser pages of `workspaceId` (`perch.browserPages`), the one shown and how many browser tabs the
 * workspace has, with the window's commands for them. `open()` names the new page and returns its id. */
export function useBrowserPages(workspaceId) {
  const data = useHostSnapshot((perch) => perch.browserPages?.(workspaceId) ?? NO_BROWSER_PAGES);
  return useMemo(() => {
    const run = (command, args) => host().command(command, { workspaceId, ...args });
    return {
      pages: data.pages ?? [],
      shownId: data.shownId ?? null,
      tabCount: data.tabCount ?? 0,
      open: () => {
        const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        run("browser.drawer.open", { id });
        return id;
      },
      select: (id) => run("browser.drawer.select", { id }),
      close: (id) => run("browser.drawer.close", { id }),
      closeAll: () => run("browser.drawer.closeAll", {}),
      // The window follows the page itself; nothing to keep here.
      setUrl: () => {},
    };
  }, [data, workspaceId]);
}

/** A drawer page with its toolbar: a box the window fills with the native page (`data-perch-engine="browser"`).
 * `active`: the page takes the keyboard once shown. */
export function BrowserPage({ pageId, active }) {
  const key = `drawer\n${pageId}`;
  useEffect(() => {
    if (active) host().command("browser.focus", { key });
  }, [active, key]);
  return createElement("div", {
    "data-perch-engine": "browser",
    "data-perch-key": key,
    "data-testid": "browser-page",
    style: { display: "flex", flex: "1 1 0%", minHeight: 0, minWidth: 0 },
  });
}
