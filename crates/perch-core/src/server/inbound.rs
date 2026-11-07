//! Inbound control on the core: what a session does with messages other sessions send it (accept,
//! hold for its person, refuse), and the person's Deliver and Discard for what is held. The rules
//! are `crate::agent_mail` (`InboundMode`, `gate`), the records `db/agent_mail.rs`, the contract
//! ARCHITECTURE ("Inbound control"). Own design (slice 9d).
//!
//! The mode is enforced where mail is admitted (`HistoryDb::admit_mail`) and, when it changes, on
//! what already waits (`set_inbound_mode`); the delivery engine never sees a held message. A
//! person's own text and Perch's status notes are never affected. Delivering a held message only
//! puts it in the queue: it is then delivered like any other, when its receiver is idle.
use super::sub_sessions::key_of;
use super::*;
use crate::agent_mail::{self, InboundMode};
use crate::protocol::HeldMessage;

/// Tell every client showing this session that its mode or its held messages changed.
fn announce(app: &AppState, session_id: &str) {
    let _ = app
        .hub
        .hub_events_tx
        .send(Arc::new(ServerMessage::InboundChanged {
            session_id: session_id.to_string(),
        }));
}

fn is_local(row: &crate::db::SessionRow) -> bool {
    row.host_id.is_empty() || row.host_id == "local"
}

/// What the person is shown of one held message: the text, cut to a preview when it was long.
fn held_message(row: &crate::db::MailRow) -> HeldMessage {
    let long = !agent_mail::fits_inline(&row.body);
    HeldMessage {
        id: row.id.clone(),
        from_session_id: row.sender_session_id.clone(),
        from_provider: row.sender_provider.clone(),
        from_label: row.sender_label.clone(),
        text: if long {
            agent_mail::preview(&row.body)
        } else {
            row.body.clone()
        },
        truncated: long,
        at: row.created_at,
    }
}

/// `inbound.get`.
pub(super) fn handle_get(state: &Arc<ConnState>, request_id: String, session_id: String) {
    let state = state.clone();
    tokio::task::spawn_blocking(move || {
        let local = state
            .app
            .db
            .get_session(&session_id)
            .ok()
            .flatten()
            .is_some_and(|row| is_local(&row));
        let (mode, held, error) = if local {
            let mode = state.app.db.inbound_mode(&session_id).unwrap_or_default();
            let held = state
                .app
                .db
                .held_mail_for(&session_id)
                .unwrap_or_default()
                .iter()
                .map(held_message)
                .collect();
            (mode, held, None)
        } else {
            (
                InboundMode::default(),
                Vec::new(),
                Some("that session is not on this computer".to_string()),
            )
        };
        let _ = state.out_tx.send(ServerMessage::InboundState {
            request_id,
            session_id,
            mode: mode.as_str().to_string(),
            held,
            error,
        });
    });
}

/// What an action came to: `Err` is the reason nothing changed.
fn act(
    state: &Arc<ConnState>,
    session_id: &str,
    action: &str,
    mode: Option<&str>,
    message_id: Option<&str>,
    generation: Option<u64>,
) -> Result<u32, String> {
    let app = &state.app;
    let row = app
        .db
        .get_session(session_id)
        .ok()
        .flatten()
        .ok_or("that session no longer exists")?;
    if !is_local(&row) {
        return Err("inbound control is for sessions on this computer".into());
    }
    if action == "set_mode" {
        let mode = mode
            .and_then(InboundMode::parse)
            .ok_or("the mode is accept, hold or refuse")?;
        return app
            .db
            .set_inbound_mode(session_id, mode)
            .map(|moved| moved as u32)
            .map_err(|error| error.to_string());
    }
    // Delivering or discarding is a decision about text that would be typed into the session, so it
    // needs the chat's input lease, as typing in it does.
    let provider = row
        .cli_provider_id
        .clone()
        .ok_or("that session is not an agent chat")?;
    let key = key_of(app, session_id, &provider).map_err(|(_, error)| error)?;
    if !generation
        .is_some_and(|generation| super::crew_actions::holds_input_lease(state, &key, generation))
    {
        return Err("Take control of this chat before answering a held message".into());
    }
    let held = app
        .db
        .held_mail_for(session_id)
        .map_err(|error| error.to_string())?;
    let targets: Vec<&crate::db::MailRow> = match (action, message_id) {
        ("deliver" | "discard", Some(id)) => held.iter().filter(|row| row.id == id).collect(),
        ("deliver" | "discard", None) => return Err("say which message".into()),
        ("deliver_all" | "discard_all", _) => held.iter().collect(),
        _ => return Err("unknown action".into()),
    };
    let deliver = action.starts_with("deliver");
    let mut moved = 0;
    for mail in targets {
        let done = if deliver {
            app.db.release_held_mail(session_id, &mail.id)
        } else {
            app.db.discard_held_mail(session_id, &mail.id)
        }
        .map_err(|error| error.to_string())?;
        if done {
            moved += 1;
            // The sender's receipt changed.
            super::notify_session_updated(app, &mail.sender_session_id);
        }
    }
    if moved == 0 {
        return Err("that message was already answered".into());
    }
    if deliver {
        app.mail_notify.notify_one();
    }
    Ok(moved)
}

/// `inbound.act` from a person's chat or the sidebar.
pub(super) fn handle_act(
    state: &Arc<ConnState>,
    request_id: String,
    session_id: String,
    action: String,
    mode: Option<String>,
    message_id: Option<String>,
    generation: Option<u64>,
) {
    let state = state.clone();
    tokio::task::spawn_blocking(move || {
        let result = act(
            &state,
            &session_id,
            &action,
            mode.as_deref(),
            message_id.as_deref(),
            generation,
        );
        let (outcome, reason, count) = match &result {
            Ok(count) => ("done", String::new(), *count),
            Err(reason) => ("refused", reason.clone(), 0),
        };
        if result.is_ok() {
            // The sidebar row shows the mode; the chat shows what is held.
            super::notify_session_updated(&state.app, &session_id);
            announce(&state.app, &session_id);
        }
        let _ = state.out_tx.send(ServerMessage::InboundActResult {
            request_id,
            session_id,
            action,
            outcome: outcome.into(),
            reason,
            count,
        });
    });
}

#[cfg(test)]
mod tests {
    use super::super::agent::tests::request;
    use super::*;
    use crate::agent_fleet::AgentKey;
    use crate::agent_identity::IdentityStore;
    use futures::{SinkExt, StreamExt};
    use serde_json::{json, Value};
    use std::time::Duration;

    /// A booted core with a lead and a child, and a socket open as the person's chat.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_session_holds_what_other_sessions_send_until_its_person_answers() {
        let root = std::env::temp_dir().join(format!("perch-inbound-ws-{}", Uuid::new_v4()));
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
        let (workspace, _) = super::super::sub_sessions::tests::lead_with_child(
            &db,
            &nest,
            crate::sub_sessions::SubState::Running,
        );
        let lead = db
            .issue(&AgentKey::new(&workspace.id, "lead", "claude").unwrap())
            .unwrap();
        let child = db
            .issue(&AgentKey::new(&workspace.id, "child", "codex").unwrap())
            .unwrap();
        let send = async |token: &str, route: &str, body: Value| -> (u16, Value) {
            request(
                address,
                "POST",
                &format!("/agent/{route}"),
                &[("Authorization", &format!("Bearer {token}"))],
                &body.to_string(),
            )
            .await
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

        // The person sets the child to hold, with no lease: a setting, not a keystroke.
        let set = ask(
            json!({"type": "inbound.act", "requestId": "1", "sessionId": "child",
                   "action": "set_mode", "mode": "hold"}),
            "inbound.act.result",
        )
        .await;
        assert_eq!(set["outcome"], "done", "{set}");
        assert_eq!(db.inbound_mode("child").unwrap(), InboundMode::Hold);

        // The lead's message is held, and the receipt says so.
        let (status, sent) = send(
            &lead.token,
            "send",
            json!({"session": "lead", "target": "child", "text": "please also run the tests", "key": "k1"}),
        )
        .await;
        assert_eq!(status, 200, "{sent}");
        assert_eq!(sent["state"], "held", "{sent}");
        // The child's own inbox does not show it: it is not the child's to read yet.
        let (_, inbox) = send(&child.token, "inbox", json!({"session": "child"})).await;
        assert_eq!(inbox["received"].as_array().unwrap().len(), 0, "{inbox}");

        // The person's chat is shown what is held.
        let shown = ask(
            json!({"type": "inbound.get", "requestId": "2", "sessionId": "child"}),
            "inbound.state",
        )
        .await;
        assert_eq!(shown["mode"], "hold");
        assert_eq!(shown["held"][0]["text"], "please also run the tests");
        assert_eq!(shown["held"][0]["fromSessionId"], "lead");
        let held_id = shown["held"][0]["id"].as_str().unwrap().to_string();

        // Deliver and Discard need the chat's input lease; without it nothing changes.
        for action in ["deliver", "discard", "deliver_all"] {
            let refused = ask(
                json!({"type": "inbound.act", "requestId": "3", "sessionId": "child",
                       "action": action, "messageId": held_id, "generation": 1}),
                "inbound.act.result",
            )
            .await;
            assert_eq!(refused["outcome"], "refused", "{refused}");
            assert!(
                refused["reason"].as_str().unwrap().contains("Take control"),
                "{refused}"
            );
        }
        assert_eq!(db.held_mail_for("child").unwrap().len(), 1);

        // Bad requests are refused in words.
        for (session, mode) in [("child", "maybe"), ("nobody", "refuse")] {
            let bad = ask(
                json!({"type": "inbound.act", "requestId": "4", "sessionId": session,
                       "action": "set_mode", "mode": mode}),
                "inbound.act.result",
            )
            .await;
            assert_eq!(bad["outcome"], "refused", "{bad}");
        }

        // Refuse: the next message is turned away, receipted `undelivered: refused`.
        let refuse = ask(
            json!({"type": "inbound.act", "requestId": "6", "sessionId": "child",
                   "action": "set_mode", "mode": "refuse"}),
            "inbound.act.result",
        )
        .await;
        assert_eq!(refuse["outcome"], "done");
        let (_, turned) = send(
            &lead.token,
            "send",
            json!({"session": "lead", "target": "child", "text": "and this", "key": "k3"}),
        )
        .await;
        assert_eq!(turned["state"], "undelivered", "{turned}");
        assert!(
            turned["reason"].as_str().unwrap().starts_with("refused"),
            "{turned}"
        );
        // The sender sees it in its own inbox; the receiver does not.
        let (_, lead_inbox) = send(&lead.token, "inbox", json!({"session": "lead"})).await;
        assert!(lead_inbox["sent"]
            .as_array()
            .unwrap()
            .iter()
            .any(|row| row["state"] == "undelivered"));
        let (_, child_inbox) = send(&child.token, "inbox", json!({"session": "child"})).await;
        assert_eq!(
            child_inbox["received"].as_array().unwrap().len(),
            0,
            "{child_inbox}"
        );
        let _ = std::fs::remove_dir_all(root);
    }
}
