//! The model, effort and permission-mode pickers of a Claude chat: what they offer, the command that
//! applies a choice, and how the CLI's own screen confirms it. Nothing here writes; the handler in
//! `server/native_ui.rs` types the command at an idle, verified-empty prompt under the input lease.
//!
//! Ported from Orca (commit 308b5000, MIT; see THIRD_PARTY_NOTICES.md): the Claude catalog of
//! `src/shared/agent-session/options/agent-session-option-catalog-claude-codex.ts` (model aliases,
//! effort ladder, the `/model <value>` and `/effort <value>` command templates), the
//! picker snapshot rules of `src/shared/native-chat/input/native-chat-session-option-snapshot.ts`
//! (the reported model is always a choice; a one-choice effort is not a control), the command
//! parsing guard of `native-chat-session-option-commands.ts` (`parseBuiltSessionOptionCommand`: a
//! value is exactly what the template wraps, never prose) and `matchNativeChatCatalogModelId` of
//! `native-chat-session-option-state.ts`, plus the mode descriptions of
//! `src/renderer/src/components/native-chat/native-chat-permission-mode-labels.ts`.
//!
//! **Differences from Orca, on purpose.** Orca remembers what it *dispatched* and shows it with a
//! caption until a report corrects it. Here a picker shows only what was read back from the CLI,
//! and an option with nothing to read back has no picker. Claude 2.1.319 draws its permission mode
//! and its effort in the footer under the prompt (`⏵⏵ accept edits on …`, `● high · /effort`), which
//! is what [`claude_footer`] reads; the model comes back as the `PostModelSwitch` hook or the CLI's
//! "Set model to …" line. A mode has no command, so it is changed by Shift+Tab one step at a time,
//! reading the footer after every step. Orca's catalog for other CLIs is not ported: Codex's
//! `/model` is a two-step TUI picker and Pi/OMP have no typed command with a read-back (see the
//! worker guide, Row 10b).
use super::session_options::{model_id_label, permission_mode_label};
use crate::protocol::{NativeUiOptions, NativeUiPicker, NativeUiPickerChoice, NativeUiSnapshot};
use regex::Regex;
use std::sync::OnceLock;

pub const MODEL: &str = "model";
pub const EFFORT: &str = "effort";
pub const MODE: &str = "mode";

/// Claude's Shift+Tab (back-tab), the key that steps its permission-mode cycle.
pub const CLAUDE_MODE_STEP: &str = "\u{1b}[Z";

/// The most steps a mode change takes: the cycle has at most five modes, so six reads cover it and
/// the first one that repeats the starting mode ends the search.
pub const CLAUDE_MODE_STEPS: usize = 6;

/// What the footer under Claude's prompt says. `None` is "not on screen", never "off".
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Footer {
    /// `ask`, `accept-edits`, `plan`, `auto` or `full-access`.
    pub mode: Option<&'static str>,
    /// `low`, `medium`, `high`, `xhigh` or `max`.
    pub effort: Option<&'static str>,
}

fn effort_value(word: &str) -> Option<&'static str> {
    Some(match word.to_ascii_lowercase().as_str() {
        "low" => "low",
        "medium" => "medium",
        "high" => "high",
        "xhigh" | "extra high" => "xhigh",
        "max" => "max",
        _ => return None,
    })
}

/// The mode and effort in the last rows of Claude's screen. Probed on 2.1.319 (tmux, no tokens):
/// `⏸ manual mode on · ? for shortcuts`, `⏵⏵ accept edits on (shift+tab to cycle)`,
/// `⏸ plan mode on …`, `⏵⏵ auto mode on …`, `⏵⏵ bypass permissions on …`, and at the right of the
/// same row `● high · /effort` (the glyph is a fill level). A model with no effort control draws none.
pub fn claude_footer(screen: &str) -> Footer {
    static MODE: OnceLock<Regex> = OnceLock::new();
    static EFFORT: OnceLock<Regex> = OnceLock::new();
    let mode = MODE.get_or_init(|| {
        Regex::new(
            r"(?i)(?:⏵⏵|⏸)\s+(manual|accept edits|plan|auto|bypass permissions)(?:\s+mode)?\s+on\b",
        )
        .unwrap()
    });
    let effort = EFFORT.get_or_init(|| {
        Regex::new(r"(?i)\s(low|medium|high|extra high|xhigh|max)\s+·\s+/effort\b").unwrap()
    });
    let mut footer = Footer::default();
    for row in screen
        .lines()
        .rev()
        .filter(|row| !row.trim().is_empty())
        .take(6)
    {
        if footer.mode.is_none() {
            footer.mode =
                mode.captures(row)
                    .map(|found| match found[1].to_ascii_lowercase().as_str() {
                        "manual" => "ask",
                        "accept edits" => "accept-edits",
                        "plan" => "plan",
                        "auto" => "auto",
                        _ => "full-access",
                    });
        }
        if footer.effort.is_none() {
            footer.effort = effort
                .captures(row)
                .and_then(|found| effort_value(&found[1]));
        }
    }
    // The indicator shares its slot with Claude's short notices ("auto mode unavailable for this model",
    // "Image in clipboard"), so it is often not drawn. Then the CLI's own answer to `/effort` is the
    // evidence, if it is still on screen and no model switch came after it (a switch can change the level).
    if footer.effort.is_none() {
        footer.effort = latest_effort_notice(screen);
    }
    footer
}

/// The level of the newest "Set effort level to X" line on the screen, unless a "Set model to" line follows it.
fn latest_effort_notice(screen: &str) -> Option<&'static str> {
    static NOTICE: OnceLock<Regex> = OnceLock::new();
    let notice = NOTICE.get_or_init(|| {
        Regex::new(r"(?i)Set effort level to (low|medium|high|extra high|xhigh|max)\b").unwrap()
    });
    let mut level = None;
    for row in screen.lines() {
        if row.contains("Set model to ") {
            level = None;
        } else if let Some(found) = notice.captures(row) {
            level = effort_value(&found[1]);
        }
    }
    level
}

/// How many times the screen shows Claude's answer to `/effort` (`Set effort level to high (saved …)`)
/// for `level`. A count, so an old line of an earlier identical command is not taken for this one's.
pub fn effort_notices(screen: &str, level: &str) -> usize {
    static NOTICE: OnceLock<Regex> = OnceLock::new();
    let notice = NOTICE.get_or_init(|| {
        Regex::new(r"(?i)Set effort level to (low|medium|high|extra high|xhigh|max)\b").unwrap()
    });
    notice
        .captures_iter(screen)
        .filter(|found| effort_value(&found[1]) == Some(level))
        .count()
}

/// How many times the screen shows Claude's answer to `/model` (`Set model to Haiku 5.5 and saved …`)
/// naming `value`'s model: the label of an alias starts with the alias (`haiku` → "Haiku 5.5"), the label
/// of an id is `model_id_label`'s ("claude-haiku-4-5" → "Haiku 4.5").
pub fn model_notices(screen: &str, value: &str) -> usize {
    static NOTICE: OnceLock<Regex> = OnceLock::new();
    let notice =
        NOTICE.get_or_init(|| Regex::new(r"Set model to (.+?)(?: and saved|\s*$)").unwrap());
    let wanted = model_id_label(value);
    let wanted = wanted
        .strip_prefix("Claude ")
        .unwrap_or(&wanted)
        .to_lowercase();
    notice
        .captures_iter(screen)
        .filter(|found| {
            let shown = found[1].trim().to_lowercase();
            shown == wanted || (is_alias(value) && shown.split(' ').next() == Some(value))
        })
        .count()
}

const MODEL_ALIASES: [(&str, &str, &str); 4] = [
    (
        "fable",
        "Fable",
        "Most capable for the hardest, longest-running tasks",
    ),
    ("opus", "Opus", "Best for everyday, complex tasks"),
    ("sonnet", "Sonnet", "Efficient for routine tasks"),
    ("haiku", "Haiku", "Fastest for quick answers"),
];

fn is_alias(value: &str) -> bool {
    MODEL_ALIASES.iter().any(|(alias, _, _)| *alias == value)
}

const EFFORT_LADDER: [(&str, &str); 5] = [
    ("low", "Low"),
    ("medium", "Medium"),
    ("high", "High"),
    ("xhigh", "Extra high"),
    ("max", "Max"),
];

/// Orca's mode wording, with Claude's own plan mode.
const MODES: [(&str, &str); 5] = [
    (
        "ask",
        "Asks before edits and commands your settings don't allow",
    ),
    (
        "accept-edits",
        "Approves file edits and file commands; asks for the rest",
    ),
    ("plan", "Plans first and makes no edits until you approve"),
    ("auto", "Reviews approval requests for you"),
    ("full-access", "Never asks before edits or commands"),
];

fn choice(value: &str, label: &str, description: Option<&str>) -> NativeUiPickerChoice {
    NativeUiPickerChoice {
        value: value.into(),
        label: label.into(),
        description: description.map(str::to_string),
    }
}

/// Orca's `matchNativeChatCatalogModelId`: the alias a reported model id names, by exact id, then by
/// label, then by the longest alias the id contains. `None` for a model the catalog does not know.
pub fn alias_of(reported: &str) -> Option<&'static str> {
    let reported = reported.trim().to_lowercase();
    if reported.is_empty() {
        return None;
    }
    MODEL_ALIASES
        .iter()
        .find(|(alias, label, _)| *alias == reported || label.to_lowercase() == reported)
        .or_else(|| {
            MODEL_ALIASES
                .iter()
                .filter(|(alias, _, _)| reported.contains(alias))
                .max_by_key(|(alias, _, _)| alias.len())
        })
        .map(|(alias, _, _)| *alias)
}

/// The pickers a Claude chat offers, from what the CLI reported (`snapshot`, its latest hook events)
/// and what its screen shows now. A picker exists only for a value that was read back.
pub fn claude_pickers(snapshot: &NativeUiSnapshot, footer: &Footer) -> Vec<NativeUiPicker> {
    // A turn, a question or a permission prompt owns the keys.
    let settable = !snapshot.running && !snapshot.blocked;
    let mut pickers = Vec::new();
    if let Some(reported) = snapshot.model.as_deref().filter(|model| !model.is_empty()) {
        let mut choices: Vec<_> = MODEL_ALIASES
            .iter()
            .map(|(alias, label, description)| choice(alias, label, Some(description)))
            .collect();
        // The running model is always a row, even when it is no alias (Orca `withTrackedNativeChatModel`).
        if !is_alias(reported) {
            let label = model_id_label(reported);
            let label = label.strip_prefix("Claude ").unwrap_or(&label);
            choices.push(choice(reported, label, None));
        }
        pickers.push(NativeUiPicker {
            id: MODEL.into(),
            label: "Model".into(),
            current: Some(reported.to_string()),
            choices,
            settable,
            note: Some("Claude also saves the pick as your default for new sessions.".into()),
        });
        if let Some(level) = footer.effort {
            // Haiku has no effort control (Orca: no options on its row); a one-choice list is no control.
            if alias_of(reported) != Some("haiku") {
                pickers.push(NativeUiPicker {
                    id: EFFORT.into(),
                    label: "Effort".into(),
                    current: Some(level.to_string()),
                    choices: EFFORT_LADDER
                        .iter()
                        .map(|(value, label)| choice(value, label, None))
                        .collect(),
                    settable,
                    note: Some(
                        "Claude also saves the pick as your default for new sessions.".into(),
                    ),
                });
            }
        }
    }
    if let Some(mode) = footer.mode {
        pickers.push(NativeUiPicker {
            id: MODE.into(),
            label: "Permissions".into(),
            current: Some(mode.to_string()),
            choices: MODES
                .iter()
                .filter_map(|(value, description)| {
                    permission_mode_label(value).map(|label| choice(value, label, Some(description)))
                })
                .collect(),
            settable,
            note: Some(
                "Steps through Claude's own mode cycle; a mode this session was not started with is not in it."
                    .into(),
            ),
        });
    }
    pickers
}

/// Orca's `parseBuiltSessionOptionCommand` guard, applied before a value is typed: a model is a listed
/// alias or one id without whitespace, an effort or a mode one of the listed values.
pub fn valid_choice(option: &str, value: &str) -> bool {
    match option {
        MODEL => {
            !value.is_empty()
                && value.len() <= 128
                && !value
                    .chars()
                    .any(|ch| ch.is_whitespace() || ch.is_control())
        }
        EFFORT => EFFORT_LADDER.iter().any(|(level, _)| *level == value),
        MODE => MODES.iter().any(|(mode, _)| *mode == value),
        _ => false,
    }
}

/// The line typed for a model or effort pick (Orca's `build` templates), `None` for a mode, which
/// has no command.
pub fn claude_command(option: &str, value: &str) -> Option<String> {
    if !valid_choice(option, value) {
        return None;
    }
    match option {
        MODEL => Some(format!("/model {value}")),
        EFFORT => Some(format!("/effort {value}")),
        _ => None,
    }
}

/// Does a reported model id satisfy a pick? An id pick is exact; an alias pick is satisfied by any id
/// that names that alias's family.
pub fn model_satisfies(reported: &str, wanted: &str) -> bool {
    if is_alias(wanted) {
        alias_of(reported) == Some(wanted)
    } else {
        reported == wanted
    }
}

/// The pickers for one snapshot sent to a viewer, added to its read-only labels. `screen` is the CLI's
/// terminal text when it could be read.
pub fn with_pickers(
    agent: &str,
    snapshot: &NativeUiSnapshot,
    options: Option<NativeUiOptions>,
    screen: Option<&str>,
) -> Option<NativeUiOptions> {
    let pickers = match (agent, screen) {
        ("claude", Some(screen)) => {
            // The footer is read now; the hook-reported mode is as old as the last prompt.
            let mut footer = claude_footer(screen);
            if footer.mode.is_none() {
                footer.mode = snapshot.permission_mode.as_deref().and_then(known_mode);
            }
            claude_pickers(snapshot, &footer)
        }
        _ => Vec::new(),
    };
    if pickers.is_empty() {
        return options;
    }
    let mut options = options.unwrap_or_default();
    options.pickers = pickers;
    Some(options)
}

fn known_mode(mode: &str) -> Option<&'static str> {
    MODES
        .iter()
        .map(|(value, _)| *value)
        .find(|value| *value == mode)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Captured from Claude Code 2.1.319 on 2026-11-06 (tmux, 120 columns, no tokens).
    fn footer_screen(mode_row: &str, effort: &str) -> String {
        format!(
            "❯ \n────────────────────────────────────────────────\n  {mode_row}{effort}\n    tmux focus-events off · add 'set -g focus-events on' to ~/.tmux.conf\n"
        )
    }

    #[test]
    fn the_footer_names_every_mode_of_the_cycle() {
        for (row, mode) in [
            ("⏸ manual mode on · ? for shortcuts", "ask"),
            ("⏵⏵ accept edits on (shift+tab to cycle)", "accept-edits"),
            ("⏸ plan mode on (shift+tab to cycle)", "plan"),
            (
                "⏵⏵ auto mode on (shift+tab to cycle) · ← for agents",
                "auto",
            ),
            (
                "⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents",
                "full-access",
            ),
        ] {
            assert_eq!(
                claude_footer(&footer_screen(row, "")).mode,
                Some(mode),
                "{row}"
            );
        }
    }

    #[test]
    fn the_footer_reads_effort_only_where_the_cli_draws_it() {
        let row = "⏵⏵ auto mode on (shift+tab to cycle) · ← for agents";
        let with = footer_screen(row, "                        ◐ medium · /effort");
        assert_eq!(claude_footer(&with).effort, Some("medium"));
        let high = footer_screen(
            "⏸ manual mode on · ? for shortcuts",
            "     ● high · /effort",
        );
        assert_eq!(claude_footer(&high).effort, Some("high"));
        let extra = footer_screen(row, "   ● extra high · /effort");
        assert_eq!(claude_footer(&extra).effort, Some("xhigh"));
        // Haiku 4.5 draws none ("Effort not supported"), and a user's status line that merely says
        // "high" is not the footer's effort.
        let none = format!(
            "{}\n   Haiku 4.5  high  55.0%  no git\n",
            footer_screen(row, "")
        );
        assert_eq!(claude_footer(&none).effort, None);
    }

    #[test]
    fn an_effort_notice_stands_in_while_a_notice_holds_the_indicators_slot() {
        // Seen in the core's own screen read of 2.1.319 after `/effort low`: the slot above the prompt box
        // held "auto mode unavailable for this model" and the CLI's answer was a few rows up.
        let screen = "❯ /effort low\n  ⎿  Set effort level to low (saved as your default for new sessions): Quick\n                              auto mode unavailable for this model\n──────\n❯ \n──────\n  ⏵⏵ bypass permissions on (shift+tab to cycle)\n";
        assert_eq!(claude_footer(screen).effort, Some("low"));
        // The indicator, when drawn, wins over an older notice.
        let both = screen.replace(
            "auto mode unavailable for this model",
            "     ● high · /effort",
        );
        assert_eq!(claude_footer(&both).effort, Some("high"));
        // The newest notice wins, and a model switch after it voids it.
        let newer = format!("  ⎿  Set effort level to max (saved)\n{screen}");
        assert_eq!(claude_footer(&newer).effort, Some("low"));
        let switched = format!(
            "{screen}❯ /model opus\n  ⎿  Set model to Opus 5.5 and saved as your default\n"
        );
        assert_eq!(claude_footer(&switched).effort, None);
    }

    #[test]
    fn a_screen_without_the_footer_says_nothing() {
        assert_eq!(claude_footer(""), Footer::default());
        // A dialog over the prompt hides the footer; old output above it is not read.
        let dialog = "  ⏸ plan mode on\n\n a\n b\n c\n d\n e\n  Select model\n  1. Default\n  Enter to confirm\n";
        assert_eq!(claude_footer(dialog), Footer::default());
    }

    #[test]
    fn the_cli_answers_to_effort_and_model_are_counted() {
        let screen = "❯ /effort high\n  ⎿  Set effort level to high (saved as your default for new sessions): Comprehensive\n❯ /model haiku\n  ⎿  Set model to Haiku 5.5 and saved as your default for new sessions\n";
        assert_eq!(effort_notices(screen, "high"), 1);
        assert_eq!(effort_notices(screen, "low"), 0);
        assert_eq!(model_notices(screen, "haiku"), 1);
        assert_eq!(model_notices(screen, "opus"), 0);
        assert_eq!(model_notices(screen, "claude-haiku-5-5"), 1);
        assert_eq!(model_notices(screen, "claude-haiku-4-5"), 0);
        assert_eq!(effort_notices("", "high"), 0);
    }

    #[test]
    fn a_reported_model_names_its_alias_exactly_by_label_or_by_containment() {
        // Orca's `matchNativeChatCatalogModelId`.
        assert_eq!(alias_of("opus"), Some("opus"));
        assert_eq!(alias_of("Sonnet"), Some("sonnet"));
        assert_eq!(alias_of("claude-haiku-4-5"), Some("haiku"));
        assert_eq!(alias_of("claude-opus-5-5[1m]"), Some("opus"));
        assert_eq!(alias_of("grok-4"), None);
        assert_eq!(alias_of(" "), None);
    }

    #[test]
    fn commands_are_built_from_a_template_never_from_prose() {
        assert_eq!(
            claude_command(MODEL, "haiku").as_deref(),
            Some("/model haiku")
        );
        assert_eq!(
            claude_command(MODEL, "claude-haiku-4-5").as_deref(),
            Some("/model claude-haiku-4-5")
        );
        assert_eq!(
            claude_command(EFFORT, "xhigh").as_deref(),
            Some("/effort xhigh")
        );
        // Prose, a second line and a value outside the ladder are refused, as is a mode (no command).
        assert_eq!(claude_command(MODEL, "haiku\n/exit"), None);
        assert_eq!(claude_command(MODEL, "haiku now"), None);
        assert_eq!(claude_command(MODEL, ""), None);
        assert_eq!(claude_command(EFFORT, "turbo"), None);
        assert_eq!(claude_command(MODE, "plan"), None);
        assert_eq!(claude_command("fast", "on"), None);
    }

    #[test]
    fn an_alias_pick_is_met_by_any_id_of_its_family() {
        assert!(model_satisfies("claude-haiku-5-5", "haiku"));
        assert!(!model_satisfies("claude-opus-5-5", "haiku"));
        assert!(model_satisfies("claude-haiku-4-5", "claude-haiku-4-5"));
        assert!(!model_satisfies("claude-haiku-5-5", "claude-haiku-4-5"));
    }

    fn snapshot(model: Option<&str>, running: bool) -> NativeUiSnapshot {
        NativeUiSnapshot {
            model: model.map(str::to_string),
            running,
            ..Default::default()
        }
    }

    #[test]
    fn a_picker_exists_only_for_a_value_read_back() {
        let footer = Footer {
            mode: Some("accept-edits"),
            effort: Some("high"),
        };
        let pickers = claude_pickers(&snapshot(Some("claude-opus-5-5"), false), &footer);
        let ids: Vec<_> = pickers.iter().map(|picker| picker.id.as_str()).collect();
        assert_eq!(ids, [MODEL, EFFORT, MODE]);
        let model = &pickers[0];
        assert_eq!(model.current.as_deref(), Some("claude-opus-5-5"));
        // The four aliases plus the running model, which is no alias.
        assert_eq!(model.choices.len(), 5);
        assert_eq!(model.choices[4].label, "Opus 5.5");
        assert!(model.settable);
        assert_eq!(pickers[2].current.as_deref(), Some("accept-edits"));
        assert_eq!(pickers[2].choices.len(), 5);

        // No model reported: no model or effort picker. No footer mode: no mode picker.
        let bare = claude_pickers(&snapshot(None, false), &Footer::default());
        assert!(bare.is_empty());
        // No effort in the footer, or a model with no effort control: no effort picker.
        let no_effort = claude_pickers(
            &snapshot(Some("claude-opus-5-5"), false),
            &Footer {
                mode: None,
                effort: None,
            },
        );
        assert_eq!(
            no_effort
                .iter()
                .map(|picker| picker.id.as_str())
                .collect::<Vec<_>>(),
            [MODEL]
        );
        let haiku = claude_pickers(&snapshot(Some("claude-haiku-4-5"), false), &footer);
        assert!(haiku.iter().all(|picker| picker.id != EFFORT));
    }

    #[test]
    fn a_running_turn_or_a_prompt_locks_every_picker() {
        let footer = Footer {
            mode: Some("ask"),
            effort: Some("low"),
        };
        let running = claude_pickers(&snapshot(Some("claude-opus-5-5"), true), &footer);
        assert!(running.iter().all(|picker| !picker.settable));
        let mut blocked = snapshot(Some("claude-opus-5-5"), false);
        blocked.blocked = true;
        assert!(claude_pickers(&blocked, &footer)
            .iter()
            .all(|picker| !picker.settable));
    }

    #[test]
    fn the_running_model_that_is_an_alias_is_not_listed_twice() {
        let pickers = claude_pickers(&snapshot(Some("opus"), false), &Footer::default());
        assert_eq!(pickers[0].choices.len(), 4);
    }

    #[test]
    fn only_claude_with_a_readable_screen_gets_pickers() {
        let screen = footer_screen(
            "⏸ manual mode on · ? for shortcuts",
            "     ● high · /effort",
        );
        let shot = snapshot(Some("claude-opus-5-5"), false);
        let options = with_pickers("claude", &shot, None, Some(&screen)).unwrap();
        assert_eq!(options.pickers.len(), 3);
        assert!(with_pickers("claude", &shot, None, None).is_none());
        assert!(with_pickers("codex", &shot, None, Some(&screen)).is_none());
        // The labels already derived are kept.
        let labels = NativeUiOptions {
            model: Some("Opus 5.5".into()),
            ..Default::default()
        };
        let merged = with_pickers("claude", &shot, Some(labels), Some(&screen)).unwrap();
        assert_eq!(merged.model.as_deref(), Some("Opus 5.5"));
        // With the footer hidden, the hook's last mode stands in.
        let mut hidden = snapshot(Some("claude-opus-5-5"), false);
        hidden.permission_mode = Some("plan".into());
        let options = with_pickers("claude", &hidden, None, Some("")).unwrap();
        assert_eq!(options.pickers.len(), 2);
        assert_eq!(options.pickers[1].current.as_deref(), Some("plan"));
    }
}
