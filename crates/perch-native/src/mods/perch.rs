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

use super::theme::{self, Theme};
use super::ModHost;
use crate::actions::ACTIONS;
use crate::client::Command;
use crate::keymap::{all_shortcuts, Keymap, Scope, TYPED};
use crate::sidebar::navigation::{self, Store, View};
use crate::sidebar::{Model, LOCAL};
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

/// The sidebar's view settings, by the web's names (`perch.sidebar.*` in its localStorage).
#[derive(Clone, Debug, PartialEq)]
pub struct SidebarSettings {
    /// `project`, `status` or `list`.
    pub organize: String,
    pub sort_by_attention: bool,
    pub show_terminals: bool,
    pub collapsed_projects: Vec<String>,
}

impl Default for SidebarSettings {
    /// The web's defaults.
    fn default() -> Self {
        Self {
            organize: "project".into(),
            sort_by_attention: true,
            show_terminals: false,
            collapsed_projects: Vec::new(),
        }
    }
}

impl SidebarSettings {
    fn to_json(&self) -> Value {
        json!({
            "organize": self.organize,
            "sortByAttention": self.sort_by_attention,
            "showTerminals": self.show_terminals,
            "collapsedProjects": self.collapsed_projects,
        })
    }

    /// Applies the fields `patch` names; a wrong type is refused and nothing changes.
    fn patch(&mut self, patch: &Value) -> Result<(), String> {
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
    pub shown: Vec<String>,
    pub active: Option<String>,
    pub zoomed: bool,
    /// The terminals' zoom factor (1 is 100%).
    pub zoom: f32,
    /// The in-app notifications, oldest first (`useNotifications`' items).
    pub notifications: Vec<Value>,
}

#[derive(Default)]
struct Data {
    model: Model,
    host_id: Option<String>,
    session_id: Option<String>,
    /// A workspace focused with no session of it on screen.
    workspace_id: Option<String>,
    sidebar: SidebarSettings,
    window: WindowState,
    /// A theme chosen here, until the core says which one is set.
    chosen_theme: Option<String>,
    /// The theme last put into gpui-base's global.
    applied: Option<Theme>,
    /// What each screen was opened with, by its key (`perch.props()`).
    props: HashMap<String, Value>,
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
    /// Per mod id, the revision of each part it read when it last rendered.
    reads: RefCell<HashMap<String, HashMap<String, u64>>>,
    hosts: RefCell<Vec<ModHost>>,
    attached: RefCell<Option<Attached>>,
    flush_queued: Cell<bool>,
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
            reads: RefCell::default(),
            hosts: RefCell::default(),
            attached: RefCell::default(),
            flush_queued: Cell::new(false),
        }))
    }

    /// Lends the `perch` module to every mod `host` loads from now on, and refreshes its views
    /// when what they read changes.
    pub fn register(&self, host: &ModHost) {
        let perch = self.clone();
        host.register_module(move |id| perch.module(id));
        self.0.hosts.borrow_mut().push(host.clone());
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
                shown: tabs.shown(),
                active: tabs.active().map(str::to_string),
                zoomed: tabs.zoomed(),
                zoom: ws.zoom_factor(),
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
        self.set_window(window);
        let changed = {
            let data = self.0.data.borrow();
            data.session_id != open.as_ref().map(|o| o.1.clone())
        };
        if changed {
            let mut data = self.0.data.borrow_mut();
            data.session_id = open.map(|o| o.1);
            data.workspace_id = None;
            drop(data);
            self.bump(VIEW);
        }
        self.flush(cx);
    }

    /// Publishes the core's facts. Call [`Self::flush`] after.
    pub fn set_model(&self, model: Model) {
        let mut data = self.0.data.borrow_mut();
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
        if theme_changed {
            self.bump(THEME);
        }
        if keys_changed {
            self.bump(KEYS);
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

    /// Screen `key` is closed: its props go.
    pub fn clear_props(&self, key: &str) {
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
        self.bump(VIEW);
    }

    pub fn sidebar(&self) -> SidebarSettings {
        self.0.data.borrow().sidebar.clone()
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
        let host_id = self.host_id();
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
                .or_else(|| session.and_then(|s| s.workspace_id.clone())),
            show_terminals: flag("showTerminals"),
            sort_by_attention: flag("sortByAttention"),
        }
    }

    fn store(&self) -> Arc<Store> {
        self.0.data.borrow().model.store.clone()
    }

    fn bump(&self, part: &str) {
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
        for (id, title, args) in OWN.iter().chain(&WINDOW_COMMANDS) {
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

    fn keymap(&self) -> Keymap {
        let data = self.0.data.borrow();
        Keymap::new(data.model.keybindings.clone(), data.model.keys_file.clone())
    }

    fn known(&self, id: &str) -> bool {
        OWN.iter()
            .chain(&WINDOW_COMMANDS)
            .any(|(own, _, _)| *own == id)
            || TYPED.iter().any(|(typed, _)| *typed == id)
            || all_shortcuts().any(|s| s.id == id && s.scope != Scope::Leader)
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
            "workspace.focus" => (|| {
                let workspace = text("id").ok_or("This command needs {id}.")?;
                if !self.store().workspaces.iter().any(|w| w.id == workspace) {
                    return Err(format!("No workspace {workspace}."));
                }
                self.0.data.borrow_mut().workspace_id = Some(workspace);
                self.bump(VIEW);
                Ok(())
            })(),
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
                self.bump(VIEW);
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
                self.bump(VIEW);
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
        if id == "app.theme" {
            // The core keeps the choice, for every screen.
            let name = args.and_then(|a| a.get("name")).cloned();
            if let Some(name) = name {
                let sidebar = workspace.read(cx).sidebar().clone();
                sidebar
                    .read(cx)
                    .send(Command::UpdateSettings(json!({ "theme": name })));
            }
            return Ok(());
        }
        if id == "session.open" {
            let session = args
                .and_then(|a| a.get("id"))
                .and_then(Value::as_str)
                .ok_or("This command needs {id}.")?
                .to_string();
            let found = self
                .store()
                .sessions
                .iter()
                .find(|s| s.id == session)
                .map(|s| (s.host_id.clone(), s.cli_provider_id.clone()))
                .ok_or_else(|| format!("No session {session}."))?;
            let sidebar = workspace.read(cx).sidebar().clone();
            sidebar.update(cx, |sidebar, cx| {
                sidebar.open(found.0, session, found.1, cx)
            });
            return Ok(());
        }
        handle
            .update(cx, |_, window, cx| {
                workspace.update(cx, |ws, cx| ws.run_command(id, args, window, cx))
            })
            .map_err(|_| "The window is gone.".to_string())?
    }

    /// The `perch` module for mod `id`.
    pub fn module(&self, id: &str) -> HostModule {
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
        HostModule::new("perch")
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
            .function(
                "zoom",
                reader(WINDOW, |perch, _| json!(perch.0.data.borrow().window.zoom)),
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
            .function("workspaceTabs", both(|perch, _| perch.workspace_tabs()))
            .function("focus", both(|perch, _| perch.focus()))
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
                reader(VIEW, |perch, _| perch.sidebar().to_json()),
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
            .function(
                "themeName",
                reader(THEME, |perch, _| json!(perch.theme().name)),
            )
            .function("themes", |_| Ok(to_host(&json!(theme::names()))))
            .function("commands", reader(KEYS, |perch, _| json!(perch.commands())))
            .function("keys", reader(KEYS, |perch, _| perch.keys()))
            .function("keybindings", reader(KEYS, |perch, _| perch.keybindings()))
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
                        // `app.theme` is also the core's to keep.
                        if id == "app.theme" && run.0.attached.borrow().is_some() {
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
    fn open_screen(
        &self,
        id: &str,
        props: Value,
    ) -> Result<futures::channel::oneshot::Receiver<Result<Value, String>>, HostError> {
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
                        ws.open_screen(
                            &id,
                            props,
                            None,
                            Some(Box::new(move |_, result, _, _| {
                                if let Some(tx) = answer.borrow_mut().take() {
                                    let _ = tx.send(Ok(result));
                                }
                            })),
                            cx,
                        )
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
    fn providers(&self, host_id: &str) -> Value {
        let store = self.store();
        let list: Vec<Value> = store
            .providers
            .get(host_id)
            .into_iter()
            .flatten()
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

    /// `useKeybindings`: every binding as the person has it, grouped as the web's help groups them.
    fn keybindings(&self) -> Value {
        let keymap = self.keymap();
        let list: Vec<Value> = all_shortcuts()
            .filter_map(|s| {
                let keys = keymap.label(s.id)?;
                let group = match s.scope {
                    Scope::Leader => "leader",
                    Scope::Terminal => "terminal",
                    _ => match s.id.split('.').next().unwrap_or("") {
                        "tabs" => "tabs",
                        "nests" | "sessions" => "nests",
                        "panes" => "panes",
                        _ => "global",
                    },
                };
                Some(json!({ "keys": keys, "description": s.title, "group": group }))
            })
            .collect();
        json!(list)
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

    /// `useWorkspaceTabs`: the window's strip. Every tab is a session.
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
            "draggingId": Value::Null,
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
                    "state": if !reachable { "host-unavailable" } else if open { "running" } else { "unknown" },
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
    /// its agents (`agent.manifest.list`) offers its enabled, installed ones and is loading until
    /// it has answered; an older one offers the two agents every Perch knows.
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
        json!({
            "connected": store.connected,
            "discovery": discovery,
            "state": if discovery && listed.is_none() { "loading" } else { "ready" },
            "choices": choices,
        })
    }
}

/// The capability of a computer that lists the agents it can start.
const MANIFEST_CAPABILITY: &str = "agent.manifest.list";

/// What a computer without that capability can start (the web's `AGENTS`).
const KNOWN_AGENTS: [(&str, &str); 2] = [("claude", "Claude"), ("codex", "Codex")];

/// The commands this module answers for, with their titles and arguments. `session.open` and
/// `app.theme` also reach the window (the sidebar opens the session, the core keeps the theme);
/// every other command is the window's.
const OWN: [(&str, &str, &str); 6] = [
    ("session.open", "Go to a session", "{id}"),
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
const WINDOW_COMMANDS: [(&str, &str, &str); 11] = [
    (
        "session.start",
        "Start an agent in a folder on a host",
        "{hostId, cwd?, agent}",
    ),
    ("session.rename", "Rename a session", "{id, name}"),
    (
        "session.request_close",
        "Close a session's tab as its × does (an agent asks first)",
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
];

/// The promise half of a window command.
async fn settled(rx: futures::channel::oneshot::Receiver<Result<(), String>>) -> HostResult {
    match rx.await {
        Ok(Ok(())) => Ok(HostValue::Bool(true)),
        Ok(Err(error)) => Err(HostError::new(error)),
        Err(_) => Err(HostError::new("The window went before the command ran.")),
    }
}

/// `useNotifications`' item for one of the window's notifications, worded as the web words it.
pub fn notification_json(note: &crate::workspace::Notification, model: &Model) -> Value {
    use crate::sidebar::Alert;
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
    fn the_typescript_face_names_exactly_what_is_registered() {
        let module = Perch::new().module("probe");
        module.validate().expect("declarations and functions agree");
        assert!(module.is_async("run"));
    }

    #[test]
    fn sidebar_settings_take_the_web_names_and_refuse_a_wrong_value_whole() {
        let mut settings = SidebarSettings::default();
        settings
            .patch(&json!({"organize": "status", "collapsedProjects": ["p-1"]}))
            .unwrap();
        assert_eq!(settings.organize, "status");
        assert_eq!(settings.collapsed_projects, ["p-1"]);
        let before = settings.clone();
        assert!(settings
            .patch(&json!({"showTerminals": true, "organize": "tree"}))
            .is_err());
        assert!(settings.patch(&json!({"nope": 1})).is_err());
        assert_eq!(settings, before, "nothing changes when any field is wrong");
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
