//! Built-in slash commands (`/context`, `/status`, `/session`, ...) are the TUI's own controls, not
//! prompts. The bridge hands text to the model, so a built-in sent that way is answered as prose by
//! the model (observed live: Codex `/status` and Pi `/session` each started a model turn that ran
//! shell tools). They have to be typed into the CLI's terminal instead, and nothing confirms their
//! effect: the result shows on the terminal, not in the transcript.
//!
//! Orca does the same split: `classifyNativeChatSend` then, for Codex, `typeAgentTuiCommand`
//! (one PTY write per key so the TUI does not read the burst as a paste).

use crate::protocol::CommandEntry;
use anyhow::{bail, ensure, Context};
use std::time::Duration;

/// Where one composer send goes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Route {
    /// Hand it to the CLI as a message: chat text, skills, extension commands, prompt templates.
    Prompt,
    /// Run it in the CLI's terminal.
    Terminal,
}

/// Classify `text` for `agent`. TUIs dispatch only a line-leading token, so a leading space makes it
/// prose. `live` is what the running CLI reported; built-ins win over a same-named live entry.
pub fn route(agent: &str, text: &str, live: Vec<CommandEntry>) -> Route {
    let first = text.split(char::is_whitespace).next().unwrap_or_default();
    let Some(name) = first.strip_prefix('/').filter(|name| !name.is_empty()) else {
        return Route::Prompt;
    };
    match agent {
        // Codex has no command a message could mean: skills are `$name`, so any `/word` is a TUI control
        // (an unknown one gets the TUI's own "unrecognized command" instead of a model turn).
        "codex" => Route::Terminal,
        "claude" | "pi" | "omp" => {
            let builtin = super::catalog::with_builtins(agent, live)
                .iter()
                .any(|entry| entry.name == name && entry.kind.as_deref() == Some("builtin"));
            if builtin {
                Route::Terminal
            } else {
                Route::Prompt
            }
        }
        _ => Route::Prompt,
    }
}

const MAX_COMMAND: usize = 256;
const KEY_INTERVAL: Duration = Duration::from_millis(16);

/// Whether the input line the cursor is on holds nothing typed. The text *before* the cursor is what
/// counts: a placeholder ("Ask Codex to do anything") is drawn after it.
// ponytail: single-line check on the cursor's row. A multi-line draft whose last line is empty, or a
// TUI that parks the cursor elsewhere, reads as empty; the upgrade is a per-CLI editor API.
pub fn input_is_empty(screen: &str, cursor_row: usize, cursor_col: usize) -> bool {
    let row = screen.lines().nth(cursor_row).unwrap_or_default();
    row.chars()
        .take(cursor_col)
        .all(|ch| ch.is_whitespace() || matches!(ch, '›' | '❯' | '>' | '│' | '┃' | '▌'))
}

/// A pager or a boxed overlay is open (Codex's `/diff` pager ends in `q close`; OMP's `/hotkeys` draws a
/// titled box from the top row). Keys typed now would go to it, not the prompt. The alternate-screen
/// flag is no signal: Codex and Pi draw their normal UI there.
// ponytail: only the two shapes seen live; another CLI's inline, untitled overlay would pass. The
// upgrade is a per-CLI "prompt is focused" signal.
pub fn overlay_open(screen: &str) -> bool {
    let mut lines = screen.lines().filter(|line| !line.trim().is_empty());
    let titled_box = lines
        .clone()
        .next()
        .is_some_and(|line| line.trim_start().starts_with("\u{256d}\u{2500} "));
    titled_box
        || lines
            .next_back()
            .is_some_and(|line| line.trim_end().ends_with("q close"))
}

/// Refuse unless typing this command cannot land in a dialog, a draft or a running turn.
pub fn prepare(
    key: &crate::agent_fleet::AgentKey,
    text: &str,
    latest: Option<&crate::protocol::NativeUiSnapshot>,
) -> anyhow::Result<()> {
    ensure!(
        !text.is_empty()
            && text.chars().count() <= MAX_COMMAND
            && !text.chars().any(char::is_control),
        "A slash command must be one short line without control characters"
    );
    let latest = latest.context("The CLI has not reported its state yet")?;
    ensure!(
        !latest.blocked,
        "The CLI is waiting for you. Answer it first."
    );
    ensure!(
        !latest.running,
        "A turn is running. Wait for it to finish before sending a command."
    );
    // Claude's own check (`claude::prepare_input`) finds its input box; its cursor is not a reliable guide.
    if key.agent_id == "claude" {
        return Ok(());
    }
    let screen = crate::daemon::client()
        .context("CLI terminal is unavailable")?
        .snapshot(&crate::shell_integration::pty_key(key))
        .context("CLI terminal is unavailable")?;
    if overlay_open(&screen.text) {
        bail!("A CLI overlay is open. Close it in CLI view (Esc) before sending from UI.");
    }
    if !input_is_empty(
        &screen.text,
        screen.cursor_row as usize,
        screen.cursor_col as usize,
    ) {
        bail!("The CLI has a draft or dialog open. Finish it in CLI view before sending from UI.");
    }
    Ok(())
}

/// One PTY write per key, then Enter. Run under the input lease, like every other write.
pub fn type_command(text: &str, write: &dyn Fn(&str) -> anyhow::Result<()>) -> anyhow::Result<()> {
    let mut buffer = [0u8; 4];
    for ch in text.chars() {
        write(ch.encode_utf8(&mut buffer))?;
        std::thread::sleep(KEY_INTERVAL);
    }
    write("\r")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn live(name: &str, kind: &str) -> CommandEntry {
        CommandEntry {
            name: name.into(),
            description: None,
            argument_hint: None,
            kind: Some(kind.into()),
        }
    }

    #[test]
    fn builtins_run_in_the_terminal_and_everything_else_is_a_message() {
        // The probe cases: these were answered as prose by the model before.
        assert_eq!(route("codex", "/status", vec![]), Route::Terminal);
        assert_eq!(route("pi", "/session", vec![]), Route::Terminal);
        assert_eq!(route("claude", "/context", vec![]), Route::Terminal);
        assert_eq!(route("omp", "/hotkeys extra args", vec![]), Route::Terminal);
        // Codex has no message-shaped slash text at all.
        assert_eq!(route("codex", "/nonsense", vec![]), Route::Terminal);
        // Chat, skills (Codex `$`, Pi `/skill:`), project/extension commands and unknown tokens are sent
        // as messages: the CLI itself expands or rejects them.
        assert_eq!(route("claude", "hello /status", vec![]), Route::Prompt);
        assert_eq!(route("codex", "$perchping", vec![]), Route::Prompt);
        assert_eq!(
            route(
                "pi",
                "/skill:perchping",
                vec![live("skill:perchping", "skill")]
            ),
            Route::Prompt
        );
        assert_eq!(
            route("claude", "/perchping", vec![live("perchping", "command")]),
            Route::Prompt
        );
        assert_eq!(route("pi", "/nonsense", vec![]), Route::Prompt);
        // Only a line-leading token is a command.
        assert_eq!(route("codex", " /status", vec![]), Route::Prompt);
        assert_eq!(route("pi", "/", vec![]), Route::Prompt);
        // A live extension command that shadows a built-in does not change what `/name` runs.
        assert_eq!(
            route("pi", "/session", vec![live("session", "extension")]),
            Route::Terminal
        );
        // A CLI with no capture is never routed to a terminal it cannot verify.
        assert_eq!(route("opencode", "/status", vec![]), Route::Prompt);
    }

    #[test]
    fn overlays_are_recognised_from_the_screen() {
        // Both captured live: OMP `/hotkeys` and Codex `/diff`.
        assert!(overlay_open(
            "\n\n╭─ Keyboard Shortcuts ───╮\n│ Navigation │"
        ));
        assert!(overlay_open(
            "`/diff` — not a repo\n~\n──── 100% ─\n↑/↓ to scroll · pgup/pgdn to page · home/end to jump | q close\n\n"
        ));
        // Idle screens of the CLIs that draw on the alternate screen are not overlays: Codex's untitled
        // welcome box, and Pi's top line.
        assert!(!overlay_open(
            "  >_ OpenAI Codex (v0.166.0)\n╭────╮\n› Ask Codex to do anything\n"
        ));
        assert!(!overlay_open("[Skills]\n ~/.agents\n────\n\n────\n"));
        assert!(!overlay_open("────\n Session Info\n"));
    }

    #[test]
    fn an_input_line_is_empty_only_before_the_cursor() {
        // Codex draws its placeholder after the cursor.
        assert!(input_is_empty("x\n› Ask Codex to do anything", 1, 2));
        assert!(!input_is_empty("x\n› half typed", 1, 14));
        assert!(input_is_empty("\n ", 1, 1));
        assert!(!input_is_empty(" /sess", 0, 6));
    }

    #[test]
    fn a_command_is_typed_one_key_at_a_time_then_submitted() {
        let writes = std::cell::RefCell::new(Vec::new());
        type_command("/hé", &|data| {
            writes.borrow_mut().push(data.to_string());
            Ok(())
        })
        .unwrap();
        assert_eq!(*writes.borrow(), ["/", "h", "é", "\r"]);
    }
}
