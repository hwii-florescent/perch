//! What the native chat draws, derived from a snapshot's raw provider messages. The web renders
//! this and holds no transcript logic.
//!
//! Ported from Orca's `shared/native-chat` (commit 308b5000): `tools/native-chat-tool-pairs.ts`
//! (call ↔ result pairing), `native-chat-tool-icon.ts` (categories), `native-chat-tool-line-label.ts`
//! and `native-chat-tool-summary.ts` (a call's verb and target), `native-chat-tool-run-sentence.ts`
//! (the run header), `native-chat-tool-activity.ts` (the live line), `native-chat-work-run.ts` and
//! `native-chat-turn-grouping.ts` (runs and turns).
//!
//! The input is `NativeUiMessage`s, which come from four different providers, so everything here
//! is tolerant: a call without an id pairs with the oldest unanswered call; an input that is not
//! JSON is shown as written; a result with no call is kept as its own row. Where Orca reads
//! structured journal fields we do not have (timestamps, ask/plan frames, subagent rosters) the
//! slice is not ported; see `docs/NATIVE-UI-PARITY.md`.
use crate::protocol::{NativeUiMessage, NativeUiSnapshot, NativeUiTool, NativeUiToolState};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::HashMap, sync::OnceLock};

const MAX_PREVIEW: usize = 80;
const MAX_DETAIL: usize = 4000;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeUiTranscript {
    pub blocks: Vec<NativeUiBlock>,
    /// The live activity line while a turn runs and nothing waits on the person:
    /// "Running npm test", "Thinking" or "Working…".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub working: Option<String>,
    /// The agent's own to-do list as of its latest plan call (`native_ui/tasks.rs`), docked above
    /// the composer; absent when it has none.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tasks: Option<super::tasks::TaskList>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum NativeUiBlock {
    /// A message the reader reads. `id` is the `NativeUiMessage` it draws.
    #[serde(rename_all = "camelCase")]
    Message {
        id: String,
        turn: String,
        #[serde(default, skip_serializing_if = "std::ops::Not::not")]
        live: bool,
    },
    /// Consecutive thinking and tool calls, folded into one row.
    #[serde(rename_all = "camelCase")]
    Run {
        id: String,
        /// The user message that opened the turn this block belongs to; empty before the first.
        turn: String,
        #[serde(default, skip_serializing_if = "std::ops::Not::not")]
        live: bool,
        /// "Read 3 files and ran 2 commands" (present tense while live).
        summary: String,
        calls: u32,
        failed: u32,
        steps: Vec<NativeUiStep>,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeUiStep {
    pub id: String,
    pub kind: StepKind,
    /// "Ran npm test", "Read lib.rs", "Thinking".
    pub label: String,
    /// The call's input (a command is shown as the command), the thinking, or an unpaired result.
    pub body: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool: Option<NativeUiToolLine>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StepKind {
    Thinking,
    Tool,
    Result,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeUiToolLine {
    pub category: ToolCategory,
    pub state: LineState,
    /// The result this call owns.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ToolCategory {
    Read,
    Search,
    ListFiles,
    Command,
    FileChange,
    WebSearch,
    Mcp,
    Subagent,
    Todo,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LineState {
    Running,
    Completed,
    Failed,
    /// No result and the turn is over: neither success nor failure is known.
    Unfinished,
}

// ---- Tool vocabulary ------------------------------------------------------------------------

const COMMAND_NAMES: &[&str] = &[
    "bash",
    "shell",
    "powershell",
    "terminal",
    "execute",
    "run_command",
    "run_shell_command",
    "shell_command",
    "exec_command",
    "run_terminal_cmd",
    "run_terminal_command",
    "exec",
    "local_shell",
];

/// Claude, Codex (app-server item names), Pi, OMP and OpenCode tool names, lowercased.
fn category(name: &str) -> ToolCategory {
    let word = name.trim().to_lowercase();
    if word.starts_with("mcp__") {
        return ToolCategory::Mcp;
    }
    if COMMAND_NAMES.contains(&word.as_str()) {
        return ToolCategory::Command;
    }
    match word.as_str() {
        "read" => ToolCategory::Read,
        "search" | "grep" | "glob" | "find" => ToolCategory::Search,
        "list" | "ls" => ToolCategory::ListFiles,
        "edit" | "multiedit" | "write" | "str_replace" | "apply_patch" | "notebookedit"
        | "diff" | "file changes" => ToolCategory::FileChange,
        "webfetch" | "websearch" | "web search" | "web_search" => ToolCategory::WebSearch,
        "task" | "agent" | "subagent" => ToolCategory::Subagent,
        "todowrite" | "update_plan" | "todo" => ToolCategory::Todo,
        _ => ToolCategory::Other,
    }
}

fn clause(category: ToolCategory, count: usize, live: bool) -> String {
    let (one, many): (&str, &str) = match (category, live) {
        (ToolCategory::Read, false) => ("Read 1 file", "Read {} files"),
        (ToolCategory::Read, true) => ("Reading 1 file", "Reading {} files"),
        (ToolCategory::Search, false) => ("Searched 1 time", "Searched {} times"),
        (ToolCategory::Search, true) => ("Searching 1 time", "Searching {} times"),
        (ToolCategory::ListFiles, false) => ("Listed 1 directory", "Listed {} directories"),
        (ToolCategory::ListFiles, true) => ("Listing 1 directory", "Listing {} directories"),
        (ToolCategory::Command, false) => ("Ran 1 command", "Ran {} commands"),
        (ToolCategory::Command, true) => ("Running 1 command", "Running {} commands"),
        (ToolCategory::FileChange, false) => ("Edited 1 file", "Edited {} files"),
        (ToolCategory::FileChange, true) => ("Editing 1 file", "Editing {} files"),
        (ToolCategory::WebSearch, false) => {
            ("Searched the web 1 time", "Searched the web {} times")
        }
        (ToolCategory::WebSearch, true) => {
            ("Searching the web 1 time", "Searching the web {} times")
        }
        (ToolCategory::Mcp, false) => ("Used 1 integration", "Used {} integrations"),
        (ToolCategory::Mcp, true) => ("Using 1 integration", "Using {} integrations"),
        (ToolCategory::Subagent, false) => ("Ran 1 agent", "Ran {} agents"),
        (ToolCategory::Subagent, true) => ("Running 1 agent", "Running {} agents"),
        (ToolCategory::Todo, false) => ("Updated the plan", "Updated the plan {} times"),
        (ToolCategory::Todo, true) => ("Updating the plan", "Updating the plan {} times"),
        (ToolCategory::Other, false) => ("Used 1 tool", "Used {} tools"),
        (ToolCategory::Other, true) => ("Using 1 tool", "Using {} tools"),
    };
    if count == 1 {
        one.into()
    } else {
        many.replace("{}", &count.to_string())
    }
}

/// Categories in first-use order, so the sentence follows the work: "Read 2 files, searched 1 time
/// and ran 3 commands". Only the first clause is capitalised.
fn sentence(categories: &[ToolCategory], live: bool) -> String {
    let mut counts: Vec<(ToolCategory, usize)> = vec![];
    for category in categories {
        match counts.iter_mut().find(|(seen, _)| seen == category) {
            Some((_, count)) => *count += 1,
            None => counts.push((*category, 1)),
        }
    }
    let clauses: Vec<String> = counts
        .iter()
        .enumerate()
        .map(|(index, (category, count))| {
            let text = clause(*category, *count, live);
            if index == 0 {
                return text;
            }
            let mut chars = text.chars();
            chars.next().map_or(String::new(), |first| {
                first.to_lowercase().chain(chars).collect()
            })
        })
        .collect();
    match clauses.as_slice() {
        [] => String::new(),
        [only] => only.clone(),
        [first, second] => format!("{first} and {second}"),
        [leading @ .., last] => format!("{}, and {last}", leading.join(", ")),
    }
}

// ---- Tool input ------------------------------------------------------------------------------

/// A provider's input text as a value: JSON objects and arrays are parsed, anything else (a Codex
/// shell command, input clipped mid-JSON) stays a string. A clipped object keeps the few fields a
/// row is named by, so a long edit still says which file it touched.
fn normalize(input: &str) -> Value {
    let trimmed = input.trim_start();
    if trimmed.starts_with('{') || trimmed.starts_with('[') {
        if let Ok(value @ (Value::Object(_) | Value::Array(_))) = serde_json::from_str(input) {
            return value;
        }
        static FIELD: OnceLock<regex::Regex> = OnceLock::new();
        let field = FIELD.get_or_init(|| {
            regex::Regex::new(
                r#""(file_path|filePath|path|command|cmd|query|pattern|url|description)"\s*:\s*"((?:[^"\\]|\\.)*)""#,
            )
            .unwrap()
        });
        let salvaged: serde_json::Map<String, Value> = field
            .captures_iter(input)
            .filter_map(|capture| {
                let text = serde_json::from_str::<String>(&format!("\"{}\"", &capture[2])).ok()?;
                Some((capture[1].to_string(), Value::String(text)))
            })
            .collect();
        if !salvaged.is_empty() {
            return Value::Object(salvaged);
        }
    }
    Value::String(input.to_string())
}

fn clip_chars(text: &str, limit: usize) -> String {
    if text.chars().count() <= limit {
        return text.to_string();
    }
    let mut clipped: String = text.chars().take(limit - 1).collect();
    clipped.push('…');
    clipped
}

fn collapse(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Strip a login-shell wrapper (`/bin/zsh -lc '…'`) only when the rest is one quoted shell word.
pub fn unwrap_login_shell(command: &str) -> String {
    static PREFIX: OnceLock<regex::Regex> = OnceLock::new();
    let prefix = PREFIX.get_or_init(|| {
        regex::Regex::new(
            r#"^\s*(?:[^'"]*[\\/])?(?:ba|z|k|da|fi)?sh(?:\.exe)?\s+-[a-zA-Z]*c\s+(['"])"#,
        )
        .unwrap()
    });
    let Some(found) = prefix.captures(command) else {
        return command.to_string();
    };
    // The quote belongs to the word that follows.
    let start = found.get(1).unwrap().start();
    decode_shell_word(command[start..].trim_end()).unwrap_or_else(|| command.to_string())
}

/// Undo POSIX quoting of one word; `None` for anything else (pipelines, unpaired quotes).
fn decode_shell_word(word: &str) -> Option<String> {
    let chars: Vec<char> = word.chars().collect();
    let mut out = String::new();
    let mut index = 0;
    while index < chars.len() {
        match chars[index] {
            '\'' => {
                let end = chars[index + 1..].iter().position(|c| *c == '\'')? + index + 1;
                out.extend(&chars[index + 1..end]);
                index = end + 1;
            }
            '"' => {
                index += 1;
                loop {
                    let c = *chars.get(index)?;
                    if c == '"' {
                        index += 1;
                        break;
                    }
                    if c == '\\' {
                        match chars.get(index + 1) {
                            Some('\n') => index += 2,
                            Some(next) if "$`\"\\".contains(*next) => {
                                out.push(*next);
                                index += 2;
                            }
                            _ => {
                                out.push('\\');
                                index += 1;
                            }
                        }
                    } else {
                        out.push(c);
                        index += 1;
                    }
                }
            }
            '\\' if index + 1 < chars.len() => {
                if chars[index + 1] != '\n' {
                    out.push(chars[index + 1]);
                }
                index += 2;
            }
            c if c.is_alphanumeric() || "_@%+=:,./-".contains(c) => {
                out.push(c);
                index += 1;
            }
            _ => return None,
        }
    }
    Some(out)
}

/// A label-worthy string argument: non-blank text, or an argv array of strings.
fn primary(value: &Value) -> Option<String> {
    match value {
        Value::String(text) if !text.trim().is_empty() => {
            Some(preview(&Value::String(text.clone())))
        }
        Value::Array(parts) if !parts.is_empty() && parts.iter().all(Value::is_string) => {
            let joined: Vec<&str> = parts.iter().filter_map(Value::as_str).collect();
            Some(preview(&Value::String(joined.join(" "))))
        }
        _ => None,
    }
}

fn first_primary(object: &serde_json::Map<String, Value>, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| object.get(*key).and_then(primary))
}

/// One line of an input: a string as written. A structure with no argument worth naming says
/// nothing here (its JSON is in the row's body), rather than printing `{"questions":[{"head…`.
fn preview(input: &Value) -> String {
    let raw = match input {
        Value::String(text) => text.clone(),
        Value::Number(_) | Value::Bool(_) => input.to_string(),
        _ => String::new(),
    };
    clip_chars(&collapse(&unwrap_login_shell(&raw)), MAX_PREVIEW)
}

fn file_path(input: &Value) -> Option<String> {
    // Codex's file changes are a list of `{path, kind, diff}`.
    let first_path = |changes: &Value| {
        changes
            .as_array()?
            .iter()
            .find_map(|change| change.get("path").filter(|path| path.is_string()).cloned())
    };
    if input.is_array() {
        return first_path(input)?
            .as_str()
            .filter(|p| !p.is_empty())
            .map(str::to_string);
    }
    let object = input.as_object()?;
    let searching = object.get("query").and_then(primary).is_some()
        || object.get("pattern").and_then(primary).is_some();
    let first_change = || first_path(object.get("changes")?);
    let path = object
        .get("file_path")
        .or_else(|| object.get("filePath"))
        .or_else(|| if searching { None } else { object.get("path") })
        .or_else(|| object.get("notebook_path"))
        .cloned()
        .or_else(first_change)?;
    path.as_str()
        .filter(|path| !path.is_empty())
        .map(str::to_string)
}

/// The command a shell call ran, unwrapped from its login shell.
fn full_command(input: &Value) -> Option<String> {
    let text = |key: &str| match input {
        Value::String(raw) => (key == "command").then(|| raw.clone()),
        Value::Object(object) => match object.get(key)? {
            Value::String(text) => Some(text.clone()),
            Value::Array(parts) if parts.iter().all(Value::is_string) => Some(
                parts
                    .iter()
                    .filter_map(Value::as_str)
                    .collect::<Vec<_>>()
                    .join(" "),
            ),
            _ => None,
        },
        _ => None,
    };
    let command = text("command")
        .filter(|c| !c.trim().is_empty())
        .or_else(|| text("cmd"))?;
    let command = unwrap_login_shell(&command);
    let command = command.trim();
    (!command.is_empty()).then(|| command.to_string())
}

fn text_field(input: &Value, key: &str) -> Option<String> {
    input.as_object()?.get(key)?.as_str().map(str::to_string)
}

/// A path trimmed from the front, so the file name survives.
fn summarize_path(path: &str) -> String {
    let collapsed = collapse(path);
    let count = collapsed.chars().count();
    if count <= MAX_PREVIEW {
        return collapsed;
    }
    let tail: String = collapsed.chars().skip(count - (MAX_PREVIEW - 1)).collect();
    match tail.find(['/', '\\']) {
        Some(boundary) if boundary > 0 => format!("…{}", &tail[boundary..]),
        _ => format!("…{tail}"),
    }
}

const PRIMARY_KEYS: &[&str] = &[
    "query",
    "pattern",
    "directory",
    "command",
    "cmd",
    "url",
    "description",
];

fn mcp_name(name: &str) -> String {
    let rest = name.trim().strip_prefix("mcp__").unwrap_or(name);
    let Some((server, tool)) = rest.split_once("__") else {
        return name.to_string();
    };
    let words = |text: &str| text.replace(['_', '-'], " ");
    let server = words(server);
    let mut chars = server.chars();
    let server: String = chars.next().map_or(String::new(), |first| {
        first.to_uppercase().chain(chars).collect()
    });
    format!("{server}: {}", words(tool))
}

// ---- A call as one row -----------------------------------------------------------------------

struct Line {
    label: String,
    body: String,
    category: ToolCategory,
}

fn verb(category: ToolCategory, state: LineState) -> Option<&'static str> {
    use LineState::*;
    use ToolCategory::*;
    let pick = |running, done, failed| match state {
        Running => Some(running),
        Completed => Some(done),
        Failed => Some(failed),
        Unfinished => None,
    };
    match category {
        Command => match state {
            Running => Some("Running"),
            _ => Some("Ran"),
        },
        Read => pick("Reading", "Read", "Tried to read"),
        FileChange => pick("Editing", "Edited", "Tried to edit"),
        Search => pick("Searching", "Searched", "Tried to search"),
        ListFiles => pick("Listing", "Listed", "Tried to list"),
        Subagent => Some("Subagent"),
        _ => None,
    }
}

fn line(tool: &NativeUiTool, state: LineState) -> Line {
    let input = normalize(&tool.input);
    let category = category(&tool.name);
    let path = file_path(&input);
    let mut target = match &path {
        Some(path) => summarize_path(path),
        None => input
            .as_object()
            .and_then(|object| first_primary(object, PRIMARY_KEYS))
            .unwrap_or_else(|| preview(&input)),
    };
    let mut body = match &input {
        Value::String(text) => text.clone(),
        other => serde_json::to_string_pretty(other).unwrap_or_default(),
    };
    let name = if category == ToolCategory::Mcp {
        mcp_name(&tool.name)
    } else {
        tool.name.clone()
    };
    let mut verb_word = verb(category, state);
    match category {
        ToolCategory::Command => {
            if let Some(command) = full_command(&input) {
                target = preview(&Value::String(command.clone()));
                body = command;
            }
        }
        ToolCategory::Read | ToolCategory::FileChange => {
            if let Some(path) = &path {
                target = path
                    .rsplit(['/', '\\'])
                    .find(|part| !part.is_empty())
                    .unwrap_or(path)
                    .to_string();
            }
        }
        ToolCategory::Subagent => {
            if let Some(description) = text_field(&input, "description") {
                target = description;
            }
        }
        ToolCategory::WebSearch if tool.name.trim().eq_ignore_ascii_case("webfetch") => {
            let url = text_field(&input, "url").unwrap_or_else(|| target.clone());
            target = url
                .split_once("://")
                .map_or(url.clone(), |(_, rest)| rest.to_string());
            verb_word = match state {
                LineState::Running => Some("Fetching"),
                LineState::Completed => Some("Fetched"),
                LineState::Failed => Some("Tried to fetch"),
                LineState::Unfinished => None,
            };
        }
        ToolCategory::WebSearch => {
            verb_word = match state {
                LineState::Running => Some("Searching the web"),
                LineState::Completed => Some("Searched the web"),
                LineState::Failed => Some("Tried to search the web"),
                LineState::Unfinished => None,
            };
        }
        _ => {}
    }
    if body.chars().count() > MAX_DETAIL {
        body = format!("{}…", body.chars().take(MAX_DETAIL).collect::<String>());
    }
    let label = match verb_word {
        // A web search is named by what it searched for, not by its tool.
        Some(verb) if target.is_empty() => verb.to_string(),
        Some(verb) => format!("{verb} {target}"),
        None if target.is_empty() => name,
        None => format!("{name} {target}"),
    };
    Line {
        label,
        body,
        category,
    }
}

/// What a running call is doing, for the live line: a shell command reads as itself.
fn activity(tool: &NativeUiTool) -> String {
    let input = normalize(&tool.input);
    let target = input
        .as_object()
        .and_then(|object| first_primary(object, PRIMARY_KEYS))
        .or_else(|| file_path(&input).map(|path| summarize_path(&path)))
        .unwrap_or_else(|| preview(&input));
    let target = full_command(&input)
        .filter(|_| category(&tool.name) == ToolCategory::Command)
        .map_or(target, |command| preview(&Value::String(command)));
    match (
        category(&tool.name) == ToolCategory::Command,
        target.is_empty(),
    ) {
        (true, true) => "Running command".into(),
        (true, false) => format!("Running {target}"),
        (false, true) => format!("Running {}", tool.name),
        (false, false) => format!("Running {} {target}", tool.name),
    }
}

// ---- Pairing and projection ------------------------------------------------------------------

/// `(message index, tool index)` of each call, and which result message answers each.
/// Named results answer the oldest unanswered call with that id; unnamed results answer the oldest
/// unanswered call. A result no call claims stays its own row.
fn pair(messages: &[NativeUiMessage]) -> (HashMap<(usize, usize), usize>, Vec<bool>) {
    let mut answered = HashMap::new();
    let mut absorbed = vec![false; messages.len()];
    let mut pending: Vec<(usize, usize)> = vec![];
    for (index, message) in messages.iter().enumerate() {
        if message.role == "toolResult" {
            let slot = pending
                .iter()
                .position(|(m, t)| match &message.tool_call_id {
                    Some(id) => messages[*m].tools[*t].id.as_ref() == Some(id),
                    None => true,
                });
            if let Some(slot) = slot {
                answered.insert(pending.remove(slot), index);
                absorbed[index] = true;
            }
        } else {
            pending.extend((0..message.tools.len()).map(|tool| (index, tool)));
        }
    }
    (answered, absorbed)
}

fn line_state(tool: &NativeUiTool, result: Option<&NativeUiMessage>, running: bool) -> LineState {
    if result.is_some_and(|result| result.is_error) || tool.state == Some(NativeUiToolState::Failed)
    {
        return LineState::Failed;
    }
    let settled = result.is_some() || tool.state == Some(NativeUiToolState::Completed);
    match (settled, running) {
        (true, _) => LineState::Completed,
        (false, true) => LineState::Running,
        (false, false) => LineState::Unfinished,
    }
}

/// Fold thinking, tool calls and their results into runs between the messages the reader reads,
/// pair each result with its call, and group everything into turns.
pub fn project(snapshot: &NativeUiSnapshot) -> NativeUiTranscript {
    let messages = &snapshot.messages;
    let running = snapshot.running;
    let (answered, absorbed) = pair(messages);
    let mut blocks: Vec<NativeUiBlock> = vec![];
    let mut turn = String::new();
    let mut task_history = super::tasks::History::default();
    // The steps of the run being built, and the categories of its calls.
    let work = |blocks: &mut Vec<NativeUiBlock>, turn: &str, step: NativeUiStep| {
        if let Some(NativeUiBlock::Run { steps, .. }) = blocks.last_mut() {
            steps.push(step);
        } else {
            blocks.push(NativeUiBlock::Run {
                id: step.id.clone(),
                turn: turn.to_string(),
                live: false,
                summary: String::new(),
                calls: 0,
                failed: 0,
                steps: vec![step],
            });
        }
    };
    for (index, message) in messages.iter().enumerate() {
        match message.role.as_str() {
            "toolResult" if absorbed[index] => {}
            "toolResult" => work(
                &mut blocks,
                &turn,
                NativeUiStep {
                    id: format!("{}:result", message.id),
                    kind: StepKind::Result,
                    label: format!("{} result", message.tool_name.as_deref().unwrap_or("Tool")),
                    body: message.text.clone(),
                    tool: None,
                },
            ),
            "assistant" => {
                if !message.thinking.is_empty() {
                    work(
                        &mut blocks,
                        &turn,
                        NativeUiStep {
                            id: format!("{}:thinking", message.id),
                            kind: StepKind::Thinking,
                            label: "Thinking".into(),
                            body: message.thinking.clone(),
                            tool: None,
                        },
                    );
                }
                if !message.text.is_empty() || message.error.is_some() {
                    blocks.push(NativeUiBlock::Message {
                        id: message.id.clone(),
                        turn: turn.clone(),
                        live: false,
                    });
                }
                for (position, tool) in message.tools.iter().enumerate() {
                    let result = answered.get(&(index, position)).map(|at| &messages[*at]);
                    let state = line_state(tool, result, running);
                    let Line {
                        label,
                        mut body,
                        category,
                    } = line(tool, state);
                    // A plan call that was accepted reads as what it changed.
                    let rejected = state == LineState::Failed || result.is_some_and(|r| r.is_error);
                    if let Some(changes) = (!rejected)
                        .then(|| {
                            task_history.accept(
                                &tool.name,
                                &tool.input,
                                result.map(|result| result.text.as_str()),
                            )
                        })
                        .flatten()
                    {
                        body = changes;
                    }
                    work(
                        &mut blocks,
                        &turn,
                        NativeUiStep {
                            id: format!("{}:tool:{position}", message.id),
                            kind: StepKind::Tool,
                            label,
                            body,
                            tool: Some(NativeUiToolLine {
                                category,
                                state,
                                output: result.map(|result| result.text.clone()),
                            }),
                        },
                    );
                }
            }
            role => {
                if role == "user" {
                    turn = message.id.clone();
                }
                blocks.push(NativeUiBlock::Message {
                    id: message.id.clone(),
                    turn: turn.clone(),
                    live: false,
                });
            }
        }
    }
    // The run header reads its calls once the run is complete.
    let last = blocks.len().saturating_sub(1);
    for (index, block) in blocks.iter_mut().enumerate() {
        let live = running && index == last;
        match block {
            NativeUiBlock::Message { live: flag, .. } => *flag = live,
            NativeUiBlock::Run {
                live: flag,
                summary,
                calls,
                failed,
                steps,
                ..
            } => {
                *flag = live;
                let tools: Vec<&NativeUiToolLine> =
                    steps.iter().filter_map(|step| step.tool.as_ref()).collect();
                *calls = tools.len() as u32;
                *failed = tools
                    .iter()
                    .filter(|tool| tool.state == LineState::Failed)
                    .count() as u32;
                let categories: Vec<ToolCategory> =
                    tools.iter().map(|tool| tool.category).collect();
                *summary = run_summary(steps, &categories, live);
            }
        }
    }
    let working = (running && !snapshot.blocked).then(|| working_line(snapshot, &blocks));
    NativeUiTranscript {
        blocks,
        working,
        tasks: task_history.docked(),
    }
}

fn run_summary(steps: &[NativeUiStep], categories: &[ToolCategory], live: bool) -> String {
    if categories.is_empty() {
        return if steps.iter().any(|step| step.kind == StepKind::Result) {
            "Tool results".into()
        } else {
            "Thinking".into()
        };
    }
    // A settled lone shell call reads as the command itself.
    if let ([ToolCategory::Command], false) = (categories, live) {
        if let Some(step) = steps.iter().find(|step| step.kind == StepKind::Tool) {
            if !step.body.is_empty() {
                return preview(&Value::String(step.body.clone()));
            }
        }
    }
    sentence(categories, live)
}

fn working_line(snapshot: &NativeUiSnapshot, blocks: &[NativeUiBlock]) -> String {
    if let Some(NativeUiBlock::Run { steps, .. }) = blocks.last() {
        let running = steps.iter().rev().find(|step| {
            step.tool
                .as_ref()
                .is_some_and(|tool| tool.state == LineState::Running)
        });
        if let Some(step) = running {
            // The step id is `<message id>:tool:<position>`.
            let tool = step
                .id
                .rsplit_once(":tool:")
                .and_then(|(message, position)| {
                    let message = snapshot.messages.iter().find(|m| m.id == message)?;
                    message.tools.get(position.parse::<usize>().ok()?)
                });
            if let Some(tool) = tool {
                return activity(tool);
            }
        }
        if steps
            .last()
            .is_some_and(|step| step.kind == StepKind::Thinking)
        {
            return "Thinking".into();
        }
    }
    "Working…".into()
}

/// Ids of the blocks whose text contains `query`, case-insensitively, in transcript order.
pub fn find(
    snapshot: &NativeUiSnapshot,
    transcript: &NativeUiTranscript,
    query: &str,
) -> Vec<String> {
    let needle = query.trim().to_lowercase();
    if needle.is_empty() {
        return vec![];
    }
    let by_id: HashMap<&str, &NativeUiMessage> = snapshot
        .messages
        .iter()
        .map(|m| (m.id.as_str(), m))
        .collect();
    transcript
        .blocks
        .iter()
        .filter_map(|block| {
            let (id, text) = match block {
                NativeUiBlock::Message { id, .. } => {
                    let message = by_id.get(id.as_str())?;
                    (
                        id,
                        format!(
                            "{}\n{}",
                            message.text,
                            message.error.as_deref().unwrap_or("")
                        ),
                    )
                }
                NativeUiBlock::Run { id, steps, .. } => (
                    id,
                    steps
                        .iter()
                        .map(|step| {
                            let output = step.tool.as_ref().and_then(|tool| tool.output.as_deref());
                            format!("{}\n{}\n{}", step.label, step.body, output.unwrap_or(""))
                        })
                        .collect::<Vec<_>>()
                        .join("\n"),
                ),
            };
            text.to_lowercase().contains(&needle).then(|| id.clone())
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(id: &str, role: &str) -> NativeUiMessage {
        NativeUiMessage {
            id: id.into(),
            role: role.into(),
            ..Default::default()
        }
    }
    fn call(name: &str, input: &str, id: Option<&str>) -> NativeUiTool {
        NativeUiTool {
            name: name.into(),
            input: input.into(),
            id: id.map(Into::into),
            state: None,
        }
    }
    fn assistant(id: &str, tools: Vec<NativeUiTool>) -> NativeUiMessage {
        NativeUiMessage {
            tools,
            ..message(id, "assistant")
        }
    }
    fn result(id: &str, call: Option<&str>, text: &str, is_error: bool) -> NativeUiMessage {
        NativeUiMessage {
            text: text.into(),
            tool_call_id: call.map(Into::into),
            is_error,
            ..message(id, "toolResult")
        }
    }
    fn snapshot(messages: Vec<NativeUiMessage>, running: bool) -> NativeUiSnapshot {
        NativeUiSnapshot {
            version: 1,
            revision: 1,
            pid: 1,
            provider_session_id: "s".into(),
            cwd: "/".into(),
            model: None,
            running,
            blocked: false,
            request: None,
            context: None,
            messages,
            truncated: false,
            transcript: None,
        }
    }
    fn run(transcript: &NativeUiTranscript, index: usize) -> (&str, &[NativeUiStep]) {
        match &transcript.blocks[index] {
            NativeUiBlock::Run { summary, steps, .. } => (summary, steps),
            other => panic!("expected a run, got {other:?}"),
        }
    }

    #[test]
    fn folds_a_turn_into_prompt_run_answer_and_pairs_results_by_id() {
        let mut thinking = assistant(
            "a1",
            vec![call(
                "Read",
                r#"{"file_path":"/repo/src/lib.rs"}"#,
                Some("t1"),
            )],
        );
        thinking.thinking = "hm".into();
        let mut answer = message("a3", "assistant");
        answer.text = "done".into();
        let mut prompt = message("u", "user");
        prompt.text = "fix it".into();
        let transcript = project(&snapshot(
            vec![
                prompt,
                thinking,
                assistant(
                    "a2",
                    vec![
                        call("Bash", r#"{"command":"ls"}"#, Some("t2")),
                        call("Bash", r#"{"command":"pwd"}"#, Some("t3")),
                    ],
                ),
                // Results arrive out of order and name their call.
                result("r3", Some("t3"), "/repo", false),
                result("r1", Some("t1"), "file", false),
                result("r2", Some("t2"), "a b", true),
                answer,
            ],
            false,
        ));
        let kinds: Vec<_> = transcript
            .blocks
            .iter()
            .map(|block| matches!(block, NativeUiBlock::Run { .. }))
            .collect();
        assert_eq!(kinds, [false, true, false]);
        let (summary, steps) = run(&transcript, 1);
        assert_eq!(summary, "Read 1 file and ran 2 commands");
        assert_eq!(
            steps.iter().map(|s| s.kind).collect::<Vec<_>>(),
            [
                StepKind::Thinking,
                StepKind::Tool,
                StepKind::Tool,
                StepKind::Tool
            ]
        );
        assert_eq!(steps[1].label, "Read lib.rs");
        assert_eq!(
            steps[1].tool.as_ref().unwrap().output.as_deref(),
            Some("file")
        );
        assert_eq!(steps[2].label, "Ran ls");
        assert_eq!(steps[2].tool.as_ref().unwrap().state, LineState::Failed);
        assert_eq!(
            steps[3].tool.as_ref().unwrap().output.as_deref(),
            Some("/repo")
        );
        let NativeUiBlock::Run {
            failed,
            calls,
            turn,
            ..
        } = &transcript.blocks[1]
        else {
            unreachable!()
        };
        assert_eq!((*failed, *calls, turn.as_str()), (1, 3, "u"));
        assert!(transcript.working.is_none());
    }

    #[test]
    fn unnamed_results_answer_the_oldest_call_and_orphans_keep_their_row() {
        let transcript = project(&snapshot(
            vec![
                assistant(
                    "a",
                    vec![
                        call("bash", "echo 1", Some("x")),
                        call("bash", "echo 2", None),
                    ],
                ),
                result("r1", None, "1", false),
                // Names a call this history no longer holds: it must not take an unrelated call's place.
                result("r0", Some("gone"), "old", false),
                // A second result for the first call's id finds it already answered.
                result("r9", Some("x"), "again", false),
            ],
            false,
        ));
        let (_, steps) = run(&transcript, 0);
        assert_eq!(steps.len(), 4);
        assert_eq!(steps[3].body, "again");
        assert_eq!(steps[0].tool.as_ref().unwrap().output.as_deref(), Some("1"));
        assert_eq!(steps[0].tool.as_ref().unwrap().state, LineState::Completed);
        assert_eq!(steps[1].tool.as_ref().unwrap().state, LineState::Unfinished);
        assert_eq!(
            (steps[2].kind, steps[2].body.as_str()),
            (StepKind::Result, "old")
        );
        assert_eq!(steps[1].id, "a:tool:1");
    }

    #[test]
    fn states_follow_the_provider_then_the_result_then_the_turn() {
        let mut done = call("shell", "ls", Some("x"));
        done.state = Some(NativeUiToolState::Completed);
        let mut failed = call("shell", "false", Some("y"));
        failed.state = Some(NativeUiToolState::Failed);
        let mut live = call("shell", "sleep 9", Some("z"));
        live.state = Some(NativeUiToolState::Running);
        let messages = vec![assistant("a", vec![done, failed, live])];
        let states = |running| {
            let transcript = project(&snapshot(messages.clone(), running));
            run(&transcript, 0)
                .1
                .iter()
                .map(|s| s.tool.as_ref().unwrap().state)
                .collect::<Vec<_>>()
        };
        assert_eq!(
            states(true),
            [LineState::Completed, LineState::Failed, LineState::Running]
        );
        // A call the provider calls running, in a turn that has ended, is not claimed to run.
        assert_eq!(
            states(false),
            [
                LineState::Completed,
                LineState::Failed,
                LineState::Unfinished
            ]
        );
    }

    #[test]
    fn rows_name_the_target_in_the_right_tense() {
        let line =
            |name: &str, input: &str, state| super::line(&call(name, input, None), state).label;
        assert_eq!(
            line(
                "Edit",
                r#"{"file_path":"/a/b/c.rs","old_string":"x"}"#,
                LineState::Running
            ),
            "Editing c.rs"
        );
        assert_eq!(
            line(
                "edit",
                r#"{"path":"crates/x/Cargo.toml","edits":[]}"#,
                LineState::Completed
            ),
            "Edited Cargo.toml"
        );
        assert_eq!(
            line("Read", r#"{"file_path":"/nope"}"#, LineState::Failed),
            "Tried to read nope"
        );
        assert_eq!(
            line(
                "Grep",
                r#"{"pattern":"TODO","path":"src"}"#,
                LineState::Completed
            ),
            "Searched TODO"
        );
        assert_eq!(
            line(
                "shell",
                "/bin/zsh -lc 'cargo test -p perch-core'",
                LineState::Completed
            ),
            "Ran cargo test -p perch-core"
        );
        assert_eq!(
            line(
                "Bash",
                r#"{"command":"ls","description":"List"}"#,
                LineState::Running
            ),
            "Running ls"
        );
        assert_eq!(
            line(
                "WebFetch",
                r#"{"url":"https://example.com/a"}"#,
                LineState::Completed
            ),
            "Fetched example.com/a"
        );
        assert_eq!(
            line(
                "mcp__chrome_devtools__take_snapshot",
                "{}",
                LineState::Completed
            ),
            "Chrome devtools: take snapshot"
        );
        assert_eq!(
            line(
                "file changes",
                r#"[{"path":"a.txt"}]"#,
                LineState::Completed
            ),
            "Edited a.txt"
        );
        assert_eq!(
            line(
                "Agent",
                r#"{"description":"Explore","prompt":"p"}"#,
                LineState::Completed
            ),
            "Subagent Explore"
        );
        // An input with nothing to name says only the tool's name, never a slice of its JSON.
        assert_eq!(
            line(
                "AskUserQuestion",
                r#"{"questions":[{"header":"Colour"}]}"#,
                LineState::Running
            ),
            "AskUserQuestion"
        );
    }

    #[test]
    fn a_clipped_input_still_names_its_file() {
        let clipped = r#"{"content":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","file_path":"/repo/notes/out.md","old"#;
        let label = super::line(&call("Write", clipped, None), LineState::Completed).label;
        assert_eq!(label, "Edited out.md");
    }

    #[test]
    fn plan_calls_read_as_their_changes_and_the_latest_list_is_docked() {
        let todos = |content: &str, status: &str| {
            format!(r#"{{"todos":[{{"content":"{content}","status":"{status}"}}]}}"#)
        };
        let snap = snapshot(
            vec![
                assistant(
                    "a1",
                    vec![call("TodoWrite", &todos("Test", "pending"), Some("1"))],
                ),
                result("r1", Some("1"), "ok", false),
                assistant(
                    "a2",
                    vec![call("TodoWrite", &todos("Test", "completed"), Some("2"))],
                ),
                result("r2", Some("2"), "ok", false),
                // Rejected: neither a change nor the docked list.
                assistant(
                    "a3",
                    vec![call("TodoWrite", &todos("Other", "pending"), Some("3"))],
                ),
                result("r3", Some("3"), "denied", true),
            ],
            false,
        );
        let transcript = project(&snap);
        let (_, steps) = run(&transcript, 0);
        assert_eq!(steps[0].body, "Added Test");
        assert_eq!(steps[1].body, "Completed Test");
        assert!(steps[2].body.contains("Other") && steps[2].body.starts_with('{'));
        let docked = transcript.tasks.unwrap();
        assert_eq!(docked.tasks.len(), 1);
        assert_eq!(docked.tasks[0].content, "Test");
        assert!(project(&snapshot(vec![], false)).tasks.is_none());
    }

    #[test]
    fn the_run_header_follows_the_work_and_its_tense() {
        let steps = |tools: Vec<NativeUiTool>, running| {
            let transcript = project(&snapshot(vec![assistant("a", tools)], running));
            run(&transcript, 0).0.to_string()
        };
        let mixed = || {
            vec![
                call("Read", "{}", None),
                call("Grep", r#"{"pattern":"x"}"#, None),
                call("Read", "{}", None),
                call("Bash", "ls", None),
                call("Bash", "pwd", None),
            ]
        };
        assert_eq!(
            steps(mixed(), false),
            "Read 2 files, searched 1 time, and ran 2 commands"
        );
        assert_eq!(
            steps(mixed(), true),
            "Reading 2 files, searching 1 time, and running 2 commands"
        );
        assert_eq!(
            steps(
                vec![call("Bash", r#"{"command":"cargo fmt --check"}"#, None)],
                false
            ),
            "cargo fmt --check"
        );
        assert_eq!(
            steps(vec![call("Bash", "ls", None)], true),
            "Running 1 command"
        );
    }

    #[test]
    fn the_live_line_names_what_runs_and_hides_while_a_person_is_needed() {
        let mut snap = snapshot(
            vec![assistant(
                "a",
                vec![call("Bash", r#"{"command":"npm test"}"#, Some("1"))],
            )],
            true,
        );
        assert_eq!(project(&snap).working.as_deref(), Some("Running npm test"));
        snap.messages[0].tools[0].name = "Read".into();
        snap.messages[0].tools[0].input = r#"{"file_path":"/a/b.rs"}"#.into();
        assert_eq!(
            project(&snap).working.as_deref(),
            Some("Running Read /a/b.rs")
        );
        snap.messages = vec![NativeUiMessage {
            thinking: "hm".into(),
            ..message("t", "assistant")
        }];
        assert_eq!(project(&snap).working.as_deref(), Some("Thinking"));
        snap.messages = vec![message("u", "user")];
        assert_eq!(project(&snap).working.as_deref(), Some("Working…"));
        snap.blocked = true;
        assert_eq!(project(&snap).working, None);
        snap.blocked = false;
        snap.running = false;
        assert_eq!(project(&snap).working, None);
    }

    #[test]
    fn text_the_agent_wrote_stays_visible_and_starts_a_new_run_after_it() {
        let mut first = assistant("a1", vec![call("Read", "{}", None)]);
        first.text = "Checking.".into();
        let mut second = assistant("a2", vec![call("Edit", "{}", None)]);
        second.text = "Now editing.".into();
        let errored = NativeUiMessage {
            error: Some("boom".into()),
            ..message("e", "assistant")
        };
        let transcript = project(&snapshot(vec![first, second, errored], true));
        let shape: Vec<_> = transcript
            .blocks
            .iter()
            .map(|b| matches!(b, NativeUiBlock::Run { .. }))
            .collect();
        assert_eq!(shape, [false, true, false, true, false]);
        // Only the trailing block is live.
        let live: Vec<_> = transcript
            .blocks
            .iter()
            .map(|b| match b {
                NativeUiBlock::Message { live, .. } | NativeUiBlock::Run { live, .. } => *live,
            })
            .collect();
        assert_eq!(live, [false, false, false, false, true]);
    }

    #[test]
    fn find_matches_messages_and_what_is_inside_runs() {
        let mut prompt = message("u", "user");
        prompt.text = "Fix the Parser".into();
        let mut answer = message("z", "assistant");
        answer.text = "done".into();
        let snap = snapshot(
            vec![
                prompt,
                assistant(
                    "a1",
                    vec![call("Bash", r#"{"command":"grep parser src"}"#, Some("1"))],
                ),
                result("r", Some("1"), "src/Parser.rs", false),
                answer,
            ],
            false,
        );
        let transcript = project(&snap);
        assert_eq!(find(&snap, &transcript, "PARSER"), ["u", "a1:tool:0"]);
        assert_eq!(find(&snap, &transcript, "  "), Vec::<String>::new());
        assert_eq!(find(&snap, &transcript, "nothing"), Vec::<String>::new());
    }

    #[test]
    fn login_shell_wrappers_come_off_only_around_one_quoted_word() {
        assert_eq!(
            unwrap_login_shell(r#"/bin/zsh -lc "echo \"hi\" && ls""#),
            r#"echo "hi" && ls"#
        );
        assert_eq!(unwrap_login_shell("bash -c 'a'\"'\"'b'"), "a'b");
        assert_eq!(unwrap_login_shell("bash -c 'a' | wc"), "bash -c 'a' | wc");
        assert_eq!(unwrap_login_shell("ls -la"), "ls -la");
    }
}
