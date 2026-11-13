//! Native mods: folders of JavaScript that draw parts of this window, as herdr-app's do.
//!
//! A mod is a folder `<id>/` with a `main.js` that default-exports a class extending `View` from
//! `gpui-kit`; its `render()` returns a description of elements (`div()`, `h_flex()`, `.child()`,
//! `.on_click()`, ...) and the vendored gpui-shell turns it into GPUI elements. There is no DOM.
//! `mod.json` beside it is optional and read as given ([`ModInfo::manifest`]).
//!
//! Where mods come from ([`ModHost::new`]):
//! - stock mods ship inside the binary, from `crates/perch-native/mods/<id>/` ([`STOCK`]), and are
//!   written out to `<user dir>/.stock/` on every start, so an edit there does not stick;
//! - user mods are folders in [`user_dir`]: `native-mods/` beside the core's web `mods/` folder
//!   (both in the folder that holds the core's database). The web UI and the core's web mod loader
//!   read only `mods/`, so neither ever sees these. A user folder with a stock mod's id replaces it.
//!
//! A [`ModView`] is one mod as a GPUI view the workspace can place anywhere. It looks at the mod's
//! files every [`POLL`] and reloads it in place when they change; when the user adds or removes an
//! override folder it switches source. A new version that throws while loading never replaces
//! the one on screen ([`ModView::load_error`]); one that throws in `render()` leaves the last good
//! render drawn under the shell's error banner ([`ModView::render_error`]). A mod is trusted code,
//! as web mods are; it may read the home folder, write only the native mods folder, and keep
//! `localStorage` in `<user dir>/.data/<id>/`.
//!
//! The data a mod can import comes from host modules: [`ModHost::register_module`] takes a
//! factory that builds one [`HostModule`] (for example `perch`: data, commands, theme tokens) for
//! each mod as it loads. Theme tokens a mod reads through `gpui-base` live in the
//! `gpui_base::Theme` global, which the host may set at any time. [`perch::Perch`] is that
//! module; [`ModHost::refresh`] re-renders the mods whose data changed.

pub mod perch;
pub mod react_host;
pub mod screens;
pub mod theme;

use anyhow::{anyhow, Context as _, Result};
use gpui::{div, prelude::*, AnyView, App, Context, Entity, Task, WeakEntity, Window};
use gpui_shell::policy::Policy;
use gpui_shell::{Capabilities, HostModule, ScriptView, ShellRoot, ShellRuntime};
use serde_json::Value;
use std::cell::RefCell;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::time::{Duration, SystemTime};

/// How often a shown mod's files are looked at. A save shows within this.
pub const POLL: Duration = Duration::from_millis(250);

/// The stock mods: path under `crates/perch-native/mods/`, and the file. Every file in that folder
/// must be listed here (a unit test checks).
pub const STOCK: &[(&str, &str)] = &[
    ("example/main.js", include_str!("../mods/example/main.js")),
    ("example/mod.json", include_str!("../mods/example/mod.json")),
    (
        "parity-probe/main.js",
        include_str!("../mods/parity-probe/main.js"),
    ),
    ("perch.d.ts", perch::DECLARATIONS),
    (
        "sidebar-react/main.js",
        include_str!("../mods/sidebar-react/main.js"),
    ),
    (
        "sidebar-react/mod.json",
        include_str!("../mods/sidebar-react/mod.json"),
    ),
    (
        "sidebar-react/host.js",
        include_str!("../mods/sidebar-react/host.js"),
    ),
    (
        "sidebar-react/agent-icons.js",
        include_str!("../mods/sidebar-react/agent-icons.js"),
    ),
    (
        "sidebar-react/runtime.mjs",
        include_str!("../mods/sidebar-react/runtime.mjs"),
    ),
    (
        "sidebar-react/react.js",
        include_str!("../mods/sidebar-react/react.js"),
    ),
    (
        "sidebar-react/react/jsx-runtime.js",
        include_str!("../mods/sidebar-react/react/jsx-runtime.js"),
    ),
    (
        "sidebar-react/react-dom.js",
        include_str!("../mods/sidebar-react/react-dom.js"),
    ),
    (
        "sidebar-react/@perch/sdk.js",
        include_str!("../mods/sidebar-react/@perch/sdk.js"),
    ),
    (
        "sidebar-react/sidebar/main.js",
        include_str!("../mods/sidebar-react/sidebar/main.js"),
    ),
    (
        "sidebar-react/sidebar/content.js",
        include_str!("../mods/sidebar-react/sidebar/content.js"),
    ),
    (
        "sidebar-react/sidebar/folders.js",
        include_str!("../mods/sidebar-react/sidebar/folders.js"),
    ),
    (
        "sidebar-react/sidebar/hosts.js",
        include_str!("../mods/sidebar-react/sidebar/hosts.js"),
    ),
    (
        "sidebar-react/sidebar/icons.js",
        include_str!("../mods/sidebar-react/sidebar/icons.js"),
    ),
    (
        "sidebar-react/sidebar/overview.js",
        include_str!("../mods/sidebar-react/sidebar/overview.js"),
    ),
    (
        "sidebar-react/sidebar/parts.js",
        include_str!("../mods/sidebar-react/sidebar/parts.js"),
    ),
];

/// Where user mods live: `native-mods/` in the folder that holds the core's database
/// (`PERCH_DB`'s folder, else `~/.perch`), the folder whose `mods/` the core serves to the web.
pub fn user_dir() -> PathBuf {
    let env = |key: &str| std::env::var_os(key).filter(|v| !v.is_empty());
    let root = match env("PERCH_DB").map(PathBuf::from) {
        Some(db) => db.parent().map(Path::to_path_buf).unwrap_or_default(),
        None => env("HOME")
            .map(PathBuf::from)
            .unwrap_or_default()
            .join(".perch"),
    };
    root.join("native-mods")
}

/// Starts the engine. Call once per app, before any [`ModHost`].
pub fn init(cx: &mut App) {
    gpui_shell::init(cx);
}

/// The window's mods and the `perch` module they import, kept for whoever places a mod view
/// (`cx.global::<WindowMods>().host.view(id, window, cx)`).
pub struct WindowMods {
    pub host: ModHost,
    pub perch: perch::Perch,
}

impl gpui::Global for WindowMods {}

/// Starts the engine for the app's one window: its mods follow `workspace` and run commands in
/// `window`. A mod host that cannot start leaves the window as it is, said on stderr.
pub fn start(
    workspace: &Entity<crate::workspace::Workspace>,
    window: gpui::AnyWindowHandle,
    cx: &mut App,
) {
    start_in(user_dir(), workspace, window, cx);
}

/// [`start`] with the mods of `dir` (a test's scratch folder).
pub fn start_in(
    dir: PathBuf,
    workspace: &Entity<crate::workspace::Workspace>,
    window: gpui::AnyWindowHandle,
    cx: &mut App,
) {
    init(cx);
    let host = match ModHost::new(dir) {
        Ok(host) => host,
        Err(error) => {
            eprintln!("perch-native: mods are off: {error:#}");
            return;
        }
    };
    let perch = perch::Perch::new();
    perch.register(&host);
    perch.attach(workspace, window, cx);
    cx.set_global(WindowMods { host, perch });
}

/// A mod found on disk.
#[derive(Clone, Debug, PartialEq)]
pub struct ModInfo {
    pub id: String,
    pub dir: PathBuf,
    /// A user folder, not a stock mod.
    pub user: bool,
    /// `mod.json`, or `Null` when there is none or it is not JSON.
    pub manifest: Value,
}

type ModuleFactory = Rc<dyn Fn(&str) -> HostModule>;

struct Inner {
    user_dir: PathBuf,
    runtime: Rc<ShellRuntime>,
    modules: RefCell<Vec<ModuleFactory>>,
    views: RefCell<Vec<WeakEntity<ModView>>>,
}

/// The mods of one window: where they are, the JavaScript runtime they share and the host
/// modules they may import. Cheap to clone.
#[derive(Clone)]
pub struct ModHost(Rc<Inner>);

impl ModHost {
    /// Writes the stock mods out under `user_dir/.stock/` and starts a runtime for them.
    pub fn new(user_dir: PathBuf) -> Result<Self> {
        write_stock(&user_dir.join(".stock"), STOCK)?;
        let runtime = ShellRuntime::new_isolated().context("could not start the mod runtime")?;
        let host = Self(Rc::new(Inner {
            user_dir,
            runtime,
            modules: RefCell::default(),
            views: RefCell::default(),
        }));
        react_host::register(&host);
        Ok(host)
    }

    pub fn user_dir(&self) -> &Path {
        &self.0.user_dir
    }

    /// Adds a host module mods may import, built for each mod (by id) as it loads. Modules
    /// registered later reach mods loaded later; a reload keeps the modules it was loaded with.
    pub fn register_module(&self, factory: impl Fn(&str) -> HostModule + 'static) {
        self.0.modules.borrow_mut().push(Rc::new(factory));
    }

    /// Every mod there is, by id: a user folder over a stock one.
    pub fn list(&self) -> Vec<ModInfo> {
        let mut ids: Vec<String> = [self.stock_dir(), self.0.user_dir.clone()]
            .iter()
            .filter_map(|dir| std::fs::read_dir(dir).ok())
            .flatten()
            .flatten()
            .filter_map(|entry| entry.file_name().into_string().ok())
            .filter(|id| valid_id(id))
            .collect();
        ids.sort();
        ids.dedup();
        ids.iter().filter_map(|id| self.find(id)).collect()
    }

    /// The mod `id`: the user's folder when it has a `main.js`, else the stock one.
    pub fn find(&self, id: &str) -> Option<ModInfo> {
        find_mod(&self.0.user_dir, id)
    }

    /// The mod `id` as a view, loaded now and watched from then on. A mod that is missing or
    /// fails to load still gives a view, which shows nothing until a working version appears.
    pub fn view(&self, id: &str, window: &mut Window, cx: &mut App) -> Entity<ModView> {
        self.view_keyed(id, id, window, cx)
    }

    /// The mod `id` as one of several copies, told apart by `key` (`pane-header#s-1`): host modules
    /// are built for `key`, and [`Self::refresh`] names the copy by it.
    pub fn view_keyed(
        &self,
        id: &str,
        key: &str,
        window: &mut Window,
        cx: &mut App,
    ) -> Entity<ModView> {
        let host = self.clone();
        let key = key.to_string();
        let id = id.to_string();
        let entity = cx.new(|cx| {
            let mut view = ModView {
                host,
                id,
                key,
                shown: None,
                tried: None,
                load_error: None,
                _poll: Task::ready(()),
            };
            view.check(window, cx);
            view._poll = cx.spawn_in(window, async move |this, cx| loop {
                cx.background_executor().timer(POLL).await;
                if this
                    .update_in(cx, |view, window, cx| view.check(window, cx))
                    .is_err()
                {
                    break;
                }
            });
            view
        });
        self.0.views.borrow_mut().push(entity.downgrade());
        entity
    }

    /// Re-renders the shown mods whose id is in `ids` (every one for `None`), from the host data
    /// as it is now.
    pub fn refresh(&self, ids: Option<&HashSet<String>>, cx: &mut App) {
        let views: Vec<Entity<ModView>> = {
            let mut views = self.0.views.borrow_mut();
            views.retain(|view| view.upgrade().is_some());
            views.iter().filter_map(WeakEntity::upgrade).collect()
        };
        for view in views {
            let view = view.read(cx);
            if ids.is_some_and(|ids| !ids.contains(&view.key)) {
                continue;
            }
            let Some(root) = view.shown.as_ref().map(|shown| shown.root.clone()) else {
                continue;
            };
            let id = view.id.clone();
            if let Err(error) = self.0.runtime.refresh(&root, cx) {
                eprintln!("perch-native: mod {id} could not refresh: {error:#}");
            }
        }
    }

    fn stock_dir(&self) -> PathBuf {
        self.0.user_dir.join(".stock")
    }

    /// The policy the next load runs under: what a mod may touch and the modules it imports.
    fn policy_for(&self, id: &str, key: &str) -> Result<Policy> {
        let capabilities = Capabilities::new()
            .read_roots(std::env::var_os("HOME").map(PathBuf::from))
            .write_roots([self.0.user_dir.clone()])
            .storage(true)
            .clipboard_read(true)
            .clipboard_write(true);
        let mut policy = Policy::new()
            .with_application(id)
            .with_capabilities(capabilities)
            .with_storage_path(self.0.user_dir.join(".data").join(id).join("store.json"));
        for factory in self.0.modules.borrow().iter() {
            policy = policy
                .with_host_module(factory(key))
                .map_err(|error| anyhow!("host module for {id}: {error}"))?;
        }
        Ok(policy)
    }
}

/// What a [`ModView`] has on screen.
struct Shown {
    dir: PathBuf,
    root: Entity<ShellRoot>,
}

/// One mod, drawn where the workspace places it, reloaded when its files change.
pub struct ModView {
    host: ModHost,
    id: String,
    /// The copy: the id, or `id#instance`.
    key: String,
    shown: Option<Shown>,
    /// The source and file stamp last acted on, so a broken version is tried once per change.
    tried: Option<(PathBuf, Stamp)>,
    load_error: Option<String>,
    _poll: Task<()>,
}

impl ModView {
    pub fn id(&self) -> &str {
        &self.id
    }

    /// Which copy of the mod this is: its id, or `id#instance`.
    pub fn key(&self) -> &str {
        &self.key
    }

    /// The folder the version on screen came from.
    pub fn source(&self) -> Option<&Path> {
        self.shown.as_ref().map(|shown| shown.dir.as_path())
    }

    /// Why the newest version could not be loaded, while an older one (or nothing) is shown.
    pub fn load_error(&self) -> Option<&str> {
        self.load_error.as_deref()
    }

    /// Why the shown version's last `render()` threw, while its last good render is drawn.
    pub fn render_error(&self, cx: &App) -> Option<String> {
        let view = self.script_view(cx)?;
        let error = view.read(cx).build_error().map(str::to_string);
        error
    }

    /// The load error, else the render error.
    pub fn error(&self, cx: &App) -> Option<String> {
        self.load_error.clone().or_else(|| self.render_error(cx))
    }

    /// The shell's view of the mod, for tests and tools that read its description.
    pub fn script_view(&self, cx: &App) -> Option<Entity<ScriptView>> {
        let root = &self.shown.as_ref()?.root;
        let content: AnyView = root.read(cx).content().clone();
        content.downcast::<ScriptView>().ok()
    }

    /// Looks at the mod's files and loads, reloads or switches source when they changed.
    fn check(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let Some(info) = self.host.find(&self.id) else {
            if self.shown.is_none() {
                self.load_error = Some(format!("no mod named {}", self.id));
            }
            return;
        };
        // ponytail: a stat per file on the window's thread every poll; a mod folder holds a
        // handful. A large one would want an OS file watcher (herdr-app uses `notify`).
        let stamp = stamp(&info.dir);
        let current = Some((info.dir.clone(), stamp));
        if self.tried == current {
            return;
        }
        self.tried = current;
        let outcome = match &self.shown {
            Some(shown) if shown.dir == info.dir => {
                let root = shown.root.clone();
                self.host.0.runtime.reload_now(&root, window, cx)
            }
            _ => self.load(&info, window, cx),
        };
        self.load_error = outcome.err().map(|error| format!("{error:#}"));
        if let Some(error) = &self.load_error {
            eprintln!(
                "perch-native: mod {} kept its last version: {error}",
                self.id
            );
        }
        cx.notify();
    }

    fn load(&mut self, info: &ModInfo, window: &mut Window, cx: &mut App) -> Result<()> {
        gpui_shell::policy::set_default(self.host.policy_for(&info.id, &self.key)?);
        let root = self.host.0.runtime.try_load(&info.dir, window, cx);
        gpui_shell::policy::set_default(Policy::new());
        let root = root?;
        self.shown = Some(Shown {
            dir: info.dir.clone(),
            root,
        });
        Ok(())
    }
}

impl Render for ModView {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        let view = div().size_full().overflow_hidden();
        match &self.shown {
            Some(shown) => view.child(shown.root.clone()),
            None => view,
        }
    }
}

/// What a folder's files looked like: each counted file's path, size and modified time.
type Stamp = Vec<(PathBuf, u64, Option<SystemTime>)>;

/// The files of a mod folder that matter to it (not hidden ones or the type files the shell
/// writes), up to a bounded depth and count.
fn stamp(dir: &Path) -> Stamp {
    fn walk(root: &Path, dir: &Path, depth: usize, out: &mut Stamp) {
        let Ok(entries) = std::fs::read_dir(dir) else {
            return;
        };
        for entry in entries.flatten() {
            if out.len() >= 1024 {
                return;
            }
            let path = entry.path();
            let Ok(relative) = path.strip_prefix(root) else {
                continue;
            };
            if !gpui_shell::application_file_counts(relative) {
                continue;
            }
            let Ok(meta) = entry.metadata() else { continue };
            if meta.is_dir() {
                if depth < 8 {
                    walk(root, &path, depth + 1, out);
                }
            } else {
                out.push((relative.to_path_buf(), meta.len(), meta.modified().ok()));
            }
        }
    }
    let mut out = Stamp::new();
    walk(dir, dir, 0, &mut out);
    out.sort();
    out
}

/// The mod `id` under `user_dir`: its own folder when that has a `main.js`, else the stock one.
fn find_mod(user_dir: &Path, id: &str) -> Option<ModInfo> {
    if !valid_id(id) {
        return None;
    }
    [
        (user_dir.join(id), true),
        (user_dir.join(".stock").join(id), false),
    ]
    .into_iter()
    .find(|(dir, _)| dir.join("main.js").is_file())
    .map(|(dir, user)| ModInfo {
        id: id.to_string(),
        manifest: std::fs::read_to_string(dir.join("mod.json"))
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or(Value::Null),
        dir,
        user,
    })
}

/// A folder name a mod may have: letters, digits, `-` and `_`, not hidden.
fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// Replaces `dir` with the shipped files, so the stock mods on disk are exactly this build's.
fn write_stock(dir: &Path, files: &[(&str, &str)]) -> Result<()> {
    match std::fs::remove_dir_all(dir) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error).context(format!("clearing {}", dir.display())),
    }
    for (path, text) in files {
        let file = dir.join(path);
        if let Some(parent) = file.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("creating {}", parent.display()))?;
        }
        std::fs::write(&file, text).with_context(|| format!("writing {}", file.display()))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("perch-native-mods-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn every_stock_file_is_shipped() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("mods");
        let mut on_disk: Vec<String> = stamp(&root)
            .into_iter()
            .map(|(path, _, _)| path.to_string_lossy().replace('\\', "/"))
            .collect();
        on_disk.sort();
        let mut listed: Vec<String> = STOCK.iter().map(|(path, _)| path.to_string()).collect();
        listed.sort();
        assert_eq!(on_disk, listed, "list each file under mods/ in STOCK");
    }

    #[test]
    fn a_user_folder_overrides_a_stock_mod_and_stock_is_rewritten() {
        let dir = scratch("override");
        write_stock(&dir.join(".stock"), STOCK).unwrap();
        // A stale stock file from an older build goes.
        std::fs::write(dir.join(".stock/example/old.js"), "").unwrap();
        write_stock(&dir.join(".stock"), STOCK).unwrap();
        assert!(!dir.join(".stock/example/old.js").exists());

        let stock = find_mod(&dir, "example").unwrap();
        assert!(!stock.user);
        assert_eq!(stock.dir, dir.join(".stock/example"));
        assert!(stock.manifest.is_object(), "mod.json is read");
        std::fs::create_dir_all(dir.join("example")).unwrap();
        std::fs::write(dir.join("example/main.js"), "").unwrap();
        let mine = find_mod(&dir, "example").unwrap();
        assert!(mine.user);
        assert_eq!(
            (mine.dir, mine.manifest),
            (dir.join("example"), Value::Null)
        );
        assert!(find_mod(&dir, "missing").is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn ids_are_plain_folder_names() {
        assert!(valid_id("sidebar-2_b"));
        for bad in ["", ".stock", "a/b", "..", "a b"] {
            assert!(!valid_id(bad), "{bad}");
        }
    }

    #[test]
    fn the_stamp_moves_on_an_edit_and_ignores_shell_files() {
        let dir = scratch("stamp");
        std::fs::write(dir.join("main.js"), "a").unwrap();
        let before = stamp(&dir);
        std::fs::write(dir.join("jsconfig.json"), "{}").unwrap();
        std::fs::write(dir.join("gpui-kit.d.ts"), "").unwrap();
        std::fs::write(dir.join(".hidden"), "").unwrap();
        assert_eq!(stamp(&dir), before);
        std::fs::write(dir.join("main.js"), "ab").unwrap();
        assert_ne!(stamp(&dir), before);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
