//! Durable project/workspace metadata: CRUD, worktree linking, and
//! connection-scoped focus. Pure move from `db.rs` — see the refactor
//! plan's Phase 5. No logic changed.
//!
//! ProjectRow, WorkspaceRow, WorkspaceSnapshot are re-exported from
//! db/mod.rs (`pub use projects::{...}`) to keep `crate::db::X` import
//! paths working — both row types are used throughout server/workspace.rs
//! and server/mod.rs's test fixtures.
//!
//! `project_name_for_path` and `ensure_project_workspace_locked` stay in
//! mod.rs: both are also called from `migrate()`'s legacy-workspace
//! import and from `create_session_on_host` (sessions domain), not just
//! from the methods that moved here.

use super::*;

/// Durable project row. The database stores settings as opaque JSON text so
/// project-specific preferences can grow without repeated schema changes.
#[derive(Debug, Clone)]
pub struct ProjectRow {
    pub id: String,
    pub host_id: String,
    pub name: String,
    pub path: String,
    pub repo_path: Option<String>,
    pub default_branch: Option<String>,
    pub favorite: bool,
    pub archived: bool,
    pub settings: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Durable workspace row. The first foundation slice creates one workspace
/// for each project path; worktree/editor work may add child rows later.
#[derive(Debug, Clone)]
pub struct WorkspaceRow {
    pub id: String,
    pub project_id: String,
    pub host_id: String,
    pub path: String,
    pub name: String,
    pub branch: Option<String>,
    pub base_branch: Option<String>,
    pub dirty: bool,
    pub start_snapshot: Option<String>,
    pub parent_workspace_id: Option<String>,
    pub state: String,
    pub created_at: i64,
    pub updated_at: i64,
    /// Kept at the top of its project in the sidebar (Orca's pin).
    pub pinned: bool,
    /// Left out of the sidebar: a worktree perch discovered but did not
    /// create (Orca's external worktree, hidden until shown).
    pub hidden: bool,
}

/// Coherent project/workspace metadata and focus returned by one snapshot.
pub type WorkspaceSnapshot = (
    Vec<ProjectRow>,
    Vec<WorkspaceRow>,
    Option<String>,
    Option<String>,
);

impl HistoryDb {
    // -----------------------------------------------------------------------
    // Durable project/workspace metadata
    // -----------------------------------------------------------------------

    /// Return projects for one host. Archived rows are retained in the DB and
    /// are included only when explicitly requested, so a normal sidebar
    /// refresh cannot accidentally resurrect archived projects.
    pub fn list_projects(
        &self,
        host_id: &str,
        include_archived: bool,
    ) -> anyhow::Result<Vec<ProjectRow>> {
        let conn = self.conn.lock().unwrap();
        let sql = if include_archived {
            "SELECT id, host_id, name, path, repo_path, default_branch, favorite, archived,
                    settings, created_at, updated_at
             FROM projects WHERE host_id = ?1 ORDER BY favorite DESC, updated_at DESC, id ASC"
        } else {
            "SELECT id, host_id, name, path, repo_path, default_branch, favorite, archived,
                    settings, created_at, updated_at
             FROM projects WHERE host_id = ?1 AND archived = 0
             ORDER BY favorite DESC, updated_at DESC, id ASC"
        };
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt
            .query_map(params![normalized_host_id(host_id)], project_row_from_row)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn get_project(&self, id: &str) -> anyhow::Result<Option<ProjectRow>> {
        let conn = self.conn.lock().unwrap();
        get_project_locked(&conn, id)
    }

    /// Idempotently create a project and its default workspace for a
    /// host/path pair. Existing rows are returned untouched, including their
    /// archived state and user-selected name.
    pub fn create_project(
        &self,
        host_id: &str,
        path: &str,
        name: Option<&str>,
        start_snapshot: Option<&str>,
    ) -> anyhow::Result<(ProjectRow, WorkspaceRow)> {
        if let Some(revision) = start_snapshot {
            validate_workspace_metadata(revision, "start snapshot")?;
        }
        let conn = self.conn.lock().unwrap();
        let host_id = normalized_host_id(host_id);
        conn.execute_batch("BEGIN IMMEDIATE")?;
        let result = (|| {
            let (project_id, workspace_id) =
                ensure_project_workspace_locked(&conn, host_id, path, name, false, start_snapshot)?;
            let project = get_project_locked(&conn, &project_id)?
                .ok_or_else(|| anyhow::anyhow!("project disappeared after creation"))?;
            let workspace = get_workspace_locked(&conn, &workspace_id)?
                .ok_or_else(|| anyhow::anyhow!("workspace disappeared after creation"))?;
            anyhow::Ok((project, workspace))
        })();
        match result {
            Ok(rows) => {
                conn.execute_batch("COMMIT")?;
                Ok(rows)
            }
            Err(err) => {
                let _ = conn.execute_batch("ROLLBACK");
                Err(err)
            }
        }
    }

    /// Refresh live Git metadata, never the creation boundary. A missing
    /// `start_snapshot` cannot be reconstructed from a later HEAD either.
    pub fn update_workspace_git_state(
        &self,
        workspace_id: &str,
        branch: Option<&str>,
        base_branch: Option<&str>,
        dirty: bool,
    ) -> anyhow::Result<WorkspaceRow> {
        let conn = self.conn.lock().unwrap();
        let changed = conn.execute(
            "UPDATE workspaces
             SET branch = COALESCE(?2, branch),
                 base_branch = COALESCE(?3, base_branch),
                 dirty = ?4,
                 updated_at = ?5
             WHERE id = ?1",
            params![
                workspace_id,
                branch,
                base_branch,
                dirty as i32,
                now_millis()
            ],
        )?;
        if changed == 0 {
            return Err(anyhow::anyhow!("workspace not found: {workspace_id}"));
        }
        get_workspace_locked(&conn, workspace_id)?
            .ok_or_else(|| anyhow::anyhow!("workspace disappeared"))
    }

    /// Idempotently register a linked worktree as a child workspace.  The
    /// `project_path` must identify the repository's primary checkout; the
    /// method creates or reuses that project/default workspace and then binds
    /// the linked checkout to it.  Repeating a create after a lost response
    /// returns the existing child row rather than creating duplicate metadata.
    pub fn create_worktree_workspace(
        &self,
        host_id: &str,
        project_path: &str,
        checkout_path: &str,
        branch: Option<&str>,
        base_branch: Option<&str>,
        start_snapshot: Option<&str>,
    ) -> anyhow::Result<WorkspaceRow> {
        let host_id = normalized_host_id(host_id);
        let project_path = canonical_path_for_host(host_id, project_path);
        let checkout_path = canonical_path_for_host(host_id, checkout_path);
        if project_path.is_empty() || checkout_path.is_empty() {
            return Err(anyhow::anyhow!("workspace paths cannot be empty"));
        }
        if let Some(branch) = branch {
            validate_workspace_metadata(branch, "branch")?;
        }
        if let Some(base_branch) = base_branch {
            validate_workspace_metadata(base_branch, "base branch")?;
        }
        if let Some(start_snapshot) = start_snapshot {
            validate_workspace_metadata(start_snapshot, "start snapshot")?;
        }
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("BEGIN IMMEDIATE")?;
        let result = (|| {
            let (project_id, parent_workspace_id) =
                ensure_project_workspace_locked(&conn, host_id, &project_path, None, false, None)?;
            let existing = conn
                .query_row(
                    "SELECT id FROM workspaces WHERE host_id = ?1 AND path = ?2
                     ORDER BY created_at ASC, id ASC LIMIT 1",
                    params![host_id, checkout_path],
                    |row| row.get::<_, String>(0),
                )
                .optional()?;
            if let Some(workspace_id) = existing {
                let workspace = get_workspace_locked(&conn, &workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("workspace disappeared"))?;
                if workspace.project_id != project_id {
                    return Err(anyhow::anyhow!(
                        "worktree path already belongs to another project"
                    ));
                }
                conn.execute(
                    "UPDATE workspaces
                     SET branch = COALESCE(?2, branch),
                         base_branch = COALESCE(?3, base_branch),
                         updated_at = ?4
                     WHERE id = ?1",
                    params![workspace_id, branch, base_branch, now_millis()],
                )?;
                return get_workspace_locked(&conn, &workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("workspace disappeared"));
            }

            // A worktree path equal to the primary checkout is the durable
            // parent workspace itself, never a second child row.
            if checkout_path == project_path {
                return get_workspace_locked(&conn, &parent_workspace_id)?
                    .ok_or_else(|| anyhow::anyhow!("workspace disappeared"));
            }
            let workspace_id = Uuid::new_v4().to_string();
            let now = now_millis();
            let name = branch
                .filter(|branch| !branch.trim().is_empty())
                .map(ToOwned::to_owned)
                .unwrap_or_else(|| project_name_for_path(&checkout_path));
            conn.execute(
                "INSERT INTO workspaces
                    (id, project_id, host_id, path, name, branch, base_branch, dirty,
                     start_snapshot, parent_workspace_id, state, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?9, 'active', ?10, ?10)",
                params![
                    workspace_id,
                    project_id,
                    host_id,
                    checkout_path,
                    name,
                    branch,
                    base_branch,
                    start_snapshot,
                    parent_workspace_id,
                    now,
                ],
            )?;
            get_workspace_locked(&conn, &workspace_id)?
                .ok_or_else(|| anyhow::anyhow!("workspace disappeared after insertion"))
        })();
        match result {
            Ok(workspace) => {
                conn.execute_batch("COMMIT")?;
                Ok(workspace)
            }
            Err(error) => {
                let _ = conn.execute_batch("ROLLBACK");
                Err(error)
            }
        }
    }

    /// Mark a removed linked checkout archived while retaining its project,
    /// comments, buffers, and agent history for safe inspection.  The primary
    /// project workspace is never archived by this path.
    pub fn archive_workspace_for_path(
        &self,
        host_id: &str,
        checkout_path: &str,
    ) -> anyhow::Result<Option<WorkspaceRow>> {
        let host_id = normalized_host_id(host_id);
        let checkout_path = canonical_path_for_host(host_id, checkout_path);
        let conn = self.conn.lock().unwrap();
        let workspace_id = conn
            .query_row(
                "SELECT id FROM workspaces
                 WHERE host_id = ?1 AND path = ?2 AND parent_workspace_id IS NOT NULL
                 LIMIT 1",
                params![host_id, checkout_path],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        let Some(workspace_id) = workspace_id else {
            return Ok(None);
        };
        conn.execute(
            "UPDATE workspaces SET state = 'archived', updated_at = ?2 WHERE id = ?1",
            params![workspace_id, now_millis()],
        )?;
        get_workspace_locked(&conn, &workspace_id)
    }

    pub fn rename_project(&self, id: &str, name: &str) -> anyhow::Result<ProjectRow> {
        let conn = self.conn.lock().unwrap();
        let changed = conn.execute(
            "UPDATE projects SET name = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, name, now_millis()],
        )?;
        if changed == 0 {
            return Err(anyhow::anyhow!("project not found: {id}"));
        }
        get_project_locked(&conn, id)?.ok_or_else(|| anyhow::anyhow!("project disappeared"))
    }

    pub fn set_project_archived(&self, id: &str, archived: bool) -> anyhow::Result<ProjectRow> {
        let conn = self.conn.lock().unwrap();
        let _project = get_project_locked(&conn, id)?
            .ok_or_else(|| anyhow::anyhow!("project not found: {id}"))?;
        let changed = conn.execute(
            "UPDATE projects SET archived = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, archived as i32, now_millis()],
        )?;
        if changed == 0 {
            return Err(anyhow::anyhow!("project not found: {id}"));
        }
        if archived {
            // Never leave a hidden project as the active selection. Choose a
            // deterministic active fallback on the same host, or clear focus
            // when no visible project remains.
            let states = {
                let mut stmt = conn
                    .prepare("SELECT host_id FROM workspace_state WHERE active_project_id = ?1")?;
                let rows = stmt
                    .query_map(params![id], |row| row.get::<_, String>(0))?
                    .collect::<Result<Vec<_>, _>>()?;
                rows
            };
            for host_id in states {
                let fallback: Option<(String, String)> = {
                    let mut stmt = conn.prepare(
                        "SELECT p.id, w.id
                         FROM projects p JOIN workspaces w ON w.project_id = p.id
                         WHERE p.host_id = ?1 AND p.archived = 0 AND w.state != 'archived'
                         ORDER BY p.favorite DESC, p.updated_at DESC, p.id ASC,
                                  w.created_at ASC, w.id ASC LIMIT 1",
                    )?;
                    let mut rows = stmt.query(params![&host_id])?;
                    let result = rows.next()?.map(|row| {
                        Ok::<(String, String), rusqlite::Error>((row.get(0)?, row.get(1)?))
                    });
                    result.transpose()?
                };
                if let Some((project_id, workspace_id)) = fallback {
                    set_workspace_focus_locked(&conn, &host_id, &project_id, &workspace_id)?;
                } else {
                    conn.execute(
                        "UPDATE workspace_state
                         SET active_project_id = NULL, active_workspace_id = NULL,
                             updated_at = ?2
                         WHERE host_id = ?1",
                        params![host_id, now_millis()],
                    )?;
                }
            }
        }
        get_project_locked(&conn, id)?.ok_or_else(|| anyhow::anyhow!("project disappeared"))
    }

    pub fn list_workspaces(
        &self,
        host_id: &str,
        project_id: Option<&str>,
    ) -> anyhow::Result<Vec<WorkspaceRow>> {
        let conn = self.conn.lock().unwrap();
        let mut rows = Vec::new();
        if let Some(project_id) = project_id {
            let mut stmt = conn.prepare(
                "SELECT id, project_id, host_id, path, name, branch, base_branch, dirty,
                        start_snapshot, parent_workspace_id, state, created_at, updated_at, pinned, hidden
                 FROM workspaces WHERE host_id = ?1 AND project_id = ?2
                 ORDER BY created_at ASC, id ASC",
            )?;
            for row in stmt.query_map(
                params![normalized_host_id(host_id), project_id],
                workspace_row_from_row,
            )? {
                rows.push(row?);
            }
        } else {
            let mut stmt = conn.prepare(
                "SELECT id, project_id, host_id, path, name, branch, base_branch, dirty,
                        start_snapshot, parent_workspace_id, state, created_at, updated_at, pinned, hidden
                 FROM workspaces WHERE host_id = ?1
                 ORDER BY created_at ASC, id ASC",
            )?;
            for row in
                stmt.query_map(params![normalized_host_id(host_id)], workspace_row_from_row)?
            {
                rows.push(row?);
            }
        }
        Ok(rows)
    }

    pub fn get_workspace(&self, id: &str) -> anyhow::Result<Option<WorkspaceRow>> {
        let conn = self.conn.lock().unwrap();
        get_workspace_locked(&conn, id)
    }

    pub fn set_workspace_pinned(&self, id: &str, pinned: bool) -> anyhow::Result<WorkspaceRow> {
        let conn = self.conn.lock().unwrap();
        let changed = conn.execute(
            "UPDATE workspaces SET pinned = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, pinned as i32, now_millis()],
        )?;
        if changed == 0 {
            return Err(anyhow::anyhow!("workspace not found: {id}"));
        }
        get_workspace_locked(&conn, id)?.ok_or_else(|| anyhow::anyhow!("workspace disappeared"))
    }

    /// Point a linked worktree's row at the checkout's new path after a
    /// `git worktree move`. A name that was just the old folder name follows.
    pub fn set_workspace_path(&self, id: &str, path: &str) -> anyhow::Result<WorkspaceRow> {
        let conn = self.conn.lock().unwrap();
        let old = get_workspace_locked(&conn, id)?
            .ok_or_else(|| anyhow::anyhow!("workspace not found: {id}"))?;
        let name = if old.name == project_name_for_path(&old.path) {
            project_name_for_path(path)
        } else {
            old.name
        };
        conn.execute(
            "UPDATE workspaces SET path = ?2, name = ?3, updated_at = ?4
             WHERE id = ?1 AND parent_workspace_id IS NOT NULL",
            params![id, path, name, now_millis()],
        )?;
        get_workspace_locked(&conn, id)?.ok_or_else(|| anyhow::anyhow!("workspace disappeared"))
    }

    /// Show or hide a linked worktree. The primary checkout is always shown.
    pub fn set_workspace_hidden(&self, id: &str, hidden: bool) -> anyhow::Result<WorkspaceRow> {
        let conn = self.conn.lock().unwrap();
        let changed = conn.execute(
            "UPDATE workspaces SET hidden = ?2, updated_at = ?3
             WHERE id = ?1 AND parent_workspace_id IS NOT NULL",
            params![id, hidden as i32, now_millis()],
        )?;
        if changed == 0 {
            return Err(anyhow::anyhow!("not a linked worktree workspace: {id}"));
        }
        get_workspace_locked(&conn, id)?.ok_or_else(|| anyhow::anyhow!("workspace disappeared"))
    }

    /// Nest a linked worktree under another workspace of the same project
    /// (Orca's parent workspace: sidebar grouping only, git is untouched).
    /// `None` returns it to the top level, i.e. under the project's primary
    /// workspace. Refuses the primary itself, other projects, archived
    /// parents and cycles.
    pub fn set_workspace_parent(
        &self,
        id: &str,
        parent_id: Option<&str>,
    ) -> anyhow::Result<WorkspaceRow> {
        let conn = self.conn.lock().unwrap();
        let workspace = get_workspace_locked(&conn, id)?
            .ok_or_else(|| anyhow::anyhow!("workspace not found: {id}"))?;
        if workspace.parent_workspace_id.is_none() {
            return Err(anyhow::anyhow!(
                "a project's primary workspace cannot be nested"
            ));
        }
        let parent_id = match parent_id {
            Some(parent_id) => {
                let mut cursor = get_workspace_locked(&conn, parent_id)?
                    .ok_or_else(|| anyhow::anyhow!("parent workspace not found"))?;
                if cursor.project_id != workspace.project_id {
                    return Err(anyhow::anyhow!(
                        "the parent must belong to the same project"
                    ));
                }
                if cursor.state == "archived" {
                    return Err(anyhow::anyhow!("an archived workspace cannot be a parent"));
                }
                // Walk up from the new parent; meeting `id` means a cycle.
                for _ in 0..1000 {
                    if cursor.id == id {
                        return Err(anyhow::anyhow!(
                            "that would nest the workspace inside itself"
                        ));
                    }
                    let Some(up) = cursor.parent_workspace_id.as_deref() else {
                        break;
                    };
                    cursor = get_workspace_locked(&conn, up)?
                        .ok_or_else(|| anyhow::anyhow!("broken workspace lineage"))?;
                }
                parent_id.to_string()
            }
            None => conn.query_row(
                "SELECT id FROM workspaces WHERE project_id = ?1 AND parent_workspace_id IS NULL
                 ORDER BY created_at ASC, id ASC LIMIT 1",
                params![workspace.project_id],
                |row| row.get::<_, String>(0),
            )?,
        };
        conn.execute(
            "UPDATE workspaces SET parent_workspace_id = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, parent_id, now_millis()],
        )?;
        get_workspace_locked(&conn, id)?.ok_or_else(|| anyhow::anyhow!("workspace disappeared"))
    }

    pub fn rename_workspace(&self, id: &str, name: &str) -> anyhow::Result<WorkspaceRow> {
        let conn = self.conn.lock().unwrap();
        let changed = conn.execute(
            "UPDATE workspaces SET name = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, name, now_millis()],
        )?;
        if changed == 0 {
            return Err(anyhow::anyhow!("workspace not found: {id}"));
        }
        get_workspace_locked(&conn, id)?.ok_or_else(|| anyhow::anyhow!("workspace disappeared"))
    }

    /// Focus a project's default workspace. Archived projects are not
    /// focusable; this prevents a normal navigation action from unarchiving
    /// metadata or reviving stale agent state.
    pub fn focus_project(&self, id: &str) -> anyhow::Result<(ProjectRow, WorkspaceRow)> {
        let conn = self.conn.lock().unwrap();
        let (project, workspace) = self.resolve_project_workspace_locked(&conn, id)?;
        set_workspace_focus_locked(&conn, &project.host_id, &project.id, &workspace.id)?;
        Ok((project, workspace))
    }

    /// Resolve a project's default workspace without changing any focus
    /// state. The server uses this for per-connection focus, so one browser or
    /// phone cannot steal another device's active workspace.
    pub fn resolve_project_workspace(
        &self,
        id: &str,
    ) -> anyhow::Result<(ProjectRow, WorkspaceRow)> {
        let conn = self.conn.lock().unwrap();
        self.resolve_project_workspace_locked(&conn, id)
    }

    fn resolve_project_workspace_locked(
        &self,
        conn: &Connection,
        id: &str,
    ) -> anyhow::Result<(ProjectRow, WorkspaceRow)> {
        let project = get_project_locked(conn, id)?
            .ok_or_else(|| anyhow::anyhow!("project not found: {id}"))?;
        if project.archived {
            return Err(anyhow::anyhow!("project is archived: {id}"));
        }
        let workspace = get_default_workspace_locked(conn, &project.id)?
            .ok_or_else(|| anyhow::anyhow!("project has no workspace: {id}"))?;
        if workspace.state == "archived" {
            return Err(anyhow::anyhow!("workspace is archived: {}", workspace.id));
        }
        Ok((project, workspace))
    }

    /// Validate and return a workspace without changing persisted focus.
    pub fn resolve_workspace(&self, id: &str) -> anyhow::Result<WorkspaceRow> {
        let conn = self.conn.lock().unwrap();
        let workspace = get_workspace_locked(&conn, id)?
            .ok_or_else(|| anyhow::anyhow!("workspace not found: {id}"))?;
        let project = get_project_locked(&conn, &workspace.project_id)?
            .ok_or_else(|| anyhow::anyhow!("project not found: {}", workspace.project_id))?;
        if project.host_id != workspace.host_id {
            return Err(anyhow::anyhow!(
                "workspace host does not match project host"
            ));
        }
        if project.archived || workspace.state == "archived" {
            return Err(anyhow::anyhow!("workspace is archived: {id}"));
        }
        Ok(workspace)
    }

    /// Focus an existing workspace after checking both host and project
    /// ownership. The host comparison is deliberate: a remote id can never
    /// select a local workspace by guessing a UUID.
    pub fn focus_workspace(&self, id: &str) -> anyhow::Result<WorkspaceRow> {
        let conn = self.conn.lock().unwrap();
        let workspace = self.resolve_workspace_locked(&conn, id)?;
        let project = get_project_locked(&conn, &workspace.project_id)
            .ok()
            .flatten()
            .ok_or_else(|| anyhow::anyhow!("project not found: {}", workspace.project_id))?;
        set_workspace_focus_locked(&conn, &workspace.host_id, &project.id, &workspace.id)?;
        Ok(workspace)
    }

    fn resolve_workspace_locked(
        &self,
        conn: &Connection,
        id: &str,
    ) -> anyhow::Result<WorkspaceRow> {
        let workspace = get_workspace_locked(conn, id)?
            .ok_or_else(|| anyhow::anyhow!("workspace not found: {id}"))?;
        let project = get_project_locked(conn, &workspace.project_id)?
            .ok_or_else(|| anyhow::anyhow!("project not found: {}", workspace.project_id))?;
        if project.host_id != workspace.host_id {
            return Err(anyhow::anyhow!(
                "workspace host does not match project host"
            ));
        }
        if project.archived || workspace.state == "archived" {
            return Err(anyhow::anyhow!("workspace is archived: {id}"));
        }
        Ok(workspace)
    }

    /// Restore metadata state only. No session runtime or agent is started as
    /// a side effect; the caller must explicitly resume a session.
    pub fn restore_workspace(&self, id: &str) -> anyhow::Result<WorkspaceRow> {
        let conn = self.conn.lock().unwrap();
        let workspace = get_workspace_locked(&conn, id)?
            .ok_or_else(|| anyhow::anyhow!("workspace not found: {id}"))?;
        let project = get_project_locked(&conn, &workspace.project_id)?
            .ok_or_else(|| anyhow::anyhow!("project not found: {}", workspace.project_id))?;
        if project.archived {
            return Err(anyhow::anyhow!("project is archived: {}", project.id));
        }
        conn.execute(
            "UPDATE workspaces SET state = 'active', updated_at = ?2 WHERE id = ?1",
            params![id, now_millis()],
        )?;
        get_workspace_locked(&conn, id)?.ok_or_else(|| anyhow::anyhow!("workspace disappeared"))
    }

    /// Read all metadata required for one coherent snapshot under a single
    /// SQLite mutex hold. This prevents a focus mutation from landing between
    /// the project/workspace lists and the active selection.
    pub fn workspace_snapshot(
        &self,
        host_id: &str,
        project_id: Option<&str>,
    ) -> anyhow::Result<WorkspaceSnapshot> {
        let conn = self.conn.lock().unwrap();
        let host_id = normalized_host_id(host_id);
        let projects = list_projects_locked(&conn, host_id)?;
        let workspaces = if let Some(project_id) = project_id {
            list_workspaces_locked(&conn, host_id, Some(project_id))?
        } else {
            list_workspaces_locked(&conn, host_id, None)?
        };
        let (active_project_id, active_workspace_id) = active_focus_locked(&conn, host_id)?;
        Ok((projects, workspaces, active_project_id, active_workspace_id))
    }

    /// Read the persisted focus for one host without loading the project or
    /// workspace rows. The server uses this only to seed a newly-created
    /// connection; subsequent focus navigation is kept in that connection's
    /// state so one browser/device cannot move another client's selection.
    pub fn active_focus(&self, host_id: &str) -> anyhow::Result<(Option<String>, Option<String>)> {
        let conn = self.conn.lock().unwrap();
        active_focus_locked(&conn, normalized_host_id(host_id))
    }
}

fn validate_workspace_metadata(value: &str, label: &str) -> anyhow::Result<()> {
    if value.is_empty() || value.len() > 4096 || value.contains('\0') {
        return Err(anyhow::anyhow!(
            "workspace {label} is empty, oversized, or contains NUL"
        ));
    }
    Ok(())
}

fn project_row_from_row(row: &rusqlite::Row) -> rusqlite::Result<ProjectRow> {
    Ok(ProjectRow {
        id: row.get(0)?,
        host_id: row.get(1)?,
        name: row.get(2)?,
        path: row.get(3)?,
        repo_path: row.get(4)?,
        default_branch: row.get(5)?,
        favorite: row.get::<_, i32>(6).unwrap_or(0) != 0,
        archived: row.get::<_, i32>(7).unwrap_or(0) != 0,
        settings: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

fn workspace_row_from_row(row: &rusqlite::Row) -> rusqlite::Result<WorkspaceRow> {
    Ok(WorkspaceRow {
        id: row.get(0)?,
        project_id: row.get(1)?,
        host_id: row.get(2)?,
        path: row.get(3)?,
        name: row.get(4)?,
        branch: row.get(5)?,
        base_branch: row.get(6)?,
        dirty: row.get::<_, i32>(7).unwrap_or(0) != 0,
        start_snapshot: row.get(8)?,
        parent_workspace_id: row.get(9)?,
        state: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
        pinned: row.get::<_, i32>(13).unwrap_or(0) != 0,
        hidden: row.get::<_, i32>(14).unwrap_or(0) != 0,
    })
}

fn get_project_locked(conn: &Connection, id: &str) -> anyhow::Result<Option<ProjectRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, host_id, name, path, repo_path, default_branch, favorite, archived,
                settings, created_at, updated_at
         FROM projects WHERE id = ?1",
    )?;
    let mut rows = stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        Ok(Some(project_row_from_row(row)?))
    } else {
        Ok(None)
    }
}

fn get_workspace_locked(conn: &Connection, id: &str) -> anyhow::Result<Option<WorkspaceRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, host_id, path, name, branch, base_branch, dirty,
                start_snapshot, parent_workspace_id, state, created_at, updated_at, pinned, hidden
         FROM workspaces WHERE id = ?1",
    )?;
    let mut rows = stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        Ok(Some(workspace_row_from_row(row)?))
    } else {
        Ok(None)
    }
}

fn list_projects_locked(conn: &Connection, host_id: &str) -> anyhow::Result<Vec<ProjectRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, host_id, name, path, repo_path, default_branch, favorite, archived,
                settings, created_at, updated_at
         FROM projects WHERE host_id = ?1
         ORDER BY favorite DESC, updated_at DESC, id ASC",
    )?;
    let rows = stmt
        .query_map(params![host_id], project_row_from_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn list_workspaces_locked(
    conn: &Connection,
    host_id: &str,
    project_id: Option<&str>,
) -> anyhow::Result<Vec<WorkspaceRow>> {
    let mut rows = Vec::new();
    if let Some(project_id) = project_id {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, host_id, path, name, branch, base_branch, dirty,
                    start_snapshot, parent_workspace_id, state, created_at, updated_at, pinned, hidden
             FROM workspaces WHERE host_id = ?1 AND project_id = ?2
             ORDER BY created_at ASC, id ASC",
        )?;
        for row in stmt.query_map(params![host_id, project_id], workspace_row_from_row)? {
            rows.push(row?);
        }
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, host_id, path, name, branch, base_branch, dirty,
                    start_snapshot, parent_workspace_id, state, created_at, updated_at, pinned, hidden
             FROM workspaces WHERE host_id = ?1
             ORDER BY created_at ASC, id ASC",
        )?;
        for row in stmt.query_map(params![host_id], workspace_row_from_row)? {
            rows.push(row?);
        }
    }
    Ok(rows)
}

fn get_default_workspace_locked(
    conn: &Connection,
    project_id: &str,
) -> anyhow::Result<Option<WorkspaceRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, host_id, path, name, branch, base_branch, dirty,
                start_snapshot, parent_workspace_id, state, created_at, updated_at, pinned, hidden
         FROM workspaces WHERE project_id = ?1 ORDER BY created_at ASC, id ASC LIMIT 1",
    )?;
    let mut rows = stmt.query(params![project_id])?;
    if let Some(row) = rows.next()? {
        Ok(Some(workspace_row_from_row(row)?))
    } else {
        Ok(None)
    }
}

fn set_workspace_focus_locked(
    conn: &Connection,
    host_id: &str,
    project_id: &str,
    workspace_id: &str,
) -> anyhow::Result<()> {
    conn.execute(
        "INSERT INTO workspace_state (host_id, active_project_id, active_workspace_id, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(host_id) DO UPDATE SET
           active_project_id = excluded.active_project_id,
           active_workspace_id = excluded.active_workspace_id,
           updated_at = excluded.updated_at",
        params![host_id, project_id, workspace_id, now_millis()],
    )?;
    Ok(())
}

fn active_focus_locked(
    conn: &Connection,
    host_id: &str,
) -> anyhow::Result<(Option<String>, Option<String>)> {
    let mut stmt = conn.prepare(
        "SELECT active_project_id, active_workspace_id
         FROM workspace_state WHERE host_id = ?1",
    )?;
    let mut rows = stmt.query(params![host_id])?;
    if let Some(row) = rows.next()? {
        Ok((row.get(0)?, row.get(1)?))
    } else {
        Ok((None, None))
    }
}
