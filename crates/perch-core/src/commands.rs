//! Slash-command / skill discovery for the Hosted composer's autocomplete.
//!
//! **Invocation needs nothing from perch.** Sending `"/name args"` as a claude
//! turn already runs the command (unknown ones come back as an ordinary
//! `result` saying `Unknown command: /x` with `num_turns: 0`), and codex
//! invokes a skill from a bare `$name` mention in the prompt. This module only
//! answers the *other* half of the feature: what to offer in the popover.
//!
//! Both probes are offline, sub-second and cost zero tokens:
//!
//! * **claude** — `claude -p "/effort" --output-format stream-json --verbose
//!   --no-session-persistence < /dev/null`, run in the session's cwd. The
//!   `system/init` line it prints before executing anything carries
//!   `slash_commands`, `skills` and `agents` (145/119/6 on this machine).
//!   `/effort` is chosen as the payload because it is a built-in that prints
//!   usage and exits with `num_turns: 0` — no model call, no cost.
//! * **codex** — `codex debug prompt-input -- "hi"`, which renders the prompt
//!   codex *would* send without sending it. Its developer message contains an
//!   `### Available skills` block whose lines read
//!   `- <name>: <description> (file: /abs/SKILL.md)`. (`app-server`'s
//!   `skills/list` is the tidier API but needs a whole JSON-RPC session; the
//!   debug route is enough for v1.)
//!
//! Results are cached per `(host, cwd)` for [`CACHE_TTL`] — the lists only
//! change when the user edits their skills, and a probe on every keystroke
//! (or even every session) would be wasteful.
//!
//! Direct-mode hosts run the exact same two commands over `ssh`, through
//! [`crate::ssh::run_remote`], which already prepends `~/.local/bin` to the
//! remote `PATH` the way `detached.rs` does when it launches the CLIs.

use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde_json::Value;
use tokio::process::Command;

use crate::protocol::CommandEntry;
use crate::ssh;

/// How long a probed command list stays fresh.
const CACHE_TTL: Duration = Duration::from_secs(300);

/// Hard bound on either probe. The claude probe measures ~1.1s locally and the
/// codex one ~0.3s; anything past this is a wedged CLI and an empty list is a
/// better answer than a hung composer.
const LOCAL_TIMEOUT: Duration = Duration::from_secs(25);
/// Remote probes pay the ssh round trip on top (mux-warm ~0.5s, cold several
/// seconds through a devpod ProxyCommand).
const REMOTE_TIMEOUT_SECS: u64 = 45;

#[derive(Clone, Default)]
pub struct CommandLists {
    pub claude: Vec<CommandEntry>,
    pub codex: Vec<CommandEntry>,
}

struct CacheEntry {
    at: Instant,
    lists: CommandLists,
}

fn cache() -> &'static Mutex<HashMap<String, CacheEntry>> {
    static CACHE: std::sync::OnceLock<Mutex<HashMap<String, CacheEntry>>> =
        std::sync::OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Probe (or serve from cache) the command lists for one session location.
/// `ssh_host` is `None` for the local machine, `Some(host)` for a direct-mode
/// remote.
pub async fn list_for(host_id: &str, ssh_host: Option<&str>, cwd: &str) -> CommandLists {
    let key = format!("{host_id}\u{1}{cwd}");
    if let Some(entry) = cache().lock().unwrap().get(&key) {
        if entry.at.elapsed() < CACHE_TTL {
            return entry.lists.clone();
        }
    }

    let lists = match ssh_host {
        None => CommandLists {
            claude: parse_claude_init(&probe_claude_local(cwd).await),
            codex: parse_codex_prompt_input(&probe_codex_local(cwd).await),
        },
        Some(host) => CommandLists {
            claude: parse_claude_init(&probe_claude_remote(host, cwd).await),
            codex: parse_codex_prompt_input(&probe_codex_remote(host, cwd).await),
        },
    };

    cache().lock().unwrap().insert(
        key,
        CacheEntry {
            at: Instant::now(),
            lists: lists.clone(),
        },
    );
    lists
}

// ---------------------------------------------------------------------------
// Probes
// ---------------------------------------------------------------------------

const CLAUDE_PROBE_ARGS: [&str; 6] = [
    "-p",
    "/effort",
    "--output-format",
    "stream-json",
    "--verbose",
    "--no-session-persistence",
];

/// `codex debug prompt-input -- "hi"` — the `--` keeps a prompt that starts
/// with `-` from being read as a flag.
const CODEX_PROBE_ARGS: [&str; 4] = ["debug", "prompt-input", "--", "hi"];

async fn run_local(bin: &str, args: &[&str], cwd: &str) -> String {
    let mut cmd = Command::new(bin);
    cmd.args(args)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true);
    match tokio::time::timeout(LOCAL_TIMEOUT, cmd.output()).await {
        Ok(Ok(out)) => String::from_utf8_lossy(&out.stdout).to_string(),
        Ok(Err(e)) => {
            tracing::debug!("[commands] {bin} probe failed: {e}");
            String::new()
        }
        Err(_) => {
            tracing::debug!("[commands] {bin} probe timed out");
            String::new()
        }
    }
}

async fn probe_claude_local(cwd: &str) -> String {
    run_local("claude", &CLAUDE_PROBE_ARGS, cwd).await
}

async fn probe_codex_local(cwd: &str) -> String {
    run_local("codex", &CODEX_PROBE_ARGS, cwd).await
}

async fn run_remote(ssh_host: &str, cwd: &str, bin: &str, args: &[&str], phase: &str) -> String {
    let quoted: Vec<String> = args.iter().map(|a| ssh::shell_quote(a)).collect();
    let cmd = format!(
        "cd {} 2>/dev/null || exit 0; {bin} {} 2>/dev/null </dev/null",
        ssh::shell_quote(cwd),
        quoted.join(" ")
    );
    match ssh::run_remote(ssh_host, &cmd, REMOTE_TIMEOUT_SECS, phase).await {
        Ok(out) => out,
        Err(e) => {
            tracing::debug!("[commands] remote {bin} probe on {ssh_host} failed: {e}");
            String::new()
        }
    }
}

async fn probe_claude_remote(ssh_host: &str, cwd: &str) -> String {
    run_remote(ssh_host, cwd, "claude", &CLAUDE_PROBE_ARGS, "commands claude").await
}

async fn probe_codex_remote(ssh_host: &str, cwd: &str) -> String {
    run_remote(ssh_host, cwd, "codex", &CODEX_PROBE_ARGS, "commands codex").await
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

/// Pull `slash_commands` + `skills` + `agents` out of claude's `system/init`
/// line. The line is *not* first in the stream (SessionStart hook events come
/// before it), so every line is scanned.
pub fn parse_claude_init(stdout: &str) -> Vec<CommandEntry> {
    let mut out: Vec<CommandEntry> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(v) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };
        if v.get("type").and_then(Value::as_str) != Some("system")
            || v.get("subtype").and_then(Value::as_str) != Some("init")
        {
            continue;
        }
        // `slash_commands` first so the built-ins keep their natural order;
        // `skills`/`agents` mostly repeat those names and only contribute the
        // handful the CLI does not also expose as a slash command.
        for key in ["slash_commands", "skills", "agents"] {
            let Some(items) = v.get(key).and_then(Value::as_array) else {
                continue;
            };
            for item in items {
                let entry = match item {
                    Value::String(name) => CommandEntry {
                        name: name.clone(),
                        description: None,
                    },
                    Value::Object(_) => {
                        let Some(name) = item.get("name").and_then(Value::as_str) else {
                            continue;
                        };
                        CommandEntry {
                            name: name.to_string(),
                            description: item
                                .get("description")
                                .and_then(Value::as_str)
                                .map(str::to_string),
                        }
                    }
                    _ => continue,
                };
                let name = entry.name.trim_start_matches('/').to_string();
                if name.is_empty() || !seen.insert(name.clone()) {
                    continue;
                }
                out.push(CommandEntry { name, ..entry });
            }
        }
        break;
    }
    out
}

/// Pull the `### Available skills` block out of `codex debug prompt-input`'s
/// JSON. Lines look like `- <name>: <description> (file: /abs/SKILL.md)`; the
/// trailing `(file: …)` is dropped and the block ends at the first line that
/// is not a `- ` bullet.
pub fn parse_codex_prompt_input(stdout: &str) -> Vec<CommandEntry> {
    // The payload is a JSON array of messages whose text blocks contain the
    // markdown; going through serde un-escapes `\n` for us. If it doesn't
    // parse (older codex, error output) fall back to scanning the raw text.
    let text = match serde_json::from_str::<Value>(stdout.trim()) {
        Ok(v) => collect_text(&v),
        Err(_) => stdout.to_string(),
    };
    let Some(start) = text.find("### Available skills") else {
        return Vec::new();
    };
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for line in text[start..].lines().skip(1) {
        let line = line.trim_end();
        let Some(rest) = line.strip_prefix("- ") else {
            if line.trim().is_empty() {
                continue;
            }
            break;
        };
        let (name, desc) = match rest.split_once(':') {
            Some((n, d)) => (n.trim(), d.trim()),
            None => (rest.trim(), ""),
        };
        // Strip the trailing `(file: /path/SKILL.md)` locator.
        let desc = match desc.rfind("(file:") {
            Some(i) => desc[..i].trim(),
            None => desc,
        };
        if name.is_empty() || !seen.insert(name.to_string()) {
            continue;
        }
        out.push(CommandEntry {
            name: name.to_string(),
            description: if desc.is_empty() {
                None
            } else {
                Some(desc.to_string())
            },
        });
    }
    out
}

/// Concatenate every string leaf of a JSON value — enough to find the skills
/// block without hard-coding codex's message envelope shape.
fn collect_text(v: &Value) -> String {
    let mut buf = String::new();
    fn walk(v: &Value, buf: &mut String) {
        match v {
            Value::String(s) => {
                buf.push_str(s);
                buf.push('\n');
            }
            Value::Array(items) => items.iter().for_each(|i| walk(i, buf)),
            Value::Object(map) => map.values().for_each(|i| walk(i, buf)),
            _ => {}
        }
    }
    walk(v, &mut buf);
    buf
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_claude_init_reads_slash_commands_skills_and_agents() {
        // Hook events precede the init line in a real stream.
        let stdout = concat!(
            r#"{"type":"system","subtype":"hook_started","hook_name":"SessionStart"}"#,
            "\n",
            r#"{"type":"system","subtype":"init","slash_commands":["effort","/review"],"#,
            r#""skills":["dataviz","effort"],"agents":[{"name":"Explore","description":"search"}]}"#,
            "\n",
            r#"{"type":"result","subtype":"success","num_turns":0}"#,
        );
        let out = parse_claude_init(stdout);
        let names: Vec<&str> = out.iter().map(|c| c.name.as_str()).collect();
        // `/review` loses its sigil, `effort` is not duplicated by `skills`.
        assert_eq!(names, vec!["effort", "review", "dataviz", "Explore"]);
        assert_eq!(out[3].description.as_deref(), Some("search"));
    }

    #[test]
    fn parse_claude_init_tolerates_garbage() {
        assert!(parse_claude_init("").is_empty());
        assert!(parse_claude_init("not json\n{}\n").is_empty());
    }

    #[test]
    fn parse_codex_prompt_input_reads_available_skills_block() {
        let payload = serde_json::json!([{
            "type": "message",
            "content": [{
                "type": "input_text",
                "text": "preamble\n### Available skills\n- imagegen: Generate images (file: /Users/x/.codex/skills/imagegen/SKILL.md)\n- openai-docs: Docs helper (file: /tmp/SKILL.md)\n\n## Next section\n- not-a-skill: nope\n"
            }]
        }])
        .to_string();
        let out = parse_codex_prompt_input(&payload);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].name, "imagegen");
        assert_eq!(out[0].description.as_deref(), Some("Generate images"));
        assert_eq!(out[1].name, "openai-docs");
    }

    #[test]
    fn parse_codex_prompt_input_returns_empty_without_a_skills_block() {
        assert!(parse_codex_prompt_input("[]").is_empty());
        assert!(parse_codex_prompt_input("").is_empty());
    }
}
