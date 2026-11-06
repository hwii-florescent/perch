//! What the toolbar says about a session's model, effort and permission mode, read back from the
//! provider and worded here. Read-only: nothing in this module changes a live session.
//!
//! Ported from Orca (commit 308b5000, MIT; see THIRD_PARTY_NOTICES.md): `src/shared/model-id-label.ts`
//! (`labelFromModelId`, with its test), the effort and permission-mode wording of
//! `src/shared/native-chat/input/native-chat-session-option-labels.ts` and
//! `src/renderer/src/components/native-chat/native-chat-permission-mode-labels.ts`, Claude's reported
//! mode names from `src/main/claude/structured/claude-structured-init-proof.ts`
//! (`readClaudeReportedPermissionMode`) and Codex's mode policies from `src/shared/
//! codex-permission-policy.ts`. Orca's pickers, option descriptors and banner reader are not ported.
//!
//! The mode is one of Orca's four (`ask`, `accept-edits`, `auto`, `full-access`) or Claude's `plan`.
//! A value no table here knows is dropped, never guessed.
use crate::protocol::{NativeUiOptions, NativeUiSnapshot};
use regex::Regex;
use serde_json::Value;
use std::sync::OnceLock;

/// "claude-opus-5-5[1m]" as "Claude Opus 5.5 (1M context)". Ids spell a dotted version with dashes
/// after the name ("claude-opus-5-5", "grok-4-1-fast"); a run after a number (2024-08-06), with a
/// zero-led part (preview-05-20) or of only two-digit parts (preview-10-20) is a date.
pub fn model_id_label(id: &str) -> String {
    static VERSION: OnceLock<Regex> = OnceLock::new();
    static DATE: OnceLock<Regex> = OnceLock::new();
    static CONTEXT: OnceLock<Regex> = OnceLock::new();
    // Orca's pattern ends in a lookahead; the regex crate has none, so the terminator is matched
    // and the next search starts in front of it.
    let version = VERSION.get_or_init(|| {
        Regex::new(r"(?i)(^|[/-])([a-z]+-)((?:[1-9]\d|\d)(?:-(?:[1-9]\d|\d))+)($|[-/\[])").unwrap()
    });
    let date = DATE.get_or_init(|| Regex::new(r"^\d\d(?:-\d\d)+$").unwrap());
    let mut dotted = String::new();
    let mut at = 0;
    while let Some(found) = version.captures_at(id, at) {
        let whole = found.get(0).unwrap();
        let end = found.get(4).unwrap().start();
        dotted.push_str(&id[at..whole.start()]);
        if date.is_match(&found[3]) {
            dotted.push_str(&id[whole.start()..end]);
        } else {
            dotted.push_str(&found[1]);
            dotted.push_str(&found[2]);
            dotted.push_str(&found[3].replace('-', "."));
        }
        at = end;
    }
    dotted.push_str(&id[at..]);
    let context = CONTEXT.get_or_init(|| Regex::new(r"(?i)\[(\d+[km])\]$").unwrap());
    let dotted = context.replace(&dotted, |size: &regex::Captures| {
        format!(" ({} context)", size[1].to_uppercase())
    });
    dotted
        .split(['/', '-'])
        .filter(|part| !part.is_empty())
        .map(|part| {
            if part.eq_ignore_ascii_case("gpt") {
                "GPT".to_string()
            } else if part.chars().count() <= 3 && part.starts_with(|ch: char| ch.is_ascii_digit())
            {
                part.to_uppercase()
            } else {
                let mut chars = part.chars();
                chars.next().map_or_else(String::new, |first| {
                    first.to_uppercase().chain(chars).collect()
                })
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// The model as the toolbar names it: Orca drops "Claude " when the name comes from the id alone
/// (`nativeChatModelPillLabel`).
fn model_label(id: &str) -> String {
    let label = model_id_label(id);
    label.strip_prefix("Claude ").unwrap_or(&label).to_string()
}

/// Orca's effort wording; a level it has no word for is shown as the provider wrote it.
fn effort_label(value: &str) -> String {
    match value {
        "minimal" => "Minimal",
        "low" => "Low",
        "medium" => "Medium",
        "high" => "High",
        "xhigh" => "Extra high",
        "max" => "Max",
        "ultra" => "Ultra",
        "ultracode" => "Ultracode",
        other => other,
    }
    .to_string()
}

fn permission_mode_label(mode: &str) -> Option<&'static str> {
    Some(match mode {
        "ask" => "Ask for approval",
        "accept-edits" => "Accept edits",
        "auto" => "Approve for me",
        "full-access" => "Full access",
        "plan" => "Plan mode",
        _ => return None,
    })
}

/// Claude's `permission_mode` (hook input) or `permissionMode` (stream frames) as a mode name.
pub fn claude_permission_mode(reported: &str) -> Option<&'static str> {
    Some(match reported {
        "default" => "ask",
        "acceptEdits" => "accept-edits",
        "auto" => "auto",
        "plan" => "plan",
        "bypassPermissions" => "full-access",
        _ => return None,
    })
}

/// The mode a Codex thread runs in, from the three fields its app-server reports (Orca's three
/// policies; `untrusted` also asks). Codex has no edits-only mode, and any other combination, a
/// workspace sandbox the user configured by hand for one, is unknown rather than a guess.
pub fn codex_permission_mode(
    approval_policy: &Value,
    sandbox: &Value,
    reviewer: &Value,
) -> Option<&'static str> {
    let policy = approval_policy.as_str()?;
    let sandbox = sandbox["type"].as_str()?;
    let reviewer = reviewer.as_str().unwrap_or("user");
    match (policy, sandbox, reviewer) {
        ("never", "dangerFullAccess", _) => Some("full-access"),
        ("on-request", "workspaceWrite", "auto_review") => Some("auto"),
        ("on-request" | "untrusted", "readOnly", "user") => Some("ask"),
        _ => None,
    }
}

/// The read-only labels for a snapshot's raw reports; `None` when it reports nothing to show.
pub fn options_of(snapshot: &NativeUiSnapshot) -> Option<NativeUiOptions> {
    let options = NativeUiOptions {
        model: snapshot
            .model
            .as_deref()
            .filter(|model| !model.is_empty())
            .map(model_label),
        effort: snapshot
            .effort
            .as_deref()
            .filter(|effort| !effort.is_empty())
            .map(effort_label),
        permission_mode: snapshot
            .permission_mode
            .as_deref()
            .and_then(permission_mode_label)
            .map(str::to_string),
    };
    (options.model.is_some() || options.effort.is_some() || options.permission_mode.is_some())
        .then_some(options)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn model_ids_dot_the_version_an_id_spells_with_dashes_never_a_date() {
        for (id, label) in [
            ("claude-opus-5-5", "Claude Opus 5.5"),
            ("claude-opus-5-5[1m]", "Claude Opus 5.5 (1M context)"),
            ("claude-3-5-sonnet-20241022", "Claude 3.5 Sonnet 20241022"),
            ("xai/grok-4-1-fast", "Xai Grok 4.1 Fast"),
            ("gpt-4o-2024-08-06", "GPT 4O 2024 08 06"),
            (
                "gemini-2.5-flash-preview-05-20",
                "Gemini 2.5 Flash Preview 05 20",
            ),
            (
                "gemini-2.5-flash-preview-10-20",
                "Gemini 2.5 Flash Preview 10 20",
            ),
            ("llama-3-8b", "Llama 3 8B"),
        ] {
            assert_eq!(model_id_label(id), label, "{id}");
        }
    }

    // Orca's pattern relies on a lookahead, so two versions in one id exercise the manual one.
    #[test]
    fn two_dashed_versions_in_one_id_are_both_dotted() {
        assert_eq!(
            model_id_label("claude-opus-5-5-sonnet-4-1"),
            "Claude Opus 5.5 Sonnet 4.1"
        );
    }

    #[test]
    fn the_toolbar_names_the_model_without_its_vendor_prefix() {
        assert_eq!(model_label("claude-haiku-4-5"), "Haiku 4.5");
        assert_eq!(model_label("claude-opus-4-8"), "Opus 4.8");
        assert_eq!(model_label("gpt-5.6-luna"), "GPT 5.6 Luna");
    }

    #[test]
    fn effort_levels_use_orcas_words_and_unknown_ones_stay_as_reported() {
        assert_eq!(effort_label("xhigh"), "Extra high");
        assert_eq!(effort_label("medium"), "Medium");
        assert_eq!(effort_label("turbo"), "turbo");
    }

    #[test]
    fn claude_reports_its_mode_in_its_own_words() {
        for (reported, mode) in [
            ("default", Some("ask")),
            ("acceptEdits", Some("accept-edits")),
            ("auto", Some("auto")),
            ("plan", Some("plan")),
            ("bypassPermissions", Some("full-access")),
            ("dontAsk", None),
        ] {
            assert_eq!(claude_permission_mode(reported), mode, "{reported}");
        }
    }

    #[test]
    fn codex_modes_are_the_three_policies_and_nothing_else() {
        let mode = |policy: &str, sandbox: &str, reviewer: &str| {
            codex_permission_mode(
                &json!(policy),
                &json!({ "type": sandbox }),
                &json!(reviewer),
            )
        };
        assert_eq!(
            mode("never", "dangerFullAccess", "user"),
            Some("full-access")
        );
        assert_eq!(mode("on-request", "readOnly", "user"), Some("ask"));
        assert_eq!(mode("untrusted", "readOnly", "user"), Some("ask"));
        assert_eq!(
            mode("on-request", "workspaceWrite", "auto_review"),
            Some("auto")
        );
        // A hand-made workspace sandbox that asks the user is not one of the three.
        assert_eq!(mode("on-request", "workspaceWrite", "user"), None);
        assert_eq!(mode("never", "readOnly", "user"), None);
        assert_eq!(
            codex_permission_mode(&Value::Null, &Value::Null, &Value::Null),
            None
        );
    }

    #[test]
    fn a_snapshot_with_nothing_reported_has_no_options() {
        let mut snapshot = NativeUiSnapshot::default();
        assert_eq!(options_of(&snapshot), None);
        snapshot.model = Some("claude-haiku-4-5".into());
        snapshot.permission_mode = Some("accept-edits".into());
        snapshot.effort = Some("high".into());
        assert_eq!(
            options_of(&snapshot),
            Some(NativeUiOptions {
                model: Some("Haiku 4.5".into()),
                effort: Some("High".into()),
                permission_mode: Some("Accept edits".into()),
            })
        );
        // A mode this module does not know is not shown.
        snapshot.permission_mode = Some("dontAsk".into());
        assert_eq!(options_of(&snapshot).unwrap().permission_mode, None);
    }
}
