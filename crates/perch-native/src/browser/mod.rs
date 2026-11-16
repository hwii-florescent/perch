//! Browser pages: a real web page in a native child view, in the drawer's Browser section or in a browser tab.
//!
//! The web's model (`drawerBrowsers.ts`, `browserPages.ts`, `WorkspaceBrowser.tsx`): a page is named by its key (a
//! drawer page's `drawer\n<id>`, a browser tab's `fileTabKey`), remembers the address, title and icon it last
//! showed (so a restart reopens it), and owns its address bar's draft and dropdown, which a toolbar screen only
//! draws. Only pages on screen are shown, but every open page keeps its view, so closing is how memory comes back.
//!
//! This holds the pages and decides, once per frame, what each view does. [`Browsers::begin_frame`] forgets
//! where pages were; each page slot drawn calls [`Browsers::painted`]; [`Browsers::end_frame`] then creates views
//! on first show, moves them, hides the ones not drawn, and under a cover (a menu, dialog, the page's own address
//! list) hides them and asks for a still picture to draw in their place. Views come from a [`PageFactory`]: the
//! window's draws real WebKit views (`view.rs`, macOS), the tests' record what they were told.
//!
//! No view exists until the first page is shown; [`Browsers::live_views`] reaching zero is the window's cue to
//! drop its key monitor (`keys.rs`).

pub mod address;
#[cfg(target_os = "macos")]
pub mod keys;
pub mod slot;
#[cfg(target_os = "macos")]
pub mod view;

use address::{address_rows, browser_address, AddressRow, HistoryEntry};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;
use std::sync::Arc;

/// Where a page is drawn, in window points, origin top left.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Frame {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

impl Frame {
    /// Too small to show (the web's `r.width < 2 || r.height < 2`).
    fn tiny(&self) -> bool {
        self.width < 2. || self.height < 2.
    }
}

/// What a view tells the window later, from WebKit's own threads and callbacks.
#[derive(Clone, Debug, PartialEq)]
pub enum PageEvent {
    /// The page's committed address, title and favicon address ("" when none).
    Location {
        url: String,
        title: String,
        icon: String,
    },
    /// A still picture of the page (PNG), asked for by [`PageView::snapshot`].
    Snapshot(Arc<Vec<u8>>),
}

/// One native page view. Calls never block on the page.
pub trait PageView {
    fn set_frame(&mut self, frame: Frame);
    fn set_visible(&mut self, visible: bool);
    fn set_zoom(&mut self, zoom: f64);
    fn navigate(&mut self, url: &str);
    /// `back`, `forward` or `reload`.
    fn act(&mut self, action: Action);
    /// Give the page the keyboard.
    fn focus(&mut self);
    /// Whether the page has the keyboard.
    fn has_focus(&self) -> bool;
    /// Hand the keyboard back to the window's own view if the page has it; whether it had it.
    fn release_focus(&mut self) -> bool;
    /// Ask for a [`PageEvent::Snapshot`].
    fn snapshot(&mut self);
    /// Ask for a [`PageEvent::Location`].
    fn poll_location(&mut self);
    /// End the page and its WebKit content process.
    fn close(self: Box<Self>);
}

/// Makes views; `url` is where the new page starts (always one [`navigable`] allows).
pub trait PageFactory {
    fn create(&mut self, key: &str, url: &str, frame: Frame, zoom: f64) -> Box<dyn PageView>;
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Action {
    Back,
    Forward,
    Reload,
}

/// Whether a page may go to `url`: the web (`http(s)`), a blank page, or, as the desktop app shows them, a local
/// file an agent printed. Everything else (other schemes, remote `file:` hosts, a missing file) is refused.
pub fn navigable(url: &str) -> bool {
    if url == "about:blank" || address::web_url(url).is_some() {
        return true;
    }
    address::file_url(url)
        .and_then(|u| url::Url::parse(&u).ok())
        .and_then(|u| u.to_file_path().ok())
        .is_some_and(|path| path.is_file())
}

/// What a page last showed, kept so a restart reopens it and the tab strip can name it before its view exists.
#[derive(Clone, Debug, Default, PartialEq, Eq, Deserialize, Serialize)]
pub struct PageMeta {
    pub url: String,
    pub title: String,
    pub icon: String,
}

/// A favicon address a screen may load: http(s) or an inline image, nothing else (`safeIcon`).
pub fn safe_icon(icon: &str) -> String {
    let lower = icon.to_ascii_lowercase();
    if lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("data:image/")
    {
        icon.to_string()
    } else {
        String::new()
    }
}

/// A page of a workspace's drawer.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrawerPage {
    pub id: String,
    pub workspace_id: String,
    pub url: String,
}

/// A drawer page's key (a browser tab's is its tab key).
pub fn drawer_key(id: &str) -> String {
    format!("drawer\n{id}")
}

/// The address bar's state while typing (`WorkspaceBrowser.tsx`).
#[derive(Debug, Default)]
pub struct Address {
    pub draft: String,
    editing: bool,
    dirty: bool,
    open: bool,
    picked: Option<usize>,
    history: Vec<HistoryEntry>,
    /// The typed text `history` answers.
    history_for: Option<String>,
    suggestions: Vec<String>,
    suggestions_for: Option<String>,
}

/// The person's browser settings.
#[derive(Clone, Debug, Default)]
pub struct Prefs {
    pub engine: Option<String>,
    pub suggestions: bool,
}

/// What a key in the address bar did.
#[derive(Debug, PartialEq, Eq)]
pub enum KeyResult {
    /// The key was the bar's: the screen must not act on it.
    Handled,
    /// Not the bar's (any other key): it types as usual.
    Pass,
}

struct Page {
    meta: PageMeta,
    view: Option<Box<dyn PageView>>,
    address: Address,
    /// Where it was drawn this frame.
    painted: Option<Frame>,
    /// What the view was last told.
    frame: Option<Frame>,
    visible: bool,
    zoom: Option<f64>,
    snapshot: Option<Arc<Vec<u8>>>,
    snapshot_asked: bool,
    /// Take the keyboard once shown and uncovered (the web's `focusPending`).
    focus_pending: bool,
    /// It had the keyboard when hidden: give it back on return.
    focus_back: bool,
}

impl Page {
    fn new(meta: PageMeta) -> Self {
        Page {
            address: Address {
                draft: meta.url.clone(),
                ..Address::default()
            },
            meta,
            view: None,
            painted: None,
            frame: None,
            visible: false,
            zoom: None,
            snapshot: None,
            snapshot_asked: false,
            focus_pending: false,
            focus_back: false,
        }
    }
    fn started(&self) -> bool {
        !self.meta.url.is_empty()
    }
    fn hide(&mut self) {
        if let Some(view) = self.view.as_mut() {
            if self.visible {
                self.focus_back |= view.release_focus();
                view.set_visible(false);
                self.visible = false;
            }
        }
    }
}

/// What the window keeps per page between launches, in `browser.json` beside its frame file.
#[derive(Debug, Default, Deserialize, Serialize)]
struct Kept {
    #[serde(default)]
    drawer: Vec<DrawerPage>,
    #[serde(default)]
    pages: BTreeMap<String, PageMeta>,
}

/// Every browser page of one window.
pub struct Browsers {
    pages: HashMap<String, Page>,
    drawer: Vec<DrawerPage>,
    /// The drawer page each workspace shows; the newest when unset.
    active: HashMap<String, String>,
    factory: Box<dyn PageFactory>,
    file: Option<PathBuf>,
    pub prefs: Prefs,
    new_id: Box<dyn FnMut() -> String>,
}

impl Browsers {
    pub fn new(factory: Box<dyn PageFactory>, new_id: Box<dyn FnMut() -> String>) -> Self {
        Browsers {
            pages: HashMap::new(),
            drawer: Vec::new(),
            active: HashMap::new(),
            factory,
            file: None,
            prefs: Prefs::default(),
            new_id,
        }
    }

    /// Reads the pages kept in `file`, if it is there and whole, and keeps them there from now on.
    pub fn kept_in(mut self, file: PathBuf) -> Self {
        let kept: Kept = std::fs::read(&file)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default();
        self.drawer = kept.drawer;
        for (key, mut meta) in kept.pages {
            // A stored address is untrusted: only one a page may show comes back.
            if !meta.url.is_empty() && !navigable(&meta.url) {
                meta.url.clear();
            }
            meta.icon = safe_icon(&meta.icon);
            self.pages.insert(key, Page::new(meta));
        }
        self.file = Some(file);
        self
    }

    fn save(&self) {
        let Some(file) = &self.file else { return };
        let kept = Kept {
            drawer: self.drawer.clone(),
            pages: self
                .pages
                .iter()
                .filter(|(_, page)| page.started())
                .map(|(key, page)| (key.clone(), page.meta.clone()))
                .collect(),
        };
        // Convenience only, as the web's localStorage: a failed write loses nothing open.
        if let Ok(bytes) = serde_json::to_vec_pretty(&kept) {
            let _ = std::fs::write(file, bytes);
        }
    }

    /// Views alive now.
    pub fn live_views(&self) -> usize {
        self.pages.values().filter(|p| p.view.is_some()).count()
    }

    /// A page's state (address, title, icon), or the default for an unknown key.
    pub fn meta(&self, key: &str) -> PageMeta {
        self.pages
            .get(key)
            .map(|p| p.meta.clone())
            .unwrap_or_default()
    }

    /// Opens (or finds) the page named `key`, starting at `url` ("" for an empty bar).
    pub fn ensure(&mut self, key: &str, url: &str) {
        self.pages.entry(key.to_string()).or_insert_with(|| {
            let url = if navigable(url) { url } else { "" };
            Page::new(PageMeta {
                url: url.into(),
                ..PageMeta::default()
            })
        });
    }

    // ---- The drawer (`drawerBrowsers.ts`) ----

    /// The workspace's drawer pages, oldest first.
    pub fn drawer_pages(&self, workspace: &str) -> Vec<&DrawerPage> {
        self.drawer
            .iter()
            .filter(|p| p.workspace_id == workspace)
            .collect()
    }

    /// The page the drawer shows: the selected one, else the newest.
    pub fn drawer_shown(&self, workspace: &str) -> Option<String> {
        let pages = self.drawer_pages(workspace);
        let active = self.active.get(workspace);
        pages
            .iter()
            .find(|p| Some(&p.id) == active)
            .or(pages.last())
            .map(|p| p.id.clone())
    }

    /// A new empty drawer page, shown; its id.
    pub fn drawer_open(&mut self, workspace: &str) -> String {
        let id = (self.new_id)();
        self.drawer.push(DrawerPage {
            id: id.clone(),
            workspace_id: workspace.into(),
            url: String::new(),
        });
        self.active.insert(workspace.into(), id.clone());
        self.ensure(&drawer_key(&id), "");
        self.save();
        id
    }

    pub fn drawer_select(&mut self, workspace: &str, id: &str) {
        self.active.insert(workspace.into(), id.into());
    }

    pub fn drawer_close(&mut self, id: &str) {
        self.drawer.retain(|p| p.id != id);
        self.close(&drawer_key(id));
    }

    /// Closes every drawer page of the workspace; the caller closes its browser tabs (`tab_keys`).
    pub fn drawer_close_all(&mut self, workspace: &str, tab_keys: &[String]) {
        let ids: Vec<String> = self
            .drawer_pages(workspace)
            .iter()
            .map(|p| p.id.clone())
            .collect();
        for id in ids {
            self.drawer_close(&id);
        }
        for key in tab_keys {
            self.close(key);
        }
    }

    /// Ends a page: its view, and what it remembered.
    pub fn close(&mut self, key: &str) {
        if let Some(mut page) = self.pages.remove(key) {
            if let Some(mut view) = page.view.take() {
                view.release_focus();
                view.close();
            }
        }
        self.save();
    }

    // ---- Each frame ----

    pub fn begin_frame(&mut self) {
        for page in self.pages.values_mut() {
            page.painted = None;
        }
    }

    /// The slot for `key` was drawn at `frame` this frame.
    pub fn painted(&mut self, key: &str, frame: Frame) {
        if let Some(page) = self.pages.get_mut(key) {
            page.painted = Some(frame);
        }
    }

    /// The still picture to draw in `key`'s place while it is covered (None: draw the plain fill).
    pub fn snapshot(&self, key: &str) -> Option<Arc<Vec<u8>>> {
        self.pages.get(key).and_then(|p| p.snapshot.clone())
    }

    /// Whether `key` is covered: drawn, but with its view hidden under something.
    pub fn covered(&self, key: &str, cover: bool) -> bool {
        self.pages
            .get(key)
            .is_some_and(|p| p.started() && (cover || p.address.open))
    }

    /// Makes views agree with what was drawn: `cover` is true while a menu, dialog or other floating screen (or
    /// Settings) is open over the window; `zoom` is the window's.
    pub fn end_frame(&mut self, cover: bool, zoom: f64) {
        for (key, page) in self.pages.iter_mut() {
            let covered = cover || page.address.open;
            let frame = page.painted.filter(|f| !f.tiny());
            match frame {
                Some(frame) if page.started() && !covered => {
                    let view = page.view.get_or_insert_with(|| {
                        self.factory.create(key, &page.meta.url, frame, zoom)
                    });
                    if page.frame != Some(frame) {
                        view.set_frame(frame);
                        page.frame = Some(frame);
                    }
                    if page.zoom != Some(zoom) {
                        view.set_zoom(zoom);
                        page.zoom = Some(zoom);
                    }
                    if !page.visible {
                        view.set_visible(true);
                        page.visible = true;
                    }
                    page.snapshot = None;
                    page.snapshot_asked = false;
                    if (page.focus_pending || page.focus_back) && !page.address.editing {
                        view.focus();
                        page.focus_pending = false;
                        page.focus_back = false;
                    }
                }
                Some(_) if page.started() && page.visible => {
                    // Covered: a picture in its place, asked for while the page still draws.
                    if !page.snapshot_asked {
                        if let Some(view) = page.view.as_mut() {
                            view.snapshot();
                        }
                        page.snapshot_asked = true;
                    }
                    page.hide();
                }
                _ => page.hide(),
            }
        }
    }

    /// A view's later answer.
    pub fn on_event(&mut self, key: &str, event: PageEvent) {
        let Some(page) = self.pages.get_mut(key) else {
            return;
        };
        match event {
            PageEvent::Snapshot(png) => {
                if page.snapshot_asked && !page.visible {
                    page.snapshot = Some(png);
                }
            }
            PageEvent::Location { url, title, icon } => {
                if url.is_empty() || !navigable(&url) {
                    return;
                }
                let same = page.meta.url == url;
                let meta = PageMeta {
                    title: if title.is_empty() && same {
                        page.meta.title.clone()
                    } else {
                        title
                    },
                    icon: safe_icon(&icon),
                    url,
                };
                if !page.address.editing {
                    page.address.draft = meta.url.clone();
                }
                if meta != page.meta {
                    page.meta = meta;
                    if let Some(id) = key.strip_prefix("drawer\n") {
                        if let Some(drawer) = self.drawer.iter_mut().find(|p| p.id == id) {
                            drawer.url = page.meta.url.clone();
                        }
                    }
                    self.save();
                }
            }
        }
    }

    /// Ask every shown page where it is now (the web polls each second while shown).
    pub fn poll(&mut self) {
        for page in self.pages.values_mut().filter(|p| p.visible) {
            if let Some(view) = page.view.as_mut() {
                view.poll_location();
            }
        }
    }

    /// Whether any page has the keyboard.
    pub fn page_has_keyboard(&self) -> bool {
        self.pages
            .values()
            .any(|p| p.view.as_ref().is_some_and(|v| p.visible && v.has_focus()))
    }

    /// Give `key` the keyboard as soon as it shows (opening or picking a page, Enter in its bar).
    pub fn focus(&mut self, key: &str) {
        if let Some(page) = self.pages.get_mut(key) {
            page.focus_pending = true;
        }
    }

    /// Back, forward or reload.
    pub fn act(&mut self, key: &str, action: Action) {
        if let Some(view) = self.pages.get_mut(key).and_then(|p| p.view.as_mut()) {
            view.act(action);
        }
    }

    // ---- The address bar ----

    pub fn address(&self, key: &str) -> Option<&Address> {
        self.pages.get(key).map(|p| &p.address)
    }

    /// The text the dropdown is for: what was typed, or "" (recent pages) before typing.
    pub fn typed(&self, key: &str) -> Option<String> {
        let address = &self.pages.get(key)?.address;
        address.open.then(|| {
            if address.dirty {
                address.draft.clone()
            } else {
                String::new()
            }
        })
    }

    /// The dropdown's rows (empty while closed).
    pub fn rows(&self, key: &str) -> Vec<AddressRow> {
        let Some(page) = self.pages.get(key) else {
            return Vec::new();
        };
        let a = &page.address;
        if !a.open {
            return Vec::new();
        }
        let typed = if a.dirty { a.draft.as_str() } else { "" };
        let history: &[HistoryEntry] = if a.history_for.as_deref() == Some(typed) {
            &a.history
        } else {
            &[]
        };
        let suggestions: &[String] = if self.prefs.suggestions
            && a.suggestions_for.as_deref() == Some(typed)
            && !typed.trim().is_empty()
        {
            &a.suggestions
        } else {
            &[]
        };
        address_rows(typed, history, suggestions, self.prefs.engine.as_deref())
    }

    pub fn picked(&self, key: &str) -> Option<usize> {
        self.pages.get(key).and_then(|p| p.address.picked)
    }

    /// The core's history for `typed`; an answer for older text is dropped.
    pub fn set_history(&mut self, key: &str, typed: &str, found: Vec<HistoryEntry>) {
        if let Some(page) = self.pages.get_mut(key) {
            page.address.history = found;
            page.address.history_for = Some(typed.into());
        }
    }

    /// The engine's suggestions for `typed`; an answer for older text is dropped.
    pub fn set_suggestions(&mut self, key: &str, typed: &str, found: Vec<String>) {
        if let Some(page) = self.pages.get_mut(key) {
            page.address.suggestions = found;
            page.address.suggestions_for = Some(typed.into());
        }
    }

    pub fn address_change(&mut self, key: &str, value: &str) {
        if let Some(a) = self.pages.get_mut(key).map(|p| &mut p.address) {
            a.draft = value.into();
            a.dirty = true;
            a.open = true;
            a.picked = None;
        }
    }

    pub fn address_focus(&mut self, key: &str) {
        if let Some(a) = self.pages.get_mut(key).map(|p| &mut p.address) {
            a.editing = true;
        }
    }

    pub fn address_blur(&mut self, key: &str) {
        if let Some(a) = self.pages.get_mut(key).map(|p| &mut p.address) {
            a.editing = false;
            a.open = false;
            a.dirty = false;
            a.picked = None;
        }
    }

    /// A key in the address bar (DOM names: `ArrowDown`, `ArrowUp`, `Escape`, `Enter`).
    pub fn address_key(&mut self, key: &str, name: &str) -> KeyResult {
        let rows = self.rows(key);
        let Some(page) = self.pages.get_mut(key) else {
            return KeyResult::Pass;
        };
        let a = &mut page.address;
        match name {
            "ArrowDown" | "ArrowUp" => {
                if !a.open {
                    a.open = true;
                } else if !rows.is_empty() {
                    let n = rows.len();
                    a.picked = Some(match (name, a.picked) {
                        ("ArrowDown", None) => 0,
                        ("ArrowDown", Some(i)) => (i + 1) % n,
                        (_, None | Some(0)) => n - 1,
                        (_, Some(i)) => i - 1,
                    });
                }
                KeyResult::Handled
            }
            "Escape" => {
                if a.open && !rows.is_empty() {
                    a.open = false;
                    a.picked = None;
                } else {
                    a.draft = page.meta.url.clone();
                    a.dirty = false;
                }
                KeyResult::Handled
            }
            "Enter" => {
                let target = match a.picked.and_then(|i| rows.get(i)) {
                    Some(row) => Some(row.url.clone()),
                    None => browser_address(&a.draft, self.prefs.engine.as_deref()),
                };
                if let Some(target) = target {
                    self.go(key, &target);
                }
                KeyResult::Handled
            }
            _ => KeyResult::Pass,
        }
    }

    /// Choose a dropdown row.
    pub fn choose(&mut self, key: &str, url: &str) {
        self.go(key, url);
    }

    /// Go to `url` (the bar's Enter, a row): the view navigates, or is made there on its first show.
    pub fn go(&mut self, key: &str, url: &str) {
        if !navigable(url) {
            return;
        }
        let Some(page) = self.pages.get_mut(key) else {
            return;
        };
        let a = &mut page.address;
        a.open = false;
        a.dirty = false;
        a.picked = None;
        a.editing = false;
        a.draft = url.into();
        page.meta = PageMeta {
            url: url.into(),
            ..PageMeta::default()
        };
        page.focus_pending = true;
        if let Some(view) = page.view.as_mut() {
            view.navigate(url);
        }
        if let Some(id) = key.strip_prefix("drawer\n") {
            if let Some(drawer) = self.drawer.iter_mut().find(|p| p.id == id) {
                drawer.url = url.into();
            }
        }
        self.save();
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::rc::Rc;

    /// Records every call; `focused` is what the view would answer.
    #[derive(Default)]
    pub struct Calls {
        pub log: Vec<String>,
        pub focused: Option<String>,
    }

    pub struct FakePage {
        key: String,
        calls: Rc<RefCell<Calls>>,
    }

    impl FakePage {
        fn note(&self, what: String) {
            self.calls
                .borrow_mut()
                .log
                .push(format!("{} {what}", self.key));
        }
    }

    impl PageView for FakePage {
        fn set_frame(&mut self, f: Frame) {
            self.note(format!("frame {},{},{},{}", f.x, f.y, f.width, f.height));
        }
        fn set_visible(&mut self, visible: bool) {
            self.note(if visible {
                "show".into()
            } else {
                "hide".into()
            });
        }
        fn set_zoom(&mut self, zoom: f64) {
            self.note(format!("zoom {zoom}"));
        }
        fn navigate(&mut self, url: &str) {
            self.note(format!("go {url}"));
        }
        fn act(&mut self, action: Action) {
            self.note(format!("{action:?}"));
        }
        fn focus(&mut self) {
            self.note("focus".into());
            self.calls.borrow_mut().focused = Some(self.key.clone());
        }
        fn has_focus(&self) -> bool {
            self.calls.borrow().focused.as_deref() == Some(&self.key)
        }
        fn release_focus(&mut self) -> bool {
            let had = self.has_focus();
            if had {
                self.note("release".into());
                self.calls.borrow_mut().focused = None;
            }
            had
        }
        fn snapshot(&mut self) {
            self.note("snapshot".into());
        }
        fn poll_location(&mut self) {
            self.note("poll".into());
        }
        fn close(self: Box<Self>) {
            self.note("close".into());
        }
    }

    pub struct FakeFactory(pub Rc<RefCell<Calls>>);

    impl PageFactory for FakeFactory {
        fn create(&mut self, key: &str, url: &str, _: Frame, zoom: f64) -> Box<dyn PageView> {
            self.0
                .borrow_mut()
                .log
                .push(format!("{key} create {url} zoom {zoom}"));
            Box::new(FakePage {
                key: key.into(),
                calls: self.0.clone(),
            })
        }
    }

    pub fn browsers() -> (Browsers, Rc<RefCell<Calls>>) {
        let calls = Rc::new(RefCell::new(Calls::default()));
        let mut n = 0;
        let ids = Box::new(move || {
            n += 1;
            format!("p{n}")
        });
        (
            Browsers::new(Box::new(FakeFactory(calls.clone())), ids),
            calls,
        )
    }

    fn take(calls: &Rc<RefCell<Calls>>) -> Vec<String> {
        std::mem::take(&mut calls.borrow_mut().log)
    }

    const F: Frame = Frame {
        x: 10.,
        y: 20.,
        width: 300.,
        height: 200.,
    };

    fn frame(b: &mut Browsers, painted: &[(&str, Frame)], cover: bool) {
        b.begin_frame();
        for (key, f) in painted {
            b.painted(key, *f);
        }
        b.end_frame(cover, 1.0);
    }

    #[test]
    fn no_view_exists_until_a_page_is_first_shown() {
        let (mut b, calls) = browsers();
        b.ensure("t", "");
        frame(&mut b, &[("t", F)], false);
        assert_eq!(b.live_views(), 0, "an empty bar has no page yet");
        b.ensure("u", "https://example.com/");
        assert_eq!(b.live_views(), 0);
        frame(&mut b, &[], false);
        assert_eq!(b.live_views(), 0, "not drawn, not made");
        frame(&mut b, &[("u", F)], false);
        assert_eq!(b.live_views(), 1);
        assert_eq!(
            take(&calls),
            [
                "u create https://example.com/ zoom 1",
                "u frame 10,20,300,200",
                "u zoom 1",
                "u show"
            ]
        );
    }

    #[test]
    fn closing_the_last_page_closes_every_view() {
        let (mut b, calls) = browsers();
        b.ensure("a", "https://a.test/");
        b.ensure("b", "https://b.test/");
        frame(&mut b, &[("a", F), ("b", F)], false);
        assert_eq!(b.live_views(), 2);
        b.focus("a");
        frame(&mut b, &[("a", F), ("b", F)], false);
        take(&calls);
        b.close("a");
        b.close("b");
        assert_eq!(b.live_views(), 0);
        assert_eq!(take(&calls), ["a release", "a close", "b close"]);
    }

    #[test]
    fn a_page_not_painted_this_frame_is_hidden_and_kept() {
        let (mut b, calls) = browsers();
        b.ensure("a", "https://a.test/");
        frame(&mut b, &[("a", F)], false);
        take(&calls);
        frame(&mut b, &[], false);
        assert_eq!(take(&calls), ["a hide"]);
        assert_eq!(b.live_views(), 1, "kept until closed");
        frame(&mut b, &[("a", F)], false);
        assert_eq!(take(&calls), ["a show"], "same frame: not moved again");
    }

    #[test]
    fn bounds_follow_the_slot_each_frame() {
        let (mut b, calls) = browsers();
        b.ensure("a", "https://a.test/");
        frame(&mut b, &[("a", F)], false);
        take(&calls);
        let moved = Frame { width: 150., ..F };
        frame(&mut b, &[("a", moved)], false);
        assert_eq!(take(&calls), ["a frame 10,20,150,200"]);
        frame(&mut b, &[("a", Frame { width: 1., ..F })], false);
        assert_eq!(take(&calls), ["a hide"], "too small to show");
    }

    #[test]
    fn any_cover_hides_and_requests_one_snapshot() {
        let (mut b, calls) = browsers();
        b.ensure("a", "https://a.test/");
        frame(&mut b, &[("a", F)], false);
        take(&calls);
        frame(&mut b, &[("a", F)], true);
        frame(&mut b, &[("a", F)], true);
        assert_eq!(take(&calls), ["a snapshot", "a hide"]);
        assert!(b.covered("a", true));
        b.on_event("a", PageEvent::Snapshot(Arc::new(vec![1, 2, 3])));
        assert_eq!(b.snapshot("a").as_deref(), Some(&vec![1, 2, 3]));
    }

    #[test]
    fn uncovering_shows_the_view_and_drops_the_snapshot() {
        let (mut b, calls) = browsers();
        b.ensure("a", "https://a.test/");
        frame(&mut b, &[("a", F)], false);
        frame(&mut b, &[("a", F)], true);
        b.on_event("a", PageEvent::Snapshot(Arc::new(vec![1])));
        take(&calls);
        frame(&mut b, &[("a", F)], false);
        assert_eq!(take(&calls), ["a show"]);
        assert!(b.snapshot("a").is_none());
        // A picture that arrives after the cover closed is not kept.
        b.on_event("a", PageEvent::Snapshot(Arc::new(vec![2])));
        assert!(b.snapshot("a").is_none());
    }

    #[test]
    fn the_suggestion_list_covers_its_own_page() {
        let (mut b, calls) = browsers();
        b.ensure("a", "https://a.test/");
        b.ensure("b", "https://b.test/");
        frame(&mut b, &[("a", F), ("b", F)], false);
        take(&calls);
        b.address_focus("a");
        b.address_change("a", "exa");
        frame(&mut b, &[("a", F), ("b", F)], false);
        assert_eq!(take(&calls), ["a snapshot", "a hide"], "only its own page");
        b.address_blur("a");
        frame(&mut b, &[("a", F), ("b", F)], false);
        assert_eq!(take(&calls), ["a show"]);
    }

    #[test]
    fn hiding_a_focused_page_releases_focus_first_and_returns_it() {
        let (mut b, calls) = browsers();
        b.ensure("a", "https://a.test/");
        b.focus("a");
        frame(&mut b, &[("a", F)], false);
        assert!(b.page_has_keyboard());
        take(&calls);
        frame(&mut b, &[("a", F)], true);
        assert_eq!(take(&calls), ["a snapshot", "a release", "a hide"]);
        assert!(!b.page_has_keyboard());
        frame(&mut b, &[("a", F)], false);
        assert_eq!(
            take(&calls),
            ["a show", "a focus"],
            "the page it had gets the keyboard back"
        );
    }

    #[test]
    fn address_enter_navigates_and_focuses_the_page() {
        let (mut b, calls) = browsers();
        b.ensure("a", "");
        b.address_focus("a");
        b.address_change("a", "example.com");
        assert_eq!(b.address_key("a", "Enter"), KeyResult::Handled);
        assert_eq!(b.meta("a").url, "https://example.com/");
        frame(&mut b, &[("a", F)], false);
        assert_eq!(
            take(&calls),
            [
                "a create https://example.com/ zoom 1",
                "a frame 10,20,300,200",
                "a zoom 1",
                "a show",
                "a focus"
            ]
        );
        b.address_change("a", "hello world");
        b.address_key("a", "Enter");
        assert_eq!(
            take(&calls),
            ["a go https://www.google.com/search?q=hello+world"]
        );
    }

    #[test]
    fn address_arrows_pick_rows_and_escape_closes_then_restores() {
        let (mut b, _) = browsers();
        b.ensure("a", "https://start.test/");
        b.address_focus("a");
        b.address_key("a", "ArrowDown");
        assert_eq!(
            b.typed("a").as_deref(),
            Some(""),
            "↓ opens the list of recent pages"
        );
        b.set_history(
            "a",
            "",
            vec![HistoryEntry {
                url: "https://h.test/".into(),
                title: "H".into(),
            }],
        );
        b.address_change("a", "h");
        b.set_history("a", "", vec![]);
        assert_eq!(b.rows("a").len(), 1, "an answer for older text is dropped");
        b.set_history(
            "a",
            "h",
            vec![HistoryEntry {
                url: "https://h.test/".into(),
                title: "H".into(),
            }],
        );
        assert_eq!(b.rows("a").len(), 2);
        b.address_key("a", "ArrowDown");
        b.address_key("a", "ArrowDown");
        assert_eq!(b.picked("a"), Some(1));
        b.address_key("a", "ArrowDown");
        assert_eq!(b.picked("a"), Some(0), "wraps");
        b.address_key("a", "ArrowUp");
        assert_eq!(b.picked("a"), Some(1));
        b.address_key("a", "Escape");
        assert!(b.rows("a").is_empty(), "first Escape closes the list");
        assert_eq!(b.address("a").unwrap().draft, "h");
        b.address_key("a", "Escape");
        assert_eq!(
            b.address("a").unwrap().draft,
            "https://start.test/",
            "second restores the address"
        );
        assert_eq!(b.address_key("a", "x"), KeyResult::Pass);
    }

    #[test]
    fn suggestions_only_when_turned_on() {
        let (mut b, _) = browsers();
        b.ensure("a", "");
        b.address_change("a", "perch");
        b.set_suggestions("a", "perch", vec!["perch fish".into()]);
        assert_eq!(b.rows("a").len(), 1);
        b.prefs.suggestions = true;
        assert_eq!(b.rows("a")[1].kind, "suggest");
    }

    #[test]
    fn location_follows_the_page_but_not_while_typing() {
        let (mut b, _) = browsers();
        b.ensure("a", "https://a.test/");
        let at = |url: &str, title: &str| PageEvent::Location {
            url: url.into(),
            title: title.into(),
            icon: "javascript:x".into(),
        };
        b.on_event("a", at("https://a.test/2", "Two"));
        assert_eq!(
            b.meta("a"),
            PageMeta {
                url: "https://a.test/2".into(),
                title: "Two".into(),
                icon: String::new()
            }
        );
        assert_eq!(b.address("a").unwrap().draft, "https://a.test/2");
        b.address_focus("a");
        b.address_change("a", "typing");
        b.on_event("a", at("https://a.test/3", ""));
        assert_eq!(b.address("a").unwrap().draft, "typing");
        b.on_event("a", at("javascript:alert(1)", ""));
        assert_eq!(
            b.meta("a").url,
            "https://a.test/3",
            "a refused address is not kept"
        );
    }

    #[test]
    fn drawer_pages_open_select_close_and_close_all() {
        let (mut b, calls) = browsers();
        let one = b.drawer_open("w");
        let two = b.drawer_open("w");
        b.drawer_open("other");
        assert_eq!(b.drawer_shown("w").as_deref(), Some(two.as_str()));
        b.drawer_select("w", &one);
        assert_eq!(b.drawer_shown("w").as_deref(), Some(one.as_str()));
        b.go(&drawer_key(&one), "https://one.test/");
        frame(&mut b, &[(&drawer_key(&one), F)], false);
        b.ensure("tab", "https://tab.test/");
        frame(&mut b, &[("tab", F)], false);
        take(&calls);
        b.drawer_close_all("w", &["tab".to_string()]);
        assert!(b.drawer_pages("w").is_empty());
        assert_eq!(b.drawer_pages("other").len(), 1);
        assert_eq!(b.live_views(), 0);
        assert_eq!(
            take(&calls),
            [format!("drawer\n{one} close"), "tab close".to_string()]
        );
    }

    #[test]
    fn pages_and_last_address_survive_a_reload_of_browser_json() {
        let dir = std::env::temp_dir().join(format!("perch-browser-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("browser.json");
        let _ = std::fs::remove_file(&file);
        let (b, _) = browsers();
        let mut b = b.kept_in(file.clone());
        let id = b.drawer_open("w");
        b.go(&drawer_key(&id), "https://kept.test/");
        b.on_event(
            &drawer_key(&id),
            PageEvent::Location {
                url: "https://kept.test/x".into(),
                title: "Kept".into(),
                icon: "https://kept.test/i.png".into(),
            },
        );
        b.ensure("blank", "");
        // A tampered address does not come back.
        let mut kept: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&file).unwrap()).unwrap();
        kept["pages"]["evil"] =
            serde_json::json!({"url": "javascript:alert(1)", "title": "", "icon": "javascript:x"});
        std::fs::write(&file, serde_json::to_vec(&kept).unwrap()).unwrap();
        let (again, _) = browsers();
        let again = again.kept_in(file.clone());
        assert_eq!(again.drawer_pages("w")[0].url, "https://kept.test/x");
        assert_eq!(again.meta(&drawer_key(&id)).title, "Kept");
        assert_eq!(again.meta("evil").url, "");
        assert_eq!(again.meta("evil").icon, "");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn only_web_blank_and_existing_local_files_navigate() {
        let file = std::env::temp_dir().join(format!("perch-nav-{}.html", std::process::id()));
        std::fs::write(&file, "<p>hi</p>").unwrap();
        let path = file.to_str().unwrap();
        assert!(navigable("https://example.com/"));
        assert!(navigable("http://localhost:3000/"));
        assert!(navigable("about:blank"));
        assert!(navigable(&format!("file://{path}")));
        assert!(
            navigable(path),
            "a bare absolute path as an agent prints it"
        );
        for refused in [
            "javascript:alert(1)",
            "data:text/html,x",
            "perch://open",
            "file:///no/such/file.html",
            "file://server/x.html",
            "about:config",
            "ftp://x/",
        ] {
            assert!(!navigable(refused), "{refused}");
        }
        std::fs::remove_file(&file).unwrap();
        let (mut b, calls) = browsers();
        b.ensure("a", "https://a.test/");
        frame(&mut b, &[("a", F)], false);
        take(&calls);
        b.go("a", "javascript:alert(1)");
        assert!(take(&calls).is_empty());
    }
}
