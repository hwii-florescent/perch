//! Suggested tasks: what a lead may put in front of a person instead of starting a sub-session
//! itself (`perch suggest`, and `perch spawn` while the person has not allowed leads to start
//! sub-sessions without asking). Pure: no database, no process. The store is
//! `db/suggestions.rs`; the routes and the person's actions are `server/suggestions.rs`.
//!
//! Own design, after the behaviour Claude desktop documents for a suggested task (a card with
//! Start, Do it here, Options and Start all); nothing is copied. A suggestion starts nothing. It
//! is a task, an agent and options written down for a person to accept; accepting it is the
//! person's own action, and it goes through the same limits as
//! `perch spawn`. Nothing here ever starts, retries or plans work.

/// Tasks one `perch suggest` may carry: one card.
pub const MAX_PER_CARD: usize = 5;
/// Default: suggestions a lead may have waiting for a person at once. A setting. A lead that fills
/// this has to wait for the person; it cannot bury them in cards.
pub const MAX_PENDING: usize = 10;

/// Where one suggestion stands.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SuggestionState {
    /// Waiting for the person.
    Pending,
    /// The person chose Start and the sub-session is being recorded and launched.
    Starting,
    /// The person started it: `child_session_id` names the sub-session.
    Started,
    /// The person chose Do it here: the task was sent to the lead as the person's message.
    Handed,
    /// The person dismissed it.
    Dismissed,
}

impl SuggestionState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Starting => "starting",
            Self::Started => "started",
            Self::Handed => "handed",
            Self::Dismissed => "dismissed",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        Some(match text {
            "pending" => Self::Pending,
            "starting" => Self::Starting,
            "started" => Self::Started,
            "handed" => Self::Handed,
            "dismissed" => Self::Dismissed,
            _ => return None,
        })
    }
}

/// One suggestion as the lead wrote it, checked.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Suggested {
    pub task: String,
    pub agent: String,
    pub model: Option<String>,
    pub worktree: bool,
}

/// A suggested task is a spawn task that cannot be read as a command when the person sends it to
/// the lead: it may not begin with `/`, `!` or `#`, which an agent's prompt would act on.
pub fn check_task(task: &str) -> Result<&str, String> {
    let task = crate::sub_sessions::check_task(task).map_err(|_| {
        "a suggested task is plain text of 1 to 3000 characters: perch suggest --task <text>"
            .to_string()
    })?;
    if task.starts_with(['/', '!', '#']) {
        return Err(
            "start a suggested task with a word, not / ! or #: the person may send it to you as a \
             message"
                .into(),
        );
    }
    Ok(task)
}

/// Refuse a card of more tasks than it may hold, or one that would put more waiting suggestions in
/// front of the person than a lead may have.
pub fn check_batch(count: usize, pending: usize, max_pending: usize) -> Result<(), String> {
    if count == 0 {
        return Err("suggest at least one task: perch suggest --task <text>".into());
    }
    if count > MAX_PER_CARD {
        return Err(format!(
            "one card holds at most {MAX_PER_CARD} tasks; suggest the most useful ones"
        ));
    }
    if pending + count > max_pending {
        return Err(format!(
            "{pending} of your suggestions are still waiting for the person (at most {max_pending} \
             at once, a setting in Settings > Sub-sessions). Wait for them to answer before \
             suggesting more."
        ));
    }
    Ok(())
}

/// The key of the sub-session a suggestion starts: stable, so clicking Start twice starts one.
pub fn spawn_key(suggestion_id: &str) -> String {
    format!("suggestion-{suggestion_id}")
}

/// What a card shows of a suggestion that was started: the sub-session's dispatch word, or why it
/// is not running. A started suggestion whose child is still live keeps its card in view.
pub fn card_visible(items: &[(SuggestionState, bool)]) -> bool {
    items.iter().any(|(state, child_live)| match state {
        SuggestionState::Pending | SuggestionState::Starting => true,
        SuggestionState::Started => *child_live,
        SuggestionState::Handed | SuggestionState::Dismissed => false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_task_is_plain_text_that_cannot_be_read_as_a_command() {
        assert_eq!(check_task("  fix the parser ").unwrap(), "fix the parser");
        for bad in [
            "",
            "   ",
            "/clear",
            "!rm -rf x",
            "# heading",
            &"x".repeat(3001),
        ] {
            assert!(check_task(bad).is_err(), "{bad:?}");
        }
        assert!(check_task("fix /clear in the docs").is_ok());
    }

    #[test]
    fn a_card_is_limited_and_a_lead_cannot_bury_the_person() {
        let check = |count, pending| check_batch(count, pending, MAX_PENDING);
        assert!(check(0, 0).is_err());
        assert!(check(1, 0).is_ok());
        assert!(check(MAX_PER_CARD, 0).is_ok());
        assert!(check(MAX_PER_CARD + 1, 0).is_err());
        assert!(check(1, MAX_PENDING - 1).is_ok());
        let refused = check(2, MAX_PENDING - 1).unwrap_err();
        assert!(refused.contains("still waiting"), "{refused}");
        // The waiting limit is the setting.
        assert!(check_batch(1, 2, 3).is_ok());
        let refused = check_batch(2, 2, 3).unwrap_err();
        assert!(refused.contains("at most 3 at once"), "{refused}");
    }

    #[test]
    fn states_round_trip_and_an_unknown_word_is_not_one() {
        for state in [
            SuggestionState::Pending,
            SuggestionState::Starting,
            SuggestionState::Started,
            SuggestionState::Handed,
            SuggestionState::Dismissed,
        ] {
            assert_eq!(SuggestionState::parse(state.as_str()), Some(state));
        }
        assert_eq!(SuggestionState::parse("done"), None);
    }

    #[test]
    fn a_card_stays_while_something_waits_or_a_started_child_still_runs() {
        use SuggestionState::*;
        assert!(card_visible(&[(Pending, false)]));
        assert!(card_visible(&[(Dismissed, false), (Starting, false)]));
        assert!(card_visible(&[(Started, true), (Handed, false)]));
        assert!(!card_visible(&[(Started, false), (Dismissed, false)]));
        assert!(!card_visible(&[(Handed, false)]));
        assert!(!card_visible(&[]));
    }

    #[test]
    fn a_suggestion_names_one_spawn_key() {
        assert_eq!(spawn_key("abc"), "suggestion-abc");
        assert!(
            crate::sub_sessions::check_key(&spawn_key(&uuid::Uuid::new_v4().to_string())).is_ok()
        );
    }
}
