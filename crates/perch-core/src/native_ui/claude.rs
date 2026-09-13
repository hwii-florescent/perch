//! Observe Claude's native hooks/transcript and type only into a verified empty
//! native prompt. Claude owns its loop, tools, configuration, and conversation.
use super::*;
use crate::protocol::{NativeUiMessage, NativeUiTool};
use serde_json::Value;
use std::{
    fs,
    io::{Read, Seek, SeekFrom},
    path::Path,
    process::Command as Process,
    time::SystemTime,
};

const EVENTS: &[&str] = &[
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PostToolUse",
    "PermissionRequest",
    "Stop",
    "StopFailure",
    "SessionEnd",
    "PostModelSwitch",
];
const MAX_TAIL: u64 = 2 * 1024 * 1024;

fn event_path(config: &Path, event: &str) -> PathBuf {
    config.with_extension(format!("{event}.event"))
}
fn stamp(path: &Path) -> String {
    fs::metadata(path)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|time| time.as_nanos().to_string())
        .unwrap_or_default()
}
pub(super) fn prompt_stamp(config: &Path) -> String {
    stamp(&event_path(config, "UserPromptSubmit"))
}

pub(super) fn settings(config: &Path, fresh: bool) -> anyhow::Result<String> {
    let mut hooks = serde_json::Map::new();
    for event in EVENTS {
        let path = event_path(config, event);
        if fresh && path.exists() {
            fs::remove_file(&path)?;
        }
        // Only fixed private paths enter this shell command. Hook JSON is data
        // on stdin; it cannot become shell syntax or output added to context.
        let quoted = format!("'{}'", path.to_string_lossy().replace('\'', "'\\''"));
        let command = format!("umask 077; perch_hook_file={quoted}; perch_hook_tmp=\"$perch_hook_file.$$\"; {{ printf '%s\\n' \"$PPID\"; head -c 262144; }} > \"$perch_hook_tmp\" && mv -f \"$perch_hook_tmp\" \"$perch_hook_file\"");
        hooks.insert(event.to_string(), serde_json::json!([{ "hooks": [{ "type": "command", "command": command, "timeout": 2 }] }]));
    }
    Ok(serde_json::to_string(
        &serde_json::json!({ "hooks": hooks }),
    )?)
}

fn read_event(path: &Path) -> anyhow::Result<(u32, Value)> {
    let mut bytes = Vec::new();
    let file = fs::File::open(path)?;
    ensure!(
        file.metadata()?.is_file(),
        "native hook must be a regular file"
    );
    file.take((MAX_FRAME + 32) as u64).read_to_end(&mut bytes)?;
    let split = bytes
        .iter()
        .position(|byte| *byte == b'\n')
        .context("missing native hook PID")?;
    let pid: u32 = std::str::from_utf8(&bytes[..split])?.parse()?;
    let mut event: Value = serde_json::from_slice(&bytes[split + 1..])?;
    ensure!(
        pid > 0 && event.get("agent_id").is_none_or(Value::is_null),
        "not a main CLI event"
    );
    if let Some(fields) = event.as_object_mut() {
        fields.retain(|name, _| {
            matches!(
                name.as_str(),
                "session_id"
                    | "transcript_path"
                    | "cwd"
                    | "hook_event_name"
                    | "model"
                    | "to_model"
                    | "prompt"
            )
        });
    }
    Ok((pid, event))
}

fn clip(text: &str, limit: usize) -> String {
    let mut end = text.len().min(limit);
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    text[..end].to_string()
}
fn text(value: &Value) -> String {
    if let Some(value) = value.as_str() {
        return clip(value, 16 * 1024);
    }
    let mut result = String::new();
    if let Some(blocks) = value.as_array() {
        for block in blocks {
            if block["type"] == "text" {
                result.push_str(&clip(
                    block["text"].as_str().unwrap_or_default(),
                    (16 * 1024usize).saturating_sub(result.len()),
                ));
            }
        }
    }
    result
}

fn messages(row: &Value) -> Vec<NativeUiMessage> {
    if row["isSidechain"] == true || row["isMeta"] == true {
        return vec![];
    }
    let role = row["type"].as_str().unwrap_or_default();
    if !matches!(role, "user" | "assistant") {
        return vec![];
    }
    let raw = &row["message"];
    let mut message = NativeUiMessage {
        id: row["uuid"].as_str().unwrap_or_default().to_string(),
        role: role.into(),
        text: text(&raw["content"]),
        thinking: String::new(),
        tools: vec![],
        tool_name: None,
        model: raw["model"].as_str().map(|model| clip(model, 256)),
        error: None,
    };
    let mut result = vec![];
    let mut tool_budget = 8 * 1024usize;
    if let Some(blocks) = raw["content"].as_array() {
        for (index, block) in blocks.iter().enumerate() {
            match block["type"].as_str().unwrap_or_default() {
                "thinking" => message.thinking.push_str(&clip(
                    block["thinking"].as_str().unwrap_or_default(),
                    (8 * 1024usize).saturating_sub(message.thinking.len()),
                )),
                "tool_use" if message.tools.len() < 32 => {
                    let input = clip(&block["input"].to_string(), tool_budget.min(2048));
                    tool_budget -= input.len();
                    message.tools.push(NativeUiTool {
                        name: clip(block["name"].as_str().unwrap_or("Tool"), 128),
                        input,
                    });
                }
                "tool_result" => result.push(NativeUiMessage {
                    id: format!("{}:tool:{index}", message.id),
                    role: "toolResult".into(),
                    text: text(&block["content"]),
                    thinking: String::new(),
                    tools: vec![],
                    tool_name: None,
                    model: None,
                    error: (block["is_error"] == true).then(|| "Tool reported an error".into()),
                }),
                "image" | "document" => message.text.push_str("\n[attachment in CLI]"),
                _ => {}
            }
        }
    }
    if !message.text.is_empty() || !message.thinking.is_empty() || !message.tools.is_empty() {
        result.insert(0, message);
    }
    result
}

fn transcript(path: &Path, session: &str) -> anyhow::Result<(Vec<NativeUiMessage>, bool)> {
    ensure!(
        path.file_name().and_then(|name| name.to_str()) == Some(&format!("{session}.jsonl")),
        "native transcript identity mismatch"
    );
    let mut file = fs::File::open(path)?;
    let metadata = file.metadata()?;
    ensure!(
        metadata.is_file(),
        "native transcript must be a regular file"
    );
    let offset = metadata.len().saturating_sub(MAX_TAIL);
    file.seek(SeekFrom::Start(offset))?;
    let mut bytes = Vec::new();
    file.take(MAX_TAIL).read_to_end(&mut bytes)?;
    let mut nodes = HashMap::new();
    let mut leaf = String::new();
    for (index, line) in bytes.split(|byte| *byte == b'\n').enumerate() {
        if offset != 0 && index == 0 {
            continue;
        }
        let Ok(row) = serde_json::from_slice::<Value>(line) else {
            continue;
        };
        if row["isSidechain"] == true || row["sessionId"].as_str().is_some_and(|id| id != session) {
            continue;
        }
        if let Some(id) = row["uuid"].as_str() {
            leaf = id.to_string();
            nodes.insert(
                leaf.clone(),
                (
                    row["parentUuid"].as_str().unwrap_or_default().to_string(),
                    messages(&row),
                ),
            );
        } else if let Some(id) = row["leafUuid"].as_str() {
            leaf = id.to_string();
        }
    }
    let mut history = Vec::new();
    let mut size = 0;
    let mut truncated = offset != 0;
    // Removal also prevents a malformed parent cycle from looping forever.
    while let Some((parent, row)) = nodes.remove(&leaf) {
        for message in row.into_iter().rev() {
            size += serde_json::to_vec(&message)?.len();
            if history.len() >= 128 || size > 192 * 1024 {
                truncated = true;
                break;
            }
            history.push(message);
        }
        if truncated && (history.len() >= 128 || size > 192 * 1024) {
            break;
        }
        leaf = parent;
    }
    history.reverse();
    Ok((history, truncated))
}

fn empty_prompt(line: &str) -> bool {
    line.trim_start()
        .strip_prefix('❯')
        .is_some_and(|draft| draft.trim().is_empty())
}

/// Run only while the runtime's existing input authority is held. The capture
/// is a preflight, never an acknowledgement; native hooks confirm acceptance.
pub fn prepare_input(key: &AgentKey, prompt: Option<&str>) -> anyhow::Result<Option<String>> {
    if key.agent_id != "claude" {
        return Ok(None);
    }
    ensure!(
        !prompt
            .unwrap_or_default()
            .chars()
            .any(|ch| ch.is_control() && ch != '\n' && ch != '\t'),
        "A CLI prompt cannot contain terminal control characters"
    );
    let session = format!(
        "={}:",
        crate::agent_tmux::tmux_session_name(&terminal_key(key))
    );
    let panes = Process::new("tmux")
        .args([
            "list-panes",
            "-t",
            &session,
            "-F",
            "#{pane_id} #{cursor_y} #{pane_active} #{pane_pid}",
        ])
        .output()?;
    ensure!(panes.status.success(), "CLI prompt is unavailable");
    let native_pid = read_event(&event_path(&paths(key)?.extension, "SessionStart"))?
        .0
        .to_string();
    let pane_text = String::from_utf8(panes.stdout)?;
    let pane = pane_text
        .lines()
        .map(|line| line.split_whitespace().collect::<Vec<_>>())
        .find(|fields| fields.len() == 4 && fields[2] == "1" && fields[3] == native_pid)
        .context("The active terminal pane is not this Claude process")?;
    let target = pane[0];
    let Some(prompt) = prompt else {
        return Ok(Some("\u{1b}".into()));
    };
    let row = pane[1].parse::<u16>()?.to_string();
    let screen = Process::new("tmux")
        .args(["capture-pane", "-p", "-t", target, "-S", &row, "-E", &row])
        .output()?;
    // ponytail: this recognizes Claude's native empty prompt on the installed
    // TUI. Fail closed on other layouts; replace with a native editor API if
    // Claude exposes one. Never clear or append to an unsubmitted CLI draft.
    ensure!(
        screen.status.success() && empty_prompt(&String::from_utf8_lossy(&screen.stdout)),
        "The CLI has a draft or dialog open. Finish it in CLI view before sending from UI."
    );
    Ok(Some(format!("\u{1b}[200~{prompt}\u{1b}[201~\r")))
}

pub(super) async fn observe(
    key: &AgentKey,
    alive: Arc<dyn Fn() -> bool + Send + Sync>,
    on_snapshot: Arc<dyn Fn(NativeUiSnapshot) + Send + Sync>,
    snapshots: watch::Sender<Option<NativeUiSnapshot>>,
    mut commands: mpsc::Receiver<super::Command>,
) {
    let Ok(paths) = paths(key) else {
        return;
    };
    let mut events = HashMap::<String, (String, u32, Value)>::new();
    let mut history_key = String::new();
    let mut history = (Vec::new(), false);
    let mut last = String::new();
    let mut revision = 0;
    let mut pending = Vec::<super::Command>::new();
    let mut tick = tokio::time::interval(Duration::from_millis(100));
    while alive() {
        tokio::select! {
            command = commands.recv() => {
                let Some(command) = command else { break; };
                pending.retain(|command| !command.reply.is_closed());
                if pending.len() < 16 { pending.push(command); }
                else { let _ = command.reply.send(Err("Too many pending native actions".into())); }
            }
            _ = tick.tick() => {
                let mut changed = false;
                for event in EVENTS {
                    let path = event_path(&paths.extension, event);
                    let current = stamp(&path);
                    if !current.is_empty() && events.get(*event).is_none_or(|(old, _, _)| old != &current) {
                        if let Ok((pid, value)) = read_event(&path) { events.insert(event.to_string(), (current, pid, value)); changed = true; }
                    }
                }
                let Some((_, pid, start)) = events.get("SessionStart") else { continue; };
                let Some(session) = start["session_id"].as_str().filter(|id| uuid::Uuid::parse_str(id).is_ok()) else { continue; };
                let Some(path) = start["transcript_path"].as_str().map(Path::new) else { continue; };
                let next_history = format!("{session}:{}", stamp(path));
                if next_history != history_key {
                    if let Ok(next) = transcript(path, session) { history = next; history_key = next_history; changed = true; }
                    else if history_key.split(':').next() != Some(session) { history = (vec![], false); }
                }
                if !changed && pending.is_empty() { continue; }
                let mut running = false;
                let mut model = start["model"].as_str().map(|model| clip(model, 256));
                let mut ordered: Vec<_> = events.values().filter(|(_, event_pid, event)| event_pid == pid && event["session_id"] == session).collect();
                ordered.sort_by(|left, right| left.0.cmp(&right.0));
                for (_, _, event) in ordered {
                    match event["hook_event_name"].as_str().unwrap_or_default() {
                        "UserPromptSubmit" | "PreToolUse" | "PostToolUse" | "PermissionRequest" => running = true,
                        "SessionStart" | "Stop" | "StopFailure" | "SessionEnd" => running = false,
                        "PostModelSwitch" => model = event["to_model"].as_str().map(|model| clip(model, 256)),
                        _ => {}
                    }
                }
                if history.0.last().is_some_and(|message| message.role == "user" && message.text.starts_with("[Request interrupted by user")) { running = false; }
                let mut snapshot = NativeUiSnapshot { version: 1, revision: 0, pid: *pid, provider_session_id: session.into(), cwd: clip(start["cwd"].as_str().unwrap_or_default(), 4096), model, running, messages: history.0.clone(), truncated: history.1 };
                let serialized = serde_json::to_string(&snapshot).unwrap_or_default();
                if serialized != last {
                    last = serialized; revision += 1; snapshot.revision = revision;
                    snapshots.send_replace(Some(snapshot.clone())); on_snapshot(snapshot);
                }
                pending.retain(|command| !command.reply.is_closed());
                for index in (0..pending.len()).rev() {
                    let Ok(payload) = serde_json::from_str::<Value>(&pending[index].payload) else { continue; };
                    let accepted = if payload["type"] == "cancel" { !running } else {
                        events.get("UserPromptSubmit").is_some_and(|(marker, event_pid, event)| event_pid == pid && event["session_id"] == session && event["prompt"] == payload["text"] && marker != payload["after"].as_str().unwrap_or_default())
                    };
                    if accepted { let command = pending.swap_remove(index); let _ = command.reply.send(Ok(true)); }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_messages_hide_metadata_and_bound_content_and_prompt_guard_preserves_drafts() {
        assert!(empty_prompt("❯\u{a0}\n"));
        assert!(!empty_prompt("❯ unfinished draft"));
        assert!(!empty_prompt("Do you trust this folder?"));
        assert!(!empty_prompt("\n"));
        assert!(messages(
            &serde_json::json!({"type":"attachment","message":{"content":"private metadata"}})
        )
        .is_empty());
        assert!(messages(&serde_json::json!({"type":"user","isMeta":true,"message":{"content":"hidden instructions"}})).is_empty());
        let result = messages(
            &serde_json::json!({"type":"assistant","uuid":"message","message":{"content":[{"type":"text","text":"é".repeat(20000)},{"type":"thinking","thinking":"thought","signature":"hidden-signature"},{"type":"tool_use","name":"Read","input":{"file_path":"notes.txt"}},{"type":"image","source":{"data":"hidden-image"}}]}}),
        );
        assert_eq!(result[0].thinking, "thought");
        assert!(result[0].text.len() < 16500);
        let serialized = serde_json::to_string(&result).unwrap();
        assert!(!serialized.contains("hidden-"));
        assert_eq!(result[0].tools[0].name, "Read");
        let tool = messages(
            &serde_json::json!({"type":"user","uuid":"result","message":{"content":[{"type":"tool_result","content":[{"type":"text","text":"sentinel"}]}]}}),
        );
        assert_eq!(tool[0].role, "toolResult");
        assert_eq!(tool[0].text, "sentinel");
    }
}
