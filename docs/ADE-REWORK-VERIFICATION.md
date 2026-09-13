# ADE rework verification

Status: in progress. The complete contract remains `goals.md` and `SPEC.md`.
No acceptance exception has been approved. No rework phase is complete yet.

## Native review delivery checkpoint — 2026-09-12

Pi/OMP packets now use the same native connection as the composer. The target
resolver selects the session's CLI owner before legacy message history and
rejects a different requested provider. A Git view borrows input only when no
other browser owns it; enqueue validates the existing lease generation, then
releases a borrowed lease. The existing atomic prompt/packet settlement writes
uncertainty before enqueue and delivery after native acceptance. Retries reuse
the frozen operation and cannot replay its prompt. Unsupported native providers
are rejected during preview, before creating an unusable packet.

`cd e2e && npx playwright test --config=native-review.config.ts` passed all four
real Pi/OMP cases in headless Chromium and WebKit (43.7 seconds). Each case:

1. Registers a disposable Git workspace, opens the native CLI, and sends a
   real initial prompt from UI mode.
2. Adds two line-anchored comments and previews them in a separate 390 × 844
   phone browser. The session picker identifies the native provider.
3. Attempts delivery while the desktop owns input, observes the refusal, and
   confirms no prompt reached the native conversation.
4. Releases desktop control, sends the packet from the phone, and observes
   the CLI acknowledge both notes in the desktop conversation.
5. Retries the same packet and waits for a correlated server receipt. All
   attempts retain one packet/operation ID, and the native user count stays
   at two: the initial prompt and one review packet.
6. Confirms unchanged native PID/session and source bytes, then reacquires
   desktop input, proving the Git view released its temporary control.

Screenshot review covered the populated phone packet/delivery view and desktop
native conversation alongside the diff. Private captures are under
`.impeccable/review/native-review-{pi,omp}-{mobile,desktop}-{chromium,webkit}.png`.
The phone session selector needed an explicit accessible name; this was fixed
at the shared select and the interaction rerun successfully. No page errors
occurred. Tests clean up only their own core, native tmux session, and workspace.

Validation: 254 core tests plus two protocol tests, 222 web tests, production
build, formatting, and Clippy with the five existing warnings passed. Logs:
`/tmp/perch-native-review-final-core.log`,
`/tmp/perch-native-review-web-tests.log`, `/tmp/perch-native-review-build.log`,
`/tmp/perch-native-review-final-clippy.log`, and
`/tmp/perch-native-review-browser-final.log`.

V-08 remains partial across the complete provider requirement: native Pi/OMP
are verified, while native Claude Code/Codex/OpenCode are still pending. This
loopback phone check does not establish secure pairing or remote delivery.

## Native Pi/OMP UI checkpoint — 2026-09-12

Implemented directly in the moved checkout after reading `refactor_logs.md`;
no agents were spawned. Testing ran entirely in headless browsers.

`native_ui/pi-extension.ts` loads into the actual interactive Pi/OMP process.
Native session entries and message events supply the transcript, and native
`sendUserMessage`/`abort` APIs control it. Rust validates the existing terminal
input lease, journals each operation before enqueueing, and preserves uncertain
delivery across disconnect. Native receipts deduplicate an operation within
the CLI. History/frame/command/client limits are explicit; streaming no longer
rescans every old turn. Native hidden custom messages are excluded, matching
the CLI's display flag. The bridge does not read or export provider authentication files or environment.

The live continuation capture originally changed only lifecycle state, which
made Pi reattach fail. It now updates the live runtime handle under the same
operation lock. OMP's native follow-up delivery option queued an idle prompt;
the bridge now uses normal prompt flow when idle and follow-up while running.
Native status prevents a terminal repaint from falsely changing Done to
Working. UI mode displays the correct provider and preserves composer drafts
across view changes; stopped CLIs disable the composer.

Observed real interaction for each provider in Chromium and WebKit:

1. Start the installed CLI through Perch's workspace picker.
2. Switch to UI and read a unique sentinel using the provider's real file tool.
   Inspect its native tool call, result, and assistant response in the web view.
3. Switch to CLI, run `/reload`, then type a follow-up that recalls the token.
   Pi reloads its extension and reconnects the bridge. OMP's built-in command
   reports `Plugins reloaded.` and retains CLI extensions. Both preserve the
   native conversation and accept the next turn.
4. Switch repeatedly while preserving an unsent UI draft.
5. Kill only the fixture Perch core with SIGKILL, restart against the same
   isolated DB, and reload the browser. The native PID, native session file,
   conversation, and logical agent key remain identical. The PTY attachment
   ID is allowed to change when the core recreates its transport.
6. Connect a separate 390 × 844 browser to that session. Its composer is
   disabled while the desktop owns input. Release desktop control, take it on
   the phone, and send a third real prompt. Both views show the same native
   response. Release phone control and regain it on desktop.
7. Start a fourth native turn calling bash with `sleep 20`; cancel it through
   the phone's Cancel turn button. Both native UI views return to Ready
   within the 10-second assertion window, without the requested final reply.
8. Confirm no page errors or horizontal overflow and explicitly stop the
   fixture CLI. Cleanup addresses only fixture-owned tmux sessions.

Validation:

- `cargo test -p perch-core`: 253 core tests plus two protocol tests passed.
  The workspace suite also passed before adding the final viewer-scope test.
- `cargo clippy --workspace --all-targets`: five existing warnings; no new
  warning. Formatting and production TypeScript/Vite build passed.
- `npm test -w @perch/web`: 222 tests passed. Added coverage includes native
  hidden messages, bounded tool data, duplicate dispatch, session-scoped
  subscriptions, wrong-session acknowledgements, and no reconnect resend.
- Rust bridge tests cover partial frames interrupted by cancellation, frame
  size rejection, disconnect without replay, subsequent controls after
  reconnect, continuation capture, and stale input-lease rejection.
- `cd e2e && npx playwright test --config=native-ui.config.ts`: four real
  Pi/OMP tests passed in Chromium/WebKit, including phone control/prompt and
  native turn cancellation (final run: 1.4 minutes).
- `cd e2e && npx playwright test --config=provider-config.config.ts`: all four
  native/configured-provider catalog and persistent-pane regressions passed.
  Final captures are `.impeccable/review/native-ui-{pi,omp}-{chromium,webkit}.png`
  and `native-ui-{pi,omp}-mobile-{chromium,webkit}.png`. They remain private.

Logs are in `/tmp/perch-native-ui-{core-final,workspace-tests,clippy,web-final,build}.log`
and `/tmp/perch-native-ui-cancel-verified.log`; the catalog regression log is
`/tmp/perch-native-ui-catalog-regression.log`. Private browser artifacts are
under `e2e/artifacts-native-ui/`. Screenshot review identified hidden custom
messages being shown; the display-flag fix passed its focused test and the
real-browser rerun. The final populated phone screenshot was inspected with
native conversation visible, controls reachable, and no hidden instructions.

Limits: only Pi/OMP have this native UI bridge. Claude/Codex/OpenCode still
need their own native history/control adapters, and the separate local Hosted
path remains to be retired. Attachments/model/approval
controls, queued-message interactions, paired remote access,
hibernation, and full resource measurements are not established by these
checks. V-04 remains partial and V-10 remains unverified; no full goal or ADE
phase is complete.

## Orca catalog and launch checkpoint — 2026-09-11

Read the complete `refactor_logs.md` before resuming in
`/Users/hwiii/Github/perch`. The refactored baseline passed 248 core tests plus
two protocol tests, 216 web tests, build, typecheck, formatting, and Clippy
with five existing warnings. Work continued directly, without new agents.

The 36-entry Orca catalog now supplies the runtime's native registry. The
availability response and actual process launch share the executable/alias
resolver. Host SQLite preferences persist enabled/default state; revisioned
snapshots update every client and prevent an older refresh from undoing a
newer preference. Disabled agents disappear from launch choices, while their
existing sessions remain attachable. Settings → Agents groups installed and
available-to-install entries, shows the public command, supports search and
Refresh, and links official install/docs pages. Install is a documentation
link, as in the adapted Orca UI, not an automatic package installation.

The CLI start screen, sidebar/tab-bar picker, and command palette share the
installed/enabled provider choices. Native OMP and Pi ran in separate
sessions in the same workspace: OMP started through the CLI start screen,
Pi through the sidebar picker. Their drafts stayed isolated, the Pi pane
retained its draft through split and reload, and both terminal identities
remained unchanged. The command palette listed both agents and opened a plain
shell whose `PWD` matched the workspace. Processes were stopped explicitly
and test cleanup addressed only fixture-owned tmux names.

The first native rerun confirmed the Pi layout repair but exposed xterm 5.5's
uncancelled viewport callbacks after disposal. A narrowly scoped compatibility
guard now prevents those callbacks touching a destroyed renderer; terminals
still dispose immediately. The wider regression suite then caught an initial
launch setting a redundant session CLI override. Launch now first resolves
the new session's inherited mode and adds an override only when necessary,
preserving device-mode control on the phone.

Validation and evidence:

- `cargo test --workspace`: 249 core tests + two protocol tests passed.
- `cargo clippy --workspace --all-targets`: the same five baseline warnings.
- `cargo fmt --check`, TypeScript check, `npm run build`: passed.
- `npx vitest run --root packages/web`: 218 passed, including stale catalog
  snapshots and inherited launch mode. The Rust preference test reopens the
  database and checks that the default remains unique and enabled.
- `cd e2e && npx playwright test --config=provider-config.config.ts`: four
  tests passed in Chromium/WebKit, covering the 36 built-ins plus three
  configured test fixtures, installed/available grouping, enable/disable,
  cross-device default updates, search, mobile layout, environment isolation,
  native OMP/Pi panes, command-palette shell launch, and reload persistence.
- `npx playwright test --config=cli-rendering.config.ts`: ten terminal/grid/
  crash-recovery checks passed; two ownership checks exposed the redundant
  mode override. After the fix, rerunning `agent-terminal-ownership.spec.ts`
  with that config passed both engines, followed by all four catalog tests.
- Reviewed wide/narrow screenshots in the private ignored directory
  `.impeccable/review/agent-catalog-{desktop,mobile}-{chromium,webkit}.png`.
  The catalog was widened for readable desktop commands; mobile controls wrap
  and remain usable at 390px. Native pane screenshots are
  `.impeccable/review/native-omp-pi-split-{chromium,webkit}.png`.
- Impeccable detection found no new component findings. Its one CSS finding
  is the pre-existing 3px side-tab border, outside this change.

V-03 is now observed with real OMP and Pi, not only test programs. The catalog
does not prove all 36 external CLIs authenticated and completed turns.
OpenCode is offered for installation when absent. Claude Agent Teams uses
Claude's native in-process mode, not Orca's app-specific pane wrapper.
V-04 remains incomplete: the separate Hosted runner still needs replacement
with a structured view/control connection to the live CLI. Full worktree,
pairing, agent snapshots, hibernation, and resource-budget gates remain open.

## Configured CLI checkpoint — 2026-09-11

Provider manifests load from the default or an explicit configuration file;
the CLI picker uses host discovery, persists the selected provider with the
session, and survives reload before the first keystroke. Environment policies
apply inside the actual tmux-owned child through a private bootstrap. The
real two-process runtime fixture verifies allowed/set/unset variables and
isolated input. Files and environment launch data are bounded.

Completed checks: `cargo test --workspace` (247 core tests and two protocol
tests), `npm test` (216 tests), `npm run build`, formatting, and workspace
Clippy with the five existing warnings. The final isolated browser command
`cd e2e && npx playwright test --config=provider-config.config.ts` passed in
Chromium and WebKit. It exercised desktop and 390px mobile provider selection,
disabled unavailable providers, literal environment values, two separate
provider terminals in one workspace, input isolation, reload before input,
reload after input, exact process/terminal continuity, and explicit stop.
Private screenshots under `.impeccable/review/provider-*` were reviewed;
the final run also verifies the custom-provider badge and clean session title.
The earlier headless WebKit page-creation failure no longer reproduced.

Alpha/Beta in this suite are test programs only. Per the user's clarification,
the shipping provider set is Claude Code, Codex, OMP, Pi, OpenCode, and ordinary
terminals. UI must view and control the same CLI-owned session. The existing
separate Hosted runner and CLI-active send refusal remain migration defects;
these fixture results do not prove V-03 or V-04 for the required real providers.
The native catalog and native event/control connections are in progress.

## Local agent runtime checkpoint — 2026-09-11

Implemented directly, without new agents. Local Claude/Codex CLI panes now
open through the provider/lifecycle adapter. Process identity includes the
workspace, session, and provider; the host retains its output and lifecycle
observer when the last browser view leaves. Request-correlated open/release
messages carry up to 128 KiB of replay, with the opened reply queued under the
same output lock as the snapshot. The client subscribes before live output,
suppresses historical terminal/clipboard responses, and releases late opens.

The visible **Take control**, **Release control**, and **Stop CLI** actions use
connection-owned input/resize leases. Input includes the exact generation;
a different connection cannot write by guessing a terminal id. Control replies
carry lifecycle revisions so stale pushes cannot erase a newly acquired lease.
A failed initial attach has a visible **Retry CLI** action. A bounded periodic
checkpoint persists changed lifecycle state independently of browser viewers. Session deletion stops its concrete processes and frees
lifecycle capacity. Existing legacy processes are detected before a second
provider is launched. A reconnect with neither a live process nor a provider
continuation is refused rather than silently creating a fresh conversation.

Current evidence:

- The two-viewer real-Claude test passed in Chromium and WebKit: the phone
  observed the desktop's terminal and unsubmitted draft; unrelated raw input
  was refused; visible release/take actions transferred authority; phone input
  appeared on desktop; mobile pane changes and reload retained the same
  terminal id and draft; explicit stop showed exit on both clients.
- Reviewed `.impeccable/review/agent-{desktop,mobile}-{chromium,webkit}.png`.
  Mobile has no page overflow and both control actions meet the 44 CSS px
  minimum. These are browser-engine checks, not native desktop acceptance.
- Workspace tests passed 240 core tests and both protocol checks. The runtime
  fixture exercises two real isolated processes under one Perch session,
  rejects stale leases, retains host tracking with zero viewers, and deletes
  one runtime without stopping the other. The desktop target compiles.
- 216 web tests in 17 files and the shared/web build passed. New regressions
  cover reversed provider replies, immediate live output, late opens after
  unmount, and stale lifecycle pushes after a new control lease.
- The complete terminal configuration passed all 12 WebKit/Chromium cases
  before the final recovery guard. The latest Chromium rerun passed all six
  cases, with the ownership test expanded to independent device profiles and
  a visible Chat/CLI round trip that preserves the terminal id and draft.
  The final WebKit rerun failed while setting up Playwright's `page`, before
  executing Perch interactions. Two independent headless WebKit probes also
  failed to create a page; the equivalent Chromium probe succeeded. No
  foreground recovery was attempted. A final WebKit rerun remains pending.
  Formatting and workspace Clippy pass with the same five existing warnings.

Remaining scope is explicit. This does not complete V-03/V-04/V-09/V-10/V-12:
custom manifests are not yet loaded by boot/UI; the browser test uses one real
provider; new Codex CLI thread capture and native-provider core-crash recovery
remain unverified; remote provider multicast and secure pairing are not wired;
full lifecycle status detection and safe automatic hibernation remain open.
Switching views and changing the phone's device mode preserve the process,
but sending a Chat turn while that CLI
is alive is currently refused to prevent a duplicate runner. Seamless Chat/CLI
prompt delivery and transcript synchronization still need implementation.
The full main e2e suite has not been rerun for this checkpoint.

## Persistent shell checkpoint — 2026-09-10

Implemented directly after the user's no-more-agents instruction. Plain shell
panes now use database-owned identities scoped to a session and its actual
workspace path. A host-wide Rust registry owns the process independently of
browser mounts; closing a view releases its subscription. The explicit
**Close shell** action terminates the process and updates every attached view.
Deleting the owning session closes its shells under the same spawn lock.

The request-correlated `terminal.open/list/release/close` protocol carries a
stable pane identity and bounded replay. The registry limits persisted shells
to 64, viewers to 32 per shell, and replay to 128 KiB per shell. Missing process
or tmux backends become visibly unavailable; recovery never silently launches
a replacement command. Existing shells are selectable on desktop and mobile;
desktop selections persist in Dockview parameters. Legacy peers retain the
older terminal path. Persistent shell federation remains explicitly unavailable
until remote multicast subscriptions are implemented.

Actual headless testing caught integration defects and drove fixes:
historical terminal queries were being answered again during replay, polluting
the running shell's input, and explicit close removed subscriptions before the
child waiter could notify other devices. Replay now disables input until the
parser finishes and suppresses historical OSC 52 clipboard writes; close sends
its exit notification before removing subscribers. A separate startup race
left layout restoration and saving inactive when the reply arrived before
Dockview readiness; readiness now triggers application of the pending layout.

Verified directly:

- `workspace-terminals.spec.ts` passed all four WebKit/Chromium cases. A shell
  retained its terminal id, process PID, and shell-local variable across browser
  reload and mobile pane unmount/remount. A second shell did not inherit the
  variable. Closing that shell on the phone updated the desktop's visible exit
  state. Mobile mounted one terminal surface with no horizontal overflow and
  44 CSS px action targets.
- The restart case starts a separate core with a temporary database, kills that
  exact core process, restarts it, and proves the tmux-backed shell retains the
  same terminal id, session id, PID, and variable. Fixture shells and processes
  are explicitly removed afterward.
- `cargo test --workspace`: 238 core unit tests and both protocol parity tests
  passed; the desktop target compiled and has no unit tests. This is not a
  native desktop UI acceptance result.
- `npm test`: 213 tests passed in 16 files, including reversed terminal reply
  ordering, immediate output delivery, unmount-before-open, late replies after
  timeout, and repeated listener cleanup after another view has reattached.
  A Dockview regression test proves an early layout reply is applied when the
  canvas becomes ready. Shared/web build passed.
- The full `cli-rendering.config.ts` run passed all ten checks across WebKit
  and Chromium: six real CLI grid/input/scaling checks plus the four persistent
  shell cases. CLI tests select device mode through visible controls and verify
  fixture terminal exits before teardown, without editing shared settings.
- `cargo fmt --all -- --check` and workspace Clippy passed. Clippy reports the
  same five existing core warnings and no new warnings from this slice.
- The source detector reported only the existing Markdown blockquote border;
  it is a semantic quote indicator, not new terminal decoration. Desktop and
  mobile screenshots in `.impeccable/review/shell-*.png` were inspected directly.

This proves local shell persistence and the terminal portion of recovery. It
still does not establish provider Chat/CLI continuity, general agent lifecycle
integration, explicit input/resize ownership, remote pairing, or the populated
resource budgets. The full goal remains in progress.

## Direct implementation checkpoint — 2026-09-10

The user requested that the orchestrator take over after the existing workers
finish, with no new agents. Subsequent implementation, review, and testing in
this checkpoint were performed directly. All browser runs were headless.

Actual Chromium testing found a cold-start React update loop that unit tests
and builds had missed. The Chat capability selector now returns a boolean
instead of allocating an empty array during the handshake. The server now
advertises the implemented mode get/set and provider manifest handlers. Empty
session identities are persisted before publication, while the existing
visibility filter keeps unstarted sessions out of navigation. This preserves
their identity and mode policy across browser reconnects without starting a
provider. Mode replies include an optional, server-owned workspace association
on both Rust and TypeScript protocol definitions; navigation focus is never
substituted for that association.

The frontend also refreshes every observed affected session after workspace
or device mode invalidation. An invalidation racing an older read records the
required revision and triggers a fresh read instead of accepting stale policy.
Confirmed modes remain mounted during ordinary refetches.

Verification performed directly:

- `npm run build`: shared and web builds passed.
- `npm test`: 206 tests passed in 14 files, including 65 store tests.
- `cargo test -p perch-core`: 235 unit tests and both protocol parity tests
  passed. The real PTY/tmux quiet and hibernation tests now wait for observable
  settling instead of assuming fixed startup delays. Hibernation still refuses
  activity arriving after completion; the test retries only that specific race.
- Headless Chromium `session-mode-policy.spec.ts`: passed against freshly
  rebuilt core servers using the isolated e2e database/hosts configuration.
  Three browser pages represented two distinct blank sessions and two device
  identities. Visible controls exercised device, workspace, and session
  precedence; cross-view invalidation; reload with the same session id; and
  clearing each override back to its inherited policy. The other device did
  not inherit a device-local change. No `terminal.create` request was emitted.
- Headless Chromium responsive checks R1, R2, and R2b passed: the mobile
  switcher opened/closed and pane changes left exactly one mounted content
  surface, with no desktop Dockview mounted.
- The orchestrator inspected `mode-policy-desktop.png` and
  `mode-policy-mobile.png` under `.impeccable/review/`. At 390 × 844, mode,
  scope, clear, pane, and session-switch controls are reachable without
  horizontal overflow. Their tested touch targets are at least 44 CSS px high.

These checks establish mode policy and blank-session behavior, not the complete
same-provider Chat/CLI continuity gate V-04, secure pairing V-10, or populated
performance and recovery gates. Those requirements remain open. The final
full workspace checks and full browser acceptance matrix remain required.

### V-08 actual provider delivery — 2026-09-10

The orchestrator extended `e2e/workspace-review.spec.ts` and ran the real
headless Chromium flow against freshly rebuilt cores, with isolated e2e
database/hosts paths and a unique temporary Git fixture. Through visible UI
controls it registered the project, opened a session in that workspace,
selected Claude Haiku 4.5, and completed a short readiness turn. It added one
inline note to the worktree line and another to the corresponding index line,
edited the first, resolved and reopened it, selected the target session,
and previewed one packet containing both anchors and the edited note.

After one Send click, the real provider returned the fixture's requested
receipt marker. The UI confirmed “Agent received the review packet.” without
another send. A subsequent explicit retry reused the same packet and operation
id. Wire evidence contained exactly two completed provider turns in that
session: readiness and the single review turn. The sentinel remained unchanged.
The test asserts the receipt is visible and the send button becomes enabled
after the retry. The orchestrator inspected the resulting
`.impeccable/review/review-packet-delivered.png` screenshot, which shows the
provider receipt beside the two-note packet and its delivery confirmation.

This verification exposed and fixed two additional UI integration issues:
the delivery status had required a second send to refresh, and a retry of an
already-confirmed packet could leave the button stuck at “Sending…”. A new
Rust/TypeScript `review.batch.delivery` event publishes the durable outcome;
the hub stamps the owning host, and the client rejects unrelated packets or
hosts and prevents stale claimed replies from undoing confirmed delivery.
Send-button progress follows the correlated request promise. The fixture's
unit regressions cover those ordering and ownership boundaries.

Commands and final evidence for this slice:

- `npm run build` passed; `npm test` passed 208 tests across 14 files.
- `cargo test -p perch-core` passed 235 unit tests and two protocol tests.
- `cargo fmt --check` passed.
- `cargo clippy -p perch-core --all-targets` passed with the five documented
  existing warnings and no added warnings.
- `cd e2e && npx playwright test workspace-review.spec.ts --project=chromium`
  passed all three tests. After the last send-button correction,
  `npx playwright test workspace-review.spec.ts --grep 'sends two' --project=chromium`
  passed again (7.6 seconds of test interaction).

Rust and browser server builds used the Command Line Tools SDK and explicit
clang/ar/linker environment. This is V-08 PASS for actual local UI delivery;
full restart recovery, paired remote/mobile delivery, and the other acceptance
gates remain open.

## Checkpoint — 2026-09-07

Implementation and test work is delegated to Luna with maximum reasoning;
the orchestrator independently reviews code and screenshots. All browser
testing must remain headless/background. Desktop testing must use
`PERCH_DESKTOP_TEST=1`; never activate the user's applications.

### Baseline evidence

Luna reported these baseline checks passing before implementation:

- `cargo test -p perch-core`: 151 unit tests and one protocol parity test.
- `npm test`: 168 tests across 11 files.
- `cargo fmt --check`.
- `cargo clippy --workspace --all-targets`: five documented existing warnings.
- `npm run build`.

An isolated core on loopback port 7798 used a temporary database and hosts
file. Reported RSS was 14,592 KB. Headless Chromium measured used JS heap of
5,661,542 bytes at 1280 × 720 and 5,486,319 bytes at 390 × 844. These are
empty/onboarding measurements, not the required populated performance
fixtures or a settled CPU measurement. Baseline screenshots are local review
artifacts; the orchestrator inspected both CDP captures and confirmed that
onboarding was still visible. They do not prove workspace interactions.

### Partial implementation and review

- Durable local project/workspace records, session associations, additive
  protocol negotiation, and navigation are under implementation.
- Filesystem service includes bounded reads/listing, versioned saves,
  descriptor-based path confinement, no-replace file creation, and sandbox
  requirements for HTML previews. Luna most recently reported 11 isolated
  module tests passing. It is not yet an end-to-end editor workflow.
- Frontend build and 57 focused store tests passed before the latest review
  fixes. This is not verification of the final worktree.
- Review found and requested fixes for legacy protocol deserialization,
  revision/event ordering, metadata broadcast, late focus responses,
  filtered snapshot replacement, and registration form error recovery.
- The latest backend work was interrupted before a final integrated test
  run. Recheck current code and tests; earlier passing results are not proof
  that subsequent edits pass.
- The first headless V-01 invalid-folder interaction exposed an actual
  failure: the core serialized error correlation as `request_id`, while the
  view expected `requestId`; registration remained pending and could not be
  corrected. Backend serialization repair and an observed browser retry are
  required before that flow passes.

### V-01 observed result — 2026-09-07

The backend was rebuilt with the `error.requestId` camelCase repair, then an
isolated headless Chromium run exercised the real UI at `http://127.0.0.1:7799`
using a temporary database and hosts file (`/tmp/perch-goal-ui.sqlite` and
`/tmp/perch-goal-ui-hosts.json`). The browser dismissed onboarding, submitted
an invalid folder, verified that the entered path and name remained in the
form after the correlated error, corrected the path, registered the project,
clicked it, and observed its default workspace become active. It registered a
second fixture project and confirmed the first project remained visible after
the scoped snapshot. After reload, the same rendered project id and active
workspace were present. A phone-sized 390 × 844 context opened the mobile
switcher and rendered the same project/workspace/session hierarchy.

The manual reproduction command was `node /tmp/perch-v01.mjs` from `e2e/`.
The checked-in regression is `npx playwright test workspace-foundation.spec.ts
--project chromium`; it uses unique `/tmp` folders and the isolated server
configuration. The manual run logged the durable project id
`82c23d65-2f85-4825-b04a-01993883eadd` before reload and rendered
`data-testid="workspace-project-82c23d65-2f85-4825-b04a-01993883eadd"` after
reload, along with workspace id
`9e24ef91-9cba-4da1-bd05-e76d8735ac35`. Review screenshots are:

- `.impeccable/review/foundation-desktop-registered.png`
- `.impeccable/review/foundation-desktop-two-projects.png`
- `.impeccable/review/foundation-desktop-reload.png`
- `.impeccable/review/foundation-mobile-registered.png`

The manual run measured 162 DOM nodes and 11.4 MB used JS heap at 1440 × 900,
and 161 nodes and 7.0 MB at 390 × 844. These are interaction evidence and
fixture measurements, not a complete performance gate. V-01 is now observed
as PASS; all other acceptance rows remain UNVERIFIED.

### File-view interaction review — 2026-09-07

Luna reported a headless file open/save/external-edit/compare/dirty-reload
interaction and captured `files-desktop-conflict.png` and
`files-mobile-editor.png` under `.impeccable/review/`. The orchestrator
inspected both. The desktop capture visibly preserves a conflicting draft
beside the disk preview. The mobile capture fails the layout requirement:
two desktop panes remain side by side, the editor is extremely narrow, and
toolbar actions are clipped. A reported viewport `scrollWidth` of 390 does
not establish that controls are visible or usable. This requires a mobile
single-pane correction and confirmation screenshot.

The partial file interaction does not yet prove Git/status updates, durable
draft/conflict recovery, or the complete V-05/V-06/V-09 gates. Further file
tests must use an isolated temporary project sentinel, not repository docs.

The subsequent bounded correction run used an isolated temporary project.
Luna replaced the file screenshots with corrected captures, and the
orchestrator inspected the updated desktop conflict and mobile editor images.
The mobile editor now occupies the full active pane, with an Explorer switch
and reachable Wrap/Preview/Reload/Save actions. The material clipping defect
is resolved for this surface. This does not yet prove the complete mobile
resource/mounting policy, pairing, draft persistence, or all visual states.

### Durable file recovery evidence — 2026-09-08

The filesystem listing regression was traced to `dup(directory_fd)`: the
duplicate shares the original directory open-file description and therefore
its `readdir` offset. `read_directory_from_fd` now opens `.` with
`openat(directory_fd, ".", O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC)` for every listing,
leaving the retained descriptor available for metadata checks. The focused Rust
regression covers eight repeated root/nested listings and sixteen concurrent
root/nested listings:

```text
cargo test -p perch-core filesystem::tests::repeated_and_concurrent_listings_use_fresh_directory_offsets -- --nocapture
test result: ok. 1 passed; 0 failed
cargo build -p perch-core
Finished `dev` profile
```

The checked-in headless browser regression is
`cd e2e && npx playwright test workspace-files-durable.spec.ts --project chromium`.
It passed (`1 passed`, 19.8 seconds including isolated server startup) against isolated `/tmp` database and hosts
files. The real UI registered a unique temporary project, refreshed the root
tree five times while retaining `README.md` and `src`, expanded `src`, opened
`src/main.txt`, persisted a draft in the server buffer, verified the
beforeunload handler and delivered/dismissed Chromium's actual leave-warning
dialog, reloaded the page with the selected path and draft, saved a sentinel
to disk, then caused an external edit. The visible conflict
preserved the local draft and offered Compare, Reload disk, and Overwrite disk;
Compare and the explicit Keep draft/Discard and reload paths were exercised.
The test also captured wide and 390 × 844 screenshots and verified that the
mobile editor and Save control were reachable without horizontal overflow.

The separate isolated restart harness `node /tmp/perch-files-durable.mjs`
also stopped and restarted the rebuilt core against the same temporary DB. Its
logged workspace id was `b0715a32-f260-424b-88ca-4592fa857a0e`; the selected
`README.md` and draft `draft survives core restart\n` were restored after the
process restart. Review captures are:

- `.impeccable/review/files-durable-desktop.png`
- `.impeccable/review/files-durable-conflict.png`
- `.impeccable/review/files-durable-mobile.png`

This establishes the file/tree and draft/conflict portions of the recovery
slice. Git/status verification is still required for V-05; sessions,
terminals, comments, and the rest of the host/client recovery contract remain
unverified for V-09.

### Git/review and responsive UI evidence — 2026-09-09

The rebuilt web client passed the current frontend checks:

```text
npm run build
npm test
14 test files passed; 197 tests passed
```

The real headless Chromium Git/review run was
`cd e2e && DEVELOPER_DIR=/Library/Developer/CommandLineTools npx playwright test workspace-review.spec.ts --project=chromium`.
It registered a unique temporary Git repository, whose sentinel file had
distinct `HEAD_ANCHOR`, `INDEX_ANCHOR`, and `WORKTREE_ANCHOR` contents. The
browser observed the working-tree, staged, and current-`HEAD` diffs, checked
that each visible source revision was a server-provided 64-character revision,
and asserted that each outgoing `review.create` used the corresponding exact
`base` and `baseRevision`. It then created comments through the UI and edited,
resolved, reopened, and deleted one of them. The run passed (`2 passed`, with
the current `perch-core` source compiled by Playwright against isolated
servers). Inline placement now also requires the matching target, side-specific
path, server source revision, consistent anchor metadata/range, and a live
anchor state; comments from another target or stale source remain in the review
list with their state. The durable visual captures are
`.impeccable/review/git-review-crud-desktop.png` and
`.impeccable/review/git-review-mobile-comment.png`.

The responsive headless run was
`cd e2e && DEVELOPER_DIR=/Library/Developer/CommandLineTools npx playwright test responsive.spec.ts -g 'R1\\.|R2\\.|R2b\\.' --project=chromium`.
All three tests passed against the current web bundle and freshly compiled
source servers on the isolated ports. R1 confirms that the mobile shell hides
Dockview and mounts one active pane; R2 confirms the mobile switcher; R2b
switches between Files and Chat and confirms only one content surface remains
mounted. Durable captures are
`.impeccable/review/git-review-mobile-header.png`,
`.impeccable/review/git-review-mobile-switcher.png`, and
`.impeccable/review/git-review-mobile-single-pane.png`.

The Git review spec also now exercises a populated 390 × 844 mobile Git pane
through the real mobile switcher, checks visible diff text, both line-number
gutters, and the reachable comment action, creates a mobile anchored comment,
and captures `.impeccable/review/git-review-mobile-comment.png`. The Git
surface uses a container-responsive layout: at a narrow Dockview width the
status summary stacks above the diff canvas and the nested file rail shrinks,
so the diff and review controls remain reachable. The current mobile capture
was captured from the same current-source browser run as the desktop capture.
`DEVELOPER_DIR=/Library/Developer/CommandLineTools cargo check -p perch-core`
also passes. Review batch delivery is intentionally not marked successful:
the provider-acceptance/receipt path still needs an integrated real-agent
verification.

### Acceptance matrix

| Gate | Current disposition |
| --- | --- |
| V-01 project registration and stable reload identity | PASS (headless UI observed) |
| V-02 two isolated worktrees | UNVERIFIED |
| V-03 two different persistent CLI agents | PASS: real OMP/Pi, isolated drafts, split and reload, both engines; see catalog checkpoint above |
| V-04 same-session Chat/CLI switching and recovery | PARTIAL: real Pi/OMP native UI/CLI turns and same-PID core recovery pass in both engines; Claude/Codex/OpenCode and full UI controls remain |
| V-05 tree, sentinel edit, save, disk/status verification | PARTIAL (file/tree/save and Git status/diff observed separately; combined edit/save/status gate remains) |
| V-06 visible external-edit conflict recovery | PASS (headless UI observed) |
| V-07 complete Git and agent change review | PARTIAL (working-tree/staged/current-HEAD source snapshots, status, and target-aware inline placement observed; workspace-start/last-agent-turn history and full change summary remain) |
| V-08 anchored comments and exactly-once review packet | PARTIAL: native Pi/OMP two-note phone delivery, ownership, and receipt-confirmed retry pass in both engines; legacy Claude passed earlier; native Claude/Codex/OpenCode remain |
| V-09 full host/client recovery | PARTIAL (file draft/path recovery, real tmux shell/core restart, and native Pi/OMP same-PID/session recovery verified; complete mixed workspace and agent recovery remains unverified) |
| V-10 paired mobile interaction and reconnect | UNVERIFIED |
| V-11 populated desktop/mobile visual and interaction QA | PARTIAL (corrected Git desktop and populated mobile screenshots inspected; populated full-surface QA remains) |
| V-12 safe hibernation and resume | UNVERIFIED |

Full Git/review, provider lifecycle and mode scope, worktree orchestration,
secure pairing, remote/mobile workflows, populated performance budgets, and
the complete automated/UI verification remain required. Update this report
with exact commands, observed actions, artifacts, and current results as each
gate is actually exercised. Never infer a pass from this checkpoint.

### Historical orchestrator review checkpoint — 2026-09-09 17:04 UTC

The orchestrator directly inspected `git-review-crud-desktop.png` and rejected
its cramped nested columns: the diff and action controls were visibly clipped.
The frontend lane subsequently added container-responsive layout and a populated
mobile interaction test. Direct inspection of
`.impeccable/review/git-review-mobile-comment.png` confirms readable index and
working-tree sentinel lines, a visible unresolved comment, and reachable Edit,
Resolve, and Delete controls. This visual observation is limited to that capture;
it does not establish the complete mobile, pairing, or delivery acceptance gates.

The reported frontend checkpoint was 196 tests passing and successful real
Git/comment CRUD, followed by a populated mobile comment interaction. Those
pre-integration browser results were superseded by the current-source runs
recorded above.

All three Luna implementation lanes stopped with a usage-limit error at this
checkpoint, reporting retry at 3:28 PM local time. Backend build repair, durable
provider-acceptance receipts, full runtime persistence/wiring, corrected desktop
layout verification, and the remaining SPEC gates are still outstanding.

Additional orchestrator review while Luna is quota-stopped: the new
`agent_persistence.rs` snapshot upsert currently overwrites existing state
unconditionally. Before integration, add stale-write protection using a
monotonic snapshot revision that covers every persisted mutation, and verify
out-of-order snapshot saves cannot replace newer state or provider identity.
This finding has been sent to the fleet lane for its next resume.

### Orchestrator review checkpoint — 2026-09-09 19:29 UTC

The frontend lane rebuilt current perch-core source and passed both
`workspace-review.spec.ts` browser tests. The tests cover distinct committed,
index, and working-tree source text; source-version-bound comment creation;
comment lifecycle; and populated mobile Git interaction. A subsequent run
also verifies that comments from another diff target stay in the review list
rather than attaching to an unrelated same-numbered line. Focused frontend
Git/review tests passed 16/16. The orchestrator inspected the corrected desktop
capture and reviewed the target/source/anchor checks. This is scoped evidence,
not full V-07 or V-08 acceptance: provider packet delivery remains unverified.

The fleet lane reports native core tests 215 passing and its combined
fleet/runtime/persistence harness 46 passing, including real PTY lifecycle,
stale snapshot saves, mode ordering, and restart revision advancement. Root
reviewed the separate monotonic lifecycle/mode update logic. The runtime and
persistence modules are now exported, but actual server/protocol/UI wiring
and real Claude/Codex acceptance remain outstanding.

At this checkpoint all three Luna lanes stopped with a usage-limit error,
reporting retry at 6:04 PM Eastern. Resume priority: finish current server
runtime/persistence integration and mirrored wire contracts; verify packet
acceptance/durability using real agents; continue actual session mode flows;
then remaining workspace-start/last-turn diff bases, worktrees, pairing,
resource budgets, and the complete SPEC matrix. No gate is complete merely
because a standalone module or fixture test passes.

### Frontend current-source correction — 2026-09-09

The Git/review correction was rerun after the backend source compiled cleanly.
`npx vitest run src/components/WorkspaceGitReview.test.tsx src/gitReviewStore.test.ts`
passed 16/16, `npm run build` passed, and the full web suite now reports 14 test
files and 197 tests passing. The Playwright fixture run rebuilt both isolated
servers from the current source and passed 2/2. It verifies that comments from
working-tree, staged, and HEAD snapshots are inline only for their matching
target and server source revision; other-target comments remain in the review
list. It also verifies the mobile populated Git surface and CRUD path.

The responsive current-source run passed 3/3 for the single mounted mobile
pane, switcher, and Files/Chat pane switch. The corrected captures are
`.impeccable/review/git-review-crud-desktop.png` and
`.impeccable/review/git-review-mobile-comment.png`. The desktop capture shows
the readable status row, HEAD compare control, diff rail, line gutters, and
review actions; the mobile capture shows the status card, controls, populated
diff, and comment actions. Review packet provider delivery is still PARTIAL
until the server's acceptance receipt is exercised with a real agent.
