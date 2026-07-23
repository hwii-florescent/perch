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

### Phase 0 — Rust workspace restructure + toolchain — ✅ done
- Install Rust via `rustup` (minimal, stable).
- Add `Cargo.toml` workspace + `crates/perch-core` + `crates/perch-desktop` skeletons.
- Move the existing Node server to `reference/node-server-spec/` (keep as spec; not shipped).
- Keep `packages/shared` + `packages/web`.
- **Milestone: `cargo build -p perch-core` compiles a headless skeleton.**

### Phase 1 — Rust core (`perch-core`) — ✅ done
- Port the verified Node behavior to Rust: `protocol.rs`, `agent.rs` (claude stream-json, multi-turn
  via `--session-id`/`--resume`, `--permission-mode bypassPermissions`), `terminal.rs`, `db.rs`,
  `registry.rs` (ring buffer), `status.rs`, `server.rs` (axum, base-path aware, flags
  `--port/--headless/--base-path/--public-base-url` + `PERCH_*` env).
- **Verify (Rust):** `cargo build` clean; boot headless on `:7788`; WS `session.create` round-trip;
  terminal `echo hi` round-trip; one real `claude` turn streams + persists to SQLite.
- **Milestone: Rust headless core talks to Claude + terminals over WS.** ✅ verified.

### Phase 2 — TS web UI (chat + terminal + PWA) — ✅ done
- `packages/web`: React + Vite, WS client + store, chat + terminal (xterm.js), status bar, PWA,
  base-path aware. Built to `packages/web/dist`, served by axum.
- **Milestone: open the gateway URL on desktop + phone; chat + terminal; install PWA.** ✅ verified.

### Phase 2.5 — Codex + model selection — ✅ done
- Added `CodexRunner` (fresh process per turn, `codex exec --json`), `AgentKind` (claude|codex) on
  the wire protocol, agent/model dropdowns in the chat UI, `claude-haiku-4-5`/`gpt-5.4-mini` verified
  working against corp's GenAI proxy (exact working model IDs — see `agent.rs` doc comments for the
  non-obvious gotchas, e.g. dated snapshot ids like `claude-haiku-4-5-20251001` 404 on the proxy).
- **Milestone: real "say hello" turns from both Claude and Codex, screenshotted.** ✅ verified.

### Phase 2.6 — Session persistence & resume — ✅ done
- `session.resume`/`session.history` protocol, SQLite persists both user *and* assistant turns,
  client resumes via `localStorage`-stored `sessionId` on every connect (not just first load), Claude
  `--resume` continuity survives a full page reload and a server restart.
- **Milestone: reload the page mid-conversation — history and Claude's context both survive.** ✅
  verified (Playwright-driven before/after/continuity screenshots).

### Phase 2.7 — Jean-style dockable shell + Hosted/CLI toggle — ✅ done
- Adopted (re-implemented, not copied) the pattern from Jean/T3Code's corp-internal forks (`jean-internal`,
  `t3code-internal`, researched read-only via Sourcegraph): a `dockview-react` panel shell replacing the tab
  bar, and a per-chat **Hosted/CLI mode toggle** — Hosted is the existing structured chat UI; CLI
  attaches the *real interactive* `claude`/`codex` CLI in a PTY, resumed from the same conversation
  (`claude --resume <id> --model <alias>`, `codex resume <thread-id> -m <model>`), so switching modes
  mid-conversation preserves full context both ways.
- Found and fixed a real bug during verification: CLI-mode resume without an explicit `--model` falls
  back to the transcript's recorded dated snapshot id, which the GenAI proxy rejects — fixed by
  passing the same model alias explicitly on resume (mirrors what headless turns always did).
- Deliberately **not** done (scoped out, see below): ACP transport for Hosted mode; tmux-backed
  terminal persistence across server restarts (CLI-mode PTYs live for the browser tab's session only).
- **Milestone: toggle Hosted → CLI → Hosted mid-conversation, same context both directions; terminal
  panel opens docked below via toolbar icon.** ✅ verified (Playwright-driven, Claude round-trip:
  "remember 7" → CLI mode correctly answers "7" → back to Hosted still answers "7"; Codex fresh-CLI
  fallback with no prior thread also verified clean).

### Phase 3 — Headless + phone integration — ✅ done
- Wire web build into axum static-serve; verify end-to-end via the gateway URL; reconnect/replay on
  refresh (ring buffer). **Milestone: fully usable from the phone browser.** ✅ verified.

### Phase 4 — Tauri desktop shell (`perch-desktop`) — ⬜ (Mac, not started)
- Thin Tauri crate boots the core WS on localhost and opens a window on the web app.
- **Milestone: launch perch as a native desktop app that boots its own Rust core.**

### Later phases (post v0.1)
- **ACP transport migration**: replace the headless `claude -p --output-format stream-json` /
  `codex exec --json` runners with real Agent Client Protocol (JSON-RPC over stdio to
  `claude-code-acp`/`codex-acp`), matching how jean-internal/t3code-internal do Hosted-mode chat. Separable from
  Phase 2.7's CLI-mode toggle, which doesn't depend on it.
- **tmux-backed CLI-terminal persistence**: let CLI-mode PTYs survive a server restart (today they
  live only for the browser tab's WS session) — swap the spawn mechanism inside `TerminalManager`
  for a tmux-attach, protocol surface unchanged.
- Side panel (file tree, fuzzy search, diff by branch / last changes); full status bar
  (context + cost); devpod fleet CLI (`perch start <devpod>` via SSH+tmux → gateway URL);
  local vs SSH-devpod environment selector; open-source vs corp-internal split.

---

## How to run (after Phase 1)
```bash
source $HOME/.cargo/env
cd /home/user/perch
cargo run -p perch-core -- --port 7788 --base-path /proxy/dev-personal/7788/
```
Phone (after Phase 2/3): `https://devpod-gateway.internal.example.com/proxy/dev-personal/7788/`.

## Verification approach
- **Core (this pass):** cargo build; headless boot; WS smoke test (session/terminal/chat); real
  claude turn persisted to SQLite.
- **Phone (Phase 2/3):** open gateway URL on desktop + phone; chat + terminal; PWA install; replay.
- **App (Phase 4, Mac):** launch Tauri; confirm it boots the embedded Rust core.

## Constraints
- Repo control via `gh` only; no `git`/arc shell-outs (read repo state from `.git/*`). No commit/push
  unless asked. Native app (webkit2gtk/display) is Mac-side; devpod covers the headless web path.
