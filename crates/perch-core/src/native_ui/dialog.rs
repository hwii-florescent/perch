//! A permission prompt or question the CLI is showing, read from its screen.
//!
//! The provider's own events say *that* a turn is blocked on the human (Claude
//! hooks, Codex app-server, OMP `ask`/approval events, Pi `ui_prompt_start`);
//! none of them let a second client answer. So while blocked, read the PTY
//! screen and, if it shows a choice list this module recognises, offer exactly
//! those choices:
//!
//! - numbered lists (`❯ 1. Yes`), which take a bare digit: Claude, Codex, and
//!   Pi extensions that copy Claude's dialog;
//! - radio lists (`❯ ○ Red`) inside a box, which take arrow keys and Enter: OMP.
//!
//! An answer is written only after the same dialog is read again under the
//! input lease (the `id` fingerprint covers the text, not the cursor, so a newer
//! prompt is never answered by a stale click). Anything not recognised returns
//! `None` and the web view points at Terminal. Extension dialogs vary, so this
//! stays a list of known shapes, never a guess at arbitrary UI.
use crate::protocol::{NativeUiRequest, NativeUiRequestOption};
use sha2::{Digest, Sha256};

const MAX_DETAIL: usize = 2000;
const MAX_LOOKBACK: usize = 14;
const ARROW_DOWN: &str = "\u{1b}[B";
const ARROW_UP: &str = "\u{1b}[A";

/// How the dialog takes its answer.
#[derive(Debug, Clone, Copy, PartialEq)]
enum Keys {
    /// Press the option's digit.
    Digits,
    /// Move the highlight (currently on this 0-based row), then Enter.
    Arrows { cursor: usize },
}

#[derive(Debug, Clone, PartialEq)]
pub struct Dialog {
    pub request: NativeUiRequest,
    keys: Keys,
}

impl Dialog {
    /// The terminal writes that choose `key`, in order; the caller paces them.
    pub fn writes(&self, key: &str) -> Option<Vec<String>> {
        let row: usize = key.parse::<usize>().ok()?.checked_sub(1)?;
        self.request.options.iter().find(|o| o.key == key)?;
        Some(match self.keys {
            Keys::Digits => vec![key.to_string()],
            Keys::Arrows { cursor } => {
                let mut writes = Vec::new();
                if row != cursor {
                    let step = if row > cursor { ARROW_DOWN } else { ARROW_UP };
                    writes.push(step.repeat(row.abs_diff(cursor)));
                }
                writes.push("\r".to_string());
                writes
            }
        })
    }
}

/// Labels that need typed text, which a key press cannot supply.
fn typed_choice(label: &str) -> bool {
    let label = label.to_ascii_lowercase();
    label.starts_with("type something")
        || label.starts_with("chat about this")
        || label.starts_with("other (type")
}

fn option_line(line: &str) -> Option<(usize, &str)> {
    let rest = line
        .trim_start()
        .trim_start_matches(['❯', '›', '>'])
        .trim_start();
    let (number, label) = rest.split_once(". ")?;
    if number.is_empty() || number.len() > 1 || !number.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    Some((number.parse().ok()?, label.trim()))
}

/// `(highlighted, label)` for a radio row such as `❯ ○ Red`.
fn radio_line(line: &str) -> Option<(bool, &str)> {
    let trimmed = line.trim_start();
    let rest = trimmed.trim_start_matches(['❯', '›', '>', '→']);
    let highlighted = rest.len() != trimmed.len();
    let rest = rest.trim_start();
    let label = rest.strip_prefix(['○', '●', '◉', '◯', '◌'])?;
    let label = label.trim();
    (!label.is_empty()).then_some((highlighted, label))
}

fn footer(line: &str) -> bool {
    let line = line.trim().to_ascii_lowercase();
    line.starts_with("esc to") || line.starts_with("enter to") || line.starts_with("press enter")
}

/// OMP: `⏎ select · n note · ↑/↓ move · ⎋ cancel`.
fn radio_footer(line: &str) -> bool {
    let line = line.to_ascii_lowercase();
    line.contains("↑/↓") && (line.contains("select") || line.contains("enter"))
}

/// `───` solid rules end a dialog's frame; `╌╌╌` dashed rules only frame its body.
fn solid_rule(line: &str) -> bool {
    !line.trim().is_empty() && line.trim().chars().all(|c| c == '─')
}

fn dashed_rule(line: &str) -> bool {
    !line.trim().is_empty() && line.trim().chars().all(|c| c == '╌' || c == '-')
}

/// The top or bottom edge of a drawn box; its `├───┤` dividers only separate the box's parts.
fn frame_edge(line: &str) -> bool {
    line.trim_start().starts_with(['╭', '╰', '┌', '└'])
}

fn divider(line: &str) -> bool {
    line.trim_start().starts_with('├')
}

/// A boxed dialog's text without its side borders.
fn unboxed(line: &str) -> &str {
    let trimmed = line.trim();
    match trimmed
        .strip_prefix('│')
        .and_then(|rest| rest.strip_suffix('│'))
    {
        Some(inner) => inner,
        None => line,
    }
}

type Block = (usize, Vec<NativeUiRequestOption>, Keys);

/// The last numbered block followed by an "Esc to…"/"Enter to…" footer.
fn numbered(lines: &[&str]) -> Option<Block> {
    let mut found = None;
    let mut index = 0;
    while index < lines.len() {
        let Some((1, _)) = option_line(lines[index]) else {
            index += 1;
            continue;
        };
        let start = index;
        let mut options: Vec<NativeUiRequestOption> = Vec::new();
        let mut end = index;
        while end < lines.len() {
            let line = lines[end];
            if let Some((number, label)) = option_line(line) {
                if number != options.len() + 1 {
                    break;
                }
                options.push(NativeUiRequestOption {
                    key: number.to_string(),
                    label: label.to_string(),
                    detail: None,
                });
            } else if footer(line) {
                break;
            } else if line.trim().is_empty() || solid_rule(line) {
                // Blank lines and the rule above Claude's "Chat about this" sit inside the block.
            } else if let Some(last) = options.last_mut() {
                let text = line.trim();
                last.detail = Some(match last.detail.take() {
                    Some(old) => format!("{old} {text}"),
                    None => text.to_string(),
                });
            }
            end += 1;
        }
        if end < lines.len() && footer(lines[end]) && !options.is_empty() {
            found = Some((start, options, Keys::Digits));
        }
        index = end.max(index + 1);
    }
    found
}

/// The last run of radio rows with exactly one highlighted, followed by a
/// "↑/↓ … select" footer.
fn radio(lines: &[&str]) -> Option<Block> {
    let mut found = None;
    let mut index = 0;
    while index < lines.len() {
        if radio_line(lines[index]).is_none() {
            index += 1;
            continue;
        }
        let start = index;
        let mut options = Vec::new();
        let mut cursors = Vec::new();
        while let Some((highlighted, label)) = lines.get(index).and_then(|line| radio_line(line)) {
            if highlighted {
                cursors.push(options.len());
            }
            options.push(NativeUiRequestOption {
                key: (options.len() + 1).to_string(),
                label: label.to_string(),
                detail: None,
            });
            index += 1;
        }
        let footer_near = lines[index..].iter().take(6).any(|line| radio_footer(line));
        if let ([cursor], true) = (cursors.as_slice(), footer_near) {
            found = Some((start, options, Keys::Arrows { cursor: *cursor }));
        }
    }
    found
}

pub fn parse_dialog(screen: &str) -> Option<Dialog> {
    let lines: Vec<&str> = screen.lines().map(unboxed).collect();
    let (start, options, keys) = [numbered(&lines), radio(&lines)]
        .into_iter()
        .flatten()
        .max_by_key(|(start, _, _)| *start)?;

    let mut title = None;
    let mut above = Vec::new();
    let mut blanks = 0;
    for line in lines[..start].iter().rev().take(MAX_LOOKBACK) {
        // Codex separates its fields with one blank line and the dialog from the
        // transcript with several; Claude frames its dialog with a solid rule and
        // OMP with a box.
        if solid_rule(line) || frame_edge(line) || (blanks >= 2 && !above.is_empty()) {
            break;
        }
        if line.trim().is_empty() {
            blanks += 1;
            continue;
        }
        blanks = 0;
        if dashed_rule(line) || divider(line) {
            continue;
        }
        above.push(line.trim_end());
        // The topmost question is the title: Codex's `Reason: …?` sits below it.
        if line.trim_end().ends_with('?') {
            title = Some(above.len() - 1);
        }
    }
    above.reverse();
    // `title` indexed the reversed list; map it back.
    let title = title.map(|from_bottom| above.len() - 1 - from_bottom);
    let (title, detail) = match title {
        // Claude: the command sits above its question; Codex: below it.
        Some(at) => {
            let detail: Vec<&str> = above
                .iter()
                .enumerate()
                .filter(|(i, _)| *i != at)
                .map(|(_, line)| *line)
                .collect();
            (above[at].trim().to_string(), detail)
        }
        None => (
            above
                .last()
                .map(|line| line.trim().to_string())
                .unwrap_or_default(),
            above
                .iter()
                .take(above.len().saturating_sub(1))
                .copied()
                .collect(),
        ),
    };
    let indent = detail
        .iter()
        .map(|line| line.len() - line.trim_start().len())
        .min()
        .unwrap_or(0);
    let mut detail = detail
        .iter()
        .map(|line| &line[indent..])
        .collect::<Vec<_>>()
        .join("\n");
    if detail.len() > MAX_DETAIL {
        let mut cut = MAX_DETAIL;
        while !detail.is_char_boundary(cut) {
            cut -= 1;
        }
        detail.truncate(cut);
    }

    let options: Vec<_> = options
        .into_iter()
        .filter(|option| !typed_choice(&option.label))
        .collect();
    if options.is_empty() {
        return None;
    }
    // Not the highlight: moving it must not turn the prompt into a different one.
    let mut hash = Sha256::new();
    hash.update(title.as_bytes());
    hash.update([0]);
    hash.update(detail.as_bytes());
    for option in &options {
        hash.update([0]);
        hash.update(option.label.as_bytes());
    }
    let id = format!("{:x}", hash.finalize())[..16].to_string();
    Some(Dialog {
        request: NativeUiRequest {
            id,
            title,
            detail,
            options,
        },
        keys,
    })
}

pub fn parse(screen: &str) -> Option<NativeUiRequest> {
    parse_dialog(screen).map(|dialog| dialog.request)
}

/// The dialog on this agent's terminal right now, if any.
pub fn read_dialog(key: &crate::agent_fleet::AgentKey) -> Option<Dialog> {
    let client = crate::daemon::client().ok()?;
    let screen = client
        .snapshot(&crate::shell_integration::pty_key(key))
        .ok()?;
    parse_dialog(&screen.text)
}

pub fn read(key: &crate::agent_fleet::AgentKey) -> Option<NativeUiRequest> {
    read_dialog(key).map(|dialog| dialog.request)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Captured from Claude Code 2.1.318 and Codex 0.166.0 on 2026-11-05.
    const CLAUDE_PERMISSION: &str = "
⏺ Bash(touch approved.txt)
  ⎿  Waiting…
────────────────────────────────────────────────────────────────────────────────
 Bash command
 Create the approved.txt file
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 touch approved.txt
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Do you want to proceed?
 ❯ 1. Yes
   2. Yes, and always allow access to /private/tmp/appr-SD32 from this project
   3. No
 Esc to cancel · Tab to amend
";

    const CLAUDE_QUESTION: &str = "
❯ Use the AskUserQuestion tool to ask me which colour I like.
────────────────────────────────────────────────────────────────────────────────
 ☐ Colour
Which colour do you like?
❯ 1. Red
     The colour red
  2. Blue
     The colour blue
  3. Green
     The colour green
  4. Type something.
────────────────────────────────────────────────────────────────────────────────
  5. Chat about this
Enter to select · ↑/↓ to navigate · Esc to cancel
";

    const CODEX_APPROVAL: &str = "
› Run the shell command: touch approved.txt . Then say done.

• Running touch approved.txt



  Would you like to run the following command?

  Environment: local

  Reason: May I create the requested approved.txt file in the workspace?

  $ touch approved.txt


› 1. Yes, proceed (y)
  2. Yes, and don't ask again for commands that start with `touch approved.txt` (p)
  3. No, and tell Codex what to do differently (esc)

  Press enter to confirm or esc to cancel
";

    #[test]
    fn reads_a_claude_permission_prompt() {
        let request = parse(CLAUDE_PERMISSION).unwrap();
        assert_eq!(request.title, "Do you want to proceed?");
        assert!(request.detail.contains("touch approved.txt"));
        assert!(request.detail.starts_with("Bash command"));
        let keys: Vec<_> = request.options.iter().map(|o| o.key.as_str()).collect();
        assert_eq!(keys, ["1", "2", "3"]);
        assert_eq!(request.options[2].label, "No");
    }

    #[test]
    fn reads_a_claude_question_without_its_typed_choices() {
        let request = parse(CLAUDE_QUESTION).unwrap();
        assert_eq!(request.title, "Which colour do you like?");
        let labels: Vec<_> = request.options.iter().map(|o| o.label.as_str()).collect();
        assert_eq!(labels, ["Red", "Blue", "Green"]);
        assert_eq!(request.options[0].detail.as_deref(), Some("The colour red"));
    }

    #[test]
    fn reads_a_codex_approval() {
        let request = parse(CODEX_APPROVAL).unwrap();
        assert_eq!(
            request.title,
            "Would you like to run the following command?"
        );
        assert!(request.detail.contains("$ touch approved.txt"));
        assert!(request.detail.contains("Reason:"));
        assert_eq!(request.options.len(), 3);
        assert_eq!(request.options[0].key, "1");
    }

    #[test]
    fn the_id_changes_with_the_command_being_approved() {
        let other = CODEX_APPROVAL.replace("touch approved.txt\n\n\n›", "rm -rf build\n\n\n›");
        assert_ne!(parse(&other).unwrap().id, parse(CODEX_APPROVAL).unwrap().id);
    }

    // Captured from OMP's `ask` tool; the earlier "Ask 1 questions" box is the tool call, not the dialog.
    const OMP_ASK: &str = "
╭─── Ask 1 questions ──────────────────────────────────────────────────────────────╮
├─── [colour] · options:3 ─────────────────────────────────────────────────────────┤
│  Which colour do you like?                                                       │
│  ○ Red                                                                           │
│  ○ Blue                                                                          │
│  ○ Green                                                                         │
╰──────────────────────────────────────────────────────────────────────────────────╯
  ⎋ Choosing a preferred colour
╭─ Ask ────────────────────────────────────────────────────────────────────────────╮
│ Which colour do you like?                                                        │
├──────────────────────────────────────────────────────────────────────────────────┤
│ ❯ ○ Red                                                                          │
│   ○ Blue                                                                         │
│   ○ Green                                                                        │
│   ○ Other (type your own)                                                        │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│ ⏎ select · n note · ↑/↓ move · ⎋ cancel · ⌥H hide                                │
╰──────────────────────────────────────────────────────────────────────────────────╯
 ⠏ 29s · ⬢ GPT-Reserve
";

    #[test]
    fn reads_an_omp_ask_and_answers_with_arrows() {
        let dialog = parse_dialog(OMP_ASK).unwrap();
        assert_eq!(dialog.request.title, "Which colour do you like?");
        let labels: Vec<_> = dialog
            .request
            .options
            .iter()
            .map(|o| o.label.as_str())
            .collect();
        assert_eq!(labels, ["Red", "Blue", "Green"]);
        assert_eq!(dialog.writes("1").unwrap(), ["\r"]);
        assert_eq!(dialog.writes("3").unwrap(), ["\u{1b}[B\u{1b}[B", "\r"]);
        assert!(dialog.writes("4").is_none());
        // Moving the highlight keeps the same prompt id.
        let moved = OMP_ASK
            .replace("│ ❯ ○ Red", "│   ○ Red")
            .replace("│   ○ Blue", "│ ❯ ○ Blue");
        let moved = parse_dialog(&moved).unwrap();
        assert_eq!(moved.request.id, dialog.request.id);
        assert_eq!(moved.writes("1").unwrap(), ["\u{1b}[A", "\r"]);
    }

    #[test]
    fn numbered_dialogs_are_answered_with_their_digit() {
        let dialog = parse_dialog(CLAUDE_PERMISSION).unwrap();
        assert_eq!(dialog.writes("2").unwrap(), ["2"]);
    }

    #[test]
    fn a_numbered_list_in_ordinary_output_is_not_a_dialog() {
        let prose = "Steps:\n1. Install\n2. Build\n3. Test\n\n❯ \n";
        assert!(parse(prose).is_none());
        assert!(parse("").is_none());
    }
}
