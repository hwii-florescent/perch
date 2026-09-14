//! Native OpenCode UI bridge through its documented local HTTP server.
use super::*;
use crate::protocol::{NativeUiMessage, NativeUiTool};
use serde_json::{json, Value};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpStream,
};

pub(super) const LAUNCHER: &str = r#"#!/bin/sh
umask 077
exe=$1
port=$2
marker=$3
pidfile=$4
shift 4
"$exe" serve --hostname 127.0.0.1 --port "$port" >/dev/null 2>&1 &
server=$!
printf '%s\n' "$server" > "$pidfile"
cleanup() { [ -z "$tui" ] || kill "$tui" 2>/dev/null; kill "$server" 2>/dev/null; wait "$server" 2>/dev/null; rm -f -- "$pidfile" "$marker"; }
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
attempt=0
while ! /usr/bin/curl -fsS --max-time 1 "http://127.0.0.1:$port/global/health" >/dev/null 2>&1; do
  if ! kill -0 "$server" 2>/dev/null || [ "$attempt" -ge 200 ]; then exit 1; fi
  attempt=$((attempt + 1)); sleep 0.05
done
touch "$marker"
"$exe" attach "http://127.0.0.1:$port" "$@" <&0 &
tui=$!
wait "$tui"
"#;

fn port(key: &AgentKey) -> u16 {
    let hash = terminal_key(key);
    20_000 + u16::from_str_radix(&hash[6..10], 16).unwrap_or(0) % 30_000
}

pub fn launch(key: &AgentKey, command: Vec<String>) -> anyhow::Result<Vec<String>> {
    ensure!(!command.is_empty(), "missing OpenCode executable");
    let paths = paths(key)?;
    let mut args = vec![
        "/bin/sh".into(),
        paths.extension.to_string_lossy().into_owned(),
        command[0].clone(),
        port(key).to_string(),
        paths.socket.to_string_lossy().into_owned(),
        paths
            .extension
            .with_extension("pid")
            .to_string_lossy()
            .into_owned(),
    ];
    args.extend(command.into_iter().skip(1));
    Ok(args)
}

async fn http(port: u16, method: &str, path: &str, body: Option<&Value>) -> anyhow::Result<Value> {
    let mut stream = tokio::time::timeout(
        Duration::from_secs(5),
        TcpStream::connect(("127.0.0.1", port)),
    )
    .await??;
    let body = body.map_or_else(String::new, Value::to_string);
    let request = format!("{method} {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\nAccept: application/json\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}", body.len());
    stream.write_all(request.as_bytes()).await?;
    let mut bytes = Vec::new();
    tokio::time::timeout(Duration::from_secs(15), stream.read_to_end(&mut bytes)).await??;
    ensure!(
        bytes.len() <= 2 * 1024 * 1024,
        "OpenCode response exceeds native UI limit"
    );
    let split = bytes
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .context("invalid OpenCode HTTP response")?;
    let header = std::str::from_utf8(&bytes[..split])?;
    ensure!(
        header
            .lines()
            .next()
            .is_some_and(|line| line.contains(" 2")),
        "OpenCode request failed: {}",
        clip(header, 1024)
    );
    if bytes.len() == split + 4 {
        return Ok(Value::Null);
    }
    serde_json::from_slice(&bytes[split + 4..]).context("invalid OpenCode JSON")
}

fn text(value: &Value, limit: usize) -> String {
    value.as_str().map_or_else(
        || clip(&value.to_string(), limit),
        |value| clip(value, limit),
    )
}

fn normalize(entry: &Value) -> Vec<NativeUiMessage> {
    let info = &entry["info"];
    let Some(id) = info["id"].as_str().or_else(|| entry["id"].as_str()) else {
        return vec![];
    };
    let role = info["role"]
        .as_str()
        .or_else(|| entry["role"].as_str())
        .unwrap_or("assistant");
    let mut row = NativeUiMessage {
        id: clip(id, 256),
        role: if role == "user" {
            "user".into()
        } else {
            "assistant".into()
        },
        text: String::new(),
        thinking: String::new(),
        tools: vec![],
        tool_name: None,
        model: info["modelID"].as_str().map(|value| clip(value, 256)),
        error: None,
    };
    for part in entry["parts"].as_array().into_iter().flatten() {
        match part["type"].as_str().unwrap_or_default() {
            "reasoning" | "thinking" => row.thinking.push_str(&text(&part["text"], 8 * 1024)),
            "tool" | "tool-call" | "toolCall" => row.tools.push(NativeUiTool {
                name: clip(
                    part["tool"]
                        .as_str()
                        .or_else(|| part["name"].as_str())
                        .unwrap_or("tool"),
                    128,
                ),
                input: text(&part["state"]["input"], 8 * 1024),
            }),
            "image" | "file" => row.text.push_str("[attachment in CLI]"),
            _ => row.text.push_str(&text(
                &part["text"],
                16 * 1024usize.saturating_sub(row.text.len()),
            )),
        }
    }
    if row.text.is_empty() && row.thinking.is_empty() && row.tools.is_empty() {
        vec![]
    } else {
        vec![row]
    }
}

async fn read_snapshot(
    port: u16,
    selected: &mut Option<String>,
    previous: &Option<NativeUiSnapshot>,
    cwd: &str,
    pid: u32,
) -> anyhow::Result<Option<NativeUiSnapshot>> {
    let sessions = http(port, "GET", "/session", None).await?;
    let list = sessions
        .as_array()
        .context("invalid OpenCode session list")?;
    if selected.is_none() {
        *selected = list
            .first()
            .and_then(|session| session["id"].as_str())
            .map(str::to_string);
    }
    let Some(id) = selected.as_deref() else {
        return Ok(None);
    };
    let messages = http(
        port,
        "GET",
        &format!("/session/{id}/message?limit=64"),
        None,
    )
    .await?;
    let statuses = http(port, "GET", "/session/status", None)
        .await
        .unwrap_or(Value::Null);
    let running = statuses[id]["type"] == "busy" || statuses[id]["status"] == "busy";
    let session = list
        .iter()
        .find(|session| session["id"].as_str() == Some(id));
    let mut rows = Vec::new();
    for entry in messages.as_array().into_iter().flatten() {
        rows.extend(normalize(entry));
    }
    if rows.len() > 128 {
        rows.drain(..rows.len() - 128);
    }
    let model = rows
        .iter()
        .rev()
        .find_map(|row| row.model.clone())
        .or_else(|| {
            session
                .and_then(|value| value["model"].as_str())
                .map(str::to_string)
        });
    Ok(Some(NativeUiSnapshot {
        version: 1,
        revision: previous.as_ref().map_or(0, |value| value.revision + 1),
        pid,
        provider_session_id: id.into(),
        cwd: clip(
            session
                .and_then(|value| value["directory"].as_str())
                .unwrap_or(cwd),
            4096,
        ),
        model,
        running,
        messages: rows,
        truncated: messages.as_array().is_some_and(|items| items.len() >= 64),
    }))
}

pub(super) async fn observe(
    key: &AgentKey,
    continuation: Option<String>,
    alive: Arc<dyn Fn() -> bool + Send + Sync>,
    on_snapshot: Arc<dyn Fn(NativeUiSnapshot) + Send + Sync>,
    snapshots: watch::Sender<Option<NativeUiSnapshot>>,
    mut commands: mpsc::Receiver<super::Command>,
) {
    let native_port = port(key);
    let pid_path = paths(key)
        .ok()
        .map(|value| value.extension.with_extension("pid"));
    let mut selected = continuation;
    let mut previous = None;
    while alive() {
        let result = async {
            let pid = pid_path.as_ref().and_then(|path| std::fs::read_to_string(path).ok()).and_then(|value| value.trim().parse().ok()).unwrap_or(0);
            if let Some(snapshot) = read_snapshot(native_port, &mut selected, &previous, &std::env::current_dir()?.to_string_lossy(), pid).await? {
                let changed = previous.as_ref().is_none_or(|old| serde_json::to_vec(old).ok() != serde_json::to_vec(&snapshot).ok());
                if changed { previous = Some(snapshot.clone()); on_snapshot(snapshot.clone()); snapshots.send_replace(Some(snapshot)); }
            }
            while let Ok(command) = commands.try_recv() {
                let payload: Value = serde_json::from_str(&command.payload)?;
                let id = selected.as_deref().context("OpenCode session is not ready")?;
                let result = if payload["type"] == "prompt" { http(native_port, "POST", &format!("/session/{id}/prompt_async"), Some(&json!({"messageID":command.id,"parts":[{"type":"text","text":payload["text"]}]}))).await } else { http(native_port, "POST", &format!("/session/{id}/abort"), Some(&json!({}))).await };
                let _ = command.reply.send(result.map(|_| true).map_err(|error| error.to_string()));
            }
            Ok::<(), anyhow::Error>(())
        }.await;
        if let Err(error) = result {
            tracing::debug!(session_id = %key.session_id, error = %error, "OpenCode native UI polling unavailable");
            snapshots.send_replace(None);
        }
        tokio::time::sleep(Duration::from_millis(400)).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn launch_preserves_args_and_projects_bounded_text() {
        let key = AgentKey::new("workspace", "session", "opencode").unwrap();
        let args = launch(
            &key,
            vec![
                "/native/opencode".into(),
                "--session".into(),
                "id '$()".into(),
            ],
        )
        .unwrap();
        assert_eq!(&args[6..], &["--session", "id '$()"]);
        let rows = normalize(
            &json!({"info":{"id":"m","role":"assistant"},"parts":[{"type":"text","text":"é".repeat(30_000)}]}),
        );
        assert!(rows[0].text.len() <= 16 * 1024);
    }
}
