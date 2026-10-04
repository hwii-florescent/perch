# Perch: product and technical strategy

## Status, authority, and reading order

Recorded 2026-10-04 from the product/architecture research and subsequent owner discussion. Implementation baseline: `1212d5e1e554b646e97827a51dfa9d1ad47b2b6d`. Local Orca reference: `564f1352`.

**Owner direction:** aim for the earliest **differentiated** public release, not the earliest release of the current agent-terminal application. Durable terminals alone are insufficient. Build and validate a coherent project workspace before launch.

This document is the long-term product and architecture proposal. It does not claim the design is implemented, certify the code, or silently amend the current behavior in [AGENTS.md](../AGENTS.md). Specific invariant changes need ratification before their implementation slice. The research found no exclusive feature moat; differentiation remains a hypothesis to validate against alternatives.

Read together:

- [PUBLIC-ALPHA.md](PUBLIC-ALPHA.md): bounded first-release requirements, build order, acceptance scenarios, and launch gates. This controls alpha scope; the whole strategy is not a launch prerequisite.
- [UI-UX-DIRECTION.md](UI-UX-DIRECTION.md): detailed interaction design, including proposed changes awaiting approval. Reuse it rather than inventing another UI specification.
- [ARCHITECTURE.md](ARCHITECTURE.md): implementation baseline and historical build sequence. Its older parity-led roadmap is not the new product priority.
- [ORCA-PARITY.md](ORCA-PARITY.md): reference inventory, not requirements.
- [TAILWIND-MIGRATION.md](TAILWIND-MIGRATION.md): required procedure before implementation touches styles.

### Evidence conventions

- **FACT:** inspected source or documented external behavior. Product documentation establishes a documented capability, not independently tested quality.
- **INTERPRETATION:** a conclusion from the evidence.
- **RECOMMENDATION:** the proposed Perch contract. Unless otherwise labeled, target designs and budgets below are recommendations.

Research covered source in perch-core, perchd, perch-desktop, shared/web, terminal/session, filesystem, Git/review, worktrees, remote routing, protocol and native-agent bridges. It also used current official repositories, docs and release discussions linked in section 25. Competitors were not installed or benchmarked. No Perch performance measurements were taken in this research. Source risks are not reproduced incident reports. External sources are a dated research snapshot, not a compatibility guarantee; verify supported versions again before implementation/release.

## 1. Final product thesis

> **Perch is a lightweight, durable workspace for terminal-led development. It keeps real shells and coding agents alongside the files, changes, and app previews needed to understand their work, across local and remote projects.**

The install-worthy promise:

> Open a project, leave its work running, and return to the same terminals, files, and decisions—locally or remotely—without changing your CLI or editor.

Browser-like means opening resources in tabs, scoped contexts, splitting related work, simple navigation, and reliable restoration. It does not mean building a general browser, automatically archiving development work, or treating a process like a disposable web page.

### Beyond Ghostty + Claude Code + worktrees + an editor

That combination can reproduce most individual capabilities. Perch should remove recurring coordination work:

- Remember which execution belongs to which checkout and machine.
- Reattach to a surviving process rather than accidentally start another.
- Bring a real question to the user without inspecting every terminal.
- Put the relevant resource/diff beside the execution.
- Preserve drafts and context through crashes and reconnects.
- Safely stop owned execution when its tab/context is explicitly removed.
- Offer the same resource workflow remotely without hand-assembled tools.

**INTERPRETATION:** Perch is valuable when managing continuity costs more attention than writing commands. The product is the coherent workflow, not a collection of individually unique features.

**RECOMMENDATION:** Validate reduction in navigation, reconstruction and uncertainty. Do not market ordinary terminals, worktrees, generic tabs, Rust, or provider count as unique.

## 2. Users and core workflow

### Primary user

An individual developer who already prefers CLI tools, uses one or several coding agents, works across projects/parallel checkouts, sometimes uses a remote workstation, and wants an editor available without making the editor own every workflow. Design for two to five concurrent streams of work, not fifty agents.

Secondary users include remote-Linux developers on macOS, developers handling logs/reports/screenshots/data alongside code, and people checking progress or answering a question from a phone. Team administration, no-code users, and production autonomous-agent operations are not the design center.

### End-to-end workflow

1. Explicitly add a local or remote project folder.
2. Use the original checkout or request an isolated context.
3. Open a shell or installed agent; no compulsory task/model/account wizard.
4. Open relevant files and changes beside it.
5. Explicitly run a known project command when needed.
6. Switch away; execution continues.
7. Respond when trustworthy evidence says attention is needed.
8. Review changes, use Git/PR tools, and close completed work.
9. Quit and return without reconstructing context.

Install to reduce coordination between terminals, paths, worktrees, machines and agent attention. Keep using Perch because restoration, reconnection, terminal input and closure become predictable enough to stop thinking about.

### Deliberate noncompetition

No best-model/harness race, comprehensive code intelligence, full debugger platform, Git history/branch-management replacement, issue tracker, orchestration engine, general browser, or provider account/quota management. External editors remain first-class companions.

## 3. Competitive analysis

The following are documented capabilities, not comparative performance or reliability scores. Sources E1–E18 are linked in section 25. Do not infer a missing feature from a brief comparison.

| Product | Evidence / overlap | Interpretation for Perch |
|---|---|---|
| Orca | CLI agents, worktrees, daemon restoration, mixed resources, remote/mobile, CLI automation and browser tools. | Closest breadth competitor. Generic surfaces and durability are not unique; avoid parity-led development. |
| T3 Code | Harness control surface; desktop/web/mobile, background service, multiple providers and review/source-control workflows. | Bring-your-subscription and multi-client agent control are established. Keep the actual CLI interaction rather than create another conversation product. |
| Emdash | Parallel agents, task/worktree workflow, SSH remote projects, diffs, PR/CI and issue integrations. | Agent + worktree + remote is already a category. Avoid mandatory task objects and integration breadth. |
| Conductor | Isolated workspace, setup/run context, agents, review/checks and PR workflow. Its docs distinguish worktree isolation from permission isolation. | Learn its complete loop without forcing every shell/file through task → PR → archive. |
| cmux | Swift/AppKit, Ghostty-based terminals, notifications, programmable surfaces, browser panes, SSH and remote-tmux beta. | Strongest challenge to a lightweight terminal workspace. Native UX and terminal quality are occupied territory. |
| Herdr | Background-server panes, agent states, SSH attachment, saved machines and remote continuity. | Durability/remote/status are not vacant niches. Perch's graphical resource/review workflow matters more. |
| Warp | Terminal/agent/editor integration, command-oriented UX, SSH and cloud-agent features; SSH capabilities have documented limits. | Preserve real terminal input instead of adopting another composer or harness. |
| Zed | Native editor, remote development, terminals and ACP external agents. | Native speed and open agents are insufficient positioning. Let it be a good external editor. |
| Cursor | Editor agents, isolated worktrees, cloud/background work and review. | Agent/worktree coordination is mainstream. Remain useful without Cursor's editor or harness model. |
| VS Code | Mature files/terminals/extensions/remote; newer agent sessions, worktrees, remote hosts and browser access, some experimental. | Moving competitive baseline; remote agent access is not uncontested. |
| GitButler | Parallel branch and agent workflows within a shared working directory. | Do not invent another branch model. Worktrees are useful for separate checkout/runtime state, not mandatory for every agent. |
| GitKraken | Worktree/agent visibility, approvals, Git graph and review workflows; documented in Desktop 12.4. | Agent visibility/review are increasingly normal Git-client features. |
| Claude Code | CLI interaction, hooks, session continuity, tools and permissions. | Observe and integrate; do not reproduce its harness. |
| Codex CLI/app | CLI, shared app-server harness, worktrees and desktop agent workflow. | Useful integration boundary and a competitor. App-server transport stability warnings matter. |
| OpenCode | CLI with server/OpenAPI/SSE and SDK interfaces. | Prefer supported observations tied to the real session, not screen scraping or a second UI. |
| Pi / OMP | Extensible terminal harnesses; RPC/SDK/extensions. OMP also owns substantial tool/coordination features. | Agent extensibility belongs primarily inside the agent. Treat their evolving APIs independently. |
| Superset and similar workspaces | Worktree-backed agents, terminals, review, tasks and automation. | Feature-bundle differentiation will decay quickly. |

**FACT:** Every individual proposed differentiator has substantial overlap elsewhere.

**INTERPRETATION:** The opportunity is the combination of real CLIs, durable execution, optional worktrees, general project resources, remote continuity and low conceptual overhead.

**RECOMMENDATION:** Compare actual end-to-end tasks against cmux, Orca and a user's terminal/editor baseline before claiming the combination is meaningfully better.

## 4. Commodity versus differentiator matrix

| Capability | Market position | Appropriate investment |
|---|---|---|
| Multiple agents | Commodity | Reliable launch and observation; not provider count. |
| Worktree creation | Commodity | Optional isolation and safe lifecycle. |
| Terminal tabs/splits | Commodity | Fidelity, bounded resources, restoration. |
| Durable terminals | Established | Strong failure semantics, not uniqueness claims. |
| Git status/diff/commit | Commodity | Enough to understand and finish work. |
| Explorer/text editor | Commodity | Fast, general-purpose and safe, not IDE breadth. |
| Common previews | Commodity individually | Consistent resource/actions and external fallback. |
| Remote SSH | Established | Complete workflow parity and honest reconnect. |
| Embedded browser | Common and costly | Narrow app-preview use, later. |
| Review-to-agent feedback | Increasingly common | Reuse anchors/packets and trustworthy delivery. |
| Agent dashboard | Commodity | Small attention queue instead. |
| Orchestration | Crowded, volatile | Leave to agents/external tools. |
| Cross-surface continuity | Integration-quality opportunity | Primary investment. |
| Low overhead with many resources | Potential differentiator | Measure and enforce. |
| No required editor/harness/cloud lock-in | Product distinction | Preserve across every feature. |

## 5. Four durable differentiation directions

These are defensible engineering investments, not exclusive moats.

1. **Execution continuity as a tested contract.** Surviving process identity, explicit recovery, uncertainty, no duplicate launch or invisible managed execution. Requires agreement across daemon, database, protocol and UI.
2. **Workspace independent of agent/editor choice.** Useful without an agent, with a manually launched CLI, an external editor, and a non-Git folder. Product discipline can survive provider churn.
3. **Local/remote resource continuity.** Execution, files, Git, worktrees, review and search share a host-qualified context. SSH alone is not the feature.
4. **Low interaction and resource overhead.** Few compulsory concepts, quiet attention, lazy views, bounded memory and quick switching. Must be demonstrated, not inferred from Rust.

The alpha must exhibit a useful portion of all four. The complete long-term feature set is not required; see the separate release contract.

## 6. Existing implementation and evidence

### Foundations to keep

| FACT from inspected implementation | Decision |
|---|---|
| Rust domain modules plus thin server adapters, especially filesystem/source-control/review. | Keep domain logic out of React and independent of wire handlers. |
| Axum HTTP/WS shared by desktop and browser. | Keep one client boundary. |
| SQLite metadata and durable buffer/save-intent/receipt machinery. | Keep; do not replace with client-only state. |
| Filesystem root descriptors, no-follow traversal, bounded reads, hashes and atomic publication. | Preserve in every new opener and streaming endpoint. |
| Git argv, timeouts, output bounds and preview-based confirmations. | Reuse for mutations; do not reimplement Git bookkeeping. |
| perchd raw bytes, retained logs and ordered replay/live attachment. | Keep PTYs detached from app/core lifetime. |
| Generation-bound input/resize leases. | Preserve one PTY size and explicit control. |
| AgentLifecycleRegistry and provider manifests. | Extend, do not add a second state machine. |
| OpenSSH CLI transport and ControlMaster reuse. | Keep users' SSH authentication/configuration. |
| Tauri/React/Dockview/xterm; terminal-profile import and faithful input. | Keep pending measurements. |
| Review anchoring, packets and delivery receipts. | Improve their placement in the canvas, not rewrite them. |

### Concrete gaps and risks to investigate

| FACT / source observation | INTERPRETATION | RECOMMENDATION |
|---|---|---|
| `terminal.rs::runtime_alive` maps daemon lookup failure to false; agent exit handling uses that boolean. | Unreachable can look dead. | Typed Alive / Exited / Unknown; never finalize termination from uncertainty. |
| `attach_inner` can spawn an in-process fallback if perchd is unavailable. | Durability silently becomes weaker apart from logs. | Fail/retry by default; temporary non-durable mode only with explicit visible consent, if retained at all. |
| `attach_daemon` resizes an existing daemon process during attachment. | Attach and resize authority are not cleanly separated on that path. | Preserve host dimensions until a lease-authorized resize. |
| Core replay is 128 KiB; daemon default attach tail 512 KiB; history cap 8 MiB, compacting to newest half. | Persistence is bounded, not full history or complete terminal-state restore. | Publish retention and report gaps. |
| Daemon attach clamps old offsets to retained range. | Slow-reader recovery is not unconditionally lossless. | Typed gap/reset; never silently imply complete replay. |
| Core WS output and daemon-client paths include unbounded channels. | Daemon subscriber limit is not end-to-end backpressure. | Bound every stage and acknowledge processed output. |
| Daemon output pump ignores log-write errors. | Live output may continue while persistence fails silently. | Report degraded history, distinguish captured/persisted offsets. |
| Worktree removal calls Git then archives metadata without a comprehensive live-work/draft preflight. | Execution and drafts can become stranded. | One revalidated server deletion plan, including running work and recoverable buffers. |
| Files are separate localStorage tabs; layouts belong to sessions; active files lose to session switching. | Competing ownership models prevent uniform splits/restoration. | Canonical surfaces and viewer-scoped presentation. |
| WS connection resumes/creates a session. | Viewing a file/project can inherit chat-first assumptions. | Connect/negotiate/subscribe without creating work; keep legacy handshake compatible. |
| Hub capability allowlist excludes full workspace metadata/fs and newer unverified agent paths. | Remote foundation is not complete local/remote parity. | Host-owned remote workspace slice, capability-gated. |
| Lifecycle state is projected into additional running/blocked sets; heuristics and stale display rules still exist. | Do not describe every signal as equally trustworthy. | One authoritative projection, explicit provenance and uncertainty. |
| Native bridges normalize transcripts as well as status. | Metadata observation can carry unnecessary chat coupling. | Separate lightweight observations from frozen transcript views. |
| Auto-hibernation can terminate an eligible agent PTY and later resume its conversation. | Conversation continuity is not process preservation. | Prefer explicit/opt-in hibernation; prove safety before promising durability. |

These observations need focused reproductions and regression checks, not an indiscriminate rewrite. Provider-launch wrapper, daemon-end and shell-exit are different events.

Source anchors:
[terminal](../crates/perch-core/src/terminal.rs), [daemon client](../crates/perch-core/src/daemon.rs), [agent runtime](../crates/perch-core/src/agent_runtime.rs), [lifecycle](../crates/perch-core/src/agent_fleet.rs), [daemon server](../crates/perchd/src/server.rs), [daemon protocol](../crates/perchd/src/proto.rs), [daemon stream client](../crates/perchd/src/client.rs), [filesystem](../crates/perch-core/src/filesystem.rs), [buffers](../crates/perch-core/src/db/file_buffers.rs), [Git](../crates/perch-core/src/source_control.rs), [review](../crates/perch-core/src/review.rs), [worktree operations](../crates/perch-core/src/worktree.rs), [workspace adapter](../crates/perch-core/src/server/workspace.rs), [hub](../crates/perch-core/src/hub.rs), [SSH](../crates/perch-core/src/ssh.rs), [server](../crates/perch-core/src/server/mod.rs), [native bridges](../crates/perch-core/src/native_ui/mod.rs), [file tabs](../packages/web/src/fileTabs.ts), [layout](../packages/web/src/dockview/DockviewShell.tsx), [socket](../packages/web/src/ws.ts), [terminal setup](../packages/web/src/xtermSetup.ts), [file UI](../packages/web/src/components/WorkspaceFiles.tsx).

## 7. Target architecture and ownership

```text
CLIENTS
  Tauri native shell: window, notifications, narrow OS integration
  Shared React / Zustand / Dockview frontend
    xterm | files | diffs | later isolated previews
  Browser / PWA: same frontend
  Future CLI / TUI: same client API, not another runtime
                       |
          authenticated HTTP + WebSocket
          JSON control/events; bounded streams
                       |
  perch-core (local execution host and optional remote hub)
    authorization / capabilities / domain actions
    projects / workspaces / resources / runtime ownership
    agent observations / attention / viewer records
    filesystem / buffers / Git / review / search
    SQLite: durable domain metadata
    Project filesystem: actual files
             |                         |
     private framed socket          OpenSSH tunnel
             |                         |
  perchd: PTYs, process identity,    remote perch-core
    retained raw output,            owns remote domain state
    observational terminal state        |
             |                      remote perchd
             |                          |
       shells / agents / project commands
```

### Ownership contract

- Execution host owns runtime, workspace, file, Git and attention facts.
- perchd owns PTYs and retained output; no project/Git/agent-product logic.
- Core owns authorization, domain mutations, durable metadata and reconciliation.
- Frontend owns rendering and immediate presentation; it is not an execution authority.
- Stable viewer identity owns active selection, geometry and reading position. One viewer must not move another's focus or compete on PTY resize.
- Agents own conversations, tools, authentication and their execution policy.
- Local core may coordinate a view spanning hosts; it caches remote facts rather than duplicating their authority. Remote IDs are always host-qualified.

Keep desktop core in-process initially. An always-running core service may eventually help notifications but is not necessary for PTY durability; do not add one before its lifecycle/security cost is justified. A future native client talks to the same domain boundary, not directly to SQLite.

## 8. Terminal architecture

| Option | What changes | Assessment |
|---|---|---|
| xterm.js DOM | Current frontend emulator/renderer | Baseline; established integration and broad web portability. |
| xterm.js WebGL | Renderer, not parser/transport | Best first performance experiment; GPU memory/context loss and tests must be included. |
| libghostty-vt | VT parsing/state/input facilities | Not a drop-in renderer. Upstream header explicitly says incomplete/unstable API. |
| Embedded native Ghostty surface | Terminal integration/rendering | Viable in products such as cmux; upstream `ghostty.h` is an internal embedder API, not a stable general embedding contract. |
| SwiftTerm | Swift emulator with AppKit/UIKit frontends | Plausible native-client component, not an improvement to the shared web UI by itself. |
| VTE | Mature GTK terminal widget | Linux-native option, not a cross-platform replacement. |
| WezTerm/other reusable internals | Emulator primitives | References worth watching, not an established cheaper integration for Perch. |

**FACT:** No measurements from this research establish xterm.js as Perch's meaningful bottleneck. Upstream xterm flow-control documentation describes asynchronous writes and overload loss; its published throughput examples are not Perch benchmarks. See T1–T4.

Profile queues, string/JSON conversion, copies, repeated parsing, inactive mounts, replay, resizing and React/store updates first. WebGL cannot fix incorrect leases, missing history, remote RTT or oversized snapshots.

### Emulation ownership

Keep interactive emulation frontend-side for now. Server-rendered cells would create another display protocol and require selection/search/accessibility/input/font coordination. Do not build one.

Use perchd's VT state for bounded reads, diagnostics, titles and headless observations. Current snapshot text/title/cursor/alternate-screen data is not full xterm state. It is not yet a reliable basis for arbitrary emulator eviction/restoration.

A checkpoint experiment must prove modes, dimensions, ordered resize history, alternate screen, Unicode and stream offsets. Historical clipboard writes, notifications and terminal queries must not replay as live side effects. Only one designated endpoint may answer terminal device queries; an observer must not race the controlling emulator. If headless behavior needs more terminal protocol coverage, adopt a mature engine rather than extend an ad hoc emulator.

Do not present an arbitrary raw-stream tail as exact state restoration. On retention gaps, explicitly reset/resynchronize using a verified strategy or show degraded history. Keep all bytes within the supported retained interval ordered; do not promise infinite scrollback.

### Decision

Keep xterm DOM now. Benchmark WebGL separately. No emulator rewrite or raw Metal renderer. Current AGENTS prohibits WebGL because tests read `.xterm-rows`; adoption requires explicit invariant revision and renderer-independent buffer assertions plus visual tests, not silently blinding the test suite. Terminal input, kitty keyboard behavior, theme/font, `convertEol: false`, and resize leases remain nonnegotiable.

## 9. Desktop frontend architecture

| Architecture | Benefit hypothesis | Cost / decision |
|---|---|---|
| Current Tauri + React | Shared desktop/web/PWA; lowest change cost | Keep. Memory/latency remain to be measured. |
| Current stack + WebGL | Faster rendering on some workloads | Benchmark; can increase GPU memory. |
| Optimized Tauri/WebView | Lazy resources, small updates, fewer wakeups | First investment; benefits browser too. |
| SwiftUI/AppKit | Native behavior and possibly lower overhead | Rebuild UI, layout, IME/accessibility, testing. Not justified now. |
| Shared web + separate Mac client | Platform specialization | Two frontend products/test matrices; only with demonstrated demand and resources. |
| Electron | Uniform bundled Chromium | Distribution/migration cost; no guaranteed performance improvement. No current reason. |
| Rust-native GUI | Backend-language reuse | Terminal/document/web-content/accessibility integration burden; no proven net gain. |

Tauri uses platform WebViews: smaller distribution is not proof of lower resident memory (T5). Count WebView/GPU helpers when benchmarking.

Rewrite only when reproducible budgets are missed, profiling locates the limiting architecture, incremental work fails, and a bounded native prototype shows material benefit (roughly 30% on the actual bottleneck or resolution of a blocking native limitation). It must also pass correctness, IME, accessibility, restoration and multi-view tests, with browser/Linux maintenance funded.

Windows is a real port: Unix sockets, PTYs/process trees, native bridges and filesystem confinement require work beyond enabling Tauri. Do not promise it from frontend portability alone.

## 10. Long-term core protocol

**Decision:** preserve HTTP/WebSocket as the long-term client boundary. Do not freeze every legacy message as ideal or replace the whole protocol with JSON-RPC, GraphQL, ACP, MCP or AHP.

Existing sources: [Rust protocol](../crates/perch-core/src/protocol.rs), [TypeScript protocol](../packages/shared/src/protocol.ts), [dispatch](../crates/perch-core/src/server/dispatch.rs). Protocol version 1, capability strings, request IDs, operation receipts, and snapshot epochs/revisions are useful starting points.

### Minimal evolution

- Add a client hello with supported major version/capabilities; retain old handshake for old clients.
- Advertise stable server identity, execution-host identity, connection epoch and supported capabilities.
- Add optional/defaulted fields. Version capability families when semantics change; a generic version number does not prove a feature is routed by a hub.
- Document unknown event/enum behavior. New clients receive explicit unsupported-command errors; do not wait indefinitely for messages an older peer silently drops.
- Support the previous stable major for a documented transition window; expand only if deployments demonstrate a need.
- Independent daemon negotiation: adopt compatible daemons; do not replace a live daemon to match the app release. Incompatible upgrade requires explicit migration/drain behavior.

| Message class | Convention |
|---|---|
| Request | Request ID, qualified target, arguments. |
| Response | Same request ID, typed result or structured error. |
| Event | Resource ID and revision; no reply obligation. |
| Long operation | Accepted operation ID, then bounded progress/final events. |
| Retryable mutation | Operation ID, payload identity and receipt; reusing ID with different payload is rejected. |
| Snapshot | Epoch + revision; resnapshot after discontinuity. |
| Terminal stream | Runtime incarnation + sequence + bounded chunks; explicit gap/reset. |

Do not retry raw terminal input after uncertainty. A disconnected `send` must not silently discard an important domain action; return an unavailable result and retain drafts locally where appropriate. Never queue keystrokes or blindly replay destructive actions on reconnect.

### Schemas and clients

Prefer Rust wire types as authority, generating TypeScript and JSON Schema using a small established tool after a compatibility spike. Verify absent vs null, defaults, tagged enums, unknown fields and integer limits (including u64 stream offsets in JavaScript). Golden fixtures and cross-version tests remain required. Generate simple client bindings, not a framework. Runtime validation is still needed at trust boundaries.

### Streams and backpressure

Bound every queue between PTY, daemon client, core, socket and emulator. Acknowledge processed output, not just received frames; prioritize control/recovery events over bulk output. A slow viewer may lag/resynchronize but must not exhaust memory or freeze all other viewers. Separate capture/retention limits from per-view delivery limits.

Binary WS terminal frames are a plausible reduction in conversion overhead, not an assumed improvement. Negotiate them only after measurement. Use HTTP streaming/ranges for bulk files, WS for control/invalidation. A small persisted attention history plus state snapshots is sufficient; do not event-source the whole application.

## 11. Generic Surface and tab architecture

Start with **Terminal, File, Diff**. Add Preview as a real consumer requires it. Data/browser formats can be providers; no speculative universal hierarchy.

Conceptual shape, not an implementation schema:

```text
ResourceRef: executionHostId, workspaceId, kind, typed locator
Surface: surfaceId, resourceRef, presentationKind, optional userTitle, schemaVersion
Execution: runtimeId, incarnationId, ownerSurfaceId, state, optional agentBinding
ViewerPresentation: viewerId, workspaceId, order, pins, splitLayout,
                    activeSurfaceId, bounded rendererState
```

### Identity

- Resource is what exists; Surface is how it is presented; viewer attachment is who sees it.
- Runtime ID, runtime incarnation, provider conversation, Perch legacy session and pane/view are different identities. PID alone is insufficient.
- Two views may reference one resource without creating two processes or independently saving over one another.
- File identity includes host/workspace/relative path. Immutable diffs include resolved revisions. A live working-tree diff is explicitly mutable.
- Use typed references internally. Deep links may serialize as `perch://<host>/workspaces/<id>/files/<encoded-relative-path>`; the URI is not authority to access a path.
- Resolve roots on the owning host. Do not authorize using arbitrary absolute paths or lossy filename display strings. Explicitly reject unsupported non-UTF-8 mutations until a lossless representation exists.

### State ownership

Core persists canonical open-work/resource/runtime records and drafts. Presentation is scoped to stable viewer identity: focus, order, pin state, splits and reading position. Host owns its resource facts; the connected local core can persist the viewer's presentation referencing qualified remote resources. A browser directly attached to a remote core uses that core for its viewer record. No cross-device layout synchronization engine is required.

Input lease is not durable ownership. Taking control does not transfer who owns or may destroy the resource. One globally owned runtime surface can have watcher views; dismissing a watcher does not end the runtime. Every managed process keeps a discoverable open-work record even with no connected client.

### Lifecycle

- Mount/unmount: rendering only.
- Open/close surface: durable open-work intent.
- Attach/detach viewer: observation/control connection.
- Start/stop execution: explicit process mutation.
- Switch tab/project or quit: continue execution.
- Close owned runtime tab: stop its execution with appropriate live/uncertain-work guard.
- Close clean file: view disappears, file remains. Dirty file: Save / Discard / Cancel; keep recovery until acknowledged.
- Turn completion is not process exit. Agent exits to shell in the same tab; shell exit follows the explicit current close policy.
- Reopen a terminated runtime means a stopped descriptor with Start/Resume choices, never automatic command re-execution.
- Pins organize/protect from bulk close, not a special persistence tier.

### Layout

Keep Dockview as engine, with a small versioned product layout adapter instead of making Dockview internals the public API. Splits reference surfaces and do not clone execution. Initial mixed splits stay within one workspace. Reordering is free; moving a live terminal across workspaces must not pretend its process moved. Offer New terminal there. Opening a corresponding file in another worktree creates another resource.

Reuse the detailed split-set/keyboard/close design in UI-UX-DIRECTION. Preserve legacy complex layouts before imposing a new creation ceiling; never drop old panes during migration.

### Restoration and migration

1. Add capability-gated descriptors alongside legacy records.
2. Map existing terminal/session identities without restarting anything.
3. Import local file descriptors once per viewer; dedupe on retry.
4. Translate layouts conservatively and retain originals until verified.
5. Restore descriptors, reconcile runtimes, then mount views lazily.
6. Missing paths/providers show recoverable placeholders; no blank substitute or automatic command launch.
7. Preserve save-intent recovery and dirty buffers throughout.
8. Remove the file-over-session overlay after mixed restore is proven.

Do not evict terminal emulators merely to meet RAM goals until state restoration is correct. Do not add a Terminal → File conversion abstraction; the small resource union is sufficient.

## 12. General-purpose file architecture

```text
Authorized ResourceRef
  → stat + bounded inspection
  → resolved type/evidence + capabilities
  → available viewers/editors/actions
  → selected Surface provider
```

Reuse FileService and durable buffers. Current previews are bounded; image preview is metadata-only, PDF MIME recognition is not a PDF viewer, and the current editor is a textarea. Do not advertise a rich viewer catalogue as existing.

### Resolution and associations

Combine extension/filename, bounded magic/signature inspection, encoding/binary detection and explicit associations. Return evidence/conflicts rather than a magical authoritative MIME string. User associations select a viewer; they do not waive safety checks. Misnamed HTML must not gain privileges because it ends in `.png`.

Use the freedesktop MIME specification as a reference for globs/magic, not an invitation to write a whole MIME engine. Use a mature existing dependency or small standard mechanism where sufficient. MIME is a hint, not a security boundary (F1).

### Ownership

Rust: authorization, metadata, bounded sniffing, byte access, host capability applicability, buffers/save, execution plans and validated external-launch requests.

Frontend: lazy rendering, selection, zoom, navigation and bounded display parsing. OS application enumeration/launch lives in the desktop adapter, with an explicit unsupported capability in ordinary browsers. UI presentation state need not move into Rust merely because domain logic does.

### Format policy

| Resource | Safe useful behavior | Deliberate limit |
|---|---|---|
| Source/text | Bounded editor, find, explicit save, external editor. | No full IDE/LSP/debugger platform. Use a mature editor component if needed. |
| Markdown | Sanitized rendering and source editing. | No automatic remote content fetch. |
| Image | Inert image viewer, fit/zoom/dimensions. | Bound decoded pixels; SVG never injected into privileged DOM. |
| PDF | Lazy read-only viewer or explicit external fallback. | No PDF editor; unsupported platform remains usable externally. |
| JSON/JSONL | Text plus bounded structured/log view. | Invalid content falls back to text, no implicit reformat. |
| CSV/TSV | Text or read-only virtualized table. | Sorting affects view only; no spreadsheet/formula engine. |
| Logs | Bounded ranges/tail, optional follow. | Rotation-aware later; do not load entire huge files. |
| HTML | Source default, explicit inert preview. | Live app is a separate trust context. |
| Media | Native browser controls where safe/supported; paused. | Range access and external codec fallback; no media editor. |
| Archives | Metadata/external open first. | Later bounded listing/extraction with traversal/link/bomb defenses. |
| Notebooks | Source or static read view. | No kernel/environment manager initially. |
| Scripts | Text. Run is separate. | No execution on open/drop/preview. |
| Executables/binaries | Information, Open With if meaningful. | Execute only through explicit supported action. |
| Unknown | Information, download, Open With, safe text fallback. | Never infer a shell command from the filename. |
| Directory | Lazy browsing, path navigation, actions. | Entering a directory does not register a project. |
| Read-only/symlink/oversized | View or explain limitations with useful fallback. | Writability is not viewability; never save a truncated preview over the original. |

### Binary transport

Authenticated HTTP streams/ranges for binary or large read-only files; WS for control/invalidation. Workspace-qualified handles, byte bounds, cancellation, validated ranges, correct content types and `nosniff`. No arbitrary `file://`, enormous base64 values in Zustand, or bypass of descriptor confinement. Consider cumulative cache limits, not just per-file limits.

### Open With / external actions

Distinguish internal renderer, OS app and execution. Use macOS NSWorkspace and appropriate Linux desktop facilities; a default opener is not automatically an application-picker API (F2). Do not silently change OS associations.

Remote Open externally must offer a labeled download/local copy or configured remote-aware editor. Never interpret a remote path locally or silently upload an external edit back. Browser clients offer download rather than pretending they can launch installed desktop apps.

### Explicit Run and agent context

Resolve a known command/interpreter/task; show host, cwd and command. Repository scripts are executable configuration requiring trust. Use a new owned terminal (or explicitly reusable idle run surface), never paste into an arbitrary busy shell/agent. Do not install dependencies automatically.

Copy context prepares a bounded path/range/excerpt. If disk and draft differ, make the source explicit. A folder reference is not recursive upload. Safe provider-specific draft insertion may be added; unsupported/busy agents fall back to Copy context, not simulated typing plus Enter.

## 13. Central action architecture

Borrow contextual action presentation from Raycast and command identity/enablement separation from VS Code (A1–A2). Browser/editor commands also distinguish focused resource from background menu target. Do not copy an extension system.

```text
ActionDefinition
  id, label, targetKinds, requiredCapabilities,
  argumentSchema, riskClass, executionLocation
```

Examples: `resource.open`, `resource.openWith`, `file.save`, `terminal.new`, `execution.stop`, `workspace.createIsolated`, `workspace.delete`, `review.open`, `attention.openNext`.

- Menus, keyboard shortcuts, toolbar and Cmd-K reference the same definitions/invocation path.
- Freeze the intended target when opening a menu; revalidate at execution.
- Client presentation actions: focus, zoom, toggle drawer, copy selection.
- Server domain actions: write, execute, delete, commit, authorize.
- Server validation and preview receipts are authoritative. Disabled UI is not authorization.
- Reuse current domain services; do not wrap every old message in a new command framework for symmetry.
- Cmd-K: actions and open-work navigation. Cmd-P: bounded workspace file search. No third Cmd-J navigation product.
- Client/platform-specific shortcuts: browser-reserved keys remain browser-owned; terminal Ctrl keys and kitty encoding remain intact, apart from the documented leader.

Later, a narrow CLI may expose list/read/open/notify and scoped mutations. Give agent callers workspace/runtime-specific authority; terminal input is execution authority. A future MCP adapter uses these same services, not separate implementations.

## 14. Agent capability architecture

Extend provider manifests and AgentLifecycleRegistry. Separate launch, observation and control. Observing a question does not mean being able to answer it safely.

Example capability vocabulary:

- `observe.status`, `observe.question`, `observe.approval`, `observe.usage`, `observe.sessionIdentity`, `observe.turnCompletion`.
- `control.interrupt`, `control.resume`, `control.submitPrompt`, `control.answerQuestion`, `control.answerApproval`.

Availability is supported / unsupported / temporarily unavailable / unknown for version. Probe on launch or explicit refresh using provider version/mode and bridge handshake, not repeated `--help` subprocesses.

| Provider | Preferred mechanism |
|---|---|
| Claude | Per-launch hooks; verified session identity; bounded transcript access only when needed. |
| Codex | Existing shared app-server/TUI; capability/version checks. Official transport warnings require pinned testing and terminal-only degradation, not a production-stability assumption. |
| Pi | Extension events inside the actual interactive process. |
| OMP | Its own supported events; do not assume permanent Pi API equivalence. |
| OpenCode | Plugin/server events tied to the actual CLI session. |
| Unknown CLI | Normal terminal; optional title/status heuristics labeled uncertain. |

Normalize observation with runtime incarnation, optional provider session/turn ID, evidence source, sequence/revision, timestamp and bounded detail. Unknown cost is not zero, silence is not done, process exit is not task success, and a dirty file is not proof of agent attribution. Preserve evidence precedence but allow explicit stale/unavailable states rather than permanent ownership by a dead bridge.

Status must not require transcript normalization. Keep frozen Hosted/UI adapters isolated; avoid new model/effort/account controls above the CLI. No forced second agent process to obtain metadata. User-launched agents in generic shells can be enhanced only when positively identified.

### Protocol assessment

| Protocol | Role |
|---|---|
| ACP | Useful optional client/agent integration and negotiation reference. Not automatically a passive observer of an existing CLI. Adopt only for a real provider/client need. |
| MCP | Possible tool/resource-facing adapter for scoped actions later. Not terminal or workspace lifecycle. |
| Agent SDKs | Use only where they integrate the same runtime without silently replacing the CLI experience. |
| AHP | Track synchronized multi-client agent hosting/interoperability. Does not replace Perch's files, PTYs and generic resources. |

Sources A3–A5. No protocol adoption merely for a badge.

## 15. Attention and meaningful events

Extend the existing lifecycle transition path with a bounded durable record of meaningful events. No Kafka, generalized event bus or full application event sourcing.

```text
AttentionEvent
  eventId, hostId, workspaceId, resourceId, runtimeIncarnation?,
  kind, sourceSequence?, occurredAt, severity,
  requiresAction, boundedSummary, resolutionKey?
```

Execution, connectivity/certainty, unread acknowledgment and unresolved attention are separate axes.

| Event | Admission evidence / policy |
|---|---|
| AgentNeedsUser | Structured question/approval preferred; heuristic explicitly qualified. |
| AgentFinished | Verified turn boundary, not silence. Recent updates by default. |
| AgentFailed | Provider or unrecoverable runtime failure. |
| CommandFailed | Perch-owned run or reliable shell integration, not arbitrary red text. |
| TestsFailed | Known test-task result; do not interrupt for every failing test an agent is still repairing. |
| ReviewReady | Explicit artifact/action/provider signal, not simply dirty files. |
| RemoteDisconnected | One deduplicated host event, not twenty agent failures. |
| ProcessExited | Confirmed exit of a specific incarnation. |
| PRReady | Explicit PR/check/readiness result when integration exists. |
| FileConflict / SaveFailed | Persistent actionable state, not a transient toast only. |

One Rust projection feeds sidebar/tab state, unread, Needs You and notification delivery. Viewing marks appropriate events read; it does not resolve unanswered questions. Source resolution clears the action. Background restoration/project selection must not acknowledge everything beneath it.

Notifications deep-link to exact resources, dedupe across reconnects and avoid sensitive prompt/path content by default. Completion notification is opt-in; ordinary completion is not Needs You. No kanban/dashboard.

### Core-offline semantics

Durable PTYs do not automatically preserve semantic events. Bridges may retain only recent observations. If exact finished-while-away history is needed, use a bounded private bridge spool with runtime identity; do not move agent-product logic into perchd. Reconcile current state and acknowledge missing history rather than fabricate events. A new attention table does not make missed producer events reliable by itself.

## 16. Project, workspace, worktree and task model

- Project: explicitly added folder/repository on a specific host; Git optional.
- Workspace: retain the internal checkout/root record.
- UI: show the project alone for its original checkout. Reveal named contexts when parallel work exists.
- Explain Git worktree at isolated-context creation/deletion and in Git details. It isolates checkout state, not permissions, ports, databases or external services.
- No separate Task entity now. A context label may describe a task; a workspace need not equal one agent or PR.
- A terminal `cd` never reparents project membership.
- External worktrees are discoverable, not automatically promoted into noisy navigation.
- Flat context list; branch ancestry belongs in Git details, not nested task trees.
- No implicit project creation from shell cwd, opened subfolder or remote reply.
- Close last tab keeps the same context selected. Remove project removes registration/owned execution, not the original folder. Delete a linked worktree is separately destructive.

Vocabulary and sidebar changes remain explicit migrations from current AGENTS, not schema-renaming projects. See UI-UX-DIRECTION for detailed disclosure rules.

## 17. Remote architecture

**Final full-feature path: managed remote perch-core + perchd.** Direct SSH/tmux stays an explicitly reduced compatibility mode until a replacement is proven. Do not delete working compatibility code merely because another route is cleaner.

Remote core owns project/workspace metadata, files/drafts, Git/worktrees, search, agent evidence, runtime identity and attention. Local core routes/caches facts. No local fallback and no second authoritative remote database on the laptop.

### Why perchd alone is not enough

It owns PTYs, not filesystem/Git/review/authorization/workspace services. Making it the full remote solution either grows it into another core or leaves a collection of ad hoc SSH operations with split metadata. A daemon-only route is useful for reduced terminal access but is not the differentiated whole-project workflow.

### Connect and reconnect

1. Select user's SSH host; verify host key and authentication.
2. Detect compatible runtime and negotiate capabilities.
3. Ask before installing/updating a remote binary; verify trusted release artifact/checksum.
4. Tunnel to remote core; keep its network exposure private.
5. Discover project inventory and reconcile runtime incarnations.
6. Attach without command relaunch or arbitrary resize.

Stable host identity, epoch/revision snapshots, terminal offsets and explicit gaps. Backoff with jitter. Reconcile uncertain mutations by operation ID; do not blindly retry them or terminal input. A running daemon is adopted, never silently replaced for a version mismatch.

### Files, Git and search

Execute on the remote host. Lazy trees, bounded/ranged files, cancellable search, limited results, workspace-scoped Git and progress-capable worktree jobs. No recursive repository mirror to populate an explorer. Preserve fs confinement and version checks remotely.

### Ports and web previews

Explicitly approved forwardings bound to local loopback, associated with host/workspace/service. Reconnect tunnels independently from execution. Remote localhost never means laptop localhost. Disconnected previews explain the failure; they do not silently point at another service. Full browser embedding is later, not a remote-terminal prerequisite.

### Authentication, encryption and offline behavior

Keep OpenSSH with user's config, proxy/MFA support and host-key verification. Current federation uses `-A`; recommend opt-in per-host agent forwarding, off by default. Prefer host-local provider/Git credentials. Never expose perchd directly to the network. Direct non-SSH access needs authenticated TLS.

Offline: cached inventory is explicitly stale; preserve drafts, disable unavailable mutations, no queued keystrokes, no auto-save over unknown remote changes. Raw echo remains RTT-bound; no speculative echo for arbitrary TUIs.

Compared with SSH+tmux: resource identity, review/files, targeted attention and restored context. Compared with Herdr: graphical resources/review. Compared with VS Code Remote: editor-independent workflow with less compulsory IDE machinery—not a claim of greater feature breadth.

## 18. Performance budgets and methodology

**Proposed targets, not measured results.** Calibrate from a baseline before advertising. Alpha gates distinguish correctness blockers from targets that may have a documented limited exception.

Reference machines: Apple Silicon Mac with 16 GB RAM/SSD and a representative 16 GB Linux machine/SSD. Release build, fixed fonts/window/grid (120×40), documented populated scrollback, no model requests. Measure Perch-owned processes separately from agent/build-tool children; publish both.

| Metric | Initial target |
|---|---|
| Cold launch → interactive restored shell | p95 ≤ 2 s |
| Warm launch/reattach → interactive shell | p95 ≤ 1 s |
| Mounted local tab switch | p95 ≤ 50 ms |
| Restore inactive resource view | p95 ≤ 150 ms, excluding large decode |
| Empty settled desktop aggregate | ≤ 200 MiB target; investigate > 300 MiB |
| Core idle | ≤ 40 MiB |
| perchd idle resident | ≤ 15 MiB |
| perchd with 20 ordinary idle PTYs | ≤ 80 MiB excluding child processes |
| Desktop/core/daemon, one populated terminal | ≤ 250 MiB |
| Same, five terminals | ≤ 350 MiB |
| Same, twenty terminals, mostly inactive | ≤ 600 MiB |
| Settled idle CPU | < 1% of one core aggregate |
| Local keystroke → visible echo | p95 ≤ 30 ms; p99 ≤ 60 ms |
| Echo under output flood | p95 ≤ 75 ms |
| ASCII parse/render | ≥ 5 MiB/s defined workload |
| ANSI-heavy parse/render | ≥ 1 MiB/s defined workload |
| Daemon capture, no viewer | ≥ 20 MiB/s defined workload |
| Project metadata opening | p95 ≤ 150 ms warm / 400 ms cold |
| First directory page | p95 ≤ 100 ms local, bounded page |
| Open 100 KiB text | p95 ≤ 100 ms warm / 250 ms cold |
| Git status, defined ~10k tracked-file repo | p95 ≤ 500 ms warm / 1.5 s cold |
| Remote reattach after transport available | p95 ≤ 2 s with bounded replay |
| Remote echo overhead beyond RTT | p95 ≤ 30 ms |

Large repo/document, slow disk, DNS, MFA and SSH authentication timings get separate results. Do not hide them inside ambiguous exclusions. Terminal-count budgets cannot be met by dropping state or killing idle shells.

### Benchmark method

Record backend/UI ready, input send, PTY output, parser completion, presentation, queue depth, replay lag, CPU/wakeups, JS heap and native/WebView/GPU memory. Linux PSS and macOS physical footprint avoid misleading summed RSS; explain attribution differences.

Use deterministic ASCII/ANSI streams, recorded realistic TUI patterns, Unicode/combining characters, alternate screen and resize storms. Run 1/5/20 terminals with one/multiple visible. Test 20/80/150 ms RTT, slow consumers, disconnects, history compaction, disk-full/write failure and app/core restart.

Verify byte accounting inside the supported retention interval. A 100 MiB throughput stream does not imply retaining all 100 MiB in an 8 MiB log. Report explicit truncation, never unexplained loss. Collect repeatable distributions, not a single best run.

Follow isolated/headless repo testing rules. Hidden/headless timing is not proof of foreground presentation performance; corroborate actual interactive latency with manual measurement rather than silently running focused automation. Keep benchmarks independent of paid model latency. Use cheap allowed models only for provider end-to-end checks and verify the CLI banner before prompting.

## 19. Security boundaries

Perch runs tools with the user's authority. File API confinement is not a sandbox for launched shells/agents. Same-user malicious code is not excluded by worktrees or ordinary tokens; describe guarantees honestly.

### HTTP/WS and device authority

Keep existing Origin/Host/loopback defenses. Recommend loopback-only default, explicit network exposure, authenticated desktop bootstrap, exact origin validation, revocable device credentials, scoped automation credentials, TLS outside SSH, and bounded connections/messages/requests/queues. Avoid tokens in logged URL queries.

The fixed-port core and desktop ephemeral loopback binding differ today. Network defaults are an explicit release decision. Browser Origin checks and native-client authentication serve different purposes; neither replaces the other. A websocket capability list is not a permission grant.

### Project trust and commands

Inert browsing is allowed without auto-running project scripts, hooks, agents, plugins, package installs or repository-defined providers. Git mutations can execute hooks; diff helpers/textconv/external commands need safe policy too. Approve executable configuration, invalidate approval on relevant changes, and show host/cwd/argv. A project being added is not blanket approval of every future command.

Use argv where possible. Shell snippets are explicitly executable content. Do not execute a filename because the user opened/dropped it, infer scripts from arbitrary names, or inject into a busy terminal. Destructive actions reuse fresh previews/receipts.

### Terminal content and process lifetime

Treat titles, links and escape sequences as untrusted: bound/sanitize metadata, allowlist URL schemes, no clipboard reads, suppress replay side effects, and never turn output into privileged actions. Sending terminal input is execution authority.

A process-group kill does not universally kill all descendants: jobs may change groups or detach. Test supported shells/agents, track managed ownership, and use platform containment where warranted. Promise cleanup of Perch-managed execution, not containment of deliberately escaping processes without a sandbox. Failed/uncertain closure stays visible and retryable.

### Resources/previews

Preserve no-follow/root-descriptor confinement. Handle symlinks intentionally. No active HTML/SVG in privileged DOM; bound decode/parse/cache/archive work. No truncated-save overwrite. Block extraction traversal, escaping links and decompression bombs if extraction is added.

Live previews need a separate unprivileged security context with no Perch credentials/native commands, constrained navigation/download/permission policy and explicit local-network handling. Different origin alone is not the whole policy. Use external browser fallback until isolation is demonstrated.

Current Tauri permissions are narrow but allow loopback URL patterns. Never navigate that privileged window to arbitrary localhost content or broaden it into general filesystem/launch authority. OS external-open adapters must validate targets and require user intent.

### Credentials, remotes and extensions

Keep provider-owned authentication, prefer host-local credentials, disable default SSH agent forwarding, use private/OS secret storage, and protect transcripts/history/drafts as sensitive data. Bound retention and explain deletion. External plugins are executable code unless isolated; signatures do not sandbox them. A future agent token must not grant desktop-wide authority.

## 20. Extensibility

Internal registries first: agent adapters, surface renderers, resource openers, actions and preview providers. Use existing manifests and compiled registration. A surface provider needs stable ID/state version, applicable resources, capabilities, lazy renderer, bounded serialization and disposal—nothing resembling hundreds of extension APIs.

No arbitrary lifecycle interception, cross-provider DOM access, unrestricted core callbacks, dependency manager or marketplace. External plugins earn their place only when repeated valuable integrations cannot reasonably be maintained internally. Prefer out-of-process, permission-scoped providers over dynamic Rust libraries or unrestricted frontend scripts. The core protocol is not automatically an extension privilege boundary.

## 21. Features and roadmap

### Classification

| Feature | Class | Decision |
|---|---|---|
| Durable terminals/restoration | Core | Tested continuity contract. |
| Actual CLI agents/shells | Core | Native interaction and provider-owned auth. |
| Projects/optional worktrees | Core | No forced task ceremony. |
| Mixed resource canvas | Core | Terminal/File/Diff first. |
| Files/navigation/basic editing | Core | General project utility. |
| Git changes/review | Core | Understand and finish work, not graph/history product. |
| Managed remote workspace | Core to differentiation | Finish a supported path, not superficial SSH support. |
| Action registry | Core infrastructure | One target/guard/invocation semantics. |
| Trustworthy attention | Important; small alpha slice | Needs You, not dashboard. |
| External editor/Open With | Important | Makes bounded internal editing credible. |
| Quick commands | Important, bounded | Saved explicit runs, not automation engine. |
| PR open/status/checks | Important, later | Thin integration with existing tools such as gh. |
| Usage/context display | Nice later | Report available facts, no accounting/quota product. |
| Mobile/PWA | Nice later expansion | Preserve existing access; focus on check-in, not full mobile IDE. |
| Isolated app preview | Nice later | Security/tunnel gate first. |
| Floating terminal | Unnecessary | Terminals already have tabs/splits. |
| Separate Cmd-J navigator | Unnecessary | Consolidate with Cmd-K/Cmd-P. |
| Agent dashboard | Remove from roadmap | Needs You replaces it. |
| AI chat UI | Frozen; retire carefully | Preserve old data/access, no new features. |
| Account hot swapping | Probably never | Credential/policy burden outside identity. |
| Automations/orchestration | Deprioritize | Agent/external-system responsibility. |
| Jira/Linear/issue suites | Deprioritize | Links/commands before bespoke integration. |
| Computer use/design mode | Probably never | Different product/security surface. |
| Native editor/front-end rewrite | Not planned | Measurement gate; not cleaner-code intuition. |
| Public plugin system | Defer | Internal registries first. |
| Automatic hibernation | Reconsider default | Explicit/opt-in unless process/continuation semantics are proven. |

### NOW

Document/ratify contracts, baseline performance/recovery, build the Terminal/File/Diff restoration slice, and fix the lifecycle/security prerequisites it exposes. Reproduce uncertain liveness, non-durable fallback, resize authority, replay/backpressure and safe deletion risks. Establish renderer-independent terminal test access without changing renderer.

### NEXT — differentiated alpha work

Unify tab state and shared actions, quick open, useful resource handling (text/Markdown/images/external fallback), a small attention queue, full-canvas review, and the managed remote workspace slice. Meet PUBLIC-ALPHA gates. Reliability fixes are part of these slices, not a separate excuse to ship an undifferentiated terminal app.

### LATER

Specialized PDF/CSV/JSON/log viewers, richer saved runs, forwarding/isolated preview, thin PR workflow, scoped CLI, phone refinement, justified external providers, Windows if demand funds a real port.

### PROBABLY NEVER

Custom agent harness/chat center, full IDE/debugger, kanban/orchestration console, account/quota manager, issue-tracker clone, browser design mode, computer-use platform, plugin marketplace, terminal emulator or raw Metal renderer.

Retire parity tiers as the scheduling mechanism. Delete unsupported roadmap promises rather than build them for completeness.

## 22. Technical risks and mitigations

| Risk | Mitigation |
|---|---|
| Transport loss becomes exit | Typed liveness, incarnation, confirmed stop receipts. |
| Incorrect terminal restoration | Explicit gaps, ordered sizing, checkpoint/corpus tests. |
| Slow viewers exhaust memory | End-to-end queue bounds and processed-output ACKs. |
| Agent integration churn | Version capabilities, recorded fixtures, terminal-only fallback. |
| Frontend/domain competing ownership | Qualified resources and viewer presentation, one lifecycle path. |
| Remote split-brain | Execution-host authority, cached projections, qualified IDs. |
| Lost drafts/external-write races | Preserve base/draft/save-intent recovery and fault tests; no overclaim of locking against unrelated external editors. |
| Worktree removed under live work | Revalidated preflight, explicit stop and visible pending/error state. |
| Daemon updates interrupt sessions | Adopt compatible version, explicit incompatible migration. |
| Preview compromises local authority | Unprivileged context or external fallback. |
| Lightweight claim fails | Reproducible aggregate benchmarks and regression gates. |
| Adapter becomes new chat product | Separate metadata/control from frozen transcript UI. |
| Too many platforms | Mac/Linux/browser foundation; explicitly supported alpha matrix. |
| Scope outruns quality | Three differentiating scenarios and release checklist, not parity count. |

## 23. Five bounded prototypes

Each has a report/pass-fail result; do not turn experiments into hidden implementation programs.

1. **Durability/replay fault harness.** Core crash, daemon disconnect, slow consumer, compaction, disk failure, resize during replay, close while disconnected. Pass: no false exit, duplicate launch, unexplained loss or acknowledged destruction while still unknown.
2. **Mixed-surface restoration.** Existing Terminal/File/Diff, order, split, restart, two viewers, dirty draft, close versus detach. Pass: same runtime identity, drafts intact, independent focus. No new viewer catalogue.
3. **DOM/WebGL benchmark.** Identical data/options/grid; latency/CPU/JS/native/GPU memory, multi-visible panes, context loss, Unicode/IME/accessibility. Pass: material measured gain without correctness/regression cost. Production adoption separately approved.
4. **Complete remote workspace.** Actual isolated test host, consented setup, project/CLI/files/Git/worktree, disconnect/reconnect/local-core restart. Pass: authoritative remote identity, no local fallback or duplicated execution. Compare daemon-only only to quantify what it loses/saves.
5. **Safe generic opener.** Text, Markdown, PNG, PDF/external fallback, misnamed HTML, unknown binary, oversized input, remote download. Pass: useful bounded action for each, no execution on open and no authorization bypass.

A native terminal experiment is not first-five priority. Run it only if the renderer experiment demonstrates a relevant problem.

## 24. Twelve-month end state

With focused small-team development, Perch opens quickly into the last project with a shallow context list and mixed tab strip. Real shells/agents, files/documents and diffs are peers; selected app previews exist only if their security cost is justified. An original checkout needs no workspace lesson; parallel contexts are explicit.

Users split a resource beside an agent, switch projects, quit and return without reconstruction. Remote projects behave consistently; disconnect means unknown, reconnect finds the same surviving process, and unsupported actions are explained rather than simulated locally. Needs You contains actual questions/actions, not all completions. External editors remain one action away.

Lightweight claims cite release measurements. Restoration, replay, closure and draft safety are fault-tested. The product does not manage subscriptions, reinvent the editor, or become an orchestration console.

Success: “Perch remembers where my work lives and what needs me. I still use my tools, but no longer hold their coordination in my head.” If that is not meaningfully easier than cmux/Orca or the existing terminal/editor combination, more integrations will not fix positioning.

## 25. Research sources

External docs/repositories were consulted during the 2026-10-04 research; moving branches and product pages may change. Repository code anchors in section 6 refer to the implementation baseline above.

### Products and provider mechanisms

- E1: [Orca repository](https://github.com/stablyai/orca), [session restoration at reference revision](https://github.com/stablyai/orca/blob/564f1352/docs/site/content/docs/model/session-restore.mdx).
- E2: [T3 Code official repository](https://github.com/pingdotgg/t3code), [product](https://t3.codes/).
- E3: [Emdash official repository](https://github.com/generalaction/emdash), [overview](https://emdash.com/docs). Repository and documentation snapshots differ in breadth; verify exact supported release.
- E4: [Conductor first workspace](https://www.conductor.build/docs/first-workspace).
- E5: [cmux repository](https://github.com/manaflow-ai/cmux), [remote tmux beta](https://cmux.com/docs/remote-tmux), [SSH](https://cmux.com/blog/cmux-ssh).
- E6: [Herdr persistence/remote access](https://herdr.dev/docs/persistence-remote/).
- E7: [Warp SSH feature support](https://docs.warp.dev/code/ssh-feature-support), [overview](https://docs.warp.dev/).
- E8: [Zed remote development](https://zed.dev/docs/remote-development), [external agents](https://zed.dev/docs/ai/agents).
- E9: [Cursor worktrees](https://cursor.com/docs/configuration/worktrees).
- E10: [VS Code remote agent sessions](https://code.visualstudio.com/docs/agents/run/remote-agent-sessions), [session model](https://code.visualstudio.com/docs/agents/concepts/sessions).
- E11: [GitButler parallel agents](https://docs.gitbutler.com/ai-agents/parallel-agents).
- E12: [GitKraken Desktop 12.4](https://www.gitkraken.com/blog/gitkraken-desktop-12-4-see-every-agent-approve-every-change).
- E13: [Claude Code hooks](https://code.claude.com/docs/en/hooks).
- E14: [Codex app-server](https://developers.openai.com/codex/app-server), [app worktrees](https://developers.openai.com/codex/app/worktrees).
- E15: [OpenCode server/OpenAPI/events](https://opencode.ai/docs/server/).
- E16: [Pi repository](https://github.com/earendil-works/pi) (formerly badlogic/pi-mono; follow upstream redirects).
- E17: [OMP repository](https://github.com/can1357/oh-my-pi).
- E18: [Superset overview](https://docs.superset.sh/overview).

### Terminals and frontend

- T1: [xterm flow control](https://xtermjs.org/docs/guides/flowcontrol/), [performance testing](https://github.com/xtermjs/xterm.js/wiki/Performance-testing). Historical example numbers are not current Perch results.
- T2: [libghostty-vt header and stability warning](https://github.com/ghostty-org/ghostty/blob/main/include/ghostty/vt.h).
- T3: [Ghostty internal embedder header](https://github.com/ghostty-org/ghostty/blob/main/include/ghostty.h).
- T4: [SwiftTerm](https://github.com/migueldeicaza/SwiftTerm).
- T5: [Tauri process model](https://v2.tauri.app/concept/process-model/), [architecture](https://v2.tauri.app/concept/architecture/).

### Files, commands and protocols

- F1: [Shared MIME-info specification](https://specifications.freedesktop.org/shared-mime-info/latest-single/).
- F2: [Apple NSWorkspace](https://developer.apple.com/documentation/appkit/nsworkspace).
- A1: [Raycast Action Panel](https://developers.raycast.com/api-reference/user-interface/action-panel).
- A2: [VS Code commands](https://code.visualstudio.com/api/extension-guides/command), [context/when clauses](https://code.visualstudio.com/api/references/when-clause-contexts).
- A3: [ACP initialization/capabilities](https://agentclientprotocol.com/protocol/v1/initialization).
- A4: [MCP](https://modelcontextprotocol.io/). Tool annotations are advisory, not enforcement.
- A5: [Agent Host Protocol](https://microsoft.github.io/agent-host-protocol/).

## 26. Implementation decisions to ratify

Before a slice changes behavior, record the decision and update AGENTS plus the relevant contract together. Documentation work alone does not enact these migrations.

- [ ] Generic tabs replace terminal/session-only ownership; session compatibility mapping and watcher close semantics agreed.
- [ ] Workspace remains internal; optional Context UI and simplified sidebar agreed.
- [ ] Viewer identity, persistence placement, layout migration and independent focus agreed.
- [ ] Close/stop/interrupt/reopen distinctions and pending remote-close behavior agreed.
- [ ] Durable launch fails closed; hibernation/defaults reconciled with the product promise.
- [ ] Stale/unknown evidence no longer reads as confirmed idle/completion.
- [ ] Shared command targets and client-specific shortcut rules agreed.
- [ ] Managed remote core is the full-feature path; direct mode's reduced scope documented.
- [ ] Local authentication/network defaults, project execution trust and SSH forwarding defaults agreed.
- [ ] Alpha platform/provider/version matrix and performance exception policy agreed.
- [ ] Any visual changes (system-sans chrome, status bar, picker order, Scratchpad naming) approved separately; they are not prerequisites hidden inside the architecture migration.

Immediate implementation priority after ratification: the smallest Terminal/File/Diff mixed-canvas restoration slice, with lifecycle and migration safety built into its acceptance checks. No feature implementation is part of this documentation checkpoint.
