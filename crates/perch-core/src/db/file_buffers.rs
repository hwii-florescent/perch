//! Durable editor buffers, save intents, and save-operation receipts.
//! Pure move from `db.rs` — see the refactor plan's Phase 5. No logic
//! changed.
//!
//! FileBufferRow, FileBufferMetadataRow, FileBufferUpdate,
//! FileBufferObservation, FileSaveCompletion, FileSaveOperation,
//! FileSaveIntentRow, FileSaveOperationRow, FileBufferError,
//! MAX_FILE_BUFFERS_PER_WORKSPACE, MAX_FILE_BUFFER_WATCHES,
//! MAX_FILE_BUFFER_BYTES are re-exported from db/mod.rs
//! (`pub use file_buffers::{...}`) to keep `crate::db::X` import paths
//! working — most are named directly in server/mod.rs's own top-level
//! `use crate::db::{...}` block.

use super::*;

/// Durable editor buffer. The content is intentionally bounded by the
/// filesystem adapter before it reaches SQLite. `base_content` is the exact
/// bounded text the editor opened, retained so a merge/compare can still be
/// offered after an external edit and a process restart. `base_version` is
/// its disk version; `external_version` is the last disk version observed by
/// the core. Keeping all three lets a dirty draft survive a reconnect/restart
/// while still exposing an external-change conflict.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileBufferRow {
    pub workspace_id: String,
    pub path: String,
    pub content: String,
    pub base_content: String,
    pub base_version: Option<String>,
    pub external_version: Option<String>,
    pub revision: u64,
    pub dirty: bool,
    pub conflict: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Metadata needed by buffer lists and the external-change poller.  Keeping
/// draft/base text out of this row is important: a watcher pass must never
/// materialize hundreds of megabytes merely to decide which paths need a
/// closer look.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileBufferMetadataRow {
    pub workspace_id: String,
    pub path: String,
    pub base_version: Option<String>,
    pub external_version: Option<String>,
    pub revision: u64,
    pub dirty: bool,
    pub conflict: bool,
    pub updated_at: i64,
}

/// Values used when creating or replacing a durable editor buffer.
#[derive(Debug, Clone)]
pub struct FileBufferUpdate {
    pub content: String,
    pub base_content: String,
    pub base_version: Option<String>,
    pub external_version: Option<String>,
    pub dirty: bool,
    pub conflict: bool,
}

/// One bounded filesystem observation used to reconcile an open buffer. The
/// references keep watcher and request paths allocation-free while grouping
/// the related values into one coherent update.
#[derive(Debug, Clone, Copy)]
pub struct FileBufferObservation<'a> {
    pub content: Option<&'a str>,
    pub base_content: Option<&'a str>,
    pub base_version: Option<&'a str>,
    pub external_version: Option<&'a str>,
    pub dirty: bool,
    pub conflict: bool,
}

/// Values needed to atomically reconcile one completed filesystem save.
#[derive(Debug, Clone, Copy)]
pub struct FileSaveCompletion<'a> {
    pub operation_id: &'a str,
    pub workspace_id: &'a str,
    pub path: &'a str,
    pub content: &'a str,
    pub version: &'a str,
    pub expected_revision: Option<u64>,
    pub bytes_written: usize,
    pub metadata_json: &'a str,
    pub max_receipts: usize,
}

/// Values for a completed-save idempotency receipt.
#[derive(Debug, Clone, Copy)]
pub struct FileSaveOperation<'a> {
    pub operation_id: &'a str,
    pub workspace_id: &'a str,
    pub path: &'a str,
    pub content_version: &'a str,
    pub expected_buffer_revision: Option<u64>,
    pub bytes_written: usize,
    pub metadata_json: &'a str,
    pub max_receipts: usize,
}

/// A durable save intent written before the filesystem rename. If the
/// process exits between publication and buffer reconciliation, startup can
/// compare the on-disk hash to `version` and complete only the matching
/// reconciliation. A later draft revision is never overwritten.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileSaveIntentRow {
    pub operation_id: String,
    pub workspace_id: String,
    pub path: String,
    pub content: String,
    pub version: String,
    pub expected_buffer_revision: Option<u64>,
    pub created_at: i64,
}

/// Completed save receipt used to make a retried request idempotent across a
/// reconnect or process restart. Metadata is stored as bounded JSON and
/// decoded by the server only after it has verified the operation id and
/// workspace/path pair.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileSaveOperationRow {
    pub operation_id: String,
    pub workspace_id: String,
    pub path: String,
    pub content_version: String,
    pub expected_buffer_revision: Option<u64>,
    pub bytes_written: usize,
    pub metadata_json: String,
    pub created_at: i64,
}

/// Optimistic buffer mutations return the current row when another client
/// supplied a stale revision. This is deliberately typed so the server can
/// return the current bounded draft rather than silently dropping it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FileBufferError {
    Conflict {
        expected: Option<u64>,
        current: Option<Box<FileBufferRow>>,
    },
    Limit {
        limit: usize,
    },
    ContentTooLarge {
        limit: usize,
    },
    Dirty {
        current: Box<FileBufferRow>,
    },
    Database {
        message: String,
    },
}

impl fmt::Display for FileBufferError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Conflict { expected, current } => write!(
                f,
                "file buffer revision conflict (expected {}, current {})",
                expected
                    .map(|revision| revision.to_string())
                    .as_deref()
                    .unwrap_or("<absent>"),
                current
                    .as_ref()
                    .map(|row| row.revision.to_string())
                    .as_deref()
                    .unwrap_or("<absent>")
            ),
            Self::Limit { limit } => write!(f, "workspace file buffer limit reached ({limit})"),
            Self::ContentTooLarge { limit } => {
                write!(f, "file buffer content exceeds the {limit}-byte limit")
            }
            Self::Dirty { .. } => f.write_str("file buffer has unsaved or conflicted content"),
            Self::Database { message } => f.write_str(message),
        }
    }
}

impl std::error::Error for FileBufferError {}

/// Maximum number of durable buffer rows retained for one workspace. The
/// server also caps the total rows it polls for external invalidation.
pub const MAX_FILE_BUFFERS_PER_WORKSPACE: usize = 128;
pub const MAX_FILE_BUFFER_WATCHES: usize = 512;
/// The durable draft cap follows the service write/read cap. The server
/// checks the workspace service's exact limit before calling these methods;
/// this constant protects direct DB callers and malformed old clients.
pub const MAX_FILE_BUFFER_BYTES: usize = 4 * 1024 * 1024;

impl HistoryDb {
    /// Return one durable editor buffer, if it is open in the workspace.
    pub fn get_file_buffer(
        &self,
        workspace_id: &str,
        path: &str,
    ) -> anyhow::Result<Option<FileBufferRow>> {
        let conn = self.conn.lock().unwrap();
        Ok(get_file_buffer_locked(&conn, workspace_id, path)?)
    }

    /// Return the bounded list of open buffers for one workspace. The caller
    /// supplies a cap so a corrupted or very old database cannot force an
    /// unbounded response.
    pub fn list_file_buffers(
        &self,
        workspace_id: &str,
        limit: usize,
    ) -> anyhow::Result<Vec<FileBufferRow>> {
        let conn = self.conn.lock().unwrap();
        Ok(list_file_buffers_locked(&conn, Some(workspace_id), limit)?)
    }

    /// Return only the bounded metadata needed to populate a buffer list.
    /// Draft and base text are loaded by `get_file_buffer` for one requested
    /// path, so a list response cannot amplify a workspace's retained text
    /// into a large SQLite allocation.
    pub fn list_file_buffer_metadata(
        &self,
        workspace_id: &str,
        limit: usize,
    ) -> anyhow::Result<Vec<FileBufferMetadataRow>> {
        let conn = self.conn.lock().unwrap();
        Ok(list_file_buffer_metadata_locked(
            &conn,
            Some(workspace_id),
            limit,
        )?)
    }

    /// Return a bounded cross-workspace watch set for the background
    /// invalidation poller. Rows represent open buffers, so no repository scan
    /// or eager directory walk is needed.
    pub fn list_file_buffers_for_watch(
        &self,
        limit: usize,
    ) -> anyhow::Result<Vec<FileBufferMetadataRow>> {
        let conn = self.conn.lock().unwrap();
        Ok(list_file_buffer_metadata_locked(&conn, None, limit)?)
    }

    /// Create or replace a draft using optimistic buffer revision checking.
    /// A missing expected revision is accepted only for a new row; existing
    /// rows require the caller to name the revision it read.
    pub fn set_file_buffer(
        &self,
        workspace_id: &str,
        path: &str,
        update: FileBufferUpdate,
        expected_revision: Option<u64>,
        max_buffers: usize,
    ) -> Result<FileBufferRow, FileBufferError> {
        let conn = self.conn.lock().unwrap();
        validate_file_buffer_update(&update, MAX_FILE_BUFFER_BYTES)?;
        let existing = get_file_buffer_locked(&conn, workspace_id, path)
            .map_err(file_buffer_database_error)?;
        match (&existing, expected_revision) {
            (Some(current), Some(expected)) if current.revision != expected => {
                return Err(FileBufferError::Conflict {
                    expected: Some(expected),
                    current: existing.map(Box::new),
                });
            }
            (Some(_current), None) => {
                return Err(FileBufferError::Conflict {
                    expected: None,
                    current: existing.map(Box::new),
                });
            }
            (None, Some(expected)) if expected != 0 => {
                return Err(FileBufferError::Conflict {
                    expected: Some(expected),
                    current: None,
                });
            }
            _ => {}
        }
        if existing.is_none() {
            let count = count_file_buffers_locked(&conn, workspace_id)
                .map_err(file_buffer_database_error)?;
            if count >= max_buffers {
                return Err(FileBufferError::Limit { limit: max_buffers });
            }
        }
        let now = now_millis();
        let revision = existing
            .as_ref()
            .map(|buffer| buffer.revision.saturating_add(1))
            .unwrap_or(1);
        let result = conn.execute(
            "INSERT INTO file_buffers
                (workspace_id, path, content, base_content, base_version,
                 external_version, revision, dirty, conflict, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
             ON CONFLICT(workspace_id, path) DO UPDATE SET
                content = excluded.content,
                base_content = excluded.base_content,
                base_version = excluded.base_version,
                external_version = excluded.external_version,
                revision = excluded.revision,
                dirty = excluded.dirty,
                conflict = excluded.conflict,
                updated_at = excluded.updated_at",
            params![
                workspace_id,
                path,
                update.content,
                update.base_content,
                update.base_version,
                update.external_version,
                revision as i64,
                update.dirty as i32,
                update.conflict as i32,
                now,
            ],
        );
        result.map_err(file_buffer_database_error)?;
        get_file_buffer_locked(&conn, workspace_id, path)
            .map_err(file_buffer_database_error)?
            .ok_or_else(|| file_buffer_database_error(anyhow::anyhow!("file buffer disappeared")))
    }

    /// Insert a clean row when a file tab is first opened. A second opener of
    /// the same path gets the existing row and therefore sees the same draft.
    pub fn ensure_file_buffer(
        &self,
        workspace_id: &str,
        path: &str,
        update: FileBufferUpdate,
        max_buffers: usize,
    ) -> Result<FileBufferRow, FileBufferError> {
        let conn = self.conn.lock().unwrap();
        validate_file_buffer_update(&update, MAX_FILE_BUFFER_BYTES)?;
        if let Some(existing) =
            get_file_buffer_locked(&conn, workspace_id, path).map_err(file_buffer_database_error)?
        {
            return Ok(existing);
        }
        let count =
            count_file_buffers_locked(&conn, workspace_id).map_err(file_buffer_database_error)?;
        if count >= max_buffers {
            return Err(FileBufferError::Limit { limit: max_buffers });
        }
        let now = now_millis();
        conn.execute(
            "INSERT INTO file_buffers
                (workspace_id, path, content, base_content, base_version,
                 external_version, revision, dirty, conflict, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8, ?9, ?9)",
            params![
                workspace_id,
                path,
                update.content,
                update.base_content,
                update.base_version,
                update.external_version,
                update.dirty as i32,
                update.conflict as i32,
                now,
            ],
        )
        .map_err(file_buffer_database_error)?;
        get_file_buffer_locked(&conn, workspace_id, path)
            .map_err(file_buffer_database_error)?
            .ok_or_else(|| file_buffer_database_error(anyhow::anyhow!("file buffer disappeared")))
    }

    /// Record the newest disk observation for an existing open buffer. Dirty
    /// content is preserved; clean content may be replaced by the fresh disk
    /// text. Returns `None` when the row no longer exists.
    pub fn observe_file_buffer(
        &self,
        workspace_id: &str,
        path: &str,
        observation: FileBufferObservation<'_>,
    ) -> anyhow::Result<Option<FileBufferRow>> {
        let FileBufferObservation {
            content,
            base_content,
            base_version,
            external_version,
            dirty,
            conflict,
        } = observation;
        let conn = self.conn.lock().unwrap();
        let Some(current) = get_file_buffer_locked(&conn, workspace_id, path)? else {
            return Ok(None);
        };
        let unchanged = current.external_version.as_deref() == external_version
            && current.dirty == dirty
            && current.conflict == conflict
            && content.is_none();
        if unchanged {
            return Ok(Some(current));
        }
        let now = now_millis();
        if let Some(content) = content {
            let Some(base_content) = base_content else {
                return Err(anyhow::anyhow!(
                    "base content is required when refreshing a file buffer"
                ));
            };
            conn.execute(
                "UPDATE file_buffers SET content = ?3, base_content = ?4,
                    base_version = ?5, external_version = ?6, dirty = ?7,
                    conflict = ?8, revision = revision + 1, updated_at = ?9
                 WHERE workspace_id = ?1 AND path = ?2",
                params![
                    workspace_id,
                    path,
                    content,
                    base_content,
                    base_version,
                    external_version,
                    dirty as i32,
                    conflict as i32,
                    now,
                ],
            )?;
        } else {
            conn.execute(
                "UPDATE file_buffers SET external_version = ?3,
                    dirty = ?4, conflict = ?5, revision = revision + 1,
                    updated_at = ?6
                 WHERE workspace_id = ?1 AND path = ?2",
                params![
                    workspace_id,
                    path,
                    external_version,
                    dirty as i32,
                    conflict as i32,
                    now,
                ],
            )?;
        }
        Ok(get_file_buffer_locked(&conn, workspace_id, path)?)
    }

    /// Persist the intent for an upcoming filesystem publication. This is a
    /// separate row from the draft so a crash after rename but before the
    /// normal reconciliation can be repaired on the next startup.
    pub fn begin_file_save_intent(
        &self,
        operation_id: &str,
        workspace_id: &str,
        path: &str,
        content: &str,
        version: &str,
        expected_buffer_revision: Option<u64>,
    ) -> Result<FileSaveIntentRow, FileBufferError> {
        if content.len() > MAX_FILE_BUFFER_BYTES {
            return Err(FileBufferError::ContentTooLarge {
                limit: MAX_FILE_BUFFER_BYTES,
            });
        }
        let conn = self.conn.lock().unwrap();
        let current = get_file_buffer_locked(&conn, workspace_id, path)
            .map_err(file_buffer_database_error)?;
        match (&current, expected_buffer_revision) {
            (Some(row), Some(expected)) if row.revision != expected => {
                return Err(FileBufferError::Conflict {
                    expected: Some(expected),
                    current: current.map(Box::new),
                });
            }
            (Some(row), None) => {
                return Err(FileBufferError::Conflict {
                    expected: None,
                    current: Some(Box::new(row.clone())),
                });
            }
            (None, Some(expected)) if expected != 0 => {
                return Err(FileBufferError::Conflict {
                    expected: Some(expected),
                    current: None,
                });
            }
            _ => {}
        }
        let now = now_millis();
        conn.execute(
            "INSERT INTO file_save_intents
                (operation_id, workspace_id, path, content, version,
                 expected_buffer_revision, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(workspace_id, path) DO UPDATE SET
                operation_id = excluded.operation_id,
                content = excluded.content,
                version = excluded.version,
                expected_buffer_revision = excluded.expected_buffer_revision,
                created_at = excluded.created_at",
            params![
                operation_id,
                workspace_id,
                path,
                content,
                version,
                expected_buffer_revision.map(|revision| revision as i64),
                now,
            ],
        )
        .map_err(file_buffer_database_error)?;
        Ok(FileSaveIntentRow {
            operation_id: operation_id.to_string(),
            workspace_id: workspace_id.to_string(),
            path: path.to_string(),
            content: content.to_string(),
            version: version.to_string(),
            expected_buffer_revision,
            created_at: now,
        })
    }

    /// Atomically reconcile a completed filesystem publication, record its
    /// idempotency receipt, and remove the matching save intent. The
    /// transaction also recognizes the exact already-reconciled row left by
    /// an older process that exited between those steps.
    pub fn complete_file_save(
        &self,
        completion: FileSaveCompletion<'_>,
    ) -> Result<Option<FileBufferRow>, FileBufferError> {
        let FileSaveCompletion {
            operation_id,
            workspace_id,
            path,
            content,
            version,
            expected_revision,
            bytes_written,
            metadata_json,
            max_receipts,
        } = completion;
        if content.len() > MAX_FILE_BUFFER_BYTES {
            return Err(FileBufferError::ContentTooLarge {
                limit: MAX_FILE_BUFFER_BYTES,
            });
        }
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction().map_err(file_buffer_database_error)?;
        let existing =
            get_file_buffer_locked(&tx, workspace_id, path).map_err(file_buffer_database_error)?;
        let already_reconciled = existing.as_ref().is_some_and(|row| {
            row.content == content
                && row.base_content == content
                && row.base_version.as_deref() == Some(version)
                && row.external_version.as_deref() == Some(version)
                && !row.dirty
                && !row.conflict
                && expected_revision
                    .is_some_and(|expected| row.revision == expected.saturating_add(1))
        });
        // A save intent is checked after filesystem publication during
        // recovery.  If an editor revision was committed after the intent,
        // the publication is still complete but must not erase that newer
        // draft.  Record the receipt and remove only this intent below; the
        // caller receives the newer row so it can surface its conflict.
        let preserve_newer = match (&existing, expected_revision) {
            (Some(current), Some(expected)) if current.revision > expected => true,
            (Some(current), Some(expected)) if current.revision < expected => {
                return Err(FileBufferError::Conflict {
                    expected: Some(expected),
                    current: Some(Box::new(current.clone())),
                });
            }
            (Some(current), None) => {
                return Err(FileBufferError::Conflict {
                    expected: None,
                    current: Some(Box::new(current.clone())),
                });
            }
            (None, Some(expected)) if expected != 0 => {
                return Err(FileBufferError::Conflict {
                    expected: Some(expected),
                    current: None,
                });
            }
            _ => false,
        };
        if !already_reconciled && !preserve_newer {
            if existing.is_some() {
                let now = now_millis();
                tx.execute(
                    "UPDATE file_buffers SET content = ?3, base_content = ?3,
                        base_version = ?4, external_version = ?4, dirty = 0,
                        conflict = 0, revision = revision + 1, updated_at = ?5
                     WHERE workspace_id = ?1 AND path = ?2",
                    params![workspace_id, path, content, version, now],
                )
                .map_err(file_buffer_database_error)?;
            }
        } else if preserve_newer
            && !already_reconciled
            && existing
                .as_ref()
                .is_some_and(|row| row.content != content || row.dirty)
        {
            // Recovery proved that this operation reached disk, but a later
            // editor revision is now authoritative. Keep its text and mark
            // the row conflicted so the client must choose how to merge.
            let now = now_millis();
            tx.execute(
                "UPDATE file_buffers SET conflict = 1, revision = revision + 1,
                    updated_at = ?3
                 WHERE workspace_id = ?1 AND path = ?2",
                params![workspace_id, path, now],
            )
            .map_err(file_buffer_database_error)?;
        }
        let now = now_millis();
        tx.execute(
            "INSERT OR IGNORE INTO file_save_operations
                (operation_id, workspace_id, path, content_version,
                 expected_buffer_revision, bytes_written, metadata_json, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                operation_id,
                workspace_id,
                path,
                version,
                expected_revision.map(|revision| revision as i64),
                bytes_written.min(i64::MAX as usize) as i64,
                metadata_json,
                now,
            ],
        )
        .map_err(file_buffer_database_error)?;
        tx.execute(
            "DELETE FROM file_save_intents
             WHERE operation_id = ?1 AND workspace_id = ?2 AND path = ?3
               AND version = ?4",
            params![operation_id, workspace_id, path, version],
        )
        .map_err(file_buffer_database_error)?;
        let max_receipts = max_receipts.min(i64::MAX as usize) as i64;
        tx.execute(
            "DELETE FROM file_save_operations
             WHERE operation_id IN (
                SELECT operation_id FROM file_save_operations
                ORDER BY created_at ASC, operation_id ASC
                LIMIT CASE WHEN (SELECT COUNT(*) FROM file_save_operations) > ?1
                           THEN (SELECT COUNT(*) FROM file_save_operations) - ?1
                           ELSE 0 END
             )",
            params![max_receipts],
        )
        .map_err(file_buffer_database_error)?;
        let result = if existing.is_some() {
            get_file_buffer_locked(&tx, workspace_id, path).map_err(file_buffer_database_error)?
        } else {
            None
        };
        tx.commit().map_err(file_buffer_database_error)?;
        Ok(result)
    }

    /// List a bounded number of pending save intents for startup recovery.
    pub fn list_file_save_intents(&self, limit: usize) -> anyhow::Result<Vec<FileSaveIntentRow>> {
        let conn = self.conn.lock().unwrap();
        Ok(list_file_save_intents_locked(&conn, limit)?)
    }

    /// Return a completed save receipt by its request/operation id.
    pub fn get_file_save_operation(
        &self,
        operation_id: &str,
    ) -> anyhow::Result<Option<FileSaveOperationRow>> {
        let conn = self.conn.lock().unwrap();
        Ok(get_file_save_operation_locked(&conn, operation_id)?)
    }

    /// Record a completed save receipt. Replays of the same operation id keep
    /// the original result, which makes a retried WS request idempotent.
    pub fn record_file_save_operation(
        &self,
        operation: FileSaveOperation<'_>,
    ) -> anyhow::Result<()> {
        let FileSaveOperation {
            operation_id,
            workspace_id,
            path,
            content_version,
            expected_buffer_revision,
            bytes_written,
            metadata_json,
            max_receipts,
        } = operation;
        let conn = self.conn.lock().unwrap();
        let now = now_millis();
        conn.execute(
            "INSERT OR IGNORE INTO file_save_operations
                (operation_id, workspace_id, path, content_version,
                 expected_buffer_revision, bytes_written, metadata_json, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                operation_id,
                workspace_id,
                path,
                content_version,
                expected_buffer_revision.map(|revision| revision as i64),
                bytes_written.min(i64::MAX as usize) as i64,
                metadata_json,
                now,
            ],
        )?;
        let max_receipts = max_receipts.min(i64::MAX as usize) as i64;
        conn.execute(
            "DELETE FROM file_save_operations
             WHERE operation_id IN (
                SELECT operation_id FROM file_save_operations
                ORDER BY created_at ASC, operation_id ASC
                LIMIT CASE WHEN (SELECT COUNT(*) FROM file_save_operations) > ?1
                           THEN (SELECT COUNT(*) FROM file_save_operations) - ?1
                           ELSE 0 END
             )",
            params![max_receipts],
        )?;
        Ok(())
    }

    /// Remove an intent only when its identifying values still match. A
    /// mismatched row belongs to a newer save and must remain intact.
    pub fn clear_file_save_intent(
        &self,
        operation_id: &str,
        workspace_id: &str,
        path: &str,
        version: &str,
        expected_buffer_revision: Option<u64>,
    ) -> anyhow::Result<bool> {
        let conn = self.conn.lock().unwrap();
        let current = get_file_save_intent_locked(&conn, workspace_id, path)?;
        let Some(current) = current else {
            return Ok(false);
        };
        if current.operation_id != operation_id
            || current.version != version
            || current.expected_buffer_revision != expected_buffer_revision
        {
            return Ok(false);
        }
        conn.execute(
            "DELETE FROM file_save_intents WHERE workspace_id = ?1 AND path = ?2",
            params![workspace_id, path],
        )?;
        Ok(true)
    }

    /// Reconcile the durable draft as part of an explicit atomic file save.
    /// The same foundation lock that guards the filesystem publication guards
    /// this revision check, so a later editor update cannot be cleared by an
    /// earlier save.
    pub fn reconcile_file_buffer_after_save(
        &self,
        workspace_id: &str,
        path: &str,
        content: &str,
        version: &str,
        expected_revision: Option<u64>,
    ) -> Result<Option<FileBufferRow>, FileBufferError> {
        let conn = self.conn.lock().unwrap();
        let existing = get_file_buffer_locked(&conn, workspace_id, path)
            .map_err(file_buffer_database_error)?;
        match (&existing, expected_revision) {
            (Some(current), Some(expected)) if current.revision != expected => {
                return Err(FileBufferError::Conflict {
                    expected: Some(expected),
                    current: existing.map(Box::new),
                });
            }
            (Some(_), None) => {
                return Err(FileBufferError::Conflict {
                    expected: None,
                    current: existing.map(Box::new),
                });
            }
            (None, Some(expected)) if expected != 0 => {
                return Err(FileBufferError::Conflict {
                    expected: Some(expected),
                    current: None,
                });
            }
            _ => {}
        }
        if existing.is_none() {
            return Ok(None);
        }
        let now = now_millis();
        conn.execute(
            "UPDATE file_buffers SET content = ?3, base_version = ?4,
                base_content = ?3, external_version = ?4, dirty = 0,
                conflict = 0, revision = revision + 1, updated_at = ?5
             WHERE workspace_id = ?1 AND path = ?2",
            params![workspace_id, path, content, version, now],
        )
        .map_err(file_buffer_database_error)?;
        get_file_buffer_locked(&conn, workspace_id, path).map_err(file_buffer_database_error)
    }

    /// Close a tab's durable row. Dirty/conflicted content requires an
    /// explicit discard flag, and the caller must name the current revision.
    pub fn close_file_buffer(
        &self,
        workspace_id: &str,
        path: &str,
        expected_revision: Option<u64>,
        discard: bool,
    ) -> Result<bool, FileBufferError> {
        let conn = self.conn.lock().unwrap();
        let Some(current) = get_file_buffer_locked(&conn, workspace_id, path)
            .map_err(file_buffer_database_error)?
        else {
            return Ok(false);
        };
        if expected_revision != Some(current.revision) {
            return Err(FileBufferError::Conflict {
                expected: expected_revision,
                current: Some(Box::new(current)),
            });
        }
        if (current.dirty || current.conflict) && !discard {
            return Err(FileBufferError::Dirty {
                current: Box::new(current),
            });
        }
        conn.execute(
            "DELETE FROM file_buffers WHERE workspace_id = ?1 AND path = ?2",
            params![workspace_id, path],
        )
        .map_err(file_buffer_database_error)?;
        Ok(true)
    }
}

fn validate_file_buffer_update(
    update: &FileBufferUpdate,
    limit: usize,
) -> Result<(), FileBufferError> {
    if update.content.len() > limit || update.base_content.len() > limit {
        return Err(FileBufferError::ContentTooLarge { limit });
    }
    Ok(())
}

fn file_buffer_database_error(error: impl Into<anyhow::Error>) -> FileBufferError {
    let error: anyhow::Error = error.into();
    FileBufferError::Database {
        message: error.to_string(),
    }
}

fn file_buffer_row_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FileBufferRow> {
    let revision: i64 = row.get(6)?;
    Ok(FileBufferRow {
        workspace_id: row.get(0)?,
        path: row.get(1)?,
        content: row.get(2)?,
        base_content: row.get(3)?,
        base_version: row.get(4)?,
        external_version: row.get(5)?,
        revision: revision.max(0) as u64,
        dirty: row.get::<_, i64>(7)? != 0,
        conflict: row.get::<_, i64>(8)? != 0,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

fn get_file_buffer_locked(
    conn: &Connection,
    workspace_id: &str,
    path: &str,
) -> rusqlite::Result<Option<FileBufferRow>> {
    conn.query_row(
        "SELECT workspace_id, path, content, base_content, base_version,
                external_version, revision, dirty, conflict, created_at, updated_at
         FROM file_buffers WHERE workspace_id = ?1 AND path = ?2",
        params![workspace_id, path],
        file_buffer_row_from_row,
    )
    .optional()
}

fn list_file_buffers_locked(
    conn: &Connection,
    workspace_id: Option<&str>,
    limit: usize,
) -> rusqlite::Result<Vec<FileBufferRow>> {
    let limit = limit.min(i64::MAX as usize) as i64;
    let mut result = Vec::new();
    if let Some(workspace_id) = workspace_id {
        let mut stmt = conn.prepare(
            "SELECT workspace_id, path, content, base_content, base_version,
                    external_version, revision, dirty, conflict, created_at, updated_at
             FROM file_buffers WHERE workspace_id = ?1
             ORDER BY updated_at DESC, path ASC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![workspace_id, limit], file_buffer_row_from_row)?;
        for row in rows {
            result.push(row?);
        }
    } else {
        let mut stmt = conn.prepare(
            "SELECT workspace_id, path, content, base_content, base_version,
                    external_version, revision, dirty, conflict, created_at, updated_at
             FROM file_buffers
             ORDER BY updated_at DESC, workspace_id ASC, path ASC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit], file_buffer_row_from_row)?;
        for row in rows {
            result.push(row?);
        }
    }
    Ok(result)
}

fn file_buffer_metadata_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<FileBufferMetadataRow> {
    let revision: i64 = row.get(4)?;
    Ok(FileBufferMetadataRow {
        workspace_id: row.get(0)?,
        path: row.get(1)?,
        base_version: row.get(2)?,
        external_version: row.get(3)?,
        revision: revision.max(0) as u64,
        dirty: row.get::<_, i64>(5)? != 0,
        conflict: row.get::<_, i64>(6)? != 0,
        updated_at: row.get(7)?,
    })
}

fn list_file_buffer_metadata_locked(
    conn: &Connection,
    workspace_id: Option<&str>,
    limit: usize,
) -> rusqlite::Result<Vec<FileBufferMetadataRow>> {
    let limit = limit.min(i64::MAX as usize) as i64;
    if let Some(workspace_id) = workspace_id {
        let mut stmt = conn.prepare(
            "SELECT workspace_id, path, base_version, external_version,
                    revision, dirty, conflict, updated_at
             FROM file_buffers WHERE workspace_id = ?1
             ORDER BY updated_at DESC, path ASC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![workspace_id, limit], file_buffer_metadata_from_row)?;
        rows.collect()
    } else {
        let mut stmt = conn.prepare(
            "SELECT workspace_id, path, base_version, external_version,
                    revision, dirty, conflict, updated_at
             FROM file_buffers
             ORDER BY updated_at DESC, workspace_id ASC, path ASC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit], file_buffer_metadata_from_row)?;
        rows.collect()
    }
}

fn count_file_buffers_locked(conn: &Connection, workspace_id: &str) -> rusqlite::Result<usize> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM file_buffers WHERE workspace_id = ?1",
        params![workspace_id],
        |row| row.get(0),
    )?;
    Ok(count.max(0) as usize)
}

fn file_save_intent_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FileSaveIntentRow> {
    let expected: Option<i64> = row.get(5)?;
    Ok(FileSaveIntentRow {
        operation_id: row.get(0)?,
        workspace_id: row.get(1)?,
        path: row.get(2)?,
        content: row.get(3)?,
        version: row.get(4)?,
        expected_buffer_revision: expected.map(|revision| revision.max(0) as u64),
        created_at: row.get(6)?,
    })
}

fn get_file_save_intent_locked(
    conn: &Connection,
    workspace_id: &str,
    path: &str,
) -> rusqlite::Result<Option<FileSaveIntentRow>> {
    conn.query_row(
        "SELECT operation_id, workspace_id, path, content, version,
                expected_buffer_revision, created_at
         FROM file_save_intents WHERE workspace_id = ?1 AND path = ?2",
        params![workspace_id, path],
        file_save_intent_from_row,
    )
    .optional()
}

fn list_file_save_intents_locked(
    conn: &Connection,
    limit: usize,
) -> rusqlite::Result<Vec<FileSaveIntentRow>> {
    let limit = limit.min(i64::MAX as usize) as i64;
    let mut stmt = conn.prepare(
        "SELECT operation_id, workspace_id, path, content, version,
                expected_buffer_revision, created_at
         FROM file_save_intents
         ORDER BY created_at ASC, workspace_id ASC, path ASC LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![limit], file_save_intent_from_row)?;
    rows.collect()
}

fn file_save_operation_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FileSaveOperationRow> {
    let expected: Option<i64> = row.get(4)?;
    let bytes_written: i64 = row.get(5)?;
    Ok(FileSaveOperationRow {
        operation_id: row.get(0)?,
        workspace_id: row.get(1)?,
        path: row.get(2)?,
        content_version: row.get(3)?,
        expected_buffer_revision: expected.map(|revision| revision.max(0) as u64),
        bytes_written: bytes_written.max(0) as usize,
        metadata_json: row.get(6)?,
        created_at: row.get(7)?,
    })
}

fn get_file_save_operation_locked(
    conn: &Connection,
    operation_id: &str,
) -> rusqlite::Result<Option<FileSaveOperationRow>> {
    conn.query_row(
        "SELECT operation_id, workspace_id, path, content_version,
                expected_buffer_revision, bytes_written, metadata_json, created_at
         FROM file_save_operations WHERE operation_id = ?1",
        params![operation_id],
        file_save_operation_from_row,
    )
    .optional()
}
