//! The core's own local UI credential: what replaced "a loopback caller needs nothing".
//! Own design (slice 3a; DECISIONS 2026-11-06 "Local authority").
//!
//! Every request to the core presents a paired device's token, this local UI token, or (only on
//! `/agent/*`) an agent's token (`server::authorize_request`). The local token is accepted only
//! from this machine, with no proxy header and a loopback `Host`, so it opens nothing for a
//! phone, a relay guest or a page on another origin even if it leaked.
//!
//! Two ways to hold it, by how the core is run:
//!
//! * [`LocalUi::in_process`] (the desktop app): minted in memory and never written to a file or
//!   an environment variable. The app's own webview gets it through a one-use sign-in code
//!   ([`LocalUi::issue_login_code`], `GET {base}local-login`), which sets an `HttpOnly` cookie.
//! * [`LocalUi::standalone`] (headless `perch-core`, development, the e2e harness): minted, or
//!   chosen by the launcher in `PERCH_LOCAL_TOKEN` (a test and launcher hook: checked, read once,
//!   removed from this process's environment and scrubbed from every child). The token is
//!   written to the 0600 `core.json` so a person or a harness can open the UI. Same-user
//!   processes can read that file: this is not a boundary against an unsandboxed agent that goes
//!   looking in the user's files.
//!
//! The token is never logged or printed. The sign-in code is single-use and short-lived, so it
//! is the only secret a terminal ever shows.
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// The launcher's choice of token for a standalone core.
pub const TOKEN_ENV: &str = "PERCH_LOCAL_TOKEN";
/// How long a sign-in code stays valid after it is issued.
pub const LOGIN_CODE_TTL: Duration = Duration::from_secs(10 * 60);
const MIN_LAUNCHER_TOKEN_CHARS: usize = 32;
const MAX_LAUNCHER_TOKEN_CHARS: usize = 256;

pub struct LocalUi {
    token: String,
    publish_token: bool,
    login: Mutex<Option<(String, Instant)>>,
}

impl LocalUi {
    /// The desktop app: a random token that stays in memory.
    pub fn in_process() -> Arc<Self> {
        Arc::new(Self::new(random_hex(), false))
    }

    /// A headless or development core. Reads and removes `PERCH_LOCAL_TOKEN`; call it before
    /// anything is spawned so no child inherits the variable.
    pub fn standalone() -> Arc<Self> {
        let chosen = std::env::var(TOKEN_ENV).ok();
        if chosen.is_some() {
            std::env::remove_var(TOKEN_ENV);
        }
        Arc::new(Self::new(token_from_launcher(chosen), true))
    }

    fn new(token: String, publish_token: bool) -> Self {
        Self {
            token,
            publish_token,
            login: Mutex::new(None),
        }
    }

    /// Whether `candidate` is this core's local token. Compared without stopping at the first
    /// differing byte.
    pub fn matches(&self, candidate: &str) -> bool {
        let (a, b) = (self.token.as_bytes(), candidate.as_bytes());
        a.len() == b.len() && a.iter().zip(b).fold(0u8, |diff, (x, y)| diff | (x ^ y)) == 0
    }

    /// The token itself, for the 0600 discovery file of a standalone core only.
    pub fn token_for_core_file(&self) -> Option<&str> {
        self.publish_token.then_some(self.token.as_str())
    }

    /// The token for an in-process cookie (`GET local-login`) and for tests.
    pub(crate) fn token(&self) -> &str {
        &self.token
    }

    /// A new one-use sign-in code, replacing any unused one.
    pub fn issue_login_code(&self) -> String {
        let code = random_hex();
        *self.login.lock().unwrap() = Some((code.clone(), Instant::now()));
        code
    }

    /// Spend a sign-in code: true once, and only before it expires.
    pub fn redeem_login_code(&self, code: &str) -> bool {
        self.redeem_login_code_at(code, Instant::now())
    }

    fn redeem_login_code_at(&self, code: &str, now: Instant) -> bool {
        let mut login = self.login.lock().unwrap();
        let Some((issued, at)) = login.as_ref() else {
            return false;
        };
        if now.saturating_duration_since(*at) > LOGIN_CODE_TTL {
            *login = None;
            return false;
        }
        let same = issued.len() == code.len()
            && issued
                .bytes()
                .zip(code.bytes())
                .fold(0u8, |diff, (x, y)| diff | (x ^ y))
                == 0;
        // A wrong guess leaves the code alone, so a stranger cannot burn it.
        if same {
            *login = None;
        }
        same
    }
}

/// The launcher's token when it is acceptable, else a random one.
fn token_from_launcher(chosen: Option<String>) -> String {
    match chosen {
        Some(value) if valid_launcher_token(&value) => value,
        Some(_) => {
            tracing::warn!(
                "{TOKEN_ENV} was ignored: it must be 32 to 256 letters, digits, `-` or `_`"
            );
            random_hex()
        }
        None => random_hex(),
    }
}

/// A launcher-chosen token must be long enough to guess nothing, made of cookie-safe
/// characters, and must not pass for an agent's (those open only `/agent/*`).
pub fn valid_launcher_token(value: &str) -> bool {
    (MIN_LAUNCHER_TOKEN_CHARS..=MAX_LAUNCHER_TOKEN_CHARS).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
        && !crate::agent_identity::looks_like_agent_token(value)
}

/// 32 random bytes from the operating system's generator (two version-4 UUIDs, as
/// `agent_identity::mint_token` and `devices.rs` do), in hex.
fn random_hex() -> String {
    uuid::Uuid::new_v4()
        .as_bytes()
        .iter()
        .chain(uuid::Uuid::new_v4().as_bytes())
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_token_matches_only_itself() {
        let ui = LocalUi::in_process();
        let token = ui.token().to_string();
        assert_eq!(token.len(), 64);
        assert!(ui.matches(&token));
        assert!(!ui.matches(""));
        assert!(!ui.matches(&token[..63]));
        assert!(!ui.matches(&format!("{token}0")));
        let mut other = token.clone();
        other.replace_range(..1, if token.starts_with('a') { "b" } else { "a" });
        assert!(!ui.matches(&other));
        assert!(!ui.matches(&LocalUi::in_process().token));
    }

    #[test]
    fn only_a_standalone_core_publishes_its_token() {
        assert!(LocalUi::in_process().token_for_core_file().is_none());
        let standalone = LocalUi::new(random_hex(), true);
        assert_eq!(standalone.token_for_core_file(), Some(standalone.token()));
    }

    #[test]
    fn a_sign_in_code_works_once() {
        let ui = LocalUi::in_process();
        assert!(!ui.redeem_login_code("anything"), "none issued yet");
        let code = ui.issue_login_code();
        assert!(!ui.redeem_login_code("wrong"));
        assert!(ui.redeem_login_code(&code));
        assert!(!ui.redeem_login_code(&code), "a spent code is gone");
        // A new code replaces an unused one.
        let first = ui.issue_login_code();
        let second = ui.issue_login_code();
        assert!(!ui.redeem_login_code(&first));
        assert!(ui.redeem_login_code(&second));
    }

    #[test]
    fn a_sign_in_code_expires() {
        let ui = LocalUi::in_process();
        let code = ui.issue_login_code();
        let issued = Instant::now();
        assert!(!ui.redeem_login_code_at(&code, issued + LOGIN_CODE_TTL + Duration::from_secs(1)));
        assert!(
            !ui.redeem_login_code_at(&code, issued),
            "an expired code is dropped, not kept for later"
        );
    }

    #[test]
    fn the_launcher_may_choose_the_token_but_not_a_weak_one() {
        let chosen = "e2e_".repeat(10);
        assert_eq!(token_from_launcher(Some(chosen.clone())), chosen);
        let random = token_from_launcher(None);
        assert_eq!(random.len(), 64);
        let weak = token_from_launcher(Some("short".into()));
        assert_ne!(weak, "short");
        assert_eq!(weak.len(), 64);
    }

    #[test]
    fn a_launcher_token_is_checked() {
        assert!(valid_launcher_token(&"a1_-".repeat(8)));
        assert!(!valid_launcher_token(&"a".repeat(31)));
        assert!(!valid_launcher_token(&"a".repeat(257)));
        assert!(!valid_launcher_token(&format!("{};", "a".repeat(40))));
        assert!(!valid_launcher_token(&format!("{} ", "a".repeat(40))));
        assert!(!valid_launcher_token(&format!(
            "{}{}",
            crate::agent_identity::TOKEN_PREFIX,
            "a".repeat(40)
        )));
    }
}
