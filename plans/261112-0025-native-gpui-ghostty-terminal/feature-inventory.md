# Tauri feature inventory for the native Ghostty-engine client

Date: 2026-11-12.
Evidence: Perch @ 60dd2c7, herdr-app @ 4c8c622. Perch paths are read from the clean worktree `/Users/hwiii/Github/perch-native-gpui` and are repo-relative. Terminal behaviour rows are in `terminal-parity-checklist.md`; this file does not repeat them.

Column rules. The third column is `planned` for the owner's daily set: sidebar (projects and sessions), tabs and splits, launching agents, attention states, the terminal and its settings, remote hosts, the command palette, and the existing keybindings. Every other built feature is `Tauri-only (hand-off)`, so the native client hands it to the Tauri app until it reaches parity. Roadmap items that are not built in either app are listed separately, because the Tauri app cannot receive a hand-off for them. Items sourced only from `docs/ROADMAP.md` or `docs/DECISIONS.md` are marked "unverified in code" in Notes.

Row count: 42 `planned` rows and 29 `Tauri-only (hand-off)` rows.

## Daily set (planned)

### Sidebar, projects and sessions

| Feature | Where it lives (file) | In native client this run? | Notes |
|---|---|---|---|
| Project and session tree (default view) | packages/web/src/stock-ui/sidebar/main.tsx, folders.tsx, overview.tsx | planned | The tree is the default; the organize setting is `perch.sidebar.organize`. Tests in packages/web/src/components/StatusSidebar.test.tsx. built: workspace rows (branch, dirty, linked), sub-sessions nested under their lead (one level), folded-project rollup, a finished chat held in Done while read and marked read in the core, scrollable. not built: sub-session nesting is covered by unit and render tests only; the isolated core with plain shells cannot produce a parent session. |
| By status sidebar view | packages/web/src/stock-ui/sidebar/overview.tsx; packages/web/src/components/StatusSidebar.test.tsx:27-28, 44-71 | planned | Sections in fixed order with counts; chats stay under their project. built: the organize toggle, fixed section order with counts, needs-you reasons, `No sessions` and Offline sections. not built: the web's `In one list` variant (not requested). |
| Hosts in the sidebar | packages/web/src/stock-ui/sidebar/hosts.tsx | planned | Shares data with the remote hosts row. built: state dot, state and detail text, error text, Turn on/off for SSH hosts, projects of the connected ones. not built: the machine check, which lives in Settings > Hosts; its "Open in Perch" link is the hand-off. |
| Sidebar toggle (mod+b) and needs-you jump (cmd+shift+u) | packages/web/src/keybinds.ts:108-110 | planned | Keybinding rows cover the shortcut registry. built: named actions `global.sidebar`, `global.needsYou` (longest wait first, wraps), native-only `global.needsYouPrev`, `sessions.new`, `nests.*` and `sidebar.organize`, each with a handler and unit tests. built: the key dispatcher runs `global.sidebar` and `global.needsYou` (and `needsYouPrev`, `sessions.new`, `nests.*`) from the keys the person chose, and the palette lists them. |

### Tabs and splits

| Feature | Where it lives (file) | In native client this run? | Notes |
|---|---|---|---|
| Tabs: new, close, next, previous, last, keep open | packages/web/src/stock-ui/tabs/main.tsx; packages/web/src/workspaceTabs.ts; keybinds.ts (tabs.*) | planned | Shortcut ids tabs.new, tabs.close, tabs.keepOpen, tabs.last, tabs.next, tabs.prev. built (window state only): a tab strip of the opened sessions in the order they were opened, with `tabs.new` (opens the sidebar's New session panel; the palette also has Start entries), `tabs.close`, `tabs.jump1`-`jump8`, `tabs.last`, `tabs.next`, `tabs.prev`, the same ids and default keys as the web. Closing a tab ends a plain terminal only when the core confirms it: the tab stays until `session.deleted` arrives, and when the core does not answer in five seconds the tab stays and says the terminal is still running (nothing is relaunched or stopped on a guess); any other session is put away (it keeps running and stays in the sidebar), with a notice. Every tab stays attached; only the tab on screen is laid out and drawn, and a hidden tab keeps its size (the program redraws out of sight) once the size has held for two draws; up to twelve out-of-sight tabs keep their terminal and the next is parked. A dropped connection reattaches each terminal with a backoff of 250 ms doubling to 5 s; a shell the core no longer has is reported as such and is never started again. not built: `tabs.keepOpen` (there are no preview tabs). |
| Tab drag and reorder | packages/web/src/components/TabDragLayer.tsx; packages/web/src/stock-ui/tab-drag | planned | In-page HTML5 drag; Tauri's drag-drop handler is disabled (crates/perch-desktop/src/main.rs, `disable_drag_drop_handler`). not built: dragging; `tab.move` exists but only a keys.json `run` entry reaches it, and the order is the order of opening. Reason: no drag layer yet and the order is not stored. |
| Tab menu | packages/web/src/stock-ui/tab-menu | planned | Part of the tab set. not built: no tab menu; the palette carries the commands, and each tab has a close button. |
| Close with the agent-session guard | packages/web/src/closeGuard.ts; packages/web/src/components/CloseAgentGuard.tsx; packages/web/src/stock-ui/close-guard | planned | Warns before closing a tab that holds a running agent. not built: no confirmation dialog. The native window never ends an agent from a tab close (it only puts the tab away and says so), which is the guard's purpose; ending one is the sidebar's job. A plain terminal is ended only with the core's confirmation (see Tabs). |
| Closed-tab history | packages/web/src/closedTabs.ts | planned | Unverified in UI: the module exists; its restore entry point was not traced. not built: no history. Reason: a closed tab's session stays in the sidebar, which reopens it. |
| Splits: split right and down, previous and next pane, zoom | packages/web/src/components/SplitCanvas.tsx; packages/web/src/stock-ui/session-split/main.tsx; packages/web/src/components/TabSplitMenu.tsx; keybinds.ts (panes.*) | planned | Built on `dockview-react` (packages/web/package.json:34). built: `panes.splitRight`, `panes.splitDown` (start a new terminal on this computer through the core and tile it beside the focused pane), `panes.prev`, `panes.next`, `panes.focus.*`, `panes.zoom`, leader `swap`, a nested row/column tree of at most four panes as in the web, a focus border, and a click gives a pane the keyboard. Tested headless against a real core: typing reaches only the focused pane and each pane's `stty size` is its own area. not built: a split on another computer (the hub's `session.created` names no request, so it is refused with a notice), dragging dividers (halves are equal), unsplit/resize through the leader's resize mode. |
| Pane header and pane menu | packages/web/src/stock-ui/pane-header; packages/web/src/stock-ui/pane-menu; packages/web/src/components/PaneContextMenu.tsx | planned | Part of the split set. built: the focused pane is outlined and a click focuses it. built: a pane menu, opened by a right-click the program did not take (Shift always opens it) and drawn where it was asked, with Copy, Paste, Select all, Find, Clear, Split right, Split down, Zoom or Restore pane, Stop the terminal (only when this view holds the keyboard) and Close; `terminal.peek` shows a session's terminal over the window with no tab, `terminal.keep` makes it a tab, `terminal.park` puts the peek away, `terminal.show` opens or goes to the session's tab. not built: a pane header; `terminal.pin` and `terminal.right_click` (no setting to read; pins are this device's and Perch's own views ignore them, docs/DECISIONS.md:251-252). |
| Per-viewer layout restore | packages/web/src/layoutState.ts; packages/web/src/components/LayoutRoot.tsx; packages/web/src/stock-ui/layouts | planned | ROADMAP lists per-viewer local restoration as built (docs/ROADMAP.md:31-50). not built: the layout is this window's alone, as the web's is per viewer, and is not stored; a restart opens no tabs. Reason: the sidebar reopens any session in one click, and nothing is written to the core. |

### Launching agents

| Feature | Where it lives (file) | In native client this run? | Notes |
|---|---|---|---|
| New session dialog | packages/web/src/components/NewSessionDialog.tsx; packages/web/src/components/NewSessionPopover.tsx; packages/web/src/stock-ui/new-session | planned | Keybinding leader.newSession. built: a New session panel in the sidebar (provider, project, computer) that launches through the core. not built: a launch on another computer is sent but not opened, since the hub's `session.created` names no request to match; the window says it was asked. The `leader.newSession` key runs the same panel through the key dispatcher. |
| Agent picker and catalog | packages/web/src/components/AgentPicker.tsx; packages/web/src/components/AgentCatalog.tsx | planned | built: the New session panel and the palette's Start entries list the core's providers that can start. not built: the catalog screen. |
| New tab launcher (pick a harness) | packages/web/src/stock-ui/launcher/main.tsx | planned | Keybinding tabs.new. The component's test file is packages/web/src/components/NewTabLauncher.test.tsx. built: `tabs.new` opens the sidebar's New session panel (provider, project, computer) and the palette's Start entries launch a provider. not built: a launcher tab or screen of its own. |
| Agent launch and lifecycle | crates/perch-core/src/terminal.rs (AgentTerminalRegistry, one PTY per session); crates/perch-core/src/server/session.rs | planned | Fail-closed launch: an unconfirmed start is `start_unknown`, never exited (docs/ARCHITECTURE.md:442-445). |
| Agent control screen | packages/web/src/stock-ui/agent-control | planned | Holds the take-control and fit controls; see terminal parity rows B-54 to B-58. |

### Attention states

| Feature | Where it lives (file) | In native client this run? | Notes |
|---|---|---|---|
| Attention model and ranking | packages/web/src/attention.ts; packages/web/src/stock-ui/status/main.tsx | planned | Unit tests in packages/web/src/attention.test.ts. built: an attention dot on each tab in the colour the sidebar uses for the session's state, and a Needs you label on a tab that waits on you. |
| Status dots (agent and host) | packages/web/src/components/StatusDot.tsx; packages/web/src/components/HostStateDot.tsx | planned | built: agent dots from the core's state, host dots from `host.info`; a computer that is not connected claims no state. |
| Done and blocked sound alerts | packages/web/src/stock-ui/settings-notifications/main.tsx:93 (`soundEnabled`); packages/web/src/sound.ts:16 (`soundDone`, `soundBlocked` files) | planned | No stock-ui control was found for the done and blocked sound files; only `soundEnabled` has a switch. built: a sound on running to idle (once) and on newly blocked (twice), gated by the core's `soundEnabled` and by the chat not being viewed in an active window; the person's own `soundDone` and `soundBlocked` file replaces the system alert when it is a relative path of a kind the core serves (mp3, wav, ogg, m4a, flac), within 2 MiB and inside the folder holding `mods/`, played with `afplay` and falling back to `NSBeep`; a toast names the session for eight seconds and a click opens it, delivered in the window or, with `toastDelivery: system`, as a system notification (`osascript`, called from main.rs only). The Settings panel has the sound switch and the toast delivery choice. Tests decide when and which, and never play or notify. |

### Terminal and its settings

| Feature | Where it lives (file) | In native client this run? | Notes |
|---|---|---|---|
| Agent terminal view (persistent, shared input, take control) | packages/web/src/views/PersistentAgentTerminal.tsx; packages/web/src/views/AgentCliTerminal.tsx; packages/web/src/agentTerminals.ts | planned | Behaviour rows B-20 to B-25 and B-54 to B-63 in the parity checklist. |
| Shell terminal view | packages/web/src/views/PersistentTerminal.tsx; packages/web/src/views/Terminal.tsx | planned | Behaviour row B-65 in the parity checklist. |
| Terminal engine (xterm, profile, fit, WebGL) | packages/web/src/xtermSetup.ts; packages/web/src/terminalKeeper.ts | planned | Replaced by libghostty-vt in the native client; behaviour rows B-01 to B-25. |
| Terminal toolbar | packages/web/src/stock-ui/terminal-toolbar/main.tsx | planned | Shell select, new and close. |
| Terminal search bar | packages/web/src/components/TerminalSearchBar.tsx; packages/web/src/terminalSearch.ts; packages/web/src/stock-ui/terminal-search | planned | Keybindings terminal.find, terminal.clear, scroll and command jumps. built: `terminal.find`, `terminal.clear`, `terminal.scrollTop`/`scrollBottom`/`scrollPageUp`/`scrollPageDown`, `terminal.scroll {lines|pages|to}`, `terminal.copy`, `terminal.paste` (text, files copied in the file manager, or an image), `terminal.selectAll`, `terminal.takeControl`, `terminal.kill`, `terminal.prevCommand` and `terminal.nextCommand`, run by the window's keymap and the palette on the focused terminal, with the web's default keys; the search keeps its query across a reattach. |
| Command marks | packages/web/src/commandMarks.ts | planned | OSC 133 jump and failure ticks. built: `terminal.prevCommand` and `terminal.nextCommand` (cmd+shift+up and down, ctrl+shift+pageup and pagedown) scroll through the prompts the shell marked, past the newest is the live screen, and a command that ended with a non-zero exit code leaves a tick in the palette's red on the scrollbar, followed through scrolling and pruning by Ghostty (up to 500 per terminal). Difference: the jumps stop at every prompt, including one where no command was run. A shell without OSC 133 has no marks. |
| Terminal settings screen | packages/web/src/stock-ui/settings-terminal/main.tsx; packages/shared/src/protocol.ts:473-505, 561-577 | planned | Covers scrollback, login shell and dropped-path quoting. Terminal settings are in protocol.ts, not in packages/web/src/components/ui/settings.ts (which holds only UI style constants). built: a Settings panel with scrollback (100 to 200000, saved only when in range), login shell and dropped-path double quotes, each sent to the core as a `settings.update` carrying only that field, and shown from the core's `settings.current`. The panel also holds colour contrast, programs writing the clipboard, pane scrollbars, padding across and down, opacity, Option as Alt, the alert sound switch and toast delivery, and a change reaches open terminals at once, scrollback included. Login shell only affects shells started later (core behaviour). Not here, because the core has no field for them: line height, ligatures, scroll speed and a font size of its own (the profile gives the size). |
| Display and input settings: padding, opacity, minimum contrast, pane scrollbars, Option as Alt, clipboard write | packages/shared/src/protocol.ts:495-505; packages/web/src/xtermSetup.ts:224-253, 340-349, 495-496 | planned | The client reads these keys. No stock-ui control was found for them by key name, and the writer was not traced. Unverified in the settings UI. built: the Settings panel has a row for each, written to the core as its own field; the terminal view takes all of them live. Option as Alt honours Off and Auto; On, Left and Right act as Auto because gpui cannot say which Option key is down. |
| Terminal-side Context Bridge (right-click capture, explicit send) | packages/web/src/contextBridge.ts:58-70 (capture), 66-67 (15 s timeout) | planned | Parity rows B-47 to B-50. Direct send is Claude-only (docs/CONTEXT-BRIDGE.md). |
| Profile from iTerm2 or Ghostty | crates/perch-core/src/iterm_profile.rs; crates/perch-core/src/ghostty_profile.rs; crates/perch-core/src/terminal_profile.rs | planned | The Ghostty source is missing from the brief. |
| File drop and image paste into the terminal | packages/web/src/agentFileDrop.ts; packages/web/src/clipboardImagePaste.ts | planned | Terminal input path. built: a file dropped on a terminal on this computer, or copied in the file manager and pasted, types its quoted path (single quotes, or double with the setting) with no Enter; on a terminal on another computer a file dropped with Option held is sent to the core (`POST upload` with `hostId` and `scp=1`, needs `upload.scp.v1`, 1 GiB at most, over a connection of its own) and the path it has there is typed once the core says it arrived, only if the view can still type; a clipboard image (TIFF and BMP become PNG) is staged by the core (`POST clipboard-image`) on this computer and its path typed, and text on the clipboard wins over a picture. The code is Perch's own, so no attribution entry. not built: a clipboard image for another computer's terminal (the web does not either), screenshot-thumbnail staging; the SCP copy itself was not run headless, which needs an SSH host. |
| Pinned terminals | packages/web/src/pinnedTerminals.ts | planned | Stored in localStorage per device. not built: Perch's own views ignore pins (docs/DECISIONS.md:251-252, 475), so the native client keeps none. |
| PTY ownership in the core and perchd | crates/perchd/src; crates/perch-core/src/terminal.rs | planned | Detached PTYs keep running across app and core restarts (AGENTS.md). |

### Remote hosts

| Feature | Where it lives (file) | In native client this run? | Notes |
|---|---|---|---|
| Hosts settings screen | packages/web/src/stock-ui/settings-hosts/main.tsx | planned | |
| Machine check | packages/web/src/components/MachineCheck.tsx; packages/web/src/stock-ui/settings-hosts/machine-check.tsx | planned | |
| Connection details | packages/web/src/components/ConnectionDetails.tsx | planned | |
| Terminal routing to remote hosts | crates/perch-core/src/server/terminal.rs (`handle_terminal_input`, `handle_terminal_resize` call `hub.route_for_terminal`) | planned | Remote terminal input and resize are forwarded to the host. |

### Command palette

| Feature | Where it lives (file) | In native client this run? | Notes |
|---|---|---|---|
| Navigator (command palette, mod+p) | packages/web/src/components/Navigator.tsx; packages/web/src/stock-ui/navigator/main.tsx | planned | Lists sessions, the focused workspace's file search and the host's agents. Shortcut global.navigator. built: `global.navigator` (and its alternate key) opens a palette that filters fuzzily as you type, moves with up, down and the page keys, runs with Enter and closes with Escape. It lists the commands by their web ids and titles with the keys they have, sessions to go to, agents and terminals to start, rename, and the hand-offs to the Perch app. not built: the focused workspace's file search (files are a hand-off). |

### Existing keybindings

| Feature | Where it lives (file) | In native client this run? | Notes |
|---|---|---|---|
| Shortcut registry (45 entries) | packages/web/src/keybinds.ts (`SHORTCUTS`, line 86, and the `shortcut(...)` calls) | planned | Groups: global, view, tabs, nests, panes, terminal, leader, nav. built: the ids, titles and default keys of the daily set (global, tabs, panes, leader, terminal.paste), per-platform default selection and the web's `mod` meaning. also built: the `view.*` zoom keys (zoom in, in with shift, out, reset: 1.2 to the power of the level, from -5 to 8, scaling the text and padding of every terminal and refitting the grid) and the terminal find, clear, scroll, copy, select-all and command-jump keys. not built: `nav.*` (there is no navigation history to go back through). |
| Keybinding file | packages/web/src/keysFile.ts; packages/web/src/keyCombo.ts | planned |built: `settings.keybindings` (an empty string unbinds) over the defaults, and `keys.json` sections `terminal` (send, a key passed through) and `global`, with the web's precedence (`keys.json` first, then the shortcuts by specificity); `send:` goes through the terminal's text input under the same lease as typing, never a paste. not built: the `layout:` and `mod:` sections. |
| Keyboard settings screen and help | packages/web/src/stock-ui/settings-keyboard; packages/web/src/components/KeybindingsSection.tsx; packages/web/src/stock-ui/keybind-help | planned | Help text lists Cmd+C and Cmd+V for the terminal (keybinds.ts:387). not built: no keyboard settings or help screen; the palette shows each command's key, and the keys are changed in the Perch app. |
| Leader chord and resize mode | packages/web/src/keybinds.ts:191-196 | planned | ctrl+space arms the leader. built: `leader.arm` (ctrl+space) waits 1.5 s for the follow-up key and runs the leader's tab, pane, swap, zoom, navigator, settings and new-session keys; Escape ends it. not built: resize mode, grow and shrink (halves are equal). |

## Hand-off (Tauri-only)

Desktop plugins: `crates/perch-desktop` has no updater, tray or deep-link feature. `Cargo.toml` lists only the notification and dialog plugins (lines 19-20), `tauri.conf.json` has no updater or plugins section, and `main.rs` has no tray code. The desktop-only scope is therefore the rows below.

| Feature | Where it lives (file) | In native client this run? | Notes |
|---|---|---|---|
| Editor: CodeMirror editing, durable drafts and conflicts, drawer search | packages/web/src/components/CodeEditor.tsx; packages/web/src/editorSyntax.ts; packages/web/src/fileTabs.ts; packages/web/src/filesystemStore.ts | Tauri-only (hand-off) | Built (docs/ROADMAP.md:31-50). The native editor is a feasibility spike only (plan piece 7). |
| File tree and workspace browser | packages/web/src/components/WorkspaceBrowser.tsx; packages/web/src/stock-ui/files; packages/web/src/stock-ui/folder-browser | Tauri-only (hand-off) | |
| File viewers: image, PDF, markdown preview, audio and video | packages/web/src/components/WorkspaceImage.tsx; WorkspacePdf.tsx; WorkspaceMarkdownPreview.tsx; WorkspaceFileAsset.tsx | Tauri-only (hand-off) | Built per docs/ROADMAP.md:31-50. |
| Archive extraction and downloads | packages/web/src/fileOps.ts | Tauri-only (hand-off) | Module location only; behaviour unverified in code. |
| Remote workspace, first slice (inventory, worktrees) | docs/ROADMAP.md:58-66 | Tauri-only (hand-off) | Unverified in code: the first slice is described as implemented. The rest is in the not-built list. |
| Git and review: diff, commit, push, anchored feedback packets | packages/web/src/gitReviewStore.ts; packages/web/src/components/gitReviewModels.ts; packages/web/src/stock-ui/review | Tauri-only (hand-off) | Built per docs/ROADMAP.md:31-50. |
| Worktree lifecycle and guards | packages/web/src/components/WorktreeMenu.tsx; packages/web/src/stock-ui/worktree | Tauri-only (hand-off) | Built per docs/ROADMAP.md:31-50. |
| Browser tabs and drawer | packages/web/src/browserNative.ts; packages/web/src/browserPages.ts; packages/web/src/drawerBrowsers.ts; packages/web/src/stock-ui/browser; packages/web/src/stock-ui/browser-toolbar | Tauri-only (hand-off) | Browser tabs open from terminal links (links.ts:66-79). |
| Desktop child webviews for browser pages | crates/perch-desktop/src/browser.rs (`browser_show`, `browser_go`, `browser_close`, and related commands) | Tauri-only (hand-off) | Tauri-specific infrastructure. |
| Native window chrome and app menu | crates/perch-desktop/src/main.rs (window 1280x800, minimum 800x600); crates/perch-desktop/src/menu.rs; crates/perch-desktop/src/glass.rs | Tauri-only (hand-off) | The Edit menu includes predefined Copy and Paste (menu.rs:31-41). |
| Close Tab through the native File menu | crates/perch-desktop/src/browser.rs:84-96 (`file_menu`, `on_menu_event`) | Tauri-only (hand-off) | Close Tab uses the configured binding in every webview. |
| Native keyboard bridge for page webviews | crates/perch-desktop/src/shortcuts.rs; crates/perch-desktop/src/browser.rs (`browser_shortcuts`) | Tauri-only (hand-off) | Forwards matched commands from AppKit events. |
| Open in Default App and Reveal in Finder | crates/perch-desktop/src/main.rs:79 (`open_in_default_app`), :120 (`reveal_in_finder`) | Tauri-only (hand-off) | |
| Native folder picker for "Add project" | crates/perch-desktop/src/main.rs:246 (`tauri_plugin_dialog`) | Tauri-only (hand-off) | Local host only. |
| Window capture | crates/perch-desktop/src/main.rs:58 (`capture_window`) | Tauri-only (hand-off) | Registered command; its caller was not traced. |
| Native notifications (macOS UserNotifications, click to open) | crates/perch-desktop/src/notify.rs | Tauri-only (hand-off) | Permission request only on an explicit user action. |
| macOS permissions setup | crates/perch-desktop/src/permissions.rs; packages/web/src/components/MacPermissions.tsx | Tauri-only (hand-off) | |
| Traffic-light placement and vibrancy | crates/perch-desktop/src/glass.rs | Tauri-only (hand-off) | Native chrome; not a web feature. |
| Phone and PWA pairing, shared CLI input | packages/web/src/components/PairingGate.tsx; packages/web/src/components/PhoneAccess.tsx; packages/web/src/components/QrCode.tsx | Tauri-only (hand-off) | Built per docs/ROADMAP.md:129-139. |
| Mobile screens | packages/web/src/components/Mobile*.tsx; packages/web/src/components/PhoneSizeNotice.tsx; packages/web/src/stock-ui/mobile-* | Tauri-only (hand-off) | Phone-only surfaces. |
| Onboarding and start screen | packages/web/src/components/Onboarding.tsx; packages/web/src/components/StartScreen.tsx; packages/web/src/stock-ui/onboarding; packages/web/src/stock-ui/start | Tauri-only (hand-off) | |
| Settings pages other than the planned ones | packages/web/src/stock-ui/settings-general; settings-appearance; settings-agents; settings-devices; settings-permissions; settings-notifications (except the sound rows above) | Tauri-only (hand-off) | Terminal, hosts, keyboard and the sound rows are in the daily set. |
| Project Home | packages/web/src/components/ProjectHomeTab.tsx; packages/web/src/stock-ui/project-home | Tauri-only (hand-off) | Not in the daily set. |
| Instructions and memory | packages/web/src/components/InstructionsDialog.tsx; packages/web/src/components/MemoryDialog.tsx; packages/web/src/instructions.ts; packages/web/src/memory.ts | Tauri-only (hand-off) | Projects parity (docs/ROADMAP.md:544-588). |
| Chat mode and composer (opt-in per agent, native chat view) | packages/web/src/views/nativeChat/; packages/web/src/chatMode.ts; packages/web/src/chatComposer.ts; packages/web/src/chatSend.ts; packages/web/src/components/SlashPopover.tsx | Tauri-only (hand-off) | The built part of "native UI mode" (docs/ROADMAP.md:163-263). |
| Context Bridge for file, editor and diff sources | packages/web/src/perch-sdk.d.ts:767-771 (`ContextSource` kinds); packages/web/src/components/ContextBridge.tsx | Tauri-only (hand-off) | The terminal source is planned above. Which UI sends the other kinds was not traced. Other providers Copy (docs/ROADMAP.md:31-50). |
| Usage, spend estimates and usage alerts | packages/web/src/stock-ui/status/usage.tsx; crates/perch-core/src/usage/mod.rs, spend.rs, alerts.rs, redeem.rs | Tauri-only (hand-off) | Built per docs/ROADMAP.md:31-50. |
| Mods (web-side mod host and mod UI) | packages/web/src/components/ModsHost.tsx; packages/web/src/components/ModView.tsx; packages/web/src/modHost.ts; packages/web/src/mod-runtime.ts | Tauri-only (hand-off) | Perch's own mod system, not herdr's. |
| Shared dialogs, confirmations and toasts | packages/web/src/stock-ui/confirm; dialog; toast; select | Tauri-only (hand-off) | Shared UI; the native client builds its own equivalents only as the daily set needs. |

## Roadmap items not built in either app

These come from `docs/ROADMAP.md` and are unverified in code. The Tauri app has no feature to hand off, so the native client has nothing to hand over for them.

| Item | Source | Notes |
|---|---|---|
| Quick Open | docs/ROADMAP.md:83-100 | Remaining alpha work. |
| Explicit Run in a new owned terminal | docs/ROADMAP.md:101-117 | Remaining alpha work. |
| Remote workspace, rest of the path (relayed background jobs, media transport, D3 proof) | docs/ROADMAP.md:58-82 | Remaining alpha work. |
| Attention across hosts | docs/ROADMAP.md:153-162 | Remaining alpha work. Not in the daily set. |
| Sub-sessions and orchestration | docs/ROADMAP.md:307-335 | Design and remaining work. |
| Native UI mode, steps beyond the built chat view | docs/ROADMAP.md:163-263 | Remaining work. Overlaps with this native client; see the unresolved questions. |

## Unresolved questions

1. The ROADMAP's "Native UI mode" (docs/ROADMAP.md:163-263) and this GPUI client both use the word native. Their relationship needs an owner decision before the native client is described as a replacement for the Tauri app's UI mode.
2. Context Bridge is split: the terminal source is planned, and the other sources are hand-off. The owner should confirm that this matches the brief's Phase 3 rule that Context Bridge's explicit send is terminal parity.
3. The writer of the display and input settings (padding, opacity, minimum contrast, pane scrollbars, Option as Alt, clipboard write) was not traced. The owner should confirm where these are set, because no stock-ui control was found.
4. The terminal's Cmd+C and Cmd+V path (menu item to xterm) was only partly traced; see parity rows B-34 and B-35.
5. The `closedTabs.ts` restore entry point and the `captureWindow` caller were not traced.
