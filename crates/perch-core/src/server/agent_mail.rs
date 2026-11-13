//! `perch send`, `inbox` and `cancel` on the core, the delivery loop that hands queued mail to
//! receivers at once, and the status notes children leave their lead. Own design, slice 5; the
//! rules are `crate::agent_mail`, the queue `db/agent_mail.rs`, the contract ARCHITECTURE
//! ("Messages").
//!
//! The delivery engine ([`pass`]) holds the decisions and asks a [`World`] for everything that
//! touches a process, so its behaviour (an idle receiver starts a turn, a busy one whose CLI has a
//! follow-up queue gets it there, nothing is written to a receiver whose state is unknown, over a
//! draft or over an open question, one claim per message, an unconfirmed delivery never repeated)
//! is tested without a terminal. [`AppWorld`] is the real one: it checks the receiver's lifecycle,
//! native bridge and input line, and writes through the bridge (Pi, OMP, Codex) or, for Claude, the
//! input lease and a verified empty prompt in one step (idle only).
use super::sub_sessions::{fail, internal, Failure};
use super::*;
use crate::agent_fleet::{AgentState, ClientIdentity, ClientKind};
use crate::agent_identity::AgentIdentity;
use crate::agent_mail::{
    self, BodyText, ChildStatus, Handoff, Live, MailKind, MailState, Owed, Sender, TargetFacts,
    Wait,
};
use crate::db::{Cancelled, Enqueued, MailRow, NewMail};
use crate::sub_sessions::{Report, ReportSource, SubState};
use serde_json::{json, Value};
use std::time::Duration;
use tokio::sync::oneshot;

/// The agents that can be sent to: those with a native bridge Perch launched itself.
const RECEIVERS: [&str; 4] = ["claude", "codex", "pi", "omp"];
/// How long a delivered prompt is waited for before it is called unconfirmed.
const CONFIRM_TIMEOUT: Duration = Duration::from_secs(10);
/// A pass runs when something is queued and at least this often while anything waits.
const PASS_INTERVAL: Duration = Duration::from_secs(2);
const LIST_LIMIT: usize = 30;

/// How a delivered message reached the agent, for a receipt: `queued_in_agent` (its CLI's follow-up
/// queue), `steered` (into the running turn) or empty (it started a turn, or is not delivered).
pub(super) fn handoff_of(row: &MailRow) -> &str {
    if row.state != MailState::Delivered {
        ""
    } else if row.kind == MailKind::Steer {
        "steered"
    } else {
        &row.handoff
    }
}

fn mail_json(row: &MailRow) -> Value {
    let long = !agent_mail::fits_inline(&row.body);
    json!({
        "id": row.id,
        "kind": row.kind.as_str(),
        "from": row.sender_session_id,
        "fromLabel": row.sender_label,
        "fromProvider": row.sender_provider,
        "to": row.target_session_id,
        "state": row.state.as_str(),
        "reason": row.reason,
        "handoff": handoff_of(row),
        "text": if long { agent_mail::preview(&row.body) } else { row.body.clone() },
        "truncated": long,
        "at": row.created_at,
    })
}

/// What a sender is called in a header: a child by its task, any other session by its title.
pub(super) fn sender_label(app: &AppState, session_id: &str, provider: &str) -> String {
    if let Ok(Some(child)) = app.db.sub_session(session_id) {
        let line = child.task.lines().next().unwrap_or_default();
        let label = agent_mail::clean_label(line, provider);
        // A child that was reset is still this child; say which of its conversations is speaking.
        return match app.db.conversation_ordinal(session_id) {
            Ok(ordinal) if ordinal > 1 => format!("{label} (conversation {ordinal})"),
            _ => label,
        };
    }
    let title = app
        .db
        .list_sessions()
        .ok()
        .and_then(|rows| rows.into_iter().find(|row| row.id == session_id))
        .map(|row| row.title)
        .unwrap_or_default();
    agent_mail::clean_label(&title, provider)
}

fn refusal_status(refusal: &agent_mail::SendRefusal) -> StatusCode {
    use agent_mail::SendRefusal::*;
    match refusal {
        ToSelf => StatusCode::BAD_REQUEST,
        OtherRun => StatusCode::FORBIDDEN,
        NotRunning | CannotReceive | RunLimit(_) | QueueFull | InboundRefuses | InboundHolds => {
            StatusCode::CONFLICT
        }
    }
}

/// `perch send <session> <text>`: queue a message for another member of the caller's run.
pub(super) fn send(app: &AppState, caller: &AgentIdentity, body: &Value) -> Result<Value, Failure> {
    let bad = |text: String| fail(StatusCode::BAD_REQUEST, text);
    let target = body["target"]
        .as_str()
        .filter(|target| !target.is_empty())
        .ok_or_else(|| bad("say who it is for: perch send <session> <text>".into()))?;
    let text = agent_mail::check_body(body["text"].as_str().unwrap_or_default()).map_err(bad)?;
    let key = agent_mail::check_key(body["key"].as_str().unwrap_or_default()).map_err(bad)?;
    let target_row = app
        .db
        .get_session(target)
        .map_err(|error| internal("read the receiver", error))?
        // A session that does not exist and one in another run read the same.
        .ok_or_else(|| {
            let refusal = agent_mail::SendRefusal::OtherRun;
            fail(refusal_status(&refusal), refusal.message())
        })?;
    let provider = target_row.cli_provider_id.clone().unwrap_or_default();
    let local = target_row.host_id.is_empty() || target_row.host_id == "local";
    let label = sender_label(app, &caller.session_id, &caller.provider_id);
    let queued = app
        .db
        .enqueue_message(&NewMail {
            sender_session_id: &caller.session_id,
            sender_provider: &caller.provider_id,
            sender_label: &label,
            target_session_id: target,
            target_provider: &provider,
            target_is_agent: local && RECEIVERS.contains(&provider.as_str()),
            body: text,
            key,
        })
        .map_err(|error| internal("queue the message", error))?;
    let (row, duplicate) = match queued {
        Enqueued::New(row) => (row, false),
        Enqueued::Existing(row) => (row, true),
        Enqueued::Refused(refusal) => {
            return Err(fail(refusal_status(&refusal), refusal.message()));
        }
    };
    app.mail_notify.notify_one();
    // The family strip shows the receipt on both ends.
    notify_session_updated(app, &caller.session_id);
    notify_session_updated(app, target);
    Ok(json!({
        "id": row.id,
        "state": row.state.as_str(),
        "reason": row.reason,
        "duplicate": duplicate,
    }))
}

/// `perch inbox`: what is addressed to the caller and what it sent, with receipts. Reading
/// consumes nothing.
pub(super) fn inbox(app: &AppState, caller: &AgentIdentity) -> Result<Value, Failure> {
    let read = |error| internal("read the mail", error);
    let mut received = app
        .db
        .mail_to(&caller.session_id, LIST_LIMIT)
        .map_err(read)?;
    // What this session's person holds back or turned away is not for it to read.
    received.retain(|row| {
        row.state != MailState::Held
            && !(row.state == MailState::Undelivered
                && matches!(
                    row.reason.as_str(),
                    agent_mail::REFUSED_REASON | agent_mail::DISCARDED_REASON
                ))
    });
    let sent = app
        .db
        .mail_from(&caller.session_id, LIST_LIMIT)
        .map_err(read)?;
    Ok(json!({
        "received": received.iter().map(mail_json).collect::<Vec<_>>(),
        "sent": sent.iter().map(mail_json).collect::<Vec<_>>(),
    }))
}

/// `perch cancel <message>`: take back a message still waiting.
pub(super) fn cancel(app: &AppState, caller: &AgentIdentity, id: &str) -> Result<Value, Failure> {
    match app
        .db
        .cancel_mail(&caller.session_id, id)
        .map_err(|error| internal("cancel the message", error))?
    {
        Cancelled::Cancelled => {
            notify_session_updated(app, &caller.session_id);
            if let Ok(Some(row)) = app.db.mail(id) {
                notify_session_updated(app, &row.target_session_id);
            }
            Ok(json!({ "id": id, "state": "undelivered" }))
        }
        Cancelled::TooLate(state) => Err(fail(
            StatusCode::CONFLICT,
            format!(
                "that message is already {}; it cannot be taken back",
                state.as_str()
            ),
        )),
        Cancelled::NotFound => Err(fail(
            StatusCode::NOT_FOUND,
            "that is not a message you sent, or it no longer exists",
        )),
    }
}

/// Working children silent past their own threshold get one note to their lead each time they
/// go quiet (`sub_sessions::newly_quiet`); `perch list` shows the same children as QUIET. Called
/// from the lifecycle loop every second, so the cheap filters come before any database read.
pub(super) fn tell_leads_of_quiet_children(
    app: &AppState,
    snapshots: &[crate::agent_fleet::AgentSnapshot],
) {
    let now = now_millis();
    let mut quiet = std::collections::HashMap::new();
    for snapshot in snapshots
        .iter()
        .filter(|snapshot| snapshot.state == crate::agent_fleet::AgentState::Working)
    {
        let evidence = snapshot.last_activity_ms.max(snapshot.last_transition_ms);
        // The shortest threshold a lead can set is a minute.
        if now.saturating_sub(evidence) < 60_000 {
            continue;
        }
        let id = &snapshot.key.session_id;
        if !matches!(app.db.parent_of(id), Ok(Some(_))) {
            continue;
        }
        let after = app
            .db
            .quiet_after(id)
            .ok()
            .flatten()
            .unwrap_or(crate::sub_sessions::DEFAULT_QUIET_AFTER_MINUTES);
        if let Some(minutes) = crate::sub_sessions::quiet_minutes(true, evidence, now, after) {
            quiet.insert(id.clone(), (snapshot.key.clone(), minutes));
        }
    }
    let ids = quiet.keys().cloned().collect();
    let fresh = crate::sub_sessions::newly_quiet(&mut app.quiet_told.lock().unwrap(), &ids);
    for id in fresh {
        let (key, minutes) = &quiet[&id];
        note_lead(app, key, ChildStatus::Quiet(*minutes), None);
    }
}

/// A child ran `perch report`: tell its lead, with the report quoted as the child's own claim.
/// This is the only note a lead gets; Perch queues none when a turn ends. A newer note from the
/// same child replaces one still waiting.
pub(super) fn note_report(app: &AppState, child: &AgentKey, text: &str) {
    let report = Report {
        text: text.to_string(),
        source: ReportSource::Reported,
        at: wall_clock_millis(),
        model: None,
    };
    note_lead(app, child, ChildStatus::Reported, Some(&report));
}

/// Queue a note from `child` to its lead, if it has one with a live identity.
fn note_lead(app: &AppState, child: &AgentKey, status: ChildStatus, report: Option<&Report>) {
    let Ok(Some(lead)) = app.db.parent_of(&child.session_id) else {
        return;
    };
    let Ok(Some(lead_row)) = app.db.get_session(&lead) else {
        return;
    };
    let label = sender_label(app, &child.session_id, &child.agent_id);
    let body = agent_mail::note_line(&label, &child.agent_id, &child.session_id, status, report);
    match app.db.enqueue_note(
        (&child.session_id, &child.agent_id, &label),
        (&lead, &lead_row.cli_provider_id.unwrap_or_default()),
        &body,
    ) {
        Ok(Some(_)) => app.mail_notify.notify_one(),
        Ok(None) => {
            tracing::info!(child = %child.session_id, "no note: the lead has no live identity")
        }
        Err(error) => tracing::warn!(%error, "could not queue a note for a lead"),
    }
}

/// How one delivery attempt to a receiver ended.
pub(super) enum Delivery {
    /// Nothing was written; the message stays queued for this reason.
    Held(Wait),
    /// The claim landed and bytes or a bridge command went out: this answers whether the
    /// receiver took it, and how it was handed over.
    Sent(oneshot::Receiver<Result<bool, String>>, Handoff),
    /// Claimed, but it is certain nothing reached the receiver: back to the queue.
    NotSent(String),
    /// Claimed and written (or maybe written), then something failed: unknown.
    Failed(String),
}

/// What the engine needs from the running system.
pub(super) trait World {
    fn live(&self, session: &str) -> Live;
    fn facts(&self, session: &str) -> TargetFacts;
    /// Write `text` to its own file in the run's notes folder, returning its path.
    fn notes_file(&self, run: &str, name: &str, text: &str) -> anyhow::Result<String>;
    /// Check the receiver again under the delivery lock, call `claim` (once, just before the first
    /// byte) and write `prompt`. `claim` is false when another pass already holds the message.
    fn deliver(
        &self,
        session: &str,
        delivery_id: &str,
        prompt: &str,
        claim: &dyn Fn() -> bool,
    ) -> Delivery;
}

pub(super) enum Pass {
    /// Nothing queued, or nothing that could be acted on.
    Idle,
    /// Mail waits for this reason.
    Waiting(String),
    Sent {
        ids: Vec<String>,
        reply: oneshot::Receiver<Result<bool, String>>,
    },
}

/// One delivery decision for one receiver: settle what can never arrive, hold what must wait,
/// and hand over at most one message (or one roster of notes).
pub(super) fn pass(db: &HistoryDb, world: &dyn World, target: &str, now_ms: i64) -> Pass {
    let Ok(queued) = db.queued_mail_for(target) else {
        return Pass::Idle;
    };
    let live = world.live(target);
    let mut owed = Vec::new();
    let mut unreadable = false;
    for item in queued {
        // The run ended with its lead's session, or the receiver is no longer in it: a lead that
        // began another conversation is not the one this was written to.
        let run_ended = match (db.run_exists(&item.run_id), db.run_of(target)) {
            (Ok(exists), Ok(receiver_run)) => {
                !exists || receiver_run.is_some_and(|run| run != item.run_id)
            }
            _ => {
                unreadable = true;
                continue;
            }
        };
        match agent_mail::owed(true, run_ended, &item.target_incarnation, &live) {
            Owed::Owed => owed.push(item),
            Owed::Stale(reason) => {
                let _ = db.undeliver_mail(&item.id, &reason);
            }
            Owed::Unavailable => unreadable = true,
        }
    }
    let all_ids: Vec<String> = owed.iter().map(|item| item.id.clone()).collect();
    if unreadable {
        let reason = "Perch could not read the receiver's state";
        let _ = db.set_mail_wait(&all_ids, reason);
        return Pass::Waiting(reason.into());
    }
    let Some(first) = owed.first() else {
        return Pass::Idle;
    };
    // One message per delivery; every waiting note of a lead goes in one roster.
    let batch: Vec<&MailRow> = match first.kind {
        MailKind::Message | MailKind::Steer => vec![first],
        MailKind::Note => owed
            .iter()
            .filter(|item| item.kind == MailKind::Note)
            .collect(),
    };
    let facts = world.facts(target);
    if let Err(wait) = agent_mail::route(&facts) {
        let reason = wait.reason();
        let _ = db.set_mail_wait(&all_ids, &reason);
        return Pass::Waiting(reason);
    }
    let from_person = first.sender_session_id == crate::crew_actions::PERSON;
    let (prompt, delivery_id) = match first.kind {
        MailKind::Message | MailKind::Steer => {
            let sender = Sender {
                label: &first.sender_label,
                provider: &first.sender_provider,
                session: &first.sender_session_id,
            };
            let body = if agent_mail::fits_inline(&first.body) {
                BodyText::Whole(&first.body)
            } else {
                let name = format!("message-{}.md", first.id);
                let path = match world.notes_file(&first.run_id, &name, &first.body) {
                    Ok(path) => path,
                    Err(error) => {
                        tracing::warn!(%error, "could not write a long message to the notes folder");
                        let reason = "Perch could not write the long message to its notes folder";
                        let _ = db.set_mail_wait(&all_ids, reason);
                        return Pass::Waiting(reason.into());
                    }
                };
                let preview = agent_mail::preview(&first.body);
                let in_file = BodyText::InFile {
                    path: &path,
                    chars: first.body.chars().count(),
                    preview: &preview,
                };
                let banner = if from_person {
                    agent_mail::format_person_banner(
                        first.kind,
                        &first.id,
                        first.created_at,
                        &in_file,
                    )
                } else {
                    agent_mail::format_banner(
                        &sender,
                        first.kind,
                        &first.id,
                        first.created_at,
                        &in_file,
                    )
                };
                return deliver_batch(
                    db,
                    world,
                    target,
                    &facts,
                    (&batch, &all_ids),
                    (&first.id, &banner),
                    from_person,
                );
            };
            let banner = if from_person {
                agent_mail::format_person_banner(first.kind, &first.id, first.created_at, &body)
            } else {
                agent_mail::format_banner(&sender, first.kind, &first.id, first.created_at, &body)
            };
            (banner, first.id.clone())
        }
        MailKind::Note => {
            let lines: Vec<&str> = batch.iter().map(|item| item.body.as_str()).collect();
            (
                agent_mail::roster_prompt(&lines, now_ms),
                Uuid::new_v4().to_string(),
            )
        }
    };
    deliver_batch(
        db,
        world,
        target,
        &facts,
        (&batch, &all_ids),
        (&delivery_id, &prompt),
        from_person,
    )
}

/// `mail` is the batch and every id waiting for the receiver; `text` the delivery id and prompt.
fn deliver_batch(
    db: &HistoryDb,
    world: &dyn World,
    target: &str,
    facts: &TargetFacts,
    mail: (&[&MailRow], &[String]),
    text: (&str, &str),
    from_person: bool,
) -> Pass {
    let (batch, all_ids) = mail;
    let (delivery_id, prompt) = text;
    let ids: Vec<String> = batch.iter().map(|item| item.id.clone()).collect();
    // A person's message is not an automatic wake, so it spends none.
    let lead = facts.is_lead && !from_person;
    let claim = || {
        if !db.claim_mail(&ids).unwrap_or(false) {
            return false;
        }
        if lead {
            let _ = db.spend_mail_wake(target);
        }
        true
    };
    match world.deliver(target, delivery_id, prompt, &claim) {
        Delivery::Held(wait) => {
            let reason = wait.reason();
            let _ = db.set_mail_wait(all_ids, &reason);
            Pass::Waiting(reason)
        }
        Delivery::Sent(reply, handoff) => {
            let _ = db.set_mail_handoff(&ids, handoff.as_str());
            Pass::Sent { ids, reply }
        }
        Delivery::NotSent(reason) => {
            let _ = db.unclaim_mail(&ids, &reason);
            Pass::Waiting(reason)
        }
        Delivery::Failed(reason) => {
            let _ = db.settle_mail(&ids, MailState::Unconfirmed, &reason);
            Pass::Idle
        }
    }
}

/// Settle a delivery from the receiver's answer: only its own confirmation makes it delivered.
pub(super) async fn settle(
    db: &HistoryDb,
    ids: &[String],
    reply: oneshot::Receiver<Result<bool, String>>,
) {
    let confirmed = matches!(
        tokio::time::timeout(CONFIRM_TIMEOUT, reply).await,
        Ok(Ok(Ok(true)))
    );
    let (state, reason) = if confirmed {
        (MailState::Delivered, "")
    } else {
        (
            MailState::Unconfirmed,
            "Perch handed it over but the receiver did not confirm that it took it; it may have arrived",
        )
    };
    if let Err(error) = db.settle_mail(ids, state, reason) {
        tracing::error!(%error, "could not record what became of delivered mail");
    }
}

/// The real system behind the engine.
pub(super) struct AppWorld<'a>(pub &'a AppState);

impl AppWorld<'_> {
    fn target_key(&self, session: &str) -> Option<(AgentKey, String)> {
        let row = self.0.db.get_session(session).ok().flatten()?;
        let provider = row.cli_provider_id?;
        let workspace = row
            .workspace_id
            .unwrap_or_else(|| format!("session-{session}"));
        Some((
            AgentKey::new(&workspace, session, &provider).ok()?,
            provider,
        ))
    }

    /// Is this child working, as far as the lead's wait is concerned? A launch in flight is; so is
    /// a running child whose state cannot be read, because unknown is not idle.
    fn child_working(&self, row: &crate::db::SubSessionRow) -> bool {
        match row.state {
            SubState::Starting => true,
            SubState::Running => {
                let state = self
                    .target_key(&row.child_session_id)
                    .and_then(|(key, _)| self.0.agent_runtime.snapshot(&key).ok())
                    .map(|snapshot| snapshot.state);
                matches!(state, Some(AgentState::Working) | None)
            }
            _ => false,
        }
    }
}

fn mail_client() -> Result<ClientIdentity, String> {
    ClientIdentity::new("mail-delivery", "perch-core", ClientKind::Service)
        .map_err(|error| error.to_string())
}

impl World for AppWorld<'_> {
    fn live(&self, session: &str) -> Live {
        match self.0.db.live_incarnation(session) {
            Ok(incarnation) => Live::Known(incarnation),
            Err(_) => Live::Unreadable,
        }
    }

    fn facts(&self, session: &str) -> TargetFacts {
        let Some((key, _)) = self.target_key(session) else {
            return TargetFacts::default();
        };
        let app = self.0;
        let snapshot = app.native_bridge(&key).and_then(|bridge| bridge.latest());
        // The agent on screen: a tab started as Claude may run `pi` now.
        let agent = app
            .agent_runtime
            .bridge_key(&key)
            .map(|bridge_key| bridge_key.agent_id)
            .unwrap_or_default();
        let lifecycle = app
            .agent_runtime
            .snapshot(&key)
            .ok()
            .map(|snapshot| snapshot.state);
        // The children of the receiver's current run: an earlier conversation's are not its to wait on.
        let children = app
            .db
            .run_of(session)
            .ok()
            .flatten()
            .map(|run| app.db.sub_sessions_in_run(&run).unwrap_or_default())
            .unwrap_or_default();
        let is_lead = !children.is_empty() && matches!(app.db.parent_of(session), Ok(None));
        TargetFacts {
            followup_queue: agent_mail::has_followup_queue(&agent),
            agent,
            alive: app.agent_runtime.runtime_alive(&key),
            reported: snapshot.is_some(),
            idle: matches!(lifecycle, Some(AgentState::Idle | AgentState::Done)),
            running: snapshot.as_ref().is_some_and(|s| s.running),
            blocked: snapshot.as_ref().is_some_and(|s| s.blocked),
            request_open: snapshot.as_ref().is_some_and(|s| s.request.is_some()),
            is_lead,
            working_children: if is_lead {
                children
                    .iter()
                    .filter(|row| self.child_working(row))
                    .count()
            } else {
                0
            },
        }
    }

    fn notes_file(&self, run: &str, name: &str, text: &str) -> anyhow::Result<String> {
        use std::io::Write;
        use std::os::unix::fs::OpenOptionsExt;
        let path = crate::native_ui::notes_dir(run)?.join(name);
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(&path)?;
        file.write_all(text.as_bytes())?;
        Ok(path.display().to_string())
    }

    fn deliver(
        &self,
        session: &str,
        delivery_id: &str,
        prompt: &str,
        claim: &dyn Fn() -> bool,
    ) -> Delivery {
        let app = self.0;
        // The same lock Context Bridge holds: no delete, stop or other delivery interleaves.
        let _operation = app.agent_operation_lock.lock().unwrap();
        let Some((key, _)) = self.target_key(session) else {
            return Delivery::Held(Wait::NotRunning);
        };
        // The agent on screen is the receiver: a tab started as Claude may run `pi` now.
        let Some(bridge_key) = app.agent_runtime.bridge_key(&key) else {
            return Delivery::Held(Wait::NotRunning);
        };
        if !RECEIVERS.contains(&bridge_key.agent_id.as_str()) {
            return Delivery::Held(Wait::NotRunning);
        }
        // Looked at again under the lock: what was true a moment ago may not be.
        if let Err(wait) = agent_mail::route(&self.facts(session)) {
            return Delivery::Held(wait);
        }
        let Some(bridge) = app.native_ui.get(&bridge_key) else {
            return Delivery::Held(Wait::NotReported);
        };
        let recheck = || agent_mail::route(&self.facts(session));
        deliver_native(
            app,
            (&key, &bridge_key, &bridge),
            (delivery_id, prompt),
            claim,
            &recheck,
        )
    }
}

/// How long a PTY must have heard no input from any client before mail is written into it.
const QUIET: Duration = Duration::from_secs(2);

/// Deliver one prompt, everything checked and written inside one critical section under the authority
/// lock that every PTY write and lease change also takes (`dispatch_under_current_lease`): no input
/// reached the PTY from any client for [`QUIET`] (unknown counts as recent), the receiver is still
/// idle, or busy with a CLI that takes it (a follow-up queue, or a steer), and nothing open (`recheck`,
/// which says which), its input line is empty (Claude: its real process and an empty prompt; the others:
/// nothing typed, no dialog or overlay), then claim, queue the confirmation with the bridge and, for
/// Claude only, paste. The input lease is the holder's current one, left exactly as it was; with no
/// holder it is borrowed for this call and returned. Pi, OMP and Codex take the prompt through their
/// bridge and write nothing to the terminal; the Pi/OMP extension queues it as a follow-up when a turn
/// runs, and a busy Codex gets `turn/steer` (`enqueue_steer`, as `perch steer` does). A busy Claude gets
/// the same verified paste as an idle one, which its own prompt queue feeds into the running turn.
/// The confirmation is Claude's `UserPromptSubmit` hook or the bridge's own answer; an unconfirmed write
/// is never repeated.
fn deliver_native(
    app: &AppState,
    // The tab (owns the PTY, leases and lifecycle), the agent whose bridge it is, and that bridge.
    receiver: (&AgentKey, &AgentKey, &Arc<crate::native_ui::NativeBridge>),
    text: (&str, &str),
    claim: &dyn Fn() -> bool,
    recheck: &dyn Fn() -> Result<Handoff, Wait>,
) -> Delivery {
    let (key, agent, bridge) = receiver;
    let (delivery_id, prompt) = text;
    let client = match mail_client() {
        Ok(client) => client,
        Err(error) => return Delivery::Held(Wait::Input(error)),
    };
    let outcome = app
        .agent_runtime
        .dispatch_under_current_lease(key, &client, QUIET, |write| {
            let handoff = match recheck() {
                Ok(handoff) => handoff,
                Err(wait) => return Ok(Delivery::Held(wait)),
            };
            // Under the lock again: the agent on screen is still the one the checks were about.
            if app.agent_runtime.bridge_key(key).as_ref() != Some(agent) {
                return Ok(Delivery::Held(Wait::NotRunning));
            }
            let input = crate::native_ui::typed::input_ready(agent)
                .and_then(|()| crate::native_ui::claude::prepare_input(agent, Some(prompt)));
            let input = match input {
                Ok(input) => input,
                Err(error) => return Ok(Delivery::Held(Wait::Input(error.to_string()))),
            };
            if !claim() {
                return Ok(Delivery::Held(Wait::Working));
            }
            // A message that starts a turn opens its change record. One queued behind, or steered into,
            // a running turn opens none now, so the running turn's record is left alone.
            let boundary = if handoff == Handoff::Started {
                app.agent_runtime.record_turn_boundary(key, true)
            } else {
                Ok(())
            };
            if let Err(error) = boundary {
                return Ok(Delivery::NotSent(format!(
                    "could not record the turn's start: {error}"
                )));
            }
            // A steer goes the way `perch steer` does: Codex's `turn/steer` through the bridge, and
            // Claude's own prompt queue (the same verified write as a start, below).
            let reply = if handoff == Handoff::Steered && agent.agent_id != "claude" {
                bridge.enqueue_steer(delivery_id, prompt)
            } else {
                bridge.enqueue(delivery_id, Some(prompt))
            };
            let reply = match reply {
                Ok(reply) => reply,
                Err(error) => return Ok(Delivery::NotSent(error.to_string())),
            };
            Ok(match input {
                Some(input) => match crate::native_ui::claude::write_input(&input, write) {
                    Ok(()) => Delivery::Sent(reply, handoff),
                    Err(error) => Delivery::Failed(format!(
                        "writing it to the terminal failed part way: {error}"
                    )),
                },
                None => Delivery::Sent(reply, handoff),
            })
        });
    match outcome {
        Ok(Some(delivery)) => delivery,
        Ok(None) => Delivery::Held(Wait::RecentInput),
        Err(error) => Delivery::Held(Wait::Input(error.to_string())),
    }
}

/// Claude took a message steered into its running turn; whether its queue fed it into the turn is in
/// its transcript, as for `perch steer`. If it is not seen joining, the receipt says so (it stays
/// delivered: Claude holds it and will use it). Off the delivery loop, since it can take 25 s.
async fn check_joined(app: AppState, row: MailRow) {
    let Some((tab, _)) = AppWorld(&app).target_key(&row.target_session_id) else {
        return;
    };
    let Some(agent) = app.agent_runtime.bridge_key(&tab) else {
        return;
    };
    if agent.agent_id != "claude" || super::crew_actions::wait_absorbed(agent, row.id.clone()).await
    {
        return;
    }
    if app
        .db
        .note_delivered_mail(&row.id, super::crew_actions::NOT_JOINED)
        .is_ok()
    {
        notify_session_updated(&app, &row.target_session_id);
        notify_session_updated(&app, &row.sender_session_id);
    }
}

/// The delivery loop: a pass over every receiver with queued mail whenever something is queued
/// and every couple of seconds while anything waits. Cheap when the queue is empty.
pub(super) async fn run_deliveries(app: AppState) {
    // The receipt keeps only the latest reason a message waits; the log keeps each change of it, so
    // "why was this never delivered" can be answered after the fact.
    let mut last_wait = std::collections::HashMap::<String, String>::new();
    loop {
        tokio::select! {
            _ = app.mail_notify.notified() => {}
            _ = tokio::time::sleep(PASS_INTERVAL) => {}
        }
        let Ok(targets) = app.db.queued_mail_targets() else {
            continue;
        };
        last_wait.retain(|target, _| targets.contains(target));
        for target in targets {
            let worker = app.clone();
            let named = target.clone();
            let outcome = tokio::task::spawn_blocking(move || {
                pass(&worker.db, &AppWorld(&worker), &target, now_millis() as i64)
            })
            .await;
            if let Ok(Pass::Waiting(reason)) = &outcome {
                if last_wait.get(&named) != Some(reason) {
                    tracing::info!(receiver = %named, reason, "queued mail is waiting");
                    last_wait.insert(named, reason.clone());
                }
            }
            if let Ok(Pass::Sent { ids, reply }) = outcome {
                settle(&app.db, &ids, reply).await;
                // Receipts changed on both ends: the family strip follows session updates.
                for id in &ids {
                    if let Ok(Some(row)) = app.db.mail(id) {
                        notify_session_updated(&app, &row.target_session_id);
                        notify_session_updated(&app, &row.sender_session_id);
                        if row.state == MailState::Delivered && row.handoff == "steered" {
                            tokio::spawn(check_joined(app.clone(), row));
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent_identity::IdentityStore;
    use std::cell::{Cell, RefCell};

    /// A world with nothing real behind it: the receiver's facts and the outcome of a write are
    /// set by the test, and what was written is recorded.
    struct Fake {
        live: Live,
        facts: RefCell<TargetFacts>,
        outcome: RefCell<Option<Delivery>>,
        written: RefCell<Vec<String>>,
        files: RefCell<Vec<(String, String)>>,
        claims_refused: Cell<bool>,
    }

    impl Fake {
        fn idle(live: Live, is_lead: bool) -> Self {
            Self {
                live,
                facts: RefCell::new(TargetFacts {
                    alive: true,
                    reported: true,
                    idle: true,
                    is_lead,
                    ..Default::default()
                }),
                outcome: RefCell::new(None),
                written: RefCell::new(Vec::new()),
                files: RefCell::new(Vec::new()),
                claims_refused: Cell::new(false),
            }
        }
    }

    impl World for Fake {
        fn live(&self, _: &str) -> Live {
            self.live.clone()
        }
        fn facts(&self, _: &str) -> TargetFacts {
            self.facts.borrow().clone()
        }
        fn notes_file(&self, run: &str, name: &str, text: &str) -> anyhow::Result<String> {
            self.files.borrow_mut().push((name.into(), text.into()));
            Ok(format!("/notes/{run}/{name}"))
        }
        fn deliver(&self, _: &str, _: &str, prompt: &str, claim: &dyn Fn() -> bool) -> Delivery {
            if self.claims_refused.get() || !claim() {
                return Delivery::Held(Wait::Working);
            }
            self.written.borrow_mut().push(prompt.to_string());
            self.outcome.borrow_mut().take().unwrap_or_else(|| {
                let (tx, rx) = oneshot::channel();
                let _ = tx.send(Ok(true));
                let handoff = agent_mail::route(&self.facts.borrow()).unwrap_or(Handoff::Started);
                Delivery::Sent(rx, handoff)
            })
        }
    }

    struct Run {
        db: HistoryDb,
        lead_incarnation: String,
        child_incarnation: String,
    }

    fn run() -> Run {
        let db = HistoryDb::open(
            std::env::temp_dir().join(format!("perch-mail-engine-{}.sqlite", Uuid::new_v4())),
        )
        .unwrap();
        let (_, workspace) = db
            .create_project("local", "/tmp/perch-mail-engine-nest", Some("nest"), None)
            .unwrap();
        db.create_session_in_workspace("lead", &workspace, "/tmp/perch-mail-engine-nest")
            .unwrap();
        db.set_cli_provider("lead", "claude").unwrap();
        let lead = db
            .issue_in_current_run(&AgentKey::new(&workspace.id, "lead", "claude").unwrap())
            .unwrap();
        let reserved = db
            .reserve_sub_session(&crate::db::SubSessionSpec {
                child_session_id: "child",
                parent_session_id: "lead",
                parent_incarnation: &lead.incarnation,
                workspace: &workspace,
                cwd: "/tmp/perch-mail-engine-nest",
                provider_id: "codex",
                model: None,
                spawn_key: "k",
                task: "fix the parser",
            })
            .unwrap();
        assert!(matches!(reserved, crate::db::Reserved::New(_)));
        db.set_cli_provider("child", "codex").unwrap();
        let child = db
            .issue(&AgentKey::new(&workspace.id, "child", "codex").unwrap())
            .unwrap();
        Run {
            db,
            lead_incarnation: lead.incarnation,
            child_incarnation: child.incarnation,
        }
    }

    fn send(db: &HistoryDb, from: &str, to: &str, text: &str, key: &str) -> MailRow {
        let provider = if from == "lead" { "claude" } else { "codex" };
        match db
            .enqueue_message(&NewMail {
                sender_session_id: from,
                sender_provider: provider,
                sender_label: "label",
                target_session_id: to,
                target_provider: "codex",
                target_is_agent: true,
                body: text,
                key,
            })
            .unwrap()
        {
            Enqueued::New(row) => row,
            other => panic!("{other:?}"),
        }
    }

    fn state_of(db: &HistoryDb, id: &str) -> (MailState, String) {
        let row = db.mail(id).unwrap().unwrap();
        (row.state, row.reason)
    }

    #[test]
    fn a_legacy_leads_first_conversation_cannot_receive_old_reports_or_messages() {
        let run = run();
        assert_eq!(run.db.run_of("lead").unwrap().as_deref(), Some("lead"));
        let note = run
            .db
            .enqueue_note(
                ("child", "codex", "old child"),
                ("lead", "claude"),
                "old report",
            )
            .unwrap()
            .unwrap();
        let message = send(&run.db, "child", "lead", "old message", "old-key");
        // The process and its credential survive the upgrade; only the provider conversation
        // proves that this is a different family. Use the same incarnation for delivery below.
        run.db.observe_conversation("lead", "pi", "new-pi").unwrap();
        let world = Fake::idle(Live::Known(Some(run.lead_incarnation.clone())), true);
        assert!(matches!(pass(&run.db, &world, "lead", 0), Pass::Idle));
        assert!(world.written.borrow().is_empty());
        for id in [&note.id, &message.id] {
            assert_eq!(
                state_of(&run.db, id),
                (MailState::Undelivered, "its run ended".into())
            );
        }
        assert!(run
            .db
            .enqueue_note(
                ("child", "codex", "old child"),
                ("lead", "claude"),
                "late report",
            )
            .unwrap()
            .is_none());
        assert!(matches!(
            run.db
                .enqueue_message(&NewMail {
                    sender_session_id: "child",
                    sender_provider: "codex",
                    sender_label: "old child",
                    target_session_id: "lead",
                    target_provider: "pi",
                    target_is_agent: true,
                    body: "late message",
                    key: "late-key",
                })
                .unwrap(),
            Enqueued::Refused(agent_mail::SendRefusal::OtherRun)
        ));
        assert!(run.db.run_exists("lead").unwrap());
        assert!(run.db.sub_session("child").unwrap().is_some());
    }

    #[tokio::test]
    async fn an_idle_receiver_gets_one_message_and_the_receipt_waits_for_its_confirmation() {
        let run = run();
        let first = send(&run.db, "lead", "child", "do part one", "k1");
        let second = send(&run.db, "lead", "child", "then part two", "k2");
        let world = Fake::idle(Live::Known(Some(run.child_incarnation.clone())), false);
        let Pass::Sent { ids, reply } = pass(&run.db, &world, "child", 0) else {
            panic!("an idle receiver is delivered to");
        };
        // One message per delivery, the oldest first, claimed before it was written.
        assert_eq!(ids, vec![first.id.clone()]);
        assert_eq!(state_of(&run.db, &first.id).0, MailState::Delivering);
        assert_eq!(state_of(&run.db, &second.id).0, MailState::Queued);
        {
            let written = world.written.borrow();
            assert_eq!(written.len(), 1);
            assert!(
                written[0].starts_with("──── Perch message from claude \"label\" (session lead")
            );
            assert!(written[0].contains("> do part one") && !written[0].contains("part two"));
        }
        // Only the receiver's confirmation makes it delivered.
        settle(&run.db, &ids, reply).await;
        assert_eq!(state_of(&run.db, &first.id).0, MailState::Delivered);
        // The second goes on the next pass, once the receiver is idle again.
        assert!(matches!(
            pass(&run.db, &world, "child", 0),
            Pass::Sent { .. }
        ));
        assert_eq!(world.written.borrow().len(), 2);
    }

    #[tokio::test]
    async fn bytes_without_the_receivers_confirmation_are_unconfirmed_and_never_sent_again() {
        let run = run();
        let row = send(&run.db, "lead", "child", "hello", "k");
        let world = Fake::idle(Live::Known(Some(run.child_incarnation.clone())), false);
        let (tx, rx) = oneshot::channel::<Result<bool, String>>();
        *world.outcome.borrow_mut() = Some(Delivery::Sent(rx, Handoff::Started));
        drop(tx); // the bridge went away before it answered
        let Pass::Sent { ids, reply } = pass(&run.db, &world, "child", 0) else {
            panic!()
        };
        settle(&run.db, &ids, reply).await;
        let (state, reason) = state_of(&run.db, &row.id);
        assert_eq!(state, MailState::Unconfirmed);
        assert!(reason.contains("may have arrived"));
        // Nothing is queued, so nothing is written again.
        assert!(matches!(pass(&run.db, &world, "child", 0), Pass::Idle));
        assert_eq!(world.written.borrow().len(), 1);
        // A failure after the bytes started is unknown too.
        let second = send(&run.db, "lead", "child", "again", "k2");
        *world.outcome.borrow_mut() = Some(Delivery::Failed("write failed part way".into()));
        assert!(matches!(pass(&run.db, &world, "child", 0), Pass::Idle));
        assert_eq!(state_of(&run.db, &second.id).0, MailState::Unconfirmed);
    }

    #[test]
    fn a_failure_before_any_byte_puts_the_message_back_in_the_queue() {
        let run = run();
        let row = send(&run.db, "lead", "child", "hello", "k");
        let world = Fake::idle(Live::Known(Some(run.child_incarnation.clone())), false);
        *world.outcome.borrow_mut() = Some(Delivery::NotSent("its command queue is full".into()));
        assert!(matches!(
            pass(&run.db, &world, "child", 0),
            Pass::Waiting(_)
        ));
        assert_eq!(
            state_of(&run.db, &row.id),
            (MailState::Queued, "its command queue is full".into())
        );
    }

    // Owner decision 2026-11-08, Pi/OMP path: a busy receiver whose CLI has a follow-up queue gets the
    // message at once, and the receipt says it is queued in the agent.
    #[tokio::test]
    async fn a_busy_pi_gets_the_message_at_once_and_the_receipt_says_queued_in_the_agent() {
        let run = run();
        let row = send(&run.db, "lead", "child", "when you can", "k");
        let world = Fake::idle(Live::Known(Some(run.child_incarnation.clone())), false);
        *world.facts.borrow_mut() = TargetFacts {
            agent: "pi".into(),
            followup_queue: true,
            running: true,
            idle: false,
            alive: true,
            reported: true,
            ..Default::default()
        };
        let Pass::Sent { ids, reply } = pass(&run.db, &world, "child", 0) else {
            panic!("a busy receiver with a follow-up queue is delivered to at once");
        };
        settle(&run.db, &ids, reply).await;
        let delivered = run.db.mail(&row.id).unwrap().unwrap();
        assert_eq!(delivered.state, MailState::Delivered);
        assert_eq!(handoff_of(&delivered), "queued_in_agent");
        assert_eq!(mail_json(&delivered)["handoff"], "queued_in_agent");
    }

    // Codex (a busy start joins the running turn) and Claude (its queue feeds the running turn) have no
    // follow-up queue: a message that arrives during a turn is a steer into it (owner, same day), the
    // receipt says steered, and once idle it is a plain start.
    #[tokio::test]
    async fn a_busy_codex_or_claude_gets_the_message_as_a_steer_and_the_receipt_says_steered() {
        for agent in ["codex", "claude"] {
            let run = run();
            let row = send(&run.db, "lead", "child", "later", "k");
            let world = Fake::idle(Live::Known(Some(run.child_incarnation.clone())), false);
            *world.facts.borrow_mut() = TargetFacts {
                agent: agent.into(),
                followup_queue: false,
                running: true,
                alive: true,
                reported: true,
                ..Default::default()
            };
            let Pass::Sent { ids, reply } = pass(&run.db, &world, "child", 0) else {
                panic!("{agent} is steered at once");
            };
            settle(&run.db, &ids, reply).await;
            let delivered = run.db.mail(&row.id).unwrap().unwrap();
            assert_eq!(delivered.state, MailState::Delivered);
            assert_eq!(handoff_of(&delivered), "steered");
            assert_eq!(mail_json(&delivered)["handoff"], "steered");
            // A question or approval open still makes it wait, with the reason.
            let again = send(&run.db, "lead", "child", "more", "k2");
            world.facts.borrow_mut().request_open = true;
            let Pass::Waiting(reason) = pass(&run.db, &world, "child", 0) else {
                panic!("an open question holds a steer");
            };
            assert_eq!(state_of(&run.db, &again.id), (MailState::Queued, reason));
            // Its turn ended: now a plain start, with no handoff word.
            {
                let mut facts = world.facts.borrow_mut();
                facts.request_open = false;
                facts.running = false;
                facts.idle = true;
            }
            let Pass::Sent { ids, reply } = pass(&run.db, &world, "child", 0) else {
                panic!("idle now");
            };
            settle(&run.db, &ids, reply).await;
            let delivered = run.db.mail(&again.id).unwrap().unwrap();
            assert_eq!(
                (delivered.state, handoff_of(&delivered)),
                (MailState::Delivered, "")
            );
        }
    }

    // A CLI Perch cannot steer keeps the idle wait, and the receipt says so.
    #[test]
    fn a_busy_receiver_perch_cannot_steer_keeps_the_idle_wait() {
        let run = run();
        let row = send(&run.db, "lead", "child", "later", "k");
        let world = Fake::idle(Live::Known(Some(run.child_incarnation.clone())), false);
        *world.facts.borrow_mut() = TargetFacts {
            agent: "opencode".into(),
            running: true,
            alive: true,
            reported: true,
            ..Default::default()
        };
        let Pass::Waiting(reason) = pass(&run.db, &world, "child", 0) else {
            panic!("it must wait for idle");
        };
        assert!(reason.contains("when its turn ends"), "{reason}");
        assert!(world.written.borrow().is_empty());
        assert_eq!(state_of(&run.db, &row.id), (MailState::Queued, reason));
    }

    #[test]
    fn a_steer_receipt_reads_steered_only_once_delivered() {
        let run = run();
        let mut row = send(&run.db, "lead", "child", "x", "k");
        assert_eq!(handoff_of(&row), "");
        row.kind = MailKind::Steer;
        assert_eq!(handoff_of(&row), "", "not delivered yet");
        row.state = MailState::Delivered;
        assert_eq!(handoff_of(&row), "steered");
    }

    #[test]
    fn nothing_is_written_while_the_receiver_is_not_provably_idle() {
        let run = run();
        let row = send(&run.db, "lead", "child", "hello", "k");
        let world = Fake::idle(Live::Known(Some(run.child_incarnation.clone())), false);
        type Change = fn(&mut TargetFacts);
        let cases: [(Change, &str); 5] = [
            (|f| f.running = true, "working"),
            (|f| f.blocked = true, "waiting on a person"),
            (|f| f.request_open = true, "waiting on a person"),
            (|f| f.reported = false, "not reported"),
            (|f| f.alive = false, "not running"),
        ];
        for (change, expect) in cases {
            *world.facts.borrow_mut() = Fake::idle(Live::Unreadable, false).facts.take();
            change(&mut world.facts.borrow_mut());
            let Pass::Waiting(reason) = pass(&run.db, &world, "child", 0) else {
                panic!("{expect}");
            };
            assert!(reason.contains(expect), "{reason}");
            let (state, shown) = state_of(&run.db, &row.id);
            assert_eq!((state, shown.contains(expect)), (MailState::Queued, true));
        }
        assert!(
            world.written.borrow().is_empty(),
            "no byte reached the receiver"
        );
        // A refused claim (another pass holds it) writes nothing and leaves it queued.
        *world.facts.borrow_mut() = Fake::idle(Live::Unreadable, false).facts.take();
        world.claims_refused.set(true);
        assert!(matches!(
            pass(&run.db, &world, "child", 0),
            Pass::Waiting(_)
        ));
        assert!(world.written.borrow().is_empty());
        assert_eq!(state_of(&run.db, &row.id).0, MailState::Queued);
    }

    // Orca: mail whose owner ended is withdrawn, never delivered; a fact that cannot be read holds it.
    #[test]
    fn mail_for_an_ended_or_replaced_receiver_is_undelivered_and_an_unreadable_one_is_held() {
        let run = run();
        let row = send(&run.db, "lead", "child", "hello", "k");
        let ended = Fake::idle(Live::Known(None), false);
        assert!(matches!(pass(&run.db, &ended, "child", 0), Pass::Idle));
        let (state, reason) = state_of(&run.db, &row.id);
        assert_eq!(state, MailState::Undelivered);
        assert!(reason.contains("ended"), "{reason}");
        assert!(ended.written.borrow().is_empty());

        let replaced_row = send(&run.db, "lead", "child", "hello", "k2");
        let replaced = Fake::idle(Live::Known(Some("a-later-run".into())), false);
        assert!(matches!(pass(&run.db, &replaced, "child", 0), Pass::Idle));
        let (state, reason) = state_of(&run.db, &replaced_row.id);
        assert_eq!(state, MailState::Undelivered);
        assert!(reason.contains("previous run"), "{reason}");
        assert!(
            replaced.written.borrow().is_empty(),
            "never handed to a later launch"
        );

        let held_row = send(&run.db, "lead", "child", "hello", "k3");
        let unreadable = Fake::idle(Live::Unreadable, false);
        assert!(matches!(
            pass(&run.db, &unreadable, "child", 0),
            Pass::Waiting(_)
        ));
        assert_eq!(state_of(&run.db, &held_row.id).0, MailState::Queued);
        assert!(unreadable.written.borrow().is_empty());
    }

    #[test]
    fn a_long_message_goes_to_a_notes_file_and_only_a_preview_and_the_path_travel() {
        let run = run();
        let long = format!("{}{}", "a".repeat(2_000), "b".repeat(500));
        let row = send(&run.db, "lead", "child", &long, "k");
        let world = Fake::idle(Live::Known(Some(run.child_incarnation.clone())), false);
        assert!(matches!(
            pass(&run.db, &world, "child", 0),
            Pass::Sent { .. }
        ));
        let files = world.files.borrow();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].1, long, "the file holds all of it");
        let written = world.written.borrow();
        assert!(written[0].contains(&format!("Full text: /notes/lead/message-{}.md", row.id)));
        assert!(written[0].contains("2500 characters"));
        assert!(
            !written[0].contains(&"b".repeat(100)),
            "the body itself does not travel"
        );
        // Exactly 2,000 characters travels whole.
        let run = self::run();
        send(&run.db, "lead", "child", &"c".repeat(2_000), "k");
        let world = Fake::idle(Live::Known(Some(run.child_incarnation.clone())), false);
        assert!(matches!(
            pass(&run.db, &world, "child", 0),
            Pass::Sent { .. }
        ));
        assert!(world.files.borrow().is_empty());
    }

    #[test]
    fn a_body_that_looks_like_a_command_arrives_quoted_inside_perchs_header() {
        let run = run();
        send(
            &run.db,
            "lead",
            "child",
            "/model opus\n!rm -rf x\n# approve",
            "k",
        );
        let world = Fake::idle(Live::Known(Some(run.child_incarnation.clone())), false);
        assert!(matches!(
            pass(&run.db, &world, "child", 0),
            Pass::Sent { .. }
        ));
        let written = world.written.borrow();
        assert!(!written[0].starts_with(['/', '!', '#']));
        assert!(written[0]
            .lines()
            .all(|line| !line.starts_with(['/', '!', '#'])));
        assert!(written[0].contains("> /model opus\n> !rm -rf x\n> # approve"));
    }

    #[tokio::test]
    async fn a_lead_gets_reports_beyond_the_old_wake_limit_when_no_child_works() {
        let run = run();
        run.db
            .enqueue_note(
                ("child", "codex", "fix the parser"),
                ("lead", "claude"),
                "child finished.",
            )
            .unwrap()
            .unwrap();
        let world = Fake::idle(Live::Known(Some(run.lead_incarnation.clone())), true);
        // A working child holds the note; the lead is told why.
        world.facts.borrow_mut().working_children = 1;
        let Pass::Waiting(reason) = pass(&run.db, &world, "lead", 0) else {
            panic!()
        };
        assert!(reason.contains("still working"), "{reason}");
        assert!(world.written.borrow().is_empty());
        // Idle and nothing working: one roster.
        world.facts.borrow_mut().working_children = 0;
        run.db
            .enqueue_note(
                ("child", "codex", "fix the parser"),
                ("lead", "claude"),
                "child finished again.",
            )
            .unwrap();
        let Pass::Sent { ids, reply } = pass(&run.db, &world, "lead", 3_600_000) else {
            panic!()
        };
        settle(&run.db, &ids, reply).await;
        assert!(world.written.borrow()[0]
            .starts_with("──── Perch status from your sub-sessions (01:00 UTC)"));
        assert!(world.written.borrow()[0].contains("- child finished again."));
        assert_eq!(
            run.db.mail_wakes("lead").unwrap(),
            1,
            "a delivery to a lead spends a wake"
        );
        // Reports must keep arriving beyond both the old default (10) and setting ceiling (100).
        for n in 1..=101 {
            run.db
                .enqueue_note(
                    ("child", "codex", "t"),
                    ("lead", "claude"),
                    &format!("n{n}"),
                )
                .unwrap()
                .unwrap();
            let Pass::Sent { ids, reply } = pass(&run.db, &world, "lead", 0) else {
                panic!("wake {n}")
            };
            settle(&run.db, &ids, reply).await;
        }
        assert_eq!(world.written.borrow().len(), 102);
        assert!(run.db.queued_mail_for("lead").unwrap().is_empty());
    }

    #[tokio::test]
    async fn legacy_wake_settings_and_counts_do_not_restrict_reports() {
        let run = run();
        run.db.set_limits(crate::sub_sessions::RunLimits {
            wakes: 1,
            ..Default::default()
        });
        // Existing runs keep their historical count; it must not hold new reports.
        for _ in 0..100 {
            run.db.spend_mail_wake("lead").unwrap();
        }
        let world = Fake::idle(Live::Known(Some(run.lead_incarnation.clone())), true);
        let note = run
            .db
            .enqueue_note(("child", "codex", "t"), ("lead", "claude"), "new report")
            .unwrap()
            .unwrap();
        let Pass::Sent { ids, reply } = pass(&run.db, &world, "lead", 0) else {
            panic!("legacy wake settings must not block reports")
        };
        settle(&run.db, &ids, reply).await;
        assert_eq!(state_of(&run.db, &note.id).0, MailState::Delivered);
    }

    #[test]
    fn a_message_to_a_child_spends_no_wake() {
        let run = run();
        send(&run.db, "lead", "child", "hello", "k");
        let world = Fake::idle(Live::Known(Some(run.child_incarnation.clone())), false);
        assert!(matches!(
            pass(&run.db, &world, "child", 0),
            Pass::Sent { .. }
        ));
        assert_eq!(run.db.mail_wakes("child").unwrap(), 0);
        assert_eq!(run.db.mail_wakes("lead").unwrap(), 0);
    }

    fn person_message(run: &Run, to: &str, text: &str, key: &str) -> MailRow {
        let new = NewMail {
            sender_session_id: "ignored",
            sender_provider: "ignored",
            sender_label: "ignored",
            target_session_id: to,
            target_provider: "codex",
            target_is_agent: true,
            body: text,
            key,
        };
        match run.db.record_person_mail(&new, MailKind::Message).unwrap() {
            Enqueued::New(row) => row,
            other => panic!("{other:?}"),
        }
    }

    /// What a person wrote from the family strip reaches the child as theirs: the header names the
    /// person, not an agent, and still opens with Perch's rule line so a leading `/` is no command;
    /// the body is their own words, unquoted. It queues like any message and waits like one.
    #[test]
    fn a_persons_message_is_headed_as_theirs_and_waits_for_idle_like_any_other() {
        let run = run();
        let row = person_message(&run, "child", "/clear\nstart with the lexer", "p1");
        let working = Fake::idle(Live::Known(Some(run.child_incarnation.clone())), false);
        working.facts.borrow_mut().running = true;
        assert!(matches!(
            pass(&run.db, &working, "child", 0),
            Pass::Waiting(_)
        ));
        assert!(working.written.borrow().is_empty(), "never into a turn");
        assert_eq!(state_of(&run.db, &row.id).0, MailState::Queued);
        let idle = Fake::idle(Live::Known(Some(run.child_incarnation.clone())), false);
        assert!(matches!(
            pass(&run.db, &idle, "child", 0),
            Pass::Sent { .. }
        ));
        let written = idle.written.borrow();
        assert!(
            written[0].starts_with("──── Perch message from the person using this Perch session")
        );
        assert!(written[0].contains("not from another agent"));
        assert!(
            written[0].contains("\n/clear\nstart with the lexer\n"),
            "the person's words, unquoted"
        );
        assert!(!written[0].contains("> /clear"));
        assert!(
            !written[0].contains("perch send"),
            "there is no peer to reply to"
        );
    }

    /// A person's message is not included in the historical automatic-delivery count.
    #[test]
    fn a_persons_message_spends_no_wake() {
        let run = run();
        person_message(&run, "lead", "how is it going", "p1");
        let world = Fake::idle(Live::Known(Some(run.lead_incarnation.clone())), true);
        assert!(matches!(
            pass(&run.db, &world, "lead", 0),
            Pass::Sent { .. }
        ));
        assert_eq!(run.db.mail_wakes("lead").unwrap(), 0);
        send(&run.db, "child", "lead", "agent text", "k");
        let again = Fake::idle(Live::Known(Some(run.lead_incarnation.clone())), true);
        assert!(matches!(
            pass(&run.db, &again, "lead", 0),
            Pass::Sent { .. }
        ));
        assert_eq!(
            run.db.mail_wakes("lead").unwrap(),
            1,
            "an agent's still spends one"
        );
    }

    /// A lead hears of a child through the child's own `perch report` and nothing else.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_report_notes_the_lead_and_nothing_else_does() {
        use super::super::agent::tests::request;
        use super::super::sub_sessions::tests::{boot, lead_with_child};
        let root = std::env::temp_dir().join(format!("perch-mail-report-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let (address, db) = boot(&root).await;
        let (workspace, _) = lead_with_child(&db, &nest, SubState::Running);
        db.issue_in_current_run(&AgentKey::new(&workspace.id, "lead", "claude").unwrap())
            .unwrap();
        let child = db
            .issue(&AgentKey::new(&workspace.id, "child", "codex").unwrap())
            .unwrap();
        assert!(db.mail_to("lead", 10).unwrap().is_empty());
        let (status, body) = request(
            address,
            "POST",
            "/agent/report",
            &[("Authorization", &format!("Bearer {}", child.token))],
            &json!({"session": "child", "text": "parser fixed"}).to_string(),
        )
        .await;
        assert_eq!(status, 200, "{body}");
        let notes = db.mail_to("lead", 10).unwrap();
        assert_eq!(notes.len(), 1);
        assert!(notes[0].body.contains("parser fixed"), "{}", notes[0].body);
    }

    /// `send`, `inbox` and `cancel` over real HTTP against a booted core, up to the point of
    /// writing to an agent: who may send to whom, what is queued and why it waits, what a retry or a
    /// cancel does. The receiver is not running, so the live loop leaves everything queued.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn send_inbox_and_cancel_enforce_their_rules_over_http() {
        use super::super::agent::tests::request;
        use super::super::sub_sessions::tests::{boot, lead_with_child};
        let root = std::env::temp_dir().join(format!("perch-mail-http-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let (address, db) = boot(&root).await;
        let (workspace, _) = lead_with_child(&db, &nest, SubState::Running);
        let lead = db
            .issue_in_current_run(&AgentKey::new(&workspace.id, "lead", "claude").unwrap())
            .unwrap();
        let child = db
            .issue(&AgentKey::new(&workspace.id, "child", "codex").unwrap())
            .unwrap();
        // Another run, and a terminal in this one.
        db.create_session_in_workspace("other", &workspace, &nest.to_string_lossy())
            .unwrap();
        db.set_cli_provider("other", "claude").unwrap();
        db.issue(&AgentKey::new(&workspace.id, "other", "claude").unwrap())
            .unwrap();
        db.create_session_in_workspace("shell", &workspace, &nest.to_string_lossy())
            .unwrap();
        let call = |route: &'static str, token: String, body: Value| async move {
            request(
                address,
                "POST",
                &format!("/agent/{route}"),
                &[("Authorization", &format!("Bearer {token}"))],
                &body.to_string(),
            )
            .await
        };
        let send_body = |from: &str, to: &str, text: &str, key: &str| json!({"session": from, "target": to, "text": text, "key": key});

        // The whole run shares one notes folder, named by its lead, and `whoami` says where it is.
        for (token, session) in [(&lead.token, "lead"), (&child.token, "child")] {
            let (status, who) = call("whoami", token.clone(), json!({ "session": session })).await;
            assert_eq!(status, 200, "{who}");
            assert!(
                who["notes"]
                    .as_str()
                    .is_some_and(|path| path.ends_with("/notes/lead")),
                "{who}"
            );
        }

        // Refused before anything is queued, each with what to do instead.
        for (token, body, status, expect) in [
            (
                &lead.token,
                send_body("lead", "lead", "hi", "a"),
                400,
                "yourself",
            ),
            (
                &lead.token,
                send_body("lead", "child", " ", "a"),
                400,
                "text",
            ),
            (
                &lead.token,
                send_body("lead", "child", "hi", "a b"),
                400,
                "key",
            ),
            (
                &lead.token,
                send_body("lead", "other", "hi", "a"),
                403,
                "not in your run",
            ),
            (
                &lead.token,
                send_body("lead", "nobody", "hi", "a"),
                403,
                "not in your run",
            ),
            (
                &lead.token,
                send_body("lead", "shell", "hi", "a"),
                403,
                "not in your run",
            ),
        ] {
            let (got, answer) = call("send", token.clone(), body).await;
            assert_eq!(got, status, "{answer}");
            assert!(
                answer["error"].as_str().unwrap().contains(expect),
                "{answer}"
            );
        }
        assert!(db.mail_from("lead", 10).unwrap().is_empty());

        // A message to a child is queued, and the same key again returns it instead of a second.
        let (status, first) = call(
            "send",
            lead.token.clone(),
            send_body("lead", "child", "start with the lexer", "k1"),
        )
        .await;
        assert_eq!(status, 200, "{first}");
        assert_eq!(
            (first["state"].as_str(), first["duplicate"].as_bool()),
            (Some("queued"), Some(false))
        );
        let (_, again) = call(
            "send",
            lead.token.clone(),
            send_body("lead", "child", "a different text", "k1"),
        )
        .await;
        assert_eq!(again["id"], first["id"]);
        assert_eq!(again["duplicate"], true);
        assert_eq!(db.mail_from("lead", 10).unwrap().len(), 1);

        // A child may message its lead, and a stranger sees none of it.
        let (status, up) = call(
            "send",
            child.token.clone(),
            send_body("child", "lead", "which lexer?", "k1"),
        )
        .await;
        assert_eq!(status, 200, "{up}");

        // The inbox is the caller's own, with receipts, and reading it consumes nothing.
        for _ in 0..2 {
            let (status, inbox) =
                call("inbox", child.token.clone(), json!({"session": "child"})).await;
            assert_eq!(status, 200, "{inbox}");
            let received = inbox["received"].as_array().unwrap();
            assert_eq!(received.len(), 1, "{inbox}");
            assert_eq!(received[0]["text"], "start with the lexer");
            assert_eq!(received[0]["state"], "queued");
            assert_eq!(received[0]["from"], "lead");
            let sent = inbox["sent"].as_array().unwrap();
            assert_eq!(sent.len(), 1);
            assert_eq!(sent[0]["to"], "lead");
        }
        let (_, other) = call("inbox", "nope".into(), json!({"session": "other"})).await;
        assert!(other["error"].is_string(), "an unknown token reads nothing");

        // Only the sender takes a message back, and only while it waits.
        let id = first["id"].as_str().unwrap().to_string();
        let (status, _) = call(
            "cancel",
            child.token.clone(),
            json!({"session": "child", "message": id}),
        )
        .await;
        assert_eq!(status, 404, "the receiver cannot cancel it");
        let (status, _) = call("cancel", lead.token.clone(), json!({"session": "lead"})).await;
        assert_eq!(status, 400);
        let (status, answer) = call(
            "cancel",
            lead.token.clone(),
            json!({"session": "lead", "message": id}),
        )
        .await;
        assert_eq!(
            (status, answer["state"].as_str()),
            (200, Some("undelivered")),
            "{answer}"
        );
        assert_eq!(
            db.mail(&id).unwrap().unwrap().reason,
            "cancelled by its sender"
        );
        let (status, _) = call(
            "cancel",
            lead.token.clone(),
            json!({"session": "lead", "message": id}),
        )
        .await;
        assert_eq!(status, 409, "already settled");
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn a_run_whose_lead_is_gone_delivers_nothing() {
        let run = run();
        let row = send(&run.db, "lead", "child", "hello", "k");
        // The lead's row goes without the DB's own cleanup (a race the engine still survives).
        run.db.remove_session_row_only("lead");
        let world = Fake::idle(Live::Known(Some(run.child_incarnation.clone())), false);
        assert!(matches!(pass(&run.db, &world, "child", 0), Pass::Idle));
        let (state, reason) = state_of(&run.db, &row.id);
        assert_eq!(
            (state, reason.contains("run ended")),
            (MailState::Undelivered, true)
        );
        assert!(world.written.borrow().is_empty());
    }
}
