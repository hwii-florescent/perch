//! Observe Claude's native hooks/transcript and type only into a verified empty
//! native prompt. Claude owns its loop, tools, configuration, and conversation.
//!
//! The hook event version floors and the `--version` parsing are ported from Orca's
//! `src/main/claude/claude-hook-event-versions.ts` and `claude-managed-hook-events.ts`
//! (commit 308b5000, MIT; see THIRD_PARTY_NOTICES.md): an older Claude rejects a whole
//! `--settings` file that names a hook event it does not know, so each event is only
//! registered once the detected CLI version has reached its floor.
//!
//! The interruption row (`interrupted`) follows Orca's `src/main/native-chat/
//! transcript-line-decoders-claude.ts` and `transcript-turn-markers.ts` (same commit): Claude's
//! injected "[Request interrupted by user]" user row becomes a `system` status row.
use super::*;
use crate::protocol::{
    NativeUiContext, NativeUiEditHunk, NativeUiEditPatch, NativeUiMessage, NativeUiTool,
};
use serde_json::Value;
use std::{
    fs,
    io::{Read, Seek, SeekFrom},
    path::Path,
    time::SystemTime,
};

/// Hook events and the first Claude version that accepts each in `--settings`
/// (Orca `CLAUDE_HOOK_EVENT_FIRST_VERSIONS`). SessionEnd is gated at 2.1.261 where
/// Orca measured delivery, though the schema has taken it since 1.0.85.
/// `PostModelSwitch` is not in Orca's table; its floor is unmeasured, so it uses the
/// newest measured one (ponytail: replace with a measured floor).
const EVENT_FLOORS: &[(&str, &str)] = &[
    ("SessionStart", "1.0.62"),
    ("UserPromptSubmit", "1.0.53"),
    ("PreToolUse", "1.0.23"),
    ("PostToolUse", "1.0.23"),
    ("PostToolUseFailure", "2.0.56"),
    ("PermissionRequest", "2.0.45"),
    ("Stop", "1.0.31"),
    ("StopFailure", "2.1.78"),
    ("SessionEnd", "2.1.261"),
    ("PostModelSwitch", "2.1.78"),
];
/// Orca `UNRESOLVED_CLAUDE_VERSION`: when the version cannot be read, register only
/// what every Claude that has hooks accepts.
const UNRESOLVED_VERSION: &str = "1.0.64";

fn events() -> impl Iterator<Item = &'static str> {
    EVENT_FLOORS.iter().map(|(name, _)| *name)
}

/// `x.y.z` from Claude's own `x.y.z (Claude Code)` line, never from a launcher's
/// version (Orca `parseClaudeCliVersionOutput`). A prerelease or build suffix is kept
/// out of the numbers compared.
pub(super) fn parse_version_output(output: &str) -> Option<String> {
    output.lines().find_map(|line| {
        let version = line.trim().strip_suffix("(Claude Code)")?.trim_end();
        let core = version.split(['-', '+']).next()?;
        (core.split('.').count() == 3
            && core
                .split('.')
                .all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit())))
        .then(|| version.to_string())
    })
}

fn numbers(version: &str) -> Option<[u64; 3]> {
    let mut parts = version.split(['-', '+']).next()?.split('.');
    let result = [
        parts.next()?.parse().ok()?,
        parts.next()?.parse().ok()?,
        parts.next()?.parse().ok()?,
    ];
    parts.next().is_none().then_some(result)
}

fn reaches(version: Option<&str>, floor: &str) -> bool {
    let have = version
        .and_then(numbers)
        .or_else(|| numbers(UNRESOLVED_VERSION));
    have >= numbers(floor)
}

/// The hook events a Claude of this version may be told about.
fn events_for(version: Option<&str>) -> Vec<&'static str> {
    EVENT_FLOORS
        .iter()
        .filter(|(_, floor)| reaches(version, floor))
        .map(|(name, _)| *name)
        .collect()
}

/// The installed Claude's version, probed with a bounded `--version` and cached for
/// five minutes. `None` when it cannot be read (Orca then keeps the old-CLI floor).
pub(super) fn cli_version() -> Option<String> {
    use std::sync::{Mutex, OnceLock};
    use std::time::Instant;
    type Probed = Option<(Instant, Option<String>)>;
    static CACHE: OnceLock<Mutex<Probed>> = OnceLock::new();
    let cache = CACHE.get_or_init(Default::default);
    if let Some((at, version)) = cache.lock().unwrap().as_ref() {
        if at.elapsed() < Duration::from_secs(300) {
            return version.clone();
        }
    }
    let version = crate::agent_catalog::resolve_executable("claude", "claude")
        .ok()
        .and_then(|path| {
            let (send, receive) = std::sync::mpsc::channel();
            std::thread::spawn(move || {
                let output = std::process::Command::new(path)
                    .arg("--version")
                    .stdin(std::process::Stdio::null())
                    .output();
                let _ = send.send(output);
            });
            let output = receive.recv_timeout(Duration::from_secs(5)).ok()?.ok()?;
            output.status.success().then(|| {
                parse_version_output(&format!(
                    "{}\n{}",
                    String::from_utf8_lossy(&output.stdout),
                    String::from_utf8_lossy(&output.stderr)
                ))
            })?
        });
    *cache.lock().unwrap() = Some((Instant::now(), version.clone()));
    version
}
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
/// Claude keeps each subagent beside the session's transcript: `<session>/subagents/agent-<id>.meta.json`
/// (description, type, the spawn call's id, `finished`) and `agent-<id>.jsonl` (its own messages).
/// Undocumented, read best effort (probed on 2.1.319, 2026-11-06); a file that does not read as
/// expected is skipped, never guessed at.
fn subagents_dir(transcript: &Path) -> Option<PathBuf> {
    Some(
        transcript
            .parent()?
            .join(transcript.file_stem()?)
            .join("subagents"),
    )
}

const MAX_SUBAGENTS: usize = 32;
/// An unfinished child whose files have been still this long reads as lost contact, not as working.
const SUBAGENT_STALE: Duration = Duration::from_secs(10 * 60);

fn subagent_meta_files(dir: &Path) -> Vec<(String, PathBuf)> {
    let Ok(entries) = fs::read_dir(dir) else {
        return vec![];
    };
    let mut files: Vec<(String, PathBuf)> = entries
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let name = entry.file_name().into_string().ok()?;
            let id = name.strip_prefix("agent-")?.strip_suffix(".meta.json")?;
            let safe = !id.is_empty()
                && id.len() <= 64
                && id
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-');
            (safe && entry.file_type().ok()?.is_file()).then(|| (id.to_string(), entry.path()))
        })
        .collect();
    files.sort();
    files
}

/// Changes when a child appears, its meta file is rewritten (`finished` flips) or its transcript
/// grows: Claude marks a child finished before its last rows are written (seen live), so the
/// roster is read again once they land.
fn roster_stamp(dir: &Path) -> String {
    subagent_meta_files(dir)
        .iter()
        .map(|(id, path)| {
            format!(
                "{id}:{}:{}",
                stamp(path),
                stamp(&dir.join(format!("agent-{id}.jsonl")))
            )
        })
        .collect::<Vec<_>>()
        .join(",")
}

/// "2026-11-06T21:22:20.679Z" as milliseconds since the epoch (UTC only, as Claude writes it).
fn iso_ms(text: &str) -> Option<i64> {
    let (date, time) = text.strip_suffix('Z')?.split_once('T')?;
    let mut ymd = date.split('-').map(|part| part.parse::<i64>().ok());
    let (year, month, day) = (ymd.next()??, ymd.next()??, ymd.next()??);
    let (clock, fraction) = time.split_once('.').unwrap_or((time, "0"));
    let mut hms = clock.split(':').map(|part| part.parse::<i64>().ok());
    let (hour, minute, second) = (hms.next()??, hms.next()??, hms.next()??);
    let millis: i64 = format!("{fraction:0<3}")[..3].parse().ok()?;
    // Days from 1970-01-01 (Howard Hinnant's civil-date algorithm).
    let year = year - i64::from(month <= 2);
    let era = year.div_euclid(400);
    let year_of_era = year - era * 400;
    let day_of_year = (153 * (month + if month > 2 { -3 } else { 9 }) + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    let days = era * 146_097 + day_of_era - 719_468;
    Some(((days * 24 + hour) * 60 + minute) * 60_000 + second * 1000 + millis)
}

/// The first line's time and, from the tail, the last line's time and whether the child's last
/// reply ended its turn.
/// A child's transcript holds rows of tens of kilobytes (the request it sent), so the tail that
/// reaches its last reply is a megabyte; it is only read once the child is marked finished.
const SUBAGENT_TAIL: u64 = 1024 * 1024;

fn subagent_transcript(path: &Path, finished: bool) -> (Option<i64>, Option<i64>, bool) {
    let Ok(mut file) = fs::File::open(path) else {
        return (None, None, false);
    };
    let time_of = |line: &[u8]| {
        serde_json::from_slice::<Value>(line)
            .ok()
            .and_then(|row| iso_ms(row["timestamp"].as_str()?))
    };
    let mut head = Vec::new();
    let _ = (&mut file).take(16 * 1024).read_to_end(&mut head);
    let started = head.split(|byte| *byte == b'\n').next().and_then(time_of);
    if !finished {
        return (started, None, false);
    }
    let length = file.metadata().map_or(0, |meta| meta.len());
    let offset = length.saturating_sub(SUBAGENT_TAIL);
    let mut tail = Vec::new();
    if file.seek(SeekFrom::Start(offset)).is_ok() {
        let _ = (&mut file).take(SUBAGENT_TAIL).read_to_end(&mut tail);
    }
    let rows: Vec<Value> = tail
        .split(|byte| *byte == b'\n')
        .skip(usize::from(offset != 0))
        .filter_map(|line| serde_json::from_slice(line).ok())
        .collect();
    let settled = rows
        .iter()
        .rev()
        .find_map(|row| iso_ms(row["timestamp"].as_str()?));
    let ended = rows
        .iter()
        .rev()
        .find(|row| row["type"] == "assistant")
        .is_some_and(|row| row["message"]["stop_reason"] == "end_turn");
    (started, settled, ended)
}

/// The children Claude recorded for this session, oldest first. `finished` is Claude's own mark that
/// the child ended: it counts as completed only when its last reply ended its turn, otherwise
/// its outcome is unknown. An unfinished child is working unless its files have been still for ten
/// minutes (lost contact is not exit, and not progress either).
fn subagent_roster(transcript: &Path, now: SystemTime) -> Vec<crate::protocol::NativeUiSubagent> {
    let Some(dir) = subagents_dir(transcript) else {
        return vec![];
    };
    let mut roster: Vec<crate::protocol::NativeUiSubagent> = subagent_meta_files(&dir)
        .into_iter()
        .filter_map(|(id, meta_path)| {
            let meta_file = fs::File::open(&meta_path).ok()?;
            let mut bytes = Vec::new();
            meta_file.take(16 * 1024).read_to_end(&mut bytes).ok()?;
            let meta: Value = serde_json::from_slice(&bytes).ok()?;
            let transcript_path = dir.join(format!("agent-{id}.jsonl"));
            let finished = meta["finished"] == true;
            let (started_at, settled_at, ended) = subagent_transcript(&transcript_path, finished);
            let touched = [&meta_path, &transcript_path]
                .iter()
                .filter_map(|path| fs::metadata(path).and_then(|meta| meta.modified()).ok())
                .max();
            let state = match (finished, ended) {
                (true, true) => "completed",
                (true, false) => "unverifiable",
                (false, _)
                    if touched.is_some_and(|time| {
                        now.duration_since(time)
                            .is_ok_and(|age| age > SUBAGENT_STALE)
                    }) =>
                {
                    "unverifiable"
                }
                (false, _) => "working",
            };
            let agent_type = meta["agentType"]
                .as_str()
                .filter(|kind| !kind.is_empty())
                .map(|kind| clip(kind, 128));
            let label = meta["description"]
                .as_str()
                .filter(|text| !text.trim().is_empty())
                .map(|text| clip(text.trim(), 160))
                .or_else(|| agent_type.clone())
                .unwrap_or_else(|| "subagent".into());
            Some(crate::protocol::NativeUiSubagent {
                id,
                label,
                agent_type,
                tool_use_id: meta["toolUseId"]
                    .as_str()
                    .filter(|id| !id.is_empty())
                    .map(|id| clip(id, 256)),
                state: state.into(),
                started_at,
                settled_at: (state != "working").then_some(settled_at).flatten(),
            })
        })
        .collect();
    roster.sort_by(|left, right| (left.started_at, &left.id).cmp(&(right.started_at, &right.id)));
    if roster.len() > MAX_SUBAGENTS {
        roster.drain(..roster.len() - MAX_SUBAGENTS);
    }
    roster
}

pub(super) fn prompt_stamp(config: &Path) -> String {
    stamp(&event_path(config, "UserPromptSubmit"))
}

pub(super) fn settings(
    config: &Path,
    fresh: bool,
    version: Option<&str>,
) -> anyhow::Result<String> {
    let mut hooks = serde_json::Map::new();
    for event in events_for(version) {
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

fn parent_pid(pid: u32) -> Option<u32> {
    let output = std::process::Command::new("ps")
        .args(["-o", "ppid=", "-p", &pid.to_string()])
        .output()
        .ok()?;
    String::from_utf8_lossy(&output.stdout).trim().parse().ok()
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
                    | "permission_mode"
                    | "prompt"
                    | "tool_name"
                    | "tool_use_id"
            )
        });
    }
    Ok((pid, event))
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

const MAX_PATCH_HUNKS: usize = 40;
const MAX_PATCH_HUNK_LINES: usize = 400;

/// The hunks Claude resolved for a file edit (`toolUseResult.structuredPatch`), bounded as Orca
/// bounds them (`transcript-line-decoders-claude.ts`): they carry true file line numbers, which
/// the snippet pair in the call cannot.
fn edit_patch(row: &Value) -> Option<NativeUiEditPatch> {
    let result = &row["toolUseResult"];
    let hunks: Vec<NativeUiEditHunk> = result["structuredPatch"]
        .as_array()?
        .iter()
        .take(MAX_PATCH_HUNKS)
        .filter_map(|hunk| {
            Some(NativeUiEditHunk {
                old_start: u32::try_from(hunk["oldStart"].as_u64()?).ok()?,
                new_start: u32::try_from(hunk["newStart"].as_u64()?).ok()?,
                old_lines: hunk["oldLines"].as_u64().unwrap_or(0) as u32,
                new_lines: hunk["newLines"].as_u64().unwrap_or(0) as u32,
                lines: hunk["lines"]
                    .as_array()?
                    .iter()
                    .take(MAX_PATCH_HUNK_LINES)
                    .filter_map(Value::as_str)
                    .map(|line| clip(line, 2048))
                    .collect(),
            })
        })
        .collect();
    (!hunks.is_empty()).then(|| NativeUiEditPatch {
        file_path: result["filePath"].as_str().map(|path| clip(path, 1024)),
        hunks,
    })
}

/// Claude's injected "[Request interrupted by user…]" user row. Orca keys on the row's
/// `interruptedMessageId` (`transcript-turn-markers.ts`); 2.1.318 transcripts also hold such rows
/// without it (two of five seen), so the two exact texts count too.
fn interrupted(row: &Value) -> bool {
    row["type"] == "user"
        && (row["interruptedMessageId"]
            .as_str()
            .is_some_and(|id| !id.is_empty())
            || matches!(
                text(&row["message"]["content"]).trim(),
                "[Request interrupted by user]" | "[Request interrupted by user for tool use]"
            ))
}

/// The turn ended in a stop: Claude's last row says so, whatever the hooks last reported.
fn ends_interrupted(history: &[NativeUiMessage]) -> bool {
    history.last().is_some_and(|message| {
        message.role == "system" && message.text == super::INTERRUPTED_STATUS_TEXT
    })
}

/// Names of Claude's own commands: a `<command-name>` envelope for one is hidden, any other (a
/// skill, a plugin command) is shown as the person typed it.
fn is_builtin_command(name: &str) -> bool {
    static NAMES: std::sync::OnceLock<std::collections::HashSet<String>> =
        std::sync::OnceLock::new();
    NAMES
        .get_or_init(|| {
            super::catalog::builtins("claude")
                .into_iter()
                .map(|entry| entry.name)
                .collect()
        })
        .contains(name)
}

/// A user row made only of text (a string, or text blocks), the only kind harness tags come in.
fn text_only(content: &Value) -> bool {
    content.is_string()
        || content
            .as_array()
            .is_some_and(|blocks| blocks.iter().all(|block| block["type"] == "text"))
}

fn messages(row: &Value) -> Vec<NativeUiMessage> {
    if row["isSidechain"] == true || row["isMeta"] == true {
        return vec![];
    }
    let role = row["type"].as_str().unwrap_or_default();
    if !matches!(role, "user" | "assistant") {
        return vec![];
    }
    if interrupted(row) {
        return vec![super::interrupted_row(
            row["uuid"].as_str().unwrap_or_default().to_string(),
        )];
    }
    let raw = &row["message"];
    let mut message = NativeUiMessage {
        id: row["uuid"].as_str().unwrap_or_default().to_string(),
        role: role.into(),
        text: text(&raw["content"]),
        model: raw["model"].as_str().map(|model| clip(model, 256)),
        ..Default::default()
    };
    if role == "user" && text_only(&raw["content"]) {
        match super::command_envelope::classify(&message.text, &is_builtin_command) {
            super::command_envelope::UserTurn::Keep => {}
            super::command_envelope::UserTurn::Hidden => return vec![],
            super::command_envelope::UserTurn::Shown(text) => message.text = text,
        }
    }
    let mut result = vec![];
    let mut tool_budget = 8 * 1024usize;
    // An edit's input is the change itself, so it has its own room.
    let mut edit_budget = 48 * 1024usize;
    let mut edit_patch = edit_patch(row);
    if let Some(blocks) = raw["content"].as_array() {
        for (index, block) in blocks.iter().enumerate() {
            match block["type"].as_str().unwrap_or_default() {
                "thinking" => message.thinking.push_str(&clip(
                    block["thinking"].as_str().unwrap_or_default(),
                    (8 * 1024usize).saturating_sub(message.thinking.len()),
                )),
                "tool_use" if message.tools.len() < 32 => {
                    let name = clip(block["name"].as_str().unwrap_or("Tool"), 128);
                    let input = if super::edits::is_edit_tool_name(&name) {
                        let input = clip(
                            &bounded_edit_json(&block["input"]),
                            edit_budget.min(24 * 1024),
                        );
                        edit_budget -= input.len();
                        input
                    } else {
                        // A clipped to-do list does not parse, so it gets room for a long one.
                        let cap = if name == "TodoWrite" { 6 * 1024 } else { 2048 };
                        let input = clip(&bounded_json(&block["input"]), tool_budget.min(cap));
                        tool_budget -= input.len();
                        input
                    };
                    message.tools.push(NativeUiTool {
                        name,
                        input,
                        id: block["id"].as_str().map(|id| clip(id, 256)),
                        state: None,
                    });
                }
                "tool_result" => result.push(NativeUiMessage {
                    id: format!("{}:tool:{index}", message.id),
                    role: "toolResult".into(),
                    text: text(&block["content"]),
                    error: (block["is_error"] == true).then(|| "Tool reported an error".into()),
                    tool_call_id: block["tool_use_id"].as_str().map(|id| clip(id, 256)),
                    is_error: block["is_error"] == true,
                    // Claude puts the resolved hunks on the row, one edit per row.
                    edit_patch: edit_patch.take(),
                    ..Default::default()
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

/// Tokens the last model response read and wrote (what the next request starts from).
fn used_tokens(row: &Value) -> u64 {
    let usage = &row["message"]["usage"];
    [
        "input_tokens",
        "cache_creation_input_tokens",
        "cache_read_input_tokens",
        "output_tokens",
    ]
    .iter()
    .map(|field| usage[field].as_u64().unwrap_or(0))
    .sum()
}

/// Claude does not report its window. Only `[1m]` names it, and a session past 200k must have it.
/// ponytail: a 1M model run without the suffix reads as 200k until it passes 200k; use the
/// statusLine `context_window` feed if that proves common.
fn context(row: &Value) -> Option<NativeUiContext> {
    let used = used_tokens(row);
    let model = row["message"]["model"].as_str();
    if used == 0 {
        return None;
    }
    let window =
        if used > 200_000 || model.is_some_and(|model| model.to_lowercase().ends_with("[1m]")) {
            1_000_000
        } else {
            200_000
        };
    Some(NativeUiContext {
        used_tokens: used,
        window_tokens: window,
        estimated: true,
    })
}

type History = (Vec<NativeUiMessage>, bool, Option<NativeUiContext>);

/// What a snapshot of a session carries by default, and how far a person can page back (Orca
/// `native-chat-pagination.ts`: a page is added to the window and the transcript is read again).
/// Each 128 messages of window also allow another 192 KiB of messages and 2 MiB of file tail.
/// ponytail: the tail is parsed again on every change to the transcript, so the window stops at
/// 528 messages (10 MiB) rather than growing without bound; the CLI view has the rest.
pub(super) const WINDOW: usize = 128;
pub(super) const PAGE: usize = 200;
pub(super) const MAX_WINDOW: usize = WINDOW + 2 * PAGE;

fn transcript(path: &Path, session: &str, window: usize) -> anyhow::Result<History> {
    let scale = window.div_ceil(WINDOW);
    let max_tail = MAX_TAIL * scale as u64;
    let max_bytes = 192 * 1024 * scale;
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
    let offset = metadata.len().saturating_sub(max_tail);
    file.seek(SeekFrom::Start(offset))?;
    let mut bytes = Vec::new();
    file.take(max_tail).read_to_end(&mut bytes)?;
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
                    (row["type"] == "assistant")
                        .then(|| context(&row))
                        .flatten(),
                ),
            );
        } else if let Some(id) = row["leafUuid"].as_str() {
            leaf = id.to_string();
        }
    }
    let mut history = Vec::new();
    let mut size = 0;
    let mut truncated = offset != 0;
    let mut usage = None;
    // Removal also prevents a malformed parent cycle from looping forever.
    while let Some((parent, row, row_usage)) = nodes.remove(&leaf) {
        // The newest response on this branch; a /clear or rewind starts a new branch.
        if usage.is_none() {
            usage = row_usage;
        }
        for message in row.into_iter().rev() {
            size += serde_json::to_vec(&message)?.len();
            if history.len() >= window || size > max_bytes {
                truncated = true;
                break;
            }
            history.push(message);
        }
        if truncated && (history.len() >= window || size > max_bytes) {
            break;
        }
        leaf = parent;
    }
    history.reverse();
    Ok((history, truncated, usage))
}

/// The row holding Claude's input box: the last `❯` line sitting between two horizontal rules. The cursor
/// row is only a fallback; under a status line, or after Claude was resized from a shell, the cursor is
/// parked on a different row than the prompt (seen one row below it).
fn prompt_row(screen: &str, cursor_row: usize) -> &str {
    let rows: Vec<&str> = screen.lines().collect();
    boxed_prompt_index(&rows).map_or_else(
        || rows.get(cursor_row).copied().unwrap_or_default(),
        |i| rows[i],
    )
}

/// Index of the last `❯` row sitting between two horizontal rules.
fn boxed_prompt_index(rows: &[&str]) -> Option<usize> {
    let rule = |row: &str| !row.trim().is_empty() && row.trim().chars().all(|ch| ch == '─');
    (1..rows.len().saturating_sub(1))
        .rev()
        .find(|&i| rows[i].trim_start().starts_with('❯') && rule(rows[i - 1]) && rule(rows[i + 1]))
}

fn empty_prompt(line: &str) -> bool {
    line.trim_start()
        .strip_prefix('❯')
        .is_some_and(|draft| draft.trim().is_empty())
}

/// Is Claude's input box empty? Besides a bare `❯`, a fresh Claude draws a greyed example in an empty
/// prompt (`Try "fix lint errors"`) that is not text anyone typed. See [`example_placeholder`] for how
/// it is told from a draft.
pub(super) fn prompt_is_empty(screen: &str, cursor_row: usize, cursor_col: usize) -> bool {
    let rows: Vec<&str> = screen.lines().collect();
    match boxed_prompt_index(&rows) {
        Some(i) => {
            empty_prompt(rows[i]) || example_placeholder(rows[i], i == cursor_row, cursor_col)
        }
        None => empty_prompt(prompt_row(screen, cursor_row)),
    }
}

/// The greyed example Claude 2.1.319 draws in an empty prompt: `❯`, a space, then `Try "…"`, with
/// the cursor parked on its first letter. The screen text is all the daemon keeps (its terminal emulator
/// drops the dim attribute the example is drawn with, checked on a raw capture), so the placeholder is
/// recognised by shape **and** cursor: a typed draft leaves the cursor at its end, so only a draft of
/// exactly this shape moved back to its start would pass (Ctrl-A). Anything else, including the dim
/// suggestion Claude may draw after a turn, stays a draft and refuses the send; the person can type
/// once or turn `promptSuggestionEnabled` off. Wording varies between launches, so only the shape is checked.
pub(super) fn example_placeholder(row: &str, on_cursor_row: bool, cursor_col: usize) -> bool {
    if !on_cursor_row {
        return false;
    }
    let Some((mark, after)) = row
        .char_indices()
        .find(|(_, ch)| !ch.is_whitespace())
        .filter(|(_, ch)| *ch == '❯')
        .map(|(at, ch)| (at, &row[at + ch.len_utf8()..]))
    else {
        return false;
    };
    let text = after.trim_start();
    let start = row[..mark].chars().count() + 1 + (after.chars().count() - text.chars().count());
    let Some(inner) = text
        .trim_end()
        .strip_prefix("Try \"")
        .and_then(|rest| rest.strip_suffix('"'))
    else {
        return false;
    };
    cursor_col == start
        && !inner.is_empty()
        && inner.chars().count() <= 80
        && !inner.contains('"')
        && !inner.chars().any(char::is_control)
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
    let terminal = crate::shell_integration::pty_key(key);
    let client = crate::daemon::client().context("CLI prompt is unavailable")?;
    let session = client
        .session(&terminal)?
        .filter(|s| s.alive)
        .context("CLI prompt is unavailable")?;
    let native_pid = read_event(&event_path(&paths(key)?.extension, "SessionStart"))?.0;
    // The pane's process is the shell Claude runs under
    // (`agent_runtime::in_shell`), so Claude is that process's child.
    ensure!(
        session
            .pid
            .is_some_and(|pane| pane == native_pid || parent_pid(native_pid) == Some(pane)),
        "The active terminal pane is not this Claude process"
    );
    let Some(prompt) = prompt else {
        return Ok(Some("\u{1b}".into()));
    };
    let screen = client.snapshot(&terminal)?;
    // ponytail: this recognizes Claude's native empty prompt on the installed
    // TUI. Fail closed on other layouts; replace with a native editor API if
    // Claude exposes one. Never clear or append to an unsubmitted CLI draft.
    ensure!(
        prompt_is_empty(
            &screen.text,
            screen.cursor_row as usize,
            screen.cursor_col as usize
        ),
        "The CLI has a draft or dialog open. Finish it in CLI view before sending from UI."
    );
    Ok(Some(format!("\u{1b}[200~{prompt}\u{1b}[201~{SUBMIT}")))
}

const SUBMIT: &str = "\r";

/// Write what [`prepare_input`] returned. Claude resolves a pasted image path
/// into an `[Image #n]` chip asynchronously, and an Enter that arrives in the
/// same write is swallowed, leaving the prompt typed but unsent. Orca likewise
/// writes Enter separately after a pause.
// ponytail: a fixed pause under the input lock; the ceiling is a very slow
// image read. Upgrade path: wait for the chip to render on the PTY screen.
pub fn write_input(input: &str, write: &dyn Fn(&str) -> anyhow::Result<()>) -> anyhow::Result<()> {
    match input.strip_suffix(SUBMIT) {
        Some(body) if input.starts_with("\u{1b}[200~") => {
            write(body)?;
            std::thread::sleep(std::time::Duration::from_millis(250));
            write(SUBMIT)
        }
        _ => write(input),
    }
}

/// Did this `UserPromptSubmit` event report the text we sent?
///
/// Not equality: the CLI decorates what it accepts. Claude Code wraps every
/// bracketed paste — which is how [`prepare_input`] submits — in
/// `<pasted_content id="…">` tags carrying a random id, so an exact match is
/// never true and *every* prompt perch sends went unacknowledged, leaving a
/// delivered review packet reported as "could not be confirmed". The invariant
/// that actually matters is that the CLI submitted our text; the caller
/// already pins the same process, the same provider session, and a submission
/// newer than the stamp taken before the write, so containment is the whole
/// remaining question and it survives the wrapper changing shape again.
fn submitted(event: &Value, payload: &Value) -> bool {
    let (Some(reported), Some(sent)) = (event["prompt"].as_str(), payload["text"].as_str()) else {
        return false;
    };
    !sent.is_empty() && reported.contains(sent)
}

/// `(running, blocked)` after one hook event, or `None` if it says nothing
/// about the turn. Blocked means waiting on the human: a permission prompt,
/// or AskUserQuestion, which Claude reports as a plain PreToolUse while it
/// waits (Orca `claude-events.ts`). Any later tool event means it moved on.
fn turn_state(event: &Value) -> Option<(bool, bool)> {
    match event["hook_event_name"].as_str()? {
        "PermissionRequest" => Some((true, true)),
        "PreToolUse" => Some((true, event["tool_name"] == "AskUserQuestion")),
        "UserPromptSubmit" | "PostToolUse" | "PostToolUseFailure" => Some((true, false)),
        "SessionStart" | "Stop" | "StopFailure" | "SessionEnd" => Some((false, false)),
        _ => None,
    }
}

pub(super) async fn observe(
    key: &AgentKey,
    alive: Arc<dyn Fn() -> bool + Send + Sync>,
    on_snapshot: Arc<dyn Fn(NativeUiSnapshot) + Send + Sync>,
    snapshots: watch::Sender<Option<NativeUiSnapshot>>,
    mut commands: mpsc::Receiver<super::Command>,
    window: Arc<std::sync::atomic::AtomicUsize>,
) {
    let Ok(paths) = paths(key) else {
        return;
    };
    let mut events = HashMap::<String, (String, u32, Value)>::new();
    let mut history_key = String::new();
    let mut history: History = (Vec::new(), false, None);
    let mut roster = Vec::<crate::protocol::NativeUiSubagent>::new();
    let mut roster_key = String::new();
    let mut last = String::new();
    let mut revision = 0;
    let mut was_blocked = false;
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
                for event in self::events() {
                    let path = event_path(&paths.extension, event);
                    let current = stamp(&path);
                    if !current.is_empty() && events.get(event).is_none_or(|(old, _, _)| old != &current) {
                        if let Ok((pid, value)) = read_event(&path) { events.insert(event.to_string(), (current, pid, value)); changed = true; }
                    }
                }
                let Some((_, pid, start)) = events.get("SessionStart") else { continue; };
                let Some(session) = start["session_id"].as_str().filter(|id| uuid::Uuid::parse_str(id).is_ok()) else { continue; };
                let Some(path) = start["transcript_path"].as_str().map(Path::new) else { continue; };
                let shown = window.load(std::sync::atomic::Ordering::Relaxed);
                let next_history = format!("{session}:{}:{shown}", stamp(path));
                if next_history != history_key {
                    if let Ok(next) = transcript(path, session, shown) { history = next; history_key = next_history; changed = true; }
                    else if history_key.split(':').next() != Some(session) { history = (vec![], false, None); }
                }
                let next_roster_key = subagents_dir(path).map(|dir| roster_stamp(&dir)).unwrap_or_default();
                if next_roster_key != roster_key { roster = subagent_roster(path, SystemTime::now()); roster_key = next_roster_key; changed = true; }
                if !changed && pending.is_empty() && !was_blocked { continue; }
                let (mut running, mut blocked) = (false, false);
                let mut model = start["model"].as_str().map(|model| clip(model, 256));
                // SessionStart carries no mode; the prompt and tool hooks do, so it is as of the latest of them.
                let mut permission_mode = None;
                let mut ordered: Vec<_> = events.values().filter(|(_, event_pid, event)| event_pid == pid && event["session_id"] == session).collect();
                ordered.sort_by(|left, right| left.0.cmp(&right.0));
                for (_, _, event) in ordered {
                    if let Some(mode) = event["permission_mode"].as_str().and_then(super::session_options::claude_permission_mode) { permission_mode = Some(mode.to_string()); }
                    if event["hook_event_name"] == "PostModelSwitch" { model = event["to_model"].as_str().map(|model| clip(model, 256)); }
                    else if let Some(state) = turn_state(event) { (running, blocked) = state; }
                }
                if ends_interrupted(&history.0) { (running, blocked) = (false, false); }
                // The hook says a human is needed; the screen says which choices. The dialog may
                // draw after the hook fires, so keep reading while blocked.
                was_blocked = blocked;
                let request = if blocked { super::dialog::read(key) } else { None };
                let mut snapshot = NativeUiSnapshot { version: 1, revision: 0, pid: *pid, provider_session_id: session.into(), cwd: clip(start["cwd"].as_str().unwrap_or_default(), 4096), model, effort: None, permission_mode, running, blocked, request, context: history.2.clone(), messages: history.0.clone(), truncated: history.1, can_load_older: history.1 && shown < MAX_WINDOW, transcript: None, options: None, subagents: roster.clone() };
                let serialized = serde_json::to_string(&snapshot).unwrap_or_default();
                if serialized != last {
                    last = serialized; revision += 1; snapshot.revision = revision;
                    snapshots.send_replace(Some(snapshot.clone())); on_snapshot(snapshot);
                }
                pending.retain(|command| !command.reply.is_closed());
                for index in (0..pending.len()).rev() {
                    let Ok(payload) = serde_json::from_str::<Value>(&pending[index].payload) else { continue; };
                    let accepted = if payload["type"] == "cancel" { !running } else {
                        events.get("UserPromptSubmit").is_some_and(|(marker, event_pid, event)| event_pid == pid && event["session_id"] == session && submitted(event, &payload) && marker != payload["after"].as_str().unwrap_or_default())
                    };
                    if accepted { let command = pending.swap_remove(index); let _ = command.reply.send(Ok(true)); }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        empty_prompt, ends_interrupted, iso_ms, messages, prompt_row, roster_stamp, subagent_roster,
    };
    use serde_json::json;

    #[test]
    fn claude_timestamps_read_as_epoch_milliseconds() {
        assert_eq!(iso_ms("1970-01-01T00:00:00.000Z"), Some(0));
        assert_eq!(iso_ms("2026-11-06T21:22:20.679Z"), Some(1_794_000_140_679));
        // Leap day and a short fraction.
        assert_eq!(iso_ms("2024-02-29T00:00:01.5Z"), Some(1_709_164_801_500));
        assert_eq!(iso_ms("2026-11-06 21:22:20"), None);
    }

    /// A child's rows: (type, timestamp, stop_reason).
    type ChildRows<'a> = &'a [(&'a str, &'a str, Option<&'a str>)];

    /// Shapes written by Claude 2.1.319 for one background `Agent` call (probed 2026-11-06).
    fn session_with_children(
        children: &[(&str, serde_json::Value, ChildRows)],
    ) -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!("perch-subagents-{}", uuid::Uuid::new_v4()));
        let session = "aa4ebb17-b406-482d-887d-77e4da113b53";
        let dir = root.join(session).join("subagents");
        fs::create_dir_all(&dir).unwrap();
        for (id, meta, rows) in children {
            fs::write(dir.join(format!("agent-{id}.meta.json")), meta.to_string()).unwrap();
            let lines: Vec<String> = rows
                .iter()
                .map(|(kind, time, stop)| {
                    json!({"type": kind, "timestamp": time, "message": {"stop_reason": stop}})
                        .to_string()
                })
                .collect();
            fs::write(dir.join(format!("agent-{id}.jsonl")), lines.join("\n")).unwrap();
        }
        let transcript = root.join(format!("{session}.jsonl"));
        fs::write(&transcript, "").unwrap();
        transcript
    }

    // Seen live: the child's last reply sat before a row of ~85 KB, so a short tail never reached it.
    #[test]
    fn a_finished_childs_last_reply_is_found_behind_a_large_row() {
        let meta = json!({"description": "big", "finished": true});
        let rows: &[(&str, &str, Option<&str>)] = &[
            ("user", "2026-11-06T21:30:45.000Z", None),
            ("assistant", "2026-11-06T21:30:46.935Z", Some("end_turn")),
        ];
        let transcript = session_with_children(&[("big", meta, rows)]);
        let path = transcript
            .parent()
            .unwrap()
            .join("aa4ebb17-b406-482d-887d-77e4da113b53/subagents/agent-big.jsonl");
        let mut body = fs::read_to_string(&path).unwrap();
        body.push('\n');
        body.push_str(
            &json!({"type": "api-request", "timestamp": "2026-11-06T21:30:47.000Z", "blob": "x".repeat(85_000)})
                .to_string(),
        );
        fs::write(&path, body).unwrap();
        let roster = subagent_roster(&transcript, SystemTime::now());
        assert_eq!(roster[0].state, "completed");
        assert!(roster[0].settled_at.is_some());
        let _ = fs::remove_dir_all(transcript.parent().unwrap());
    }

    #[test]
    fn a_finished_child_that_ended_its_turn_is_completed_with_its_run_time() {
        let meta = json!({"agentType": "general-purpose", "description": "count words", "toolUseId": "toolu_01", "finished": true});
        let rows: &[(&str, &str, Option<&str>)] = &[
            ("user", "2026-11-06T21:22:20.679Z", None),
            ("assistant", "2026-11-06T21:22:22.075Z", Some("end_turn")),
            ("attachment", "2026-11-06T21:22:22.114Z", None),
        ];
        let transcript = session_with_children(&[("a3465b65339b5c3d5", meta, rows)]);
        let roster = subagent_roster(&transcript, SystemTime::now());
        assert_eq!(roster.len(), 1);
        let child = &roster[0];
        assert_eq!(
            (
                child.id.as_str(),
                child.label.as_str(),
                child.state.as_str()
            ),
            ("a3465b65339b5c3d5", "count words", "completed")
        );
        assert_eq!(child.agent_type.as_deref(), Some("general-purpose"));
        assert_eq!(child.tool_use_id.as_deref(), Some("toolu_01"));
        assert_eq!(
            child
                .settled_at
                .zip(child.started_at)
                .map(|(end, start)| end - start),
            Some(1_435)
        );
        let _ = fs::remove_dir_all(transcript.parent().unwrap());
    }

    #[test]
    fn an_unfinished_child_works_a_finished_one_with_no_stated_end_is_unknown_and_a_stale_one_is_lost(
    ) {
        let working = json!({"description": "still going", "finished": false});
        let unknown = json!({"description": "cut off", "finished": true});
        let rows: &[(&str, &str, Option<&str>)] = &[
            ("user", "2026-11-06T21:22:20.679Z", None),
            ("assistant", "2026-11-06T21:22:21.000Z", Some("tool_use")),
        ];
        let transcript = session_with_children(&[("a1", working, rows), ("a2", unknown, rows)]);
        let states = |now: SystemTime| {
            subagent_roster(&transcript, now)
                .into_iter()
                .map(|child| (child.id, child.state, child.settled_at.is_some()))
                .collect::<Vec<_>>()
        };
        assert_eq!(
            states(SystemTime::now()),
            [
                ("a1".into(), "working".into(), false),
                ("a2".into(), "unverifiable".into(), true)
            ]
        );
        // Nothing touched for a quarter of an hour: contact is lost, which is not an exit.
        let later = SystemTime::now() + Duration::from_secs(15 * 60);
        assert_eq!(states(later)[0].1, "unverifiable");
        // The stamp changes when a meta file does, so the observer re-reads.
        let dir = transcript
            .parent()
            .unwrap()
            .join("aa4ebb17-b406-482d-887d-77e4da113b53/subagents");
        let before = roster_stamp(&dir);
        std::thread::sleep(Duration::from_millis(20));
        fs::write(
            dir.join("agent-a1.meta.json"),
            json!({"finished": true}).to_string(),
        )
        .unwrap();
        assert_ne!(roster_stamp(&dir), before);
        let _ = fs::remove_dir_all(transcript.parent().unwrap());
    }

    #[test]
    fn an_unreadable_or_oddly_named_child_file_is_skipped() {
        let transcript = session_with_children(&[("ok", json!({"finished": false}), &[])]);
        let dir = transcript
            .parent()
            .unwrap()
            .join("aa4ebb17-b406-482d-887d-77e4da113b53/subagents");
        fs::write(dir.join("agent-bad.meta.json"), "{not json").unwrap();
        fs::write(dir.join("agent-a b.meta.json"), "{}").unwrap();
        let ids: Vec<_> = subagent_roster(&transcript, SystemTime::now())
            .into_iter()
            .map(|child| child.id)
            .collect();
        assert_eq!(ids, ["ok"]);
        let _ = fs::remove_dir_all(transcript.parent().unwrap());
    }

    // Shapes from Claude 2.1.318 transcripts (Orca's `transcript-interruption-message.test.ts` case).
    fn interrupt_row(text: &str, marker: bool) -> serde_json::Value {
        let mut row = json!({
            "type": "user", "uuid": "interrupt-row", "timestamp": "2026-07-16T23:46:01.000Z",
            "message": {"role": "user", "content": [{"type": "text", "text": text}]}
        });
        if marker {
            row["interruptedMessageId"] = json!("assistant-request-1");
        }
        row
    }

    #[test]
    fn claude_interruption_boilerplate_is_one_quiet_status_row() {
        for (text, marker) in [
            ("[Request interrupted by user]", true),
            ("[Request interrupted by user for tool use]", true),
            ("[Request interrupted by user for tool use]", false),
        ] {
            let rows = messages(&interrupt_row(text, marker));
            assert_eq!(rows.len(), 1);
            assert_eq!(rows[0].id, "interrupt-row");
            assert_eq!(rows[0].role, "system");
            assert_eq!(rows[0].text, "Conversation interrupted");
            assert!(ends_interrupted(&rows));
        }
    }

    fn user_row(content: serde_json::Value) -> serde_json::Value {
        json!({"type": "user", "uuid": "u", "message": {"role": "user", "content": content}})
    }

    #[test]
    fn command_envelopes_show_a_skill_hide_a_builtin_and_hide_local_output() {
        let skill = messages(&user_row(json!(
            "<command-message>perchping</command-message>\n<command-name>/perchping</command-name>\n<command-args>now</command-args>"
        )));
        assert_eq!(skill[0].text, "/perchping now");
        // `plan` is one of Claude's own commands; its output row is machinery too.
        let plan = "<command-name>/plan</command-name>\n    <command-message>plan</command-message>\n    <command-args>x</command-args>";
        assert!(messages(&user_row(json!(plan))).is_empty());
        assert!(messages(&user_row(json!([{"type": "text", "text": plan}]))).is_empty());
        assert!(messages(&user_row(json!(
            "<local-command-stdout>Enabled plan mode</local-command-stdout>"
        )))
        .is_empty());
        assert_eq!(
            messages(&user_row(json!("<bash-input>ls</bash-input>")))[0].text,
            "!ls"
        );
        assert_eq!(
            messages(&user_row(json!("fix the bug")))[0].text,
            "fix the bug"
        );
    }

    #[test]
    fn an_ordinary_user_message_that_quotes_the_boilerplate_stays_a_prompt() {
        let rows = messages(&interrupt_row(
            "why does it say [Request interrupted by user]?",
            false,
        ));
        assert_eq!(rows[0].role, "user");
        assert!(!ends_interrupted(&rows));
    }

    /// Captured from a Claude started in a Terminal tab: the prompt is row 7 but the cursor was reported on 8.
    #[test]
    fn prompt_is_found_by_its_box_not_the_cursor_row() {
        let rule = "─".repeat(40);
        let screen = format!("claude --dang%\n ▐▛███▛█   Claude Code\n\n{rule}\n❯\u{a0}\n{rule}\n  \u{a0}Haiku\u{a0}4.5\n  ⏵⏵ bypass permissions on");
        assert!(
            empty_prompt(prompt_row(&screen, 5)),
            "cursor one row below the prompt"
        );
        assert!(empty_prompt(prompt_row(&screen, 99)), "cursor off screen");
        let draft = screen.replace("❯\u{a0}", "❯ half-typed message");
        assert!(
            !empty_prompt(prompt_row(&draft, 5)),
            "an unsent draft must still block a send"
        );
        let dialog = format!("{rule}\n❯ 1. Yes\n  2. No\n");
        assert!(
            !empty_prompt(prompt_row(&dialog, 1)),
            "a permission dialog is not an empty prompt"
        );
    }

    /// Captured from Claude 2.1.319 started under a private config with prompt suggestions on: the greyed
    /// example sits in the box, the cursor (row 5, column 2) is parked on its first letter, and the daemon
    /// keeps no colour. Before this, every chat send was refused as "a draft is open".
    fn fresh_claude_screen(prompt: &str) -> String {
        let rule = "─".repeat(100);
        format!("\n ▐▛███▜▌   Claude Code v2.1.319\n▝▜█████▛▘  Haiku 4.5\n\n{rule}\n{prompt}\n{rule}\n  my-status-line\n  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents")
    }

    #[test]
    fn the_greyed_try_example_is_not_a_draft_but_typed_text_is() {
        let example = fresh_claude_screen("❯\u{a0}Try \"fix lint errors\"");
        assert!(
            prompt_is_empty(&example, 5, 2),
            "cursor parked on the example"
        );
        let other = fresh_claude_screen("❯\u{a0}Try \"how do I log an error?\"");
        assert!(prompt_is_empty(&other, 5, 2), "the wording rotates");
        // A draft leaves the cursor at its end, even when it has the example's shape.
        let typed = fresh_claude_screen("❯\u{a0}Try \"x\"");
        assert!(!prompt_is_empty(&typed, 5, 9), "cursor after typed text");
        assert!(!prompt_is_empty(&example, 5, 9), "cursor not at the start");
        assert!(!prompt_is_empty(&example, 6, 2), "cursor on another row");
        assert!(!prompt_is_empty(&example, 99, 2), "cursor off screen");
        // Other text, even at the cursor's start, is a draft: a suggestion or a real message.
        for text in [
            "fix the bug",
            "Try fixing it",
            "Try \"\"",
            "Try \"a\" and \"b\"",
            "Try \"unclosed",
        ] {
            let screen = fresh_claude_screen(&format!("❯\u{a0}{text}"));
            assert!(!prompt_is_empty(&screen, 5, 2), "{text}");
        }
        assert!(prompt_is_empty(&fresh_claude_screen("❯\u{a0}"), 5, 2));
    }

    #[test]
    fn parent_pid_reads_this_process_parent() {
        let child = std::process::Command::new("sleep")
            .arg("5")
            .spawn()
            .unwrap();
        assert_eq!(super::parent_pid(child.id()), Some(std::process::id()));
        let _ = { child }.kill();
    }

    use super::*;
    #[test]
    fn context_sums_the_last_response_and_guesses_the_window_from_the_model() {
        let row = |model: &str, input: u64, cache: u64| serde_json::json!({"type":"assistant","message":{"model":model,"usage":{"input_tokens":input,"cache_read_input_tokens":cache,"output_tokens":10}}});
        let small = context(&row("claude-haiku-4-5", 100, 900)).unwrap();
        assert_eq!(
            (small.used_tokens, small.window_tokens, small.estimated),
            (1010, 200_000, true)
        );
        assert_eq!(
            context(&row("claude-opus-4-7[1m]", 100, 900))
                .unwrap()
                .window_tokens,
            1_000_000
        );
        // Past 200k the window can only be the large one.
        assert_eq!(
            context(&row("claude-opus-4-7", 100, 250_000))
                .unwrap()
                .window_tokens,
            1_000_000
        );
        // Synthetic responses report zero usage.
        assert!(context(&serde_json::json!({"type":"assistant","message":{"model":"<synthetic>","usage":{"input_tokens":0}}})).is_none());
    }

    /// The exact payload Claude Code wrote for a prompt perch had sent as a
    /// bracketed paste, captured from `UserPromptSubmit` on the installed CLI.
    /// Equality against it is false, which is what silently turned every
    /// delivered prompt into "delivery could not be confirmed".
    #[test]
    fn a_prompt_the_cli_wrapped_in_paste_tags_still_counts_as_submitted() {
        let sent = "Reply with exactly PHONE_UI_tyrz2w. Do not use tools or modify files.";
        let wrapped = serde_json::json!({
            "prompt": format!("\n\n<pasted_content id=\"cafd\">\n{sent}\n</pasted_content id=\"cafd\">\n"),
        });
        let payload = serde_json::json!({ "text": sent });
        assert_ne!(
            wrapped["prompt"], payload["text"],
            "fixture must be the decorated form"
        );
        assert!(submitted(&wrapped, &payload));

        // Undecorated CLIs keep working, and a different prompt is not ours.
        assert!(submitted(&serde_json::json!({ "prompt": sent }), &payload));
        assert!(!submitted(
            &serde_json::json!({ "prompt": "something the user typed instead" }),
            &payload
        ));
        // An empty send must never be satisfied by an arbitrary submission.
        assert!(!submitted(
            &serde_json::json!({ "prompt": "anything at all" }),
            &serde_json::json!({ "text": "" })
        ));
        // A cancel payload carries no text and cannot match this way.
        assert!(!submitted(
            &serde_json::json!({ "prompt": sent }),
            &serde_json::json!({ "type": "cancel" })
        ));
    }

    #[test]
    fn permission_prompts_and_questions_block_until_the_next_tool_event() {
        let event = |name: &str, tool: &str| serde_json::json!({"hook_event_name": name, "tool_name": tool});
        let replay = |names: &[(&str, &str)]| {
            names
                .iter()
                .rev()
                .find_map(|(n, t)| turn_state(&event(n, t)))
        };
        assert_eq!(
            replay(&[
                ("UserPromptSubmit", ""),
                ("PreToolUse", "Bash"),
                ("PermissionRequest", "Bash")
            ]),
            Some((true, true))
        );
        assert_eq!(
            replay(&[("PermissionRequest", "Bash"), ("PostToolUse", "Bash")]),
            Some((true, false))
        );
        assert_eq!(
            replay(&[("PreToolUse", "AskUserQuestion")]),
            Some((true, true))
        );
        assert_eq!(
            replay(&[
                ("PreToolUse", "AskUserQuestion"),
                ("PostToolUseFailure", "AskUserQuestion")
            ]),
            Some((true, false))
        );
        assert_eq!(
            replay(&[("PermissionRequest", "Bash"), ("Stop", "")]),
            Some((false, false))
        );
        assert_eq!(replay(&[("PostModelSwitch", "")]), None);
    }

    /// Cases from Orca's `claude-hook-event-versions.test.ts` (identified version output).
    #[test]
    fn only_claudes_own_version_line_names_the_version() {
        for (output, expected) in [
            ("2.1.310 (Claude Code)\n", Some("2.1.310")),
            ("1.0.23 (Claude Code)", Some("1.0.23")),
            ("launcher 11.17.0\n1.0.64 (Claude Code)", Some("1.0.64")),
            ("launcher 0.1.0\n2.1.310 (Claude Code)", Some("2.1.310")),
            (
                "2.1.94-rc.1+build.2 (Claude Code)",
                Some("2.1.94-rc.1+build.2"),
            ),
            ("11.17.0\n", None),
            ("2.30.0", None),
            ("2.1.310\nwrapper for (Claude Code)", None),
            ("2.1.310\n(Claude Code)", None),
            ("2.1 (Claude Code)", None),
        ] {
            assert_eq!(
                parse_version_output(output).as_deref(),
                expected,
                "{output:?}"
            );
        }
    }

    #[test]
    fn an_event_is_registered_only_once_the_cli_has_reached_its_floor() {
        let all: Vec<_> = events().collect();
        assert_eq!(events_for(Some("2.1.319")), all);
        // Measured delivery of SessionEnd starts at 2.1.261.
        assert!(!events_for(Some("2.1.260")).contains(&"SessionEnd"));
        assert!(events_for(Some("2.1.261")).contains(&"SessionEnd"));
        // An unreadable version gets only the events every hook-capable Claude knows.
        let old = [
            "SessionStart",
            "UserPromptSubmit",
            "PreToolUse",
            "PostToolUse",
            "Stop",
        ];
        assert_eq!(events_for(None), old);
        assert_eq!(events_for(Some("1.0.64")), old);
        assert_eq!(events_for(Some("not a version")), old);
        assert!(events_for(Some("2.0.45")).contains(&"PermissionRequest"));
        assert!(!events_for(Some("2.0.44")).contains(&"PermissionRequest"));
    }

    #[test]
    fn settings_name_no_event_the_cli_would_reject() {
        let config = std::env::temp_dir().join("perch-settings-floor.json");
        let hooks: Value =
            serde_json::from_str(&settings(&config, false, Some("1.0.64")).unwrap()).unwrap();
        let names: Vec<_> = hooks["hooks"]
            .as_object()
            .unwrap()
            .keys()
            .cloned()
            .collect();
        assert_eq!(names.len(), 5);
        assert!(!names.contains(&"PermissionRequest".to_string()));
    }

    /// Hook files are what the poll loop really sees: the PID line, then the
    /// event JSON. `read_event` must keep what `turn_state` reads, or a
    /// question would never block.
    #[test]
    fn a_question_event_read_from_its_hook_file_still_blocks() {
        let dir = std::env::temp_dir().join(format!("perch-hook-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("PreToolUse.event");
        let body = serde_json::json!({
            "session_id": "s", "hook_event_name": "PreToolUse", "tool_name": "AskUserQuestion",
            "tool_use_id": "toolu_1", "tool_input": {"secret": "dropped"}, "cwd": "/w"
        });
        fs::write(&path, format!("4242\n{body}")).unwrap();
        let (pid, event) = read_event(&path).unwrap();
        assert_eq!(pid, 4242);
        assert_eq!(event["tool_use_id"], "toolu_1");
        assert!(
            event.get("tool_input").is_none(),
            "unlisted fields stay dropped"
        );
        assert_eq!(turn_state(&event), Some((true, true)));
        let _ = fs::remove_dir_all(&dir);
    }

    /// Claude 2.1.319's UserPromptSubmit hook input names the mode (`acceptEdits`, seen live);
    /// SessionStart does not.
    #[test]
    fn a_prompt_hook_keeps_the_permission_mode_the_toolbar_reads_back() {
        let dir = std::env::temp_dir().join(format!("perch-hook-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("UserPromptSubmit.event");
        let body = serde_json::json!({"session_id": "s", "hook_event_name": "UserPromptSubmit", "permission_mode": "acceptEdits", "prompt": "hi"});
        fs::write(&path, format!("4242\n{body}")).unwrap();
        let (_, event) = read_event(&path).unwrap();
        assert_eq!(
            event["permission_mode"]
                .as_str()
                .and_then(super::super::session_options::claude_permission_mode),
            Some("accept-edits")
        );
        let _ = fs::remove_dir_all(&dir);
    }

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

    /// A transcript of `count` chained messages, written as Claude does (one JSON row each).
    fn write_transcript(count: usize, text: &str) -> (Removed, std::path::PathBuf, String) {
        let session = uuid::Uuid::new_v4().to_string();
        let dir = std::env::temp_dir().join(format!("perch-claude-transcript-{session}"));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join(format!("{session}.jsonl"));
        let mut rows = String::new();
        for n in 0..count {
            let parent = if n == 0 {
                Value::Null
            } else {
                format!("m{}", n - 1).into()
            };
            let (kind, role) = if n % 2 == 0 {
                ("user", "user")
            } else {
                ("assistant", "assistant")
            };
            rows += &serde_json::json!({"type": kind, "uuid": format!("m{n}"), "parentUuid": parent, "sessionId": session,
                "message": {"role": role, "content": format!("{text} {n}")}}).to_string();
            rows.push('\n');
        }
        fs::write(&path, rows).unwrap();
        (Removed(dir), path, session)
    }

    /// Deletes the directory when the test ends, passing or not.
    struct Removed(std::path::PathBuf);
    impl Drop for Removed {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn a_larger_window_reads_further_back_until_the_file_is_exhausted() {
        let (_dir, path, session) = write_transcript(500, "hello");
        let (first, truncated, _) = transcript(&path, &session, WINDOW).unwrap();
        assert_eq!(first.len(), 128);
        assert!(truncated);
        assert_eq!(first.last().unwrap().text, "hello 499");
        let (more, truncated, _) = transcript(&path, &session, WINDOW + PAGE).unwrap();
        assert_eq!(more.len(), 328);
        assert!(truncated);
        // The older page is prepended: the newest messages are the same ones.
        let ids =
            |rows: &[NativeUiMessage]| rows.iter().map(|row| row.id.clone()).collect::<Vec<_>>();
        assert_eq!(ids(&more[more.len() - 128..]), ids(&first));
        let (all, truncated, _) = transcript(&path, &session, MAX_WINDOW).unwrap();
        assert_eq!(all.len(), 500);
        assert!(!truncated, "the whole file fits, so nothing older exists");
    }

    /// The whole path with no CLI: hook files and a transcript on disk, the real observer, and
    /// the bridge's page request. No model turn is involved.
    #[tokio::test]
    async fn paging_through_the_real_observer_reads_further_back_and_stops_at_the_start() {
        use std::sync::atomic::{AtomicBool, Ordering};
        let (_dir, path, session) = write_transcript(300, "hello");
        let key = AgentKey::new("native-test", uuid::Uuid::new_v4().to_string(), "claude").unwrap();
        let paths = paths(&key).unwrap();
        let start = event_path(&paths.extension, "SessionStart");
        let event = serde_json::json!({"session_id": session, "transcript_path": path, "cwd": "/",
            "hook_event_name": "SessionStart", "model": "claude-haiku-4-5"});
        fs::write(&start, format!("{}\n{event}", std::process::id())).unwrap();
        let alive = Arc::new(AtomicBool::new(true));
        let registry = Arc::new(super::super::NativeUiRegistry::default());
        let watched = alive.clone();
        registry
            .start(
                key.clone(),
                None,
                Arc::new(move || watched.load(Ordering::Relaxed)),
                Arc::new(|_| {}),
            )
            .unwrap();
        let bridge = registry.get(&key).unwrap();
        let first = bridge.snapshot().await.unwrap();
        assert_eq!(first.messages.len(), 128);
        assert!(first.truncated && first.can_load_older);
        assert_eq!(first.messages.last().unwrap().text, "hello 299");
        assert_eq!(
            bridge.load_older().await,
            crate::protocol::OlderPageOutcome::Applied
        );
        let all = bridge.latest().unwrap();
        assert_eq!(all.messages.len(), 300);
        assert!(!all.truncated && !all.can_load_older);
        assert_eq!(all.messages.first().unwrap().text, "hello 0");
        assert_eq!(
            bridge.load_older().await,
            crate::protocol::OlderPageOutcome::Exhausted
        );
        alive.store(false, Ordering::Relaxed);
        let _ = fs::remove_file(start);
    }

    #[test]
    fn a_larger_window_also_lifts_the_byte_budget() {
        // 1 KiB per message: 128 of them are past 192 KiB's worth only when about 190 fit.
        let (_dir, path, session) = write_transcript(400, &"x".repeat(2048));
        let (small, truncated, _) = transcript(&path, &session, WINDOW).unwrap();
        assert!(truncated && small.len() < 128, "{} messages", small.len());
        let (large, _, _) = transcript(&path, &session, WINDOW + PAGE).unwrap();
        assert!(large.len() > small.len());
    }

    #[test]
    fn an_edit_keeps_its_text_and_its_resolved_hunks_ride_on_the_result() {
        let content = "line of the new file\n".repeat(100);
        let call = serde_json::json!({"type":"assistant","uuid":"m","message":{"content":[
            {"type":"tool_use","id":"1","name":"Write","input":{"file_path":"/r/a.txt","content":content}}]}});
        let tool = &messages(&call)[0].tools[0];
        // Past the 300 characters other tools keep, and whole: nothing says it was cut.
        let input: Value = serde_json::from_str(&tool.input).unwrap();
        assert_eq!(input["content"].as_str().unwrap(), content);
        assert!(input.get(crate::native_ui::edits::CLIPPED_KEY).is_none());
        let huge = serde_json::json!({"type":"assistant","uuid":"m","message":{"content":[
            {"type":"tool_use","id":"1","name":"Write","input":{"file_path":"/r/a.txt","content":"y".repeat(20_000)}}]}});
        let cut: Value = serde_json::from_str(&messages(&huge)[0].tools[0].input).unwrap();
        assert_eq!(cut[crate::native_ui::edits::CLIPPED_KEY], true);

        let row = serde_json::json!({"type":"user","uuid":"u",
            "message":{"content":[{"type":"tool_result","tool_use_id":"1","content":"ok"}]},
            "toolUseResult":{"filePath":"/r/a.txt","structuredPatch":[
                {"oldStart":3,"oldLines":2,"newStart":3,"newLines":2,"lines":[" a","-b","+c"]},
                {"oldStart":"bad","lines":[]}]}});
        let patch = messages(&row)[0].edit_patch.clone().unwrap();
        assert_eq!(patch.file_path.as_deref(), Some("/r/a.txt"));
        assert_eq!(patch.hunks.len(), 1);
        assert_eq!(patch.hunks[0].lines, [" a", "-b", "+c"]);
        // A result with no patch (a failed edit's text), or an empty one, carries none.
        let plain = serde_json::json!({"type":"user","uuid":"u",
            "message":{"content":[{"type":"tool_result","tool_use_id":"1","content":"x"}]},
            "toolUseResult":"Error: nope"});
        assert!(messages(&plain)[0].edit_patch.is_none());
        let empty = serde_json::json!({"type":"user","uuid":"u",
            "message":{"content":[{"type":"tool_result","tool_use_id":"1","content":"x"}]},
            "toolUseResult":{"structuredPatch":[]}});
        assert!(messages(&empty)[0].edit_patch.is_none());
    }

    #[test]
    fn a_long_todo_list_keeps_parseable_input() {
        let todos: Vec<_> = (0..30)
            .map(|n| serde_json::json!({"content": format!("Task number {n} with a fairly descriptive name"), "status": "pending", "activeForm": format!("Doing task number {n} with a fairly descriptive name")}))
            .collect();
        let row = serde_json::json!({"type":"assistant","uuid":"m","message":{"content":[
            {"type":"tool_use","id":"1","name":"TodoWrite","input":{"todos": todos}},
            {"type":"tool_use","id":"2","name":"Bash","input":{"command":"x".repeat(5000)}}]}});
        let tools = messages(&row).remove(0).tools;
        assert!(tools[0].input.len() > 2048);
        let list = crate::native_ui::tasks::normalize(&tools[0].name, &tools[0].input).unwrap();
        assert_eq!(list.tasks.len(), 30);
        // Other tools keep their smaller cap.
        assert!(tools[1].input.len() <= 2048);
    }
}
