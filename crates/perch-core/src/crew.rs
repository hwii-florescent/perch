//! The family strip's read model: who is in a session's run and what each member is doing, from
//! the viewer's session. Pure: no database, no process. The facts are gathered by `server/crew.rs`;
//! the contract is ARCHITECTURE ("Family strip").
//!
//! Ported from Orca (MIT, `stablyai/orca` at `308b5000`), translated to Rust and narrowed to
//! Perch's flat run (a lead and its children, no tasks table):
//! - `src/shared/orchestration-crew.ts` (`CrewRow`, `CrewSnapshot`): a row is a party with a role
//!   (`manager`, `worker`, `peer`), a label, an agent kind, a task, the latest line of traffic with
//!   its direction, a pending question and whether it can be sent to (`Role`, `Row`);
//! - `src/main/runtime/orchestration/crew/crew-party-snapshot.ts`: the 1,024-byte preview
//!   (`preview`), a manager row for the one that started a worker, worker rows for what the viewer
//!   started, peer rows only for a party it exchanged traffic with, and a pending question that
//!   puts "Waiting for you" on a row (`build`);
//! - `src/main/runtime/orchestration/crew/crew-query.ts` (`readCrewTraffic`): only an agent's own
//!   words are a row's latest line, one line per peer (the newest), rows ordered by newest
//!   traffic first (`latest_traffic`).
//!
//! Changes from Orca: its `status` string is split into the four records ROADMAP keeps apart,
//! `lifecycle` (Perch's runtime), `needs_you` (a pending approval or question, never a model's
//! claim), `latest.receipt` (the mail's delivery state) and `report` (the agent's own claim, with
//! its source); Orca's Mention, menu, host label and dispatch addresses have no counterpart.

use crate::agent_mail::{MailKind, MailState};
use crate::sub_sessions::ReportSource;

/// Orca's preview bound, in bytes.
pub const PREVIEW_BYTES: usize = 1024;

/// How a row relates to the viewer (Orca's `managedBy`, `managing`, `talkingWith`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    /// Started the viewer.
    Manager,
    /// Started by the viewer.
    Worker,
    /// Another member of the run the viewer wrote to or heard from.
    Peer,
}

impl Role {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Manager => "manager",
            Self::Worker => "worker",
            Self::Peer => "peer",
        }
    }
}

/// A member of the run, as Perch's records have it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Member {
    pub session_id: String,
    /// The session's title.
    pub title: String,
    pub provider: String,
    /// Perch's lifecycle word for it (`working`, `idle`, `done`, `blocked`, `exited`, …), or
    /// `unknown` when it could not be read: unknown is not idle.
    pub lifecycle: String,
    /// The dispatch record of a child (`running`, `stopped`, `exited`, `start_unknown`, …).
    pub dispatch: Option<String>,
    /// What a child was asked to do.
    pub task: Option<String>,
    /// A pending approval or question: its text and when it was raised.
    pub needs_you: Option<(String, i64)>,
    pub report: Option<MemberReport>,
    /// A message to it would be accepted (a live agent Perch started).
    pub can_message: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MemberReport {
    pub text: String,
    pub source: ReportSource,
    pub at: i64,
}

/// One message between the viewer and a peer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Traffic {
    pub peer: String,
    /// `true` when the viewer sent it.
    pub to_peer: bool,
    pub kind: MailKind,
    pub body: String,
    pub state: MailState,
    pub reason: String,
    pub at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Latest {
    /// `Message` or `Steer`.
    pub kind: MailKind,
    pub to_peer: bool,
    pub preview: String,
    pub at: i64,
    pub receipt: MailState,
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Row {
    pub role: Role,
    pub member: Member,
    pub latest: Option<Latest>,
}

/// Orca's `preview`: the body whole up to [`PREVIEW_BYTES`] bytes, else cut on a character
/// boundary and marked.
pub fn preview(body: &str) -> String {
    if body.len() <= PREVIEW_BYTES {
        return body.to_string();
    }
    let mut end = PREVIEW_BYTES - 3;
    while !body.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}…", &body[..end])
}

/// The newest admitted line per peer. Only an agent's or a person's own message or steer is one: a status note is
/// Perch's wording (its facts are the row's lifecycle and report), and an empty body says nothing.
pub fn latest_traffic(traffic: &[Traffic]) -> Vec<(String, Latest)> {
    let mut newest: Vec<(String, Latest)> = Vec::new();
    for item in traffic {
        if item.kind == MailKind::Note || item.body.trim().is_empty() {
            continue;
        }
        let line = Latest {
            kind: item.kind,
            to_peer: item.to_peer,
            preview: preview(&item.body),
            at: item.at,
            receipt: item.state,
            reason: item.reason.clone(),
        };
        match newest.iter_mut().find(|(peer, _)| *peer == item.peer) {
            Some((_, current)) if line.at >= current.at => *current = line,
            Some(_) => {}
            None => newest.push((item.peer.clone(), line)),
        }
    }
    newest
}

/// The viewer's family. `members` holds every member of the run, the lead first; a lead sees
/// its children as workers, a child sees its lead as its manager and a sibling only once they
/// exchanged a message. Rows with the newest traffic come first; the rest keep run order.
pub fn build(viewer: &str, members: &[Member], traffic: &[Traffic]) -> Vec<Row> {
    let Some(lead) = members.first() else {
        return Vec::new();
    };
    let viewer_is_lead = lead.session_id == viewer;
    let latest = latest_traffic(traffic);
    let mut rows: Vec<Row> = members
        .iter()
        .filter(|member| member.session_id != viewer)
        .filter_map(|member| {
            let line = latest
                .iter()
                .find(|(peer, _)| *peer == member.session_id)
                .map(|(_, line)| line.clone());
            let role = if viewer_is_lead {
                Role::Worker
            } else if member.session_id == lead.session_id {
                Role::Manager
            } else if line.is_some() || member.needs_you.is_some() {
                Role::Peer
            } else {
                return None;
            };
            Some(Row {
                role,
                member: member.clone(),
                latest: line,
            })
        })
        .collect();
    // Stable: equal times (no traffic) keep the order the run lists them in.
    rows.sort_by_key(|row| std::cmp::Reverse(row.latest.as_ref().map_or(i64::MIN, |l| l.at)));
    rows
}

#[cfg(test)]
mod tests {
    use super::*;

    fn member(id: &str) -> Member {
        Member {
            session_id: id.into(),
            title: format!("title {id}"),
            provider: "claude".into(),
            lifecycle: "idle".into(),
            dispatch: None,
            task: None,
            needs_you: None,
            report: None,
            can_message: true,
        }
    }

    fn message(peer: &str, to_peer: bool, body: &str, at: i64) -> Traffic {
        Traffic {
            peer: peer.into(),
            to_peer,
            kind: MailKind::Message,
            body: body.into(),
            state: MailState::Delivered,
            reason: String::new(),
            at,
        }
    }

    #[test]
    fn a_preview_is_whole_up_to_1024_bytes_and_cut_on_a_character_boundary_after() {
        let exact = "a".repeat(PREVIEW_BYTES);
        assert_eq!(preview(&exact), exact);
        let cut = preview(&"a".repeat(PREVIEW_BYTES + 1));
        assert_eq!(cut.len(), PREVIEW_BYTES - 3 + '…'.len_utf8());
        assert!(cut.ends_with('…'));
        // A two-byte character straddling the limit is dropped, never split.
        let wide = "é".repeat(PREVIEW_BYTES);
        let cut = preview(&wide);
        assert!(cut.ends_with('…') && cut.len() <= PREVIEW_BYTES);
        assert!(cut.trim_end_matches('…').chars().all(|c| c == 'é'));
    }

    #[test]
    fn a_lead_sees_its_children_as_workers_newest_traffic_first() {
        let members = [member("lead"), member("a"), member("b"), member("c")];
        let traffic = [
            message("a", true, "first to a", 10),
            message("b", false, "from b", 30),
            message("a", false, "from a", 20),
        ];
        let rows = build("lead", &members, &traffic);
        let order: Vec<&str> = rows.iter().map(|r| r.member.session_id.as_str()).collect();
        // b's newest line is at 30, a's at 20, c has none and keeps its place last.
        assert_eq!(order, ["b", "a", "c"]);
        assert!(rows.iter().all(|row| row.role == Role::Worker));
        let a = &rows[1];
        let latest = a.latest.as_ref().unwrap();
        assert_eq!((latest.preview.as_str(), latest.to_peer), ("from a", false));
        assert!(rows[2].latest.is_none());
    }

    #[test]
    fn a_child_sees_its_lead_as_manager_and_a_sibling_only_after_they_wrote() {
        let members = [member("lead"), member("a"), member("b"), member("c")];
        let rows = build("a", &members, &[message("b", true, "hi b", 5)]);
        let seen: Vec<(&str, Role)> = rows
            .iter()
            .map(|row| (row.member.session_id.as_str(), row.role))
            .collect();
        assert_eq!(seen, [("b", Role::Peer), ("lead", Role::Manager)]);
        // Without traffic the sibling is not shown; the lead always is.
        let quiet = build("a", &members, &[]);
        assert_eq!(quiet.len(), 1);
        assert_eq!(quiet[0].role, Role::Manager);
    }

    #[test]
    fn a_sibling_waiting_on_a_person_is_shown_without_traffic() {
        let mut waiting = member("b");
        waiting.lifecycle = "blocked".into();
        waiting.needs_you = Some(("Run this command?".into(), 7));
        let members = [member("lead"), member("a"), waiting];
        let rows = build("a", &members, &[]);
        let peer = rows.iter().find(|row| row.role == Role::Peer).unwrap();
        assert_eq!(peer.member.session_id, "b");
        assert_eq!(
            peer.member.needs_you.as_ref().unwrap().0,
            "Run this command?"
        );
    }

    #[test]
    fn only_an_agents_own_words_are_the_latest_line_one_per_peer_and_the_newest() {
        let mut note = message("a", false, "a finished its turn", 50);
        note.kind = MailKind::Note;
        let mut cancelled = message("a", true, "take it back", 40);
        cancelled.state = MailState::Undelivered;
        cancelled.reason = "cancelled by its sender".into();
        let traffic = [
            message("a", true, "older", 10),
            message("a", false, "   ", 60),
            note,
            cancelled,
            message("a", false, "older still", 5),
        ];
        let latest = latest_traffic(&traffic);
        assert_eq!(latest.len(), 1);
        let (peer, line) = &latest[0];
        assert_eq!(peer, "a");
        // The status note and the blank body are not words; a cancelled message still is the
        // newest message and carries its receipt.
        assert_eq!(line.preview, "take it back");
        assert_eq!(line.receipt, MailState::Undelivered);
        assert_eq!(line.reason, "cancelled by its sender");
    }

    #[test]
    fn a_run_with_no_members_has_no_rows_and_the_viewer_is_never_its_own_row() {
        assert!(build("x", &[], &[]).is_empty());
        let rows = build("lead", &[member("lead")], &[message("lead", true, "me", 1)]);
        assert!(rows.is_empty());
    }

    #[test]
    fn a_steer_is_a_line_of_its_own_kind_and_a_note_is_still_not_one() {
        let mut steer = message("a", true, "use the other file", 20);
        steer.kind = MailKind::Steer;
        steer.state = MailState::Unconfirmed;
        let latest = latest_traffic(&[message("a", true, "earlier", 10), steer]);
        assert_eq!(latest[0].1.kind, MailKind::Steer);
        assert_eq!(latest[0].1.receipt, MailState::Unconfirmed);
    }

    #[test]
    fn a_report_and_the_lifecycle_stay_separate_records_on_a_row() {
        let mut child = member("a");
        child.lifecycle = "working".into();
        child.report = Some(MemberReport {
            text: "done, tests pass".into(),
            source: ReportSource::Reported,
            at: 3,
        });
        let rows = build("lead", &[member("lead"), child], &[]);
        let row = &rows[0];
        // Working and having reported are both true: neither overwrites the other, and a report
        // is a claim whose source travels with it.
        assert_eq!(row.member.lifecycle, "working");
        assert_eq!(
            row.member.report.as_ref().unwrap().source,
            ReportSource::Reported
        );
        assert!(row.member.needs_you.is_none());
    }
}
