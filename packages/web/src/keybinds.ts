/**
 * keybinds.ts — Phase 4 (Keybindings + Navigator) default web keymap.
 *
 * herdr's default keymap uses a `prefix` key (`ctrl+b` by default) followed
 * by a second keystroke ("chord"). Browsers reserve too many single-key
 * combinations for that model to translate directly (`ctrl+b` = bold in a
 * lot of browser chrome/extensions), so the web keymap uses `Ctrl+Space` as
 * the leader instead — chosen because it is not reserved by any major
 * browser. Pressing the leader "arms" a ~1.5s window during which the next
 * keystroke is looked up in `CHORD_ACTIONS`; missing that window silently
 * disarms (no action, no error).
 *
 * Two bindings are NOT part of the leader chord, matching herdr's actual
 * UX for these (both are also directly reachable without a prefix in most
 * command-palette-style tools):
 *   - `Cmd+K` opens the Navigator unconditionally (even while a text
 *     input has focus — command-palette convention, e.g. Slack/Linear);
 *     `Ctrl+K` does too, except in a terminal, where it belongs to the PTY.
 *   - plain `?` opens KeybindHelp, but only when focus is NOT inside an
 *     editable element (a bare `?` must still be typeable in the composer).
 *
 * Focus guard: chords (leader arm + the follow-up letter) and the plain `?`
 * binding are both suppressed while `document.activeElement` is inside a
 * `textarea`/`input`/`[contenteditable]`. A focused terminal is the
 * exception for chords: CLI panes always hold focus, so the leader has to
 * work there. `terminalKeyHandler` keeps xterm from also sending Ctrl+Space
 * (NUL) and the chord's follow-up letter to the PTY.
 */
import { useEffect, useRef } from "react";
import { usePerchStore, effectiveActiveProject } from "./store";
import { activateTab, currentTabs } from "./workspaceTabs";
import { getDockviewController } from "./dockview/dockviewController";

const LEADER_TIMEOUT_MS = 1500;

// ---------------------------------------------------------------------------
// Keybind table (also consumed by KeybindHelp.tsx for the searchable modal)
// ---------------------------------------------------------------------------

export type KeybindGroup = "global" | "navigation" | "sessions" | "panes";

export interface KeybindEntry {
  keys: string;
  description: string;
  group: KeybindGroup;
}

export const KEYBINDS: KeybindEntry[] = [
  { keys: "Cmd+K (Ctrl+K outside terminals)", description: "Open Navigator", group: "global" },
  { keys: "Ctrl+Space, g", description: "Open Navigator", group: "global" },
  { keys: "?", description: "Open this keybind help (outside inputs)", group: "global" },
  { keys: "Ctrl+Space, ?", description: "Open this keybind help", group: "global" },
  { keys: "Esc", description: "Close any open overlay", group: "global" },
  { keys: "Ctrl+Space, b", description: "Toggle sidebar collapse", group: "navigation" },
  { keys: "Ctrl+Space, s", description: "Open Settings", group: "navigation" },
  { keys: "Ctrl+Space, w", description: "Jump to the next project's most recent session", group: "navigation" },
  { keys: "Ctrl+Space, W", description: "Open the worktree menu for the current project", group: "navigation" },
  { keys: "↑ / ↓ (Ctrl+j / Ctrl+k)", description: "Move selection in Navigator", group: "navigation" },
  { keys: "Ctrl+Space, c", description: "New session in the current project", group: "sessions" },
  { keys: "Ctrl+Space, n", description: "Next session in the current workspace", group: "sessions" },
  { keys: "Ctrl+Space, p", description: "Previous session in the current workspace", group: "sessions" },
  { keys: "Ctrl+Space, 1-9", description: "Jump to the Nth session in the current workspace", group: "sessions" },
  { keys: "Ctrl+Space, x", description: "Close the current terminal pane", group: "panes" },
  { keys: "Ctrl+Space, v", description: "Split pane vertically (new terminal to the right)", group: "panes" },
  { keys: "Ctrl+Space, _", description: "Split pane horizontally (new terminal below)", group: "panes" },
  { keys: "Ctrl+Space, z", description: "Maximize / restore the focused pane", group: "panes" },
  { keys: "Ctrl+Space, h/j/k/l", description: "Focus the pane to the left/below/above/right", group: "panes" },
  { keys: "Ctrl+Space, o", description: "Cycle focus to the next pane", group: "panes" },
  { keys: "Ctrl+Space, }", description: "Swap the focused pane with the next one", group: "panes" },
  {
    keys: "Ctrl+Space, H/J/K/L",
    description: "Swap the focused pane with its neighbour left/below/above/right",
    group: "panes",
  },
  { keys: "Ctrl+Space, +", description: "Grow the focused pane", group: "panes" },
  { keys: "Ctrl+Space, -", description: "Shrink the focused pane", group: "panes" },
  {
    keys: "Ctrl+Space, r, then h/j/k/l…",
    description: "Resize mode: repeated h/j/k/l resizes the focused pane (Esc or timeout exits)",
    group: "panes",
  },
];

// ---------------------------------------------------------------------------
// Focus guard
// ---------------------------------------------------------------------------

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('input, textarea, [contenteditable=""], [contenteditable="true"], .xterm') != null;
}

function inTerminal(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(".xterm") != null;
}

/** True while the leader or resize mode waits for its next key. */
let chordPending = false;

/** xterm's custom key handler (attached by terminalSearch.ts for every
 * terminal). Returns false for keys the PTY must not see: the leader chord,
 * and Cmd combinations, which belong to the app as in Ghostty (copy, paste,
 * find, Navigator; the browser default still runs). Without the Cmd rule
 * the kitty protocol would encode them as CSI u. Everything else, Ctrl/
 * Shift+Enter included, is xterm's to encode; the kitty keyboard protocol
 * (xtermSetup.ts) lets CLIs tell those apart as they do in Ghostty. */
export function terminalKeyHandler(e: KeyboardEvent): boolean {
  if (e.metaKey) return false;
  if (e.type !== "keydown") return true;
  if (chordPending) return false;
  return !(e.ctrlKey && !e.altKey && (e.code === "Space" || e.key === " "));
}

// ---------------------------------------------------------------------------
// Session-jump helpers (read the store directly — this module has no React
// component of its own, so there's nothing to subscribe/re-render)
// ---------------------------------------------------------------------------

/** Jump to the Nth (1-indexed) tab of the strip, in the order it shows (sessions
 * and open files alike). No-op out of range. */
function jumpToNthWorkspaceTab(n: number): void {
  const { tabs, activeId } = currentTabs();
  const target = tabs[n - 1];
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

/**
 * Worktree menu for the active project (leader,W — capital, so it does not
 * collide with leader,w's next-project jump). Resolves the active session's
 * `(hostId, cwd)` project key and asks that project's `WorktreeMenu` in the
 * sidebar to open itself (see `worktreeMenuRequest` in the store). No-op when
 * there is no active project cwd, or when the cwd is not a git repo — in the
 * latter case the sidebar never renders a menu for that project, so nothing
 * consumes the request and it is simply ignored.
 */
function openWorktreeMenuForActiveProject(): void {
  const state = usePerchStore.getState();
  const project = effectiveActiveProject(state);
  const hostId = project?.hostId ?? state.activeHostId;
  const cwd = project?.cwd ?? (hostId === "local" ? state.status?.cwd : undefined);
  if (!cwd) return;
  state.requestWorktreeMenu(`${hostId}:${cwd}`);
}

// ---------------------------------------------------------------------------
// Chord action table — the letter pressed after the Ctrl+Space leader
// ---------------------------------------------------------------------------

export interface LeaderKeyHandlers {
  openNavigator: () => void;
  openKeybindHelp: () => void;
}

const CHORD_ACTIONS: Record<string, (handlers: LeaderKeyHandlers) => void> = {
  g: (h) => h.openNavigator(),
  c: () => newSessionInCurrentProject(),
  n: () => switchTabRelative(1),
  p: () => switchTabRelative(-1),
  x: () => getDockviewController()?.closeActiveTerminalPanel(),
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
        if (isEditableTarget(e.target) && !inTerminal(e.target)) {
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

      // Cmd+K -> Navigator, unconditionally (command-palette convention;
      // deliberately NOT gated by the editable-focus guard below). Ctrl+K too,
      // except in a terminal: there it is the PTY's (readline kill-line).
      if ((e.metaKey || (e.ctrlKey && !inTerminal(e.target))) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handlersRef.current.openNavigator();
        return;
      }

      const editable = isEditableTarget(e.target);

      // Ctrl+Space -> arm the leader. Ignored while typing, except in a terminal.
      if (e.ctrlKey && !e.metaKey && !e.altKey && (e.code === "Space" || e.key === " ")) {
        if (editable && !inTerminal(e.target)) return;
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
          (!isEditableTarget(e.target) || inTerminal(e.target))) e.preventDefault();
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
