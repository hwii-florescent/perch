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
- **jean-parity backlog** (earlier menu, untouched): @-file mentions, AI commit
  messages / PR descriptions, MCP support, GitHub #-issue mentions, worktree
  auto-cleanup.
