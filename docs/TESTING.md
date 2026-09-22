# Testing

perch has four test layers. Each one exists to catch a different class of
regression; none of them substitute for another. This doc describes the
intended scope of each so the boundaries don't drift as the codebase grows.

## Rust unit tests (`cargo test -p perch-core`, 121 today)

Belong here: anything that is pure Rust logic reachable without a live
server/WS connection — parsers, state machines, debounce/threshold
functions, SQL row mapping, path/env manipulation. Concretely: `db.rs`'s
query helpers, `is_quiet_enough_to_idle` (agent idle debounce), `osc52`-style
byte-level parsing on the Rust side, `settings.rs`/`hosts.rs` serde
round-trips, `ssh.rs`'s pure helpers (e.g. control-path length). Run with
`cargo test -p perch-core` or `cargo test -p perch-core <substring>` for one
test. Fast, no network, no subprocess spawning (a few tests do spawn `ssh`
against a mux socket path and are documented as flaky under HOME mutation —
see AGENTS.md).

Several modules have **zero** unit tests today (`registry.rs`, `hub.rs`,
`protocol.rs` itself, `settings.rs`, `hosts.rs`, `status.rs`, `terminal.rs`)
— noted in `docs/PHASE-HISTORY.md`'s structure/test-gaps entry. Closing that
is its own future phase, not a side effect of this one.

## Protocol parity test (`crates/perch-core/tests/protocol_parity.rs`)

Enforces that `protocol.rs` and `packages/shared/src/protocol.ts` — the two
hand-maintained mirrors of the WS wire protocol — haven't drifted: matching
message discriminants, matching field names in wire (camelCase) casing, and
matching optionality direction (a field the Rust `ClientMessage` requires
must not be optional-only on the TS side; a field Rust may omit from
`ServerMessage` JSON must not be declared required on the TS side). It also
asserts count floors, so a parser that silently stops matching anything
fails loudly instead of passing vacuously.

**What it explicitly does not catch** (read the module doc comment in full
before relying on it for something new):
- Field **types** — a `String` that should have been a `u64`, a `Vec<T>`
  that should have been a single `T`. Only names/optionality are compared.
- Bare string enum variants (`SessionStatus`, `AgentKind`) against their TS
  union literals — only *structs* embedded in messages are checked.
- The shape inside `serde_json::Value` / TS `unknown` fields (`input`,
  `result`, `layout`, …) — intentionally opaque on both sides.
- `#[serde(flatten)]` or other serde attributes the parser doesn't
  recognise — silently ignored, not rejected. None of today's structs use
  one.
- Anything outside `protocol.rs`/`protocol.ts` unless explicitly added to
  its `VALUE_TYPES` list (e.g. `TerminalProfile` lives in `iterm_profile.rs`).
- A source style different enough from today's formatting to defeat its
  regex/brace-counting parser (it is not a real AST parser).

If a protocol change needs more than this test guarantees — e.g. a field
changing type — that has to be caught by hand at review time, or by a
Rust-side unit test on the serialize/deserialize round-trip itself.

## Web unit tests (`packages/web`, Vitest)

New as of this phase — previously `packages/web` had no test runner and no
test files at all, while several pure, exported modules had never been
executed outside manual `esbuild` checks or the full e2e suite.

**Belongs here:** pure functions, parsers, reducers, and store selectors
that can be exercised as plain input → output, with no server, no real
WebSocket, and (mostly) no DOM. Concretely: `osc52.ts`, `statusDot.ts`,
`composerCommands.ts`, `attachments.ts`, `components/popoverPosition.ts`,
`tabOrder.ts`, and `store.ts`'s exported selectors
(`projectsForHost`/`effectiveActiveProject`/`activeProjectSessions`/
`archivedSessions`). Add a test here whenever a new pure helper is extracted
from a component — that's usually why it was extracted in the first place.

**Does not belong here:** anything that needs a real rendered component
tree, a real PTY/xterm instance, or a real WS round-trip against the Rust
server — that's Playwright's job (below). This layer does not simulate
network races, terminal rendering, or React re-render timing.

**Run it:**
```sh
npm test                       # from repo root
npm run test -w @perch/web     # equivalent, explicit workspace
```
Config: `packages/web/vitest.config.ts`, separate from `vite.config.ts` so
the app's build plugins (`@vitejs/plugin-react`, `vite-plugin-pwa`) aren't
loaded just to run tests. Default environment is Node, not jsdom — most of
these modules have no DOM dependency, or already guard their
`window`/`document`/`localStorage` access behind `try/catch` (see
`store.ts`, `ws.ts`, `tabOrder.ts`), so exercising them in plain Node is
exactly the "unavailable" branch those guards exist for. Two files opt into
more:
- `store.test.ts` needs `// @vitest-environment jsdom` because `store.ts`'s
  module-scope code (not just its exports) calls `applyTheme("catppuccin")`
  and `socket.connect()` unconditionally at import time — the test installs
  a minimal fake `WebSocket` before importing so that import doesn't throw.
- `attachments.test.ts` mocks `./base` (which reads `window.location`)
  rather than pulling in jsdom, since only a stable URL string is needed.
- `components/popoverPosition.test.ts` and `tabOrder.test.ts` stub just the
  one global each needs (`window.innerWidth/innerHeight`, `localStorage`)
  as plain objects — cheaper than a full DOM for arithmetic/storage helpers.

Test files are `src/**/*.test.ts` and are excluded from
`packages/web/tsconfig.json`'s build (`tsc --noEmit` in `npm run build`
must not trip over them; `vitest` type-checks nothing by default, it only
transpiles via esbuild).

## Playwright e2e (`e2e/`)

Belongs here: real end-to-end user flows through the actual UI against a
real running `perch-core`, including anything that needs a real agent turn
(claude/codex actually replying), a real terminal/PTY round-trip, real
WS reconnect behavior, or federation between two live server instances.
This is the only layer that proves the Rust and TS halves actually agree at
runtime, not just on paper.

**Known constraints:**
- It runs **real agent turns** — requires working `claude`/`codex` CLI
  credentials on the machine running the suite.
- It is **slow** (whole-suite runs are minutes, not seconds) and **flaky
  under load**: when the model proxy is slow, turns from one test overlap
  into the next test's window and cause rotating failures (multiple
  `.session-status--running` dots, idle-timeout misses). Re-run a failing
  spec in isolation before treating it as a real regression.
- New specs must be added to `testMatch` in `e2e/playwright.config.ts` or
  they **silently never run** — there is no directory-scan fallback.
- `cli-rendering.spec.ts` is deliberately **not** in the main config. It has
  its own `e2e/cli-rendering.config.ts` and must be run under **both**
  chromium and WebKit projects — the desktop app renders in WebKit
  (WKWebView), and font matching / glyph fallback / cell metrics differ
  enough between engines that a Chromium-only pass once reported a build as
  "verified" while it was visibly broken in the WebKit-rendered app (Phase
  12.2). Run it with `npx playwright test --config=cli-rendering.config.ts`.
- Do not run the full e2e suite reflexively for a change that a unit test
  layer already covers — it exists for flows the other layers structurally
  cannot exercise.

## Decision rule: which layer tests a given change

1. **Changed a pure function/parser/selector in Rust or TypeScript, with no
   server/DOM/network dependency?** → Rust unit test or web (Vitest) unit
   test, in the same language as the code. This should be the fast, default
   answer for most logic changes.
2. **Changed a field or message shape in `protocol.rs` /
   `packages/shared/src/protocol.ts`?** → Run `protocol_parity.rs`
   (`cargo test -p perch-core protocol_parity`) and update both files
   together regardless — the parity test only catches *drift*, not whether
   you remembered to change both files in the first place.
3. **Changed how the UI renders, reacts to a real WS message sequence, or
   drives a real terminal/agent process?** → Playwright e2e. If an existing
   spec already covers the flow, extend it; if not, add one and register it
   in `testMatch`.
4. **Changed terminal/text rendering specifically?** → also run
   `cli-rendering.spec.ts` under both engines, not just chromium.
5. **Unsure?** Prefer the cheapest layer that would actually fail if the
   change were wrong. A unit test that can't fail on the change you made
   isn't testing it — write it against the layer where the logic actually
   lives, not the layer that happens to be easiest to run.
