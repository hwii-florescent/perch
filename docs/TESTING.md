# Testing and development

## Normal checks

```sh
cargo test -p perch-core                 # add a substring for focused tests
cargo test -p perchd
npm ci && npm run build                  # shared + web; axum serves web/dist
npm test                                # Vitest
cargo fmt --check
cargo clippy --workspace --all-targets   # add no warnings
cargo run -p perch-core -- --port 7788
cargo run -p perch-desktop
```

These are the existing npm scripts/CI commands, not a decision to delete the
pnpm lockfile. Both lockfiles exist; package-manager consolidation remains open.
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
  earlier "working" check also races the process snapshot).
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
- `native-options.spec.ts` (same config): Claude's model, effort and permission-mode pickers with **no model
  turn**. Claude runs under a private `CLAUDE_CONFIG_DIR` (pre-approved onboarding, trust, the dummy
  `ANTHROPIC_API_KEY`, prompt suggestions left on, so the fresh Claude's greyed `Try "…"` placeholder is in the
  prompt for every send), because Claude saves `/model` and `/effort` picks as the user's own defaults;
  the spec also checks that `~/.claude/settings.json` was not touched. Use the same recipe for any probe of
  Claude commands that write settings. Codex has an equivalent: a private `CODEX_HOME` and a dummy
  `OPENAI_API_KEY` reach its TUI and pickers (choose "Use an OpenAI API key" once).
- `sub-sessions.spec.ts` (same config; needs `perch` built beside the core): a Claude lead (haiku) that a
  person has just spoken to runs `perch spawn`, the child (luna Codex; `PERCH_E2E_CHILD=claude` makes it a
  haiku Claude when Codex's quota is spent) is started in the same Nest with its task as its first
  message, reports with `perch report`, the lead reads it with `perch list`, then `perch stop` ends it
  and the core confirms. One lead turn to start and read, one to stop, one child turn. The assertions read
  the core's SQLite file, not the models' words. Verified once with a haiku child; the Codex child's launch
  and first message were seen but its turn hit a usage limit. What a model will not do on cue (a spawn on
  a message-opened turn, the fifth child) is tested without models in `server/sub_sessions.rs`,
  `db/sub_sessions.rs` and `agent_runtime.rs`.
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
- `needs-you.spec.ts`: question persistence/resolution and By status navigation.
- `context-bridge.config.ts`: isolated Chromium/WebKit real Claude probe.
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

Claude normally bypasses permissions here: use `AskUserQuestion` to exercise
Needs You. Bracketed paste wraps the prompt in `<pasted_content …>`; hook
assertions match with `contains`, not equality.

## Released-only cleanup and fixture teardown

Build the developer CLI (not an installed app update):

```sh
cargo build -p perchd --bin perch
target/debug/perch ps
target/debug/perch cleanup --dry-run
target/debug/perch cleanup                  # confirms the exact preview
# Noninteractive execution requires explicit --yes.
```

`perch daemon ps` and `perch daemon cleanup` are the same commands under their new home; only
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
exercise WebKit instead of Chromium. The check requires the actual phone data
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
- `paired-phone-flows` intermittently reports unconfirmed review delivery.
- `ssh::tests::mux_control_path_…` can fail in the full run and pass alone.

Alpha evidence must name candidate commit, platform/provider versions, command,
result, retained report and remaining limits; see [PUBLIC-ALPHA](PUBLIC-ALPHA.md).
