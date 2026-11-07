//! `perch read <child>`: a bounded tail of a sub-session's own transcript for the lead that started
//! it. Pure: no database, no process. The route that checks the caller owns the child and fetches the
//! snapshot is `server/read.rs`; the contract is ARCHITECTURE ("Reading a sub-session").
//!
//! Own design, after the behaviour Claude desktop documents for a session that reads another's
//! recent work; nothing is copied. The tail is read from the transcript Perch already projects
//! (`native_ui::transcript`): per turn, what opened it, one sentence per run of tool calls ("Read 3
//! files and ran 2 commands"), the files its landed edits changed with their line counts, and the
//! last thing the agent said. **Never** a tool's output or a file's contents, and never more than
//! [`MAX_CHARS`] in all; the newest turn is kept and older ones are dropped first.
use crate::native_ui::transcript::{self, NativeUiBlock};
use crate::protocol::{NativeUiMessage, NativeUiSnapshot};

/// Turns read when `--turns` is not given.
pub const DEFAULT_TURNS: usize = 2;
/// The most turns one read may ask for.
pub const MAX_TURNS: usize = 5;
/// The most characters one read returns.
pub const MAX_CHARS: usize = 8_000;

const ASKED_CHARS: usize = 1_000;
const SAID_CHARS: usize = 3_000;
const RUN_LINES: usize = 20;
const RUN_CHARS: usize = 150;
const FILE_LINES: usize = 15;
const FILE_CHARS: usize = 120;
const QUESTION_CHARS: usize = 500;

/// How many turns were asked for: absent means the default, 0 or too many is refused with the limits.
pub fn check_turns(asked: Option<u64>) -> Result<usize, String> {
    match asked {
        None => Ok(DEFAULT_TURNS),
        Some(turns) if (1..=MAX_TURNS as u64).contains(&turns) => Ok(turns as usize),
        Some(_) => Err(format!(
            "--turns is 1 to {MAX_TURNS} (default {DEFAULT_TURNS}): perch read <session> [--turns N]"
        )),
    }
}

/// What a read returns.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Tail {
    /// The tail as text, oldest turn first.
    pub text: String,
    /// How many turns it holds.
    pub turns: usize,
    /// Older turns were left out, or one was cut, to stay within [`MAX_CHARS`].
    pub cut: bool,
}

/// Cut `text` to `max` characters, marking the cut. Line breaks are kept: a reader wants the shape of
/// what the agent said.
fn cut_text(text: &str, max: usize) -> String {
    let text = text.trim();
    let mut chars = text.chars();
    let head: String = chars.by_ref().take(max).collect();
    if chars.next().is_none() {
        return head;
    }
    let mut cut: String = head.chars().take(max.saturating_sub(1)).collect();
    cut.push('…');
    cut
}

fn indent(text: &str) -> String {
    text.lines()
        .map(|line| format!("    {line}").trim_end().to_string())
        .collect::<Vec<_>>()
        .join("\n")
}

/// What opened a turn, in words: a delivered message reads as who it is from, not as its envelope.
fn asked(message: &NativeUiMessage, sender: Option<&crate::agent_mail::Envelope>) -> String {
    match sender {
        Some(envelope) => {
            let from = match envelope.sender.as_str() {
                "session" => format!(
                    "{} \"{}\"",
                    envelope.provider.as_deref().unwrap_or("another session"),
                    envelope.label.as_deref().unwrap_or("")
                ),
                "person" => "the person, through Perch".to_string(),
                _ => "Perch (status notes)".to_string(),
            };
            format!(
                "a {} from {from}: {}",
                envelope.kind,
                cut_text(&envelope.body, ASKED_CHARS)
            )
        }
        None => cut_text(&message.text, ASKED_CHARS),
    }
}

/// The last `turns` turns of `snapshot`, within [`MAX_CHARS`].
pub fn tail(snapshot: &NativeUiSnapshot, turns: usize) -> Tail {
    let projected = transcript::project(snapshot);
    // Turns in the order they appear: the user message that opened each, which blocks name.
    let mut order: Vec<String> = Vec::new();
    for block in &projected.blocks {
        let (NativeUiBlock::Message { turn, .. } | NativeUiBlock::Run { turn, .. }) = block;
        if order.last() != Some(turn) {
            order.push(turn.clone());
        }
    }
    let skipped = order.len().saturating_sub(turns);
    let wanted = &order[skipped..];
    let last_turn = order.last();
    let message_of = |id: &str| snapshot.messages.iter().find(|message| message.id == id);
    let mut rendered: Vec<String> = Vec::new();
    for (position, turn) in wanted.iter().enumerate() {
        let mut lines = vec![format!("Turn {}/{}:", position + 1, wanted.len())];
        let opener = message_of(turn).filter(|message| message.role == "user");
        if let Some(message) = opener {
            let sender = projected.blocks.iter().find_map(|block| match block {
                NativeUiBlock::Message { id, sender, .. } if *id == message.id => sender.as_ref(),
                _ => None,
            });
            lines.push(format!(
                "  Asked: {}",
                indent(&asked(message, sender)).trim_start()
            ));
        }
        let mut said: Option<&str> = None;
        let mut runs = 0;
        for block in &projected.blocks {
            match block {
                NativeUiBlock::Message { id, turn: of, .. } if of == turn => {
                    if let Some(message) = message_of(id).filter(|m| m.role == "assistant") {
                        if !message.text.trim().is_empty() {
                            said = Some(message.text.as_str());
                        }
                    }
                }
                NativeUiBlock::Run {
                    turn: of,
                    summary,
                    failed,
                    ..
                } if of == turn && runs < RUN_LINES && !summary.trim().is_empty() => {
                    runs += 1;
                    let line = if *failed > 0 {
                        format!("{summary} ({failed} failed)")
                    } else {
                        summary.clone()
                    };
                    lines.push(format!(
                        "  Did: {}",
                        cut_text(&line.replace('\n', " "), RUN_CHARS)
                    ));
                }
                _ => {}
            }
        }
        if let Some(diff) = projected.turn_diffs.iter().find(|diff| diff.turn == *turn) {
            let files: Vec<String> = diff
                .files
                .iter()
                .take(FILE_LINES)
                .map(|file| {
                    cut_text(
                        &format!("{} (+{} -{})", file.path, file.added, file.removed),
                        FILE_CHARS,
                    )
                })
                .collect();
            if !files.is_empty() {
                lines.push(format!("  Changed: {}", files.join(", ")));
            }
        }
        if let Some(text) = said {
            lines.push(format!("  Said:\n{}", indent(&cut_text(text, SAID_CHARS))));
        }
        if Some(turn) == last_turn {
            if let Some(request) = &snapshot.request {
                lines.push(format!(
                    "  Waiting on a person: {}",
                    cut_text(
                        &format!("{} {}", request.title, request.detail).replace('\n', " "),
                        QUESTION_CHARS
                    )
                ));
            }
            if snapshot.running {
                lines.push("  (this turn is still running)".into());
            }
        }
        rendered.push(lines.join("\n"));
    }
    // Newest first until the budget is spent, then back to reading order.
    let mut kept: Vec<String> = Vec::new();
    let mut used = 0;
    let mut cut = false;
    for turn in rendered.iter().rev() {
        let size = turn.chars().count() + 2;
        if used + size > MAX_CHARS && !kept.is_empty() {
            cut = true;
            break;
        }
        used += size;
        kept.push(turn.clone());
    }
    kept.reverse();
    let mut text = kept.join("\n\n");
    if text.chars().count() > MAX_CHARS {
        text = cut_text(&text, MAX_CHARS);
        cut = true;
    }
    Tail {
        text,
        turns: kept.len(),
        cut,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::NativeUiTool;

    fn message(id: &str, role: &str, text: &str) -> NativeUiMessage {
        NativeUiMessage {
            id: id.into(),
            role: role.into(),
            text: text.into(),
            ..Default::default()
        }
    }

    fn call(id: &str, name: &str, input: &str) -> NativeUiMessage {
        NativeUiMessage {
            id: id.into(),
            role: "assistant".into(),
            tools: vec![NativeUiTool {
                name: name.into(),
                input: input.into(),
                id: Some(format!("call-{id}")),
                state: None,
            }],
            ..Default::default()
        }
    }

    fn result(id: &str, of: &str, text: &str) -> NativeUiMessage {
        NativeUiMessage {
            id: id.into(),
            role: "toolResult".into(),
            text: text.into(),
            tool_call_id: Some(format!("call-{of}")),
            ..Default::default()
        }
    }

    fn snapshot(messages: Vec<NativeUiMessage>) -> NativeUiSnapshot {
        NativeUiSnapshot {
            messages,
            ..Default::default()
        }
    }

    fn three_turns() -> NativeUiSnapshot {
        snapshot(vec![
            message("u1", "user", "first task"),
            message("a1", "assistant", "FIRST ANSWER"),
            message("u2", "user", "second task"),
            call("c1", "Read", r#"{"file_path":"/w/src/lib.rs"}"#),
            result("r1", "c1", "SECRET FILE CONTENTS"),
            message("a2", "assistant", "second answer\nover two lines"),
            message("u3", "user", "third task"),
            message("a3", "assistant", "THIRD ANSWER"),
        ])
    }

    #[test]
    fn the_turns_asked_for_are_read_newest_last_with_what_each_asked_did_and_said() {
        let tail = tail(&three_turns(), 2);
        assert_eq!(tail.turns, 2);
        assert!(!tail.cut || tail.text.contains("second task"), "{tail:?}");
        assert!(tail.text.contains("Turn 1/2:"), "{}", tail.text);
        assert!(tail.text.contains("Asked: second task"), "{}", tail.text);
        assert!(tail.text.contains("Did: Read"), "{}", tail.text);
        assert!(
            tail.text.contains("    second answer\n    over two lines"),
            "{}",
            tail.text
        );
        assert!(tail.text.contains("THIRD ANSWER"));
        assert!(
            tail.text.find("second task") < tail.text.find("third task"),
            "reading order"
        );
        // The turn before them is not here, and one turn is the last.
        assert!(!tail.text.contains("FIRST ANSWER"), "{}", tail.text);
        let one = super::tail(&three_turns(), 1);
        assert!(one.text.contains("third task") && !one.text.contains("second task"));
        // More turns than exist is every turn there is.
        assert_eq!(super::tail(&three_turns(), 5).turns, 3);
    }

    #[test]
    fn a_tool_s_output_never_appears_only_the_sentence_about_the_run() {
        let all = tail(&three_turns(), 5);
        assert!(!all.text.contains("SECRET FILE CONTENTS"), "{}", all.text);
        assert!(
            !all.text.contains("lib.rs") || all.text.contains("Did:"),
            "{}",
            all.text
        );
    }

    #[test]
    fn a_read_is_capped_and_drops_the_oldest_turns_first() {
        let huge = "word ".repeat(2_000);
        let mut messages = Vec::new();
        for turn in 0..5 {
            messages.push(message(
                &format!("u{turn}"),
                "user",
                &format!("task {turn} {huge}"),
            ));
            messages.push(message(
                &format!("a{turn}"),
                "assistant",
                &format!("answer {turn} {huge}"),
            ));
        }
        let tail = tail(&snapshot(messages), 5);
        assert!(
            tail.text.chars().count() <= MAX_CHARS,
            "{}",
            tail.text.chars().count()
        );
        assert!(tail.cut);
        assert!(tail.turns < 5 && tail.turns >= 1);
        assert!(tail.text.contains("answer 4"), "the newest turn is kept");
        assert!(!tail.text.contains("answer 0"), "the oldest goes first");
    }

    #[test]
    fn the_longest_turn_every_part_allows_still_fits() {
        let mut messages = vec![message("u1", "user", &"a".repeat(5_000))];
        for index in 0..40 {
            messages.push(call(
                &format!("c{index}"),
                if index % 2 == 0 { "Read" } else { "Bash" },
                "{}",
            ));
            messages.push(result(&format!("r{index}"), &format!("c{index}"), "x"));
        }
        messages.push(message("a1", "assistant", &"s".repeat(9_000)));
        let tail = tail(&snapshot(messages), 5);
        assert!(tail.text.chars().count() <= MAX_CHARS);
    }

    #[test]
    fn a_waiting_question_and_a_running_turn_are_said() {
        let mut snap = snapshot(vec![message("u1", "user", "deploy")]);
        snap.running = true;
        snap.request = Some(crate::protocol::NativeUiRequest {
            id: "q".into(),
            title: "Run rm -rf build?".into(),
            detail: "deletes the build folder".into(),
            options: vec![],
        });
        let tail = tail(&snap, 2);
        assert!(
            tail.text.contains("Waiting on a person: Run rm -rf build?"),
            "{}",
            tail.text
        );
        assert!(tail.text.contains("still running"));
    }

    #[test]
    fn a_delivered_message_opening_a_turn_reads_as_who_sent_it() {
        let banner = crate::agent_mail::format_banner(
            &crate::agent_mail::Sender {
                label: "the lead",
                provider: "claude",
                session: "s1",
            },
            crate::agent_mail::MailKind::Message,
            "m1",
            0,
            &crate::agent_mail::BodyText::Whole("please also add a test"),
        );
        let tail = tail(
            &snapshot(vec![
                message("u1", "user", &banner),
                message("a1", "assistant", "ok"),
            ]),
            1,
        );
        assert!(
            tail.text
                .contains("Asked: a message from claude \"the lead\": please also add a test"),
            "{}",
            tail.text
        );
        assert!(!tail.text.contains("────"), "{}", tail.text);
    }

    #[test]
    fn an_empty_transcript_reads_as_no_turns_and_turns_are_checked() {
        let none = tail(&snapshot(vec![]), 2);
        assert_eq!((none.turns, none.text.as_str(), none.cut), (0, "", false));
        assert_eq!(check_turns(None), Ok(DEFAULT_TURNS));
        assert_eq!(check_turns(Some(5)), Ok(5));
        for bad in [0, 6, 100] {
            assert!(check_turns(Some(bad)).unwrap_err().contains("1 to 5"));
        }
    }
}
