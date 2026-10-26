/**
 * Settings-resolved application command registry. Global commands, local editor/
 * terminal/Navigator/folder commands, leader follow-ups and resize mode all use
 * effectiveSpec(). Defaults are declarations here, never independent dispatch maps.
 *
 * The capture listener resolves the full focus context and claims only global
 * winners, before CodeMirror or xterm can also act. Local winners pass to their
 * owner. Text editing, arrows, Enter/Tab and Escape remain native interactions.
 * Explicit global Ctrl/Alt overrides can claim terminal keys; unclaimed input
 * stays with xterm and the PTY. Leader/resize modes cancel on unmatched input:
 * unclaimed text passes through; another app command cannot run behind a cancel.
 */
import { useEffect, useRef, useState } from "react";
import { usePerchStore, effectiveActiveProject, effectiveWorkspace } from "./store";
import { activateTab, currentTabs } from "./workspaceTabs";
import { getPaneController as getDockviewController, splitActiveTab } from "./tiledPanes";
import { useFileTabs } from "./fileTabs";
import { jumpToNest, newScratchpad, reopenClosedTab, stepNest } from "./workspaceNav";
import { requestCloseSession } from "./closeGuard";
import { requestAddProject, requestNewTab, withSidebar } from "./appEvents";
import { browserOwner, closeBrowserById, useDrawerBrowsers } from "./drawerBrowsers";
import { fileTabKey } from "./fileTabs";
import { nativeBrowser } from "./browserNative";
import { tauriInvoke } from "./links";
import { zoomIn, zoomOut, zoomReset } from "./zoom";
import { openNextAttention } from "./attention";
import { IS_MAC, comboMatches, formatCombo, keyLabel, normalizeCombo, parseCombo, validCombo } from "./keyCombo";

export const LEADER_TIMEOUT_MS = 1500;

// ---------------------------------------------------------------------------
// Shortcut table (also consumed by KeybindHelp.tsx and Settings > Keyboard)
// ---------------------------------------------------------------------------

export type KeybindGroup = "global" | "tabs" | "nests" | "panes" | "terminal" | "leader" | "resize" | "editor" | "navigator" | "directory";
export type ShortcutScope = "terminal" | "outsideTerminal" | "pane" | "outsideEditable" | "leader" | "resize" | "editor" | "navigator" | "directory";

export interface KeybindEntry {
  keys: string;
  description: string;
  group: KeybindGroup;
}

export interface LeaderKeyHandlers {
  openNavigator: () => void;
  openKeybindHelp: () => void;
  toggleDrawer: () => void;
  armLeader?: () => void;
  armResize?: () => void;
}

interface ShortcutRange {
  id: string;
  noun: string;
  label: string;
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
  scope?: ShortcutScope;
  /** An alias invokes the same command, including explicit native page targeting. */
  command?: string;
  nextMode?: "leader" | "resize";
  /** The help lists a range (jump to tab 1…8) as one row while none of its members is customised. */
  range?: ShortcutRange;
}

export const SHORTCUTS: Shortcut[] = [];

function shortcut(
  id: string,
  group: KeybindGroup,
  keys: string | [string, string | null],
  description: string,
  run: Shortcut["run"],
  extra: Pick<Shortcut, "scope" | "range" | "command" | "nextMode"> = {},
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
shortcut("global.needsYou", "global", ["cmd+shift+u", "alt+shift+u"], "Open the next agent that needs you (else the Needs You panel)", () => openNextAttention());

// Zoom the tab area (terminals, files, browser pages): VS Code's keys, ⌘ on a Mac, Ctrl elsewhere
shortcut("view.zoomIn", "global", ["cmd+=", "ctrl+="], "Zoom in", () => zoomIn());
shortcut("view.zoomInShift", "global", ["cmd+shift+=", "ctrl+shift+="], "Zoom in (the + key)", () => zoomIn());
shortcut("view.zoomOut", "global", ["cmd+-", "ctrl+-"], "Zoom out", () => zoomOut());
shortcut("view.zoomReset", "global", ["cmd+0", "ctrl+0"], "Reset zoom", () => zoomReset());

// Tabs (browser style)
shortcut("tabs.new", "tabs", "mod+t", "New tab (pick a harness) in this nest", () => requestNewTab());
shortcut("tabs.close", "tabs", "mod+w", "Close the focused pane, file or tab (agents ask first)", () => closeCurrent());
shortcut("tabs.reopen", "tabs", ["cmd+shift+t", "alt+shift+t"], "Reopen the last closed tab or file", () => reopenClosedTab());
shortcut("tabs.keepOpen", "tabs", ["cmd+alt+enter", "ctrl+alt+enter"], "Keep the preview tab open (make it a regular tab)", () => {
  const { active, pin } = useFileTabs.getState();
  if (active) pin(active);
});
const TAB_JUMPS: ShortcutRange = { id: "tabs.jump", noun: "tab", label: "1…8" };
for (let i = 1; i <= 8; i++) {
  shortcut(`tabs.jump${i}`, "tabs", [`cmd+${i}`, `alt+${i}`], `Jump to tab ${i}`, () => jumpToNthWorkspaceTab(i), { range: TAB_JUMPS });
}
shortcut("tabs.last", "tabs", ["cmd+9", "alt+9"], "Jump to the last tab", () => jumpToNthWorkspaceTab(Infinity));
shortcut("tabs.next", "tabs", ["cmd+shift+]", "ctrl+pagedown"], "Next tab", () => switchTabRelative(1));
shortcut("tabs.prev", "tabs", ["cmd+shift+[", "ctrl+pageup"], "Previous tab", () => switchTabRelative(-1));

// Nests and birdhouses (workspaces and projects)
shortcut("nests.prev", "nests", ["ctrl+shift+up", "alt+shift+up"], "Previous nest", () => stepNest(-1));
shortcut("nests.next", "nests", ["ctrl+shift+down", "alt+shift+down"], "Next nest", () => stepNest(1));
const NEST_JUMPS: ShortcutRange = { id: "nests.jump", noun: "nest", label: "1…9" };
for (let i = 1; i <= 9; i++) {
  shortcut(`nests.jump${i}`, "nests", [`ctrl+shift+${i}`, `alt+shift+${i}`], `Jump to nest ${i}`, () => jumpToNest(i), { range: NEST_JUMPS });
}
shortcut("nests.new", "nests", "mod+n", "New nest (worktree)", () => openWorktreeMenuForActiveProject(true));
shortcut("nests.addBirdhouse", "nests", "mod+o", "Add birdhouse (project)", () => requestAddProject());
shortcut("nests.scratchpad", "nests", ["cmd+shift+n", null], "New scratchpad chat", () => newScratchpad());

// Splits and panes (iTerm2/Ghostty)
shortcut("panes.splitRight", "panes", "mod+d", "Split right", () => splitActiveTab("right"));
shortcut("panes.splitDown", "panes", ["cmd+shift+d", "alt+shift+d"], "Split down", () => splitActiveTab("below"));
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

// Scoped commands are executed by their owner, not by the global listener.
for (const [id, keys, description] of [
  ["editor.save", ["cmd+s", "ctrl+s"], "Save file"],
  ["editor.find", ["cmd+f", "ctrl+f"], "Find in file"],
  ["editor.replace", ["cmd+alt+f", "ctrl+h"], "Replace in file"],
  ["editor.replaceAlt", ["cmd+shift+f", null], "Replace in file (alternate)"],
  ["editor.findNext", "f3", "Next file match (while Find is open)"],
  ["editor.findPrevious", "shift+f3", "Previous file match (while Find is open)"],
  ["editor.findNextAlt", ["cmd+g", null], "Next file match (alternate)"],
  ["editor.findPreviousAlt", ["cmd+shift+g", null], "Previous file match (alternate)"],
  ["editor.gotoLine", "ctrl+g", "Go to line"],
] as const) shortcut(id, "editor", typeof keys === "string" ? keys : [...keys], description, noop, { scope: "editor" });
for (const [id, key, description] of [
  ["navigator.next", "ctrl+j", "Next Navigator result"],
  ["navigator.nextAlt", "ctrl+n", "Next Navigator result (alternate)"],
  ["navigator.previous", "ctrl+k", "Previous Navigator result"],
  ["navigator.previousAlt", "ctrl+p", "Previous Navigator result (alternate)"],
  ["directory.use", "cmd+enter", "Use this folder"],
  ["directory.useAlt", "ctrl+enter", "Use this folder (alternate)"],
] as const) shortcut(id, id.startsWith("navigator.") ? "navigator" : "directory", key, description, noop, { scope: id.startsWith("navigator.") ? "navigator" : "directory" });
shortcut("global.helpPlain", "global", "shift+/", "Open keybind help (outside inputs)", (h) => h.openKeybindHelp(), { scope: "outsideEditable" });

shortcut("leader.arm", "leader", "ctrl+space", "Leader prefix (then a follow-up key)", (h) => h.armLeader?.(), { scope: "pane", nextMode: "leader" });
for (const [id, key, command] of [
  ["navigator", "g", "global.navigator"], ["help", "shift+/", "global.help"],
  ["sidebar", "b", "global.sidebar"], ["settings", "s", "global.settings"],
  ["nextTab", "n", "tabs.next"], ["previousTab", "p", "tabs.prev"], ["close", "x", "tabs.close"],
  ["splitRight", "v", "panes.splitRight"], ["splitDown", "shift+-", "panes.splitDown"],
  ["zoom", "z", "panes.zoom"], ["nextPane", "o", "panes.next"],
  ...(["left", "down", "up", "right"] as const).map((dir, i) => [`focus.${dir}`, ["h", "j", "k", "l"][i]!, `panes.focus.${dir}`] as const),
] as const) {
  const action = SHORTCUTS.find((s) => s.id === command)!;
  shortcut(`leader.${id}`, "leader", key, action.description, action.run, { scope: "leader", command });
}
for (let i = 1; i <= 9; i++) shortcut(`leader.jump${i}`, "leader", String(i), `Jump to tab ${i}`, () => jumpToNthWorkspaceTab(i), { scope: "leader", range: { id: "leader.jump", noun: "tab", label: "1…9" } });
shortcut("leader.nextProject", "leader", "w", "Next project's most recent session", jumpToNextProject, { scope: "leader" });
shortcut("leader.worktree", "leader", "shift+w", "Open this project's worktree menu", () => openWorktreeMenuForActiveProject(), { scope: "leader" });
shortcut("leader.newSession", "leader", "c", "New session in this project", newSessionInCurrentProject, { scope: "leader" });
shortcut("leader.swapNext", "leader", "shift+]", "Swap with the next pane", () => controller()?.swapActivePaneWithNext(), { scope: "leader" });
shortcut("leader.grow", "leader", "shift+=", "Grow the focused pane", () => controller()?.growActivePane(), { scope: "leader" });
shortcut("leader.shrink", "leader", "-", "Shrink the focused pane", () => controller()?.shrinkActivePane(), { scope: "leader" });
for (const [i, dir] of (["left", "down", "up", "right"] as const).entries()) {
  shortcut(`leader.swap.${dir}`, "leader", `shift+${["h", "j", "k", "l"][i]}`, `Swap pane ${dir}`, () => controller()?.swapPaneDirection(dir), { scope: "leader" });
  shortcut(`resize.${dir}`, "resize", ["h", "j", "k", "l"][i]!, `Resize pane ${dir} (${i < 2 ? "shrink" : "grow"})`, () => i < 2 ? controller()?.shrinkActivePane() : controller()?.growActivePane(), { scope: "resize", nextMode: "resize" });
}
shortcut("leader.resize", "leader", "r", "Enter resize mode (Escape or timeout exits)", (h) => h.armResize?.(), { scope: "leader", nextMode: "resize" });

/** The user's overrides (action id → combo, "" = none) from Settings > Keyboard. */
function overrides(): Record<string, string> {
  return usePerchStore.getState().settings?.keybindings ?? {};
}

/** The combo `s` is bound to on this platform: the user's choice, else the default; `null` = none. */
export function effectiveSpec(s: Shortcut, mac = IS_MAC): string | null {
  const own = overrides()[s.id];
  if (own !== undefined) {
    if (!own || !validCombo(own)) return null;
    const c = parseCombo(own, mac);
    return plainShortcutAllowed(s) || c.cmd || c.ctrl || c.alt || /^F\d+$/.test(c.code) ? own : null;
  }
  return s.keys[mac ? 0 : 1] || null;
}

/** The shortcut `e` triggers on this platform, if any. `inTerm`: the key went to a focused terminal, where
 * `terminal` shortcuts apply and `outsideTerminal` ones do not (the PTY keeps their key). */
export type ShortcutContext = Exclude<ShortcutScope, "outsideTerminal" | "pane" | "outsideEditable"> | "global";
export function shortcutContext(target: EventTarget | null): ShortcutContext {
  if (typeof Element === "undefined" || !(target instanceof Element)) return "global";
  if (target.closest('[data-testid="navigator"]')) return "navigator";
  if (target.closest('[data-testid="dir-browser"]')) return "directory";
  if (target.closest(".cm-editor")) return "editor";
  return target.closest(".xterm") ? "terminal" : "global";
}
export const isGlobalShortcut = (s: Shortcut) => !s.scope || s.scope === "pane" || s.scope === "outsideTerminal" || s.scope === "outsideEditable";
export const plainShortcutAllowed = (s: Shortcut) => s.scope === "leader" || s.scope === "resize" || s.scope === "outsideEditable";
const contexts = ["global", "terminal", "editor", "navigator", "directory", "leader", "resize"] as const;
export function shortcutAppliesTo(s: Shortcut, context: typeof contexts[number]): boolean {
  if (context === "leader" || context === "resize") return s.scope === context;
  if (!s.scope || s.scope === "pane") return true;
  if (s.scope === "outsideTerminal") return context !== "terminal" && context !== "navigator";
  if (s.scope === "outsideEditable") return context === "global";
  return s.scope === context;
}
export function shortcutFor(e: KeyboardEvent, context: boolean | ShortcutContext = shortcutContext(e.target), mac = IS_MAC): Shortcut | undefined {
  if (e.isComposing || e.keyCode === 229) return undefined;
  const ctx = typeof context === "boolean" ? context ? "terminal" : "global" : context;
  const candidates = SHORTCUTS.filter((s) => shortcutAppliesTo(s, ctx) &&
    !(s.scope === "pane" && isEditableTarget(e.target, true)) &&
    !(s.scope === "outsideEditable" && isEditableTarget(e.target)));
  // Capture and local handlers use the same winner. A modal/editor binding cannot be
  // swallowed by the capture listener on its way to the owning component.
  return [ ...candidates.filter((s) => s.scope === ctx), ...candidates.filter((s) => s.scope !== ctx) ].find((s) => {
    const spec = effectiveSpec(s, mac);
    return spec !== null && comboMatches(e, parseCombo(spec, mac));
  });
}

type HeldModifiers = Pick<KeyboardEvent, "ctrlKey" | "shiftKey" | "altKey" | "metaKey">;

/** Labels for the nest-jump keys whose modifiers are currently held. */
export function nestShortcutHints(held: HeldModifiers | null, mac = IS_MAC): (string | null)[] {
  return SHORTCUTS.filter((s) => s.range === NEST_JUMPS).map((s) => {
    const spec = effectiveSpec(s, mac);
    if (!held || !spec || !(held.ctrlKey || held.shiftKey || held.altKey || held.metaKey)) return null;
    const combo = parseCombo(spec, mac);
    return held.ctrlKey === combo.ctrl && held.shiftKey === combo.shift &&
      held.altKey === combo.alt && held.metaKey === combo.cmd ? keyLabel(spec) : null;
  });
}

/** Passive hints only: modifier presses still belong to the focused terminal/input. */
export function useNestShortcutHints(): (string | null)[] {
  const [held, setHeld] = useState<HeldModifiers | null>(null);
  usePerchStore((state) => state.settings?.keybindings);
  useEffect(() => {
    const update = (event: KeyboardEvent) => {
      const next = { ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey, metaKey: event.metaKey };
      setHeld((current) => current?.ctrlKey === next.ctrlKey && current.shiftKey === next.shiftKey &&
        current.altKey === next.altKey && current.metaKey === next.metaKey ? current : next);
    };
    const clear = () => setHeld(null);
    const visibility = () => { if (document.hidden) clear(); };
    document.addEventListener("keydown", update);
    document.addEventListener("keyup", update);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("keydown", update);
      document.removeEventListener("keyup", update);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return nestShortcutHints(held);
}

/** Two shortcuts can fire on the same keystroke unless one is terminal-only and the other terminal-free. */
const overlaps = (a: Shortcut, b: Shortcut) => contexts.some((ctx) => shortcutAppliesTo(a, ctx) && shortcutAppliesTo(b, ctx));

/** The other shortcuts already on `spec` that would fire together with `id` (for the recorder to move). */
export function shortcutsBoundTo(spec: string, id: string, mac = IS_MAC): Shortcut[] {
  const want = normalizeCombo(spec, mac);
  const mine = SHORTCUTS.find((s) => s.id === id);
  return SHORTCUTS.filter((s) => {
    if (s.id === id || (mine && !overlaps(mine, s))) return false;
    const other = effectiveSpec(s, mac);
    return other !== null && normalizeCombo(other, mac) === want;
  });
}

/** The current binding, including the effective prefix for modal follow-up keys. */
export function shortcutLabel(id: string, mac = IS_MAC): string | null {
  const s = SHORTCUTS.find((s) => s.id === id);
  const spec = s && effectiveSpec(s, mac);
  if (!s || !spec) return null;
  const prefix = s.scope === "leader" ? shortcutLabel("leader.arm", mac) : s.scope === "resize" ? shortcutLabel("leader.resize", mac) : null;
  if ((s.scope === "leader" || s.scope === "resize") && !prefix) return null;
  return [prefix, formatCombo(spec, mac)].filter(Boolean).join(", ");
}
export function keybindEntries(mac = IS_MAC): KeybindEntry[] {
  const custom = overrides(), seen = new Set<string>();
  return [...SHORTCUTS.flatMap((s): KeybindEntry[] => {
    const spec = effectiveSpec(s, mac), label = shortcutLabel(s.id, mac);
    if (!spec || !label) return [];
    if (s.range && !SHORTCUTS.some((other) => other.range?.id === s.range!.id && custom[other.id] !== undefined)) {
      if (seen.has(s.range.id)) return [];
      seen.add(s.range.id);
      return [{ keys: label.slice(0, -keyLabel(spec).length) + s.range.label, description: `Jump to ${s.range.noun} ${s.range.label}`, group: s.group }];
    }
    return [{ keys: label, description: s.description, group: s.group }];
  }), { keys: "Esc", description: "Close any open overlay or keyboard mode", group: "global" },
    { keys: "↑ / ↓", description: "Move selection in Navigator", group: "navigator" },
    { keys: mac ? "⌘C / ⌘V" : "Ctrl+Shift+C / V", description: "Copy / paste", group: "terminal" }];
}

// ---------------------------------------------------------------------------
// Focus guard
// ---------------------------------------------------------------------------

function isEditableTarget(target: EventTarget | null, exceptPanes = false): boolean {
  if (!(target instanceof Element)) return false;
  if (exceptPanes && target.closest('.xterm, [data-testid="workspace-file-editor"]')) return false;
  return target.closest('input, textarea, [contenteditable=""], [contenteditable="true"], .xterm') != null;
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
  if (e.isComposing || e.keyCode === 229) return true;
  if (e.metaKey) return false;
  if (e.type !== "keydown") return true;
  // macOS turns Ctrl+Enter in a text control into the OS context menu unless the keydown is
  // cancelled; xterm only cancels keys it encodes itself, so kitty-mode Ctrl+Enter leaked it.
  if (e.ctrlKey && e.key === "Enter") e.preventDefault();
  if (chordPending) return false;
  return !shortcutFor(e, true);
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

/** Native menu activation, including when the main view (or a blank browser) has focus. */
export const CLOSE_TAB_EVENT = "perch:close-tab";
export const NATIVE_COMMAND_EVENT = "perch:command";
/** Compiled from the same settings-resolved registry, never a native list of default keys. */
export type NativeBinding = [id: string, code: string, letter: string | null, mods: number];
export function nativeShortcutBindings(mac = IS_MAC): NativeBinding[] {
  return SHORTCUTS.flatMap((s) => {
    if (s.scope && s.scope !== "outsideTerminal") return [];
    const spec = effectiveSpec(s, mac);
    if (!spec) return [];
    const c = parseCombo(spec, mac);
    return [[s.id, c.code, c.letter ?? null, +c.cmd | (+c.ctrl << 1) | (+c.alt << 2) | (+c.shift << 3)]];
  });
}

/** Universal app-command entry point for DOM keys, native pages and command/menu callers. */
export function dispatchShortcut(id: string, handlers: LeaderKeyHandlers, pageId?: string, focusPage = false): boolean {
  const shortcut = SHORTCUTS.find((s) => s.id === id);
  if (!shortcut) return false;
  if (pageId) {
    const owner = browserOwner(pageId);
    if (!owner) return false;
    if ((shortcut.command ?? id) === "tabs.close") return closeBrowserById(pageId);
    if (focusPage) {
      if (owner.kind === "tab") activateTab({ id: fileTabKey(owner.tab), kind: "resource", tab: owner.tab });
      else useDrawerBrowsers.getState().select(owner.page.workspaceId, owner.page.id);
    }
  }
  shortcut.run(handlers);
  return true;
}
const closeEpoch = nativeBrowser && IS_MAC ? crypto.randomUUID() : "";
let closeGeneration = 0;
const closeShortcut = SHORTCUTS.find((s) => s.id === "tabs.close")!;

/** Use the same parsed key as the DOM keymap; no second default in Rust. */
function closeAccelerator(spec: string | null): string | null {
  if (!spec) return null;
  const c = parseCombo(spec, true);
  return [c.cmd && "Super", c.ctrl && "Control", c.alt && "Alt", c.shift && "Shift", c.code].filter(Boolean).join("+");
}

/** Cmd+W: the open file or review, else a split's focused terminal pane,
 * else the session's tab (the same end as its ×). */
function closeCurrent(): void {
  const browser = document.activeElement?.closest<HTMLElement>("[data-browser-id]")?.dataset.browserId;
  if (browser) { closeBrowserById(browser); return; }
  const files = useFileTabs.getState();
  if (files.active) return files.close(files.active);
  if (controller()?.closeActiveTerminalPanel()) return;
  const { sessionId } = usePerchStore.getState();
  if (sessionId) requestCloseSession(sessionId);
}

// ---------------------------------------------------------------------------
// useLeaderKey — the single global keydown listener
// ---------------------------------------------------------------------------

/** Mounted once from `App.tsx`. Owns the global keydown listener for the
 * leader chord, `Ctrl/Cmd+K`, and plain `?`. Overlay open/close state lives
 * in `App.tsx` (mirroring how it already owns the dockview `apiRef`) — this
 * hook just calls back into it via `handlers`. */
export function useLeaderKey(handlers: LeaderKeyHandlers): void {
  const modeRef = useRef<{ arm: () => void; resize: () => void; reset: () => void; run: (id: string, pageId?: string, focusPage?: boolean) => void } | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = { ...handlers, armLeader: () => modeRef.current?.arm(), armResize: () => modeRef.current?.resize() };
  const keybindings = usePerchStore((s) => s.settings?.keybindings);
  const spec = effectiveSpec(closeShortcut);
  const settingsOpen = usePerchStore((s) => s.settingsOpen);
  const native = nativeBrowser && IS_MAC;
  const nativeOwnsClose = useRef(false);
  const nativeBinding = useRef<{ accelerator: string | null; generation: number; epoch: string; bindings: NativeBinding[] } | null>(null);
  const menuQueue = useRef(Promise.resolve());

  useEffect(() => {
    if (!native) return;
    // Settings records keys in a capturing DOM listener. Do not let a native equivalent
    // consume them before that recorder (or the existing DOM guards) can see them.
    const accelerator = settingsOpen ? null : closeAccelerator(spec);
    const generation = ++closeGeneration;
    let live = true;
    // A menu event bearing this generation is itself proof that Rust installed it, even if
    // the IPC acknowledgement is still in flight. Older generations cannot execute it.
    const bindings = settingsOpen ? [] : nativeShortcutBindings();
    nativeBinding.current = { accelerator, generation, epoch: closeEpoch, bindings };
    // While configuration is pending, don't run a second DOM close behind the native menu.
    // A rejected configuration restores the original DOM path.
    nativeOwnsClose.current = accelerator !== null;
    menuQueue.current = menuQueue.current
      .then(async () => { await tauriInvoke!("browser_shortcuts", { accelerator, generation, epoch: closeEpoch, bindings }); })
      .catch(() => { if (live) { nativeOwnsClose.current = false; nativeBinding.current = null; } });
    return () => { live = false; };
  }, [native, spec, settingsOpen, keybindings]);

  useEffect(() => {
    let composing = false;
    const compositionStart = () => { composing = true; };
    const compositionEnd = () => { composing = false; };
    const onClose = (event: Event) => {
      const detail: unknown = (event as CustomEvent<unknown>).detail;
      if (!native || !detail || typeof detail !== "object" || !("id" in detail) || !("generation" in detail)) return;
      const binding = nativeBinding.current;
      if (!binding?.accelerator || detail.generation !== binding.generation || !("epoch" in detail) || detail.epoch !== binding.epoch ||
          binding.accelerator !== closeAccelerator(effectiveSpec(closeShortcut)) || typeof detail.id !== "string") return;
      if (!composing && !chordPending) dispatchShortcut("tabs.close", handlersRef.current, detail.id || undefined);
    };
    const onCommand = (event: Event) => {
      const detail: unknown = (event as CustomEvent<unknown>).detail;
      if (!native || !detail || typeof detail !== "object" || !("epoch" in detail) || !("generation" in detail) || !("index" in detail) || !("id" in detail)) return;
      const config = nativeBinding.current;
      if (!config || detail.epoch !== config.epoch || detail.generation !== config.generation || typeof detail.index !== "number" || !Number.isInteger(detail.index) || typeof detail.id !== "string" || !detail.id) return;
      const binding = config.bindings[detail.index];
      if (!binding) return;
      const current = nativeShortcutBindings().find((b) => b[0] === binding[0]);
      if (!current || current.some((part, i) => part !== binding[i])) return;
      modeRef.current?.run(binding[0], detail.id, "focused" in detail && detail.focused === true);
    };
    window.addEventListener(NATIVE_COMMAND_EVENT, onCommand);
    window.addEventListener(CLOSE_TAB_EVENT, onClose);
    window.addEventListener("compositionstart", compositionStart, true);
    window.addEventListener("compositionend", compositionEnd, true);
    window.addEventListener("blur", compositionEnd);
    return () => {
      window.removeEventListener(NATIVE_COMMAND_EVENT, onCommand);
      window.removeEventListener(CLOSE_TAB_EVENT, onClose);
      window.removeEventListener("compositionstart", compositionStart, true);
      window.removeEventListener("compositionend", compositionEnd, true);
      window.removeEventListener("blur", compositionEnd);
    };
  }, [native]);

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

    function reset() { disarm(); disarmResize(); }
    function run(id: string, pageId?: string, focusPage = false) {
      const resize = SHORTCUTS.find((s) => s.id === id)?.scope === "resize";
      disarm();
      if (!resize) disarmResize();
      dispatchShortcut(id, handlersRef.current, pageId, focusPage);
      if (resize) armResize();
    }
    modeRef.current = { arm, resize: armResize, reset, run };
    const claim = (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); };
    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.isComposing || e.keyCode === 229 || ["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
      if (armedRef.current || resizeArmedRef.current) {
        if (isEditableTarget(e.target, true)) { reset(); return; }
        if (e.key === "Escape") { reset(); claim(e); return; }
        const selected = shortcutFor(e, resizeArmedRef.current ? "resize" : "leader");
        if (selected) {
          claim(e);
          if (!e.repeat || selected.scope === "resize") run(selected.id);
        } else {
          // An unmatched key cancels. Ordinary text/editing still reaches its owner, but
          // another app command cannot run behind the cancelled chord (including menus).
          const other = shortcutFor(e);
          if (e.repeat && other?.id === "leader.arm") { claim(e); return; }
          reset();
          if (other) claim(e);
        }
        return;
      }
      const direct = shortcutFor(e);
      if (!direct || !isGlobalShortcut(direct)) return; // Let the resolved local owner receive it.
      if (direct.id === "tabs.close" && nativeOwnsClose.current) { e.stopPropagation(); return; }
      claim(e);
      if (!e.repeat) run(direct.id);
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (shortcutFor(e)?.id === "leader.arm") e.preventDefault();
    }

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", reset);
    document.addEventListener("pointerdown", reset, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", reset);
      document.removeEventListener("pointerdown", reset, true);
      reset();
      modeRef.current = null;
    };
  }, []);
  useEffect(() => { modeRef.current?.reset(); }, [keybindings]);
}
