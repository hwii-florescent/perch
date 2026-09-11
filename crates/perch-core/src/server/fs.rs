//! `fs.*` arm bodies, the `spawn_fs_*` functions, and the file-buffer
//! wire mappers. Pure move from `server.rs` — see the refactor plan's
//! Phase 3. No logic changed.
//!
//! `filesystem_operation_lock` and `workspace_file_service` are
//! pub(super): mod.rs's boot-time save-intent recovery and file-watch
//! polling (`recover_file_save_intents`, `spawn_filesystem_watch_task`)
//! call them directly, so they stay reachable from the parent.

use super::*;

/// Errors raised before a workspace service exists are kept separate from
/// filesystem errors so the client can distinguish an expired/unknown durable
/// workspace from a path or file error inside a valid workspace.
#[derive(Debug)]
pub(super) enum FsAdapterFailure {
    Workspace { code: &'static str, message: String },
    Filesystem(FsError),
    Buffer(FileBufferError),
    Task(String),
}

impl std::fmt::Display for FsAdapterFailure {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Workspace { message, .. } | Self::Task(message) => f.write_str(message),
            Self::Filesystem(error) => error.fmt(f),
            Self::Buffer(error) => error.fmt(f),
        }
    }
}

const MAX_FILESYSTEM_OPERATION_LOCKS: usize = 1_024;

/// Return a bounded lock for one workspace/path operation. The overflow lock
/// keeps correctness when an attacker presents more distinct paths than the
/// lock table can retain, without allowing the table itself to grow without
/// bound.
pub(super) fn filesystem_operation_lock(
    app: &AppState,
    workspace_id: &str,
    path: &str,
) -> Arc<Mutex<()>> {
    let key = format!("{workspace_id}\0{path}");
    let mut locks = app.filesystem_operation_locks.lock().unwrap();
    if let Some(lock) = locks.get(&key) {
        return lock.clone();
    }
    if locks.len() < MAX_FILESYSTEM_OPERATION_LOCKS {
        let lock = Arc::new(Mutex::new(()));
        locks.insert(key, lock.clone());
        lock
    } else {
        app.filesystem_operation_overflow.clone()
    }
}

fn file_buffer_to_wire(row: FileBufferRow) -> FileBuffer {
    FileBuffer {
        workspace_id: row.workspace_id,
        path: row.path,
        content: row.content,
        base_content: row.base_content,
        base_version: row.base_version,
        external_version: row.external_version,
        revision: row.revision,
        dirty: row.dirty,
        conflict: row.conflict,
        updated_at: row.updated_at,
    }
}

fn file_buffer_summary_to_wire(row: FileBufferMetadataRow) -> FileBufferSummary {
    FileBufferSummary {
        workspace_id: row.workspace_id,
        path: row.path,
        base_version: row.base_version,
        external_version: row.external_version,
        revision: row.revision,
        dirty: row.dirty,
        conflict: row.conflict,
        updated_at: row.updated_at,
    }
}

/// Resolve a durable local workspace id into a retained-descriptor filesystem
/// service. The caller never supplies a root path to an fs.* operation. Remote
/// workspace ids are rejected in this slice rather than accidentally opening
/// a same-looking path on the local host.
pub(super) fn workspace_file_service(
    app: &AppState,
    workspace_id: &str,
) -> Result<FileService, FsAdapterFailure> {
    let workspace =
        app.db
            .resolve_workspace(workspace_id)
            .map_err(|error| FsAdapterFailure::Workspace {
                code: "workspace_unavailable",
                message: format!("workspace {workspace_id:?} is unavailable: {error}"),
            })?;
    if workspace.host_id != "local" {
        return Err(FsAdapterFailure::Workspace {
            code: "unsupported_remote",
            message: format!(
                "filesystem access is not available on workspace host {}",
                workspace.host_id
            ),
        });
    }
    let mut services = app.filesystem_services.lock().unwrap();
    if let Some(service) = services.get(workspace_id) {
        if service.root() != Path::new(&workspace.path) {
            return Err(FsAdapterFailure::Workspace {
                code: "workspace_path_changed",
                message: format!("workspace {workspace_id:?} path changed after authorization"),
            });
        }
        return Ok(service.clone());
    }
    let service = FileService::new(&workspace.path).map_err(FsAdapterFailure::Filesystem)?;
    services.insert(workspace_id.to_string(), service.clone());
    Ok(service)
}

/// Convert a bounded service error into the structured fs.error response. In
/// particular, conflicts preserve both hashes and current metadata so the UI
/// can compare/reload before an explicit overwrite.
fn fs_error_response(
    request_id: String,
    workspace_id: String,
    failure: FsAdapterFailure,
) -> ServerMessage {
    match failure {
        FsAdapterFailure::Workspace { code, message } => ServerMessage::FsError {
            request_id,
            workspace_id,
            code: code.to_string(),
            message,
            path: None,
            metadata: None,
            expected_version: None,
            actual_version: None,
            current: None,
            expected_buffer_revision: None,
            actual_buffer_revision: None,
            current_buffer: None,
        },
        FsAdapterFailure::Buffer(error) => {
            let message = error.to_string();
            match error {
                FileBufferError::Conflict { expected, current } => ServerMessage::FsError {
                    request_id,
                    workspace_id,
                    code: "buffer_conflict".to_string(),
                    message,
                    path: current.as_ref().map(|row| row.path.clone()),
                    metadata: None,
                    expected_version: None,
                    actual_version: current
                        .as_ref()
                        .and_then(|row| row.external_version.clone()),
                    current: None,
                    expected_buffer_revision: expected,
                    actual_buffer_revision: current.as_ref().map(|row| row.revision),
                    current_buffer: current.map(|row| Box::new(file_buffer_to_wire(*row))),
                },
                FileBufferError::Dirty { current } => ServerMessage::FsError {
                    request_id,
                    workspace_id,
                    code: "dirty_buffer".to_string(),
                    message,
                    path: Some(current.path.clone()),
                    metadata: None,
                    expected_version: None,
                    actual_version: current.external_version.clone(),
                    current: None,
                    expected_buffer_revision: Some(current.revision),
                    actual_buffer_revision: Some(current.revision),
                    current_buffer: Some(Box::new(file_buffer_to_wire(*current))),
                },
                FileBufferError::Limit { limit } => ServerMessage::FsError {
                    request_id,
                    workspace_id,
                    code: "buffer_limit".to_string(),
                    message: format!("workspace file buffer limit reached ({limit})"),
                    path: None,
                    metadata: None,
                    expected_version: None,
                    actual_version: None,
                    current: None,
                    expected_buffer_revision: None,
                    actual_buffer_revision: None,
                    current_buffer: None,
                },
                FileBufferError::ContentTooLarge { limit } => ServerMessage::FsError {
                    request_id,
                    workspace_id,
                    code: "buffer_too_large".to_string(),
                    message: format!("file buffer content exceeds the {limit}-byte limit"),
                    path: None,
                    metadata: None,
                    expected_version: None,
                    actual_version: None,
                    current: None,
                    expected_buffer_revision: None,
                    actual_buffer_revision: None,
                    current_buffer: None,
                },
                FileBufferError::Database { message } => ServerMessage::FsError {
                    request_id,
                    workspace_id,
                    code: "buffer_database_error".to_string(),
                    message,
                    path: None,
                    metadata: None,
                    expected_version: None,
                    actual_version: None,
                    current: None,
                    expected_buffer_revision: None,
                    actual_buffer_revision: None,
                    current_buffer: None,
                },
            }
        }
        FsAdapterFailure::Task(message) => ServerMessage::FsError {
            request_id,
            workspace_id,
            code: "filesystem_task_failed".to_string(),
            message,
            path: None,
            metadata: None,
            expected_version: None,
            actual_version: None,
            current: None,
            expected_buffer_revision: None,
            actual_buffer_revision: None,
            current_buffer: None,
        },
        FsAdapterFailure::Filesystem(error) => {
            let message = error.to_string();
            match error {
                FsError::Conflict {
                    path,
                    expected,
                    actual,
                    current,
                } => ServerMessage::FsError {
                    request_id,
                    workspace_id,
                    code: "conflict".to_string(),
                    message,
                    path: Some(path),
                    metadata: None,
                    expected_version: expected,
                    actual_version: actual,
                    current: current.map(|metadata| *metadata),
                    expected_buffer_revision: None,
                    actual_buffer_revision: None,
                    current_buffer: None,
                },
                error => {
                    let (code, path, metadata) = match &error {
                        FsError::InvalidConfig { .. } => ("invalid_config", None, None),
                        FsError::InvalidPath { path, .. } => {
                            ("invalid_path", Some(path.clone()), None)
                        }
                        FsError::Traversal { path } => {
                            ("traversal_refused", Some(path.clone()), None)
                        }
                        FsError::NotFound { path } => ("not_found", Some(path.clone()), None),
                        FsError::Symlink { path } => ("symlink_refused", Some(path.clone()), None),
                        FsError::NotRegularFile { path } => {
                            ("not_regular_file", Some(path.clone()), None)
                        }
                        FsError::TooLarge { path, metadata, .. } => {
                            ("too_large", Some(path.clone()), Some((**metadata).clone()))
                        }
                        FsError::Binary { path, metadata } => {
                            ("binary", Some(path.clone()), Some((**metadata).clone()))
                        }
                        FsError::Unsupported { path, .. } => {
                            ("unsupported", Some(path.clone()), None)
                        }
                        FsError::ChangedDuringRead { path } => {
                            ("changed_during_read", Some(path.clone()), None)
                        }
                        FsError::Io { path, .. } => ("filesystem_error", Some(path.clone()), None),
                        FsError::Conflict { .. } => unreachable!("conflict handled above"),
                    };
                    ServerMessage::FsError {
                        request_id,
                        workspace_id,
                        code: code.to_string(),
                        message,
                        path,
                        metadata,
                        expected_version: None,
                        actual_version: None,
                        current: None,
                        expected_buffer_revision: None,
                        actual_buffer_revision: None,
                        current_buffer: None,
                    }
                }
            }
        }
    }
}

pub(super) fn spawn_fs_tree(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    path: Option<String>,
) {
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    let task_workspace_id = workspace_id.clone();
    tokio::spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            let service = workspace_file_service(&app, &task_workspace_id)?;
            service
                .list_dir(path.as_deref().unwrap_or(""))
                .map_err(FsAdapterFailure::Filesystem)
        })
        .await;
        let message = match result {
            Ok(Ok(listing)) => ServerMessage::FsTreeResult {
                request_id,
                workspace_id,
                path: listing.path,
                entries: listing.entries,
                truncated: listing.truncated,
            },
            Ok(Err(error)) => fs_error_response(request_id, workspace_id, error),
            Err(error) => fs_error_response(
                request_id,
                workspace_id,
                FsAdapterFailure::Task(format!("filesystem task failed: {error}")),
            ),
        };
        let _ = out_tx.send(message);
    });
}

pub(super) fn spawn_fs_read(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    path: String,
) {
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    let task_workspace_id = workspace_id.clone();
    tokio::spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            let service = workspace_file_service(&app, &task_workspace_id)?;
            service
                .read_file(&path)
                .map_err(FsAdapterFailure::Filesystem)
        })
        .await;
        let message = match result {
            Ok(Ok(read)) => ServerMessage::FsReadResult {
                request_id,
                workspace_id,
                metadata: read.metadata,
                content: read.content,
                version: read.version,
            },
            Ok(Err(error)) => fs_error_response(request_id, workspace_id, error),
            Err(error) => fs_error_response(
                request_id,
                workspace_id,
                FsAdapterFailure::Task(format!("filesystem task failed: {error}")),
            ),
        };
        let _ = out_tx.send(message);
    });
}

pub(super) fn spawn_fs_preview(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    path: String,
) {
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    let task_workspace_id = workspace_id.clone();
    tokio::spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            let service = workspace_file_service(&app, &task_workspace_id)?;
            service.preview(&path).map_err(FsAdapterFailure::Filesystem)
        })
        .await;
        let message = match result {
            Ok(Ok(preview)) => ServerMessage::FsPreviewResult {
                request_id,
                workspace_id,
                metadata: preview.metadata,
                version: preview.version,
                kind: preview.kind,
                content: preview.content,
                media_type: preview.media_type,
                requires_sandbox: preview.requires_sandbox,
                truncated: preview.truncated,
                message: preview.message,
            },
            Ok(Err(error)) => fs_error_response(request_id, workspace_id, error),
            Err(error) => fs_error_response(
                request_id,
                workspace_id,
                FsAdapterFailure::Task(format!("filesystem task failed: {error}")),
            ),
        };
        let _ = out_tx.send(message);
    });
}

struct FsWriteExecution {
    result: WriteResult,
    buffer_revision: Option<u64>,
    buffer_conflict: bool,
    /// Retries of a completed request return the saved result but must not
    /// emit another invalidation event.
    replayed: bool,
}

pub(super) fn spawn_fs_write(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    path: String,
    content: String,
    expected_version: Option<String>,
    expected_buffer_revision: Option<u64>,
) {
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    let task_workspace_id = workspace_id.clone();
    let operation_id = request_id.clone();
    let operation_lock = filesystem_operation_lock(&app, &workspace_id, &path);
    let event_workspace_id = workspace_id.clone();
    let event_path = path.clone();
    let events_tx = app.hub.hub_events_tx.clone();
    tokio::spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            let _operation_guard = operation_lock.lock().unwrap();
            let service = workspace_file_service(&app, &task_workspace_id)?;
            let content_version = FileService::version_for_bytes(content.as_bytes());

            // A retried request id returns the original publication result,
            // even if an external process changed the pathname afterwards.
            // Reusing an id for different content/workspace/path is refused.
            if let Some(receipt) =
                app.db
                    .get_file_save_operation(&operation_id)
                    .map_err(|error| {
                        FsAdapterFailure::Buffer(FileBufferError::Database {
                            message: error.to_string(),
                        })
                    })?
            {
                if receipt.workspace_id != task_workspace_id
                    || receipt.path != path
                    || receipt.content_version != content_version
                    || receipt.expected_buffer_revision != expected_buffer_revision
                {
                    return Err(FsAdapterFailure::Workspace {
                        code: "operation_id_reused",
                        message: "save request id was already used for different content"
                            .to_string(),
                    });
                }
                let metadata = serde_json::from_str(&receipt.metadata_json).map_err(|error| {
                    FsAdapterFailure::Buffer(FileBufferError::Database {
                        message: format!("saved metadata receipt is invalid: {error}"),
                    })
                })?;
                let current_buffer =
                    app.db
                        .get_file_buffer(&task_workspace_id, &path)
                        .map_err(|error| {
                            FsAdapterFailure::Buffer(FileBufferError::Database {
                                message: error.to_string(),
                            })
                        })?;
                return Ok(FsWriteExecution {
                    result: WriteResult {
                        metadata,
                        bytes_written: receipt.bytes_written,
                        version: receipt.content_version,
                    },
                    buffer_revision: current_buffer.as_ref().map(|row| row.revision),
                    buffer_conflict: current_buffer.as_ref().is_some_and(|row| row.conflict),
                    replayed: true,
                });
            }

            app.db
                .begin_file_save_intent(
                    &operation_id,
                    &task_workspace_id,
                    &path,
                    &content,
                    &content_version,
                    expected_buffer_revision,
                )
                .map_err(FsAdapterFailure::Buffer)?;

            let write = match service.write_text(&path, &content, expected_version.as_deref()) {
                Ok(result) => result,
                // An I/O error after publication is not distinguishable from
                // an error before it. Keep the intent so startup recovery can
                // inspect the durable pathname before deciding anything.
                Err(error) => return Err(FsAdapterFailure::Filesystem(error)),
            };
            let metadata_json = serde_json::to_string(&write.metadata).map_err(|error| {
                FsAdapterFailure::Buffer(FileBufferError::Database {
                    message: format!("saved metadata could not be recorded: {error}"),
                })
            })?;
            let reconciled = app
                .db
                .complete_file_save(FileSaveCompletion {
                    operation_id: &operation_id,
                    workspace_id: &task_workspace_id,
                    path: &path,
                    content: &content,
                    version: &write.version,
                    expected_revision: expected_buffer_revision,
                    bytes_written: write.bytes_written,
                    metadata_json: &metadata_json,
                    max_receipts: 1_024,
                })
                .map_err(FsAdapterFailure::Buffer)?;
            Ok(FsWriteExecution {
                result: write,
                buffer_revision: reconciled.as_ref().map(|row| row.revision),
                buffer_conflict: reconciled.as_ref().is_some_and(|row| row.conflict),
                replayed: false,
            })
        })
        .await;
        let message = match result {
            Ok(Ok(execution)) => {
                if !execution.replayed {
                    let _ = events_tx.send(Arc::new(ServerMessage::FsChanged {
                        workspace_id: event_workspace_id.clone(),
                        path: event_path.clone(),
                        version: Some(execution.result.version.clone()),
                        kind: "changed".to_string(),
                        metadata: Some(execution.result.metadata.clone()),
                        buffer_revision: execution.buffer_revision,
                        conflict: execution.buffer_conflict,
                    }));
                }
                ServerMessage::FsWriteResult {
                    request_id,
                    workspace_id,
                    metadata: execution.result.metadata,
                    bytes_written: execution.result.bytes_written,
                    version: execution.result.version,
                    buffer_revision: execution.buffer_revision,
                }
            }
            Ok(Err(error)) => fs_error_response(request_id, workspace_id, error),
            Err(error) => fs_error_response(
                request_id,
                workspace_id,
                FsAdapterFailure::Task(format!("filesystem task failed: {error}")),
            ),
        };
        let _ = out_tx.send(message);
    });
}

pub(super) fn spawn_fs_buffer_list(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
) {
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    let task_workspace_id = workspace_id.clone();
    tokio::spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            // Resolve the retained service even for a metadata-only list so
            // archived/remote/path-swapped workspaces cannot expose rows.
            let _service = workspace_file_service(&app, &task_workspace_id)?;
            let mut buffers = app
                .db
                .list_file_buffer_metadata(&task_workspace_id, MAX_FILE_BUFFERS_PER_WORKSPACE + 1)
                .map_err(|error| {
                    FsAdapterFailure::Buffer(FileBufferError::Database {
                        message: error.to_string(),
                    })
                })?;
            let truncated = buffers.len() > MAX_FILE_BUFFERS_PER_WORKSPACE;
            buffers.truncate(MAX_FILE_BUFFERS_PER_WORKSPACE);
            Ok((buffers, truncated))
        })
        .await;
        let message = match result {
            Ok(Ok((buffers, truncated))) => ServerMessage::FsBufferListResult {
                request_id,
                workspace_id,
                buffers: buffers
                    .into_iter()
                    .map(file_buffer_summary_to_wire)
                    .collect(),
                truncated,
            },
            Ok(Err(error)) => fs_error_response(request_id, workspace_id, error),
            Err(error) => fs_error_response(
                request_id,
                workspace_id,
                FsAdapterFailure::Task(format!("filesystem task failed: {error}")),
            ),
        };
        let _ = out_tx.send(message);
    });
}

/// Read the disk baseline and reconcile a durable buffer's external version.
/// Clean buffers follow the disk automatically; dirty buffers retain their
/// draft/base and become conflicted so the client can compare or merge.
pub(super) fn spawn_fs_buffer_get(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    path: String,
) {
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    let task_workspace_id = workspace_id.clone();
    let operation_lock = filesystem_operation_lock(&app, &workspace_id, &path);
    let events_tx = app.hub.hub_events_tx.clone();
    tokio::spawn(async move {
        let event_workspace_id = workspace_id.clone();
        let event_path = path.clone();
        let result = tokio::task::spawn_blocking(move || {
            let _operation_guard = operation_lock.lock().unwrap();
            let service = workspace_file_service(&app, &task_workspace_id)?;
            let existing = app
                .db
                .get_file_buffer(&task_workspace_id, &path)
                .map_err(|error| {
                    FsAdapterFailure::Buffer(FileBufferError::Database {
                        message: error.to_string(),
                    })
                })?;
            let (buffer, changed) = match service.read_file(&path) {
                Ok(read) => {
                    let current = if let Some(row) = existing.clone() {
                        if row.external_version.as_deref() == Some(read.version.as_str()) {
                            row
                        } else if row.dirty {
                            app.db
                                .observe_file_buffer(
                                    &task_workspace_id,
                                    &path,
                                    FileBufferObservation {
                                        content: None,
                                        base_content: None,
                                        base_version: None,
                                        external_version: Some(&read.version),
                                        dirty: true,
                                        conflict: true,
                                    },
                                )
                                .map_err(|error| {
                                    FsAdapterFailure::Buffer(FileBufferError::Database {
                                        message: error.to_string(),
                                    })
                                })?
                                .ok_or_else(|| {
                                    FsAdapterFailure::Task("buffer disappeared".to_string())
                                })?
                        } else {
                            app.db
                                .observe_file_buffer(
                                    &task_workspace_id,
                                    &path,
                                    FileBufferObservation {
                                        content: Some(&read.content),
                                        base_content: Some(&read.content),
                                        base_version: Some(&read.version),
                                        external_version: Some(&read.version),
                                        dirty: false,
                                        conflict: false,
                                    },
                                )
                                .map_err(|error| {
                                    FsAdapterFailure::Buffer(FileBufferError::Database {
                                        message: error.to_string(),
                                    })
                                })?
                                .ok_or_else(|| {
                                    FsAdapterFailure::Task("buffer disappeared".to_string())
                                })?
                        }
                    } else {
                        app.db
                            .ensure_file_buffer(
                                &task_workspace_id,
                                &path,
                                FileBufferUpdate {
                                    content: read.content.clone(),
                                    base_content: read.content.clone(),
                                    base_version: Some(read.version.clone()),
                                    external_version: Some(read.version.clone()),
                                    dirty: false,
                                    conflict: false,
                                },
                                MAX_FILE_BUFFERS_PER_WORKSPACE,
                            )
                            .map_err(FsAdapterFailure::Buffer)?
                    };
                    let changed = existing
                        .as_ref()
                        .is_some_and(|row| row.revision != current.revision)
                        || existing.is_none();
                    (current, changed)
                }
                Err(FsError::NotFound { .. }) => {
                    let Some(row) = existing else {
                        return Err(FsAdapterFailure::Filesystem(FsError::NotFound {
                            path: path.clone(),
                        }));
                    };
                    let current = app
                        .db
                        .observe_file_buffer(
                            &task_workspace_id,
                            &path,
                            FileBufferObservation {
                                content: None,
                                base_content: None,
                                base_version: None,
                                external_version: None,
                                dirty: row.dirty,
                                conflict: true,
                            },
                        )
                        .map_err(|error| {
                            FsAdapterFailure::Buffer(FileBufferError::Database {
                                message: error.to_string(),
                            })
                        })?
                        .ok_or_else(|| FsAdapterFailure::Task("buffer disappeared".to_string()))?;
                    (current, row.external_version.is_some() || !row.conflict)
                }
                Err(error) => return Err(FsAdapterFailure::Filesystem(error)),
            };
            Ok((buffer, changed))
        })
        .await;
        let message = match result {
            Ok(Ok((buffer, changed))) => {
                if changed {
                    let version = buffer.external_version.clone();
                    let _ = events_tx.send(Arc::new(ServerMessage::FsChanged {
                        workspace_id: event_workspace_id,
                        path: event_path,
                        version,
                        kind: "changed".to_string(),
                        metadata: None,
                        buffer_revision: Some(buffer.revision),
                        conflict: buffer.conflict,
                    }));
                }
                ServerMessage::FsBufferResult {
                    request_id,
                    workspace_id,
                    buffer: file_buffer_to_wire(buffer),
                }
            }
            Ok(Err(error)) => fs_error_response(request_id, workspace_id, error),
            Err(error) => fs_error_response(
                request_id,
                workspace_id,
                FsAdapterFailure::Task(format!("filesystem task failed: {error}")),
            ),
        };
        let _ = out_tx.send(message);
    });
}

pub(super) fn spawn_fs_buffer_set(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    path: String,
    content: String,
    base_content: Option<String>,
    expected_buffer_revision: Option<u64>,
) {
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    let task_workspace_id = workspace_id.clone();
    let operation_lock = filesystem_operation_lock(&app, &workspace_id, &path);
    tokio::spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            let _operation_guard = operation_lock.lock().unwrap();
            let service = workspace_file_service(&app, &task_workspace_id)?;
            if content.len() > service.config().max_read_bytes
                || content.len() > service.config().max_write_bytes
                || content.len() > MAX_FILE_BUFFER_BYTES
            {
                return Err(FsAdapterFailure::Buffer(FileBufferError::ContentTooLarge {
                    limit: service
                        .config()
                        .max_read_bytes
                        .min(service.config().max_write_bytes)
                        .min(MAX_FILE_BUFFER_BYTES),
                }));
            }
            let existing = app
                .db
                .get_file_buffer(&task_workspace_id, &path)
                .map_err(|error| {
                    FsAdapterFailure::Buffer(FileBufferError::Database {
                        message: error.to_string(),
                    })
                })?;
            let disk = match service.read_file(&path) {
                Ok(read) => Some(read),
                Err(FsError::NotFound { .. }) => None,
                Err(error) => return Err(FsAdapterFailure::Filesystem(error)),
            };
            let (disk_version, disk_content) = disk
                .as_ref()
                .map(|read| (Some(read.version.clone()), Some(read.content.clone())))
                .unwrap_or((None, None));
            let supplied_base_content = base_content.is_some();
            let base_content = base_content
                .or_else(|| existing.as_ref().map(|row| row.base_content.clone()))
                .or(disk_content.clone())
                .unwrap_or_default();
            let base_version = if base_content.is_empty() && disk_version.is_none() {
                None
            } else if supplied_base_content {
                // A client may send a merged/reloaded base after resolving a
                // conflict. Its hash must travel with that exact content;
                // retaining an older row's base_version would compare the
                // new draft against the wrong baseline after a restart.
                Some(FileService::version_for_bytes(base_content.as_bytes()))
            } else if let Some(existing) = &existing {
                existing
                    .base_version
                    .clone()
                    .or_else(|| Some(FileService::version_for_bytes(base_content.as_bytes())))
            } else {
                Some(FileService::version_for_bytes(base_content.as_bytes()))
            };
            let draft_version = FileService::version_for_bytes(content.as_bytes());
            let conflict = match (base_version.as_deref(), disk_version.as_deref()) {
                (None, None) => false,
                (Some(base), Some(disk)) => base != disk,
                _ => true,
            };
            let row = app
                .db
                .set_file_buffer(
                    &task_workspace_id,
                    &path,
                    FileBufferUpdate {
                        content,
                        base_content,
                        base_version,
                        external_version: disk_version,
                        dirty: disk
                            .as_ref()
                            .is_none_or(|read| read.version != draft_version),
                        conflict,
                    },
                    expected_buffer_revision,
                    MAX_FILE_BUFFERS_PER_WORKSPACE,
                )
                .map_err(FsAdapterFailure::Buffer)?;
            Ok(row)
        })
        .await;
        let message = match result {
            Ok(Ok(buffer)) => ServerMessage::FsBufferResult {
                request_id,
                workspace_id,
                buffer: file_buffer_to_wire(buffer),
            },
            Ok(Err(error)) => fs_error_response(request_id, workspace_id, error),
            Err(error) => fs_error_response(
                request_id,
                workspace_id,
                FsAdapterFailure::Task(format!("filesystem task failed: {error}")),
            ),
        };
        let _ = out_tx.send(message);
    });
}

pub(super) fn spawn_fs_buffer_close(
    state: &Arc<ConnState>,
    request_id: String,
    workspace_id: String,
    path: String,
    expected_buffer_revision: Option<u64>,
    discard: bool,
) {
    let out_tx = state.out_tx.clone();
    let app = state.app.clone();
    let task_workspace_id = workspace_id.clone();
    let result_path = path.clone();
    let operation_lock = filesystem_operation_lock(&app, &workspace_id, &path);
    tokio::spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            let _operation_guard = operation_lock.lock().unwrap();
            let _service = workspace_file_service(&app, &task_workspace_id)?;
            app.db
                .close_file_buffer(&task_workspace_id, &path, expected_buffer_revision, discard)
                .map_err(FsAdapterFailure::Buffer)
        })
        .await;
        let message = match result {
            Ok(Ok(removed)) => ServerMessage::FsBufferCloseResult {
                request_id,
                workspace_id,
                path: result_path,
                removed,
            },
            Ok(Err(error)) => fs_error_response(request_id, workspace_id, error),
            Err(error) => fs_error_response(
                request_id,
                workspace_id,
                FsAdapterFailure::Task(format!("filesystem task failed: {error}")),
            ),
        };
        let _ = out_tx.send(message);
    });
}

pub(super) fn handle_fs_browse(
    state: &Arc<ConnState>,
    raw_text: &str,
    request_id: String,
    host_id: Option<String>,
    path: Option<String>,
) {
    let target = host_id.as_deref().unwrap_or("local");
    if target != "local" && !target.is_empty() {
        // Direct-mode host: no perch to forward to — list over ssh.
        // Bounded and on a spawned task, so a slow devpod can't block
        // this connection's message loop.
        if let Some(host) = direct_host(state, target) {
            let out_tx = state.out_tx.clone();
            let target = target.to_string();
            tokio::spawn(async move {
                match crate::detached::browse_remote(&host.ssh_host, path.as_deref(), 30).await {
                    Ok((resolved, parent, home, entries)) => {
                        let _ = out_tx.send(ServerMessage::FsBrowseResult {
                            request_id,
                            host_id: target,
                            path: resolved,
                            parent,
                            home,
                            entries,
                        });
                    }
                    Err(e) => {
                        let _ = out_tx.send(ServerMessage::Error {
                            message: format!("browse failed on {target}: {e}"),
                            request_id: None,
                            code: None,
                            retryable: false,
                        });
                    }
                }
            });
            return;
        }
        state.app.hub.register_unicast(
            PendingKey::Browse(request_id.clone()),
            state.conn_id.clone(),
            state.out_tx.clone(),
        );
        state.app.hub.forward(target, &strip_host_id(raw_text));
        return;
    }
    let home = std::env::var("HOME").unwrap_or_default();
    let requested = path.unwrap_or_else(|| home.clone());
    let expanded = if requested == "~" || requested.starts_with("~/") {
        if requested == "~" {
            home.clone()
        } else {
            format!("{home}{}", &requested[1..])
        }
    } else {
        requested
    };
    // Never hard-fail: fall back to home on any invalid/inaccessible
    // path so the browser always has something to show.
    let resolved = if std::path::Path::new(&expanded).is_dir() {
        expanded
    } else {
        home.clone()
    };
    let resolved_path = std::path::Path::new(&resolved);
    let parent = resolved_path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .map(|p| p.to_string_lossy().to_string());
    let mut entries: Vec<FsEntry> = Vec::new();
    if let Ok(read_dir) = std::fs::read_dir(resolved_path) {
        for entry in read_dir.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue; // skip hidden dotdirs
            }
            let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
            if !is_dir {
                continue;
            }
            let full_path = entry.path();
            let is_git_repo = full_path.join(".git").exists();
            entries.push(FsEntry {
                name,
                path: full_path.to_string_lossy().to_string(),
                is_git_repo,
            });
        }
    }
    entries.sort_by(|a, b| a.name.cmp(&b.name));
    let _ = state.out_tx.send(ServerMessage::FsBrowseResult {
        request_id,
        host_id: "local".to_string(),
        path: resolved,
        parent,
        home,
        entries,
    });
}
