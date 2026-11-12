//! "Open in Perch": hand what this client cannot do yet (files, changes, the browser, chat,
//! settings) to the Perch desktop app, on the session being looked at.
//!
//! The desktop app is not reachable through any core: its own core keeps its credential in
//! memory, and this client usually follows another core. What the system does reach is the app
//! itself, by the `perch://` scheme it registers. Opening `perch://open?place=files&session=<id>`
//! brings the running app forward (macOS starts it if it is not running) and the app shows that
//! place (`crates/perch-desktop/src/open_url.rs` receives it, `packages/web/src/openRequest.ts`
//! acts on it). The link names a place and a session id and nothing else: no credential, no path,
//! nothing to run.
//!
//! Only a click calls [`open_in_perch`]; nothing here runs on its own.

use std::io;
use std::process::Command;

/// Where in Perch to open.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Place {
    Files,
    Changes,
    Browser,
    Chat,
    Settings,
}

impl Place {
    fn name(self) -> &'static str {
        match self {
            Place::Files => "files",
            Place::Changes => "changes",
            Place::Browser => "browser",
            Place::Chat => "chat",
            Place::Settings => "settings",
        }
    }
}

/// What a session id may be made of, on both sides of the link: a UUID, or a host-qualified one.
fn is_session_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b':'))
}

/// The link that opens `place` in Perch, on `session_id` when the place belongs to one. An id
/// the receiving side would refuse is left out rather than sent.
pub fn perch_url(session_id: Option<&str>, place: Place) -> String {
    let mut url = format!("perch://open?place={}", place.name());
    if let Some(id) = session_id.filter(|id| is_session_id(id)) {
        url.push_str("&session=");
        url.push_str(id);
    }
    url
}

/// Hand `url` to the system. Call it only from a click: it brings another app forward.
pub fn open_in_perch(url: &str) -> io::Result<()> {
    if !is_perch_link(url) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "only a Perch link can be opened",
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

/// Only a link this module makes is opened, never a file or an option for the opener.
fn is_perch_link(url: &str) -> bool {
    url.starts_with("perch://open?place=")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn links_name_the_place_and_the_session() {
        assert_eq!(
            perch_url(None, Place::Browser),
            "perch://open?place=browser"
        );
        assert_eq!(
            perch_url(Some("host:3f2a-b.9_x"), Place::Files),
            "perch://open?place=files&session=host:3f2a-b.9_x"
        );
        assert_eq!(
            perch_url(Some("3f2a"), Place::Settings),
            "perch://open?place=settings&session=3f2a"
        );
        for (place, name) in [
            (Place::Changes, "changes"),
            (Place::Chat, "chat"),
            (Place::Files, "files"),
        ] {
            assert!(perch_url(None, place).ends_with(name));
        }
    }

    #[test]
    fn an_id_the_app_would_refuse_is_never_sent() {
        for id in [
            "a&place=settings",
            "a#b",
            "a b",
            "../x",
            "",
            &"x".repeat(129),
        ] {
            assert_eq!(
                perch_url(Some(id), Place::Chat),
                "perch://open?place=chat",
                "{id:?}"
            );
        }
    }

    #[test]
    fn only_a_perch_link_opens() {
        assert!(is_perch_link(&perch_url(Some("s1"), Place::Files)));
        assert!(!is_perch_link("http://127.0.0.1:7788/"));
        assert!(!is_perch_link("file:///etc/passwd"));
        assert!(!is_perch_link("-a Calculator"));
        // Refused before anything is launched.
        assert_eq!(
            open_in_perch("file:///etc/passwd").unwrap_err().kind(),
            io::ErrorKind::InvalidInput
        );
    }
}
