//! `@perch/sdk` for the native client: the surface a stock screen imports (the navigation part, 1.3), with every
//! call going to one abstract host object, `globalThis.perch`, read when called (so a host or a test sets it before
//! mounting). Class helpers, icons, `cn`, `keyLabel` and the host dot are the app's own modules, compiled in, so the
//! classes are the web's to the character. Data hooks subscribe to `perch.subscribe` and read the host's snapshots
//! (`perch.navigation(options)`, `perch.hosts()`, ...), which must return the same object until the data changes.
//! Menus and dialogs Perch draws itself (session menu, new session menu, confirm, select, folder browser,
//! instructions, memory) open through `perch.openOverlay(kind, props)`; their callbacks are plain functions.
import { createElement, Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "../../../../packages/web/src/lib/cn.ts";
import { formatCombo } from "../../../../packages/web/src/keyCombo.ts";
import { segment } from "../../../../packages/web/src/components/ui/segment.ts";
import { rowAction } from "../../../../packages/web/src/components/ui/row-action.ts";
import { button } from "../../../../packages/web/src/components/ui/button.ts";
import { menuDivider, menuItem, menuPanel } from "../../../../packages/web/src/components/ui/menu.ts";
import { GHOST_BUTTON, ICON_BUTTON } from "../../../../packages/web/src/components/ui/icon-button.ts";
import { CloseIcon, EllipsisIcon, GearIcon, PlusIcon } from "../../../../packages/web/src/components/ui/icons.tsx";
import { HostStateDot } from "../../../../packages/web/src/components/HostStateDot.tsx";
import StockDialog from "../../../../packages/web/src/stock-ui/dialog/main.tsx";
import { DOT_GLYPH, sessionDotState } from "../../../../packages/web/src/statusDot.ts";
import { isNestedIn, nestUnderLeads } from "../../../../packages/web/src/sidebarOrder.ts";
import { computeAnchoredPopoverStyle, useDismissOnOutsideClick } from "../../../../packages/web/src/components/popoverPosition.ts";
import { PageIcon } from "../../../../packages/web/src/components/PageIcon.tsx";

/** The SDK version this surface implements (`perch-sdk.d.ts`'s navigation part). */
export const version = "1.3.0";

// The host this copy of the runtime serves (`bindHost`, from the screen's `screen.js`). Each screen's folder has its own
// runtime and host, but the mods share one script context, so `globalThis.perch` is the host of whichever screen
// loaded last: a screen that read data through it would stop hearing of changes once that screen closed.
let bound = null;
/** Binds this runtime's `@perch/sdk` to `perch`, its screen's own host. */
export const bindHost = (perch) => { bound = perch; };

/** The host object; a clear error when a screen runs without one. */
function host() {
  const perch = bound ?? globalThis.perch;
  if (!perch) throw new Error("@perch/sdk: no perch host (globalThis.perch) is set");
  return perch;
}
const subscribe = (listener) => host().subscribe?.(listener) ?? (() => {});

export { cn, menuPanel, CloseIcon, EllipsisIcon, GearIcon, PlusIcon, HostStateDot, PageIcon, useDismissOnOutsideClick };
export const anchoredPopoverStyle = computeAnchoredPopoverStyle;
/** Read once: the host (`globalThis.perch`) is set before the runtime is evaluated. */
export const isMac = globalThis.perch?.isMac !== false;
export const keyLabel = (combo) => formatCombo(combo, host().isMac !== false);
export const segmentClass = (options) => segment(options);
export const rowActionClass = ({ className, ...variants } = {}) => cn(rowAction(variants), className);
export const buttonClass = button;
export const menuItemClass = (options) => menuItem(options);
export const menuDividerClass = menuDivider;
export const ghostButton = GHOST_BUTTON;
export const iconButton = ICON_BUTTON;
export const agentStateColor = (state) => DOT_GLYPH[state].color;

/** The key binding `event` triggers in `scope` (1.7), from the host (`perch.shortcutFor`); null where the host has
 * no bindings for that scope (the native keymap has no `navigator.*` keys yet, so the Navigator moves with the arrows
 * only). */
export const shortcutFor = (event, scope) => host().shortcutFor?.(event, scope) ?? null;

/** A typed command (`session.open`, `project.move`, ...) for the host to run; false when it refused it. */
export const runCommand = (command, args) => host().command(command, args ?? {}) !== false;
export const startSession = (hostId, cwd, agent) => host().startSession?.(hostId, cwd, agent);
/** The desktop's folder dialog, or null where the host has none (as in a browser, where a screen hides its button). */
export const pickFolder = globalThis.perch?.pickFolder ? (title) => host().pickFolder(title) : null;

// ---- data -----------------------------------------------------------------------------------------------------

function useHostSnapshot(read) {
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
/** A dropdown: the field is the screen's (the stock select's classes), its list Perch's (`select` overlay). */
export function Select({ value, onChange, options = [], className, ariaLabel, testId, title, disabled, placeholder }) {
  const ref = useRef(null);
  const selected = options.find((option) => option.value === value);
  return createElement(
    "button",
    {
      type: "button", ref, title, disabled, "aria-label": ariaLabel, "data-testid": testId, "aria-haspopup": "listbox",
      className: cn("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", className),
      onClick: () => host().openOverlay?.("select", { value, options, onChange: (next) => onChange?.(next), anchor: ref.current?.getBoundingClientRect() }),
    },
    createElement("span", { className: "min-w-0 flex-1 truncate" }, selected ? selected.label : (placeholder ?? "")),
  );
}
export const FolderBrowser = overlay("folder-browser");
export const InstructionsDialog = overlay("instructions");
export const MemoryDialog = overlay("memory");
/** The app's own stock dialog: drawn from the screen's children in the overlay layer (`document.body`). */
export const Dialog = StockDialog;

/** A git folder's worktree menu button; the menu itself is Perch's (`worktree` overlay, anchored on the button). */
export function WorktreeMenu({ hostId, path, className }) {
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

/** A row drag: the host follows the pointer and slides the rows (`perch.beginReorderDrag`); without it a press
 * stays a press. */
export const beginReorderDrag = (event, options) => host().beginReorderDrag?.(event, options);

// ---- chrome (1.2: tabs, status bar, pane header) ------------------------------------------------------------------

export const useWorkspaceTabs = () => useHostSnapshot((perch) => perch.workspaceTabs());
export const useStatusLine = () => useHostSnapshot((perch) => perch.statusLine());
export const useZoom = () => useHostSnapshot((perch) => perch.zoom());
export const usePaneLook = () => useHostSnapshot((perch) => perch.paneLook());
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
