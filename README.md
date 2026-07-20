# perch

A personal AI IDE / agent app: a WebSocket server that drives Claude Code
headlessly and exposes it (plus a terminal) to a web/desktop client.

## Layout

- `packages/shared` — protocol types shared between server and clients.
- `packages/server` — Node/TS WebSocket + HTTP server, Claude Code runner,
  terminal manager, SQLite history.
- `packages/web` — browser client (placeholder).
- `packages/desktop` — desktop shell (placeholder).

## Develop

```sh
npm install
npm run build
npm run start -w @perch/server -- --port 7788
```

Flags: `--port`, `--headless`, `--base-path`, `--public-base-url` (env
fallbacks `PERCH_PORT`, `PERCH_BASE_PATH`, `PERCH_PUBLIC_BASE_URL`).
