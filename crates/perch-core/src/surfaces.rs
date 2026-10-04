//! Canonical, host-qualified open resources (Terminal / File / Diff) and
//! per-viewer presentation (order, focus, split geometry).
//!
//! Two kinds of state, deliberately separate:
//! - `surface_resources`: what exists in a workspace. Identity is
//!   `(host, workspace, kind, locator)`, so opening the same thing twice
//!   returns the same id and files/diffs need no chat session parent. A
//!   terminal descriptor *refers* to a runtime (agent session or shell pane);
//!   it never starts or stops one.
//! - `viewer_presentations`: how one viewer arranges a workspace's resources.
//!   Keyed by the viewer's stable id, so two viewers never write the same row
//!   and cannot fight over focus or layout. The layout blob is opaque to Rust
//!   (the client's versioned Dockview adapter owns its shape).
//!
//! Legacy state (per-session `pane_layout`, the web's localStorage file tabs)
//! is imported once per viewer by [`import_legacy`]. Originals are never
//! modified or deleted: `sessions.pane_layout` stays in place and a verbatim
//! copy is kept in `legacy_layouts_json` until a later slice verifies the
//! translated layout. Importing again is a no-op.
//!
//! Resources whose workspace, session or shell pane has gone are reported as
//! `stale` placeholders; nothing here ever launches a command.

use crate::agent_persistence::SqliteConnectionAdapter;
use crate::db::HistoryDb;
use crate::source_control::DiffTarget;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashSet};
use std::path::{Component, Path};

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

pub const MAX_PRESENTATION_ORDER: usize = 512;
pub const MAX_LAYOUT_BYTES: usize = 256 * 1024;
const MAX_PATH_BYTES: usize = 4096;
const MAX_IMPORT_FILES: usize = 512;

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

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SurfaceStatus {
    Ok,
    /// What it referred to is gone. Shown as a placeholder, never relaunched.
    Stale,
}

/// The runtime a terminal descriptor refers to (never owned by the view).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceRuntime {
    pub id: String,
    /// Shell panes: the row's lifecycle (`running`, `exited`, `lost`, ...).
    /// Agent terminals report `unknown`: liveness is the lifecycle
    /// registry's, not this table's.
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
    pub status: SurfaceStatus,
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
    Storage(anyhow::Error),
}

impl std::fmt::Display for SurfaceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Invalid(message) => f.write_str(message),
            Self::NotFound => f.write_str("not found"),
            Self::Dirty => f.write_str("the file has unsaved changes"),
            Self::Owned => f.write_str("close the terminal itself; its process is still owned"),
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
    if value.is_empty() || value.len() > 128 || value.chars().any(char::is_control) {
        return invalid(&format!("invalid {what}"));
    }
    Ok(())
}

/// Workspace-relative, no traversal: the filesystem service re-confines it,
/// this only keeps nonsense out of durable identity.
fn check_relative_path(path: &str) -> Result<()> {
    if path.is_empty() || path.len() > MAX_PATH_BYTES || path.contains('\0') {
        return invalid("invalid file path");
    }
    if Path::new(path)
        .components()
        .any(|c| !matches!(c, Component::Normal(_) | Component::CurDir))
    {
        return invalid("file path must stay inside its workspace");
    }
    Ok(())
}

/// Validate a locator for its kind and return its canonical key.
fn locator_key(kind: SurfaceKind, locator: &SurfaceLocator) -> Result<String> {
    let canonical = match kind {
        SurfaceKind::File => {
            let path = locator.path.as_deref().unwrap_or_default();
            check_relative_path(path)?;
            SurfaceLocator {
                path: Some(path.trim_start_matches("./").to_string()),
                ..Default::default()
            }
        }
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

/// Resolve a stored row to a descriptor, marking dangling terminal references
/// stale. Rows of an unknown kind (written by a newer core) are skipped.
fn describe(
    conn: &rusqlite::Connection,
    row: (String, String, String, String, String, i64),
) -> Result<Option<SurfaceDescriptor>> {
    let (id, host_id, workspace_id, kind, locator, created_at) = row;
    let Some(kind) = SurfaceKind::parse(&kind) else {
        return Ok(None);
    };
    let Ok(locator) = serde_json::from_str::<SurfaceLocator>(&locator) else {
        return Ok(None);
    };
    let (status, runtime) = match kind {
        SurfaceKind::Terminal => {
            let session_id = locator.session_id.as_deref().unwrap_or_default();
            let session_live: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM sessions WHERE id = ?1)",
                params![session_id],
                |r| r.get(0),
            )?;
            match &locator.pane_id {
                Some(pane_id) => {
                    let shell = conn
                        .query_row(
                            "SELECT id, state FROM workspace_terminals
                             WHERE session_id = ?1 AND pane_id = ?2",
                            params![session_id, pane_id],
                            |r| {
                                Ok(SurfaceRuntime {
                                    id: r.get(0)?,
                                    state: r.get(1)?,
                                })
                            },
                        )
                        .optional()?;
                    match shell {
                        Some(runtime) => (SurfaceStatus::Ok, Some(runtime)),
                        None => (SurfaceStatus::Stale, None),
                    }
                }
                None if session_live => (
                    SurfaceStatus::Ok,
                    Some(SurfaceRuntime {
                        id: session_id.to_string(),
                        state: "unknown".into(),
                    }),
                ),
                None => (SurfaceStatus::Stale, None),
            }
        }
        SurfaceKind::File | SurfaceKind::Diff => {
            let live: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id = ?1)",
                params![workspace_id],
                |r| r.get(0),
            )?;
            (
                if live {
                    SurfaceStatus::Ok
                } else {
                    SurfaceStatus::Stale
                },
                None,
            )
        }
    };
    Ok(Some(SurfaceDescriptor {
        id,
        host_id,
        workspace_id,
        kind,
        locator,
        status,
        runtime,
        created_at,
    }))
}

fn read_row(
    r: &rusqlite::Row<'_>,
) -> rusqlite::Result<(String, String, String, String, String, i64)> {
    Ok((
        r.get(0)?,
        r.get(1)?,
        r.get(2)?,
        r.get(3)?,
        r.get(4)?,
        r.get(5)?,
    ))
}

fn list_locked(conn: &rusqlite::Connection, workspace_id: &str) -> Result<Vec<SurfaceDescriptor>> {
    let mut statement =
        conn.prepare(&format!("{SELECT} WHERE workspace_id = ?1 ORDER BY rowid"))?;
    let rows = statement
        .query_map(params![workspace_id], read_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        out.extend(describe(conn, row)?);
    }
    Ok(out)
}

/// Insert-or-find. Opening never creates a process: a terminal descriptor
/// must name a session (and shell pane) that already exists.
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
    let key = locator_key(kind, locator)?;
    if kind == SurfaceKind::Terminal {
        let canonical: SurfaceLocator =
            serde_json::from_str(&key).map_err(|e| SurfaceError::Storage(e.into()))?;
        let session_workspace: Option<Option<String>> = conn
            .query_row(
                "SELECT workspace_id FROM sessions WHERE id = ?1",
                params![canonical.session_id],
                |r| r.get(0),
            )
            .optional()?;
        match session_workspace {
            Some(Some(owner)) if owner == workspace_id => {}
            Some(_) => return invalid("session belongs to another workspace"),
            None => return Err(SurfaceError::NotFound),
        }
        if let Some(pane_id) = &canonical.pane_id {
            let exists: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM workspace_terminals WHERE session_id = ?1 AND pane_id = ?2)",
                params![canonical.session_id, pane_id],
                |r| r.get(0),
            )?;
            if !exists {
                return Err(SurfaceError::NotFound);
            }
        }
    }
    conn.execute(
        "INSERT OR IGNORE INTO surface_resources (id, host_id, workspace_id, kind, locator, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![uuid::Uuid::new_v4().to_string(), host_id, workspace_id, kind.as_str(), key, now_millis()],
    )?;
    let row = conn.query_row(
        &format!(
            "{SELECT} WHERE host_id = ?1 AND workspace_id = ?2 AND kind = ?3 AND locator = ?4"
        ),
        params![host_id, workspace_id, kind.as_str(), key],
        read_row,
    )?;
    describe(conn, row)?.ok_or(SurfaceError::NotFound)
}

pub fn open(
    db: &HistoryDb,
    workspace_id: &str,
    kind: SurfaceKind,
    locator: &SurfaceLocator,
) -> Result<SurfaceDescriptor> {
    Ok(db.with_connection(|conn| Ok(open_locked(conn, workspace_id, kind, locator)?))?)
}

pub fn list(db: &HistoryDb, workspace_id: &str) -> Result<Vec<SurfaceDescriptor>> {
    Ok(db.with_connection(|conn| Ok(list_locked(conn, workspace_id)?))?)
}

/// Drop a descriptor. Never touches a process or a draft: a live terminal
/// refuses (close the terminal), a file with an unsaved draft refuses (Save
/// or Discard first). Viewers drop the id from their order on next read.
pub fn close(db: &HistoryDb, workspace_id: &str, resource_id: &str) -> Result<()> {
    Ok(db.with_connection(|conn| Ok(close_locked(conn, workspace_id, resource_id)?))?)
}

fn close_locked(conn: &rusqlite::Connection, workspace_id: &str, resource_id: &str) -> Result<()> {
    let row = conn
        .query_row(
            &format!("{SELECT} WHERE id = ?1 AND workspace_id = ?2"),
            params![resource_id, workspace_id],
            read_row,
        )
        .optional()?
        .ok_or(SurfaceError::NotFound)?;
    if let Some(descriptor) = describe(conn, row)? {
        match descriptor.kind {
            SurfaceKind::Terminal if descriptor.status == SurfaceStatus::Ok => {
                return Err(SurfaceError::Owned);
            }
            SurfaceKind::File => {
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
            _ => {}
        }
    }
    conn.execute(
        "DELETE FROM surface_resources WHERE id = ?1",
        params![resource_id],
    )?;
    Ok(())
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
    // Reconcile against what exists: closed resources drop out, resources
    // this viewer has not placed yet follow in creation order.
    let resources = list_locked(conn, workspace_id)?;
    let existing: HashSet<&str> = resources.iter().map(|d| d.id.as_str()).collect();
    let mut seen = HashSet::new();
    order.retain(|id| existing.contains(id.as_str()) && seen.insert(id.clone()));
    order.extend(
        resources
            .iter()
            .filter(|d| !seen.contains(&d.id))
            .map(|d| d.id.clone()),
    );
    if presentation
        .active_resource_id
        .as_deref()
        .is_some_and(|id| !existing.contains(id))
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
        workspace_host(conn, workspace_id)?;
        conn.execute(
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
        Ok(presentation_locked(conn, viewer_id, workspace_id)?)
    })?)
}

/// One-time, idempotent import of a viewer's legacy state into a workspace.
///
/// - `files`: the viewer's localStorage file tabs for this workspace (once
///   per viewer; a later call is a no-op so a tab closed since stays closed).
/// - Sessions (once per viewer and workspace): each CLI session and each
///   shell pane becomes a terminal descriptor in place, `session_order`
///   (the viewer's old tab order) first. Their `pane_layout` blobs are
///   copied verbatim into the presentation; nothing is restarted or deleted.
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
            let mut statement = tx.prepare(
                "SELECT id, pane_layout, cli_provider_id IS NOT NULL FROM sessions
                 WHERE workspace_id = ?1 AND archived = 0 ORDER BY created_at, rowid",
            )?;
            let mut sessions = statement
                .query_map(params![workspace_id], |r| {
                    Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?, r.get::<_, bool>(2)?))
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            drop(statement);
            // Stable sort: ids the viewer ordered first, the rest unchanged.
            sessions.sort_by_key(|(id, _, _)| session_order.iter().position(|o| o == id).unwrap_or(usize::MAX));
            let mut legacy = BTreeMap::new();
            for (session_id, layout, is_cli) in sessions {
                let agent = SurfaceLocator { session_id: Some(session_id.clone()), ..Default::default() };
                if is_cli {
                    open_locked(&tx, workspace_id, SurfaceKind::Terminal, &agent)?;
                }
                let panes = {
                    let mut statement = tx.prepare(
                        "SELECT pane_id FROM workspace_terminals WHERE session_id = ?1 ORDER BY rowid",
                    )?;
                    let rows = statement.query_map(params![session_id], |r| r.get::<_, String>(0))?;
                    rows.collect::<rusqlite::Result<Vec<_>>>()?
                };
                for pane_id in panes {
                    let shell = SurfaceLocator { pane_id: Some(pane_id), ..agent.clone() };
                    open_locked(&tx, workspace_id, SurfaceKind::Terminal, &shell)?;
                }
                if let Some(value) = layout.and_then(|raw| serde_json::from_str::<Value>(&raw).ok()) {
                    legacy.insert(session_id, value);
                }
            }
            tx.execute(
                "INSERT INTO viewer_presentations
                    (viewer_id, workspace_id, revision, order_json, legacy_layouts_json, updated_at)
                 VALUES (?1, ?2, 0, '[]', ?3, ?4)
                 ON CONFLICT(viewer_id, workspace_id) DO UPDATE SET
                    legacy_layouts_json = COALESCE(legacy_layouts_json, excluded.legacy_layouts_json)",
                params![viewer_id, workspace_id, serde_json::to_string(&legacy).unwrap_or_default(), now_millis()],
            )?;
        }
        if first(&format!("files:{workspace_id}"))? {
            for path in files {
                // One bad entry (stale or hand-edited storage) must not
                // block the rest.
                let locator = SurfaceLocator { path: Some(path.clone()), ..Default::default() };
                if let Err(error @ SurfaceError::Storage(_)) =
                    open_locked(&tx, workspace_id, SurfaceKind::File, &locator)
                {
                    return Err(error.into());
                }
            }
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

    #[test]
    fn open_is_idempotent_and_needs_no_session() {
        let (db, ws) = db_with_workspace();
        let a = open(&db, &ws, SurfaceKind::File, &file("src/a.rs")).unwrap();
        let b = open(&db, &ws, SurfaceKind::File, &file("./src/a.rs")).unwrap();
        assert_eq!(a.id, b.id);
        assert_eq!(a.host_id, "local");
        let d = open(&db, &ws, SurfaceKind::Diff, &SurfaceLocator::default()).unwrap();
        assert_eq!(d.locator.diff, Some(DiffTarget::WorkingTree));
        assert_eq!(list(&db, &ws).unwrap().len(), 2);
        assert!(open(&db, &ws, SurfaceKind::File, &file("../etc/passwd")).is_err());
        assert!(open(&db, &ws, SurfaceKind::File, &file("/etc/passwd")).is_err());
        assert!(matches!(
            open(&db, "nope", SurfaceKind::File, &file("a")),
            Err(SurfaceError::NotFound)
        ));
    }

    #[test]
    fn closing_refuses_dirty_drafts_and_live_terminals() {
        let (db, ws) = db_with_workspace();
        let f = open(&db, &ws, SurfaceKind::File, &file("a.txt")).unwrap();
        db.with_connection(|c| {
            c.execute(
                "INSERT INTO file_buffers (workspace_id, path, content, dirty, created_at, updated_at)
                 VALUES (?1, 'a.txt', 'x', 1, 0, 0)",
                params![ws],
            )?;
            Ok(())
        })
        .unwrap();
        assert!(matches!(close(&db, &ws, &f.id), Err(SurfaceError::Dirty)));
        db.with_connection(|c| {
            c.execute("UPDATE file_buffers SET dirty = 0", [])?;
            Ok(())
        })
        .unwrap();
        close(&db, &ws, &f.id).unwrap();
        assert!(list(&db, &ws).unwrap().is_empty());

        db.create_session("s1", "/tmp/demo").unwrap();
        db.with_connection(|c| {
            c.execute(
                "UPDATE sessions SET workspace_id = ?1 WHERE id = 's1'",
                params![ws],
            )?;
            Ok(())
        })
        .unwrap();
        let t = open(
            &db,
            &ws,
            SurfaceKind::Terminal,
            &SurfaceLocator {
                session_id: Some("s1".into()),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(t.status, SurfaceStatus::Ok);
        assert!(matches!(close(&db, &ws, &t.id), Err(SurfaceError::Owned)));
        // The session goes away: an honest stale placeholder, closable.
        db.with_connection(|c| {
            c.execute("DELETE FROM sessions WHERE id = 's1'", [])?;
            Ok(())
        })
        .unwrap();
        assert_eq!(list(&db, &ws).unwrap()[0].status, SurfaceStatus::Stale);
        close(&db, &ws, &t.id).unwrap();
    }

    #[test]
    fn viewers_keep_independent_presentation() {
        let (db, ws) = db_with_workspace();
        let a = open(&db, &ws, SurfaceKind::File, &file("a")).unwrap();
        let b = open(&db, &ws, SurfaceKind::File, &file("b")).unwrap();
        let one = PresentationUpdate {
            order: vec![b.id.clone(), a.id.clone()],
            active_resource_id: Some(b.id.clone()),
            layout: Some(json!({"v": 1, "grid": "one"})),
        };
        let two = PresentationUpdate {
            order: vec![a.id.clone()],
            active_resource_id: Some(a.id.clone()),
            layout: None,
        };
        set_presentation(&db, "viewer-1", &ws, &one).unwrap();
        let second = set_presentation(&db, "viewer-2", &ws, &two).unwrap();
        let first = get_presentation(&db, "viewer-1", &ws).unwrap();
        assert_eq!(first.order, vec![b.id.clone(), a.id.clone()]);
        assert_eq!(first.active_resource_id, Some(b.id.clone()));
        assert_eq!(first.layout, one.layout);
        assert_eq!(first.revision, 1);
        // Viewer 2 never placed `b`: it follows, and focus is its own.
        assert_eq!(second.order, vec![a.id.clone(), b.id.clone()]);
        assert_eq!(second.active_resource_id, Some(a.id.clone()));
        assert_eq!(
            set_presentation(&db, "viewer-1", &ws, &one)
                .unwrap()
                .revision,
            2
        );
        // A closed resource drops out of every viewer's order and focus.
        close(&db, &ws, &b.id).unwrap();
        let after = get_presentation(&db, "viewer-1", &ws).unwrap();
        assert_eq!(after.order, vec![a.id]);
        assert_eq!(after.active_resource_id, None);
        assert!(set_presentation(&db, "", &ws, &one).is_err());
    }

    #[test]
    fn legacy_import_is_idempotent_and_keeps_originals() {
        let (db, ws) = db_with_workspace();
        let layout = json!({"grid": {"root": "complex"}, "panels": {"p1": {}, "p2": {}}});
        for id in ["old", "newer"] {
            db.create_session(id, "/tmp/demo").unwrap();
        }
        db.with_connection(|c| {
            c.execute(
                "UPDATE sessions SET workspace_id = ?1, cli_provider_id = 'claude', pane_layout = ?2 WHERE id = 'old'",
                params![ws, layout.to_string()],
            )?;
            c.execute(
                "UPDATE sessions SET workspace_id = ?1, cli_provider_id = 'claude' WHERE id = 'newer'",
                params![ws],
            )?;
            c.execute(
                "INSERT INTO workspace_terminals (id, session_id, workspace_id, pane_id, cwd, cols, rows, backend, state)
                 VALUES ('sh1', 'old', ?1, 'pane-a', '/tmp', 80, 24, 'daemon', 'running')",
                params![ws],
            )?;
            Ok(())
        })
        .unwrap();

        let files = vec![
            "src/a.rs".to_string(),
            "../escape".to_string(),
            "b.md".to_string(),
        ];
        let order = vec!["newer".to_string()];
        let first = import_legacy(&db, "v1", &ws, &files, &order).unwrap();
        let again = import_legacy(&db, "v1", &ws, &files, &order).unwrap();
        assert_eq!(first, again);
        assert_eq!(list(&db, &ws).unwrap().len(), 5); // 2 agents + 1 shell + 2 files; bad path skipped
        assert_eq!(first.legacy_layouts.get("old"), Some(&layout));
        // The viewer's old order leads; the running shell keeps its runtime.
        let resources = list(&db, &ws).unwrap();
        let first_resource = resources.iter().find(|d| d.id == first.order[0]).unwrap();
        assert_eq!(first_resource.locator.session_id.as_deref(), Some("newer"));
        assert!(resources.iter().any(|d| d.runtime
            == Some(SurfaceRuntime {
                id: "sh1".into(),
                state: "running".into()
            })));
        // The original layout column is untouched.
        assert_eq!(
            db.get_session_layout("old").unwrap().unwrap(),
            layout.to_string()
        );
        // A tab closed after migration is not resurrected by a retry.
        let a = resources
            .iter()
            .find(|d| d.locator.path.as_deref() == Some("src/a.rs"))
            .unwrap();
        close(&db, &ws, &a.id).unwrap();
        import_legacy(&db, "v1", &ws, &files, &order).unwrap();
        assert_eq!(list(&db, &ws).unwrap().len(), 4);
        // Another viewer imports its own files without duplicating resources.
        import_legacy(&db, "v2", &ws, &["b.md".to_string()], &[]).unwrap();
        assert_eq!(list(&db, &ws).unwrap().len(), 4);
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
            let f = open(&db, &workspace.id, SurfaceKind::File, &file("a.rs")).unwrap();
            let update = PresentationUpdate {
                order: vec![f.id.clone()],
                active_resource_id: Some(f.id.clone()),
                layout: Some(json!({"v": 1})),
            };
            set_presentation(&db, "v1", &workspace.id, &update).unwrap();
            (workspace.id, f.id)
        };
        // A new process: same file, same schema bootstrap (idempotent).
        let db = HistoryDb::open(&path).unwrap();
        ensure_schema(&db).unwrap();
        let restored = get_presentation(&db, "v1", &ws).unwrap();
        assert_eq!(restored.order, vec![file_id.clone()]);
        assert_eq!(restored.active_resource_id, Some(file_id.clone()));
        assert_eq!(restored.layout, Some(json!({"v": 1})));
        assert_eq!(
            open(&db, &ws, SurfaceKind::File, &file("a.rs")).unwrap().id,
            file_id
        );
        std::fs::remove_dir_all(dir).ok();

        // Optional fields may be absent (older peers); output omits empties.
        let message: crate::protocol::ClientMessage = serde_json::from_value(json!({
            "type": "surface.open", "requestId": "r", "workspaceId": "w", "kind": "diff"
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
