//! Mods on this core (`crate::mods` holds the rules and the files): `perch mod` (`/agent/mod/*`) lists,
//! turns one off or on and asks the person's screen to show one; the person's own screen does the
//! same over `mods.list`/`mods.set`, and loads a mod's code from `GET /mods/file` (a package's files
//! from `GET /mods/package?id&rev&path`). There is no approval: a mod is trusted code the person's
//! page runs, so the code routes are the person's alone (an agent token cannot fetch them) and
//! everything else here is list, off/on and show. A connection sees packages only once its
//! `mods.list` said it `accepts` their format; an older page is never handed one it cannot load.
use super::sub_sessions::{fail, internal, Failure};
use super::*;
use crate::agent_identity::AgentIdentity;
use crate::layouts;
use crate::mods::{self, Error};
use axum::Json;
use serde_json::{json, Value};

fn failure(error: Error) -> Failure {
    match error {
        Error::Invalid(text) => fail(StatusCode::BAD_REQUEST, text),
        Error::NotFound(text) => fail(StatusCode::NOT_FOUND, text),
        Error::Off(text) => fail(StatusCode::FORBIDDEN, text),
        Error::Gone(text) => fail(StatusCode::GONE, text),
        Error::Io(error) => internal("use the mods folder", error),
    }
}

fn id_of(body: &Value) -> Result<&str, Failure> {
    body["id"]
        .as_str()
        .filter(|text| !text.is_empty())
        .ok_or_else(|| fail(StatusCode::BAD_REQUEST, "a mod request needs `id`"))
}

pub(super) fn agent_list(app: &AppState) -> Result<Value, Failure> {
    let policy = app.settings.get().mods;
    Ok(json!({
        "mods": mods::scan(&app.memory_root, &policy),
        "layouts": layouts::scan(&app.memory_root, &policy),
        "layout": layouts::current(&app.memory_root),
        "uses": if policy.is_off() { Default::default() } else { layouts::uses(&app.memory_root) },
        "off": policy.is_off(),
        "folder": app.memory_root.display().to_string(),
    }))
}

/// `perch mod examples`: the mods and layouts that ship inside Perch to copy, then the stock screens
/// of this core's web build (`stock:<id>`).
pub(super) fn agent_examples(app: &AppState) -> Value {
    let examples = mods::EXAMPLES
        .iter()
        .map(|e| json!({ "id": e.id, "kind": if e.layout { "layout" } else { "mod" }, "about": e.about }));
    let stock = mods::stock(&app.stock_ui_dir).into_iter().map(|m| {
        let about = match &m.error {
            Some(error) => format!("stock screen, cannot be copied: {error}"),
            None => format!("stock screen \"{}\" as shipped ({})", m.name, m.description),
        };
        json!({ "id": m.id, "kind": "stock", "about": about })
    });
    let windows = layouts::stock(&app.stock_ui_dir).into_iter().map(|l| {
        let about = match &l.error {
            Some(error) => format!("stock layout, cannot be copied: {error}"),
            None => format!(
                "stock layout \"{}\": Perch's own window as a layout file to copy and edit",
                l.name
            ),
        };
        json!({ "id": l.id, "kind": "layout", "about": about })
    });
    json!(examples.chain(stock).chain(windows).collect::<Vec<_>>())
}

/// Copies `id` as `as_id`: a stock screen (`stock:<id>`) from the web build, else an example or one
/// of the person's mods or layouts. Returns the new id.
fn clone_any(app: &AppState, id: &str, as_id: Option<&str>) -> Result<String, Error> {
    if layouts::stock(&app.stock_ui_dir).iter().any(|l| l.id == id) {
        layouts::clone_stock(&app.memory_root, &app.stock_ui_dir, id, as_id)
    } else if id.starts_with(mods::STOCK_PREFIX) {
        mods::clone_stock(&app.memory_root, &app.stock_ui_dir, id, as_id)
    } else {
        mods::clone_example(&app.memory_root, id, as_id)
    }
}

/// `perch mod clone <example|stock:id|id> [id]`: copy into the mods or layouts folder.
pub(super) fn agent_clone(app: &AppState, body: &Value) -> Result<Value, Failure> {
    let example = body["example"]
        .as_str()
        .filter(|text| !text.is_empty())
        .ok_or_else(|| fail(StatusCode::BAD_REQUEST, "name an example to clone"))?;
    let id = clone_any(
        app,
        example,
        body["as"].as_str().filter(|text| !text.is_empty()),
    )
    .map_err(failure)?;
    // Where to edit it: a mod is a folder, a layout one file.
    let folder = app.memory_root.join("mods").join(&id);
    let path = if folder.is_dir() {
        folder
    } else {
        app.memory_root.join("layouts").join(format!("{id}.json"))
    };
    Ok(json!({ "id": id, "path": path.display().to_string() }))
}

/// `perch mod remove <id>`: move a mod folder or layout file to `mods-removed/` (never deleted).
pub(super) fn agent_remove(app: &AppState, body: &Value) -> Result<Value, Failure> {
    let id = id_of(body)?;
    let kind = mods::remove(&app.memory_root, id, body["kind"].as_str()).map_err(failure)?;
    Ok(json!({ "id": id, "kind": kind }))
}

/// `perch mod install <source>`: copy mods and layouts from a public GitHub repo, another public https git host or a folder here; never overwrites.
pub(super) async fn agent_install(app: &AppState, body: &Value) -> Result<Value, Failure> {
    let source = body["source"]
        .as_str()
        .filter(|text| !text.is_empty())
        .ok_or_else(|| {
            fail(
                StatusCode::BAD_REQUEST,
                "name a GitHub repository, an https git URL or a folder to install from",
            )
        })?
        .to_string();
    let root = app.memory_root.clone();
    let done = tokio::task::spawn_blocking(move || mods::install(&root, &source))
        .await
        .map_err(|_| fail(StatusCode::INTERNAL_SERVER_ERROR, "install was interrupted"))?
        .map_err(failure)?;
    Ok(json!(done))
}

/// Perch as shipped: an empty id, `stock`, or a stock layout of this build (`stock:main` is the
/// stock window itself, which is what no chosen layout shows).
fn shipped_window(app: &AppState, id: &str) -> bool {
    id.is_empty() || id == "stock" || layouts::stock(&app.stock_ui_dir).iter().any(|l| l.id == id)
}

/// `perch mod layout <id|stock>`: choose the window layout; `stock` (or an empty id, or `stock:main`) is Perch as shipped.
pub(super) fn agent_set_layout(app: &AppState, body: &Value) -> Result<Value, Failure> {
    let id = body["id"].as_str().filter(|id| !shipped_window(app, id));
    let policy = app.settings.get().mods;
    layouts::set_current(&app.memory_root, &policy, id).map_err(failure)?;
    Ok(json!({ "layout": id }))
}

/// Show the person's package `target` wherever Perch shows the stock screen `stock` (`stock:<name>`);
/// `None`, an empty target or `stock` itself shows the stock screen again. The stock screen must be
/// in this core's web build and the target one of the person's packages (`format: "esm"`) that loads;
/// a stock id is never a target, so a stock screen cannot stand in for another.
fn set_use(app: &AppState, stock: &str, target: Option<&str>) -> Result<(), Error> {
    let policy = app.settings.get().mods;
    if policy.is_off() {
        return Err(Error::Off(
            "mods are off, so no stock screen can be replaced".into(),
        ));
    }
    let known = mods::stock(&app.stock_ui_dir);
    if !known.iter().any(|m| m.id == stock) {
        let names: Vec<_> = known.iter().map(|m| m.id.as_str()).collect();
        return Err(Error::NotFound(format!(
            "no stock screen \"{stock}\" in this Perch's web build (there are: {})",
            if names.is_empty() {
                "none".to_string()
            } else {
                names.join(", ")
            }
        )));
    }
    let target = target.filter(|t| !t.is_empty() && *t != stock);
    if let Some(id) = target {
        let found = mods::scan(&app.memory_root, &policy);
        match found.iter().find(|m| m.id == id) {
            None => return Err(Error::NotFound(format!("no mod \"{id}\""))),
            Some(m) if m.format.as_deref() != Some("esm") => {
                return Err(Error::Invalid(format!(
                    "\"{id}\" is a single-file mod; only a package (a clone of {stock}) can replace a stock screen"
                )))
            }
            Some(m) if m.error.is_some() => {
                return Err(Error::Invalid(format!(
                    "\"{id}\" cannot load: {}",
                    m.error.clone().unwrap_or_default()
                )))
            }
            Some(_) => {}
        }
    }
    layouts::set_use(&app.memory_root, stock, target)?;
    Ok(())
}

/// `perch mod use <stock:id> <id|stock>`: show one of the person's packages in place of a stock screen.
pub(super) fn agent_set_use(app: &AppState, body: &Value) -> Result<Value, Failure> {
    let stock = id_of(body)?;
    let target = body["target"]
        .as_str()
        .filter(|t| !t.is_empty() && *t != "stock");
    set_use(app, stock, target).map_err(failure)?;
    Ok(json!({ "stock": stock, "use": target }))
}

/// `perch mod enable|disable <id>`.
pub(super) fn agent_set_enabled(
    app: &AppState,
    _caller: &AgentIdentity,
    body: &Value,
) -> Result<Value, Failure> {
    let id = id_of(body)?;
    let enabled = body["enabled"].as_bool().unwrap_or(true);
    let policy = app.settings.get().mods;
    mods::set_enabled(&app.memory_root, &policy, id, enabled).map_err(failure)?;
    Ok(json!({ "id": id, "enabled": enabled }))
}

/// `perch mod open <id>`: ask the person's screen to show an enabled mod now.
pub(super) fn agent_open(
    app: &AppState,
    _caller: &AgentIdentity,
    body: &Value,
) -> Result<Value, Failure> {
    let id = id_of(body)?;
    let policy = app.settings.get().mods;
    if !mods::scan(&app.memory_root, &policy)
        .iter()
        .any(|m| m.id == id && m.enabled)
    {
        return Err(fail(
            StatusCode::BAD_REQUEST,
            format!("no enabled mod \"{id}\""),
        ));
    }
    let _ = app
        .hub
        .hub_events_tx
        .send(Arc::new(ServerMessage::ModsOpen {
            mod_id: id.to_string(),
        }));
    Ok(json!({ "id": id }))
}

/// What the person's pages said about loading mods, and their answers to `perch mod do/dom`. A
/// report is filed under the connection it came on (`ConnState::conn_id`, the core's own viewer id;
/// a page never names it) and the copy of the mod it is about (`instance`), per revision, so one
/// copy's success never hides another's failure. Both tables are bounded and evict their oldest
/// entry, never refusing a new one; a closed connection's reports go with it. Memory only: a
/// reloaded page reports again.
#[derive(Default)]
pub(super) struct ModDiagnostics {
    seq: u64,
    reports: HashMap<ReportKey, Report>,
    requests: HashMap<String, Asked>,
}

/// Reports kept, across every mod, viewer, copy and revision.
const MAX_REPORTS: usize = 256;
/// `perch mod do/dom` requests waiting for an answer at once.
const MAX_ASKED: usize = 16;
/// The phases a page reports; `swap` (a new revision shown while tracked work was still pending)
/// is a warning, the others a failure when they carry an error.
const PHASES: [&str; 5] = ["load", "render", "callback", "disposal", "swap"];

#[derive(Clone, PartialEq, Eq, Hash)]
struct ReportKey {
    id: String,
    viewer: String,
    instance: String,
    revision: String,
}

#[derive(Clone, Default)]
struct Report {
    seq: u64,
    rendered: bool,
    /// The first failure at this revision: `(phase, error)`.
    failure: Option<(String, String)>,
    warning: Option<String>,
}

/// An answer to a snapshot request: `(html, text, error)`.
type Answer = (String, String, Option<String>);

struct Asked {
    seq: u64,
    viewer: Option<String>,
    instance: Option<String>,
    answer: Option<Answer>,
}

fn clip(text: String, max: usize) -> String {
    match text.char_indices().nth(max) {
        Some((at, _)) => text[..at].to_string(),
        None => text,
    }
}

impl ModDiagnostics {
    fn next(&mut self) -> u64 {
        self.seq += 1;
        self.seq
    }

    /// Files one report from `viewer`. A legacy page names no instance or phase: its `null` error
    /// is a load that rendered, its error a load failure.
    pub(super) fn report(
        &mut self,
        viewer: &str,
        id: String,
        revision: String,
        instance: Option<String>,
        phase: Option<String>,
        error: Option<String>,
    ) {
        if id.len() > 200 || revision.len() > 128 {
            return;
        }
        let phase = phase
            .filter(|p| PHASES.contains(&p.as_str()))
            .unwrap_or_else(|| "load".into());
        let key = ReportKey {
            id,
            viewer: viewer.to_string(),
            instance: clip(instance.unwrap_or_default(), 200),
            revision,
        };
        let seq = self.next();
        if !self.reports.contains_key(&key) && self.reports.len() >= MAX_REPORTS {
            let oldest = self
                .reports
                .iter()
                .min_by_key(|(_, report)| report.seq)
                .map(|(key, _)| key.clone());
            if let Some(oldest) = oldest {
                self.reports.remove(&oldest);
            }
        }
        let report = self.reports.entry(key).or_default();
        report.seq = seq;
        match (error.map(|e| clip(e, 2000)), phase.as_str()) {
            (Some(error), "swap") => report.warning = Some(error),
            (Some(error), _) => {
                report.failure.get_or_insert((phase, error));
            }
            (None, "load" | "render") => report.rendered = true,
            (None, _) => {}
        }
    }

    /// Forgets what a closed connection reported.
    pub(super) fn drop_viewer(&mut self, viewer: &str) {
        self.reports.retain(|key, _| key.viewer != viewer);
    }

    /// Every copy of `id` that reported `revision` (only `viewer`'s or `instance`'s when named), as
    /// `perch mod check` lists them, oldest report first.
    fn copies(
        &self,
        id: &str,
        revision: &str,
        viewer: Option<&str>,
        instance: Option<&str>,
    ) -> Vec<Value> {
        let mut found: Vec<(&ReportKey, &Report)> = self
            .reports
            .iter()
            .filter(|(key, _)| {
                key.id == id
                    && key.revision == revision
                    && viewer.is_none_or(|v| key.viewer == v)
                    && instance.is_none_or(|i| key.instance == i)
            })
            .collect();
        found.sort_by_key(|(_, report)| report.seq);
        found
            .into_iter()
            .map(|(key, report)| {
                let (status, phase, error) = match (&report.failure, report.rendered) {
                    (Some((phase, error)), _) => ("error", Some(phase), Some(error)),
                    (None, true) => ("ok", None, None),
                    (None, false) => ("pending", None, None),
                };
                json!({
                    "viewer": key.viewer,
                    "instance": key.instance,
                    "revision": key.revision,
                    "status": status,
                    "phase": phase,
                    "error": error,
                    "warning": report.warning,
                })
            })
            .collect()
    }

    /// Starts waiting for an answer to `request_id`, from `viewer` only when one is named.
    fn ask(&mut self, request_id: &str, viewer: Option<String>, instance: Option<String>) {
        if self.requests.len() >= MAX_ASKED {
            let oldest = self
                .requests
                .iter()
                .min_by_key(|(_, asked)| asked.seq)
                .map(|(id, _)| id.clone());
            if let Some(oldest) = oldest {
                self.requests.remove(&oldest);
            }
        }
        let seq = self.next();
        self.requests.insert(
            request_id.to_string(),
            Asked {
                seq,
                viewer,
                instance,
                answer: None,
            },
        );
    }

    /// Takes `viewer`'s answer if a request is waiting for it: the first answer from a connection
    /// it was sent to, about the copy it named. Anything else is dropped.
    pub(super) fn answer(
        &mut self,
        viewer: &str,
        request_id: &str,
        instance: Option<String>,
        answer: Answer,
    ) -> bool {
        let Some(asked) = self.requests.get_mut(request_id) else {
            return false;
        };
        if asked.answer.is_some()
            || asked.viewer.as_deref().is_some_and(|v| v != viewer)
            || asked.instance.is_some() && asked.instance != instance
        {
            return false;
        }
        asked.answer = Some(answer);
        true
    }

    /// The answer to `request_id`, once there is one; it is then forgotten.
    fn take(&mut self, request_id: &str) -> Option<Answer> {
        self.requests.get(request_id)?.answer.as_ref()?;
        self.requests
            .remove(request_id)
            .and_then(|asked| asked.answer)
    }
}

/// The person's page reports how loading a mod went; `perch mod check` waits for the current revision.
pub(super) fn handle_report(
    state: &Arc<ConnState>,
    id: String,
    revision: String,
    instance: Option<String>,
    phase: Option<String>,
    error: Option<String>,
) {
    state.app.mod_diagnostics.lock().unwrap().report(
        &state.conn_id,
        id,
        revision,
        instance,
        phase,
        error,
    );
}

/// The page's answer to a snapshot request; ignored unless that request was sent to this
/// connection and is still waiting.
pub(super) fn handle_snapshot(
    state: &Arc<ConnState>,
    request_id: String,
    instance: Option<String>,
    answer: Answer,
) {
    state
        .app
        .mod_diagnostics
        .lock()
        .unwrap()
        .answer(&state.conn_id, &request_id, instance, answer);
}

/// `viewer` and `instance` of a `perch mod check/do/dom` body: the one connection (as `perch mod
/// check` lists it) and the one copy of a mod a request is about.
fn target(body: &Value) -> Result<(Option<String>, Option<String>), Failure> {
    let field = |name: &str| -> Result<Option<String>, Failure> {
        match &body[name] {
            Value::Null => Ok(None),
            Value::String(text)
                if !text.is_empty() && text.len() <= 200 && !text.chars().any(char::is_control) =>
            {
                Ok(Some(text.clone()))
            }
            _ => Err(fail(
                StatusCode::BAD_REQUEST,
                format!("`{name}` is a viewer or instance id from perch mod check"),
            )),
        }
    };
    Ok((field("viewer")?, field("instance")?))
}

/// Sends a snapshot request (to `viewer` only, when named) and waits up to `ticks` × 250 ms for
/// the answer it accepts. `None` when nobody answered.
async fn ask_screens(
    app: &AppState,
    mod_id: &str,
    command: Option<String>,
    args: Option<Value>,
    (viewer, instance): (Option<String>, Option<String>),
    ticks: u32,
) -> Option<Answer> {
    let request_id = Uuid::new_v4().to_string();
    app.mod_diagnostics
        .lock()
        .unwrap()
        .ask(&request_id, viewer.clone(), instance.clone());
    let _ = app
        .hub
        .hub_events_tx
        .send(Arc::new(ServerMessage::ModsSnapshotRequest {
            request_id: request_id.clone(),
            mod_id: mod_id.to_string(),
            command,
            args,
            viewer,
            instance,
        }));
    for _ in 0..ticks {
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        if let Some(answer) = app.mod_diagnostics.lock().unwrap().take(&request_id) {
            return Some(answer);
        }
    }
    app.mod_diagnostics
        .lock()
        .unwrap()
        .requests
        .remove(&request_id);
    None
}

/// Why nobody answered: no window, or not the one named.
fn unanswered(target: &(Option<String>, Option<String>)) -> Value {
    let error = match target {
        (None, None) => "no Perch window answered within 5 seconds (is one open?)".to_string(),
        (viewer, instance) => format!(
            "the window{} showing{} did not answer within 5 seconds (perch mod check lists them)",
            viewer.as_ref().map(|v| format!(" {v}")).unwrap_or_default(),
            instance
                .as_ref()
                .map_or(" it".to_string(), |i| format!(" copy {i}"))
        ),
    };
    json!({ "status": "not loaded", "error": error })
}

/// `perch mod dom <id|app> [--viewer v] [--instance i]`: ask the person's screen for what a mod (or
/// the whole page) drew, as HTML and text, to see a result without a screenshot. Without a target
/// the first screen to answer wins; with one, only that window or copy can answer.
pub(super) async fn agent_dom(app: &AppState, body: &Value) -> Result<Value, Failure> {
    let id = id_of(body)?;
    let target = target(body)?;
    if id != "app" {
        let policy = app.settings.get().mods;
        if !mods::scan(&app.memory_root, &policy)
            .iter()
            .chain(mods::stock(&app.stock_ui_dir).iter())
            .any(|m| m.id == id && m.enabled)
        {
            return Err(fail(
                StatusCode::BAD_REQUEST,
                format!("no enabled mod \"{id}\""),
            ));
        }
    }
    Ok(
        match ask_screens(app, id, None, None, target.clone(), 20).await {
            Some((_, _, Some(error))) => json!({ "status": "error", "error": error }),
            Some((html, text, None)) => json!({ "status": "ok", "html": html, "text": text }),
            None => unanswered(&target),
        },
    )
}

/// `perch mod do <command> [json] [--viewer v]` and `perch mod commands`: runs an app command on the
/// person's screen (what a key or a mod's `api.run` does), or with `list` returns the commands.
/// Without `--viewer` the first screen to answer wins; a command nobody recognises answers `error`.
pub(super) async fn agent_do(app: &AppState, body: &Value) -> Result<Value, Failure> {
    let command = body["command"]
        .as_str()
        .filter(|c| !c.is_empty() && c.len() <= 100 && !c.chars().any(char::is_control))
        .ok_or_else(|| {
            fail(
                StatusCode::BAD_REQUEST,
                "name a command (perch mod commands lists them)",
            )
        })?;
    let target = target(body)?;
    if app.settings.get().mods.is_off() {
        return Err(fail(StatusCode::BAD_REQUEST, "mods are off"));
    }
    let args = body.get("args").filter(|a| !a.is_null()).cloned();
    // A picture (`shot`) takes a moment to draw.
    Ok(
        match ask_screens(app, "", Some(command.to_string()), args, target.clone(), 40).await {
            Some((_, _, Some(error))) => json!({ "status": "error", "error": error }),
            Some((_, text, None)) => {
                json!({ "status": "ok", "result": serde_json::from_str::<Value>(&text).unwrap_or(Value::String(text)) })
            }
            None => unanswered(&target),
        },
    )
}

/// `perch mod check <id> [--viewer v] [--instance i]`: `ok` once the person's screens have loaded
/// the mod's current files, `error` with why when any copy failed (its phase: load, render, a
/// callback or disposal), `off` for a disabled mod, and `not loaded` when no screen reported within
/// a few seconds (no window open). Every copy that reported is listed in `instances`; one copy's
/// success never hides another's failure. A mod that draws badly without throwing still needs a look.
pub(super) async fn agent_check(app: &AppState, body: &Value) -> Result<Value, Failure> {
    let id = id_of(body)?;
    let (viewer, instance) = target(body)?;
    for _ in 0..30 {
        let policy = app.settings.get().mods;
        let Some(info) = mods::scan(&app.memory_root, &policy)
            .into_iter()
            .chain(mods::stock(&app.stock_ui_dir))
            .find(|m| m.id == id)
        else {
            return Err(fail(StatusCode::NOT_FOUND, format!("no mod \"{id}\"")));
        };
        if let Some(error) = info.error {
            return Ok(json!({ "status": "error", "error": error }));
        }
        if !info.enabled {
            return Ok(json!({ "status": "off", "error": "the mod is off, or mods are off" }));
        }
        let copies = app.mod_diagnostics.lock().unwrap().copies(
            id,
            &info.revision,
            viewer.as_deref(),
            instance.as_deref(),
        );
        if let Some(failed) = copies.iter().find(|c| c["status"] == "error") {
            return Ok(json!({
                "status": "error",
                "error": failed["error"],
                "phase": failed["phase"],
                "revision": info.revision,
                "instances": copies,
            }));
        }
        if copies.iter().any(|c| c["status"] == "ok") {
            return Ok(json!({ "status": "ok", "revision": info.revision, "instances": copies }));
        }
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
    }
    Ok(
        json!({ "status": "not loaded", "error": "no Perch window loaded it within 7 seconds (is one open?)" }),
    )
}

/// `GET /mods/file?id=`: a mod's code for the person's own page to import. A person's token only.
pub(super) async fn file(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(app): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> axum::response::Response {
    if let Err(status) = authorize_request(&app, &peer, &headers, &params) {
        return (status, "device access denied").into_response();
    }
    let policy = app.settings.get().mods;
    // A program's icon from programs.json: an image under the folder, shown by <img> and never run.
    if let Some(rel) = params.get("icon") {
        return match mods::icon(&app.memory_root, &policy, rel) {
            Ok((bytes, kind)) => (
                [
                    ("content-type", kind),
                    ("x-content-type-options", "nosniff"),
                    (
                        "content-security-policy",
                        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
                    ),
                    ("cache-control", "no-cache"),
                ],
                bytes,
            )
                .into_response(),
            Err(error) => {
                let (status, text) = failure(error);
                (status, text).into_response()
            }
        };
    }
    // A notification sound from settings.json: audio under the folder, played by the page.
    if let Some(rel) = params.get("sound") {
        return match mods::sound(&app.memory_root, &policy, rel) {
            Ok((bytes, kind)) => (
                [
                    ("content-type", kind),
                    ("x-content-type-options", "nosniff"),
                    ("cache-control", "no-cache"),
                ],
                bytes,
            )
                .into_response(),
            Err(error) => {
                let (status, text) = failure(error);
                (status, text).into_response()
            }
        };
    }
    let Some(id) = params.get("id") else {
        return (StatusCode::BAD_REQUEST, "id is required").into_response();
    };
    if let Some(name) = params.get("font") {
        return match mods::font(&app.memory_root, &policy, id, name) {
            Ok((bytes, kind)) => (
                [
                    ("content-type", kind),
                    ("x-content-type-options", "nosniff"),
                    ("cache-control", "no-store"),
                ],
                bytes,
            )
                .into_response(),
            Err(error) => {
                let (status, text) = failure(error);
                (status, text).into_response()
            }
        };
    }
    match mods::source(&app.memory_root, &policy, id) {
        Ok(code) => (
            [
                ("content-type", "text/javascript; charset=utf-8"),
                ("x-content-type-options", "nosniff"),
                ("cache-control", "no-store"),
            ],
            code,
        )
            .into_response(),
        Err(error) => {
            let (status, text) = failure(error);
            (status, text).into_response()
        }
    }
}

/// `GET /mods/package?id=&rev=&path=`: one file of a retained package revision, by exact path in that
/// revision's list (`ModInfo::files`), never read from the disk at request time. A person's token
/// only, from a header or cookie (a token in the URL is not looked at); 403 while mods or the mod
/// are off, 410 for a revision no longer kept (list again), 404 for any other path.
pub(super) async fn package(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(app): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> axum::response::Response {
    if params.contains_key("token") {
        return (StatusCode::BAD_REQUEST, "a token never goes in the URL").into_response();
    }
    if let Err(status) = authorize_request(&app, &peer, &headers, &HashMap::new()) {
        return (status, "device access denied").into_response();
    }
    let (Some(id), Some(revision), Some(path)) =
        (params.get("id"), params.get("rev"), params.get("path"))
    else {
        return (StatusCode::BAD_REQUEST, "id, rev and path are required").into_response();
    };
    let policy = app.settings.get().mods;
    match mods::package_file(&app.memory_root, &policy, id, revision, path) {
        Ok((bytes, kind)) => {
            let script = kind.starts_with("text/javascript");
            let mut response = (
                [
                    ("content-type", kind),
                    ("x-content-type-options", "nosniff"),
                    ("cache-control", "no-store"),
                ],
                bytes.to_vec(),
            )
                .into_response();
            if !script {
                // An asset opened on its own is an inert document (an SVG runs no script).
                response.headers_mut().insert(
                    "content-security-policy",
                    axum::http::HeaderValue::from_static(
                        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
                    ),
                );
            }
            response
        }
        Err(error) => {
            let (status, text) = failure(error);
            (status, text).into_response()
        }
    }
}

/// The person's page asking for what a mod may do on this computer: run a program or use a file, as
/// herdr's `exec` and file functions do. Same gate as the mod's code (a person's token, never an
/// agent's, and nothing while mods are off), since a mod is trusted code the person chose to run.
fn mod_host_gate(
    app: &AppState,
    peer: &SocketAddr,
    headers: &HeaderMap,
) -> Result<(), (StatusCode, &'static str)> {
    authorize_request(app, peer, headers, &HashMap::new())
        .map_err(|status| (status, "device access denied"))?;
    if app.settings.get().mods.is_off() {
        return Err((StatusCode::FORBIDDEN, "mods are off"));
    }
    Ok(())
}

fn plain_error(status: StatusCode, text: impl ToString) -> axum::response::Response {
    (status, Json(json!({ "error": text.to_string() }))).into_response()
}

/// `~/x` and absolute paths only: a mod names a place on the computer, not "somewhere near here".
fn host_path(text: &str) -> Result<PathBuf, String> {
    let path = match text.strip_prefix("~/") {
        Some(rest) => PathBuf::from(std::env::var_os("HOME").ok_or("no home folder")?).join(rest),
        None => PathBuf::from(text),
    };
    if path.is_absolute() {
        Ok(path)
    } else {
        Err("a path must be absolute or start with ~/".into())
    }
}

const MAX_OUTPUT: usize = 1024 * 1024;
const MAX_FILE: u64 = 5 * 1024 * 1024;

/// The ssh destination of a host perch knows by id; a mod cannot name an arbitrary machine.
fn ssh_target(app: &AppState, host: &str) -> Result<String, String> {
    app.hosts
        .get(host)
        .filter(|h| h.enabled && !h.ssh_host.is_empty())
        .map(|h| h.ssh_host)
        .ok_or_else(|| format!("no host \"{host}\" (see Settings > Hosts)"))
}

/// A remote path as shell text: `~/x` follows the remote `$HOME`, otherwise absolute.
fn remote_path(text: &str) -> Result<String, String> {
    use crate::ssh::shell_quote;
    match text.strip_prefix("~/") {
        Some(rest) => Ok(format!("\"$HOME\"/{}", shell_quote(rest))),
        None if text.starts_with('/') => Ok(shell_quote(text)),
        None => Err("a path must be absolute or start with ~/".into()),
    }
}

/// `exec` on another computer over the host's ssh login (same result shape as the local run).
async fn remote_exec(
    app: &AppState,
    host: &str,
    cmd: &str,
    args: &[String],
    cwd: Option<&str>,
    wait: std::time::Duration,
) -> axum::response::Response {
    use crate::ssh::shell_quote;
    let target = match ssh_target(app, host) {
        Ok(target) => target,
        Err(error) => return plain_error(StatusCode::BAD_REQUEST, error),
    };
    let cd = match cwd.map(remote_path).transpose() {
        Ok(dir) => dir.map(|d| format!("cd {d} && ")).unwrap_or_default(),
        Err(error) => return plain_error(StatusCode::BAD_REQUEST, error),
    };
    let words: Vec<String> = std::iter::once(cmd)
        .chain(args.iter().map(String::as_str))
        .map(shell_quote)
        .collect();
    let script = format!(
        "{} {cd}exec {}",
        crate::ssh::REMOTE_PATH_PREFIX,
        words.join(" ")
    );
    match crate::ssh::exec_with_fallback(&target, &script, wait.as_secs().max(1), "mod exec").await
    {
        Err(error) => plain_error(StatusCode::REQUEST_TIMEOUT, error),
        Ok(out) => Json(json!({
            "code": out.status.code(),
            "stdout": cut_output(out.stdout),
            "stderr": cut_output(out.stderr),
        }))
        .into_response(),
    }
}

fn cut_output(bytes: Vec<u8>) -> String {
    String::from_utf8_lossy(&bytes[..bytes.len().min(MAX_OUTPUT)]).into_owned()
}

/// `fs` on another computer over ssh (a write goes down ssh's stdin, up to 5 MiB like a read).
async fn remote_fs(app: &AppState, host: &str, body: &Value) -> axum::response::Response {
    let target = match ssh_target(app, host) {
        Ok(target) => target,
        Err(error) => return plain_error(StatusCode::BAD_REQUEST, error),
    };
    let path = match body["path"].as_str().map(remote_path) {
        Some(Ok(path)) => path,
        Some(Err(error)) => return plain_error(StatusCode::BAD_REQUEST, error),
        None => return plain_error(StatusCode::BAD_REQUEST, "fs needs `path`"),
    };
    let op = body["op"].as_str().unwrap_or_default();
    let script = match op {
        "read" => format!(
            "p={path}; [ \"$(wc -c < \"$p\")\" -le {MAX_FILE} ] || {{ echo 'larger than 5 MiB' >&2; exit 1; }}; cat \"$p\""
        ),
        "write" => {
            let text = body["text"].as_str().unwrap_or_default();
            if text.len() as u64 > MAX_FILE {
                return plain_error(StatusCode::BAD_REQUEST, "larger than 5 MiB");
            }
            // The text goes down ssh's stdin, so the command line does not limit it.
            let script = format!("p={path}; mkdir -p \"$(dirname \"$p\")\" && cat > \"$p\"");
            let input = text.as_bytes().to_vec();
            return match crate::ssh::run_remote_with_input(&target, &script, input, 60).await {
                Ok(out) if out.status.success() => Json(json!({})).into_response(),
                Ok(out) => plain_error(StatusCode::BAD_REQUEST, String::from_utf8_lossy(&out.stderr).trim()),
                Err(error) => plain_error(StatusCode::BAD_REQUEST, error),
            };
        }
        "stat" => format!(
            "p={path}; if [ -e \"$p\" ]; then d=false; [ -d \"$p\" ] && d=true; m=$(stat -c %Y \"$p\" 2>/dev/null || stat -f %m \"$p\"); s=$(wc -c < \"$p\" 2>/dev/null || echo 0); echo \"$d $m $s\"; else echo missing; fi"
        ),
        "list" => format!("ls -1Ap {path} | head -5000"),
        _ => return plain_error(StatusCode::BAD_REQUEST, "op is read, write, stat or list"),
    };
    let full = format!("{} {script}", crate::ssh::REMOTE_PATH_PREFIX);
    let out = match crate::ssh::exec_with_fallback(&target, &full, 30, "mod fs").await {
        Ok(out) if out.status.success() => String::from_utf8_lossy(&out.stdout).into_owned(),
        Ok(out) => {
            let error = String::from_utf8_lossy(&out.stderr);
            return plain_error(StatusCode::BAD_REQUEST, error.trim());
        }
        Err(error) => return plain_error(StatusCode::BAD_REQUEST, error),
    };
    // Only a read keeps its text exactly; the others are one short line each.
    let out = if op == "read" {
        out
    } else {
        out.trim().to_string()
    };
    Json(match op {
        "read" => json!({ "text": out }),
        "write" => json!({}),
        "stat" if out == "missing" => json!({ "exists": false }),
        "stat" => {
            let mut parts = out.split_whitespace();
            let is_dir = parts.next() == Some("true");
            let modified = parts
                .next()
                .and_then(|m| m.parse::<u64>().ok())
                .map(|s| s * 1000);
            let size = parts
                .next()
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);
            json!({ "exists": true, "isDir": is_dir, "size": size, "modified": modified })
        }
        _ => json!({ "entries": out.lines().map(|l| match l.strip_suffix('/') {
            Some(name) => json!({ "name": name, "isDir": true }),
            None => json!({ "name": l, "isDir": false }),
        }).collect::<Vec<_>>() }),
    })
    .into_response()
}

/// `perch` names the control CLI that ships beside the core (what `api.perch()` runs), which is not
/// on the core's own PATH; every other program is looked up as usual.
fn program_path(cmd: &str) -> std::path::PathBuf {
    program_path_with(cmd, crate::agent_identity::cli_binary())
}

fn program_path_with(cmd: &str, cli: Option<std::path::PathBuf>) -> std::path::PathBuf {
    match cli {
        Some(cli) if cmd == "perch" => cli,
        _ => cmd.into(),
    }
}

/// What `exec` and `agent_exec` read from a request body: the program, its arguments and how long to wait.
type ExecParts = (String, Vec<String>, std::time::Duration);

fn exec_request(body: &Value) -> Result<ExecParts, &'static str> {
    let Some(cmd) = body["cmd"].as_str().filter(|c| !c.is_empty()) else {
        return Err("exec needs `cmd`");
    };
    let args = body["args"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();
    let wait =
        std::time::Duration::from_millis(body["timeout"].as_u64().unwrap_or(30_000).min(600_000));
    Ok((cmd.to_string(), args, wait))
}

/// `POST agent/exec {host, cmd, args?, cwd?, timeout?}`: an agent runs one program on a computer from
/// Settings > Hosts over that host's ssh login (`perch exec --on`). Only hosts: an agent already has a
/// shell here, and it never names a machine the person did not list. Nothing runs while mods are off.
pub(super) async fn agent_exec(app: &AppState, body: &Value) -> axum::response::Response {
    if app.settings.get().mods.is_off() {
        return plain_error(StatusCode::FORBIDDEN, "mods are off");
    }
    let Some(host) = body["host"].as_str().filter(|h| !h.is_empty()) else {
        return plain_error(
            StatusCode::BAD_REQUEST,
            "name a host from Settings > Hosts (on this computer, run the program in your own shell)",
        );
    };
    let (cmd, args, wait) = match exec_request(body) {
        Ok(parsed) => parsed,
        Err(message) => return plain_error(StatusCode::BAD_REQUEST, message),
    };
    remote_exec(app, host, &cmd, &args, body["cwd"].as_str(), wait).await
}

/// `POST /mods/exec {cmd, args?, cwd?, timeout?, host?}`: run a program in the person's environment (or, with
/// a `host` id from Settings > Hosts, on that computer over ssh). The
/// timeout is milliseconds (default 30 s, at most 10 min); output past 1 MiB is cut.
pub(super) async fn exec(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(app): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> axum::response::Response {
    if let Err((status, text)) = mod_host_gate(&app, &peer, &headers) {
        return (status, text).into_response();
    }
    let (cmd, args, wait) = match exec_request(&body) {
        Ok(parsed) => parsed,
        Err(message) => return plain_error(StatusCode::BAD_REQUEST, message),
    };
    let cmd = cmd.as_str();
    if let Some(host) = body["host"].as_str().filter(|h| !h.is_empty()) {
        return remote_exec(&app, host, cmd, &args, body["cwd"].as_str(), wait).await;
    }
    let mut command = tokio::process::Command::new(program_path(cmd));
    command
        .args(&args)
        .stdin(std::process::Stdio::null())
        .kill_on_drop(true);
    if let Some(cwd) = body["cwd"].as_str() {
        match host_path(cwd) {
            Ok(dir) => command.current_dir(dir),
            Err(error) => return plain_error(StatusCode::BAD_REQUEST, error),
        };
    }
    let cut = |bytes: Vec<u8>| {
        String::from_utf8_lossy(&bytes[..bytes.len().min(MAX_OUTPUT)]).into_owned()
    };
    match tokio::time::timeout(wait, command.output()).await {
        Err(_) => plain_error(
            StatusCode::REQUEST_TIMEOUT,
            format!("{cmd} ran past {} ms", wait.as_millis()),
        ),
        Ok(Err(error)) => plain_error(
            StatusCode::BAD_REQUEST,
            format!("could not start {cmd}: {error}"),
        ),
        Ok(Ok(out)) => Json(json!({
            "code": out.status.code(),
            "stdout": cut(out.stdout),
            "stderr": cut(out.stderr),
        }))
        .into_response(),
    }
}

/// `POST /mods/fs {op: read|write|stat|list, path, text?, host?}` on absolute or `~/` paths. Reads stop at
/// 5 MiB. Write replaces the file (parent folders are made).
pub(super) async fn fs(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(app): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> axum::response::Response {
    if let Err((status, text)) = mod_host_gate(&app, &peer, &headers) {
        return (status, text).into_response();
    }
    if let Some(host) = body["host"].as_str().filter(|h| !h.is_empty()) {
        return remote_fs(&app, host, &body).await;
    }
    let path = match body["path"].as_str().map(host_path) {
        Some(Ok(path)) => path,
        Some(Err(error)) => return plain_error(StatusCode::BAD_REQUEST, error),
        None => return plain_error(StatusCode::BAD_REQUEST, "fs needs `path`"),
    };
    let done = tokio::task::spawn_blocking(move || -> Result<Value, std::io::Error> {
        Ok(match body["op"].as_str() {
            Some("read") => {
                if std::fs::metadata(&path)?.len() > MAX_FILE {
                    return Err(std::io::Error::other("larger than 5 MiB"));
                }
                json!({ "text": std::fs::read_to_string(&path)? })
            }
            Some("write") => {
                let text = body["text"].as_str().unwrap_or_default();
                if text.len() as u64 > MAX_FILE {
                    return Err(std::io::Error::other("larger than 5 MiB"));
                }
                if let Some(parent) = path.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                std::fs::write(&path, text)?;
                json!({})
            }
            Some("stat") => match std::fs::metadata(&path) {
                Ok(m) => json!({
                    "exists": true,
                    "isDir": m.is_dir(),
                    "size": m.len(),
                    "modified": m.modified().ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_millis() as u64),
                }),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => json!({ "exists": false }),
                Err(error) => return Err(error),
            },
            Some("list") => {
                let mut names: Vec<Value> = std::fs::read_dir(&path)?
                    .filter_map(Result::ok)
                    .filter_map(|e| {
                        Some(json!({ "name": e.file_name().into_string().ok()?, "isDir": e.file_type().ok()?.is_dir() }))
                    })
                    .take(5000)
                    .collect();
                names.sort_by_key(|n| n["name"].as_str().unwrap_or_default().to_string());
                json!({ "entries": names })
            }
            _ => return Err(std::io::Error::other("op is read, write, stat or list")),
        })
    })
    .await;
    match done {
        Ok(Ok(value)) => Json(value).into_response(),
        Ok(Err(error)) => plain_error(StatusCode::BAD_REQUEST, error),
        Err(error) => plain_error(StatusCode::INTERNAL_SERVER_ERROR, error),
    }
}

/// `POST /mods/data {id, op: read|write|delete|list, key?, value?, expected?}`: a mod's durable data
/// (`crate::mod_data`, outside its source folder). A person's token only, like the mod's code; `id`
/// must be a mod in the mods folder (refused while mods are off) or a stock screen of the served
/// build (also while mods are off: stock is Perch as shipped). A stale `expected` is 409 with the
/// key's current revision; a value that is not valid JSON reads as `corrupt` with its revision.
pub(super) async fn data(
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    State(app): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> axum::response::Response {
    use crate::mod_data::{self, Error as DataError, Expect, Value as Stored};
    if let Err(status) = authorize_request(&app, &peer, &headers, &HashMap::new()) {
        return (status, "device access denied").into_response();
    }
    let id = body["id"].as_str().unwrap_or_default().to_string();
    let dir = match mod_data::folder(&app.memory_root, &id) {
        Ok(dir) => dir,
        Err(error) => return plain_error(StatusCode::BAD_REQUEST, error),
    };
    let known = match id.strip_prefix(mods::STOCK_PREFIX) {
        Some(_) => mods::stock(&app.stock_ui_dir).iter().any(|m| m.id == id),
        None => {
            if app.settings.get().mods.is_off() {
                return plain_error(StatusCode::FORBIDDEN, "mods are off");
            }
            app.memory_root.join("mods").join(&id).is_dir()
        }
    };
    if !known {
        return plain_error(StatusCode::NOT_FOUND, format!("no mod \"{id}\""));
    }
    let done = tokio::task::spawn_blocking(move || -> Result<Value, DataError> {
        let key = || body["key"].as_str().unwrap_or_default();
        Ok(match body["op"].as_str().unwrap_or_default() {
            "read" => match mod_data::read(&dir, key())? {
                Stored::Missing => json!({ "exists": false }),
                Stored::Found { value, revision } => {
                    json!({ "exists": true, "value": value, "revision": revision })
                }
                Stored::Corrupt { revision, error } => {
                    json!({ "exists": true, "corrupt": true, "revision": revision, "error": error })
                }
            },
            "write" => {
                let Some(value) = body.get("value") else {
                    return Err(DataError::Invalid("write needs a `value`".into()));
                };
                let revision = mod_data::write(&dir, key(), value, &Expect::from_body(&body)?)?;
                json!({ "revision": revision })
            }
            "delete" => {
                json!({ "deleted": mod_data::delete(&dir, key(), &Expect::from_body(&body)?)? })
            }
            "list" => json!({ "keys": mod_data::list(&dir)? }),
            _ => {
                return Err(DataError::Invalid(
                    "op is read, write, delete or list".into(),
                ))
            }
        })
    })
    .await;
    match done {
        Ok(Ok(value)) => Json(value).into_response(),
        Ok(Err(DataError::Conflict(revision))) => (
            StatusCode::CONFLICT,
            Json(json!({ "error": "the value changed since it was read", "revision": revision })),
        )
            .into_response(),
        Ok(Err(DataError::Invalid(text))) => plain_error(StatusCode::BAD_REQUEST, text),
        Ok(Err(error @ DataError::Io(_))) => plain_error(StatusCode::INTERNAL_SERVER_ERROR, error),
        Err(error) => plain_error(StatusCode::INTERNAL_SERVER_ERROR, error),
    }
}

/// `mods.state` for a page that loads the mod formats in `accepts` (a single-file mod is always
/// loadable; a package only when its format is accepted).
fn state_message(
    app: &AppState,
    request_id: String,
    error: Option<String>,
    accepts: &[String],
) -> ServerMessage {
    let policy = app.settings.get().mods;
    let files = mods::scan_user_files(&app.memory_root, &policy);
    // Stock screens come first and are listed even while mods are off: they are Perch as shipped.
    let mut found = mods::stock(&app.stock_ui_dir);
    found.extend(mods::scan(&app.memory_root, &policy));
    found.retain(|m| m.format.as_ref().is_none_or(|f| accepts.contains(f)));
    // A replacement counts only for a page that can load it, and never while mods are off.
    let mut uses = layouts::uses(&app.memory_root);
    uses.retain(|_, id| !policy.is_off() && found.iter().any(|m| m.id == *id));
    ServerMessage::ModsState {
        request_id,
        mods: found,
        layouts: layouts::scan(&app.memory_root, &policy),
        layout: layouts::current(&app.memory_root),
        uses,
        themes: layouts::scan_themes(&app.memory_root, &policy),
        safe_mode: policy.is_off(),
        policy,
        folder: app.memory_root.join("mods").display().to_string(),
        home: std::env::var("HOME").unwrap_or_default(),
        keys: files.keys,
        keys_error: files.keys_error,
        programs: files.programs,
        programs_error: files.programs_error,
        error,
    }
}

/// `mods.list`: also what this connection can load from now on (`accepts`; absent is an older page
/// that loads single-file mods only), which `mods.set` replies follow too.
pub(super) fn handle_list(
    state: &Arc<ConnState>,
    request_id: String,
    accepts: Option<Vec<String>>,
) {
    let accepts: Vec<String> = accepts
        .unwrap_or_default()
        .into_iter()
        .filter(|f| f.len() <= 32)
        .take(8)
        .collect();
    *state.mod_formats.lock().unwrap() = accepts.clone();
    let _ = state
        .out_tx
        .send(state_message(&state.app, request_id, None, &accepts));
}

/// A person's click: turn one mod off or on.
pub(super) fn handle_set(
    state: &Arc<ConnState>,
    request_id: String,
    id: String,
    op: String,
    as_id: Option<String>,
    target: Option<String>,
) {
    let app = &state.app;
    let policy = app.settings.get().mods;
    let outcome = match op.as_str() {
        "use" => set_use(app, &id, target.as_deref()),
        "enable" => mods::set_enabled(&app.memory_root, &policy, &id, true),
        "disable" => mods::set_enabled(&app.memory_root, &policy, &id, false),
        "layout" => layouts::set_current(
            &app.memory_root,
            &policy,
            Some(id.as_str()).filter(|id| !shipped_window(app, id)),
        ),
        "clone" => clone_any(app, &id, as_id.as_deref().filter(|n| !n.is_empty())).map(drop),
        "remove-mod" => mods::remove(&app.memory_root, &id, Some("mod")).map(drop),
        "remove-layout" => mods::remove(&app.memory_root, &id, Some("layout")).map(drop),
        _ => Err(Error::Invalid(
            "ops are enable, disable, layout, use, clone, remove-mod and remove-layout".into(),
        )),
    };
    let error = outcome.err().map(|error| error.to_string());
    let accepts = state.mod_formats.lock().unwrap().clone();
    let _ = state
        .out_tx
        .send(state_message(app, request_id, error, &accepts));
}

/// Tells every client when the mods folder or a mod's state changes, so a mod an agent just wrote
/// shows up without anyone visiting Settings.
// ponytail: a 2 s rescan of small folders, not a file watcher; the ceiling is a change taking up
// to 2 s to show, and the upgrade path is `notify` on the mods folder.
pub(super) fn spawn_watch(app: AppState) {
    tokio::spawn(async move {
        type Seen = (
            Vec<mods::ModInfo>,
            Vec<layouts::LayoutInfo>,
            Option<String>,
            std::collections::BTreeMap<String, String>,
            Vec<layouts::ThemeInfo>,
            mods::UserFiles,
        );
        let mut seen: Option<Seen> = None;
        let mut tick = tokio::time::interval(std::time::Duration::from_secs(2));
        loop {
            tick.tick().await;
            let (root, policy) = (app.memory_root.clone(), app.settings.get().mods);
            let Ok(now) = tokio::task::spawn_blocking(move || {
                (
                    mods::scan(&root, &policy),
                    layouts::scan(&root, &policy),
                    layouts::current(&root),
                    layouts::uses(&root),
                    layouts::scan_themes(&root, &policy),
                    mods::scan_user_files(&root, &policy),
                )
            })
            .await
            else {
                continue;
            };
            if seen.as_ref().is_some_and(|before| *before != now) {
                let _ = app
                    .hub
                    .hub_events_tx
                    .send(Arc::new(ServerMessage::ModsChanged {}));
            }
            seen = Some(now);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::super::agent::tests::request;
    use super::super::sub_sessions::tests::{boot, lead_with_child};
    use super::*;
    use crate::agent_fleet::AgentKey;
    use crate::agent_identity::IdentityStore;

    /// A stand-in `ssh` that runs the remote command line here, so the remote scripts and the stdin
    /// write are exercised for real (what a host would see, minus the network).
    #[tokio::test]
    async fn a_write_to_another_computer_streams_over_stdin_and_reads_back() {
        let dir = std::env::temp_dir().join(format!("perch-fake-ssh-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let shim = dir.join("ssh");
        std::fs::write(
            &shim,
            "#!/bin/sh\nwhile [ \"$1\" = -o ]; do shift 2; done\nshift\nexec sh -c \"$1\"\n",
        )
        .unwrap();
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&shim, std::fs::Permissions::from_mode(0o755)).unwrap();
        std::env::set_var("PERCH_SSH", &shim); // only the ssh helpers read it

        let target = dir.join("nested/out.txt");
        let big = "x".repeat(600 * 1024); // past what a command line carries
        let script = format!(
            "p={}; mkdir -p \"$(dirname \"$p\")\" && cat > \"$p\"",
            crate::ssh::shell_quote(&target.display().to_string())
        );
        let wrote =
            crate::ssh::run_remote_with_input("host", &script, big.clone().into_bytes(), 20).await;
        let run = crate::ssh::run_remote(
            "host",
            &format!(
                "cat {}",
                crate::ssh::shell_quote(&target.display().to_string())
            ),
            20,
            "t",
        )
        .await;
        std::env::remove_var("PERCH_SSH");
        assert!(wrote.unwrap().status.success());
        assert_eq!(run.unwrap().len(), big.len());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_path_on_another_computer_is_quoted_and_must_be_absolute() {
        assert_eq!(
            remote_path("~/a b/it's").unwrap(),
            r#""$HOME"/'a b/it'\''s'"#
        );
        assert_eq!(
            remote_path("/etc/x; rm -rf /").unwrap(),
            "'/etc/x; rm -rf /'"
        );
        assert!(remote_path("relative/x").is_err());
    }

    /// A package's files reach the person's page by revision and exact path, with nosniff; an
    /// agent, a token in the URL, a dropped revision and mods-off get no bytes. A page that did
    /// not say it accepts `esm` is never shown the package, on `mods.list` or `mods.set`.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn package_files_are_the_persons_and_older_pages_never_see_packages() {
        use futures::{SinkExt, StreamExt};
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let root = std::env::temp_dir().join(format!("perch-mods-package-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let (address, db) = boot(&root).await;
        let app = super::super::booted_state(address);
        let (workspace, _) = lead_with_child(&db, &nest, crate::sub_sessions::SubState::Running);
        let agent = db
            .issue(&AgentKey::new(&workspace.id, "lead", "claude").unwrap())
            .unwrap()
            .token;
        let person = app.local_ui.token().to_string();
        let put = |id: &str, file: &str, text: &str| {
            let path = app.memory_root.join("mods").join(id).join(file);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(path, text).unwrap();
        };
        put("pkg", "mod.json", r#"{"format":"esm","api":"^1"}"#);
        put("pkg", "main.js", "export default 1");
        put("pkg", "art/dot.svg", "<svg/>");
        put("old", "main.js", "export default () => {}");
        let policy = app.settings.get().mods;
        let revision = mods::scan(&app.memory_root, &policy)
            .into_iter()
            .find(|m| m.id == "pkg")
            .unwrap()
            .revision;

        // (status, lowercased head, body) of a GET with these headers.
        let get = |path: String, auth: Option<String>| async move {
            let mut text = format!(
                "GET {path} HTTP/1.0\r\nHost: 127.0.0.1:{}\r\n",
                address.port()
            );
            if let Some(auth) = auth {
                text.push_str(&format!("Authorization: Bearer {auth}\r\n"));
            }
            text.push_str("\r\n");
            let mut stream = tokio::net::TcpStream::connect(address).await.unwrap();
            stream.write_all(text.as_bytes()).await.unwrap();
            let mut response = Vec::new();
            stream.read_to_end(&mut response).await.unwrap();
            let response = String::from_utf8_lossy(&response).into_owned();
            let (head, body) = response.split_once("\r\n\r\n").unwrap();
            let status: u16 = head.split_whitespace().nth(1).unwrap().parse().unwrap();
            (status, head.to_ascii_lowercase(), body.to_string())
        };
        let url = |rev: &str, path: &str| format!("/mods/package?id=pkg&rev={rev}&path={path}");

        let (status, head, body) = get(url(&revision, "main.js"), Some(person.clone())).await;
        assert_eq!((status, body.as_str()), (200, "export default 1"), "{head}");
        assert!(head.contains("content-type: text/javascript"), "{head}");
        assert!(head.contains("x-content-type-options: nosniff"), "{head}");
        let (status, head, _) = get(url(&revision, "art/dot.svg"), Some(person.clone())).await;
        assert_eq!(status, 200);
        assert!(head.contains("content-type: image/svg+xml") && head.contains("sandbox"));

        assert_eq!(get(url(&revision, "main.js"), Some(agent)).await.0, 403);
        assert_eq!(get(url(&revision, "main.js"), None).await.0, 401);
        let in_url = format!("{}&token={person}", url(&revision, "main.js"));
        assert_eq!(get(in_url, None).await.0, 400);
        assert_eq!(
            get(url("feed", "main.js"), Some(person.clone())).await.0,
            410
        );
        for bad in ["..%2fold%2fmain.js", "nope.js", "Main.js", "mod.json%00"] {
            assert_eq!(
                get(url(&revision, bad), Some(person.clone())).await.0,
                404,
                "{bad}"
            );
        }
        assert_eq!(
            get("/mods/file?id=pkg".into(), Some(person.clone()))
                .await
                .0,
            400
        );

        // An older page, then a newer one, on the same core.
        let (mut socket, _) = tokio_tungstenite::connect_async(
            crate::hub::socket_request(&format!("ws://{address}/ws"), Some(&person)).unwrap(),
        )
        .await
        .unwrap();
        let mut ask = async |message: Value| -> Vec<String> {
            socket
                .send(tokio_tungstenite::tungstenite::Message::Text(
                    message.to_string(),
                ))
                .await
                .unwrap();
            loop {
                let next = tokio::time::timeout(std::time::Duration::from_secs(10), socket.next())
                    .await
                    .unwrap()
                    .unwrap()
                    .unwrap();
                let tokio_tungstenite::tungstenite::Message::Text(text) = next else {
                    continue;
                };
                let value: Value = serde_json::from_str(&text).unwrap();
                if value["type"] == "mods.state" {
                    return value["mods"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .map(|m| m["id"].as_str().unwrap().to_string())
                        .collect();
                }
            }
        };
        let list = json!({"type": "mods.list", "requestId": "1"});
        let set = json!({"type": "mods.set", "requestId": "2", "id": "old", "op": "enable"});
        assert_eq!(ask(list.clone()).await, ["old"]);
        assert_eq!(ask(set.clone()).await, ["old"]);
        let newer = json!({"type": "mods.list", "requestId": "3", "accepts": ["esm"]});
        assert_eq!(ask(newer).await, ["old", "pkg"]);
        assert_eq!(ask(set.clone()).await, ["old", "pkg"]);
        assert_eq!(ask(list).await, ["old"]);
        assert_eq!(ask(set).await, ["old"]);

        // Mods off: no bytes for any revision.
        app.settings
            .update(crate::settings::SettingsPatch {
                mods: Some(mods::Policy { off: true }),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(get(url(&revision, "main.js"), Some(person)).await.0, 403);
        let _ = std::fs::remove_dir_all(&root);
    }

    /// The served web build's stock screens are listed as `stock:<id>` to a page that loads packages,
    /// whether mods are on or off, never to an older page, and `perch mod clone` / `mods.set clone`
    /// copy one into the mods folder under a new plain id.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn stock_screens_are_listed_from_the_web_build_and_clone_into_the_mods_folder() {
        let root = std::env::temp_dir().join(format!("perch-mods-stock-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let (address, _db) = boot(&root).await;
        let app = super::super::booted_state(address);
        let ids = |accepts: &[&str]| {
            let accepts: Vec<String> = accepts.iter().map(|a| a.to_string()).collect();
            match state_message(&app, "1".into(), None, &accepts) {
                ServerMessage::ModsState { mods, .. } => {
                    mods.into_iter().map(|m| m.id).collect::<Vec<_>>()
                }
                _ => unreachable!(),
            }
        };
        assert!(ids(&["esm"]).is_empty(), "no web build, no stock screens");
        let package = app.stock_ui_dir.join("demo");
        std::fs::create_dir_all(&package).unwrap();
        std::fs::write(
            package.join("mod.json"),
            r#"{"name":"Demo","format":"esm","api":"^1","version":"1.0.0","place":"layout"}"#,
        )
        .unwrap();
        std::fs::write(package.join("main.js"), "export default () => null;").unwrap();
        assert!(
            mods::stock(&app.stock_ui_dir).is_empty(),
            "no catalog, nothing listed"
        );
        // The catalog the exporter writes: a wrong revision is listed broken, the files' digest works.
        std::fs::write(
            app.stock_ui_dir.join("catalog.json"),
            r#"{"packages":[{"id":"demo","revision":"pending"}]}"#,
        )
        .unwrap();
        let drifted = mods::stock(&app.stock_ui_dir).remove(0);
        assert!(drifted.error.is_some());
        let digest = drifted.revision;
        std::fs::write(
            app.stock_ui_dir.join("catalog.json"),
            format!(r#"{{"packages":[{{"id":"demo","revision":"{digest}"}}]}}"#),
        )
        .unwrap();
        assert_eq!(ids(&["esm"]), ["stock:demo"]);
        assert!(ids(&[]).is_empty(), "an older page never sees a package");

        let made = agent_clone(&app, &json!({ "example": "stock:demo", "as": "my-demo" })).unwrap();
        assert_eq!(made["id"], "my-demo");
        assert_eq!(ids(&["esm"]), ["stock:demo", "my-demo"]);
        assert!(agent_clone(
            &app,
            &json!({ "example": "stock:demo", "as": "stock:demo" })
        )
        .is_err());
        let examples = agent_examples(&app);
        assert!(examples
            .as_array()
            .unwrap()
            .iter()
            .any(|e| e["id"] == "stock:demo" && e["kind"] == "stock"));

        // The clone replaces the stock screen wherever Perch shows it, for a page that can load it,
        // in every layout; the choice survives choosing a layout. Only a package that loads, and
        // only for a stock screen this build has.
        let uses = |accepts: &[&str]| {
            let accepts: Vec<String> = accepts.iter().map(|a| a.to_string()).collect();
            match state_message(&app, "1".into(), None, &accepts) {
                ServerMessage::ModsState { uses, .. } => uses,
                _ => unreachable!(),
            }
        };
        std::fs::create_dir_all(app.memory_root.join("mods/plain")).unwrap();
        std::fs::write(
            app.memory_root.join("mods/plain/main.js"),
            "export default () => {};",
        )
        .unwrap();
        for (body, status) in [
            (
                json!({"id": "stock:nope", "target": "my-demo"}),
                "no stock screen",
            ),
            (json!({"id": "stock:demo", "target": "nope"}), "no mod"),
            (
                json!({"id": "stock:demo", "target": "plain"}),
                "single-file",
            ),
            (
                json!({"id": "stock:demo", "target": "stock:demo2"}),
                "no mod",
            ),
        ] {
            let refused = agent_set_use(&app, &body).unwrap_err();
            assert!(
                format!("{refused:?}").contains(status),
                "{body}: {refused:?}"
            );
        }
        assert!(uses(&["esm"]).is_empty());
        agent_set_use(&app, &json!({"id": "stock:demo", "target": "my-demo"})).unwrap();
        let chosen =
            std::collections::BTreeMap::from([("stock:demo".to_string(), "my-demo".to_string())]);
        assert_eq!(uses(&["esm"]), chosen);
        assert!(
            uses(&[]).is_empty(),
            "an older page cannot load the clone, so it is not told to"
        );
        std::fs::create_dir_all(app.memory_root.join("layouts")).unwrap();
        std::fs::write(
            app.memory_root.join("layouts/solo.json"),
            r#"{"type":"block","content":"sidebar"}"#,
        )
        .unwrap();
        agent_set_layout(&app, &json!({"id": "solo"})).unwrap();
        assert_eq!(layouts::current(&app.memory_root).as_deref(), Some("solo"));
        assert_eq!(
            uses(&["esm"]),
            chosen,
            "choosing a layout keeps the replacement"
        );
        assert_eq!(agent_list(&app).unwrap()["uses"]["stock:demo"], "my-demo");

        // Mods off: stock is still listed, the clone is not, and nothing replaces stock.
        app.settings
            .update(crate::settings::SettingsPatch {
                mods: Some(mods::Policy { off: true }),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(ids(&["esm"]), ["stock:demo"]);
        assert!(uses(&["esm"]).is_empty());
        assert!(agent_set_use(&app, &json!({"id": "stock:demo", "target": "my-demo"})).is_err());
        app.settings
            .update(crate::settings::SettingsPatch {
                mods: Some(mods::Policy { off: false }),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(
            uses(&["esm"]),
            chosen,
            "turning mods back on brings the choice back"
        );
        agent_set_use(&app, &json!({"id": "stock:demo", "target": "stock"})).unwrap();
        assert!(uses(&["esm"]).is_empty());
        assert_eq!(layouts::current(&app.memory_root).as_deref(), Some("solo"));
        let _ = std::fs::remove_dir_all(&root);
    }

    /// A mod's data over `POST /mods/data`: the person's alone, kept outside the mod's folder (a clone
    /// starts with none and its source has no data file), keyed by revision, refused for a path in a
    /// key or id, for an unknown mod and (except stock's) while mods are off.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn mod_data_is_the_persons_lives_outside_the_package_and_a_clone_starts_without_it() {
        let root = std::env::temp_dir().join(format!("perch-mods-data-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let (address, db) = boot(&root).await;
        let app = super::super::booted_state(address);
        let (workspace, _) = lead_with_child(&db, &nest, crate::sub_sessions::SubState::Running);
        let agent = db
            .issue(&AgentKey::new(&workspace.id, "lead", "claude").unwrap())
            .unwrap()
            .token;
        let person = format!("Bearer {}", app.local_ui.token());
        let package = app.memory_root.join("mods/pkg");
        std::fs::create_dir_all(&package).unwrap();
        std::fs::write(package.join("mod.json"), r#"{"format":"esm","api":"^1"}"#).unwrap();
        std::fs::write(package.join("main.js"), "export default () => null;").unwrap();
        let stock = app.stock_ui_dir.join("demo");
        std::fs::create_dir_all(&stock).unwrap();
        std::fs::write(
            stock.join("mod.json"),
            r#"{"name":"Demo","format":"esm","api":"^1","version":"1.0.0","place":"layout"}"#,
        )
        .unwrap();
        std::fs::write(stock.join("main.js"), "export default () => null;").unwrap();
        std::fs::write(
            app.stock_ui_dir.join("catalog.json"),
            r#"{"packages":[{"id":"demo","revision":"pending"}]}"#,
        )
        .unwrap();
        let digest = mods::stock(&app.stock_ui_dir).remove(0).revision;
        std::fs::write(
            app.stock_ui_dir.join("catalog.json"),
            format!(r#"{{"packages":[{{"id":"demo","revision":"{digest}"}}]}}"#),
        )
        .unwrap();
        let post = |auth: String, body: Value| async move {
            let headers = [("Authorization", auth.as_str())];
            request(address, "POST", "/mods/data", &headers, &body.to_string()).await
        };

        let wrote = post(
            person.clone(),
            json!({"id": "pkg", "op": "write", "key": "notes", "value": {"n": 1}, "expected": null}),
        )
        .await;
        assert_eq!(wrote.0, 200, "{:?}", wrote.1);
        let revision = wrote.1["revision"].as_str().unwrap().to_string();
        let read = post(
            person.clone(),
            json!({"id": "pkg", "op": "read", "key": "notes"}),
        )
        .await;
        assert_eq!(
            read.1,
            json!({"exists": true, "value": {"n": 1}, "revision": revision})
        );
        let stale = post(
            person.clone(),
            json!({"id": "pkg", "op": "write", "key": "notes", "value": 2, "expected": "old"}),
        )
        .await;
        assert_eq!((stale.0, &stale.1["revision"]), (409, &json!(revision)));
        assert!(app.memory_root.join("mod-data/pkg/notes.json").is_file());
        assert!(!package.join("notes.json").exists());

        // A clone copies the source and none of the data.
        clone_any(&app, "pkg", Some("pkg-copy")).unwrap();
        let copied = post(person.clone(), json!({"id": "pkg-copy", "op": "list"})).await;
        assert_eq!(copied.1, json!({"keys": []}));
        let files: Vec<String> = std::fs::read_dir(app.memory_root.join("mods/pkg-copy"))
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert!(files.iter().all(|f| f != "notes.json"), "{files:?}");

        // The person's only: an agent token and no token get nothing.
        let as_agent = post(
            format!("Bearer {agent}"),
            json!({"id": "pkg", "op": "read", "key": "notes"}),
        )
        .await;
        assert_eq!(as_agent.0, 403);
        let bare = request(
            address,
            "POST",
            "/mods/data",
            &[],
            &json!({"id": "pkg", "op": "list"}).to_string(),
        )
        .await;
        assert_eq!(bare.0, 401);
        // Paths and unknown mods.
        for (body, status) in [
            (json!({"id": "../mods", "op": "list"}), 400),
            (
                json!({"id": "pkg", "op": "read", "key": "../pkg-copy/x"}),
                400,
            ),
            (
                json!({"id": "pkg", "op": "write", "key": "a/b", "value": 1}),
                400,
            ),
            (json!({"id": "nope", "op": "list"}), 404),
            (json!({"id": "stock:nope", "op": "list"}), 404),
            (json!({"id": "pkg", "op": "chmod"}), 400),
        ] {
            assert_eq!(post(person.clone(), body.clone()).await.0, status, "{body}");
        }
        // Mods off: a mod's data is refused; a stock screen's still works.
        app.settings
            .update(crate::settings::SettingsPatch {
                mods: Some(mods::Policy { off: true }),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(
            post(person.clone(), json!({"id": "pkg", "op": "list"}))
                .await
                .0,
            403
        );
        let stock_write = post(
            person.clone(),
            json!({"id": "stock:demo", "op": "write", "key": "seen", "value": true}),
        )
        .await;
        assert_eq!(stock_write.0, 200, "{:?}", stock_write.1);
        assert!(app
            .memory_root
            .join("mod-data/@stock-demo/seen.json")
            .is_file());
        let _ = std::fs::remove_dir_all(&root);
    }

    /// An agent lists, turns off and on, and opens a mod; opening reaches the person's screen only
    /// for an enabled one. A mod needs no approval: it is listed working the moment it is written.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn an_agent_lists_toggles_and_opens_a_mod_that_needed_no_approval() {
        let root = std::env::temp_dir().join(format!("perch-mods-http-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let (address, db) = boot(&root).await;
        let app = super::super::booted_state(address);
        let (workspace, _) = lead_with_child(&db, &nest, crate::sub_sessions::SubState::Running);
        let token = db
            .issue_in_current_run(&AgentKey::new(&workspace.id, "lead", "claude").unwrap())
            .unwrap()
            .token;
        let call = |route: &'static str, body: Value| {
            let token = token.clone();
            async move {
                let mut full = json!({"session": "lead"});
                full.as_object_mut()
                    .unwrap()
                    .extend(body.as_object().unwrap().clone());
                request(
                    address,
                    "POST",
                    &format!("/agent/mod/{route}"),
                    &[("Authorization", &format!("Bearer {token}"))],
                    &full.to_string(),
                )
                .await
            }
        };
        let (_, listed) = call("list", json!({})).await;
        let home = std::path::PathBuf::from(listed["folder"].as_str().unwrap());
        let folder = home.join("mods").join("board");
        std::fs::create_dir_all(&folder).unwrap();
        std::fs::write(folder.join("main.js"), "export default () => {}").unwrap();
        std::fs::create_dir_all(home.join("layouts")).unwrap();
        std::fs::write(
            home.join("layouts").join("solo.json"),
            r#"{"type":"block","content":"mod:board"}"#,
        )
        .unwrap();
        std::fs::write(home.join("layouts").join("bad.json"), "{").unwrap();
        let mut screen = app.hub.hub_events_tx.subscribe();

        let (_, listed) = call("list", json!({})).await;
        assert_eq!(listed["mods"][0]["id"], "board");
        assert_eq!(listed["mods"][0]["enabled"], true);
        assert_eq!(call("open", json!({"id": "board"})).await.0, 200);
        let shown = screen.try_recv().expect("the screen is told");
        assert!(matches!(&*shown, ServerMessage::ModsOpen { mod_id } if mod_id == "board"));

        // `check` answers from what the page reported for the mod's current revision only.
        let revision = listed["mods"][0]["revision"].as_str().unwrap().to_string();
        let report =
            |viewer: &str, instance: Option<&str>, phase: Option<&str>, error: Option<&str>| {
                app.mod_diagnostics.lock().unwrap().report(
                    viewer,
                    "board".into(),
                    revision.clone(),
                    instance.map(str::to_string),
                    phase.map(str::to_string),
                    error.map(str::to_string),
                );
            };
        app.mod_diagnostics.lock().unwrap().report(
            "desk",
            "board".into(),
            "older".into(),
            None,
            None,
            None,
        );
        assert_eq!(
            call("check", json!({"id": "board", "viewer": "desk"}))
                .await
                .1["status"],
            "not loaded",
            "another revision's success is not this one's"
        );
        report("desk", None, None, None);
        let (_, checked) = call("check", json!({"id": "board"})).await;
        assert_eq!(checked["status"], "ok");
        assert_eq!(checked["instances"][0]["viewer"], "desk");
        // A second viewer's copy fails in a callback: the mod is in error, with the phase, and the
        // first viewer's success does not hide it (no last-writer-wins either way).
        report(
            "phone",
            Some("layout:main/side"),
            Some("callback"),
            Some("x is not defined"),
        );
        report("phone", Some("layout:main/side"), Some("render"), None);
        let (_, checked) = call("check", json!({"id": "board"})).await;
        assert_eq!(
            (
                checked["status"].as_str(),
                checked["error"].as_str(),
                checked["phase"].as_str()
            ),
            (Some("error"), Some("x is not defined"), Some("callback"))
        );
        assert_eq!(checked["instances"].as_array().unwrap().len(), 2);
        // Scoped to the first viewer, it is fine; to the second, it is not.
        assert_eq!(
            call("check", json!({"id": "board", "viewer": "desk"}))
                .await
                .1["status"],
            "ok"
        );
        assert_eq!(
            call(
                "check",
                json!({"id": "board", "instance": "layout:main/side"})
            )
            .await
            .1["status"],
            "error"
        );
        // A swap past its wait is a warning on an instance that rendered, not a failure.
        report(
            "desk",
            Some("pane:t1"),
            Some("swap"),
            Some("shown while 1 tracked operation was pending"),
        );
        report("desk", Some("pane:t1"), Some("render"), None);
        let (_, checked) = call("check", json!({"id": "board", "instance": "pane:t1"})).await;
        assert_eq!(checked["status"], "ok");
        assert!(checked["instances"][0]["warning"]
            .as_str()
            .unwrap()
            .contains("pending"));
        // A closed connection's reports go with it.
        app.mod_diagnostics.lock().unwrap().drop_viewer("phone");
        assert_eq!(
            call("check", json!({"id": "board"})).await.1["status"],
            "ok"
        );
        assert_eq!(call("check", json!({"id": "nope"})).await.0, 404);
        assert_eq!(
            call("check", json!({"id": "board", "viewer": 3})).await.0,
            400
        );

        // `dom` asks the screens and returns the first answer.
        let mut asked = app.hub.hub_events_tx.subscribe();
        let window = app.clone();
        let answering = tokio::spawn(async move {
            while let Ok(message) = asked.recv().await {
                if let ServerMessage::ModsSnapshotRequest {
                    request_id, mod_id, ..
                } = &*message
                {
                    assert_eq!(mod_id, "board");
                    assert!(window.mod_diagnostics.lock().unwrap().answer(
                        "desk",
                        request_id,
                        None,
                        ("<p>hi</p>".into(), "hi".into(), None)
                    ));
                    break;
                }
            }
        });
        let (_, dom) = call("dom", json!({"id": "board"})).await;
        answering.await.unwrap();
        assert_eq!(
            (
                dom["status"].as_str(),
                dom["html"].as_str(),
                dom["text"].as_str()
            ),
            (Some("ok"), Some("<p>hi</p>"), Some("hi"))
        );
        assert_eq!(call("dom", json!({"id": "nope"})).await.0, 400);

        // `do` sends the command and args to the screens and returns the first answer, parsed.
        let mut asked = app.hub.hub_events_tx.subscribe();
        let window = app.clone();
        let answering = tokio::spawn(async move {
            while let Ok(message) = asked.recv().await {
                if let ServerMessage::ModsSnapshotRequest {
                    request_id,
                    command,
                    args,
                    ..
                } = &*message
                {
                    assert_eq!(command.as_deref(), Some("session.open"));
                    assert_eq!(args.as_ref().unwrap()["session"], "s1");
                    assert!(window.mod_diagnostics.lock().unwrap().answer(
                        "desk",
                        request_id,
                        None,
                        (String::new(), "[{\"id\":\"a\"}]".into(), None),
                    ));
                    break;
                }
            }
        });
        let (_, done) = call(
            "do",
            json!({"command": "session.open", "args": {"session": "s1"}}),
        )
        .await;
        answering.await.unwrap();
        assert_eq!(
            (done["status"].as_str(), done["result"][0]["id"].as_str()),
            (Some("ok"), Some("a"))
        );
        assert_eq!(call("do", json!({"command": ""})).await.0, 400);
        while screen.try_recv().is_ok() {} // the request was also broadcast to this listener

        assert_eq!(
            call("enable", json!({"id": "board", "enabled": false}))
                .await
                .0,
            200
        );
        assert_eq!(call("open", json!({"id": "board"})).await.0, 400);
        assert!(screen.try_recv().is_err());
        assert_eq!(
            call("enable", json!({"id": "nope", "enabled": false}))
                .await
                .0,
            404
        );

        // A layout is chosen only if it parses; `stock` goes back to Perch as shipped.
        assert_eq!(call("layout", json!({"id": "bad"})).await.0, 400);
        assert_eq!(call("layout", json!({"id": "solo"})).await.0, 200);
        let (_, listed) = call("list", json!({})).await;
        assert_eq!(listed["layout"], "solo");
        assert_eq!(listed["layouts"].as_array().unwrap().len(), 2);
        assert_eq!(call("layout", json!({"id": "stock"})).await.0, 200);
        assert_eq!(call("list", json!({})).await.1["layout"], Value::Null);

        // What a mod may do on this computer is the person's alone: an agent's token is refused,
        // the person's works, and nothing runs while mods are off.
        let person = format!("Bearer {}", app.local_ui.token());
        let host = |route: &'static str, auth: String, body: Value| async move {
            request(
                address,
                "POST",
                route,
                &[("Authorization", &auth)],
                &body.to_string(),
            )
            .await
        };
        let file = root.join("note.txt");
        let path = file.display().to_string();
        let agent = format!("Bearer {token}");
        assert_eq!(
            host(
                "/mods/fs",
                agent.clone(),
                json!({"op": "read", "path": path})
            )
            .await
            .0,
            403
        );
        // An agent runs a program only on a listed host (`perch exec --on`), never on this computer,
        // and its own token is what opens that route.
        for body in [
            json!({"session": "lead", "cmd": "echo"}),
            json!({"session": "lead", "host": "nope", "cmd": "echo"}),
            json!({"session": "lead", "host": "nope"}),
        ] {
            assert_eq!(host("/agent/exec", agent.clone(), body).await.0, 400);
        }
        // On a listed host the program runs and its output and exit code come back: a stand-in `ssh`
        // runs the remote command line here (the same helper the file tests use).
        let shim_dir = root.join("shim");
        std::fs::create_dir_all(&shim_dir).unwrap();
        let shim = shim_dir.join("ssh");
        std::fs::write(
            &shim,
            "#!/bin/sh\nwhile [ \"$1\" = -o ]; do shift 2; done\nshift\nexec sh -c \"$1\"\n",
        )
        .unwrap();
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&shim, std::fs::Permissions::from_mode(0o755)).unwrap();
        std::env::set_var("PERCH_SSH", &shim);
        app.hosts
            .upsert(crate::hosts::SshHost {
                id: "box".into(),
                name: "box".into(),
                ssh_host: "box".into(),
                ..Default::default()
            })
            .unwrap();
        let ran = host(
            "/agent/exec",
            agent.clone(),
            json!({"session": "lead", "host": "box", "cmd": "sh", "args": ["-c", "echo \"$1\"; echo oops >&2; exit 3", "x", "a b"], "cwd": "/tmp"}),
        )
        .await;
        std::env::remove_var("PERCH_SSH");
        assert_eq!(ran.0, 200, "{:?}", ran.1);
        assert_eq!(
            (
                ran.1["code"].as_i64(),
                ran.1["stdout"].as_str(),
                ran.1["stderr"].as_str()
            ),
            (Some(3), Some("a b\n"), Some("oops\n"))
        );
        assert_eq!(
            host(
                "/agent/exec",
                person.clone(),
                json!({"session": "lead", "host": "nope", "cmd": "echo"})
            )
            .await
            .0,
            401
        );
        assert_eq!(
            host("/mods/exec", agent, json!({"cmd": "echo"})).await.0,
            403
        );
        assert_eq!(
            host(
                "/mods/fs",
                person.clone(),
                json!({"op": "write", "path": path, "text": "hi"})
            )
            .await
            .0,
            200
        );
        assert_eq!(
            host(
                "/mods/fs",
                person.clone(),
                json!({"op": "read", "path": path})
            )
            .await
            .1["text"],
            "hi"
        );
        assert_eq!(
            host(
                "/mods/fs",
                person.clone(),
                json!({"op": "stat", "path": path})
            )
            .await
            .1["size"],
            2
        );
        assert_eq!(
            host(
                "/mods/fs",
                person.clone(),
                json!({"op": "read", "path": "relative.txt"})
            )
            .await
            .0,
            400
        );
        let echoed = host(
            "/mods/exec",
            person.clone(),
            json!({"cmd": "echo", "args": ["a", "b"]}),
        )
        .await
        .1;
        assert_eq!(
            (echoed["code"].as_i64(), echoed["stdout"].as_str()),
            (Some(0), Some("a b\n"))
        );
        assert_eq!(
            host(
                "/mods/exec",
                person.clone(),
                json!({"cmd": "sleep", "args": ["5"], "timeout": 100})
            )
            .await
            .0,
            408
        );
        assert_eq!(
            host("/mods/exec", person, json!({"cmd": "no-such-program-here"}))
                .await
                .0,
            400
        );
        let _ = std::fs::remove_dir_all(&root);
    }
}

#[cfg(test)]
mod diagnostics_tests {
    use super::{ModDiagnostics, MAX_ASKED, MAX_REPORTS};

    /// A request for one viewer or one copy takes no other viewer's or copy's answer, an answer
    /// for no waiting request is dropped, and only the first accepted answer counts.
    #[test]
    fn a_targeted_request_is_answered_only_by_its_viewer_and_copy() {
        let mut d = ModDiagnostics::default();
        let answer = |text: &str| (String::new(), text.to_string(), None);
        assert!(!d.answer("desk", "never-asked", None, answer("x")));
        d.ask("r1", Some("desk".into()), Some("pane:t1".into()));
        assert!(!d.answer("phone", "r1", Some("pane:t1".into()), answer("phone")));
        assert!(!d.answer("desk", "r1", None, answer("an older page")));
        assert!(!d.answer("desk", "r1", Some("pane:t2".into()), answer("another copy")));
        assert_eq!(d.take("r1"), None, "nothing accepted yet");
        assert!(d.answer("desk", "r1", Some("pane:t1".into()), answer("desk")));
        assert!(!d.answer("desk", "r1", Some("pane:t1".into()), answer("again")));
        assert_eq!(d.take("r1").unwrap().1, "desk");
        assert_eq!(d.take("r1"), None, "taken once");
        // Untargeted: any connection, first answer wins.
        d.ask("r2", None, None);
        assert!(d.answer("phone", "r2", None, answer("phone")));
        assert_eq!(d.take("r2").unwrap().1, "phone");
    }

    /// Past the caps the oldest entry goes and the newest is always kept: a full table never
    /// silences a new report or request.
    #[test]
    fn full_tables_evict_their_oldest_entry_and_take_the_new_one() {
        let mut d = ModDiagnostics::default();
        for n in 0..MAX_REPORTS + 10 {
            d.report("v", format!("m{n}"), "r".into(), None, None, None);
        }
        assert_eq!(d.reports.len(), MAX_REPORTS);
        assert!(
            d.copies("m0", "r", None, None).is_empty(),
            "the oldest went"
        );
        let newest = format!("m{}", MAX_REPORTS + 9);
        assert_eq!(d.copies(&newest, "r", None, None)[0]["status"], "ok");
        // Reporting again refreshes an entry, so it is not the next to go.
        d.report("v", "m10".into(), "r".into(), None, None, None);
        d.report("v", "fresh".into(), "r".into(), None, None, None);
        assert!(d.copies("m11", "r", None, None).is_empty());
        assert_eq!(d.copies("m10", "r", None, None).len(), 1);

        for n in 0..MAX_ASKED + 3 {
            d.ask(&format!("q{n}"), None, None);
        }
        assert_eq!(d.requests.len(), MAX_ASKED);
        let last = format!("q{}", MAX_ASKED + 2);
        assert!(d.answer("v", &last, None, (String::new(), "late".into(), None)));
        assert!(!d.answer("v", "q0", None, (String::new(), "evicted".into(), None)));
    }

    /// The first failure at a revision is the one kept, and an unknown phase counts as a load.
    #[test]
    fn a_copy_keeps_its_first_failure_and_its_phase() {
        let mut d = ModDiagnostics::default();
        let report = |d: &mut ModDiagnostics, phase: Option<&str>, error: Option<&str>| {
            d.report(
                "v",
                "m".into(),
                "r".into(),
                Some("i".into()),
                phase.map(str::to_string),
                error.map(str::to_string),
            )
        };
        report(&mut d, Some("render"), Some("first"));
        report(&mut d, Some("disposal"), Some("second"));
        report(&mut d, Some("render"), None);
        let copy = &d.copies("m", "r", None, Some("i"))[0];
        assert_eq!(
            (
                copy["status"].as_str(),
                copy["phase"].as_str(),
                copy["error"].as_str()
            ),
            (Some("error"), Some("render"), Some("first"))
        );
        report(&mut d, Some("bogus"), Some("x"));
        d.report(
            "v",
            "n".into(),
            "r".into(),
            None,
            Some("bogus".into()),
            Some("y".into()),
        );
        assert_eq!(d.copies("n", "r", None, None)[0]["phase"], "load");
    }
}

#[cfg(test)]
mod program_path_tests {
    use super::program_path_with;
    use std::path::PathBuf;

    #[test]
    fn only_perch_resolves_to_the_shipped_cli() {
        let cli = Some(PathBuf::from("/app/perch"));
        assert_eq!(
            program_path_with("perch", cli.clone()),
            PathBuf::from("/app/perch")
        );
        assert_eq!(program_path_with("git", cli), PathBuf::from("git"));
        assert_eq!(program_path_with("perch", None), PathBuf::from("perch"));
    }
}
