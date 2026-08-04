# Distributing perch as a Mac app

Status (2026-08-04): the `.app` and `.dmg` **build and run and serve the real UI**, and
`/Applications/perch.app` is installed and verified. **Homebrew publishing is deliberately not
done yet** — see "Decisions taken". One of the three original blockers (private repo) is now
resolved; the other two are recorded below so they don't have to be re-derived, and neither is
a code problem.

## Decisions taken (2026-08-04)

- **Local install only for now.** No tap, no GitHub release. The cask and this guide are
  written and ready for whenever that changes. (The repo has since gone public, which removes
  the hard blocker — what remains is a deliberate choice, plus notarization.)
- **arm64 only — universal build skipped.** Intel support is the *least* important blocker
  (the other two stop distribution outright, this one only matters if an Intel user exists),
  and it would mean replacing a working `brew install rust` toolchain with rustup. The cask
  already declares `depends_on arch: :arm64`, so an Intel user would get a clean "unsupported"
  message rather than a confusing crash. Revisit when a real Intel user turns up.

## Building the bundle

```sh
npm run build                  # frontendDist points at packages/web/dist — build it FIRST
cargo install tauri-cli --version "^2" --locked   # one-time
cargo tauri build
```

Outputs:

| Artifact | Path | Size |
|---|---|---|
| App bundle | `target/release/bundle/macos/perch.app` | ~14 MB |
| Disk image | `target/release/bundle/dmg/perch_<ver>_aarch64.dmg` | ~5.3 MB |

`cargo tauri build --no-bundle` compiles without packaging, which is the faster loop when
you only want to know that it links.

### The web UI must be bundled as a resource

The desktop window points at the in-process axum server (`WebviewUrl::External`,
`http://127.0.0.1:<port>/`), **not** at the `tauri://` asset protocol. So Tauri's embedded copy
of `frontendDist` is never consulted — axum serves the UI from disk, and the directory has to
physically exist inside the `.app`. `bundle.resources` in `tauri.conf.json` copies
`packages/web/dist` to `Contents/Resources/web-dist`, and `resolve_web_dist_dir()` in `boot.rs`
looks there first.

`frontendDist` still has to be set (Tauri requires it) but its embedded output is dead weight.
Do not delete `bundle.resources` on the assumption that `frontendDist` covers it.

**Verifying this is not optional, and status code will not tell you.** When the directory is
missing, the server falls back to a placeholder page that says "No web client build found" —
and serves it with **HTTP 200**. Assert on the body:

```sh
curl -s http://127.0.0.1:<port>/ | grep -c "No web client build found"   # must be 0
```

### Verified on this machine

- Serves the **real** UI from the bundle: `index.html` is the app shell (not the placeholder),
  and `/assets/index-*.js` returns 200 with the full ~1.09 MB bundle. Checked with the process
  started from `/`, so the CWD fallback could not mask a broken resource path.
- **Survives a Finder/launchd launch.** This was the thing that blocked the bundle for so
  long: a GUI launch inherits launchd's minimal `PATH`, not your shell's, so `claude` and
  `codex` were unreachable. Tested with `env -i PATH=/usr/bin:/bin:/usr/sbin:/sbin`, and
  `boot.rs`'s `adopt_login_shell_path()` recovers both `~/.local/bin` (claude) and
  `/opt/homebrew/bin` (codex). Escape hatch if it ever misbehaves: `PERCH_NO_LOGIN_PATH`.
- `PERCH_DESKTOP_TEST=1` runs the window hidden and unfocused — use it for any automation.

## Blockers before this can be published

### 1. ~~The repo is private~~ — RESOLVED (2026-08-04)

`hwii-florescent/perch` is now **public**. A cask can fetch from it.

What is still missing is a **release**: `gh release list` is empty, so the cask's `url` currently
points at an artifact that does not exist. Cut one (see "Publishing to a personal tap") before
the cask can install.

### 2. The app is ad-hoc signed, not notarized

```
Signature=adhoc
```

That is enough to run locally, but on **any other Mac** Gatekeeper will refuse it, because the
download carries a quarantine attribute. This matters more than it used to:

- Homebrew now audits casks for codesigning + notarization, and **from 2026-09-01 casks that
  fail the Gatekeeper check are removed from the official `homebrew/cask` repo.**
- `--no-quarantine` is being removed from `brew` itself, so the historical workaround of
  telling users to pass that flag is going away.

Options, in order of how much they cost you:

1. **Notarize** — needs an Apple Developer account ($99/yr). Sign with a Developer ID
   certificate, submit with `notarytool`, staple with `stapler`. This is the only path that
   gives a clean double-click install for other people, and the only path to the official
   cask repo.
2. **Personal tap, unsigned** — allowed: Homebrew does not require signing for casks in your
   *own* tap. Users will still hit Gatekeeper on first launch and need to clear it manually:
   ```sh
   xattr -dr com.apple.quarantine /Applications/perch.app
   ```
3. **Skip Homebrew** — ship the `.dmg` on a GitHub Release and let people drag it across.
   Same Gatekeeper caveat, one less moving part.

### 3. arm64 only

```
$ lipo -archs perch.app/Contents/MacOS/perch-desktop
arm64
```

Intel Macs cannot run this build. Deliberately deferred (see "Decisions taken").

If you do want it later: `cargo tauri build --target universal-apple-darwin` needs both Rust
targets, and Rust here is `brew install rust`, which ships **only** `aarch64-apple-darwin`
(confirmed: a test `rustc --target x86_64-apple-darwin` fails with `can't find crate for std`).
That means installing rustup. `brew install rustup` is **keg-only** "because it conflicts with
rust", so it won't clobber anything on install — but to actually use it you must put
`$(brew --prefix rustup)/bin` ahead of `/opt/homebrew/bin` on your PATH, which then shadows
brew's rust. Worth knowing: `boot.rs` adopts the login-shell PATH, so that shadowing would
follow perch's subprocesses around too.

## Publishing to a personal tap

Given the above, a personal tap is the realistic route. The official `homebrew/cask` repo is
not viable here: it requires a public repo, notarization, and a notability bar.

**1. Cut a public release** with the `.dmg` attached:

```sh
gh release create v0.1.0 \
  target/release/bundle/dmg/perch_0.0.1_aarch64.dmg \
  --title "perch v0.1.0" --notes "First packaged build."
```

**2. Create the tap repo.** It must be named `homebrew-<something>`:

```
github.com/hwii-florescent/homebrew-tap
```

**3. Add `Casks/perch.rb`** — see `packaging/homebrew/perch.rb` in this repo for a filled-in
template. Get the checksum with:

```sh
shasum -a 256 target/release/bundle/dmg/perch_0.0.1_aarch64.dmg
```

**4. Install:**

```sh
brew tap hwii-florescent/tap
brew install --cask perch
xattr -dr com.apple.quarantine /Applications/perch.app   # until notarized
```

**Every release** you must bump `version` *and* `sha256` in the cask, or `brew` will fetch the
new artifact and fail the checksum.

## Things that will bite you

- **`~/.perch` is shared with the dev build.** There is no `--settings-path`, so an installed
  `perch.app` and a `cargo run` instance read and write the same `settings.json` and
  `history.sqlite`. Two running copies will fight over settings.
- **The app bundles the web UI at build time.** `Contents/Resources/web-dist` is a snapshot of
  `packages/web/dist`, so the PWA self-update path that the plain web server relies on does
  **not** apply — shipping UI changes means shipping a new build. Corollary: **always run
  `npm run build` before `cargo tauri build`**, or you ship a stale UI with fresh Rust.
- **`claude`/`codex` are not bundled.** perch drives whatever is on the user's PATH, so the app
  is useless on a machine without them, authenticated. Worth saying out loud in release notes.
