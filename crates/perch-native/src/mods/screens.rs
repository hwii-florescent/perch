//! Screens: the parts of the window a mod may draw instead of the Rust view.
//!
//! Each screen has the id of the web's stock screen it stands for (`packages/web/src/stock-ui/<id>`).
//! When a stock or user mod with that id exists, the window places the mod there; otherwise the
//! Rust view stays, and with no screen mods the window draws exactly as it did. Two kinds:
//!
//! - in flow, a region of the layout: `sidebar`, `tabs`, `status`, `pane-header` (one copy per
//!   pane, keyed `pane-header#<tab id>`, while the area is split), `start` (the main area while
//!   nothing is open in it), `folder-browser` (the sidebar draws its own copy in its Add project
//!   dialog) and `worktree` (the sidebar draws its own copy on each git project's row), which the
//!   window places nowhere yet, and over each terminal on screen `agent-control` (keyed
//!   `agent-control#<tab id>`, while the agent has a chip, an error or an ended banner),
//!   `terminal-search` (`terminal-search#<tab id>`, while its find is open) and `phone-size`
//!   (`phone-size#<tab id>`, while a phone holds its size and this window may take it back), and
//!   `files`: the explorer in the drawer's Files tab (`files#drawer`) and a file's editor in each
//!   file tab's pane (`files#<tab id>`);
//! - floating, opened by the window over the whole of it, as the web's take the whole page:
//!   `navigator`, `pane-menu`, `tab-menu`, `confirm`, `dialog`, `new-session`, `session-split`,
//!   `keybind-help`, `launcher`, `instructions`, `memory`, `context-bridge` (modal), `toast` and `tab-drag`
//!   (not modal: shown while there are notifications).
//!
//! A screen gets its arguments from `perch.props()` (the web's prop names, with each callback
//! replaced by a result) and a floating one closes itself with `perch.close(result)`. A dismissal
//! is the result `null`. The terminal is always Rust.
//!
//! A floating screen places its own panel and draws its own backdrop, from its props (a menu's
//! `x`, `y`, the New session panel's `anchorRect`) and `viewport`, the window's size, which the
//! window adds to every floating screen's props (the web's `window.innerWidth/innerHeight`). It
//! also closes itself on a press outside its panel, as the web's do: a backdrop that calls
//! `perch.close()`, or `on_mouse_down_out` on a menu's panel. The window keeps two things: under
//! a modal screen nothing beneath takes the mouse, and Escape dismisses it (unless its props say
//! `busy`), giving the keyboard back to what had it. Under the toast the window takes nothing:
//! presses, scrolls and keys reach what is beneath except where the mod's own elements stop them
//! (`cx.stop_propagation()` in `on_mouse_down`, as a DOM element that takes pointer events does).
//!
//! An in-flow screen's box is its default size here, or `"screen": {"width", "height"}` in its
//! `mod.json`.
//!
//! A copy that leaves the window (a floating screen closed or opened again, a pane's header when
//! its split ends) gets its final call, `View.close`, at the next draw, and the engine then
//! releases it (`ShellRuntime::close`, as gpui-kit's own hosts do).

use super::perch::Perch;
use super::{ModHost, ModView, WindowMods, POLL};
use crate::workspace::Workspace;
use gpui::{App, Context, Entity, FocusHandle, Pixels, Point, Window};
use serde_json::Value;
use std::cell::RefCell;
use std::collections::HashMap;
use std::time::{Duration, Instant};

/// How a pane header is laid out (`usePaneLook`). The native window has no layouts to change it.
pub const PANE_HEADER_HEIGHT: f32 = 28.;

/// Where a screen goes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Place {
    /// A region of the layout.
    InFlow,
    /// Over the whole window. A modal one takes the keyboard, and the mouse from what is beneath.
    Floating { modal: bool },
}

pub struct Screen {
    pub id: &'static str,
    pub place: Place,
    /// Logical size in flow; `0` is "the region's" (a sidebar's height, a strip's width). A
    /// floating screen has the whole window.
    pub width: f32,
    pub height: f32,
}

const MODAL: Place = Place::Floating { modal: true };

/// Every screen a mod can take, in the order the web's are ported.
pub const SCREENS: &[Screen] = &[
    // Settings: the web's page over the whole window (`SettingsPage`), its pages drawn inside it.
    Screen {
        id: "settings",
        place: MODAL,
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "sidebar",
        place: Place::InFlow,
        width: 240.,
        height: 0.,
    },
    Screen {
        id: "tabs",
        place: Place::InFlow,
        width: 0.,
        height: crate::workspace::TAB_BAR_HEIGHT,
    },
    Screen {
        id: "status",
        place: Place::InFlow,
        width: 0.,
        height: 24.,
    },
    Screen {
        id: "navigator",
        place: MODAL,
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "pane-header",
        place: Place::InFlow,
        width: 0.,
        height: PANE_HEADER_HEIGHT,
    },
    Screen {
        id: "pane-menu",
        place: MODAL,
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "tab-menu",
        place: MODAL,
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "confirm",
        place: MODAL,
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "dialog",
        place: MODAL,
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "toast",
        place: Place::Floating { modal: false },
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "new-session",
        place: MODAL,
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "session-split",
        place: MODAL,
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "tab-drag",
        place: Place::Floating { modal: false },
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "keybind-help",
        place: MODAL,
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "launcher",
        place: MODAL,
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "start",
        place: Place::InFlow,
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "folder-browser",
        place: Place::InFlow,
        width: 480.,
        height: 416.,
    },
    Screen {
        id: "worktree",
        place: Place::InFlow,
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "terminal-search",
        place: Place::InFlow,
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "phone-size",
        place: Place::InFlow,
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "browser",
        place: Place::InFlow,
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "browser-toolbar",
        place: Place::InFlow,
        width: 0.,
        height: 43.,
    },
    Screen {
        id: "agent-control",
        place: Place::InFlow,
        width: 0.,
        height: 0.,
    },
    // Files (`stock:files`): the explorer in the drawer's Files tab (`files#drawer`) and a file's
    // editor in each file tab's pane (`files#<tab id>`).
    Screen {
        id: "files",
        place: Place::InFlow,
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "instructions",
        place: MODAL,
        width: 0.,
        height: 0.,
    },
    Screen {
        id: "memory",
        place: MODAL,
        width: 0.,
        height: 0.,
    },
    // Context Bridge: the terminal selection's Ask agent menu and the dialog over the whole window.
    Screen {
        id: "context-bridge",
        place: MODAL,
        width: 0.,
        height: 0.,
    },
];

pub fn screen(id: &str) -> Option<&'static Screen> {
    SCREENS.iter().find(|s| s.id == id)
}

/// Screen `id`'s box as `host` has its mod: the mod's `"screen"` in `mod.json`, else the default.
pub fn size_in(host: &ModHost, id: &str) -> (f32, f32) {
    let screen = screen(id).expect("a known screen");
    let manifest = host
        .find(id)
        .map(|info| info.manifest["screen"].clone())
        .unwrap_or_default();
    let side = |key: &str, default: f32| {
        manifest[key]
            .as_f64()
            .filter(|v| *v > 0.)
            .map_or(default, |v| v as f32)
    };
    (side("width", screen.width), side("height", screen.height))
}

/// `props` with the window's size as `viewport`, which a floating screen places itself by.
pub fn with_viewport(props: &Value, (width, height): (f32, f32)) -> Value {
    let mut props = match props {
        Value::Object(_) => props.clone(),
        _ => Value::Object(Default::default()),
    };
    props["viewport"] = serde_json::json!({ "width": width, "height": height });
    props
}

/// What runs when a floating screen closes, with its result (`null` when it was dismissed).
pub type OnResult = Box<dyn FnOnce(&mut Workspace, Value, &mut Window, &mut Context<Workspace>)>;

/// A floating screen the window opened.
pub struct Floating {
    pub id: &'static str,
    /// The point it was opened at, in window coordinates (a menu's props say it too).
    pub at: Option<Point<Pixels>>,
    /// Made at the first draw after opening: a view needs the window.
    pub view: Option<Entity<ModView>>,
    pub on_result: Option<OnResult>,
    /// What had the keyboard when a modal one opened, given it back on close.
    pub focus_back: Option<FocusHandle>,
    /// The screen wants Escape for itself (a search text to clear, a key being recorded): the window
    /// leaves it to the screen instead of dismissing it.
    pub takes_escape: bool,
    props: Value,
}

impl Floating {
    pub fn modal(&self) -> bool {
        matches!(
            screen(self.id).map(|s| s.place),
            Some(Place::Floating { modal: true })
        )
    }

    /// Escape may dismiss it: not while its props say it is `busy` (a confirmation whose action
    /// is under way), as the web's confirmation ignores Escape then.
    pub fn dismissable(&self) -> bool {
        self.props.get("busy") != Some(&Value::Bool(true))
    }
}

/// The window's screens: which mods exist, the in-flow copies on screen and the floating ones open.
#[derive(Default)]
pub struct Screens {
    /// Whether each screen's mod was found, at which [`ModHost::files_generation`] and when.
    present: RefCell<HashMap<&'static str, (bool, u64, Instant)>>,
    inflow: HashMap<String, Entity<ModView>>,
    pub floating: Vec<Floating>,
    /// Copies that left the window since the last draw, closed at the next (closing needs the window).
    leaving: Vec<Entity<ModView>>,
    /// The window's size at the last draw, in every floating screen's props.
    viewport: (f32, f32),
}

/// How long a copy that leaves the window has for its final call (`View.close`).
pub(super) const CLOSE_DEADLINE: Duration = Duration::from_millis(250);

/// Gives a copy that left the window its final call and lets the engine release it, as gpui-kit's
/// own hosts do (`ShellRuntime::close`). Dropping the view alone releases it without that call, so
/// the script never learns the copy went and keeps what it made for it (a mounted React tree, its
/// listeners) for as long as the window lives.
fn close_copy(view: &Entity<ModView>, window: &mut Window, cx: &mut App) {
    let view = view.read(cx);
    let Some(root) = view.shown.as_ref().map(|shown| shown.root.clone()) else {
        return;
    };
    let runtime = view.host.0.runtime.clone();
    runtime
        .close(&root, Instant::now() + CLOSE_DEADLINE, window, cx)
        .detach();
}

/// The window's mod host and `perch` module, when the engine was started for it.
pub fn mods(cx: &App) -> Option<(ModHost, Perch)> {
    let mods = cx.try_global::<WindowMods>()?;
    Some((mods.host.clone(), mods.perch.clone()))
}

impl Screens {
    /// Whether a mod draws screen `id` now.
    pub fn has(&self, id: &str, cx: &App) -> bool {
        let Some(screen) = screen(id) else {
            return false;
        };
        let Some((host, _)) = mods(cx) else {
            return false;
        };
        let mut present = self.present.borrow_mut();
        let generation = host.files_generation();
        if let Some((found, seen, at)) = present.get(screen.id) {
            // A watched host says when files change; a test's host is looked at every POLL.
            let fresh = if host.is_watched() {
                *seen == generation
            } else {
                at.elapsed() < POLL
            };
            if fresh {
                return *found;
            }
        }
        let found = host.find(screen.id).is_some();
        present.insert(screen.id, (found, generation, Instant::now()));
        found
    }

    /// Screen `id`'s box: the mod's `"screen"` in `mod.json`, else the default.
    pub fn size(&self, id: &str, cx: &App) -> (f32, f32) {
        let screen = screen(id).expect("a known screen");
        mods(cx).map_or((screen.width, screen.height), |(host, _)| {
            size_in(&host, id)
        })
    }

    /// The in-flow copy `key` on screen, when there is one.
    pub fn inflow(&self, key: &str) -> Option<Entity<ModView>> {
        self.inflow.get(key).cloned()
    }

    /// Keeps exactly the in-flow copies `wanted` (`(screen id, key, props)`): makes the missing
    /// ones, hands each its props and lets the others go.
    pub fn place(&mut self, wanted: Vec<(&str, String, Value)>, window: &mut Window, cx: &mut App) {
        let Some((host, perch)) = mods(cx) else {
            return;
        };
        let leaving = &mut self.leaving;
        self.inflow.retain(|key, view| {
            let keep = wanted.iter().any(|(_, k, _)| k == key);
            if !keep {
                perch.clear_props(key);
                leaving.push(view.clone());
            }
            keep
        });
        for view in std::mem::take(&mut self.leaving) {
            close_copy(&view, window, cx);
        }
        for (id, key, props) in wanted {
            perch.set_props(&key, props);
            if let std::collections::hash_map::Entry::Vacant(slot) = self.inflow.entry(key) {
                let view = host.view_keyed(id, slot.key(), window, cx);
                slot.insert(view);
            }
        }
        perch.flush(cx);
    }

    /// Opens floating screen `id` with `props`; `on_result` runs when it closes. False when no mod
    /// draws it (the caller keeps its Rust view). One copy of a screen is open at a time: opening
    /// it again replaces the open one, whose result is dropped.
    pub fn open(
        &mut self,
        id: &str,
        props: Value,
        at: Option<Point<Pixels>>,
        on_result: Option<OnResult>,
        cx: &mut App,
    ) -> bool {
        if !self.has(id, cx) {
            return false;
        }
        let screen = screen(id).expect("a known screen");
        let props = with_viewport(&props, self.viewport);
        let focus_back = self
            .floating
            .iter()
            .position(|f| f.id == screen.id)
            .and_then(|at| {
                let replaced = self.floating.remove(at);
                self.leaving.extend(replaced.view);
                replaced.focus_back
            });
        if let Some((_, perch)) = mods(cx) {
            perch.set_props(screen.id, props.clone());
            perch.flush(cx);
        }
        self.floating.push(Floating {
            id: screen.id,
            at,
            view: None,
            on_result,
            focus_back,
            takes_escape: false,
            props,
        });
        true
    }

    /// Changes an open screen's props; it re-renders.
    pub fn update(&mut self, id: &str, props: Value, cx: &mut App) -> bool {
        let Some(open) = self.floating.iter_mut().find(|f| f.id == id) else {
            return false;
        };
        let props = with_viewport(&props, self.viewport);
        open.props = props.clone();
        if let Some((_, perch)) = mods(cx) {
            perch.set_props(id, props);
            perch.flush(cx);
        }
        true
    }

    /// The props an open screen has, `viewport` with them.
    pub fn props(&self, id: &str) -> Option<&Value> {
        self.floating.iter().find(|f| f.id == id).map(|f| &f.props)
    }

    /// Makes the views of screens opened since the last draw, and keeps their `viewport` the
    /// window's size. A modal one takes the keyboard from whatever had it (giving it to `layer`),
    /// which gets it back on close.
    pub fn realize(&mut self, layer: &FocusHandle, window: &mut Window, cx: &mut App) {
        let Some((host, perch)) = mods(cx) else {
            return;
        };
        for view in std::mem::take(&mut self.leaving) {
            close_copy(&view, window, cx);
        }
        let size = window.viewport_size();
        let viewport = (f32::from(size.width), f32::from(size.height));
        if viewport != self.viewport {
            self.viewport = viewport;
            perch.set_viewport(viewport);
            for open in &mut self.floating {
                open.props = with_viewport(&open.props, viewport);
                perch.set_props(open.id, open.props.clone());
            }
            perch.flush(cx);
        }
        for open in self.floating.iter_mut().filter(|f| f.view.is_none()) {
            open.view = Some(host.view(open.id, window, cx));
            if open.modal() {
                if open.focus_back.is_none() {
                    open.focus_back = window.focused(cx);
                }
                layer.focus(window, cx);
            }
        }
    }

    /// Takes the open screen `id` out, its props with it.
    pub fn take(&mut self, id: &str, cx: &mut App) -> Option<Floating> {
        let at = self.floating.iter().position(|f| f.id == id)?;
        if let Some((_, perch)) = mods(cx) {
            perch.clear_props(id);
        }
        let mut open = self.floating.remove(at);
        self.leaving.extend(open.view.take());
        Some(open)
    }

    /// Whether Escape may dismiss open screen `id` now.
    pub fn dismissable(&self, id: &str) -> bool {
        self.floating
            .iter()
            .find(|f| f.id == id)
            .is_none_or(Floating::dismissable)
    }

    pub fn is_open(&self, id: &str) -> bool {
        self.floating.iter().any(|f| f.id == id)
    }

    /// The modal screen on top, which the keyboard belongs to.
    pub fn top_modal(&self) -> Option<&'static str> {
        self.floating.iter().rev().find(|f| f.modal()).map(|f| f.id)
    }

    /// Why screen `id` is not drawn as its mod means: the mod would not load, its last render threw, or a call into
    /// it was stopped past its time budget. A floating screen when open, else every in-flow copy of it (`files`,
    /// `files#drawer`, `files#<tab id>`), each error after its key.
    pub fn error(&self, id: &str, cx: &App) -> Option<String> {
        if let Some(open) = self.floating.iter().find(|f| f.id == id) {
            return open.view.as_ref()?.read(cx).error(cx);
        }
        let mut errors: Vec<String> = self
            .inflow
            .iter()
            .filter(|(key, _)| {
                *key == id || key.strip_prefix(id).is_some_and(|k| k.starts_with('#'))
            })
            .filter_map(|(key, view)| Some(format!("{key:?}: {}", view.read(cx).error(cx)?)))
            .collect();
        errors.sort();
        (!errors.is_empty()).then(|| errors.join("\n"))
    }

    /// Whether open screen `id` keeps Escape for itself.
    pub fn takes_escape(&self, id: &str) -> bool {
        self.floating.iter().any(|f| f.id == id && f.takes_escape)
    }

    /// Screen `id` keeps Escape for itself (`held`), or gives it back to the window.
    pub fn set_takes_escape(&mut self, id: &str, held: bool) {
        if let Some(open) = self.floating.iter_mut().find(|f| f.id == id) {
            open.takes_escape = held;
        }
    }
}
