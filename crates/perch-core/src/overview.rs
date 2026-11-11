//! The Project overview's grouping: which state-group a thread (a sub-session) sits in. Pure: no
//! database, no process. The facts are gathered by `server/overview.rs`.
//!
//! Claude Code Projects groups threads as Ready for review, Waiting on you, Working, Landing, Idle
//! and Resolved. Perch uses the same words where its own records can back them, and adds one Claude
//! lacks: `unknown`, because a thread whose state Perch could not read is not idle and not done.
//! Own design, not ported.
//!
//! Every group is derived from Perch's records, never from an agent's claim: a report only
//! *suggests* review (it is the agent's word, labelled so in the UI), and a pull request is what
//! the person's `gh` login says. Landing and Resolved read the PR state; without a PR they are
//! never reached, except that a confirmed-gone thread with no PR is Resolved.

/// The facts one thread is grouped by.
#[derive(Debug, Clone, Copy, Default)]
pub struct Facts<'a> {
    /// Perch's lifecycle word: `working`, `idle`, `done`, `blocked`, `exited`, … or `unknown`.
    pub lifecycle: &'a str,
    /// The dispatch record: `running`, `stopped`, `exited`, `start_unknown`, `stop_unknown`, …
    pub dispatch: Option<&'a str>,
    /// A pending approval or question, from Perch's own blocked state.
    pub needs_you: bool,
    /// The thread has an agent report (its own or a summary).
    pub has_report: bool,
    /// `open`, `draft`, `merged` or `closed`, when `gh` reported one.
    pub pr: Option<&'a str>,
}

/// The groups in display order, with their labels.
pub const GROUPS: [(&str, &str); 7] = [
    ("needs_you", "Needs you"),
    ("working", "Working"),
    ("ready_for_review", "Ready for review"),
    ("landing", "Landing"),
    ("idle", "Idle"),
    ("unknown", "State unknown"),
    ("resolved", "Resolved"),
];

/// The group key of a thread. First rule that holds wins.
pub fn group_of(facts: &Facts) -> &'static str {
    // Its pull request is settled: nothing left to do here.
    if matches!(facts.pr, Some("merged" | "closed")) {
        return "resolved";
    }
    // Confirmed gone. A thread that opened a pull request and then exited is the usual one waiting to
    // land, so an open or draft PR keeps it in view; with none, nothing is left to do.
    if matches!(facts.dispatch, Some("stopped" | "exited" | "failed")) {
        return match facts.pr {
            Some("open") => "landing",
            Some("draft") => "ready_for_review",
            _ => "resolved",
        };
    }
    if facts.needs_you {
        return "needs_you";
    }
    // An unconfirmed start or stop, or an unreadable lifecycle, is never shown as idle.
    if matches!(
        facts.dispatch,
        Some("start_unknown" | "stop_unknown" | "starting" | "stopping")
    ) || facts.lifecycle == "unknown"
    {
        return "unknown";
    }
    if facts.lifecycle == "working" {
        return "working";
    }
    if facts.pr == Some("open") {
        return "landing";
    }
    if facts.has_report || facts.pr == Some("draft") {
        return "ready_for_review";
    }
    "idle"
}

#[cfg(test)]
mod tests {
    use super::*;

    fn of(
        lifecycle: &str,
        dispatch: Option<&str>,
        needs_you: bool,
        has_report: bool,
        pr: Option<&str>,
    ) -> &'static str {
        group_of(&Facts {
            lifecycle,
            dispatch,
            needs_you,
            has_report,
            pr,
        })
    }

    #[test]
    fn each_group_is_reached_from_perchs_own_records() {
        assert_eq!(
            of("blocked", Some("running"), true, false, None),
            "needs_you"
        );
        assert_eq!(
            of("working", Some("running"), false, false, None),
            "working"
        );
        assert_eq!(
            of("idle", Some("running"), false, true, None),
            "ready_for_review"
        );
        assert_eq!(
            of("idle", Some("running"), false, false, Some("draft")),
            "ready_for_review"
        );
        assert_eq!(
            of("idle", Some("running"), false, true, Some("open")),
            "landing"
        );
        assert_eq!(of("idle", Some("running"), false, false, None), "idle");
        assert_eq!(of("done", Some("exited"), false, true, None), "resolved");
        // It opened a pull request and exited: still waiting to land (or to be reviewed as a draft).
        assert_eq!(
            of("done", Some("exited"), false, true, Some("open")),
            "landing"
        );
        assert_eq!(
            of("done", Some("exited"), false, true, Some("draft")),
            "ready_for_review"
        );
        assert_eq!(
            of("done", Some("stopped"), false, true, Some("merged")),
            "resolved"
        );
        assert_eq!(
            of("idle", Some("running"), false, true, Some("merged")),
            "resolved"
        );
    }

    #[test]
    fn unknown_is_never_idle_or_resolved_and_a_question_outranks_working() {
        assert_eq!(
            of("unknown", Some("running"), false, false, None),
            "unknown"
        );
        assert_eq!(
            of("idle", Some("start_unknown"), false, false, None),
            "unknown"
        );
        assert_eq!(
            of("idle", Some("stop_unknown"), false, true, None),
            "unknown"
        );
        assert_eq!(
            of("working", Some("running"), true, false, None),
            "needs_you"
        );
        // A question on a thread already confirmed gone is not a live ask.
        assert_eq!(
            of("blocked", Some("stopped"), true, false, None),
            "resolved"
        );
    }

    #[test]
    fn every_group_key_has_a_label_in_display_order() {
        for key in [
            "needs_you",
            "working",
            "ready_for_review",
            "landing",
            "idle",
            "unknown",
            "resolved",
        ] {
            assert!(GROUPS.iter().any(|(k, _)| *k == key), "{key}");
        }
        assert_eq!(GROUPS[0].0, "needs_you");
    }
}
