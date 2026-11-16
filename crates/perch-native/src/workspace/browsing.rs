//! Browser pages in the window: browser tabs, the drawer's Browser page, the toolbar screen's commands, the core's
//! history and suggestions, the page polls and (macOS) the key monitor. The pages themselves are
//! [`crate::browser::Browsers`], shared with the slots that draw them (`browser::slot`).
//!
//! A browser tab's id is the web's file tab key of kind `browser`: `<workspace id>\n<url>`, or
//! `<workspace id>\nblank:<n>` for one opened empty; the page's key is the tab id. The drawer's page is
//! `drawer\n<id>`. The pages are made the first time one is wanted, with the window's WebKit factory (or, in tests,
//! the pages given to [`Workspace::with_browser_pages`]); none exist, and WebKit never starts, until then.

use super::*;
use crate::browser::address::{browser_address, HistoryEntry};
use crate::browser::slot::{self, Look, Shared};
use crate::browser::{drawer_key, Action, Browsers, KeyResult, PageEvent};

/// The window's side of its browser pages.
#[derive(Default)]
pub(super) struct Browsing {
    pages: Option<Shared>,
    /// Pages given before the window had any (tests: no WebKit headless).
    given: Option<Browsers>,
    /// Where the pages are kept between launches.
    file: Option<std::path::PathBuf>,
    /// What the key monitor resolves a press with: the window's keymap, leader and resize state, as of the last draw.
    keys: Rc<RefCell<Option<(Keymap, bool, bool)>>>,
    #[cfg(target_os = "macos")]
    monitor: Option<crate::browser::keys::Monitor>,
    /// The event pump, the poll and the key pump.
    tasks: Vec<Task<()>>,
    /// The suggestion request waiting out its pause.
    suggest: Option<Task<()>>,
    /// Per page: the history last asked for, and the `url\ntitle` and URL last recorded.
    asked: HashMap<String, String>,
    recorded: HashMap<String, (String, String)>,
    blanks: u64,
}

/// Whether tab `id` is a browser tab.
pub fn is_browser_tab(id: &str) -> bool {
    id.split_once('\n').is_some_and(|(_, path)| {
        path.starts_with("blank:")
            || ["http://", "https://", "file://", "about:"]
                .iter()
                .any(|scheme| path.starts_with(scheme))
    })
}

/// Only web pages go into the history (as the web's `webUrl`).
fn web_url(url: &str) -> bool {
    url.starts_with("http://") || url.starts_with("https://")
}

impl Workspace {
    /// Use `pages` (made with a test's factory) for this window's browser pages.
    pub fn with_browser_pages(mut self, pages: Browsers) -> Self {
        self.browsing.given = Some(pages);
        self
    }

    /// Keep the pages in `file` between launches.
    pub fn with_browser_file(mut self, file: std::path::PathBuf) -> Self {
        self.browsing.file = Some(file);
        self
    }

    /// The window's pages, if any were made.
    pub fn browser_pages(&self) -> Option<&Shared> {
        self.browsing.pages.as_ref()
    }

    /// The window's pages, made now if they are not yet.
    fn pages_in(&mut self, window: &mut Window, cx: &mut Context<Self>) -> Option<Shared> {
        if let Some(pages) = &self.browsing.pages {
            return Some(pages.clone());
        }
        let file = self.browsing.file.clone();
        let made = match self.browsing.given.take() {
            Some(given) => given,
            None => self.webkit_pages(window, cx)?,
        };
        let made = match file {
            Some(file) => made.kept_in(file),
            None => made,
        };
        let pages: Shared = Rc::new(RefCell::new(made));
        slot::attach(window.window_handle().window_id(), pages.clone());
        // The web polls each shown page once a second for where it is.
        self.browsing
            .tasks
            .push(cx.spawn(async move |this, cx| loop {
                cx.background_executor().timer(Duration::from_secs(1)).await;
                let polled = this.update(cx, |this, _| {
                    if let Some(pages) = &this.browsing.pages {
                        pages.borrow_mut().poll();
                    }
                });
                if polled.is_err() {
                    break;
                }
            }));
        self.browsing.pages = Some(pages.clone());
        Some(pages)
    }

    #[cfg(target_os = "macos")]
    fn webkit_pages(&mut self, window: &mut Window, cx: &mut Context<Self>) -> Option<Browsers> {
        use futures::StreamExt;
        let (events, mut heard) = futures::channel::mpsc::unbounded();
        let factory = crate::browser::view::WryFactory::new(&*window, events)?;
        self.browsing.tasks.push(cx.spawn(async move |this, cx| {
            while let Some((key, event)) = heard.next().await {
                if this
                    .update(cx, |this, cx| this.page_event(&key, event, cx))
                    .is_err()
                {
                    break;
                }
            }
        }));
        let mut next = 0u64;
        Some(Browsers::new(
            Box::new(factory),
            Box::new(move || {
                next += 1;
                format!("{}-{next}", std::process::id())
            }),
        ))
    }

    #[cfg(not(target_os = "macos"))]
    fn webkit_pages(&mut self, _: &mut Window, _: &mut Context<Self>) -> Option<Browsers> {
        None
    }

    /// A page's answer: where it is now, or its still picture. A web page's address and title go into the core's
    /// history once per change, a new address counting as a visit (the web's `recordPage`).
    pub fn page_event(&mut self, key: &str, event: PageEvent, cx: &mut Context<Self>) {
        let Some(pages) = self.browsing.pages.clone() else {
            return;
        };
        let location = matches!(event, PageEvent::Location { .. });
        pages.borrow_mut().on_event(key, event);
        if location {
            let meta = pages.borrow().meta(key);
            if web_url(&meta.url) {
                let seen = format!("{}\n{}", meta.url, meta.title);
                let (sent, visited) = self.browsing.recorded.entry(key.into()).or_default();
                if *sent != seen {
                    let visit = *visited != meta.url;
                    *sent = seen;
                    *visited = meta.url.clone();
                    self.send_to_core(
                        json!({"type": "browser.history.record", "url": meta.url, "title": meta.title, "visit": visit}),
                        cx,
                    );
                }
            }
        }
        cx.notify();
    }

    /// Before the window draws: the pages exist once a browser tab or the drawer's page is wanted, the frame
    /// starts, the key monitor follows whether any page is alive.
    pub(super) fn browser_frame(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let wanted = self.tabs.strip().iter().any(|id| is_browser_tab(id))
            || self.chrome.tools() == Some(shell::Tools::Browser);
        if !wanted && self.browsing.pages.is_none() {
            return;
        }
        let Some(pages) = self.pages_in(window, cx) else {
            return;
        };
        pages.borrow_mut().begin_frame();
        *self.browsing.keys.borrow_mut() = Some((
            self.keymap(cx),
            self.leader.is_some(),
            self.resizing.is_some(),
        ));
        #[cfg(target_os = "macos")]
        self.follow_monitor(pages.borrow().live_views() > 0, window, cx);
    }

    /// While a page is alive, a key monitor takes the window's own shortcuts from it (AppKit gives a page every
    /// key) and runs them here.
    #[cfg(target_os = "macos")]
    fn follow_monitor(&mut self, alive: bool, window: &mut Window, cx: &mut Context<Self>) {
        use raw_window_handle::{HasWindowHandle, RawWindowHandle};
        if !alive {
            self.browsing.monitor = None;
            return;
        }
        if self.browsing.monitor.is_some() {
            return;
        }
        let Ok(handle) = HasWindowHandle::window_handle(&*window) else {
            return;
        };
        let RawWindowHandle::AppKit(handle) = handle.as_raw() else {
            return;
        };
        let parent = handle.ns_view.as_ptr() as *mut objc2::runtime::AnyObject;
        let (taken, mut heard) = futures::channel::mpsc::unbounded::<Keystroke>();
        let keys = self.browsing.keys.clone();
        let take = Rc::new(move |keystroke: &Keystroke| {
            let Some((keymap, leader, resize)) = &*keys.borrow() else {
                return false;
            };
            let context = KeyContext {
                in_terminal: false,
                typing: true,
                leader: *leader,
                resize: *resize,
            };
            let hit = keymap.resolve(keystroke, context);
            let take = crate::browser::keys::window_takes(hit.as_ref(), &keystroke.key);
            if take {
                let _ = taken.unbounded_send(keystroke.clone());
            }
            take
        });
        // SAFETY: `parent` is this window's GPUI view, which outlives the monitor (dropped with the workspace or
        // the last page); main thread.
        self.browsing.monitor = Some(unsafe { crate::browser::keys::install(parent, take) });
        self.browsing
            .tasks
            .push(cx.spawn_in(window, async move |this, cx| {
                use futures::StreamExt;
                while let Some(keystroke) = heard.next().await {
                    if this
                        .update_in(cx, |this, window, cx| {
                            this.key(&keystroke, window, cx);
                        })
                        .is_err()
                    {
                        break;
                    }
                }
            }));
    }

    /// Whether anything floats over the pages: then each shows its still picture instead (a native view would draw
    /// over any GPUI menu).
    fn page_cover(&self) -> bool {
        self.peek.is_some() || self.screens.floating.iter().any(|open| open.id != "toast")
    }

    /// Painted after everything: the views follow what was drawn.
    pub(super) fn browser_reconcile(&self) -> Option<AnyElement> {
        let pages = self.browsing.pages.as_ref()?;
        Some(slot::reconcile(
            pages,
            self.page_cover(),
            f64::from(self.zoom_factor()),
        ))
    }

    /// The toolbars on screen: one over each browser tab shown, and the drawer page's.
    pub(super) fn browser_wanted(&self, cx: &App) -> Vec<(&'static str, String, Value)> {
        let Some(pages) = &self.browsing.pages else {
            return Vec::new();
        };
        let pages = pages.borrow();
        let mut keys: Vec<String> = self
            .tabs
            .shown()
            .into_iter()
            .filter(|id| is_browser_tab(id))
            .collect();
        if let Some(drawer) = self.drawer_page(&pages, cx) {
            keys.push(drawer);
        }
        keys.into_iter()
            .map(|key| {
                let meta = pages.meta(&key);
                let rows = pages.rows(&key);
                let props = json!({
                    "key": key,
                    "native": true,
                    "started": !meta.url.is_empty(),
                    "icon": meta.icon,
                    "value": pages.address(&key).map(|a| a.draft.clone()).unwrap_or_default(),
                    "rows": rows,
                    "picked": pages.picked(&key).map_or(-1, |i| i as i64),
                });
                ("browser-toolbar", format!("browser-toolbar#{key}"), props)
            })
            .collect()
    }

    /// The workspace shown: what the start page's picker or the active session says.
    fn shown_workspace(&self, cx: &App) -> Option<String> {
        if let Some((_, Some(id))) = screens::mods(cx).map(|(_, perch)| perch.shown_place()) {
            return Some(id);
        }
        let active = self.tabs.active()?;
        if let Some((workspace, _)) = active.split_once('\n') {
            return Some(workspace.to_string());
        }
        self.sidebar
            .read(cx)
            .find_session(active)
            .and_then(|s| s.workspace_id.clone())
    }

    /// The drawer's page for the workspace shown, while the drawer shows Browser.
    fn drawer_page(&self, pages: &Browsers, cx: &App) -> Option<String> {
        if self.chrome.tools() != Some(shell::Tools::Browser) {
            return None;
        }
        let workspace = self.shown_workspace(cx)?;
        pages.drawer_shown(&workspace).map(|id| drawer_key(&id))
    }

    /// The drawer's Browser: its page for this workspace (one is made the first time), the toolbar over it.
    pub(super) fn drawer_browser(&mut self, cx: &mut Context<Self>) -> Option<AnyElement> {
        let pages = self.browsing.pages.clone()?;
        let workspace = self.shown_workspace(cx)?;
        let key = {
            let mut b = pages.borrow_mut();
            let id = b
                .drawer_shown(&workspace)
                .unwrap_or_else(|| b.drawer_open(&workspace));
            drawer_key(&id)
        };
        Some(self.page_with_toolbar(&pages, &key, cx))
    }

    fn page_with_toolbar(&self, pages: &Shared, key: &str, cx: &App) -> AnyElement {
        let tokens = self.tokens(cx);
        let look = Look {
            fill: tokens.surface_0.into(),
            hint: tokens.subtext.into(),
        };
        let toolbar = self
            .screens
            .inflow(&format!("browser-toolbar#{key}"))
            .map(|view| div().flex_none().h(px(43.)).w_full().child(view));
        div()
            .size_full()
            .flex()
            .flex_col()
            .children(toolbar)
            .child(slot::page_slot(pages, key, self.page_cover(), look))
            .into_any_element()
    }

    /// A browser tab's pane: its toolbar over its page.
    pub(super) fn browser_body(
        &self,
        id: &str,
        focused: bool,
        cx: &mut Context<Self>,
    ) -> Option<AnyElement> {
        if !is_browser_tab(id) {
            return None;
        }
        let pages = self.browsing.pages.clone()?;
        let target = id.to_string();
        Some(
            div()
                .id(format!("pane-{id}"))
                .size_full()
                .overflow_hidden()
                .rounded_md()
                .border_1()
                .border_color(rgb(if focused { PANE_FOCUS } else { MAIN_BG }))
                .on_mouse_down(
                    MouseButton::Left,
                    cx.listener(move |this, _, _, cx| this.focus_pane(&target, cx)),
                )
                .child(self.page_with_toolbar(&pages, id, cx))
                .into_any_element(),
        )
    }

    /// A browser tab's name: its page's title, else its address's host, else "New tab".
    pub(super) fn browser_title(&self, id: &str) -> Option<String> {
        if !is_browser_tab(id) {
            return None;
        }
        let meta = self
            .browsing
            .pages
            .as_ref()
            .map(|p| p.borrow().meta(id))
            .unwrap_or_default();
        let url = if meta.url.is_empty() {
            id.split_once('\n').map(|(_, p)| p).unwrap_or("")
        } else {
            &meta.url
        };
        Some(
            Some(meta.title.trim().to_string())
                .filter(|t| !t.is_empty())
                .or_else(|| crate::browser::address::url_host(url))
                .unwrap_or_else(|| "New tab".into()),
        )
    }

    /// Close browser tab `id`: its page ends (closing is how its memory returns).
    pub(super) fn close_browser_tab(&mut self, id: &str, cx: &mut Context<Self>) {
        if let Some(pages) = &self.browsing.pages {
            pages.borrow_mut().close(id);
        }
        self.browsing.asked.remove(id);
        self.browsing.recorded.remove(id);
        self.tabs.close(id);
        self.after_change(cx);
    }

    /// Open a browser tab in `workspace`, at `url` or empty.
    fn open_browser_tab(
        &mut self,
        workspace: &str,
        url: Option<String>,
        cx: &mut Context<Self>,
    ) -> Result<String, String> {
        let path = match url {
            Some(url) => url,
            None => {
                self.browsing.blanks += 1;
                format!("blank:{}-{}", std::process::id(), self.browsing.blanks)
            }
        };
        let id = format!("{workspace}\n{path}");
        let started = !path.starts_with("blank:");
        if let Some(pages) = &self.browsing.pages {
            let mut pages = pages.borrow_mut();
            pages.ensure(&id, if started { &path } else { "" });
            if started {
                pages.focus(&id);
            }
        }
        if self.tabs.contains(&id) {
            self.tabs.show(&id);
        } else {
            self.tabs.open(&id);
        }
        self.after_change(cx);
        Ok(id)
    }

    /// The browser's commands: `browser.open` and the toolbar screen's. None for any other command.
    pub(super) fn browser_command(
        &mut self,
        name: &str,
        args: Option<&Value>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Option<Result<(), String>> {
        if !name.starts_with("browser.") {
            return None;
        }
        let text = |key: &str| args.and_then(|a| a.get(key)).and_then(Value::as_str);
        if name == "browser.open" {
            let workspace = match text("workspaceId") {
                Some(id) => self.known_workspace(Some(id), cx),
                None => self
                    .shown_workspace(cx)
                    .ok_or_else(|| "Open a workspace first.".to_string()),
            };
            let engine = self.read_prefs(cx).engine;
            let result = workspace.and_then(|workspace| {
                // The page must exist before the tab draws it.
                self.pages_in(window, cx)
                    .ok_or("Browser pages need the desktop's WebKit.")?;
                let url = match text("url").filter(|u| !u.trim().is_empty()) {
                    Some(typed) => Some(
                        browser_address(typed, engine.as_deref())
                            .filter(|u| crate::browser::navigable(u))
                            .ok_or_else(|| format!("Not an address to open: {typed}"))?,
                    ),
                    None => None,
                };
                self.open_browser_tab(&workspace, url, cx).map(|_| ())
            });
            return Some(result);
        }
        let pages = self.browsing.pages.clone()?;
        let key = text("key").unwrap_or("").to_string();
        let result = match name {
            "browser.addressChange" => {
                pages
                    .borrow_mut()
                    .address_change(&key, text("value").unwrap_or(""));
                self.address_lookups(&pages, &key, cx);
                Ok(())
            }
            "browser.addressFocus" => {
                pages.borrow_mut().address_focus(&key);
                Ok(())
            }
            "browser.addressBlur" => {
                pages.borrow_mut().address_blur(&key);
                Ok(())
            }
            "browser.addressKey" => {
                let prefs = self.read_prefs(cx);
                pages.borrow_mut().prefs = prefs;
                let done = pages
                    .borrow_mut()
                    .address_key(&key, text("name").unwrap_or(""));
                if done == KeyResult::Handled {
                    self.address_lookups(&pages, &key, cx);
                }
                Ok(())
            }
            "browser.choose" => {
                pages.borrow_mut().choose(&key, text("url").unwrap_or(""));
                Ok(())
            }
            "browser.forget" => {
                let url = text("url").unwrap_or("");
                self.send_to_core(json!({"type": "browser.history.remove", "url": url}), cx);
                self.browsing.asked.remove(&key);
                self.address_lookups(&pages, &key, cx);
                Ok(())
            }
            "browser.back" | "browser.forward" | "browser.reload" => {
                let action = match name {
                    "browser.back" => Action::Back,
                    "browser.forward" => Action::Forward,
                    _ => Action::Reload,
                };
                pages.borrow_mut().act(&key, action);
                Ok(())
            }
            "browser.openExternal" => {
                let url = pages.borrow().meta(&key).url;
                if web_url(&url) {
                    (self.opener)(&Target::Url(url));
                    Ok(())
                } else {
                    Err("Only a web page opens in the system's browser.".into())
                }
            }
            _ => Err(format!("No command {name}.")),
        };
        cx.notify();
        Some(result)
    }

    /// The person's browser settings, as the core keeps them.
    fn read_prefs(&self, cx: &App) -> crate::browser::Prefs {
        let settings = self.sidebar.read(cx).model().store.settings.clone();
        let get = |key: &str| settings.as_ref().and_then(|s| s.get(key)).cloned();
        crate::browser::Prefs {
            engine: get("browserSearchEngine").and_then(|v| v.as_str().map(str::to_string)),
            suggestions: get("browserSearchSuggestions")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
        }
    }

    /// The dropdown's sources for what is typed now: the core's history at once, the engine's suggestions after a
    /// short pause (one request per burst of typing), and only when the person turned them on.
    fn address_lookups(&mut self, pages: &Shared, key: &str, cx: &mut Context<Self>) {
        let prefs = self.read_prefs(cx);
        let wants_suggestions = prefs.suggestions;
        pages.borrow_mut().prefs = prefs;
        let Some(typed) = pages.borrow().typed(key) else {
            self.browsing.suggest = None;
            return;
        };
        if self.browsing.asked.get(key) != Some(&typed) {
            self.browsing.asked.insert(key.into(), typed.clone());
            let answer = self.ask(
                json!({"type": "browser.history.search", "query": typed}),
                cx,
            );
            let (pages, key, query) = (pages.clone(), key.to_string(), typed.clone());
            cx.spawn(async move |this, cx| {
                let Ok(Ok(found)) = answer.await else { return };
                let entries: Vec<HistoryEntry> = found
                    .get("entries")
                    .cloned()
                    .and_then(|e| serde_json::from_value(e).ok())
                    .unwrap_or_default();
                pages.borrow_mut().set_history(&key, &query, entries);
                let _ = this.update(cx, |_, cx| cx.notify());
            })
            .detach();
        }
        self.browsing.suggest = None;
        if !wants_suggestions || typed.trim().is_empty() {
            return;
        }
        let (pages, key) = (pages.clone(), key.to_string());
        self.browsing.suggest = Some(cx.spawn(async move |this, cx| {
            cx.background_executor()
                .timer(Duration::from_millis(150))
                .await;
            let Ok(answer) = this.update(cx, |this, cx| {
                this.ask(json!({"type": "browser.suggest", "query": typed}), cx)
            }) else {
                return;
            };
            let Ok(Ok(found)) = answer.await else { return };
            let suggestions: Vec<String> = found
                .get("suggestions")
                .cloned()
                .and_then(|s| serde_json::from_value(s).ok())
                .unwrap_or_default();
            pages
                .borrow_mut()
                .set_suggestions(&key, &typed, suggestions);
            let _ = this.update(cx, |_, cx| cx.notify());
        }));
    }
}
