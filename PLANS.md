# PLANS.md — follow-up work

Snapshot: 2026-08-04, branch `main`, HEAD `6d102c5`. This file tracks work that was
deliberately stopped mid-stream or deferred; `PLAN.md` remains the phase-by-phase
record of completed work.

**Read the sanitization note at the top of `CLAUDE.md` before touching anything.** The repo
is public and its history was scrubbed and recreated on 2026-08-04; internal-looking names in
these docs are placeholders, and real ssh targets live in `~/.perch/hosts.json`.

**Item 1 (Hosted-mode power features / composer UI) is DONE** — landed as Phase 7,
see `PLAN.md`. The section that used to sit here has been removed rather than
marked done; `PLAN.md` is the record.

## Open items

- **Ship perch to other machines** (the bundle itself is DONE — Phase 11, see
  `PLAN.md`; `/Applications/perch.app` is installed and verified). What remains is
  purely distribution, and none of it is code — full detail in
  `docs/DISTRIBUTION.md`:
  - ~~the repo is **private**~~ — **resolved**, `hwii-florescent/perch` is public (and was
    deleted/recreated during the 2026-08-04 scrub, so it has no stars, forks, or releases and
    a fresh creation date). What remains is that there is still **no release**, so the cask's
    `url` points at an artifact that does not exist — cut one with `gh release create`;
  - the app is **ad-hoc signed, not notarized**, so Gatekeeper blocks it on any
    other Mac. Note Homebrew removes casks failing the Gatekeeper check from the
    official repo on **2026-09-01**, and `--no-quarantine` is being removed from
    `brew`, so a personal tap would need users to run `xattr -dr
    com.apple.quarantine` by hand. Notarizing needs an Apple Developer account;
  - the build is **arm64-only** (deliberate — see the decision note in the doc).
  A filled-in cask template is ready at `packaging/homebrew/perch.rb`.
- **Universal command/skill palette** (supersedes `BUGS.md` Bug 2 — do this
  *before* the jean-parity backlog below). Today the composer sigil is
  per-agent (`AGENT_SIGIL = {claude:'/', codex:'$'}` in
  `packages/web/src/composerCommands.ts`) and only the *selected* model's list
  shows: `sigil` is derived each render from `AGENT_SIGIL[store.agent]`
  (`Chat.tsx:744`) and the candidate list is sliced to that same agent
  (`sessionCommands[sessionId]?.[agent]`). This is correct today but doesn't
  generalize to future open-weight models / added MCPs / plugins / skills.
  **Goal:** any sigil triggers one unified, deduped palette regardless of the
  selected model. **Approach sketch:** on app start, aggregate
  commands/skills/plugins/MCPs from every agent config dir (`~/.claude`,
  `~/.codex`, `~/.agents`, plus their plugin/MCP/skill subdirs) into one pool,
  **dedup first** (by name/source), and serve it through the existing
  `commands.list` path — which already returns *both* agents' lists per session
  (`crates/perch-core/src/commands.rs::list_for` → `store.ts` stores
  `{claude, codex}`), a natural foundation. The composer then derives the
  popover from the unified pool instead of `AGENT_SIGIL[agent]`. **Must
  preserve the no-mis-send guarantee**: a picked command has to route to the
  runner it belongs to (claude path-list vs codex `-i`/`--` separator in
  `agent.rs`). Relaxes the "sigil derived per-agent, never stored" invariant
  documented at `Chat.tsx:722–736` — update that comment when it lands.
- **jean-parity backlog** (earlier menu, untouched): @-file mentions, AI commit
  messages / PR descriptions, MCP support, GitHub #-issue mentions, worktree
  auto-cleanup.
