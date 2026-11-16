//! The review's Git and review state, with no GPUI: the web's `gitReviewStore.ts` in Rust, so what a review shows
//! and the requests in flight belong to the host and outlive a screen reload or a clone swap.
//!
//! One [`WorkspaceReview`] per workspace, shared by every copy of the screen. Each request is a [`Ticket`]; the
//! caller sends [`Effect::Send`]'s frame to the core and hands the answer back with [`GitReviewStore::on_answer`],
//! or [`GitReviewStore::on_lost`] when the connection dropped it, or [`GitReviewStore::expire`] when it timed out.
//! Rules kept from the web:
//!
//! - A newer request of the same kind for the same workspace supersedes the older one: the older one's promise
//!   settles with nothing, and its late answer (or error) is consumed without touching the state.
//! - At most [`MAX_PENDING`] requests are pending; the oldest is settled to make room.
//! - A request lost with the connection or timed out becomes the state's error, and is never sent again.
//! - An action's result refreshes the status and the last diff.
//! - A comment is created only against the server-issued source revision of the diff it was made on.
//! - Batch delivery never goes back: `delivered` stays, `unconfirmed` gives way only to `delivered`, `claimed`
//!   does not fall back to `queued`.

use perch_core::review::{ReviewComment, ReviewSide};
use perch_core::source_control::{DiffFile, DiffTarget};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::{BTreeMap, HashMap};
use std::rc::Rc;
use std::time::Duration;

/// How long a request waits for the core.
pub const TIMEOUT: Duration = Duration::from_secs(30);
/// Most requests pending at once.
pub const MAX_PENDING: usize = 64;

/// One request, as the store numbers it.
pub type Ticket = u64;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Kind {
    Status,
    Refs,
    Diff,
    Action,
    Preview,
    Comments,
    Comment,
    Delete,
    BatchPreview,
    BatchSend,
}

/// What the store asks its owner to do.
#[derive(Debug, PartialEq)]
pub enum Effect {
    /// Send `frame` to the core (the owner adds the request id and the host) and answer `ticket` with its reply.
    Send { ticket: Ticket, frame: Value },
    /// The promise behind `ticket` settles with `value` (null when superseded, failed or lost).
    Settle { ticket: Ticket, value: Value },
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum LoadState {
    #[default]
    Idle,
    Loading,
    Ready,
    Error,
}

/// The diff a review shows: the core's `git.diff.result` without its kind and request id.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DiffSnapshot {
    pub workspace_id: String,
    pub target: DiffTarget,
    pub files: Vec<DiffFile>,
    pub hunk_count: usize,
    pub truncated: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_revision: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_revisions: Option<BTreeMap<String, String>>,
}

impl DiffSnapshot {
    /// The server-issued revision of `path`'s `side`, as the web store reads it: a per-source key when the diff has
    /// a map (`path:side`, `side:path`, `path`), else the scalar.
    pub fn source_revision_for(&self, path: &str, side: ReviewSide) -> Option<&str> {
        match &self.source_revisions {
            Some(map) => {
                let side = side.label();
                map.get(&format!("{path}:{side}"))
                    .or_else(|| map.get(&format!("{side}:{path}")))
                    .or_else(|| map.get(path))
                    .map(String::as_str)
            }
            None => self.source_revision.as_deref(),
        }
    }
}

/// One workspace's review (`WorkspaceGitReviewState`).
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceReview {
    pub status: Option<Value>,
    pub status_state: LoadState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_error: Option<String>,
    #[serde(skip)]
    pub diff: Option<Rc<DiffSnapshot>>,
    pub diff_state: LoadState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diff_error: Option<String>,
    #[serde(skip)]
    pub comments: Rc<Vec<ReviewComment>>,
    pub refs: Vec<Value>,
    pub action_state: LoadState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action_error: Option<String>,
    pub batch_delivery: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_session_id: Option<String>,
    pub last_agent_turn: Option<Value>,
    /// Bumped on every change, so a reader can keep its last answer until this moves.
    #[serde(skip)]
    pub revision: u64,
    /// Bumped when `diff` changes.
    #[serde(skip)]
    pub diff_revision: u64,
    /// Bumped when `comments` change.
    #[serde(skip)]
    pub comments_revision: u64,
}

struct Pending {
    workspace: String,
    kind: Kind,
}

#[derive(Clone, Debug, PartialEq)]
struct DiffRequest {
    target: DiffTarget,
    path: Option<String>,
    include_untracked: bool,
    ignore_whitespace: bool,
    context_lines: u32,
}

/// The input of a new comment (`createComment`).
pub struct NewComment {
    pub id: String,
    pub path: String,
    pub side: ReviewSide,
    pub start: u32,
    pub end: u32,
    pub body: String,
}

#[derive(Default)]
pub struct GitReviewStore {
    workspaces: HashMap<String, WorkspaceReview>,
    pending: BTreeMap<Ticket, Pending>,
    latest: HashMap<(Kind, String), Ticket>,
    last_diff: HashMap<String, DiffRequest>,
    next: Ticket,
}

const NO_REVISION: &str =
    "The diff has no server-issued source revision. Refresh the diff before commenting.";
const TIMED_OUT: &str = "The Git request timed out. Check the host connection and try again.";

impl GitReviewStore {
    pub fn workspace(&self, id: &str) -> Option<&WorkspaceReview> {
        self.workspaces.get(id)
    }

    /// Workspace `id`'s review, empty when nothing was asked yet.
    pub fn workspace_or_default(&self, id: &str) -> WorkspaceReview {
        self.workspaces.get(id).cloned().unwrap_or_default()
    }

    /// Each workspace's revision, to find the ones that moved since a reader last looked.
    pub fn revisions(&self) -> impl Iterator<Item = (&str, u64)> {
        self.workspaces
            .iter()
            .map(|(id, s)| (id.as_str(), s.revision))
    }

    pub fn pending_count(&self) -> usize {
        self.pending.len()
    }

    fn update(&mut self, id: &str, f: impl FnOnce(&mut WorkspaceReview)) {
        let state = self.workspaces.entry(id.to_string()).or_default();
        f(state);
        state.revision += 1;
    }

    fn mark_error(&mut self, id: &str, kind: Kind, message: &str) {
        self.update(id, |s| match kind {
            Kind::Status => {
                s.status_state = LoadState::Error;
                s.status_error = Some(message.into());
            }
            Kind::Diff => {
                s.diff_state = LoadState::Error;
                s.diff_error = Some(message.into());
            }
            _ => {
                s.action_state = LoadState::Error;
                s.action_error = Some(message.into());
            }
        });
    }

    fn set_action_loading(&mut self, id: &str) {
        self.update(id, |s| {
            s.action_state = LoadState::Loading;
            s.action_error = None;
        });
    }

    /// Starts a request; with `ready` false (no connection, or the host offers no Git) it fails at once.
    fn begin(
        &mut self,
        id: &str,
        kind: Kind,
        frame: Value,
        ready: bool,
        out: &mut Vec<Effect>,
    ) -> Option<Ticket> {
        if id.is_empty() {
            return None;
        }
        if !ready {
            self.mark_error(
                id,
                kind,
                "Git and review are unavailable until this host reconnects and advertises the Git protocol.",
            );
            return None;
        }
        self.next += 1;
        let ticket = self.next;
        if let Some(previous) = self.latest.insert((kind, id.to_string()), ticket) {
            if self.pending.remove(&previous).is_some() {
                out.push(Effect::Settle {
                    ticket: previous,
                    value: Value::Null,
                });
            }
        }
        while self.pending.len() >= MAX_PENDING {
            let Some((&oldest, _)) = self.pending.iter().next() else {
                break;
            };
            self.settle(oldest, out);
        }
        self.pending.insert(
            ticket,
            Pending {
                workspace: id.to_string(),
                kind,
            },
        );
        let mut frame = frame;
        frame["workspaceId"] = json!(id);
        out.push(Effect::Send { ticket, frame });
        Some(ticket)
    }

    fn settle(&mut self, ticket: Ticket, out: &mut Vec<Effect>) {
        if let Some(pending) = self.pending.remove(&ticket) {
            let key = (pending.kind, pending.workspace);
            if self.latest.get(&key) == Some(&ticket) {
                self.latest.remove(&key);
            }
            out.push(Effect::Settle {
                ticket,
                value: Value::Null,
            });
        }
    }

    /// Takes `ticket` out of the pending set: its request, and whether it was still the latest of its kind.
    fn finish(&mut self, ticket: Ticket) -> Option<(Pending, bool)> {
        let pending = self.pending.remove(&ticket)?;
        let key = (pending.kind, pending.workspace.clone());
        let latest = self.latest.get(&key) == Some(&ticket);
        if latest {
            self.latest.remove(&key);
        }
        Some((pending, latest))
    }

    // ---- requests ------------------------------------------------------------------------------------------------

    pub fn refresh_status(
        &mut self,
        id: &str,
        ready: bool,
        out: &mut Vec<Effect>,
    ) -> Option<Ticket> {
        let mut frame = json!({ "type": "git.status", "includeIgnored": false });
        if let Some(session) = self
            .workspaces
            .get(id)
            .and_then(|s| s.agent_session_id.clone())
        {
            frame["sessionId"] = json!(session);
        }
        self.update(id, |s| {
            s.status_state = LoadState::Loading;
            s.status_error = None;
        });
        self.begin(id, Kind::Status, frame, ready, out)
    }

    pub fn select_agent_session(
        &mut self,
        id: &str,
        session: Option<String>,
        ready: bool,
        out: &mut Vec<Effect>,
    ) {
        self.update(id, |s| {
            s.agent_session_id = session;
            s.last_agent_turn = None;
        });
        self.refresh_status(id, ready, out);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn load_diff(
        &mut self,
        id: &str,
        target: DiffTarget,
        path: Option<String>,
        include_untracked: bool,
        ignore_whitespace: bool,
        context_lines: u32,
        ready: bool,
        out: &mut Vec<Effect>,
    ) -> Option<Ticket> {
        let request = DiffRequest {
            target,
            path,
            include_untracked,
            ignore_whitespace,
            context_lines,
        };
        let mut frame = json!({
            "type": "git.diff",
            "target": request.target,
            "includeUntracked": include_untracked,
            "ignoreWhitespace": ignore_whitespace,
            "contextLines": context_lines,
        });
        if let Some(path) = &request.path {
            frame["path"] = json!(path);
        }
        self.last_diff.insert(id.to_string(), request);
        self.update(id, |s| {
            s.diff_state = LoadState::Loading;
            s.diff_error = None;
        });
        self.begin(id, Kind::Diff, frame, ready, out)
    }

    pub fn list_comments(
        &mut self,
        id: &str,
        ready: bool,
        out: &mut Vec<Effect>,
    ) -> Option<Ticket> {
        self.begin(
            id,
            Kind::Comments,
            json!({ "type": "review.list" }),
            ready,
            out,
        )
    }

    pub fn list_refs(&mut self, id: &str, ready: bool, out: &mut Vec<Effect>) -> Option<Ticket> {
        self.begin(id, Kind::Refs, json!({ "type": "git.refs" }), ready, out)
    }

    /// `git.stage` or `git.unstage` of `paths`.
    pub fn path_action(
        &mut self,
        id: &str,
        kind: &str,
        paths: Vec<String>,
        ready: bool,
        out: &mut Vec<Effect>,
    ) {
        if paths.is_empty() || !matches!(kind, "git.stage" | "git.unstage") {
            return;
        }
        self.set_action_loading(id);
        self.begin(
            id,
            Kind::Action,
            json!({ "type": kind, "paths": paths }),
            ready,
            out,
        );
    }

    pub fn discard(&mut self, id: &str, preview_id: &str, ready: bool, out: &mut Vec<Effect>) {
        self.set_action_loading(id);
        self.begin(
            id,
            Kind::Action,
            json!({ "type": "git.discard", "previewId": preview_id }),
            ready,
            out,
        );
    }

    pub fn commit(
        &mut self,
        id: &str,
        preview_id: &str,
        message: &str,
        ready: bool,
        out: &mut Vec<Effect>,
    ) {
        self.set_action_loading(id);
        let frame = json!({ "type": "git.commit", "previewId": preview_id, "message": message });
        self.begin(id, Kind::Action, frame, ready, out);
    }

    /// A preview receipt; the ticket's promise settles with it, or null.
    pub fn discard_preview(
        &mut self,
        id: &str,
        mode: &str,
        paths: Vec<String>,
        ready: bool,
        out: &mut Vec<Effect>,
    ) -> Option<Ticket> {
        if paths.is_empty() || !matches!(mode, "worktree" | "staged" | "all") {
            return None;
        }
        self.set_action_loading(id);
        let frame = json!({ "type": "git.discard.preview", "mode": mode, "paths": paths });
        self.begin(id, Kind::Preview, frame, ready, out)
    }

    pub fn commit_preview(
        &mut self,
        id: &str,
        message: &str,
        ready: bool,
        out: &mut Vec<Effect>,
    ) -> Option<Ticket> {
        let message = message.trim();
        if message.is_empty() {
            return None;
        }
        self.set_action_loading(id);
        self.begin(
            id,
            Kind::Preview,
            json!({ "type": "git.commit.preview", "message": message }),
            ready,
            out,
        )
    }

    /// `review.create` against the diff on show; `focused_session` names the comment's session unless the diff is
    /// the last agent turn's, whose session it then names.
    pub fn create_comment(
        &mut self,
        id: &str,
        input: NewComment,
        focused_session: Option<&str>,
        ready: bool,
        out: &mut Vec<Effect>,
    ) {
        let state = self.workspace_or_default(id);
        let Some(diff) = state.diff.as_deref() else {
            return self.mark_error(id, Kind::Comment, NO_REVISION);
        };
        let Some(revision) = diff.source_revision_for(&input.path, input.side) else {
            return self.mark_error(id, Kind::Comment, NO_REVISION);
        };
        let turn_session = state
            .last_agent_turn
            .as_ref()
            .and_then(|turn| match &diff.target {
                DiffTarget::Compare { base, head }
                    if turn["beforeRef"].as_str() == Some(base)
                        && turn["afterRef"].as_str() == head.as_deref() =>
                {
                    turn["sessionId"].as_str().map(str::to_string)
                }
                _ => None,
            });
        let session = turn_session.or_else(|| focused_session.map(str::to_string));
        let mut frame = json!({
            "type": "review.create",
            "id": input.id,
            "path": input.path,
            "base": diff.target,
            "baseRevision": revision,
            "side": input.side,
            "range": { "start": input.start, "end": input.end },
            "body": input.body,
        });
        if let Some(session) = session {
            frame["sessionId"] = json!(session);
        }
        self.set_action_loading(id);
        self.begin(id, Kind::Comment, frame, ready, out);
    }

    pub fn update_comment(
        &mut self,
        id: &str,
        comment: &str,
        body: &str,
        version: u64,
        ready: bool,
        out: &mut Vec<Effect>,
    ) {
        self.set_action_loading(id);
        let frame = json!({ "type": "review.update", "commentId": comment, "body": body, "expectedVersion": version });
        self.begin(id, Kind::Comment, frame, ready, out);
    }

    pub fn resolve_comment(
        &mut self,
        id: &str,
        comment: &str,
        resolved: bool,
        version: u64,
        ready: bool,
        out: &mut Vec<Effect>,
    ) {
        self.set_action_loading(id);
        let frame = json!({ "type": "review.resolve", "commentId": comment, "resolved": resolved, "expectedVersion": version });
        self.begin(id, Kind::Comment, frame, ready, out);
    }

    pub fn delete_comment(
        &mut self,
        id: &str,
        comment: &str,
        version: u64,
        ready: bool,
        out: &mut Vec<Effect>,
    ) {
        self.set_action_loading(id);
        let frame =
            json!({ "type": "review.delete", "commentId": comment, "expectedVersion": version });
        self.begin(id, Kind::Delete, frame, ready, out);
    }

    /// `review.batch.preview` with `input` as the screen sends it (`sendOperationId`, `targetSessionId`,
    /// `targetAgentId`, `currentRevision`, `instruction`).
    pub fn preview_batch(
        &mut self,
        id: &str,
        input: &Value,
        ready: bool,
        out: &mut Vec<Effect>,
    ) -> Option<Ticket> {
        let mut frame = json!({ "type": "review.batch.preview" });
        for key in [
            "sendOperationId",
            "targetSessionId",
            "targetAgentId",
            "currentRevision",
            "instruction",
        ] {
            if let Some(value) = input
                .get(key)
                .filter(|v| v.as_str().is_some_and(|s| !s.is_empty()))
            {
                frame[key] = value.clone();
            }
        }
        self.set_action_loading(id);
        self.begin(id, Kind::BatchPreview, frame, ready, out)
    }

    pub fn send_batch(
        &mut self,
        id: &str,
        packet: &str,
        operation: &str,
        ready: bool,
        out: &mut Vec<Effect>,
    ) -> Option<Ticket> {
        let queued =
            json!({ "packetId": packet, "sendOperationId": operation, "delivery": "queued" });
        self.update(id, |s| {
            s.batch_delivery = Some(merge_delivery(s.batch_delivery.as_ref(), queued))
        });
        self.set_action_loading(id);
        let frame = json!({ "type": "review.batch.send", "packetId": packet, "sendOperationId": operation });
        self.begin(id, Kind::BatchSend, frame, ready, out)
    }

    // ---- answers -------------------------------------------------------------------------------------------------

    /// The core's answer to `ticket`: the reply without its kind and request id, or its refusal. The `ready` flag
    /// is for the requests an action's result starts.
    pub fn on_answer(
        &mut self,
        ticket: Ticket,
        answer: Result<Value, String>,
        ready: bool,
        out: &mut Vec<Effect>,
    ) {
        let Some((pending, latest)) = self.finish(ticket) else {
            return;
        };
        if !latest {
            out.push(Effect::Settle {
                ticket,
                value: Value::Null,
            });
            return;
        }
        let id = pending.workspace.as_str();
        let reply = match answer {
            Ok(reply) => reply,
            Err(message) => {
                self.mark_error(id, pending.kind, &message);
                out.push(Effect::Settle {
                    ticket,
                    value: Value::Null,
                });
                return;
            }
        };
        let mut settle = Value::Null;
        match pending.kind {
            Kind::Status => {
                let session = self
                    .workspaces
                    .get(id)
                    .and_then(|s| s.agent_session_id.clone());
                let turn = reply
                    .as_object()
                    .and_then(|o| o.get("lastAgentTurn"))
                    .cloned();
                let status = status_snapshot(&reply["status"]);
                self.update(id, |s| {
                    s.status = Some(status);
                    s.status_state = LoadState::Ready;
                    s.status_error = None;
                    // Absent: an older reply that does not say; keep what we knew. Null: the core has none.
                    if let Some(turn) = turn {
                        // An older peer may ignore the session filter; never label another session's turn.
                        let mine = session
                            .as_deref()
                            .is_none_or(|session| turn["sessionId"].as_str() == Some(session));
                        s.last_agent_turn = (mine && !turn.is_null()).then_some(turn);
                    }
                });
            }
            Kind::Diff => match serde_json::from_value::<DiffSnapshot>(reply) {
                Ok(diff) => self.update(id, |s| {
                    s.diff = Some(Rc::new(diff));
                    s.diff_state = LoadState::Ready;
                    s.diff_error = None;
                    s.diff_revision += 1;
                }),
                Err(error) => self.mark_error(
                    id,
                    Kind::Diff,
                    &format!("The diff could not be read: {error}"),
                ),
            },
            Kind::Refs => self.update(id, |s| {
                s.refs = reply["refs"].as_array().cloned().unwrap_or_default();
                s.action_state = LoadState::Idle;
            }),
            Kind::Action => {
                let status = status_snapshot(&reply["receipt"]["status"]);
                self.update(id, |s| {
                    s.status = Some(status);
                    s.status_state = LoadState::Ready;
                    s.action_state = LoadState::Idle;
                    s.action_error = None;
                });
                self.refresh_status(id, ready, out);
                if let Some(last) = self.last_diff.get(id).cloned() {
                    self.load_diff(
                        id,
                        last.target,
                        last.path,
                        last.include_untracked,
                        last.ignore_whitespace,
                        last.context_lines,
                        ready,
                        out,
                    );
                }
            }
            Kind::Preview | Kind::BatchPreview => {
                settle = reply[if pending.kind == Kind::Preview {
                    "preview"
                } else {
                    "packet"
                }]
                .clone();
                self.update(id, |s| {
                    s.action_state = LoadState::Idle;
                    s.action_error = None;
                });
            }
            Kind::Comments => {
                let comments =
                    serde_json::from_value::<Vec<ReviewComment>>(reply["comments"].clone());
                match comments {
                    Ok(comments) => self.update(id, |s| {
                        s.comments = Rc::new(comments);
                        s.comments_revision += 1;
                        s.action_state = LoadState::Idle;
                        s.action_error = None;
                    }),
                    Err(error) => self.mark_error(
                        id,
                        Kind::Comments,
                        &format!("Comments could not be read: {error}"),
                    ),
                }
            }
            Kind::Comment => {
                match serde_json::from_value::<ReviewComment>(reply["comment"].clone()) {
                    Ok(comment) => self.update(id, |s| {
                        let mut list = (*s.comments).clone();
                        match list.iter_mut().find(|c| c.id == comment.id) {
                            Some(slot) => *slot = comment,
                            None => list.push(comment),
                        }
                        s.comments = Rc::new(list);
                        s.comments_revision += 1;
                        s.action_state = LoadState::Idle;
                        s.action_error = None;
                    }),
                    Err(error) => self.mark_error(
                        id,
                        Kind::Comment,
                        &format!("The comment could not be read: {error}"),
                    ),
                }
            }
            Kind::Delete => {
                if reply["deleted"].as_bool() == Some(true) {
                    let gone = reply["commentId"].as_str().unwrap_or_default().to_string();
                    self.update(id, |s| {
                        s.comments = Rc::new(
                            s.comments
                                .iter()
                                .filter(|c| c.id != gone)
                                .cloned()
                                .collect(),
                        );
                        s.comments_revision += 1;
                        s.action_state = LoadState::Idle;
                        s.action_error = None;
                    });
                }
            }
            Kind::BatchSend => {
                let mut delivery = Map::new();
                for key in [
                    "packetId",
                    "sendOperationId",
                    "delivery",
                    "targetSessionId",
                    "targetAgentId",
                ] {
                    if let Some(value) = reply.get(key).filter(|v| !v.is_null()) {
                        delivery.insert(key.into(), value.clone());
                    }
                }
                let delivery = Value::Object(delivery);
                settle = delivery.clone();
                self.update(id, |s| {
                    s.batch_delivery = Some(merge_delivery(s.batch_delivery.as_ref(), delivery));
                    s.action_state = LoadState::Idle;
                    s.action_error = None;
                });
            }
        }
        out.push(Effect::Settle {
            ticket,
            value: settle,
        });
    }

    /// `ticket`'s request went down with the connection: never replayed; the latest of its kind says so.
    pub fn on_lost(&mut self, ticket: Ticket, out: &mut Vec<Effect>) {
        let Some((pending, latest)) = self.finish(ticket) else {
            return;
        };
        out.push(Effect::Settle {
            ticket,
            value: Value::Null,
        });
        if latest {
            let message = match pending.kind {
                Kind::Status => {
                    "Git status lost its connection. Refresh after the host reconnects."
                }
                Kind::Refs => "Git refs lost their connection. Refresh after the host reconnects.",
                Kind::Diff => "The diff lost its connection. Refresh after the host reconnects.",
                Kind::Comments => return,
                _ => "The Git action lost its connection. Refresh before trying again.",
            };
            self.mark_error(&pending.workspace, pending.kind, message);
        }
    }

    /// `ticket` waited [`TIMEOUT`] with no answer.
    pub fn expire(&mut self, ticket: Ticket, out: &mut Vec<Effect>) {
        let Some((pending, latest)) = self.finish(ticket) else {
            return;
        };
        out.push(Effect::Settle {
            ticket,
            value: Value::Null,
        });
        if latest {
            self.mark_error(&pending.workspace, pending.kind, TIMED_OUT);
        }
    }

    /// The core's `review.batch.delivery` broadcast, from `host` (`local` for this computer's core), for a
    /// workspace on `workspace_host`.
    pub fn on_delivery(&mut self, message: &Value, host: &str, workspace_host: &str) {
        let Some(id) = message["workspaceId"].as_str() else {
            return;
        };
        let Some(current) = self
            .workspaces
            .get(id)
            .and_then(|s| s.batch_delivery.clone())
        else {
            return;
        };
        if host != workspace_host
            || current["packetId"] != message["packetId"]
            || current["sendOperationId"] != message["sendOperationId"]
        {
            return;
        }
        let mut next = message.clone();
        if let Some(object) = next.as_object_mut() {
            object.remove("type");
            object.remove("workspaceId");
            object.remove("hostId");
        }
        self.update(id, |s| {
            s.batch_delivery = Some(merge_delivery(Some(&current), next))
        });
    }
}

/// A status as the review shows it: the core's, with `dirty` and `conflicted` (`updateStatusFromWire`).
fn status_snapshot(status: &Value) -> Value {
    let mut status = status.clone();
    let entries = status["entries"].as_array().cloned().unwrap_or_default();
    let conflicted = entries
        .iter()
        .any(|e| e["index"] == "conflicted" || e["worktree"] == "conflicted");
    if let Some(object) = status.as_object_mut() {
        object.insert("dirty".into(), json!(!entries.is_empty()));
        object.insert("conflicted".into(), json!(conflicted));
    }
    status
}

/// `mergeBatchDelivery`: a delayed reply cannot undo an earlier confirmation.
fn merge_delivery(current: Option<&Value>, next: Value) -> Value {
    let Some(current) = current else { return next };
    if current["packetId"] != next["packetId"]
        || current["sendOperationId"] != next["sendOperationId"]
    {
        return next;
    }
    match (current["delivery"].as_str(), next["delivery"].as_str()) {
        (Some("delivered"), _) => current.clone(),
        (Some("unconfirmed"), next_state) if next_state != Some("delivered") => current.clone(),
        (Some("claimed"), Some("queued")) => current.clone(),
        _ => next,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const WS: &str = "workspace-test";

    fn status() -> Value {
        json!({ "workspaceId": WS, "root": "/tmp/review", "branch": "main",
                "head": "0123456789abcdef0123456789abcdef01234567", "entries": [] })
    }

    fn diff(target: DiffTarget, revision: Option<&str>) -> DiffSnapshot {
        DiffSnapshot {
            workspace_id: WS.into(),
            target,
            files: vec![],
            hunk_count: 0,
            truncated: false,
            source_revision: revision.map(str::to_string),
            source_revisions: None,
        }
    }

    fn seeded(diff: Option<DiffSnapshot>) -> GitReviewStore {
        let mut store = GitReviewStore::default();
        store.update(WS, |s| {
            s.status = Some(status_snapshot(&status()));
            s.status_state = LoadState::Ready;
            s.diff_state = if diff.is_some() {
                LoadState::Ready
            } else {
                LoadState::Idle
            };
            s.diff = diff.map(Rc::new);
        });
        store
    }

    /// The frame of the last `kind` sent.
    fn sent<'a>(out: &'a [Effect], kind: &str) -> (Ticket, &'a Value) {
        out.iter()
            .rev()
            .find_map(|e| match e {
                Effect::Send { ticket, frame } if frame["type"] == kind => Some((*ticket, frame)),
                _ => None,
            })
            .unwrap_or_else(|| panic!("no {kind} sent"))
    }

    fn settled(out: &[Effect], ticket: Ticket) -> Option<&Value> {
        out.iter().find_map(|e| match e {
            Effect::Settle { ticket: t, value } if *t == ticket => Some(value),
            _ => None,
        })
    }

    fn comment(path: &str) -> NewComment {
        NewComment {
            id: "comment-1".into(),
            path: path.into(),
            side: ReviewSide::New,
            start: 2,
            end: 2,
            body: "Please handle this case.".into(),
        }
    }

    fn state(store: &GitReviewStore) -> &WorkspaceReview {
        store.workspace(WS).unwrap()
    }

    #[test]
    fn correlated_git_error_is_surfaced() {
        let mut store = GitReviewStore::default();
        let mut out = vec![];
        let ticket = store.refresh_status(WS, true, &mut out).unwrap();
        store.on_answer(
            ticket,
            Err("workspace is not a Git repository".into()),
            true,
            &mut out,
        );
        assert_eq!(state(&store).status_state, LoadState::Error);
        assert!(state(&store)
            .status_error
            .as_deref()
            .unwrap()
            .contains("not a Git repository"));
    }

    #[test]
    fn comment_carries_the_exact_target_and_source_revision() {
        for (target, revision) in [
            (DiffTarget::WorkingTree, "rev-working-tree"),
            (DiffTarget::Staged, "rev-index"),
            (DiffTarget::Head, "rev-head"),
            (
                DiffTarget::Compare {
                    base: "main".into(),
                    head: Some("feature".into()),
                },
                "rev-compare",
            ),
        ] {
            let mut store = seeded(Some(diff(target.clone(), Some(revision))));
            let mut out = vec![];
            store.create_comment(
                WS,
                comment("src/main.ts"),
                Some("session-test"),
                true,
                &mut out,
            );
            let (_, frame) = sent(&out, "review.create");
            assert_eq!(frame["base"], json!(target));
            assert_eq!(frame["baseRevision"], revision);
            assert_eq!(frame["path"], "src/main.ts");
            assert_eq!(frame["range"], json!({ "start": 2, "end": 2 }));
            assert_eq!(frame["workspaceId"], WS);
        }
    }

    #[test]
    fn correlated_review_error_resolves_the_action() {
        let mut store = seeded(Some(diff(
            DiffTarget::WorkingTree,
            Some("rev-working-tree"),
        )));
        let mut out = vec![];
        store.create_comment(WS, comment("src/main.ts"), None, true, &mut out);
        let (ticket, _) = sent(&out, "review.create");
        store.on_answer(
            ticket,
            Err("the reviewed source changed".into()),
            true,
            &mut out,
        );
        let s = state(&store);
        assert_eq!(s.action_state, LoadState::Error);
        assert!(s
            .action_error
            .as_deref()
            .unwrap()
            .contains("reviewed source changed"));
        assert_eq!(s.status_state, LoadState::Ready, "status is independent");
        assert_eq!(s.diff_state, LoadState::Ready, "the diff is independent");
        assert_eq!(settled(&out, ticket), Some(&Value::Null));
    }

    #[test]
    fn git_error_reaches_the_git_state_once() {
        // The native client answers each request once, so the error lands on the review's state (the web's
        // "generic subscriber first" case has no counterpart); a second answer for the same ticket is ignored.
        let mut store = seeded(Some(diff(DiffTarget::WorkingTree, Some("rev"))));
        let mut out = vec![];
        store.create_comment(WS, comment("src/main.ts"), None, true, &mut out);
        let (ticket, _) = sent(&out, "review.create");
        store.on_answer(
            ticket,
            Err("the reviewed source changed".into()),
            true,
            &mut out,
        );
        store.on_answer(ticket, Err("again".into()), true, &mut out);
        assert!(state(&store)
            .action_error
            .as_deref()
            .unwrap()
            .contains("the reviewed source changed"));
    }

    #[test]
    fn comment_without_source_revision_is_refused() {
        let mut store = seeded(Some(diff(DiffTarget::WorkingTree, None)));
        let mut out = vec![];
        store.create_comment(WS, comment("src/main.ts"), None, true, &mut out);
        assert!(out.is_empty(), "nothing is sent");
        assert_eq!(state(&store).action_state, LoadState::Error);
        assert!(state(&store)
            .action_error
            .as_deref()
            .unwrap()
            .contains("server-issued source revision"));
    }

    #[test]
    fn status_reply_keeps_action_state() {
        let mut store = seeded(Some(diff(DiffTarget::WorkingTree, Some("rev"))));
        store.update(WS, |s| {
            s.action_state = LoadState::Error;
            s.action_error = Some("keep this action error".into());
        });
        let mut out = vec![];
        let ticket = store.refresh_status(WS, true, &mut out).unwrap();
        assert_eq!(
            state(&store).action_error.as_deref(),
            Some("keep this action error")
        );
        store.on_answer(
            ticket,
            Ok(json!({ "workspaceId": WS, "status": status() })),
            true,
            &mut out,
        );
        let s = state(&store);
        assert_eq!(s.status_state, LoadState::Ready);
        assert_eq!(s.action_state, LoadState::Error);
        assert_eq!(s.action_error.as_deref(), Some("keep this action error"));
        assert_eq!(s.status.as_ref().unwrap()["dirty"], false);
    }

    #[test]
    fn explicit_null_clears_turn_absent_key_keeps_it() {
        let mut store = seeded(Some(diff(DiffTarget::WorkingTree, Some("rev"))));
        let turn = json!({ "snapshotId": "snapshot-1", "sessionId": "session-test", "agent": "turnbot",
            "beforeRef": "ref-before", "afterRef": "ref-after", "changedPaths": ["src/main.txt"], "state": "complete" });
        let mut out = vec![];
        let mut status_reply = |store: &mut GitReviewStore, ticket: Ticket, turn: Option<Value>| {
            let mut reply = json!({ "workspaceId": WS, "status": status() });
            if let Some(turn) = turn {
                reply["lastAgentTurn"] = turn;
            }
            store.on_answer(ticket, Ok(reply), true, &mut out);
        };
        let cached = |store: &GitReviewStore| state(store).last_agent_turn.clone();
        let mut o = vec![];

        let t = store.refresh_status(WS, true, &mut o).unwrap();
        status_reply(&mut store, t, Some(turn.clone()));
        assert_eq!(cached(&store), Some(turn.clone()));
        let t = store.refresh_status(WS, true, &mut o).unwrap();
        status_reply(&mut store, t, None);
        assert_eq!(
            cached(&store),
            Some(turn.clone()),
            "an absent key keeps the summary"
        );
        let t = store.refresh_status(WS, true, &mut o).unwrap();
        status_reply(&mut store, t, Some(Value::Null));
        assert_eq!(cached(&store), None, "an explicit null clears it");

        // Changing session clears the old turn, supersedes the reply in flight and keeps the filter.
        let old = store.refresh_status(WS, true, &mut o).unwrap();
        store.select_agent_session(WS, Some("session-other".into()), true, &mut o);
        assert_eq!(sent(&o, "git.status").1["sessionId"], "session-other");
        status_reply(&mut store, old, Some(turn.clone()));
        assert_eq!(cached(&store), None);
        let t = store.refresh_status(WS, true, &mut o).unwrap();
        status_reply(&mut store, t, Some(turn.clone()));
        assert_eq!(
            cached(&store),
            None,
            "an older host's turn for another session is not taken"
        );
        let other = json!({ "snapshotId": "snapshot-1", "sessionId": "session-other", "agent": "turnbot",
            "beforeRef": "ref-before", "afterRef": "ref-after", "changedPaths": ["src/main.txt"], "state": "complete" });
        let t = store.refresh_status(WS, true, &mut o).unwrap();
        status_reply(&mut store, t, Some(other.clone()));
        assert_eq!(cached(&store), Some(other));
        assert_eq!(sent(&o, "git.status").1["sessionId"], "session-other");

        store.update(WS, |s| {
            s.diff = Some(Rc::new(diff(
                DiffTarget::Compare {
                    base: "ref-before".into(),
                    head: Some("ref-after".into()),
                },
                Some("turn-revision"),
            )))
        });
        store.create_comment(
            WS,
            comment("src/main.txt"),
            Some("session-test"),
            true,
            &mut o,
        );
        assert_eq!(
            sent(&o, "review.create").1["sessionId"],
            "session-other",
            "the turn's session"
        );
        store.select_agent_session(WS, None, true, &mut o);
        assert!(sent(&o, "git.status").1.get("sessionId").is_none());
        assert_eq!(cached(&store), None);
    }

    #[test]
    fn refs_keep_an_existing_action_error() {
        let mut store = seeded(None);
        store.update(WS, |s| {
            s.action_state = LoadState::Error;
            s.action_error = Some("keep this action error".into());
        });
        let mut out = vec![];
        let ticket = store.list_refs(WS, true, &mut out).unwrap();
        let refs = json!([{ "name": "main", "target": "abc123", "remote": false }]);
        store.on_answer(
            ticket,
            Ok(json!({ "workspaceId": WS, "refs": refs })),
            true,
            &mut out,
        );
        assert_eq!(json!(state(&store).refs), refs);
        assert_eq!(
            state(&store).action_error.as_deref(),
            Some("keep this action error")
        );
    }

    #[test]
    fn superseded_preview_settles_and_late_reply_is_ignored() {
        let mut store = GitReviewStore::default();
        let mut out = vec![];
        let first = store
            .commit_preview(WS, "first message", true, &mut out)
            .unwrap();
        let second = store
            .commit_preview(WS, "second message", true, &mut out)
            .unwrap();
        assert_eq!(
            settled(&out, first),
            Some(&Value::Null),
            "the superseded promise settles with nothing"
        );
        store.on_answer(first, Err("late first response".into()), true, &mut out);
        assert!(!state(&store)
            .action_error
            .clone()
            .unwrap_or_default()
            .contains("late first"));
        let receipt = json!({ "previewId": "preview-2", "operation": "commit", "workspaceId": WS,
            "paths": ["src/main.ts"], "status": status(), "expiresAt": 1, "message": "second message" });
        store.on_answer(second, Ok(json!({ "preview": receipt })), true, &mut out);
        assert_eq!(settled(&out, second), Some(&receipt));
        assert_eq!(state(&store).action_state, LoadState::Idle);
    }

    #[test]
    fn disconnect_clears_pending_and_never_replays() {
        let mut store = GitReviewStore::default();
        let mut out = vec![];
        let ticket = store
            .commit_preview(WS, "do not replay", true, &mut out)
            .unwrap();
        let sends = out.len();
        store.on_lost(ticket, &mut out);
        assert_eq!(settled(&out, ticket), Some(&Value::Null));
        assert_eq!(state(&store).action_state, LoadState::Error);
        assert!(state(&store)
            .action_error
            .as_deref()
            .unwrap()
            .contains("lost its connection"));
        assert!(
            out[sends..]
                .iter()
                .all(|e| !matches!(e, Effect::Send { .. })),
            "nothing is sent again"
        );
        let before = state(&store).revision;
        store.on_answer(ticket, Err("stale".into()), true, &mut out);
        assert_eq!(
            state(&store).revision,
            before,
            "a reply from the old connection changes nothing"
        );
        assert_eq!(store.pending_count(), 0);
    }

    #[test]
    fn delayed_claimed_reply_cannot_undo_delivered() {
        let mut store = GitReviewStore::default();
        let mut out = vec![];
        let ticket = store
            .send_batch(WS, "packet-test", "operation-test", true, &mut out)
            .unwrap();
        let outcome = json!({ "workspaceId": WS, "packetId": "packet-test", "sendOperationId": "operation-test",
            "delivery": "delivered", "targetSessionId": "session-test" });
        store.on_delivery(&outcome, "local", "local");
        assert_eq!(
            state(&store).batch_delivery.as_ref().unwrap()["delivery"],
            "delivered"
        );
        let mut claimed = outcome.clone();
        claimed["delivery"] = json!("claimed");
        store.on_answer(ticket, Ok(claimed), true, &mut out);
        assert_eq!(
            state(&store).batch_delivery.as_ref().unwrap()["delivery"],
            "delivered"
        );
        assert_eq!(
            out.iter()
                .filter(|e| matches!(e, Effect::Send { .. }))
                .count(),
            1,
            "no other send"
        );
    }

    #[test]
    fn delivery_is_scoped_to_host_and_packet() {
        let mut store = GitReviewStore::default();
        let mut out = vec![];
        let ticket = store
            .send_batch(WS, "current-packet", "current-operation", true, &mut out)
            .unwrap();
        let outcome = json!({ "workspaceId": WS, "packetId": "current-packet", "sendOperationId": "current-operation",
            "delivery": "delivered" });
        store.on_delivery(&outcome, "another-host", "local");
        let mut old = outcome.clone();
        old["packetId"] = json!("old-packet");
        store.on_delivery(&old, "local", "local");
        assert_eq!(
            state(&store).batch_delivery.as_ref().unwrap()["delivery"],
            "queued"
        );
        let mut unconfirmed = outcome.clone();
        unconfirmed["delivery"] = json!("unconfirmed");
        store.on_answer(ticket, Ok(unconfirmed), true, &mut out);
        let mut claimed = outcome.clone();
        claimed["delivery"] = json!("claimed");
        store.on_delivery(&claimed, "local", "local");
        assert_eq!(
            state(&store).batch_delivery.as_ref().unwrap()["delivery"],
            "unconfirmed"
        );
    }

    #[test]
    fn request_times_out_after_its_wait() {
        let mut store = GitReviewStore::default();
        let mut out = vec![];
        let ticket = store
            .load_diff(
                WS,
                DiffTarget::WorkingTree,
                None,
                true,
                false,
                3,
                true,
                &mut out,
            )
            .unwrap();
        store.expire(ticket, &mut out);
        assert_eq!(state(&store).diff_state, LoadState::Error);
        assert!(state(&store)
            .diff_error
            .as_deref()
            .unwrap()
            .contains("timed out"));
    }

    #[test]
    fn at_most_64_pending() {
        let mut store = GitReviewStore::default();
        let mut out = vec![];
        let first = store.refresh_status("w0", true, &mut out).unwrap();
        for i in 1..=MAX_PENDING {
            store.refresh_status(&format!("w{i}"), true, &mut out);
        }
        assert_eq!(store.pending_count(), MAX_PENDING);
        assert_eq!(
            settled(&out, first),
            Some(&Value::Null),
            "the oldest made room"
        );
    }

    #[test]
    fn action_result_refreshes_status_and_last_diff() {
        let mut store = GitReviewStore::default();
        let mut out = vec![];
        store.load_diff(
            WS,
            DiffTarget::Staged,
            Some("a.rs".into()),
            false,
            true,
            8,
            true,
            &mut out,
        );
        store.path_action(WS, "git.stage", vec!["a.rs".into()], true, &mut out);
        let (ticket, _) = sent(&out, "git.stage");
        let mut after = vec![];
        let receipt = json!({ "workspaceId": WS, "action": "stage", "paths": ["a.rs"], "commitId": null,
            "status": { "workspaceId": WS, "root": "/r", "entries": [{ "path": "a.rs", "index": "conflicted" }] } });
        store.on_answer(
            ticket,
            Ok(json!({ "workspaceId": WS, "receipt": receipt })),
            true,
            &mut after,
        );
        let s = state(&store);
        assert_eq!(s.status.as_ref().unwrap()["conflicted"], true);
        assert_eq!(s.action_state, LoadState::Idle);
        sent(&after, "git.status");
        let (_, diff) = sent(&after, "git.diff");
        assert_eq!(diff["target"], json!({ "kind": "staged" }));
        assert_eq!(
            (diff["path"].as_str(), diff["contextLines"].as_u64()),
            (Some("a.rs"), Some(8))
        );
        assert_eq!(diff["ignoreWhitespace"], true);
    }

    #[test]
    fn unavailable_host_fails_without_sending() {
        let mut store = GitReviewStore::default();
        let mut out = vec![];
        assert!(store.refresh_status(WS, false, &mut out).is_none());
        assert!(out.is_empty());
        assert!(state(&store)
            .status_error
            .as_deref()
            .unwrap()
            .contains("unavailable"));
    }

    #[test]
    fn per_source_revision_is_preferred() {
        let mut d = diff(DiffTarget::WorkingTree, Some("aggregate"));
        d.source_revisions = Some(BTreeMap::from([("a.rs:new".into(), "rev-a".into())]));
        assert_eq!(
            d.source_revision_for("a.rs", ReviewSide::New),
            Some("rev-a")
        );
        assert_eq!(
            d.source_revision_for("b.rs", ReviewSide::New),
            None,
            "a map without the path has no revision"
        );
    }
}
