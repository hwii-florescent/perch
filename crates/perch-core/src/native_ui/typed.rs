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

/// What the CLI's input box holds, read from its screen.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Draft {
    Empty,
    Text(String),
    /// An input box this reader does not recognise, or a draft it cannot read whole (several lines,
    /// soft-wrapped, an overlay over it). Never cleared and never picked up.
    Unreadable,
}

/// A horizontal rule, which OMP titles with a status (`─── 🛡️ SENT: Read x ─`), so only its start counts.
fn is_rule(row: &str) -> bool {
    row.trim_start().starts_with("───")
}

/// The text on the input line of `agent`'s TUI, one line only. Probed live (tmux, no tokens): Claude, Pi
/// and OMP draw the line between two horizontal rules (Claude and OMP lead it with `❯`, Pi has no marker),
/// Codex leads it with `›` and draws no rules. A draft that wraps or has several lines puts the next row
/// somewhere other than a rule, so it reads as [`Draft::Unreadable`] rather than as its first line.
/// Claude's cursor is not a reliable guide (see `claude::prompt_row`), so its box is found by its rules.
// ponytail: Codex has no rules, so a multi-line draft with the cursor on its first row reads as that row.
// The upgrade is a per-CLI editor API.
pub fn read_draft(agent: &str, screen: &str, cursor_row: usize, cursor_col: usize) -> Draft {
    let rows: Vec<&str> = screen.lines().collect();
    let boxed = |i: usize| {
        i >= 1 && rows.get(i + 1).is_some_and(|next| is_rule(next)) && is_rule(rows[i - 1])
    };
    let row = match agent {
        "claude" => (1..rows.len().saturating_sub(1))
            .rev()
            .find(|&i| rows[i].trim_start().starts_with('❯') && boxed(i)),
        "pi" | "omp" => Some(cursor_row).filter(|&i| i < rows.len() && boxed(i)),
        "codex" => Some(cursor_row).filter(|&i| {
            rows.get(i)
                .is_some_and(|row| row.trim_start().starts_with('›'))
        }),
        _ => None,
    };
    let Some((index, row)) = row.map(|i| (i, rows[i])) else {
        return Draft::Unreadable;
    };
    let line = row.trim_start();
    let line = line.strip_prefix(['❯', '›']).unwrap_or(line);
    // Text before the cursor is what was typed; a placeholder or hint is drawn after it. Claude's cursor is
    // not trusted, so only its greyed `Try "…"` example (shape and cursor, `claude::example_placeholder`)
    // is told from a draft.
    let typed: String = if agent == "claude" {
        if super::claude::example_placeholder(row, index == cursor_row, cursor_col) {
            String::new()
        } else {
            line.to_string()
        }
    } else {
        let before: String = row.chars().take(cursor_col).collect();
        let before = before.trim_start();
        before
            .strip_prefix(['❯', '›'])
            .unwrap_or(before)
            .to_string()
    };
    if typed.trim().is_empty() {
        Draft::Empty
    } else {
        Draft::Text(line.trim().to_string())
    }
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

/// The input line of the CLI running as `key`, read from its terminal. An overlay over it is unreadable.
fn current_draft(key: &crate::agent_fleet::AgentKey) -> anyhow::Result<Draft> {
    let screen = crate::daemon::client()
        .context("CLI terminal is unavailable")?
        .snapshot(&crate::shell_integration::pty_key(key))
        .context("CLI terminal is unavailable")?;
    Ok(if overlay_open(&screen.text) {
        Draft::Unreadable
    } else {
        read_draft(
            &key.agent_id,
            &screen.text,
            screen.cursor_row as usize,
            screen.cursor_col as usize,
        )
    })
}

/// What the composer may pick up: the text of a readable, non-empty draft.
pub fn pickup(key: &crate::agent_fleet::AgentKey) -> anyhow::Result<Option<String>> {
    Ok(match current_draft(key)? {
        Draft::Text(text) => Some(text),
        _ => None,
    })
}

/// Clear the line the composer picked up (`expected`) so the message sent from the composer replaces it. Run
/// under the input lease. Ctrl-U clears the line on all four CLIs (probed live). It only fires when the line
/// still holds exactly `expected`; a line that is already empty (sent or cleared in the terminal) is fine, and
/// anything else is refused rather than overwritten. The clear is verified before anything is sent.
pub fn clear_pickup(
    key: &crate::agent_fleet::AgentKey,
    expected: &str,
    latest: Option<&crate::protocol::NativeUiSnapshot>,
    write: &dyn Fn(&str) -> anyhow::Result<()>,
) -> anyhow::Result<()> {
    ensure!(
        latest.is_some_and(|latest| !latest.blocked),
        "The CLI is waiting for you. Answer it first."
    );
    match current_draft(key)? {
        Draft::Empty => return Ok(()),
        Draft::Text(text) if text == expected => {}
        _ => bail!("The CLI's input line changed since it was picked up. Check it in CLI view."),
    }
    write("\u{15}")?;
    std::thread::sleep(Duration::from_millis(150));
    ensure!(
        current_draft(key)? == Draft::Empty,
        "The CLI's input line could not be cleared. Clear it in CLI view first."
    );
    Ok(())
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

    #[test]
    fn the_draft_is_read_from_each_clis_input_line() {
        let rule = "──────────";
        let text = |s: &str| Draft::Text(s.into());
        // Screens as probed live with `first line` typed (and Ctrl-U after it).
        let claude = format!("x\n{rule}\n❯ first line\n{rule}\n  status");
        assert_eq!(read_draft("claude", &claude, 0, 0), text("first line"));
        // Claude's cursor is parked elsewhere; its box is found by the rules.
        assert_eq!(read_draft("claude", &claude, 4, 9), text("first line"));
        assert_eq!(
            read_draft("claude", &format!("{rule}\n❯ \n{rule}\n"), 1, 2),
            Draft::Empty
        );
        // Claude's greyed example in a fresh prompt is not a draft; the same words typed (cursor at their
        // end) are.
        let example = format!("x\n{rule}\n❯\u{a0}Try \"fix lint errors\"\n{rule}\n  status");
        assert_eq!(read_draft("claude", &example, 2, 2), Draft::Empty);
        assert_eq!(
            read_draft("claude", &example, 2, 21),
            text("Try \"fix lint errors\"")
        );
        let pi = format!("{rule}\n\n{rule}\nfirst line\n{rule}\n/tmp");
        assert_eq!(read_draft("pi", &pi, 3, 10), text("first line"));
        assert_eq!(
            read_draft("pi", &format!("{rule}\n\n{rule}\n\n{rule}"), 3, 0),
            Draft::Empty
        );
        let omp = format!("{rule}\n❯ first line\n{rule}\n π · status");
        assert_eq!(read_draft("omp", &omp, 1, 12), text("first line"));
        // Seen live after a turn: OMP titles the rule above its input.
        let titled =
            format!("{rule}── 🛡️ SENT: Read sentinel.txt contents ─\n❯ half typed\n{rule}");
        assert_eq!(read_draft("omp", &titled, 1, 12), text("half typed"));
        // A hint drawn after the cursor is not a draft.
        let omp_empty =
            format!("{rule}\n❯                       ⇧⇥ to change thinking effort\n{rule}");
        assert_eq!(read_draft("omp", &omp_empty, 1, 2), Draft::Empty);
        assert_eq!(
            read_draft("codex", "menu\n› first line\n\n  GPT", 1, 12),
            text("first line")
        );
        assert_eq!(
            read_draft("codex", "menu\n› Ask Codex to do anything\n", 1, 2),
            Draft::Empty
        );
    }

    #[test]
    fn a_draft_that_wraps_or_has_no_known_box_is_unreadable_not_truncated() {
        let rule = "──────────";
        // The second row of a longer draft sits where the closing rule should be.
        let wrapped = format!("{rule}\n❯ a long draft that\n  wrapped\n{rule}");
        assert_eq!(read_draft("claude", &wrapped, 2, 9), Draft::Unreadable);
        assert_eq!(read_draft("omp", &wrapped, 2, 9), Draft::Unreadable);
        // Codex's continuation rows carry no marker.
        assert_eq!(
            read_draft("codex", "› first\n  second", 1, 8),
            Draft::Unreadable
        );
        assert_eq!(read_draft("opencode", "> x", 0, 3), Draft::Unreadable);
        assert_eq!(read_draft("pi", "just text", 5, 0), Draft::Unreadable);
    }
}
