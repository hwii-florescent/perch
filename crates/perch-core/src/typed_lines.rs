//! What a person typed into a session's terminal, as completed lines: the proof `perch start` and
//! `perch dismiss` need that a person, not the agent, asked for it. Only bytes a client sent to the
//! PTY land here (a view's keystrokes and pastes); Perch's own writes and everything an agent does
//! from inside its shell never do. In memory, short-lived and consumed by use.
use std::collections::VecDeque;
use std::time::{Duration, Instant};

/// Completed lines kept per session, and the longest a line may grow while it is typed.
const LINES: usize = 8;
const LINE_CHARS: usize = 512;
/// How long after Enter a typed line still counts.
pub const FRESH: Duration = Duration::from_secs(120);

#[derive(Default)]
pub struct TypedLines {
    partial: String,
    done: VecDeque<(Instant, String)>,
    /// Inside an escape sequence the terminal or a key sent (arrows, paste markers, reports).
    escape: Escape,
}

#[derive(Default, PartialEq)]
enum Escape {
    #[default]
    None,
    Started,
    Csi,
}

impl TypedLines {
    /// Take what a client sent. Enter completes a line, Backspace edits it, escape sequences are
    /// skipped; any other control character is dropped.
    pub fn feed(&mut self, data: &str, now: Instant) {
        for ch in data.chars() {
            match (&self.escape, ch) {
                (Escape::Started, '[') => self.escape = Escape::Csi,
                (Escape::Started, _) => self.escape = Escape::None,
                (Escape::Csi, '\u{40}'..='\u{7e}') => self.escape = Escape::None,
                (Escape::Csi, _) => {}
                (Escape::None, '\u{1b}') => self.escape = Escape::Started,
                (Escape::None, '\r' | '\n') => {
                    let line = std::mem::take(&mut self.partial);
                    if !line.trim().is_empty() {
                        self.done.push_back((now, line));
                        if self.done.len() > LINES {
                            self.done.pop_front();
                        }
                    }
                }
                (Escape::None, '\u{7f}' | '\u{8}') => {
                    self.partial.pop();
                }
                (Escape::None, c)
                    if !c.is_control() && self.partial.chars().count() < LINE_CHARS =>
                {
                    self.partial.push(c);
                }
                _ => {}
            }
        }
    }

    /// Was `command` entered within `within` of `now`? A leading `!` (Claude's and Pi's shell
    /// escape) does not matter; the rest must match exactly. A match is used up: the same line
    /// proves one request.
    pub fn take(&mut self, command: &str, now: Instant, within: Duration) -> bool {
        let found = self.done.iter().rposition(|(at, line)| {
            now.saturating_duration_since(*at) <= within
                && line.trim().trim_start_matches('!').trim() == command
        });
        match found {
            Some(index) => {
                self.done.remove(index);
                true
            }
            None => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_a_completed_line_typed_by_a_client_counts_and_only_once() {
        let now = Instant::now();
        let mut typed = TypedLines::default();
        typed.feed("!perch start abc", now);
        assert!(!typed.take("perch start abc", now, FRESH), "no Enter yet");
        typed.feed("\r", now);
        assert!(!typed.take("perch start abd", now, FRESH));
        assert!(typed.take("perch start abc", now, FRESH));
        assert!(!typed.take("perch start abc", now, FRESH), "used up");
    }

    #[test]
    fn editing_pasting_arrows_and_reports_leave_only_the_text_the_person_meant() {
        let now = Instant::now();
        let mut typed = TypedLines::default();
        typed.feed("perch dismisxx\u{7f}\u{7f}s \u{1b}[200~abc\u{1b}[201~", now);
        typed.feed("\u{1b}[D\u{1b}[1;5C\u{1b}[?1;2c\r", now);
        assert!(typed.take("perch dismiss abc", now, FRESH));
    }

    #[test]
    fn an_old_line_does_not_count() {
        let then = Instant::now();
        let mut typed = TypedLines::default();
        typed.feed("perch start all\r", then);
        let later = then + FRESH + Duration::from_secs(1);
        assert!(!typed.take("perch start all", later, FRESH));
    }
}
