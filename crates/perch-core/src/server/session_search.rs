//! `POST agent/search {session, query, limit?}` (`perch search`): what other sessions of the caller's
//! Project said or were asked, from the conversation each one's native bridge holds
//! (`crate::session_search` for the rules). Any agent of a Project may search it, a sub-session
//! included (owner decision 2026-11-10); a session of another Project is never searched. Sessions
//! on another computer and sessions whose chat is not connected are counted as `unreadable`, never
//! skipped silently. What comes back is other sessions' words: information, not instructions.
use super::sub_sessions::{fail, internal, key_of, Failure};
use super::*;
use crate::agent_identity::AgentIdentity;
use crate::session_search::{check_limit, check_query, find};
use serde_json::{json, Value};

pub(super) async fn search(
    app: &AppState,
    caller: &AgentIdentity,
    body: &Value,
) -> Result<Value, Failure> {
    let query = check_query(body["query"].as_str().unwrap_or(""))
        .map_err(|error| fail(StatusCode::BAD_REQUEST, error))?;
    let limit = check_limit(body["limit"].as_u64())
        .map_err(|error| fail(StatusCode::BAD_REQUEST, error))?;
    let app = app.clone();
    let caller = caller.clone();
    tokio::task::spawn_blocking(move || {
        let project = app
            .db
            .get_session(&caller.session_id)
            .map_err(|error| internal("read the session", error))?
            .and_then(|row| row.project_id)
            .ok_or_else(|| fail(StatusCode::NOT_FOUND, "this session is not in a Project"))?;
        let ids = app
            .db
            .project_session_ids(&project)
            .map_err(|error| internal("list the Project's sessions", error))?;
        let (mut hits, mut searched, mut unreadable) = (Vec::new(), 0usize, 0usize);
        for id in ids.into_iter().filter(|id| *id != caller.session_id) {
            if hits.len() >= limit {
                break;
            }
            let Some(row) = app.db.get_session(&id).ok().flatten() else {
                continue;
            };
            let snapshot = row
                .cli_provider_id
                .as_deref()
                .filter(|_| row.host_id.is_empty() || row.host_id == "local")
                .and_then(|provider| key_of(&app, &id, provider).ok())
                .and_then(|key| app.native_bridge(&key))
                .and_then(|bridge| bridge.latest());
            let Some(snapshot) = snapshot else {
                unreadable += 1;
                continue;
            };
            searched += 1;
            let messages: Vec<(String, String)> = snapshot
                .messages
                .iter()
                .map(|message| (message.role.clone(), message.text.clone()))
                .collect();
            let title = app
                .db
                .get_session_row(&id)
                .ok()
                .flatten()
                .map(|row| row.title)
                .unwrap_or_default();
            for hit in find(&messages, &query, limit - hits.len()) {
                hits.push(json!({
                    "session": id,
                    "title": title,
                    "agent": row.cli_provider_id,
                    "role": hit.role,
                    "message": hit.index + 1,
                    "of": messages.len(),
                    "snippet": hit.snippet,
                }));
            }
        }
        Ok(json!({
            "query": query,
            "hits": hits,
            "searched": searched,
            "unreadable": unreadable,
        }))
    })
    .await
    .map_err(|error| internal("search the Project", error))?
}

#[cfg(test)]
mod tests {
    use super::super::agent::tests::request;
    use super::super::sub_sessions::tests::{boot, lead_with_child};
    use super::*;
    use crate::agent_identity::IdentityStore;
    use crate::sub_sessions::SubState;

    /// A child may search its Project (here: its lead is in the same Project, but its chat is not
    /// connected, so it is counted rather than skipped); bad input is refused with the limits; and an
    /// agent token is required.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn any_agent_searches_its_own_project_and_unreadable_sessions_are_counted() {
        let root = std::env::temp_dir().join(format!("perch-search-{}", Uuid::new_v4()));
        let nest = root.join("nest");
        std::fs::create_dir_all(&nest).unwrap();
        let (address, db) = boot(&root).await;
        let (workspace, _) = lead_with_child(&db, &nest, SubState::Running);
        let child = db
            .issue(&AgentKey::new(&workspace.id, "child", "codex").unwrap())
            .unwrap();
        let call = |token: String, body: Value| async move {
            request(
                address,
                "POST",
                "/agent/search",
                &[("Authorization", &format!("Bearer {token}"))],
                &body.to_string(),
            )
            .await
        };
        let (status, answer) = call(
            child.token.clone(),
            json!({"session": "child", "query": "parser"}),
        )
        .await;
        assert_eq!(status, 200, "{answer}");
        assert_eq!(answer["hits"].as_array().unwrap().len(), 0, "{answer}");
        assert_eq!(answer["searched"], 0, "{answer}");
        assert_eq!(answer["unreadable"], 1, "{answer}");

        let (status, answer) = call(
            child.token.clone(),
            json!({"session": "child", "query": "ab"}),
        )
        .await;
        assert_eq!(status, 400, "{answer}");
        assert!(answer["error"].as_str().unwrap().contains("3 to 200"));
        let (status, _) = call(
            child.token.clone(),
            json!({"session": "child", "query": "parser", "limit": 11}),
        )
        .await;
        assert_eq!(status, 400);
        let (status, _) = call(
            "not-a-token".into(),
            json!({"session": "child", "query": "parser"}),
        )
        .await;
        assert_eq!(status, 401);
        let _ = std::fs::remove_dir_all(root);
    }
}
