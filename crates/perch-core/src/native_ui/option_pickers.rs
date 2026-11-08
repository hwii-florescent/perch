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
//! docs/evidence/cli-probes-2026-11.md).
use super::session_options::{effort_label, model_id_label, permission_mode_label};
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
            // Haiku 4.x has no effort control (Orca: no options on its row); a one-choice list is no control.
            if alias_of(reported) != Some("haiku") || reported.contains("haiku-5") {
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

/// Codex 0.166's `/permissions` presets, in the order its list draws them: the mode, the row's text in that list
/// (how the CLI's screen is read) and what it does. Probed live (docs/evidence/cli-probes-2026-11.md).
pub const CODEX_MODES: [(&str, &str, &str); 4] = [
    (
        "ask",
        "Ask for approval",
        "Reads and edits workspace files and runs commands; asks for internet access or edits outside it",
    ),
    (
        "auto",
        "Approve for me",
        "Only asks for actions detected as potentially unsafe",
    ),
    (
        "full-access",
        "Full Access",
        "Edits any file and uses the internet without approval",
    ),
    (
        "read-only",
        "Read Only",
        "Reads workspace files; asks for edits or internet access",
    ),
];

pub fn valid_codex_mode(value: &str) -> bool {
    CODEX_MODES.iter().any(|(mode, _, _)| *mode == value)
}

/// A Codex chat's permission picker. The current mode is what its app-server reports for the thread (it sends
/// `thread/settings/updated` after every change), so unlike Claude's it needs no screen; a combination that is no
/// preset has no current value but can still be replaced. Codex has no model or effort picker here: `/model` is a
/// two-step TUI list.
pub fn codex_pickers(snapshot: &NativeUiSnapshot) -> Vec<NativeUiPicker> {
    vec![NativeUiPicker {
        id: MODE.into(),
        label: "Permissions".into(),
        current: snapshot.permission_mode.clone().filter(|mode| valid_codex_mode(mode)),
        choices: CODEX_MODES
            .iter()
            .filter_map(|(value, _, description)| {
                permission_mode_label(value).map(|label| choice(value, label, Some(description)))
            })
            .collect(),
        settable: !snapshot.running && !snapshot.blocked,
        note: Some("Runs Codex's own /permissions list for this session only; Full access asks you to confirm first.".into()),
    }]
}

/// What Codex's `/permissions` list shows: the mode marked `(current)` and the key of every row.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CodexPermissionList {
    pub current: Option<&'static str>,
    pub keys: Vec<(&'static str, char)>,
}

/// The open `/permissions` list on `screen`, or `None` when it is not showing. Each preset is a numbered row
/// (`› 2. Approve for me (current)  Only ask for …`); the number is read from the screen, not assumed.
pub fn codex_permission_list(screen: &str) -> Option<CodexPermissionList> {
    static ROW: OnceLock<Regex> = OnceLock::new();
    if !screen.contains("Update Model Permissions") {
        return None;
    }
    let row = ROW.get_or_init(|| {
        Regex::new(r"^\s*(?:›\s*)?(\d)\.\s+(Ask for approval|Approve for me|Full Access|Read Only)\b(\s+\(current\))?").unwrap()
    });
    let mut list = CodexPermissionList {
        current: None,
        keys: Vec::new(),
    };
    for found in screen.lines().filter_map(|line| row.captures(line)) {
        let Some((mode, _, _)) = CODEX_MODES.iter().find(|(_, text, _)| *text == &found[2]) else {
            continue;
        };
        list.keys.push((mode, found[1].chars().next()?));
        if found.get(3).is_some() {
            list.current = Some(mode);
        }
    }
    (list.keys.len() == CODEX_MODES.len()).then_some(list)
}

/// The key of "Yes, continue anyway" while Codex asks "Enable full access?".
pub fn codex_full_access_confirm(screen: &str) -> Option<char> {
    static YES: OnceLock<Regex> = OnceLock::new();
    if !screen.contains("Enable full access?") {
        return None;
    }
    let yes =
        YES.get_or_init(|| Regex::new(r"(?m)^\s*(?:›\s*)?(\d)\.\s+Yes, continue anyway").unwrap());
    yes.captures(screen)?[1].chars().next()
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
    with_pickers_with(agent, snapshot, options, screen, &saved_claude_effort)
}

/// `with_pickers` with the saved-effort lookup supplied (the tests must not read the machine's settings).
fn with_pickers_with(
    agent: &str,
    snapshot: &NativeUiSnapshot,
    options: Option<NativeUiOptions>,
    screen: Option<&str>,
    saved: &dyn Fn(&NativeUiSnapshot) -> Option<&'static str>,
) -> Option<NativeUiOptions> {
    // The footer draws the effort only some of the time, so a Claude chat falls back to the level the user
    // saved for the model; it stays marked as such on the picker.
    let mut effort = None;
    let mut from_settings = false;
    let mut pickers = match (agent, screen) {
        ("codex", _) => codex_pickers(snapshot),
        ("claude", Some(screen)) => {
            // The footer is read now; the hook-reported mode is as old as the last prompt.
            let mut footer = claude_footer(screen);
            if footer.mode.is_none() {
                footer.mode = snapshot.permission_mode.as_deref().and_then(known_mode);
            }
            if footer.effort.is_none() {
                footer.effort = saved(snapshot);
                from_settings = footer.effort.is_some();
            }
            effort = footer.effort;
            claude_pickers(snapshot, &footer)
        }
        _ => Vec::new(),
    };
    if agent == "claude" && screen.is_none() {
        effort = saved(snapshot);
    }
    for picker in pickers
        .iter_mut()
        .filter(|picker| picker.id == EFFORT && from_settings)
    {
        picker.note = Some("Shown from your Claude settings: the CLI does not draw it. Picking a level sets it in the CLI.".into());
    }
    // A read-only label for a viewer that gets no pickers (an older web, or the screen could not be read).
    let label = effort.filter(|_| {
        options
            .as_ref()
            .is_none_or(|options| options.effort.is_none())
    });
    if pickers.is_empty() && label.is_none() {
        return options;
    }
    let mut options = options.unwrap_or_default();
    if let Some(level) = label {
        options.effort = Some(effort_label(level));
    }
    options.pickers = pickers;
    Some(options)
}

/// The effort Claude was last told to use for this model: the user's `modelSettings.<model>.effortLevel`,
/// else their `effortLevel`, in the config dir the CLI itself reads. A model with no effort control has none.
/// ponytail: user settings only (a project's `.claude/settings.json` can override it), re-read per snapshot;
/// add the project file and an mtime cache if either matters.
fn saved_claude_effort(snapshot: &NativeUiSnapshot) -> Option<&'static str> {
    let model = snapshot
        .model
        .as_deref()
        .filter(|model| !model.is_empty())?;
    let dir = std::env::var_os("CLAUDE_CONFIG_DIR")
        .map(std::path::PathBuf::from)
        .or_else(|| {
            std::env::var_os("HOME").map(|home| std::path::Path::new(&home).join(".claude"))
        })?;
    let settings = serde_json::from_slice(&std::fs::read(dir.join("settings.json")).ok()?).ok()?;
    saved_effort(model, &settings)
}

fn saved_effort(model: &str, settings: &serde_json::Value) -> Option<&'static str> {
    // Haiku 4.x has no effort control; Haiku 5.x does.
    if alias_of(model) == Some("haiku") && !model.contains("haiku-5") {
        return None;
    }
    let id = model.split('[').next().unwrap_or(model).trim();
    settings["modelSettings"][id]["effortLevel"]
        .as_str()
        .or_else(|| settings["effortLevel"].as_str())
        .and_then(effort_value)
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
    fn the_saved_effort_stands_in_for_an_undrawn_one_per_model() {
        let settings = serde_json::json!({
            "effortLevel": "high",
            "modelSettings": { "claude-opus-5-5": { "effortLevel": "medium" }, "claude-haiku-5-5": { "effortLevel": "low" } }
        });
        // The model's own entry wins, then the global one; a context suffix is not part of the id.
        assert_eq!(saved_effort("claude-opus-5-5", &settings), Some("medium"));
        assert_eq!(
            saved_effort("claude-opus-5-5[1m]", &settings),
            Some("medium")
        );
        assert_eq!(saved_effort("claude-sonnet-5-5", &settings), Some("high"));
        // Haiku 5.x has an effort control, Haiku 4.x none, whatever the file says.
        assert_eq!(saved_effort("claude-haiku-5-5", &settings), Some("low"));
        assert_eq!(saved_effort("claude-haiku-4-5", &settings), None);
        assert_eq!(
            saved_effort(
                "claude-opus-5-5",
                &serde_json::json!({ "effortLevel": "turbo" })
            ),
            None
        );
        assert_eq!(
            saved_effort("claude-opus-5-5", &serde_json::json!({})),
            None
        );
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

    fn with_pickers(
        agent: &str,
        snapshot: &NativeUiSnapshot,
        options: Option<NativeUiOptions>,
        screen: Option<&str>,
    ) -> Option<NativeUiOptions> {
        with_pickers_with(agent, snapshot, options, screen, &|_| None)
    }

    #[test]
    fn a_saved_effort_fills_an_undrawn_one_and_says_where_it_came_from() {
        let shot = snapshot(Some("claude-opus-5-5"), false);
        let screen = footer_screen("⏸ manual mode on · ? for shortcuts", "");
        let saved = |_: &NativeUiSnapshot| Some("medium");
        let options = with_pickers_with("claude", &shot, None, Some(&screen), &saved).unwrap();
        let effort = options
            .pickers
            .iter()
            .find(|picker| picker.id == EFFORT)
            .unwrap();
        assert_eq!(effort.current.as_deref(), Some("medium"));
        assert!(effort.note.as_deref().unwrap().contains("settings"));
        assert_eq!(options.effort.as_deref(), Some("Medium"));
        // What the footer draws wins, and is not marked as saved.
        let drawn = footer_screen(
            "⏸ manual mode on · ? for shortcuts",
            "     ● high · /effort",
        );
        let options = with_pickers_with("claude", &shot, None, Some(&drawn), &saved).unwrap();
        let effort = options
            .pickers
            .iter()
            .find(|picker| picker.id == EFFORT)
            .unwrap();
        assert_eq!(effort.current.as_deref(), Some("high"));
        assert!(!effort.note.as_deref().unwrap().contains("settings"));
        // No readable screen: no pickers, but the label is still there.
        let options = with_pickers_with("claude", &shot, None, None, &saved).unwrap();
        assert!(options.pickers.is_empty());
        assert_eq!(options.effort.as_deref(), Some("Medium"));
    }

    // Captured from Codex 0.166.0 on 2026-11-07 (tmux, no tokens): `/permissions`, then the full-access choice.
    const CODEX_LIST: &str = "  Update Model Permissions\n  1. Ask for approval          Read and edit workspace files and run commands, with approval required for internet\n                               access or edits outside the workspace\n› 2. Approve for me (current)  Only ask for actions detected as potentially unsafe\n  3. Full Access               Use with caution: Codex can edit files outside this workspace and access the internet\n                               without approval\n  4. Read Only                 Read workspace files, with approval required for edits or internet access\n  enter select · esc back\n";
    const CODEX_CONFIRM: &str = "  Enable full access?\n  When Codex runs with full access, it can edit any file on your\n› 1. Yes, continue anyway  Apply full access for this session\n  2. Cancel                Go back without enabling full access\n  enter select · esc back\n";

    #[test]
    fn codexs_permissions_list_and_confirmation_are_read_from_its_screen() {
        let list = codex_permission_list(CODEX_LIST).unwrap();
        assert_eq!(list.current, Some("auto"));
        assert_eq!(
            list.keys,
            [
                ("ask", '1'),
                ("auto", '2'),
                ("full-access", '3'),
                ("read-only", '4')
            ]
        );
        // The marker moves with the current mode, and a list that is not fully on screen is not a list.
        let moved = CODEX_LIST
            .replace(" (current)", "")
            .replace("1. Ask for approval ", "1. Ask for approval (current)");
        assert_eq!(codex_permission_list(&moved).unwrap().current, Some("ask"));
        assert_eq!(codex_permission_list("› Ask Codex to do anything"), None);
        assert_eq!(
            codex_permission_list(&CODEX_LIST.replace("  4. Read Only", "")),
            None
        );
        assert_eq!(codex_full_access_confirm(CODEX_CONFIRM), Some('1'));
        assert_eq!(codex_full_access_confirm(CODEX_LIST), None);
    }

    #[test]
    fn codex_offers_a_permission_picker_and_pi_and_omp_offer_nothing() {
        let mut shot = snapshot(Some("gpt-5.6-luna"), false);
        shot.permission_mode = Some("read-only".into());
        let options = with_pickers("codex", &shot, None, None).unwrap();
        assert_eq!(options.pickers.len(), 1);
        let mode = &options.pickers[0];
        assert_eq!(
            (mode.id.as_str(), mode.current.as_deref(), mode.settable),
            (MODE, Some("read-only"), true)
        );
        assert_eq!(
            mode.choices
                .iter()
                .map(|choice| choice.value.as_str())
                .collect::<Vec<_>>(),
            ["ask", "auto", "full-access", "read-only"]
        );
        // A combination that is no preset has no current value but can be replaced; a running turn locks it.
        shot.permission_mode = None;
        shot.running = true;
        let mode = &with_pickers("codex", &shot, None, None).unwrap().pickers[0];
        assert_eq!((mode.current.as_deref(), mode.settable), (None, false));
        for agent in ["pi", "omp"] {
            assert!(with_pickers(agent, &shot, None, None).is_none(), "{agent}");
        }
    }

    #[test]
    fn only_claude_with_a_readable_screen_gets_claudes_pickers() {
        let screen = footer_screen(
            "⏸ manual mode on · ? for shortcuts",
            "     ● high · /effort",
        );
        let shot = snapshot(Some("claude-opus-5-5"), false);
        let options = with_pickers("claude", &shot, None, Some(&screen)).unwrap();
        assert_eq!(options.pickers.len(), 3);
        assert!(with_pickers("claude", &shot, None, None).is_none());
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
