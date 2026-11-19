//! A workspace's open tabs, shared by every device (capability `workspace.tabs.v1`).
//!
//! One row per local workspace: the strip (tab ids in order) and its split sets. Every client
//! writes it and draws it; which tab each device shows stays that device's own. Ids are the
//! web's tab ids, which name what they open: a session id, or `fileTabKey`'s
//! `<workspace id>\n<path>`, `<workspace id>\n\0review`, `<workspace id>\n\0browser\n<url>`.
//! Only those are kept: a mod tab (it carries props) and a tab of another scope (a terminal's
//! folder) stay on their device. `sets` is the web's `SplitSet[]`, opaque here past its members.
//!
//! Writes are last-writer-wins on the whole row, guarded by the revision the writer last saw: a
//! stale write changes nothing and the writer gets the current row to merge into (see
//! `plans/261118-1429-mobile-route/task-3-design.md`). A workspace with no row is seeded once from
//! the newest per-viewer presentation (`surfaces.rs`), which is read, never changed.

use crate::agent_persistence::SqliteConnectionAdapter;
use crate::db::HistoryDb;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;

pub const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS workspace_tabs (
    workspace_id TEXT PRIMARY KEY,
    revision INTEGER NOT NULL,
    strip_json TEXT NOT NULL,
    sets_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);";

/// Most tab ids a strip holds.
pub const MAX_STRIP: usize = 4096;
/// Most bytes the split sets take.
pub const MAX_SETS_BYTES: usize = 256 * 1024;
/// Most panes in one split set, as the clients'.
const MAX_SPLIT: usize = 4;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct SharedTabs {
    pub workspace_id: String,
    pub revision: u64,
    pub strip: Vec<String>,
    pub sets: Vec<Value>,
}

impl SharedTabs {
    /// As the wire's `workspace.tabs`, answering `request_id` when given.
    pub fn message(
        self,
        request_id: Option<String>,
        conflict: bool,
    ) -> crate::protocol::ServerMessage {
        crate::protocol::ServerMessage::WorkspaceTabs {
            request_id,
            workspace_id: self.workspace_id,
            revision: self.revision,
            strip: self.strip,
            sets: self.sets,
            conflict,
        }
    }
}

/// What a write did.
#[derive(Debug, PartialEq)]
pub enum Written {
    /// Stored as a new revision: tell everyone.
    Changed(SharedTabs),
    /// Already so: only the writer needs the answer.
    Unchanged(SharedTabs),
    /// Made against an older revision: nothing stored; the writer merges into this one.
    Conflict(SharedTabs),
}

/// Whether tab `id` of `workspace_id` can be shown on another device.
pub fn shareable(workspace_id: &str, id: &str) -> bool {
    if id.is_empty() || id.len() > 4096 {
        return false;
    }
    match id.split_once('\n') {
        None => !id.chars().any(char::is_control),
        Some((owner, rest)) => owner == workspace_id && !rest.starts_with("\0mod\n"),
    }
}

/// `strip` and `sets` with only what may be shared: shareable ids once each, and sets of two to
/// four members that are all in the strip and in no earlier set.
fn clean(workspace_id: &str, strip: &[String], sets: &[Value]) -> (Vec<String>, Vec<Value>) {
    let mut seen = HashSet::new();
    let strip: Vec<String> = strip
        .iter()
        .filter(|id| shareable(workspace_id, id) && seen.insert(id.as_str()))
        .cloned()
        .collect();
    let mut placed = HashSet::new();
    let sets = sets
        .iter()
        .filter(|set| {
            let Some(ids) = set.get("ids").and_then(Value::as_array) else {
                return false;
            };
            let ids: Option<Vec<&str>> = ids.iter().map(Value::as_str).collect();
            let Some(ids) = ids else { return false };
            let fits = (2..=MAX_SPLIT).contains(&ids.len())
                && ids
                    .iter()
                    .all(|id| seen.contains(id) && !placed.contains(id));
            if fits {
                placed.extend(ids);
            }
            fits
        })
        .cloned()
        .collect();
    (strip, sets)
}

pub fn ensure_schema(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    conn.execute_batch(SCHEMA)
}

fn read(conn: &rusqlite::Connection, workspace_id: &str) -> rusqlite::Result<SharedTabs> {
    let row = conn
        .query_row(
            "SELECT revision, strip_json, sets_json FROM workspace_tabs WHERE workspace_id = ?1",
            params![workspace_id],
            |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                ))
            },
        )
        .optional()?;
    let mut tabs = SharedTabs {
        workspace_id: workspace_id.to_string(),
        ..Default::default()
    };
    if let Some((revision, strip, sets)) = row {
        tabs.revision = revision.max(0) as u64;
        tabs.strip = serde_json::from_str(&strip).unwrap_or_default();
        tabs.sets = serde_json::from_str(&sets).unwrap_or_default();
    }
    Ok(tabs)
}

fn store(conn: &rusqlite::Connection, tabs: &SharedTabs) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO workspace_tabs (workspace_id, revision, strip_json, sets_json, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(workspace_id) DO UPDATE SET revision = excluded.revision,
            strip_json = excluded.strip_json, sets_json = excluded.sets_json,
            updated_at = excluded.updated_at",
        params![
            tabs.workspace_id,
            tabs.revision as i64,
            serde_json::to_string(&tabs.strip).unwrap_or_default(),
            serde_json::to_string(&tabs.sets).unwrap_or_default(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0)
        ],
    )?;
    Ok(())
}

/// `strip` without the sessions known to be gone: ended (no row, or archived) or of another
/// workspace. A session id only marks a session's place. One whose row cannot be read is unknown,
/// not gone, and keeps its place; so does one with no workspace recorded (an older row).
fn live(conn: &rusqlite::Connection, workspace_id: &str, strip: &[String]) -> Vec<String> {
    strip
        .iter()
        .filter(|id| {
            if id.contains('\n') {
                return true;
            }
            let row = conn
                .query_row(
                    "SELECT workspace_id FROM sessions WHERE id = ?1 AND archived = 0",
                    params![id],
                    |r| r.get::<_, Option<String>>(0),
                )
                .optional();
            match row {
                Ok(Some(owner)) => owner.is_none_or(|owner| owner == workspace_id),
                Ok(None) => false,
                Err(_) => true,
            }
        })
        .cloned()
        .collect()
}

/// Give each local workspace with a per-viewer presentation but no shared row the strip of the
/// newest of those presentations (the web's layout v1: `{v: 1, strip, sets}`), without its ended
/// sessions. An older presentation is never used: what the newest one left out stays out.
fn seed(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    let legacy = conn
        .prepare(
            "SELECT p.workspace_id, p.layout_json FROM viewer_presentations p
             JOIN workspaces w ON w.id = p.workspace_id AND w.host_id = 'local'
             WHERE p.layout_json IS NOT NULL
               AND p.workspace_id NOT IN (SELECT workspace_id FROM workspace_tabs)
             ORDER BY p.updated_at DESC",
        )?
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let mut done = HashSet::new();
    for (workspace_id, layout) in legacy {
        if !done.insert(workspace_id.clone()) {
            continue;
        }
        let Ok(layout) = serde_json::from_str::<Value>(&layout) else {
            continue;
        };
        if layout["v"] != 1 {
            continue;
        }
        let strip: Vec<String> =
            serde_json::from_value(layout["strip"].clone()).unwrap_or_default();
        let sets: Vec<Value> = serde_json::from_value(layout["sets"].clone()).unwrap_or_default();
        let strip = live(conn, &workspace_id, &strip);
        let (strip, sets) = clean(&workspace_id, &strip, &sets);
        if strip.is_empty() {
            continue;
        }
        store(
            conn,
            &SharedTabs {
                workspace_id,
                revision: 1,
                strip,
                sets,
            },
        )?;
    }
    Ok(())
}

/// Every local workspace's shared tabs (seeding the ones that have only per-viewer state), for a
/// new connection.
pub fn all(db: &HistoryDb) -> anyhow::Result<Vec<SharedTabs>> {
    db.with_connection(|conn| {
        seed(conn)?;
        let ids = conn
            .prepare(
                "SELECT t.workspace_id FROM workspace_tabs t
                 JOIN workspaces w ON w.id = t.workspace_id AND w.host_id = 'local'
                 ORDER BY t.workspace_id",
            )?
            .query_map([], |r| r.get::<_, String>(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(ids
            .iter()
            .map(|id| read(conn, id))
            .collect::<rusqlite::Result<_>>()?)
    })
}

/// Replace a local workspace's shared tabs. `base_revision`, when given, must be the current one.
pub fn set(
    db: &HistoryDb,
    workspace_id: &str,
    base_revision: Option<u64>,
    strip: &[String],
    sets: &[Value],
) -> anyhow::Result<Written> {
    if strip.len() > MAX_STRIP {
        anyhow::bail!("too many tabs");
    }
    if serde_json::to_string(sets)?.len() > MAX_SETS_BYTES {
        anyhow::bail!("split sets too large");
    }
    let (strip, sets) = clean(workspace_id, strip, sets);
    db.with_connection(|conn| {
        let tx = conn.transaction()?;
        let local: Option<String> = tx
            .query_row(
                "SELECT host_id FROM workspaces WHERE id = ?1",
                params![workspace_id],
                |r| r.get(0),
            )
            .optional()?;
        if local.as_deref() != Some("local") {
            anyhow::bail!("workspace is not present on the local host");
        }
        let strip = live(&tx, workspace_id, &strip);
        // A set left with a member that went is dropped with it.
        let (strip, sets) = clean(workspace_id, &strip, &sets);
        let current = read(&tx, workspace_id)?;
        if base_revision.is_some_and(|base| base != current.revision) {
            return Ok(Written::Conflict(current));
        }
        if current.revision > 0 && current.strip == strip && current.sets == sets {
            return Ok(Written::Unchanged(current));
        }
        let next = SharedTabs {
            workspace_id: workspace_id.to_string(),
            revision: current.revision + 1,
            strip,
            sets,
        };
        store(&tx, &next)?;
        tx.commit()?;
        Ok(Written::Changed(next))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn db_with_workspace() -> (HistoryDb, String) {
        let db = HistoryDb::open(":memory:").unwrap();
        crate::surfaces::ensure_schema(&db).unwrap();
        let (_, workspace) = db
            .create_project("local", "/tmp/demo", Some("demo"), None)
            .unwrap();
        db.create_session("s1", "/tmp/demo").unwrap();
        (db, workspace.id)
    }

    fn ids(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn two_viewers_see_one_tab_list_and_keep_their_own_active_tab() {
        let (db, w) = db_with_workspace();
        let file = format!("{w}\nsrc/a.rs");
        let review = format!("{w}\n\0review");
        // The desktop opens a file and a review beside its session, and splits them.
        let set = json!({"ids": [file, review], "sizes": [0.5, 0.5], "dir": "row"});
        let Ok(Written::Changed(first)) = set_tabs(
            &db,
            &w,
            Some(0),
            &["s1", &file, &review],
            std::slice::from_ref(&set),
        ) else {
            panic!("first write stores")
        };
        assert_eq!(first.revision, 1);
        // The phone reads the same list.
        let seen = all(&db).unwrap();
        assert_eq!(seen, vec![first.clone()]);
        // Each keeps its own active tab: the per-viewer rows are untouched by the shared write.
        let desktop = crate::surfaces::PresentationUpdate {
            active_resource_id: None,
            layout: Some(json!({"session": "s1"})),
            ..Default::default()
        };
        crate::surfaces::set_presentation(&db, "desktop", &w, &desktop).unwrap();
        let phone = crate::surfaces::PresentationUpdate {
            layout: Some(json!({"session": "other"})),
            ..Default::default()
        };
        crate::surfaces::set_presentation(&db, "phone", &w, &phone).unwrap();
        assert_eq!(all(&db).unwrap(), vec![first.clone()]);
        let mine = crate::surfaces::get_presentation(&db, "desktop", &w).unwrap();
        let theirs = crate::surfaces::get_presentation(&db, "phone", &w).unwrap();
        assert_eq!(mine.layout.unwrap()["session"], "s1");
        assert_eq!(theirs.layout.unwrap()["session"], "other");
        // The phone closes the review: one write, made against the revision it saw.
        let Ok(Written::Changed(second)) = set_tabs(&db, &w, Some(1), &["s1", &file], &[]) else {
            panic!("phone's close stores")
        };
        assert_eq!(second.strip, ids(&["s1", &file]));
        // The desktop's write against revision 1 is refused with what is current.
        assert_eq!(
            set_tabs(&db, &w, Some(1), &["s1", &file, &review], &[set]).unwrap(),
            Written::Conflict(second.clone())
        );
        // Writing the same again changes nothing.
        assert_eq!(
            set_tabs(&db, &w, Some(2), &["s1", &file], &[]).unwrap(),
            Written::Unchanged(second)
        );
    }

    fn set_tabs(
        db: &HistoryDb,
        w: &str,
        base: Option<u64>,
        strip: &[&str],
        sets: &[Value],
    ) -> anyhow::Result<Written> {
        set(db, w, base, &ids(strip), sets)
    }

    #[test]
    fn only_shareable_tabs_and_whole_sets_are_kept() {
        let (db, w) = db_with_workspace();
        let file = format!("{w}\na.rs");
        let strip = [
            "s1",
            "ended-session",
            &file,
            "s1",
            &format!("{w}\n\0mod\nnotes:1"),
            "term:x\nb.rs",
            "other-workspace\nc.rs",
        ];
        let sets = [
            json!({"ids": ["s1", file], "sizes": [0.5, 0.5]}),
            json!({"ids": [file, "gone"], "sizes": [0.5, 0.5]}),
            json!({"ids": ["s1"], "sizes": [1.0]}),
        ];
        let Written::Changed(tabs) = set_tabs(&db, &w, None, &strip, &sets).unwrap() else {
            panic!()
        };
        assert_eq!(tabs.strip, ids(&["s1", &file]));
        assert_eq!(tabs.sets, vec![sets[0].clone()]);
    }

    #[test]
    fn a_workspace_is_seeded_once_from_its_newest_viewer_layout() {
        let (db, w) = db_with_workspace();
        let file = format!("{w}\na.rs");
        for (viewer, strip) in [("old", vec!["s1"]), ("new", vec!["s1", file.as_str()])] {
            let update = crate::surfaces::PresentationUpdate {
                layout: Some(json!({"v": 1, "strip": strip, "sets": []})),
                ..Default::default()
            };
            crate::surfaces::set_presentation(&db, viewer, &w, &update).unwrap();
            std::thread::sleep(std::time::Duration::from_millis(3));
        }
        let seeded = all(&db).unwrap();
        assert_eq!(seeded.len(), 1);
        assert_eq!(seeded[0].strip, ids(&["s1", &file]));
        assert_eq!(seeded[0].revision, 1);
        // The legacy rows stay readable, and a later write is not undone by seeding again.
        assert!(crate::surfaces::get_presentation(&db, "old", &w)
            .unwrap()
            .layout
            .is_some());
        set_tabs(&db, &w, Some(1), &["s1"], &[]).unwrap();
        assert_eq!(all(&db).unwrap()[0].strip, ids(&["s1"]));
    }

    #[test]
    fn the_wire_message_reads_back() {
        use crate::protocol::{ClientMessage, ServerMessage};
        let sent = SharedTabs {
            workspace_id: "w".into(),
            revision: 3,
            strip: ids(&["s1", "w\na.rs"]),
            sets: vec![json!({"ids": ["s1", "w\na.rs"], "sizes": [0.5, 0.5]})],
        }
        .message(None, true);
        let wire = serde_json::to_value(&sent).unwrap();
        assert_eq!(wire["type"], "workspace.tabs");
        assert_eq!(wire["workspaceId"], "w");
        assert_eq!(wire["conflict"], true);
        let back: ServerMessage = serde_json::from_value(wire).unwrap();
        assert_eq!(
            serde_json::to_value(back).unwrap(),
            serde_json::to_value(sent).unwrap()
        );
        let set: ClientMessage = serde_json::from_value(json!({"type": "workspace.tabs.set",
            "requestId": "r", "workspaceId": "w", "baseRevision": 2, "strip": ["s1"], "sets": []}))
        .unwrap();
        assert!(matches!(
            set,
            ClientMessage::WorkspaceTabsSet {
                base_revision: Some(2),
                ..
            }
        ));
    }

    #[test]
    fn a_session_is_kept_unless_known_ended_or_elsewhere() {
        let (db, w) = db_with_workspace();
        let (_, other) = db
            .create_project("local", "/tmp/other", Some("other"), None)
            .unwrap();
        db.create_session_in_workspace("there", &other, "/tmp/other")
            .unwrap();
        // An ended session goes, as does one of another workspace.
        let Written::Changed(tabs) =
            set_tabs(&db, &w, None, &["s1", "gone", "there"], &[]).unwrap()
        else {
            panic!()
        };
        assert_eq!(tabs.strip, ids(&["s1"]));
        // A session whose row cannot be read is unknown, not ended: it keeps its place.
        db.with_connection(|conn| {
            Ok(conn.execute_batch("ALTER TABLE sessions RENAME TO sessions_away")?)
        })
        .unwrap();
        let Written::Changed(tabs) = set_tabs(&db, &w, Some(1), &["s1", "unknown"], &[]).unwrap()
        else {
            panic!()
        };
        assert_eq!(tabs.strip, ids(&["s1", "unknown"]));
    }

    #[test]
    fn seeding_uses_only_the_newest_layout_and_drops_ended_sessions() {
        let (db, w) = db_with_workspace();
        let file = format!("{w}\na.rs");
        for (viewer, strip) in [("old", vec!["s1", file.as_str()]), ("new", vec!["ended"])] {
            let update = crate::surfaces::PresentationUpdate {
                layout: Some(json!({"v": 1, "strip": strip, "sets": []})),
                ..Default::default()
            };
            crate::surfaces::set_presentation(&db, viewer, &w, &update).unwrap();
            std::thread::sleep(std::time::Duration::from_millis(3));
        }
        // The newest holds only an ended session: nothing is seeded, the older one is not used.
        assert_eq!(all(&db).unwrap(), vec![]);
    }

    #[test]
    fn a_remote_workspace_is_refused() {
        let (db, _) = db_with_workspace();
        assert!(set_tabs(&db, "missing", None, &["s1"], &[]).is_err());
    }
}
