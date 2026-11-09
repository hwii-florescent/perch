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

/// Default: children of one lead that may be live at once.
pub const MAX_CONCURRENT: usize = 4;
/// Default: children one lead may ever have started, stopped ones included.
pub const MAX_DESCENDANTS: usize = 8;

/// The per-run limits a person sets (Settings > Sub-sessions; owner decision 2026-11-08: runs go on
/// without a person's prompt, so these are what bound them). Every counter is per run, never reset by
/// a person's message. The defaults are today's constants.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct RunLimits {
    /// Live sub-sessions per run.
    pub live: u32,
    /// Sub-sessions a run may ever start.
    pub total: u32,
    /// Messages the run's agents may send (notes do not count).
    pub messages: u32,
    /// Automatic deliveries to the lead.
    pub wakes: u32,
    /// Interrupts the lead may send each sub-session.
    pub interrupts: u32,
    /// Suggested-task cards waiting for the person.
    pub waiting_cards: u32,
}

impl Default for RunLimits {
    fn default() -> Self {
        Self {
            live: MAX_CONCURRENT as u32,
            total: MAX_DESCENDANTS as u32,
            messages: crate::agent_mail::MAX_MESSAGES_PER_RUN as u32,
            wakes: crate::agent_mail::DEFAULT_WAKES_PER_RUN,
            interrupts: crate::crew_actions::MAX_LEAD_INTERRUPTS_PER_CHILD,
            waiting_cards: crate::suggestions::MAX_PENDING as u32,
        }
    }
}

impl RunLimits {
    /// Each limit's allowed range (name, value, lowest, highest).
    fn ranges(&self) -> [(&'static str, u32, u32, u32); 6] {
        [
            ("live sub-sessions per run", self.live, 1, 16),
            ("sub-sessions per run", self.total, 1, 64),
            ("messages per run", self.messages, 1, 1_000),
            ("automatic lead wakes per run", self.wakes, 1, 100),
            ("interrupts per sub-session", self.interrupts, 1, 20),
            ("waiting suggested tasks", self.waiting_cards, 1, 50),
        ]
    }

    /// Reject a value outside its range, or a total below the live limit, with the reason a person reads.
    pub fn validate(&self) -> Result<(), String> {
        for (name, value, low, high) in self.ranges() {
            if !(low..=high).contains(&value) {
                return Err(format!("{name} must be {low} to {high}, not {value}"));
            }
        }
        if self.total < self.live {
            return Err(format!(
                "sub-sessions per run ({}) cannot be fewer than live sub-sessions per run ({})",
                self.total, self.live
            ));
        }
        Ok(())
    }
}
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
    /// The run's live limit (the number is the setting at the time).
    Concurrent(u32),
    /// The run's total limit.
    Descendants(u32),
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
            Self::Concurrent(limit) => format!(
                "You already have {limit} sub-sessions running, the most the person allows \
                 (Settings > Sub-sessions). Wait for one to finish, or stop one you no longer \
                 need with `perch stop <session>`."
            ),
            Self::Descendants(limit) => format!(
                "This run has already started {limit} sub-sessions, the most the person allows \
                 (Settings > Sub-sessions). Continue with the ones you have or do the rest yourself."
            ),
        }
    }
}

/// What the core knows about the caller and its children when a spawn arrives.
pub struct SpawnContext {
    pub caller_is_child: bool,
    pub live_children: usize,
    pub all_children: usize,
    pub limits: RunLimits,
}

/// The one admission rule, applied before anything is dispatched. Depth first, so a child gets
/// the "do it yourself" text whatever else is true. Any turn may spawn (owner decision 2026-11-08):
/// the run's limits are what bound it.
pub fn admit(context: &SpawnContext) -> Result<(), Refusal> {
    if context.caller_is_child {
        return Err(Refusal::Depth);
    }
    if context.live_children >= context.limits.live as usize {
        return Err(Refusal::Concurrent(context.limits.live));
    }
    if context.all_children >= context.limits.total as usize {
        return Err(Refusal::Descendants(context.limits.total));
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

/// A working child with no output and no state change for this long is shown as quiet in
/// `perch list`. ponytail: one fixed threshold for every child; a setting is the upgrade path.
pub const QUIET_AFTER_MS: u64 = 10 * 60 * 1000;

/// Whole minutes a working child has been silent, once that reaches [`QUIET_AFTER_MS`]. A child
/// that is blocked on a person is flagged as that instead, and an idle or finished one is not
/// quiet, it is done.
pub fn quiet_minutes(working: bool, last_evidence_ms: u64, now_ms: u64) -> Option<u64> {
    let silent = now_ms.saturating_sub(last_evidence_ms);
    (working && silent >= QUIET_AFTER_MS).then_some(silent / 60_000)
}

/// The first message of a child: Perch's note, then the task. Plain text, never starting with
/// a dash or a slash, so the agent's command line cannot read it as an option or a command.
pub fn first_message(parent_session: &str, task: &str) -> String {
    format!(
        "Perch started you as a sub-session of session {parent_session}. This message is your \
         task. When you finish, or if you are blocked, run `perch report <text>` with the result or \
         what blocks you, then stop and wait: the session that started you hears only what you \
         report. Run `perch guide` for how Perch works.\n\nTask: {task}"
    )
}

/// Where a report came from. Both are claims.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportSource {
    /// The child's own `perch report`.
    Reported,
    /// What a cheap model wrote about the child's turn (`reporter.rs`), because it reported
    /// nothing. Perch's wording of the child's work, still unverified.
    Summary,
    /// The child's last message, kept because it reported nothing. A fallback, not a report.
    LastMessage,
}

impl ReportSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Reported => "report",
            Self::Summary => "summary",
            Self::LastMessage => "last-message",
        }
    }
}

/// What a member's report is, after choosing between the claims below.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Report {
    pub text: String,
    pub source: ReportSource,
    /// When it was written, in milliseconds.
    pub at: i64,
    /// The model that wrote a `Summary`.
    pub model: Option<String>,
}

/// The child's own `perch report` of the turn that just ended, else the running summary, else
/// nothing: the child's last message is never shown in its place. A `perch report` is of the latest turn when it is newer than the
/// turn the stored notes cover; older, the notes already hold it. `use_summaries` is the
/// reporter's setting: off, the stored notes (a model's summaries and the fallbacks kept beside them)
/// are no longer shown.
pub fn choose_report(
    own: Option<(String, i64)>,
    stored: Option<crate::db::StoredSummary>,
    use_summaries: bool,
) -> Option<Report> {
    // Rows an earlier version stored from the last message are not shown.
    let stored = stored.filter(|row| use_summaries && row.source != "last-message");
    if let Some((text, at)) = own {
        if stored.as_ref().is_none_or(|row| at > row.as_of) {
            return Some(Report {
                text,
                source: ReportSource::Reported,
                at,
                model: None,
            });
        }
    }
    stored.map(|row| {
        let source = match row.source.as_str() {
            "summary" => ReportSource::Summary,
            _ => ReportSource::Reported,
        };
        Report {
            text: row.text,
            source,
            at: row.as_of,
            model: row.model.filter(|_| source == ReportSource::Summary),
        }
    })
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
            live_children: 0,
            all_children: 0,
            limits: RunLimits::default(),
        }
    }

    // Owner decision 2026-11-08: no turn origin is asked for; the limits are what bound a run.
    #[test]
    fn any_turn_with_room_is_admitted() {
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
            live_children: 9,
            all_children: 9,
            ..context()
        });
        assert_eq!(refusal, Err(Refusal::Depth));
    }

    #[test]
    fn the_limits_are_the_settings_not_fixed_numbers() {
        let limits = RunLimits {
            live: 2,
            total: 3,
            ..RunLimits::default()
        };
        let at = |live, all| {
            admit(&SpawnContext {
                live_children: live,
                all_children: all,
                limits,
                ..context()
            })
        };
        assert_eq!(at(1, 2), Ok(()));
        assert_eq!(at(2, 2), Err(Refusal::Concurrent(2)));
        assert_eq!(at(0, 3), Err(Refusal::Descendants(3)));
        assert!(Refusal::Concurrent(2)
            .message()
            .contains("You already have 2"));
        assert!(Refusal::Descendants(3)
            .message()
            .contains("started 3 sub-sessions"));
    }

    #[test]
    fn limits_are_validated_to_their_ranges_with_a_reason() {
        assert_eq!(RunLimits::default().validate(), Ok(()));
        for (limits, text) in [
            (
                RunLimits {
                    live: 0,
                    ..Default::default()
                },
                "live sub-sessions per run must be 1 to 16",
            ),
            (
                RunLimits {
                    live: 17,
                    total: 20,
                    ..Default::default()
                },
                "must be 1 to 16",
            ),
            (
                RunLimits {
                    total: 65,
                    ..Default::default()
                },
                "sub-sessions per run must be 1 to 64",
            ),
            (
                RunLimits {
                    messages: 1_001,
                    ..Default::default()
                },
                "messages per run must be 1 to 1000",
            ),
            (
                RunLimits {
                    wakes: 0,
                    ..Default::default()
                },
                "wakes per run must be 1 to 100",
            ),
            (
                RunLimits {
                    interrupts: 21,
                    ..Default::default()
                },
                "interrupts per sub-session must be 1 to 20",
            ),
            (
                RunLimits {
                    waiting_cards: 51,
                    ..Default::default()
                },
                "waiting suggested tasks must be 1 to 50",
            ),
            (
                RunLimits {
                    live: 8,
                    total: 4,
                    ..Default::default()
                },
                "cannot be fewer than live",
            ),
        ] {
            let error = limits.validate().unwrap_err();
            assert!(error.contains(text), "{error}");
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
        assert_eq!(at(4, 4), Err(Refusal::Concurrent(4)));
        assert_eq!(at(0, 7), Ok(()));
        assert_eq!(at(0, 8), Err(Refusal::Descendants(8)));
        // Four live children are refused as concurrent even when the total is over too.
        assert_eq!(at(4, 8), Err(Refusal::Concurrent(4)));
    }

    #[test]
    fn every_refusal_tells_the_agent_what_to_do_next() {
        for refusal in [
            Refusal::Depth,
            Refusal::Concurrent(4),
            Refusal::Descendants(8),
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
        // The lead hears only what the child reports.
        assert!(message.contains("run `perch report <text>`") && message.contains("hears only"));
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
        assert_eq!(ReportSource::Summary.as_str(), "summary");
    }

    fn stored(source: &str, as_of: i64) -> crate::db::StoredSummary {
        crate::db::StoredSummary {
            text: format!("notes {source}"),
            status: "done".into(),
            source: source.into(),
            model: (source == "summary").then(|| "claude-haiku-4-5".into()),
            as_of,
        }
    }

    #[test]
    fn the_childs_own_report_of_this_turn_beats_the_summary_and_nothing_stands_in_for_both() {
        let own = Some(("my report".to_string(), 200));
        let newer = choose_report(own.clone(), Some(stored("summary", 100)), true).unwrap();
        assert_eq!(
            (newer.text.as_str(), newer.source),
            ("my report", ReportSource::Reported)
        );
        // A report the notes already cover is of an earlier turn.
        let older = choose_report(own.clone(), Some(stored("summary", 300)), true).unwrap();
        assert_eq!(older.source, ReportSource::Summary);
        assert_eq!(older.model.as_deref(), Some("claude-haiku-4-5"));
        assert_eq!(older.at, 300);
        assert_eq!(choose_report(None, None, true), None);
        let alone = choose_report(own, None, true).unwrap();
        assert_eq!(alone.source, ReportSource::Reported);
    }

    #[test]
    fn notes_kept_from_a_report_keep_their_label_and_a_stored_last_message_is_not_shown() {
        let report = choose_report(None, Some(stored("report", 5)), true).unwrap();
        assert_eq!(
            (report.source, report.model),
            (ReportSource::Reported, None)
        );
        assert_eq!(
            choose_report(None, Some(stored("last-message", 5)), true),
            None
        );
    }

    #[test]
    fn only_a_working_child_silent_for_ten_minutes_is_quiet() {
        let now = 100 * 60_000;
        assert_eq!(quiet_minutes(true, now - 9 * 60_000, now), None);
        assert_eq!(quiet_minutes(true, now - 10 * 60_000, now), Some(10));
        assert_eq!(
            quiet_minutes(true, now - 25 * 60_000 - 5_000, now),
            Some(25)
        );
        assert_eq!(quiet_minutes(false, 0, now), None);
        assert_eq!(
            quiet_minutes(true, now + 5, now),
            None,
            "a clock step back is not quiet"
        );
    }

    #[test]
    fn with_the_reporter_off_an_old_model_summary_is_no_longer_shown() {
        assert_eq!(choose_report(None, Some(stored("summary", 5)), false), None);
    }
}
