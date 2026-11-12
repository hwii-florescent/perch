//! `perch://open?place=<files|changes|browser|chat|settings>[&session=<id>]`: the link the native
//! client's "Open in Perch" hands to the system. macOS delivers it here (the scheme is declared
//! in `Info.plist`), the main window is brought forward, and the page is told which place to
//! show with a `perch:open` event (`packages/web/src/openRequest.ts` acts on it).
//!
//! The link names a place and a session id and nothing else. It is checked here and again in the
//! page, and it only ever navigates: nothing is created, run or sent.
//!
//! A link that launches the app arrives before the page has loaded, when an event would reach no
//! one. The latest valid link is kept in [`Handoff`] until the page, once its listener is in
//! place, claims it with `open_ready`; from then on links are delivered as events. A page load
//! resets this, so a reload claims again and a link is never delivered to a page that is not
//! listening. A claimed link is gone: it is delivered once.

use std::sync::Mutex;

#[cfg(any(target_os = "macos", test))]
const OPEN_EVENT: &str = "perch:open";
#[cfg(any(target_os = "macos", test))]
const PLACES: [&str; 5] = ["files", "changes", "browser", "chat", "settings"];

#[cfg_attr(not(any(target_os = "macos", test)), allow(dead_code))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OpenRequest {
    place: &'static str,
    session: Option<String>,
}

impl OpenRequest {
    /// What the page receives: the `detail` of `perch:open`, and what `open_ready` returns.
    fn detail(&self) -> serde_json::Value {
        serde_json::json!({ "place": self.place, "session": self.session })
    }
}

/// Where a link goes: to the page when it is listening, otherwise held for it.
#[derive(Default)]
pub struct Handoff(Mutex<HandoffState>);

#[derive(Default)]
struct HandoffState {
    /// The page has claimed and is listening for events.
    listening: bool,
    /// The latest link that arrived while it was not.
    held: Option<OpenRequest>,
}

impl Handoff {
    /// A link arrived: `Some` when the page is listening and should be told now, else it is held
    /// (replacing an older held link) for the page to claim.
    #[cfg_attr(not(any(target_os = "macos", test)), allow(dead_code))]
    fn arrive(&self, request: OpenRequest) -> Option<OpenRequest> {
        let mut state = self.0.lock().unwrap();
        if state.listening {
            return Some(request);
        }
        state.held = Some(request);
        None
    }

    /// The page is listening: from now on links are delivered; the held one, if any, is returned
    /// and forgotten.
    fn claim(&self) -> Option<OpenRequest> {
        let mut state = self.0.lock().unwrap();
        state.listening = true;
        state.held.take()
    }

    /// The page is loading, or gone: it is not listening.
    pub fn reset(&self) {
        self.0.lock().unwrap().listening = false;
    }
}

/// The page's listener is in place: hand over the link that launched the app, if one is waiting.
#[tauri::command]
pub fn open_ready(handoff: tauri::State<'_, Handoff>) -> Option<serde_json::Value> {
    handoff.claim().map(|request| request.detail())
}

/// What a session id may be made of: a UUID, or a host-qualified one.
#[cfg(any(target_os = "macos", test))]
fn is_session_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b':'))
}

/// The request in `url`, or `None` for anything that is not exactly an open link: another
/// scheme or host, an unknown place or option, a repeated option, an id with other characters.
/// Values are taken as written (no percent-decoding), so nothing is smuggled in by encoding.
#[cfg(any(target_os = "macos", test))]
fn parse(url: &str) -> Option<OpenRequest> {
    let query = url.strip_prefix("perch://open?")?;
    let (mut place, mut session) = (None, None);
    for pair in query.split('&') {
        let (key, value) = pair.split_once('=')?;
        match key {
            "place" if place.is_none() => place = PLACES.iter().find(|p| **p == value),
            "session" if session.is_none() && is_session_id(value) => session = Some(value),
            _ => return None,
        }
    }
    Some(OpenRequest {
        place: place?,
        session: session.map(str::to_string),
    })
}

#[cfg(any(target_os = "macos", test))]
fn script(request: &OpenRequest) -> String {
    let detail = request.detail();
    format!("window.dispatchEvent(new CustomEvent('{OPEN_EVENT}', {{ detail: {detail} }}))")
}

/// Show the main window on what each valid link asks for. Links that are not ours are ignored.
#[cfg(target_os = "macos")]
pub fn open(app: &tauri::AppHandle, urls: &[tauri::Url]) {
    use tauri::Manager;
    let Some(request) = urls.iter().find_map(|url| parse(url.as_str())) else {
        return;
    };
    let ui = app.clone();
    let _ = app.run_on_main_thread(move || {
        let handoff = ui.state::<Handoff>();
        let Some(window) = ui.get_webview_window("main") else {
            // No page to tell: keep it for the one that opens.
            handoff.reset();
            handoff.arrive(request);
            return;
        };
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        if let Some(request) = handoff.arrive(request) {
            let _ = window.eval(script(&request));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn link(place: &'static str) -> OpenRequest {
        request(place, Some("s1")).unwrap()
    }

    #[test]
    fn a_link_before_the_page_listens_is_held_and_claimed_once() {
        let handoff = Handoff::default();
        assert_eq!(
            handoff.arrive(link("files")),
            None,
            "nobody is listening yet"
        );
        // The latest link wins.
        assert_eq!(handoff.arrive(link("chat")), None);
        assert_eq!(handoff.claim(), Some(link("chat")));
        assert_eq!(handoff.claim(), None, "delivered once");
    }

    #[test]
    fn once_the_page_listens_links_are_delivered_not_held() {
        let handoff = Handoff::default();
        handoff.claim();
        assert_eq!(handoff.arrive(link("files")), Some(link("files")));
        assert_eq!(handoff.claim(), None, "nothing was kept back");
    }

    #[test]
    fn a_page_load_stops_delivery_until_it_claims_again() {
        let handoff = Handoff::default();
        handoff.claim();
        handoff.reset();
        assert_eq!(handoff.arrive(link("changes")), None);
        assert_eq!(handoff.claim(), Some(link("changes")));
    }

    #[test]
    fn the_claim_is_what_the_page_reads() {
        let detail = link("browser").detail();
        assert_eq!(
            detail,
            serde_json::json!({"place": "browser", "session": "s1"})
        );
    }

    fn request(place: &'static str, session: Option<&str>) -> Option<OpenRequest> {
        Some(OpenRequest {
            place,
            session: session.map(str::to_string),
        })
    }

    #[test]
    fn a_place_and_a_session_are_read() {
        assert_eq!(
            parse("perch://open?place=browser"),
            request("browser", None)
        );
        assert_eq!(
            parse("perch://open?place=files&session=host:3f2a-b.9_x"),
            request("files", Some("host:3f2a-b.9_x"))
        );
        // Order does not matter.
        assert_eq!(
            parse("perch://open?session=s1&place=settings"),
            request("settings", Some("s1"))
        );
        for place in PLACES {
            assert!(parse(&format!("perch://open?place={place}")).is_some());
        }
    }

    #[test]
    fn anything_else_is_refused() {
        for url in [
            "perch://open",
            "perch://open?",
            "perch://open?place=",
            "perch://open?place=terminal",
            "perch://open?place=Files",
            "perch://open?session=s1",
            "perch://open?place=files&place=chat",
            "perch://open?place=files&session=s1&session=s2",
            "perch://open?place=files&run=ls",
            "perch://open?place=files&session=",
            "perch://open?place=files&session=a%2Fb",
            "perch://open?place=files&session=a b",
            "perch://open?place=files&session=../x",
            "perch://open?place=files&session=a#b",
            "perch://open?place=files&&session=s1",
            "perch://open/?place=files",
            "perch://elsewhere?place=files",
            "https://open?place=files",
            "file:///etc/passwd",
        ] {
            assert_eq!(parse(url), None, "{url}");
        }
        let long = format!("perch://open?place=files&session={}", "x".repeat(129));
        assert_eq!(parse(&long), None);
    }

    #[test]
    fn the_page_is_told_with_quoted_values() {
        let script = script(&request("chat", Some("s-1")).unwrap());
        assert_eq!(
            script,
            r#"window.dispatchEvent(new CustomEvent('perch:open', { detail: {"place":"chat","session":"s-1"} }))"#
        );
        let none = super::script(&request("settings", None).unwrap());
        assert!(
            none.contains(r#"{"place":"settings","session":null}"#),
            "{none}"
        );
    }
}
