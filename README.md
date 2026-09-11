# perch

A personal agent-babysitting IDE. The Rust core (`perch-core`) owns all logic and data — agent runners (Claude and Codex), PTY terminals, SQLite history, settings, SSH host federation — and exposes everything over a single axum HTTP+WebSocket server. The React/TypeScript web app is a thin view that connects over that one WebSocket. Two delivery modes, one core: the Tauri desktop app (`perch-desktop`) boots the core in-process on a free localhost port and opens a native window (Mac); the headless binary runs on devpods and is reachable from a phone browser.

## Layout

- `crates/perch-core/` — Rust server: WS protocol, agent runners (Claude/Codex), PTY terminals, SQLite history, settings/hosts, hub federation
- `crates/perch-desktop/` — Tauri v2 shell; boots the core in-process on a free localhost port and opens a native window (Mac only)
- `packages/shared/` — TypeScript protocol types, kept field-for-field in sync with `crates/perch-core/src/protocol.rs`
- `packages/web/` — React/Vite UI (Zustand, dockview, xterm), built to `packages/web/dist`, served by the Rust core
- `e2e/` — Playwright suite (boots two core instances: hub `:7799` + federated remote `:7800`)
- `reference/node-server-spec/` — the original Node server, kept as an executable spec; not shipped

## Develop

```sh
npm install && npm run build          # shared types + web UI -> packages/web/dist
cargo run -p perch-core -- --port 7788   # headless server (serves the built UI)
cargo run -p perch-desktop               # native app (Mac)
cd e2e && npm ci && npx playwright test  # e2e (needs claude/codex CLI credentials)
```

Flags: `--port --headless --base-path --public-base-url --db-path --hosts-path`
Env: `PERCH_PORT`, `PERCH_BASE_PATH`, `PERCH_PUBLIC_BASE_URL`, `PERCH_DB`, `PERCH_HOSTS`, `PERCH_WEB_DIST`

## Federation

Add SSH hosts in Settings. The local perch becomes a hub: it health-checks each host over SSH, opens a tunnel (`ssh -A -L`, keeping a stable auth-sock symlink for agent forwarding), auto-starts the remote perch in a tmux session if it isn't running, and polls until connected. Once live, the remote host's projects and sessions appear in the same sidebar; chat messages and CLI terminals relay transparently through the tunnel.

---

See `PLAN.md` for the phase-by-phase history, and `AGENTS.md`/`CLAUDE.md` for contributor and agent guidance.
