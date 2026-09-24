//! Agent status from the terminal's OSC 0/2 title, for CLIs with no native
//! status bridge (Gemini, Aider, Cursor, Grok, Droid, a Claude or Pi launched
//! without perch's hooks, ...). Ported from Orca's
//! `src/shared/agent-title-status.ts` (`computeAgentStatusFromTitle`) and the
//! helpers it reads (`agent-title-core.ts`, `pi-state-title-marker.ts`,
//! `pi-compatible-synthetic-title.ts`, `opencode-terminal-title.ts`,
//! `agent-name-token-match.ts`). Rule order is Orca's; each rule's "why" is
//! in those files. Display-title normalisation is not ported: perch never
//! shows the raw title.
//!
//! [`TitleTracker`] is fed PTY output and reports status *changes*;
//! [`signals`] turns a change into lifecycle signals.
use crate::agent_fleet::ProviderSignal;
use regex::Regex;
use std::sync::LazyLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TitleStatus {
    Working,
    /// Waiting on the human: a permission prompt or a question.
    Permission,
    Idle,
}
use TitleStatus::*;

const CLAUDE_IDLE: char = '\u{2733}'; // ✳
const GEMINI_WORKING: char = '\u{2726}'; // ✦
const GEMINI_SILENT_WORKING: char = '\u{23f2}'; // ⏲
const GEMINI_IDLE: char = '\u{25c7}'; // ◇
const GEMINI_PERMISSION: char = '\u{270b}'; // ✋

// JS `\w` is ASCII; `regex`'s is Unicode, so spell the class out. Rust's
// `regex` has no lookaround: Orca's `(?<!X)`/`(?!X)` become `(?:^|[^X])` and
// `(?:$|[^X])`, which is equivalent for a yes/no match.
const LEFT: &str = r"(?:^|[^A-Za-z0-9_./\\-])";
const RIGHT: &str = r"(?:$|[^A-Za-z0-9_./\\-])";
const LEGACY_AGENT_NAMES: &str = "claude|openclaude|codex|copilot|cursor|gemini|antigravity|opencode|opencode2|mimo|openclaw|aider|grok|devin";

fn re(pattern: &str) -> Regex {
    Regex::new(pattern).expect("static title pattern")
}

static LEGACY_NAME: LazyLock<Regex> = LazyLock::new(|| {
    re(&format!(
        r"(?i){LEFT}(?:{LEGACY_AGENT_NAMES})(?:\.(?:exe|cmd|bat|ps1))?{RIGHT}"
    ))
});
static DROID_NAME: LazyLock<Regex> = LazyLock::new(|| re(&format!("(?i){LEFT}droid{RIGHT}")));
static OTHER_NAME: LazyLock<Regex> =
    LazyLock::new(|| re(&format!("(?i){LEFT}(?:hermes|agy){RIGHT}")));
static IDLE_WORD: LazyLock<Regex> = LazyLock::new(|| {
    re(&format!(
        r"(?i){LEFT}(?:ready|idle|done)(?:$|[^A-Za-z0-9_-])"
    ))
});
static WORKING_WORD: LazyLock<Regex> = LazyLock::new(|| {
    re(&format!(
        r"(?i){LEFT}(?:working|thinking|running)(?:$|[^A-Za-z0-9_-])"
    ))
});
static CLAUDE_MANAGEMENT: LazyLock<Regex> = LazyLock::new(|| {
    let command = r"(?:.*[\\/])?claude(?:\.(?:exe|cmd|bat|ps1))?";
    re(&format!(
        r#"(?i)^\s*(?:"{command}"|'{command}'|{command})\s+agents\s*$"#
    ))
});
static OPENCODE_NATIVE: LazyLock<Regex> = LazyLock::new(|| {
    re(r"^\s*(?:[^|▣\x{2800}-\x{28ff}][^|]*? \| )?(?:[▣\x{2800}-\x{28ff}] )?OC \|[ \t]+\S")
});
static PI_STATE: LazyLock<Regex> =
    LazyLock::new(|| re(r"(?:^|[\s|])(?:π|Pi|OMP)[ \t]+([:!>])(?:\s|$)"));
static PI_SYNTHETIC: LazyLock<Regex> = LazyLock::new(|| {
    re(
        r"(?i)^\s*(?:[\x{2800}-\x{28ff}]\s+)?(?:pi|omp)(?:\s+-\s+action required|\s+(?:ready|idle|done))?\s*$",
    )
});
static PI_LEGACY: LazyLock<Regex> =
    LazyLock::new(|| re(r"^\s*(?:[\x{2800}-\x{28ff}]\s+)?π(?:\s*[-:]|\s)"));
static PI_SEPARATOR: LazyLock<Regex> =
    LazyLock::new(|| re(r"^\s*(?:π|Pi|OMP)(?::|\s+([!>-]))(?:\s|$)"));

fn braille(title: &str) -> bool {
    title
        .chars()
        .any(|c| ('\u{2800}'..='\u{28ff}').contains(&c))
}

/// Braille frames, or Claude Code ≥ 2.1.228's quarter circles (◐◑◒◓).
fn spinner(title: &str) -> bool {
    braille(title)
        || title
            .chars()
            .any(|c| ('\u{25d0}'..='\u{25d3}').contains(&c))
}

fn waiting_words(lower: &str) -> bool {
    ["action required", "permission", "waiting"]
        .iter()
        .any(|word| lower.contains(word))
}

/// What a title says about the agent, or `None` when it says nothing (a
/// shell prompt, a cwd, an unrecognised program).
pub fn classify(title: &str) -> Option<TitleStatus> {
    if title.is_empty() || CLAUDE_MANAGEMENT.is_match(title) {
        return None;
    }
    let lower = title.to_lowercase();
    if lower.trim() == "cursor agent" {
        return None;
    }
    if OPENCODE_NATIVE.is_match(title) {
        return Some(if spinner(title) { Working } else { Idle });
    }
    // Pi/OMP's explicit state marker outranks every glyph and keyword below.
    if let Some(marker) = PI_STATE.captures(title) {
        return Some(match &marker[1] {
            ":" => Working,
            "!" => Permission,
            _ => Idle,
        });
    }
    if title.contains(GEMINI_PERMISSION) {
        return Some(Permission);
    }
    if title.contains(GEMINI_WORKING) || title.contains(GEMINI_SILENT_WORKING) {
        return Some(Working);
    }
    if title.contains(GEMINI_IDLE) {
        return Some(Idle);
    }
    if PI_SYNTHETIC.is_match(title) {
        return Some(if braille(title) {
            Working
        } else if waiting_words(&lower) {
            Permission
        } else {
            Idle
        });
    }
    if title == CLAUDE_IDLE.to_string() || title.starts_with(&format!("{CLAUDE_IDLE} ")) {
        return Some(Idle);
    }
    if !braille(title) {
        if let Some(separator) = PI_SEPARATOR.captures(title) {
            let blocked = lower.contains("action required")
                || separator.get(1).is_some_and(|mark| mark.as_str() == "!");
            return Some(if blocked { Permission } else { Idle });
        }
        if PI_LEGACY.is_match(title) {
            return Some(Idle);
        }
    }
    if spinner(title) {
        return Some(Working);
    }
    let legacy = LEGACY_NAME.is_match(title);
    let droid = DROID_NAME.is_match(title);
    if !legacy && !droid && !OTHER_NAME.is_match(title) {
        return None;
    }
    if waiting_words(&lower) {
        return Some(Permission);
    }
    if IDLE_WORD.is_match(title) {
        return Some(Idle);
    }
    if WORKING_WORD.is_match(title) {
        return Some(Working);
    }
    if title.starts_with(". ") {
        return Some(Working);
    }
    if title.starts_with("* ") {
        return Some(Idle);
    }
    // Droid's hooks are authoritative; its name-only title is not completion.
    if droid && !legacy {
        return None;
    }
    Some(Idle)
}

/// Lifecycle signals for one title status change. Entering Working or
/// Permission from rest starts a turn first (Done → Blocked is not a legal
/// edge). Idle closes a turn only if one was running: an agent's startup
/// title is not a completion.
pub fn signals(previous: Option<TitleStatus>, next: TitleStatus) -> Vec<ProviderSignal> {
    let in_turn = matches!(previous, Some(Working | Permission));
    match next {
        _ if previous == Some(next) => vec![],
        Working => vec![ProviderSignal::TurnStarted],
        Permission if in_turn => vec![blocked()],
        Permission => vec![ProviderSignal::TurnStarted, blocked()],
        Idle if in_turn => vec![ProviderSignal::Completed {
            reason: "terminal title reports idle".into(),
        }],
        Idle => vec![],
    }
}

fn blocked() -> ProviderSignal {
    ProviderSignal::InputRequested {
        reason: "terminal title reports waiting on you".into(),
    }
}

/// Follows the OSC title through a PTY stream. vt100 owns the escape-state
/// machine, so a title split across reads, BEL vs ST terminators and OSC
/// look-alikes inside other sequences are handled for free. The screen is a
/// standard 24x80 without scrollback: vt100 underflows on a 1-row grid.
pub struct TitleTracker {
    parser: vt100::Parser,
    status: Option<TitleStatus>,
}

impl Default for TitleTracker {
    fn default() -> Self {
        Self {
            parser: vt100::Parser::new(24, 80, 0),
            status: None,
        }
    }
}

impl TitleTracker {
    /// Feed output; returns `(previous, next)` when the title's status
    /// changed. A title that says nothing keeps the last status: process
    /// exit, not a shell title, is what ends a session here.
    pub fn feed(&mut self, text: &str) -> Option<(Option<TitleStatus>, TitleStatus)> {
        self.parser.process(text.as_bytes());
        let next = classify(self.parser.screen().title())?;
        let previous = self.status.replace(next);
        (previous != Some(next)).then_some((previous, next))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn titles_classify_like_orca() {
        let cases: &[(&str, Option<TitleStatus>)] = &[
            // Claude Code: ✳ idle, braille or quarter-circle spinner working.
            ("✳ Claude Code", Some(Idle)),
            ("⠂ Fix the parser", Some(Working)),
            ("◐ Claude Code", Some(Working)),
            ("claude agents", None),
            // Gemini glyphs.
            ("✋ Gemini CLI", Some(Permission)),
            ("✦ Gemini CLI", Some(Working)),
            ("⏲ Gemini CLI", Some(Working)),
            ("◇ Gemini CLI", Some(Idle)),
            // OpenCode's native title.
            ("OC | Fix tests", Some(Idle)),
            ("⠋ OC | Fix tests", Some(Working)),
            ("host | ▣ OC | Fix tests", Some(Idle)),
            // Pi/OMP state markers win over label text.
            ("π : ~/codex/working", Some(Working)),
            ("OMP ! refactor", Some(Permission)),
            ("zsh | Pi > done", Some(Idle)),
            ("⠋ pi", Some(Working)),
            ("OMP - action required", Some(Permission)),
            ("pi ready", Some(Idle)),
            ("π - session - ~/repo", Some(Idle)),
            ("⠋ π - session - ~/repo", Some(Working)),
            // Named agents with keywords, token-bounded.
            ("codex - action required", Some(Permission)),
            ("aider ready", Some(Idle)),
            ("aider thinking", Some(Working)),
            ("Cursor Agent", None),
            ("droid", None),
            ("codex", Some(Idle)),
            ("~/opencode-blinker", None),
            ("~/codex/ready", None),
            ("reworking codex", Some(Idle)),
            // Not agents.
            ("", None),
            ("zsh", None),
            ("vim README.md", None),
            ("~/android/app", None),
        ];
        for (title, expected) in cases {
            assert_eq!(classify(title), *expected, "{title:?}");
        }
    }

    #[test]
    fn changes_map_to_turn_signals() {
        let kinds = |previous, next| {
            signals(previous, next)
                .into_iter()
                .map(|signal| match signal {
                    ProviderSignal::TurnStarted => "turn",
                    ProviderSignal::InputRequested { .. } => "blocked",
                    ProviderSignal::Completed { .. } => "done",
                    _ => "other",
                })
                .collect::<Vec<_>>()
        };
        assert_eq!(kinds(None, Idle), Vec::<&str>::new());
        assert_eq!(kinds(Some(Idle), Working), ["turn"]);
        assert_eq!(kinds(Some(Working), Permission), ["blocked"]);
        assert_eq!(kinds(Some(Idle), Permission), ["turn", "blocked"]);
        assert_eq!(kinds(Some(Permission), Working), ["turn"]);
        assert_eq!(kinds(Some(Working), Idle), ["done"]);
        assert_eq!(kinds(Some(Permission), Idle), ["done"]);
        assert_eq!(kinds(Some(Working), Working), Vec::<&str>::new());
    }

    #[test]
    fn tracker_reads_split_osc_titles_and_reports_only_changes() {
        let mut tracker = TitleTracker::default();
        assert_eq!(
            tracker.feed("\x1b]0;✳ Claude Code\x07hello"),
            Some((None, Idle))
        );
        // Split mid-sequence and ST-terminated.
        assert_eq!(tracker.feed("\x1b]2;⠂ Fix"), None);
        assert_eq!(tracker.feed(" it\x1b\\"), Some((Some(Idle), Working)));
        assert_eq!(tracker.feed("\x1b]0;⠄ Fix it\x07"), None);
        // A title that says nothing keeps the last status.
        assert_eq!(tracker.feed("\x1b]0;zsh\x07"), None);
        assert_eq!(
            tracker.feed("\x1b]0;✳ Claude Code\x07"),
            Some((Some(Working), Idle))
        );
    }
}
