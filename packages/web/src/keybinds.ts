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
 *   - `Ctrl/Cmd+K` opens the Navigator unconditionally (even while a text
 *     input has focus — command-palette convention, e.g. Slack/Linear).
 *   - plain `?` opens KeybindHelp, but only when focus is NOT inside an
 *     editable element (a bare `?` must still be typeable in the composer).
 *
 * Focus guard: chords (leader arm + the follow-up letter) and the plain `?`
 * binding are both suppressed while `document.activeElement` is inside a
 * `textarea`/`input`/`[contenteditable]`, OR inside an `.xterm` container.
 * xterm mounts a real (visually hidden) `<textarea class="xterm-helper-
 * textarea">` inside `.xterm` to capture keyboard input (see
 * `views/Terminal.tsx` — `term.open(containerRef.current)` renders into a
 * `.terminal__surface` div that xterm fills with `.xterm-screen`/`.xterm-
 * helper-textarea`), so the `textarea` selector alone would already catch
 * it; `.xterm` is checked too for robustness against xterm internals
 * changing which element actually holds focus.
 */
import { useEffect, useRef } from "react";
import { usePerchStore, activeProjectSessions, effectiveActiveProject } from "./store";
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
  { keys: "Ctrl/Cmd+K", description: "Open Navigator", group: "global" },
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
  { keys: "Ctrl+Space, n", description: "Next session in the current project", group: "sessions" },
  { keys: "Ctrl+Space, p", description: "Previous session in the current project", group: "sessions" },
  { keys: "Ctrl+Space, 1-9", description: "Jump to the Nth session in the current project", group: "sessions" },
  { keys: "Ctrl+Space, x", description: "Close the current terminal pane", group: "panes" },
  { keys: "Ctrl+Space, v", description: "Split pane vertically (new terminal to the right)", group: "panes" },
  { keys: "Ctrl+Space, _", description: "Split pane horizontally (new terminal below)", group: "panes" },
  { keys: "Ctrl+Space, z", description: "Maximize / restore the focused pane", group: "panes" },
  { keys: "Ctrl+Space, h/j/k/l", description: "Focus the pane to the left/below/above/right", group: "panes" },
  { keys: "Ctrl+Space, o", description: "Cycle focus to the next pane", group: "panes" },
  { keys: "Ctrl+Space, }", description: "Swap the focused pane with the next one", group: "panes" },
  { keys: "Ctrl+Space, +", description: "Grow the focused pane", group: "panes" },
  { keys: "Ctrl+Space, -", description: "Shrink the focused pane", group: "panes" },
];

// ---------------------------------------------------------------------------
// Focus guard
// ---------------------------------------------------------------------------

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('input, textarea, [contenteditable=""], [contenteditable="true"], .xterm') != null;
}

// ---------------------------------------------------------------------------
// Session-jump helpers (read the store directly — this module has no React
// component of its own, so there's nothing to subscribe/re-render)
// ---------------------------------------------------------------------------

/** Jump to the Nth (1-indexed) session within the active project's session
 * list (same ordering as `TabBar`: created-at ascending). No-op out of range. */
function jumpToNthProjectSession(n: number): void {
  const state = usePerchStore.getState();
  const target = activeProjectSessions(state)[n - 1];
  if (target && target.id !== state.sessionId) state.switchSession(target.id);
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
  n: () => usePerchStore.getState().switchSessionRelative(1),
  p: () => usePerchStore.getState().switchSessionRelative(-1),
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
};
for (let i = 1; i <= 9; i++) {
  CHORD_ACTIONS[String(i)] = () => jumpToNthProjectSession(i);
}

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

    function disarm() {
      armedRef.current = false;
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function arm() {
      armedRef.current = true;
      if (timer != null) clearTimeout(timer);
      timer = setTimeout(disarm, LEADER_TIMEOUT_MS);
    }

    function handleKeyDown(e: KeyboardEvent) {
      // A chord is in progress — the next non-modifier keydown resolves it
      // (or is silently dropped if it doesn't match any bound letter).
      if (armedRef.current) {
        if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;
        disarm();
        // Exact-key lookup first so shifted bindings (leader,W → worktree
        // menu) stay distinct from their lowercase counterparts (leader,w →
        // next project); everything else still resolves case-insensitively.
        const action = CHORD_ACTIONS[e.key] ?? CHORD_ACTIONS[e.key.toLowerCase()];
        if (action) {
          e.preventDefault();
          action(handlersRef.current);
        }
        return;
      }

      // Ctrl/Cmd+K -> Navigator, unconditionally (command-palette convention;
      // deliberately NOT gated by the editable-focus guard below).
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handlersRef.current.openNavigator();
        return;
      }

      const editable = isEditableTarget(e.target);

      // Ctrl+Space -> arm the leader. Ignored while typing.
      if (e.ctrlKey && !e.metaKey && !e.altKey && (e.code === "Space" || e.key === " ")) {
        if (editable) return;
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

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      disarm();
    };
  }, []);
}
