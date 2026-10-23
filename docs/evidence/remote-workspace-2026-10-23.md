# Managed remote workspace: resource slice evidence

Date: 2026-10-23. Candidate: the implementation commit containing this record,
based on `4277d46`. This is development evidence, **not D3 or public-alpha
certification**. Private host aliases, account names, home paths and scheduler
identifiers are intentionally omitted.

## Implemented boundary

- Remote project/workspace inventory, names/focus/nesting and synchronous
  worktree operations use the owning core. The hub does not import their rows
  into its own DB or interpret remote paths locally.
- Browser-facing project/workspace IDs encode the stable configured host ID
  and owning core ID. Identical UUIDs from different hosts remain distinct.
- Bounded text files, search, durable drafts, optimistic saves/conflicts,
  filesystem mutations and canonical file/diff surfaces/presentation reuse
  the remote core's existing confinement and persistence services.
- Upstream request IDs are rewritten per browser/host; project creation keeps
  correlation through its row events and terminal snapshot. Metadata broadcasts
  do not carry another viewer's request ID. Pending requests have count, byte
  and time budgets.
- Disconnect reports an unavailable/unknown outcome without queuing mutations
  for reconnect. The UI keeps stale inventory and drafts, reads durable buffers
  before reconciling them, and retains a tab after an unconfirmed close.
- Remote media/download transport is explicitly unavailable (HTTP 501 and
  viewer explanation); no OS-default open receives a remote path.

## Repeatable automated checks

Local platform: macOS 27.0.1 Apple Silicon; Cargo 1.97.1, Node 26.10.0,
Playwright 1.61.1, headless Chromium.

| Command | Result |
|---|---|
| `cargo test -p perch-core` | Passed: 354 unit tests and 2 protocol-parity tests. |
| `npm test -- --run` | Passed: 458 tests in 50 files. |
| `npm run build` | Passed; existing bundle-size advisory remains. |
| `cargo fmt --check` | Passed. |
| `cargo clippy -p perch-core --all-targets` | Passed; three existing warnings outside changed logic, no new warnings. |
| `cd e2e && npx playwright test -c remote-workspace.config.ts` | Passed: 10 headless tests; no paid turns or remote agent processes. |

The dedicated e2e config isolates both cores' DB, hosts, settings and daemon
paths and refuses server reuse. It covers:

- RG1–RG4: honest capabilities, live branch metadata, remote stage/commit/review,
  and worktree creation/deletion with unmerged-branch review. These tests no
  longer require an agent turn just to make a remote project discoverable.
- RW1–RW6: colliding remote UUIDs, local inventory separation, cross-host nesting
  refusal, file/search/draft/save/conflict/confinement, HTTP media refusal,
  remote canonical surfaces and opaque presentation, UI file reload without a
  remote session, unconfirmed-close retention, qualified Git/review/nested
  worktrees, and disconnected-write refusal followed by draft recovery.
- Focused Rust checks exercise same-request-ID browser isolation, wrong-peer
  replies, late replies, disconnect outcomes, malformed/unavailable identities
  and multi-reply project creation. Web regressions cover host-scoped read-first
  buffer reconciliation and stale-inventory retention/reconnect refresh.

Active LSP probes reported no language-server errors, but several push-only
servers could not confirm clean rechecks. Supplemental scanners flagged an
existing loopback WebSocket test and the pre-existing test-only shell helper;
these are not a blanket clean-security result. Advisor completion review was
attempted twice but unavailable due to rate limiting; no successful independent
completion review is claimed.

## Actual authorized Linux host probe

Platform: Linux x86_64, Red Hat Enterprise Linux 9.8. Remote Cargo/rustc 1.87.0.
The source was built with `cargo build --locked --release -p perch-core -j2`
in a CPU-only scheduler allocation, using a private scratch source/target/cache
and at most two CPUs. No existing runtime was installed, replaced or upgraded.

A scratch remote core listened on loopback behind a normal authenticated SSH
local forward, with no requested agent forwarding. An isolated local hub used
that forwarded endpoint. Both cores used scratch `PERCH_DB`, `PERCH_HOSTS`,
`PERCH_SETTINGS` and `PERCHD_DIR`; the probe created its own tiny Git fixture.
No existing project, provider, training job or default Perch daemon was used.

Observed results:

```text
PASS actual Linux: host-owned inventory, text save, durable draft, Git, file/diff surfaces, confinement
PASS local core restart: same remote workspace identity, draft and viewer presentation
PASS disconnect/reconnect: mutations refused, no replay, saved file and dirty draft retained
PASS real SSH transport loss and remote core restart: persistent draft and presentation recovered
```

The probe registered the remote fixture through the hub, verified saved content
on the remote filesystem, retained a newer dirty draft separately, restarted the
local core against the same scratch DB, disabled/reconnected the host, then
stopped/restarted the actual remote core. Workspace identity, draft text and
opaque viewer layout survived. Local inventory never acquired the remote row.

Cleanup was confirmed: scratch remote core stopped by its exact executable/PID;
remote build/cache/state/fixture removed; no PTY daemon had been launched. Only
the probe's exact SSH forward was canceled; the pre-existing SSH master and
unrelated execution were preserved. Both CPU build jobs had finished.

## Limits and next work

No terminal or agent runtime was started by the actual Linux probe. It does not
prove remote PTY survival, owned close, incarnation reconciliation, lost start/
stop acknowledgements, provider questions or a full D3 worktree/runtime cleanup.
It also does not test a packaged installer or artifact verification.

Still required: persistent owned-shell/provider-runtime routing, remote
background jobs, bounded authenticated media/downloads, attention relay,
consent-based compatible-runtime deployment/update, and full actual-host D3
with the runtime/fault/cleanup gates. Browser connection itself still uses the
existing session handshake; session-free connect remains separate roadmap work.
