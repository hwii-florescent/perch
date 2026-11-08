//! Instructions store: one row per Project (`project`) or Workspace (`workspace`), and the
//! snapshot each session pinned at its first launch. Rules and composition live in
//! `crate::instructions`; this file only persists them.
//!
//! A pin is written once per session and never rewritten, so wake and resume launch with the
//! text the session started with even after the Project's Instructions change. A session
//! that started with nothing to inject keeps an empty pin for the same reason.
use super::*;
use crate::instructions::{self, Instructions, Pinned, Source};
use anyhow::Context;

const SCOPES: [&str; 2] = ["project", "workspace"];

fn folders_from_json(json: &str) -> Vec<String> {
    serde_json::from_str(json).unwrap_or_default()
}

/// The stored row for one scope, empty at revision 0 when nothing was ever saved.
fn get_locked(conn: &Connection, scope: &str, id: &str) -> anyhow::Result<(Instructions, i64)> {
    Ok(conn
        .query_row(
            "SELECT text, folders, revision FROM instructions WHERE scope = ?1 AND scope_id = ?2",
            params![scope, id],
            |row| {
                Ok((
                    Instructions {
                        text: row.get(0)?,
                        folders: folders_from_json(&row.get::<_, String>(1)?),
                    },
                    row.get(2)?,
                ))
            },
        )
        .optional()?
        .unwrap_or_default())
}

impl HistoryDb {
    /// The Instructions saved for a Project or Workspace, with the revision that identifies them.
    pub fn get_instructions(&self, scope: &str, id: &str) -> anyhow::Result<(Instructions, i64)> {
        anyhow::ensure!(SCOPES.contains(&scope), "unknown Instructions scope");
        get_locked(&self.conn.lock().unwrap(), scope, id)
    }

    /// Save a Project's or Workspace's Instructions. The revision rises only when the content
    /// changed. Refused when the target does not exist or any session it covers would exceed
    /// the shared character cap.
    pub fn set_instructions(
        &self,
        scope: &str,
        id: &str,
        text: &str,
        folders: &[String],
    ) -> anyhow::Result<(Instructions, i64)> {
        anyhow::ensure!(SCOPES.contains(&scope), "unknown Instructions scope");
        let next = instructions::validate(text, folders).map_err(anyhow::Error::msg)?;
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        if scope == "project" {
            anyhow::ensure!(
                tx.query_row("SELECT 1 FROM projects WHERE id = ?1", params![id], |_| Ok(
                    ()
                ))
                .optional()?
                .is_some(),
                "Project not found"
            );
            let mut stmt = tx.prepare("SELECT id FROM workspaces WHERE project_id = ?1")?;
            let nests: Vec<String> = stmt
                .query_map(params![id], |row| row.get(0))?
                .collect::<Result<_, _>>()?;
            drop(stmt);
            for nest in nests {
                let (nest_instructions, _) = get_locked(&tx, "workspace", &nest)?;
                instructions::check_combined(&next, &nest_instructions)
                    .map_err(anyhow::Error::msg)?;
            }
        } else {
            let project: String = tx
                .query_row(
                    "SELECT project_id FROM workspaces WHERE id = ?1",
                    params![id],
                    |row| row.get(0),
                )
                .optional()?
                .context("Workspace not found")?;
            let (project_instructions, _) = get_locked(&tx, "project", &project)?;
            instructions::check_combined(&project_instructions, &next)
                .map_err(anyhow::Error::msg)?;
        }
        let (current, revision) = get_locked(&tx, scope, id)?;
        if current == next {
            return Ok((current, revision));
        }
        let revision = revision + 1;
        tx.execute(
            "INSERT INTO instructions (scope, scope_id, text, folders, revision, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(scope, scope_id) DO UPDATE SET text = excluded.text,
                folders = excluded.folders, revision = excluded.revision,
                updated_at = excluded.updated_at",
            params![
                scope,
                id,
                next.text,
                serde_json::to_string(&next.folders)?,
                revision,
                now_millis()
            ],
        )?;
        tx.commit()?;
        Ok((next, revision))
    }

    /// What `session_id` launches with: its pin, created from the current Instructions the
    /// first time and returned unchanged afterwards. `None` when it has nothing to inject.
    pub fn pin_session_instructions(&self, session_id: &str) -> anyhow::Result<Option<Pinned>> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        let existing = tx
            .query_row(
                "SELECT text, folders, sources, hash FROM session_instructions WHERE session_id = ?1",
                params![session_id],
                |row| {
                    Ok((
                        row.get::<_, Option<String>>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, Option<String>>(3)?,
                    ))
                },
            )
            .optional()?;
        if let Some((text, folders, sources, hash)) = existing {
            return Ok(match (text, hash) {
                (Some(text), Some(hash)) => Some(Pinned {
                    text,
                    folders: folders_from_json(&folders),
                    sources: serde_json::from_str(&sources).unwrap_or_default(),
                    hash,
                }),
                _ => None,
            });
        }
        let (project_id, workspace_id): (Option<String>, Option<String>) = tx
            .query_row(
                "SELECT project_id, workspace_id FROM sessions WHERE id = ?1",
                params![session_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?
            .context("session not found")?;
        let project_id = match (project_id.filter(|id| !id.is_empty()), &workspace_id) {
            (Some(project), _) => Some(project),
            (None, Some(workspace)) => tx
                .query_row(
                    "SELECT project_id FROM workspaces WHERE id = ?1",
                    params![workspace],
                    |row| row.get(0),
                )
                .optional()?,
            _ => None,
        };
        let mut layers = Vec::new();
        for (scope, id) in [
            ("project", project_id),
            ("workspace", workspace_id.filter(|id| !id.is_empty())),
        ] {
            if let Some(id) = id {
                let (body, revision) = get_locked(&tx, scope, &id)?;
                layers.push((
                    Source {
                        scope: scope.into(),
                        id,
                        revision,
                    },
                    body,
                ));
            }
        }
        let pinned = instructions::compose(&layers);
        tx.execute(
            "INSERT INTO session_instructions (session_id, text, folders, sources, hash, pinned_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                session_id,
                pinned.as_ref().map(|pin| &pin.text),
                serde_json::to_string(pinned.as_ref().map_or(&[][..], |pin| &pin.folders[..]))?,
                serde_json::to_string(pinned.as_ref().map_or(&[][..], |pin| &pin.sources[..]))?,
                pinned.as_ref().map(|pin| &pin.hash),
                now_millis()
            ],
        )?;
        tx.commit()?;
        Ok(pinned)
    }

    pub(super) fn delete_session_instructions_locked(
        conn: &Connection,
        session_id: &str,
    ) -> anyhow::Result<()> {
        conn.execute(
            "DELETE FROM session_instructions WHERE session_id = ?1",
            params![session_id],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> HistoryDb {
        HistoryDb::open(std::env::temp_dir().join(format!(
            "perch-instructions-{}.sqlite",
            uuid::Uuid::new_v4()
        )))
        .unwrap()
    }

    /// A project with one Workspace and one session in it, as `create_session_on_host` leaves them.
    fn seeded(db: &HistoryDb) -> (String, String, String) {
        let conn = db.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO projects (id, host_id, name, path, created_at, updated_at) VALUES ('p1', 'local', 'P', '/p', 0, 0)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO workspaces (id, project_id, host_id, path, name, created_at, updated_at) VALUES ('w1', 'p1', 'local', '/p', 'W', 0, 0)",
            [],
        )
        .unwrap();
        for id in ["s1", "s2"] {
            conn.execute(
                "INSERT INTO sessions (id, cwd, created_at, host_id, project_id, workspace_id) VALUES (?1, '/p', 0, 'local', 'p1', 'w1')",
                params![id],
            )
            .unwrap();
        }
        ("p1".into(), "w1".into(), "s1".into())
    }

    #[test]
    fn saving_bumps_the_revision_only_when_the_content_changes() {
        let db = db();
        let (project, nest, _) = seeded(&db);
        assert_eq!(db.get_instructions("project", &project).unwrap().1, 0);
        let (saved, revision) = db
            .set_instructions("project", &project, " rule ", &["/ref/".into()])
            .unwrap();
        assert_eq!(
            (saved.text.as_str(), saved.folders.clone(), revision),
            ("rule", vec!["/ref".to_string()], 1)
        );
        assert_eq!(
            db.set_instructions("project", &project, "rule", &["/ref".into()])
                .unwrap()
                .1,
            1
        );
        assert_eq!(
            db.set_instructions("project", &project, "rule 2", &["/ref".into()])
                .unwrap()
                .1,
            2
        );
        assert_eq!(db.get_instructions("workspace", &nest).unwrap().1, 0);
        assert!(db.set_instructions("project", "missing", "x", &[]).is_err());
        assert!(db
            .set_instructions("workspace", "missing", "x", &[])
            .is_err());
        assert!(db.set_instructions("galaxy", &project, "x", &[]).is_err());
    }

    #[test]
    fn the_cap_is_shared_by_project_and_nest_in_both_directions() {
        let db = db();
        let (project, nest, _) = seeded(&db);
        let big = "x".repeat(instructions::MAX_CHARS - 10);
        db.set_instructions("project", &project, &big, &[]).unwrap();
        assert!(db
            .set_instructions("workspace", &nest, &"y".repeat(11), &[])
            .is_err());
        db.set_instructions("workspace", &nest, &"y".repeat(8), &[])
            .unwrap();
        // Growing the Project now would push the Workspace's sessions over.
        assert!(db
            .set_instructions(
                "project",
                &project,
                &"x".repeat(instructions::MAX_CHARS - 5),
                &[]
            )
            .is_err());
        assert_eq!(
            db.get_instructions("project", &project).unwrap().0.text,
            big
        );
    }

    #[test]
    fn a_session_pins_its_first_launch_and_wake_never_sees_later_edits() {
        let db = db();
        let (project, nest, session) = seeded(&db);
        db.set_instructions("project", &project, "Project rule", &[])
            .unwrap();
        db.set_instructions("workspace", &nest, "Workspace rule", &["/ref".into()])
            .unwrap();
        let pinned = db.pin_session_instructions(&session).unwrap().unwrap();
        assert_eq!(pinned.text, "Project rule\n\nWorkspace rule");
        assert_eq!(
            pinned.sources,
            [
                Source {
                    scope: "project".into(),
                    id: project.clone(),
                    revision: 1
                },
                Source {
                    scope: "workspace".into(),
                    id: nest.clone(),
                    revision: 1
                },
            ]
        );
        db.set_instructions("project", &project, "Changed", &[])
            .unwrap();
        assert_eq!(
            db.pin_session_instructions(&session).unwrap().unwrap(),
            pinned
        );
        // A session started afterwards gets the new text.
        assert_eq!(
            db.pin_session_instructions("s2").unwrap().unwrap().text,
            "Changed\n\nWorkspace rule"
        );
    }

    #[test]
    fn a_session_that_started_with_nothing_stays_without_when_text_arrives_later() {
        let db = db();
        let (project, _, session) = seeded(&db);
        assert_eq!(db.pin_session_instructions(&session).unwrap(), None);
        db.set_instructions("project", &project, "Late rule", &[])
            .unwrap();
        assert_eq!(db.pin_session_instructions(&session).unwrap(), None);
        assert!(db.pin_session_instructions("no-such-session").is_err());
        db.delete_session(&session).unwrap();
        assert_eq!(
            db.conn
                .lock()
                .unwrap()
                .query_row(
                    "SELECT COUNT(*) FROM session_instructions WHERE session_id = 's1'",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            0
        );
    }

    #[test]
    fn removing_a_project_removes_its_and_its_nests_instructions() {
        let db = db();
        let (project, nest, _) = seeded(&db);
        db.set_instructions("project", &project, "a", &[]).unwrap();
        db.set_instructions("workspace", &nest, "b", &[]).unwrap();
        db.delete_project(&project).unwrap();
        let rows: i64 = db
            .conn
            .lock()
            .unwrap()
            .query_row("SELECT COUNT(*) FROM instructions", [], |row| row.get(0))
            .unwrap();
        assert_eq!(rows, 0);
    }
}
