# Plan: native GPUI client with Ghostty terminals

Status: done with concerns (2026-11-12); see `../reports/atoz-261112-0821-native-gpui-ghostty-terminal.md`. Contract: `brief.md` plus the decisions below, confirmed by the owner.

## Locked decisions (2026-11-12 interview)

1. GPUI from `gpui-pre` on crates.io, pinned exactly; copy a crate in only when a patch is proven necessary.
2. Bytes only. The native client runs its own libghostty-vt per terminal. No new protocol family.
3. Daily set: sidebar (projects, sessions), tabs, splits, agent launch, attention states, terminal settings,
   remote hosts, command palette, the user's keybindings.
4. Editor: feasibility spike only. Everything else stays in the React/Tauri app, unchanged.
5. Native replaces Tauri on macOS once at parity; the roadmap lists what is still Tauri-only.
6. Zig is required to build `perchd` and `perch-core`; `vt100` is removed. Only the GPUI client stays out of
   default builds.
7. Unfinishable parity items become proposed deferrals in the final report (run ends DONE_WITH_CONCERNS).
8. Nothing is lost: the native client hands off to the Tauri app for anything it cannot do yet.

Waived by the owner: GitHub issue, labels and PR (never push). Sub-sessions are Claude Code subagents.

## Result

Everything is on `feat/native-gpui-ghostty` (`c453f0a3`, 100 commits over `60dd2c7`) in `../perch-native-gpui`.
The editor spike is on `spike/native-editor` (`0a5f60e`, not merged). All ten pieces are done: engine swap,
client skeleton, inventories, terminal view, terminal parity, daily client, editor spike, proof, docs, and two
isolated reviews with their fixes. Open items (32 proposed deferrals, no hands-on use yet, estimated Tauri
figures, `npm run build` failing on a file broken at the base) are in the report.

Reference clone: `~/Github/perch-refs/herdr-app` at `4c8c622` (read-only). The pinned Ghostty commit needs
Zig 0.16.x.

## Acceptance

The 12 Done-means items in the confirmed handoff brief (see the final report for evidence per item).
