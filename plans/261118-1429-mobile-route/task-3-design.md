# Shared tabs: design

Decision A (2026-11-18): a workspace's open tabs live in the core and every device draws them.
Decision B: which tab each device shows stays its own.

## Data shape

One row per local workspace in a new core table `workspace_tabs`:

| field | meaning |
| --- | --- |
| `workspaceId` | the workspace (local host only in this slice) |
| `revision` | bumped on every real change; 0 = no row yet |
| `strip` | tab ids in strip order: session ids (places of sessions among the other tabs) and the web's `fileTabKey` ids `<workspaceId>\n<path>`, `<workspaceId>\n\0review`, `<workspaceId>\n\0browser\n<url or blank:..>` |
| `sets` | split sets in the web's `SplitSet` shape (`{ids, sizes, dir?, tree?}`, `tree` = web `SplitNode`); opaque to Rust beyond a size cap and "members are in the strip" |

The ids are self-describing, so no separate descriptor list is needed: a device that sees
`<w>\n src/a.rs` opens that file. Native already uses the same ids (`review.rs`, `browsing.rs`).

## Wire (capability `workspace.tabs.v1`, local host only)

- `workspace.tabs.set {requestId, workspaceId, baseRevision?, strip, sets}`.
- `workspace.tabs {requestId?, workspaceId, revision, strip, sets, conflict?}`:
  sent on connect for every workspace that has a row, broadcast to every connection after a change
  (the requester's copy echoes `requestId`), and sent only to the requester with `conflict: true`
  when `baseRevision` is not the current revision (nothing is stored then).
- The core keeps only shareable ids (a session id, or an id of this workspace that is not a mod tab),
  dedupes, caps the strip at 4096 ids and `sets` at 256 KiB, and drops a set whose members are not
  all in the strip. An unchanged write does not bump the revision.

`viewer.presentation.*` and `surface.*` stay as they are: the web keeps its per-viewer row for the
active resource and the session it shows, and keeps opening files as surfaces (drafts, dirty guard).

## Who writes

Every device: the web (desktop web, phone) from `surfaceSync.ts`'s debounced mirror, native from the
window after each change. Each sends its projection (shareable ids only) of the workspace's strip
and sets with the revision it last applied.

## Conflict rule

Last writer wins on the whole row, guarded by `baseRevision`. A client keeps, per workspace, the
last core state it applied (`base`). When a newer core state arrives (a broadcast, or a conflict
reply) it three-way merges `merge(base, local, remote)`, adopts the result and writes again if its
projection differs from the core's:

- ids local removed since `base` are removed from remote's; ids local added are inserted after
  their local predecessor (else first);
- order: remote's, unless local reordered the ids it shares with `base` (then local's, with remote's
  additions after their remote predecessor);
- sets: local's if local changed them since `base`, else remote's; a set whose members are not all
  in the result is dropped. "Changed" compares a canonical form (the tree, sizes in thousandths,
  no key order), so a set one client rewrote is not a change.

The `base` survives a reconnect, so changes made offline are merged, not overwritten. With no
`base` yet (first state after launch), `base` is the device's own projection: remote wins,
and the device's unshareable tabs (mod tabs, terminal-scoped tabs) keep their places.
Same function in TS (`sharedTabs.ts`) and Rust (`tabs.rs`).

## Migration from per-viewer rows

On connect the core seeds a workspace that has no row from its most recently updated
`viewer_presentations` row whose layout is the web's v1 (`strip`, `sets`), filtered by the same
rule, with ended sessions dropped; if that row leaves nothing, an older one is not used. The per-viewer rows are never changed or deleted, so an older client still reads its own.
A workspace with no legacy row gets its first row from whichever device writes first (native's
`.window.json` strips migrate this way). The native `.window.json` strips stay as a cache: they
restore the window offline and before the core answers, and the core's state replaces them.

## Per device (not shared)

- the active tab / session shown (web: per-viewer presentation and localStorage; native: `active`);
- UI/CLI view mode; zoom; Back/Forward history; preview (italic) state;
- native "put away" sessions (a tab closed without ending its session);
- mod tabs (they carry props) and terminal-scoped file tabs (`scope`), until a scope is a core fact;
- remote-host workspaces (the shared row lives on the owning core; relaying it is later work).
