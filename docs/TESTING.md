# Testing and development

## Normal checks

The terminal engine is built from source: run `git submodule update --init
third_party/ghostty` once, and have **Zig 0.16.x** on `PATH` (or `ZIG=/path/to/zig`).
The pinned Ghostty commit does not build with Zig 0.17; `crates/ghostty-sys`
says so when the version is wrong.

```sh
cargo test -p perch-core                 # add a substring for focused tests
cargo test -p perchd
npm ci && npm run build                  # shared + web; axum serves web/dist
npm test                                # Vitest
npm run check:stock-ui -w @perch/web    # stock-screen exporter tests, then dist/stock-ui vs sources
cargo fmt --check
cargo clippy --workspace --all-targets   # add no warnings
cargo run -p perch-core -- --port 7788
cargo run -p perch-desktop
```

These are the existing npm scripts/CI commands, not a decision to delete the
pnpm lockfile. Both lockfiles exist; package-manager consolidation remains open.
After a dependency change, refresh the pnpm one too with `npx --yes pnpm@10
install --lockfile-only --ignore-scripts`. `pnpm-workspace.yaml` sets
`linkWorkspacePackages`, so `@perch/shared` links to the workspace instead of
being fetched from the registry.
Do not maintain volatile test counts or an exact clippy-warning count here.

Run checks relevant to the changed behavior, with one focused regression for
nontrivial logic. A docs-only edit needs link/consistency and diff checks, not
paid turns. A build or empty diagnostic cache does not prove runtime correctness.

## Headless e2e

```sh
npm run build
cd e2e
npx playwright test <spec> [-g name]
npx playwright test -c worktree-lifecycle.config.ts
PERCH_E2E_WEBKIT=1 npx playwright test --project=webkit <spec>
```

- Headless only: no `--headed` or focused windows.
- Main config boots isolated cores on :7799/:7800; worktree lifecycle uses
  :7796. Other focused configs specify their own ports. Check the config before
  reusing a server: never point tests at the installed user's app.
- Specs may make **real paid agent turns**. Use only `claude-haiku-4-5` or
  `gpt-5.6-luna`; use aliases, not dated snapshot IDs. Set
  `ANTHROPIC_MODEL=claude-haiku-4-5` for probe cores and verify the actual
  CLI banner before the first prompt.
- **Every core needs a token, loopback included** (slice 3a). `e2e/localAuth.ts` makes one
  random `PERCH_LOCAL_TOKEN` per run (the core reads it once and removes it from its own and
  every agent's environment): the configs put it in the browsers' `perch_local` cookie
  (`storageState: localStorageState()`; any `browser.newContext()` that opens a core needs the
  same), spec-spawned cores inherit it, Node `fetch` sends `localHeaders()` and Node WebSockets
  use `withLocalToken(url)`. A federation host's `directUrl` carries `withLocalToken(...)`. A
  context for a *paired phone* gets no cookie. For a hand-run headless core without the env
  variable, read `localToken` from `<PERCHD_DIR>/core.json` (0600, same-user readable) or open
  the one-use `local-login?code=` link it prints to a terminal. `PERCH_REQUIRE_PAIRING` does
  nothing now. iOS-simulator probes against a loopback core need pairing like any phone.
- **Fixture cores run under a private `$HOME`** (`e2e/fixtureHome.ts`). "Chats" sessions start
  in `$HOME`, and a real agent started there walks it; on macOS that reaches Desktop,
  Documents, Downloads, Pictures and Music and the OS asks for access in the name of the test
  `perch-core` (a new identity on every rebuild). `fixtureRuntimeEnv()` therefore sets `HOME` to
  one temp dir per run holding symlinks to what agents and shells need (`.claude`, `.codex`,
  `.pi`, `.omp`, `.local`, toolchains, `.config`, shell startup files, `Library/Keychains` so
  logins keep working) and never to a protected folder or `~/.perch`; it is deleted when the
  runner exits. Test code runs under the real home: use `fixtureHome()` for where the *core's*
  `$HOME` is (the Chats cwd, `.perch/worktrees`, `.perch/uploads`) and `REAL_HOME` for the
  user's. A spec that spawns a core must take its env from `fixtureRuntimeEnv(...)` (a `HOME`
  override goes after it); a config that copies it into `process.env` must drop `HOME`. A new
  spec or config must never start an agent under the real home. To check a change, run a
  real-Claude spec such as `cli-sync.spec.ts` and read the TCC log for the test binary:
  `log show --last 5m --predicate 'subsystem == "com.apple.TCC" AND eventMessage CONTAINS "AUTHREQ_PROMPTING"'`
  should list nothing for your worktree's `target/debug/perch-core`. `device-pairing.spec.ts`
  and `workspace-recovery.spec.ts` fail with and without it (below).
- Known base failures (not regressions, same on a clean checkout): `federation.spec.ts` E2,
  `settings.spec.ts` D3, `sidebar.spec.ts` 2d, `wave2.spec.ts` X1, `remote-git.spec.ts` RG2 and
  `remote-workspace.spec.ts` RW4, `workspace-recovery.spec.ts` (its core's sidebar opens By status,
  so the project tree it looks for is absent) and `device-pairing.spec.ts` (the resize check; its
  earlier "working" check also races the process snapshot). Also, on a clean `8a02934` with the
  2026-11-08 working-tree snapshot (Chromium, 2026-11-09): `workspace-tabs.spec.ts` W2 (leader `_`
  splits nothing: W1's sessions are Quickchat chats with no workspace) and `responsive.spec.ts` R9
  (the held row's `row-menu` never opens) fail alone and in the suite; `pane-splitting.spec.ts` P1
  (and P2, the same leader split) fails only after other specs (sidebar, nav, workspace-tabs,
  mixed-tabs, …) and passes alone. R9 is fixed on the cloneable-stock-UI branch: Chromium's touch
  sends a compatibility mousedown and click on release, which closed the menu and then clicked the
  item under the finger; the hold now swallows that one release click and the menu closes on a
  `pointerdown` outside it (`stock-ui/sidebar/parts.test.tsx`).
  On the same clean baseline, each run alone (Chromium, 2026-11-09): `workspace-git.spec.ts` GB1
  (no `.workspace-entry` holds the new terminal's row) and `workspace-terminals.spec.ts` "perchd
  shell recovers … after a core crash" (the alert reads "provider terminal failed: persisted
  terminal process is no longer available", not the expected no-replacement wording).
  Same baseline (Chromium, 2026-11-09): `workspace-visual-qa.spec.ts` fails alone at its phone step
  (the held row's `workspace-menu-git-*` never shows, the same hold-row menu as R9). On the branch it
  passes that step and the drawer-width step (the test now sets `--tools-width` on the element that
  defines it, not on the drawer inside), then fails at the wide-desktop focus check: `git-refresh`
  focused by script after mouse use shows no `:focus-visible` outline; its markup and CSS are those
  of `8a02934`, a point the baseline never reaches. And
  `toasts.spec.ts` TN1/TN2 are flaky real-turn tests: TN1 failed in a three-spec run and passed alone
  and in the full spec, TN2 passed alone and failed in the full spec (the toast never came in 90 s).
  `paired-phone-flows.spec.ts` on that pristine baseline (a temporary worktree of `8a02934` with the
  sha256-verified snapshot files, `npm ci`, build; Chromium, 2026-11-09) fails twice before any paid
  turn: the phone page is blank with React error #300 at its pairing gate. On the branch it passes
  alone (twice, 16 s, Haiku), after three fixes: the held-row release click (R9 above), the review's
  session picker located as a combobox (its open list has the same accessible name), and waiting for
  the review to select the phone's own session instead of racing it with an open list.
  `needs-you.spec.ts` N1 (2026-11-09, stock and untouched clones alike): Claude Code 2.1.319 keeps the
  Enter typed right after the prompt as a newline, so no question is asked and Needs you stays empty.
  `sessions.spec.ts` S1 presses ⌘⇧T expecting "reopen closed tab", but since before `8a02934` that key is
  New session (`sessions.new` in `keybinds.ts`), so it opens the launcher and fails; neither file differs from
  `8a02934`.
- Add new specs to the intended config's `testMatch`. Main config enumerates
  specs; a new filename alone is not enough.
- Runs start with clean test state; create your own project/chat via
  `e2e/projects.ts`. `e2e/artifacts/` is wiped each run: retain release
  evidence elsewhere.
- Prefer deterministic CLI fixtures for faults/performance. Rerun a failed
  real-turn spec alone before calling it a regression; slow turns can overlap.

Useful existing coverage (not a claim of a fresh passing run):
- `mixed-tabs.spec.ts`: mixed order/splits, restoration, drafts, two viewers.
- `workspace-recovery.spec.ts` and `workspace-files-durable.spec.ts`:
  core restart, draft/conflict recovery.
- `workspace-file-browser.spec.ts`: CodeMirror, media, read-only and extraction.
- `agent-terminal-ownership.spec.ts`, `terminal-width.spec.ts`: authority/size.
- `cd e2e && npx playwright test -c provider-config.config.ts agent-file-drop.spec.ts`:
  isolated Chromium/WebKit drops, a real 3 MiB HTTP upload, the 1 GiB declared
  limit, quote-setting persistence, and configured-host SCP success/failure
  cleanup using local SSH/SCP stand-ins (no network hosts or paid turns).
  This is not certification against a real SSH/SFTP server.
- Native chat e2e (`native-composer.config.ts`: `native-composer`, `native-terminal`,
  `native-slash-send`, `instructions` (one real turn per provider and a dialog test)): do not run it from a shell inside a Perch terminal. Its PATH starts with
  that Perch's command shims, the fixture core inherits them, the picker's `claude` becomes a
  shim-launched agent of the *outer* Perch and the UI never connects (`data-native-pid` unset).
  Strip `perch-native-*.shell/bin` from `PATH` and unset `PERCH_SHELL`, `TERM_PROGRAM` and
  `PERCH_SKIP_RELAY` first. A cold OMP or Codex bridge also fails to connect now and then; rerun
  that provider alone.
- `stock-ui-chat.spec.ts` (same config, Claude haiku only, one real turn after the model is checked): the native
  chat as `stock:chat` and as an untouched clone chosen with `use` (same draft, a deep edit only in the clone, a
  send carried through a swap dispatched once, the phone's own chat). The clone lives in the fixture's `mods/`.
  `stock-ui-clones.spec.ts` (main config, no turns; WebKit with `PERCH_E2E_WEBKIT=1 --project=webkit`) covers
  the other stock packages, the Settings pages, the stock window layout `stock:main`, keyed and kept mod windows,
  package commands in Settings > Keyboard, and a live terminal moving into a peek and a package `Layout`. Its
  close-guard test starts one Claude CLI (haiku, banner checked) and never prompts it; so does its slash-popover
  test, which switches to the UI view and types only `/` into the composer (a pick rewrites the draft; nothing is
  sent). Its docked pane menu and Split with session tests seed a two-pane dock through `session.layout.set`
  (`saveSessionLayout`). Its phone-size test pairs a phone context over loopback (it passes an empty
  `storageState`: the config's cookie would make it this computer's own window, whose size never gets the notice)
  and revokes that device at the end. Its scripted-agent test
  builds `perch` itself (`cargo build -p perchd --bin perch`) and drives a terminal session's shell with only
  `perch` and `sed`; no model runs. Its frozen-start test is Chromium only (WebKit's driver cannot close a page
  whose main thread never yields) and closes that page itself. Its phone-screens test pairs a phone (as the
  phone-size test) and drives the opt-in, off and revoke paths on the five `stock:mobile-*` copies. Its agent-chip
  test removes `terminal.sharedInput` from each page's `serverInfo` before the terminal shows, so two views of one
  shell trade Take control (shared typing never offers it). Its upgrade and safe-mode tests start a second fixture
  core through `fixtureServer.ts` (private state, `fixtureRuntimeEnv`) on a copy of the person's package: one with
  `PERCH_WEB_DIST` pointing at a temp copy of `packages/web/dist` whose `stock:status` says a newer version (the
  catalog revision is recomputed with the exporter's `packageDigest`), one with `PERCH_MODS=off`; the real dist is
  never edited. Its 100-edit test logs `MODULE-CACHE` with the loader's registry size before and after. Its
  base-path test starts such a core with `PERCH_BASE_PATH=/proxy/e2e/7799/` on a temp web build: every stock file
  and package request stays under the base, the service worker (scope = the base) precaches `stock-ui/` and never
  `mods/package` or `mods/data`, offline the stock files still load (Chromium; WebKit reads the cache instead,
  because Playwright's WebKit fails offline fetches the worker would answer), an edited copy is never served stale,
  and a newer build (sidebar changed, catalog revision recomputed, the worker's entries re-revisioned) replaces the
  open page's stock screen and catalog on the worker's update. Its phone-screens test also checks that the phone
  gets every package `no-store`, that no cache holds one, and that a revoked phone gets 401/403 for it. Its
  regrouping test starts one Claude CLI (haiku, banner checked) and never prompts it.
  Its fault tests inject faults only at the network, on disk or in browser storage; the loader, core and socket are
  the real ones. They read the page's `mods.report` frames off its socket (`watchReports`), count live object URLs
  and intervals by period from an init script (`countLive`), and list the core's revision from a socket of the
  test's own (`coreRevision`, which also makes the core snapshot it). The load-fault test passes the page's `/ws`
  through `page.routeWebSocket`, keeping back only the core's `mods.changed` news while it makes the page fall behind,
  and holds a revision's `mods/package` requests with `page.route` until the core no longer keeps it (four newer
  revisions, `RETAINED_SNAPSHOTS`). The expired-revision test holds a swap with `trackOperation` and imports a lazy
  file of the old revision. The restart test starts its own core (`restartableCore`: `target/debug/perch-core` on
  `fixtureRuntimeEnv` state, stopped with SIGTERM and started again on the same port and state, then
  `cleanupFixtureRuntime`); its shell keeps its PID across the restart, though the restarted core gives it a new
  terminal id. The storage test blocks `Storage.prototype.setItem` from the next load on (an init script gated on a
  flag, so the session can be made first) and writes a corrupt value straight into `mod-data/e2e-esm/`. The
  100-cycle test logs `EDIT-CYCLES` with its counters at cycles 0, 25, 50, 75 and 100 and takes about 3.5 min in Chromium. Its package and the fault package use `place: "layout"`: a package with
  no `place` also opens as a dock panel, and `none` runs a hidden copy, either of which doubles every counter. The load-fault and restart tests block the
  service worker (`serviceWorkers: "block"`): in WebKit `page.route` cannot see requests the worker makes.
  `relay.check.mjs` passes the phone's relay socket through `phone.routeWebSocket` and cuts it 12 frames after a
  package edit (mid-fetch of a 60-file revision), then expects the readable error, the last good revision, the new
  revision after the phone is back, and a readable refusal of `api.exec` over the relay.
- Running existing specs on untouched copies: `PERCH_E2E_STOCK_CLONES=sidebar,tabs,status npx playwright test
  sidebar.spec.ts nav.spec.ts` (main config). `stockClones.setup.ts` clones each `stock:<name>` as
  `e2e-untouched-<name>` on the hub core, puts it in place with `use`, and before any spec checks the copy's files
  are the shipped bytes and (sidebar, status, tabs) that the copy is what the page draws. Leave out
  `stock-ui-clones.spec.ts`, which resets `use` after each test.
- `native-options.spec.ts` (same config): Claude's model, effort and permission-mode pickers with **no model
  turn**. Claude runs under a private `CLAUDE_CONFIG_DIR` (pre-approved onboarding, trust, the dummy
  `ANTHROPIC_API_KEY`, prompt suggestions left on, so the fresh Claude's greyed `Try "…"` placeholder is in the
  prompt for every send), because Claude saves `/model` and `/effort` picks as the user's own defaults;
  the spec also checks that `~/.claude/settings.json` was not touched. Use the same recipe for any probe of
  Claude commands that write settings. Codex has an equivalent: a private `CODEX_HOME` and a dummy
  `OPENAI_API_KEY` reach its TUI and pickers (choose "Use an OpenAI API key" once).
- `sub-sessions.spec.ts` (same config; needs `perch` built beside the core): a Claude lead (haiku) that a
  person has just spoken to runs `perch spawn`, the child (luna Codex; `PERCH_E2E_CHILD=claude` makes it a
  haiku Claude when Codex's quota is spent) is started in the same Workspace with its task as its first
  message, reports with `perch report`, the lead reads it with `perch list`, then `perch stop` ends it
  and the core confirms. One lead turn to start and read, one to stop, one child turn. The assertions read
  the core's SQLite file, not the models' words. Verified once with a haiku child; the Codex child's launch
  and first message were seen but its turn hit a usage limit. What a model will not do on cue (a spawn on
  a message-opened turn, the fifth child) is tested without models in `server/sub_sessions.rs`,
  `db/sub_sessions.rs` and `agent_runtime.rs`.
- `agent-runs.spec.ts` (same config; needs `perch` beside the core; run outside a Perch shell; haiku only, three lead
  turns and one short child turn): a picker-launched Claude lead starts a haiku child; `/clear` begins a fresh run
  (the child stays in the first one, and the new lead's `perch stop` of it is refused); the person `/exit`s Claude and
  types `claude --resume <first conversation>` into the same shell, which is issued its own identity through the
  shell's launcher (`launch_pid`, replacing the picker's) and gets the first run and the child back; `perch whoami`
  from it names the new incarnation. Asserts the SQLite file, and that no `perch_agent_` secret reaches the chat, `ps`
  or the core log. Verified live 2026-11-09 (Claude 2.1.319). Provider semantics seen directly: Claude `/clear`
  gives a new `session_id` (`SessionStart` source `clear`) and `--resume` keeps the id; Pi `/new` gives a new
  session file/id and `--session` keeps it. Codex and OMP resets are not probed.
- `agent-mail.spec.ts` (same config; needs `perch` beside the core; `PERCH_E2E_CHILD=claude` for a haiku
  child, the default is a luna Codex one): a haiku lead starts a child whose task is `perch send` to the
  lead; the window stays open on the lead (its view holds the input lease; delivery rides it unchanged);
  the child's message and its status note reach the lead (delivered, confirmed by Claude's own
  hook, one wake spent) and the chat shows both as `Perch message from` and `Perch status
  from` user rows, then the lead messages the idle child, which acts on it (its `perch report` carries
  the marker). Assertions read the core's SQLite file; nothing may be left `delivering` or `unconfirmed`.
  The same run checks slice 6: the sidebar row of the child is nested under its lead's (`data-sub-session`)
  and the family strip above the composer shows the child's state, `Reported: <marker>` (its own report)
  and `You wrote` for the lead's message. Verified (haiku child, ~30 s each run); Codex, Pi and OMP receivers
  were not run live, nor a child waiting on a person (jsdom and a booted-core WebSocket test cover it).
- `family-actions.spec.ts` (same config; needs `perch` beside the core): a haiku lead starts a haiku child with a
  slow four-`sleep` task; from the lead's open chat the person steers it mid-turn (`Steer confirmed` needs
  Claude's transcript to show the text absorbed into the turn, which waits for the running tool call), messages
  it once idle (queued, delivered as the person's, no wake), interrupts a second slow turn (confirmed, session
  kept) and stops it after a confirm step. Four haiku turns. Run it outside a Perch shell (as the native specs).
  Not covered live: Codex, Pi and OMP steer or interrupt, and a lead's own `perch steer`/`perch interrupt`
  (unit and HTTP tests in `crew_actions.rs`, `server/crew_actions.rs`, `native_ui`).
- `agent-mods.spec.ts` (same config; needs `perch` beside the core): a haiku lead is asked to make Perch show a todo
  list; it reads `perch guide`, `perch mod api` and `perch mod examples`, writes a mod, enables it and opens it. The
  test asserts the mod's `main.js` in the core's folder, then that the page draws the heading, an input and a button
  outside the chat and that adding an item shows it. The same lead is then asked to turn Perch into an IDE: the test
  reads the layout file it wrote (files, panes and git blocks) and expects the page to draw `layout-files`,
  `layout-canvas` and `layout-git`. Two lead turns, about 50 s in the verified run. The screenshot in the run's
  artifacts shows the git block as the explorer, which is stock behavior in a folder that is not a git checkout (`WorkspaceTools`), and one of the agent's
  five commands in the second turn failed before it recovered: the test checks the result, not the path.
  Its second test is the agent-only stock loop, in two turns of a new haiku lead with only `perch mod guide` and the
  CLI: copy `stock:status` as `my-status` and put it in place (checked untouched: `clonedFrom`, the copy drawing
  "Local"), then add a button with a given label that opens Settings through the SDK's command runner; the test
  clicks the button, checks Settings opens, the stock bytes are unchanged and the copy imports only `react`,
  `react-dom`, `@perch/sdk` and its own files. It builds `perch` itself.
  Its third test is the deep edit in four staged turns of one haiku lead (same tools; a shell session in the same
  project is started first so two agents are listed): (1) a `stock:sidebar` copy with a "By agent" organize choice,
  agent then project then session (the window has that choice saved before the turn, so the agent's `perch mod dom`
  shows its groups); (2) group headings that fold on click, Enter and a CDP touch tap, and a touch hold on a row
  that still opens Perch's row menu; (3) a `stock:dialog` copy with a line of text, checked while a second window
  keeps a project's Instructions (opened from the sidebar copy's menu) open, then opened again from the first
  window; (4) a `stock:chat` copy with a line above the composer, through which the next turn ("pong") is sent.
  After each stage the agent's saved `perch mod check`/`dom` output is asserted, Perch's own files of the three
  screens are compared byte for byte with the start, and every copy imports only React, `@perch/sdk` and its own
  files. When the agent's saved output lacks what it was asked to see, the test tells it so in a follow-up turn
  (at most two per stage), logged as `FOLLOW-UP` and kept as an annotation. About 6 minutes.
  Run it outside a Perch shell: strip `PERCH_*` and the Perch wrapper directory from `PATH`.
- `reporter.spec.ts` (same config; needs `perch` beside the core, and a signed-in `claude` on the PATH the core
  runs with): a haiku lead starts a haiku child whose task is one command and one sentence; the child does
  not run `perch report`; the test reads `session_summaries`, `reporter_runs` and the lead's note from SQLite
  (a `summary` by `claude-haiku-4-5` that names the word the command printed, one call, `Summary by claude-haiku-4-5` in the note)
  and the strip. Three short haiku turns; the third is the summary call. Not covered live: the Codex runner
  and Pi/OMP children. The product defaults are the aliases `haiku` and `gpt-6-luna`; every spec that starts
  children writes the fixture's `settings.json` through `pinReporterModels` (`cheapModel.ts`) so the reporter
  also runs `claude-haiku-4-5` and `gpt-5.6-luna`, as the rest of the suite does.
- `suggestions.spec.ts` (same config; needs `perch` beside the core; run outside a Perch shell; haiku only, three
  lead/child turns and the reporter's call): the fixture leaves "Let leads start sub-sessions without asking" at its
  default (off; the other specs turn it on through `pinReporterModels`). A haiku lead runs `perch suggest`; the card
  appears and nothing is started (SQLite); the test presses Start, and `suggestions.state` becomes `started` with one
  sub-session; the haiku child's `perch send` reaches the lead, whose chat draws a sender card (`data-from-session` is the
  child, no envelope text on the page); then the lead runs `perch read <child> --turns 2 > file` and the file holds the
  child's turn (the task wrapper, `Did: perch send …`, its last words, no `────` rule). Passed once in 30 s. Earlier
  runs failed for model reasons only (the lead ran the suggested task itself, and a wrong assertion about how a child's
  first message reads); **found live:** Claude records a delivered banner between `<pasted_content id="N">` lines, which
  the first card parser did not look through. Not covered live: Do it here, Options, Start all, Codex/Pi/OMP receivers
  for sender cards, and inbound control (slice 9d: unit, HTTP/socket and jsdom tests only). `agent-mail.spec.ts` now
  looks for sender cards instead of envelope text and was **not re-run** after that change.
- `memory-live.spec.ts` (same config; needs `perch` beside the core; run outside a Perch shell, e.g. `env -u
  PERCH_SESSION -u PERCH_SHELL -u PERCH_TOKEN -u PERCH_USER_ZDOTDIR npx playwright test -c native-composer.config.ts
  memory-live.spec.ts`; haiku only, two short turns): a lead runs `perch memory write live-check.md`; the file is under
  the Project's folder in the fixture, and `.provenance.json` records the lead's session as an `agent` author; a second
  turn runs `perch memory read` and its reply holds the marker. Passed once in 18 s (2026-11-11, Claude 2.1.322). Not
  covered live: Codex, Pi and OMP writers, a second session reading, concurrent writers.
- `needs-you.spec.ts`: question persistence/resolution and By status navigation.
- `context-bridge.config.ts`: isolated Chromium/WebKit real Claude probe: one Haiku turn for Perch's own dialog and
  one more for an untouched clone of `stock:context-bridge` chosen in its place (each test has its own core).
- `federation.spec.ts` E8 (main config) creates a remote Claude session over the protocol (the store's
  `session.create` with the host, not E2's picker path) and peeks it through a package: no prompt is sent. It runs
  before E2, the known base failure, so the serial run reaches it.
- `cd e2e && npx playwright test -c remote-workspace.config.ts`: isolated
  headless metadata/files/drafts/surfaces/reconnect plus `remote-git.spec.ts`
  Git/review/worktree checks, with no paid turns. Ports :7794/:7795 and all
  state live under `/tmp/perch-e2e-remote-workspace`; no existing server reuse.
  Loopback federation is **not** actual Linux-host D3 acceptance. The bounded
  [real Linux resource probe](evidence/remote-workspace-2026-10-23.md) is
  additional evidence, not runtime/D3 certification.

## Notification regression (macOS)

`npm run test -w @perch/web -- src/notifications.test.ts src/store.test.ts src/components/SettingsPage.test.tsx`
checks native permission routing, explicit-only consent, browser fallbacks,
asynchronous delivery failure and independent sound. After `npm run build`,
`cd e2e && npx playwright test -c provider-config.config.ts notifications.spec.ts`
checks desktop/mobile Settings in Chromium and WebKit with a fake IPC seam:
no real permission prompts, System Settings launch, notifications or paid turns.

The read-only native probe needs its own bundle identity (unbundled execution
is deliberately refused). From the repository root:

```sh
cargo build -p perch-desktop --example notification_probe
python3 - <<'PY'
import pathlib, tempfile, shutil, plistlib, subprocess
with tempfile.TemporaryDirectory(prefix="perch-notification-probe-") as root:
    app = pathlib.Path(root) / "Perch Notification Probe.app"
    contents = app / "Contents"
    binary = contents / "MacOS" / "notification_probe"
    binary.parent.mkdir(parents=True)
    shutil.copy2("target/debug/examples/notification_probe", binary)
    with (contents / "Info.plist").open("wb") as out:
        plistlib.dump({"CFBundleIdentifier": "dev.perch.notification-probe",
                      "CFBundleName": "Perch Notification Probe",
                      "CFBundleExecutable": "notification_probe",
                      "CFBundlePackageType": "APPL", "LSUIElement": True}, out)
    subprocess.run(["codesign", "--force", "--sign", "-", str(app)], check=True)
    subprocess.run([str(binary)], check=True, timeout=35)
PY
```

This exercises the production delegate, real native settings callback and
rejection of unauthorized sends, with no window, core, daemon, live consent or
alert. It does **not** prove banner presentation, click navigation or the
installed app’s permission state. For that, rebuild the bundled app, use Settings
→ Notifications → Allow notifications / Send test, then verify a banner and
click-to-open with another session selected. Do not automate changes to the
installed app’s permissions. Focus and notification summaries require manual
inspection; authorization alone does not certify visible banners.

## Native shortcut regression (macOS)

`cargo run -p perch-desktop --example close_shortcut_probe` uses the production
app menu, real hidden main/child WKWebViews and main-only IPC permissions. It
checks every Settings-derived native binding (including leader/resize follow-ups),
focus-once routing for queued tab cycles, unknown-key pass-through, Close Tab rebinding,
disabling, reloads, invalid/stale updates and duplicate menu entries/events,
including whether an old key is still consumed. Uninterrupted sequences use the
production hide/show/focus/close paths without repairing focus before the next
key, including return to a main DOM input that was already focused while the
browser remains visible in a split. Input, textarea, contenteditable and
same-origin nested-frame selections survive native focus round trips; typing
then reaches the original caret, while
main-view typing never reaches hidden pages. Showing/resizing a page and closing
a background page must not steal focus. It starts
only a temporary loopback HTML server on a free port: no core, daemon, shells,
installed app state or external sites. Its windows cannot activate. The web
suite's `keybinds.close.test.tsx` covers the mounted listener, every registered
global command, effective native wire fixtures, tab cycling, all existing close
targets/guards, Settings recording and native/DOM ownership.

Native leader/resize modes are resolved and expire entirely in Rust from
the Settings-derived table (JS only receives resolved actions), so there is no
native active-mode hint. macOS menu keys (Quit, Hide, Minimize, Fullscreen,
standard editing) cannot be claimed and are refused by the recorder.

The native probe invokes the installed event-monitor handler and AppKit menu
matching with native events, not hardware keystrokes. It does not certify global
OS dispatch, monitor delivery by the OS event pump or non-US keyboard layouts.

## Window chrome regression (macOS)

`cargo run -p perch-desktop --example window_chrome_probe` builds the main window with the app's
own options (overlay title bar, hidden title, transparent) but hidden, unfocused and with the
app's activation policy prohibited, then drives it through the production capability file:
it measures the real AppKit close/minimise/zoom buttons (default spot, a layout's
`trafficLights`, reset), toggles maximise and minimise, takes a WKWebView snapshot
(`api.screenshot()` in the app) and checks that `plugin:window|destroy` stays refused before
closing the window. No core, daemon, shells, installed app or external network. It does not
show how the lights look to a person (colours, hover glyphs) or the vibrancy behind them.

For a real key press in a windowed run (isolated `PERCH_DB`/`PERCH_HOSTS`/`PERCHD_DIR`/`PERCH_SETTINGS`, a
mod that writes a file from `api.command`, and a `keys.json` binding to it), post the key to your
own pid with `CGEvent.postToPid` rather than a global keystroke, which lands in whichever app is
frontmost (often the installed Perch). Capture only your window with `screencapture -x -o -l <id>`.

## Settings-resolved command regression

`npm run test -w @perch/web -- src/keybinds.scopes.test.tsx src/keybinds.test.ts src/editorKeymap.test.ts src/keybinds.close.test.tsx`
checks the effective registry on both platforms, recording/conflict scopes,
leader/resize overrides and cancellation, mounted CodeMirror save/find and global
key ownership, Navigator, folder confirmation and dynamic hints. Ordinary editing,
typing, Enter/Tab/arrows, Escape and terminal input remain native interactions.

## Isolated manual probes

Point **all four** at scratch paths: `PERCH_DB`, `PERCH_HOSTS`,
`PERCHD_DIR`, `PERCH_SETTINGS`. Default settings and the default daemon
belong to the installed app. Leaked test PTYs can exhaust its file descriptors.
For a desktop probe, `PERCH_DESKTOP_TEST=1` creates a hidden, unfocused window.

Restore settings even on failure. Stop the probe core, its
`__perchd serve --dir <scratch>` daemon and its children afterwards. Scope
cleanup to your own paths/processes; do not use broad kill commands. Remote
probes need an explicitly authorized host and confirmed cleanup, never a
placeholder hostname or a private host discovered on this machine.

**Machine add over real ssh.** `scripts/machine-over-real-ssh.sh` starts a user-mode `sshd` on
a free 127.0.0.1 port (key login only; sessions and the test process both run with temp `$HOME`s, so no
control socket reaches your real `~/.ssh`), runs the ignored
`machine_install` test through real OpenSSH (probe, upload, atomic replace, shared control master),
then stops the sshd and the master, including on build/test failure or interruption.
`python3 scripts/check-machine-ssh-failure.py` injects a failed Cargo build and checks that its diagnostic
is visible, no stale executable runs, and the fixture directory/processes are removed.
These checks prove the ssh plumbing, not a remote host: a loopback substitute is not evidence for the
remote-workspace gates above.

Claude normally bypasses permissions here: use `AskUserQuestion` to exercise
Needs You. Bracketed paste wraps the prompt in `<pasted_content …>`; hook
assertions match with `contains`, not equality.

## Native client (`crates/perch-native`)

```sh
cargo test -p perch-native            # everything below
cargo test -p perch-native --lib      # state reduction, actions, frames, launch correlation and reconnect against a stand-in core, hand-off URL; tab and split model, key resolution, command palette filtering, terminal settings
cargo test -p perch-native --test sidebar_render    # headless GPUI render of the sidebar (project and By status views, nested rows); no window opens
cargo test -p perch-native --test workspace_render  # the window drawn offscreen: tabs, a split with different content in each pane, the palette, the terminal settings, attention on a tab, keys.json and chosen keys
cargo test -p perch-native --test terminal_session  # a real core as a child process
cargo test -p perch-native --test workspace_session # two shells in a split against a real core, and the settings round trip
```

Run `cargo test` for this package on its own: building `perch-core` together with GPUI changes how
`serde_json` orders keys and fails three unrelated core tests.

- Nothing opens a window, takes focus or calls `open`. The render tests draw through GPUI's test
  platform into a texture (set `SHOT=<folder>` to save each frame as a PNG); keys go through the window's
  own `dispatch_keystroke`, so the dispatcher that runs before the terminal is what is tested. The
  hand-off test checks the URL and never runs the opener.
- `terminal_session` boots a core in a scratch directory (database, hosts, settings, daemon and
  `HOME` all private) and starts only plain shells: a shell is signed in, then watched appearing, changing
  state and being started from the sidebar's follower. It stops the core, shells and daemon and checks each by
  PID; on failure it keeps the scratch directory and says so. Agent providers are covered by unit tests of the
  frames built, never by a real turn.
- `workspace_session` runs the same way and drives the whole window: a shell in a tab, `cmd-d` starts a second
  shell through the core and splits it in, typing through the window reaches only the pane with the keyboard,
  each pane's `stty size` equals its own fitted size (narrower than the single pane before the split), closing
  the tab ends the session and the other pane refits to the whole area. It also changes the terminal settings
  through the core's settings route and checks the follower learns them and the core saved them. The window is
  2000 px wide so each half is a normal terminal.
- A plain shell never ends an agent turn, so `unseen` (Done) and the core clearing it on viewing cannot be
  produced against the real core without a paid turn. `terminal_session` checks that viewing a session is
  accepted and the follower keeps following; the Done hold, alerts and needs-you order are unit tests of the
  reducer fed the same messages. A launch on another computer is correlated only by a stand-in core, since the
  hub's `session.created` names no request.
- A shell that was used stays Working in the core for good (only an agent's turn ends), so a test cannot wait for
  Idle after typing. GPUI's test clock is simulated: a timer in the window fires as soon as the test runs the
  executor, so anything that must wait for a real process uses real time.
- "Open in Perch" sends `perch://open?place=…&session=…`. `crates/perch-desktop/src/open_url.rs` (link parsing,
  and holding a link that launches the app until the page claims it) and `packages/web/src/openRequest.ts`
  (acting on it, once the session is listed) have their own tests; neither opens the system opener.
  `cargo test -p perch-desktop` needs the web bundle to exist, as every build of that crate does.
- A plain shell inside a project has no sidebar row (Show terminals off), so `terminal_session` starts shells in
  Chats; the render tests give their sessions an agent provider for the same reason.
- Remote computers go through the core's hub on the same socket, so they are tested as messages in
  `sidebar.rs` and not against a real remote.

## Released-only cleanup and fixture teardown

Build the developer CLI (not an installed app update):

```sh
cargo build -p perchd --bin perch
target/debug/perch ps
target/debug/perch cleanup --dry-run
target/debug/perch cleanup                  # confirms the exact preview
# Noninteractive execution requires explicit --yes.
```

`perch daemon ls|read|send|run|wait|kill` drive terminals from any program (`crates/perchd/tests/terminal_cli.rs`; the
`api.perch` path through a real core is the mods e2e `hc` test). `perch daemon ps` and `perch daemon cleanup` are the same commands under their new home; only
`ps`, `cleanup` and `release` keep a bare alias (`perch list` is the agent's own run, and `perch
daemon list` the daemon's). `perch whoami`, `report`, `guide`, `spawn`, `list` and `stop` are for agents; the e2e that exercises them
(`instructions.spec.ts`) needs `perch` built beside the core (`cargo build --workspace`, or
`-p perchd --bin perch` too): a core with no `perch` beside it gives agents no identity and no
pointer, by design.

**Packaged `perch`** (`e2e/packaged-perch.check.mjs`, zero tokens, no browser): after
`cargo build --release -p perchd --bin perch && cargo build -p perch-core` and a local bundle
(`cd crates/perch-desktop && npx --yes @tauri-apps/cli@2 build --bundles app`), run
`node --experimental-strip-types e2e/packaged-perch.check.mjs [perch.app|dir]`. It requires an
executable `perch` beside the package's own executable, checks `perch whoami` and `guide` outside a
session, then puts that `perch` next to a headless `perch-core` (the lookup the app makes beside
its own executable), starts a terminal session under private state and requires `perch whoami`
in it to name the session without echoing the token. The desktop app embeds its core and has no
headless mode, so the check does not launch the app; open the built app once for a visual pass
(`codesign --verify --deep --strict` on the bundle also passes with `perch` inside it).

These commands connect only; they never start a missing daemon. Older daemons
can be listed, but cleanup refuses without `released-cleanup.v1`. Do not restart
the installed daemon to enable it: upgrade during a planned session shutdown.
Retained and unknown sessions are protected, including unfocused agents and
their subprocesses. This does not discover arbitrary old leftovers by age,
visibility, cwd, process names or memory usage. Production sessions currently
stay retained; explicit release is wired to private test-owner teardown only.
Cleanup preserves history and provider transcripts. Detached/escaped processes
are not swept; original-group confirmation is not whole-tree attribution.

Standalone fixture cores use `fixtureRuntimeEnv()` for private state and owner
metadata captured at core startup (never forwarded into PTY/provider children).
Only after the core exits does `cleanupFixtureRuntime()` explicitly release its
owned sessions, perform verified group cleanup and wait for the private daemon
idle exit (`PERCHD_IDLE_EXIT_SECS=1`). It refuses legacy, differently owned or
unconfirmed runtime state and preserves scratch evidence on failure. Never kill
the daemon first: its PTYs intentionally survive it. Intermediate core restarts
must not release sessions. Main Playwright web servers use the same final
teardown wrapper and fresh hub/remote state, with no existing-server reuse.
Focused configs must likewise isolate all four state paths; a killed test
runner/host cannot guarantee finalizers ran and is never itself a release.

No paid provider turns are needed for the lifecycle regression:

```sh
cargo build -p perch-core
node --experimental-strip-types e2e/fixtureRuntime.check.mjs
node --experimental-strip-types e2e/fixtureRuntime.check.mjs --crash-core
cargo test -p perchd
```

The Node check uses a real core, persistent shell and private daemon; it checks
watcher-disconnect protection, owner capture, refused unknown metadata and
final cleanup, both normally and after forcibly killing its exact private core. Rust regressions cover stale previews/reclaims, sibling scopes,
HUP-resistant children (including leader-first exit), escaped-group refusal,
process-group confirmation, history preservation and connect-only behavior.

## Rendering, performance and packaging

- `node e2e/memory/memory.mjs` after a web build checks footprint and WebGL
  context replacement/release and terminal disposal.
- `node e2e/visual/visual.mjs` checks Chromium/WebKit visual equivalence for
  style-only refactors. Intentional design changes need reviewed expectations,
  not an assertion of unchanged pixels.
- Production uses WebGL; WebDriver uses DOM for `.xterm-rows` assertions.
  Hidden-window measurements are not actual interactive presentation timing.
- Web builds update open clients through the service worker; allow about a
  minute. A core/desktop rebuild is needed for Rust changes.
- Desktop installers: `npm run build`, then
  `(cd crates/perch-desktop && npx --yes @tauri-apps/cli@2 build)`.
  `scripts/reinstall-desktop.sh` installs/reopens the user's macOS app and
  redeploys the user's Cloudflare relay (`PERCH_SKIP_RELAY=1` skips that):
  use only when that is intended, not as a test-isolation shortcut.
- iPhone app (`ios/`, needs Xcode and `brew install xcodegen`): `cd ios &&
  xcodegen`, then `xcodebuild -project Perch.xcodeproj -scheme Perch
  -destination 'platform=iOS Simulator,name=iPhone 17' test`. Unit tests cover
  link parsing; `PerchUITests` is a live pairing probe, skipped unless
  `TEST_RUNNER_PERCH_ADDRESS` and `TEST_RUNNER_PERCH_CODE` are set: a fresh
  code from `device.pair.start` (keep that socket open meanwhile) and either
  the core at a non-loopback address (this Mac's LAN IP and port; loopback
  no longer skips pairing: nothing is tokenless) or a whole relay link (`http://127.0.0.1:<port>/#r=…` from
  a `wrangler dev` relay set up as in `e2e/relay.check.mjs`). Use isolated
  state and uninstall the app first. 2026-11-04: passed on Wi-Fi and through
  a local relay (iOS 27 simulator); Tailscale and the QR camera need a device.
  For a device, set `DEVELOPMENT_TEAM` (and a bundle id of your own,
  `PERCH_BUNDLE_ID`) in the git-ignored `ios/Perch/Local.xcconfig`, open the
  project in Xcode and Run. Editor/pi-lens diagnostics need the iOS SDK:
  `brew install xcode-build-server`, then in `ios/`, `xcode-build-server
  config -project Perch.xcodeproj -scheme Perch` and one build.
- Release workflow builds draft macOS/Linux packages and Linux daemon binaries.
  Build support is not packaged-install evidence. macOS is ad-hoc signed, not
  notarized. Do not publish/tag/push without instruction.

## Known limitations to recheck

- Legacy core `daemon::terminate()` still confirms leader exit, not complete
  group exit. Released-only cleanup does not use that confirmation. Follow-up:
  capability-gated owned Stop reusing the verified group-stop engine; do not
  treat old-daemon leader exit as group-confirmed destructive cleanup.
- Escaped/daemonized descendants cannot be universally attributed. Known
  separate groups are refused; already escaped unknown processes need manual
  review. These checks are macOS evidence, not fresh Linux certification.

Cleanup validation (2026-10-27): the shared-server Chromium settings smoke
passed. The standalone `provider-config` browser spec still timed out at browser
context teardown after the reorder; no core/daemon from that rerun survived.
It is not a passing provider UI acceptance check. The 300 ms synthetic usage
probe failed once under concurrent browser/build load, then passed alone and
in a fresh full core run; do not hide this timing sensitivity.

Relay (`relay/`, `perch-core/src/relay/`, `web/src/relay/`):
`node --experimental-strip-types relay/check.mjs` checks host replacement,
close handshakes and closing-socket routing without network or account access.
`cargo test -p perch-core --lib relay`
(in-process relay stand-in, tamper and stranger cases) and `npx vitest run
src/relay` (shares `wire.fixture.json` with Rust). `node
--experimental-strip-types e2e/relay.check.mjs` runs a real `wrangler dev`
Worker, a core and a browser, all private under the temp dir; needs `npm install`
in `relay/` and a built web app and `perch-core`. Set `PERCH_E2E_WEBKIT=1` to
exercise WebKit instead of Chromium. It chooses its 20-file package for the phone's header
(`stock:mobile-header`), checks the phone keeps Perch's own until "Phone screens from my packages" is turned on in
its Settings > Mods, then that the package's modules, CSS, asset and data cross the tunnel. It also chooses an
edited copy of `stock:select` (a computer's screen) and proves the phone's Settings > Mods, through the tunnel,
never runs it, says so, and puts Perch's own dropdown back. The
check requires the actual phone data
socket to connect, survive reload and recover after host replacement and a
relay off/on cycle; rendering the phone shell alone is not a pass. Set
`PERCH_RELAY_CHECK_URL` to an explicitly authorized deployed relay to exercise
that deployment with a fresh, private room. Never use your real `~/.perch`
for this check. Set `PERCH_RELAY_CHECK_SOAK_MS=100000` to check that the
sealed session stays usable across idle/heartbeat periods before replacing the
host; valid values are 0–600000 ms. Host replacement must close the old guest
sessions so they perform a new encrypted hello, not retain a stale open socket.

Disconnected browser/phone and pairing screens expose **Connection details →
Copy diagnostic report**. The report distinguishes a missing relay link, browser
storage/encryption availability, the relay WebSocket, encrypted hello and Perch
data socket; it preserves the last failure during retries. It contains no URL,
room id, encryption key, pairing code, device token or workspace payload. A
12-hex-character `roomFingerprint` (truncated SHA-256 of the public room id) lets
support compare phone and host identities without sharing the QR link. The
relay check verifies the offline-host close code and report redaction, and saves
phone/desktop diagnostic screenshots under `/tmp/perch-connection-*.png`.
Focused checks: `npm run test -w @perch/web -- src/relay
src/components/ConnectionDetails.test.tsx src/pairing.test.ts`.

2026-11-02: `device-pairing` timed out at its post-reload typing step (the
reply to `after-phone-reload` never arrived), with and without the relay
installed; not caused by it, not diagnosed.

Recorded 2026-10-02, not blanket exemptions for new failures:
- OpenCode is deliberately absent on this dev Mac; do not install it for tests.
- `paired-phone-flows` intermittently reports unconfirmed review delivery (not seen on 2026-11-09: two passes
  alone after the fixes noted above).
- `ssh::tests::mux_control_path_…` can fail in the full run and pass alone.

Alpha evidence must name candidate commit, platform/provider versions, command,
result, retained report and remaining limits; see [PUBLIC-ALPHA](PUBLIC-ALPHA.md).
