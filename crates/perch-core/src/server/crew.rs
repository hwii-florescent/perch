//! `crew.get`: the family strip's data for one session, gathered from Perch's own records and
//! shaped by `crate::crew` (capability `crew.v1`). Read only: nothing here writes, sends or stops;
//! the strip's actions are the ordinary ones (open the child's chat, type to it, close it).
//! The chat refetches when a member's session updates; mail receipts that change without a
//! session update announce themselves with `notify_session_updated` (`server/agent_mail.rs`).
use super::sub_sessions::{key_of, member_report, reconcile};
use super::*;
use crate::agent_fleet::AgentState;
use crate::agent_mail::MailKind;
use crate::crew::{self, Member, MemberReport, Traffic};
use crate::protocol::{CrewLatest, CrewNeedsYou, CrewReport, CrewRow};
use crate::sub_sessions::SubState;

/// Messages read for one viewer in each direction; the strip shows only the newest per peer.
const TRAFFIC_LIMIT: usize = 200;
/// The longest text of a pending question on a row, in characters.
const QUESTION_CHARS: usize = 300;
/// Same list as the delivery loop's: the agents that can be written to.
const RECEIVERS: [&str; 4] = ["claude", "codex", "pi", "omp"];

fn lifecycle_word(state: Option<AgentState>) -> String {
    match state {
        Some(state) => serde_json::to_value(state)
            .ok()
            .and_then(|value| value.as_str().map(str::to_string))
            .unwrap_or_else(|| "unknown".into()),
        None => "unknown".into(),
    }
}

/// One member as Perch's records have it. `child` carries the dispatch record of a sub-session.
fn member_of(
    app: &AppState,
    session_id: &str,
    provider: &str,
    child: Option<(&crate::db::SubSessionRow, SubState)>,
) -> Member {
    let title = app
        .db
        .get_session_row(session_id)
        .ok()
        .flatten()
        .map(|row| row.title)
        .unwrap_or_default();
    let key = key_of(app, session_id, provider).ok();
    let state = key
        .as_ref()
        .and_then(|key| app.agent_runtime.snapshot(key).ok());
    let snapshot = key
        .as_ref()
        .and_then(|key| app.native_bridge(key))
        .and_then(|bridge| bridge.latest());
    let blocked = state
        .as_ref()
        .is_some_and(|state| state.state == AgentState::Blocked)
        || snapshot
            .as_ref()
            .is_some_and(|snapshot| snapshot.blocked || snapshot.request.is_some());
    // Perch's own evidence that a person is wanted, never an agent's word for it.
    let needs_you = blocked.then(|| {
        let asked = snapshot
            .as_ref()
            .and_then(|snapshot| snapshot.request.as_ref())
            .map(|request| format!("{} {}", request.title, request.detail))
            .map(|text| text.split_whitespace().collect::<Vec<_>>().join(" "))
            .filter(|text| !text.is_empty())
            .map(|text| text.chars().take(QUESTION_CHARS).collect::<String>())
            .unwrap_or_else(|| "Waiting for an approval or an answer".into());
        let at = state
            .as_ref()
            .map_or_else(wall_clock_millis, |state| state.last_transition_ms as i64);
        (asked, at)
    });
    // What can receive is the agent on screen, not the one the tab was started with.
    // (`None`: it left, so there is nobody to message.)
    let on_screen = match &key {
        Some(key) => app
            .agent_runtime
            .bridge_key(key)
            .map(|agent| agent.agent_id),
        None => Some(provider.to_string()),
    };
    let can_message = on_screen.is_some_and(|agent| RECEIVERS.contains(&agent.as_str()))
        && app.db.live_incarnation(session_id).ok().flatten().is_some()
        && key
            .as_ref()
            .is_some_and(|key| app.agent_runtime.runtime_alive(key));
    Member {
        session_id: session_id.to_string(),
        title,
        provider: provider.to_string(),
        lifecycle: lifecycle_word(state.map(|state| state.state)),
        dispatch: child.map(|(_, state)| state.as_str().to_string()),
        task: child.map(|(row, _)| {
            row.task
                .lines()
                .next()
                .unwrap_or_default()
                .chars()
                .take(160)
                .collect()
        }),
        needs_you,
        report: member_report(app, session_id, child.is_some()).map(|report| MemberReport {
            text: crew::preview(&report.text),
            source: report.source,
            at: report.at,
            model: report.model,
        }),
        can_message,
    }
}

/// The run `viewer` is in, lead first, or nothing when it is in none.
fn members(app: &AppState, viewer: &str) -> Vec<Member> {
    let Ok(Some(lead)) = app.db.run_of(viewer) else {
        return Vec::new();
    };
    let children = app.db.sub_sessions_of(&lead).unwrap_or_default();
    if children.is_empty() {
        return Vec::new();
    }
    let lead_provider = app
        .db
        .get_session(&lead)
        .ok()
        .flatten()
        .and_then(|row| row.cli_provider_id)
        .unwrap_or_default();
    let mut members = vec![member_of(app, &lead, &lead_provider, None)];
    for row in &children {
        let state = reconcile(app, row);
        members.push(member_of(
            app,
            &row.child_session_id,
            &row.provider_id,
            Some((row, state)),
        ));
    }
    members
}

fn traffic(app: &AppState, viewer: &str) -> Vec<Traffic> {
    let sent = app.db.mail_from(viewer, TRAFFIC_LIMIT).unwrap_or_default();
    let received = app.db.mail_to(viewer, TRAFFIC_LIMIT).unwrap_or_default();
    let line = |row: crate::db::MailRow, to_peer: bool| Traffic {
        peer: if to_peer {
            row.target_session_id.clone()
        } else {
            row.sender_session_id.clone()
        },
        to_peer,
        kind: row.kind,
        handoff: super::agent_mail::handoff_of(&row).to_string(),
        body: row.body,
        state: row.state,
        reason: row.reason,
        at: row.created_at,
    };
    // What a person wrote to a child from this strip is the viewing lead's own traffic.
    let viewer_is_lead = matches!(app.db.run_of(viewer), Ok(Some(lead)) if lead == viewer);
    let from_person: Vec<crate::db::MailRow> = if viewer_is_lead {
        app.db
            .sub_sessions_of(viewer)
            .unwrap_or_default()
            .into_iter()
            .flat_map(|child| {
                app.db
                    .person_mail_to(&child.child_session_id, TRAFFIC_LIMIT)
                    .unwrap_or_default()
            })
            .collect()
    } else {
        Vec::new()
    };
    sent.into_iter()
        .map(|row| line(row, true))
        .chain(from_person.into_iter().map(|row| line(row, true)))
        .chain(received.into_iter().map(|row| line(row, false)))
        .filter(|item| item.kind != MailKind::Note)
        .collect()
}

pub(super) fn rows_for(app: &AppState, viewer: &str) -> Vec<CrewRow> {
    let members = members(app, viewer);
    crew::build(viewer, &members, &traffic(app, viewer))
        .into_iter()
        .map(|row| CrewRow {
            // Before the fields that move out of `row.member`.
            actions: (row.role == crew::Role::Worker)
                .then(|| super::crew_actions::offered(app, &row.member.session_id))
                .flatten(),
            session_id: row.member.session_id,
            role: row.role.as_str().into(),
            title: row.member.title,
            provider: row.member.provider,
            lifecycle: row.member.lifecycle,
            dispatch: row.member.dispatch,
            task: row.member.task,
            needs_you: row
                .member
                .needs_you
                .map(|(preview, at)| CrewNeedsYou { preview, at }),
            report: row.member.report.map(|report| CrewReport {
                text: report.text,
                source: report.source.as_str().into(),
                at: report.at,
                model: report.model,
            }),
            latest: row.latest.map(|latest| CrewLatest {
                direction: if latest.to_peer { "to" } else { "from" }.into(),
                preview: latest.preview,
                at: latest.at,
                receipt: latest.receipt.as_str().into(),
                reason: latest.reason,
                handoff: latest.handoff,
                kind: latest.kind.as_str().into(),
            }),
            can_message: row.member.can_message,
        })
        .collect()
}

pub(super) fn handle_get(state: &Arc<ConnState>, request_id: String, session_id: String) {
    let state = state.clone();
    tokio::task::spawn_blocking(move || {
        let rows = rows_for(&state.app, &session_id);
        let _ = state.out_tx.send(ServerMessage::CrewState {
            request_id,
            session_id,
            rows,
            error: None,
        });
    });
}

#[cfg(test)]
mod tests {
    use super::super::sub_sessions::tests::lead_with_child;
    use super::*;
    use crate::agent_identity::IdentityStore;
    use crate::db::{Enqueued, NewMail};
    use futures::{SinkExt, StreamExt};
    use tokio_tungstenite::tungstenite::Message;

    /// The family strip's data over a real WebSocket against a booted core: a lead sees its child as
    /// a worker with the child's own report, the dispatch record and the receipt of the last message
    /// between them; the child sees its lead as its manager. Nothing is a single status word.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn crew_get_answers_each_member_with_its_own_records() {
        let root = std::env::temp_dir().join(format!("perch-crew-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let db_path = root.join("history.sqlite");
        let db = Arc::new(HistoryDb::open(&db_path).unwrap());
        let local_ui = crate::local_ui::LocalUi::in_process();
        let token = local_ui.token().to_string();
        let (ready_tx, ready_rx) = tokio::sync::oneshot::channel();
        tokio::spawn(run(
            ServerOptions {
                port: 0,
                base_path: "/".into(),
                web_dist_dir: root.join("web"),
                db_path: Some(db_path),
                hosts_path: Some(root.join("hosts.json")),
                providers_path: None,
                devices_path: Some(root.join("devices.json")),
                ready_tx: Some(ready_tx),
                phone_access_port: None,
                local_ui,
            },
            db.clone(),
            root.display().to_string(),
        ));
        let address = tokio::time::timeout(std::time::Duration::from_secs(5), ready_rx)
            .await
            .unwrap()
            .unwrap();
        let (workspace, _) = lead_with_child(&db, &nest, SubState::Running);
        let child_run = db
            .issue(&AgentKey::new(&workspace.id, "child", "codex").unwrap())
            .unwrap();
        // The lead asks the child something; the child has said what it did.
        let Enqueued::New(sent) = db
            .enqueue_message(&NewMail {
                sender_session_id: "lead",
                sender_provider: "claude",
                sender_label: "lead",
                target_session_id: "child",
                target_provider: "codex",
                target_is_agent: true,
                body: "run the tests too",
                key: "k1",
            })
            .unwrap()
        else {
            panic!("the message should be queued");
        };
        db.claim_mail(std::slice::from_ref(&sent.id)).unwrap();
        db.settle_mail(
            std::slice::from_ref(&sent.id),
            crate::agent_mail::MailState::Delivered,
            "",
        )
        .unwrap();
        db.record_agent_report(&child_run.incarnation, "parser fixed, tests not run yet")
            .unwrap();

        let url = format!("ws://{address}/ws");
        let (mut socket, _) = tokio_tungstenite::connect_async(
            crate::hub::socket_request(&url, Some(&token)).unwrap(),
        )
        .await
        .unwrap();
        let mut ask = async |session: &str| -> Vec<CrewRow> {
            let request = serde_json::json!({
                "type": "crew.get", "requestId": "r1", "sessionId": session
            });
            socket
                .send(Message::Text(request.to_string()))
                .await
                .unwrap();
            loop {
                let next = tokio::time::timeout(std::time::Duration::from_secs(10), socket.next())
                    .await
                    .unwrap()
                    .unwrap()
                    .unwrap();
                let Message::Text(text) = next else { continue };
                if let Ok(ServerMessage::CrewState { rows, .. }) = serde_json::from_str(&text) {
                    return rows;
                }
            }
        };

        let lead_view = ask("lead").await;
        assert_eq!(lead_view.len(), 1, "{lead_view:?}");
        let child = &lead_view[0];
        assert_eq!(
            (child.session_id.as_str(), child.role.as_str()),
            ("child", "worker")
        );
        // The record said running, but perchd confirms no such process: a confirmed exit.
        assert_eq!(child.dispatch.as_deref(), Some("exited"));
        assert_eq!(child.task.as_deref(), Some("fix the parser"));
        // No runtime is attached in this test: unknown, and never idle.
        assert_eq!(child.lifecycle, "unknown");
        assert!(child.needs_you.is_none());
        let report = child.report.as_ref().unwrap();
        assert_eq!(
            (report.text.as_str(), report.source.as_str()),
            ("parser fixed, tests not run yet", "report")
        );
        let latest = child.latest.as_ref().unwrap();
        assert_eq!(
            (
                latest.direction.as_str(),
                latest.preview.as_str(),
                latest.receipt.as_str()
            ),
            ("to", "run the tests too", "delivered")
        );

        let child_view = ask("child").await;
        assert_eq!(child_view.len(), 1, "{child_view:?}");
        assert_eq!(child_view[0].session_id, "lead");
        assert_eq!(child_view[0].role, "manager");
        assert_eq!(child_view[0].latest.as_ref().unwrap().direction, "from");
        // A session outside any run has no family.
        assert!(ask("nobody").await.is_empty());
    }
}
