# Security adversary review: cloneable stock UI plan

Plan: `plans/261108-2212-cloneable-stock-ui/` (plan.md, design.md, parity-matrix.md, validation.md, phase-01..05).
Baseline: worktree `use-the-ak-cook-skill-to-execute-the-cloneable-s` at 8a02934 plus dirty tree. Read-only; no code run.
Owner decisions are taken as given: full customization parity, plain JS with no build, independent clones, desktop/web/phone including relay, trusted mods keep full access, es-module-shims if Phase 1 proves it.

Web paths are under `packages/web/src/`. Rust paths are under `crates/perch-core/src/`.

## Findings

### SEC-01 High: relay phones would run user and installed mod code that can read durable credentials stored where scripts can read them
- **Threat model.** The attacker is the author of a mod the person installed, or an agent that wrote a clone. On the desktop this code already has full access, but only while it runs. The new part is that it can take credentials away and keep using them later.
- **Evidence.**
  - Today, mods never run on a relay phone. `mods/file` is missing from both allowlists (`relay/transport.ts:21`, `relay/host.rs:10,45`), and `fetchText` falls back to a native relay-origin fetch, which fails (`modApp.ts:174-182`, `relay/transport.ts:230-233`).
  - A relay phone keeps the room key (`relay/transport.ts:18,49,57`) and the device token (`relay/transport.ts:19,89-97,105`) in `localStorage`, so any script on the page can read them.
  - On desktop and LAN, the same credentials are `HttpOnly` cookies (`server/mod.rs:1939`, `server/mod.rs:2054`).
  - Third-party code arrives through `perch mod install` from GitHub (`server/mods.rs:70-88`). It loads with no approval (`docs/DECISIONS.md:23`).
- **Failure.** design.md §6 and phase-01 step 7 add `mods/package` to the relay. Any enabled mod on the phone can then read `perch.relay.link` and `perch.relay.token.<room>` and send them anywhere. Whoever holds them can join the user's relay room as a paired device (ws, workspace-file, upload) from anywhere. That access survives `perch mod disable`, removing the mod, and mods-off, until the person revokes the pairing.
- **Plan correction.** Record this as a consequence the owner accepts, without reopening full access.
  - Option A: by default the relay serves only the shipped catalog. User and installed packages run on a phone only after a per-device setting such as "Run my mods on this phone".
  - Option B: allow everything, but have mod disable/remove and Settings > Mods tell the person to revoke paired relay devices.
  - Either way, add a Phase 1 test proving a revoked token stops working on the new route. Also state that the SDK never exposes the token or key directly.

### SEC-02 High: shipped and user ids can collide, so user code can shadow stock or run in safe mode
- **Threat model.** This is about recovery integrity. Safe mode and mods-off promise stock Perch "even when no UI can reach Settings" (`mods.rs:52-55`).
- **Evidence.**
  - When the source is a shipped example, `clone_example` gives the copy the shipped id by default: `let id = new_id.unwrap_or(found.id)` (`mods.rs:844`).
  - Code is looked up by plain id from disk (`mods.rs:158-176`, `mods.rs:396-418`). Layouts refer to blocks as `mod:<id>` (`modApp.ts:402`).
  - phase-01 step 5 extends this clone operation to the catalog.
  - phase-04 step 3 makes `sidebar/tabs/...` aliases for shipped source.
  - Under mods-off, `scan` returns nothing (`mods.rs:162-164`), so stock UI served through a mods route needs its own path anyway.
- **Failure.** If the clone default is reused, cloning stock `workspace-overview` creates `mods/workspace-overview`. Two things can then go wrong:
  - If id resolution prefers disk, user code silently replaces stock.
  - If the catalog is exempted from mods-off by id string and lookup falls through to disk, safe mode runs the user's broken or hostile copy. That defeats the recovery path in design.md §4 and phase-04's critical "Source failure while Settings/recovery needed".
- **Plan correction.**
  - Give catalog references their own namespace, for example `stock:<id>`, that `plain_id` rejects (`mods.rs:98-104`).
  - The package route serves catalog ids only from embedded bytes and never falls through to disk.
  - Cloning a catalog package requires a distinct id or derives `<id>-copy`.
  - Under `PERCH_MODS=off` or the mods-off setting, the route serves the catalog only.
  - Phase 1 test: put a user folder with the catalog's id in place, turn mods off, and check that the served bytes match the catalog digest.

### SEC-03 High: sanitizers for untrusted content become editable, shared, mutable presentation code
- **Threat model.** The attacker writes content, not mods: agent or provider output, a repository's Markdown, or files on a remote host. The trusted-mod decision does not cover this attacker.
- **Evidence.**
  - Chat sanitizing: `markdown.ts:12-23,37`, `views/nativeChat/SafeHtml.tsx:1-12`.
  - The file preview uses a stricter, separate instance whose "config never touches the chat renderer's" (`markdown.ts:59-122`).
  - uiBlocks promises "never as HTML or a link" (`views/nativeChat/uiBlocks.ts:1-4`).
  - phase-03 step 4 exports native-chat messages, code, diff and UI blocks. design.md §1.1 exports presentation helpers, and §2 puts shared primitives in the SDK.
  - The page holds Tauri IPC (`crates/perch-desktop/capabilities/main.json`: open-in-default-app, permissions-restart-host, capture-window) and, on a relay phone, the credentials from SEC-01.
- **Failure.**
  - (a) The SDK exports a shared DOMPurify. Any clone that calls `addHook` or `setConfig` weakens sanitizing for stock chat and file preview everywhere. That breaks the isolation `markdown.ts:59` depends on.
  - (b) An agent asked to "move the composer and change message rendering" rewrites `SafeHtml` as `innerHTML`. Agent or repository Markdown then runs script in the IPC-holding page.
- **Plan correction.**
  - Keep untrusted-content rendering as frozen host SDK primitives: Markdown to sanitized DOM, the file-preview sanitizer, and the uiBlocks parser. Do not export them as editable source, and do not expose a mutable DOMPurify.
  - The exporter's boundary check fails if presentation code imports `dompurify` directly.
  - Add stock and clone conformance tests with XSS payloads: `<img onerror>`, `javascript:` links, and file-preview fetch blocking.

### SEC-04 Medium: relay loading does not fail closed
- **Evidence.**
  - `routeOf` returns null for any route not on the allowlist (`relay/transport.ts:80-87`).
  - The patched `fetch` sends `Request` objects and non-route URLs to the real fetch on the relay origin (`relay/transport.ts:230-233`).
  - The plan addresses "relay-origin static fallbacks" only in Phase 5 step 2, but Phase 1's exit gate already claims relay proof.
- **Failure.** Some module or asset URLs never get translated: absolute paths, `new URL(x, import.meta.url)` handed to `<img>`, CSS, `Worker` or `fetch(new Request(...))`. They go out in plaintext to the user's Worker with mod ids and paths in the URL. The Worker's static fallback answers them, and the result looks like a working load.
- **Plan correction.**
  - In Phase 1, the shim fetch hook calls the tunnel directly for package virtual URLs and throws for anything else, never relying on the global patch.
  - Use a virtual namespace that can never be a valid relay static path.
  - The relay e2e checks that the relay origin receives no non-tunnel requests while the graph and assets load.

### SEC-05 Medium: the client claims its own diagnostic identity, and the report caps never evict
- **Evidence.**
  - Reports are keyed by mod id, capped at 256 with no eviction (`server/mods.rs:140-150`).
  - Snapshots are capped at 16, and any connection's answer to any `request_id` is inserted (`server/mods.rs:152-164`).
  - The `request_id` goes out to every connection (`server/mods.rs:183-191,222-231`).
  - The viewer id is generated by the client (`viewer.ts:31`), while `ConnState` holds the authenticated `conn_id`/`device_id` (`server/mod.rs:2126-2132`).
  - phase-01 step 10 adds instance and viewer context, which multiplies the number of keys.
- **Failure.**
  - Any connected page, such as a stale clone on a phone, can answer `perch mod do/dom` first or report "ok" for a revision. Acceptance item 2 relies on these answers to judge the agent's work.
  - Once 256 id×instance×viewer keys or 16 unclaimed snapshots exist, new reports are dropped silently, and `check` reports "not loaded" until the core restarts.
- **Plan correction.**
  - Key reports by the server-side `(conn_id, device_id)` plus the client's instance id, and drop them when the connection closes.
  - Accept a snapshot answer only from connections the request was sent to.
  - Use TTL/LRU eviction instead of refuse-when-full, and test cap pressure.

### SEC-06 Medium: explicit-target terminal read/send would give agents other sessions' terminals, and bare ids can be spoofed
- **Evidence.**
  - Today, read and send work only on DOM elements on screen (`modApp.ts:344-352`, `modApp.ts:424-429`).
  - design.md §2 requires "explicit-target read/send/actions ... rather than requiring an on-screen DOM element", including hidden terminals and agents. §6 says there is "one command path".
  - `perch mod do` runs any `runCommand` entry for an agent token (`server/mods.rs:209-247`, `server/agent.rs:519-529`).
  - An agent token is meant for "its own session and nothing else" (`docs/ARCHITECTURE.md:267`).
  - `terminals()`/`agents()` return `id` and `hostId` separately, and `sendText`/`readTerminal` take only `id` (`modApp.ts:334,342-352`). Remote cores keep their own UUIDs (`docs/ARCHITECTURE.md:209`).
- **Failure.**
  - If `terminal.read/send {terminal}` becomes a typed command, any agent can read hidden terminals belonging to other agents or remote hosts, and type into them, through the person's page.
  - A compromised remote core can report a session id that collides with a local one. Resolving by bare id then sends text to a local shell.
- **Plan correction.**
  - Keep cross-session read/send in the SDK, out of the command table agents can reach, or record an explicit owner decision.
  - Targets are `(hostId, id)` pairs. A bare id that matches more than one terminal is refused.
  - Add tests for agent-token refusal and id collisions.

### SEC-07 Medium: the CSP proof gate tests against a CSP that does not exist
- **Evidence.**
  - `crates/perch-desktop/tauri.conf.json` has no `app.security.csp`.
  - `packages/web/index.html:4-11` has no CSP meta tag.
  - The app is served by ServeDir with no security headers (`server/mod.rs:956-966`). The only CSP is on the icon route (`server/mods.rs:300-303`).
  - Yet design.md §1.8 and the phase-01 risks require proof "through the actual Vite/CSP path".
  - es-module-shims needs `blob:` and `'wasm-unsafe-eval'` under a CSP (its README).
- **Failure.** The gate passes without testing anything. A later CSP, for example one added to protect the SEC-03 sinks, breaks the loader on every client.
- **Plan correction.**
  - Write down that there is no CSP today.
  - Pick the target policy, for example `script-src 'self' blob: 'wasm-unsafe-eval'`, and inject it in the Phase 1 direct and relay e2e runs. The relay Worker's shell headers count as part of this.
  - Otherwise, remove the CSP claim.

### SEC-08 Medium: the package route's path and identity handling is not specified
- **Evidence.**
  - Existing confinement canonicalizes and reads the disk on each request (`mods.rs:288-297,355-359,409-414`). That contradicts snapshot binding (design.md §1.6) and leaves a time-of-check/time-of-use gap.
  - The relay drops `nosniff`, CSP and cache headers. It forwards only content-type, content-disposition and set-cookie (`relay/host.rs:385-391`, `relay/transport.ts:119-121`).
- **Failure.**
  - `Main.js` vs `main.js` (on case-insensitive APFS), `a/./b.js`, and double-decoded `%2e%2e`/`%2f` all name the same file. Each gets its own module record, which splits singletons and state.
  - Any fallback to disk reopens traversal.
  - HTML or SVG assets served same-origin with a script-capable type become navigable documents.
- **Plan correction.**
  - Serve only by exact, case-sensitive lookup in the snapshot's inventory map, with no filesystem access at request time.
  - Reject `.`, `..`, empty segments, `\`, NUL, a leading `/`, encoded separators, and any second decode.
  - Content types come from an extension allowlist that never includes HTML.
  - Send `nosniff`, plus `CSP: sandbox` on non-script assets as the icon route does.
  - Check the MIME type in the client fetch hook too, because the relay strips headers.

### SEC-09 Medium: the Phase 4 mod-data route is needed on phones but has no relay, auth or confinement spec
- **Evidence.**
  - phase-04 step 7 and its inventory (`server/mods.rs`) add durable mod data.
  - C06, C16 and C17 require it on every client.
  - The relay allowlists (`relay/transport.ts:21`, `relay/host.rs:45`) are not in the Phase 4 inventory.
  - `copy_tree` copies everything in a mod folder into a clone except dotfiles and symlinks (`mods.rs:545-565`).
- **Failure.** Phones either lose parity, or someone later widens the relay or reuses `mods/fs`, which design.md §6 forbids. If data lives under `mods/<id>/`, the package route serves it and clones copy private data.
- **Plan correction.**
  - Specify one exact route name, gated by `authorize_request`, that refuses agent tokens and refuses when mods are off.
  - Validate the mod id and key with `plain_id`.
  - Store the data in a core-owned folder outside `mods/`, with byte and record bounds.
  - Add both relay allowlists to the Phase 4 inventory with exact-name tests.

### SEC-10 Low: the revision digest algorithm and cache namespace are unspecified
- **Evidence.** The current revision is FNV-1a over size and mtime (`mods.rs:185-194`). The plan says "content digest" without naming an algorithm. `sha2` is already a dependency (`crates/perch-core/Cargo.toml:31`).
- **Failure.** A non-cryptographic or truncated digest lets any same-user process craft collisions. `check` then reports "ok" for different bytes, and the client reuses the old module graph. A catalog package and a clone with the same id and revision would share cache keys.
- **Plan correction.** Use SHA-256 over a canonical list of (path, length, bytes). Build virtual URLs from `{catalog|user}/{id}/{full digest}/{path}`.

### SEC-11 Low: the exporter can leak build-machine details into the catalog that gets committed and served
- **Evidence.** phase-01 step 3 uses an esbuild transform. The output is committed under `stock_ui/` and served to every paired device.
- **Failure.** Inline source maps, `sourcesContent`, absolute `/Users/...` paths or `import.meta.env` values end up in the output.
- **Plan correction.** No source maps. The `--check` gate rejects absolute paths and `import.meta.env` in the output. Run `--check` from a second checkout root as well.

### SEC-12 Low: PWA caching of authenticated package responses
- **Evidence.** Phase 5 changes `vite.config.ts` for "Source assets/PWA cache". The current Workbox setup only precaches (`vite.config.ts:58-66`), and `mods/file` sends `no-store` (`server/mods.rs:358`).
- **Failure.** Runtime-caching `mods/package` keeps user source in Cache Storage after pairing is revoked, and stale revisions get served from it.
- **Plan correction.** Never runtime-cache the package route. Add it to `navigateFallbackDenylist`.

## Verified as sound (reuse these as they are)
- `authorize_request` refuses agent tokens on every non-agent route (`server/mod.rs:1897-1899`).
- The relay allowlist matches exact route names and rejects CR/LF and spaces (`relay/host.rs:326-329`).
- `copy_tree` skips symlinks, dotfiles and `node_modules`, and is bounded (`mods.rs:545-565`).
- Mod source lookups resolve symlinks and stay inside the mod folder (`mods.rs:409-414`).
- Desktop and LAN credentials are `HttpOnly` and `SameSite=Strict` cookies.

## Unresolved questions
1. SEC-01: does the owner accept that a relay phone exposes its credentials to mods, or do they want the opt-in?
2. SEC-06: may agents read or send to other sessions' terminals through `perch mod do`?
3. Clones of stock packages go through `copy_tree`, which is capped at 300 files and 8 MiB (`mods.rs:477-478`). Do the measured stock package sizes fit?
4. The plan's file inventories use `/Users/hwiii/Github/perch/...`, not this worktree. Which tree is authoritative for execution?

Status: DONE
Summary: 12 evidence-backed findings (3 High, 6 Medium, 3 Low). The most serious: mods on a relay phone can read the phone's pairing credentials and keep using them, user clones can collide with stock ids and break safe-mode recovery, and the sanitizers for untrusted content would become editable shared code. The plan should be corrected before execution.
