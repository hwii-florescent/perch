# Orca reference, not a roadmap

Perch learns from [Orca](https://github.com/stablyai/orca), but is not a port or
a completeness exercise. [ROADMAP](ROADMAP.md) owns priorities;
[PUBLIC-ALPHA](PUBLIC-ALPHA.md) owns release gates.

This selected inventory replaces the old tiered grep survey, whose missing
markers had become stale. Implementation summary refreshed against `8dae768`;
not a fresh runtime comparison. Orca reference revision: `564f1352`.

| Area | Perch implementation | Relevant gap / deliberate limit |
|---|---|---|
| Real CLI agents/shells | Provider manifests, native observations and OSC-title fallback; exited agents leave a shell. | Provider-specific evidence differs; not a second harness/chat product. |
| Worktrees | Background local create/cancel/retry, start-from, include/shared paths, external discovery, rename/pin/nesting and guarded deletion. | Remote workspace inventory/jobs incomplete; per-user shared paths and squash-merge detection are not implemented. |
| Tabs and splits | Mixed terminal/file/review order, splits and per-viewer local restoration. | Remote canonical surfaces not routed; not arbitrary grouping/tear-off. |
| Continuity | Local perchd, retained history, screen repaint, tri-state liveness and bounded queues. | Bounded history, not infinite transcript; app/core survival is not reboot/daemon survival. |
| Attention | Local Needs You / Welcome Back, toasts/sound and desktop notifications. | Remote event relay, per-user read state and notification deep links deferred. |
| Terminal extras | Search, OSC 52, kitty keyboard, link-to-browser tabs, bounded context copy. | No need to treat these as missing because an old inventory did. |
| Navigation | Navigator for sessions/agent launch; drawer file search. | Workspace file Quick Open and broader shared actions remain. |
| Files | CodeMirror/drafts/conflicts, images/PDF/media, archive extraction/download, desktop default-app open. | Markdown rendered file preview, image controls and richer Open With remain. |
| Git/review | Status/diffs, commit/push, anchored comments and agent packets. | Thin PR/status/checks integration later. |
| Context handoff | Local bounded Context Bridge; Claude explicit send, other harnesses Copy. | No arbitrary PTY injection; remote and further safe provider transports later. |
| Usage/profiles | Plan usage windows and iTerm/Ghostty profiles. | Not an account/quota manager; Warp import not implemented. |
| Remote/phone | Perch federation, reduced direct SSH/tmux, paired browser/PWA and shared CLI input. | Full managed remote workspace and phone refinements remain. |
| Browser | Browser tabs/drawer; desktop native child webviews. | Remote service forwarding/security verification are distinct from merely having a viewer. |
| Agent-facing CLI | No scoped Perch CLI yet. | Later, through core's services and authority model. |

## Not parity tasks

Orca features such as floating terminals, kanban, orchestration/automations,
account hot-swap, issue-system suites, browser design mode and computer use do
not become Perch requirements by appearing in a comparison.

For current Perch contracts read [ARCHITECTURE](ARCHITECTURE.md); for dated
competitive research see [PRODUCT-STRATEGY](PRODUCT-STRATEGY.md). Consult Orca
source for ideas/invariants, not a file layout or an implicit to-do list.
