//! Canonical, host-qualified open resources (Terminal / File / Diff) and
//! per-viewer presentation (order, focus, split geometry).
//!
//! - `surface_resources`: what exists in a workspace. Identity is
//!   `(host, workspace, kind, locator)`, so opening the same thing twice
//!   returns the same id and files/diffs need no chat session parent.
//!   Terminal descriptors are derived from the sessions and shell panes the
//!   existing lifecycle already owns (see `sync_terminals`): a descriptor
//!   refers to a runtime, it never starts or stops one.
//! - `viewer_presentations`: how one viewer arranges a workspace. Keyed by
//!   the viewer's stable id, so viewers never write the same row and cannot
//!   fight over focus or layout. A file or diff is in a viewer's tab order
//!   only because that viewer opened or imported it; terminals are global
//!   runtimes and appear for every viewer. The layout blob is opaque to
//!   Rust (the client's versioned Dockview adapter owns its shape).
//!
//! Legacy state (per-session `pane_layout`, the web's localStorage file tabs)
//! is imported once per viewer by [`import_legacy`]. Originals are never
//! modified or deleted: `sessions.pane_layout` stays in place and a verbatim
//! copy is kept in the presentation until a later slice verifies the
//! translated layout. Importing again is a no-op.
//!
//! Nothing here launches a command. A shell that is `exited` or `lost` keeps
//! its descriptor and says so; ending a terminal is `terminal.close` / the
//! session's own close.

use crate::agent_persistence::SqliteConnectionAdapter;
use crate::db::HistoryDb;
use crate::source_control::DiffTarget;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashSet};

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS surface_resources (
    id TEXT PRIMARY KEY,
    host_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    locator TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(host_id, workspace_id, kind, locator)
);
CREATE INDEX IF NOT EXISTS surface_resources_workspace
    ON surface_resources(workspace_id);
CREATE TABLE IF NOT EXISTS viewer_presentations (
    viewer_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    order_json TEXT NOT NULL DEFAULT '[]',
    active_resource_id TEXT,
    layout_json TEXT,
    legacy_layouts_json TEXT,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (viewer_id, workspace_id)
);
CREATE TABLE IF NOT EXISTS surface_imports (
    viewer_id TEXT NOT NULL,
    source TEXT NOT NULL,
    PRIMARY KEY (viewer_id, source)
);";

/// Bound on one `set` (terminals included; they are derived, never refused).
pub const MAX_PRESENTATION_ORDER: usize = 4096;
/// Files and diffs one viewer may hold open in a workspace. Open, import and
/// set all enforce it; an import that would exceed it fails whole (nothing is
/// truncated, the client keeps its legacy state).
pub const MAX_OPEN_TABS: usize = 512;
pub const MAX_LAYOUT_BYTES: usize = 256 * 1024;
const MAX_IMPORT_FILES: usize = MAX_OPEN_TABS;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SurfaceKind {
    Terminal,
    File,
    Diff,
}

impl SurfaceKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Terminal => "terminal",
            Self::File => "file",
            Self::Diff => "diff",
        }
    }

    fn parse(value: &str) -> Option<Self> {
        match value {
            "terminal" => Some(Self::Terminal),
            "file" => Some(Self::File),
            "diff" => Some(Self::Diff),
            _ => None,
        }
    }
}

/// Typed locator; which fields apply depends on the kind. File: `path`
/// (workspace-relative). Diff: `diff` (a working-tree diff is live and
/// mutable; compare targets carry their revisions). Terminal: `sessionId`,
/// plus `paneId` for a shell pane (absent = the session's agent terminal).
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default, rename_all = "camelCase")]
pub struct SurfaceLocator {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pane_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diff: Option<DiffTarget>,
}

/// The runtime a shell descriptor refers to (never owned by the view).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceRuntime {
    pub id: String,
    /// The pane's lifecycle: `starting`, `running`, `exited` or `lost`. An
    /// exited/lost shell is shown as such and is never relaunched by a view.
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceDescriptor {
    pub id: String,
    pub host_id: String,
    pub workspace_id: String,
    pub kind: SurfaceKind,
    pub locator: SurfaceLocator,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub runtime: Option<SurfaceRuntime>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct ViewerPresentation {
    pub viewer_id: String,
    pub workspace_id: String,
    pub revision: u64,
    pub order: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_resource_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layout: Option<Value>,
    /// Verbatim copies of the migrated per-session layouts, by session id.
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub legacy_layouts: BTreeMap<String, Value>,
}

/// What a viewer may change. Legacy copies are server-written only.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PresentationUpdate {
    /// The revision this update was made against. When present and not the
    /// current one (another tab of this viewer, an open or an import has
    /// changed it since) the write is refused with `surface_conflict`.
    pub base_revision: Option<u64>,
    pub order: Vec<String>,
    pub active_resource_id: Option<String>,
    pub layout: Option<Value>,
}

#[derive(Debug)]
pub enum SurfaceError {
    Invalid(String),
    NotFound,
    /// The file has an unsaved draft: Save or Discard it first.
    Dirty,
    /// A live terminal is closed by closing its runtime, not its descriptor.
    Owned,
    /// The presentation changed since the caller read it; re-read and retry.
    Conflict,
    Storage(anyhow::Error),
}

impl std::fmt::Display for SurfaceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Invalid(message) => f.write_str(message),
            Self::NotFound => f.write_str("not found"),
            Self::Dirty => f.write_str("the file has unsaved changes"),
            Self::Owned => f.write_str("close the terminal itself; its process is still owned"),
            Self::Conflict => f.write_str("the presentation changed; reload it and retry"),
            Self::Storage(error) => error.fmt(f),
        }
    }
}

impl std::error::Error for SurfaceError {}

impl SurfaceError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Invalid(_) => "surface_invalid",
            Self::NotFound => "surface_not_found",
            Self::Dirty => "surface_dirty",
            Self::Owned => "surface_owned",
            Self::Conflict => "surface_conflict",
            Self::Storage(_) => "surface_storage",
        }
    }
}

/// `with_connection` flattens errors to anyhow; recover a typed one.
impl From<anyhow::Error> for SurfaceError {
    fn from(error: anyhow::Error) -> Self {
        match error.downcast::<SurfaceError>() {
            Ok(typed) => typed,
            Err(other) => Self::Storage(other),
        }
    }
}

impl From<rusqlite::Error> for SurfaceError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Storage(error.into())
    }
}

type Result<T> = std::result::Result<T, SurfaceError>;

fn invalid<T>(message: &str) -> Result<T> {
    Err(SurfaceError::Invalid(message.into()))
}

pub fn ensure_schema(db: &HistoryDb) -> anyhow::Result<()> {
    db.with_connection(|conn| {
        conn.execute_batch(SCHEMA)?;
        conn.execute_batch(crate::workspace_terminals::SCHEMA)?;
        Ok(())
    })
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn check_id(value: &str, what: &str) -> Result<()> {
    if value.is_empty() || value.len() > 256 || value.chars().any(char::is_control) {
        return invalid(&format!("invalid {what}"));
    }
    Ok(())
}

/// Validate a locator for its kind and return its canonical key.
fn locator_key(kind: SurfaceKind, locator: &SurfaceLocator) -> Result<String> {
    let canonical = match kind {
        SurfaceKind::File => SurfaceLocator {
            path: Some(
                crate::filesystem::canonical_file_path(locator.path.as_deref().unwrap_or_default())
                    .map_err(|e| SurfaceError::Invalid(e.to_string()))?,
            ),
            ..Default::default()
        },
        SurfaceKind::Diff => SurfaceLocator {
            diff: Some(locator.diff.clone().unwrap_or(DiffTarget::WorkingTree)),
            ..Default::default()
        },
        SurfaceKind::Terminal => {
            let session_id = locator.session_id.as_deref().unwrap_or_default();
            check_id(session_id, "session id")?;
            if let Some(pane_id) = &locator.pane_id {
                check_id(pane_id, "pane id")?;
            }
            SurfaceLocator {
                session_id: Some(session_id.to_string()),
                pane_id: locator.pane_id.clone(),
                ..Default::default()
            }
        }
    };
    serde_json::to_string(&canonical).map_err(|e| SurfaceError::Storage(e.into()))
}

fn workspace_host(conn: &rusqlite::Connection, workspace_id: &str) -> Result<String> {
    conn.query_row(
        "SELECT host_id FROM workspaces WHERE id = ?1",
        params![workspace_id],
        |row| row.get(0),
    )
    .optional()?
    .ok_or(SurfaceError::NotFound)
}

const SELECT: &str =
    "SELECT id, host_id, workspace_id, kind, locator, created_at FROM surface_resources";

type Row = (String, String, String, String, String, i64);

fn read_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Row> {
    Ok((
        r.get(0)?,
        r.get(1)?,
        r.get(2)?,
        r.get(3)?,
        r.get(4)?,
        r.get(5)?,
    ))
}

fn describe(row: Row) -> Option<SurfaceDescriptor> {
    let (id, host_id, workspace_id, kind, locator, created_at) = row;
    let kind = SurfaceKind::parse(&kind)?; // a newer core's kind: skip, don't fail
    let locator = serde_json::from_str::<SurfaceLocator>(&locator).ok()?;
    Some(SurfaceDescriptor {
        id,
        host_id,
        workspace_id,
        kind,
        locator,
        runtime: None,
        created_at,
    })
}

/// Terminal descriptors are derived, not opened: every visible CLI session
/// and every shell pane of a workspace has one, and one whose session or
/// pane is gone is dropped. Doing this where descriptors are read leaves
/// every existing create/close path (tab ×, `terminal.close`, session
/// delete, project removal) the single owner of lifecycle. Never launches
/// anything.
fn sync_terminals(conn: &rusqlite::Connection, workspace_id: &str) -> Result<()> {
    let host_id = workspace_host(conn, workspace_id)?;
    if host_id != "local" {
        return Ok(());
    }
    let mut keys = Vec::new();
    let sessions = conn
        .prepare(&format!(
            "SELECT s.id FROM sessions s
             WHERE s.workspace_id = ?1 AND s.archived = 0 AND s.cli_provider_id IS NOT NULL
               AND {}
             ORDER BY s.created_at, s.rowid",
            crate::db::SESSION_VISIBILITY_FILTER
        ))?
        .query_map(params![workspace_id], |r| r.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    keys.extend(sessions.into_iter().map(|id| SurfaceLocator {
        session_id: Some(id),
        ..Default::default()
    }));
    let shells = conn
        .prepare("SELECT session_id, pane_id FROM workspace_terminals WHERE workspace_id = ?1 ORDER BY rowid")?
        .query_map(params![workspace_id], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    keys.extend(
        shells
            .into_iter()
            .map(|(session_id, pane_id)| SurfaceLocator {
                session_id: Some(session_id),
                pane_id: Some(pane_id),
                ..Default::default()
            }),
    );
    let mut live = HashSet::new();
    for locator in &keys {
        let key = locator_key(SurfaceKind::Terminal, locator)?;
        conn.execute(
            "INSERT OR IGNORE INTO surface_resources (id, host_id, workspace_id, kind, locator, created_at)
             VALUES (?1, ?2, ?3, 'terminal', ?4, ?5)",
            params![uuid::Uuid::new_v4().to_string(), host_id, workspace_id, key, now_millis()],
        )?;
        live.insert(key);
    }
    let stored = conn
        .prepare("SELECT id, locator FROM surface_resources WHERE workspace_id = ?1 AND kind = 'terminal'")?
        .query_map(params![workspace_id], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    for (id, key) in stored {
        if !live.contains(&key) {
            conn.execute("DELETE FROM surface_resources WHERE id = ?1", params![id])?;
        }
    }
    Ok(())
}

/// Everything in the workspace. A shell descriptor carries its runtime
/// (the pane's row id and lifecycle state); an agent terminal claims none,
/// because agent liveness belongs to the lifecycle registry.
fn list_locked(conn: &rusqlite::Connection, workspace_id: &str) -> Result<Vec<SurfaceDescriptor>> {
    sync_terminals(conn, workspace_id)?;
    let rows = conn
        .prepare(&format!("{SELECT} WHERE workspace_id = ?1 ORDER BY rowid"))?
        .query_map(params![workspace_id], read_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let mut out = Vec::with_capacity(rows.len());
    for mut descriptor in rows.into_iter().filter_map(describe) {
        if let (SurfaceKind::Terminal, Some(session_id), Some(pane_id)) = (
            descriptor.kind,
            &descriptor.locator.session_id,
            &descriptor.locator.pane_id,
        ) {
            descriptor.runtime = conn
                .query_row(
                    "SELECT id, state FROM workspace_terminals WHERE session_id = ?1 AND pane_id = ?2",
                    params![session_id, pane_id],
                    |r| {
                        Ok(SurfaceRuntime {
                            id: r.get(0)?,
                            state: r.get(1)?,
                        })
                    },
                )
                .optional()?;
        }
        out.push(descriptor);
    }
    Ok(out)
}

/// Insert-or-find a file or diff descriptor. Terminals are derived
/// ([`sync_terminals`]); opening one never creates a process.
fn open_locked(
    conn: &rusqlite::Connection,
    workspace_id: &str,
    kind: SurfaceKind,
    locator: &SurfaceLocator,
) -> Result<SurfaceDescriptor> {
    let host_id = workspace_host(conn, workspace_id)?;
    // The owning host holds resource facts; a remote workspace is opened on
    // that host's own core, not mirrored here.
    if host_id != "local" {
        return invalid("open this resource on its owning host");
    }
    if kind == SurfaceKind::Terminal {
        return invalid("a terminal exists by being started, not by being opened here");
    }
    let key = locator_key(kind, locator)?;
    conn.execute(
        "INSERT OR IGNORE INTO surface_resources (id, host_id, workspace_id, kind, locator, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            uuid::Uuid::new_v4().to_string(),
            host_id,
            workspace_id,
            kind.as_str(),
            key,
            now_millis()
        ],
    )?;
    let row = conn.query_row(
        &format!(
            "{SELECT} WHERE host_id = ?1 AND workspace_id = ?2 AND kind = ?3 AND locator = ?4"
        ),
        params![host_id, workspace_id, kind.as_str(), key],
        read_row,
    )?;
    describe(row).ok_or(SurfaceError::NotFound)
}

/// The viewer's stored `(revision, order)`; `(0, [])` before it has a row.
fn stored_order(
    conn: &rusqlite::Connection,
    viewer_id: &str,
    workspace_id: &str,
) -> Result<(u64, Vec<String>)> {
    let stored: Option<(i64, String)> = conn
        .query_row(
            "SELECT revision, order_json FROM viewer_presentations WHERE viewer_id = ?1 AND workspace_id = ?2",
            params![viewer_id, workspace_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    Ok(stored
        .map(|(revision, raw)| {
            (
                revision.max(0) as u64,
                serde_json::from_str(&raw).unwrap_or_default(),
            )
        })
        .unwrap_or_default())
}

/// Refuse an order holding more than [`MAX_OPEN_TABS`] files/diffs.
fn check_tab_cap(conn: &rusqlite::Connection, workspace_id: &str, order: &[String]) -> Result<()> {
    let tabs: HashSet<String> = conn
        .prepare("SELECT id FROM surface_resources WHERE workspace_id = ?1 AND kind != 'terminal'")?
        .query_map(params![workspace_id], |r| r.get(0))?
        .collect::<rusqlite::Result<_>>()?;
    if order.iter().filter(|id| tabs.contains(*id)).count() > MAX_OPEN_TABS {
        return invalid("too many open files and diffs; close some first");
    }
    Ok(())
}

/// Add ids to one viewer's order (appended, deduped). Membership is how a
/// file or diff becomes visible to a viewer: another viewer opening one never
/// adds a tab here. A real change advances the revision; a repeat does not.
fn add_to_order(
    conn: &rusqlite::Connection,
    viewer_id: &str,
    workspace_id: &str,
    ids: &[String],
) -> Result<()> {
    let (_, mut order) = stored_order(conn, viewer_id, workspace_id)?;
    let before = order.len();
    for id in ids {
        if !order.contains(id) {
            order.push(id.clone());
        }
    }
    if order.len() == before {
        return Ok(());
    }
    check_tab_cap(conn, workspace_id, &order)?;
    conn.execute(
        "INSERT INTO viewer_presentations (viewer_id, workspace_id, revision, order_json, updated_at)
         VALUES (?1, ?2, 1, ?3, ?4)
         ON CONFLICT(viewer_id, workspace_id) DO UPDATE SET
            revision = revision + 1, order_json = excluded.order_json, updated_at = excluded.updated_at",
        params![
            viewer_id,
            workspace_id,
            serde_json::to_string(&order).unwrap_or_default(),
            now_millis()
        ],
    )?;
    Ok(())
}

/// A file or diff leaves `viewer_id`'s tabs. The descriptor itself goes only
/// when no other viewer shows it, and then a file with an unsaved draft
/// refuses (Save or Discard first). Every path that removes membership
/// (`close`, `set_presentation`) goes through this one guard.
fn release_locked(
    conn: &rusqlite::Connection,
    viewer_id: &str,
    workspace_id: &str,
    resource_id: &str,
) -> Result<()> {
    let row = conn
        .query_row(
            &format!("{SELECT} WHERE id = ?1 AND workspace_id = ?2 AND kind != 'terminal'"),
            params![resource_id, workspace_id],
            read_row,
        )
        .optional()?;
    let Some(descriptor) = row.and_then(describe) else {
        return Ok(()); // already gone, or a terminal (never removed here)
    };
    let shown_elsewhere = conn
        .prepare("SELECT order_json FROM viewer_presentations WHERE workspace_id = ?1 AND viewer_id != ?2")?
        .query_map(params![workspace_id, viewer_id], |r| r.get::<_, String>(0))?
        .filter_map(|raw| serde_json::from_str::<Vec<String>>(&raw.ok()?).ok())
        .any(|order| order.iter().any(|id| id == resource_id));
    if shown_elsewhere {
        return Ok(());
    }
    if descriptor.kind == SurfaceKind::File {
        let dirty: bool = conn
            .query_row(
                "SELECT dirty FROM file_buffers WHERE workspace_id = ?1 AND path = ?2",
                params![
                    workspace_id,
                    descriptor.locator.path.as_deref().unwrap_or_default()
                ],
                |r| r.get(0),
            )
            .optional()?
            .unwrap_or(false);
        if dirty {
            return Err(SurfaceError::Dirty);
        }
    }
    conn.execute(
        "DELETE FROM surface_resources WHERE id = ?1",
        params![resource_id],
    )?;
    Ok(())
}

/// Open a file or diff for `viewer_id`: idempotent per resource, and only
/// that viewer gains the tab.
pub fn open(
    db: &HistoryDb,
    viewer_id: &str,
    workspace_id: &str,
    kind: SurfaceKind,
    locator: &SurfaceLocator,
) -> Result<SurfaceDescriptor> {
    check_id(viewer_id, "viewer id")?;
    Ok(db.with_connection(|conn| {
        let tx = conn.transaction()?;
        let descriptor = open_locked(&tx, workspace_id, kind, locator)?;
        add_to_order(
            &tx,
            viewer_id,
            workspace_id,
            std::slice::from_ref(&descriptor.id),
        )?;
        tx.commit()?;
        Ok(descriptor)
    })?)
}

/// Everything that exists in the workspace, for browsing; a viewer's tabs
/// are its presentation's `order`.
pub fn list(db: &HistoryDb, workspace_id: &str) -> Result<Vec<SurfaceDescriptor>> {
    Ok(db.with_connection(|conn| Ok(list_locked(conn, workspace_id)?))?)
}

/// Close a file or diff in one viewer (see [`release_locked`] for the guard).
/// Terminals refuse: closing one means ending its process (`terminal.close`,
/// tab ×), which removes its descriptor.
pub fn close(db: &HistoryDb, viewer_id: &str, workspace_id: &str, resource_id: &str) -> Result<()> {
    check_id(viewer_id, "viewer id")?;
    Ok(db.with_connection(|conn| {
        let tx = conn.transaction()?;
        let descriptor = list_locked(&tx, workspace_id)?
            .into_iter()
            .find(|d| d.id == resource_id)
            .ok_or(SurfaceError::NotFound)?;
        if descriptor.kind == SurfaceKind::Terminal {
            return Err(SurfaceError::Owned.into());
        }
        release_locked(&tx, viewer_id, workspace_id, resource_id)?;
        let (_, mut order) = stored_order(&tx, viewer_id, workspace_id)?;
        if order.contains(&resource_id.to_string()) {
            order.retain(|id| id != resource_id);
            tx.execute(
                "UPDATE viewer_presentations SET order_json = ?3, revision = revision + 1, updated_at = ?4
                 WHERE viewer_id = ?1 AND workspace_id = ?2",
                params![viewer_id, workspace_id, serde_json::to_string(&order).unwrap_or_default(), now_millis()],
            )?;
        }
        tx.commit()?;
        Ok(())
    })?)
}

fn presentation_locked(
    conn: &rusqlite::Connection,
    viewer_id: &str,
    workspace_id: &str,
) -> Result<ViewerPresentation> {
    let stored = conn
        .query_row(
            "SELECT revision, order_json, active_resource_id, layout_json, legacy_layouts_json
             FROM viewer_presentations WHERE viewer_id = ?1 AND workspace_id = ?2",
            params![viewer_id, workspace_id],
            |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, Option<String>>(2)?,
                    r.get::<_, Option<String>>(3)?,
                    r.get::<_, Option<String>>(4)?,
                ))
            },
        )
        .optional()?;
    let mut presentation = ViewerPresentation {
        viewer_id: viewer_id.to_string(),
        workspace_id: workspace_id.to_string(),
        ..Default::default()
    };
    let mut order: Vec<String> = Vec::new();
    if let Some((revision, order_json, active, layout, legacy)) = stored {
        presentation.revision = revision.max(0) as u64;
        order = serde_json::from_str(&order_json).unwrap_or_default();
        presentation.active_resource_id = active;
        presentation.layout = layout.and_then(|raw| serde_json::from_str(&raw).ok());
        presentation.legacy_layouts = legacy
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default();
    }
    // Reconcile against what exists: vanished resources drop out, and
    // terminals (global runtimes, always listed) this viewer has not placed
    // follow in creation order. Files and diffs are never added here.
    let resources = list_locked(conn, workspace_id)?;
    let existing: HashSet<&str> = resources.iter().map(|d| d.id.as_str()).collect();
    let mut seen = HashSet::new();
    order.retain(|id| existing.contains(id.as_str()) && seen.insert(id.clone()));
    order.extend(
        resources
            .iter()
            .filter(|d| d.kind == SurfaceKind::Terminal && !seen.contains(&d.id))
            .map(|d| d.id.clone()),
    );
    if presentation
        .active_resource_id
        .as_deref()
        .is_some_and(|id| !order.iter().any(|o| o == id))
    {
        presentation.active_resource_id = None;
    }
    presentation.order = order;
    Ok(presentation)
}

pub fn get_presentation(
    db: &HistoryDb,
    viewer_id: &str,
    workspace_id: &str,
) -> Result<ViewerPresentation> {
    check_id(viewer_id, "viewer id")?;
    Ok(db.with_connection(|conn| Ok(presentation_locked(conn, viewer_id, workspace_id)?))?)
}

/// Replace one viewer's presentation of one workspace and return it. Only the
/// caller's own row is touched, which is what keeps viewers independent.
/// A file or diff the update drops from the order goes through the same
/// guard as `close` (a last-shown dirty file refuses the whole write), and
/// `base_revision`, when given, must be current.
pub fn set_presentation(
    db: &HistoryDb,
    viewer_id: &str,
    workspace_id: &str,
    update: &PresentationUpdate,
) -> Result<ViewerPresentation> {
    check_id(viewer_id, "viewer id")?;
    if update.order.len() > MAX_PRESENTATION_ORDER {
        return invalid("too many resources in order");
    }
    let layout = update
        .layout
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|e| SurfaceError::Storage(e.into()))?;
    if layout.as_ref().is_some_and(|l| l.len() > MAX_LAYOUT_BYTES) {
        return invalid("layout too large");
    }
    let order_json =
        serde_json::to_string(&update.order).map_err(|e| SurfaceError::Storage(e.into()))?;
    Ok(db.with_connection(|conn| {
        let tx = conn.transaction()?;
        workspace_host(&tx, workspace_id)?;
        let (revision, old_order) = stored_order(&tx, viewer_id, workspace_id)?;
        if update.base_revision.is_some_and(|base| base != revision) {
            return Err(SurfaceError::Conflict.into());
        }
        check_tab_cap(&tx, workspace_id, &update.order)?;
        for id in old_order.iter().filter(|id| !update.order.contains(id)) {
            release_locked(&tx, viewer_id, workspace_id, id)?;
        }
        tx.execute(
            "INSERT INTO viewer_presentations
                (viewer_id, workspace_id, revision, order_json, active_resource_id, layout_json, updated_at)
             VALUES (?1, ?2, 1, ?3, ?4, ?5, ?6)
             ON CONFLICT(viewer_id, workspace_id) DO UPDATE SET
                revision = revision + 1,
                order_json = excluded.order_json,
                active_resource_id = excluded.active_resource_id,
                layout_json = excluded.layout_json,
                updated_at = excluded.updated_at",
            params![viewer_id, workspace_id, order_json, update.active_resource_id, layout, now_millis()],
        )?;
        tx.commit()?;
        Ok(presentation_locked(conn, viewer_id, workspace_id)?)
    })?)
}

/// One-time, idempotent import of a viewer's legacy state into a workspace.
///
/// - Sessions (once per viewer and workspace): the workspace's terminals
///   enter the order with `session_order` (the viewer's old tab order)
///   first, each session's agent terminal before its shells. A session
///   layout holding a Git review panel adds the working-tree diff. Their
///   `pane_layout` blobs are copied verbatim; nothing is restarted/deleted.
/// - `files`: the viewer's localStorage file tabs (once per viewer and
///   workspace; a later call is a no-op, so a tab closed since stays
///   closed). An unusable entry is skipped, never blocking the rest.
pub fn import_legacy(
    db: &HistoryDb,
    viewer_id: &str,
    workspace_id: &str,
    files: &[String],
    session_order: &[String],
) -> Result<ViewerPresentation> {
    check_id(viewer_id, "viewer id")?;
    if files.len() > MAX_IMPORT_FILES || session_order.len() > MAX_PRESENTATION_ORDER {
        return invalid("too much legacy state to import at once");
    }
    Ok(db.with_connection(|conn| {
        let tx = conn.transaction()?;
        workspace_host(&tx, workspace_id)?;
        let first = |source: &str| -> rusqlite::Result<bool> {
            Ok(tx.execute(
                "INSERT OR IGNORE INTO surface_imports (viewer_id, source) VALUES (?1, ?2)",
                params![viewer_id, source],
            )? == 1)
        };
        if first(&format!("sessions:{workspace_id}"))? {
            let terminals = list_locked(&tx, workspace_id)?
                .into_iter()
                .filter(|d| d.kind == SurfaceKind::Terminal)
                .collect::<Vec<_>>();
            let mut sessions = tx
                .prepare(
                    "SELECT id, pane_layout FROM sessions
                     WHERE workspace_id = ?1 AND archived = 0 ORDER BY created_at, rowid",
                )?
                .query_map(params![workspace_id], |r| {
                    Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?))
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            // Stable sort: ids the viewer ordered first, the rest unchanged.
            sessions.sort_by_key(|(id, _)| {
                session_order
                    .iter()
                    .position(|o| o == id)
                    .unwrap_or(usize::MAX)
            });
            let mut ids = Vec::new();
            let mut legacy = BTreeMap::new();
            let mut wants_diff = false;
            for (session_id, layout) in sessions {
                // Agent terminal first, then its shells (creation order).
                let (agent, shells): (Vec<_>, Vec<_>) = terminals
                    .iter()
                    .filter(|d| d.locator.session_id.as_deref() == Some(session_id.as_str()))
                    .partition(|d| d.locator.pane_id.is_none());
                ids.extend(agent.iter().chain(shells.iter()).map(|d| d.id.clone()));
                if let Some(value) = layout.and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
                {
                    wants_diff |=
                        value
                            .get("panels")
                            .and_then(Value::as_object)
                            .is_some_and(|panels| {
                                panels.values().any(|panel| {
                                    panel.get("contentComponent").and_then(Value::as_str)
                                        == Some("gitReview")
                                })
                            });
                    legacy.insert(session_id, value);
                }
            }
            if wants_diff {
                let diff = open_locked(
                    &tx,
                    workspace_id,
                    SurfaceKind::Diff,
                    &SurfaceLocator::default(),
                )?;
                ids.push(diff.id);
            }
            tx.execute(
                "INSERT INTO viewer_presentations
                    (viewer_id, workspace_id, revision, order_json, legacy_layouts_json, updated_at)
                 VALUES (?1, ?2, 0, '[]', ?3, ?4)
                 ON CONFLICT(viewer_id, workspace_id) DO UPDATE SET
                    legacy_layouts_json = COALESCE(legacy_layouts_json, excluded.legacy_layouts_json)",
                params![viewer_id, workspace_id, serde_json::to_string(&legacy).unwrap_or_default(), now_millis()],
            )?;
            add_to_order(&tx, viewer_id, workspace_id, &ids)?;
        }
        if first(&format!("files:{workspace_id}"))? {
            let mut ids = Vec::new();
            for path in files {
                let locator = SurfaceLocator {
                    path: Some(path.clone()),
                    ..Default::default()
                };
                match open_locked(&tx, workspace_id, SurfaceKind::File, &locator) {
                    Ok(descriptor) => ids.push(descriptor.id),
                    Err(SurfaceError::Storage(error)) => return Err(error),
                    Err(_) => {}
                }
            }
            add_to_order(&tx, viewer_id, workspace_id, &ids)?;
        }
        tx.commit()?;
        Ok(presentation_locked(conn, viewer_id, workspace_id)?)
    })?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn db_with_workspace() -> (HistoryDb, String) {
        let db = HistoryDb::open(":memory:").unwrap();
        ensure_schema(&db).unwrap();
        let (_, workspace) = db
            .create_project("local", "/tmp/demo", Some("demo"), None)
            .unwrap();
        (db, workspace.id)
    }

    fn file(path: &str) -> SurfaceLocator {
        SurfaceLocator {
            path: Some(path.into()),
            ..Default::default()
        }
    }

    fn agent(session_id: &str) -> SurfaceLocator {
        SurfaceLocator {
            session_id: Some(session_id.into()),
            ..Default::default()
        }
    }

    /// A visible CLI session in `ws`.
    fn cli_session(db: &HistoryDb, ws: &str, id: &str, layout: Option<&Value>) {
        db.create_session(id, "/tmp/demo").unwrap();
        db.with_connection(|c| {
            c.execute(
                "UPDATE sessions SET workspace_id = ?1, cli_provider_id = 'claude', cli_activity = 1,
                        pane_layout = ?3 WHERE id = ?2",
                params![ws, id, layout.map(Value::to_string)],
            )?;
            Ok(())
        })
        .unwrap();
    }

    fn shell(db: &HistoryDb, ws: &str, session: &str, pane: &str, state: &str) {
        db.with_connection(|c| {
            c.execute(
                "INSERT INTO workspace_terminals (id, session_id, workspace_id, pane_id, cwd, cols, rows, backend, state)
                 VALUES (?1, ?2, ?3, ?4, '/tmp', 80, 24, 'daemon', ?5)",
                params![format!("sh-{pane}"), session, ws, pane, state],
            )?;
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn open_is_idempotent_canonical_and_needs_no_session() {
        let (db, ws) = db_with_workspace();
        let a = open(&db, "v", &ws, SurfaceKind::File, &file("src/a.rs")).unwrap();
        for same in ["./src/a.rs", "src//a.rs", "src/./a.rs"] {
            assert_eq!(
                open(&db, "v", &ws, SurfaceKind::File, &file(same))
                    .unwrap()
                    .id,
                a.id
            );
        }
        assert_eq!(a.host_id, "local");
        let d = open(&db, "v", &ws, SurfaceKind::Diff, &SurfaceLocator::default()).unwrap();
        assert_eq!(d.locator.diff, Some(DiffTarget::WorkingTree));
        assert_eq!(list(&db, &ws).unwrap().len(), 2);
        for bad in ["../etc/passwd", "/etc/passwd", "", ".", "a\\b"] {
            assert!(
                open(&db, "v", &ws, SurfaceKind::File, &file(bad)).is_err(),
                "{bad}"
            );
        }
        assert!(open(&db, "v", &ws, SurfaceKind::Terminal, &agent("s")).is_err());
        assert!(matches!(
            open(&db, "v", "nope", SurfaceKind::File, &file("a")),
            Err(SurfaceError::NotFound)
        ));
    }

    #[test]
    fn terminals_follow_the_existing_lifecycle_and_never_relaunch() {
        let (db, ws) = db_with_workspace();
        assert!(list(&db, &ws).unwrap().is_empty());
        cli_session(&db, &ws, "s1", None);
        shell(&db, &ws, "s1", "pane-a", "running");
        let found = list(&db, &ws).unwrap();
        assert_eq!(found.len(), 2);
        let agent_terminal = found.iter().find(|d| d.locator.pane_id.is_none()).unwrap();
        assert_eq!(agent_terminal.runtime, None); // liveness is the registry's
        let pane = found.iter().find(|d| d.locator.pane_id.is_some()).unwrap();
        assert_eq!(
            pane.runtime,
            Some(SurfaceRuntime {
                id: "sh-pane-a".into(),
                state: "running".into()
            })
        );
        // A hidden (never-used) session and a hosted one get no descriptor.
        db.create_session("quiet", "/tmp/demo").unwrap();
        assert_eq!(list(&db, &ws).unwrap().len(), 2);
        // A lost shell keeps an honest placeholder; the id is stable.
        db.with_connection(|c| {
            c.execute("UPDATE workspace_terminals SET state = 'lost'", [])?;
            Ok(())
        })
        .unwrap();
        let lost = list(&db, &ws).unwrap();
        let again = lost.iter().find(|d| d.locator.pane_id.is_some()).unwrap();
        assert_eq!(
            (
                again.id.as_str(),
                again.runtime.as_ref().unwrap().state.as_str()
            ),
            (pane.id.as_str(), "lost")
        );
        // Terminals refuse surface.close; the session's own delete removes them.
        assert!(matches!(
            close(&db, "v", &ws, &pane.id),
            Err(SurfaceError::Owned)
        ));
        db.delete_session("s1").unwrap();
        db.with_connection(|c| {
            c.execute("DELETE FROM workspace_terminals", [])?;
            Ok(())
        })
        .unwrap();
        assert!(list(&db, &ws).unwrap().is_empty());
    }

    #[test]
    fn file_tabs_are_per_viewer_and_dirty_drafts_block_the_last_close() {
        let (db, ws) = db_with_workspace();
        let one = open(&db, "v1", &ws, SurfaceKind::File, &file("a.txt")).unwrap();
        let two = open(&db, "v2", &ws, SurfaceKind::File, &file("a.txt")).unwrap();
        assert_eq!(one.id, two.id); // one resource, two viewers
        let other = open(&db, "v1", &ws, SurfaceKind::File, &file("only-v1")).unwrap();
        assert_eq!(
            get_presentation(&db, "v1", &ws).unwrap().order,
            vec![one.id.clone(), other.id.clone()]
        );
        // v2 never opened `only-v1`: it must not gain that tab.
        assert_eq!(
            get_presentation(&db, "v2", &ws).unwrap().order,
            vec![one.id.clone()]
        );
        db.with_connection(|c| {
            c.execute(
                "INSERT INTO file_buffers (workspace_id, path, content, dirty, created_at, updated_at)
                 VALUES (?1, 'a.txt', 'x', 1, 0, 0)",
                params![ws],
            )?;
            Ok(())
        })
        .unwrap();
        // v1 closing while v2 still shows it only removes v1's tab.
        close(&db, "v1", &ws, &one.id).unwrap();
        assert_eq!(
            get_presentation(&db, "v1", &ws).unwrap().order,
            vec![other.id.clone()]
        );
        assert_eq!(
            get_presentation(&db, "v2", &ws).unwrap().order,
            vec![one.id.clone()]
        );
        // The last viewer cannot drop a dirty draft's tab...
        assert!(matches!(
            close(&db, "v2", &ws, &one.id),
            Err(SurfaceError::Dirty)
        ));
        db.with_connection(|c| {
            c.execute("UPDATE file_buffers SET dirty = 0", [])?;
            Ok(())
        })
        .unwrap();
        // ...but may once it is saved or discarded; then the descriptor goes.
        close(&db, "v2", &ws, &one.id).unwrap();
        assert!(list(&db, &ws).unwrap().iter().all(|d| d.id != one.id));
    }

    #[test]
    fn viewers_keep_independent_presentation() {
        let (db, ws) = db_with_workspace();
        cli_session(&db, &ws, "s1", None);
        let a = open(&db, "v1", &ws, SurfaceKind::File, &file("a")).unwrap();
        let terminal = list(&db, &ws)
            .unwrap()
            .into_iter()
            .find(|d| d.kind == SurfaceKind::Terminal)
            .unwrap();
        let one = PresentationUpdate {
            order: vec![a.id.clone(), terminal.id.clone()],
            active_resource_id: Some(a.id.clone()),
            layout: Some(json!({"v": 1, "grid": "one"})),
            ..Default::default()
        };
        let first = set_presentation(&db, "v1", &ws, &one).unwrap();
        assert_eq!(
            (first.revision, first.order.clone()),
            (2, one.order.clone()) // open (1), then set (2)
        );
        // v2 sees the global terminal only, with its own (empty) focus.
        let second = get_presentation(&db, "v2", &ws).unwrap();
        assert_eq!(second.order, vec![terminal.id.clone()]);
        assert_eq!(second.active_resource_id, None);
        assert_eq!(second.layout, None);
        // v2 moving focus leaves v1 untouched.
        let two = PresentationUpdate {
            order: vec![terminal.id.clone()],
            active_resource_id: Some(terminal.id.clone()),
            layout: None,
            ..Default::default()
        };
        set_presentation(&db, "v2", &ws, &two).unwrap();
        assert_eq!(get_presentation(&db, "v1", &ws).unwrap(), first);
        assert_eq!(set_presentation(&db, "v1", &ws, &one).unwrap().revision, 3);
        assert!(set_presentation(&db, "", &ws, &one).is_err());
        // The session ends: its tab and focus disappear from every viewer.
        db.delete_session("s1").unwrap();
        let after = get_presentation(&db, "v2", &ws).unwrap();
        assert_eq!((after.order, after.active_resource_id), (vec![], None));
    }

    #[test]
    fn legacy_import_is_idempotent_and_keeps_originals() {
        let (db, ws) = db_with_workspace();
        let layout = json!({
            "grid": {"root": "complex"},
            "panels": {"p1": {"contentComponent": "terminal"}, "p2": {"contentComponent": "gitReview"}}
        });
        cli_session(&db, &ws, "old", Some(&layout));
        cli_session(&db, &ws, "newer", None);
        let long_pane = "p".repeat(200); // legal for `terminal.open`
        shell(&db, &ws, "old", &long_pane, "running");

        let files = vec![
            "src/a.rs".to_string(),
            "../escape".to_string(),
            "b.md".to_string(),
        ];
        let order = vec!["newer".to_string()];
        let first = import_legacy(&db, "v1", &ws, &files, &order).unwrap();
        let again = import_legacy(&db, "v1", &ws, &files, &order).unwrap();
        assert_eq!(first, again);
        let resources = list(&db, &ws).unwrap();
        // 2 agents + 1 shell + 2 files (bad path skipped) + the review panel's diff.
        assert_eq!(resources.len(), 6);
        assert_eq!(first.order.len(), 6);
        assert_eq!(first.legacy_layouts.get("old"), Some(&layout));
        // The viewer's old order leads; the shell keeps its runtime, unrestarted.
        let by_id = |id: &String| resources.iter().find(|d| &d.id == id).unwrap();
        assert_eq!(
            by_id(&first.order[0]).locator.session_id.as_deref(),
            Some("newer")
        );
        assert!(resources.iter().any(|d| d.runtime
            == Some(SurfaceRuntime {
                id: format!("sh-{long_pane}"),
                state: "running".into()
            })));
        assert_eq!(
            by_id(&first.order[4]).locator.path.as_deref(),
            Some("src/a.rs")
        );
        // The original layout column is untouched.
        assert_eq!(
            db.get_session_layout("old").unwrap().unwrap(),
            layout.to_string()
        );
        // A tab closed after migration is not resurrected by a retry.
        close(&db, "v1", &ws, &first.order[4]).unwrap();
        let retried = import_legacy(&db, "v1", &ws, &files, &order).unwrap();
        assert_eq!(retried.order.len(), 5);
        // Another viewer imports its own files without duplicating resources.
        let other = import_legacy(&db, "v2", &ws, &["b.md".to_string()], &[]).unwrap();
        assert_eq!(list(&db, &ws).unwrap().len(), 5);
        assert!(other
            .order
            .iter()
            .any(|id| by_id_path(&resources, id) == Some("b.md")));
    }

    fn by_id_path<'a>(resources: &'a [SurfaceDescriptor], id: &str) -> Option<&'a str> {
        resources
            .iter()
            .find(|d| d.id == id)?
            .locator
            .path
            .as_deref()
    }

    #[test]
    fn presentation_writes_cannot_bypass_the_close_guard_or_go_stale() {
        let (db, ws) = db_with_workspace();
        let f = open(&db, "v", &ws, SurfaceKind::File, &file("a.txt")).unwrap();
        db.with_connection(|c| {
            c.execute(
                "INSERT INTO file_buffers (workspace_id, path, content, dirty, created_at, updated_at)
                 VALUES (?1, 'a.txt', 'x', 1, 0, 0)",
                params![ws],
            )?;
            Ok(())
        })
        .unwrap();
        // Dropping the last tab of a dirty file through `set` is refused too.
        let drop_it = PresentationUpdate::default();
        assert!(matches!(
            set_presentation(&db, "v", &ws, &drop_it),
            Err(SurfaceError::Dirty)
        ));
        assert_eq!(
            get_presentation(&db, "v", &ws).unwrap().order,
            vec![f.id.clone()]
        );

        // An open advances the revision, so a stale write conflicts instead of
        // silently dropping the new tab.
        let seen = get_presentation(&db, "v", &ws).unwrap();
        let g = open(&db, "v", &ws, SurfaceKind::File, &file("b.txt")).unwrap();
        assert!(get_presentation(&db, "v", &ws).unwrap().revision > seen.revision);
        let stale = PresentationUpdate {
            base_revision: Some(seen.revision),
            order: seen.order.clone(),
            ..Default::default()
        };
        assert!(matches!(
            set_presentation(&db, "v", &ws, &stale),
            Err(SurfaceError::Conflict)
        ));
        // A repeat open changes nothing; a current base revision is accepted.
        let before = get_presentation(&db, "v", &ws).unwrap();
        open(&db, "v", &ws, SurfaceKind::File, &file("b.txt")).unwrap();
        assert_eq!(
            get_presentation(&db, "v", &ws).unwrap().revision,
            before.revision
        );
        let fresh = PresentationUpdate {
            base_revision: Some(before.revision),
            order: vec![g.id.clone(), f.id.clone()],
            ..Default::default()
        };
        assert_eq!(
            set_presentation(&db, "v", &ws, &fresh).unwrap().order,
            fresh.order
        );
    }

    #[test]
    fn one_capacity_policy_for_open_import_and_set() {
        let (db, ws) = db_with_workspace();
        let mut last = None;
        for i in 0..MAX_OPEN_TABS {
            last = Some(open(&db, "v", &ws, SurfaceKind::File, &file(&format!("f{i}"))).unwrap());
        }
        assert!(open(&db, "v", &ws, SurfaceKind::File, &file("one-too-many")).is_err());
        // What was saved stays savable: the unchanged presentation round-trips.
        let current = get_presentation(&db, "v", &ws).unwrap();
        assert_eq!(current.order.len(), MAX_OPEN_TABS);
        let same = PresentationUpdate {
            order: current.order.clone(),
            active_resource_id: last.map(|d| d.id),
            ..Default::default()
        };
        set_presentation(&db, "v", &ws, &same).unwrap();
        // An import that would not fit fails whole: no marker, nothing truncated.
        let over: Vec<String> = (0..10).map(|i| format!("extra{i}")).collect();
        assert!(import_legacy(&db, "v", &ws, &over, &[]).is_err());
        assert_eq!(list(&db, &ws).unwrap().len(), MAX_OPEN_TABS);
        close(&db, "v", &ws, &current.order[0]).unwrap();
        assert!(import_legacy(&db, "v", &ws, &over[..1], &[]).is_ok());
    }

    #[test]
    fn removing_a_project_removes_its_surface_state() {
        let (db, ws) = db_with_workspace();
        open(&db, "v", &ws, SurfaceKind::File, &file("a")).unwrap();
        import_legacy(&db, "v", &ws, &["b".to_string()], &[]).unwrap();
        let project: String = db
            .with_connection(|c| {
                Ok(c.query_row(
                    "SELECT project_id FROM workspaces WHERE id = ?1",
                    params![ws],
                    |r| r.get(0),
                )?)
            })
            .unwrap();
        db.delete_project(&project).unwrap();
        let left: i64 = db
            .with_connection(|c| {
                Ok(c.query_row(
                    "SELECT (SELECT COUNT(*) FROM surface_resources) + (SELECT COUNT(*) FROM viewer_presentations)
                          + (SELECT COUNT(*) FROM surface_imports)",
                    [],
                    |r| r.get(0),
                )?)
            })
            .unwrap();
        assert_eq!(left, 0);
    }

    #[test]
    fn survives_core_restart_and_speaks_the_wire_format() {
        let dir = std::env::temp_dir().join(format!("perch-surfaces-{}", uuid::Uuid::new_v4()));
        let path = dir.join("history.sqlite");
        let (ws, file_id) = {
            let db = HistoryDb::open(&path).unwrap();
            ensure_schema(&db).unwrap();
            let (_, workspace) = db
                .create_project("local", "/tmp/demo", Some("demo"), None)
                .unwrap();
            let f = open(&db, "v1", &workspace.id, SurfaceKind::File, &file("a.rs")).unwrap();
            let update = PresentationUpdate {
                order: vec![f.id.clone()],
                active_resource_id: Some(f.id.clone()),
                layout: Some(json!({"v": 1})),
                ..Default::default()
            };
            set_presentation(&db, "v1", &workspace.id, &update).unwrap();
            (workspace.id, f.id)
        };
        // A new process: same file, same schema bootstrap (idempotent).
        let db = HistoryDb::open(&path).unwrap();
        ensure_schema(&db).unwrap();
        let restored = get_presentation(&db, "v1", &ws).unwrap();
        assert_eq!(restored.order, vec![file_id.clone()]);
        assert_eq!(restored.revision, 2);
        assert_eq!(restored.active_resource_id, Some(file_id.clone()));
        assert_eq!(restored.layout, Some(json!({"v": 1})));
        assert_eq!(
            open(&db, "v1", &ws, SurfaceKind::File, &file("a.rs"))
                .unwrap()
                .id,
            file_id
        );
        std::fs::remove_dir_all(dir).ok();

        // Optional fields may be absent (older peers); output omits empties.
        let message: crate::protocol::ClientMessage = serde_json::from_value(json!({
            "type": "surface.open", "requestId": "r", "viewerId": "v", "workspaceId": "w", "kind": "diff"
        }))
        .unwrap();
        assert!(matches!(
            message,
            crate::protocol::ClientMessage::SurfaceOpen { .. }
        ));
        let wire = serde_json::to_value(ViewerPresentation::default()).unwrap();
        assert_eq!(wire["revision"], 0);
        assert!(wire.get("layout").is_none() && wire.get("legacyLayouts").is_none());
    }
}
