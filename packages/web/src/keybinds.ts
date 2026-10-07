/**
 * keybinds.ts — the web keymap.
 *
 * Two layers, one table each:
 *
 * 1. **Direct shortcuts** (`SHORTCUTS`): browser-tab, Vivaldi-workspace and
 *    iTerm2/Ghostty style keys. On macOS the app owns every Cmd combination
 *    (they never reach the PTY; see `terminalKeyHandler`), so `mod` is Cmd
 *    there. Elsewhere Ctrl alone belongs to the shell, so `mod` is Ctrl+Shift,
 *    as in Ghostty/GNOME Terminal. Each entry gives the macOS and the other
 *    platforms' spec; `null` means "no direct key there" (the leader still
 *    reaches it). The help modal is generated from this table.
 * 2. **The leader** (`Ctrl+Space`, then a letter; `CHORD_ACTIONS`): the
 *    namespace for rarer actions that deserve no direct key (swap panes,
 *    resize mode, next project, the worktree menu). Pressing it arms a ~1.5s
 *    window; missing it silently disarms.
 *
 * perch is a desktop app (a phone app is coming), never a web page, so no
 * browser reserves a key from it.
 *
 * Cmd+K / Ctrl+K open the Navigator outside terminals; in a terminal Cmd+K
 * clears it (terminalSearch.ts) and Ctrl+K stays the PTY's. Plain `?` opens
 * the help outside editable elements.
 *
 * Focus guard: leader chords and `?` are suppressed while focus is in a
 * `textarea`/`input`/`[contenteditable]`; a focused terminal or the file
 * editor is the exception, as panes hold focus when their tab is selected.
 * Direct shortcuts work from anywhere, even inside inputs, like a browser's.
 * `terminalKeyHandler` keeps xterm from also sending any of them to the PTY.
 */
import { useEffect, useRef } from "react";
import { usePerchStore, effectiveActiveProject, effectiveWorkspace } from "./store";
import { activateTab, currentTabs } from "./workspaceTabs";
import { getDockviewController } from "./dockview/dockviewController";
import { useFileTabs } from "./fileTabs";
import { jumpToNest, newScratchpad, reopenClosedTab, stepNest } from "./workspaceNav";
import { requestCloseSession } from "./closeGuard";
import { requestAddProject, requestNewTab, withSidebar } from "./appEvents";
import { IS_MAC, comboMatches, formatCombo, keyLabel, normalizeCombo, parseCombo, validCombo } from "./keyCombo";

const LEADER_TIMEOUT_MS = 1500;

// ---------------------------------------------------------------------------
// Shortcut table (also consumed by KeybindHelp.tsx and Settings > Keyboard)
// ---------------------------------------------------------------------------

export type KeybindGroup = "global" | "tabs" | "nests" | "panes" | "terminal" | "leader";

export interface KeybindEntry {
  keys: string;
  description: string;
  group: KeybindGroup;
}

export interface LeaderKeyHandlers {
  openNavigator: () => void;
  openKeybindHelp: () => void;
  toggleDrawer: () => void;
}

export interface Shortcut {
  /** Stable name: what a user's override in `settings.keybindings` is keyed by. */
  id: string;
  group: KeybindGroup;
  description: string;
  /** Built-in defaults [macOS, other platforms]; `null` = none there. */
  keys: [string, string | null];
  run: (handlers: LeaderKeyHandlers) => void;
  /**
   * `terminal`: needs the xterm instance, so `terminalSearch.ts` runs it (the
   * global listener skips it). `outsideTerminal`: in a terminal the key
   * belongs to the PTY, so it is neither run nor swallowed there.
   */
  scope?: "terminal" | "outsideTerminal";
  /** The help lists a range (jump to tab 1…8) as one row while none of its members is customised. */
  range?: { id: string; label?: string };
}

export const SHORTCUTS: Shortcut[] = [];

function shortcut(
  id: string,
  group: KeybindGroup,
  keys: string | [string, string | null],
  description: string,
  run: Shortcut["run"],
  extra: Pick<Shortcut, "scope" | "range"> = {},
): void {
  SHORTCUTS.push({ id, group, keys: typeof keys === "string" ? [keys, keys] : keys, description, run, ...extra });
}

const controller = () => getDockviewController();
const chrome = () => usePerchStore.getState();
const noop = () => {};

// Global
shortcut("global.navigator", "global", "mod+p", "Open Navigator", (h) => h.openNavigator());
shortcut("global.navigatorAlt", "global", ["cmd+k", "ctrl+k"], "Open Navigator (outside terminals)", (h) => h.openNavigator(), { scope: "outsideTerminal" });
shortcut("global.settings", "global", "mod+,", "Open Settings", () => chrome().setSettingsOpen(true));
shortcut("global.help", "global", "mod+/", "Open this keybind help", (h) => h.openKeybindHelp());
shortcut("global.sidebar", "global", "mod+b", "Toggle sidebar", () => chrome().toggleSidebar());
shortcut("global.drawer", "global", ["cmd+shift+b", "alt+shift+b"], "Toggle the right drawer (files and Git)", (h) => h.toggleDrawer());

// Tabs (browser style)
shortcut("tabs.new", "tabs", "mod+t", "New tab (pick a harness) in this nest", () => requestNewTab());
shortcut("tabs.close", "tabs", "mod+w", "Close the focused pane, file or tab (agents ask first)", () => closeCurrent());
shortcut("tabs.reopen", "tabs", ["cmd+shift+t", "alt+shift+t"], "Reopen the last closed tab or file", () => reopenClosedTab());
for (let i = 1; i <= 8; i++) {
  shortcut(`tabs.jump${i}`, "tabs", [`cmd+${i}`, `alt+${i}`], `Jump to tab ${i}`, () => jumpToNthWorkspaceTab(i), { range: { id: "tabs.jump", label: "1…8" } });
}
shortcut("tabs.last", "tabs", ["cmd+9", "alt+9"], "Jump to the last tab", () => jumpToNthWorkspaceTab(Infinity));
shortcut("tabs.next", "tabs", ["cmd+shift+]", "ctrl+pagedown"], "Next tab", () => switchTabRelative(1));
shortcut("tabs.prev", "tabs", ["cmd+shift+[", "ctrl+pageup"], "Previous tab", () => switchTabRelative(-1));

// Nests and birdhouses (workspaces and projects)
shortcut("nests.prev", "nests", ["ctrl+shift+up", "alt+shift+up"], "Previous nest", () => stepNest(-1));
shortcut("nests.next", "nests", ["ctrl+shift+down", "alt+shift+down"], "Next nest", () => stepNest(1));
for (let i = 1; i <= 9; i++) {
  shortcut(`nests.jump${i}`, "nests", [`ctrl+shift+${i}`, `alt+shift+${i}`], `Jump to nest ${i}`, () => jumpToNest(i), { range: { id: "nests.jump", label: "1…9" } });
}
shortcut("nests.new", "nests", "mod+n", "New nest (worktree)", () => openWorktreeMenuForActiveProject(true));
shortcut("nests.addBirdhouse", "nests", "mod+o", "Add birdhouse (project)", () => requestAddProject());
shortcut("nests.scratchpad", "nests", ["cmd+shift+n", null], "New scratchpad chat", () => newScratchpad());

// Splits and panes (iTerm2/Ghostty)
shortcut("panes.splitRight", "panes", "mod+d", "Split right", () => controller()?.addTerminalPanel("right"));
shortcut("panes.splitDown", "panes", ["cmd+shift+d", "alt+shift+d"], "Split down", () => controller()?.addTerminalPanel("below"));
shortcut("panes.prev", "panes", "mod+[", "Previous pane", () => controller()?.cycleToPreviousPane());
shortcut("panes.next", "panes", "mod+]", "Next pane", () => controller()?.cycleToNextPane());
shortcut("panes.zoom", "panes", "mod+shift+enter", "Zoom / restore the focused pane", () => controller()?.toggleMaximizeActive());
for (const dir of ["left", "right", "up", "down"] as const) {
  const where = { left: "to the left", right: "to the right", up: "above", down: "below" }[dir];
  shortcut(`panes.focus.${dir}`, "panes", [`cmd+alt+${dir}`, `ctrl+shift+alt+${dir}`], `Focus the pane ${where}`, () => controller()?.focusPaneDirection(dir));
}

// Terminal: run by terminalSearch.ts, which has the xterm instance
shortcut("terminal.find", "terminal", "mod+f", "Find in the terminal", noop, { scope: "terminal" });
shortcut("terminal.clear", "terminal", "mod+k", "Clear the terminal (screen and scrollback)", noop, { scope: "terminal" });
shortcut("terminal.scrollTop", "terminal", "mod+up", "Scroll to the top", noop, { scope: "terminal" });
shortcut("terminal.scrollBottom", "terminal", "mod+down", "Scroll to the bottom", noop, { scope: "terminal" });

/** The user's overrides (action id → combo, "" = none) from Settings > Keyboard. */
function overrides(): Record<string, string> {
  return usePerchStore.getState().settings?.keybindings ?? {};
}

/** The combo `s` is bound to on this platform: the user's choice, else the default; `null` = none. */
export function effectiveSpec(s: Shortcut, mac = IS_MAC): string | null {
  const own = overrides()[s.id];
  if (own !== undefined) return own !== "" && validCombo(own) ? own : null;
  return s.keys[mac ? 0 : 1];
}

/** The shortcut `e` triggers on this platform, if any. `inTerm`: the key went to a focused terminal, where
 * `terminal` shortcuts apply and `outsideTerminal` ones do not (the PTY keeps their key). */
export function shortcutFor(e: KeyboardEvent, inTerm = false, mac = IS_MAC): Shortcut | undefined {
  return SHORTCUTS.find((s) => {
    if (inTerm ? s.scope === "outsideTerminal" : s.scope === "terminal") return false;
    const spec = effectiveSpec(s, mac);
    return spec !== null && comboMatches(e, parseCombo(spec, mac));
  });
}

/** Two shortcuts can fire on the same keystroke unless one is terminal-only and the other terminal-free. */
const overlaps = (a: Shortcut, b: Shortcut) => !(a.scope && b.scope && a.scope !== b.scope);

/** The other shortcuts already on `spec` that would fire together with `id` (for the recorder to move). */
export function shortcutsBoundTo(spec: string, id: string, mac = IS_MAC): Shortcut[] {
  const want = normalizeCombo(spec, mac);
  const mine = SHORTCUTS.find((s) => s.id === id);
  return SHORTCUTS.filter((s) => {
    const other = s.id === id || (mine && !overlaps(mine, s)) ? null : effectiveSpec(s, mac);
    return other !== null && normalizeCombo(other, mac) === want;
  });
}

/** The help and Settings' view of the keymap: static keys plus the current shortcuts. */
export function keybindEntries(mac = IS_MAC): KeybindEntry[] {
  const custom = overrides();
  const rangeEdited = (id: string) => SHORTCUTS.some((s) => s.range?.id === id && custom[s.id] !== undefined);
  const seenRanges = new Set<string>();
  const direct = SHORTCUTS.flatMap((s): KeybindEntry[] => {
    const spec = effectiveSpec(s, mac);
    if (spec === null) return [];
    if (s.range && !rangeEdited(s.range.id)) {
      if (seenRanges.has(s.range.id)) return [];
      seenRanges.add(s.range.id);
      const keys = formatCombo(spec, mac);
      return [{ keys: keys.slice(0, -keyLabel(spec).length) + (s.range.label ?? ""), description: `Jump to ${s.range.id === "tabs.jump" ? "tab" : "nest"} ${s.range.label}`, group: s.group }];
    }
    return [{ keys: formatCombo(spec, mac), description: s.description, group: s.group }];
  });
  return [
    ...direct,
    { keys: "?", description: "Open this keybind help (outside inputs)", group: "global" },
    { keys: "Esc", description: "Close any open overlay", group: "global" },
    { keys: "↑ / ↓ (Ctrl+j / Ctrl+k)", description: "Move selection in Navigator", group: "global" },
    { keys: mac ? "⌘C / ⌘V" : "Ctrl+Shift+C / V", description: "Copy / paste", group: "terminal" },
  { keys: "Ctrl+Space, g", description: "Open Navigator", group: "leader" },
  { keys: "Ctrl+Space, ?", description: "Open this keybind help", group: "leader" },
  { keys: "Ctrl+Space, b", description: "Toggle sidebar collapse", group: "leader" },
  { keys: "Ctrl+Space, s", description: "Open Settings", group: "leader" },
  { keys: "Ctrl+Space, w", description: "Jump to the next project's most recent session", group: "leader" },
  { keys: "Ctrl+Space, W", description: "Open the worktree menu for the current project", group: "leader" },
  { keys: "Ctrl+Space, c", description: "New session in the current project", group: "leader" },
  { keys: "Ctrl+Space, n", description: "Next session in the current workspace", group: "leader" },
  { keys: "Ctrl+Space, p", description: "Previous session in the current workspace", group: "leader" },
  { keys: "Ctrl+Space, 1-9", description: "Jump to the Nth session in the current workspace", group: "leader" },
  { keys: "Ctrl+Space, x", description: "Close the focused pane, file or tab (agents ask first)", group: "leader" },
  { keys: "Ctrl+Space, v", description: "Split pane vertically (new terminal to the right)", group: "leader" },
  { keys: "Ctrl+Space, _", description: "Split pane horizontally (new terminal below)", group: "leader" },
  { keys: "Ctrl+Space, z", description: "Maximize / restore the focused pane", group: "leader" },
  { keys: "Ctrl+Space, h/j/k/l", description: "Focus the pane to the left/below/above/right", group: "leader" },
  { keys: "Ctrl+Space, o", description: "Cycle focus to the next pane", group: "leader" },
  { keys: "Ctrl+Space, }", description: "Swap the focused pane with the next one", group: "leader" },
  {
    keys: "Ctrl+Space, H/J/K/L",
    description: "Swap the focused pane with its neighbour left/below/above/right",
    group: "leader",
  },
  { keys: "Ctrl+Space, +", description: "Grow the focused pane", group: "leader" },
  { keys: "Ctrl+Space, -", description: "Shrink the focused pane", group: "leader" },
  {
    keys: "Ctrl+Space, r, then h/j/k/l…",
    description: "Resize mode: repeated h/j/k/l resizes the focused pane (Esc or timeout exits)",
    group: "leader",
  },
  ];
}

// ---------------------------------------------------------------------------
// Focus guard
// ---------------------------------------------------------------------------

function isEditableTarget(target: EventTarget | null, exceptPanes = false): boolean {
  if (!(target instanceof Element)) return false;
  if (exceptPanes && target.closest('.xterm, [data-testid="workspace-file-editor"]')) return false;
  return target.closest('input, textarea, [contenteditable=""], [contenteditable="true"], .xterm') != null;
}

function inTerminal(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(".xterm") != null;
}

/** True while the leader or resize mode waits for its next key. */
let chordPending = false;

/** xterm's custom key handler (attached by terminalSearch.ts for every
 * terminal). Returns false for keys the PTY must not see: the leader chord,
 * every direct shortcut, and Cmd combinations, which belong to the app as in
 * Ghostty (copy, paste, find, Navigator; the browser default still runs).
 * Without the Cmd rule the kitty protocol would encode them as CSI u.
 * Everything else, Ctrl/Shift+Enter included, is xterm's to encode; the kitty
 * keyboard protocol (xtermSetup.ts) lets CLIs tell those apart as they do in
 * Ghostty. */
export function terminalKeyHandler(e: KeyboardEvent): boolean {
  if (e.metaKey) return false;
  if (e.type !== "keydown") return true;
  if (chordPending) return false;
  if (shortcutFor(e, true)) return false;
  return !(e.ctrlKey && !e.altKey && (e.code === "Space" || e.key === " "));
}

// ---------------------------------------------------------------------------
// Session-jump helpers (read the store directly — this module has no React
// component of its own, so there's nothing to subscribe/re-render)
// ---------------------------------------------------------------------------

/** Jump to the Nth (1-indexed) tab of the strip, in the order it shows (sessions
 * and open files alike); past the end (Infinity) is the last tab. */
function jumpToNthWorkspaceTab(n: number): void {
  const { tabs, activeId } = currentTabs();
  const target = tabs[Math.min(n, tabs.length) - 1];
  if (target && target.id !== activeId) activateTab(target);
}

/** Next/previous tab of the strip, wrapping. */
function switchTabRelative(dir: 1 | -1): void {
  const { tabs, activeId } = currentTabs();
  if (tabs.length < 2) return;
  const idx = tabs.findIndex((tab) => tab.id === activeId);
  const next = tabs[((idx === -1 ? 0 : idx) + dir + tabs.length) % tabs.length];
  if (next && next.id !== activeId) activateTab(next);
}

/**
 * Workspace picker (leader,w). herdr's `prefix+w` opens a full interactive
 * workspace switcher; the herdr-parity plan explicitly leaves the web
 * equivalent to "the simplest reasonable interpretation... pick one,
 * document it". This implementation: cycle directly to the next known
 * project (grouped by (hostId,cwd), same grouping Sidebar/TabBar use),
 * ordered by most recent activity across *all* hosts, and switch straight
 * to that project's most-recently-created session — no intermediate picker
 * UI. It's a fast "next workspace" shortcut; fuzzy-finding a specific
 * session/project by name is already covered by leader,g / Ctrl+K's
 * Navigator, so a second picker UI would be redundant.
 */
function jumpToNextProject(): void {
  const state = usePerchStore.getState();
  const groups = new Map<string, { sessions: typeof state.sessions; newestAt: number }>();
  for (const s of state.sessions) {
    const hostId = s.hostId ?? "local";
    const cwd = s.cwd ?? "(unknown)";
    const key = `${hostId}:${cwd}`;
    let g = groups.get(key);
    if (!g) {
      g = { sessions: [], newestAt: 0 };
      groups.set(key, g);
    }
    g.sessions.push(s);
    if (s.createdAt > g.newestAt) g.newestAt = s.createdAt;
  }
  if (groups.size < 2) return;
  for (const g of groups.values()) g.sessions.sort((a, b) => b.createdAt - a.createdAt);
  const ordered = [...groups.entries()].sort((a, b) => b[1].newestAt - a[1].newestAt);

  const current = effectiveActiveProject(state);
  const currentKey = current ? `${current.hostId}:${current.cwd}` : null;
  const idx = ordered.findIndex(([key]) => key === currentKey);
  const nextIdx = idx === -1 ? 0 : (idx + 1) % ordered.length;
  const target = ordered[nextIdx]?.[1].sessions[0];
  if (target && target.id !== state.sessionId) state.switchSession(target.id);
}

function newSessionInCurrentProject(): void {
  const state = usePerchStore.getState();
  const project = effectiveActiveProject(state);
  const hostId = project?.hostId ?? state.activeHostId;
  const cwd = project?.cwd ?? (hostId === "local" ? state.status?.cwd : undefined);
  state.createSessionOnHost(hostId, cwd);
}

/** `${hostId}:${repoPath}`: the key the sidebar's `WorktreeMenu` for the
 * checkout on screen answers to. A linked worktree resolves to its project's
 * main repo, so the menu opens from any nest. */
function activeRepoKey(): string | null {
  const state = usePerchStore.getState();
  const workspace = effectiveWorkspace(state);
  const owner = workspace && state.workspaceProjects.find((project) => project.id === workspace.projectId);
  if (owner?.repoPath) return `${owner.hostId}:${owner.repoPath}`;
  const project = effectiveActiveProject(state);
  const hostId = project?.hostId ?? state.activeHostId;
  const cwd = project?.cwd ?? (hostId === "local" ? state.status?.cwd : undefined);
  return cwd ? `${hostId}:${cwd}` : null;
}

/**
 * Worktree menu for the active project (leader,W; with `create`, Cmd+N opens
 * it on the create form). The request is consumed by that project's
 * `WorktreeMenu` in the sidebar (see `worktreeMenuRequest` in the store); a
 * folder that is not a git repo has no menu, so the request is ignored.
 */
function openWorktreeMenuForActiveProject(create = false): void {
  const key = activeRepoKey();
  if (key) withSidebar(() => usePerchStore.getState().requestWorktreeMenu(key, undefined, create));
}

/** Cmd+W: the open file or review, else a split's focused terminal pane,
 * else the session's tab (the same end as its ×). */
function closeCurrent(): void {
  const files = useFileTabs.getState();
  if (files.active) return files.close(files.active);
  if (controller()?.closeActiveTerminalPanel()) return;
  const { sessionId } = usePerchStore.getState();
  if (sessionId) requestCloseSession(sessionId);
}

// ---------------------------------------------------------------------------
// Chord action table — the letter pressed after the Ctrl+Space leader
// ---------------------------------------------------------------------------

const CHORD_ACTIONS: Record<string, (handlers: LeaderKeyHandlers) => void> = {
  g: (h) => h.openNavigator(),
  c: () => newSessionInCurrentProject(),
  n: () => switchTabRelative(1),
  p: () => switchTabRelative(-1),
  x: () => closeCurrent(),
  v: () => getDockviewController()?.addTerminalPanel("right"),
  // Wave 2 item 8: split-horizontal moved from leader,- to leader,_ (shift+-)
  // to free up leader,-/leader,+ for the new grow/shrink resize chords below
  // — a plain minus/equals pair mirrors how resize is usually spoken about
  // ("shrink"/"grow"), and `s` was already taken by Settings so `_`/`-`/`+`
  // (all reachable off the same physical key) was the cleanest free slot.
  "_": () => getDockviewController()?.addTerminalPanel("below"),
  z: () => getDockviewController()?.toggleMaximizeActive(),
  b: () => usePerchStore.getState().toggleSidebar(),
  s: () => usePerchStore.getState().setSettingsOpen(true),
  "?": (h) => h.openKeybindHelp(),
  w: () => jumpToNextProject(),
  // Capital W (shift+w) — deliberately a *separate* binding from lowercase w,
  // resolved by the exact-key lookup in `handleKeyDown` below.
  W: () => openWorktreeMenuForActiveProject(),
  // Directional pane focus (Wave 2 item 8) — mirrors vim/tmux h/j/k/l.
  h: () => getDockviewController()?.focusPaneDirection("left"),
  j: () => getDockviewController()?.focusPaneDirection("down"),
  k: () => getDockviewController()?.focusPaneDirection("up"),
  l: () => getDockviewController()?.focusPaneDirection("right"),
  o: () => getDockviewController()?.cycleToNextPane(),
  "}": () => getDockviewController()?.swapActivePaneWithNext(),
  "+": () => getDockviewController()?.growActivePane(),
  "-": () => getDockviewController()?.shrinkActivePane(),
  // Directional pane SWAP (capital H/J/K/L, i.e. shift+h/j/k/l) — deliberately
  // separate bindings from lowercase h/j/k/l's directional FOCUS above,
  // resolved by the same exact-key-first lookup in `handleKeyDown` that
  // already keeps leader,W distinct from leader,w. No collision: object keys
  // are case-sensitive, and `e.key` for Shift+H is "H", not "h".
  H: () => getDockviewController()?.swapPaneDirection("left"),
  J: () => getDockviewController()?.swapPaneDirection("down"),
  K: () => getDockviewController()?.swapPaneDirection("up"),
  L: () => getDockviewController()?.swapPaneDirection("right"),
};
for (let i = 1; i <= 9; i++) {
  CHORD_ACTIONS[String(i)] = () => jumpToNthWorkspaceTab(i);
}

// ---------------------------------------------------------------------------
// Resize mode (leader,r) — herdr lets repeated h/j/k/l resize the focused
// pane without re-pressing the leader for each press. `r` is deliberately
// NOT a CHORD_ACTIONS entry: entering resize mode has to arm a *second*,
// independent timer alongside the leader's own (see `useLeaderKey` below),
// which the flat CHORD_ACTIONS table (single no-args-beyond-handlers call)
// has no way to express, so it's special-cased in `handleKeyDown` instead.
// h/j/k/l while armed call the same grow/shrink helpers leader,+/- already
// use (not a new directional-resize primitive) — direction is just a mnemonic
// (left/up shrink, right/down grow), since a single split only ever has one
// resizable axis at a time regardless of which of the four keys is pressed.
// ---------------------------------------------------------------------------

const RESIZE_KEYS: Record<string, (c: NonNullable<ReturnType<typeof getDockviewController>>) => void> = {
  h: (c) => c.shrinkActivePane(),
  j: (c) => c.shrinkActivePane(),
  k: (c) => c.growActivePane(),
  l: (c) => c.growActivePane(),
};

// ---------------------------------------------------------------------------
// useLeaderKey — the single global keydown listener
// ---------------------------------------------------------------------------

/** Mounted once from `App.tsx`. Owns the global keydown listener for the
 * leader chord, `Ctrl/Cmd+K`, and plain `?`. Overlay open/close state lives
 * in `App.tsx` (mirroring how it already owns the dockview `apiRef`) — this
 * hook just calls back into it via `handlers`. */
export function useLeaderKey(handlers: LeaderKeyHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const armedRef = { current: false };
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Resize mode's own arm/disarm/timer, mirroring the leader's pattern
    // above exactly (same `LEADER_TIMEOUT_MS`, same arm-resets-the-timer
    // shape) rather than inventing a second timing mechanism.
    const resizeArmedRef = { current: false };
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    // Captured at *arm* time, not at effect-mount time: nothing else writes
    // `document.title` today, but if anything ever does (an unread count, the
    // active session name), a mount-time capture would restore a stale title
    // on disarm and silently clobber it.
    let baseTitle = document.title;

    function disarm() {
      armedRef.current = false;
      chordPending = resizeArmedRef.current;
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function arm() {
      armedRef.current = true;
      chordPending = true;
      if (timer != null) clearTimeout(timer);
      timer = setTimeout(disarm, LEADER_TIMEOUT_MS);
    }

    // Resize mode has no dedicated chip/overlay in this codebase — the
    // leader chord itself has no visual affordance either (arming it is
    // silent; only the follow-up letter's *effect* is visible), so this
    // mirrors that by staying out of the DOM entirely. The one concession is
    // the document title, the cheapest possible "you are in a mode" signal
    // that needs no new CSS/markup (this file may only touch keybinds.ts,
    // dockviewController.ts, and KeybindHelp.tsx).
    function disarmResize() {
      if (!resizeArmedRef.current) return;
      resizeArmedRef.current = false;
      chordPending = armedRef.current;
      if (resizeTimer != null) {
        clearTimeout(resizeTimer);
        resizeTimer = null;
      }
      document.title = baseTitle;
    }

    function armResize() {
      // Capture the title only on a fresh arm. Re-arms (every h/j/k/l press
      // refreshes the timeout) must not re-capture, or the prefixed title
      // would become the new base and compound on each keystroke.
      if (!resizeArmedRef.current) {
        baseTitle = document.title.replace(/^\[resize\] /, "");
      }
      resizeArmedRef.current = true;
      chordPending = true;
      document.title = `[resize] ${baseTitle}`;
      if (resizeTimer != null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(disarmResize, LEADER_TIMEOUT_MS);
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Resize mode: while armed, h/j/k/l resize (and re-arm the timeout so
      // a steady stream of presses keeps working); Escape or any other
      // non-modifier key exits; typing into an editable element always
      // exits without touching the keystroke (same invariant as the leader
      // chord — never intercept real typing).
      if (resizeArmedRef.current) {
        if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;
        if (isEditableTarget(e.target, true)) {
          disarmResize();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          disarmResize();
          return;
        }
        const controller = getDockviewController();
        const action = RESIZE_KEYS[e.key.toLowerCase()];
        if (action && controller) {
          e.preventDefault();
          action(controller);
          armResize();
        } else {
          disarmResize();
        }
        return;
      }

      // A chord is in progress — the next non-modifier keydown resolves it
      // (or is silently dropped if it doesn't match any bound letter).
      if (armedRef.current) {
        if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;
        disarm();
        // leader,r enters resize mode instead of going through the generic
        // CHORD_ACTIONS dispatch below (see the "Resize mode" comment above
        // CHORD_ACTIONS for why it can't just be a table entry).
        if (e.key === "r") {
          e.preventDefault();
          armResize();
          return;
        }
        // Exact-key lookup first so shifted bindings (leader,W → worktree
        // menu, leader,H/J/K/L → directional swap) stay distinct from their
        // lowercase counterparts (leader,w → next project, leader,h/j/k/l →
        // directional focus); everything else still resolves
        // case-insensitively.
        const action = CHORD_ACTIONS[e.key] ?? CHORD_ACTIONS[e.key.toLowerCase()];
        if (action) {
          e.preventDefault();
          action(handlersRef.current);
        }
        return;
      }

      // Direct shortcuts work from anywhere, inputs included, like a browser's.
      // `terminal` ones belong to the focused xterm (terminalSearch.ts); an
      // `outsideTerminal` one (Ctrl+K) is the PTY's inside a terminal.
      const direct = e.isComposing ? undefined : shortcutFor(e, inTerminal(e.target));
      if (direct && direct.scope !== "terminal") {
        e.preventDefault();
        if (!e.repeat) direct.run(handlersRef.current);
        return;
      }

      const editable = isEditableTarget(e.target);

      // Ctrl+Space -> arm the leader. Forms keep it; terminal/file panes don't.
      if (e.ctrlKey && !e.metaKey && !e.altKey && (e.code === "Space" || e.key === " ")) {
        if (isEditableTarget(e.target, true)) return;
        e.preventDefault();
        arm();
        return;
      }

      // Plain '?' (no modifiers) -> keybind help, outside inputs only.
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "?") {
        if (editable) return;
        e.preventDefault();
        handlersRef.current.openKeybindHelp();
      }
    }

    // Space activates a focused button on keyup too. The leader must not
    // re-click the tab left focused after a keyboard-only tab switch.
    function handleKeyUp(e: KeyboardEvent) {
      if (e.ctrlKey && !e.metaKey && !e.altKey && (e.code === "Space" || e.key === " ") &&
          !isEditableTarget(e.target, true)) e.preventDefault();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      disarm();
      disarmResize();
    };
  }, []);
}
