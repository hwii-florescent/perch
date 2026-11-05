//! A permission prompt or question the CLI is showing, read from its screen.
//!
//! Neither Claude's hooks nor Codex's app-server let a second client answer the
//! human, but both TUIs take a bare digit for a numbered choice. So: while the
//! provider's own events say the turn is blocked, read the PTY screen, and if it
//! shows a numbered dialog, offer exactly those choices. An answer writes the one
//! digit, and only after the same dialog is read again under the input lease
//! (the `id` fingerprint covers the text, so a newer prompt is never answered by
//! a stale click). Anything this does not recognise returns `None`: the web view
//! then points at Terminal instead of guessing.
use crate::protocol::{NativeUiRequest, NativeUiRequestOption};
use sha2::{Digest, Sha256};

const MAX_DETAIL: usize = 2000;
const MAX_LOOKBACK: usize = 14;

/// Labels that need typed text, which a digit cannot supply.
fn typed_choice(label: &str) -> bool {
    let label = label.to_ascii_lowercase();
    label.starts_with("type something") || label.starts_with("chat about this")
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

fn footer(line: &str) -> bool {
    let line = line.trim().to_ascii_lowercase();
    line.starts_with("esc to") || line.starts_with("enter to") || line.starts_with("press enter")
}

/// `───` solid rules end a dialog's frame; `╌╌╌` dashed rules only frame its body.
fn solid_rule(line: &str) -> bool {
    !line.trim().is_empty() && line.trim().chars().all(|c| c == '─')
}

fn dashed_rule(line: &str) -> bool {
    !line.trim().is_empty() && line.trim().chars().all(|c| c == '╌' || c == '-')
}

pub fn parse(screen: &str) -> Option<NativeUiRequest> {
    let lines: Vec<&str> = screen.lines().collect();
    // The last numbered block that is followed by a "Esc to…"/"Enter to…" footer.
    let mut found: Option<(usize, Vec<NativeUiRequestOption>)> = None;
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
            found = Some((start, options));
        }
        index = end.max(index + 1);
    }
    let (start, options) = found?;

    let mut title = None;
    let mut above = Vec::new();
    let mut blanks = 0;
    for line in lines[..start].iter().rev().take(MAX_LOOKBACK) {
        // Codex separates its fields with one blank line and the dialog from the
        // transcript with several; Claude frames its dialog with a solid rule.
        if solid_rule(line) || (blanks >= 2 && !above.is_empty()) {
            break;
        }
        if line.trim().is_empty() {
            blanks += 1;
            continue;
        }
        blanks = 0;
        if dashed_rule(line) {
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
    let mut hash = Sha256::new();
    hash.update(title.as_bytes());
    hash.update([0]);
    hash.update(detail.as_bytes());
    for option in &options {
        hash.update([0]);
        hash.update(option.label.as_bytes());
    }
    let id = format!("{:x}", hash.finalize())[..16].to_string();
    Some(NativeUiRequest {
        id,
        title,
        detail,
        options,
    })
}

/// The dialog on this agent's terminal right now, if any.
pub fn read(key: &crate::agent_fleet::AgentKey) -> Option<NativeUiRequest> {
    let client = crate::daemon::client().ok()?;
    let screen = client
        .snapshot(&crate::agent_runtime::terminal_key(key))
        .ok()?;
    parse(&screen.text)
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

    #[test]
    fn a_numbered_list_in_ordinary_output_is_not_a_dialog() {
        let prose = "Steps:\n1. Install\n2. Build\n3. Test\n\n❯ \n";
        assert!(parse(prose).is_none());
        assert!(parse("").is_none());
    }
}
