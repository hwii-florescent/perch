//! The native Codex TUI and Perch join one private native app-server.
use super::*;
use crate::protocol::{NativeUiMessage, NativeUiTool};
use futures::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tokio_tungstenite::{
    tungstenite::{protocol::WebSocketConfig, Message},
    WebSocketStream,
};

// Both children inherit the provider's actual environment. No model, auth,
// approval, or instruction settings are replaced by this launcher.
pub(super) const LAUNCHER: &str = r#"#!/bin/sh
umask 077
perch_codex_executable=$1
perch_codex_endpoint=$2
perch_codex_pid_file=$3
shift 3
"$perch_codex_executable" app-server --listen "$perch_codex_endpoint" >/dev/null 2>&1 &
perch_codex_server=$!
printf '%s\n' "$perch_codex_server" > "$perch_codex_pid_file"
perch_codex_cleanup() {
  if [ -n "$perch_codex_tui" ]; then
    kill "$perch_codex_tui" 2>/dev/null
  fi
  kill "$perch_codex_server" 2>/dev/null
  wait "$perch_codex_server" 2>/dev/null
  rm -f -- "$perch_codex_pid_file"
}
trap perch_codex_cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
perch_codex_attempt=0
while [ ! -S "${perch_codex_endpoint#unix://}" ]; do
  if ! kill -0 "$perch_codex_server" 2>/dev/null || [ "$perch_codex_attempt" -ge 200 ]; then
    printf '%s\n' 'Codex native server could not start. Restart the CLI to retry.' >&2
    exit 1
  fi
  perch_codex_attempt=$((perch_codex_attempt + 1))
  sleep 0.05
done
# Waiting on an asynchronous child lets the shell handle tmux's SIGHUP
# immediately, including while a native turn is still running.
"$perch_codex_executable" --remote "$perch_codex_endpoint" "$@" <&0 &
perch_codex_tui=$!
wait "$perch_codex_tui"
"#;

pub fn launch(key: &AgentKey, command: Vec<String>) -> anyhow::Result<Vec<String>> {
    ensure!(!command.is_empty(), "missing Codex executable");
    let paths = paths(key)?;
    let mut wrapped = vec![
        "/bin/sh".into(),
        paths.extension.to_string_lossy().into_owned(),
        command[0].clone(),
        format!("unix://{}", paths.socket.display()),
        paths
            .extension
            .with_extension("pid")
            .to_string_lossy()
            .into_owned(),
    ];
    wrapped.extend(command.into_iter().skip(1));
    Ok(wrapped)
}

fn message(id: &str, role: &str) -> NativeUiMessage {
    NativeUiMessage {
        id: clip(id, 256),
        role: role.into(),
        text: String::new(),
        thinking: String::new(),
        tools: vec![],
        tool_name: None,
        model: None,
        error: None,
    }
}
fn content(value: &Value) -> String {
    if let Some(text) = value.as_str() {
        return clip(text, 16 * 1024);
    }
    let mut text = String::new();
    for block in value.as_array().into_iter().flatten() {
        let part = match block["type"].as_str().unwrap_or_default() {
            "text" | "input_text" | "output_text" | "inputText" => {
                block["text"].as_str().unwrap_or_default()
            }
            "image" | "localImage" | "input_image" | "inputImage" => "[attachment in CLI]",
            _ => "",
        };
        text.push_str(&clip(part, (16 * 1024usize).saturating_sub(text.len())));
    }
    text
}
fn normalize(item: &Value) -> Vec<NativeUiMessage> {
    let Some(id) = item["id"].as_str() else {
        return vec![];
    };
    let mut row = message(id, "assistant");
    let mut result = vec![];
    match item["type"].as_str().unwrap_or_default() {
        "userMessage" => {
            row.role = "user".into();
            row.text = content(&item["content"]);
        }
        "agentMessage" | "plan" => row.text = content(&item["text"]),
        "reasoning" => {
            row.thinking = clip(
                &item["summary"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(Value::as_str)
                    .collect::<Vec<_>>()
                    .join("\n"),
                8 * 1024,
            )
        }
        "commandExecution" | "fileChange" | "mcpToolCall" | "dynamicToolCall" => {
            let (name, input) = match item["type"].as_str().unwrap_or_default() {
                "commandExecution" => (
                    "shell",
                    item["command"].as_str().unwrap_or_default().to_string(),
                ),
                "fileChange" => ("file changes", item["changes"].to_string()),
                _ => (
                    item["tool"].as_str().unwrap_or("Tool"),
                    item["arguments"].to_string(),
                ),
            };
            row.tools.push(NativeUiTool {
                name: clip(name, 128),
                input: clip(&input, 8 * 1024),
            });
            let output = if item["type"] == "commandExecution" {
                content(&item["aggregatedOutput"])
            } else if item["type"] == "dynamicToolCall" {
                content(&item["contentItems"])
            } else {
                content(&item["result"]["content"])
            };
            if !output.is_empty() {
                let mut tool = message(&format!("{id}:output"), "toolResult");
                tool.text = output;
                tool.tool_name = Some(clip(name, 128));
                result.push(tool);
            }
            if matches!(item["status"].as_str(), Some("failed" | "declined")) {
                row.error = Some("Tool did not complete successfully".into());
            }
        }
        "functionCallOutput" => {
            row.role = "toolResult".into();
            row.tool_name = item["name"].as_str().map(|name| clip(name, 128));
            row.text = content(&item["output"]);
        }
        _ => return vec![], // Native instructions, hooks, signatures and media are not chat.
    }
    if !row.text.is_empty() || !row.thinking.is_empty() || !row.tools.is_empty() {
        result.insert(0, row);
    }
    result
}

/// An active thread paused on an approval or a `request_user_input` answer
/// (app-server `ThreadStatus::Active { activeFlags }`).
fn waiting_on_human(status: &Value) -> bool {
    status["type"] == "active"
        && status["activeFlags"].as_array().is_some_and(|flags| {
            flags
                .iter()
                .any(|flag| flag == "waitingOnApproval" || flag == "waitingOnUserInput")
        })
}

struct View {
    snapshot: NativeUiSnapshot,
    message_bytes: usize,
    turn: Option<String>,
    next_thread: Option<String>,
    dirty: bool,
}
impl View {
    fn turn_error(&mut self, turn: &Value) {
        if let Some(error) = turn["error"]["message"].as_str() {
            let mut row = message(
                &format!("{}:error", turn["id"].as_str().unwrap_or_default()),
                "assistant",
            );
            row.error = Some(clip(error, 4096));
            self.put(row);
        }
    }
    fn put(&mut self, message: NativeUiMessage) {
        // ponytail: at most 128 entries; a linear lookup keeps this bounded
        // view small. Index by native item ID if the history ceiling grows.
        self.message_bytes += serde_json::to_vec(&message).map_or(0, |bytes| bytes.len());
        if let Some(old) = self
            .snapshot
            .messages
            .iter_mut()
            .find(|old| old.id == message.id)
        {
            self.message_bytes -= serde_json::to_vec(old).map_or(0, |bytes| bytes.len());
            *old = message;
        } else {
            self.snapshot.messages.push(message);
        }
        while self.snapshot.messages.len() > 128 || self.message_bytes > 192 * 1024 {
            let removed = self.snapshot.messages.remove(0);
            self.message_bytes -= serde_json::to_vec(&removed).map_or(0, |bytes| bytes.len());
            self.snapshot.truncated = true;
        }
        self.dirty = true;
    }
    fn event(&mut self, event: &Value) {
        let method = event["method"].as_str().unwrap_or_default();
        let params = &event["params"];
        if method == "thread/started" && primary(&params["thread"]) {
            if let Some(id) = params["thread"]["id"]
                .as_str()
                .filter(|id| *id != self.snapshot.provider_session_id)
            {
                self.next_thread = Some(id.into());
            }
        }
        if params["threadId"] != self.snapshot.provider_session_id {
            return;
        }
        match method {
            "turn/started" => {
                self.turn = params["turn"]["id"].as_str().map(str::to_string);
                self.snapshot.running = true;
                self.snapshot.blocked = false;
                self.dirty = true;
            }
            "turn/completed" => {
                self.turn_error(&params["turn"]);
                if self.turn.as_deref() == params["turn"]["id"].as_str() {
                    self.turn = None;
                    self.snapshot.running = false;
                    self.snapshot.blocked = false;
                    self.dirty = true;
                }
            }
            "thread/status/changed" => {
                self.snapshot.running = params["status"]["type"] == "active";
                self.snapshot.blocked = waiting_on_human(&params["status"]);
                self.dirty = true;
            }
            "thread/settings/updated" => {
                self.snapshot.model = params["threadSettings"]["model"]
                    .as_str()
                    .map(|model| clip(model, 256));
                self.dirty = true;
            }
            "item/started" | "item/completed" => {
                for message in normalize(&params["item"]) {
                    self.put(message);
                }
            }
            "item/agentMessage/delta"
            | "item/reasoning/summaryTextDelta"
            | "item/commandExecution/outputDelta" => {
                let Some(id) = params["itemId"].as_str() else {
                    return;
                };
                let output = method == "item/commandExecution/outputDelta";
                let id = if output {
                    format!("{id}:output")
                } else {
                    id.into()
                };
                let mut row = self
                    .snapshot
                    .messages
                    .iter()
                    .find(|row| row.id == id)
                    .cloned()
                    .unwrap_or_else(|| {
                        message(&id, if output { "toolResult" } else { "assistant" })
                    });
                let (field, bound) = if method == "item/reasoning/summaryTextDelta" {
                    (&mut row.thinking, 8 * 1024usize)
                } else {
                    (&mut row.text, 16 * 1024usize)
                };
                field.push_str(&clip(
                    params["delta"].as_str().unwrap_or_default(),
                    bound.saturating_sub(field.len()),
                ));
                self.put(row);
            }
            _ => {}
        }
    }
}
fn primary(thread: &Value) -> bool {
    thread["ephemeral"] == false
        && thread["parentThreadId"].is_null()
        && thread["threadSource"] != "system"
        && thread["id"]
            .as_str()
            .is_some_and(|id| uuid::Uuid::parse_str(id).is_ok())
}

type Peer = WebSocketStream<UnixStream>;
async fn request(
    peer: &mut Peer,
    view: &mut View,
    id: u64,
    method: &str,
    params: Value,
) -> anyhow::Result<Value> {
    tokio::time::timeout(
        Duration::from_secs(2),
        peer.send(Message::Text(
            json!({"id": id, "method": method, "params": params}).to_string(),
        )),
    )
    .await??;
    tokio::time::timeout(Duration::from_secs(15), async {
        while let Some(frame) = peer.next().await {
            let frame = frame?;
            if frame.is_close() {
                break;
            }
            if !frame.is_text() {
                continue;
            }
            let value: Value = serde_json::from_str(frame.to_text()?)?;
            if value["id"] == id && value["method"].is_null() {
                if !value["error"].is_null() {
                    bail!(
                        "{}",
                        clip(
                            value["error"]["message"]
                                .as_str()
                                .unwrap_or("Codex rejected this action"),
                            4096
                        )
                    );
                }
                return Ok(value["result"].clone());
            }
            view.event(&value);
        }
        bail!("Codex native connection closed; delivery is unconfirmed")
    })
    .await?
}

async fn connection(
    key: &AgentKey,
    continuation: &mut Option<String>,
    alive: &Arc<dyn Fn() -> bool + Send + Sync>,
    on_snapshot: &Arc<dyn Fn(NativeUiSnapshot) + Send + Sync>,
    snapshots: &watch::Sender<Option<NativeUiSnapshot>>,
    commands: &mut mpsc::Receiver<super::Command>,
) -> anyhow::Result<()> {
    let paths = paths(key)?;
    let pid_path = paths.extension.with_extension("pid");
    let pid_metadata = std::fs::metadata(&pid_path)?;
    ensure!(
        pid_metadata.is_file() && pid_metadata.len() <= 32,
        "invalid native Codex PID file"
    );
    let pid: u32 = std::fs::read_to_string(pid_path)?.trim().parse()?;
    ensure!(pid > 0, "invalid native Codex PID");
    let stream = UnixStream::connect(&paths.socket).await?;
    // No compression negotiation: the native Unix listener rejects it.
    let (mut peer, _) = tokio::time::timeout(
        Duration::from_secs(5),
        tokio_tungstenite::client_async_with_config(
            "ws://localhost/",
            stream,
            Some(WebSocketConfig {
                max_message_size: Some(2 * 1024 * 1024),
                max_frame_size: Some(2 * 1024 * 1024),
                ..Default::default()
            }),
        ),
    )
    .await??;
    let mut view = View {
        snapshot: NativeUiSnapshot {
            version: 1,
            revision: snapshots
                .borrow()
                .as_ref()
                .map_or(0, |snapshot| snapshot.revision),
            pid,
            provider_session_id: String::new(),
            cwd: String::new(),
            model: None,
            running: false,
            blocked: false,
            messages: vec![],
            truncated: false,
        },
        turn: None,
        message_bytes: 0,
        next_thread: None,
        dirty: false,
    };
    let mut id = 1;
    request(&mut peer, &mut view, id, "initialize", json!({"clientInfo":{"name":"perch_native_ui","title":"Perch","version":env!("CARGO_PKG_VERSION")},"capabilities":{"experimentalApi":true,"requestAttestation":false}})).await?;
    peer.send(Message::Text(json!({"method":"initialized"}).to_string()))
        .await?;
    loop {
        if !alive() {
            return Ok(());
        }
        id += 1;
        let loaded = request(&mut peer, &mut view, id, "thread/loaded/list", json!({})).await?;
        let ids = loaded["data"]
            .as_array()
            .context("invalid native thread list")?;
        let requested = view.next_thread.as_ref().or(continuation.as_ref()).cloned();
        let known = requested
            .as_ref()
            .filter(|requested| ids.iter().any(|id| id == *requested));
        ensure!(
            known.is_some() || ids.len() <= 64,
            "too many native threads to discover in this CLI"
        );
        let mut primary_threads = vec![];
        for native in ids
            .iter()
            .filter_map(Value::as_str)
            .filter(|native| known.is_none_or(|known| native == known))
        {
            id += 1;
            let metadata = request(
                &mut peer,
                &mut view,
                id,
                "thread/read",
                json!({"threadId":native}),
            )
            .await?;
            if primary(&metadata["thread"]) {
                primary_threads.push(metadata["thread"].clone());
            }
        }
        let requested = view.next_thread.as_ref().or(continuation.as_ref());
        let selected = primary_threads
            .iter()
            .find(|thread| requested.is_some_and(|id| thread["id"] == *id))
            .cloned()
            .or_else(|| {
                (view.next_thread.is_none() && primary_threads.len() == 1)
                    .then(|| primary_threads[0].clone())
            });
        ensure!(
            selected.is_some() || primary_threads.len() <= 1 || view.next_thread.is_some(),
            "Choose the CLI conversation before opening UI"
        );
        let Some(thread) = selected else {
            tokio::time::sleep(Duration::from_millis(250)).await;
            continue;
        };
        let native = thread["id"]
            .as_str()
            .context("missing native thread ID")?
            .to_string();
        view.next_thread = None;
        view.snapshot.provider_session_id = native.clone();
        view.snapshot.cwd = clip(thread["cwd"].as_str().unwrap_or_default(), 4096);
        view.snapshot.model = thread["model"].as_str().map(|model| clip(model, 256));
        view.snapshot.running = thread["status"]["type"] == "active";
        view.snapshot.blocked = waiting_on_human(&thread["status"]);
        view.snapshot.messages.clear();
        view.message_bytes = 0;
        view.turn = None;
        *continuation = Some(native.clone());
        let rollout = thread["path"].as_str().map(PathBuf::from);
        let waiting_for_history = !rollout.as_ref().is_some_and(|path| path.is_file());
        let history = if waiting_for_history {
            // Codex 0.154 accepts turn/start on a live empty thread, but
            // refuses subscriptions until its first real turn creates the
            // rollout. Never insert a synthetic prompt to bootstrap UI.
            json!({"data":[],"nextCursor":null})
        } else {
            // Only a thread verified loaded in this private CLI server may
            // be joined. Never create a parallel thread for the UI.
            id += 1;
            let joined = request(&mut peer, &mut view, id, "thread/resume",
                json!({"threadId":native,"excludeTurns":true,"initialTurnsPage":{"limit":8,"itemsView":"full","sortDirection":"desc"}})).await?;
            ensure!(
                joined["thread"]["id"] == native,
                "native Codex identity changed"
            );
            view.snapshot.model = joined["model"].as_str().map(|model| clip(model, 256));
            ensure!(
                joined["initialTurnsPage"].is_object(),
                "Codex did not return native history"
            );
            joined["initialTurnsPage"].clone()
        };
        let arriving = std::mem::take(&mut view.snapshot.messages);
        view.message_bytes = 0;
        view.snapshot.truncated = !history["nextCursor"].is_null();
        for turn in history["data"].as_array().into_iter().flatten().rev() {
            if turn["status"] == "inProgress" {
                view.turn = turn["id"].as_str().map(str::to_string);
            }
            for item in turn["items"].as_array().into_iter().flatten() {
                for row in normalize(item) {
                    view.put(row);
                }
            }
            view.turn_error(turn);
        }
        for row in arriving {
            view.put(row);
        }
        view.dirty = true;
        let mut tick = tokio::time::interval(Duration::from_millis(100));
        let discovery_deadline = tokio::time::Instant::now() + Duration::from_millis(500);
        while alive() && view.next_thread.is_none() {
            tokio::select! {
                _ = tick.tick() => {
                    if waiting_for_history && (rollout.as_ref().is_some_and(|path| path.is_file()) || rollout.is_none() && tokio::time::Instant::now() >= discovery_deadline) { break; }
                    if view.dirty {
                        view.dirty = false;
                        view.snapshot.revision += 1;
                        snapshots.send_replace(Some(view.snapshot.clone()));
                        on_snapshot(view.snapshot.clone());
                    }
                }
                command = commands.recv() => {
                    let Some(command) = command else { return Ok(()); };
                    let payload: Value = serde_json::from_str(&command.payload)?;
                    let action = if payload["type"] == "prompt" {
                        Some(("turn/start", json!({"threadId":native,"clientUserMessageId":command.id,"input":[{"type":"text","text":payload["text"],"text_elements":[]}]})))
                    } else { view.turn.as_ref().map(|turn| ("turn/interrupt", json!({"threadId":native,"turnId":turn}))) };
                    if let Some((method, params)) = action {
                        id += 1;
                        let result = request(&mut peer, &mut view, id, method, params).await;
                        if method == "turn/start" {
                            if let Ok(result) = &result {
                                view.turn = result["turn"]["id"].as_str().map(str::to_string);
                                view.snapshot.running = result["turn"]["status"] == "inProgress";
                                view.dirty = true;
                            }
                        }
                        let failed = result.is_err();
                        let _ = command.reply.send(result.map(|_| true).map_err(|error| error.to_string()));
                        if failed { bail!("native action failed; reconnect without replaying it"); }
                    } else { let _ = command.reply.send(Err("No active native turn is available to cancel".into())); }
                }
                frame = peer.next() => {
                    let frame = frame.context("Codex native connection closed")??;
                    if frame.is_close() { bail!("Codex native connection closed"); }
                    if frame.is_text() { view.event(&serde_json::from_str::<Value>(frame.to_text()?)?); }
                }
            }
        }
    }
}

pub(super) async fn observe(
    key: &AgentKey,
    mut continuation: Option<String>,
    alive: Arc<dyn Fn() -> bool + Send + Sync>,
    on_snapshot: Arc<dyn Fn(NativeUiSnapshot) + Send + Sync>,
    snapshots: watch::Sender<Option<NativeUiSnapshot>>,
    mut commands: mpsc::Receiver<super::Command>,
) {
    let mut last_error = String::new();
    while alive() {
        if let Err(error) = connection(
            key,
            &mut continuation,
            &alive,
            &on_snapshot,
            &snapshots,
            &mut commands,
        )
        .await
        {
            snapshots.send_replace(None);
            let message = clip(&error.to_string(), 4096);
            if message != last_error {
                tracing::warn!(session_id = %key.session_id, error = %message, "native Codex UI connection unavailable");
                last_error = message;
            }
        }
        while let Ok(command) = commands.try_recv() {
            let _ = command.reply.send(Err(
                "Codex native connection closed; this action will not be replayed".into(),
            ));
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn closing_the_terminal_stops_both_native_children() {
        use std::os::unix::{fs::PermissionsExt, net::UnixListener};
        use std::process::{Command, Stdio};
        let directory = std::env::temp_dir().join(format!("pc-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&directory).unwrap();
        let socket = directory.join("s");
        let _listener = UnixListener::bind(&socket).unwrap();
        let executable = directory.join("codex");
        let launcher = directory.join("launch.sh");
        let server_pid = directory.join("server.pid");
        let tui_pid = directory.join("tui.pid");
        std::fs::write(&launcher, LAUNCHER).unwrap();
        std::fs::write(&executable, "#!/bin/sh\nif [ \"$1\" != app-server ]; then printf '%s' \"$$\" > \"$PERCH_TEST_TUI_PID\"; fi\nexec sleep 60\n").unwrap();
        std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o700)).unwrap();
        let mut parent = Command::new("/bin/sh")
            .args([
                launcher.to_str().unwrap(),
                executable.to_str().unwrap(),
                &format!("unix://{}", socket.display()),
                server_pid.to_str().unwrap(),
            ])
            .env("PERCH_TEST_TUI_PID", &tui_pid)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        for _ in 0..100 {
            if tui_pid.is_file() {
                break;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
        let children: Vec<i32> = [&server_pid, &tui_pid]
            .into_iter()
            .filter_map(|path| std::fs::read_to_string(path).ok()?.trim().parse().ok())
            .collect();
        unsafe {
            libc::kill(parent.id() as i32, libc::SIGHUP);
        }
        let mut exited = false;
        for _ in 0..100 {
            if parent.try_wait().unwrap().is_some() {
                exited = true;
                break;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        let stopped = children
            .iter()
            .all(|pid| unsafe { libc::kill(*pid, 0) != 0 });
        // Clean up even if a regression makes either child outlive its terminal.
        for pid in &children {
            unsafe {
                libc::kill(*pid, libc::SIGKILL);
            }
        }
        let _ = parent.kill();
        let _ = parent.wait();
        std::fs::remove_dir_all(directory).unwrap();
        assert_eq!(children.len(), 2);
        assert!(
            exited && stopped,
            "closing tmux must stop the native TUI and server"
        );
    }

    #[test]
    fn native_projection_excludes_system_threads_and_private_payloads() {
        let mut thread = json!({"id":uuid::Uuid::new_v4().to_string(),"ephemeral":false,"parentThreadId":null,"threadSource":"user"});
        assert!(primary(&thread));
        thread["ephemeral"] = true.into();
        thread["threadSource"] = "system".into();
        assert!(!primary(&thread));
        assert!(normalize(
            &json!({"id":"hook","type":"hookPrompt","fragments":["private instructions"]})
        )
        .is_empty());
        let user = normalize(
            &json!({"id":"user","type":"userMessage","content":[{"type":"text","text":"é".repeat(20_000)},{"type":"image","url":"data:image/png;base64,private"}]}),
        );
        assert!(user[0].text.len() <= 16 * 1024);
        assert!(!serde_json::to_string(&user).unwrap().contains("private"));
        let tool = normalize(
            &json!({"id":"tool","type":"commandExecution","command":"read sentinel.txt","status":"completed","aggregatedOutput":"unique sentinel"}),
        );
        assert_eq!(tool[0].tools[0].name, "shell");
        assert_eq!(tool[1].role, "toolResult");
        assert_eq!(tool[1].text, "unique sentinel");
        let dynamic = normalize(
            &json!({"id":"dynamic","type":"dynamicToolCall","tool":"read","arguments":{},"contentItems":[{"type":"inputText","text":"native result"},{"type":"inputImage","imageUrl":"private media"}]}),
        );
        assert_eq!(dynamic[1].text, "native result[attachment in CLI]");
        assert!(!serde_json::to_string(&dynamic)
            .unwrap()
            .contains("private media"));
        let key = AgentKey::new("workspace", "session", "codex").unwrap();
        let mut view = View {
            snapshot: NativeUiSnapshot {
                version: 1,
                revision: 0,
                pid: 1,
                provider_session_id: "native".into(),
                cwd: "/workspace".into(),
                model: None,
                running: true,
                blocked: false,
                messages: vec![],
                truncated: false,
            },
            message_bytes: 0,
            turn: Some("turn".into()),
            next_thread: None,
            dirty: false,
        };
        for index in 0..150 {
            let mut row = message(&index.to_string(), "assistant");
            row.text = "é".repeat(8192);
            view.put(row);
        }
        assert!(view.snapshot.truncated && view.message_bytes <= 192 * 1024);
        view.event(&json!({"method":"thread/status/changed","params":{"threadId":"native","status":{"type":"active","activeFlags":["waitingOnApproval"]}}}));
        assert!(view.snapshot.running && view.snapshot.blocked);
        view.event(&json!({"method":"thread/status/changed","params":{"threadId":"native","status":{"type":"active","activeFlags":[]}}}));
        assert!(view.snapshot.running && !view.snapshot.blocked);
        view.event(&json!({"method":"thread/status/changed","params":{"threadId":"native","status":{"type":"active","activeFlags":["waitingOnUserInput"]}}}));
        assert!(view.snapshot.blocked);
        view.event(&json!({"method":"turn/completed","params":{"threadId":"native","turn":{"id":"turn","status":"failed","error":{"message":"native failure"}}}}));
        assert!(!view.snapshot.running && !view.snapshot.blocked);
        assert_eq!(
            view.snapshot.messages.last().unwrap().error.as_deref(),
            Some("native failure")
        );
        assert_eq!(
            view.message_bytes,
            view.snapshot
                .messages
                .iter()
                .map(|row| serde_json::to_vec(row).unwrap().len())
                .sum::<usize>()
        );
        let args = launch(
            &key,
            vec![
                "/native/codex".into(),
                "resume".into(),
                "literal '$() session".into(),
            ],
        )
        .unwrap();
        assert_eq!(&args[5..], &["resume", "literal '$() session"]);
    }
}
