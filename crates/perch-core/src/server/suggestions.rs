//! Suggested tasks on the core: `perch suggest` (and `perch spawn` while leads may not start
//! sub-sessions without asking) puts a card in front of the person; the person's Start, Start all,
//! Do it here, Options and Dismiss come in as `suggestion.act`. The rules are
//! `crate::suggestions`, the records `db/suggestions.rs`. Own design (ARCHITECTURE,
//! "Suggested tasks").
//!
//! A suggestion starts nothing by itself. Start is the person's own click: it goes through the
//! same admission, limits, key and launch as `perch spawn` (`sub_sessions::start`). The person must hold the lead chat's input lease, as for
//! typing in it. Clicking Start twice starts one sub-session: the step `pending` to `starting` is
//! taken once and the spawn key names the child.
use super::sub_sessions::{self, fail, key_of, reconcile, Failure, SpawnRequest};
use super::*;
use crate::agent_identity::AgentIdentity;
use crate::db::{Added, SuggestionRow};
use crate::protocol::{SuggestionCard, SuggestionItem, SuggestionResult};
use crate::sub_sessions::Refusal;
use crate::suggestions::{self, Suggested, SuggestionState};
use serde_json::{json, Value};

/// The longest task `perch list` shows of a waiting suggestion, in characters.
const LIST_TASK_CHARS: usize = 120;

fn clip(text: &str, max: usize) -> String {
    let flat = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if flat.chars().count() <= max {
        flat
    } else {
        let mut cut: String = flat.chars().take(max.saturating_sub(1)).collect();
        cut.push('…');
        cut
    }
}

/// Tell every client showing this chat that its cards changed.
pub(super) fn announce(app: &AppState, lead_session_id: &str) {
    let _ = app
        .hub
        .hub_events_tx
        .send(Arc::new(ServerMessage::SuggestionsChanged {
            session_id: lead_session_id.to_string(),
        }));
}

/// A lead may put suggestions in front of a person only if it could start sub-sessions at all: it is
/// not itself a sub-session, it runs on this computer and it is in a Workspace.
fn check_lead(app: &AppState, caller: &AgentIdentity) -> Result<(), Failure> {
    let lead = app
        .db
        .get_session(&caller.session_id)
        .map_err(|error| sub_sessions::internal("read the session", error))?
        .ok_or_else(|| fail(StatusCode::NOT_FOUND, "your session no longer exists"))?;
    if !(lead.host_id.is_empty() || lead.host_id == "local") {
        return Err(fail(
            StatusCode::FORBIDDEN,
            "sub-sessions can be started only from a session on this computer",
        ));
    }
    if lead.workspace_id.is_none() {
        return Err(fail(
            StatusCode::FORBIDDEN,
            "this session is not in a Workspace",
        ));
    }
    let is_child = app
        .db
        .parent_of(&caller.session_id)
        .map_err(|error| sub_sessions::internal("read the session", error))?
        .is_some();
    if is_child {
        return Err(fail(StatusCode::FORBIDDEN, Refusal::Depth.message()));
    }
    Ok(())
}

fn added_json(added: Added) -> Result<Value, Failure> {
    let (rows, duplicate) = match added {
        Added::New(rows) => (rows, false),
        Added::Existing(rows) => (rows, true),
        Added::Refused(reason) => return Err(fail(StatusCode::CONFLICT, reason)),
    };
    Ok(json!({
        "card": rows.first().map(|row| row.card_id.clone()),
        "duplicate": duplicate,
        "suggested": true,
        "suggestions": rows.iter().map(|row| json!({
            "id": row.id,
            "agent": row.agent,
            "task": clip(&row.task, LIST_TASK_CHARS),
            "state": row.state.as_str(),
        })).collect::<Vec<_>>(),
    }))
}

/// `perch suggest`: one card of one or more tasks. Nothing is started.
pub(super) fn suggest(
    app: &AppState,
    caller: &AgentIdentity,
    body: &Value,
) -> Result<Value, Failure> {
    let bad = |text: String| fail(StatusCode::BAD_REQUEST, text);
    check_lead(app, caller)?;
    let key = crate::sub_sessions::check_key(body["key"].as_str().unwrap_or_default())
        .map_err(bad)?
        .to_string();
    let entries = body["suggestions"].as_array().cloned().unwrap_or_default();
    let mut items = Vec::new();
    for entry in &entries {
        let agent = match entry["agent"].as_str().filter(|agent| !agent.is_empty()) {
            Some(agent) => agent,
            None => caller.provider_id.as_str(),
        };
        if !sub_sessions::AGENTS.contains(&agent) {
            return Err(bad(format!(
                "choose the agent with --agent: {}",
                sub_sessions::AGENTS.join(", ")
            )));
        }
        let task = suggestions::check_task(entry["task"].as_str().unwrap_or_default())
            .map_err(bad)?
            .to_string();
        let model = match entry["model"].as_str().filter(|model| !model.is_empty()) {
            Some(model) => Some(
                crate::sub_sessions::check_model(model)
                    .map_err(bad)?
                    .to_string(),
            ),
            None => None,
        };
        items.push(Suggested {
            task,
            agent: agent.to_string(),
            model,
            worktree: entry["worktree"].as_bool().unwrap_or(false),
        });
    }
    suggestions::check_batch(items.len(), 0, app.db.limits().waiting_cards as usize)
        .map_err(bad)?;
    let added = app
        .db
        .add_suggestions(&caller.session_id, &key, &items)
        .map_err(|error| sub_sessions::internal("keep the suggestions", error))?;
    let fresh = matches!(added, Added::New(_));
    let answer = added_json(added)?;
    if fresh {
        announce(app, &caller.session_id);
    }
    Ok(answer)
}

/// `perch spawn` while leads may not start sub-sessions without asking: the same task as a card of
/// one, waiting for the person. The spawn key names the card, so a retry returns it.
pub(super) fn suggest_spawn(
    app: &AppState,
    caller: &AgentIdentity,
    request: SpawnRequest,
) -> Result<Value, Failure> {
    check_lead(app, caller)?;
    let item = Suggested {
        task: request.task,
        agent: request.agent,
        model: request.model,
        worktree: request.worktree,
    };
    let added = app
        .db
        .add_suggestions(&caller.session_id, &request.key, &[item])
        .map_err(|error| sub_sessions::internal("keep the suggestion", error))?;
    let fresh = matches!(added, Added::New(_));
    let answer = added_json(added)?;
    if fresh {
        announce(app, &caller.session_id);
    }
    Ok(answer)
}

/// The sub-session's dispatch word for a started suggestion, and whether it still counts as live.
fn child_state(app: &AppState, row: &SuggestionRow) -> (Option<String>, bool) {
    let Some(child) = row.child_session_id.as_deref() else {
        return (None, false);
    };
    match app.db.sub_session(child) {
        Ok(Some(record)) => {
            let state = reconcile(app, &record);
            (Some(state.as_str().to_string()), state.is_live())
        }
        _ => (None, false),
    }
}

/// `perch suggestions`: the tasks still waiting for a person, with the ids `perch start` and
/// `perch dismiss` take. Read-only.
pub(super) fn waiting(app: &AppState, caller: &AgentIdentity) -> Result<Value, Failure> {
    check_lead(app, caller)?;
    let rows = app
        .db
        .suggestions_in_run(&caller.session_id)
        .map_err(|error| sub_sessions::internal("read the suggestions", error))?;
    Ok(json!({
        "suggestions": rows
            .into_iter()
            .filter(|row| row.state == SuggestionState::Pending)
            .map(|row| json!({
                "id": row.id,
                "card": row.card_id,
                "agent": row.agent,
                "model": row.model,
                "worktree": row.worktree,
                "task": clip(&row.task, LIST_TASK_CHARS),
            }))
            .collect::<Vec<_>>(),
    }))
}

/// `perch start <id|all>` and `perch dismiss <id>`. Only a person may answer a card, and this route
/// opens with the agent's token, so it acts only when a client typed this exact line into the
/// caller's own terminal a moment ago (`AgentRuntimeAdapter::person_typed`): something an agent
/// cannot do from inside its shell. `target` is the word as typed; an id may be shortened to six or
/// more characters that name one waiting task.
pub(super) async fn answer_typed(
    app: &AppState,
    caller: &AgentIdentity,
    verb: &str,
    target: &str,
) -> Result<Value, Failure> {
    let bad = |text: String| fail(StatusCode::BAD_REQUEST, text);
    check_lead(app, caller)?;
    let all = verb == "start" && target == "all";
    if !matches!(verb, "start" | "dismiss")
        || target.is_empty()
        || target.contains(char::is_whitespace)
    {
        return Err(bad("perch start <id|all> or perch dismiss <id>".into()));
    }
    let waiting: Vec<SuggestionRow> = app
        .db
        .suggestions_in_run(&caller.session_id)
        .map_err(|error| sub_sessions::internal("read the suggestions", error))?
        .into_iter()
        .filter(|row| row.state == SuggestionState::Pending)
        .collect();
    let picked: Vec<&SuggestionRow> = if all {
        waiting.iter().collect()
    } else if target.len() < 6 {
        return Err(bad(
            "name the task by the id `perch suggestions` shows".into()
        ));
    } else {
        waiting
            .iter()
            .filter(|row| row.id.starts_with(target))
            .collect()
    };
    if !all && picked.len() != 1 {
        return Err(fail(
            StatusCode::NOT_FOUND,
            if picked.is_empty() {
                "no waiting task has that id (`perch suggestions` lists them)"
            } else {
                "that id names more than one waiting task; type more of it"
            },
        ));
    }
    if picked.is_empty() {
        return Err(fail(
            StatusCode::NOT_FOUND,
            "there is nothing waiting to start",
        ));
    }
    let line = format!("perch {verb} {target}");
    if !app.agent_runtime.person_typed(&caller.session_id, &line) {
        return Err(fail(
            StatusCode::FORBIDDEN,
            format!(
                "only a person can answer a suggestion. Nothing was done. A person types \
                 `{line}` themselves in this session's terminal (in Claude or Pi, as `!{line}`), \
                 or presses the button on the card."
            ),
        ));
    }
    let chosen = || Chosen {
        agent: None,
        model: None,
        worktree: None,
    };
    let mut results = Vec::new();
    let mut reason = String::new();
    // One card at a time, as the card's own buttons do.
    let mut cards: Vec<&str> = picked.iter().map(|row| row.card_id.as_str()).collect();
    cards.sort_unstable();
    cards.dedup();
    for card in cards {
        let acted = match (verb, all) {
            ("start", true) => {
                act(app, &caller.session_id, "start_all", card, None, chosen()).await
            }
            _ => {
                let id = picked
                    .iter()
                    .find(|row| row.card_id == card)
                    .map(|row| row.id.as_str());
                act(app, &caller.session_id, verb, card, id, chosen()).await
            }
        };
        if reason.is_empty() {
            reason = acted.reason;
        }
        results.extend(acted.results);
    }
    announce(app, &caller.session_id);
    let (outcome, first) = if verb == "start" {
        outcome_of(&results)
    } else if results.iter().any(|r| r.outcome == "dismissed") {
        ("dismissed", String::new())
    } else {
        (
            "refused",
            results
                .first()
                .map(|r| r.reason.clone())
                .unwrap_or_default(),
        )
    };
    Ok(json!({
        "outcome": outcome,
        "reason": if reason.is_empty() { first } else { reason },
        "results": results.iter().map(|r| json!({
            "id": r.suggestion_id,
            "outcome": r.outcome,
            "reason": r.reason,
            "session": r.child_session_id,
        })).collect::<Vec<_>>(),
    }))
}

/// What `perch list` says of a lead's waiting and started suggestions.
pub(super) fn listed(app: &AppState, lead_session_id: &str) -> Vec<Value> {
    app.db
        .suggestions_in_run(lead_session_id)
        .unwrap_or_default()
        .into_iter()
        .filter(|row| {
            matches!(
                row.state,
                SuggestionState::Pending | SuggestionState::Starting | SuggestionState::Started
            )
        })
        .map(|row| {
            json!({
                "id": row.id,
                "agent": row.agent,
                "model": row.model,
                "task": clip(&row.task, LIST_TASK_CHARS),
                "state": row.state.as_str(),
                "session": row.child_session_id,
            })
        })
        .collect()
}

/// Cards still worth showing: something waits, or a sub-session started from one still runs.
pub(super) fn cards(app: &AppState, lead_session_id: &str) -> Vec<SuggestionCard> {
    let mut cards: Vec<(String, Vec<(SuggestionItem, bool)>)> = Vec::new();
    for row in app.db.suggestions_of(lead_session_id).unwrap_or_default() {
        let (dispatch, live) = child_state(app, &row);
        let item = SuggestionItem {
            id: row.id.clone(),
            task: row.task.clone(),
            agent: row.agent.clone(),
            model: row.model.clone(),
            worktree: row.worktree,
            state: row.state.as_str().to_string(),
            child_session_id: row.child_session_id.clone(),
            dispatch,
            reason: row.reason.clone(),
        };
        match cards.iter_mut().find(|(id, _)| *id == row.card_id) {
            Some((_, items)) => items.push((item, live)),
            None => cards.push((row.card_id.clone(), vec![(item, live)])),
        }
    }
    cards
        .into_iter()
        .filter(|(_, items)| {
            let states: Vec<(SuggestionState, bool)> = items
                .iter()
                .map(|(item, live)| {
                    (
                        SuggestionState::parse(&item.state).unwrap_or(SuggestionState::Pending),
                        *live,
                    )
                })
                .collect();
            suggestions::card_visible(&states)
        })
        .map(|(id, items)| SuggestionCard {
            id,
            items: items.into_iter().map(|(item, _)| item).collect(),
        })
        .collect()
}

/// `suggestions.get`.
pub(super) fn handle_get(state: &Arc<ConnState>, request_id: String, session_id: String) {
    let state = state.clone();
    tokio::task::spawn_blocking(move || {
        let local = state
            .app
            .db
            .get_session(&session_id)
            .ok()
            .flatten()
            .is_some_and(|row| row.host_id.is_empty() || row.host_id == "local");
        let (cards, error) = if local {
            (cards(&state.app, &session_id), None)
        } else {
            (
                Vec::new(),
                Some("that session is not on this computer".to_string()),
            )
        };
        let _ = state.out_tx.send(ServerMessage::SuggestionsState {
            request_id,
            session_id,
            cards,
            error,
        });
    });
}

/// The lead's live identity, which a started sub-session records as the authority that started it.
fn live_identity(app: &AppState, session_id: &str) -> Option<AgentIdentity> {
    app.db
        .active_agent_identities()
        .ok()?
        .into_iter()
        .find(|identity| identity.session_id == session_id)
}

/// What the person chose in Options, checked like `perch spawn`'s arguments.
struct Chosen {
    agent: Option<String>,
    model: Option<String>,
    worktree: Option<bool>,
}

impl Chosen {
    fn check(self) -> Result<Self, String> {
        if let Some(agent) = &self.agent {
            if !sub_sessions::AGENTS.contains(&agent.as_str()) {
                return Err(format!("choose one of {}", sub_sessions::AGENTS.join(", ")));
            }
        }
        if let Some(model) = &self.model {
            // An empty model means the agent's own default.
            if !model.is_empty() {
                crate::sub_sessions::check_model(model)?;
            }
        }
        Ok(self)
    }
}

/// Start one waiting suggestion as the person chose. `Ok` is the sub-session; `Err` why nothing
/// started, with the suggestion waiting again.
async fn start_one(
    app: &AppState,
    lead_session_id: &str,
    row: &SuggestionRow,
    chosen: &Chosen,
) -> SuggestionResult {
    let refused = |reason: String| SuggestionResult {
        suggestion_id: row.id.clone(),
        outcome: "refused".into(),
        reason,
        child_session_id: None,
    };
    let picked = Suggested {
        task: row.task.clone(),
        agent: chosen.agent.clone().unwrap_or_else(|| row.agent.clone()),
        model: match &chosen.model {
            Some(model) if model.is_empty() => None,
            Some(model) => Some(model.clone()),
            None => row.model.clone(),
        },
        worktree: chosen.worktree.unwrap_or(row.worktree),
    };
    let Some(identity) = live_identity(app, lead_session_id) else {
        return refused(
            "this session is not running, so it cannot have a sub-session; start it again first"
                .into(),
        );
    };
    match app.db.begin_suggestion(&row.id, &picked) {
        Ok(true) => {}
        Ok(false) => return refused("that task was already answered".into()),
        Err(error) => return refused(format!("Perch could not record the start: {error}")),
    }
    let key = suggestions::spawn_key(&row.id);
    let request = SpawnRequest {
        agent: picked.agent.clone(),
        model: picked.model.clone(),
        task: picked.task.clone(),
        key: key.clone(),
        worktree: picked.worktree,
        quiet_after: None,
    };
    let settle = |state: SuggestionState, child: Option<&str>, reason: &str| {
        if let Err(error) =
            app.db
                .move_suggestion(&row.id, &[SuggestionState::Starting], state, child, reason)
        {
            tracing::warn!(%error, "could not keep the result of a suggestion");
        }
    };
    match sub_sessions::start(app, &identity, request).await {
        Ok(answer) => {
            let child = answer["session"].as_str().unwrap_or_default().to_string();
            settle(SuggestionState::Started, Some(&child), "");
            SuggestionResult {
                suggestion_id: row.id.clone(),
                outcome: "started".into(),
                reason: String::new(),
                child_session_id: Some(child),
            }
        }
        Err((_, reason)) => {
            // A launch that could not be shown to have failed leaves a record: the card then follows
            // that sub-session, never starting a second one.
            match app.db.sub_session_by_key(lead_session_id, &key) {
                Ok(Some(record)) => {
                    settle(
                        SuggestionState::Started,
                        Some(&record.child_session_id),
                        &reason,
                    );
                    SuggestionResult {
                        suggestion_id: row.id.clone(),
                        outcome: "started".into(),
                        reason,
                        child_session_id: Some(record.child_session_id),
                    }
                }
                _ => {
                    settle(SuggestionState::Pending, None, &reason);
                    refused(reason)
                }
            }
        }
    }
}

fn outcome_of(results: &[SuggestionResult]) -> (&'static str, String) {
    let started = results.iter().filter(|r| r.outcome == "started").count();
    if results.is_empty() {
        return ("refused", "there is nothing waiting to start".into());
    }
    if started == results.len() {
        return ("started", String::new());
    }
    let reason = results
        .iter()
        .find(|r| r.outcome == "refused")
        .map(|r| r.reason.clone())
        .unwrap_or_default();
    if started == 0 {
        ("refused", reason)
    } else {
        ("partial", reason)
    }
}

/// `suggestion.act` from a person's chat.
#[allow(clippy::too_many_arguments)]
pub(super) fn handle_act(
    state: &Arc<ConnState>,
    request_id: String,
    session_id: String,
    action: String,
    card_id: String,
    suggestion_id: Option<String>,
    generation: u64,
    agent: Option<String>,
    model: Option<String>,
    worktree: Option<bool>,
) {
    let state = state.clone();
    tokio::spawn(async move {
        let reply = |outcome: &str, reason: &str, results: Vec<SuggestionResult>| {
            let _ = state.out_tx.send(ServerMessage::SuggestionActResult {
                request_id: request_id.clone(),
                session_id: session_id.clone(),
                action: action.clone(),
                outcome: outcome.into(),
                reason: reason.into(),
                results,
            });
        };
        let refuse = |reason: &str| reply("refused", reason, Vec::new());
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
        if !super::crew_actions::holds_input_lease(&state, &lead_key, generation) {
            return refuse("Take control of this chat before answering a suggestion");
        }
        let acted = act(
            &state.app,
            &session_id,
            &action,
            &card_id,
            suggestion_id.as_deref(),
            Chosen {
                agent,
                model,
                worktree,
            },
        )
        .await;
        announce(&state.app, &session_id);
        reply(&acted.outcome, &acted.reason, acted.results);
    });
}

/// What an action came to.
struct Acted {
    outcome: String,
    reason: String,
    results: Vec<SuggestionResult>,
}

impl Acted {
    fn refused(reason: &str) -> Self {
        Self {
            outcome: "refused".into(),
            reason: reason.into(),
            results: Vec::new(),
        }
    }
}

/// A person's action on a card of `session_id`, after the lease and the session were checked.
async fn act(
    app: &AppState,
    session_id: &str,
    action: &str,
    card_id: &str,
    suggestion_id: Option<&str>,
    chosen: Chosen,
) -> Acted {
    let rows: Vec<SuggestionRow> = app
        .db
        .suggestions_of(session_id)
        .unwrap_or_default()
        .into_iter()
        .filter(|row| row.card_id == card_id)
        .collect();
    if rows.is_empty() {
        return Acted::refused("that suggestion is gone");
    }
    match action {
        "start" => {
            let Some(row) = rows
                .iter()
                .find(|row| Some(row.id.as_str()) == suggestion_id)
            else {
                return Acted::refused("say which task to start");
            };
            let chosen = match chosen.check() {
                Ok(chosen) => chosen,
                Err(reason) => return Acted::refused(&reason),
            };
            let result = start_one(app, session_id, row, &chosen).await;
            let (outcome, reason) = outcome_of(std::slice::from_ref(&result));
            Acted {
                outcome: outcome.into(),
                reason,
                results: vec![result],
            }
        }
        "start_all" => {
            let mut results = Vec::new();
            for row in rows
                .iter()
                .filter(|row| row.state == SuggestionState::Pending)
            {
                let nothing = Chosen {
                    agent: None,
                    model: None,
                    worktree: None,
                };
                results.push(start_one(app, session_id, row, &nothing).await);
            }
            let (outcome, reason) = outcome_of(&results);
            Acted {
                outcome: outcome.into(),
                reason,
                results,
            }
        }
        "handed" | "dismiss" => {
            let to = if action == "handed" {
                SuggestionState::Handed
            } else {
                SuggestionState::Dismissed
            };
            let targets: Vec<&SuggestionRow> = match (suggestion_id, action) {
                (Some(id), _) => rows.iter().filter(|row| row.id == id).collect(),
                (None, "dismiss") => rows.iter().collect(),
                (None, _) => return Acted::refused("say which task"),
            };
            let mut results = Vec::new();
            for row in targets {
                let moved = app
                    .db
                    .move_suggestion(&row.id, &[SuggestionState::Pending], to, None, "")
                    .unwrap_or(false);
                results.push(SuggestionResult {
                    suggestion_id: row.id.clone(),
                    outcome: if moved { to.as_str() } else { "refused" }.to_string(),
                    reason: if moved {
                        String::new()
                    } else {
                        "that task was already answered".into()
                    },
                    child_session_id: None,
                });
            }
            if results.iter().all(|r| r.outcome == "refused") {
                let reason = results
                    .first()
                    .map(|r| r.reason.clone())
                    .unwrap_or_default();
                Acted {
                    outcome: "refused".into(),
                    reason,
                    results,
                }
            } else {
                Acted {
                    outcome: to.as_str().into(),
                    reason: String::new(),
                    results,
                }
            }
        }
        _ => Acted::refused("unknown action"),
    }
}

#[cfg(test)]
mod tests {
    use super::super::agent::tests::request;
    use super::super::sub_sessions::tests::boot;
    use super::*;
    use crate::agent_fleet::AgentKey;
    use crate::agent_identity::IdentityStore;
    use futures::{SinkExt, StreamExt};
    use std::time::Duration;

    struct Run {
        address: SocketAddr,
        db: Arc<HistoryDb>,
        lead_token: String,
        child_token: String,
        _root: std::path::PathBuf,
    }

    /// A booted core with a lead and one of its children, both with live identities.
    async fn run() -> Run {
        let root = std::env::temp_dir().join(format!("perch-suggest-http-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let (address, db) = boot(&root).await;
        let (workspace, _) = super::super::sub_sessions::tests::lead_with_child(
            &db,
            &nest,
            crate::sub_sessions::SubState::Running,
        );
        let lead = db
            .issue_in_current_run(&AgentKey::new(&workspace.id, "lead", "claude").unwrap())
            .unwrap();
        let child = db
            .issue(&AgentKey::new(&workspace.id, "child", "codex").unwrap())
            .unwrap();
        Run {
            address,
            db,
            lead_token: lead.token,
            child_token: child.token,
            _root: root,
        }
    }

    async fn call(run: &Run, route: &str, token: &str, body: Value) -> (u16, Value) {
        request(
            run.address,
            "POST",
            &format!("/agent/{route}"),
            &[("Authorization", &format!("Bearer {token}"))],
            &body.to_string(),
        )
        .await
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_lead_suggests_a_card_and_nothing_is_started() {
        let run = run().await;
        let before = run.db.sub_sessions_of("lead").unwrap().len();
        let (status, answer) = call(
            &run,
            "suggest",
            &run.lead_token,
            json!({"session": "lead", "key": "k1", "suggestions": [
                {"task": "fix the parser"},
                {"task": "write the docs", "agent": "codex", "model": "gpt-5.6-luna", "worktree": true},
            ]}),
        )
        .await;
        assert_eq!(status, 200, "{answer}");
        assert_eq!(answer["suggested"], true);
        assert_eq!(answer["suggestions"].as_array().unwrap().len(), 2);
        // The first task takes the lead's own agent; the second keeps what was asked.
        assert_eq!(answer["suggestions"][0]["agent"], "claude");
        let rows = run.db.suggestions_of("lead").unwrap();
        assert_eq!(rows[1].model.as_deref(), Some("gpt-5.6-luna"));
        assert!(rows[1].worktree);
        assert_eq!(
            run.db.sub_sessions_of("lead").unwrap().len(),
            before,
            "nothing started"
        );
        // The same key returns the card and adds nothing.
        let (_, again) = call(
            &run,
            "suggest",
            &run.lead_token,
            json!({"session": "lead", "key": "k1", "suggestions": [{"task": "other"}]}),
        )
        .await;
        assert_eq!(again["duplicate"], true);
        assert_eq!(again["card"], answer["card"]);
        assert_eq!(run.db.suggestions_of("lead").unwrap().len(), 2);
        // `perch list` names what waits.
        let (_, listed) = call(&run, "list", &run.lead_token, json!({"session": "lead"})).await;
        assert_eq!(listed["suggested"].as_array().unwrap().len(), 2, "{listed}");
        assert_eq!(listed["suggested"][0]["state"], "pending");
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn bad_suggestions_and_a_sub_session_suggesting_are_refused_and_keep_nothing() {
        let run = run().await;
        for (body, expect) in [
            (json!({"suggestions": []}), "at least one task"),
            (json!({"suggestions": [{"task": "  "}]}), "plain text"),
            (
                json!({"suggestions": [{"task": "/clear"}]}),
                "start a suggested task with a word",
            ),
            (
                json!({"suggestions": [{"task": "x", "agent": "gemini"}]}),
                "choose the agent",
            ),
            (
                json!({"suggestions": [{"task": "x", "model": "--help"}]}),
                "not a model",
            ),
            (
                json!({"suggestions": vec![json!({"task": "x"}); 6]}),
                "at most 5",
            ),
            (
                json!({"key": "a b", "suggestions": [{"task": "x"}]}),
                "spawn key",
            ),
        ] {
            let mut full = json!({"session": "lead", "key": "k0"});
            full.as_object_mut()
                .unwrap()
                .extend(body.as_object().unwrap().clone());
            let (status, answer) = call(&run, "suggest", &run.lead_token, full).await;
            assert_eq!(status, 400, "{answer}");
            assert!(
                answer["error"].as_str().unwrap().contains(expect),
                "{answer}"
            );
        }
        // A sub-session cannot suggest, as it cannot spawn.
        let (status, answer) = call(
            &run,
            "suggest",
            &run.child_token,
            json!({"session": "child", "key": "k", "suggestions": [{"task": "x"}]}),
        )
        .await;
        assert_eq!(status, 403, "{answer}");
        assert!(answer["error"]
            .as_str()
            .unwrap()
            .contains("Complete this task yourself"));
        assert!(run.db.suggestions_of("lead").unwrap().is_empty());
        assert!(run.db.suggestions_of("child").unwrap().is_empty());
        // Ten waiting at most.
        for card in 0..2 {
            let items = vec![json!({"task": "t"}); 5];
            let (status, _) = call(
                &run,
                "suggest",
                &run.lead_token,
                json!({"session": "lead", "key": format!("c{card}"), "suggestions": items}),
            )
            .await;
            assert_eq!(status, 200);
        }
        let (status, answer) = call(
            &run,
            "suggest",
            &run.lead_token,
            json!({"session": "lead", "key": "c9", "suggestions": [{"task": "t"}]}),
        )
        .await;
        assert_eq!(status, 409, "{answer}");
        assert!(answer["error"].as_str().unwrap().contains("still waiting"));
    }

    fn suggested(task: &str) -> Suggested {
        Suggested {
            task: task.into(),
            agent: "codex".into(),
            model: None,
            worktree: false,
        }
    }

    fn nothing_chosen() -> Chosen {
        Chosen {
            agent: None,
            model: None,
            worktree: None,
        }
    }

    /// A card of `count` tasks for the lead of [`run`], as `perch suggest` would have left it.
    fn card(run: &Run, key: &str, count: usize) -> Vec<SuggestionRow> {
        let items: Vec<Suggested> = (0..count)
            .map(|n| suggested(&format!("task {n}")))
            .collect();
        let Added::New(rows) = run.db.add_suggestions("lead", key, &items).unwrap() else {
            panic!("a new card");
        };
        rows
    }

    /// `perch suggestions` lists what waits; `perch start` and `perch dismiss` run with the agent's
    /// token and do nothing unless a client typed that exact line in the lead's terminal.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn an_agent_cannot_answer_a_card_but_a_line_a_person_typed_does() {
        let run = run().await;
        let app = super::super::booted_state(run.address);
        let rows = card(&run, "k", 2);
        let (status, listed) = call(
            &run,
            "suggestions",
            &run.lead_token,
            json!({"session": "lead"}),
        )
        .await;
        assert_eq!(status, 200, "{listed}");
        assert_eq!(listed["suggestions"].as_array().unwrap().len(), 2);
        assert_eq!(listed["suggestions"][0]["id"], rows[0].id.as_str());
        let answer = |verb: &'static str, target: String| {
            let (run, token) = (&run, run.lead_token.clone());
            async move {
                call(
                    run,
                    "answer",
                    &token,
                    json!({"session": "lead", "verb": verb, "target": target}),
                )
                .await
            }
        };
        let id = rows[0].id.clone();
        let short = id[..8].to_string();
        // The agent alone, with any word: refused, and nothing changes.
        for (verb, target) in [("dismiss", short.clone()), ("start", "all".to_string())] {
            let (status, refused) = answer(verb, target).await;
            assert_eq!(status, 403, "{refused}");
            assert!(refused["error"].as_str().unwrap().contains("only a person"));
        }
        assert_eq!(run.db.suggestions_of("lead").unwrap().len(), 2);
        assert!(run
            .db
            .suggestions_of("lead")
            .unwrap()
            .iter()
            .all(|row| row.state == SuggestionState::Pending));
        // The child never answers, typed or not.
        app.agent_runtime
            .note_terminal_input("lead", &format!("!perch dismiss {short}\r"));
        let (status, _) = request(
            run.address,
            "POST",
            "/agent/answer",
            &[("Authorization", &format!("Bearer {}", run.child_token))],
            &json!({"session": "child", "verb": "dismiss", "target": short}).to_string(),
        )
        .await;
        assert_ne!(status, 200);
        // A different id than the one typed does not borrow the proof.
        let (status, _) = answer("dismiss", rows[1].id[..8].to_string()).await;
        assert_eq!(status, 403);
        // What a person typed is accepted once.
        let (status, done) = answer("dismiss", short.clone()).await;
        assert_eq!(status, 200, "{done}");
        assert_eq!(done["outcome"], "dismissed");
        let (status, _) = answer("dismiss", short.clone()).await;
        assert_ne!(status, 200, "used up, and the task is answered");
        // Too short and unknown ids never reach the proof.
        assert_eq!(answer("dismiss", "abc".into()).await.0, 400);
        assert_eq!(answer("dismiss", "ffffffffff".into()).await.0, 404);
    }

    /// Dismissing and handing a task over answer it once; the card then goes from view.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_task_is_answered_once_and_an_answered_card_leaves_the_chat() {
        let run = run().await;
        let app = super::super::booted_state(run.address);
        let rows = card(&run, "k", 3);
        let card_id = rows[0].card_id.clone();
        assert_eq!(cards(&app, "lead").len(), 1);
        let handed = act(
            &app,
            "lead",
            "handed",
            &card_id,
            Some(&rows[0].id),
            nothing_chosen(),
        )
        .await;
        assert_eq!(handed.outcome, "handed");
        let again = act(
            &app,
            "lead",
            "handed",
            &card_id,
            Some(&rows[0].id),
            nothing_chosen(),
        )
        .await;
        assert_eq!(again.outcome, "refused");
        assert!(again.reason.contains("already answered"));
        let one = act(
            &app,
            "lead",
            "dismiss",
            &card_id,
            Some(&rows[1].id),
            nothing_chosen(),
        )
        .await;
        assert_eq!(one.outcome, "dismissed");
        assert_eq!(cards(&app, "lead")[0].items[2].state, "pending");
        // Without a task, dismiss answers what still waits; handing needs a task.
        assert_eq!(
            act(&app, "lead", "handed", &card_id, None, nothing_chosen())
                .await
                .outcome,
            "refused"
        );
        let all = act(&app, "lead", "dismiss", &card_id, None, nothing_chosen()).await;
        assert_eq!(all.outcome, "dismissed");
        assert!(cards(&app, "lead").is_empty());
        // A card that is gone, and an action nobody offers.
        assert_eq!(
            act(&app, "lead", "dismiss", "nope", None, nothing_chosen())
                .await
                .outcome,
            "refused"
        );
        let rows = card(&run, "k2", 1);
        assert_eq!(
            act(
                &app,
                "lead",
                "approve",
                &rows[0].card_id,
                Some(&rows[0].id),
                nothing_chosen()
            )
            .await
            .outcome,
            "refused"
        );
    }

    /// Start goes through the limits of `perch spawn`: past four live children it starts nothing and
    /// the task waits again with the reason on its card.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn start_is_refused_past_the_limits_and_the_task_waits_again_with_the_reason() {
        let run = run().await;
        let app = super::super::booted_state(run.address);
        let (workspace, nest) = {
            let row = run.db.get_session("lead").unwrap().unwrap();
            (
                run.db
                    .resolve_workspace(&row.workspace_id.unwrap())
                    .unwrap(),
                row.cwd,
            )
        };
        // The fixture's child is one; three more fill the four a lead may run.
        let lead = app
            .db
            .active_agent_identities()
            .unwrap()
            .into_iter()
            .find(|i| i.session_id == "lead")
            .unwrap();
        for n in 0..3 {
            let id: &'static str = Box::leak(format!("extra{n}").into_boxed_str());
            let crate::db::Reserved::New(_) = run
                .db
                .reserve_sub_session(&crate::db::SubSessionSpec {
                    child_session_id: id,
                    parent_session_id: "lead",
                    parent_incarnation: &lead.incarnation,
                    workspace: &workspace,
                    cwd: &nest,
                    provider_id: "codex",
                    model: None,
                    spawn_key: id,
                    task: "x",
                })
                .unwrap()
            else {
                panic!("recorded");
            };
        }
        let rows = card(&run, "k", 2);
        let before = run.db.sub_sessions_of("lead").unwrap().len();
        let started = act(
            &app,
            "lead",
            "start",
            &rows[0].card_id,
            Some(&rows[0].id),
            nothing_chosen(),
        )
        .await;
        assert_eq!(started.outcome, "refused", "{}", started.reason);
        assert!(
            started.reason.contains("already have 4"),
            "{}",
            started.reason
        );
        assert_eq!(
            run.db.sub_sessions_of("lead").unwrap().len(),
            before,
            "nothing was started"
        );
        let kept = run.db.suggestion(&rows[0].id).unwrap().unwrap();
        assert_eq!(kept.state, SuggestionState::Pending);
        assert!(kept.reason.contains("already have 4"));
        // Start all refuses each with the reason and reports none started.
        let all = act(
            &app,
            "lead",
            "start_all",
            &rows[0].card_id,
            None,
            nothing_chosen(),
        )
        .await;
        assert_eq!(all.outcome, "refused");
        assert_eq!(all.results.len(), 2);
        // An Options choice that is not an agent or model is refused before anything is recorded.
        for chosen in [
            Chosen {
                agent: Some("gemini".into()),
                model: None,
                worktree: None,
            },
            Chosen {
                agent: None,
                model: Some("--help".into()),
                worktree: None,
            },
        ] {
            let bad = act(
                &app,
                "lead",
                "start",
                &rows[0].card_id,
                Some(&rows[0].id),
                chosen,
            )
            .await;
            assert_eq!(bad.outcome, "refused");
            assert!(bad.results.is_empty());
        }
        // A lead that is not running cannot have a sub-session started under it.
        use crate::agent_identity::IdentityStore;
        app.db
            .revoke_session(&AgentKey::new(&workspace.id, "lead", "claude").unwrap())
            .unwrap();
        let stopped = act(
            &app,
            "lead",
            "start",
            &rows[1].card_id,
            Some(&rows[1].id),
            nothing_chosen(),
        )
        .await;
        assert!(stopped.reason.contains("not running"), "{}", stopped.reason);
        assert_eq!(
            run.db.suggestion(&rows[1].id).unwrap().unwrap().state,
            SuggestionState::Pending
        );
    }

    /// A task whose sub-session was already recorded under its key is that sub-session: a second Start
    /// follows it and starts nothing new.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn starting_a_task_again_follows_the_sub_session_its_key_made() {
        let run = run().await;
        let app = super::super::booted_state(run.address);
        let workspace = {
            let row = run.db.get_session("lead").unwrap().unwrap();
            run.db
                .resolve_workspace(&row.workspace_id.unwrap())
                .unwrap()
        };
        let rows = card(&run, "k", 1);
        let lead = app
            .db
            .active_agent_identities()
            .unwrap()
            .into_iter()
            .find(|i| i.session_id == "lead")
            .unwrap();
        let key = suggestions::spawn_key(&rows[0].id);
        let crate::db::Reserved::New(child) = run
            .db
            .reserve_sub_session(&crate::db::SubSessionSpec {
                child_session_id: "made",
                parent_session_id: "lead",
                parent_incarnation: &lead.incarnation,
                workspace: &workspace,
                cwd: "/tmp",
                provider_id: "codex",
                model: None,
                spawn_key: &key,
                task: "task 0",
            })
            .unwrap()
        else {
            panic!("recorded");
        };
        assert_eq!(child.child_session_id, "made");
        let before = run.db.sub_sessions_of("lead").unwrap().len();
        let started = act(
            &app,
            "lead",
            "start",
            &rows[0].card_id,
            Some(&rows[0].id),
            nothing_chosen(),
        )
        .await;
        assert_eq!(started.outcome, "started", "{}", started.reason);
        assert_eq!(started.results[0].child_session_id.as_deref(), Some("made"));
        assert_eq!(run.db.sub_sessions_of("lead").unwrap().len(), before);
        let card = &cards(&app, "lead")[0].items[0];
        assert_eq!(
            (card.state.as_str(), card.child_session_id.as_deref()),
            ("started", Some("made"))
        );
        assert!(card.dispatch.is_some());
        // Once started it cannot be started again.
        let again = act(
            &app,
            "lead",
            "start",
            &rows[0].card_id,
            Some(&rows[0].id),
            nothing_chosen(),
        )
        .await;
        assert_eq!(again.outcome, "refused");
    }

    /// With leads not allowed to start without asking, `perch spawn` is a card and starts nothing; with
    /// the setting on it is the spawn it always was.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn spawn_is_a_card_unless_the_person_let_leads_start_without_asking() {
        let run = run().await;
        let app = super::super::booted_state(run.address);
        app.settings
            .update(crate::settings::SettingsPatch {
                leads_start_without_asking: Some(false),
                ..Default::default()
            })
            .unwrap();
        let body = |key: &str| json!({"session": "lead", "agent": "codex", "model": "gpt-5.6-luna", "task": "fix the parser", "key": key});
        let before = run.db.sub_sessions_of("lead").unwrap().len();
        let (status, answer) = call(&run, "spawn", &run.lead_token, body("s1")).await;
        assert_eq!(status, 200, "{answer}");
        assert_eq!(answer["suggested"], true);
        assert_eq!(run.db.sub_sessions_of("lead").unwrap().len(), before);
        let rows = run.db.suggestions_of("lead").unwrap();
        assert_eq!(
            (
                rows[0].task.as_str(),
                rows[0].agent.as_str(),
                rows[0].model.as_deref()
            ),
            ("fix the parser", "codex", Some("gpt-5.6-luna"))
        );
        // The same key is the same card.
        let (_, again) = call(&run, "spawn", &run.lead_token, body("s1")).await;
        assert_eq!(again["duplicate"], true);
        assert_eq!(run.db.suggestions_of("lead").unwrap().len(), 1);
        // A sub-session still cannot spawn or suggest.
        let (status, _) = call(
            &run,
            "spawn",
            &run.child_token,
            json!({"session": "child", "agent": "codex", "task": "x", "key": "c"}),
        )
        .await;
        assert_eq!(status, 403);
        // With the setting on it is a spawn, admitted by the run's limits alone (any turn may spawn).
        // The limit is set to what the lead already has so the test starts no real agent.
        app.settings
            .update(crate::settings::SettingsPatch {
                leads_start_without_asking: Some(true),
                ..Default::default()
            })
            .unwrap();
        run.db.set_limits(crate::sub_sessions::RunLimits {
            live: 1,
            total: 1,
            ..Default::default()
        });
        let (status, answer) = call(&run, "spawn", &run.lead_token, body("s2")).await;
        assert_eq!(status, 409, "{answer}");
        assert!(answer["error"]
            .as_str()
            .unwrap()
            .contains("Settings > Sub-sessions"));
        assert!(answer.get("suggested").is_none(), "{answer}");
        assert_eq!(run.db.suggestions_of("lead").unwrap().len(), 1);
    }

    /// The cards a chat asks for are over the socket, local sessions only.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn the_cards_come_over_the_socket_and_an_act_without_the_lease_changes_nothing() {
        let root = std::env::temp_dir().join(format!("perch-suggest-ws-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let local_ui = crate::local_ui::LocalUi::in_process();
        let token = local_ui.token().to_string();
        let db_path = root.join("history.sqlite");
        let db = Arc::new(HistoryDb::open(&db_path).unwrap());
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
        super::super::sub_sessions::tests::lead_with_child(
            &db,
            &nest,
            crate::sub_sessions::SubState::Running,
        );
        let Added::New(rows) = db
            .add_suggestions("lead", "k", &[suggested("one")])
            .unwrap()
        else {
            panic!("a new card");
        };
        let (mut socket, _) = tokio_tungstenite::connect_async(
            crate::hub::socket_request(&format!("ws://{address}/ws"), Some(&token)).unwrap(),
        )
        .await
        .unwrap();
        let mut ask = async |message: Value, want: &str| -> Value {
            socket
                .send(tokio_tungstenite::tungstenite::Message::Text(
                    message.to_string(),
                ))
                .await
                .unwrap();
            loop {
                let next = tokio::time::timeout(Duration::from_secs(10), socket.next())
                    .await
                    .unwrap()
                    .unwrap()
                    .unwrap();
                let tokio_tungstenite::tungstenite::Message::Text(text) = next else {
                    continue;
                };
                let value: Value = serde_json::from_str(&text).unwrap();
                if value["type"] == want {
                    return value;
                }
            }
        };
        let state = ask(
            json!({"type": "suggestions.get", "requestId": "g", "sessionId": "lead"}),
            "suggestions.state",
        )
        .await;
        assert_eq!(state["cards"][0]["items"][0]["task"], "one");
        assert_eq!(state["cards"][0]["items"][0]["state"], "pending");
        let refused = ask(
            json!({"type": "suggestion.act", "requestId": "a", "sessionId": "lead", "action": "dismiss",
                   "cardId": rows[0].card_id, "suggestionId": rows[0].id, "generation": 1}),
            "suggestion.act.result",
        )
        .await;
        assert_eq!(refused["outcome"], "refused");
        assert!(
            refused["reason"].as_str().unwrap().contains("Take control"),
            "{refused}"
        );
        assert_eq!(
            db.suggestion(&rows[0].id).unwrap().unwrap().state,
            SuggestionState::Pending
        );
        let _ = std::fs::remove_dir_all(root);
    }
}
