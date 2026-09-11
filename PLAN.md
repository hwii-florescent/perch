# perch — Personal AI IDE / Agent App: Full Plan (Rust / Tauri)

## Context

A personal IDE/agent app to **babysit coding agents from anywhere**, including your phone, built to
eventually ship in two flavors (corp-internal + open-source) that borrow the best of **Jean**
(Rust/Tauri native app: chat + terminal + diff + side panel) and **T3/t3code-internal** (web-first, devpod
gateway URLs, remote-ready).

**Product shape:** *Rust app core, TypeScript as the thin view + web-routing layer* — the Jean/Tauri
model. Rust owns all the logic and data (agents, terminals, git, devpod, SQLite) and exposes it over
a single WebSocket API. The TypeScript/React web app is *just the view*: it connects to that WS,
whether it's embedded in the native Tauri window (localhost) or opened from your phone (devpod
gateway URL). One Rust core, one TS view, two delivery modes.

## Why this shape (decision record)

- User wants a **Rust app** with **TS only for minimal routing of app data to the web resource**.
  That is exactly Tauri: Rust backend + web-tech frontend, plus a headless mode that serves the same
  web bundle for the phone.
- **Single WS transport** for both desktop and web (instead of Tauri IPC for desktop + WS for web):
  the Rust core always runs an axum HTTP+WS server; the Tauri window and the phone both connect over
  WS. Keeps TS purely view+routing and Rust the single source of truth.
- **Toolchain reality on this devpod:** Rust installs via `rustup` (verified reachable). `webkit2gtk`
  and a display are **absent** → the **Tauri desktop GUI is built/tested on the Mac**, while the
  **headless axum web mode builds & runs here** and is testable via the gateway URL.

## Repo structure (Cargo workspace + TS packages)

```
perch/
  Cargo.toml                      # Rust workspace
  crates/
    perch-core/                   # PURE Rust core — NO Tauri/webkit dep (builds headless on devpod)
      src/protocol.rs             #   serde types matching the WS contract (tagged by `type`)
      src/agent.rs                #   claude stream-json runner (AgentRunner trait + ClaudeRunner)
      src/terminal.rs             #   portable-pty terminals
      src/db.rs                   #   rusqlite history (~/.perch/history.sqlite)
      src/registry.rs             #   session registry + replay ring buffer
      src/status.rs               #   cwd + branch (parse .git/HEAD, no git shell-out)
      src/server.rs               #   axum HTTP (serve web dist / placeholder) + WS at {base}/ws
      src/lib.rs  src/main.rs     #   lib + headless binary entry
    perch-desktop/                # Tauri app (thin) — depends on perch-core; BUILT ON MAC
      src/main.rs                 #   boots core WS on localhost, opens Tauri window on the web app
      tauri.conf.json
  packages/
    shared/                       # TS WS protocol contract (mirrors protocol.rs) — REUSED
    web/                          # React/TS UI (chat/terminal/PWA), WS client — REUSED PLAN
  reference/node-server-spec/     # the old Node server, kept as an executable spec (not shipped)
```

An `integrations/corp/*` seam (in perch-core) keeps corp-specifics (corp-gateway, devpod gateway, corp-cli,
corp-SSH) swappable so the open-source split is a strip-out, not a rewrite.

## Rust dependencies (perch-core)
`tokio`, `axum`, `tower-http` (serve-dir), `serde`/`serde_json`, `rusqlite` (bundled sqlite),
`portable-pty`, `uuid`, `anyhow`, `tracing`. `perch-desktop`: `tauri` (+ webkit2gtk on Mac).

## WS protocol (defined in Rust `protocol.rs` + TS `shared`, kept field-for-field identical)
- Client→Server: `session.create`, `session.resume` (localStorage-backed, replays history), `session.subscribe`,
  `chat.send` (+`agent`, `model`), `chat.cancel`, `terminal.create` (+optional `agentAttach:
  {sessionId, agent}` to spawn the real interactive CLI instead of a shell), `terminal.input`,
  `terminal.resize`.
- Server→Client: `session.created`, `session.history`, `chat.chunk`, `chat.thinking`, `chat.tool_use`,
  `chat.tool_result`, `chat.done` (usage: input/output tokens, costUsd, contextTokens),
  `terminal.created`, `terminal.data`, `terminal.exit`, `status.update`, `error`.

---

## Phases & Milestones

### ADE rework checkpoint — 2026-09-10 (in progress)

Work now continues directly under the user's instruction to finish the current
workers and create no more agents. The full contract remains `goals.md` and
`SPEC.md`; no ADE phase or final acceptance gate is declared complete here.

User clarification, 2026-09-11: ship Claude Code, Codex, OMP, Pi, OpenCode,
and ordinary terminals as first-class choices. UI mode is a web view and
control surface of the same CLI-owned session, not a Perch agent harness.
The CLI retains its tools, instructions, authentication, approvals, and
transcript. Retiring the separate Hosted/print-runner path in favor of this
shared native session is required; refusing UI sends until the CLI is stopped
is an interim defect, not an acceptable final mode-switch contract.
Alpha/Beta are isolated automated-test programs only. Their checks do not
establish real provider support or UI/CLI turn continuity.

Configured-provider loading, environment enforcement inside tmux, durable
provider selection before input, and generic CLI picker/reload are now
implemented. The completed configuration checkpoint passed 247 core tests,
two protocol tests, 216 web tests, build, and the isolated desktop/mobile
provider suite in both Chromium and WebKit. Screenshot review also fixed the
provider pane badge and terminal-response bytes leaking into session titles.
The five built-in choices and native UI connection are the next active slice.

Implemented and browser-verified mode policy discovery, stable blank-session
identity, server-owned workspace associations, multi-view invalidation, and
session/workspace/device precedence with safe gated CLI start. Fixed a real
cold-start React render loop missed by builds and unit tests. Direct checks:
235 core unit tests, two protocol parity tests, 206 web tests, shared/web build,
and headless Chromium mode-policy plus responsive R1/R2/R2b interactions.
Detailed evidence and remaining gates are in
`docs/ADE-REWORK-VERIFICATION.md`. Plain shell persistence now passes real browser reload, phone view release,
and isolated core-crash recovery in WebKit and Chromium, preserving the same
PID and shell state. Workspace tests pass (238 core plus two protocol checks);
213 web tests, the shared/web build, and all ten WebKit/Chromium terminal
checks pass. Local agent terminals now also attach through the lifecycle adapter, retain
host-owned replay across view release, and expose generation-bound input/resize
control. Real Claude desktop/phone ownership and reconnect checks passed in
both WebKit and Chromium. Latest checks: 240 core tests, two protocol checks,
216 web tests, shared/web build, formatting, and Clippy with the same five
existing warnings. See the 2026-09-11 checkpoint in the verification report for
browser rerun status and explicit limits. Seamless CLI-backed UI
prompt/transcript continuity, complete native-agent recovery,
full worktree/remote pairing flows, mixed workspace recovery, lifecycle-driven
hibernation, and populated resource budgets remain incomplete.

V-08 local review delivery is now observed: the real browser added two exact
inline anchors, edited/resolved/reopened a note, previewed one packet, selected
the session, sent it to Claude, and received one provider turn despite an
explicit same-operation retry. Durable delivery now pushes its confirmation
to the pane and the send button recovers after each correlated request. The
latest checks pass 208 web tests, 235 core unit tests, both protocol tests, and
the real review browser flow; core Clippy retains only the five baseline
warnings. Recovery and remote/mobile gates remain separate and open.

All phases below are **done**. One line each; the full record — root causes, rejected
alternatives, and the reasoning behind each decision — lives in
[`docs/PHASE-HISTORY.md`](docs/PHASE-HISTORY.md). Read that before re-litigating anything here.

| Phase | What shipped |
| --- | --- |
| 0 | Cargo workspace + `perch-core`/`perch-desktop` skeletons; Node server retired to `reference/node-server-spec/`. |
| 1 | Rust core: protocol, claude/codex runners, terminals, SQLite history, axum HTTP+WS. |
| 2 | TS web UI — chat, terminal, PWA. |
| 2.5 | Codex agent + per-agent model selection. |
| 2.6 | Session persistence and resume. |
| 2.7 | Dockable pane shell; Hosted/CLI mode toggle. |
| 2.8 | Session sidebar, agent status dots, environment header. |
| 2.9 | CLI/model sync, model catalogue, Codex-style UI, Settings modal. |
| 3.0 | Hub federation — remote perch instances over an ssh tunnel. |
| 3.1 | Tauri desktop shell (core boots in-process). |
| 3.2 | Session lifecycle + spawn-environment fixes. |
| 3 | Headless devpod + phone integration. |
| 4 | herdr UI/feature parity (Wave 1). |
| 5.W | Wave 2 — git worktree management. |
| 6 | Detached mode: `direct` hosts run turns over ssh+tmux, surviving sleep and restarts. |
| 7 | Hosted composer power features — slash autocomplete, plan mode, attachments. |
| 8 | Optimization pass (DB indices, rAF chunk coalescing, memoised markdown). |
| 9 | Open-item cleanup. |
| 10 | Server-side event scoping; honour codex's configured default model. |
| 11 | `perch.app` bundle — double-clickable Mac app that finds the user's CLIs from a cold GUI launch. |
| 11.1 | Fixed the bundle shipping without a UI in it. |
| 11.2 | Public-repo sanitization (history scrub + repo recreate) and codex catalogue sync. |
| 12 | CLI mode: emulator semantics, gated terminal start, auto session titles from the first prompt. |
| 12.1 | CLI mode: fixed the pty UTF-8 byte path (the real corruption), adopted the user's terminal profile, font scaling instead of reflow. |
| 12.2 | Rendering verified in **WebKit** (the engine the desktop app actually uses) after a Chromium-only pass gave a false pass; added `e2e/cli-rendering.spec.ts`; single-resize fit; PLAN.md condensed into this table. **Confirmed fixed by the user in the installed app.** |
| 13 | herdr CLI-mode parity Wave 3: agent-attach singleton + multi-viewer fan-out (fixed duplicate `--resume` spawns), PTY-activity status detection, OSC 52, clickable links, directional swap + resize mode, protocol-parity test, CLI provider picker, no-session empty state, pane-menu discoverability. |
| 14 | tmux-backed local CLI persistence (agents survive perch restarts) + a real web unit-test layer (Vitest, 113 cases) and `docs/TESTING.md`. |
| 15 | herdr parity Wave 2: cursor style/blink + light/dark palettes from the real terminal, a Ghostty config reader, configurable scrollback, login-shell panes, system-notification click-to-focus, bulk archive-project. |

**Current milestone:** ✅ perch is a double-clickable Mac app whose CLI mode renders the agent
TUIs the way the user's own terminal does — user-confirmed in `/Applications/perch.app` — and
whose CLI-mode agents **survive a perch restart** (tmux-backed, Phase 14), closing the last
structural gap with herdr's detach/reattach. Phase 15 spent the remaining small parity items,
so CLI-mode parity is **~86%** of herdr's user-facing surface (from ~61% → ~71% → ~77%).
What is left is deliberate, not backlog: kitty graphics (no viable xterm.js implementation),
a plugin marketplace, and Windows ConPTY — none of which perch has a use for. Tests:
**151 Rust + 1 parity + 134 web** (all under a second) plus **91 e2e**.
See Phases 13-15 in [`docs/PHASE-HISTORY.md`](docs/PHASE-HISTORY.md); testing strategy in
[`docs/TESTING.md`](docs/TESTING.md).


## How to run

**Devpod headless:**
```bash
source $HOME/.cargo/env
cd /home/user/perch
cargo run -p perch-core -- --port 7788
```
Phone access: run `devpod serve :7788/` on the devpod (with `DEVPOD_NAME` and `DEVPOD_REGION` exported); it assigns a port and prints the gateway URL (`https://devpod-gateway.internal.example.com/proxy/<user>/<assigned-port>/`). The old `/proxy/dev-personal/7788/` static path is no longer used.

**Mac desktop:**
```bash
cargo run -p perch-desktop   # boots core in-process on a free port, opens a window
```
`PERCH_DESKTOP_TEST=1` runs the window hidden and unfocused (for automation).

**Usual federation flow:** run the app locally, add devpod hosts in Settings; the hub auto-starts the remote perch in a tmux session and keeps it connected.

## Verification approach
- **Core:** cargo build + WS smoke test (session/terminal/chat) + real claude turn persisted to SQLite. ✅ done (Phase 1).
- **Web/phone:** gateway URL + chat + terminal + PWA install. ✅ done (Phase 2/3).
- **Desktop (Mac):** hidden-window launch via `PERCH_DESKTOP_TEST=1`; WebView auto-created session over WS. ✅ done (Phase 3.1).
- **Ongoing:** committed Playwright e2e suite in `e2e/` (hub `:7799` + federated remote `:7800`).
- **Terminal rendering:** `e2e/cli-rendering.spec.ts` via its own config, run under **both**
  Chromium and WebKit — the desktop app renders in WKWebView, so a Chromium-only pass proves
  nothing about it (this is exactly how Phase 12.1 shipped a "verified" build that was still
  broken). Screenshots land in `e2e/screenshots-cli-rendering/<engine>/` to be looked at, not
  just asserted on — **gitignored**, because they capture a real agent session and carry the
  account email, machine name and session titles into what is a public repo:
  ```sh
  cd e2e && npx playwright test --config=cli-rendering.config.ts
  ```
- **Bundle:** never trust HTTP 200 — it is also what the "no web client build found"
  placeholder returns. Check the served body for app-shell markers, and cold-launch from `/`
  under `env -i PATH=/usr/bin:/bin:/usr/sbin:/sbin` so neither the CWD fallback nor a rich
  PATH can mask a failure.

## Constraints
- Repo control via `gh` only; no `git`/arc shell-outs (read repo state from `.git/*`). No commit/push
  unless asked. Native app (webkit2gtk/display) is Mac-side; devpod covers the headless web path.
