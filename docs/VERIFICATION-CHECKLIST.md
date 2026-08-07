# perch — manual verification checklist

Every user-facing feature added in Waves 1–3 and Phases 12–15, with **where to click** and
**what should happen**. Written so a human can walk the UI and tick boxes, and so the
automated specs have a human-readable counterpart.

Leader key is **Ctrl+Space**, then the letter (a ~1.5s window). Chords are ignored while
typing in an input, on purpose.

---

## A. Wave 2 / Phase 15 — the newest work

| # | Feature | Where | Expected |
|---|---------|-------|----------|
| A1 | **Terminal scrollback setting** | Settings (⚙ or `leader,s`) → Terminal → "Scrollback (lines)" | Shows `10000` on a fresh profile. Accepts 100–200000. A value outside that range is **not** saved. Survives reload. |
| A2 | **Login-shell panes** | Settings → Terminal → "Spawn plain terminal panes as a login shell" | Off by default. When on, a **newly opened** terminal pane runs `$SHELL -l` (your `.zprofile` runs — prompt/PATH may differ). Does not affect CLI-mode agent panes. |
| A3 | **Cursor from your terminal** | Open a CLI-mode pane | Cursor shape/blink match your iTerm2 profile. On this machine `Cursor Type` is unset → xterm's default block, and `Blinking Cursor` is off → **cursor does not blink** (it used to always blink). |
| A4 | **Light/dark terminal palettes** | — | Only active if iTerm2's *"Use Separate Colors for Light and Dark Mode"* is ON. It is **off** on this machine, so the pane keeps your single palette and must **not** change with macOS appearance. |
| A5 | **Ghostty support** | — | If you ever use Ghostty, its config is read when iTerm2's isn't available. No visible change today. |
| A6 | **Notification click-to-focus** | Settings → Notifications → delivery `system`; let a background session finish | Clicking the OS notification focuses perch **and** switches to that session. Repeat firings replace the notification rather than stacking. |
| A7 | **Bulk archive a project** | Sidebar project row → 📦 (`project-close-all`) | Confirm dialog names the exact session count. Cancel does nothing. Confirm archives them all; they leave the nav and appear in Settings → Archived Sessions. |

## B. Wave 3 / Phase 13

| # | Feature | Where | Expected |
|---|---------|-------|----------|
| B1 | **No-session empty state** | Delete the last session in a project | A real "No session open" card with a working create button — not a stuck "Connecting…". |
| B2 | **CLI provider picker** | CLI mode, unstarted session | Claude/Codex toggle before starting. |
| B3 | **Agent-attach singleton** | Open the same CLI session in two tabs | Both attach to **one** agent process. Previously spawned a duplicate `--resume`. |
| B4 | **OSC 52 clipboard** | In a CLI pane, have the agent copy something | Lands in the system clipboard, UTF-8 intact. |
| B5 | **Clickable links** | Print a URL in a terminal pane | Click opens it. |
| B6 | **Directional pane swap** | `leader,H/J/K/L` | Swaps the focused pane with its neighbour. |
| B7 | **Resize mode** | `leader,r` then `h/j/k/l` repeatedly | Resizes without re-pressing the leader. Title shows `[resize]`. |
| B8 | **Pane menu discoverability** | `⋯` in a pane group header (`pane-group-menu`) | Split right/down, rename, zoom, close. |
| B9 | **PTY-activity status** | Run something long in a CLI pane | The session dot reflects activity. |

## C. Phase 14 — persistence & tests

| # | Feature | Where | Expected |
|---|---------|-------|----------|
| C1 | **CLI agents survive restart** | Start a CLI session, quit perch, reopen | The **same** agent process is still running with its screen intact (tmux-backed). |
| C2 | **Restart CLI kills cleanly** | CLI pane → Restart CLI | Old agent is gone, not orphaned and silently reattached. |

## D. Phase 12 — CLI rendering

| # | Feature | Where | Expected |
|---|---------|-------|----------|
| D1 | **TUI renders correctly** | CLI pane with a full-screen agent TUI | Box-drawing and emoji intact, columns aligned. No stray `�`. |
| D2 | **Your terminal's font/colours** | CLI pane | Matches iTerm2 (font `MesloLGS NF` 13, 22 palette colours here) — never perch's UI theme. |
| D3 | **Narrow pane scales, not reflows** | Drag a CLI pane narrow | Font shrinks to hold 80 columns; the TUI does not rewrap. |
| D4 | **Gated CLI start** | Open the app in CLI mode | No agent spawns until you explicitly start the session. |
| D5 | **Auto session titles** | Type a first prompt in a CLI session | The session gets titled from that prompt. |

## E. Wave 1 & earlier — still-live surface

| # | Feature | Where | Expected |
|---|---------|-------|----------|
| E1 | **Directory browser** | New session → browse | Filter, up, type-a-path fallback, select cwd. |
| E2 | **Rename a session** | Double-click a tab | Inline rename persists. |
| E3 | **Sound on done/blocked** | Settings → Notifications → sound | Tone when a background session finishes or blocks. |
| E4 | **Toast delivery** | Settings → Notifications | `off` / `app` / `system`. Clicking an in-app toast switches session. |
| E5 | **Terminal find** | `Ctrl/Cmd+F` in a terminal | Find bar; Escape closes. |
| E6 | **Multi-tab close guard** | Close a group with several terminals | Confirms first. A single terminal does not. |
| E7 | **Session delete** | Trash icon | Immediate, no confirmation (by design). |
| E8 | **Worktrees** | `leader,W` or project row | List, create (new branch), open as session, remove; dirty ones are guarded then force-removable. |
| E9 | **Themes** | Settings → theme | Switches and persists; default `catppuccin`. |
| E10 | **Onboarding** | First run on a clean profile | Shows once, dismiss persists. |
| E11 | **Pane labels** | Settings → pane labels | Toggles the chat tab's agent badge. |
| E12 | **Tab drag-reorder** | Drag tabs in the strip | Order persists across reload. |
| E13 | **Navigator** | `leader,g` or `Ctrl/Cmd+K` | Fuzzy-jump to a session/project. |
| E14 | **Keybinding help** | `?` | Searchable overlay. |
| E15 | **Slash autocomplete** | Composer, `/` (claude) or `$` (codex) | Popover; Enter accepts the suggestion instead of sending. |
| E16 | **Plan mode** | `composer-plan-toggle` | Plan card; "Approve & run" runs it with plan mode **off**. |
| E17 | **Attachments** | `composer-attach` | Name-only chips (never image previews — only the staged server path crosses the wire). |
| E18 | **Federation** | Settings → SSH hosts | Remote sessions/terminals over the tunnel; direct-mode turns survive sleep. |

---

## Full leader chord table

`g` navigator · `c` new session in project · `n`/`p` next/prev session · `x` close terminal pane ·
`v` split terminal right · `_` split terminal down · `z` zoom · `b` sidebar · `s` settings ·
`?` help · `w` next project · `W` worktree menu · `1`–`9` nth session ·
`h/j/k/l` focus pane · `H/J/K/L` swap pane · `o` cycle pane · `}` swap with next ·
`+`/`-` grow/shrink · `r` resize mode

## Known gaps (not bugs)

- Bulk **delete** of a project is deliberately not offered — archive only, since archive is restorable.
- Leader-armed state has no on-screen chip yet; it only prefixes the window title.
- The tab-bar `+` does not yet offer an agent choice (the sidebar and empty-state create paths do).
