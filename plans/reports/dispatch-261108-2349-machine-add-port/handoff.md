# Machine-add-port verification and completion handoff

## Mission and current status

The owner asked whether `machine-add-port` is done and explicitly requested another subsession if not. Use **Claude Code in this newly assigned Perch worktree** and invoke **`/ak-cook <YOUR_WORKTREE>/plans/261108-2145-machine-add-port/plan.md`**. If slash invocation is unavailable, explicitly locate/read the installed ak-cook SKILL.md and follow it. Do not silently replace the requested runtime.

The plan is **partially implemented**, not simply “not started”: its top status is stale, four slices are committed, and the CI release core job is explicitly unrun. Reconcile the document with actual evidence. Complete verification and fix remaining authorized gaps, not a new transport design.

## Scope and guardrails

- Original checkout: `/Users/hwiii/Github/perch` on `main`; **never write source there**. Your own isolated Perch worktree is the implementation root.
- Timezone `America/New_York`; English; locale `en_US.UTF-8`. Read `/Users/hwiii/.claude/rules/development-rules.md`, AGENTS.md, docs/TESTING.md and affected module headers.
- Markdown belongs under your worktree's plans/ or docs/. The user explicitly requested this isolated worktree. New source filenames follow descriptive kebab-case, Rust snake_case and existing language conventions.
- KISS/DRY; full authorized outcome, nothing unrequested; no --yagni. No new dependency without need. Every nontrivial change needs a focused runnable regression.
- No automatic commits, push, tags, merge, workflow_dispatch, release or production installation. Do not access installed application databases/daemon; back up before any actual data/schema modification.
- No real remote host is authorized. Do not discover/select a private host from this computer. Report genuine remote/cross-OS verification as blocked if needed, not a loopback success.
- Do not start more Perch subsessions. Native bounded review agents may be used as required by ak-cook within your one worktree writer policy.

## Current state and baseline setup

Base commit: **`8a02934e9b3b7743f6377cb41ce6dedfd1cb1807`**. Already includes:

- `f8b18ac`: probe/install, SSH config names and login command.
- `d10f805`: installed-core startup and precheck.
- `ac17490`: machine messages and Settings > Hosts MachineCheck.
- `527ed22`: release core assets/checksums (unrun).
- `8a02934`: architectural/product documentation and proof limits.

Frozen input folder beside this handoff:
`/Users/hwiii/Github/perch/plans/reports/dispatch-261108-2349-machine-add-port/`

It contains `baseline-manifest.json` plus **one** plan file under baseline-files/. Verify the manifest base commit, copy the plan by relative path into your worktree, and verify its SHA-256. The plan is untracked in main and will not otherwise exist in a plain HEAD worktree.

**Use HEAD + this plan only, not the entire dirty main checkout.** Perch may carry current working changes into new worktrees; inspect git status/base first. If it carries dirty changes, preserve them outside your implementation diff or stop/report a safe-baseline issue; never delete user work blindly. Do not merge another arbitrary branch to obtain a baseline.

There are unrelated ongoing native-chat/subsession changes in main. Known overlap/integration hotspots include `packages/web/src/components/SettingsPage.tsx`, `crates/perch-core/src/server/mod.rs`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, and `crates/perch-core/src/server/dispatch.rs` if both jobs touch it. Do not import dirty hunks unless you prove a dependency and record the exact hunk/reason. Integration is later reviewed work, not this session's merge task.

## Decisions and rationale

Approved scope is route A: CI-built headless core assets; probe/install/login/clear next steps in Settings; installed-core startup using existing SSH tunnel and tmux; direct hosts retain their semantics. Consult owning **Add machine** entry in docs/DECISIONS.md; it supersedes earlier contradictory proposal text.

The plan deliberately excludes `--via`/framed stdio transport, core-routed one-shot exec and removal of tmux. Those exclusions are not new bugs to implement. **Classify each acceptance item** as:

1. Met, with retained evidence.
2. Unmet and in scope: implement/fix and verify.
3. Blocked by an explicit exclusion or absent external capability: report and ask the owner if changing that decision is necessary.

Do not silently redefine acceptance or implement a transport rewrite to make an old sentence true. For example, “remote exec comes from the remote core” conflicts with the later intentional SSH decision; “only SSH access” may conflict with stated tmux prerequisites. Record those as product-contract conflicts with the current approved decision, not passing tests.

## Work performed and verification

Parent read the plan, relevant testing/decision docs and commit history. Existing machine tests and workflow paths were identified, but **no fresh machine tests or release job were run**. `ak plan parse` finds no structured phases/checklists in this older narrative plan; do not call its zero-task count completion. Parent attempted docs/MACHINES.md but that path does not exist; use owning docs above.

## Open risks and blockers

Release core job is unrun. No fresh cross-platform remote-host proof exists. Local workflow lint/build/tests do not close release/download/real-host gates. Actionlint was not found in the parent's PATH; do not silently install tooling or claim lint ran. Remote installation and shared SSH master authority/atomic replacement require care.

Another worktree is executing cloneable stock UI: session `b23d52b7-2f8e-4e88-8d62-8262fff82ce8`, worktree `/Users/hwiii/.perch/worktrees/perch/use-the-ak-cook-skill-to-execute-the-cloneable-s`. Do not edit it. Avoid colliding test ports/processes. If a fixture needs a fixed port already used, report or configure a private port rather than stopping another job.

## Exact next actions

1. **First safe step**: confirm your actual cwd/branch/base and model; ensure it is not the main checkout or stock-UI worktree. Establish HEAD + the one manifest-verified plan without discarding carried user work. Report a baseline problem rather than resetting.
2. Invoke ak-cook on the worktree plan. Scout all machine/probe/install/login callers, server/protocol compatibility, Settings UI, hub startup and release packaging. Build the acceptance classification before implementation.
3. Run narrow existing machine/MachineCheck/protocol checks. Use the smallest useful regression for each proven gap. Trace callers before changing shared helpers. Keep Rust/TS protocol fields compatible and existing remote/direct semantics intact.
4. Follow docs/TESTING.md for isolated real loopback SSH testing: throwaway sshd on a high loopback port, temporary client/host keys and HOME, private PERCH_DB/PERCH_HOSTS/PERCHD_DIR/PERCH_SETTINGS, no real ~/.ssh/config or known_hosts writes, no installed daemon. Audit the existing script before running it; report exact process cleanup. If sshd is absent/unusable, keep that verification gap. Mocks never count as real SSH or real remote proof.
5. Validate local release build/package contracts where feasible; no release triggers, tags or pushes. Preserve explicit unrun CI and cross-OS gaps. Real agent test turns, if needed at all, use only claude-haiku-4-5 or gpt-5.6-luna with actual banner verification; your own default implementation model is separate.
6. Reconcile plan/docs status and contradictions based on evidence; review changes/tests/security. Report actual worktree/branch/model, changes, commands/results, acceptance classification and remaining external blockers with `perch report`, then stop and wait. Do not label full machine-add complete without its required evidence.

## Source pointers

- Copied `plans/261108-2145-machine-add-port/plan.md`.
- `docs/DECISIONS.md` Add machine, docs/ARCHITECTURE.md remote execution, docs/TESTING.md machine-over-real-ssh and isolation.
- `crates/perch-core/src/machine.rs`, `ssh.rs`, `hub.rs`, server/config.rs and server/dispatch.rs.
- `crates/perch-core/tests/machine_install.rs`, `scripts/machine-over-real-ssh.sh`.
- `packages/web/src/components/MachineCheck.tsx`, MachineCheck.test.tsx, SettingsPage.tsx.
- `crates/perch-core/src/protocol.rs`, `packages/shared/src/protocol.ts`, `.github/workflows/release.yml`.
