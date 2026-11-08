//! The family strip's actions on a child (`crew.act`, and a lead's `perch steer` / `perch interrupt`
//! on `/agent/steer` and `/agent/interrupt`): Message, Steer, Interrupt and Stop. Own design,
//! slice 7; the rules are `crate::crew_actions`, the contract ARCHITECTURE ("Family strip actions").
//!
//! Every action goes through [`run`], whoever asks. It looks the child up under the lead (a person
//! acts for the lead whose chat shows the strip; an agent only as that lead), reads the child's facts
//! again, applies `crew_actions::availability` and then, under the same locks mail delivery uses
//! (`agent_operation_lock` and `dispatch_under_current_lease`), re-checks and hands the action to the
//! provider's own mechanism. Nothing is retried: a steer or an interrupt that is not confirmed is
//! reported as such and left alone, because it may have taken effect.
//!
//! - **Message** (a person only): the slice 5 queue with the person as sender (`record_person_mail`);
//!   delivery is `server/agent_mail.rs`'s (at once; a busy Pi/OMP queues it), and spends no wake.
//! - **Steer**: a `steer` row (claimed as it is sent) for the receipt and the run's limit; Codex
//!   `turn/steer`, Pi and OMP `deliverAs: "steer"` through the bridge; Claude through its own prompt
//!   queue, written under the 2 s quiet window into a verified empty prompt, confirmed by its
//!   `UserPromptSubmit` hook and then by the transcript showing the text joined the running turn.
//! - **Interrupt**: the chat's Stop path (`native_ui::queue_cancel`), confirmed by the bridge's answer
//!   and then by the provider reporting its turn over.
//! - **Stop**: `sub_sessions::stop_child`, confirmed by perchd.
use super::agent_mail::sender_label;
use super::sub_sessions::{fail, internal, key_of, reconcile, stop_child, Failure};
use super::*;
use crate::agent_fleet::{AgentState, ClientIdentity, ClientKind};
use crate::agent_mail::{self, BodyText, MailKind, MailState, Sender};
use crate::crew_actions::{self, Action, Actor, ChildFacts, Outcome};
use crate::db::{Enqueued, NewMail, SubSessionRow};
use crate::protocol::{CrewActionState, CrewActions};
use std::time::Duration;
use tokio::sync::oneshot;

/// How long the provider's own answer is waited for.
const ANSWER: Duration = Duration::from_secs(10);
/// How long a Claude steer is given to show in the transcript once Claude took it. Claude feeds queued
/// text into the turn at its next step, so a long tool call (seen live: a 12 s `sleep`) delays it.
const ABSORB: Duration = Duration::from_secs(25);
/// A steer into Claude's prompt needs the terminal quiet, like a delivered message.
const QUIET: Duration = Duration::from_secs(2);

/// What was asked.
pub(super) struct Request {
    pub action: Action,
    pub text: Option<String>,
    /// Names the action so a retry of the same request does nothing twice.
    pub key: String,
}

/// How an action ended, as the receipt.
pub(super) struct Done {
    pub outcome: Outcome,
    pub reason: String,
    /// The message or steer row, when there is one.
    pub id: String,
    pub duplicate: bool,
}

impl Done {
    fn new(outcome: Outcome, reason: impl Into<String>) -> Self {
        Self {
            outcome,
            reason: reason.into(),
            id: String::new(),
            duplicate: false,
        }
    }
}

/// What the blocking half of an action leaves for the half that waits for the provider.
enum Prepared {
    Done(Done),
    Steer {
        id: String,
        reply: oneshot::Receiver<Result<bool, String>>,
        /// Set for Claude, whose steer is also checked against the transcript.
        claude: Option<AgentKey>,
    },
    Interrupt {
        id: String,
        reply: oneshot::Receiver<Result<bool, String>>,
        bridge: Arc<crate::native_ui::NativeBridge>,
    },
}

fn service_client() -> Result<ClientIdentity, Failure> {
    ClientIdentity::new("crew-actions", "perch-core", ClientKind::Service)
        .map_err(|error| internal("name the strip's actions", error))
}

/// What the core reads about a child before it acts.
pub(super) fn child_facts(app: &AppState, row: &SubSessionRow) -> ChildFacts {
    let key = key_of(app, &row.child_session_id, &row.provider_id).ok();
    let snapshot = key
        .as_ref()
        .and_then(|key| app.native_bridge(key))
        .and_then(|bridge| bridge.latest());
    // The agent on screen decides what can be done to it (a tab started as Claude may run `pi` now).
    let provider = key
        .as_ref()
        .and_then(|key| app.agent_runtime.bridge_key(key))
        .map_or_else(|| row.provider_id.clone(), |agent| agent.agent_id);
    let lifecycle = key
        .as_ref()
        .and_then(|key| app.agent_runtime.snapshot(key).ok())
        .map(|snapshot| snapshot.state);
    ChildFacts {
        provider,
        dispatch: row.state,
        alive: app
            .db
            .live_incarnation(&row.child_session_id)
            .ok()
            .flatten()
            .is_some()
            && key
                .as_ref()
                .is_some_and(|key| app.agent_runtime.runtime_alive(key)),
        reported: snapshot.is_some(),
        running: snapshot.as_ref().is_some_and(|snapshot| snapshot.running),
        // Perch's own evidence that a person is wanted, never the agent's word.
        blocked: lifecycle == Some(AgentState::Blocked)
            || snapshot
                .as_ref()
                .is_some_and(|snapshot| snapshot.blocked || snapshot.request.is_some()),
        // A count that cannot be read counts as spent.
        lead_interrupts: app
            .db
            .lead_interrupts(&row.child_session_id)
            .unwrap_or(u32::MAX),
        max_interrupts: app.db.limits().interrupts,
    }
}

/// The four actions as a person is offered them, for a row of the strip.
pub(super) fn offered(app: &AppState, child_session_id: &str) -> Option<CrewActions> {
    let row = app.db.sub_session(child_session_id).ok().flatten()?;
    let state = reconcile(app, &row);
    let facts = child_facts(app, &SubSessionRow { state, ..row });
    let state_of = |action| match crew_actions::availability(action, Actor::Person, &facts) {
        Ok(()) => CrewActionState {
            ok: true,
            reason: String::new(),
        },
        Err(reason) => CrewActionState { ok: false, reason },
    };
    Some(CrewActions {
        message: state_of(Action::Message),
        steer: state_of(Action::Steer),
        interrupt: state_of(Action::Interrupt),
        stop: state_of(Action::Stop),
    })
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

/// Run one action on `child`, a sub-session of `lead`. `progress` hears `sent` once the provider has
/// been handed a steer or an interrupt and its answer is awaited. `Err` is a refusal: nothing was done.
pub(super) async fn run(
    app: &AppState,
    actor: Actor,
    lead: &str,
    child: &str,
    request: Request,
    progress: impl Fn(Outcome, &str),
) -> Result<Done, Failure> {
    let worker = app.clone();
    let (lead, child_id) = (lead.to_string(), child.to_string());
    let prepared =
        tokio::task::spawn_blocking(move || prepare(&worker, actor, &lead, &child_id, &request))
            .await
            .map_err(|error| internal("run the action", error))??;
    match prepared {
        Prepared::Done(done) => Ok(done),
        Prepared::Steer { id, reply, claude } => {
            progress(Outcome::Sent, "");
            Ok(confirm_steer(app, id, reply, claude).await)
        }
        Prepared::Interrupt { id, reply, bridge } => {
            progress(Outcome::Sent, "");
            let mut done = confirm_interrupt(reply, &bridge).await;
            done.id = id;
            Ok(done)
        }
    }
}

fn prepare(
    app: &AppState,
    actor: Actor,
    lead: &str,
    child: &str,
    request: &Request,
) -> Result<Prepared, Failure> {
    let row = app
        .db
        .sub_session(child)
        .map_err(|error| internal("read the sub-session", error))?
        .filter(|row| row.parent_session_id == lead)
        .ok_or_else(|| {
            fail(
                StatusCode::NOT_FOUND,
                "that is not one of your sub-sessions",
            )
        })?;
    let row = SubSessionRow {
        state: reconcile(app, &row),
        ..row
    };
    crew_actions::availability(request.action, actor, &child_facts(app, &row))
        .map_err(|why| fail(StatusCode::CONFLICT, why))?;
    match request.action {
        Action::Stop => Ok(Prepared::Done(match stop_child(app, &row) {
            Ok(_) => Done::new(Outcome::Confirmed, "stopped"),
            // Not confirmed is the answer, not a refusal: the record says so too.
            Err((StatusCode::BAD_GATEWAY, why)) => Done::new(Outcome::NotConfirmed, why),
            Err(refused) => return Err(refused),
        })),
        Action::Message => {
            if actor != Actor::Person {
                return Err(fail(
                    StatusCode::FORBIDDEN,
                    "a lead sends a message with `perch send`",
                ));
            }
            message(app, lead, &row, request)
        }
        Action::Steer => steer(app, actor, lead, &row, request),
        Action::Interrupt => interrupt(app, actor, lead, &row),
    }
}

fn bad(text: String) -> Failure {
    fail(StatusCode::BAD_REQUEST, text)
}

fn message(
    app: &AppState,
    lead: &str,
    row: &SubSessionRow,
    request: &Request,
) -> Result<Prepared, Failure> {
    let text = agent_mail::check_body(request.text.as_deref().unwrap_or_default()).map_err(bad)?;
    let key = agent_mail::check_key(&request.key).map_err(bad)?;
    let new = NewMail {
        sender_session_id: crew_actions::PERSON,
        sender_provider: crew_actions::PERSON,
        sender_label: crew_actions::PERSON,
        target_session_id: &row.child_session_id,
        target_provider: &row.provider_id,
        target_is_agent: true,
        body: text,
        key,
    };
    let (mail, duplicate) = match app
        .db
        .record_person_mail(&new, MailKind::Message)
        .map_err(|error| internal("queue the message", error))?
    {
        Enqueued::New(mail) => (mail, false),
        Enqueued::Existing(mail) => (mail, true),
        Enqueued::Refused(refusal) => {
            return Err(fail(refusal_status(&refusal), refusal.message()));
        }
    };
    app.mail_notify.notify_one();
    notify_session_updated(app, &row.child_session_id);
    notify_session_updated(app, lead);
    Ok(Prepared::Done(Done {
        outcome: Outcome::Queued,
        reason: mail.reason,
        id: mail.id,
        duplicate,
    }))
}

fn steer(
    app: &AppState,
    actor: Actor,
    lead: &str,
    row: &SubSessionRow,
    request: &Request,
) -> Result<Prepared, Failure> {
    let text =
        crew_actions::check_steer_text(request.text.as_deref().unwrap_or_default()).map_err(bad)?;
    let key = agent_mail::check_key(&request.key).map_err(bad)?;
    let agent_key = key_of(app, &row.child_session_id, &row.provider_id)?;
    // The agent on screen, which may not be the one the tab was started with.
    let agent = app.agent_runtime.bridge_key(&agent_key).ok_or_else(|| {
        fail(
            StatusCode::CONFLICT,
            "its agent is no longer running in that tab, so Perch cannot reach it",
        )
    })?;
    let bridge = app.native_ui.get(&agent).ok_or_else(|| {
        fail(
            StatusCode::CONFLICT,
            "its native connection is not up, so Perch cannot reach it",
        )
    })?;
    let claude = agent.agent_id == "claude";
    let lead_provider = app
        .db
        .get_session(lead)
        .ok()
        .flatten()
        .and_then(|session| session.cli_provider_id)
        .unwrap_or_default();
    let label = sender_label(app, lead, &lead_provider);
    let client = service_client()?;
    // The lock mail delivery and Context Bridge hold: no delete, stop or delivery interleaves.
    let _operation = app.agent_operation_lock.lock().unwrap();
    let outcome = app.agent_runtime.dispatch_under_current_lease(
        &agent_key,
        &client,
        // Only Claude's steer is typed into the terminal, so only it waits for a quiet one.
        if claude { QUIET } else { Duration::ZERO },
        |write| -> anyhow::Result<Result<Prepared, Failure>> {
            // Looked at again under the lock: what was true a moment ago may not be.
            if let Err(why) =
                crew_actions::availability(Action::Steer, actor, &child_facts(app, row))
            {
                return Ok(Err(fail(StatusCode::CONFLICT, why)));
            }
            if app.agent_runtime.bridge_key(&agent_key).as_ref() != Some(&agent) {
                return Ok(Err(fail(
                    StatusCode::CONFLICT,
                    "the agent in that tab changed; try again",
                )));
            }
            if claude {
                if let Err(error) = crate::native_ui::claude::prepare_input(&agent, Some(text)) {
                    return Ok(Err(fail(StatusCode::CONFLICT, error.to_string())));
                }
            }
            let new = NewMail {
                sender_session_id: lead,
                sender_provider: &lead_provider,
                sender_label: &label,
                target_session_id: &row.child_session_id,
                target_provider: &row.provider_id,
                target_is_agent: true,
                body: text,
                key,
            };
            let recorded = match actor {
                Actor::Lead => app.db.record_steer(&new)?,
                Actor::Person => app.db.record_person_mail(&new, MailKind::Steer)?,
            };
            let mail = match recorded {
                Enqueued::New(mail) => mail,
                // The same request again: what it came to, and nothing is sent twice.
                Enqueued::Existing(mail) => {
                    let outcome = if mail.state == MailState::Delivered {
                        Outcome::Confirmed
                    } else {
                        Outcome::NotConfirmed
                    };
                    return Ok(Ok(Prepared::Done(Done {
                        outcome,
                        reason: mail.reason,
                        id: mail.id,
                        duplicate: true,
                    })));
                }
                Enqueued::Refused(refusal) => {
                    return Ok(Err(fail(refusal_status(&refusal), refusal.message())));
                }
            };
            let prompt = steer_prompt(actor, &mail, &lead_provider, &label, lead);
            let nothing_sent = |why: String| {
                let _ = app.db.void_claimed_mail(&mail.id, &why);
                Ok(Err(fail(StatusCode::CONFLICT, why)))
            };
            let input = if claude {
                match crate::native_ui::claude::prepare_input(&agent, Some(&prompt)) {
                    Ok(input) => input,
                    Err(error) => return nothing_sent(error.to_string()),
                }
            } else {
                None
            };
            let reply = if claude {
                bridge.enqueue(&mail.id, Some(&prompt))
            } else {
                bridge.enqueue_steer(&mail.id, &prompt)
            };
            let reply = match reply {
                Ok(reply) => reply,
                Err(error) => return nothing_sent(error.to_string()),
            };
            if let Some(input) = input {
                if let Err(error) = crate::native_ui::claude::write_input(&input, write) {
                    let why = format!("writing it to the terminal failed part way: {error}");
                    let _ = app.db.settle_mail(
                        std::slice::from_ref(&mail.id),
                        MailState::Unconfirmed,
                        &why,
                    );
                    return Ok(Ok(Prepared::Done(Done {
                        outcome: Outcome::NotConfirmed,
                        reason: why,
                        id: mail.id,
                        duplicate: false,
                    })));
                }
            }
            Ok(Ok(Prepared::Steer {
                id: mail.id,
                reply,
                claude: claude.then(|| agent.clone()),
            }))
        },
    );
    match outcome {
        Ok(Some(prepared)) => prepared,
        Ok(None) => Err(fail(
            StatusCode::CONFLICT,
            "someone is typing in its terminal, or did a moment ago; try again in a moment",
        )),
        Err(error) => Err(fail(StatusCode::CONFLICT, error.to_string())),
    }
}

/// The prompt a steer arrives as: Perch's rule line first (so a leading `/` is never a command), the
/// sender, and the text. A lead's is quoted like any peer's; a person's is their own words.
fn steer_prompt(
    actor: Actor,
    mail: &crate::db::MailRow,
    lead_provider: &str,
    label: &str,
    lead: &str,
) -> String {
    let body = BodyText::Whole(&mail.body);
    match actor {
        Actor::Person => {
            agent_mail::format_person_banner(MailKind::Steer, &mail.id, mail.created_at, &body)
        }
        Actor::Lead => agent_mail::format_banner(
            &Sender {
                label,
                provider: lead_provider,
                session: lead,
            },
            MailKind::Steer,
            &mail.id,
            mail.created_at,
            &body,
        ),
    }
}

fn interrupt(
    app: &AppState,
    actor: Actor,
    lead: &str,
    row: &SubSessionRow,
) -> Result<Prepared, Failure> {
    let agent_key = key_of(app, &row.child_session_id, &row.provider_id)?;
    let agent = app.agent_runtime.bridge_key(&agent_key).ok_or_else(|| {
        fail(
            StatusCode::CONFLICT,
            "its agent is no longer running in that tab, so Perch cannot reach it",
        )
    })?;
    let bridge = app.native_ui.get(&agent).ok_or_else(|| {
        fail(
            StatusCode::CONFLICT,
            "its native connection is not up, so Perch cannot reach it",
        )
    })?;
    let client = service_client()?;
    let id = Uuid::new_v4().to_string();
    let _operation = app.agent_operation_lock.lock().unwrap();
    let outcome = app.agent_runtime.dispatch_under_current_lease(
        &agent_key,
        &client,
        // An interrupt is the person's or the lead's explicit act: it does not wait for a quiet line.
        Duration::ZERO,
        |write| -> anyhow::Result<Result<Prepared, Failure>> {
            if let Err(why) =
                crew_actions::availability(Action::Interrupt, actor, &child_facts(app, row))
            {
                return Ok(Err(fail(StatusCode::CONFLICT, why)));
            }
            if app.agent_runtime.bridge_key(&agent_key).as_ref() != Some(&agent) {
                return Ok(Err(fail(
                    StatusCode::CONFLICT,
                    "the agent in that tab changed; try again",
                )));
            }
            // Counted before it is sent: a lead's attempts are what the cap limits, confirmed or not.
            if actor == Actor::Lead {
                app.db.spend_lead_interrupt(lead, &row.child_session_id)?;
            }
            let reply = super::native_ui::queue_cancel(&agent, &bridge, &id, write)?;
            Ok(Ok(Prepared::Interrupt {
                id: id.clone(),
                reply,
                bridge: bridge.clone(),
            }))
        },
    );
    match outcome {
        Ok(Some(prepared)) => prepared,
        Ok(None) => Err(fail(StatusCode::CONFLICT, "try again in a moment")),
        Err(error) => Err(fail(StatusCode::CONFLICT, error.to_string())),
    }
}

/// What a Claude steer's receipt says when the text was taken but not yet seen joining the turn.
pub(super) const NOT_JOINED: &str = "Claude took the text but did not show it joining the running turn yet: it \
     holds it in its own queue, to feed into the turn at its next step or to start a turn with when \
     this one ends";

/// Whether Claude's transcript shows the steer `marker` (its mail id) joining the running turn,
/// looked for up to [`ABSORB`]. Shared by `perch steer` and a message delivered as a steer.
pub(super) async fn wait_absorbed(key: AgentKey, marker: String) -> bool {
    let deadline = tokio::time::Instant::now() + ABSORB;
    let mut joined = false;
    loop {
        let (key, marker) = (key.clone(), marker.clone());
        joined = tokio::task::spawn_blocking(move || {
            crate::native_ui::claude::steer_absorbed_in_session(&key, &marker)
        })
        .await
        .unwrap_or(joined);
        if joined || tokio::time::Instant::now() >= deadline {
            return joined;
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
}

/// The provider's answer to a steer, and for Claude the transcript's.
async fn confirm_steer(
    app: &AppState,
    id: String,
    reply: oneshot::Receiver<Result<bool, String>>,
    claude: Option<AgentKey>,
) -> Done {
    let ids = [id.clone()];
    let settle = |state: MailState, reason: &str| {
        if let Err(error) = app.db.settle_mail(&ids, state, reason) {
            tracing::error!(%error, "could not record what became of a steer");
        }
    };
    let (outcome, reason) = match tokio::time::timeout(ANSWER, reply).await {
        Ok(Ok(Ok(true))) => match claude {
            None => {
                settle(MailState::Delivered, "");
                (Outcome::Confirmed, String::new())
            }
            Some(key) => {
                // Claude took the text (its `UserPromptSubmit` hook); whether its queue fed it into the
                // running turn is in its transcript.
                settle(MailState::Delivered, "");
                if wait_absorbed(key, id.clone()).await {
                    (Outcome::Confirmed, String::new())
                } else {
                    (Outcome::NotConfirmed, NOT_JOINED.into())
                }
            }
        },
        answer => {
            let why = match answer {
                Ok(Ok(Err(why))) => why,
                Ok(Ok(Ok(false))) => "it said no".into(),
                _ => "it did not answer in time".into(),
            };
            settle(MailState::Unconfirmed, &why);
            (Outcome::NotConfirmed, why)
        }
    };
    Done {
        outcome,
        reason,
        id,
        duplicate: false,
    }
}

/// The provider's answer to an interrupt, then its report that the turn is over.
async fn confirm_interrupt(
    reply: oneshot::Receiver<Result<bool, String>>,
    bridge: &Arc<crate::native_ui::NativeBridge>,
) -> Done {
    match tokio::time::timeout(ANSWER, reply).await {
        Ok(Ok(Ok(true))) => {
            if bridge.wait_turn_end(ANSWER).await {
                Done::new(Outcome::Confirmed, "")
            } else {
                Done::new(
                    Outcome::NotConfirmed,
                    "it accepted the interrupt, but its turn is still running",
                )
            }
        }
        Ok(Ok(Err(why))) => Done::new(Outcome::NotConfirmed, why),
        Ok(Ok(Ok(false))) => Done::new(Outcome::NotConfirmed, "it said no"),
        _ => Done::new(Outcome::NotConfirmed, "it did not answer in time"),
    }
}

/// An agent's `perch steer` and `perch interrupt`: only a lead, only its own children.
pub(super) async fn agent_action(
    app: &AppState,
    caller: &crate::agent_identity::AgentIdentity,
    action: Action,
    body: &serde_json::Value,
) -> Result<serde_json::Value, Failure> {
    debug_assert!(matches!(action, Action::Steer | Action::Interrupt));
    if matches!(app.db.parent_of(&caller.session_id), Ok(Some(_))) {
        return Err(fail(
            StatusCode::FORBIDDEN,
            "a sub-session cannot steer or interrupt anyone; only a lead can, and only its own sub-sessions",
        ));
    }
    let target = body["target"]
        .as_str()
        .filter(|target| !target.is_empty())
        .ok_or_else(|| {
            bad(format!(
                "say which sub-session: perch {} <session>",
                action.as_str()
            ))
        })?;
    let key = if action == Action::Steer {
        agent_mail::check_key(body["key"].as_str().unwrap_or_default())
            .map_err(bad)?
            .to_string()
    } else {
        String::new()
    };
    let done = run(
        app,
        Actor::Lead,
        &caller.session_id,
        target,
        Request {
            action,
            text: body["text"].as_str().map(str::to_string),
            key,
        },
        |_, _| {},
    )
    .await?;
    Ok(serde_json::json!({
        "session": target,
        "id": done.id,
        "outcome": done.outcome.as_str(),
        "reason": done.reason,
        "duplicate": done.duplicate,
    }))
}

/// Whether this connection's chat of `key` holds the input lease at `generation`: the same test
/// typing in the chat has to pass.
pub(super) fn holds_input_lease(state: &Arc<ConnState>, key: &AgentKey, generation: u64) -> bool {
    state
        .agent_input_leases
        .lock()
        .unwrap()
        .get(&agents::lifecycle_control_key(key, ControlChannel::Input))
        .is_some_and(|lease| lease.generation == generation)
}

/// `crew.act` from a person's chat. The strip belongs to the lead whose chat shows it, so the
/// person must hold that chat's input lease, exactly as for typing in it.
pub(super) fn handle_act(
    state: &Arc<ConnState>,
    request_id: String,
    session_id: String,
    child_session_id: String,
    action: String,
    generation: u64,
    text: Option<String>,
) {
    let state = state.clone();
    let reply = {
        let (request_id, session_id, child_session_id, action) = (
            request_id.clone(),
            session_id.clone(),
            child_session_id.clone(),
            action.clone(),
        );
        let out = state.out_tx.clone();
        move |outcome: &str, reason: &str, done: bool| {
            let _ = out.send(ServerMessage::CrewActResult {
                request_id: request_id.clone(),
                session_id: session_id.clone(),
                child_session_id: child_session_id.clone(),
                action: action.clone(),
                outcome: outcome.into(),
                reason: reason.into(),
                done,
            });
        }
    };
    tokio::spawn(async move {
        let refuse = |reason: &str| reply("refused", reason, true);
        let Some(action) = Action::parse(&action) else {
            return refuse("unknown action");
        };
        let lead = match state.app.db.get_session(&session_id) {
            Ok(Some(row)) => row,
            _ => return refuse("that chat no longer exists"),
        };
        if !(lead.host_id.is_empty() || lead.host_id == "local") {
            return refuse("sub-sessions are on this computer only");
        }
        let Some(provider) = lead.cli_provider_id.clone() else {
            return refuse("that session is not an agent chat");
        };
        let Ok(lead_key) = key_of(&state.app, &session_id, &provider) else {
            return refuse("that chat no longer exists");
        };
        if !holds_input_lease(&state, &lead_key, generation) {
            return refuse("Take control of this chat before acting on a sub-session");
        }
        let request = Request {
            action,
            text,
            key: request_id.clone(),
        };
        let progress = |outcome: Outcome, reason: &str| reply(outcome.as_str(), reason, false);
        match run(
            &state.app,
            Actor::Person,
            &session_id,
            &child_session_id,
            request,
            progress,
        )
        .await
        {
            Ok(done) => {
                notify_session_updated(&state.app, &child_session_id);
                notify_session_updated(&state.app, &session_id);
                reply(done.outcome.as_str(), &done.reason, true);
            }
            Err((_, why)) => refuse(&why),
        }
    });
}

#[cfg(test)]
mod tests {
    use super::super::agent::tests::request;
    use super::super::sub_sessions::tests::{boot, lead_with_child};
    use super::*;
    use crate::agent_identity::IdentityStore;
    use crate::sub_sessions::SubState;
    use futures::{SinkExt, StreamExt};
    use serde_json::{json, Value};
    use tokio_tungstenite::tungstenite::Message;

    /// An agent may steer or interrupt only as the lead of the child it names: a child cannot do
    /// either to anyone, a lead cannot reach another run's session, and a refused action records
    /// nothing and spends nothing.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn only_a_lead_steers_or_interrupts_and_only_its_own_children() {
        let root = std::env::temp_dir().join(format!("perch-steer-http-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let (address, db) = boot(&root).await;
        let (workspace, _) = lead_with_child(&db, &nest, SubState::Running);
        let lead = db
            .issue(&AgentKey::new(&workspace.id, "lead", "claude").unwrap())
            .unwrap();
        let child = db
            .issue(&AgentKey::new(&workspace.id, "child", "codex").unwrap())
            .unwrap();
        db.create_session_in_workspace("other", &workspace, &nest.to_string_lossy())
            .unwrap();
        db.set_cli_provider("other", "claude").unwrap();
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
        for route in ["steer", "interrupt"] {
            // A child cannot, whoever it names.
            for target in ["lead", "child", "other"] {
                let (status, answer) = call(
                    route,
                    child.token.clone(),
                    json!({"session": "child", "target": target, "text": "stop", "key": "k1"}),
                )
                .await;
                assert_eq!(status, 403, "{route} {target}: {answer}");
                assert!(answer["error"].as_str().unwrap().contains("only a lead"));
            }
            // A lead reaches its own child only: another session reads like a stranger's.
            for target in ["other", "nobody", "lead"] {
                let (status, answer) = call(
                    route,
                    lead.token.clone(),
                    json!({"session": "lead", "target": target, "text": "stop", "key": "k1"}),
                )
                .await;
                assert_eq!(status, 404, "{route} {target}: {answer}");
            }
            // Its own child, which no process backs here: refused, with the reason.
            let (status, answer) = call(
                route,
                lead.token.clone(),
                json!({"session": "lead", "target": "child", "text": "stop", "key": "k1"}),
            )
            .await;
            assert_eq!(status, 409, "{route}: {answer}");
            assert!(
                answer["error"].as_str().unwrap().contains("not running"),
                "{answer}"
            );
        }
        // A bad key is the lead's mistake and is told so before anything else.
        let (status, _) = call(
            "steer",
            lead.token.clone(),
            json!({"session": "lead", "target": "child", "text": "x", "key": "a b"}),
        )
        .await;
        assert_eq!(status, 400);
        assert!(db.mail_from("lead", 10).unwrap().is_empty());
        assert_eq!(db.lead_interrupts("child").unwrap(), 0);
        let _ = std::fs::remove_dir_all(root);
    }

    /// A person's action needs the input lease of the lead's chat, as typing in it does; without one
    /// nothing reaches the child, and the strip's rows say why each action is not offered.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_persons_action_without_the_leads_input_lease_is_refused() {
        let root = std::env::temp_dir().join(format!("perch-act-ws-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let db_path = root.join("history.sqlite");
        let db = Arc::new(HistoryDb::open(&db_path).unwrap());
        let local_ui = crate::local_ui::LocalUi::in_process();
        let token = local_ui.token().to_string();
        let (ready_tx, ready_rx) = tokio::sync::oneshot::channel();
        tokio::spawn(super::super::run(
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
        let address = tokio::time::timeout(Duration::from_secs(5), ready_rx)
            .await
            .unwrap()
            .unwrap();
        lead_with_child(&db, &nest, SubState::Running);
        let (mut socket, _) = tokio_tungstenite::connect_async(
            crate::hub::socket_request(&format!("ws://{address}/ws"), Some(&token)).unwrap(),
        )
        .await
        .unwrap();
        let mut ask = async |message: Value, want: &str| -> Value {
            socket
                .send(Message::Text(message.to_string()))
                .await
                .unwrap();
            loop {
                let next = tokio::time::timeout(Duration::from_secs(10), socket.next())
                    .await
                    .unwrap()
                    .unwrap()
                    .unwrap();
                let Message::Text(text) = next else { continue };
                let value: Value = serde_json::from_str(&text).unwrap();
                if value["type"] == want {
                    return value;
                }
            }
        };
        for action in ["message", "steer", "interrupt", "stop", "approve"] {
            let result = ask(
                json!({"type": "crew.act", "requestId": format!("r-{action}"), "sessionId": "lead",
                       "childSessionId": "child", "action": action, "generation": 1, "text": "hi"}),
                "crew.act.result",
            )
            .await;
            assert_eq!(result["outcome"], "refused", "{action}: {result}");
            assert_eq!(result["done"], true);
            assert_eq!(result["requestId"], format!("r-{action}"));
        }
        let result = ask(
            json!({"type": "crew.act", "requestId": "r2", "sessionId": "lead",
                   "childSessionId": "child", "action": "stop", "generation": 1}),
            "crew.act.result",
        )
        .await;
        assert!(
            result["reason"].as_str().unwrap().contains("Take control"),
            "{result}"
        );
        assert!(db.mail_to("child", 10).unwrap().is_empty());
        // The row says what is not offered, and why, for a child no process backs.
        let state = ask(
            json!({"type": "crew.get", "requestId": "g1", "sessionId": "lead"}),
            "crew.state",
        )
        .await;
        let actions = &state["rows"][0]["actions"];
        for action in ["message", "steer", "interrupt", "stop"] {
            assert_eq!(actions[action]["ok"], false, "{action}: {actions}");
            assert!(actions[action]["reason"]
                .as_str()
                .unwrap()
                .contains("not running"));
        }
        let _ = std::fs::remove_dir_all(root);
    }
}
