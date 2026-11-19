//! `perch://open` links: the system hands one to the app (macOS, by the scheme declared in
//! `Info.plist`) and [`Workspace::open_link`] shows the place it names. A link only navigates:
//! nothing is created, run or sent. A link naming a session the core has not listed yet (the
//! window is still starting) waits for it, then is applied once; the latest link replaces an older
//! waiting one.

use super::*;
use crate::handoff::{parse_link, Link};

/// How long a link waits for its session to be listed.
const HOLD: Duration = Duration::from_secs(30);

impl Workspace {
    /// Act on a link handed to the app. Anything that is not a Perch open link is ignored with a
    /// log line.
    pub fn open_link(&mut self, url: &str, window: &mut Window, cx: &mut Context<Self>) {
        let Some(link) = parse_link(url) else {
            eprintln!("perch-native: ignored a link that is not a Perch open link: {url:?}");
            return;
        };
        self.link_wait = None;
        match self.show_link(&link, window, cx) {
            Ok(true) => {}
            Err(error) => eprintln!("perch-native: could not open {url:?}: {error}"),
            // ponytail: polls ten times a second for up to HOLD; a sidebar event could wake it.
            Ok(false) => {
                let url = url.to_string();
                self.link_wait = Some(cx.spawn_in(window, async move |this, cx| {
                    let until = Instant::now() + HOLD;
                    while Instant::now() < until {
                        cx.background_executor()
                            .timer(Duration::from_millis(100))
                            .await;
                        let shown = this
                            .update_in(cx, |this, window, cx| this.show_link(&link, window, cx));
                        match shown {
                            Ok(Ok(false)) => continue,
                            Ok(Err(error)) => {
                                eprintln!("perch-native: could not open {url:?}: {error}")
                            }
                            // The window is gone, or the link was applied.
                            _ => {}
                        }
                        return;
                    }
                    eprintln!("perch-native: dropped {url:?}: the core never listed its session");
                }));
            }
        }
    }

    /// Show the link's place. `Ok(false)`: its session is not listed (yet), nothing was done.
    fn show_link(
        &mut self,
        link: &Link,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Result<bool, String> {
        if link.place == Place::Settings {
            if !self.screens.is_open("settings") {
                self.open_screen("settings", json!({ "page": null }), None, None, cx);
            }
            return Ok(true);
        }
        // Without a session the place is the shown workspace's. The core's list is what says a
        // session exists: a plain shell is in it but not in the sidebar's rows.
        let (workspace, session) = match &link.session {
            Some(id) => {
                let store = &self.sidebar.read(cx).model().store;
                let Some(listed) = store.sessions.iter().find(|s| &s.id == id) else {
                    return Ok(false);
                };
                (listed.workspace_id.clone(), Some(listed.clone()))
            }
            None => (self.shown_workspace(cx), None),
        };
        let opened = session.is_some();
        if let Some(listed) = session {
            if self.show_session(&listed.id, cx).is_err() {
                let provider = listed.current_provider_id.or(listed.cli_provider_id);
                self.sidebar.update(cx, |sidebar, cx| {
                    sidebar.open(listed.host_id, listed.id, provider, cx)
                });
            }
        }
        // Chat is the session itself.
        if link.place == Place::Chat {
            return Ok(true);
        }
        // The session's tab is shown when the sidebar's event is handled, after this call: the
        // place goes on top of it, not under it.
        let place = link.place;
        if opened {
            cx.defer_in(window, move |this, window, cx| {
                if let Err(error) = this.show_place(place, workspace, window, cx) {
                    eprintln!("perch-native: could not open {place:?}: {error}");
                }
            });
            Ok(true)
        } else {
            self.show_place(place, workspace, window, cx).map(|()| true)
        }
    }

    fn show_place(
        &mut self,
        place: Place,
        workspace: Option<String>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Result<(), String> {
        let need = || workspace.clone().ok_or("The link names no workspace.");
        match place {
            Place::Files => self.show_files(&need()?, cx),
            Place::Changes => self.open_review(&need()?, cx),
            // Without a workspace the browser opens in the computer's first.
            Place::Browser => {
                let args = json!({ "workspaceId": workspace });
                if let Some(result) = self.browser_command("browser.open", Some(&args), window, cx)
                {
                    result?;
                }
            }
            Place::Chat | Place::Settings => {}
        }
        Ok(())
    }
}
