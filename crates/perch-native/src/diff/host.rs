//! The `perch-diff` module and the `diff` engine kind: the review's [`DiffView`] as a screen places it.
//!
//! A screen marks a box `data-perch-engine="diff" data-perch-key="<key>"` and drives the view by that key:
//! `open(key, {workspaceId})` makes (or keeps) it, `setProps(key, props)` sends the view state (`DiffProps` by the
//! SDK's names) and `events(key)` drains what the person did (`selectLine`, `addComment`, `askAgent`, `editComment`,
//! `editBody`, `saveEdit`, `cancelEdit`, `resolve`, `delete`; comments by id). Queuing an event re-renders the mod
//! that opened the key, as `perch-editor` does.
//!
//! The diff and comments never cross into script: the window's Git store publishes them per workspace
//! ([`Diffs::set_data`]) and each view picks up its workspace's latest values when it is drawn (a pointer compare
//! when nothing moved). The theme is picked up the same way.

use super::element::{DiffEvent, DiffProps, DiffView, Editing, Layout, Selection};
use crate::git::store::DiffSnapshot;
use crate::mods::ModHost;
use gpui::{
    prelude::*, AnyElement, App, Entity, FocusHandle, Focusable as _, Subscription, Window,
};
use gpui_shell::{HostArguments, HostError, HostModule, HostValue};
use perch_core::review::{ReviewComment, ReviewSide};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::rc::Rc;

const DECLARATIONS: &str =
    "export function open(key: string, options: { workspaceId: string }): void;
export function setProps(key: string, props: {
  path?: string | null; wrap?: boolean; layout?: string; canAsk?: boolean;
  selection?: { path: string; side: string; start: number; end: number } | null;
  editingCommentId?: string | null; editingBody?: string;
}): void;
export function events(key: string): Array<{ type: string; [field: string]: unknown }>;
export function seq(key: string): number;
export function release(key: string): void;";

/// What the store last published for one workspace.
#[derive(Clone, Default)]
struct Data {
    diff: Option<Rc<DiffSnapshot>>,
    comments: Rc<Vec<ReviewComment>>,
}

struct Doc {
    view: Entity<DiffView>,
    workspace_id: String,
    /// The mod copy that opened it, re-rendered when an event is queued.
    owner: String,
    events: Vec<HostValue>,
    /// Events queued since the view opened: a screen re-renders when it moves, then drains them.
    seq: u64,
    theme: String,
    _events: Subscription,
}

#[derive(Default)]
struct Shared {
    docs: HashMap<String, Doc>,
    data: HashMap<String, Data>,
    hosts: Vec<ModHost>,
    refresh_queued: HashSet<String>,
}

/// Every diff view of one window, by key. Cheap to clone.
#[derive(Clone, Default)]
pub struct Diffs(Rc<RefCell<Shared>>);

impl Diffs {
    /// Lends `perch-diff` to every mod `host` loads from now on.
    pub fn register(&self, host: &ModHost) {
        let diffs = self.clone();
        host.register_module(move |id| diffs.module(id));
        self.0.borrow_mut().hosts.push(host.clone());
    }

    /// Publishes workspace `workspace_id`'s diff and comments; views pick them up at their next draw.
    pub fn set_data(
        &self,
        workspace_id: &str,
        diff: Option<Rc<DiffSnapshot>>,
        comments: Rc<Vec<ReviewComment>>,
        cx: &mut App,
    ) {
        let views: Vec<_> = {
            let mut shared = self.0.borrow_mut();
            shared
                .data
                .insert(workspace_id.to_string(), Data { diff, comments });
            shared
                .docs
                .values()
                .filter(|d| d.workspace_id == workspace_id)
                .map(|d| d.view.clone())
                .collect()
        };
        for view in views {
            view.update(cx, |_, cx| cx.notify());
        }
    }

    /// The view for `key`, for Rust callers (tests).
    pub fn view(&self, key: &str) -> Option<Entity<DiffView>> {
        self.0.borrow().docs.get(key).map(|d| d.view.clone())
    }

    /// The events queued for `key` since the last call, oldest first.
    pub fn drain(&self, key: &str) -> Vec<HostValue> {
        self.0
            .borrow_mut()
            .docs
            .get_mut(key)
            .map(|d| std::mem::take(&mut d.events))
            .unwrap_or_default()
    }

    /// Makes (or keeps) the view for `key` on workspace `workspace_id`, on behalf of mod copy `owner`.
    pub fn open(&self, owner: &str, key: &str, workspace_id: &str, cx: &mut App) {
        {
            let mut shared = self.0.borrow_mut();
            if let Some(doc) = shared.docs.get_mut(key) {
                doc.owner = owner.to_string();
                if doc.workspace_id != workspace_id {
                    doc.workspace_id = workspace_id.to_string();
                    let view = doc.view.clone();
                    drop(shared);
                    view.update(cx, |_, cx| cx.notify());
                }
                return;
            }
        }
        let theme = theme(cx);
        let view = cx.new(|cx| DiffView::new(&theme, cx));
        let (diffs, events_key) = (self.clone(), key.to_string());
        let subscription = cx.subscribe(&view, move |_, event: &DiffEvent, cx| {
            diffs.push(&events_key, event_value(event), cx)
        });
        self.0.borrow_mut().docs.insert(
            key.to_string(),
            Doc {
                view,
                workspace_id: workspace_id.to_string(),
                owner: owner.to_string(),
                events: Vec::new(),
                seq: 0,
                theme: theme.name,
                _events: subscription,
            },
        );
    }

    /// Drops the view for `key`.
    pub fn release(&self, key: &str) {
        self.0.borrow_mut().docs.remove(key);
    }

    fn push(&self, key: &str, event: HostValue, cx: &mut App) {
        let owner = {
            let mut shared = self.0.borrow_mut();
            let Some(doc) = shared.docs.get_mut(key) else {
                return;
            };
            // The latest body is all a screen needs.
            if event.get("type").and_then(HostValue::as_str) == Some("editBody") {
                doc.events
                    .retain(|e| e.get("type").and_then(HostValue::as_str) != Some("editBody"));
            }
            doc.events.push(event);
            doc.seq += 1;
            let owner = doc.owner.clone();
            if !shared.refresh_queued.insert(owner.clone()) {
                return;
            }
            owner
        };
        let diffs = self.clone();
        cx.defer(move |cx| {
            let hosts = {
                let mut shared = diffs.0.borrow_mut();
                shared.refresh_queued.remove(&owner);
                shared.hosts.clone()
            };
            let only = HashSet::from([owner]);
            for host in hosts {
                host.refresh(Some(&only), cx);
            }
        });
    }

    fn set_props(
        &self,
        key: &str,
        props: &HostValue,
        window: &mut Window,
        cx: &mut App,
    ) -> Result<(), HostError> {
        let view = self
            .view(key)
            .ok_or_else(|| HostError::new(format!("setProps: no diff view {key:?} is open")))?;
        let props = props_of(props)?;
        view.update(cx, |view, cx| view.set_props(props, window, cx));
        Ok(())
    }

    /// The view for `key` with its workspace's latest data and the theme on screen.
    fn draw_view(&self, key: &str, window: &mut Window, cx: &mut App) -> AnyElement {
        let found = {
            let shared = self.0.borrow();
            shared.docs.get(key).map(|doc| {
                let data = shared
                    .data
                    .get(&doc.workspace_id)
                    .cloned()
                    .unwrap_or_default();
                (doc.view.clone(), data, doc.theme.clone())
            })
        };
        let Some((view, data, shown_theme)) = found else {
            return gpui::div().size_full().into_any_element();
        };
        let theme = theme(cx);
        if theme.name != shown_theme {
            if let Some(doc) = self.0.borrow_mut().docs.get_mut(key) {
                doc.theme = theme.name.clone();
            }
            view.update(cx, |view, cx| view.set_theme(&theme, cx));
        }
        view.update(cx, |view, cx| {
            view.set_data(data.diff, data.comments, window, cx)
        });
        view.into_any_element()
    }

    fn module(&self, owner: &str) -> HostModule {
        let owner: Rc<str> = owner.into();
        let key = |args: &HostArguments| args.string(0).map(str::to_string);
        let current = |what: &str| HostError::new(format!("{what} is only callable from a mod"));
        let (open, set, events, release) = (self.clone(), self.clone(), self.clone(), self.clone());
        let seq = self.clone();
        HostModule::new("perch-diff")
            .declarations(DECLARATIONS)
            .function("open", move |args| {
                let key = key(args)?;
                let workspace_id = args
                    .value(1)?
                    .get("workspaceId")
                    .and_then(HostValue::as_str)
                    .ok_or_else(|| HostError::new("open: options.workspaceId is required"))?
                    .to_string();
                gpui_shell::with_current(|_, cx| open.open(&owner, &key, &workspace_id, cx))
                    .ok_or_else(|| current("open"))?;
                Ok(HostValue::Null)
            })
            .function("setProps", move |args| {
                let key = key(args)?;
                let props = args.value(1)?.clone();
                gpui_shell::with_current(|window, cx| set.set_props(&key, &props, window, cx))
                    .ok_or_else(|| current("setProps"))??;
                Ok(HostValue::Null)
            })
            .function("events", move |args| {
                Ok(HostValue::Array(events.drain(&key(args)?)))
            })
            .function("seq", move |args| {
                let key = key(args)?;
                let n = seq.0.borrow().docs.get(&key).map_or(0, |d| d.seq);
                Ok(HostValue::Number(n as f64))
            })
            .function("release", move |args| {
                release.release(&key(args)?);
                Ok(HostValue::Null)
            })
    }
}

/// The review as an engine a screen places (`data-perch-engine="diff"`): drawn by key, dropped when the screen
/// lets the key go, focused through the view's own handle.
impl crate::mods::engines::EngineKind for Diffs {
    fn draw(&self, key: &str, window: &mut Window, cx: &mut App) -> AnyElement {
        self.draw_view(key, window, cx)
    }
    fn release(&self, key: &str, _cx: &mut App) {
        Diffs::release(self, key);
    }
    fn focus_handle(&self, key: &str, cx: &App) -> Option<FocusHandle> {
        self.view(key).map(|view| view.read(cx).focus_handle(cx))
    }
}

/// The theme on screen (the default when mods are off, as in tests).
fn theme(cx: &App) -> crate::mods::theme::Theme {
    match crate::mods::screens::mods(cx) {
        Some((_, perch)) => perch.theme(),
        None => crate::mods::theme::resolve(crate::mods::theme::DEFAULT),
    }
}

fn side_of(word: &str) -> Result<ReviewSide, HostError> {
    match word {
        "old" => Ok(ReviewSide::Old),
        "new" => Ok(ReviewSide::New),
        "file" => Ok(ReviewSide::File),
        other => Err(HostError::new(format!("no review side {other:?}"))),
    }
}

/// `DiffProps` from the SDK's props; a missing field is its default.
fn props_of(props: &HostValue) -> Result<DiffProps, HostError> {
    let text = |k: &str| props.get(k).and_then(HostValue::as_str);
    let flag = |k: &str| props.get(k).and_then(HostValue::as_bool).unwrap_or(false);
    let selection = match props.get("selection") {
        Some(s @ HostValue::Object(_)) => {
            let n = |k: &str| {
                s.get(k)
                    .and_then(HostValue::as_number)
                    .map(|v| v as u32)
                    .ok_or_else(|| HostError::new(format!("selection.{k} is a line number")))
            };
            Some(Selection {
                path: s
                    .get("path")
                    .and_then(HostValue::as_str)
                    .ok_or_else(|| HostError::new("selection.path is required"))?
                    .to_string(),
                side: side_of(s.get("side").and_then(HostValue::as_str).unwrap_or(""))?,
                start: n("start")?,
                end: n("end")?,
            })
        }
        _ => None,
    };
    Ok(DiffProps {
        path: text("path").map(str::to_string),
        wrap: flag("wrap"),
        layout: match text("layout") {
            Some("unified") => Layout::Unified,
            Some("split") => Layout::Split,
            _ => Layout::Auto,
        },
        selection,
        editing: text("editingCommentId").map(|id| Editing {
            comment: id.to_string(),
            body: text("editingBody").unwrap_or("").to_string(),
        }),
        can_ask: flag("canAsk"),
    })
}

fn event_value(event: &DiffEvent) -> HostValue {
    let s = |v: &str| HostValue::from(v.to_string());
    let n = |v: u32| HostValue::Number(f64::from(v));
    let fields: Vec<(&str, HostValue)> = match event {
        DiffEvent::SelectLine {
            path,
            side,
            line,
            extend,
        } => vec![
            ("type", s("selectLine")),
            ("path", s(path)),
            ("side", s(side.label())),
            ("line", n(*line)),
            ("extend", HostValue::Bool(*extend)),
        ],
        DiffEvent::AddComment { path, side, line } => vec![
            ("type", s("addComment")),
            ("path", s(path)),
            ("side", s(side.label())),
            ("line", n(*line)),
        ],
        DiffEvent::AskAgent { path } => vec![("type", s("askAgent")), ("path", s(path))],
        DiffEvent::EditComment { comment } => {
            vec![("type", s("editComment")), ("commentId", s(comment))]
        }
        DiffEvent::EditBody { text } => vec![("type", s("editBody")), ("text", s(text))],
        DiffEvent::SaveEdit { comment } => vec![("type", s("saveEdit")), ("commentId", s(comment))],
        DiffEvent::CancelEdit => vec![("type", s("cancelEdit"))],
        DiffEvent::Resolve { comment, resolved } => vec![
            ("type", s("resolve")),
            ("commentId", s(comment)),
            ("resolved", HostValue::Bool(*resolved)),
        ],
        DiffEvent::Delete { comment } => vec![("type", s("delete")), ("commentId", s(comment))],
    };
    HostValue::Object(
        fields
            .into_iter()
            .map(|(k, v)| (k.to_string(), v))
            .collect(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn props_read_the_sdk_names() {
        let value = HostValue::Object(vec![
            ("path".into(), "a.rs".to_string().into()),
            ("wrap".into(), HostValue::Bool(true)),
            (
                "selection".into(),
                HostValue::Object(vec![
                    ("path".into(), "a.rs".to_string().into()),
                    ("side".into(), "old".to_string().into()),
                    ("start".into(), HostValue::Number(3.)),
                    ("end".into(), HostValue::Number(5.)),
                ]),
            ),
            ("editingCommentId".into(), "c1".to_string().into()),
            ("editingBody".into(), "draft".to_string().into()),
        ]);
        let props = props_of(&value).unwrap();
        assert_eq!(props.path.as_deref(), Some("a.rs"));
        assert!(props.wrap && !props.can_ask);
        assert_eq!(
            props.selection,
            Some(Selection {
                path: "a.rs".into(),
                side: ReviewSide::Old,
                start: 3,
                end: 5
            })
        );
        assert_eq!(props.editing.unwrap().body, "draft");
        assert_eq!(
            props_of(&HostValue::Object(vec![])).unwrap(),
            DiffProps::default()
        );
        assert!(props_of(&HostValue::Object(vec![(
            "selection".into(),
            HostValue::Object(vec![("path".into(), "a".to_string().into())])
        )]))
        .is_err());
    }

    #[test]
    fn events_carry_the_sdk_names() {
        let value = event_value(&DiffEvent::SelectLine {
            path: "a.rs".into(),
            side: ReviewSide::New,
            line: 7,
            extend: true,
        });
        assert_eq!(
            value.get("type").and_then(HostValue::as_str),
            Some("selectLine")
        );
        assert_eq!(value.get("side").and_then(HostValue::as_str), Some("new"));
        assert_eq!(value.get("line").and_then(HostValue::as_number), Some(7.));
        assert_eq!(
            event_value(&DiffEvent::Resolve {
                comment: "c".into(),
                resolved: false
            })
            .get("resolved"),
            Some(&HostValue::Bool(false))
        );
    }
}
