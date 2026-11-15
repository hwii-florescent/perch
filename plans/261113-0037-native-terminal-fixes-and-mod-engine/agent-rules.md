# Rules for every agent working on this plan

Read `brief.md` in this folder first (the section "Confirmed by the owner" replaces matching text above it), then
the repository's `AGENTS.md`. The rules below are not negotiable.

## Where you work

- You are given one git worktree and one branch. Edit, build and commit only there. Never edit
  `/Users/hwiii/Github/perch` (the owner's checkout) except the findings file you are told to write.
- `~/Github/perch-refs/herdr-app` is a read-only reference.
- Commit each verified slice locally with a conventional commit (`fix(native): ...`, `feat(native): ...`,
  `test(native): ...`, `chore(vendor): ...`). No AI references, no plan or phase labels in code, test names or
  commits. Never push. Never `git stash`, rebase or reset anything outside your worktree.

## Building and testing

- Build with `ZIG=/opt/homebrew/opt/zig@0.16/bin/zig` in the environment.
- Run `cargo test -p perch-native` on its own, never together with `-p perch-core` (see `docs/TESTING.md`,
  "Native client").
- Tests are headless: GPUI `render_to_image` and the existing harnesses in `crates/perch-native/tests/`. Follow
  their pattern (`harness = false` binaries, `tests/common/mod.rs`).
- Do not weaken or delete a failing test to make a suite pass. Report real failures with their output.

## Isolation and the owner's screen

- Every probe that starts a core, a daemon or the client uses scratch `PERCH_DB`, `PERCH_HOSTS`, `PERCHD_DIR`,
  `PERCH_SETTINGS` and `HOME` under a temp directory. Never the installed app, its daemon, or `~/.perch`.
- No focus stealing: never activate a window, never post key or mouse events to the screen (no `CGEvent` posts,
  no `osascript` activation, no `open -a`). No visible window unless it can never take focus; prefer none.
- No paid agent turns. Use mock sessions or plain shells.
- Stop every process you start and check by PID that it is gone. No broad `pkill`.
- A PATH inside a Perch terminal starts with a Perch shim. For any probe that launches a core or the client, strip
  `perch-native-*.shell/bin` from `PATH` and unset `PERCH_SESSION`, `PERCH_SHELL`, `PERCH_TOKEN`,
  `PERCH_USER_ZDOTDIR`, `TERM_PROGRAM`.

## Scope

- Out of scope: settings, files, Git, chat and other stock screens; any web view; packaging; the phone and web UIs
  (web mods must keep working); the protocol; moving the GPUI or Ghostty pin; polishing Rust views that mods will
  replace.
- An unrelated bug you find goes into your final message under "Unrelated findings". Do not fix it.
- Do not spawn further agents for code changes. Keep to the files your task names; if you must touch another
  file, say so in your final message.

## Stop and report instead of continuing when

- the mod engine would need a `gpui-pre` change that is not one of herdr's existing patches at 0.3.8;
- a check cannot be done without a focused window or real key presses;
- a destructive or irreversible action would be needed.

## Your final message

What you changed (files and commits), the command lines you ran with their real results, what is not done and
why, then:

```text
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: one or two sentences
Concerns/Blockers: optional
```
