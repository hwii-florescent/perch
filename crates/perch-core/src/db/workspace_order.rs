//! Sidebar order (`workspace_order`): two ordered id lists per core, one for
//! projects and one for sessions (chats). The core owns them so every viewer,
//! including the phone, shows the same order; a viewer only sends moves.
//!
//! Ids are untrusted and never joined against other tables: a session row may
//! not exist yet (rows appear with the first message) and a stale id is
//! harmless, so unknown ids are tolerated. The sender passes only live ids,
//! which is how stale ones are pruned; each list is bounded.

use super::*;

pub const ORDER_PROJECTS: &str = "projects";
pub const ORDER_SESSIONS: &str = "sessions";
pub const MAX_ORDER_IDS: usize = 4096;
const MAX_ORDER_ID_BYTES: usize = 256;

/// Dedupe (first occurrence wins) and drop empty, oversized or control-char
/// ids. `None` when the list is over the bound, so a flood is refused rather
/// than silently truncated.
pub fn clean_order_ids(ids: Vec<String>) -> Option<Vec<String>> {
    if ids.len() > MAX_ORDER_IDS {
        return None;
    }
    let mut seen = std::collections::HashSet::new();
    Some(
        ids.into_iter()
            .filter(|id| {
                !id.is_empty()
                    && id.len() <= MAX_ORDER_ID_BYTES
                    && !id.chars().any(char::is_control)
                    && seen.insert(id.clone())
            })
            .collect(),
    )
}

impl HistoryDb {
    pub(super) fn migrate_workspace_order(conn: &Connection) -> anyhow::Result<()> {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS workspace_order (
                kind TEXT PRIMARY KEY,
                ids TEXT NOT NULL
            );",
        )?;
        Ok(())
    }

    /// The stored list for `ORDER_PROJECTS` / `ORDER_SESSIONS`; empty when
    /// never set or unreadable (the sidebar then keeps its default sort).
    pub fn workspace_order(&self, kind: &str) -> Vec<String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT ids FROM workspace_order WHERE kind = ?1",
            params![kind],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .ok()
        .flatten()
        .and_then(|ids| serde_json::from_str(&ids).ok())
        .unwrap_or_default()
    }

    /// Replace one list (last write wins). Returns `false` when `kind` is
    /// unknown or the list is over the bound; nothing is written then.
    pub fn set_workspace_order(&self, kind: &str, ids: Vec<String>) -> anyhow::Result<bool> {
        if kind != ORDER_PROJECTS && kind != ORDER_SESSIONS {
            return Ok(false);
        }
        let Some(ids) = clean_order_ids(ids) else {
            return Ok(false);
        };
        self.conn.lock().unwrap().execute(
            "INSERT INTO workspace_order(kind, ids) VALUES (?1, ?2)
             ON CONFLICT(kind) DO UPDATE SET ids = excluded.ids",
            params![kind, serde_json::to_string(&ids)?],
        )?;
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn path() -> PathBuf {
        std::env::temp_dir()
            .join(format!("perch-workspace-order-{}", Uuid::new_v4()))
            .join("history.sqlite")
    }

    #[test]
    fn cleaning_dedupes_drops_junk_and_bounds() {
        let ids = ["b", "a", "b", "", "x\ny", &"z".repeat(300), "c"].map(String::from);
        assert_eq!(clean_order_ids(ids.to_vec()).unwrap(), ["b", "a", "c"]);
        assert!(clean_order_ids(vec!["a".into(); MAX_ORDER_IDS + 1]).is_none());
    }

    #[test]
    fn order_persists_across_reopen_and_last_write_wins() {
        let path = path();
        let db = HistoryDb::open(&path).unwrap();
        assert!(db.workspace_order(ORDER_PROJECTS).is_empty());
        let ids = |list: &[&str]| list.iter().map(|id| id.to_string()).collect::<Vec<_>>();
        assert!(db
            .set_workspace_order(ORDER_PROJECTS, ids(&["p2", "p1"]))
            .unwrap());
        assert!(db
            .set_workspace_order(ORDER_SESSIONS, ids(&["s1"]))
            .unwrap());
        assert!(db
            .set_workspace_order(ORDER_PROJECTS, ids(&["p1", "p2", "p1"]))
            .unwrap());
        // Refused writes leave the stored list alone.
        assert!(!db.set_workspace_order("bogus", ids(&["x"])).unwrap());
        assert!(!db
            .set_workspace_order(ORDER_SESSIONS, vec!["s".into(); MAX_ORDER_IDS + 1])
            .unwrap());
        drop(db);
        // Reopening runs migrate() again over the existing table.
        let db = HistoryDb::open(&path).unwrap();
        assert_eq!(db.workspace_order(ORDER_PROJECTS), ["p1", "p2"]);
        assert_eq!(db.workspace_order(ORDER_SESSIONS), ["s1"]);
    }
}
