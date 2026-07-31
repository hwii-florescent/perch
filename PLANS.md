# PLANS.md — follow-up work

Snapshot: 2026-07-31, branch `herdr-parity`. This file tracks work that was
deliberately stopped mid-stream or deferred; `PLAN.md` remains the phase-by-phase
record of completed work.

## 1. Hosted-mode power features — server DONE, UI partially wired

The Rust/server side of slash commands, plan mode, attachments, and effort is
**complete and unit-tested** (77 tests green). The TypeScript store layer is
complete. The remaining work is composer UI only.

### Already done (do not redo)

Server (`crates/perch-core`):
- Protocol: `chat.send` gained `planMode?`, `effort?`, `attachments?`; new
  `commands.list` (client+server) and `chat.plan` messages. Mirrored in
  `packages/shared/src/protocol.ts`.
- `commands.rs`: slash/skill discovery — claude via zero-cost
  `claude -p "/effort" … --no-session-persistence` init-line parse
  (`slash_commands`/`skills`/`agents`), codex via `codex debug prompt-input`
  skills-block parse. Local + over-ssh (direct hosts), 300s cache keyed host+cwd.
- `uploads.rs` + `POST {base}upload?sessionId=<id>&name=<file>` (raw bytes body,
  no multipart) → `{"path","name"}`; per-session dirs under `~/.perch/uploads/`,
  25MB cap, no-clobber names, 24h sweep.
- Runners (`agent.rs` + `detached.rs`, both modes): plan mode (claude
  `--permission-mode plan`, codex `--sandbox read-only`); effort (claude
  `--effort X` + `MAX_THINKING_TOKENS=0` for `none`; codex
  `-c model_reasoning_effort="X"`); attachments (claude: path list appended to
  turn text; codex: images via repeatable `-i` before the mandatory `--`/`-`
  separator; direct hosts: files pushed to the remote run dir via
  `ssh::write_remote_bytes` first).
- Plan detection: claude 2.1.x has no ExitPlanMode — a `Write` tool_use whose
  path contains `/.claude/plans/` IS the plan; parser emits `AgentEvent::Plan`
  and suppresses the Write card + its tool_result.
- Safety: `strip_image_blocks` replaces base64 image blocks in tool results
  with `[image]` before WS/SQLite.

Web (already on disk):
- `protocol.ts` fully mirrored; `store.ts` handles `chat.plan` (inserts a
  `kind: "plan"` message ahead of the streaming bubble), `commands.list`
  caching, `effortBySession` + `EFFORT_OPTIONS`, and
  `sendChat(text, { planMode, attachments })` which reads effort from the store.
- `EffortChip.tsx` — built AND rendered next to ModelChip (functional today).
- Helpers built but not yet used by any UI: `attachments.ts` (upload helper),
  `composerCommands.ts` (autocomplete filtering), `popoverPosition.ts`.

### Remaining (composer UI in `packages/web/src/views/Chat.tsx`)

1. **Slash autocomplete**: typing `/` (claude) or `$` (codex) at token start →
   popover from `commands.list` via `composerCommands.ts`; Up/Down/Enter/Escape;
   testids `composer-slash-popover`, `composer-slash-item-<name>`. Note:
   `CommandEntry.name` is bare — prepend the sigil in the UI; claude entries
   have no descriptions, codex entries do.
2. **Plan mode UI**: composer toggle (`composer-plan-toggle`) passing
   `planMode: true` to `sendChat`; a renderer in Chat.tsx for the
   `kind: "plan"` message (markdown card + "Approve & run" button
   (`plan-approve`) sending "Approved. Proceed with the plan now." with
   planMode false). Plan cards arrive for claude only.
3. **Attachments UI**: attach button (`composer-attach`) + drag-drop onto the
   composer → `attachments.ts` upload → pending chips with remove → pass
   server paths to `sendChat`; clear after send.
4. **e2e coverage** for all four features + a live smoke (script outline: type
   `/` → popover; plan turn → card, file not created → approve → created;
   attach PNG → colour answer, no giant base64 in DOM; codex effort low turn).

## 2. Other open items

- **CLI-only sessions are invisible in the nav** — `db.rs::list_sessions`
  requires ≥1 hosted message; a CLI-mode-only session never qualifies. Needs a
  deliberate fix (loosening the query also surfaces the blank session minted on
  every connect — design first).
- **Detached recovery live-update wart** — a page attached during the
  few-second recovery window doesn't live-update until reopened (fresh pages
  always render correctly).
- **Tauri `Perch.app` bundle** — unblocked now that boot adopts the login-shell
  PATH; build the bundle and verify a Finder launch end-to-end (codex auth
  included).
- **hosts.json cleanup** — the two configured devpods were deleted by the user;
  replace with `dev-agent.devpod-us-or` (mode `direct`).
- **Repo hygiene** — `cargo fmt --check` fails repo-wide on pre-existing hunks;
  `ssh::tests::mux_control_path_stays_under_the_macos_sun_path_limit` is flaky
  in the full suite (another test mutates `HOME`; `control_dir()` is a
  `OnceLock`) — fix the test-order race or the clipboard test.
- **jean-parity backlog** (earlier menu, untouched): @-file mentions, AI commit
  messages / PR descriptions, MCP support, GitHub #-issue mentions, worktree
  auto-cleanup.
