//! Address-bar history of the built-in browser (`db/browser_history.rs`).
//! Local host only; a search is answered to the asking connection alone.

use super::*;
use crate::protocol::BrowserHistoryEntry;

/// Most suggestions one search returns.
const MAX_SUGGESTIONS: usize = 20;

pub(super) fn handle_record(state: &Arc<ConnState>, url: &str, title: &str, visit: bool) {
    if let Err(error) = state
        .app
        .db
        .record_browser_page(url, title, visit, now_millis() as i64)
    {
        tracing::warn!(%error, "could not record browser history");
    }
}

pub(super) fn handle_search(
    state: &Arc<ConnState>,
    request_id: String,
    query: &str,
    limit: Option<u32>,
) {
    let limit = (limit.unwrap_or(6) as usize).clamp(1, MAX_SUGGESTIONS);
    let entries = state
        .app
        .db
        .search_browser_history(query, limit, now_millis() as i64)
        .unwrap_or_else(|error| {
            tracing::warn!(%error, "could not search browser history");
            Vec::new()
        })
        .into_iter()
        .map(|row| BrowserHistoryEntry {
            url: row.url,
            title: row.title,
        })
        .collect();
    let _ = state.out_tx.send(ServerMessage::BrowserHistoryResult {
        request_id,
        entries,
    });
}

pub(super) fn handle_remove(state: &Arc<ConnState>, url: &str) {
    if let Err(error) = state.app.db.remove_browser_page(url) {
        tracing::warn!(%error, "could not remove browser history entry");
    }
}

pub(super) fn handle_clear(state: &Arc<ConnState>) {
    if let Err(error) = state.app.db.clear_browser_history() {
        tracing::warn!(%error, "could not clear browser history");
    }
}
