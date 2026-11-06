//! The subagents a lead session started, drawn as one roster row per spawning turn: a headline
//! ("Kicked off 2 subagents"), a verdict ("1 working"), an adverse outcome that is not held back
//! by working siblings, and one line per child.
//!
//! Ported from Orca (commit 308b5000, MIT; see THIRD_PARTY_NOTICES.md):
//! `src/shared/native-chat/transcript/native-chat-subagent-{summary,group-header,items}.ts` (state
//! vocabulary and precedence, the headline and verdict words, the elapsed-clock anchor, and the
//! ordinals that tell same-named siblings apart) with the cases of their tests that do not depend
//! on Orca's journal rows, frozen fallback sentences or sections. Not ported: token totals (no
//! child usage is read), the per-child transcript sections, nested helpers (`parentId`).
//!
//! Where the children come from is the provider bridge's business (`claude.rs` reads Claude's own
//! per-subagent files); this module only groups and words them. An unreported or unknown state is
//! `unverifiable`, never `working`, so a row cannot spin forever on a state this build cannot read.
use crate::protocol::NativeUiSubagent;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum State {
    Working,
    Idle,
    Completed,
    Failed,
    Stopped,
    Unverifiable,
}

impl State {
    /// A state this build does not know reads as `Unverifiable` (Orca `normalizeSubagentState`).
    pub fn reported(state: &str) -> State {
        match state {
            "working" => State::Working,
            "idle" => State::Idle,
            "completed" => State::Completed,
            "failed" => State::Failed,
            "stopped" => State::Stopped,
            _ => State::Unverifiable,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            State::Working => "working",
            State::Idle => "idle",
            State::Completed => "completed",
            State::Failed => "failed",
            State::Stopped => "stopped",
            State::Unverifiable => "unverifiable",
        }
    }
}

/// The worst outcome wins the group's verdict; `completed` only shows when nothing else is left.
const SETTLED_PRECEDENCE: [State; 5] = [
    State::Failed,
    State::Stopped,
    State::Unverifiable,
    State::Idle,
    State::Completed,
];

/// Adverse outcomes are reported before all siblings settle, so a failure stays visible.
const ADVERSE_PRECEDENCE: [State; 3] = [State::Failed, State::Stopped, State::Unverifiable];

/// One child as the summary reads it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Entry {
    pub id: String,
    pub label: String,
    pub state: State,
    pub started_at: Option<i64>,
    pub settled_at: Option<i64>,
}

#[derive(Debug, PartialEq, Eq)]
pub struct Summary {
    pub total: usize,
    pub working: usize,
    /// The verdict once nothing is in flight; `None` while any child works.
    pub settled_state: Option<State>,
    pub settled_count: usize,
    /// The worst adverse outcome already recorded, even while siblings still work.
    pub adverse_state: Option<State>,
    pub adverse_count: usize,
    /// Anchor for the group's elapsed clock: overlapping runs count once and idle gaps are left out.
    pub clock_started_at: Option<i64>,
    /// The latest terminal time, once the group has settled.
    pub settled_at: Option<i64>,
}

pub fn summarize(agents: &[Entry]) -> Summary {
    let count = |state: State| agents.iter().filter(|agent| agent.state == state).count();
    let working = count(State::Working);
    let settled_at = agents.iter().filter_map(|agent| agent.settled_at).max();
    let settled_state = (working == 0)
        .then(|| {
            SETTLED_PRECEDENCE
                .into_iter()
                .find(|state| count(*state) > 0)
        })
        .flatten();
    let adverse_state = ADVERSE_PRECEDENCE
        .into_iter()
        .find(|state| count(*state) > 0);
    let settled_at = (working == 0).then_some(settled_at).flatten();
    Summary {
        total: agents.len(),
        working,
        settled_state,
        settled_count: settled_state.map_or(0, count),
        adverse_state,
        adverse_count: adverse_state.map_or(0, count),
        clock_started_at: clock_start(agents, settled_at),
        settled_at,
    }
}

/// Every working run ends at now, so together they cover one span from the earliest of them; only
/// settled time before that span adds to it.
fn clock_start(agents: &[Entry], settled_at: Option<i64>) -> Option<i64> {
    let mut runs: Vec<(i64, i64)> = vec![];
    let mut live_from: Option<i64> = None;
    for agent in agents {
        let Some(start) = agent.started_at else {
            continue;
        };
        if agent.state == State::Working {
            live_from = Some(live_from.map_or(start, |from| from.min(start)));
        } else if let Some(end) = agent.settled_at {
            runs.push((start, end.max(start)));
        }
    }
    let cutoff = live_from.unwrap_or(i64::MAX);
    let mut covered = 0;
    let mut reach = i64::MIN;
    runs.sort_by_key(|run| run.0);
    for (start, end) in runs.iter().copied() {
        covered += (end.min(cutoff) - start.max(reach)).max(0);
        reach = reach.max(end);
    }
    match live_from {
        Some(from) => Some(from - covered),
        None if settled_at.is_none() || runs.is_empty() => None,
        None => settled_at.map(|settled| settled - covered),
    }
}

/// "completed" alone; a single child's verdict omits the count and a group's includes it.
pub fn state_label(state: State, count: usize, group_total: usize) -> String {
    if state == State::Completed {
        return "completed".into();
    }
    if group_total <= 1 {
        return match state {
            State::Working => "working",
            State::Idle => "idle",
            State::Failed => "failed",
            State::Stopped => "stopped",
            State::Unverifiable | State::Completed => "status unavailable",
        }
        .into();
    }
    match state {
        State::Working => format!("{count} working"),
        State::Idle => format!("{count} idle"),
        State::Failed => format!("{count} failed"),
        State::Stopped => format!("{count} stopped"),
        State::Unverifiable | State::Completed => format!("{count} with status unavailable"),
    }
}

/// The words of one group's header (Orca `nativeChatSubagentGroupHeader`, less tokens).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Header {
    pub working: bool,
    /// "Kicked off 2 subagents" while any child works, else "Ran 2 subagents".
    pub headline: String,
    pub verdict_state: String,
    pub verdict: String,
    /// An adverse outcome already recorded while siblings still work.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alert_state: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alert: Option<String>,
    /// How long the settled group ran, in milliseconds; absent while it works or when a child's run
    /// length is unknown.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<i64>,
}

pub fn header(agents: &[Entry]) -> Header {
    let summary = summarize(agents);
    let working = summary.working > 0;
    let noun = if summary.total == 1 {
        "subagent"
    } else {
        "subagents"
    };
    let verdict_state = if working {
        State::Working
    } else {
        summary.settled_state.unwrap_or(State::Idle)
    };
    let verdict = if working {
        state_label(State::Working, summary.working, summary.total)
    } else {
        state_label(verdict_state, summary.settled_count, summary.total)
    };
    let alert_state = if working { summary.adverse_state } else { None };
    // A settled child with no terminal time makes the duration unknown: a sibling's time would
    // stand in for a run nobody saw end.
    let unknown = agents
        .iter()
        .any(|agent| agent.state != State::Working && agent.settled_at.is_none());
    let duration_ms = match (summary.clock_started_at, summary.settled_at) {
        (Some(start), Some(end)) if !unknown && !working => Some((end - start).max(0)),
        _ => None,
    };
    Header {
        working,
        headline: format!(
            "{} {} {noun}",
            if working { "Kicked off" } else { "Ran" },
            summary.total
        ),
        verdict_state: verdict_state.as_str().into(),
        verdict,
        alert_state: alert_state.map(|state| state.as_str().into()),
        alert: alert_state.map(|state| state_label(state, summary.adverse_count, summary.total)),
        duration_ms,
    }
}

/// Tell same-named siblings apart with ordinals that avoid every name a sibling already has,
/// including a provider-authored "Audit 2" (Orca `labelledEntries`).
pub fn labelled(labels: &[&str]) -> Vec<String> {
    let mut taken = HashSet::new();
    let mut repeated = HashSet::new();
    for label in labels {
        if !taken.insert(*label) {
            repeated.insert(*label);
        }
    }
    let mut claimed: HashSet<String> = HashSet::new();
    labels
        .iter()
        .map(|base| {
            let mut label = base.to_string();
            if repeated.contains(base) && claimed.contains(&label) {
                let mut ordinal = 2;
                while taken.contains(label.as_str()) || claimed.contains(&label) {
                    label = format!("{base} {ordinal}");
                    ordinal += 1;
                }
            }
            claimed.insert(label.clone());
            label
        })
        .collect()
}

/// One child's line in a roster row.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeUiSubagentRow {
    pub id: String,
    pub label: String,
    pub state: String,
    pub state_label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_type: Option<String>,
}

/// One spawning turn's roster, drawn after the block that holds its spawn calls.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeUiSubagentGroup {
    /// The user message that opened the spawning turn; empty for children whose spawn call is not
    /// in the loaded history.
    pub turn: String,
    /// The block this is drawn after.
    pub after: String,
    #[serde(flatten)]
    pub header: Header,
    pub agents: Vec<NativeUiSubagentRow>,
}

/// Where a spawn call sits in the transcript: its provider call id, its turn and the block that
/// holds it.
pub struct SpawnSite<'a> {
    pub call_id: &'a str,
    pub turn: &'a str,
    pub block: &'a str,
    /// Position of that block in the transcript, so rows keep the transcript's order.
    pub index: usize,
}

/// Group `children` by the turn that spawned them. A child whose call is not found (older than the
/// loaded history, or a provider that names none) forms a last group after `last_block`.
pub fn groups(
    children: &[NativeUiSubagent],
    sites: &[SpawnSite],
    last_block: Option<&str>,
) -> Vec<NativeUiSubagentGroup> {
    // (turn, after block, its index, members), in the order the turns appear.
    let mut placed: Vec<(String, String, usize, Vec<&NativeUiSubagent>)> = vec![];
    let mut unplaced: Vec<&NativeUiSubagent> = vec![];
    for child in children {
        let site = child
            .tool_use_id
            .as_deref()
            .and_then(|id| sites.iter().find(|site| site.call_id == id));
        let Some(site) = site else {
            unplaced.push(child);
            continue;
        };
        match placed.iter_mut().find(|entry| entry.0 == site.turn) {
            Some(entry) => {
                // The row follows the group's last spawn call.
                if site.index >= entry.2 {
                    entry.1 = site.block.to_string();
                    entry.2 = site.index;
                }
                entry.3.push(child);
            }
            None => placed.push((
                site.turn.to_string(),
                site.block.to_string(),
                site.index,
                vec![child],
            )),
        }
    }
    placed.sort_by_key(|entry| entry.2);
    let mut rows: Vec<(String, String, Vec<&NativeUiSubagent>)> = placed
        .into_iter()
        .map(|(turn, after, _, members)| (turn, after, members))
        .collect();
    if let (false, Some(last)) = (unplaced.is_empty(), last_block) {
        rows.push((String::new(), last.to_string(), unplaced));
    }
    rows.into_iter()
        .map(|(turn, after, members)| {
            let labels = labelled(
                &members
                    .iter()
                    .map(|member| member.label.as_str())
                    .collect::<Vec<_>>(),
            );
            let entries: Vec<Entry> = members
                .iter()
                .zip(&labels)
                .map(|(member, label)| Entry {
                    id: member.id.clone(),
                    label: label.clone(),
                    state: State::reported(&member.state),
                    started_at: member.started_at,
                    settled_at: member.settled_at,
                })
                .collect();
            let agents = members
                .iter()
                .zip(&entries)
                .map(|(member, entry)| NativeUiSubagentRow {
                    id: entry.id.clone(),
                    label: entry.label.clone(),
                    state: entry.state.as_str().into(),
                    state_label: state_label(entry.state, 1, 1),
                    agent_type: member.agent_type.clone(),
                })
                .collect();
            NativeUiSubagentGroup {
                turn,
                after,
                header: header(&entries),
                agents,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn agent(id: &str, state: State) -> Entry {
        Entry {
            id: id.into(),
            label: "task".into(),
            state,
            started_at: None,
            settled_at: None,
        }
    }

    fn timed(id: &str, state: State, started: Option<i64>, settled: Option<i64>) -> Entry {
        Entry {
            started_at: started,
            settled_at: settled,
            ..agent(id, state)
        }
    }

    fn child(id: &str, label: &str, state: &str, call: Option<&str>) -> NativeUiSubagent {
        NativeUiSubagent {
            id: id.into(),
            label: label.into(),
            state: state.into(),
            tool_use_id: call.map(Into::into),
            ..Default::default()
        }
    }

    #[test]
    fn the_settled_verdict_ranks_worst_first_and_completed_last() {
        use State::*;
        for (states, expected) in [
            (vec![Failed, Stopped, Idle, Completed], Failed),
            (vec![Stopped, Idle, Completed], Stopped),
            (vec![Unverifiable, Idle, Completed], Unverifiable),
            (vec![Idle, Completed], Idle),
            (vec![Completed, Completed], Completed),
        ] {
            let agents: Vec<Entry> = states
                .iter()
                .enumerate()
                .map(|(index, state)| agent(&format!("a{index}"), *state))
                .collect();
            assert_eq!(summarize(&agents).settled_state, Some(expected));
        }
    }

    #[test]
    fn counts_how_many_children_hold_the_winning_verdict() {
        let summary = summarize(&[
            agent("a", State::Failed),
            agent("b", State::Failed),
            agent("c", State::Completed),
        ]);
        assert_eq!(summary.settled_state, Some(State::Failed));
        assert_eq!(summary.settled_count, 2);
    }

    #[test]
    fn reports_the_earliest_start_and_withholds_a_settled_time_while_work_continues() {
        let working = summarize(&[
            timed("a", State::Completed, Some(50), Some(80)),
            timed("b", State::Working, Some(20), None),
        ]);
        let settled = summarize(&[
            timed("a", State::Completed, Some(50), Some(80)),
            timed("b", State::Stopped, Some(20), Some(95)),
        ]);
        assert_eq!(
            (working.clock_started_at, working.settled_at),
            (Some(20), None)
        );
        assert_eq!(
            (settled.clock_started_at, settled.settled_at),
            (Some(20), Some(95))
        );
    }

    fn elapsed(agents: &[Entry], now: i64) -> Option<i64> {
        let summary = summarize(agents);
        summary
            .clock_started_at
            .map(|start| summary.settled_at.unwrap_or(now) - start)
    }

    #[test]
    fn an_overlapping_fan_out_reads_as_first_start_to_last_stop() {
        let agents = [
            timed("a", State::Completed, Some(100), Some(400)),
            timed("b", State::Completed, Some(150), Some(250)),
            timed("c", State::Failed, Some(300), Some(700)),
        ];
        assert_eq!(elapsed(&agents, 10_000), Some(600));
    }

    #[test]
    fn a_child_resumed_after_a_long_gap_counts_only_its_two_runs() {
        let agents = [
            timed("a", State::Completed, Some(1_000), Some(6_000)),
            timed("b", State::Completed, Some(300_000), Some(305_000)),
        ];
        assert_eq!(elapsed(&agents, 400_000), Some(10_000));
    }

    #[test]
    fn sequential_children_sum_and_skip_the_gap_between_them() {
        let agents = [
            timed("a", State::Completed, Some(0), Some(2_000)),
            timed("b", State::Completed, Some(60_000), Some(63_000)),
            timed("c", State::Stopped, Some(120_000), Some(121_000)),
        ];
        assert_eq!(elapsed(&agents, 200_000), Some(6_000));
    }

    #[test]
    fn the_clock_grows_with_now_while_a_child_works_without_the_gap_before_its_run() {
        let agents = [
            timed("a", State::Completed, Some(1_000), Some(6_000)),
            timed("b", State::Working, Some(300_000), None),
        ];
        assert_eq!(elapsed(&agents, 302_000), Some(7_000));
        assert_eq!(elapsed(&agents, 310_000), Some(15_000));
    }

    #[test]
    fn a_settled_run_that_overlaps_a_working_one_counts_once() {
        let agents = [
            timed("a", State::Completed, Some(1_000), Some(5_000)),
            timed("b", State::Working, Some(3_000), None),
        ];
        assert_eq!(elapsed(&agents, 10_000), Some(9_000));
    }

    #[test]
    fn no_clock_when_no_child_carries_a_run_time() {
        assert_eq!(summarize(&[]).clock_started_at, None);
        assert_eq!(
            summarize(&[
                agent("a", State::Working),
                timed("b", State::Completed, None, Some(50)),
            ])
            .clock_started_at,
            None
        );
    }

    #[test]
    fn a_state_this_build_does_not_know_is_unverifiable_never_working() {
        assert_eq!(State::reported("paused-for-review"), State::Unverifiable);
        let summary = summarize(&[agent("a", State::reported("unheard-of"))]);
        assert_eq!(summary.working, 0);
        assert_eq!(summary.settled_state, Some(State::Unverifiable));
    }

    #[test]
    fn an_adverse_outcome_is_reported_before_the_group_settles() {
        let summary = summarize(&[
            agent("a", State::Working),
            agent("b", State::Working),
            agent("c", State::Failed),
        ]);
        assert_eq!(summary.working, 2);
        assert_eq!(summary.settled_state, None);
        assert_eq!(
            (summary.adverse_state, summary.adverse_count),
            (Some(State::Failed), 1)
        );
    }

    #[test]
    fn the_adverse_outcome_ranks_worst_first_and_ignores_benign_states() {
        assert_eq!(
            summarize(&[
                agent("a", State::Working),
                agent("b", State::Stopped),
                agent("c", State::Failed),
            ])
            .adverse_state,
            Some(State::Failed)
        );
        assert_eq!(
            summarize(&[
                agent("a", State::Working),
                agent("b", State::Idle),
                agent("c", State::Completed),
            ])
            .adverse_state,
            None
        );
    }

    #[test]
    fn the_header_says_kicked_off_while_work_runs_and_ran_once_it_ends() {
        let live = header(&[agent("a", State::Working), agent("b", State::Failed)]);
        assert_eq!(live.headline, "Kicked off 2 subagents");
        assert_eq!(live.verdict, "1 working");
        assert_eq!(live.alert.as_deref(), Some("1 failed"));
        let done = header(&[agent("a", State::Completed)]);
        assert_eq!(done.headline, "Ran 1 subagent");
        assert_eq!(done.verdict, "completed");
        assert_eq!(done.alert, None);
        let lost = header(&[agent("a", State::Unverifiable)]);
        assert_eq!(lost.verdict, "status unavailable");
    }

    #[test]
    fn a_duration_needs_every_settled_child_to_have_a_terminal_time() {
        let known = header(&[timed("a", State::Completed, Some(1_000), Some(4_000))]);
        assert_eq!(known.duration_ms, Some(3_000));
        let unknown = header(&[
            timed("a", State::Completed, Some(1_000), Some(4_000)),
            timed("b", State::Unverifiable, Some(1_000), None),
        ]);
        assert_eq!(unknown.duration_ms, None);
    }

    #[test]
    fn same_named_siblings_are_told_apart_without_taking_a_name_a_sibling_has() {
        assert_eq!(
            labelled(&["Audit", "Audit", "Audit 2"]),
            ["Audit", "Audit 3", "Audit 2"]
        );
    }

    fn site<'a>(call: &'a str, turn: &'a str, block: &'a str, index: usize) -> SpawnSite<'a> {
        SpawnSite {
            call_id: call,
            turn,
            block,
            index,
        }
    }

    #[test]
    fn siblings_of_one_turn_form_one_row_after_the_last_spawn_and_other_turns_get_their_own() {
        let children = [
            child("a", "Audit", "working", Some("c1")),
            child("b", "Review", "completed", Some("c2")),
            child("c", "Later", "working", Some("c3")),
        ];
        let rows = groups(
            &children,
            &[
                site("c1", "u1", "run1", 1),
                site("c2", "u1", "run2", 3),
                site("c3", "u2", "run3", 6),
            ],
            Some("run3"),
        );
        assert_eq!(rows.len(), 2);
        assert_eq!(
            (rows[0].turn.as_str(), rows[0].after.as_str()),
            ("u1", "run2")
        );
        assert_eq!(
            rows[0]
                .agents
                .iter()
                .map(|a| a.id.as_str())
                .collect::<Vec<_>>(),
            ["a", "b"]
        );
        assert_eq!(rows[0].header.headline, "Kicked off 2 subagents");
        assert_eq!(
            (rows[1].turn.as_str(), rows[1].after.as_str()),
            ("u2", "run3")
        );
    }

    #[test]
    fn a_child_whose_spawn_call_is_not_in_the_history_gets_a_last_row() {
        let children = [
            child("a", "Old", "completed", Some("gone")),
            child("b", "Named none", "completed", None),
        ];
        let rows = groups(&children, &[], Some("end"));
        assert_eq!(rows.len(), 1);
        assert_eq!((rows[0].turn.as_str(), rows[0].after.as_str()), ("", "end"));
        assert_eq!(rows[0].agents.len(), 2);
        // No transcript at all: nowhere to draw them.
        assert!(groups(&children, &[], None).is_empty());
    }
}
