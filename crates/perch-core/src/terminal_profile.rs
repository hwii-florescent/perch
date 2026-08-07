//! Single entry point for "what does the user's real terminal look like".
//!
//! Tries each supported terminal in turn and ships the first usable profile;
//! callers (the `server.info` payload) don't need to know which terminal
//! produced it. Same best-effort contract as the per-terminal modules: no
//! supported terminal installed, or nothing parseable, yields `None`, and the
//! client falls back to xterm.js's own stock defaults — never to perch's UI
//! theme.

use crate::ghostty_profile;
use crate::iterm_profile::{self, TerminalProfile};

/// Try iTerm2 first (it was the original target and is still the most
/// common on macOS dev machines), then Ghostty. Returns the first non-empty
/// result; a terminal that's installed but has nothing recognisable in its
/// config is treated the same as "not installed" and we move on to the next.
pub fn load() -> Option<TerminalProfile> {
    if let Some(profile) = iterm_profile::load() {
        if !profile.is_empty() {
            return Some(profile);
        }
    }
    if let Some(profile) = ghostty_profile::load() {
        if !profile.is_empty() {
            return Some(profile);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Reading the real machine's terminal profile must never panic or hang.
    /// `None` is a legitimate outcome on a box with neither terminal.
    #[test]
    fn loading_is_safe() {
        let _ = load();
    }
}
