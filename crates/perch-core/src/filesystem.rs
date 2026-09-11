//! Bounded, workspace-confined filesystem operations.
//!
//! The WebSocket protocol deliberately stays in `protocol.rs`; this module is
//! the Rust-owned implementation that protocol adapters can call.  A
//! [`FileService`] is created for one already-authorized workspace root.  It
//! retains an open descriptor for that root; all subsequent paths are relative
//! to that descriptor and are opened by walking directory file descriptors
//! with `O_NOFOLLOW` on Unix.  This matters for both ordinary traversal
//! attempts and the less obvious case where a parent directory is swapped for
//! a symlink between validation and use.
//!
//! Directory listing is one level at a time and capped.  File reads and
//! previews are bounded before and during the read, and text versions are
//! SHA-256 hashes of the exact bytes returned.  Saves are written to a fresh
//! file in the same directory, synced, and atomically renamed into place.
//! Expected-version checks are serialized by the service, so two concurrent
//! saves cannot both pass against the same old version.

use std::cmp::Ordering;
use std::error::Error;
use std::ffi::{OsStr, OsString};
use std::fmt;
use std::fs::{self, File, Metadata};
use std::io::{self, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[cfg(unix)]
use std::ffi::CStr;
#[cfg(unix)]
use std::os::fd::{AsRawFd, FromRawFd, RawFd};
#[cfg(unix)]
use std::os::unix::ffi::{OsStrExt, OsStringExt};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

/// Default maximum number of entries returned by one lazy directory request.
pub const DEFAULT_MAX_ENTRIES: usize = 1_000;
/// Default maximum text file size accepted by `read_file` and `write_file`.
/// Keeping these caps equal means a successfully saved supported editor file
/// can always be reopened by the same service.
pub const DEFAULT_MAX_READ_BYTES: usize = 4 * 1_024 * 1_024;
/// Default maximum size accepted by `write_file` (kept as a named alias for
/// callers that configure the service explicitly).
pub const DEFAULT_MAX_WRITE_BYTES: usize = 4 * 1_024 * 1_024;
/// Default maximum text returned by `preview`.
pub const DEFAULT_MAX_PREVIEW_BYTES: usize = 256 * 1_024;

/// Limits applied to one [`FileService`].  Limits are intentionally per
/// workspace so a large project cannot change the safety envelope of another
/// project that is already open.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FsConfig {
    pub max_entries: usize,
    pub max_read_bytes: usize,
    pub max_write_bytes: usize,
    pub max_preview_bytes: usize,
}

impl Default for FsConfig {
    fn default() -> Self {
        Self {
            max_entries: DEFAULT_MAX_ENTRIES,
            max_read_bytes: DEFAULT_MAX_READ_BYTES,
            max_write_bytes: DEFAULT_MAX_WRITE_BYTES,
            max_preview_bytes: DEFAULT_MAX_PREVIEW_BYTES,
        }
    }
}

/// The kind of entry reported by a directory listing or file metadata.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    Directory,
    File,
    Symlink,
    Other,
}

impl EntryKind {
    fn sort_rank(self) -> u8 {
        match self {
            Self::Directory => 0,
            Self::File => 1,
            Self::Symlink => 2,
            Self::Other => 3,
        }
    }
}

/// Metadata returned for a file or tree entry.  `path` is always normalized
/// and relative to the service root.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadata {
    pub path: String,
    pub name: String,
    pub size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified_at_ms: Option<i64>,
    pub readonly: bool,
    pub executable: bool,
    pub kind: EntryKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_type: Option<String>,
}

/// One entry in a lazy directory listing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryEntry {
    pub name: String,
    pub path: String,
    pub kind: EntryKind,
    pub size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified_at_ms: Option<i64>,
    pub readonly: bool,
    pub executable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_type: Option<String>,
}

/// One level of a workspace tree.  `truncated` tells a client that it should
/// offer a narrower request rather than pretending the directory is complete.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryListing {
    pub path: String,
    pub entries: Vec<DirectoryEntry>,
    pub truncated: bool,
}

/// A bounded UTF-8 file document and its optimistic-concurrency version.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileRead {
    pub metadata: FileMetadata,
    pub content: String,
    pub version: String,
}

/// Result of an atomic file save.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteResult {
    pub metadata: FileMetadata,
    pub bytes_written: usize,
    pub version: String,
}

/// Lightweight preview classification.  Binary data is represented by its
/// metadata and explanation; it is never copied into the response.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PreviewKind {
    Text,
    Markdown,
    Json,
    Html,
    Image,
    Binary,
    TooLarge,
}

/// A bounded preview.  `requires_sandbox` is an explicit signal to the view
/// layer that HTML belongs in a sandboxed document, never in the privileged
/// application shell.  The core does not sanitize or execute workspace HTML.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilePreview {
    pub metadata: FileMetadata,
    pub version: Option<String>,
    pub kind: PreviewKind,
    pub content: Option<String>,
    pub media_type: Option<String>,
    pub requires_sandbox: bool,
    pub truncated: bool,
    pub message: Option<String>,
}

/// Errors returned by the bounded service.  `Conflict` carries the current
/// version so a client can reload/compare and then make an explicit save with
/// the newer version.
#[derive(Debug)]
pub enum FsError {
    InvalidConfig {
        message: String,
    },
    InvalidPath {
        path: String,
        reason: String,
    },
    Traversal {
        path: String,
    },
    NotFound {
        path: String,
    },
    Symlink {
        path: String,
    },
    NotRegularFile {
        path: String,
    },
    TooLarge {
        path: String,
        size: u64,
        limit: usize,
        metadata: Box<FileMetadata>,
    },
    Binary {
        path: String,
        metadata: Box<FileMetadata>,
    },
    Unsupported {
        path: String,
        reason: String,
    },
    ChangedDuringRead {
        path: String,
    },
    Conflict {
        path: String,
        expected: Option<String>,
        actual: Option<String>,
        current: Option<Box<FileMetadata>>,
    },
    Io {
        operation: &'static str,
        path: String,
        source: io::Error,
    },
}

impl FsError {
    fn io(operation: &'static str, path: impl Into<String>, source: io::Error) -> Self {
        Self::Io {
            operation,
            path: path.into(),
            source,
        }
    }

    fn path_not_found(path: &str, error: io::Error) -> Self {
        if error.kind() == io::ErrorKind::NotFound {
            Self::NotFound {
                path: path.to_string(),
            }
        } else if is_symlink_error(&error) {
            Self::Symlink {
                path: path.to_string(),
            }
        } else {
            Self::io("open", path, error)
        }
    }
}

impl fmt::Display for FsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidConfig { message } => {
                write!(f, "invalid filesystem configuration: {message}")
            }
            Self::InvalidPath { path, reason } => {
                write!(f, "invalid filesystem path {path:?}: {reason}")
            }
            Self::Traversal { path } => write!(f, "path traversal is not allowed: {path:?}"),
            Self::NotFound { path } => write!(f, "file or directory not found: {path:?}"),
            Self::Symlink { path } => write!(
                f,
                "symbolic links are not allowed in workspace paths: {path:?}"
            ),
            Self::NotRegularFile { path } => write!(f, "path is not a regular file: {path:?}"),
            Self::TooLarge {
                path, size, limit, ..
            } => {
                write!(
                    f,
                    "file {path:?} is {size} bytes, exceeding the {limit}-byte limit"
                )
            }
            Self::Binary { path, .. } => write!(f, "file {path:?} is binary or not valid UTF-8"),
            Self::Unsupported { path, reason } => {
                write!(f, "file {path:?} is unsupported: {reason}")
            }
            Self::ChangedDuringRead { path } => {
                write!(f, "file {path:?} changed while it was being read")
            }
            Self::Conflict {
                path,
                expected,
                actual,
                ..
            } => write!(
                f,
                "file {path:?} changed (expected version {}, current version {})",
                expected.as_deref().unwrap_or("<absent>"),
                actual.as_deref().unwrap_or("<absent>")
            ),
            Self::Io {
                operation,
                path,
                source,
            } => write!(f, "filesystem {operation} failed for {path:?}: {source}"),
        }
    }
}

impl Error for FsError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Io { source, .. } => Some(source),
            _ => None,
        }
    }
}

/// Rust-owned service for one authorized workspace root.
#[derive(Clone)]
pub struct FileService {
    root: PathBuf,
    root_handle: Arc<File>,
    config: FsConfig,
    /// A single bounded lock is preferable to an ever-growing path→lock map:
    /// saves are infrequent and the lock makes the optimistic check/write
    /// sequence atomic for every caller sharing this workspace service.
    write_lock: Arc<Mutex<()>>,
}

impl FileService {
    /// Create a service for an existing directory.  The root is canonicalized
    /// and opened once at authorization time; every operation then starts from
    /// the retained descriptor and uses the no-follow descriptor walk below.
    pub fn new(root: impl AsRef<Path>) -> Result<Self, FsError> {
        Self::with_config(root, FsConfig::default())
    }

    /// Create a service with explicit bounds.
    pub fn with_config(root: impl AsRef<Path>, config: FsConfig) -> Result<Self, FsError> {
        validate_config(config)?;
        let requested = root.as_ref();
        let canonical = fs::canonicalize(requested)
            .map_err(|error| FsError::io("authorize root", requested.to_string_lossy(), error))?;
        let metadata = fs::symlink_metadata(&canonical)
            .map_err(|error| FsError::io("authorize root", canonical.to_string_lossy(), error))?;
        if !metadata.is_dir() {
            return Err(FsError::InvalidPath {
                path: canonical.to_string_lossy().to_string(),
                reason: "workspace root must be a directory".to_string(),
            });
        }
        // Fail early on platforms where the descriptor primitives required to
        // enforce the root boundary are unavailable.  Retaining this handle
        // also prevents a later replacement of the root pathname from moving
        // the service to a different directory.
        let root_handle = open_root(&canonical)
            .map_err(|error| FsError::io("authorize root", canonical.to_string_lossy(), error))?;
        Ok(Self {
            root: canonical,
            root_handle: Arc::new(root_handle),
            config,
            write_lock: global_write_lock(),
        })
    }

    /// Construct with individual bounds, useful for tests and small clients.
    pub fn with_limits(
        root: impl AsRef<Path>,
        max_entries: usize,
        max_read_bytes: usize,
        max_write_bytes: usize,
        max_preview_bytes: usize,
    ) -> Result<Self, FsError> {
        Self::with_config(
            root,
            FsConfig {
                max_entries,
                max_read_bytes,
                max_write_bytes,
                max_preview_bytes,
            },
        )
    }

    /// The canonical authorized root.  Callers should use service operations
    /// for file access rather than opening this path themselves.
    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn config(&self) -> FsConfig {
        self.config
    }

    /// List one directory lazily.  Files, directories, and symlinks are
    /// reported, but links are never followed by this service.
    pub fn list_dir<P: AsRef<Path>>(&self, path: P) -> Result<DirectoryListing, FsError> {
        let components = normalized_components(path.as_ref())?;
        let relative = relative_path(&components);
        let directory = self.open_directory(&components, &relative)?;
        let read_dir = read_directory_from_fd(&directory, self.config.max_entries)
            .map_err(|error| FsError::io("list directory", &relative, error))?;

        let mut entries = Vec::new();
        for entry in read_dir.entries {
            let name = entry.name.to_string_lossy().to_string();
            let child_path = append_component(&components, entry.name);
            entries.push(DirectoryEntry {
                name: name.clone(),
                path: relative_path(&child_path),
                kind: entry.kind,
                size: entry.size,
                modified_at_ms: entry.modified_at_ms,
                readonly: entry.readonly,
                executable: entry.executable,
                media_type: media_type_for_name(&name),
            });
        }

        entries.sort_by(|left, right| {
            left.kind
                .sort_rank()
                .cmp(&right.kind.sort_rank())
                .then_with(|| natural_cmp(&left.name, &right.name))
        });
        Ok(DirectoryListing {
            path: relative,
            entries,
            truncated: read_dir.truncated,
        })
    }

    /// Read a bounded UTF-8 text file and return its content hash.
    pub fn read_file<P: AsRef<Path>>(&self, path: P) -> Result<FileRead, FsError> {
        let components = normalized_components(path.as_ref())?;
        let relative = require_file_components(&components, path.as_ref())?;
        let (parent, name) = self.open_parent(&components, &relative)?;
        let mut file = open_file_at(&parent, &name)
            .map_err(|error| FsError::path_not_found(&relative, error))?;
        let metadata = file
            .metadata()
            .map_err(|error| FsError::io("stat", &relative, error))?;
        let file_metadata = metadata_for_file(&relative, &metadata);
        if !metadata.is_file() {
            return Err(FsError::NotRegularFile { path: relative });
        }
        let bytes = read_bounded(
            &mut file,
            &metadata,
            self.config.max_read_bytes,
            &file_metadata,
        )?;
        let content = String::from_utf8(bytes.clone()).map_err(|_| FsError::Binary {
            path: relative.clone(),
            metadata: Box::new(file_metadata.clone()),
        })?;
        if is_probably_binary(&bytes) {
            return Err(FsError::Binary {
                path: relative,
                metadata: Box::new(file_metadata),
            });
        }
        let after = file
            .metadata()
            .map_err(|error| FsError::io("stat", &relative, error))?;
        if after.len() != metadata.len() {
            return Err(FsError::ChangedDuringRead { path: relative });
        }
        Ok(FileRead {
            metadata: file_metadata,
            content,
            version: version_hash(&bytes),
        })
    }

    /// Return bounded metadata for a regular file without reading its
    /// contents. Adapters can use this as a cheap invalidation fast path and
    /// call [`FileService::read_file`] only when size/mtime changes (or on a
    /// periodic verification pass). The same descriptor walk and no-follow
    /// checks as a content read protect the workspace boundary.
    pub fn stat_file<P: AsRef<Path>>(&self, path: P) -> Result<FileMetadata, FsError> {
        let components = normalized_components(path.as_ref())?;
        let relative = require_file_components(&components, path.as_ref())?;
        let (parent, name) = self.open_parent(&components, &relative)?;
        let file = open_file_at(&parent, &name)
            .map_err(|error| FsError::path_not_found(&relative, error))?;
        let metadata = file
            .metadata()
            .map_err(|error| FsError::io("stat", &relative, error))?;
        if !metadata.is_file() {
            return Err(FsError::NotRegularFile { path: relative });
        }
        Ok(metadata_for_file(&relative, &metadata))
    }

    /// Return a bounded preview for text, Markdown, JSON, HTML, image, and
    /// binary files.  Image/binary responses contain metadata only.
    pub fn preview<P: AsRef<Path>>(&self, path: P) -> Result<FilePreview, FsError> {
        let components = normalized_components(path.as_ref())?;
        let relative = require_file_components(&components, path.as_ref())?;
        let (parent, name) = self.open_parent(&components, &relative)?;
        let mut file = open_file_at(&parent, &name)
            .map_err(|error| FsError::path_not_found(&relative, error))?;
        let metadata = file
            .metadata()
            .map_err(|error| FsError::io("stat", &relative, error))?;
        let file_metadata = metadata_for_file(&relative, &metadata);
        if !metadata.is_file() {
            return Err(FsError::NotRegularFile { path: relative });
        }

        let name_text = name.to_string_lossy().to_string();
        let preview_kind = preview_kind_for_name(&name_text);
        if preview_kind == PreviewKind::Image {
            return Ok(FilePreview {
                metadata: file_metadata,
                version: None,
                kind: PreviewKind::Image,
                content: None,
                media_type: media_type_for_name(&name_text),
                requires_sandbox: false,
                truncated: false,
                message: Some("Image preview is metadata-only in the core".to_string()),
            });
        }

        if metadata.len() > self.config.max_preview_bytes as u64 {
            return Ok(FilePreview {
                metadata: file_metadata,
                version: None,
                kind: PreviewKind::TooLarge,
                content: None,
                media_type: media_type_for_name(&name_text),
                requires_sandbox: false,
                truncated: true,
                message: Some(format!(
                    "Preview is limited to {} bytes",
                    self.config.max_preview_bytes
                )),
            });
        }

        let bytes = read_bounded(
            &mut file,
            &metadata,
            self.config.max_preview_bytes,
            &file_metadata,
        )?;
        let Ok(content) = String::from_utf8(bytes.clone()) else {
            return Ok(FilePreview {
                metadata: file_metadata,
                version: None,
                kind: PreviewKind::Binary,
                content: None,
                media_type: media_type_for_name(&name_text),
                requires_sandbox: false,
                truncated: false,
                message: Some("Binary or non-UTF-8 content is not sent to the client".to_string()),
            });
        };
        if is_probably_binary(&bytes) {
            return Ok(FilePreview {
                metadata: file_metadata,
                version: None,
                kind: PreviewKind::Binary,
                content: None,
                media_type: media_type_for_name(&name_text),
                requires_sandbox: false,
                truncated: false,
                message: Some("Binary content is not sent to the client".to_string()),
            });
        }
        let kind = if preview_kind == PreviewKind::Html {
            PreviewKind::Html
        } else if preview_kind == PreviewKind::Json {
            PreviewKind::Json
        } else if preview_kind == PreviewKind::Markdown {
            PreviewKind::Markdown
        } else {
            PreviewKind::Text
        };
        Ok(FilePreview {
            metadata: file_metadata,
            version: Some(version_hash(&bytes)),
            kind,
            content: Some(content),
            media_type: media_type_for_name(&name_text),
            requires_sandbox: kind == PreviewKind::Html,
            truncated: false,
            message: if kind == PreviewKind::Html {
                Some("Render HTML only in a sandboxed document".to_string())
            } else {
                None
            },
        })
    }

    /// Return the current content version for a regular file.  This is useful
    /// to an adapter that wants to refresh a conflict without opening content.
    pub fn current_version<P: AsRef<Path>>(&self, path: P) -> Result<String, FsError> {
        let read = self.read_file(path)?;
        Ok(read.version)
    }

    /// Compute the same SHA-256 version used by reads and writes without
    /// exposing the hashing implementation to protocol adapters.
    pub fn version_for_bytes(bytes: &[u8]) -> String {
        version_hash(bytes)
    }

    /// Atomically replace a text/binary file only when `expected_version`
    /// matches the current content hash.  `None` is create-only: an existing
    /// path produces a conflict, which prevents an unversioned caller from
    /// silently clobbering edits.
    pub fn write_file<P: AsRef<Path>>(
        &self,
        path: P,
        content: &[u8],
        expected_version: Option<&str>,
    ) -> Result<WriteResult, FsError> {
        let components = normalized_components(path.as_ref())?;
        let relative = require_file_components(&components, path.as_ref())?;
        if content.len() > self.config.max_write_bytes {
            return Err(FsError::TooLarge {
                path: relative.clone(),
                size: content.len() as u64,
                limit: self.config.max_write_bytes,
                metadata: Box::new(empty_metadata(relative)),
            });
        }
        // The editor protocol promises that a successful write can be
        // reopened through `read_file`. A caller may intentionally configure
        // a smaller read cap, so refuse this write before publication rather
        // than leaving an unreadable file behind.
        if content.len() > self.config.max_read_bytes {
            return Err(FsError::TooLarge {
                path: relative.clone(),
                size: content.len() as u64,
                limit: self.config.max_read_bytes,
                metadata: Box::new(empty_metadata(relative)),
            });
        }
        let _guard = self
            .write_lock
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let (parent, name) = self.open_parent(&components, &relative)?;

        let before = self.snapshot_existing(&parent, &name, &relative)?;
        let before_version = before.as_ref().map(|snapshot| snapshot.version.as_str());
        if before_version != expected_version {
            return Err(conflict_for(&relative, expected_version, before.as_ref()));
        }

        let temp_name = format!(
            ".perch-write-{}-{}",
            uuid::Uuid::new_v4(),
            std::process::id()
        );
        let mut temp = match create_temp_at(&parent, OsStr::new(&temp_name)) {
            Ok(file) => file,
            Err(error) => return Err(FsError::io("create temporary file", &relative, error)),
        };
        let cleanup = || {
            let _ = unlink_at(&parent, OsStr::new(&temp_name));
        };

        if let Some(snapshot) = &before {
            set_mode(&temp, snapshot.mode).map_err(|error| {
                cleanup();
                FsError::io("preserve file permissions", &relative, error)
            })?;
        }
        if let Err(error) = temp.write_all(content) {
            cleanup();
            return Err(FsError::io("write temporary file", &relative, error));
        }
        if let Err(error) = temp.sync_all() {
            cleanup();
            return Err(FsError::io("sync temporary file", &relative, error));
        }
        drop(temp);

        // Re-check after writing the temporary file.  This closes the usual
        // race with another Perch request and, together with the process-wide
        // service lock, prevents simultaneous saves from both replacing an
        // old hash.  For an existing pathname, POSIX `renameat` has no
        // compare-and-swap primitive: an unrelated process can still replace
        // that pathname after this check, but the replacement remains inside
        // the already-authorized parent directory.  Create-only publication
        // below uses `linkat`, which fails if another process creates the name.
        let after = match self.snapshot_existing(&parent, &name, &relative) {
            Ok(snapshot) => snapshot,
            Err(error) => {
                cleanup();
                return Err(error);
            }
        };
        if !same_snapshot(before.as_ref(), after.as_ref()) {
            cleanup();
            return Err(conflict_for(&relative, expected_version, after.as_ref()));
        }
        if after
            .as_ref()
            .is_some_and(|snapshot| snapshot.metadata.kind == EntryKind::Symlink)
        {
            cleanup();
            return Err(FsError::Symlink { path: relative });
        }

        if before.is_none() {
            match link_at(&parent, OsStr::new(&temp_name), &name) {
                Ok(()) => {
                    // The target now owns the temporary inode.  Removing the
                    // private name leaves exactly one durable pathname.
                    let _ = unlink_at(&parent, OsStr::new(&temp_name));
                }
                Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
                    // A concurrent creator won the no-replace publication.
                    // Re-snapshot while still holding the process-wide lock
                    // so the caller receives the version it must compare.
                    let current = self.snapshot_existing(&parent, &name, &relative);
                    cleanup();
                    return match current {
                        Ok(current) => {
                            Err(conflict_for(&relative, expected_version, current.as_ref()))
                        }
                        Err(error) => Err(error),
                    };
                }
                Err(error) => {
                    cleanup();
                    return Err(FsError::io("atomically create file", &relative, error));
                }
            }
        } else if let Err(error) = rename_at(&parent, OsStr::new(&temp_name), &name) {
            cleanup();
            return Err(FsError::io("atomically replace file", &relative, error));
        }
        if let Err(error) = parent.sync_all() {
            return Err(FsError::io("sync parent directory", &relative, error));
        }
        let mut result_file = open_file_at(&parent, &name)
            .map_err(|error| FsError::path_not_found(&relative, error))?;
        let result_metadata = result_file
            .metadata()
            .map_err(|error| FsError::io("stat saved file", &relative, error))?;
        let file_metadata = metadata_for_file(&relative, &result_metadata);
        if !result_metadata.is_file() {
            return Err(FsError::NotRegularFile { path: relative });
        }
        // The bytes are already bounded and were the input to the atomic
        // write; reading a bounded amount here only verifies that the target
        // remains a regular file after the rename.
        let mut first_byte = [0u8; 1];
        let _ = result_file.read(&mut first_byte);
        Ok(WriteResult {
            metadata: file_metadata,
            bytes_written: content.len(),
            version: version_hash(content),
        })
    }

    /// Text-oriented convenience wrapper for editor adapters.
    pub fn write_text<P: AsRef<Path>>(
        &self,
        path: P,
        content: &str,
        expected_version: Option<&str>,
    ) -> Result<WriteResult, FsError> {
        self.write_file(path, content.as_bytes(), expected_version)
    }

    fn open_directory(&self, components: &[OsString], relative: &str) -> Result<File, FsError> {
        let root = self
            .root_handle
            .try_clone()
            .map_err(|error| FsError::io("clone workspace root", relative, error))?;
        let mut current = root;
        for component in components {
            current = open_dir_at(&current, component).map_err(|error| {
                if is_symlink_error(&error) {
                    FsError::Symlink {
                        path: relative.to_string(),
                    }
                } else {
                    FsError::path_not_found(relative, error)
                }
            })?;
        }
        Ok(current)
    }

    fn open_parent(
        &self,
        components: &[OsString],
        relative: &str,
    ) -> Result<(File, OsString), FsError> {
        let (name, parents) = components
            .split_last()
            .ok_or_else(|| FsError::InvalidPath {
                path: relative.to_string(),
                reason: "a file path is required".to_string(),
            })?;
        let parent = self.open_directory(parents, relative)?;
        Ok((parent, name.clone()))
    }

    fn snapshot_existing(
        &self,
        parent: &File,
        name: &OsStr,
        relative: &str,
    ) -> Result<Option<FileSnapshot>, FsError> {
        let mut file = match open_file_at(parent, name) {
            Ok(file) => file,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) if is_symlink_error(&error) => {
                return Err(FsError::Symlink {
                    path: relative.to_string(),
                })
            }
            Err(error) => return Err(FsError::io("open", relative, error)),
        };
        let metadata = file
            .metadata()
            .map_err(|error| FsError::io("stat", relative, error))?;
        if !metadata.is_file() {
            return Err(FsError::NotRegularFile {
                path: relative.to_string(),
            });
        }
        let file_metadata = metadata_for_file(relative, &metadata);
        let bytes = read_bounded(
            &mut file,
            &metadata,
            self.config.max_read_bytes,
            &file_metadata,
        )?;
        Ok(Some(FileSnapshot {
            version: version_hash(&bytes),
            metadata: file_metadata,
            mode: file_mode(&metadata),
        }))
    }
}

#[derive(Debug, Clone)]
struct FileSnapshot {
    version: String,
    metadata: FileMetadata,
    mode: u32,
}

fn global_write_lock() -> Arc<Mutex<()>> {
    static LOCK: OnceLock<Arc<Mutex<()>>> = OnceLock::new();
    LOCK.get_or_init(|| Arc::new(Mutex::new(()))).clone()
}

fn validate_config(config: FsConfig) -> Result<(), FsError> {
    if config.max_entries == 0
        || config.max_read_bytes == 0
        || config.max_write_bytes == 0
        || config.max_preview_bytes == 0
    {
        return Err(FsError::InvalidConfig {
            message: "all filesystem limits must be greater than zero".to_string(),
        });
    }
    Ok(())
}

fn normalized_components(path: &Path) -> Result<Vec<OsString>, FsError> {
    let path_text = path_for_error(path);
    if path.as_os_str().is_empty() {
        return Ok(Vec::new());
    }
    let mut components = Vec::new();
    for component in path.components() {
        match component {
            Component::Normal(value) => {
                #[cfg(unix)]
                if value.as_bytes().contains(&0) || value.as_bytes().contains(&b'\\') {
                    return Err(FsError::InvalidPath {
                        path: path_text,
                        reason: "NUL and backslash characters are not valid workspace path input"
                            .to_string(),
                    });
                }
                #[cfg(not(unix))]
                if value.to_string_lossy().contains(['\0', '\\']) {
                    return Err(FsError::InvalidPath {
                        path: path_text,
                        reason: "NUL and backslash characters are not valid workspace path input"
                            .to_string(),
                    });
                }
                components.push(value.to_os_string());
            }
            Component::CurDir => {}
            Component::ParentDir => return Err(FsError::Traversal { path: path_text }),
            Component::RootDir | Component::Prefix(_) => {
                return Err(FsError::InvalidPath {
                    path: path_text,
                    reason: "absolute paths are not accepted; use a workspace-relative path"
                        .to_string(),
                })
            }
        }
    }
    Ok(components)
}

fn require_file_components(components: &[OsString], path: &Path) -> Result<String, FsError> {
    if components.is_empty() {
        return Err(FsError::InvalidPath {
            path: path_for_error(path),
            reason: "a file path is required".to_string(),
        });
    }
    Ok(relative_path(components))
}

fn relative_path(components: &[OsString]) -> String {
    let mut path = PathBuf::new();
    for component in components {
        path.push(component);
    }
    path.to_string_lossy().to_string()
}

fn append_component(components: &[OsString], component: OsString) -> Vec<OsString> {
    let mut path = components.to_vec();
    path.push(component);
    path
}

fn path_for_error(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn empty_metadata(path: String) -> FileMetadata {
    let name = Path::new(&path)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_default();
    FileMetadata {
        path,
        name,
        size: 0,
        modified_at_ms: None,
        readonly: false,
        executable: false,
        kind: EntryKind::File,
        media_type: None,
    }
}

fn metadata_for_file(path: &str, metadata: &Metadata) -> FileMetadata {
    let name = Path::new(path)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_default();
    FileMetadata {
        path: path.to_string(),
        name: name.clone(),
        size: metadata.len(),
        modified_at_ms: modified_at_ms(metadata),
        readonly: metadata.permissions().readonly(),
        executable: is_executable(metadata),
        kind: EntryKind::File,
        media_type: media_type_for_name(&name),
    }
}

fn modified_at_ms(metadata: &Metadata) -> Option<i64> {
    let duration = metadata.modified().ok()?.duration_since(UNIX_EPOCH).ok()?;
    i64::try_from(duration.as_millis()).ok()
}

#[cfg(unix)]
fn is_executable(metadata: &Metadata) -> bool {
    metadata.permissions().mode() & 0o111 != 0
}

#[cfg(not(unix))]
fn is_executable(_metadata: &Metadata) -> bool {
    false
}

#[cfg(unix)]
fn file_mode(metadata: &Metadata) -> u32 {
    metadata.permissions().mode() & 0o7777
}

#[cfg(not(unix))]
fn file_mode(_metadata: &Metadata) -> u32 {
    0o644
}

fn media_type_for_name(name: &str) -> Option<String> {
    let extension = Path::new(name)
        .extension()
        .and_then(|extension| extension.to_str())?
        .to_ascii_lowercase();
    let media_type = match extension.as_str() {
        "md" | "markdown" => "text/markdown",
        "json" | "jsonc" => "application/json",
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "js" | "mjs" | "cjs" | "ts" | "tsx" | "jsx" => "text/javascript",
        "rs" => "text/x-rust",
        "toml" => "application/toml",
        "yaml" | "yml" => "application/yaml",
        "xml" => "application/xml",
        "txt" | "log" => "text/plain",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "pdf" => "application/pdf",
        _ => return None,
    };
    Some(media_type.to_string())
}

fn preview_kind_for_name(name: &str) -> PreviewKind {
    let extension = Path::new(name)
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    match extension.as_str() {
        "md" | "markdown" => PreviewKind::Markdown,
        "json" | "jsonc" => PreviewKind::Json,
        "html" | "htm" => PreviewKind::Html,
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "ico" => PreviewKind::Image,
        _ => PreviewKind::Text,
    }
}

fn version_hash(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn is_probably_binary(bytes: &[u8]) -> bool {
    bytes
        .iter()
        .any(|byte| *byte == 0 || (*byte < 0x09) || (*byte > 0x0d && *byte < 0x20))
}

fn read_bounded(
    file: &mut File,
    metadata: &Metadata,
    limit: usize,
    file_metadata: &FileMetadata,
) -> Result<Vec<u8>, FsError> {
    if metadata.len() > limit as u64 {
        return Err(FsError::TooLarge {
            path: file_metadata.path.clone(),
            size: metadata.len(),
            limit,
            metadata: Box::new(file_metadata.clone()),
        });
    }
    let mut bytes = Vec::with_capacity(metadata.len().min(limit as u64) as usize);
    let mut bounded = file.take((limit as u64).saturating_add(1));
    bounded
        .read_to_end(&mut bytes)
        .map_err(|error| FsError::io("read", &file_metadata.path, error))?;
    if bytes.len() > limit {
        return Err(FsError::TooLarge {
            path: file_metadata.path.clone(),
            size: bytes.len() as u64,
            limit,
            metadata: Box::new(file_metadata.clone()),
        });
    }
    Ok(bytes)
}

fn same_snapshot(before: Option<&FileSnapshot>, after: Option<&FileSnapshot>) -> bool {
    match (before, after) {
        (None, None) => true,
        (Some(left), Some(right)) => left.version == right.version,
        _ => false,
    }
}

fn conflict_for(path: &str, expected: Option<&str>, current: Option<&FileSnapshot>) -> FsError {
    FsError::Conflict {
        path: path.to_string(),
        expected: expected.map(ToOwned::to_owned),
        actual: current.map(|snapshot| snapshot.version.clone()),
        current: current.map(|snapshot| Box::new(snapshot.metadata.clone())),
    }
}

fn natural_cmp(left: &str, right: &str) -> Ordering {
    let left_lower = left.to_ascii_lowercase();
    let right_lower = right.to_ascii_lowercase();
    let mut left_iter = left_lower.chars().peekable();
    let mut right_iter = right_lower.chars().peekable();
    loop {
        match (left_iter.peek(), right_iter.peek()) {
            (None, None) => return left.cmp(right),
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(left_char), Some(right_char))
                if left_char.is_ascii_digit() && right_char.is_ascii_digit() =>
            {
                let mut left_digits = String::new();
                while left_iter
                    .peek()
                    .is_some_and(|character| character.is_ascii_digit())
                {
                    left_digits.push(left_iter.next().expect("peeked digit"));
                }
                let mut right_digits = String::new();
                while right_iter
                    .peek()
                    .is_some_and(|character| character.is_ascii_digit())
                {
                    right_digits.push(right_iter.next().expect("peeked digit"));
                }
                let left_trimmed = left_digits.trim_start_matches('0');
                let right_trimmed = right_digits.trim_start_matches('0');
                if left_trimmed.len() != right_trimmed.len() {
                    return left_trimmed.len().cmp(&right_trimmed.len());
                }
                if left_trimmed != right_trimmed {
                    return left_trimmed.cmp(right_trimmed);
                }
            }
            (Some(_), Some(_)) => {
                let left_char = left_iter.next().expect("peeked character");
                let right_char = right_iter.next().expect("peeked character");
                if left_char != right_char {
                    return left_char.cmp(&right_char);
                }
            }
        }
    }
}

fn is_symlink_error(error: &io::Error) -> bool {
    #[cfg(unix)]
    {
        error.raw_os_error() == Some(libc::ELOOP)
    }
    #[cfg(not(unix))]
    {
        false
    }
}

#[cfg(unix)]
fn open_root(path: &Path) -> io::Result<File> {
    let mut current = secure_open_root_directory()?;
    for component in path.components() {
        match component {
            Component::RootDir => {}
            Component::Normal(name) => current = open_dir_at(&current, name)?,
            Component::CurDir => {}
            Component::ParentDir => {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "root path contains parent traversal",
                ))
            }
            Component::Prefix(_) => {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "root path prefix is unsupported",
                ))
            }
        }
    }
    Ok(current)
}

#[cfg(not(unix))]
fn open_root(_path: &Path) -> io::Result<File> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "workspace-safe filesystem operations require Unix no-follow primitives",
    ))
}

#[cfg(unix)]
fn secure_open_root_directory() -> io::Result<File> {
    let root = std::ffi::CString::new("/").expect("literal has no NUL");
    let flags = libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC;
    let fd = unsafe { libc::open(root.as_ptr(), flags) };
    file_from_fd(fd)
}

#[cfg(unix)]
fn open_dir_at(parent: &File, name: &OsStr) -> io::Result<File> {
    let name = CStringPath::new(name)?;
    // Do not rely on O_DIRECTORY here: macOS reports ENOTDIR for a symlink
    // with O_DIRECTORY before O_NOFOLLOW can report ELOOP.  Open no-follow,
    // then inspect the descriptor and reject anything that is not a directory.
    // O_NONBLOCK also prevents a FIFO in an intermediate component from
    // blocking the service before it can reject the path.
    let flags = libc::O_RDONLY | libc::O_NONBLOCK | libc::O_NOFOLLOW | libc::O_CLOEXEC;
    let fd = unsafe { libc::openat(parent.as_raw_fd(), name.as_ptr(), flags) };
    let file = file_from_fd(fd)?;
    if file.metadata()?.is_dir() {
        Ok(file)
    } else {
        Err(io::Error::from_raw_os_error(libc::ENOTDIR))
    }
}

#[cfg(not(unix))]
fn open_dir_at(_parent: &File, _name: &OsStr) -> io::Result<File> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "directory descriptor walk is unsupported on this platform",
    ))
}

#[cfg(unix)]
fn open_file_at(parent: &File, name: &OsStr) -> io::Result<File> {
    let name = CStringPath::new(name)?;
    // O_NONBLOCK makes opening a FIFO return immediately.  We reject it after
    // `fstat`; without this flag a hostile workspace entry could wedge the
    // server before it gets a chance to report `NotRegularFile`.
    let flags = libc::O_RDONLY | libc::O_NONBLOCK | libc::O_NOFOLLOW | libc::O_CLOEXEC;
    let fd = unsafe { libc::openat(parent.as_raw_fd(), name.as_ptr(), flags) };
    file_from_fd(fd)
}

#[cfg(not(unix))]
fn open_file_at(_parent: &File, _name: &OsStr) -> io::Result<File> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "file descriptor operations are unsupported on this platform",
    ))
}

#[cfg(unix)]
fn create_temp_at(parent: &File, name: &OsStr) -> io::Result<File> {
    let name = CStringPath::new(name)?;
    let flags = libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL | libc::O_NOFOLLOW | libc::O_CLOEXEC;
    let fd = unsafe { libc::openat(parent.as_raw_fd(), name.as_ptr(), flags, 0o600) };
    file_from_fd(fd)
}

#[cfg(not(unix))]
fn create_temp_at(_parent: &File, _name: &OsStr) -> io::Result<File> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "atomic descriptor operations are unsupported on this platform",
    ))
}

#[cfg(unix)]
fn rename_at(parent: &File, old: &OsStr, new: &OsStr) -> io::Result<()> {
    let old = CStringPath::new(old)?;
    let new = CStringPath::new(new)?;
    let result = unsafe {
        libc::renameat(
            parent.as_raw_fd(),
            old.as_ptr(),
            parent.as_raw_fd(),
            new.as_ptr(),
        )
    };
    if result == 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    }
}

#[cfg(unix)]
fn link_at(parent: &File, old: &OsStr, new: &OsStr) -> io::Result<()> {
    let old = CStringPath::new(old)?;
    let new = CStringPath::new(new)?;
    let result = unsafe {
        libc::linkat(
            parent.as_raw_fd(),
            old.as_ptr(),
            parent.as_raw_fd(),
            new.as_ptr(),
            0,
        )
    };
    if result == 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    }
}

#[cfg(not(unix))]
fn link_at(_parent: &File, _old: &OsStr, _new: &OsStr) -> io::Result<()> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "atomic descriptor operations are unsupported on this platform",
    ))
}

#[cfg(not(unix))]
fn rename_at(_parent: &File, _old: &OsStr, _new: &OsStr) -> io::Result<()> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "atomic descriptor operations are unsupported on this platform",
    ))
}

#[cfg(unix)]
fn unlink_at(parent: &File, name: &OsStr) -> io::Result<()> {
    let name = CStringPath::new(name)?;
    let result = unsafe { libc::unlinkat(parent.as_raw_fd(), name.as_ptr(), 0) };
    if result == 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    }
}

#[cfg(not(unix))]
fn unlink_at(_parent: &File, _name: &OsStr) -> io::Result<()> {
    Ok(())
}

#[cfg(unix)]
fn set_mode(file: &File, mode: u32) -> io::Result<()> {
    let result = unsafe { libc::fchmod(file.as_raw_fd(), mode as libc::mode_t) };
    if result == 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    }
}

#[cfg(not(unix))]
fn set_mode(_file: &File, _mode: u32) -> io::Result<()> {
    Ok(())
}

#[cfg(unix)]
fn file_from_fd(fd: RawFd) -> io::Result<File> {
    if fd < 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(unsafe { File::from_raw_fd(fd) })
    }
}

#[derive(Debug)]
struct RawDirectoryEntry {
    name: OsString,
    kind: EntryKind,
    size: u64,
    modified_at_ms: Option<i64>,
    readonly: bool,
    executable: bool,
}

struct RawDirectoryListing {
    entries: Vec<RawDirectoryEntry>,
    truncated: bool,
}

#[cfg(unix)]
fn read_directory_from_fd(directory: &File, max_entries: usize) -> io::Result<RawDirectoryListing> {
    // `dup` would share the directory's open file description and therefore
    // its readdir offset.  A later listing could then observe EOF after an
    // earlier listing consumed the duplicate.  Open `.` relative to the
    // retained descriptor instead, which gives fdopendir an independent
    // description while keeping the root-boundary and no-follow guarantees.
    let dot = CStringPath::new(OsStr::new("."))?;
    let flags = libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC;
    let fresh_fd = unsafe { libc::openat(directory.as_raw_fd(), dot.as_ptr(), flags) };
    if fresh_fd < 0 {
        return Err(io::Error::last_os_error());
    }
    let dir = unsafe { libc::fdopendir(fresh_fd) };
    if dir.is_null() {
        let error = io::Error::last_os_error();
        unsafe {
            libc::close(fresh_fd);
        }
        return Err(error);
    }
    let guard = DirectoryGuard(dir);
    // Keep bounded candidates for each class.  Directory-first ordering is
    // useful to a tree client, but kernel readdir order is unspecified; a
    // single first-N pass could fill the response with files before seeing a
    // later directory.  We scan this one directory once while retaining at
    // most `max_entries` candidates in each class, then take directories
    // first.  No descendant directory is ever scanned.
    let mut directories = Vec::with_capacity(max_entries.min(64));
    let mut others = Vec::with_capacity(max_entries.min(64));
    let mut extra_directory = false;
    let mut extra_other = false;
    loop {
        let raw = unsafe { libc::readdir(guard.0) };
        if raw.is_null() {
            break;
        }
        let raw_name = unsafe { CStr::from_ptr((*raw).d_name.as_ptr()) }.to_bytes();
        if raw_name == b"." || raw_name == b".." {
            continue;
        }
        let name = OsString::from_vec(raw_name.to_vec());
        let path = CStringPath::new(&name)?;
        let mut stat = std::mem::MaybeUninit::<libc::stat>::zeroed();
        let result = unsafe {
            libc::fstatat(
                directory.as_raw_fd(),
                path.as_ptr(),
                stat.as_mut_ptr(),
                libc::AT_SYMLINK_NOFOLLOW,
            )
        };
        if result != 0 {
            // An entry can disappear between readdir and fstatat.  Omitting
            // that stale entry is safer and more useful than failing an
            // otherwise valid lazy listing.
            continue;
        }
        let stat = unsafe { stat.assume_init() };
        let mode = stat.st_mode as libc::mode_t;
        let kind = match mode & libc::S_IFMT as libc::mode_t {
            value if value == libc::S_IFDIR as libc::mode_t => EntryKind::Directory,
            value if value == libc::S_IFREG as libc::mode_t => EntryKind::File,
            value if value == libc::S_IFLNK as libc::mode_t => EntryKind::Symlink,
            _ => EntryKind::Other,
        };
        let size = if stat.st_size < 0 {
            0
        } else {
            stat.st_size as u64
        };
        let entry = RawDirectoryEntry {
            name,
            kind,
            size,
            modified_at_ms: stat_modified_at_ms(&stat),
            readonly: mode & 0o222 == 0,
            executable: mode & 0o111 != 0,
        };
        if kind == EntryKind::Directory {
            if directories.len() < max_entries {
                directories.push(entry);
            } else {
                extra_directory = true;
            }
        } else if others.len() < max_entries {
            others.push(entry);
        } else {
            extra_other = true;
        }
    }
    directories.sort_by(|left, right| {
        natural_cmp(&left.name.to_string_lossy(), &right.name.to_string_lossy())
    });
    others.sort_by(|left, right| {
        left.kind
            .sort_rank()
            .cmp(&right.kind.sort_rank())
            .then_with(|| natural_cmp(&left.name.to_string_lossy(), &right.name.to_string_lossy()))
    });
    let remaining = max_entries.saturating_sub(directories.len());
    let truncated = extra_directory || extra_other || others.len() > remaining;
    others.truncate(remaining);
    let mut entries = directories;
    entries.extend(others);
    Ok(RawDirectoryListing { entries, truncated })
}

#[cfg(not(unix))]
fn read_directory_from_fd(
    _directory: &File,
    _max_entries: usize,
) -> io::Result<RawDirectoryListing> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "directory descriptor enumeration is unsupported on this platform",
    ))
}

#[cfg(unix)]
struct DirectoryGuard(*mut libc::DIR);

#[cfg(unix)]
impl Drop for DirectoryGuard {
    fn drop(&mut self) {
        unsafe {
            libc::closedir(self.0);
        }
    }
}

#[cfg(any(target_os = "linux", target_os = "android"))]
fn stat_modified_at_ms(stat: &libc::stat) -> Option<i64> {
    let seconds = i128::from(stat.st_mtim.tv_sec);
    let nanos = i128::from(stat.st_mtim.tv_nsec);
    let millis = seconds.checked_mul(1_000)?.checked_add(nanos / 1_000_000)?;
    i64::try_from(millis).ok()
}

#[cfg(any(
    target_os = "macos",
    target_os = "ios",
    target_os = "freebsd",
    target_os = "openbsd",
    target_os = "netbsd",
    target_os = "dragonfly"
))]
fn stat_modified_at_ms(stat: &libc::stat) -> Option<i64> {
    let seconds = i128::from(stat.st_mtime);
    let nanos = i128::from(stat.st_mtime_nsec);
    let millis = seconds.checked_mul(1_000)?.checked_add(nanos / 1_000_000)?;
    i64::try_from(millis).ok()
}

#[cfg(all(
    unix,
    not(any(
        target_os = "linux",
        target_os = "android",
        target_os = "macos",
        target_os = "ios",
        target_os = "freebsd",
        target_os = "openbsd",
        target_os = "netbsd",
        target_os = "dragonfly"
    ))
))]
fn stat_modified_at_ms(_stat: &libc::stat) -> Option<i64> {
    None
}

#[cfg(unix)]
struct CStringPath(std::ffi::CString);

#[cfg(unix)]
impl CStringPath {
    fn new(path: &OsStr) -> io::Result<Self> {
        std::ffi::CString::new(path.as_bytes())
            .map(Self)
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "path contains NUL"))
    }

    fn as_ptr(&self) -> *const libc::c_char {
        self.0.as_ptr()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::Arc;
    use std::thread;

    fn fixture(name: &str) -> (PathBuf, FileService) {
        let root =
            std::env::temp_dir().join(format!("perch-filesystem-{name}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).expect("fixture root");
        let service = FileService::new(&root).expect("service root");
        (root, service)
    }

    fn cleanup(root: &Path) {
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn read_returns_sha256_version_and_metadata() {
        let (root, service) = fixture("read");
        fs::write(root.join("note.txt"), b"hello").expect("write fixture");
        let read = service.read_file("note.txt").expect("read");
        assert_eq!(read.content, "hello");
        assert_eq!(
            read.version,
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
        assert_eq!(read.metadata.kind, EntryKind::File);
        assert_eq!(read.metadata.media_type.as_deref(), Some("text/plain"));
        cleanup(&root);
    }

    #[test]
    fn listing_sorts_directories_first_naturally() {
        let root =
            std::env::temp_dir().join(format!("perch-filesystem-list-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("dir10")).expect("dir10");
        fs::create_dir_all(root.join("dir2")).expect("dir2");
        fs::write(root.join("z.txt"), b"z").expect("z");
        fs::write(root.join("a.txt"), b"a").expect("a");
        let service = FileService::with_limits(&root, 4, 1024, 1024, 1024).expect("service");
        let listing = service.list_dir(".").expect("list");
        assert_eq!(listing.entries.len(), 4);
        assert!(!listing.truncated);
        assert_eq!(listing.entries[0].name, "dir2");
        assert_eq!(listing.entries[1].name, "dir10");
        assert_eq!(listing.entries[2].name, "a.txt");
        assert_eq!(listing.entries[3].name, "z.txt");
        cleanup(&root);
    }

    #[test]
    fn listing_is_lazy_bounded_and_reports_truncation() {
        let (root, _) = fixture("list-cap");
        for name in ["one", "two", "three", "four", "five"] {
            fs::write(root.join(name), name.as_bytes()).expect("entry");
        }
        let service =
            FileService::with_limits(root.as_path(), 3, 1024, 1024, 1024).expect("bounded service");
        let listing = service.list_dir(".").expect("list");
        assert_eq!(listing.entries.len(), 3);
        assert!(listing.truncated);
        cleanup(&root);
    }

    #[cfg(unix)]
    #[test]
    fn repeated_and_concurrent_listings_use_fresh_directory_offsets() {
        let (root, service) = fixture("list-offset");
        fs::create_dir(root.join("nested")).expect("nested");
        fs::write(root.join("root.txt"), b"root").expect("root file");
        fs::write(root.join("nested").join("child.txt"), b"child").expect("child file");
        let service = Arc::new(service);

        for _ in 0..8 {
            let root_listing = service.list_dir(".").expect("repeated root list");
            let nested_listing = service.list_dir("nested").expect("repeated nested list");
            assert_eq!(
                root_listing
                    .entries
                    .iter()
                    .map(|entry| entry.name.as_str())
                    .collect::<Vec<_>>(),
                vec!["nested", "root.txt"]
            );
            assert_eq!(
                nested_listing
                    .entries
                    .iter()
                    .map(|entry| entry.name.as_str())
                    .collect::<Vec<_>>(),
                vec!["child.txt"]
            );
        }

        let workers = (0..16)
            .map(|index| {
                let service = Arc::clone(&service);
                thread::spawn(move || {
                    let path = if index % 2 == 0 { "." } else { "nested" };
                    let listing = service.list_dir(path).expect("concurrent list");
                    (
                        path,
                        listing
                            .entries
                            .into_iter()
                            .map(|entry| entry.name)
                            .collect::<Vec<_>>(),
                    )
                })
            })
            .collect::<Vec<_>>();

        for worker in workers {
            let (path, names) = worker.join().expect("listing worker");
            let expected = if path == "." {
                vec!["nested".to_string(), "root.txt".to_string()]
            } else {
                vec!["child.txt".to_string()]
            };
            assert_eq!(names, expected, "listing for {path}");
        }

        drop(service);
        cleanup(&root);
    }

    #[test]
    fn traversal_absolute_paths_and_symlinks_are_rejected() {
        let (root, service) = fixture("boundary");
        fs::create_dir(root.join("nested")).expect("nested");
        fs::write(root.join("outside.txt"), b"inside").expect("inside");
        assert!(matches!(
            service.read_file("../outside.txt"),
            Err(FsError::Traversal { .. })
        ));
        assert!(matches!(
            service.read_file(root.join("outside.txt")),
            Err(FsError::InvalidPath { .. })
        ));
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink("/tmp", root.join("escape")).expect("symlink");
            let escape_result = service.list_dir("escape");
            assert!(matches!(escape_result, Err(FsError::Symlink { .. })));
            std::os::unix::fs::symlink("outside.txt", root.join("linked.txt")).expect("file link");
            assert!(matches!(
                service.read_file("linked.txt"),
                Err(FsError::Symlink { .. })
            ));
        }
        cleanup(&root);
    }

    #[cfg(unix)]
    #[test]
    fn retained_root_descriptor_survives_root_path_replacement() {
        let root = std::env::temp_dir().join(format!(
            "perch-filesystem-root-replacement-{}",
            uuid::Uuid::new_v4()
        ));
        let moved_root = root.with_file_name(format!(
            "perch-filesystem-root-replacement-moved-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&root).expect("root");
        let service = FileService::new(&root).expect("service");
        fs::rename(&root, &moved_root).expect("move authorized root");
        fs::create_dir(&root).expect("replacement root");
        fs::write(root.join("outside.txt"), b"outside").expect("replacement content");

        assert!(matches!(
            service.read_file("outside.txt"),
            Err(FsError::NotFound { .. })
        ));
        assert!(service
            .list_dir(".")
            .expect("list retained root")
            .entries
            .is_empty());

        drop(service);
        cleanup(&root);
        cleanup(&moved_root);
    }

    #[test]
    fn read_and_preview_are_bounded_without_returning_binary_content() {
        let root =
            std::env::temp_dir().join(format!("perch-filesystem-bounds-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).expect("root");
        fs::write(root.join("large.txt"), vec![b'x'; 17]).expect("large");
        fs::write(root.join("image.png"), vec![0u8; 17]).expect("image");
        fs::write(root.join("binary.bin"), [0, 159, 146, 150]).expect("binary");
        let service = FileService::with_limits(&root, 10, 16, 32, 8).expect("service");
        assert!(matches!(
            service.read_file("large.txt"),
            Err(FsError::TooLarge { .. })
        ));
        let image = service.preview("image.png").expect("image preview");
        assert_eq!(image.kind, PreviewKind::Image);
        assert!(image.content.is_none());
        let binary = service.preview("binary.bin").expect("binary preview");
        assert_eq!(binary.kind, PreviewKind::Binary);
        assert!(binary.content.is_none());
        cleanup(&root);
    }

    #[test]
    fn write_is_create_only_without_a_version_and_preserves_permissions() {
        let (root, service) = fixture("write");
        let created = service.write_file("new.txt", b"one", None).expect("create");
        assert_eq!(created.version, version_hash(b"one"));
        assert_eq!(
            fs::read(root.join("new.txt")).expect("read created"),
            b"one"
        );
        let conflict = service
            .write_file("new.txt", b"two", None)
            .expect_err("must conflict");
        assert!(matches!(
            conflict,
            FsError::Conflict {
                expected: None,
                actual: Some(_),
                ..
            }
        ));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(root.join("new.txt"), fs::Permissions::from_mode(0o751))
                .expect("mode");
            let version = service.read_file("new.txt").expect("read").version;
            service
                .write_file("new.txt", b"three", Some(&version))
                .expect("replace");
            assert_eq!(
                fs::metadata(root.join("new.txt"))
                    .expect("stat")
                    .permissions()
                    .mode()
                    & 0o777,
                0o751
            );
        }
        cleanup(&root);
    }

    #[test]
    fn stale_version_reports_current_hash_and_keeps_file_unchanged() {
        let (root, service) = fixture("conflict");
        fs::write(root.join("note.md"), b"one").expect("fixture");
        let first = service.read_file("note.md").expect("first read");
        let second = service
            .write_file("note.md", b"two", Some("stale"))
            .expect_err("conflict");
        match second {
            FsError::Conflict {
                expected,
                actual,
                current,
                ..
            } => {
                assert_eq!(expected.as_deref(), Some("stale"));
                assert_eq!(actual.as_deref(), Some(first.version.as_str()));
                assert_eq!(current.expect("metadata").size, 3);
            }
            other => panic!("unexpected error: {other:?}"),
        }
        assert_eq!(fs::read(root.join("note.md")).expect("unchanged"), b"one");
        cleanup(&root);
    }

    #[test]
    fn concurrent_saves_are_optimistic_and_only_one_wins() {
        let (root, service) = fixture("concurrent");
        fs::write(root.join("note.txt"), b"base").expect("fixture");
        let version = service.read_file("note.txt").expect("read").version;
        let service = Arc::new(service);
        // Distinct service instances still share the bounded process-wide
        // lock.  Adapters may cache one service per workspace, but a second
        // request path must not be able to bypass the optimistic check.
        let left = Arc::clone(&service);
        let right = Arc::new(FileService::new(&root).expect("second service"));
        let left_version = version.clone();
        let right_version = version.clone();
        let left_thread =
            thread::spawn(move || left.write_file("note.txt", b"left", Some(&left_version)));
        let right_thread =
            thread::spawn(move || right.write_file("note.txt", b"right", Some(&right_version)));
        let left_result = left_thread.join().expect("left thread");
        let right_result = right_thread.join().expect("right thread");
        assert_eq!(left_result.is_ok() as u8 + right_result.is_ok() as u8, 1);
        let final_content = fs::read(root.join("note.txt")).expect("final");
        assert!(final_content == b"left" || final_content == b"right");
        cleanup(&root);
    }

    #[cfg(unix)]
    #[test]
    fn fifo_entries_are_refused_without_blocking() {
        use std::ffi::CString;

        let (root, service) = fixture("fifo");
        let fifo = root.join("agent-pipe");
        let fifo_name = CString::new(fifo.as_os_str().as_bytes()).expect("fifo path");
        let result = unsafe { libc::mkfifo(fifo_name.as_ptr(), 0o600) };
        assert_eq!(result, 0, "mkfifo failed: {}", io::Error::last_os_error());
        assert!(matches!(
            service.read_file("agent-pipe"),
            Err(FsError::NotRegularFile { .. })
        ));
        assert!(matches!(
            service.write_file("agent-pipe", b"data", None),
            Err(FsError::NotRegularFile { .. })
        ));
        cleanup(&root);
    }

    #[test]
    fn html_preview_is_marked_for_sandboxing() {
        let (root, service) = fixture("preview");
        fs::write(root.join("index.html"), b"<script>bad()</script>").expect("fixture");
        let preview = service.preview("index.html").expect("preview");
        assert_eq!(preview.kind, PreviewKind::Html);
        assert!(preview.requires_sandbox);
        assert!(preview.content.is_some());
        cleanup(&root);
    }
}
