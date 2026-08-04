# Homebrew cask template for perch.
#
# This file does NOT belong in this repo's install path — it is a template.
# Copy it to a tap repo named `homebrew-<name>` as `Casks/perch.rb`, e.g.
#   github.com/hwii-florescent/homebrew-tap  ->  Casks/perch.rb
# then:  brew tap hwii-florescent/tap && brew install --cask perch
#
# See docs/DISTRIBUTION.md for the blockers (private repo, ad-hoc signature,
# arm64-only) that must be resolved before this actually installs for anyone
# other than you.
cask "perch" do
  version "0.1.0"

  # Regenerate on EVERY release — brew fetches the new artifact and verifies
  # this checksum, so a stale value is a hard install failure:
  #   shasum -a 256 target/release/bundle/dmg/perch_<ver>_aarch64.dmg
  sha256 "5c7f3f15989a5ef1f0e6bd01352702bc0afa3cc0de4324b1ad491e93f2857bef"

  # The tauri bundler names the dmg with the *Cargo* version (0.0.1 today),
  # which is not necessarily the release tag. Keep the two in sync, or
  # interpolate whatever the artifact is actually called.
  url "https://github.com/hwii-florescent/perch/releases/download/v#{version}/perch_0.0.1_aarch64.dmg"
  name "perch"
  desc "Personal agent-babysitting IDE for claude and codex"
  homepage "https://github.com/hwii-florescent/perch"

  # arm64 only — the current bundle is not universal. Drop this once you ship
  # a universal build, otherwise Intel users get a confusing runtime failure
  # instead of a clear "unsupported" message.
  depends_on arch: :arm64
  depends_on macos: ">= :high_sierra" # LSMinimumSystemVersion is 10.13

  app "perch.app"

  # perch drives the user's own CLIs; it does not bundle them. Without these
  # on PATH and authenticated, the app runs but every turn fails.
  caveats <<~EOS
    perch drives your existing `claude` and/or `codex` CLIs — it does not bundle
    them. Install and authenticate at least one before using perch.

    This build is ad-hoc signed, not notarized, so Gatekeeper will block the
    first launch. Clear the quarantine attribute once:

      xattr -dr com.apple.quarantine /Applications/perch.app

    perch stores settings and chat history in ~/.perch. That directory is shared
    with any `cargo run` development instance — do not run both at once.
  EOS

  # `zap` removes everything perch created. Deliberately NOT in `uninstall`:
  # a plain uninstall should not destroy the user's chat history.
  zap trash: [
    "~/.perch",
    "~/Library/Saved Application State/dev.hwii.perch.savedState",
  ]
end
