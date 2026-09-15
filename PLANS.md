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
- **Universal command/skill palette** (do this
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

## From the interrupted Codex goals.md session (2026-09-11)

The "Follow goals.md with Luna" session ran out of quota mid-turn twice. These are
the items it stated or left unfinished; the structural refactor that followed was
deliberately behavior-free and did not address any of them.

- **UI mode is still a second harness, not a view of the CLI-owned session.**
  `goals.md` requires "UI mode is a web view of the same CLI-owned session, not a
  separate agent harness"; Codex's own words were "the current separate Chat runner
  still needs to be replaced." Two implementations still run side by side: the
  headless per-turn runner (`ClaudeRunner`/`CodexRunner` at
  `crates/perch-core/src/server/session.rs:248` and `:1347`, driven by
  `handle_chat_send` at `session.rs:1078`) and the real interactive PTY
  (`open_agent_terminal` at `crates/perch-core/src/server/terminal.rs:20`).
  Unifying them touches the protocol pair and the store's chat handling — plan it
  as its own phased slice.
- **Provider parity is partial.** Claude Code, Codex, OMP and Pi resolve on this
  machine; `opencode` does not. Decide whether it is "offer to install" or out of
  scope and record it in `SPEC.md`.
- **Unwired scaffolding.** 12 `pub fn`s exist with zero callers, and 20 more are
  referenced only by their own unit tests (notably `hibernation_decision`, the
  agent-change-snapshot trio, `create_worktree_workspace`,
  `archive_workspace_for_path`, `wake_cli`). Each is a completed, tested slice of a
  `goals.md` capability that no protocol handler calls. Decide per item: wire it or
  delete it — do not leave it in the middle state a third time.
- **Unverified:** the `savedPanelIdsRef` fix at
  `packages/web/src/dockview/DockviewShell.tsx:331,393,511` ("Pi pane missing after
  reload") passes its unit test but was never re-checked against
  `e2e/native-providers.spec.ts`.
