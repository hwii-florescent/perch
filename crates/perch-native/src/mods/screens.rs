//! Screens: the parts of the window a mod may draw instead of the Rust view.
//!
//! Each screen has the id of the web's stock screen it stands for (`packages/web/src/stock-ui/<id>`).
//! When a stock or user mod with that id exists, the window places the mod there; otherwise the
//! Rust view stays, and with no screen mods the window draws exactly as it did. Two kinds:
//!
//! - in flow, a region of the layout: `sidebar`, `tabs`, `status`, `pane-header` (one copy per
//!   pane, keyed `pane-header#<tab id>`, while the area is split);
//! - floating, opened by the window over it: `navigator`, `pane-menu`, `tab-menu`, `confirm`,
//!   `dialog`, `new-session` (modal: Escape or a press outside dismisses them, handled once by the
//!   window, and the keyboard goes back to where it was on close) and `toast` (not modal: shown
//!   while there are notifications).
//!
//! A screen gets its arguments from `perch.props()` (the web's prop names, with each callback
//! replaced by a result) and a floating one closes itself with `perch.close(result)`. A dismissal
//! is the result `null`. The terminal is always Rust.
//!
//! A screen's box is its default size here, or `"screen": {"width", "height"}` in its `mod.json`.

use super::perch::Perch;
use super::{ModHost, ModView, WindowMods, POLL};
use crate::workspace::Workspace;
use gpui::{App, Context, Entity, FocusHandle, Pixels, Point, Window};
use serde_json::Value;
use std::cell::RefCell;
use std::collections::HashMap;
use std::time::Instant;

/// How a pane header is laid out (`usePaneLook`). The native window has no layouts to change it.
pub const PANE_HEADER_HEIGHT: f32 = 28.;

/// Where a screen goes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Place {
    /// A region of the layout.
    InFlow,
    /// Over the window. A modal one takes the keyboard and is dismissed by Escape or a press
    /// outside; an anchored one opens at a point (a menu), the others centred near the top.
    Floating { modal: bool, anchored: bool },
}

pub struct Screen {
    pub id: &'static str,
    pub place: Place,
    /// Logical size; `0` in flow is "the region's" (a sidebar's height, a strip's width).
    pub width: f32,
    pub height: f32,
}

const MODAL: Place = Place::Floating {
    modal: true,
    anchored: false,
};
const MENU: Place = Place::Floating {
    modal: true,
    anchored: true,
};

/// Every screen a mod can take, in the order the web's are ported.
pub const SCREENS: &[Screen] = &[
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
        width: 560.,
        height: 420.,
    },
    Screen {
        id: "pane-header",
        place: Place::InFlow,
        width: 0.,
        height: PANE_HEADER_HEIGHT,
    },
    Screen {
        id: "pane-menu",
        place: MENU,
        width: 220.,
        height: 320.,
    },
    Screen {
        id: "tab-menu",
        place: MENU,
        width: 220.,
        height: 320.,
    },
    Screen {
        id: "confirm",
        place: MODAL,
        width: 420.,
        height: 160.,
    },
    Screen {
        id: "dialog",
        place: MODAL,
        width: 520.,
        height: 420.,
    },
    Screen {
        id: "toast",
        place: Place::Floating {
            modal: false,
            anchored: false,
        },
        width: 360.,
        height: 96.,
    },
    Screen {
        id: "new-session",
        place: MENU,
        width: 280.,
        height: 360.,
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

/// Where the window puts floating screen `id`'s `size` box in a `viewport`, as its top-left
/// corner: an anchored one at `at`, moved in to stay inside; a notification under the tab strip
/// at the right; the others centred, near the top.
pub fn origin(
    id: &str,
    at: Option<Point<Pixels>>,
    (width, height): (f32, f32),
    (vw, vh): (f32, f32),
) -> (f32, f32) {
    let place = screen(id).map(|s| s.place);
    match (place, at) {
        (Some(Place::Floating { anchored: true, .. }), Some(at)) => (
            f32::from(at.x).min(vw - width).max(0.),
            f32::from(at.y).min(vh - height).max(0.),
        ),
        (Some(Place::Floating { modal: false, .. }), _) => {
            (vw - width - 12., crate::workspace::TAB_BAR_HEIGHT + 12.)
        }
        _ => (((vw - width) / 2.).max(0.), 48.),
    }
}

/// What runs when a floating screen closes, with its result (`null` when it was dismissed).
pub type OnResult = Box<dyn FnOnce(&mut Workspace, Value, &mut Window, &mut Context<Workspace>)>;

/// A floating screen the window opened.
pub struct Floating {
    pub id: &'static str,
    /// Where an anchored one opens, in window coordinates.
    pub at: Option<Point<Pixels>>,
    pub width: f32,
    pub height: f32,
    /// Made at the first draw after opening: a view needs the window.
    pub view: Option<Entity<ModView>>,
    pub on_result: Option<OnResult>,
    /// What had the keyboard when a modal one opened, given it back on close.
    pub focus_back: Option<FocusHandle>,
    props: Value,
}

impl Floating {
    pub fn modal(&self) -> bool {
        matches!(
            screen(self.id).map(|s| s.place),
            Some(Place::Floating { modal: true, .. })
        )
    }
}

/// The window's screens: which mods exist, the in-flow copies on screen and the floating ones open.
#[derive(Default)]
pub struct Screens {
    /// Whether a mod exists for an id, and when that was looked at.
    present: RefCell<HashMap<&'static str, (bool, Instant)>>,
    inflow: HashMap<String, Entity<ModView>>,
    pub floating: Vec<Floating>,
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
        if let Some((found, at)) = present.get(screen.id) {
            if at.elapsed() < POLL {
                return *found;
            }
        }
        // ponytail: one stat per screen per POLL while drawing; a folder watcher would push it.
        let found = host.find(screen.id).is_some();
        present.insert(screen.id, (found, Instant::now()));
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
        self.inflow.retain(|key, _| {
            let keep = wanted.iter().any(|(_, k, _)| k == key);
            if !keep {
                perch.clear_props(key);
            }
            keep
        });
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
        let (width, height) = self.size(id, cx);
        let focus_back = self
            .floating
            .iter()
            .position(|f| f.id == screen.id)
            .and_then(|at| self.floating.remove(at).focus_back);
        if let Some((_, perch)) = mods(cx) {
            perch.set_props(screen.id, props.clone());
            perch.flush(cx);
        }
        self.floating.push(Floating {
            id: screen.id,
            at,
            width,
            height,
            view: None,
            on_result,
            focus_back,
            props,
        });
        true
    }

    /// Changes an open screen's props; it re-renders.
    pub fn update(&mut self, id: &str, props: Value, cx: &mut App) -> bool {
        let Some(open) = self.floating.iter_mut().find(|f| f.id == id) else {
            return false;
        };
        open.props = props.clone();
        if let Some((_, perch)) = mods(cx) {
            perch.set_props(id, props);
            perch.flush(cx);
        }
        true
    }

    /// The props an open screen was given.
    pub fn props(&self, id: &str) -> Option<&Value> {
        self.floating.iter().find(|f| f.id == id).map(|f| &f.props)
    }

    /// Makes the views of screens opened since the last draw. A modal one takes the keyboard from
    /// whatever had it (giving it to `layer`), which gets it back on close.
    pub fn realize(&mut self, layer: &FocusHandle, window: &mut Window, cx: &mut App) {
        let Some((host, _)) = mods(cx) else {
            return;
        };
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
        Some(self.floating.remove(at))
    }

    pub fn is_open(&self, id: &str) -> bool {
        self.floating.iter().any(|f| f.id == id)
    }

    /// The modal screen on top, which the keyboard and presses outside belong to.
    pub fn top_modal(&self) -> Option<&'static str> {
        self.floating.iter().rev().find(|f| f.modal()).map(|f| f.id)
    }
}
