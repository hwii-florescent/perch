//! "Open in Perch": hand what this client cannot do yet (files, changes, the browser, chat,
//! settings) to the existing desktop app or web UI, which the core serves at its base URL.
//!
//! The place travels in the URL fragment, which no server ever sees. The web UI does not read
//! it yet, so today the link opens the app where it was left. Nothing secret goes in the link:
//! the web UI signs in with its own credential.

use std::io;
use std::process::Command;

/// Where in Perch to open.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Place {
    Files,
    Changes,
    Browser,
    Chat,
    /// A Settings page by name, for example `general` or `agents`.
    Settings(&'static str),
}

impl Place {
    fn name(self) -> String {
        match self {
            Place::Files => "files".into(),
            Place::Changes => "changes".into(),
            Place::Browser => "browser".into(),
            Place::Chat => "chat".into(),
            Place::Settings(page) => format!("settings/{page}"),
        }
    }
}

/// `base_url` is [`Core::base_url`](crate::client::Core::base_url); `session_id` the session
/// the place belongs to, when it belongs to one.
pub fn perch_url(base_url: &str, session_id: Option<&str>, place: Place) -> String {
    let mut url = format!("{base_url}#open={}", place.name());
    if let Some(id) = session_id {
        url.push_str("&session=");
        for byte in id.bytes() {
            match byte {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b':' => {
                    url.push(byte as char)
                }
                _ => url.push_str(&format!("%{byte:02X}")),
            }
        }
    }
    url
}

/// Hand `url` to the system. Call it only from a click: it brings another app forward.
pub fn open_in_perch(url: &str) -> io::Result<()> {
    if !is_core_address(url) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "only a core address can be opened",
        ));
    }
    let opener = if cfg!(target_os = "macos") {
        "open"
    } else {
        "xdg-open"
    };
    let status = Command::new(opener).arg(url).status()?;
    status
        .success()
        .then_some(())
        .ok_or_else(|| io::Error::other(format!("{opener} failed: {status}")))
}

/// Only a core address is opened, never a file or an option for the opener.
fn is_core_address(url: &str) -> bool {
    url.starts_with("http://")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn urls_name_the_place_in_the_fragment() {
        let base = "http://127.0.0.1:7788/";
        assert_eq!(
            perch_url(base, None, Place::Browser),
            "http://127.0.0.1:7788/#open=browser"
        );
        assert_eq!(
            perch_url(base, Some("host:3f2a-b"), Place::Files),
            "http://127.0.0.1:7788/#open=files&session=host:3f2a-b"
        );
        assert_eq!(
            perch_url(base, None, Place::Settings("agents")),
            "http://127.0.0.1:7788/#open=settings/agents"
        );
        // An id is data, never more URL.
        assert_eq!(
            perch_url(base, Some("a&b#c d"), Place::Chat),
            "http://127.0.0.1:7788/#open=chat&session=a%26b%23c%20d"
        );
    }

    #[test]
    fn only_a_core_address_opens() {
        assert!(is_core_address("http://127.0.0.1:7788/#open=files"));
        assert!(!is_core_address("file:///etc/passwd"));
        assert!(!is_core_address("-a Calculator"));
    }
}
