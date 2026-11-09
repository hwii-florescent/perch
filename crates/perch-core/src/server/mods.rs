//! Mods on this core (`crate::mods` holds the rules and the files): `perch mod` (`/agent/mod/*`) lists,
//! turns one off or on and asks the person's screen to show one; the person's own screen does the
//! same over `mods.list`/`mods.set`, and loads a mod's code from `GET /mods/file`. There is no
//! approval: a mod is trusted code the person's page runs, so the code route is the person's alone
//! (an agent token cannot fetch it) and everything else here is list, off/on and show.
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
        "off": policy.is_off(),
        "folder": app.memory_root.display().to_string(),
    }))
}

/// `perch mod examples`: the mods and layouts that ship inside Perch to copy.
pub(super) fn agent_examples() -> Value {
    json!(mods::EXAMPLES
        .iter()
        .map(|e| json!({ "id": e.id, "kind": if e.layout { "layout" } else { "mod" }, "about": e.about }))
        .collect::<Vec<_>>())
}

/// `perch mod clone <example> [id]`: copy an example into the mods or layouts folder.
pub(super) fn agent_clone(app: &AppState, body: &Value) -> Result<Value, Failure> {
    let example = body["example"]
        .as_str()
        .filter(|text| !text.is_empty())
        .ok_or_else(|| fail(StatusCode::BAD_REQUEST, "name an example to clone"))?;
    let id = mods::clone_example(
        &app.memory_root,
        example,
        body["as"].as_str().filter(|text| !text.is_empty()),
    )
    .map_err(failure)?;
    Ok(json!({ "id": id }))
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

/// `perch mod layout <id|stock>`: choose the window layout; `stock` (or an empty id) is Perch as shipped.
pub(super) fn agent_set_layout(app: &AppState, body: &Value) -> Result<Value, Failure> {
    let id = body["id"]
        .as_str()
        .filter(|id| !id.is_empty() && *id != "stock");
    let policy = app.settings.get().mods;
    layouts::set_current(&app.memory_root, &policy, id).map_err(failure)?;
    Ok(json!({ "layout": id }))
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

/// The person's page reports how loading a mod went; `perch mod check` waits for the current revision.
pub(super) fn handle_report(
    state: &Arc<ConnState>,
    id: String,
    revision: String,
    error: Option<String>,
) {
    let mut reports = state.app.mod_reports.lock().unwrap();
    if reports.len() < 256 || reports.contains_key(&id) {
        reports.insert(id, (revision, error));
    }
}

/// The page's answer to a snapshot request.
pub(super) fn handle_snapshot(
    state: &Arc<ConnState>,
    request_id: String,
    html: String,
    text: String,
    error: Option<String>,
) {
    let mut snapshots = state.app.mod_snapshots.lock().unwrap();
    if snapshots.len() < 16 {
        snapshots.insert(request_id, (html, text, error));
    }
}

/// `perch mod dom <id|app>`: ask the person's screen for what a mod (or the whole page) drew, as
/// HTML and text, to see a result without a screenshot. The first screen to answer wins.
pub(super) async fn agent_dom(app: &AppState, body: &Value) -> Result<Value, Failure> {
    let id = id_of(body)?;
    if id != "app" {
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
    }
    let request_id = Uuid::new_v4().to_string();
    let _ = app
        .hub
        .hub_events_tx
        .send(Arc::new(ServerMessage::ModsSnapshotRequest {
            request_id: request_id.clone(),
            mod_id: id.to_string(),
            command: None,
            args: None,
        }));
    for _ in 0..20 {
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        if let Some((html, text, error)) = app.mod_snapshots.lock().unwrap().remove(&request_id) {
            return Ok(match error {
                Some(error) => json!({ "status": "error", "error": error }),
                None => json!({ "status": "ok", "html": html, "text": text }),
            });
        }
    }
    Ok(
        json!({ "status": "not loaded", "error": "no Perch window answered within 5 seconds (is one open?)" }),
    )
}

/// `perch mod do <command> [json]` and `perch mod commands`: runs an app command on the person's
/// screen (what a key or a mod's `api.run` does), or with `list` returns the commands. The first
/// screen to answer wins; a command nobody recognises answers `error`.
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
    if app.settings.get().mods.is_off() {
        return Err(fail(StatusCode::BAD_REQUEST, "mods are off"));
    }
    let request_id = Uuid::new_v4().to_string();
    let _ = app
        .hub
        .hub_events_tx
        .send(Arc::new(ServerMessage::ModsSnapshotRequest {
            request_id: request_id.clone(),
            mod_id: String::new(),
            command: Some(command.to_string()),
            args: body.get("args").filter(|a| !a.is_null()).cloned(),
        }));
    // A picture (`shot`) takes a moment to draw.
    for _ in 0..40 {
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        if let Some((_, text, error)) = app.mod_snapshots.lock().unwrap().remove(&request_id) {
            return Ok(match error {
                Some(error) => json!({ "status": "error", "error": error }),
                None => {
                    json!({ "status": "ok", "result": serde_json::from_str::<Value>(&text).unwrap_or(Value::String(text)) })
                }
            });
        }
    }
    Ok(
        json!({ "status": "not loaded", "error": "no Perch window answered within 5 seconds (is one open?)" }),
    )
}

/// `perch mod check <id>`: `ok` once the person's screen has loaded the mod's current files, `error`
/// with why when it threw, `off` for a disabled mod, and `not loaded` when no screen reported within
/// a few seconds (no window open). A mod that draws badly without throwing still needs a look.
pub(super) async fn agent_check(app: &AppState, body: &Value) -> Result<Value, Failure> {
    let id = id_of(body)?;
    for _ in 0..30 {
        let policy = app.settings.get().mods;
        let Some(info) = mods::scan(&app.memory_root, &policy)
            .into_iter()
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
        let report = app.mod_reports.lock().unwrap().get(id).cloned();
        if let Some((_, error)) = report.filter(|(revision, _)| *revision == info.revision) {
            return Ok(match error {
                Some(error) => json!({ "status": "error", "error": error }),
                None => json!({ "status": "ok" }),
            });
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

fn state_message(app: &AppState, request_id: String, error: Option<String>) -> ServerMessage {
    let policy = app.settings.get().mods;
    let files = mods::scan_user_files(&app.memory_root, &policy);
    ServerMessage::ModsState {
        request_id,
        mods: mods::scan(&app.memory_root, &policy),
        layouts: layouts::scan(&app.memory_root, &policy),
        layout: layouts::current(&app.memory_root),
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

pub(super) fn handle_list(state: &Arc<ConnState>, request_id: String) {
    let _ = state
        .out_tx
        .send(state_message(&state.app, request_id, None));
}

/// A person's click: turn one mod off or on.
pub(super) fn handle_set(
    state: &Arc<ConnState>,
    request_id: String,
    id: String,
    op: String,
    as_id: Option<String>,
) {
    let app = &state.app;
    let policy = app.settings.get().mods;
    let outcome = match op.as_str() {
        "enable" => mods::set_enabled(&app.memory_root, &policy, &id, true),
        "disable" => mods::set_enabled(&app.memory_root, &policy, &id, false),
        "layout" => layouts::set_current(
            &app.memory_root,
            &policy,
            Some(id.as_str()).filter(|id| !id.is_empty()),
        ),
        "clone" => mods::clone_example(
            &app.memory_root,
            &id,
            as_id.as_deref().filter(|n| !n.is_empty()),
        )
        .map(drop),
        "remove-mod" => mods::remove(&app.memory_root, &id, Some("mod")).map(drop),
        "remove-layout" => mods::remove(&app.memory_root, &id, Some("layout")).map(drop),
        _ => Err(Error::Invalid(
            "ops are enable, disable, layout, clone, remove-mod and remove-layout".into(),
        )),
    };
    let error = outcome.err().map(|error| error.to_string());
    let _ = state.out_tx.send(state_message(app, request_id, error));
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
            .issue(&AgentKey::new(&workspace.id, "lead", "claude").unwrap())
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
        let report = |revision: &str, error: Option<&str>| {
            app.mod_reports
                .lock()
                .unwrap()
                .insert("board".into(), (revision.into(), error.map(str::to_string)));
        };
        report(&revision, None);
        assert_eq!(
            call("check", json!({"id": "board"})).await.1["status"],
            "ok"
        );
        report(&revision, Some("x is not defined"));
        let (_, checked) = call("check", json!({"id": "board"})).await;
        assert_eq!(checked["status"], "error");
        assert_eq!(checked["error"], "x is not defined");
        assert_eq!(call("check", json!({"id": "nope"})).await.0, 404);

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
                    window
                        .mod_snapshots
                        .lock()
                        .unwrap()
                        .insert(request_id.clone(), ("<p>hi</p>".into(), "hi".into(), None));
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
                    window.mod_snapshots.lock().unwrap().insert(
                        request_id.clone(),
                        (String::new(), "[{\"id\":\"a\"}]".into(), None),
                    );
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
