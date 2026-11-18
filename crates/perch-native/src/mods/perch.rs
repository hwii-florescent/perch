//! The `perch` module native mods import: Perch's data, its commands and its theme, as the web's
//! `@perch/sdk` names them (`mods/perch.d.ts` is the whole surface).
//!
//! The Rust models stay the owners. [`Perch`] holds what the window last published (the
//! [`Model`] the core's messages reduce to, what the window shows, the theme) and each function
//! derives its answer from that on the call: [`navigation`] and [`hosts`] are the web's rules
//! ported, the commands are the window's ([`Workspace::run_command`]). Nothing a mod calls
//! changes a fact; a command asks the window, as a key would.
//!
//! Re-render, as herdr-app's `herdr` module does it: every published part has a revision, each
//! mod records the revision of every part it reads (in `render()`, a callback or `init`), and
//! [`Perch::flush`] refreshes the views of exactly the mods whose parts moved since
//! ([`ModHost::refresh`]). A function a mod calls never re-enters the script: a change it makes
//! is flushed after the call unwinds (`cx.defer`).
//!
//! Wiring a window takes three calls: [`Perch::new`], [`Perch::register`] on the window's
//! [`ModHost`] and [`Perch::attach`] to its [`Workspace`], which publishes on every change the
//! workspace sees and runs commands there.

use super::screens::OnResult;
use super::theme::{self, Theme};
use super::ModHost;
use crate::actions::ACTIONS;
use crate::keymap::{all_shortcuts, Keymap, Scope, TYPED};
use crate::sidebar::navigation::{self, AgentList, Store, View};
use crate::sidebar::{Model, KNOWN_AGENTS, LOCAL, MANIFEST_CAPABILITY};
use crate::workspace::Workspace;
use gpui::{AnyWindowHandle, App, Entity, Subscription, WeakEntity};
use gpui_shell::{HostArguments, HostError, HostModule, HostResult, HostValue};
use serde_json::{json, Value};
use std::cell::{Cell, RefCell};
use std::collections::{HashMap, HashSet};
use std::rc::Rc;
use std::sync::Arc;

/// The module's TypeScript face, `declare module "perch" { ... }`, shipped beside the stock mods.
pub const DECLARATIONS: &str = include_str!("../../mods/perch.d.ts");

/// The parts a mod can read, each with its own revision.
const STORE: &str = "store";
const VIEW: &str = "view";
const WINDOW: &str = "window";
const THEME: &str = "theme";
const KEYS: &str = "keys";
/// The workspaces' names, folders and Git presence, and whether the core is connected: what the
/// files screen reads of the store, so a store change elsewhere does not read its files again.
const WORKSPACES: &str = "workspaces";
/// The sidebar's view settings: a change to them does not read again what follows the view.
const SIDEBAR: &str = "sidebar";
/// A drag's geometry (`tabSlide`, `pointerFollow`), which moves with every pointer move: only
/// the strip and a followed press read it, so a move re-renders nothing else.
const DRAG: &str = "drag";

/// The sidebar's view settings, by the web's names (`perch.sidebar.*` in its localStorage).
#[derive(Clone, Debug, PartialEq)]
pub struct SidebarSettings {
    /// `project`, `status` or `list`.
    pub organize: String,
    pub sort_by_attention: bool,
    pub show_terminals: bool,
    pub collapsed_projects: Vec<String>,
    /// Sessions folded over their sub-sessions.
    pub folded_sessions: Vec<String>,
}

impl Default for SidebarSettings {
    /// The web's defaults.
    fn default() -> Self {
        Self {
            organize: "project".into(),
            // Off, as the web's (`readFlag` is false when unset): on, the order moves by itself
            // whenever an agent's state changes.
            sort_by_attention: false,
            show_terminals: false,
            collapsed_projects: Vec::new(),
            folded_sessions: Vec::new(),
        }
    }
}

impl SidebarSettings {
    /// Reads `file` as [`Self::to_json`] wrote it; a missing or broken file, or a field of the
    /// wrong type, gives the defaults for what it could not read.
    pub fn read(file: &std::path::Path) -> Self {
        let mut settings = Self::default();
        let kept: Value = std::fs::read(file)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default();
        if let Some(object) = kept.as_object() {
            for (key, value) in object {
                let _ = settings.patch(&json!({ key: value }));
            }
        }
        settings
    }

    fn to_json(&self) -> Value {
        json!({
            "organize": self.organize,
            "sortByAttention": self.sort_by_attention,
            "showTerminals": self.show_terminals,
            "collapsedProjects": self.collapsed_projects,
            "foldedSessions": self.folded_sessions,
        })
    }

    /// Applies the fields `patch` names; a wrong type is refused and nothing changes.
    pub fn patch(&mut self, patch: &Value) -> Result<(), String> {
        let object = patch
            .as_object()
            .ok_or("setSidebarSettings takes an object")?;
        let mut next = self.clone();
        for (key, value) in object {
            match key.as_str() {
                "organize" => match value.as_str() {
                    Some(word @ ("project" | "status" | "list")) => next.organize = word.into(),
                    _ => return Err(r#"organize is "project", "status" or "list""#.into()),
                },
                "sortByAttention" => {
                    next.sort_by_attention =
                        value.as_bool().ok_or("sortByAttention is a boolean")?
                }
                "showTerminals" => {
                    next.show_terminals = value.as_bool().ok_or("showTerminals is a boolean")?
                }
                "collapsedProjects" => {
                    next.collapsed_projects = value
                        .as_array()
                        .and_then(|list| {
                            list.iter()
                                .map(|v| v.as_str().map(str::to_string))
                                .collect::<Option<Vec<_>>>()
                        })
                        .ok_or("collapsedProjects is a list of project ids")?
                }
                "foldedSessions" => {
                    next.folded_sessions = value
                        .as_array()
                        .and_then(|list| {
                            list.iter()
                                .map(|v| v.as_str().map(str::to_string))
                                .collect::<Option<Vec<_>>>()
                        })
                        .ok_or("foldedSessions is a list of session ids")?
                }
                other => return Err(format!("no sidebar setting {other}")),
            }
        }
        *self = next;
        Ok(())
    }
}

/// What the window shows: its tab strip, the tabs on screen and the one with the keyboard.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct WindowState {
    pub strip: Vec<String>,
    /// The strip's preview tabs (files opened by a single click).
    pub previews: Vec<String>,
    /// The strip's browser tabs as `useWorkspaceTabs` lists them, by tab id.
    pub browser_tabs: Value,
    pub shown: Vec<String>,
    pub active: Option<String>,
    pub zoomed: bool,
    /// The terminals' zoom factor (1 is 100%).
    pub zoom: f32,
    /// The in-app notifications, oldest first (`useNotifications`' items).
    pub notifications: Vec<Value>,
    /// How many times the window asked the tab strip for a new tab (Cmd+T): the strip opens its
    /// New session menu at its "+" on each.
    pub new_tab: u64,
    /// The open tabs whose terminal is known to be `running` or `exited`; any other is unknown.
    pub terminals: HashMap<String, &'static str>,
    /// The tab a drag holds off the strip, which the strip dims (`draggingId`); null when none.
    /// The drag's geometry is published apart from the window ([`Perch::set_drag`]).
    pub dragging: Value,
    /// The last Add project request (`useAddProject`), null before any.
    pub add_project: Value,
    /// How many times the window asked the sidebar for its Add project form, and when last.
    pub add_project_asks: u64,
    pub add_project_at: Option<std::time::Instant>,
    /// The last request for a project's worktree menu, null when none is waiting.
    pub worktree_request: Value,
    /// The drawer's browser pages by workspace (`useBrowserPages`).
    pub browser_pages: Value,
}

/// The tab a drag `slide` holds off the strip (the strip dims it, as the web's), null when none.
fn dragging(slide: &Value) -> Value {
    match slide {
        slide if slide["overStrip"] == false => slide["id"].clone(),
        _ => Value::Null,
    }
}

/// Answers a screen's question for the core (`kind` and its `args`, as
/// [`crate::client::ask_frame`] checks them): a folder listing, Instructions, Project memory.
pub type Asker =
    Rc<dyn Fn(&str, &Value) -> futures::channel::oneshot::Receiver<Result<Value, String>>>;

/// Takes a change a screen sends the core (`kind` and its `args`, as [`crate::client::send_frame`]
/// checks them) instead of the window's core (a test's fixture).
pub type Sender = Rc<dyn Fn(&str, &Value)>;

/// How long after the window asked for the Add project form a sidebar that mounts takes the
/// request (the sidebar shown by that same request): `ADD_PROJECT_LATE_MS` in the web.
const ADD_PROJECT_LATE_MS: u128 = 3000;

#[derive(Default)]
struct Data {
    model: Model,
    host_id: Option<String>,
    session_id: Option<String>,
    /// A workspace focused with no session of it on screen.
    workspace_id: Option<String>,
    sidebar: SidebarSettings,
    /// The window's logical size (`set_viewport`).
    viewport: (f32, f32),
    window: WindowState,
    /// A tab drag in flight (`tabSlide()`, `TabDrag::slide`); null when none.
    slide: Value,
    /// The pointer as last forwarded for a press a mod follows (`pointerFollow()`), null before any.
    pointer: Value,
    /// A theme chosen here, until the core says which one is set.
    chosen_theme: Option<String>,
    /// The theme last put into gpui-base's global.
    applied: Option<Theme>,
    /// What each screen was opened with, by its key (`perch.props()`).
    props: HashMap<String, Value>,
    /// Each workspace's files as the window's store last published them (`FileStore::snapshot`).
    files: HashMap<String, Value>,
    /// Each workspace's review as the window's Git store last published it.
    git: HashMap<String, Value>,
}

/// The connection, and each workspace's id, name, folder, computer and Git presence.
type FilesFacts<'a> = (bool, Vec<(&'a str, &'a str, &'a str, &'a str, bool)>);

/// What the files screen reads of the model (`workspace_files`, `media_file`).
fn files_facts(model: &Model) -> FilesFacts<'_> {
    let store = &model.store;
    let workspaces = store
        .workspaces
        .iter()
        .map(|w| {
            (
                w.id.as_str(),
                w.name.as_str(),
                w.path.as_str(),
                w.host_id.as_str(),
                w.branch.is_some(),
            )
        })
        .collect();
    (model.connected, workspaces)
}

/// Where window commands run.
struct Attached {
    handle: AnyWindowHandle,
    workspace: WeakEntity<Workspace>,
    _observe: Subscription,
}

struct Shared {
    data: RefCell<Data>,
    revisions: RefCell<HashMap<String, u64>>,
    /// Bumped with every part: a screen that saw this value has nothing new to read (`revision`).
    revision: Cell<u64>,
    /// Per mod id, the revision of each part it read when it last rendered.
    reads: RefCell<HashMap<String, HashMap<String, u64>>>,
    /// Per mod id, the parts its calls read since it last asked (`takeReads`): the screen's
    /// snapshots are read again only when one of theirs moved.
    touched: RefCell<HashMap<String, Vec<String>>>,
    hosts: RefCell<Vec<ModHost>>,
    /// Answers screens' questions in place of the window's core (`Self::set_asker`).
    asker: RefCell<Option<Asker>>,
    /// Takes screens' changes in place of the window's core (`Self::set_sender`).
    sender: RefCell<Option<Sender>>,
    /// Reads media files in place of the window's core (`Self::set_fetch`).
    fetch: RefCell<Option<Arc<dyn crate::files::media::Fetch>>>,
    /// The instant screens read as now, in ms since the epoch, when held (`Self::hold_clock`).
    held_clock: std::cell::Cell<Option<f64>>,
    attached: RefCell<Option<Attached>>,
    flush_queued: Cell<bool>,
    /// Where the sidebar's view settings are kept on this device, as the web keeps them in
    /// localStorage; without it they last as long as the window.
    sidebar_file: RefCell<Option<std::path::PathBuf>>,
    /// Per copy key, how many times a copy under it was loaded: a reload is a new one, which
    /// holds nothing its predecessor held.
    loads: RefCell<HashMap<String, u64>>,
    /// Per copy key, how many times [`Perch::flush`] re-rendered it because a part it read moved.
    refreshes: RefCell<HashMap<String, u64>>,
}

/// The `perch` module's state for one window. Cheap to clone.
#[derive(Clone)]
pub struct Perch(Rc<Shared>);

impl Default for Perch {
    fn default() -> Self {
        Self::new()
    }
}

impl Perch {
    pub fn new() -> Self {
        Self(Rc::new(Shared {
            data: RefCell::default(),
            revisions: RefCell::default(),
            revision: Cell::default(),
            reads: RefCell::default(),
            touched: RefCell::default(),
            hosts: RefCell::default(),
            asker: RefCell::default(),
            sender: RefCell::default(),
            fetch: RefCell::default(),
            held_clock: std::cell::Cell::default(),
            attached: RefCell::default(),
            flush_queued: Cell::new(false),
            sidebar_file: RefCell::default(),
            loads: RefCell::default(),
            refreshes: RefCell::default(),
        }))
    }

    /// Lends the `perch` module to every mod `host` loads from now on, and refreshes its views
    /// when what they read changes.
    pub fn register(&self, host: &ModHost) {
        let perch = self.clone();
        self.register_with(host, move |id| perch.module(id));
    }

    /// [`Perch::register`] with `module` as the `perch` module a mod is given (a test's `module(id)` with a
    /// function of its own), and the same companion modules beside it.
    pub fn register_with(&self, host: &ModHost, module: impl Fn(&str) -> HostModule + 'static) {
        host.register_module(module);
        self.0.hosts.borrow_mut().push(host.clone());
        // `perch-markdown` (the `markdown` engine): a Markdown file's rendered preview.
        crate::files::markdown::register(host);
        // `perch-media` (and the `image` engine), reading bytes from the attached window's core.
        let perch = self.clone();
        crate::files::media::register(
            host,
            Rc::new(move |cx: &App| {
                if let Some(fetch) = perch.0.fetch.borrow().clone() {
                    return Some(fetch);
                }
                let workspace = perch.0.attached.borrow().as_ref()?.workspace.upgrade()?;
                let core = workspace.read(cx).core()?;
                Some(Arc::new(core) as Arc<dyn crate::files::media::Fetch>)
            }),
        );
    }

    /// Media files are read through `fetch` instead of the window's core (fixtures, tests).
    pub fn set_fetch(&self, fetch: Arc<dyn crate::files::media::Fetch>) {
        *self.0.fetch.borrow_mut() = Some(fetch);
    }

    /// Follows `workspace` (in the window `handle`): publishes its model and tabs whenever it
    /// changes, and runs window commands there.
    pub fn attach(&self, workspace: &Entity<Workspace>, handle: AnyWindowHandle, cx: &mut App) {
        let perch = self.clone();
        let observe = cx.observe(workspace, move |workspace, cx| {
            perch.sync(&workspace, cx);
        });
        *self.0.attached.borrow_mut() = Some(Attached {
            handle,
            workspace: workspace.downgrade(),
            _observe: observe,
        });
        self.sync(workspace, cx);
    }

    /// Reads what `workspace` shows now and publishes what changed.
    fn sync(&self, workspace: &Entity<Workspace>, cx: &mut App) {
        let (model, window, open) = {
            let ws = workspace.read(cx);
            let tabs = ws.tabs();
            let model = ws.sidebar().read(cx).model();
            let window = WindowState {
                strip: tabs.strip().to_vec(),
                previews: tabs.previews().to_vec(),
                browser_tabs: ws.browser_tabs(),
                shown: tabs.shown(),
                active: tabs.active().map(str::to_string),
                zoomed: tabs.zoomed(),
                zoom: ws.zoom_factor(),
                new_tab: ws.new_tab_asks(),
                add_project: ws.add_project_state().clone(),
                add_project_asks: ws.add_project_asks().0,
                add_project_at: ws.add_project_asks().1,
                worktree_request: ws.worktree_request().clone(),
                browser_pages: ws.browser_drawer_state(cx),
                terminals: ws.terminal_states(cx),
                dragging: dragging(&ws.tab_slide()),
                notifications: ws
                    .notifications()
                    .iter()
                    .map(|n| notification_json(n, model))
                    .collect(),
            };
            let fresh = !Arc::ptr_eq(&model.store, &self.0.data.borrow().model.store);
            (
                fresh.then(|| model.clone()),
                window,
                ws.open().map(|o| (o.host_id.clone(), o.session_id.clone())),
            )
        };
        if let Some(model) = model {
            self.set_model(model);
        }
        {
            let ws = workspace.read(cx);
            self.set_drag(ws.tab_slide(), ws.pointer_follow().clone());
        }
        // A file, review or browser tab on screen names its workspace in its id: the one the
        // strip's + (New browser, New file) and the start page work in.
        let tab_workspace = window
            .active
            .as_deref()
            .and_then(|id| id.split_once('\n'))
            .map(|(workspace, _)| workspace.to_string());
        self.set_window(window);
        let changed = {
            let data = self.0.data.borrow();
            data.session_id != open.as_ref().map(|o| o.1.clone())
        };
        if changed {
            let mut data = self.0.data.borrow_mut();
            // A session on screen decides the workspace; with none, the workspace just focused
            // (Quickchat's start page) stays.
            if open.is_some() {
                data.workspace_id = None;
            }
            data.session_id = open.map(|o| o.1);
            drop(data);
            self.bump(VIEW);
        }
        if let Some(workspace) = tab_workspace {
            let mut data = self.0.data.borrow_mut();
            if data.workspace_id.as_ref() != Some(&workspace) {
                data.workspace_id = Some(workspace);
                drop(data);
                self.bump(VIEW);
            }
        }
        self.flush(cx);
    }

    /// Publishes the core's facts. Call [`Self::flush`] after.
    pub fn set_model(&self, model: Model) {
        let mut data = self.0.data.borrow_mut();
        // The same facts again (the window hands its model on with each change of its own)
        // publish nothing: the files screen would read every workspace's files again.
        if Arc::ptr_eq(&data.model.store, &model.store) && data.model == model {
            return;
        }
        let files_moved = files_facts(&data.model) != files_facts(&model);
        let keys_changed =
            data.model.keybindings != model.keybindings || data.model.keys_file != model.keys_file;
        // A theme the core now names replaces one chosen here.
        let theme_changed = data.model.store.theme != model.store.theme;
        if theme_changed {
            data.chosen_theme = None;
        }
        data.model = model;
        drop(data);
        self.bump(STORE);
        if files_moved {
            self.bump(WORKSPACES);
        }
        if theme_changed {
            self.bump(THEME);
        }
        if keys_changed {
            self.bump(KEYS);
        }
    }

    /// Publishes the window's logical size. Call [`Self::flush`] after.
    pub fn set_viewport(&self, viewport: (f32, f32)) {
        let mut data = self.0.data.borrow_mut();
        if data.viewport != viewport {
            data.viewport = viewport;
            drop(data);
            self.bump(WINDOW);
        }
    }

    /// Publishes what the window shows. Call [`Self::flush`] after.
    pub fn set_window(&self, window: WindowState) {
        let mut data = self.0.data.borrow_mut();
        if data.window != window {
            data.window = window;
            drop(data);
            self.bump(WINDOW);
        }
    }

    /// Publishes a drag's geometry: where the strip's tabs slide (`tabSlide()`) and the pointer
    /// a followed press last had (`pointerFollow()`). Only their readers re-render; the window's
    /// own part moves only when the dragged tab leaves or comes back to the strip. Call
    /// [`Self::flush`] after.
    pub fn set_drag(&self, slide: Value, pointer: Value) {
        let mut data = self.0.data.borrow_mut();
        if data.slide == slide && data.pointer == pointer {
            return;
        }
        let held = dragging(&slide);
        let left = data.window.dragging != held;
        data.window.dragging = held;
        data.slide = slide;
        data.pointer = pointer;
        drop(data);
        self.bump(DRAG);
        if left {
            self.bump(WINDOW);
        }
    }

    /// Gives screen `key` its props (`perch.props()`); a change re-renders it. Call
    /// [`Self::flush`] after.
    pub fn set_props(&self, key: &str, props: Value) {
        let mut data = self.0.data.borrow_mut();
        if data.props.get(key) != Some(&props) {
            data.props.insert(key.to_string(), props);
            drop(data);
            self.bump(&format!("props:{key}"));
        }
    }

    /// Publishes workspace `workspace_id`'s files (`FileStore::snapshot`). Call [`Self::flush`]
    /// after.
    pub fn set_files(&self, workspace_id: &str, snapshot: Value) {
        self.0
            .data
            .borrow_mut()
            .files
            .insert(workspace_id.to_string(), snapshot);
        self.bump(&format!("files:{workspace_id}"));
    }

    /// `useWorkspaceFiles(workspaceId, {git})`'s data: the workspace, the connection, the
    /// store's snapshot of its files and its Git marks (none until the window keeps Git).
    /// Converted straight from the stored snapshot: cloning it first copied every open
    /// document's text once more on each read.
    fn workspace_files(&self, workspace_id: &str) -> HostValue {
        let store = self.store();
        let data = self.0.data.borrow();
        let workspace = store.workspaces.iter().find(|w| w.id == workspace_id);
        let empty = || json!({ "trees": {}, "documents": {}, "previews": {}, "search": null, "wrap": false });
        let HostValue::Object(mut files) = data
            .files
            .get(workspace_id)
            .map_or_else(|| to_host(&empty()), to_host)
        else {
            return HostValue::Null;
        };
        let added = [
            (
                "workspace",
                workspace.map_or(
                    Value::Null,
                    |w| json!({ "id": w.id, "name": w.name, "path": w.path, "hostId": w.host_id }),
                ),
            ),
            ("connected", json!(data.model.connected)),
            (
                "git",
                json!({
                    "isGit": workspace.is_some_and(|w| w.branch.is_some()),
                    "ready": false,
                    "statusState": "idle",
                    "decorations": [],
                }),
            ),
        ];
        files.retain(|(key, _)| !added.iter().any(|(name, _)| key == name));
        files.extend(
            added
                .iter()
                .map(|(name, value)| (name.to_string(), to_host(value))),
        );
        HostValue::Object(files)
    }

    /// `FileAsset`'s view of one file: the workspace's folder on this computer (`root`, null for
    /// a workspace on another computer or one that is gone) and the file's archive extraction.
    fn media_file(&self, workspace_id: &str, path: &str) -> Value {
        let store = self.store();
        let data = self.0.data.borrow();
        let root = store
            .workspaces
            .iter()
            .find(|w| w.id == workspace_id && w.host_id == crate::sidebar::LOCAL)
            .map(|w| w.path.clone());
        let extraction = data
            .files
            .get(workspace_id)
            .and_then(|files| files["extractions"].get(path))
            .cloned();
        json!({ "root": root, "extraction": extraction })
    }

    /// The `perch` functions of the files screen: `workspaceFiles(workspaceId)` and
    /// `filesDo(action, workspaceId, ...args)`, which runs one of `useWorkspaceFiles`' actions
    /// on the window's store.
    fn files_functions(&self, id: &Rc<str>, module: HostModule) -> HostModule {
        let (reader, id) = (self.clone(), id.clone());
        let (media, media_id) = (self.clone(), id.clone());
        let runner = self.clone();
        module
            .function("mediaFile", move |args| {
                let (workspace_id, path) = (args.string(0)?, args.string(1)?);
                media.read(&media_id, WORKSPACES);
                media.read(&media_id, &format!("files:{workspace_id}"));
                Ok(to_host(&media.media_file(workspace_id, path)))
            })
            .function("workspaceFiles", move |args| {
                let workspace_id = args.string(0)?.to_string();
                reader.read(&id, WORKSPACES);
                reader.read(&id, &format!("files:{workspace_id}"));
                Ok(reader.workspace_files(&workspace_id))
            })
            .function("filesDo", move |args| {
                let action = args.string(0)?.to_string();
                let workspace_id = args.string(1)?.to_string();
                let rest: Vec<Value> = (2..args.len())
                    .filter_map(|i| args.get(i).map(from_host))
                    .collect();
                // A screen drawn with no window (the parity capture) has no store to act on.
                if runner.0.attached.borrow().is_none() {
                    return Ok(HostValue::Null);
                }
                runner.in_workspace(move |ws, cx| {
                    let text = |i: usize| {
                        rest.get(i)
                            .and_then(Value::as_str)
                            .unwrap_or("")
                            .to_string()
                    };
                    let w = workspace_id.as_str();
                    ws.with_files(
                        |store, now| match action.as_str() {
                            "requestTree" => drop(store.request_tree(w, &text(0))),
                            "searchFiles" => drop(store.search_files(w, &text(0))),
                            "openFile" => drop(store.open_file(
                                w,
                                &text(0),
                                rest.get(1).and_then(Value::as_bool).unwrap_or(false),
                            )),
                            "reloadFile" => drop(store.reload_file(w, &text(0))),
                            "requestPreview" => drop(store.request_preview(w, &text(0))),
                            "updateDraft" => store.update_draft(w, &text(0), text(1), now),
                            "saveFile" => drop(store.save_file(w, &text(0), None)),
                            "overwriteFile" => drop(store.overwrite_file(w, &text(0))),
                            "extractArchive" => drop(store.extract_archive(w, &text(0))),
                            // `mutate(op, path, to?)`: an op the core does not know is not sent.
                            "mutate" => {
                                if let Ok(op) = serde_json::from_value(json!(text(0))) {
                                    let to = rest.get(2).and_then(Value::as_str);
                                    drop(store.mutate(w, op, &text(1), to));
                                }
                            }
                            "setWrap" => store.set_wrap(
                                rest.first().and_then(Value::as_bool).unwrap_or(false),
                                w,
                            ),
                            _ => {}
                        },
                        cx,
                    )
                })?;
                Ok(HostValue::Null)
            })
    }

    /// Publishes workspace `workspace_id`'s review (`useGitReview`'s state fields, the diff and comments
    /// included). Call [`Self::flush`] after.
    pub fn set_git_review(&self, workspace_id: &str, review: &crate::git::store::WorkspaceReview) {
        // ponytail: the whole diff becomes JSON on every change of the review (a status refresh too); if a
        // 20,000-line diff costs too much here, keep the diff's JSON by `diff_revision`.
        let mut value = serde_json::to_value(review).unwrap_or_else(|_| json!({}));
        value["diff"] = review
            .diff
            .as_deref()
            .and_then(|d| serde_json::to_value(d).ok())
            .unwrap_or(Value::Null);
        value["comments"] = serde_json::to_value(&*review.comments).unwrap_or_else(|_| json!([]));
        self.0
            .data
            .borrow_mut()
            .git
            .insert(workspace_id.to_string(), value);
        self.bump(&format!("git:{workspace_id}"));
    }

    /// The revision of what `gitReview(workspaceId)` answers: it moves with the review and the sidebar's store.
    fn git_review_revision(&self, workspace_id: &str) -> u64 {
        let git = self
            .0
            .revisions
            .borrow()
            .get(&format!("git:{workspace_id}"))
            .copied()
            .unwrap_or(0);
        git.wrapping_mul(1 << 32)
            .wrapping_add(self.store().revision)
    }

    /// `useGitReview(workspaceId)`'s data, without its actions (the SDK binds those to `gitDo`).
    fn git_review(&self, workspace_id: &str) -> Value {
        let store = self.store();
        let data = self.0.data.borrow();
        let mut review = data.git.get(workspace_id).cloned().unwrap_or_else(|| {
            json!({ "statusState": "idle", "diffState": "idle", "actionState": "idle", "diff": null,
                    "comments": [], "refs": [], "batchDelivery": null, "lastAgentTurn": null })
        });
        let workspace = store.workspaces.iter().find(|w| w.id == workspace_id);
        let scope = workspace_id
            .strip_prefix("term:")
            .and_then(|rest| rest.split(':').next());
        let targets: Vec<Value> = store
            .sessions
            .iter()
            .filter(|s| {
                s.workspace_id.as_deref() == Some(workspace_id)
                    || scope == Some(s.id.as_str())
                    || workspace.is_some_and(|w| s.host_id == w.host_id && s.cwd == w.path)
            })
            .map(|s| {
                let title = if s.title.is_empty() {
                    "New session"
                } else {
                    &s.title
                };
                json!({ "id": s.id, "title": title, "agent": s.cli_provider_id })
            })
            .collect();
        let remote_name = store
            .sessions
            .iter()
            .find(|s| s.workspace_id.as_deref() == Some(workspace_id))
            .and_then(|s| s.cwd.trim_end_matches('/').rsplit('/').next())
            .map(str::to_string);
        review["ready"] = json!(crate::git::can_take(
            data.model.connected,
            &store,
            workspace_id
        ));
        review["workspaceName"] = json!(workspace.map(|w| w.name.clone()).or(remote_name));
        review["startSnapshot"] = json!(workspace.and_then(|w| w.start_snapshot.clone()));
        review["sessions"] = json!(targets);
        review["currentRevision"] = review["diff"]["sourceRevision"].clone();
        review["revision"] = json!(self.git_review_revision(workspace_id));
        review
    }

    /// The `perch` functions of the review screen: `gitReview(workspaceId)`, `gitReviewRevision(workspaceId)`
    /// (cheap: the SDK asks for the review again only when it moved) and `gitDo(action, workspaceId, ...args)`,
    /// which runs one of `useGitReview`'s actions on the window's Git store and settles with its value (a preview
    /// receipt, a packet or a delivery; null for the rest).
    fn git_functions(&self, id: &Rc<str>, module: HostModule) -> HostModule {
        let (reader, reader_id) = (self.clone(), id.clone());
        let (counter, counter_id) = (self.clone(), id.clone());
        let doer = self.clone();
        module
            .function("gitReview", move |args| {
                let workspace_id = args.string(0)?.to_string();
                reader.read(&reader_id, STORE);
                reader.read(&reader_id, &format!("git:{workspace_id}"));
                Ok(to_host(&reader.git_review(&workspace_id)))
            })
            .function("gitReviewRevision", move |args| {
                let workspace_id = args.string(0)?.to_string();
                counter.read(&counter_id, STORE);
                counter.read(&counter_id, &format!("git:{workspace_id}"));
                Ok(HostValue::Number(
                    counter.git_review_revision(&workspace_id) as f64,
                ))
            })
            .async_function("gitDo", move |args| {
                let action = args.string(0)?.to_string();
                let workspace_id = args.string(1)?.to_string();
                let rest: Vec<Value> = (2..args.len())
                    .filter_map(|i| args.get(i).map(from_host))
                    .collect();
                let focused = doer.0.data.borrow().session_id.clone();
                let (tx, rx) = futures::channel::oneshot::channel();
                gpui_shell::with_current_app(|cx| {
                    cx.defer(move |cx| {
                        let Some(git) = crate::git::host(cx) else {
                            let _ = tx.send(Err("Git is not kept in this window.".to_string()));
                            return;
                        };
                        let waiter = git.run(
                            &workspace_id,
                            |store, ready, out| {
                                git_action(
                                    store,
                                    &action,
                                    &workspace_id,
                                    &rest,
                                    focused,
                                    ready,
                                    out,
                                )
                            },
                            cx,
                        );
                        let _ = tx.send(waiter.map(|ticket| git.wait(ticket)));
                    })
                })
                .ok_or_else(|| HostError::new("No app to reach the window in."))?;
                Ok(async move {
                    let waiter = match rx.await {
                        Ok(Ok(waiter)) => waiter,
                        Ok(Err(error)) => return Err(HostError::new(error)),
                        Err(_) => return Ok(HostValue::Null),
                    };
                    Ok(to_host(&waiter.await.unwrap_or(Value::Null)))
                })
            })
    }

    /// The props screen copy `key` was last given, while it has any.
    pub fn props_of(&self, key: &str) -> Option<Value> {
        self.0.data.borrow().props.get(key).cloned()
    }

    /// Screen `key` is closed: its props go, and what it read (a view made for the key again
    /// reads afresh).
    pub fn clear_props(&self, key: &str) {
        self.0.reads.borrow_mut().remove(key);
        if self.0.data.borrow_mut().props.remove(key).is_some() {
            self.bump(&format!("props:{key}"));
        }
    }

    /// Which computer, session and workspace are on screen. Call [`Self::flush`] after.
    pub fn set_active(
        &self,
        host_id: Option<String>,
        session_id: Option<String>,
        workspace_id: Option<String>,
    ) {
        {
            let mut data = self.0.data.borrow_mut();
            data.host_id = host_id;
            data.session_id = session_id;
            data.workspace_id = workspace_id;
        }
        self.bump(VIEW);
    }

    /// Replaces the sidebar's view settings. Call [`Self::flush`] after.
    pub fn set_sidebar(&self, settings: SidebarSettings) {
        self.0.data.borrow_mut().sidebar = settings;
        self.bump(SIDEBAR);
    }

    pub fn sidebar(&self) -> SidebarSettings {
        self.0.data.borrow().sidebar.clone()
    }

    /// Keeps the sidebar's view settings in `file` from now on, starting from what it holds.
    pub fn keep_sidebar_in(&self, file: std::path::PathBuf) {
        let kept = SidebarSettings::read(&file);
        *self.0.sidebar_file.borrow_mut() = Some(file);
        self.set_sidebar(kept);
    }

    /// Shows theme `name` (the default when unknown) until the core names another. Call
    /// [`Self::flush`] after.
    pub fn set_theme(&self, name: &str) {
        self.0.data.borrow_mut().chosen_theme = Some(name.to_string());
        self.bump(THEME);
    }

    /// The theme on screen.
    pub fn theme(&self) -> Theme {
        let data = self.0.data.borrow();
        let name = data
            .chosen_theme
            .clone()
            .or_else(|| data.model.store.theme.clone())
            .unwrap_or_else(|| theme::DEFAULT.into());
        theme::resolve(&name)
    }

    /// The computer the navigation shows and the workspace focused with no session of it on
    /// screen, for the start page.
    pub fn shown_place(&self) -> (String, Option<String>) {
        (self.host_id(), self.0.data.borrow().workspace_id.clone())
    }

    /// No workspace is focused: the start page is not any workspace's. Call [`Self::flush`] after.
    pub fn unfocus_workspace(&self) {
        if self.0.data.borrow_mut().workspace_id.take().is_some() {
            self.bump(VIEW);
        }
    }

    /// The computer the navigation shows: the one picked, else the focused session's.
    fn host_id(&self) -> String {
        let data = self.0.data.borrow();
        data.host_id.clone().unwrap_or_else(|| {
            data.session_id
                .as_ref()
                .and_then(|id| data.model.store.sessions.iter().find(|s| s.id == *id))
                .map_or_else(|| LOCAL.to_string(), |s| s.host_id.clone())
        })
    }

    /// The navigation's view: the active ids, and the sidebar's options unless `options` names
    /// them (`useNavigation`'s, which default to off).
    fn view(&self, options: Option<&Value>) -> View {
        // Another computer's sessions when the options name it, else the shown computer's.
        let host_id = options
            .and_then(|o| o.get("hostId"))
            .and_then(Value::as_str)
            .map_or_else(|| self.host_id(), str::to_string);
        let data = self.0.data.borrow();
        let flag = |key: &str| {
            options
                .and_then(|o| o.get(key))
                .and_then(Value::as_bool)
                .unwrap_or(false)
        };
        let session = data
            .session_id
            .as_ref()
            .and_then(|id| data.model.store.sessions.iter().find(|s| s.id == *id));
        View {
            host_id,
            session_id: data.session_id.clone(),
            workspace_id: data
                .workspace_id
                .clone()
                // A session with no workspace recorded belongs to the one at its folder, as the
                // web's tab strip places it.
                .or_else(|| {
                    let s = session?;
                    s.workspace_id.clone().or_else(|| {
                        let store = &data.model.store;
                        store
                            .workspaces
                            .iter()
                            .find(|w| navigation::in_workspace(s, w))
                            .map(|w| w.id.clone())
                    })
                }),
            show_terminals: flag("showTerminals"),
            sort_by_attention: flag("sortByAttention"),
        }
    }

    fn store(&self) -> Arc<Store> {
        self.0.data.borrow().model.store.clone()
    }

    fn bump(&self, part: &str) {
        if part == SIDEBAR {
            if let Some(file) = self.0.sidebar_file.borrow().as_ref() {
                // A per-viewer convenience, as the web's localStorage: a failed write keeps the
                // settings for this run.
                let json = self.0.data.borrow().sidebar.to_json();
                let _ = std::fs::write(file, json.to_string());
            }
        }
        self.0.revision.set(self.0.revision.get() + 1);
        *self
            .0
            .revisions
            .borrow_mut()
            .entry(part.to_string())
            .or_default() += 1;
    }

    /// Notes that mod `id` read `part` at its current revision.
    fn read(&self, id: &str, part: &str) {
        let revision = self.0.revisions.borrow().get(part).copied().unwrap_or(0);
        let mut touched = self.0.touched.borrow_mut();
        let list = touched.entry(id.to_string()).or_default();
        if !list.iter().any(|p| p == part) {
            list.push(part.to_string());
        }
        drop(touched);
        self.0
            .reads
            .borrow_mut()
            .entry(id.to_string())
            .or_default()
            .entry(part.to_string())
            .or_insert(revision);
    }

    /// Mods whose parts moved since they read them; their records are brought up to date.
    fn changed(&self) -> HashSet<String> {
        let revisions = self.0.revisions.borrow();
        let mut changed = HashSet::new();
        for (id, seen) in self.0.reads.borrow_mut().iter_mut() {
            for (part, revision) in seen.iter_mut() {
                let now = revisions.get(part.as_str()).copied().unwrap_or(0);
                if *revision != now {
                    *revision = now;
                    changed.insert(id.clone());
                }
            }
        }
        changed
    }

    /// Re-renders the mods that read a part that changed, and keeps gpui-base's theme in step.
    pub fn flush(&self, cx: &mut App) {
        self.0.flush_queued.set(false);
        let theme = self.theme();
        let restyled = self.0.data.borrow().applied.as_ref() != Some(&theme);
        if restyled {
            theme::apply(&theme, cx);
            self.0.data.borrow_mut().applied = Some(theme);
        }
        let changed = self.changed();
        if changed.is_empty() && !restyled {
            return;
        }
        let mut refreshes = self.0.refreshes.borrow_mut();
        for id in &changed {
            *refreshes.entry(id.clone()).or_default() += 1;
        }
        drop(refreshes);
        // A new theme reaches every mod: one may read it through gpui-base without asking us.
        let only = (!restyled).then_some(&changed);
        let hosts = self.0.hosts.borrow().clone();
        for host in hosts {
            host.refresh(only, cx);
        }
    }

    /// Flushes once the current script call has unwound.
    fn flush_later(&self) {
        if self.0.flush_queued.replace(true) {
            return;
        }
        let perch = self.clone();
        let deferred = gpui_shell::with_current_app(|cx| cx.defer(move |cx| perch.flush(cx)));
        if deferred.is_none() {
            self.0.flush_queued.set(false);
        }
    }

    /// Every command a mod may `run`, with its title, the arguments it takes and its key.
    pub fn commands(&self) -> Vec<Value> {
        let keymap = self.keymap();
        let mut seen = HashSet::new();
        let mut list = Vec::new();
        let mut push = |id: &str, title: &str, args: Option<&str>| {
            if seen.insert(id.to_string()) {
                list.push(json!({
                    "id": id, "title": title, "args": args, "keys": keymap.label(id),
                }));
            }
        };
        for (id, title, args) in OWN.iter().chain(&WINDOW_COMMANDS).chain(&USAGE_COMMANDS) {
            push(id, title, Some(args));
        }
        for shortcut in all_shortcuts() {
            if shortcut.scope != Scope::Leader {
                push(shortcut.id, shortcut.title, None);
            }
        }
        for (id, arg) in TYPED {
            push(
                id,
                typed_title(id),
                arg.map(|a| format!("{{{a}}}")).as_deref(),
            );
        }
        list
    }

    /// The window's key bindings as the person has them.
    pub fn keymap(&self) -> Keymap {
        let data = self.0.data.borrow();
        Keymap::new(data.model.keybindings.clone(), data.model.keys_file.clone())
    }

    fn known(&self, id: &str) -> bool {
        OWN.iter()
            .chain(&WINDOW_COMMANDS)
            .chain(&USAGE_COMMANDS)
            .any(|(own, _, _)| *own == id)
            || TYPED.iter().any(|(typed, _)| *typed == id)
            || all_shortcuts().any(|s| s.id == id && s.scope != Scope::Leader)
            // The browser toolbar's page commands (`browser.addressChange`, `browser.back`, …): the
            // window's `browser_command` takes every `browser.*`; they are not listed for the palette.
            || id.starts_with("browser.")
    }

    /// Runs one of the commands this module owns (the navigation's view). `None`: not one of them.
    pub(crate) fn run_own(&self, id: &str, args: &Value) -> Option<Result<(), String>> {
        let text = |key: &str| args.get(key).and_then(Value::as_str).map(str::to_string);
        let result = match id {
            "host.select" => (|| {
                let host = text("id").ok_or("This command needs {id}.")?;
                let store = self.store();
                if host != LOCAL && !store.host_entries.iter().any(|h| h.id == host) {
                    return Err(format!("No host {host}."));
                }
                self.0.data.borrow_mut().host_id = Some(host);
                self.bump(VIEW);
                Ok(())
            })(),
            // `workspace.open` is the window's too (its session last shown), once this has run.
            "workspace.focus" | "workspace.open" => (|| {
                let workspace = text("id").ok_or("This command needs {id}.")?;
                if !self.store().workspaces.iter().any(|w| w.id == workspace) {
                    return Err(format!("No workspace {workspace}."));
                }
                self.0.data.borrow_mut().workspace_id = Some(workspace);
                self.bump(VIEW);
                Ok(())
            })(),
            // The project's checkout the window lands in, as the web's `focusWorkspaceProject`.
            "project.focus" | "project.select" | "project.next" | "project.prev" => (|| {
                let store = self.store();
                let view = self.view(None);
                let shown: Vec<String> = navigation::navigation(&store, &view)
                    .projects
                    .into_iter()
                    .map(|p| p.id)
                    .collect();
                let index = args
                    .get("index")
                    .and_then(Value::as_f64)
                    .filter(|n| n.fract() == 0.0 && *n >= 1.0);
                let current = view.workspace_id.as_ref().and_then(|w| {
                    let project = &store.workspaces.iter().find(|x| x.id == *w)?.project_id;
                    shown.iter().position(|p| p == project)
                });
                let step = |by: isize| {
                    let n = shown.len() as isize;
                    (n > 0).then(|| {
                        let at = current.map_or(if by > 0 { 0 } else { n - 1 }, |i| {
                            (i as isize + by).rem_euclid(n)
                        });
                        shown[at as usize].clone()
                    })
                };
                let project = match id {
                    "project.next" => step(1).ok_or("There are no projects.")?,
                    "project.prev" => step(-1).ok_or("There are no projects.")?,
                    "project.select" if index.is_some() => {
                        let n = index.unwrap_or(0.) as usize;
                        shown
                            .get(n - 1)
                            .cloned()
                            .ok_or_else(|| format!("There is no project {n}."))?
                    }
                    _ => {
                        let wanted = text("id").ok_or(if id == "project.select" {
                            "This command needs {index} or {id}."
                        } else {
                            "This command needs {id}."
                        })?;
                        if !store.projects.iter().any(|p| p.id == wanted) {
                            return Err(format!("There is no project {wanted}."));
                        }
                        wanted
                    }
                };
                let (workspace, _) = navigation::landing_workspace(&store, &project, None)
                    .ok_or_else(|| format!("Project {project} has no workspace yet."))?;
                let host = store
                    .projects
                    .iter()
                    .find(|p| p.id == project)
                    .map(|p| p.host_id.clone());
                let mut data = self.0.data.borrow_mut();
                data.workspace_id = Some(workspace);
                data.host_id = host.or(data.host_id.take());
                drop(data);
                self.bump(VIEW);
                Ok(())
            })(
            ),
            "project.fold" => (|| {
                let project = text("id").ok_or("This command needs {id}.")?;
                let mut data = self.0.data.borrow_mut();
                let list = &mut data.sidebar.collapsed_projects;
                let folded = list.contains(&project);
                let fold = args
                    .get("folded")
                    .and_then(Value::as_bool)
                    .unwrap_or(!folded);
                list.retain(|p| *p != project);
                if fold {
                    list.push(project);
                }
                drop(data);
                self.bump(SIDEBAR);
                Ok(())
            })(),
            "sidebar.organize" => {
                let mut data = self.0.data.borrow_mut();
                let next = match text("organize") {
                    Some(word) => word,
                    None if data.sidebar.organize == "project" => "status".into(),
                    None => "project".into(),
                };
                let patched = data.sidebar.patch(&json!({ "organize": next }));
                drop(data);
                self.bump(SIDEBAR);
                patched
            }
            "app.theme" => (|| {
                let name = text("name").ok_or(r#"This command needs {name: "…"}."#)?;
                if !theme::names().contains(&name.as_str()) {
                    return Err(format!("No theme {name}."));
                }
                self.set_theme(&name);
                Ok(())
            })(),
            _ => return None,
        };
        Some(result)
    }

    /// Runs `id` in the attached window, as its key or palette entry would.
    fn run_in_window(&self, id: &str, args: Option<&Value>, cx: &mut App) -> Result<(), String> {
        let (handle, workspace) = {
            let attached = self.0.attached.borrow();
            let attached = attached
                .as_ref()
                .ok_or("No window runs commands for this mod.")?;
            (attached.handle, attached.workspace.clone())
        };
        let workspace = workspace.upgrade().ok_or("The window is gone.")?;
        handle
            .update(cx, |_, window, cx| {
                workspace.update(cx, |ws, cx| ws.run_command(id, args, window, cx))
            })
            .map_err(|_| "The window is gone.".to_string())?
    }

    /// The `perch` module for mod `id`.
    /// How many times a copy under key `key` was loaded (see [`Self::module`]).
    pub fn loads(&self, key: &str) -> u64 {
        self.0.loads.borrow().get(key).copied().unwrap_or(0)
    }

    /// How many times each copy (by key) was re-rendered for a part it read that moved: what a
    /// gesture costs the screens that do not show it.
    pub fn refreshes(&self) -> HashMap<String, u64> {
        self.0.refreshes.borrow().clone()
    }

    pub fn module(&self, id: &str) -> HostModule {
        // Built once for each load of the copy `id`.
        let load = {
            let mut loads = self.0.loads.borrow_mut();
            let count = loads.entry(id.to_string()).or_default();
            *count += 1;
            *count
        };
        let id: Rc<str> = id.into();
        let reader = |part: &'static str, f: fn(&Perch, &HostArguments) -> Value| {
            let (perch, id) = (self.clone(), id.clone());
            move |args: &HostArguments| -> HostResult {
                perch.read(&id, part);
                Ok(to_host(&f(&perch, args)))
            }
        };
        let both = |f: fn(&Perch, &HostArguments) -> Value| {
            let (perch, id) = (self.clone(), id.clone());
            move |args: &HostArguments| -> HostResult {
                perch.read(&id, STORE);
                perch.read(&id, VIEW);
                perch.read(&id, WINDOW);
                Ok(to_host(&f(&perch, args)))
            }
        };
        let sidebar_set = self.clone();
        let run = self.clone();
        let start = self.clone();
        let (props, props_id) = (self.clone(), id.clone());
        let (close, close_id) = (self.clone(), id.clone());
        let opener = self.clone();
        let (notifier, notify_id) = (self.clone(), id.clone());
        self.git_functions(&id, self.files_functions(&id, HostModule::new("perch")))
            .function("props", move |_| {
                props.read(&props_id, &format!("props:{props_id}"));
                let value = props.0.data.borrow().props.get(&*props_id).cloned();
                Ok(to_host(&value.unwrap_or_else(|| json!({}))))
            })
            .function("close", move |args| {
                let result = args.get(0).map(from_host).unwrap_or(Value::Null);
                close.close_screen(&close_id, result)
            })
            .async_function("openScreen", move |args| {
                let screen = args.string(0)?.to_string();
                let props = args.get(1).map(from_host).unwrap_or_else(|| json!({}));
                let rx = opener.open_screen(&screen, props)?;
                Ok(async move {
                    match rx.await {
                        Ok(Ok(result)) => Ok(to_host(&result)),
                        Ok(Err(error)) => Err(HostError::new(error)),
                        Err(_) => Err(HostError::new("The window went before the screen closed.")),
                    }
                })
            })
            .function(
                "notifications",
                reader(
                    WINDOW,
                    |perch, _| json!({ "items": perch.0.data.borrow().window.notifications }),
                ),
            )
            // A notification from this mod, as the web's `notify`: `{title, body?, level?, icon?,
            // action?: {command, args?}, timeout?}`.
            .function("notify", move |args| {
                notifier.notify(&notify_id, &from_host(args.value(0)?))
            })
            .function(
                "zoom",
                reader(WINDOW, |perch, _| json!(perch.0.data.borrow().window.zoom)),
            )
            // A workspace's drawer pages, the one shown and how many browser tabs it has.
            .function(
                "browserPages",
                reader(WINDOW, |perch, args| {
                    let workspace = args.get(0).and_then(HostValue::as_str).unwrap_or("");
                    let pages = &perch.0.data.borrow().window.browser_pages;
                    pages
                        .get(workspace)
                        .cloned()
                        .unwrap_or_else(|| json!({ "pages": [], "shownId": null, "tabCount": 0 }))
                }),
            )
            // The window's requests to a screen, as counts that grow by one per request.
            .function(
                "requests",
                reader(WINDOW, |perch, _| {
                    let data = perch.0.data.borrow();
                    json!({ "new-tab": data.window.new_tab,
                                "add-project": data.window.add_project_asks })
                }),
            )
            // The scale factor of the window this mod is drawn in (physical pixels per logical
            // pixel), read where the script runs, so it is the window's own and a mod can lay out
            // on whole device pixels.
            .function("scale", |_| {
                gpui_shell::with_current(|window, _| to_host(&json!(window.scale_factor())))
                    .ok_or_else(|| HostError::new("scale() is read while a mod draws."))
            })
            .function("paneLook", |_| {
                Ok(to_host(&json!({
                    "headerAt": "top",
                    "headerReveal": "always",
                    "headerHeight": super::screens::PANE_HEADER_HEIGHT,
                })))
            })
            .function(
                "providers",
                reader(STORE, |perch, args| {
                    let host = args.get(0).and_then(HostValue::as_str).unwrap_or(LOCAL);
                    perch.providers(host)
                }),
            )
            .async_function("startSession", move |args| {
                let host = args.string(0)?.to_string();
                let cwd = args.get(1).and_then(HostValue::as_str).map(str::to_string);
                let agent = args.string(2)?.to_string();
                let rx = start.in_window(
                    "session.start",
                    Some(json!({ "hostId": host, "cwd": cwd, "agent": agent })),
                )?;
                Ok(settled(rx))
            })
            .declarations(module_body(DECLARATIONS))
            .function(
                "navigation",
                both(|perch, args| {
                    let options = args.get(0).map(from_host);
                    let view = perch.view(options.as_ref());
                    serde_json::to_value(navigation::navigation(&perch.store(), &view))
                        .unwrap_or(Value::Null)
                }),
            )
            .function(
                "hosts",
                both(|perch, _| {
                    serde_json::to_value(navigation::hosts(&perch.store(), &perch.host_id()))
                        .unwrap_or(Value::Null)
                }),
            )
            .function("statusLine", both(|perch, _| perch.status_line()))
            // `usePlanUsage`'s value: the web's empty one until the core answers `usage.get`.
            .function(
                "planUsage",
                reader(STORE, |perch, _| {
                    let usage = perch.0.data.borrow().model.store.plan_usage.clone();
                    if usage.is_null() {
                        json!({"usage": [], "updatedAt": 0, "spend": null, "redeemResult": null})
                    } else {
                        usage
                    }
                }),
            )
            // The window's logical size (`window.innerWidth`/`innerHeight`, media rules).
            .function(
                "viewport",
                reader(WINDOW, |perch, _| {
                    // Null before a window has drawn the mod.
                    let (width, height) = perch.0.data.borrow().viewport;
                    if width > 0. && height > 0. {
                        json!({"width": width, "height": height})
                    } else {
                        Value::Null
                    }
                }),
            )
            .function(
                "tabSlide",
                reader(DRAG, |perch, _| perch.0.data.borrow().slide.clone()),
            )
            .function(
                "pointerFollow",
                reader(DRAG, |perch, _| perch.0.data.borrow().pointer.clone()),
            )
            .function("workspaceTabs", both(|perch, _| perch.workspace_tabs()))
            .function("focus", both(|perch, _| perch.focus()))
            // `useSessionFolders`: the shown computer's sessions by folder.
            .function(
                "sessionFolders",
                both(|perch, _| {
                    let view = perch.view(None);
                    serde_json::to_value(navigation::session_folders(&perch.store(), &view))
                        .unwrap_or(Value::Null)
                }),
            )
            // `useAddProject`'s state: `{status, error?, hostId?}`.
            .function(
                "addProject",
                reader(WINDOW, |perch, _| {
                    match &perch.0.data.borrow().window.add_project {
                        Value::Null => json!({ "status": "idle" }),
                        state => state.clone(),
                    }
                }),
            )
            // Whether a request of `kind` the window made a moment ago is still for a screen that
            // mounts now (the sidebar the Add project request showed).
            .function("requestFresh", {
                let perch = self.clone();
                move |args| {
                    let kind = args.string(0)?;
                    let at = perch.0.data.borrow().window.add_project_at;
                    let fresh = kind == "add-project"
                        && at.is_some_and(|at| at.elapsed().as_millis() < ADD_PROJECT_LATE_MS);
                    Ok(HostValue::Bool(fresh))
                }
            })
            .function("addProjectFolder", {
                let perch = self.clone();
                move |args| {
                    let path = args.string(0)?.to_string();
                    let name = args.get(1).and_then(HostValue::as_str).map(str::to_string);
                    let host = args
                        .get(2)
                        .and_then(HostValue::as_str)
                        .map_or_else(|| perch.host_id(), str::to_string);
                    perch.in_workspace(move |ws, cx| ws.add_project(&host, &path, name, cx))?;
                    Ok(HostValue::Null)
                }
            })
            .function("clearAddProject", {
                let perch = self.clone();
                move |_| {
                    perch.in_workspace(|ws, cx| ws.clear_add_project(cx))?;
                    Ok(HostValue::Null)
                }
            })
            // A question for the core, `ask(kind, args)` (`client::ask_frame`'s list): the
            // folder browser's listing (`fs.browse`, which the core routes to a remote host),
            // Instructions and Project memory. Resolves with the core's answer, or null when no
            // core answers; rejects with its refusal.
            // Context Bridge (`docs/CONTEXT-BRIDGE.md`): whether it is offered for a workspace, and asking an
            // agent about a source or a file (the dialog opens on it).
            .function(
                "contextBridgeAvailable",
                reader(STORE, |perch, args| {
                    let workspace = args.get(0).and_then(HostValue::as_str).unwrap_or("");
                    json!(crate::workspace::bridge_available(
                        &perch.store(),
                        workspace
                    ))
                }),
            )
            .function("askAgent", {
                let perch = self.clone();
                move |args| {
                    let workspace = args.string(0)?.to_string();
                    let source = serde_json::from_value(from_host(args.value(1)?))
                        .map_err(|e| HostError::new(format!("Not a context source: {e}")))?;
                    perch.in_workspace(move |ws, cx| drop(ws.ask_agent(&workspace, source, cx)))?;
                    Ok(HostValue::Null)
                }
            })
            .function("askAgentAboutFile", {
                let perch = self.clone();
                move |args| {
                    let workspace = args.string(0)?.to_string();
                    let path = args.string(1)?.to_string();
                    perch.in_workspace(move |ws, cx| {
                        drop(ws.ask_agent_about_file(&workspace, &path, cx))
                    })?;
                    Ok(HostValue::Null)
                }
            })
            // The context-bridge screen's actions on the window's capture: the menu's Ask agent, Preview, the one
            // Send (the window keeps its operation id and refuses a second) and Open agent.
            .function("contextAsk", {
                let perch = self.clone();
                move |_| {
                    perch.in_workspace(|ws, cx| ws.bridge_ask_from_menu(cx))?;
                    Ok(HostValue::Null)
                }
            })
            .async_function("contextPreview", {
                let perch = self.clone();
                move |args| {
                    let instruction = args.string(0)?.to_string();
                    let answer = perch.bridge(move |ws, cx| ws.bridge_preview(instruction, cx))?;
                    Ok(answered(answer))
                }
            })
            .async_function("contextSend", {
                let perch = self.clone();
                move |args| {
                    let instruction = args.string(0)?.to_string();
                    let digest = args.string(1)?.to_string();
                    let target = args.string(2)?.to_string();
                    let preview = args.get(3).map(from_host).unwrap_or(Value::Null);
                    let answer = perch.bridge(move |ws, cx| {
                        ws.bridge_send(instruction, digest, target, preview, cx)
                    })?;
                    Ok(answered(answer))
                }
            })
            .function("contextOpenAgent", {
                let perch = self.clone();
                move |args| {
                    let session = args.string(0)?.to_string();
                    if !perch.store().sessions.iter().any(|s| s.id == session) {
                        return Ok(HostValue::Bool(false));
                    }
                    perch.in_workspace(move |ws, cx| {
                        ws.bridge_open_agent(&session, cx);
                    })?;
                    Ok(HostValue::Bool(true))
                }
            })
            .async_function("ask", {
                let perch = self.clone();
                move |args| {
                    let kind = args.string(0)?.to_string();
                    let fields = args.get(1).map(from_host).unwrap_or(Value::Null);
                    let answer = perch.ask(&kind, fields)?;
                    Ok(async move {
                        match answer.await {
                            Ok(Ok(answer)) => Ok(to_host(&answer)),
                            Ok(Err(error)) => Err(HostError::new(error)),
                            Err(_) => Ok(HostValue::Null),
                        }
                    })
                }
            })
            // A screen's own key (`shortcutFor(event, scope)`), for the scopes the window leaves
            // to a screen: `{id, scope}` or null.
            .function(
                "shortcutFor",
                reader(KEYS, |perch, args| {
                    let event = args.get(0).map(from_host).unwrap_or(Value::Null);
                    let scope = args.get(1).and_then(HostValue::as_str).unwrap_or("");
                    match perch.keymap().screen_shortcut(&event, scope) {
                        Some(id) => json!({ "id": id, "scope": scope }),
                        None => Value::Null,
                    }
                }),
            )
            // A modal screen keeps Escape for itself (true) or gives it back to the window (false).
            .function("holdEscape", {
                let (perch, id) = (self.clone(), id.clone());
                move |args| {
                    let held = matches!(args.get(0), Some(HostValue::Bool(true)));
                    let id = id.to_string();
                    perch.in_workspace(move |ws, _| ws.hold_escape(&id, held))?;
                    Ok(HostValue::Null)
                }
            })
            // An in-flow screen's own field has the keyboard (true) or let it go (false).
            .function("holdKeyboard", {
                let (perch, id) = (self.clone(), id.clone());
                move |args| {
                    let held = matches!(args.get(0), Some(HostValue::Bool(true)));
                    let id = id.to_string();
                    perch.in_workspace(move |ws, cx| ws.hold_keyboard(&id, load, held, cx))?;
                    Ok(HostValue::Null)
                }
            })
            // The instant a test holds the screens' clock at (`Self::hold_clock`), else null.
            .function("heldClock", {
                let perch = self.clone();
                move |_| {
                    Ok(perch
                        .0
                        .held_clock
                        .get()
                        .map_or(HostValue::Null, HostValue::Number))
                }
            })
            // Whether a computer's core has a capability (`server.info`; another computer's as the
            // core relays it), as the web's clients check before offering what needs it.
            .function(
                "coreCan",
                reader(STORE, |perch, args| {
                    let capability = args.get(0).and_then(HostValue::as_str).unwrap_or("");
                    let host = args.get(1).and_then(HostValue::as_str).unwrap_or(LOCAL);
                    let store = perch.store();
                    let capabilities = if host == LOCAL {
                        Some(&store.local_capabilities)
                    } else {
                        store.host_capabilities.get(host)
                    };
                    json!(capabilities.is_some_and(|c| c.iter().any(|c| c == capability)))
                }),
            )
            // Settings' "Empty workspace opens": the pane a new workspace starts with ("" for
            // none), null until the core has sent its settings.
            .function(
                "emptyWorkspaceAgent",
                reader(STORE, |perch, _| json!(perch.store().empty_agent)),
            )
            // The window's last request for a project's worktree menu (leader W, New workspace,
            // `worktree.remove`): `{projectKey, nonce, remove?, create?}`, null once taken.
            .function(
                "worktreeMenuRequest",
                reader(WINDOW, |perch, _| {
                    perch.0.data.borrow().window.worktree_request.clone()
                }),
            )
            .function("takeWorktreeRequest", {
                let perch = self.clone();
                move |_| {
                    perch.in_workspace(|ws, cx| ws.take_worktree_request(cx))?;
                    Ok(HostValue::Null)
                }
            })
            // Whether a screen sits in a region of the window (a sidebar) rather than over all of it.
            .function("inRegion", |args| {
                let id = args.get(0).and_then(HostValue::as_str).unwrap_or("");
                let place = super::screens::screen(id).map(|screen| screen.place);
                Ok(HostValue::Bool(
                    place == Some(super::screens::Place::InFlow),
                ))
            })
            .function("terminals", both(|perch, _| perch.terminals()))
            .function(
                "agentChoices",
                reader(STORE, |perch, args| {
                    let host = args.get(0).and_then(HostValue::as_str).unwrap_or(LOCAL);
                    perch.agent_choices(host)
                }),
            )
            .function(
                "sidebarSettings",
                reader(SIDEBAR, |perch, _| perch.sidebar().to_json()),
            )
            .function("setSidebarSettings", move |args| {
                let patch = from_host(args.value(0)?);
                let mut settings = sidebar_set.sidebar();
                settings.patch(&patch).map_err(HostError::new)?;
                let json = settings.to_json();
                sidebar_set.set_sidebar(settings);
                sidebar_set.flush_later();
                Ok(to_host(&json))
            })
            .function("theme", reader(THEME, |perch, _| perch.theme_tokens()))
            .function("revision", {
                let perch = self.clone();
                move |_| Ok(HostValue::Number(perch.0.revision.get() as f64))
            })
            // Every part's revision, and the parts this mod's calls read since it last asked: a
            // screen reads a snapshot again only when a part that snapshot read has moved.
            .function("revisions", {
                let perch = self.clone();
                move |_| Ok(to_host(&json!(*perch.0.revisions.borrow())))
            })
            .function("takeReads", {
                let (perch, id) = (self.clone(), id.clone());
                move |_| {
                    let parts = perch
                        .0
                        .touched
                        .borrow_mut()
                        .remove(&*id)
                        .unwrap_or_default();
                    Ok(to_host(&json!(parts)))
                }
            })
            .function(
                "themeName",
                reader(THEME, |perch, _| json!(perch.theme().name)),
            )
            .function("themes", |_| Ok(to_host(&json!(theme::names()))))
            .function("commands", reader(KEYS, |perch, _| json!(perch.commands())))
            .function("keys", reader(KEYS, |perch, _| perch.keys()))
            .function("keybindings", reader(KEYS, |perch, _| perch.keybindings()))
            // Settings' pages. The core's settings as it last sent them (the web's `settings`), null
            // until it has.
            .function(
                "settings",
                reader(STORE, |perch, _| {
                    perch.store().settings.clone().unwrap_or(Value::Null)
                }),
            )
            // A change to the core's settings or computers: `send("settings.update", {patch})`,
            // `send("hosts.upsert", {host})`, `send("hosts.delete", {id})`. The core answers with
            // `settings.current` / `hosts.updated`, which the readers above and below follow.
            .function("send", {
                let perch = self.clone();
                move |args| {
                    let kind = args.string(0)?.to_string();
                    perch.send(&kind, args.get(1).map(from_host).unwrap_or(Value::Null))?;
                    Ok(HostValue::Null)
                }
            })
            // The computers Settings > SSH hosts lists and each one's connection.
            .function(
                "hostEntries",
                reader(STORE, |perch, _| {
                    let store = perch.store();
                    let states: serde_json::Map<String, Value> = store
                        .host_states
                        .iter()
                        .map(|(id, f)| {
                            let mut state = json!({ "state": f.state });
                            if let Some(error) = &f.error {
                                state["error"] = json!(error);
                            }
                            (id.clone(), state)
                        })
                        .collect();
                    json!({ "hosts": store.host_entries, "hostStates": states })
                }),
            )
            // Settings > Keyboard: the commands' groups with their keys, and what recording a key
            // gives a command (`Keymap::record`).
            .function(
                "keyboard",
                reader(KEYS, |perch, _| {
                    let data = perch.0.data.borrow();
                    json!({
                        "groups": perch.keymap().settings_groups(),
                        "hasOverrides": !data.model.keybindings.is_empty(),
                    })
                }),
            )
            .function(
                "recordKey",
                reader(KEYS, |perch, args| {
                    let id = args.get(0).and_then(HostValue::as_str).unwrap_or("");
                    let event = args.get(1).map(from_host).unwrap_or(Value::Null);
                    perch.keymap().record(id, &event).unwrap_or(Value::Null)
                }),
            )
            .function(
                "shortcutLabel",
                reader(KEYS, |perch, args| {
                    json!(args
                        .get(0)
                        .and_then(HostValue::as_str)
                        .and_then(|id| perch.keymap().label(id)))
                }),
            )
            .async_function("run", move |args| {
                let id = args.string(0)?.to_string();
                let options = args.get(1).map(from_host).filter(|v| !v.is_null());
                if !run.known(&id) {
                    return Err(HostError::new(format!("No command {id}.")));
                }
                let (tx, rx) = futures::channel::oneshot::channel();
                let empty = json!({});
                match run.run_own(&id, options.as_ref().unwrap_or(&empty)) {
                    Some(result) => {
                        result.map_err(HostError::new)?;
                        run.flush_later();
                        // `app.theme` is also the core's to keep, and `workspace.open` also shows
                        // the workspace's session in the window.
                        let window_too = matches!(id.as_str(), "app.theme" | "workspace.open");
                        if window_too && run.0.attached.borrow().is_some() {
                            let perch = run.clone();
                            gpui_shell::with_current_app(|cx| {
                                cx.defer(move |cx| {
                                    let _ = perch.run_in_window(&id, options.as_ref(), cx);
                                })
                            });
                        }
                        let _ = tx.send(Ok(()));
                    }
                    None => return Ok(settled(run.in_window(&id, options)?)),
                }
                Ok(settled(rx))
            })
    }

    /// Holds the clock screens read (`Date.now`) at `ms` since the epoch, as a test's reference
    /// page holds its own; set before the screens load.
    pub fn hold_clock(&self, ms: f64) {
        self.0.held_clock.set(Some(ms));
    }

    /// Answers screens' questions with `asker` instead of the window's core (a test's fixture).
    pub fn set_asker(&self, asker: Asker) {
        *self.0.asker.borrow_mut() = Some(asker);
    }

    /// Takes screens' changes with `sender` instead of the window's core (a test's fixture).
    pub fn set_sender(&self, sender: Sender) {
        *self.0.sender.borrow_mut() = Some(sender);
    }

    /// Sends the core change `kind` with `args` (`settings.update`, `hosts.upsert`,
    /// `hosts.delete`); refused when they are not what the core takes.
    fn send(&self, kind: &str, args: Value) -> Result<(), HostError> {
        let frame = crate::client::send_frame(kind, &args).map_err(HostError::new)?;
        if let Some(sender) = self.0.sender.borrow().clone() {
            sender(kind, &args);
            return Ok(());
        }
        self.in_workspace(move |ws, cx| ws.send_to_core(frame, cx))
    }

    /// Puts question `kind` to the set asker, else the attached window's core; refused when
    /// `args` are not what the core takes.
    fn ask(
        &self,
        kind: &str,
        args: Value,
    ) -> Result<futures::channel::oneshot::Receiver<Result<Value, String>>, HostError> {
        let frame = crate::client::ask_frame(kind, &args).map_err(HostError::new)?;
        if let Some(asker) = self.0.asker.borrow().clone() {
            return Ok(asker(kind, &args));
        }
        let (tx, rx) = futures::channel::oneshot::channel();
        self.in_workspace(move |ws, cx| {
            let answer = ws.ask(frame, cx);
            cx.spawn(async move |_, _| {
                // No core followed: the sender goes unanswered, and so does the screen.
                if let Ok(answer) = answer.await {
                    let _ = tx.send(answer);
                }
            })
            .detach();
        })?;
        Ok(rx)
    }

    /// Runs `f` (a Context Bridge request) on the attached window's workspace once the calling script has unwound;
    /// the receiver gets its answer.
    fn bridge(
        &self,
        f: impl FnOnce(&mut Workspace, &mut gpui::Context<Workspace>) -> Answer + 'static,
    ) -> Result<Answer, HostError> {
        let (tx, rx) = futures::channel::oneshot::channel();
        self.in_workspace(move |ws, cx| {
            let answer = f(ws, cx);
            cx.spawn(async move |_, _| {
                if let Ok(outcome) = answer.await {
                    let _ = tx.send(outcome);
                }
            })
            .detach();
        })?;
        Ok(rx)
    }

    /// Runs `f` on the attached window's workspace once the calling script has unwound.
    fn in_workspace(
        &self,
        f: impl FnOnce(&mut Workspace, &mut gpui::Context<Workspace>) + 'static,
    ) -> Result<(), HostError> {
        let workspace = self
            .0
            .attached
            .borrow()
            .as_ref()
            .map(|attached| attached.workspace.clone())
            .ok_or_else(|| HostError::new("No window is attached to this mod."))?;
        gpui_shell::with_current_app(|cx| {
            cx.defer(move |cx| {
                if let Some(workspace) = workspace.upgrade() {
                    workspace.update(cx, f);
                }
            })
        })
        .ok_or_else(|| HostError::new("No app to reach the window in."))
    }

    /// Runs window command `id` once the calling script has unwound; the promise settles with it.
    fn in_window(
        &self,
        id: &str,
        args: Option<Value>,
    ) -> Result<futures::channel::oneshot::Receiver<Result<(), String>>, HostError> {
        let (tx, rx) = futures::channel::oneshot::channel();
        let (perch, id) = (self.clone(), id.to_string());
        gpui_shell::with_current_app(|cx| {
            cx.defer(move |cx| {
                let _ = tx.send(perch.run_in_window(&id, args.as_ref(), cx));
            })
        })
        .ok_or_else(|| HostError::new("No app to run the command in."))?;
        Ok(rx)
    }

    /// Opens floating screen `id` with `props` for the calling mod, once its script has unwound; the
    /// receiver gets the screen's result (`null` when dismissed, or when another opening of it
    /// replaces this one), or an error when no mod draws that screen.
    /// Mod `mod_id`'s notification (`perch.notify`), shown in this mod's window.
    fn notify(&self, mod_id: &str, note: &Value) -> HostResult {
        let (title, body, notice) = notice_from(note).map_err(HostError::new)?;
        let attached = self.0.attached.borrow();
        let attached = attached
            .as_ref()
            .ok_or_else(|| HostError::new("No window shows this mod's notifications."))?;
        let (workspace, mod_id) = (attached.workspace.clone(), mod_id.to_string());
        gpui_shell::with_current_app(|cx| {
            cx.defer(move |cx| {
                if let Some(workspace) = workspace.upgrade() {
                    workspace.update(cx, |ws, cx| {
                        ws.notify_for_mod(&mod_id, title, body, notice, cx)
                    });
                }
            })
        })
        .ok_or_else(|| HostError::new("No app to notify in."))?;
        Ok(HostValue::Null)
    }

    /// A mod opens screen `id` with `props`. `busy` (a confirmation whose action is running,
    /// which Escape and its buttons cannot end) is the window's to set: dropped here, so a mod
    /// cannot open a screen nothing closes.
    fn open_screen(
        &self,
        id: &str,
        mut props: Value,
    ) -> Result<futures::channel::oneshot::Receiver<Result<Value, String>>, HostError> {
        if let Some(fields) = props.as_object_mut() {
            fields.remove("busy");
        }
        let (tx, rx) = futures::channel::oneshot::channel();
        let attached = self.0.attached.borrow();
        let attached = attached
            .as_ref()
            .ok_or_else(|| HostError::new("No window opens screens for this mod."))?;
        let (handle, workspace, id) = (attached.handle, attached.workspace.clone(), id.to_string());
        gpui_shell::with_current_app(|cx| {
            cx.defer(move |cx| {
                let Some(workspace) = workspace.upgrade() else {
                    return;
                };
                let tx = Rc::new(RefCell::new(Some(tx)));
                let answer = tx.clone();
                let opened = handle.update(cx, |_, _, cx| {
                    workspace.update(cx, |ws, cx| {
                        let on_result: OnResult = Box::new(move |_, result, _, _| {
                            if let Some(tx) = answer.borrow_mut().take() {
                                let _ = tx.send(Ok(result));
                            }
                        });
                        // A sidebar row's menu is the tab menu the window works out for it.
                        if id == "tab-menu" && props["sessionMenu"] == true {
                            ws.open_session_menu(&props, on_result, cx)
                        } else {
                            ws.open_screen(&id, props, None, Some(on_result), cx)
                        }
                    })
                });
                if !matches!(opened, Ok(true)) {
                    if let Some(tx) = tx.borrow_mut().take() {
                        let _ = tx.send(Err(format!("No mod draws the {id} screen.")));
                    }
                }
            })
        })
        .ok_or_else(|| HostError::new("No app to open the screen in."))?;
        Ok(rx)
    }

    /// A floating screen closes itself with `result`; the window runs what it was opened for.
    fn close_screen(&self, key: &str, result: Value) -> HostResult {
        let attached = self.0.attached.borrow();
        let attached = attached
            .as_ref()
            .ok_or_else(|| HostError::new("No window opened this screen."))?;
        let (handle, workspace, key) =
            (attached.handle, attached.workspace.clone(), key.to_string());
        gpui_shell::with_current_app(|cx| {
            cx.defer(move |cx| {
                let Some(workspace) = workspace.upgrade() else {
                    return;
                };
                let _ = handle.update(cx, |_, window, cx| {
                    workspace.update(cx, |ws, cx| ws.screen_closed(&key, result, window, cx))
                });
            })
        })
        .ok_or_else(|| HostError::new("No app to close the screen in."))?;
        Ok(HostValue::Null)
    }

    /// `hostId`'s agents by id and name, for a screen to tell them apart (and draw their icons).
    /// A plain terminal is not one, though the new-tab choices list it.
    fn providers(&self, host_id: &str) -> Value {
        let store = self.store();
        let list: Vec<Value> = store
            .providers
            .get(host_id)
            .into_iter()
            .flatten()
            .filter(|p| p.id != perch_core::agent_fleet::TERMINAL_PROVIDER)
            .map(|p| json!({ "id": p.id, "name": p.name }))
            .collect();
        json!(list)
    }

    fn theme_tokens(&self) -> Value {
        let theme = self.theme();
        let tokens: serde_json::Map<String, Value> = theme::TOKENS
            .iter()
            .zip(theme.tokens.iter())
            .map(|(name, value)| (name.to_string(), json!(value)))
            .collect();
        Value::Object(tokens)
    }

    fn keys(&self) -> Value {
        let keymap = self.keymap();
        let list: Vec<Value> = all_shortcuts()
            .filter_map(|s| {
                let label = keymap.label(s.id)?;
                Some(json!({ "command": s.id, "keys": label }))
            })
            .collect();
        json!(list)
    }

    /// `useKeybindings`: every binding as the person has it, grouped as the web's help groups
    /// them, with the bindings in `keys.json` (`Keymap::help`).
    fn keybindings(&self) -> Value {
        json!(self.keymap().help())
    }

    /// `useStatusLine`: what the core's `status.update` says about the focused session, else the
    /// session's folder, else the shown workspace's (folder and branch).
    fn status_line(&self) -> Value {
        let host_id = self.host_id();
        let store = self.store();
        let view = self.view(None);
        let data = self.0.data.borrow();
        let session = data
            .session_id
            .as_ref()
            .and_then(|id| store.sessions.iter().find(|s| s.id == *id));
        let host = session.map_or(host_id.as_str(), |s| s.host_id.as_str());
        let entry = store.host_entries.iter().find(|h| h.id == host);
        let workspace = view
            .workspace_id
            .as_ref()
            .and_then(|id| store.workspaces.iter().find(|w| w.id == *id));
        let status = store.status.as_ref();
        let some = |text: &str| (!text.is_empty()).then(|| text.to_string());
        let cwd = status
            .and_then(|(cwd, _)| some(cwd))
            .or_else(|| session.and_then(|s| some(&s.cwd)))
            .or_else(|| workspace.and_then(|w| some(&w.path)))
            .unwrap_or_default();
        let branch = match status {
            Some((_, branch)) => Some(branch.clone()),
            None => workspace.and_then(|w| w.branch.clone()),
        };
        let mut line = json!({
            "connected": store.connected,
            "hostId": host,
            "sessionId": data.session_id,
            "cwd": cwd,
        });
        if let Some(entry) = entry {
            line["hostName"] = json!(entry.name);
        }
        if let Some(state) = store.host_states.get(host) {
            line["hostState"] = json!(state.state);
        }
        if let Some(branch) = branch {
            line["branch"] = json!(branch);
        }
        if let Some(tokens) = store.context_tokens {
            line["contextTokens"] = json!(tokens);
        }
        if let Some(cost) = store.cost_usd {
            line["costUsd"] = json!(cost);
        }
        line
    }

    /// A tab's state: with the keyboard, on screen beside it, or not shown.
    fn tab_state(&self, id: &str) -> &'static str {
        let data = self.0.data.borrow();
        if data.window.active.as_deref() == Some(id) {
            "focused"
        } else if data.window.shown.iter().any(|s| s == id) {
            "visible"
        } else {
            "hidden"
        }
    }

    /// A file tab's `TabInfo` (its id is `<workspace id>\n<path>`), as the web's `tabInfo`: its
    /// name, ● while its document is dirty, italic while a preview.
    fn file_tab(&self, data: &Data, id: &str) -> Option<Value> {
        let (workspace_id, path) = crate::workspace::file_tab(id)?;
        let dirty = data.files.get(workspace_id).is_some_and(|files| {
            let document = &files["documents"][path];
            document.is_object() && document["content"] != document["savedContent"]
        });
        Some(json!({
            "id": id,
            "kind": "file",
            "label": path.rsplit('/').next().unwrap_or(path),
            "title": path,
            "state": self.tab_state(id),
            "dirty": dirty,
            "preview": data.window.previews.iter().any(|p| p == id),
            "path": path,
            "workspaceId": workspace_id,
            "blank": false,
        }))
    }

    /// `useWorkspaceTabs`: the window's strip: sessions and files.
    fn workspace_tabs(&self) -> Value {
        let store = self.store();
        let view = self.view(None);
        let data = self.0.data.borrow();
        let workspace = view
            .workspace_id
            .as_ref()
            .and_then(|id| store.workspaces.iter().find(|w| w.id == *id));
        let tabs: Vec<Value> = data
            .window
            .strip
            .iter()
            .map(|id| {
                if let Some(tab) = data.window.browser_tabs.get(id) {
                    let mut tab = tab.clone();
                    tab["state"] = json!(self.tab_state(id));
                    return tab;
                }
                if let Some(tab) = self.file_tab(&data, id) {
                    return tab;
                }
                if let Some(workspace_id) = crate::workspace::review_tab(id) {
                    // The web's review tab (`tabInfo`): "Changes", no path of its own.
                    return json!({
                        "id": id,
                        "kind": "review",
                        "label": "Changes",
                        "title": "",
                        "state": self.tab_state(id),
                        "dirty": false,
                        "preview": false,
                        "path": "",
                        "workspaceId": workspace_id,
                        "blank": false,
                    });
                }
                let session = store.sessions.iter().find(|s| s.id == *id);
                let title = session.map(|s| s.title.clone()).unwrap_or_default();
                let mut tab = json!({
                    "id": id,
                    "kind": "session",
                    "label": session_label(&title),
                    "title": title,
                    "state": self.tab_state(id),
                    "dirty": false,
                    "preview": false,
                    "path": session.map(|s| s.cwd.clone()).unwrap_or_default(),
                });
                if let Some(s) = session {
                    if let Some(provider) = s
                        .current_provider_id
                        .as_ref()
                        .or(s.cli_provider_id.as_ref())
                    {
                        tab["provider"] = json!(provider);
                    }
                    tab["activity"] = json!(session_state(s));
                    tab["blocked"] = json!(s.blocked);
                    tab["unseen"] = json!(s.unseen);
                }
                tab
            })
            .collect();
        json!({
            "hostId": workspace.map_or(view.host_id.clone(), |w| w.host_id.clone()),
            "cwd": workspace.map(|w| w.path.clone()),
            "workspace": workspace.map(|w| json!({ "id": w.id, "path": w.path })),
            "activeId": data.window.active,
            "tabs": tabs,
            "tabShape": "square",
            // Off the strip the dragged tab dims (its ghost follows the pointer), as the web's.
            "draggingId": data.window.dragging,
        })
    }

    /// `focus()`: the host, workspace and session with the keyboard, and the panes on screen.
    fn focus(&self) -> Value {
        let store = self.store();
        let view = self.view(None);
        let data = self.0.data.borrow();
        let panes: Vec<Value> = data
            .window
            .shown
            .iter()
            .map(|id| {
                let title = store
                    .sessions
                    .iter()
                    .find(|s| s.id == *id)
                    .map(|s| s.title.clone())
                    .unwrap_or_default();
                json!({
                    "id": id, "kind": "session", "title": title,
                    "focused": data.window.active.as_deref() == Some(id.as_str()),
                })
            })
            .collect();
        json!({
            "hostId": view.host_id,
            "workspaceId": view.workspace_id,
            "sessionId": view.session_id,
            "terminalId": Value::Null,
            "panes": panes,
        })
    }

    /// `terminals()`: every session on every computer. What a terminal is doing is never claimed
    /// beyond what is known: `unknown` unless this window has it open, `host-unavailable` while
    /// its computer cannot be reached.
    fn terminals(&self) -> Value {
        let store = self.store();
        let data = self.0.data.borrow();
        let list: Vec<Value> = store
            .sessions
            .iter()
            .map(|s| {
                let provider = s
                    .current_provider_id
                    .clone()
                    .or(s.cli_provider_id.clone())
                    .unwrap_or_else(|| "terminal".into());
                let reachable = if s.host_id == LOCAL {
                    store.connected
                } else {
                    store
                        .host_states
                        .get(&s.host_id)
                        .is_some_and(|f| f.state == "connected")
                };
                let open = data.window.strip.contains(&s.id);
                let mut record = json!({
                    "target": format!("{}/{}", s.host_id, s.id),
                    "hostId": s.host_id,
                    "sessionId": s.id,
                    "kind": if provider == "terminal" { "terminal" } else { "agent" },
                    "provider": provider,
                    "title": s.title,
                    "cwd": s.current_cwd.clone().unwrap_or_else(|| s.cwd.clone()),
                    "terminalId": Value::Null,
                    "shown": data.window.shown.contains(&s.id),
                    "open": open,
                    "pinned": false,
                    "order": Value::Null,
                    "focused": data.window.active.as_deref() == Some(s.id.as_str()),
                    "state": if !reachable {
                        "host-unavailable"
                    } else {
                        data.window.terminals.get(&s.id).copied().unwrap_or("unknown")
                    },
                });
                if let Some(w) = &s.workspace_id {
                    record["workspaceId"] = json!(w);
                }
                if let Some(p) = &s.parent_session_id {
                    record["parentSessionId"] = json!(p);
                }
                record
            })
            .collect();
        json!(list)
    }

    /// `useAgentChoices` without its functions: what `host_id` can start. A computer that lists
    /// its agents (`agent.manifest.list`) offers its enabled, installed ones, is loading while
    /// asked (its last answer still offered) and says why when it refused; an older one offers
    /// the two agents every Perch knows.
    fn agent_choices(&self, host_id: &str) -> Value {
        let store = self.store();
        let capabilities = if host_id == LOCAL {
            Some(&store.local_capabilities)
        } else {
            store.host_capabilities.get(host_id)
        };
        let discovery = capabilities.is_some_and(|c| c.iter().any(|c| c == MANIFEST_CAPABILITY));
        let listed = store.providers.get(host_id);
        let defaults = store.provider_defaults.get(host_id);
        let choices: Vec<Value> = if discovery {
            listed
                .into_iter()
                .flatten()
                .map(|p| {
                    let mut choice = json!({ "id": p.id, "label": p.name });
                    if let Some(default) = defaults.and_then(|d| d.get(&p.id)) {
                        choice["isDefault"] = json!(default);
                    }
                    choice
                })
                .collect()
        } else {
            KNOWN_AGENTS
                .iter()
                .map(|(id, label)| json!({ "id": id, "label": label }))
                .collect()
        };
        let mut answer = json!({
            "connected": store.connected,
            "discovery": discovery,
            "state": "ready",
            "choices": choices,
        });
        if discovery {
            match store.agent_lists.get(host_id) {
                Some(AgentList::Failed(error)) => {
                    answer["state"] = json!("error");
                    answer["error"] = json!(error);
                }
                Some(AgentList::Loading) => answer["state"] = json!("loading"),
                None if listed.is_none() => answer["state"] = json!("loading"),
                None => {}
            }
        }
        answer
    }
}

/// The commands this module answers for, with their titles and arguments. `session.open` and
/// `app.theme` also reach the window (the sidebar opens the session, the core keeps the theme);
/// every other command is the window's.
const OWN: [(&str, &str, &str); 10] = [
    ("session.open", "Go to a session", "{id}"),
    ("project.focus", "Focus a project", "{id}"),
    (
        "project.select",
        "Show a project by position (1 = first, as the sidebar orders them) or id",
        "{index | id}",
    ),
    ("project.next", "Show the next project", "{}"),
    ("project.prev", "Show the previous project", "{}"),
    ("host.select", "Show a host's projects and sessions", "{id}"),
    ("workspace.focus", "Focus a workspace", "{id}"),
    (
        "project.fold",
        "Fold or unfold a project in the sidebar",
        "{id, folded?}",
    ),
    (
        "sidebar.organize",
        "List the sidebar by project or by status",
        "{organize?}",
    ),
    ("app.theme", "Choose a theme by name", "{name}"),
];

/// Window commands beyond the keymap's: the web's ids the window can perform (some under the
/// name its keys use), and the native ones screens need.
const WINDOW_COMMANDS: [(&str, &str, &str); 45] = [
    (
        "browser.open",
        "Open a browser tab in a workspace (the one shown when none is named), at an address or empty",
        "{workspaceId?, url?}",
    ),
    (
        "files.extract",
        "Extract a workspace's archive beside it",
        "{workspaceId, path}",
    ),
    (
        "files.openDefault",
        "Open a local workspace's entry with its default app (a click's choice)",
        "{workspaceId, path}",
    ),
    (
        "files.reveal",
        "Show a local workspace's entry in the file manager (a click's choice)",
        "{workspaceId, path}",
    ),
    (
        "file.open",
        "Open a workspace's file in a tab (its preview tab with preview: true)",
        "{workspaceId, path, preview?}",
    ),
    (
        "handoff.open",
        "Open a place in the Perch desktop app (a click's choice)",
        "{place: files | changes | browser | chat | settings}",
    ),
    (
        "link.open",
        "Open an https link in the browser (a click's choice)",
        "{url}",
    ),
    (
        "session.start",
        "Start an agent in a folder on a host",
        "{hostId, cwd?, agent}",
    ),
    ("session.rename", "Rename a session", "{id, name}"),
    (
        "session.request_close",
        "Close a session as its × does, with a tab here or not (an agent asks first)",
        "{id}",
    ),
    ("agent.focus", "Show an agent's session", "{id}"),
    (
        "pane.unsplit",
        "Take a tab out of its split and show it full size",
        "{id}",
    ),
    (
        "tab.menu",
        "Open a tab's menu at a point of the window",
        "{id, x, y}",
    ),
    (
        "tab.beginDrag",
        "A press on a tab, which the window follows as a drag (the SDK's beginTabDrag)",
        "{id, label, x, y, entries: [{id, left, width}]}",
    ),
    (
        "worktree.remove",
        "Ask to delete a linked worktree (its worktree menu confirms and guards the removal)",
        "{id}",
    ),
    ("worktree.cancel", "Stop making a worktree", "{id}"),
    ("worktree.retry", "Try a failed worktree again", "{id}"),
    ("worktree.dismiss", "Forget a failed worktree", "{id}"),
    (
        "folder.select",
        "Show a folder's newest session, on a host without projects",
        "{cwd, host?}",
    ),
    (
        "terminal.restart",
        "Start a tab's agent again after it ended or could not start (Retry CLI, Restart CLI, Resume agent)",
        "{id}",
    ),
    (
        "pointer.follow",
        "Forward the pointer to this mod until the press it began with ends (the SDK's beginReorderDrag)",
        "{token, x, y}",
    ),
    (
        "host.enable",
        "Turn a configured host on or off",
        "{id, enabled}",
    ),
    ("quickchat.new", "A new chat in Quickchat", "{}"),
    ("overlay.close", "Close the top screen, menu or panel", "{}"),
    (
        "notification.open",
        "Go to what a notification is about",
        "{id}",
    ),
    ("notification.dismiss", "Put a notification away", "{id}"),
    ("session.close", "Delete a session", "{id}"),
    (
        "session.move",
        "Move a session beside another in the order the core keeps for every screen",
        "{id, target, after, siblings}",
    ),
    (
        "project.move",
        "Move a project beside another in the order the core keeps for every screen",
        "{id, target, after}",
    ),
    (
        "project.close",
        "Delete a project and end its sessions (the folder stays on disk); needs {confirmed: true}",
        "{id, confirmed: true}",
    ),
    ("project.rename", "Rename a project", "{id, name}"),
    (
        "project.new",
        "Add a folder as a project; with `argv` (and `task`), run that program in it once added (this computer)",
        "{folder, name?, hostId?, argv?: string[], task?}",
    ),
    (
        "workspace.open",
        "Show a workspace: its session last shown here, else the workspace",
        "{id}",
    ),
    (
        "workspace.hide",
        "Hide a linked worktree from the sidebar, or show it again",
        "{id, hidden}",
    ),
    ("workspace.restore", "Wake a sleeping workspace", "{id}"),
    ("workspace.rename", "Rename a workspace", "{id, name}"),
    (
        "workspace.files",
        "Open a workspace's files in the drawer",
        "{id}",
    ),
    (
        "workspace.git",
        "Open a workspace's Git in the drawer",
        "{id}",
    ),
    (
        "project.home",
        "Show a project's start page",
        "{projectId, name?}",
    ),
    (
        "tab.pin",
        "Keep a previewed file's tab (single-click previews are replaced by the next one)",
        "{id}",
    ),
    (
        "host.refresh",
        "Ask a host for its projects and workspaces again",
        "{id}",
    ),
    (
        "terminal.findQuery",
        "Set what a tab's terminal finds (its find bar's field)",
        "{id, query}",
    ),
    (
        "terminal.findNext",
        "Select a tab's terminal's next match",
        "{id}",
    ),
    (
        "terminal.findPrevious",
        "Select a tab's terminal's previous match",
        "{id}",
    ),
    (
        "terminal.findClose",
        "Close a tab's terminal's find and give it the keyboard",
        "{id}",
    ),
];

/// Plan usage, as the web's status bar asks for it (`usePlanUsage`, `refreshUsage`,
/// `redeemUsageReset`): the window sends them to the core, whose answer is `planUsage()`.
const USAGE_COMMANDS: [(&str, &str, &str); 2] = [
    (
        "usage.get",
        "Ask the core for plan usage (force: past its cache)",
        "{force?}",
    ),
    (
        "usage.redeemReset",
        "Spend one banked reset of a plan account",
        "{accountId}",
    ),
];

type Answer = futures::channel::oneshot::Receiver<Result<Value, String>>;

/// The promise half of a question to the window: its answer, or its refusal as the error.
async fn answered(answer: Answer) -> HostResult {
    match answer.await {
        Ok(Ok(value)) => Ok(to_host(&value)),
        Ok(Err(error)) => Err(HostError::new(error)),
        Err(_) => Err(HostError::new("The window went before it answered.")),
    }
}

/// The promise half of a window command.
async fn settled(rx: futures::channel::oneshot::Receiver<Result<(), String>>) -> HostResult {
    match rx.await {
        Ok(Ok(())) => Ok(HostValue::Bool(true)),
        Ok(Err(error)) => Err(HostError::new(error)),
        Err(_) => Err(HostError::new("The window went before the command ran.")),
    }
}

/// A mod's `notify` argument, checked: a title is needed, a level is one of the three, an action
/// names a command, and it stays 1 to 60 s.
pub fn notice_from(
    note: &Value,
) -> Result<(String, Option<String>, crate::workspace::Notice), String> {
    let text = |key: &str| -> Result<Option<String>, String> {
        match &note[key] {
            Value::Null => Ok(None),
            Value::String(text) => Ok(Some(text.clone())),
            _ => Err(format!("notify: {key} is text.")),
        }
    };
    let title = text("title")?
        .filter(|t| !t.trim().is_empty())
        .ok_or("notify needs a title.")?;
    let level = text("level")?;
    if level
        .as_deref()
        .is_some_and(|l| !matches!(l, "info" | "warning" | "error"))
    {
        return Err("notify: level is info, warning or error.".into());
    }
    let action = match &note["action"] {
        Value::Null => None,
        action => Some((
            action["command"]
                .as_str()
                .ok_or("notify: action needs a command.")?
                .to_string(),
            action.get("args").filter(|a| !a.is_null()).cloned(),
        )),
    };
    let timeout = match &note["timeout"] {
        Value::Null => None,
        t => Some(
            t.as_f64()
                .ok_or("notify: timeout is milliseconds.")?
                .clamp(1000., 60_000.) as u64,
        ),
    };
    let notice = crate::workspace::Notice {
        level,
        icon: text("icon")?,
        action,
        timeout,
    };
    Ok((title, text("body")?, notice))
}

/// `useNotifications`' item for one of the window's notifications, worded as the web words it.
/// The capability a core has inbound control with (`inbound.ts`).
pub const INBOUND_CAPABILITY: &str = "inbound.v1";

/// What a session does with messages from other sessions, as the menu words each choice.
const INBOUND_CHOICES: [(&str, &str); 3] = [
    ("accept", "Accept messages from other sessions"),
    ("hold", "Hold messages for my approval"),
    ("refuse", "Refuse messages from other sessions"),
];

/// A session menu's three inbound choices (`inboundMenuItems`), the current one ticked, as
/// `extraItems` rows (`{label, testId}`); a row picked is `{item: testId}`. Only for an agent session
/// on the core's own computer, and only when the core can do it.
pub fn inbound_items(store: &Store, session_id: &str) -> Vec<Value> {
    let Some(session) = store.sessions.iter().find(|s| s.id == session_id) else {
        return Vec::new();
    };
    let capable = store
        .local_capabilities
        .iter()
        .any(|c| c == INBOUND_CAPABILITY);
    if session.cli_provider_id.is_none() || session.host_id != LOCAL || !capable {
        return Vec::new();
    }
    let current = session.inbound_mode.as_deref().unwrap_or("accept");
    INBOUND_CHOICES
        .iter()
        .map(|(mode, label)| {
            let tick = if *mode == current { "\u{2713} " } else { "" };
            json!({ "label": format!("{tick}{label}"), "testId": format!("session-inbound-{mode}-{session_id}") })
        })
        .collect()
}

/// The inbound choice a tab menu row `item` (its `testId`) makes for `session_id`, when it is one
/// and not the current mode.
pub fn inbound_choice(store: &Store, session_id: &str, item: &str) -> Option<&'static str> {
    let mode = item
        .strip_prefix("session-inbound-")?
        .strip_suffix(session_id)?
        .strip_suffix('-')?;
    let current = store
        .sessions
        .iter()
        .find(|s| s.id == session_id)?
        .inbound_mode
        .as_deref()
        .unwrap_or("accept");
    INBOUND_CHOICES
        .iter()
        .map(|(m, _)| *m)
        .find(|m| *m == mode && *m != current)
}

/// What a session menu for `session_id` offers to show beside it, as the web's strip for that
/// session's workspace holds them (`SessionMenu`): the workspace's sessions with a tab (in `strip`
/// order), then the rest of them, oldest first. A session in no workspace offers the strip.
pub fn workspace_mates(store: &Store, strip: &[String], session_id: &str) -> Vec<String> {
    let Some(workspace) = store
        .sessions
        .iter()
        .find(|s| s.id == session_id)
        .and_then(|s| s.workspace_id.as_deref())
    else {
        return strip.to_vec();
    };
    let mut rest: Vec<&perch_core::protocol::SessionSummary> = store
        .sessions
        .iter()
        .filter(|s| s.workspace_id.as_deref() == Some(workspace))
        .collect();
    let mut mates: Vec<String> = strip
        .iter()
        .filter(|id| rest.iter().any(|s| s.id == **id))
        .cloned()
        .collect();
    rest.retain(|s| !mates.contains(&s.id));
    rest.sort_by_key(|s| s.created_at);
    mates.extend(rest.into_iter().map(|s| s.id.clone()));
    mates
}

/// `TabMenuScreenProps` for tab (or session) `id` at `(x, y)`: what may be done with it in
/// `tabs`, which of `among` a split can take (`label` names each), and `extra` rows after the
/// split rows (the sidebar's, then the session's inbound choices).
pub fn tab_menu_props(
    tabs: &crate::tabs::Tabs,
    among: &[String],
    id: &str,
    (x, y): (f32, f32),
    label: &dyn Fn(&str) -> String,
    can_stop: bool,
    extra: Vec<Value>,
) -> Value {
    let title = label(id);
    let offered: Vec<Value> = tabs
        .offered(id, among)
        .iter()
        .map(|other| json!({ "id": other, "label": label(other) }))
        .collect();
    json!({
        "id": id,
        "x": x,
        "y": y,
        "self": { "id": id, "kind": "session", "label": title, "title": title },
        // Every native tab is a session, which a new terminal can be split in beside.
        "canSplitNew": true,
        "canSplitMore": tabs.room_beside(id),
        "offered": offered,
        "inSplit": tabs.in_split(id),
        "canStopAgent": can_stop,
        "extraItems": extra,
    })
}

pub fn notification_json(note: &crate::workspace::Notification, model: &Model) -> Value {
    use crate::sidebar::Alert;
    let heard = &note.heard;
    if heard.alert == Alert::Usage {
        // About no session: its title is the heading and its body the detail.
        let mut item = json!({
            "id": note.id,
            "kind": "usage",
            "title": heard.title,
            "heading": heard.title,
            "detail": heard.body.as_deref().unwrap_or_default(),
            "sessionId": heard.session_id,
            "hasSession": false,
            "timeout": 6000,
        });
        if let Some(body) = &heard.body {
            item["body"] = json!(body);
        }
        if let Some(notice) = &note.notice {
            for (key, value) in [("level", &notice.level), ("icon", &notice.icon)] {
                if let Some(value) = value {
                    item[key] = json!(value);
                }
            }
            if let Some(timeout) = notice.timeout {
                item["timeout"] = json!(timeout);
            }
        }
        return item;
    }
    let session = model
        .store
        .sessions
        .iter()
        .find(|s| s.id == note.heard.session_id);
    let blocked = note.heard.alert == Alert::Blocked;
    let provider =
        session.and_then(|s| s.current_provider_id.clone().or(s.cli_provider_id.clone()));
    let program = provider
        .filter(|p| p != perch_core::agent_fleet::TERMINAL_PROVIDER)
        .and_then(|p| program_name(&p, model.store.programs.as_ref()));
    let heading = if blocked {
        "Needs your attention".to_string()
    } else {
        program.map_or_else(
            || "Session finished".into(),
            |name| format!("{name} finished"),
        )
    };
    let title = &note.heard.title;
    let mut item = json!({
        "id": note.id,
        "kind": if blocked { "blocked" } else { "done" },
        "title": title,
        "heading": heading,
        "detail": if title.is_empty() { "(new session)" } else { title.as_str() },
        "sessionId": note.heard.session_id,
        "hasSession": session.is_some(),
        "timeout": if blocked { 10_000 } else { 6000 },
    });
    if let Some(s) = session {
        item["sessionTitle"] = json!(s.title);
    }
    item
}

/// The name the program table gives agent `id` (`programFor`): `programs.json`'s, else the
/// built-in one; None for a program the table does not know.
fn program_name(id: &str, programs: Option<&Value>) -> Option<String> {
    let entry = programs.map(|file| &file["programs"][id]);
    entry
        .and_then(|e| e["name"].as_str())
        .map(str::to_string)
        .or_else(|| {
            AGENT_PROGRAMS
                .iter()
                .find(|(known, _)| *known == id)
                .map(|(_, name)| name.to_string())
        })
        .or_else(|| entry.is_some_and(Value::is_object).then(|| id.to_string()))
}

/// The agents of the web's built-in program table (`programs.ts`), by id and name.
// ponytail: only the agents, since a session's provider is always one; the editors, runtimes and
// tools the web table also names would matter only for naming a pane's foreground program.
const AGENT_PROGRAMS: [(&str, &str); 17] = [
    ("claude", "Claude"),
    ("codex", "Codex"),
    ("pi", "Pi"),
    ("omp", "Oh My Pi"),
    ("opencode", "OpenCode"),
    ("gemini", "Gemini"),
    ("aider", "Aider"),
    ("amp", "Amp"),
    ("kiro", "Kiro"),
    ("cursor-agent", "Cursor"),
    ("droid", "Droid"),
    ("copilot", "Copilot"),
    ("goose", "Goose"),
    ("crush", "Crush"),
    ("qwen", "Qwen"),
    ("cline", "Cline"),
    ("kilo", "Kilo"),
];

/// A typed command's title, from the shortcut it stands for where there is one.
fn typed_title(id: &str) -> &'static str {
    match id {
        "tab.new" => "A new tab",
        "tab.next" => "The next tab",
        "tab.prev" => "The previous tab",
        "tab.close" => "Close a tab: the one named by {id}, else the shown one",
        "tab.select" => "Show a tab by its number (1 is first) or id",
        "tab.rename" => "Rename a session's tab",
        "tab.move" => "Move a tab to a number in the strip",
        "pane.split" => "Split the tab with a new terminal pane",
        "pane.close" => "Close a pane (its tab)",
        "pane.zoom" => "Zoom the focused pane (again: back)",
        "pane.go" => "Focus the neighbouring pane",
        "pane.swap" => "Swap the focused pane with its neighbour",
        "pane.swapNext" => "Swap the focused pane with the next",
        "pane.focus" => "Focus a pane by id",
        "app.settings" => "Open Settings",
        "app.palette" => "Open the Navigator",
        "app.zoom_in" => "Zoom in",
        "app.zoom_out" => "Zoom out",
        "app.zoom_reset" => "Zoom back to 100%",
        "terminal.show" => "Go to a terminal's session",
        "terminal.peek" => "Show a session over the app for a moment",
        "terminal.keep" => "Keep a peeked session as a tab",
        "terminal.park" => "Put the peek away",
        "workspace.pin" => "Pin or unpin a workspace",
        _ => ACTIONS
            .iter()
            .find(|a| a.id == id)
            .map_or("Terminal command", |a| a.description),
    }
}

/// `sessionLabel`: the title, "New session" for none, at most 24 characters.
fn session_label(title: &str) -> String {
    let title = title.trim();
    if title.is_empty() {
        return "New session".into();
    }
    if title.chars().count() > 24 {
        let cut: String = title.chars().take(23).collect();
        format!("{cut}…")
    } else {
        title.to_string()
    }
}

/// `sessionDotState`, by the web's word.
pub(crate) fn session_state(session: &perch_core::protocol::SessionSummary) -> &'static str {
    use perch_core::protocol::SessionStatus;
    if session.blocked && !session.stale {
        "blocked"
    } else if session.status == SessionStatus::Running && !session.stale {
        "working"
    } else if session.unseen {
        "done"
    } else {
        "idle"
    }
}

/// The body of `declare module "perch" { ... }`: what the shell wraps itself.
fn module_body(file: &str) -> String {
    let start = file.find('{').map_or(0, |at| at + 1);
    let end = file.rfind('}').unwrap_or(file.len());
    file[start..end].to_string()
}

/// Runs `useGitReview` action `action` on `store` for workspace `id` with the script's `args`: the ticket a
/// promise waits on (`Ok(None)` settles null at once), or why the arguments are wrong.
fn git_action(
    store: &mut crate::git::store::GitReviewStore,
    action: &str,
    id: &str,
    args: &[Value],
    focused: Option<String>,
    ready: bool,
    out: &mut Vec<crate::git::store::Effect>,
) -> Result<Option<crate::git::store::Ticket>, String> {
    use perch_core::review::ReviewSide;
    let text = |i: usize| {
        args.get(i)
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string()
    };
    let number = |i: usize| args.get(i).and_then(Value::as_u64).unwrap_or(0);
    let paths = |i: usize| -> Vec<String> {
        args.get(i)
            .and_then(Value::as_array)
            .map(|a| {
                a.iter()
                    .filter_map(|p| p.as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default()
    };
    Ok(match action {
        "refreshStatus" => store.refresh_status(id, ready, out),
        "selectAgentSession" => {
            let session = args.first().and_then(Value::as_str).map(str::to_string);
            store.select_agent_session(id, session, ready, out);
            None
        }
        "loadDiff" => {
            let target = serde_json::from_value(args.first().cloned().unwrap_or(Value::Null))
                .map_err(|e| format!("loadDiff: {e}"))?;
            let path = args.get(1).and_then(Value::as_str).map(str::to_string);
            let options = args.get(2).cloned().unwrap_or(Value::Null);
            store.load_diff(
                id,
                target,
                path,
                options["includeUntracked"].as_bool().unwrap_or(true),
                options["ignoreWhitespace"].as_bool().unwrap_or(false),
                options["contextLines"].as_u64().unwrap_or(3) as u32,
                ready,
                out,
            )
        }
        "stage" | "unstage" => {
            store.path_action(id, &format!("git.{action}"), paths(0), ready, out);
            None
        }
        "discardPreview" => store.discard_preview(id, &text(0), paths(1), ready, out),
        "discard" => {
            store.discard(id, &text(0), ready, out);
            None
        }
        "commitPreview" => store.commit_preview(id, &text(0), ready, out),
        "commit" => {
            store.commit(id, &text(0), &text(1), ready, out);
            None
        }
        "listComments" => store.list_comments(id, ready, out),
        "listRefs" => store.list_refs(id, ready, out),
        "createComment" => {
            let input = args.first().cloned().unwrap_or(Value::Null);
            let side: ReviewSide = serde_json::from_value(input["side"].clone())
                .map_err(|e| format!("createComment: {e}"))?;
            let new = crate::git::store::NewComment {
                id: input["id"]
                    .as_str()
                    .map(str::to_string)
                    .unwrap_or_else(new_id),
                path: input["path"].as_str().unwrap_or("").to_string(),
                side,
                start: input["start"].as_u64().unwrap_or(0) as u32,
                end: input["end"].as_u64().unwrap_or(0) as u32,
                body: input["body"].as_str().unwrap_or("").to_string(),
            };
            store.create_comment(id, new, focused.as_deref(), ready, out);
            None
        }
        "updateComment" => {
            store.update_comment(id, &text(0), &text(1), number(2), ready, out);
            None
        }
        "resolveComment" => {
            let resolved = args.get(1).and_then(Value::as_bool).unwrap_or(false);
            store.resolve_comment(id, &text(0), resolved, number(2), ready, out);
            None
        }
        "deleteComment" => {
            store.delete_comment(id, &text(0), number(1), ready, out);
            None
        }
        "previewBatch" => store.preview_batch(id, args.first().unwrap_or(&Value::Null), ready, out),
        "sendBatch" => store.send_batch(id, &text(0), &text(1), ready, out),
        other => return Err(format!("No Git action {other}.")),
    })
}

/// A new comment's id, `comment-<unique>` as the web's store makes it.
fn new_id() -> String {
    static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_nanos());
    let n = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    format!("comment-{nanos:x}-{n}")
}

pub fn to_host(value: &Value) -> HostValue {
    match value {
        Value::Null => HostValue::Null,
        Value::Bool(b) => HostValue::Bool(*b),
        Value::Number(n) => HostValue::Number(n.as_f64().unwrap_or(0.0)),
        Value::String(s) => HostValue::Str(s.clone()),
        Value::Array(list) => HostValue::Array(list.iter().map(to_host).collect()),
        Value::Object(map) => {
            HostValue::Object(map.iter().map(|(k, v)| (k.clone(), to_host(v))).collect())
        }
    }
}

pub fn from_host(value: &HostValue) -> Value {
    match value {
        HostValue::Null => Value::Null,
        HostValue::Bool(b) => Value::Bool(*b),
        HostValue::Number(n) if n.fract() == 0.0 && n.abs() < 9e15 => Value::from(*n as i64),
        HostValue::Number(n) => serde_json::Number::from_f64(*n).map_or(Value::Null, Value::Number),
        HostValue::Str(s) => Value::String(s.clone()),
        HostValue::Array(list) => Value::Array(list.iter().map(from_host).collect()),
        HostValue::Object(fields) => Value::Object(
            fields
                .iter()
                .map(|(k, v)| (k.clone(), from_host(v)))
                .collect(),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_mods_notification_is_checked_as_the_web_takes_it() {
        let (title, body, notice) = notice_from(&json!({
            "title": "Build failed", "body": "3 errors", "level": "error", "icon": "!",
            "action": {"command": "tab.select", "args": {"id": "s1"}}, "timeout": 500}))
        .unwrap();
        assert_eq!(
            (title.as_str(), body.as_deref()),
            ("Build failed", Some("3 errors"))
        );
        assert_eq!(notice.level.as_deref(), Some("error"));
        assert_eq!(notice.icon.as_deref(), Some("!"));
        assert_eq!(
            notice.action,
            Some(("tab.select".into(), Some(json!({"id": "s1"}))))
        );
        assert_eq!(notice.timeout, Some(1000), "at least 1 s");
        let long = notice_from(&json!({"title": "t", "timeout": 600_000})).unwrap();
        assert_eq!(long.2.timeout, Some(60_000), "at most 60 s");
        for bad in [
            json!({}),
            json!({"title": "  "}),
            json!({"title": "t", "level": "loud"}),
            json!({"title": "t", "action": {}}),
            json!({"title": "t", "body": 3}),
            json!({"title": "t", "timeout": "soon"}),
        ] {
            assert!(notice_from(&bad).is_err(), "{bad} is refused");
        }
    }

    #[test]
    fn the_files_screen_reads_again_only_when_its_workspaces_move() {
        let perch = Perch::new();
        let workspace = |name: &str| {
            serde_json::from_value(json!({
                "id": "w", "projectId": "p", "hostId": "local", "path": "/w", "name": name, "dirty": false,
                "state": "active", "createdAt": 0, "updatedAt": 0,
            }))
            .unwrap()
        };
        let model = |revision: u64, name: &str| crate::sidebar::Model {
            store: Arc::new(crate::sidebar::navigation::Store {
                revision,
                workspaces: vec![workspace(name)],
                ..Default::default()
            }),
            ..Default::default()
        };
        let revision = |part: &str| perch.0.revisions.borrow().get(part).copied().unwrap_or(0);
        let first = model(1, "w");
        perch.set_model(first.clone());
        let (store, workspaces) = (revision(STORE), revision(WORKSPACES));
        perch.set_model(first);
        assert_eq!(
            revision(STORE),
            store,
            "the same model again publishes nothing"
        );
        perch.set_model(model(2, "w"));
        assert_eq!(revision(STORE), store + 1);
        assert_eq!(revision(WORKSPACES), workspaces, "a store change elsewhere");
        perch.set_model(model(3, "renamed"));
        assert_eq!(revision(WORKSPACES), workspaces + 1, "a workspace renamed");

        perch.set_files("w", json!({"documents": {"a.md": {"text": "hello"}}}));
        let files = from_host(&perch.workspace_files("w"));
        assert_eq!(files["documents"]["a.md"]["text"], "hello");
        assert_eq!(files["workspace"]["name"], "renamed");
        assert_eq!(files["git"]["isGit"], false);
        assert_eq!(
            from_host(&perch.workspace_files("none"))["trees"],
            json!({})
        );
    }

    #[test]
    fn media_file_gives_a_local_workspace_its_folder_and_the_extraction() {
        let perch = Perch::new();
        let workspace = |id: &str, host: &str| {
            serde_json::from_value(json!({
                "id": id, "projectId": "p", "hostId": host, "path": format!("/w/{id}"), "name": id, "dirty": false, "state": "active",
                "createdAt": 0, "updatedAt": 0,
            }))
            .unwrap()
        };
        let store = crate::sidebar::navigation::Store {
            workspaces: vec![workspace("here", "local"), workspace("there", "box")],
            ..Default::default()
        };
        perch.set_model(crate::sidebar::Model {
            store: Arc::new(store),
            ..Default::default()
        });
        perch.set_files(
            "here",
            json!({"extractions": {"a.zip": {"state": "ready", "destination": "a"}}}),
        );
        assert_eq!(
            perch.media_file("here", "a.zip"),
            json!({"root": "/w/here", "extraction": {"state": "ready", "destination": "a"}})
        );
        assert_eq!(
            perch.media_file("here", "b.png"),
            json!({"root": "/w/here", "extraction": null})
        );
        assert_eq!(
            perch.media_file("there", "a.zip"),
            json!({"root": null, "extraction": null}),
            "another computer's folder is not on this one"
        );
        assert_eq!(perch.media_file("gone", "a.zip")["root"], Value::Null);
    }

    #[test]
    fn a_screen_that_goes_forgets_what_it_read() {
        let perch = Perch::new();
        for key in ["pane-header#a", "pane-header#b"] {
            perch.set_props(key, json!({ "id": key }));
            perch.read(key, &format!("props:{key}"));
            perch.read(key, STORE);
        }
        perch.clear_props("pane-header#a");
        let reads = perch.0.reads.borrow();
        assert!(!reads.contains_key("pane-header#a"), "the copy that went");
        assert_eq!(reads["pane-header#b"].len(), 2, "the one still on screen");
    }

    #[test]
    fn the_typescript_face_names_exactly_what_is_registered() {
        let module = Perch::new().module("probe");
        module.validate().expect("declarations and functions agree");
        assert!(module.is_async("run"));
    }

    #[test]
    fn sidebar_settings_take_the_web_names_and_refuse_a_wrong_value_whole() {
        let mut settings = SidebarSettings::default();
        settings
            .patch(&json!({"organize": "status", "collapsedProjects": ["p-1"], "foldedSessions": ["s-1"]}))
            .unwrap();
        assert_eq!(settings.organize, "status");
        assert_eq!(settings.collapsed_projects, ["p-1"]);
        assert_eq!(settings.folded_sessions, ["s-1"]);
        assert!(settings.patch(&json!({"foldedSessions": [1]})).is_err());
        let before = settings.clone();
        assert!(settings
            .patch(&json!({"showTerminals": true, "organize": "tree"}))
            .is_err());
        assert!(settings.patch(&json!({"nope": 1})).is_err());
        assert_eq!(settings, before, "nothing changes when any field is wrong");
    }

    /// The command ids the stock mods run: each `runCommand("id"` and `run("id"` of the native
    /// mods and of the web mods of the same name.
    fn stock_mod_commands() -> std::collections::BTreeSet<String> {
        fn scan(dir: &std::path::Path, found: &mut std::collections::BTreeSet<String>) {
            for entry in std::fs::read_dir(dir).into_iter().flatten().flatten() {
                let path = entry.path();
                if path.is_dir() {
                    scan(&path, found);
                } else if path
                    .extension()
                    .is_some_and(|e| matches!(e.to_str(), Some("js" | "jsx" | "ts" | "tsx")))
                {
                    let text = std::fs::read_to_string(&path).unwrap();
                    for call in ["runCommand(", "run("] {
                        for part in text.split(call).skip(1) {
                            let Some(rest) = part.strip_prefix('"') else {
                                continue;
                            };
                            let id = rest.split('"').next().unwrap_or("");
                            let dotted = id
                                .split_once('.')
                                .is_some_and(|(a, b)| !a.is_empty() && !b.is_empty());
                            if dotted && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '.') {
                                found.insert(id.to_string());
                            }
                        }
                    }
                }
            }
        }
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
        let web = root.join("../../packages/web/src/stock-ui");
        let mut found = std::collections::BTreeSet::new();
        for entry in std::fs::read_dir(root.join("mods")).unwrap().flatten() {
            if entry.path().is_dir() {
                scan(&entry.path(), &mut found);
                scan(&web.join(entry.file_name()), &mut found);
            }
        }
        found
    }

    /// Whether some match arm of the window's sources names command `id`.
    fn has_handler(id: &str) -> bool {
        fn arms(dir: &std::path::Path, id: &str) -> bool {
            std::fs::read_dir(dir)
                .into_iter()
                .flatten()
                .flatten()
                .any(|entry| {
                    let path = entry.path();
                    if path.is_dir() {
                        return arms(&path, id);
                    }
                    let quoted = format!("\"{id}\"");
                    path.extension().is_some_and(|e| e == "rs")
                        && std::fs::read_to_string(&path).unwrap().lines().any(|line| {
                            line.match_indices(quoted.as_str()).any(|(at, _)| {
                                let rest = line[at + quoted.len()..].trim_start();
                                rest.starts_with("=>")
                                    || rest.starts_with('|')
                                    || rest.starts_with("if ")
                            })
                        })
                })
        }
        arms(
            &std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src"),
            id,
        )
    }

    #[test]
    fn every_command_a_stock_mod_runs_is_listed_and_handled() {
        let perch = Perch::new();
        let ids = stock_mod_commands();
        assert!(ids.contains("tab.select") && ids.contains("workspace.git"));
        // The browser toolbar's `browser.*` are known by prefix and handled but not listed;
        // `terminal.*` is taken by prefix.
        let missing: Vec<&String> = ids
            .iter()
            .filter(|id| {
                let window_only = id.starts_with("browser.");
                !(window_only || perch.known(id))
                    || !(window_only || id.starts_with("terminal.") || has_handler(id))
                    || (window_only && !has_handler(id))
            })
            .collect();
        assert!(missing.is_empty(), "no native handler: {missing:?}");
    }

    #[test]
    fn every_listed_command_runs_and_ids_are_unique() {
        let perch = Perch::new();
        let list = perch.commands();
        let ids: Vec<&str> = list.iter().filter_map(|c| c["id"].as_str()).collect();
        let unique: HashSet<&str> = ids.iter().copied().collect();
        assert_eq!(ids.len(), unique.len());
        for id in &ids {
            assert!(perch.known(id), "{id}");
        }
        for id in [
            "session.open",
            "host.select",
            "app.theme",
            "tab.next",
            "pane.split",
        ] {
            assert!(ids.contains(&id), "{id}");
        }
        assert!(
            !perch.known("leader.navigator"),
            "a leader follow-up is a key, not a command"
        );
    }

    #[test]
    fn sidebar_settings_default_to_the_web_s_and_outlast_the_window() {
        // Off by default: sorted by attention, the workspaces move whenever an agent's state does.
        assert!(!SidebarSettings::default().sort_by_attention);
        let dir = std::env::temp_dir().join(format!("perch-sidebar-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join(".sidebar.json");
        let _ = std::fs::remove_file(&file);
        let perch = Perch::new();
        perch.keep_sidebar_in(file.clone());
        assert_eq!(perch.sidebar(), SidebarSettings::default());
        perch
            .run_own("project.fold", &json!({"id": "p-1"}))
            .unwrap()
            .unwrap();
        perch
            .run_own("sidebar.organize", &json!({"organize": "list"}))
            .unwrap()
            .unwrap();
        let again = SidebarSettings::read(&file);
        assert_eq!(again.collapsed_projects, ["p-1"]);
        assert_eq!(again.organize, "list");
        // A broken file, or one wrong field, gives the defaults for what it could not read.
        std::fs::write(&file, "{\"organize\": 3, \"sortByAttention\": true").unwrap();
        assert_eq!(SidebarSettings::read(&file), SidebarSettings::default());
        std::fs::write(&file, r#"{"organize": 3, "sortByAttention": true}"#).unwrap();
        let partial = SidebarSettings::read(&file);
        assert!(partial.sort_by_attention);
        assert_eq!(partial.organize, "project");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn perch_owned_commands_change_the_view_and_refuse_unknown_targets() {
        let perch = Perch::new();
        assert!(perch
            .run_own("host.select", &json!({"id": "elsewhere"}))
            .unwrap()
            .is_err());
        perch
            .run_own("host.select", &json!({"id": "local"}))
            .unwrap()
            .unwrap();
        perch
            .run_own("project.fold", &json!({"id": "p-1"}))
            .unwrap()
            .unwrap();
        assert_eq!(perch.sidebar().collapsed_projects, ["p-1"]);
        perch
            .run_own("project.fold", &json!({"id": "p-1"}))
            .unwrap()
            .unwrap();
        assert!(perch.sidebar().collapsed_projects.is_empty());
        perch
            .run_own("sidebar.organize", &json!({}))
            .unwrap()
            .unwrap();
        assert_eq!(perch.sidebar().organize, "status");
        assert!(perch
            .run_own("app.theme", &json!({"name": "no-such-theme"}))
            .unwrap()
            .is_err());
        perch
            .run_own("app.theme", &json!({"name": "catppuccin-latte"}))
            .unwrap()
            .unwrap();
        assert_eq!(perch.theme().name, "catppuccin-latte");
        assert!(
            perch.run_own("tab.next", &json!({})).is_none(),
            "the window's"
        );
    }

    #[test]
    fn a_mod_is_refreshed_only_for_parts_it_read() {
        let perch = Perch::new();
        perch.read("a", STORE);
        perch.read("b", THEME);
        perch.bump(STORE);
        assert_eq!(perch.changed(), HashSet::from(["a".to_string()]));
        assert!(perch.changed().is_empty(), "once per change");
    }

    #[test]
    fn labels_are_cut_as_the_web_cuts_them() {
        assert_eq!(session_label("  "), "New session");
        assert_eq!(
            session_label(&"x".repeat(30)),
            format!("{}…", "x".repeat(23))
        );
    }

    #[test]
    fn agents_are_named_by_the_program_table() {
        assert_eq!(program_name("codex", None).as_deref(), Some("Codex"));
        assert_eq!(program_name("mystery", None), None);
        let file = json!({ "programs": {
            "codex": { "name": "Codex CLI" }, "mystery": { "tile": "#000" } } });
        assert_eq!(
            program_name("codex", Some(&file)).as_deref(),
            Some("Codex CLI")
        );
        assert_eq!(
            program_name("claude", Some(&file)).as_deref(),
            Some("Claude")
        );
        assert_eq!(
            program_name("mystery", Some(&file)).as_deref(),
            Some("mystery")
        );
    }
}
