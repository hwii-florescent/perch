//! Reconstructing a CLI-mode session's first prompt from its keystroke stream.
//!
//! Hosted mode gets session titles for free: every turn is a `messages` row,
//! and `db.rs`'s title expression takes the first `role='user'` one. CLI mode
//! has no such row — the agent's own PTY owns the transcript — so the nav
//! showed "(new session)" forever regardless of what the session was about.
//!
//! The one thing perch *does* see for a CLI session is `terminal.input`: the
//! exact bytes the user typed. This module turns that byte stream back into
//! the line the user submitted, by running the same minimal edit model a
//! line-editor does — printable characters accumulate, backspace deletes,
//! Ctrl-U/Ctrl-C abandon, Enter submits.
//!
//! Deliberately *not* a terminal emulator. It never looks at what the agent
//! echoes back, only at input, and it gives up quietly (returns nothing,
//! keeps buffering) rather than guessing whenever the stream doesn't look
//! like a typed line — e.g. the Enter that dismisses a trust-folder prompt
//! submits an empty buffer, which yields no title and leaves the next real
//! prompt free to become one.

/// Longest title we will produce. Matches the 40-char `SUBSTR` the Hosted
/// auto-title uses, so both kinds of session truncate the same way in the nav.
const MAX_TITLE_CHARS: usize = 40;

use regex::Regex;
use std::sync::OnceLock;

/// Hard cap on the pending buffer so a session where the user pastes a novel
/// and never presses Enter can't grow this without bound. Larger than
/// `MAX_TITLE_CHARS` because the leading characters are the ones we keep, and
/// we still want backspacing back into range to work.
const MAX_BUFFER_CHARS: usize = 512;

/// Where the escape-sequence state machine is between chunks. Terminal input
/// arrives in arbitrarily-split WS frames, so a `\x1b[` can land at the end of
/// one `terminal.input` and its final byte at the start of the next — the
/// state has to survive across `feed` calls.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
enum EscState {
    #[default]
    Ground,
    /// Saw ESC; the next byte decides whether this is CSI, OSC, or a
    /// two-character sequence (e.g. Alt+Enter, which many CLIs send as
    /// `ESC CR` for "newline, don't submit").
    Esc,
    /// Inside CSI (`ESC [`) or SS3 (`ESC O`), terminated by a byte in
    /// 0x40..=0x7E. SS3 carries application-mode arrow/function keys. This is
    /// also what swallows bracketed-paste markers (`ESC [ 200 ~`), so pasted
    /// text lands in the buffer as plain characters.
    Csi,
    /// Inside OSC/DCS/APC/PM responses, ending in BEL or ST. Consumed wholesale.
    Osc,
    /// ESC within a string response; consume the following ST backslash too.
    OscEsc,
}

/// Per-terminal accumulator. One of these lives per CLI-attached session for
/// as long as that session still has no title.
#[derive(Debug, Default)]
pub struct CliTitleBuffer {
    text: String,
    esc: EscState,
}

impl CliTitleBuffer {
    pub fn new() -> Self {
        Self::default()
    }

    /// Feed one `terminal.input` payload. Returns the submitted line the
    /// moment the user presses Enter on a non-empty buffer, and nothing
    /// otherwise. The buffer resets after every submit attempt, empty or not.
    pub fn feed(&mut self, data: &str) -> Option<String> {
        let mut submitted = None;
        for ch in data.chars() {
            match self.esc {
                EscState::Esc => {
                    self.esc = match ch {
                        '[' | 'O' => EscState::Csi,
                        ']' | 'P' | '_' | '^' => EscState::Osc,
                        // Any other byte completes a two-char sequence. Note
                        // this is what makes Alt/Shift+Enter (`ESC CR`)
                        // correctly *not* submit: the CR is consumed here.
                        _ => EscState::Ground,
                    };
                }
                EscState::Csi => {
                    if ('\u{40}'..='\u{7e}').contains(&ch) {
                        self.esc = EscState::Ground;
                    }
                }
                EscState::Osc => {
                    self.esc = match ch {
                        '\u{7}' | '\u{9c}' => EscState::Ground,
                        '\u{1b}' => EscState::OscEsc,
                        _ => EscState::Osc,
                    };
                }
                EscState::OscEsc => {
                    self.esc = match ch {
                        '\\' | '\u{7}' | '\u{9c}' => EscState::Ground,
                        '\u{1b}' => EscState::OscEsc,
                        _ => EscState::Osc,
                    };
                }
                EscState::Ground => match ch {
                    '\u{1b}' => self.esc = EscState::Esc,
                    '\r' | '\n' => {
                        // A trailing backslash is the CLIs' line-continuation
                        // convention: the user is still composing, so fold it
                        // into a space instead of submitting a half-sentence.
                        if self.text.trim_end().ends_with('\\') {
                            let trimmed = self.text.trim_end();
                            self.text = trimmed[..trimmed.len() - 1].to_string();
                            self.text.push(' ');
                        } else if let Some(title) = clean_prompt(&self.text) {
                            self.text.clear();
                            // Keep scanning the rest of the chunk (the state
                            // machine must stay consistent), but the first
                            // submitted line is the one that wins.
                            if submitted.is_none() {
                                submitted = Some(title);
                            }
                        } else {
                            self.text.clear();
                        }
                    }
                    // Backspace / delete.
                    '\u{8}' | '\u{7f}' => {
                        self.text.pop();
                    }
                    // Ctrl-C (abandon), Ctrl-U (kill line), Ctrl-W is left
                    // alone deliberately — word-erase would need us to model
                    // word boundaries the same way the CLI does, and getting
                    // it wrong is worse than a slightly-off title.
                    '\u{3}' | '\u{15}' => self.text.clear(),
                    // Everything else in C0 is dropped. Tab is in here on
                    // purpose: in these TUIs Tab means "complete", not
                    // "insert a tab", so echoing it into the buffer would put
                    // a character in the title the user never typed.
                    c if c.is_control() => {}
                    c => {
                        if self.text.chars().count() < MAX_BUFFER_CHARS {
                            self.text.push(c);
                        }
                    }
                },
            }
        }
        submitted
    }
}

/// Turn a submitted prompt into a nav-sized title: drop a leading `/command`, file paths (bare or
/// quoted) and pasted-image placeholders, collapse whitespace, and cut at [`MAX_TITLE_CHARS`]. When
/// nothing else is left the command's own name stands in (`/ak-debug '/x.png'` is `ak-debug`).
/// `None` only for a prompt with no words at all, the signal to keep waiting for a real one.
pub fn clean_prompt(raw: &str) -> Option<String> {
    static NOISE: OnceLock<Regex> = OnceLock::new();
    let noise = NOISE.get_or_init(|| {
        Regex::new(r#"'(?:~|\.\.?)?/[^']*'|"(?:~|\.\.?)?/[^"]*"|\[(?:Image|Pasted text)[^\]]*\]"#)
            .expect("valid prompt noise pattern")
    });
    let text = noise.replace_all(raw, " ");
    let mut words: Vec<&str> = text.split_whitespace().collect();
    let mut command = None;
    if let Some(first) = words.first().and_then(|word| word.strip_prefix('/')) {
        // A command name ends at the first character a command cannot hold; a `/` there means
        // the word is a path (`/Users/…`), not a command. A Tab-completed command can run into
        // what follows (`/ak-debu'/Users/…`), so the rest of the word is kept as its own word.
        let end = first
            .find(|c: char| !(c.is_alphanumeric() || matches!(c, '-' | '_' | ':' | '.')))
            .unwrap_or(first.len());
        if end > 0 && !first[end..].starts_with('/') {
            command = Some(&first[..end]);
            words[0] = &first[end..];
        }
    }
    let kept = words
        .into_iter()
        .filter(|word| !word.is_empty() && !is_path(word))
        .collect::<Vec<_>>()
        .join(" ");
    let title = if kept.is_empty() {
        command?.to_string()
    } else {
        kept
    };
    Some(title.chars().take(MAX_TITLE_CHARS).collect())
}

fn is_path(word: &str) -> bool {
    let word = word.trim_start_matches(['\'', '"', '`', '(', '<']);
    ["/", "~/", "./", "../", "file://"]
        .iter()
        .any(|prefix| word.starts_with(prefix))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_typed_line_becomes_a_title_on_enter() {
        let mut buf = CliTitleBuffer::new();
        assert_eq!(buf.feed("fix the login bug"), None);
        assert_eq!(buf.feed("\r"), Some("fix the login bug".to_string()));
    }

    /// Every character arrives as its own `terminal.input` in practice, so the
    /// per-chunk path has to behave identically to one big chunk.
    #[test]
    fn keystrokes_split_one_char_per_chunk() {
        let mut buf = CliTitleBuffer::new();
        let mut result = None;
        for ch in "hello\r".chars() {
            if let Some(t) = buf.feed(&ch.to_string()) {
                result = Some(t);
            }
        }
        assert_eq!(result, Some("hello".to_string()));
    }

    #[test]
    fn backspace_deletes_and_ctrl_u_clears() {
        let mut buf = CliTitleBuffer::new();
        buf.feed("helloo\u{7f}");
        assert_eq!(buf.feed("\r"), Some("hello".to_string()));

        let mut buf = CliTitleBuffer::new();
        buf.feed("throw this away\u{15}keep this");
        assert_eq!(buf.feed("\r"), Some("keep this".to_string()));
    }

    /// The Enter that dismisses a menu (trust-folder prompt, model picker)
    /// must not mint an empty title — it should leave the next real prompt
    /// free to become one.
    #[test]
    fn bare_enter_yields_no_title_and_keeps_buffering() {
        let mut buf = CliTitleBuffer::new();
        assert_eq!(buf.feed("\r"), None);
        assert_eq!(buf.feed("   \r"), None);
        assert_eq!(buf.feed("real prompt\r"), Some("real prompt".to_string()));
    }

    /// Arrow keys, Alt+Enter and bracketed paste all arrive as escape
    /// sequences. None of them may leak into the title, and `ESC CR`
    /// (newline-not-submit) must not submit.
    #[test]
    fn escape_sequences_are_swallowed() {
        let mut buf = CliTitleBuffer::new();
        // Up/down arrows around some typing.
        buf.feed("\u{1b}[Aabc\u{1b}[Bdef");
        assert_eq!(buf.feed("\r"), Some("abcdef".to_string()));

        // Alt+Enter: a soft newline, not a submit.
        let mut buf = CliTitleBuffer::new();
        assert_eq!(buf.feed("line one\u{1b}\r"), None);
        assert_eq!(buf.feed("line two\r"), Some("line oneline two".to_string()));

        // Bracketed paste markers are CSI sequences; the payload survives.
        let mut buf = CliTitleBuffer::new();
        buf.feed("\u{1b}[200~pasted text\u{1b}[201~");
        assert_eq!(buf.feed("\r"), Some("pasted text".to_string()));
    }

    /// An escape sequence split across two WS frames must not spill its tail
    /// into the buffer — this is why `EscState` lives on the struct.
    #[test]
    fn escape_sequence_split_across_chunks() {
        let mut buf = CliTitleBuffer::new();
        buf.feed("ab\u{1b}");
        buf.feed("[C");
        buf.feed("cd");
        assert_eq!(buf.feed("\r"), Some("abcd".to_string()));

        // Application-cursor arrows must not title a trust-dialog session B.
        let mut buf = CliTitleBuffer::new();
        for chunk in ["\u{1b}", "O", "B", "\r", "\u{1b}OP", "\r"] {
            assert_eq!(buf.feed(chunk), None);
        }
        assert_eq!(buf.feed("real prompt\r"), Some("real prompt".into()));
    }

    #[test]
    fn terminal_string_responses_do_not_prefix_the_user_title() {
        let mut buf = CliTitleBuffer::new();
        for introducer in [']', 'P', '_', '^'] {
            assert_eq!(
                buf.feed(&format!("\u{1b}{introducer}10;rgb:aaaa/bbbb/cccc\u{1b}")),
                None
            );
            assert_eq!(buf.feed("\\"), None);
        }
        assert_eq!(buf.feed("actual prompt\r"), Some("actual prompt".into()));
    }

    #[test]
    fn trailing_backslash_continues_the_line() {
        let mut buf = CliTitleBuffer::new();
        assert_eq!(buf.feed("first part \\\r"), None);
        assert_eq!(
            buf.feed("second part\r"),
            Some("first part second part".to_string()),
        );
    }

    #[test]
    fn long_prompts_truncate_and_whitespace_collapses() {
        let mut buf = CliTitleBuffer::new();
        buf.feed("  lots   of  space  ");
        assert_eq!(buf.feed("\r"), Some("lots of space".to_string()));

        let mut buf = CliTitleBuffer::new();
        buf.feed(&"x".repeat(200));
        let title = buf.feed("\r").unwrap();
        assert_eq!(title.chars().count(), MAX_TITLE_CHARS);
    }

    /// A user who never presses Enter must not be able to grow the buffer
    /// without bound.
    #[test]
    fn buffer_is_capped() {
        let mut buf = CliTitleBuffer::new();
        for _ in 0..100 {
            buf.feed(&"y".repeat(100));
        }
        assert!(buf.text.chars().count() <= MAX_BUFFER_CHARS);
    }

    #[test]
    fn prompts_are_cleaned_into_titles() {
        let cases = [
            ("/ak-debug '/Users/hwiii/.perch/x.png'", Some("ak-debug")),
            ("/ak-debu'/Users/hwiii/.perch/x.png'", Some("ak-debu")),
            (
                "/ak-debug '/Users/me/x.png' why does login fail",
                Some("why does login fail"),
            ),
            (
                "fix   the\tbug in ~/proj/a.rs and ./b.rs",
                Some("fix the bug in and"),
            ),
            (
                "[Image #1] what is wrong here?",
                Some("what is wrong here?"),
            ),
            ("look at \"/tmp/a b/c.png\" please", Some("look at please")),
            ("/Users/me/screenshot.png", None),
            ("/review", Some("review")),
            ("explain and/or summarize", Some("explain and/or summarize")),
            ("   ", None),
        ];
        for (raw, expected) in cases {
            assert_eq!(clean_prompt(raw).as_deref(), expected, "{raw:?}");
        }
        assert_eq!(
            clean_prompt(&"word ".repeat(30)).unwrap().chars().count(),
            40
        );
    }

    #[test]
    fn a_submitted_command_with_only_a_pasted_path_is_titled_by_the_command() {
        let mut buf = CliTitleBuffer::new();
        assert_eq!(
            buf.feed("/ak-debug '/Users/hwiii/.perch/x.png'\r"),
            Some("ak-debug".to_string())
        );
    }
}
