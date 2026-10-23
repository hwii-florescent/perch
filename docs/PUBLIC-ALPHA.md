# Perch: differentiated public alpha

## Release intent and status

Release contract recorded 2026-10-04. Implementation summary refreshed against
`8dae768`; this documentation refresh does not certify a release candidate.

**Goal: the earliest differentiated release, not the earliest release of today's agent-terminal application.** The repository is already public. Here, launch means a publicly promoted, downloadable alpha with a demonstrated product distinction—not merely changing GitHub visibility or publishing a terminal wrapper.

Owner direction is to build a meaningful separation from existing terminals/agent workspaces before launch. This document scopes that work. It does not claim a feature is unique or a test has passed. Unchecked means candidate evidence is still owed, **not necessarily that implementation is missing**. Existing checked local-attention entries retain their cited historical evidence; they do not certify the whole current candidate.

- [PRODUCT-STRATEGY.md](PRODUCT-STRATEGY.md): full product, research, target architecture, technical decisions and sources.
- [UI-UX-DIRECTION.md](UI-UX-DIRECTION.md): detailed proposed interaction contract.
- [ROADMAP.md](ROADMAP.md): current remaining functionality and priorities.
- [ARCHITECTURE.md](ARCHITECTURE.md): current ownership and safety contracts.
- [TESTING.md](TESTING.md): commands, isolation and known limitations.
- [DECISIONS.md](DECISIONS.md): approved UX; proposals do not override newer decisions.

The complete long-term architecture is **not** an alpha requirement. This file is the release scope boundary. No calendar deadline overrides a correctness/security/differentiation gate.

### Implementation is ahead of the original checklist

These are source/test starting points, not new gate passes:

| Area | Implemented locally | Still to complete / verify |
|---|---|---|
| Mixed canvas | Canonical surfaces, mixed strip/splits and per-viewer restoration; compatible remote file/diff surface routing (`surfaces.rs`, `surfaceSync.ts`, `e2e/mixed-tabs.spec.ts`, `e2e/remote-workspace.spec.ts`). | Candidate D1 recovery/migration/authority evidence; remote runtime integration; session-free connect. |
| Resources | CodeMirror/durable drafts, file search, image/PDF/media, archive extraction/download and desktop default-app opening (`e2e/workspace-file-browser.spec.ts`). | File Quick Open, Markdown preview, image controls, Open With, explicit Run and candidate D2 trust/safety evidence. |
| Context | Local bounded Context Bridge, Claude explicit delivery (`docs/CONTEXT-BRIDGE.md`). | Retest source/draft/busy-target boundaries; remote and other safe send transports are not implied. |
| Attention | Local Needs You / Welcome Back (`e2e/needs-you.spec.ts`). | Remote question path/dedupe and documented deferred notification/device features. |
| Durability | Tri-state liveness, fail-closed persistent launch, bounded output, gap/error disclosure, guarded deletion. | Candidate fault/load/close/restart evidence; implementation is not proof of every gate. |
| Remote | Host-qualified metadata/text files/drafts/search/surfaces and Git/review/worktree federation; [actual Linux resource/core-restart probe](evidence/remote-workspace-2026-10-23.md). | Runtime integration/fault evidence, media/jobs/attention, consent-based install/update and full authorized Linux-host D3. |

Do not rebuild these local foundations because a checklist below remains open.

## 1. Alpha promise

> **A project workspace where real CLI agents, files and changes sit together—and the same working context comes back locally and remotely.**

A user should be able to run their real CLI, inspect its output and changes beside it, leave, and return without reconstructing which project, checkout, machine, file, diff or process they were using.

Durable terminals are necessary but insufficient: cmux, Herdr, Orca and others already overlap. The proposed difference is coherent resource + execution continuity with less navigation and setup. We must demonstrate that benefit, not manufacture a uniqueness claim.

### Primary user

An individual terminal-led developer with two to five concurrent streams of work, an existing preferred editor/agent, and occasional remote development. Perch must also be useful without an agent or Git.

## 2. Three required demonstrations

All three gate the differentiated public alpha. A local-only preview can be shared privately for testing, but it is not completion of this release contract. Dropping remote from alpha requires an explicit product scope decision, not silently relabeling it experimental to get the checklist green.

### D1 — Agent + file + review, restored together

1. Add a project and start the real CLI.
2. Open a source file and a diff as peers in the same tab strip.
3. Split file/diff beside the terminal; reorder and focus them.
4. Switch projects and return.
5. Quit/reopen Perch, then separately crash/restart its core.
6. Recover the same resource identities, split/focus state, draft state and surviving process.

**Proves:** more than terminal organization. A working context, not just terminal output, persists.

### D2 — Open an output and act on it without chat ceremony

1. Open a non-Git project with no agent/session started.
2. Browse a text file, Markdown document and image.
3. Edit/save text safely, view Markdown/image, and open a resource externally where supported.
4. Inspect unknown/oversized/misnamed files through useful safe fallback.
5. Copy bounded context; explicitly run a supported command in a new owned terminal.
6. Cancel an open/run picker and confirm no process or chat session was created.

**Proves:** a general project resource workspace, not an agent dashboard with attachments.

### D3 — Repeat the workflow on a remote execution host

1. Connect via normal SSH to the explicitly supported remote platform.
2. Register/open a remote project; start its real CLI under remote perchd.
3. Browse/edit a remote file and inspect a remote diff beside the terminal.
4. Create an isolated context and verify resources belong to it.
5. Disconnect/reconnect and restart the local core.
6. Recover the same remote runtime/context, without local execution fallback.
7. Safely close execution and remove the test worktree after reconnection.

**Proves:** one workflow across execution locations, not just an embedded SSH terminal.

Full active-browser previews, every remote platform and direct-mode feature parity are not needed for D3.

## 3. Proposed support envelope

Freeze this matrix before collecting release evidence. These are proposed limits, not current compatibility claims.

| Area | Alpha contract |
|---|---|
| Desktop | macOS Apple Silicon, with exact tested OS versions recorded. |
| Browser | Shared client on named tested desktop browsers; at least one non-Tauri client passes multi-view/restore tests. Do not claim all browsers. |
| Remote execution | One actual tested Linux x86_64 distribution/version, managed perch-core + perchd over SSH. No loopback-only substitute for the real-host test. |
| Linux desktop | Preserve build support; experimental until actual packaged UI is verified. Not a blocker to the narrower Mac alpha if clearly labeled. |
| Other remote architectures | Supported only after measured verification; build artifacts alone do not establish support. |
| Windows | Not supported in this alpha. |
| Phone/PWA | Existing access remains; broader phone polish is deferred. Known control/review issues disclosed and not presented as verified capabilities. |
| Agents | Generic shell plus at least two real CLI providers verified end to end. Claude and Codex are the proposed primary pair; exact versions/capabilities recorded. |
| Other existing providers | Preserve launch paths where possible; label tested capability/version or experimental. Do not imply normalized questions/approvals everywhere. |
| Attention | At least one verified provider's question path locally and remotely; generic terminal/other providers degrade honestly. |
| Direct SSH/tmux | Compatibility mode, explicitly reduced; not the path used to satisfy full remote workspace requirements. |

Do not install missing providers merely to make a support matrix larger. Existing repo rules on absent OpenCode and cheap-model verification still apply.

## 4. Required product slices

### A. Canonical mixed tabs and canvas

- [ ] Terminal, File and Diff use a common surface/resource descriptor and one ordered tab strip.
- [ ] Files/reviews require no chat session parent. Merely connecting does not mint work for the new client path.
- [ ] Same-context terminal/file/diff splits work through the existing Dockview engine.
- [ ] Resource title/focus/close behavior is consistent; status follows the focused resource.
- [ ] Switching context and closing its final tab never displays unrelated work.
- [ ] Order, selected member and split geometry restore per viewer.
- [ ] File/session legacy state migrates idempotently without killing/restarting any process or losing drafts.
- [ ] Unsupported/stale resources produce an actionable placeholder, not a substitute or auto-run.
- [ ] Workspace navigation is coherent without a second mandatory session hierarchy. Preserve the approved compact-session sidebar choice; the older sessionless proposal is not a release requirement.

**Not required:** arbitrary grouping, window tear-off, cross-context runtime dragging, new layout engine, full visual redesign, or a public surface-provider API. Preserve old complex layouts even if new UI has a smaller creation ceiling. Pins/safe reopen are long-term designs, not prerequisites to the first mixed-canvas slice; if shipped, they must follow the documented lifecycle contract.

### B. Useful resources and safe actions

- [ ] Fast bounded explorer and Quick Open for the selected context; ignore/generated handling is explicit and cancellable.
- [ ] Text/source edit, find, explicit save, recoverable drafts and external-change conflict handling.
- [ ] Markdown rendered safely with source access; no automatic external resource fetch.
- [ ] Inert image viewing with zoom/dimensions and decode limits.
- [ ] Diff/review opens in the canvas; scope/base is explicit and existing anchors/packet behavior is preserved.
- [ ] Internal Open With and a narrow native external-open path; browser download fallback.
- [ ] PDF can have an explicit external/download fallback; internal PDF rendering is not a launch blocker.
- [ ] Unknown, binary, read-only, symlink and oversized resources have useful non-destructive outcomes.
- [ ] Remote external opening is labeled download/local copy or configured remote-aware editor; never use remote path as a laptop path.
- [ ] Copy context is bounded and distinguishes saved content from unsaved draft. No recursive automatic upload or automatic prompt submission.
- [ ] At least one explicit approved Run-in-new-terminal path displays host/cwd/command and gives execution a visible owner.
- [ ] Menus, toolbar, shortcuts and Cmd-K call shared action definitions for these operations, with frozen targets and server revalidation.

**Not required:** spreadsheets, notebook kernels, media editing, archive extraction, full LSP/debugger, automatic context submission, universal interpreter inference, saved-command library or command scheduling.

### C. Managed remote workspace

- [ ] Host-qualified project/workspace/resource/runtime identities throughout the supported path.
- [ ] Remote core owns remote metadata, files, Git, worktrees, agent evidence and execution; local side only routes/caches.
- [ ] Normal SSH config/authentication/host-key verification works; deployment/update requires consent.
- [ ] Remote files use the same confinement, bounded access and versioned-save behavior.
- [ ] Remote Git/diff and worktree creation/deletion appear in the actual workspace UI, not only legacy messages.
- [ ] Capabilities reflect end-to-end routing support, not just what the remote advertises.
- [ ] Remote terminal/control/replay works through remote perchd without local fallback.
- [ ] Reconnection reconciles uncertain operations and runtime incarnations; it does not duplicate processes or resend terminal input.
- [ ] Offline inventory/drafts are preserved and visibly stale; unavailable mutations fail clearly.
- [ ] Remote close while offline cannot falsely report success. Keep a visible pending/failed intent; revalidate the intended incarnation before any later stop.
- [ ] Incompatible daemon/runtime upgrade never silently ends live execution.

**Not required:** full direct-mode replacement, port discovery, app-preview tunnels, remote file mirroring, cloud provisioning, every Linux distribution, or a hosted account service.

### D. Trustworthy attention

- [x] Small Needs You view, not dashboard/kanban. (`components/NeedsYou.tsx`, 2026-10-21)
- [ ] Verified question/needs-input signal with exact resource navigation for a tested provider locally and remotely. **Local done** (Claude, `e2e/needs-you.spec.ts`); remote hosts not yet relayed.
- [x] Viewing and resolving are separate; question remains until evidence resolves it. (`db/attention.rs` tests, needs-you N1)
- [x] Completion, process exit, successful tests and review readiness are not conflated. (`attention` kinds: question/failed/finished/exited; no test/review admission)
- [x] Silence/stale observation is not confirmed idle/done; transport loss is unknown/reconnecting. (`server/attention.rs::admit` tests; open questions become `unconfirmed` across a restart)
- [ ] Host disconnect is deduplicated rather than generating one false failure per terminal.
- [ ] Events do not duplicate on reconnect; background restoration does not clear unread.
- [ ] OS notifications, if enabled, navigate correctly and do not expose sensitive content by default. Unsupported delivery is explicit.
- [ ] Unsupported question/approval controls stay in the real CLI; Perch does not fake an approval UI.

**Not required:** every provider capability, whole historical event reconstruction while core was stopped, automation subscriptions, task management, or a second chat UI. Disclose missing historical evidence honestly.

## 5. Nonnegotiable safety and durability gates

These gate all alpha promotion regardless of feature completion or performance exceptions.

### Runtime and terminal

- [ ] Confirmed Alive / Exited / Unknown semantics replace ambiguous liveness decisions on the shipped path.
- [ ] Runtime incarnation distinguishes reattached process from a later process reusing a key/PID.
- [ ] Daemon unavailable does not silently produce a non-durable process.
- [ ] Attaching/watching does not resize a terminal without authority.
- [ ] Input/resize leases reject stale generations, including reload/takeover races.
- [ ] Closing an owned runtime stops the intended managed execution; watcher dismissal only detaches.
- [ ] App quit/core crash preserves execution; daemon loss/reboot restores stopped descriptors, not silently relaunched commands.
- [ ] No automatic hibernation undermines the advertised live-process continuity promise on the supported path.
- [ ] Output queues are bounded end to end; slow consumers cannot grow memory indefinitely.
- [ ] Retention gaps and history-write failures are explicit. No unexplained loss within the supported retained range.
- [ ] Replay handles ordering/sizing/Unicode and suppresses historical clipboard/notification/device-response side effects.
- [ ] Common supported shell/agent descendants are not left orphaned by explicit close; limits of containment are documented.

### Files and destructive operations

- [ ] Dirty draft + external change + core crash preserves draft and conflict evidence.
- [ ] Save intent/receipt recovery does not overwrite a newer draft or changed external content silently.
- [ ] Truncated/oversized previews cannot overwrite original files.
- [ ] Root/path confinement and symlink-race defenses apply to new preview/download endpoints.
- [ ] Worktree deletion preflight includes running work, dirty buffers/files and unmerged branch consequences; recheck at execution.
- [ ] Failed/unconfirmed process stop blocks destructive cleanup from being reported complete.
- [ ] Remove project leaves the original folder intact and clearly scopes stopped work.
- [ ] Resource/layout migration retains recoverable legacy state; repeat migration does not duplicate resources.

### Trust and network

- [ ] Loopback/network-binding defaults are reviewed, explicit and accurately documented.
- [ ] Origin/Host/authentication checks cover browser WS/HTTP, native clients, paired devices and new binary endpoints.
- [ ] Device revocation and disconnect behavior are tested; secrets do not leak through logs or URLs.
- [ ] SSH host verification remains enabled; agent forwarding is opt-in, not an implicit default.
- [ ] Remote installer/update verifies the selected artifact and never restarts live work without consent.
- [ ] Merely adding/opening a project never executes its setup/tasks/plugins/hooks.
- [ ] Run/external-open actions validate scheme/path/host and require user intent.
- [ ] Markdown/HTML/SVG cannot reach privileged DOM, Perch credentials or Tauri authority; adversarial file tests cover this.
- [ ] Untrusted web content has no access to privileged app DOM, credentials or Tauri authority. Existing native child-webview browser features require separate security evidence; browser presence does not waive the gate.

## 6. Completion and verification order

[ROADMAP](ROADMAP.md) owns implementation priorities. The original first-slice
sequence is retired: local mixed canvas, attention and much of resource handling
already exist. Each implementation slice still needs a focused regression,
relevant suites, an isolated probe and a local checkpoint; no push/publication
without instruction.

For the release candidate:

1. Freeze the support matrix and any remaining product/security decisions;
   record reproducible performance/recovery baselines.
2. Reuse existing local mixed-canvas/recovery tests to establish D1. Retain
   legacy state and runtime identity; fix any reproduced blocker, not a dated
   source-review hypothesis.
3. Close remaining D2 gaps (Quick Open, explicit Run, Markdown/resource actions
   and session-free browsing), then verify the non-Git/no-agent workflow.
4. Complete D3 on an authorized actual Linux host, including file/Git/worktree
   operations, reconnect, no local fallback and confirmed cleanup. No host means
   this evidence is blocked, not waived.
5. Verify local and remote questions plus reconnect/dedupe and all section 5
   safety/trust gates. Fix prerequisites earlier whenever needed.
6. Measure the packaged candidate, run the differentiation tasks, finish public
   docs and clean install/upgrade checks, then record the launch decision.

This is an evidence sequence, not a requirement to delay remote implementation
until all local acceptance work is finished.

## 7. Acceptance scenario catalogue

Use these IDs in tests and release evidence. Prefer existing tests/helpers and expand them rather than create a second harness. Not every scenario needs a real paid agent turn.

| ID | Scenario | Required result |
|---|---|---|
| AT-01 | Non-Git folder, file open, canceled launcher | No Git requirement, agent or chat/session created merely for browsing. |
| AT-02 | Mixed terminal/file/diff order and split | Consistent keyboard/click order; same-context resources shown together. |
| AT-03 | Switch project; close last tab | Exact context restored; no unrelated fallback. |
| AT-04 | App quit + core kill/restart | Same surviving runtime incarnation and resource/layout identities. |
| AT-05 | Daemon connection loss vs daemon death | Unknown/reconnect versus confirmed stopped distinguished; no automatic duplicate launch. |
| AT-06 | Two viewers/reload/control takeover | Independent focus/layout; one PTY size; stale leases rejected. |
| AT-07 | Owned close vs watcher dismiss | Intended execution stopped only by authorized close; watchers detach. |
| AT-08 | Legacy layout/file migration twice | No dropped panes/drafts, no duplicate resource or restarted PTY. |
| AT-09 | Dirty file + external edit + save/crash | Recoverable draft/base/conflict; no silent loss. |
| AT-10 | Text/Markdown/image/PDF fallback/unknown | Useful renderer/action; read-only view works; oversized data bounded. |
| AT-11 | Malicious HTML/SVG, symlink race, misnamed file | No privileged execution or filesystem escape. |
| AT-12 | Run/copy context on inactive or busy target | Correct frozen target; no implicit Enter or command injection. |
| AT-13 | Real remote workflow | Remote files/Git/worktree/runtime all use owning host. |
| AT-14 | Remote disconnect during start/save/stop | Uncertainty visible; receipts reconcile; no blind retry/local fallback. |
| AT-15 | Delete worktree with active work/draft/unmerged branch | Scoped preflight, confirmation/revalidation, no hidden orphan or lost draft. |
| AT-16 | Question/answer, completion, stale evidence | Read != resolved; no fabricated success; exact resource navigation. |
| AT-17 | Attention reconnect/background restore | No duplicate notification or automatic acknowledgment. |
| AT-18 | Fast output + slow/disconnected viewer + compaction | Bounded memory, responsive controls, explicit replay gaps. |
| AT-19 | Disk-full/history write failure | Visible degradation; no false persistence claim. |
| AT-20 | Unicode, alternate screen, resize and replay | Supported terminal corpus remains correct; no replay side effects. |
| AT-21 | Unrelated web origin, revoked device, wrong scope | Denied without exposing data or mutation authority. |
| AT-22 | Clean packaged install and upgrade with live execution | CLI discovery works; compatible daemon adopted, no silent execution interruption. |
| AT-23 | Keyboard-only and 200% UI zoom | Open/switch/split/save/attention/close remain usable; visible focus and correct restoration. |
| AT-24 | Browser-reserved and terminal keys | Browser keeps reserved keys; PTY receives native input except documented app/leader shortcuts. |

## 8. Performance gate

Full proposed budgets/methodology are in PRODUCT-STRATEGY section 18. They are targets, not measurements or advertising copy.

Minimum release evidence:

- [ ] Release-build cold/warm startup on named hardware.
- [ ] Aggregate owned-process memory and idle CPU for 0/1/5/20 terminals, with workload/scrollback recorded.
- [ ] Local echo and under-load response distribution; parser time distinguished from actual display timing.
- [ ] ASCII/ANSI throughput, queue depth, retention/gap behavior and no-viewer capture.
- [ ] Project/tree/file/Git timings on defined repositories.
- [ ] Real remote reconnect and echo overhead with RTT recorded.
- [ ] Comparison with the pre-change baseline; no unexplained regressions.

Performance exception policy: an unmet numerical target can receive a written, scoped owner-approved exception after measurement. Record actual value, user impact, mitigation and follow-up. Unbounded memory, data loss, false lifecycle state, security failure or failure of D1–D3 cannot receive a routine performance exception. Do not rewrite the frontend to avoid profiling, or kill/evict unrecoverable state to improve benchmark numbers.

Production WebGL is already implemented; WebDriver retains DOM for e2e text assertions. Measure the current renderer and verify context replacement/release rather than scheduling adoption again. A native renderer rewrite is not an alpha prerequisite.

## 9. Differentiation validation gate

Recruit approximately five target developers for the release decision; private testing is allowed before public launch. Include people whose existing workflow is terminal + editor and people familiar with a close alternative.

Compare the same task outcomes against the participant's normal setup and, where practical, cmux or Orca. Do not configure alternatives badly to manufacture a win. Use the same project and separate unfamiliarity/setup time from steady-state use.

Tasks:

1. Inspect agent changes alongside source and an output artifact.
2. Leave/reopen and identify the same process/context without reconstruction.
3. Respond to a question in the correct workspace.
4. Repeat on a remote host through disconnect/reconnect.

Record completion, navigation/window/context switches, manual reconstruction steps, mistakes about host/process lifetime, assistance needed and qualitative preference. This is directional product validation, not a statistically significant market study.

### Proposed pass bar

- [ ] At least four of five complete the core local workflow without explanation of internal session/pane concepts after a brief introduction.
- [ ] At least three of five identify a concrete recurring benefit over their baseline and would use Perch for that workflow—not merely prefer its appearance.
- [ ] Remote-capable participants complete D3; at least two independent users verify the remote benefit.
- [ ] No participant leaves with an uncorrected belief that closing a runtime tab preserves its process, that reconnecting restarts work, or that remote paths execute locally.
- [ ] A short decision records where Perch is actually better, equivalent or worse; release claims follow that evidence.

If this fails, revise the workflow or positioning. Do not answer failure by adding a dashboard, provider count, integrations or a native rewrite without a demonstrated causal link.

## 10. Explicitly excluded from the alpha critical path

- Native frontend/terminal rewrite; libghostty integration; Metal renderer.
- WebGL adoption without measurement.
- General-purpose embedded browser, design mode or computer use.
- Full PDF/data/media/archive/notebook suites.
- Full editor/LSP/debugger platform.
- Orchestration, automations, agent kanban/dashboard.
- Provider account hot-swap, quota or usage-accounting dashboard.
- Jira/Linear/GitHub project-management surfaces; comprehensive PR/checks integration.
- Plugin marketplace/public extension system.
- New Hosted/custom agent chat UI.
- Native mobile client/full mobile IDE.
- Windows port and every remote architecture.
- A new task entity, arbitrary tab-group system or windowing engine.
- Floating terminal or third navigation palette.
- Exact historical semantic-event recovery while core was stopped, unless a concrete alpha workflow requires it.

Preserve existing features/data during migration; excluded does not mean delete working code indiscriminately. Optional additions may ship only if they do not delay or weaken the required differentiated workflow.

## 11. Packaging and public-facing readiness

The repository is public and already contains GPL-3.0-only LICENSE and
THIRD_PARTY_NOTICES; a tracked root README and public security/privacy guidance
are still absent at this source refresh. Published-release status needs a live
check at release time. The existing release workflow builds draft macOS/Linux
installers and Linux daemon artifacts; use it rather than inventing distribution
infrastructure.

- [ ] README explains the actual differentiated workflow, supported platforms, installation, quick start and limitations.
- [ ] Short screenshot/demo shows D1–D3 honestly; no unimplemented features or unmeasured speed/memory claims.
- [ ] Review the existing GPL-3.0-only license, THIRD_PARTY_NOTICES and dependency/distribution obligations against the actual shipped artifacts. License selection is not an open feature task.
- [ ] SECURITY/contact guidance explains command authority, project trust, remote access, pairing, credentials and responsible reporting.
- [ ] Privacy/retention docs describe local metadata, terminal history, drafts, provider-owned data transfer and deletion behavior.
- [ ] Issue template/report instructions request version/platform/provider and redact secrets, terminal contents and hostnames by default.
- [ ] Freeze named platform/provider versions and known limitations, including experimental paths.
- [ ] Choose one documented contributor package-manager workflow; resolve dual-lockfile ambiguity deliberately, not by casually deleting a lockfile. Current release CI uses npm.
- [ ] Build and smoke-test actual release artifacts from a clean checkout/environment.
- [ ] Verify install, first launch, CLI PATH discovery, missing-provider errors, restart/update, uninstall and surviving-daemon explanation.
- [ ] Decide macOS signing/notarization. Current workflow documents ad-hoc signing, not notarization; if alpha ships that way, disclose exact installation friction and get explicit owner approval. Do not normalize disabling security globally.
- [ ] Record checksums, release notes, recovery/backup instructions for schema migration and compatible-daemon policy.
- [ ] Before any push, perform required public-history/internal-name review. Do not include private hosts, credentials or local research artifacts.
- [ ] Publish/tag/push only on explicit owner instruction.

## 12. Verification discipline

Follow [TESTING](TESTING.md), not the installed user's app:

- Relevant Rust core/daemon suites, web tests/build, formatting/clippy with no new warnings, focused headless e2e and isolated real probe per slice.
- New e2e specs enter the appropriate testMatch/config.
- Isolate database, hosts, settings, pairing/device state when relevant, and daemon directory. Never use the installed app daemon for probes.
- Clean up probe core/daemon/processes and remote test worktree afterwards; confirm rather than assume remote cleanup.
- Cheap allowed models only; verify banner before first prompt. Deterministic synthetic CLI fixtures for most fault/performance tests.
- No focused/headed automated UI. Do not equate hidden-window timing with real interactive presentation performance.
- Known flaky/unavailable-provider failures are recorded and rerun narrowly where appropriate, not silently counted as passes.
- No implementation claims based only on an empty diagnostic cache or a successful build.

## 13. Evidence ledger and release decision

Maintain evidence against the actual candidate commit. Existing tests or earlier source inspection do not automatically pass a row. Reports must survive e2e artifact cleanup and contain no sensitive data.

| Gate | Status | Evidence required |
|---|---|---|
| Contracts/support envelope | Not verified | Decision record and affected invariant updates. |
| D1 mixed restored canvas | Not verified | Candidate commit, scenario/test IDs, real probe. |
| D2 resources/actions | Not verified | Safe-format/adversarial cases, no-agent workflow. |
| D3 remote continuity | Not verified | Actual host platform, qualified identity/reconnect/cleanup evidence. |
| Attention | Not verified | Tested provider/version, question/resolution/dedupe evidence. |
| Durability/data safety | Not verified | AT-04–09, AT-14–20 and migration/fault results. |
| Security | Not verified | Auth/origin/trust/preview/remote review and tests. |
| Performance | Not measured | Reproducible release-build distributions and approved exceptions. |
| Differentiation | Not tested | Comparison observations and owner go/no-go. |
| Packaged install | Not verified | Actual installer/clean-environment/upgrade result. |
| Public docs/license | Not complete | README, license decision, limitations/privacy/security/release notes. |

Every evidence entry should include date, candidate commit, platform/provider versions, command/scenario, result, retained report location and remaining limitations. Record implementation progress here rather than changing unchecked requirements into ambiguous prose.

### Launch decision

Launch only when D1–D3, safety/security and the differentiation gate pass; the support envelope, installation and known limitations are clear; and performance is measured with any exceptions explicitly accepted. No unresolved data-loss, false-exit, wrong-host execution, invisible-owned-process or untrusted-preview issue is an acceptable alpha limitation.

If a core promise is removed, update this contract through an explicit owner decision and reconsider the differentiation claim. Do not quietly ship today's terminal product under the future product description.
