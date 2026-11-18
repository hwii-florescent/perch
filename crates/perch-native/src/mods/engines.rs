//! Engine slots: native elements a React screen places by key. A screen marks a box with
//! `data-perch-engine="<kind>" data-perch-key="<key>"`; the runtime describes it as
//! `{ kind: "engine", engine, key, style }` and draws the box holding `Engine.new(key, { engine })` from the
//! `perch-engine` module. The engine's state lives here in Rust by key, so a re-render, a re-key or a screen reload
//! never loses it; the component only looks the state up each frame.
//!
//! A kind ([`EngineKind`]) gives three things: [`EngineKind::draw`] (the element for a key; an unknown key draws an
//! empty box), [`EngineKind::release`] (the screen let the key go: unmounted or re-keyed; a kind may park rather than
//! drop) and [`EngineKind::focus_handle`] (the GPUI focus of the key, for the focus hand-off). Kinds are registered
//! once per window ([`Engines::register`]); phases add theirs (`editor` here, `diff` for review).
//!
//! Focus hand-off: GPUI focus is the truth. `focus(engine, key)` moves it onto the engine (a screen's `ref.focus()`);
//! `focused()` says which engine key holds it (`{ engine, key }` or null), which the screen reads each frame to keep
//! its document's `activeElement` on the engine's node. A key that reaches the screen's own key handler while the
//! screen's focus handle is not itself focused came from an engine inside it and is not sent to the React tree.

use gpui::{prelude::*, AnyElement, App, FocusHandle, Window};
use gpui_shell::{HostError, HostModule, HostValue};
use std::cell::RefCell;
use std::collections::{BTreeMap, HashSet};
use std::rc::Rc;

/// The module's TypeScript face.
const DECLARATIONS: &str =
    "export const Engine: { new(key: string, props: { engine: string }): any };
export function focus(engine: string, key: string): boolean;
export function focused(): { engine: string; key: string } | null;
export function release(engine: string, key: string): void;
export function kinds(): string[];";

/// One kind of engine a screen can place.
pub trait EngineKind {
    /// The element for `key`, filling its box. A key with no state draws an empty box.
    fn draw(&self, key: &str, window: &mut Window, cx: &mut App) -> AnyElement;
    /// The screen let `key` go (unmounted or re-keyed). Default: nothing.
    fn release(&self, _key: &str, _cx: &mut App) {}
    /// The focus handle of `key`'s element, when it can take the keyboard.
    fn focus_handle(&self, _key: &str, _cx: &App) -> Option<FocusHandle> {
        None
    }
}

#[derive(Default)]
struct Shared {
    kinds: BTreeMap<String, Rc<dyn EngineKind>>,
    /// Keys drawn since the window started, by kind: where `focused()` looks.
    drawn: BTreeMap<String, HashSet<String>>,
    /// Unknown kinds already reported.
    reported: HashSet<String>,
}

/// The engine kinds of one window. Cheap to clone.
#[derive(Clone, Default)]
pub struct Engines(Rc<RefCell<Shared>>);

impl Engines {
    /// Makes `kind` placeable as `data-perch-engine="<name>"`. A later registration of the same name replaces it.
    pub fn register(&self, name: &str, kind: impl EngineKind + 'static) {
        self.0
            .borrow_mut()
            .kinds
            .insert(name.to_string(), Rc::new(kind));
    }

    /// Lends `perch-engine` to every mod `host` loads from now on.
    pub fn lend(&self, host: &super::ModHost) {
        let engines = self.clone();
        host.register_module(move |_| engines.module());
    }

    fn kind(&self, name: &str) -> Option<Rc<dyn EngineKind>> {
        self.0.borrow().kinds.get(name).cloned()
    }

    /// The element for `key` of kind `engine`, in a box that fills its slot.
    pub fn draw(&self, engine: &str, key: &str, window: &mut Window, cx: &mut App) -> AnyElement {
        let Some(kind) = self.kind(engine) else {
            if self.0.borrow_mut().reported.insert(engine.to_string()) {
                eprintln!("perch-native: no engine kind {engine:?} is registered");
            }
            return gpui::div().size_full().into_any_element();
        };
        self.0
            .borrow_mut()
            .drawn
            .entry(engine.to_string())
            .or_default()
            .insert(key.to_string());
        gpui::div()
            .size_full()
            .min_w_0()
            .min_h_0()
            .child(kind.draw(key, window, cx))
            .into_any_element()
    }

    /// The screen let `key` go.
    pub fn release(&self, engine: &str, key: &str, cx: &mut App) {
        if let Some(set) = self.0.borrow_mut().drawn.get_mut(engine) {
            set.remove(key);
        }
        if let Some(kind) = self.kind(engine) {
            kind.release(key, cx);
        }
    }

    /// Moves the keyboard onto `key`; false when it cannot take it.
    pub fn focus(&self, engine: &str, key: &str, window: &mut Window, cx: &mut App) -> bool {
        let Some(handle) = self.kind(engine).and_then(|k| k.focus_handle(key, cx)) else {
            return false;
        };
        window.focus(&handle, cx);
        true
    }

    /// The engine key that has the keyboard, if any.
    pub fn focused(&self, window: &Window, cx: &App) -> Option<(String, String)> {
        let (kinds, drawn) = {
            let shared = self.0.borrow();
            (shared.kinds.clone(), shared.drawn.clone())
        };
        for (engine, keys) in drawn {
            let Some(kind) = kinds.get(&engine) else {
                continue;
            };
            for key in keys {
                if kind
                    .focus_handle(&key, cx)
                    .is_some_and(|h| h.is_focused(window))
                {
                    return Some((engine, key));
                }
            }
        }
        None
    }

    fn module(&self) -> HostModule {
        let pair = |args: &gpui_shell::HostArguments| -> Result<(String, String), HostError> {
            Ok((args.string(0)?.to_string(), args.string(1)?.to_string()))
        };
        let current = |what: &str| HostError::new(format!("{what} is only callable from a mod"));
        let draw = self.clone();
        let focus = self.clone();
        let focused = self.clone();
        let release = self.clone();
        let kinds = self.clone();
        HostModule::new("perch-engine")
            .declarations(DECLARATIONS)
            .component("Engine", move |args, window, cx| {
                let engine = args
                    .props()
                    .get("engine")
                    .and_then(HostValue::as_str)
                    .unwrap_or("");
                draw.draw(engine, args.id(), window, cx)
            })
            .function("focus", move |args| {
                let (engine, key) = pair(args)?;
                gpui_shell::with_current(|window, cx| focus.focus(&engine, &key, window, cx))
                    .map(HostValue::Bool)
                    .ok_or_else(|| current("focus"))
            })
            .function("focused", move |_| {
                gpui_shell::with_current(|window, cx| focused.focused(window, cx))
                    .ok_or_else(|| current("focused"))
                    .map(|found| match found {
                        Some((engine, key)) => HostValue::Object(vec![
                            ("engine".into(), engine.into()),
                            ("key".into(), key.into()),
                        ]),
                        None => HostValue::Null,
                    })
            })
            .function("release", move |args| {
                let (engine, key) = pair(args)?;
                gpui_shell::with_current(|_, cx| release.release(&engine, &key, cx))
                    .ok_or_else(|| current("release"))?;
                Ok(HostValue::Null)
            })
            .function("kinds", move |_| {
                Ok(HostValue::Array(
                    kinds
                        .0
                        .borrow()
                        .kinds
                        .keys()
                        .map(|k| HostValue::from(k.clone()))
                        .collect(),
                ))
            })
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn declarations_and_exports_agree() {
        super::Engines::default()
            .module()
            .validate()
            .expect("declarations and exports agree");
    }
}

/// A trivial kind for tests and for screens built before their engine: a box per key that takes the keyboard on a
/// press and counts the keys it hears (`keys(key)`), and remembers which keys were released.
#[derive(Clone, Default)]
pub struct StubEngine(Rc<RefCell<StubState>>);

#[derive(Default)]
struct StubState {
    focus: BTreeMap<String, FocusHandle>,
    keys: BTreeMap<String, usize>,
    draws: BTreeMap<String, usize>,
    released: Vec<String>,
}

impl StubEngine {
    /// Keys `key` heard while focused.
    pub fn keys(&self, key: &str) -> usize {
        self.0.borrow().keys.get(key).copied().unwrap_or(0)
    }
    /// Frames that drew `key`.
    pub fn draws(&self, key: &str) -> usize {
        self.0.borrow().draws.get(key).copied().unwrap_or(0)
    }
    /// Keys released, in order.
    pub fn released(&self) -> Vec<String> {
        self.0.borrow().released.clone()
    }
}

impl EngineKind for StubEngine {
    fn draw(&self, key: &str, _window: &mut Window, cx: &mut App) -> AnyElement {
        *self
            .0
            .borrow_mut()
            .draws
            .entry(key.to_string())
            .or_default() += 1;
        let handle = self
            .0
            .borrow_mut()
            .focus
            .entry(key.to_string())
            .or_insert_with(|| cx.focus_handle())
            .clone();
        let (pressed, typed, key) = (handle.clone(), self.clone(), key.to_string());
        gpui::div()
            .id(gpui::SharedString::from(format!("stub-engine:{key}")))
            .size_full()
            .track_focus(&handle)
            .on_mouse_down(gpui::MouseButton::Left, move |_, window, cx| {
                window.focus(&pressed, cx);
                cx.stop_propagation();
            })
            .on_key_down(move |_, _, cx| {
                *typed.0.borrow_mut().keys.entry(key.clone()).or_default() += 1;
                cx.stop_propagation();
            })
            .into_any_element()
    }

    fn release(&self, key: &str, _cx: &mut App) {
        let mut state = self.0.borrow_mut();
        state.focus.remove(key);
        state.released.push(key.to_string());
    }

    fn focus_handle(&self, key: &str, _cx: &App) -> Option<FocusHandle> {
        self.0.borrow().focus.get(key).cloned()
    }
}
