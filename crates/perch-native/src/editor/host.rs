//! The `perch-editor` module: the native editor a screen places, as the web's `CodeEditor.tsx` gives it.
//!
//! Editors live here, in Rust, by document key, so a screen's re-render or reload never loses one: `open` makes
//! (or restores) the editor for a key, the `Editor` component draws it by that key (`Editor.new(docKey)`, a stateless
//! lookup, no props per frame), `park` keeps its whole state (text, undo history, selection, scroll; least recently
//! parked dropped past [`MAX_PARKED`]) and `release` drops it. Every other function takes the key first.
//!
//! A host function cannot hold a script callback (the boundary is plain data, `gpui_shell::host_modules`), so events
//! are queued per key and read with `events(docKey)`: `change` (a user edit; read `value`), `caret` `{line, col}`
//! (1-based), `focus`, `blur`, `contextmenu` `{x, y}`, and `save` / `goto` when Rust asks for them ([`Editors::emit`]).
//! Queuing re-renders the mod that opened the key. A store value applied with `setValue(key, text, {external:
//! true})` makes no change event and leaves no undo entry.
//!
//! No keys are bound here: save, find and go-to-line belong to the window's keymap.

use super::{highlight, theme};
use crate::mods::ModHost;
use gpui::{
    prelude::*, AnyElement, App, Entity, Focusable as _, MouseButton, SharedString, Subscription,
    Window,
};
use gpui_base::input::{
    Copy as CopyAction, Cut, Editor, EditorState, InputBase, InputEditorStyle, InputEvent, Paste,
    Position, Redo, RopeExt as _, TabSize, Undo,
};
use gpui_shell::{HostArguments, HostError, HostModule, HostResult, HostValue};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet, VecDeque};
use std::rc::Rc;

/// The module's TypeScript face, shipped beside the stock mods.
pub const DECLARATIONS: &str = include_str!("../../mods/perch-editor.d.ts");

/// Parked editors kept, as the web's `CodeEditor` keeps 32.
pub const MAX_PARKED: usize = 32;

struct Doc {
    state: Entity<EditorState>,
    /// The mod copy that opened it, re-rendered when an event is queued.
    owner: String,
    events: Vec<HostValue>,
    caret: (usize, usize),
    _subscriptions: Vec<Subscription>,
}

#[derive(Default)]
struct Shared {
    docs: HashMap<String, Doc>,
    /// Parked keys, least recently parked first.
    parked: VecDeque<String>,
    hosts: Vec<ModHost>,
    refresh_queued: HashSet<String>,
}

/// Every editor of one app, by document key. Cheap to clone.
#[derive(Clone, Default)]
pub struct Editors(Rc<RefCell<Shared>>);

impl Editors {
    /// Lends `perch-editor` to every mod `host` loads from now on.
    pub fn register(&self, host: &ModHost) {
        let editors = self.clone();
        host.register_module(move |id| editors.module(id));
        self.0.borrow_mut().hosts.push(host.clone());
    }

    /// The editor entity for `key`, for Rust callers (the keymap, tests).
    pub fn state(&self, key: &str) -> Option<Entity<EditorState>> {
        self.0.borrow().docs.get(key).map(|d| d.state.clone())
    }

    /// Queues `event` (`save`, `goto`) for `key`'s screen, as a key the window resolved asks.
    pub fn emit(&self, key: &str, event: &str, cx: &mut App) {
        self.push(key, object([("type", event.into())]), cx);
    }

    /// Keys with an editor, parked or not.
    pub fn keys(&self) -> Vec<String> {
        self.0.borrow().docs.keys().cloned().collect()
    }

    /// The events queued for `key` since the last call, oldest first.
    pub fn drain(&self, key: &str) -> Vec<HostValue> {
        let mut shared = self.0.borrow_mut();
        shared
            .docs
            .get_mut(key)
            .map(|d| std::mem::take(&mut d.events))
            .unwrap_or_default()
    }

    /// `setValue` from Rust: see [`set_value`].
    pub fn set_value(
        &self,
        key: &str,
        text: &str,
        external: bool,
        window: &mut Window,
        cx: &mut App,
    ) {
        if let Some(state) = self.state(key) {
            set_value(&state, text, external, window, cx);
        }
    }

    /// Whether `key` is parked.
    pub fn is_parked(&self, key: &str) -> bool {
        self.0.borrow().parked.iter().any(|k| k == key)
    }

    fn push(&self, key: &str, event: HostValue, cx: &mut App) {
        let owner = {
            let mut shared = self.0.borrow_mut();
            let Some(doc) = shared.docs.get_mut(key) else {
                return;
            };
            let kind = event
                .get("type")
                .and_then(HostValue::as_str)
                .map(str::to_string);
            // One change and the latest caret are all a screen needs.
            if let Some(kind) = kind.as_deref().filter(|k| *k == "change" || *k == "caret") {
                doc.events
                    .retain(|e| e.get("type").and_then(HostValue::as_str) != Some(kind));
            }
            doc.events.push(event);
            let owner = doc.owner.clone();
            if !shared.refresh_queued.insert(owner.clone()) {
                return;
            }
            owner
        };
        let editors = self.clone();
        cx.defer(move |cx| {
            let hosts = {
                let mut shared = editors.0.borrow_mut();
                shared.refresh_queued.remove(&owner);
                shared.hosts.clone()
            };
            let only = HashSet::from([owner]);
            for host in hosts {
                host.refresh(Some(&only), cx);
            }
        });
    }

    /// Opens (or restores, when its text is `options.value`) the editor for `key`, on behalf of mod copy `owner`.
    pub fn open(
        &self,
        owner: &str,
        key: &str,
        options: &HostValue,
        window: &mut Window,
        cx: &mut App,
    ) -> HostResult {
        let text = |k: &str| options.get(k).and_then(HostValue::as_str);
        let flag = |k: &str| options.get(k).and_then(HostValue::as_bool);
        let path = text("path").ok_or_else(|| HostError::new("open: options.path is required"))?;
        let value = text("value").unwrap_or("");
        let existing = self.state(key);
        let restored = existing.as_ref().is_some_and(|state| {
            state.read(cx).text().len() == value.len() && state.read(cx).value() == value
        });
        if restored {
            let mut shared = self.0.borrow_mut();
            shared.parked.retain(|k| k != key);
            if let Some(doc) = shared.docs.get_mut(key) {
                doc.owner = owner.to_string();
            }
        } else {
            self.release(key);
            let state = create(path, value, window, cx);
            let subscriptions = self.subscribe(key, &state, window, cx);
            self.0.borrow_mut().docs.insert(
                key.to_string(),
                Doc {
                    state,
                    owner: owner.to_string(),
                    events: Vec::new(),
                    caret: (1, 1),
                    _subscriptions: subscriptions,
                },
            );
        }
        let state = self.state(key).expect("just opened");
        state.update(cx, |state, cx| {
            if let Some(on) = flag("readonly") {
                state.set_readonly(on, cx);
            }
            if let Some(on) = flag("wrap") {
                state.set_soft_wrap(on, window, cx);
            }
            if let Some(on) = flag("autoClose") {
                state.set_auto_close(on, window, cx);
            }
        });
        Ok(object([("restored", restored.into())]))
    }

    fn subscribe(
        &self,
        key: &str,
        state: &Entity<EditorState>,
        window: &mut Window,
        cx: &mut App,
    ) -> Vec<Subscription> {
        let (editors, events_key) = (self.clone(), key.to_string());
        let events = cx.subscribe(state, move |state, event: &InputEvent, cx| {
            let name = match event {
                InputEvent::Change => "change",
                InputEvent::Focus => "focus",
                InputEvent::Blur => "blur",
                _ => return,
            };
            editors.push(&events_key, object([("type", name.into())]), cx);
            if matches!(event, InputEvent::Change) {
                editors.caret_moved(&events_key, &state, cx);
            }
        });
        let (editors, caret_key) = (self.clone(), key.to_string());
        let caret = cx.observe(state, move |state, cx| {
            editors.caret_moved(&caret_key, &state, cx)
        });
        let (editors, menu_key) = (self.clone(), key.to_string());
        state.update(cx, |state, _| {
            state.on_context_menu(Rc::new(move |_, _, at, _, cx| {
                let n = |v: gpui::Pixels| HostValue::Number(f64::from(f32::from(v)));
                editors.push(
                    &menu_key,
                    object([
                        ("type", "contextmenu".into()),
                        ("x", n(at.x)),
                        ("y", n(at.y)),
                    ]),
                    cx,
                );
            }));
        });
        let _ = window;
        vec![events, caret]
    }

    /// Queues a caret event when the caret moved.
    fn caret_moved(&self, key: &str, state: &Entity<EditorState>, cx: &mut App) {
        let now = caret(state.read(cx));
        let moved = {
            let mut shared = self.0.borrow_mut();
            match shared.docs.get_mut(key) {
                Some(doc) if doc.caret != now => {
                    doc.caret = now;
                    true
                }
                _ => false,
            }
        };
        if moved {
            let n = |v: usize| HostValue::Number(v as f64);
            self.push(
                key,
                object([
                    ("type", "caret".into()),
                    ("line", n(now.0)),
                    ("col", n(now.1)),
                ]),
                cx,
            );
        }
    }

    /// Keeps `key`'s editor whole but unshown; past [`MAX_PARKED`] the least recently parked is dropped.
    pub fn park(&self, key: &str) {
        let dropped = {
            let mut shared = self.0.borrow_mut();
            if !shared.docs.contains_key(key) {
                return;
            }
            shared.parked.retain(|k| k != key);
            shared.parked.push_back(key.to_string());
            let mut dropped = Vec::new();
            while shared.parked.len() > MAX_PARKED {
                if let Some(oldest) = shared.parked.pop_front() {
                    dropped.push(oldest);
                }
            }
            dropped
        };
        for key in dropped {
            self.release(&key);
        }
    }

    /// Drops `key`'s editor.
    pub fn release(&self, key: &str) {
        let doc = {
            let mut shared = self.0.borrow_mut();
            shared.parked.retain(|k| k != key);
            shared.docs.remove(key)
        };
        drop(doc);
    }

    fn with<R>(
        &self,
        key: &str,
        f: impl FnOnce(&Entity<EditorState>, &mut Window, &mut App) -> R,
    ) -> Result<R, HostError> {
        let state = self
            .state(key)
            .ok_or_else(|| HostError::new(format!("no editor is open for {key:?}")))?;
        gpui_shell::with_current(|window, cx| f(&state, window, cx))
            .ok_or_else(|| HostError::new("perch-editor is only callable from a mod"))
    }

    fn module(&self, owner: &str) -> HostModule {
        let owner: Rc<str> = owner.into();
        let e = || self.clone();
        let key = |args: &HostArguments| args.string(0).map(str::to_string);
        let null = |_| HostValue::Null;
        let action = |action: fn() -> Box<dyn gpui::Action>| {
            let editors = self.clone();
            move |args: &HostArguments| -> HostResult {
                editors
                    .with(&key(args)?, |state, window, cx| {
                        let handle = state.read(cx).focus_handle(cx);
                        handle.dispatch_action(action().as_ref(), window, cx);
                    })
                    .map(null)
            }
        };
        let (editors, open_owner) = (e(), owner.clone());
        let editors_draw = e();
        HostModule::new("perch-editor")
            .declarations(DECLARATIONS)
            .component("Editor", move |args, window, cx| {
                editors_draw.draw(args.id(), window, cx)
            })
            .function("open", move |args| {
                let key = key(args)?;
                let options = args.value(1)?.clone();
                gpui_shell::with_current(|window, cx| {
                    editors.open(&open_owner, &key, &options, window, cx)
                })
                .ok_or_else(|| HostError::new("open is only callable from a mod"))?
            })
            .function("park", {
                let editors = e();
                move |args| {
                    editors.park(&key(args)?);
                    Ok(HostValue::Null)
                }
            })
            .function("release", {
                let editors = e();
                move |args| {
                    editors.release(&key(args)?);
                    Ok(HostValue::Null)
                }
            })
            .function("events", {
                let editors = e();
                move |args| {
                    let key = key(args)?;
                    Ok(HostValue::Array(editors.drain(&key)))
                }
            })
            .function("value", {
                let editors = e();
                move |args| {
                    editors.with(&key(args)?, |s, _, cx| {
                        HostValue::from(s.read(cx).value().to_string())
                    })
                }
            })
            .function("setValue", {
                let editors = e();
                move |args| {
                    let text = args.string(1)?.to_string();
                    let external = args
                        .get(2)
                        .and_then(|o| o.get("external"))
                        .and_then(HostValue::as_bool)
                        == Some(true);
                    editors
                        .with(&key(args)?, |s, window, cx| {
                            set_value(s, &text, external, window, cx)
                        })
                        .map(null)
                }
            })
            .function("setReadonly", {
                let editors = e();
                move |args| {
                    let on = args.boolean(1)?;
                    editors
                        .with(&key(args)?, |s, _, cx| {
                            s.update(cx, |s, cx| s.set_readonly(on, cx))
                        })
                        .map(null)
                }
            })
            .function("setWrap", {
                let editors = e();
                move |args| {
                    let on = args.boolean(1)?;
                    editors
                        .with(&key(args)?, |s, w, cx| {
                            s.update(cx, |s, cx| s.set_soft_wrap(on, w, cx))
                        })
                        .map(null)
                }
            })
            .function("setAutoClose", {
                let editors = e();
                move |args| {
                    let on = args.boolean(1)?;
                    editors
                        .with(&key(args)?, |s, w, cx| {
                            s.update(cx, |s, cx| s.set_auto_close(on, w, cx))
                        })
                        .map(null)
                }
            })
            .function("focus", {
                let editors = e();
                move |args| {
                    editors
                        .with(&key(args)?, |s, w, cx| s.update(cx, |s, cx| s.focus(w, cx)))
                        .map(null)
                }
            })
            .function("openSearch", {
                let editors = e();
                move |args| {
                    let replace = args.get(1).and_then(HostValue::as_bool).unwrap_or(false);
                    editors
                        .with(&key(args)?, |s, _, cx| {
                            s.update(cx, |s, cx| s.open_search(replace, cx))
                        })
                        .map(null)
                }
            })
            .function("closeSearch", {
                let editors = e();
                move |args| {
                    editors
                        .with(&key(args)?, |s, _, cx| {
                            s.update(cx, |s, cx| s.close_search(cx))
                        })
                        .map(null)
                }
            })
            .function("isSearchOpen", {
                let editors = e();
                move |args| {
                    editors.with(&key(args)?, |s, _, cx| {
                        HostValue::Bool(s.read(cx).search_session().open)
                    })
                }
            })
            .function("openGoto", {
                let editors = e();
                move |args| {
                    let key = key(args)?;
                    editors
                        .with(&key, |_, _, cx| editors.emit(&key, "goto", cx))
                        .map(null)
                }
            })
            .function("goTo", {
                let editors = e();
                move |args| {
                    let line = args.number(1)?.max(1.) as u32 - 1;
                    let col = args
                        .get(2)
                        .and_then(HostValue::as_number)
                        .unwrap_or(1.)
                        .max(1.) as u32
                        - 1;
                    editors
                        .with(&key(args)?, |s, w, cx| {
                            s.update(cx, |s, cx| {
                                s.set_cursor_position(Position::new(line, col), w, cx)
                            })
                        })
                        .map(null)
                }
            })
            .function("caret", {
                let editors = e();
                move |args| {
                    editors.with(&key(args)?, |s, _, cx| {
                        let (line, col) = caret(s.read(cx));
                        object([("line", (line as f64).into()), ("col", (col as f64).into())])
                    })
                }
            })
            .function("selection", {
                let editors = e();
                move |args| editors.with(&key(args)?, |s, _, cx| selection(s.read(cx)))
            })
            .function("undo", action(|| Box::new(Undo)))
            .function("redo", action(|| Box::new(Redo)))
            .function("cut", action(|| Box::new(Cut)))
            .function("copy", action(|| Box::new(CopyAction)))
            .function("paste", action(|| Box::new(Paste)))
            .function("selectAll", {
                let editors = e();
                move |args| {
                    editors
                        .with(&key(args)?, |s, w, cx| {
                            s.update(cx, |s, cx| s.select_all(w, cx))
                        })
                        .map(null)
                }
            })
            .function("canUndo", {
                let editors = e();
                move |args| {
                    editors.with(&key(args)?, |s, _, cx| {
                        HostValue::Bool(s.read(cx).can_undo())
                    })
                }
            })
            .function("canRedo", {
                let editors = e();
                move |args| {
                    editors.with(&key(args)?, |s, _, cx| {
                        HostValue::Bool(s.read(cx).can_redo())
                    })
                }
            })
    }

    /// The editor for `key`, drawn to fill its box; an empty box when there is none.
    pub fn draw(&self, key: &str, _window: &mut Window, cx: &mut App) -> AnyElement {
        let Some(state) = self.state(key) else {
            return gpui::div().size_full().into_any_element();
        };
        let typography = &gpui_base::Theme::global(cx).tokens.typography;
        let (family, size) = (typography.mono.clone(), typography.mono_md.size);
        let focus = state.clone();
        InputBase::new(SharedString::from(format!("perch-editor-{key}")))
            .flex()
            .items_start()
            .size_full()
            .min_h_0()
            .font_family(family)
            .text_size(size)
            .on_mouse_down(MouseButton::Left, move |_, window, cx| {
                focus.update(cx, |state, cx| state.focus(window, cx));
            })
            .child(Editor::new(&state))
            .into_any_element()
    }
}

/// The editor as an engine a screen places (`data-perch-engine="editor"`): drawn by key, parked when the screen lets
/// the key go, focused through its own handle.
impl crate::mods::engines::EngineKind for Editors {
    fn draw(&self, key: &str, window: &mut Window, cx: &mut App) -> AnyElement {
        Editors::draw(self, key, window, cx)
    }
    fn release(&self, key: &str, _cx: &mut App) {
        self.park(key);
    }
    fn focus_handle(&self, key: &str, cx: &App) -> Option<gpui::FocusHandle> {
        self.state(key).map(|state| state.read(cx).focus_handle(cx))
    }
}

/// A new editor on `value`, its language from `path`'s file name.
fn create(path: &str, value: &str, window: &mut Window, cx: &mut App) -> Entity<EditorState> {
    let name = path.rsplit('/').next().unwrap_or(path).to_string();
    let state = cx.new(|cx| {
        let mut state = EditorState::new(window, cx)
            .language(name)
            .line_number(true)
            .soft_wrap(false)
            .folding(false);
        state.set_tab_size(
            TabSize {
                tab_size: 2,
                hard_tabs: false,
            },
            cx,
        );
        state.set_editor_style(InputEditorStyle {
            highlight_styles: theme::colours(),
            ..Default::default()
        });
        state.set_highlighter_factory(highlight::factory(), cx);
        state
    });
    state.update(cx, |state, cx| {
        state.set_value(value.to_string(), window, cx)
    });
    state
}

/// Replaces the text. `external` (a store value): no undo entry and no change event, the caret and scroll kept
/// where they were (clamped). Otherwise one undoable edit, heard as a change.
///
/// ponytail: an external value clears the undo history, because the engine cannot map history through a change it
/// did not record (the web maps it, `editorDiff.ts`). External values are rare (reload, conflict, recovery).
fn set_value(
    state: &Entity<EditorState>,
    text: &str,
    external: bool,
    window: &mut Window,
    cx: &mut App,
) {
    state.update(cx, |state, cx| {
        if state.value() == text {
            return;
        }
        if !external {
            state.replace_all(text.to_string(), window, cx);
            return;
        }
        let selected = state.selected_range();
        let scroll = state.scroll_offset();
        state.set_value(text.to_string(), window, cx);
        let len = state.text().len();
        let clamp = |at: usize| {
            let mut at = at.min(len);
            while !state.text().is_char_boundary(at) {
                at -= 1;
            }
            at
        };
        let range = clamp(selected.start)..clamp(selected.end);
        state.set_selected_range(range, cx);
        state.set_scroll_offset(scroll, cx);
    });
}

/// The caret as 1-based line and column.
fn caret(state: &EditorState) -> (usize, usize) {
    let at = state.cursor_position();
    (at.line as usize + 1, at.character as usize + 1)
}

/// The selected text with its first and last line (1-based), or null when nothing is selected.
fn selection(state: &EditorState) -> HostValue {
    let range = state.selected_range();
    if range.is_empty() {
        return HostValue::Null;
    }
    let text = state.text();
    let line = |at: usize| (text.offset_to_point(at).row + 1) as f64;
    object([
        ("text", HostValue::from(state.selected_text().to_string())),
        ("startLine", line(range.start).into()),
        (
            "endLine",
            line(range.end.saturating_sub(1).max(range.start)).into(),
        ),
    ])
}

fn object<const N: usize>(fields: [(&str, HostValue); N]) -> HostValue {
    HostValue::Object(
        fields
            .into_iter()
            .map(|(k, v)| (k.to_string(), v))
            .collect(),
    )
}

#[cfg(test)]
mod tests {
    #[test]
    fn declarations_and_exports_agree() {
        super::Editors::default()
            .module("test")
            .validate()
            .expect("declarations and exports agree");
    }
}
