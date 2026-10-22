# macOS permission setup

The macOS desktop app offers optional setup after the welcome screen, and the
same controls under Settings → Permissions. The setup's Not now / Continue
footer stays visible while the permission rows scroll. Either action (or Escape) remembers only
that setup was dismissed, in the core's settings file; it never records an OS
grant. Browsers, paired phones, Linux and headless clients get no native controls.

## What Allow does

- Full Disk Access opens System Settings. macOS has no public request API for it;
  add the current perch app with + if it is not listed, and enable it there.
- Screen Recording and Accessibility explicitly request their native permission,
  then open the relevant settings pane.
- Automation explicitly requests Apple Events consent for **each named target**,
  then opens Automation settings. Allow may start that target in the background
  so macOS can register the request. Installed Safari/Chrome and System Events
  have separate rows. Other targets can still request their own consent later.

A click never changes a tick optimistically. Refresh/returning to the app runs
non-prompting checks. Ticks mean granted; crosses mean not granted (including
consent not requested); question marks mean the API could not determine access,
for example when an Automation target is not running. The Full Disk Access
check only opens/closes the system TCC.db and, when the account's real home can
be resolved through macOS (not the shell's HOME), the user's TCC.db read-only;
it does not read their content. The per-user database does not exist on every
Mac, so its absence must not hide a successful system probe. Any successful
open means granted; a permission denial without a successful open means not
granted; only missing files or unrelated errors means unable to verify.
This is a heuristic because macOS has no public Full Disk Access status API.

These controls enable OS access for tools the user chooses to run. They do not
implement computer-use tooling, bypass agent approvals, give root access, or
remove third-party tools' own identities and sandboxes. Normal embedded browser
tabs do not need these grants. Purpose strings and the Apple Events hardened
runtime entitlement are bundled; those declarations do not grant consent.

## Verify the process chain, not just the window

The runtime launches perchd as the app binary re-run through a per-user
launchd job. Permission inheritance is **not assumed**.

Verify terminals creates a uniquely named, short shell PTY through the same
daemon client as real terminals. That shell execs the app's
`__perchd permissions` diagnostic, which only performs preflight checks.
The report compares the app's checks with the fresh PTY child's checks and
includes a separate host-process snapshot when the running daemon supports it.
Matching denials are a match, **not** a successful permission grant. Unknown
checks cannot produce a verified match. Results are observations at check time,
not a promise about every executable a shell can launch.

The probe has a deadline and cleans up its own process and daemon history on
success/failure/timeout. Existing terminal input, leases, processes and saved
sessions are untouched. Opening Settings alone never starts perchd. The additive
health field is ignored by older daemons; their unavailable checks stay unknown,
without automatically restarting them.

Screen Recording may be cached in a long-lived process. A fresh child can differ
from an older app/host. Any required host restart must be user-coordinated because
it ends its sessions; this feature never resets TCC or restarts processes for you.

## Ad-hoc builds

No paid certificate is required. Signing stays `-`, but a rebuild can change
the identity macOS compares with saved grants. System Settings may still show an
enabled entry while the measured check fails. Toggle it off/on or remove and add
the current app again. An already-running daemon may still use an older build.
We cannot promise permanent, one-time consent across ad-hoc replacements.

## Validation

Runnable checks:

```sh
cargo test -p perchd
cargo test -p perch-core permissions
cargo test -p perch-core keybinding_tests
npm run test -w @perch/web -- src/components/MacPermissions.test.tsx src/components/MacPermissionsWeb.test.tsx
npm run build
cargo test -p perch-desktop
cargo fmt --check
cargo clippy --workspace --all-targets
```

Manual macOS acceptance (only with the tester's consent; don't reset real TCC
state automatically): use an isolated app/core/daemon/settings directory, confirm
first-run skip and revisit, exercise each Allow flow, decline and grant, return
to the app and verify actual terminal checks, revoke and refresh, then replace
the ad-hoc bundle with a daemon still running. Confirm mismatch/unknown remains
honest and existing sessions are not restarted. Screen/Accessibility/Automation
grants and privacy prompts themselves require real OS consent; browser mocks
are not evidence those grants reach a production installation.
