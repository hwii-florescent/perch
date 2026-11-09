# Cloneable stock UI — Claude Code / ak-cook handoff

## Mission and current status

The user explicitly requested dispatch of the cloneable-stock-UI plan to a **Perch subsession running Claude Code with model `sonnet-5-5`, in its own worktree**, using `/ak-cook`. This is one plan with five sequential phases, not five independent plans. The user now authorizes delegated execution of the plan; retain its outstanding independent-review gate before implementation. Do not substitute models or runtimes. Do not launch other Perch subsessions.

## Scope and guardrails

- Original repository: `/Users/hwiii/Github/perch`; original branch: `main`. Your assigned Perch worktree is your only implementation checkout. Verify it differs from the original repository path before writing source.
- Timezone: `America/New_York`. Language: English. Locale: `en_US.UTF-8`. Set TZ/LANG appropriately for commands where relevant.
- Read `/Users/hwiii/.claude/rules/development-rules.md` and the worktree's AGENTS.md. Use KISS/DRY; retain the full requested scope. No `--yagni` was requested.
- Markdown authored in the worktree belongs under its `plans/` or `docs/`. The user explicitly requested the isolated worktree. Treat the original absolute source inventory paths in the plan as repository-relative paths mapped into your worktree; never edit those original main-checkout paths.
- Preserve all baseline sidebar/native-chat work. No checkout/reset to erase it, no automatic commit/push/merge/release, no product database changes without backup.
- Runtime probes must follow docs/TESTING.md: headless and isolated, never the installed app's daemon. Only approved cheap models for real-agent **tests**, with banner verification. Your requested implementation-session model is sonnet-5-5; report an unavailable model instead of substituting.

## Current state

Base commit: `8a02934e9b3b7743f6377cb41ce6dedfd1cb1807`. The main checkout contains intentional tracked/untracked native-chat, provider and sidebar changes plus the untracked plan.

A frozen input snapshot is at:
`/Users/hwiii/Github/perch/plans/reports/dispatch-261108-2306-cloneable-stock-ui/`

- `baseline-manifest.json`: base commit and SHA-256/size for 48 input files.
- `baseline-files/`: those files at repository-relative paths, including all scoped tracked changes, untracked source files, nine plan documents and the planning journal.

A new worktree from HEAD does **not** contain this baseline. Copy only the manifest-listed files from baseline-files into your worktree, preserving relative paths, before reviewing or implementing. Confirm the checkout starts at the manifest base commit. Before replacing any existing different bytes, inspect whether they are already Perch-carried main-baseline files; preserve/report any unexpected modifications rather than overwriting them. Verify all 48 destination digests after applying the snapshot. Never copy .git or an installed runtime's data. Use the frozen snapshot, not changing live files in the main checkout.

## Decisions and rationale

Confirmed: full Herdr customization parity, not unrelated product/runtime parity; plain JavaScript/CSS without a user compiler/build; independent copies never overwritten/automatically merged; desktop/browser/paired phone.

Keep React/Tauri and Rust/domain authority. Export actual TSX presentation graphs as readable release-generated ESM plus CSS/assets. Stock and clones execute the same source/runtime, not opaque wrappers. Shared React/stores/commands/engines remain single owners. Proposed maintained loader is es-module-shims, subject to Phase 1 singleton/CSP/relay proof. Source revisions cover coherent bounded package snapshots. Trusted mods remain full-access; do not invent a sandbox/approval redesign.

## Work performed

Nine plan documents authored and parent-checked. Two read-only research audits completed. Parent review corrected Phase 1 test sequencing, two-way format negotiation, hidden-instance ownership/source callers, complete resource queries, and competing React reload effects. All plan implementation checklists remain unchecked.

The first snapshot command was blocked before execution by a privacy guard matching exclusion-pattern strings. It was replaced with a source-extension allowlist; no credential file was needed or read. The resulting frozen source snapshot contains 48 files / 1,022,659 bytes.

## Verification

Plan schema validation passed. Parsing found five phases and 25 unchecked implementation tasks. Static checks passed for 22 local links, 76 source-inventory paths and concrete test/config paths, accounting for declared new files. Matrix: S01–S24 and C01–C20, all pending runtime proof. Planning journal validation passed.

No application implementation, installs, application tests, paid agent tests, runtime probes, commits or pushes were performed by the planning agent. Path existence is not test/build/discovery success.

## Open risks and blockers

**Independent review is unpassed.** Three prior reviewer children failed before findings with a provider Subscription Sharing usage-limit error. Their failure is not approval. The parent-led findings in validation.md are not an independent pass.

As a fresh Claude Code delegate, complete the required independent evidence-backed plan review using the available native review facilities before implementation; cite current source paths/lines, record dispositions and correct material findings. Do not assume Perch sub-subsession support. If the required review cannot be completed, report the blocker rather than bypassing it. Loader feasibility and ownership remain Phase 1 stop gates; do not cut phone/import/deep-edit scope to obtain a passing demo.

## Exact next actions

1. **First safe step**: verify your actual cwd, Git base and requested model. If not an isolated worktree or not sonnet-5-5, stop and report. Read the manifest and this handoff, overlay/verify its 48 frozen baseline files as described above, and preserve unexpected differences.
2. Read the copied `plans/261108-2212-cloneable-stock-ui/plan.md`, design.md, parity-matrix.md, validation.md and all five phase documents. Follow plan links in your worktree.
3. Invoke `/ak-cook <YOUR_WORKTREE>/plans/261108-2212-cloneable-stock-ui/plan.md`. If slash invocation is unavailable, locate and read the installed `ak-cook` SKILL.md and follow that workflow explicitly. Do not merely imitate its name.
4. Complete/adjudicate the independent-review gate first, recording evidence. If blocked, report and wait. Otherwise execute phases sequentially, re-scouting each phase and preserving the snapshotted user work. Keep checklists truthful and leave a focused runnable regression for nontrivial changes.
5. Report your actual worktree/branch/model, review outcome, implemented phase/checklist progress, exact checks/results, remaining risks and paths to artifacts through `perch report`. Report blockers immediately; do not claim another model ran if the requested one is unavailable. Stop and wait after your report.

## Source pointers

- Worktree copy of `plans/261108-2212-cloneable-stock-ui/plan.md`: execution index.
- Same directory `design.md`, `parity-matrix.md`, `validation.md`: architectural, parity and review contracts.
- Same directory phase-01-start.md through phase-05-parity-and-rollout.md: sequential implementation and verification.
- Worktree docs/TESTING.md, docs/ARCHITECTURE.md, docs/DECISIONS.md and AGENTS.md: project contracts.
- Frozen snapshot manifest and baseline-files directory beside this handoff: exact continuation inputs.
