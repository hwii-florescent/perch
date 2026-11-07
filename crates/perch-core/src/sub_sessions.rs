//! Sub-sessions: the rules a lead session's children follow (`perch spawn`, `list`, `stop`).
//! Pure: no database, no process. The store is `db/sub_sessions.rs`; the routes are
//! `server/sub_sessions.rs`.
//!
//! Ported from Orca (MIT, `stablyai/orca` at `308b5000`), translated to Rust:
//! - `src/main/runtime/orchestration/types.ts` and `db/schema/create-core-tables-sql.ts`
//!   (`worker_dispatches`): the worker states, including `start_unknown` and `stop_unknown`,
//!   and which of them still count as live;
//! - `db/worker-dispatch/worker-dispatch-stop.ts`: a stop begins only from a running (or start
//!   unknown) worker, an unconfirmed stop stays `stop_unknown`, and only a confirmed process
//!   exit settles it as `stopped`;
//! - `src/shared/nested-worker-depth.ts` and its test: the depth fence and its refusal text,
//!   which tells the refused worker to do the work itself. Perch fixes the limit at 1.
//!
//! Not ported: tasks, gates, the coordinator loop and the settlement of a dispatch by a
//! report. In Perch a report is the child's claim and settles nothing.
//!
//! The limits, the turn rule and the report labels are Perch's own (ROADMAP, "Perch's version
//! of Claude Projects and sub-sessions"). Unknown is never read as exited: a child whose start
//! or stop was not confirmed keeps counting against the limits.

/// Children of one lead that may be live at once.
pub const MAX_CONCURRENT: usize = 4;
/// Children one lead may ever have started, stopped ones included.
pub const MAX_DESCENDANTS: usize = 8;
/// Root sessions are depth 0; a child is depth 1 and may not spawn.
pub const MAX_DEPTH: usize = 1;
/// The longest task `perch spawn` accepts, in characters. The task and Perch's note to the
/// child travel as one argument of the agent's command line, which Perch bounds at 4 KiB.
pub const TASK_MAX_CHARS: usize = 3_000;
/// A fallback report is the first this many characters of the child's last message.
pub const FALLBACK_REPORT_CHARS: usize = 400;

/// Where a child is, as Perch knows it. `Running` is Orca's `ready`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubState {
    /// The record exists and the launch is in flight.
    Starting,
    Running,
    /// The launch was not confirmed either way.
    StartUnknown,
    /// Perch confirmed no process was started.
    Failed,
    /// A stop was requested and its result is not known yet.
    Stopping,
    /// The stop was not confirmed.
    StopUnknown,
    /// A stop was requested and the process is confirmed gone.
    Stopped,
    /// The process is confirmed gone and nobody asked for a stop.
    Exited,
}

impl SubState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Starting => "starting",
            Self::Running => "running",
            Self::StartUnknown => "start_unknown",
            Self::Failed => "failed",
            Self::Stopping => "stopping",
            Self::StopUnknown => "stop_unknown",
            Self::Stopped => "stopped",
            Self::Exited => "exited",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        Some(match text {
            "starting" => Self::Starting,
            "running" => Self::Running,
            "start_unknown" => Self::StartUnknown,
            "failed" => Self::Failed,
            "stopping" => Self::Stopping,
            "stop_unknown" => Self::StopUnknown,
            "stopped" => Self::Stopped,
            "exited" => Self::Exited,
            _ => return None,
        })
    }

    /// Orca's active index: a child that may still be running counts against the limits.
    pub fn is_live(self) -> bool {
        matches!(
            self,
            Self::Starting
                | Self::Running
                | Self::StartUnknown
                | Self::Stopping
                | Self::StopUnknown
        )
    }

    /// The live states in `as_str` form, for a database filter.
    pub const LIVE: [&'static str; 5] = [
        "starting",
        "running",
        "start_unknown",
        "stopping",
        "stop_unknown",
    ];

    /// May a stop begin? Orca allows it from `ready` and `start_unknown`, and lets a later
    /// attempt retry a stop that was left `stopping` or `stop_unknown`.
    pub fn can_begin_stop(self) -> bool {
        matches!(
            self,
            Self::Running | Self::StartUnknown | Self::Stopping | Self::StopUnknown
        )
    }
}

/// Why a spawn was refused. The text is what the agent reads.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Refusal {
    /// The caller is itself a child.
    Depth,
    /// No turn opened by a person is running in the caller.
    NotPersonTurn,
    Concurrent,
    Descendants,
}

impl Refusal {
    pub fn message(&self) -> String {
        match self {
            // Orca's wording: the refused worker must not loop on an unavailable dispatch.
            Self::Depth => format!(
                "Sub-session start is not permitted at depth {} (max {MAX_DEPTH}). \
                 Complete this task yourself.",
                MAX_DEPTH + 1
            ),
            Self::NotPersonTurn => "Sub-sessions can be started only during a turn a person \
                 opened in this session. This turn was not, or Perch cannot tell. Do the work \
                 yourself, or say what you would have delegated and let the person decide."
                .into(),
            Self::Concurrent => format!(
                "You already have {MAX_CONCURRENT} sub-sessions running. Wait for one to finish, \
                 or stop one you no longer need with `perch stop <session>`."
            ),
            Self::Descendants => format!(
                "This run has already started {MAX_DESCENDANTS} sub-sessions, the most it may. \
                 Continue with the ones you have or do the rest yourself."
            ),
        }
    }
}

/// Who opened the turn a session is in.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TurnOrigin {
    /// A person typed it, in the terminal or in the chat, or sent it by an explicit action.
    Person,
    /// Perch delivered it for an agent: a sub-session's first message or a message between
    /// sessions.
    Agent,
}

/// What the core knows about the caller and its children when a spawn arrives.
pub struct SpawnContext {
    pub caller_is_child: bool,
    /// The caller's current turn, if Perch saw it open. `None` is "cannot tell".
    pub turn: Option<TurnOrigin>,
    pub live_children: usize,
    pub all_children: usize,
}

/// The one admission rule, applied before anything is dispatched. Depth first, so a child gets
/// the "do it yourself" text whatever else is true.
pub fn admit(context: &SpawnContext) -> Result<(), Refusal> {
    if context.caller_is_child {
        return Err(Refusal::Depth);
    }
    if context.turn != Some(TurnOrigin::Person) {
        return Err(Refusal::NotPersonTurn);
    }
    if context.live_children >= MAX_CONCURRENT {
        return Err(Refusal::Concurrent);
    }
    if context.all_children >= MAX_DESCENDANTS {
        return Err(Refusal::Descendants);
    }
    Ok(())
}

/// A task is plain text of a bounded size.
pub fn check_task(task: &str) -> Result<&str, String> {
    let task = task.trim();
    if task.is_empty() {
        return Err("a sub-session needs a task: perch spawn --agent <agent> --task <text>".into());
    }
    if task.chars().count() > TASK_MAX_CHARS {
        return Err(format!(
            "a task is limited to {TASK_MAX_CHARS} characters; put the detail in a file and \
             give its path in the task"
        ));
    }
    if task.contains('\0') {
        return Err("a task cannot contain a NUL character".into());
    }
    Ok(task)
}

/// A model is whatever the agent's own `--model` takes: a name or id, never an option.
pub fn check_model(model: &str) -> Result<&str, String> {
    let valid = !model.is_empty()
        && model.len() <= 100
        && !model.starts_with('-')
        && model.chars().all(|c| {
            c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | ':' | '/' | '-' | '[' | ']')
        });
    if valid {
        Ok(model)
    } else {
        Err("that is not a model name the agent can take".into())
    }
}

/// An idempotency key names one spawn request so a retry cannot start a second child.
pub fn check_key(key: &str) -> Result<&str, String> {
    let valid = !key.is_empty()
        && key.len() <= 64
        && key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_'));
    if valid {
        Ok(key)
    } else {
        Err("a spawn key is 1 to 64 letters, digits, - or _".into())
    }
}

/// The first message of a child: Perch's note, then the task. Plain text, never starting with
/// a dash or a slash, so the agent's command line cannot read it as an option or a command.
pub fn first_message(parent_session: &str, task: &str) -> String {
    format!(
        "Perch started you as a sub-session of session {parent_session}. This message is your \
         task. When you finish, or if you are blocked, run `perch report <summary>`; the report \
         goes to the session that started you. Then stop and wait. Run `perch guide` for how \
         Perch works.\n\nTask: {task}"
    )
}

/// Where a report came from. Both are claims.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportSource {
    /// The child's own `perch report`.
    Reported,
    /// The child's last message, kept because it reported nothing. A fallback, not a report.
    LastMessage,
}

impl ReportSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Reported => "report",
            Self::LastMessage => "last-message",
        }
    }
}

/// The first 400 characters of the child's last message, marked when cut.
pub fn fallback_report(last_message: &str) -> Option<String> {
    let text = last_message.trim();
    if text.is_empty() {
        return None;
    }
    let mut chars = text.chars();
    let head: String = chars.by_ref().take(FALLBACK_REPORT_CHARS).collect();
    Some(if chars.next().is_some() {
        format!("{head}…")
    } else {
        head
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn context() -> SpawnContext {
        SpawnContext {
            caller_is_child: false,
            turn: Some(TurnOrigin::Person),
            live_children: 0,
            all_children: 0,
        }
    }

    #[test]
    fn a_person_turn_with_room_is_admitted() {
        assert_eq!(admit(&context()), Ok(()));
    }

    // Orca's test: the message names both depths and tells the worker to finish the task.
    #[test]
    fn the_depth_refusal_names_both_depths_and_tells_the_child_to_do_the_work() {
        let message = admit(&SpawnContext {
            caller_is_child: true,
            ..context()
        })
        .unwrap_err()
        .message();
        assert!(message.contains("depth 2 (max 1)"), "{message}");
        assert!(message.contains("Complete this task yourself"));
    }

    #[test]
    fn a_child_is_refused_for_depth_before_anything_else() {
        let refusal = admit(&SpawnContext {
            caller_is_child: true,
            turn: None,
            live_children: 9,
            all_children: 9,
        });
        assert_eq!(refusal, Err(Refusal::Depth));
    }

    #[test]
    fn only_a_turn_a_person_opened_may_spawn() {
        for turn in [Some(TurnOrigin::Agent), None] {
            assert_eq!(
                admit(&SpawnContext { turn, ..context() }),
                Err(Refusal::NotPersonTurn)
            );
        }
    }

    #[test]
    fn the_concurrent_and_total_limits_are_exact() {
        let at = |live, all| {
            admit(&SpawnContext {
                live_children: live,
                all_children: all,
                ..context()
            })
        };
        assert_eq!(at(3, 3), Ok(()));
        assert_eq!(at(4, 4), Err(Refusal::Concurrent));
        assert_eq!(at(0, 7), Ok(()));
        assert_eq!(at(0, 8), Err(Refusal::Descendants));
        // Four live children are refused as concurrent even when the total is over too.
        assert_eq!(at(4, 8), Err(Refusal::Concurrent));
    }

    #[test]
    fn every_refusal_tells_the_agent_what_to_do_next() {
        for refusal in [
            Refusal::Depth,
            Refusal::NotPersonTurn,
            Refusal::Concurrent,
            Refusal::Descendants,
        ] {
            let message = refusal.message();
            assert!(
                message.contains("yourself")
                    || message.contains("perch stop")
                    || message.contains("Continue"),
                "{message}"
            );
        }
    }

    #[test]
    fn unproven_states_still_count_as_live() {
        for state in [
            SubState::Starting,
            SubState::Running,
            SubState::StartUnknown,
            SubState::Stopping,
            SubState::StopUnknown,
        ] {
            assert!(state.is_live(), "{state:?}");
            assert!(SubState::LIVE.contains(&state.as_str()));
        }
        for state in [SubState::Failed, SubState::Stopped, SubState::Exited] {
            assert!(!state.is_live(), "{state:?}");
            assert!(!SubState::LIVE.contains(&state.as_str()));
        }
    }

    #[test]
    fn states_round_trip_through_their_names() {
        for state in [
            SubState::Starting,
            SubState::Running,
            SubState::StartUnknown,
            SubState::Failed,
            SubState::Stopping,
            SubState::StopUnknown,
            SubState::Stopped,
            SubState::Exited,
        ] {
            assert_eq!(SubState::parse(state.as_str()), Some(state));
        }
        assert_eq!(SubState::parse("succeeded"), None);
    }

    #[test]
    fn a_stop_begins_only_from_a_state_that_may_still_run() {
        assert!(SubState::Running.can_begin_stop());
        assert!(SubState::StartUnknown.can_begin_stop());
        assert!(SubState::StopUnknown.can_begin_stop(), "a retry");
        assert!(!SubState::Starting.can_begin_stop());
        for settled in [SubState::Failed, SubState::Stopped, SubState::Exited] {
            assert!(!settled.can_begin_stop());
        }
    }

    #[test]
    fn a_task_is_bounded_plain_text() {
        assert_eq!(check_task("  fix the parser \n"), Ok("fix the parser"));
        assert!(check_task("   ").is_err());
        assert!(check_task(&"x".repeat(TASK_MAX_CHARS)).is_ok());
        assert!(check_task(&"x".repeat(TASK_MAX_CHARS + 1)).is_err());
        // Characters, not bytes: a long task in a wide script is judged by what it shows.
        assert!(check_task(&"é".repeat(TASK_MAX_CHARS)).is_ok());
        assert!(check_task("a\0b").is_err());
    }

    #[test]
    fn a_model_cannot_be_read_as_an_option() {
        for good in [
            "claude-haiku-4-5",
            "gpt-5.6-luna",
            "openai/gpt-5.2",
            "sonnet",
            "opus[1m]",
        ] {
            assert!(check_model(good).is_ok(), "{good}");
        }
        for bad in [
            "",
            "--help",
            "-m",
            "a b",
            "a;b",
            "a\nb",
            "$(x)",
            &"m".repeat(101),
        ] {
            assert!(check_model(bad).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn a_key_is_short_and_safe() {
        assert!(check_key("spawn-1_a").is_ok());
        for bad in ["", "a b", "a/b", &"k".repeat(65)] {
            assert!(check_key(bad).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn the_first_message_names_the_parent_and_the_task_and_is_not_an_option_or_command() {
        let message = first_message("lead-1", "fix it");
        assert!(message.contains("session lead-1"));
        assert!(message.contains("perch report"));
        assert!(message.ends_with("Task: fix it"));
        assert!(!message.starts_with(['-', '/']));
    }

    #[test]
    fn a_fallback_report_keeps_the_first_400_characters_and_says_when_it_cut() {
        assert_eq!(fallback_report("  \n "), None);
        assert_eq!(fallback_report("done"), Some("done".into()));
        let exact = "a".repeat(FALLBACK_REPORT_CHARS);
        assert_eq!(fallback_report(&exact), Some(exact));
        let long = "b".repeat(FALLBACK_REPORT_CHARS + 1);
        let cut = fallback_report(&long).unwrap();
        assert_eq!(cut.chars().count(), FALLBACK_REPORT_CHARS + 1);
        assert!(cut.ends_with('…'));
        // Cutting counts characters, so a multibyte message is never split inside one.
        assert!(fallback_report(&"é".repeat(500)).unwrap().starts_with("éé"));
    }

    #[test]
    fn report_sources_are_labelled() {
        assert_eq!(ReportSource::Reported.as_str(), "report");
        assert_eq!(ReportSource::LastMessage.as_str(), "last-message");
    }
}
