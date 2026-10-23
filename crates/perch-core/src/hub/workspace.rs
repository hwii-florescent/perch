//! Host-qualified workspace routing at the federation boundary. Remote cores
//! retain their own UUIDs/DBs; only browser-facing project/workspace IDs are
//! qualified. Paths, content, resource IDs and opaque viewer layouts are never
//! interpreted or rewritten. A qualified ID can never fall through locally.

use super::*;
use serde_json::{json, Value};

const PREFIX: &str = "remote:";

pub(crate) fn qualify(host: &str, id: &str) -> String {
    format!("{PREFIX}{}", json!([host, id]))
}

pub(crate) fn split(id: &str) -> Result<Option<(String, String)>, &'static str> {
    let Some(encoded) = id.strip_prefix(PREFIX) else {
        return Ok(None);
    };
    let (host, id): (String, String) =
        serde_json::from_str(encoded).map_err(|_| "malformed remote identity")?;
    if host.is_empty() || host == "local" || id.is_empty() || id.starts_with(PREFIX) {
        return Err("malformed remote identity");
    }
    Ok(Some((host, id)))
}

struct Pending {
    host: String,
    conn: String,
    request: Value,
    tx: Outbox,
    _budget: tokio::sync::OwnedSemaphorePermit,
}

pub(super) struct WorkspaceRelay {
    pending: Mutex<HashMap<String, Pending>>,
    budget: Arc<tokio::sync::Semaphore>,
}

impl Default for WorkspaceRelay {
    fn default() -> Self {
        Self {
            pending: Mutex::new(HashMap::new()),
            budget: Arc::new(tokio::sync::Semaphore::new(32 * 1024 * 1024)),
        }
    }
}

impl WorkspaceRelay {
    pub(super) fn unregister(&self, conn: &str) {
        self.pending
            .lock()
            .unwrap()
            .retain(|_, pending| pending.conn != conn);
    }
}

fn failure(request: &Value, code: &str, message: &str) -> ServerMessage {
    let mut reply = json!({
        "type": "error", "requestId": request["requestId"],
        "code": code, "message": message, "retryable": false,
    });
    if request["type"]
        .as_str()
        .is_some_and(|kind| kind.starts_with("fs."))
    {
        reply["type"] = json!("fs.error");
        reply["workspaceId"] = request["workspaceId"].clone();
        reply["path"] = request["path"].clone();
    }
    serde_json::from_value(reply).expect("valid relay failure")
}

/// Only these families have a workspace relay. Other qualified requests fail
/// explicitly (notably Context Bridge and runtime control).
fn capability(kind: &str) -> Option<&str> {
    match kind {
        "project.list"
        | "project.create"
        | "project.rename"
        | "project.remove"
        | "project.focus"
        | "workspace.snapshot"
        | "workspace.focus"
        | "workspace.rename"
        | "workspace.restore"
        | "workspace.pin"
        | "workspace.visibility"
        | "workspace.nest"
        | "fs.tree"
        | "fs.search"
        | "fs.read"
        | "fs.preview"
        | "fs.write"
        | "fs.buffer.list"
        | "fs.buffer.get"
        | "fs.buffer.set"
        | "fs.buffer.close"
        | "fs.mutate"
        | "fs.extract" => Some(kind),
        "worktree.create" => Some("worktree.startFrom"),
        "surface.open"
        | "surface.list"
        | "surface.close"
        | "surface.import"
        | "viewer.presentation.get"
        | "viewer.presentation.set" => Some("surface.v1"),
        kind if kind.starts_with("git.") || kind.starts_with("review.") => Some(kind),
        _ => None,
    }
}

/// Returns the remote target and a host-local request. Validate secondary
/// identities too: nesting across hosts is never a local DB operation.
fn target(request: &Value) -> Result<Option<(String, Value)>, &'static str> {
    let mut host = request["hostId"]
        .as_str()
        .filter(|host| !host.is_empty() && *host != "local")
        .map(str::to_string);
    let mut forwarded = request.clone();
    for key in ["workspaceId", "projectId", "parentWorkspaceId"] {
        if let Some(id) = request[key].as_str() {
            if let Some((owner, id)) = split(id)? {
                if host.as_ref().is_some_and(|host| host != &owner) {
                    return Err("identities belong to different hosts");
                }
                host = Some(owner);
                forwarded[key] = json!(id);
            }
        }
    }
    let Some(host) = host else { return Ok(None) };
    if request["hostId"]
        .as_str()
        .is_some_and(|explicit| !explicit.is_empty() && explicit != host)
    {
        return Err("explicit host does not match the remote identity");
    }
    // A local secondary identity must not be interpreted on a remote either.
    for key in ["workspaceId", "projectId", "parentWorkspaceId"] {
        if let Some(id) = request[key].as_str() {
            if split(id)?.is_none() {
                // Legacy Git/review APIs also accept cwd in workspaceId.
                if key != "workspaceId"
                    || !request["type"]
                        .as_str()
                        .is_some_and(|kind| kind.starts_with("git.") || kind.starts_with("review."))
                {
                    return Err("remote request requires host-qualified identities");
                }
            }
        }
    }
    forwarded.as_object_mut().unwrap().remove("hostId");
    Ok(Some((host, forwarded)))
}

fn id_field(value: &mut Value, key: &str, host: &str) {
    if let Some(id) = value[key].as_str() {
        value[key] = json!(qualify(host, id));
    }
}

fn row(value: &mut Value, host: &str, workspace: bool) {
    id_field(value, "id", host);
    value["hostId"] = json!(host);
    if workspace {
        id_field(value, "projectId", host);
        id_field(value, "parentWorkspaceId", host);
    }
}

/// Explicit payload locations only. In particular, never walk settings,
/// locators, file contents or presentation.layout looking for ID-like strings.
fn tag(reply: &mut Value, host: &str) {
    id_field(reply, "workspaceId", host);
    id_field(reply, "projectId", host);
    id_field(reply, "activeProjectId", host);
    id_field(reply, "activeWorkspaceId", host);
    if reply.get("hostId").is_some() || reply["type"] == "review.batch.delivery" {
        reply["hostId"] = json!(host);
    }
    if let Some(rows) = reply["projects"].as_array_mut() {
        for project in rows {
            row(project, host, false);
        }
    }
    if let Some(rows) = reply["workspaces"].as_array_mut() {
        for workspace in rows {
            row(workspace, host, true);
        }
    }
    if reply["project"].is_object() {
        row(&mut reply["project"], host, false);
    }
    if reply["workspace"].is_object() {
        row(&mut reply["workspace"], host, true);
    }
    for key in [
        "buffer",
        "currentBuffer",
        "presentation",
        "packet",
        "preview",
        "comment",
        "lastAgentTurn",
        "receipt",
    ] {
        if reply[key].is_object() {
            id_field(&mut reply[key], "workspaceId", host);
        }
    }
    for key in ["buffers", "comments"] {
        if let Some(rows) = reply[key].as_array_mut() {
            for row in rows {
                id_field(row, "workspaceId", host);
            }
        }
    }
    if reply["surface"].is_object() {
        id_field(&mut reply["surface"], "workspaceId", host);
        reply["surface"]["hostId"] = json!(host);
    }
    if let Some(surfaces) = reply["surfaces"].as_array_mut() {
        for surface in surfaces {
            id_field(surface, "workspaceId", host);
            surface["hostId"] = json!(host);
        }
    }
}

fn is_event(kind: &str) -> bool {
    matches!(
        kind,
        "project.updated"
            | "project.deleted"
            | "workspace.updated"
            | "fs.changed"
            | "review.batch.delivery"
    )
}

impl HubManager {
    /// Called before local dispatch. true means handled, including refusal.
    pub fn route_workspace_request(
        self: &Arc<Self>,
        conn: &str,
        tx: &Outbox,
        request: &crate::protocol::ClientMessage,
        raw: &str,
    ) -> bool {
        use crate::protocol::ClientMessage as C;
        // Keep terminal keystrokes/resize and large chat payloads off the JSON
        // adapter. Only resource/metadata operations cross this boundary.
        if !matches!(
            request,
            C::ProjectList { .. }
                | C::ProjectCreate { .. }
                | C::ProjectRename { .. }
                | C::ProjectRemove { .. }
                | C::ProjectFocus { .. }
                | C::WorkspaceSnapshot { .. }
                | C::WorkspaceFocus { .. }
                | C::WorkspaceRename { .. }
                | C::WorkspaceRestore { .. }
                | C::WorkspacePin { .. }
                | C::WorkspaceVisibility { .. }
                | C::WorkspaceNest { .. }
                | C::FsTree { .. }
                | C::FsSearch { .. }
                | C::FsRead { .. }
                | C::FsPreview { .. }
                | C::FsWrite { .. }
                | C::FsBufferList { .. }
                | C::FsBufferGet { .. }
                | C::FsBufferSet { .. }
                | C::FsBufferClose { .. }
                | C::FsMutate { .. }
                | C::FsExtract { .. }
                | C::SurfaceOpen { .. }
                | C::SurfaceList { .. }
                | C::SurfaceClose { .. }
                | C::SurfaceImport { .. }
                | C::ViewerPresentationGet { .. }
                | C::ViewerPresentationSet { .. }
                | C::GitStatus { .. }
                | C::GitRefs { .. }
                | C::GitDiff { .. }
                | C::GitStage { .. }
                | C::GitUnstage { .. }
                | C::GitDiscardPreview { .. }
                | C::GitDiscard { .. }
                | C::GitCommitPreview { .. }
                | C::GitCommit { .. }
                | C::ReviewList { .. }
                | C::ReviewCreate { .. }
                | C::ReviewUpdate { .. }
                | C::ReviewResolve { .. }
                | C::ReviewDelete { .. }
                | C::ReviewBatchPreview { .. }
                | C::ReviewBatchSend { .. }
                | C::WorktreeCreate { .. }
        ) {
            return false;
        }
        let request: Value = serde_json::from_str(raw).expect("validated client message");
        let kind = request["type"].as_str().unwrap_or_default();
        // Legacy explicit-host Git/worktree routing stays with its handlers.
        let has_qualified_id = ["workspaceId", "projectId", "parentWorkspaceId"]
            .iter()
            .any(|key| {
                request[key]
                    .as_str()
                    .is_some_and(|id| id.starts_with(PREFIX))
            });
        let metadata = kind.starts_with("project.") || kind == "workspace.snapshot";
        let explicit_host = request["hostId"]
            .as_str()
            .is_some_and(|host| !host.is_empty() && host != "local");
        let legacy = kind.starts_with("git.")
            || kind.starts_with("review.")
            || kind.starts_with("worktree.");
        if !has_qualified_id && !metadata && (!explicit_host || legacy) {
            return false;
        }
        let (host, mut forwarded) = match target(&request) {
            Ok(Some(value)) => value,
            Ok(None) => return false,
            Err(message) => {
                let _ = tx.send(failure(&request, "invalid_remote_identity", message));
                return true;
            }
        };
        let Some(capability) = capability(kind) else {
            let _ = tx.send(failure(
                &request,
                "unsupported_remote",
                "this operation is not relayed for remote workspaces",
            ));
            return true;
        };
        let supported = matches!(self.host_states.lock().unwrap().get(&host),
            Some(HostState::Connected(info)) if info.capabilities.iter().any(|cap| cap == capability));
        if !supported || !self.is_connected(&host) {
            let _ = tx.send(failure(&request, "remote_unavailable", "Remote workspace is disconnected or does not support this operation. No local operation was attempted."));
            return true;
        }
        let budget = u32::try_from(raw.len()).ok().and_then(|bytes| {
            self.workspace_relay
                .budget
                .clone()
                .try_acquire_many_owned(bytes)
                .ok()
        });
        let Some(budget) = budget else {
            let _ = tx.send(failure(
                &request,
                "remote_busy",
                "Remote workspace request budget exceeded. Nothing was queued.",
            ));
            return true;
        };
        let id = uuid::Uuid::new_v4().to_string();
        forwarded["requestId"] = json!(id);
        let pending = Pending {
            host: host.clone(),
            conn: conn.into(),
            // Keep correlation/error context, not another copy of file text.
            request: json!({"type":request["type"], "requestId":request["requestId"], "workspaceId":request["workspaceId"], "path":request["path"]}),
            tx: tx.clone(),
            _budget: budget,
        };
        // Register and enqueue under the connection lock, so disconnect cannot
        // miss an in-flight request. No mutation is queued for reconnect.
        let connections = self.connections.lock().unwrap();
        let connection = connections.get(&host);
        let mut requests = self.workspace_relay.pending.lock().unwrap();
        if requests.len() >= 128 {
            let _ = tx.send(failure(
                &pending.request,
                "remote_busy",
                "Too many pending remote workspace requests",
            ));
            return true;
        }
        if connection.is_none_or(|connection| connection.ws_tx.send(forwarded.to_string()).is_err())
        {
            let _ = tx.send(failure(
                &pending.request,
                "remote_unavailable",
                "Remote disconnected before the request could be sent",
            ));
            return true;
        }
        requests.insert(id.clone(), pending);
        drop(requests);
        drop(connections);
        let hub = Arc::downgrade(self);
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(30)).await;
            if let Some(hub) = hub.upgrade() {
                if let Some(pending) = hub.workspace_relay.pending.lock().unwrap().remove(&id) {
                    let _ = pending.tx.send(failure(&pending.request, "remote_outcome_unknown", "Remote reply timed out; the outcome is unknown. Refresh/reconcile before retrying a mutation."));
                }
            }
        });
        true
    }

    pub(super) fn fail_workspace_requests(&self, host: &str) {
        self.workspace_relay.pending.lock().unwrap().retain(|_, pending| {
            if pending.host != host { return true; }
            let _ = pending.tx.send(failure(&pending.request, "remote_outcome_unknown", "Remote disconnected; an in-flight operation may have completed. Reconcile before retrying. Your draft has not been discarded."));
            false
        });
    }

    /// Consume workspace replies/events before the legacy relay. Request IDs
    /// are rewritten per connection/host; a peer cannot answer another peer's
    /// request. Metadata events reach other viewers without a correlation ID.
    pub(super) fn relay_workspace_message(&self, host: &str, message: &ServerMessage) -> bool {
        if matches!(
            message,
            ServerMessage::TerminalData { .. }
                | ServerMessage::ChatChunk { .. }
                | ServerMessage::ChatThinking { .. }
                | ServerMessage::SessionHistory { .. }
        ) {
            return false;
        }
        let mut reply = serde_json::to_value(message).expect("server message serializes");
        let kind = reply["type"].as_str().unwrap_or_default().to_string();
        let event = is_event(&kind);
        let mut requests = self.workspace_relay.pending.lock().unwrap();
        let key = reply["requestId"].as_str().unwrap_or_default().to_string();
        let pending = requests.get(&key).filter(|pending| pending.host == host);
        if let Some(pending) = pending {
            tag(&mut reply, host);
            reply["requestId"] = pending.request["requestId"].clone();
            if let Ok(message) = serde_json::from_value(reply.clone()) {
                let _ = pending.tx.send(message);
            }
            // project.create emits two row events before its terminal snapshot.
            let intermediate = pending.request["type"] == "project.create"
                && matches!(kind.as_str(), "project.updated" | "workspace.updated");
            if !intermediate {
                requests.remove(&key);
            }
            drop(requests);
            if event {
                reply.as_object_mut().unwrap().remove("requestId");
                if let Ok(message) = serde_json::from_value(reply) {
                    let _ = self.hub_events_tx.send(Arc::new(message));
                }
            }
            return true;
        }
        drop(requests);
        if event {
            tag(&mut reply, host);
            reply.as_object_mut().unwrap().remove("requestId");
            if let Ok(message) = serde_json::from_value(reply) {
                let _ = self.hub_events_tx.send(Arc::new(message));
            }
            return true;
        }
        // Drop unowned/late replies. The legacy relay still owns its own
        // request families; only the new workspace families are consumed here.
        kind.starts_with("project.")
            || (kind.starts_with("workspace.") && kind != "workspace.git")
            || (kind.starts_with("fs.") && kind != "fs.browse.result")
            || kind.starts_with("surface.")
            || kind == "viewer.presentation"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn connected() -> (
        Arc<HubManager>,
        tokio::sync::mpsc::UnboundedReceiver<String>,
    ) {
        let hub = HubManager::new(1);
        let (ws_tx, ws_rx) = tokio::sync::mpsc::unbounded_channel();
        hub.connections.lock().unwrap().insert(
            "a".into(),
            Arc::new(HubConnection {
                host_id: "a".into(),
                ws_tx,
            }),
        );
        hub.set_host_state(
            "a",
            "remote",
            HostState::Connected(RemoteInfo {
                hostname: "test".into(),
                platform: "linux".into(),
                is_ssh: false,
                claude_models: vec![],
                codex_models: vec![],
                capabilities: vec!["project.create".into(), "fs.read".into(), "fs.write".into()],
            }),
        );
        (hub, ws_rx)
    }

    fn route(hub: &Arc<HubManager>, conn: &str, tx: &Outbox, request: Value) {
        let raw = request.to_string();
        let message = serde_json::from_value(request).unwrap();
        assert!(hub.route_workspace_request(conn, tx, &message, &raw));
    }

    #[tokio::test]
    async fn same_browser_request_id_is_isolated_and_disconnect_is_unknown_not_retried() {
        let (hub, mut remote) = connected();
        let (one, mut rx_one) = crate::ws_outbox::channel();
        let (two, mut rx_two) = crate::ws_outbox::channel();
        for (conn, tx, path) in [("one", &one, "one"), ("two", &two, "two")] {
            route(
                &hub,
                conn,
                tx,
                json!({"type":"fs.read", "requestId":"same", "workspaceId":qualify("a", "w"), "path":path}),
            );
        }
        let first: Value = serde_json::from_str(&remote.recv().await.unwrap()).unwrap();
        let second: Value = serde_json::from_str(&remote.recv().await.unwrap()).unwrap();
        assert_ne!(first["requestId"], second["requestId"]);
        assert_eq!(first["workspaceId"], "w");
        let reply: ServerMessage = serde_json::from_value(json!({"type":"fs.error", "requestId":first["requestId"], "workspaceId":"w", "code":"test", "message":"one"})).unwrap();
        hub.relay_workspace_message("wrong-host", &reply);
        assert!(rx_one.try_recv().is_err());
        hub.relay_workspace_message("a", &reply);
        let received: Value = serde_json::from_str(&rx_one.recv().await.unwrap().0).unwrap();
        assert_eq!(received["requestId"], "same");
        assert_eq!(received["workspaceId"], qualify("a", "w"));
        assert!(rx_two.try_recv().is_err());
        hub.fail_workspace_requests("a");
        let received: Value = serde_json::from_str(&rx_two.recv().await.unwrap().0).unwrap();
        assert_eq!(received["code"], "remote_outcome_unknown");
        assert!(remote.try_recv().is_err());
        assert!(hub.workspace_relay.pending.lock().unwrap().is_empty());
        // A late reply cannot acknowledge a later operation using the same browser ID.
        hub.relay_workspace_message("a", &reply);
        assert!(rx_one.try_recv().is_err());
    }

    #[tokio::test]
    async fn unavailable_or_malformed_remote_requests_never_fall_through() {
        let hub = HubManager::new(1);
        let (tx, mut rx) = crate::ws_outbox::channel();
        for id in [
            qualify("absent", "local-looking-id"),
            "remote:broken".into(),
        ] {
            route(
                &hub,
                "one",
                &tx,
                json!({"type":"fs.write", "requestId":"write", "workspaceId":id, "path":"file", "content":"preserve"}),
            );
            let message: Value = serde_json::from_str(&rx.recv().await.unwrap().0).unwrap();
            assert_eq!(message["type"], "fs.error");
            assert_eq!(message["workspaceId"], id);
        }
    }

    #[tokio::test]
    async fn project_create_keeps_correlation_until_its_snapshot() {
        let (hub, mut remote) = connected();
        let (tx, mut rx) = crate::ws_outbox::channel();
        let mut events = hub.subscribe_events();
        route(
            &hub,
            "one",
            &tx,
            json!({"type":"project.create", "requestId":"create", "hostId":"a", "path":"/remote"}),
        );
        let forwarded: Value = serde_json::from_str(&remote.recv().await.unwrap()).unwrap();
        let request_id = forwarded["requestId"].as_str().unwrap();
        // Use the real protocol to make sure field spelling/defaults agree.
        let row: ServerMessage = serde_json::from_value(json!({"type":"project.updated", "requestId":request_id, "snapshotEpoch":"epoch", "snapshotRevision":1, "project":{"id":"p", "hostId":"local", "name":"test", "path":"/remote", "favorite":false,"createdAt":1,"updatedAt":1}})).unwrap();
        assert!(hub.relay_workspace_message("a", &row));
        assert!(hub
            .workspace_relay
            .pending
            .lock()
            .unwrap()
            .contains_key(request_id));
        let correlated: Value = serde_json::from_str(&rx.recv().await.unwrap().0).unwrap();
        assert_eq!(correlated["requestId"], "create");
        let event = serde_json::to_value(&*events.recv().await.unwrap()).unwrap();
        assert!(event.get("requestId").is_none());
        assert_eq!(event["project"]["id"], qualify("a", "p"));
        let snapshot: ServerMessage = serde_json::from_value(json!({"type":"workspace.snapshot", "requestId":request_id, "hostId":"local", "snapshotEpoch":"epoch", "snapshotRevision":1,"projects":[],"workspaces":[]})).unwrap();
        assert!(hub.relay_workspace_message("a", &snapshot));
        assert!(hub.workspace_relay.pending.lock().unwrap().is_empty());
        assert_eq!(
            serde_json::from_str::<Value>(&rx.recv().await.unwrap().0).unwrap()["hostId"],
            "a"
        );
    }

    #[test]
    fn identities_are_unambiguous_and_fail_closed() {
        let id = qualify("host:with/quotes\"", "workspace");
        assert_eq!(
            split(&id),
            Ok(Some(("host:with/quotes\"".into(), "workspace".into())))
        );
        assert_eq!(split("local-uuid"), Ok(None));
        for bad in [
            "remote:",
            "remote:[]",
            "remote:[\"local\",\"w\"]",
            "remote:[\"h\",\"\"]",
        ] {
            assert!(split(bad).is_err());
        }
        assert!(split(&qualify("h", &id)).is_err());
    }

    #[test]
    fn requests_decode_only_same_host_identities() {
        let request = json!({"type":"workspace.nest", "workspaceId":qualify("a", "w"), "parentWorkspaceId":qualify("a", "p")});
        let (host, decoded) = target(&request).unwrap().unwrap();
        assert_eq!(host, "a");
        assert_eq!(decoded["workspaceId"], "w");
        assert_eq!(decoded["parentWorkspaceId"], "p");
        for parent in [json!(qualify("b", "p")), json!("local-parent")] {
            let mut bad = request.clone();
            bad["parentWorkspaceId"] = parent;
            assert!(target(&bad).is_err());
        }
        let mut bad = request;
        bad["hostId"] = json!("b");
        assert!(target(&bad).is_err());
    }

    #[test]
    fn nested_rows_buffers_and_surfaces_are_qualified_but_layouts_are_opaque() {
        let mut reply = json!({"workspaceId":"w", "hostId":"forged", "projects":[{"id":"p","hostId":"local"}], "workspaces":[{"id":"w","projectId":"p","parentWorkspaceId":"parent"}], "currentBuffer":{"workspaceId":"w","content":"workspaceId"}, "surface":{"workspaceId":"w","hostId":"local","id":"resource"}, "presentation":{"workspaceId":"w","layout":{"workspaceId":"opaque"}}});
        tag(&mut reply, "a");
        assert_eq!(reply["workspaceId"], qualify("a", "w"));
        assert_eq!(reply["projects"][0]["id"], qualify("a", "p"));
        assert_eq!(
            reply["workspaces"][0]["parentWorkspaceId"],
            qualify("a", "parent")
        );
        assert_eq!(reply["currentBuffer"]["workspaceId"], qualify("a", "w"));
        assert_eq!(reply["surface"]["hostId"], "a");
        assert_eq!(reply["surface"]["id"], "resource");
        assert_eq!(reply["presentation"]["layout"]["workspaceId"], "opaque");
    }
}
