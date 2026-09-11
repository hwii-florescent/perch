//! Bounded, workspace-scoped Git status, diff, and source-control actions.
//!
//! This module is deliberately independent from the WebSocket protocol and
//! persistence layer.  The server can translate these value types into its
//! wire contract, while a later DB adapter can persist agent-turn snapshots.
//! Every Git argument is passed directly to `git` (there is no shell), every
//! path is authorized against a canonical workspace root, and destructive
//! operations require a confirmation produced from a fresh status preview.
//!
//! Git porcelain is used for status, diff, refs, and the small set of
//! mutations that Git itself must own.  The subprocess runner drains bounded
//! stdout/stderr concurrently and kills a command that exceeds its timeout,
//! so a prompting or unexpectedly noisy Git process cannot wedge the server.

use std::collections::BTreeSet;
use std::ffi::OsString;
use std::fmt;
use std::fs;
use std::io::{self, Read};
use std::path::{Component, Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt};
use tokio::process::Command;

const DEFAULT_TIMEOUT: Duration = Duration::from_secs(15);
const DEFAULT_MAX_OUTPUT_BYTES: usize = 4 * 1024 * 1024;
const DEFAULT_MAX_FILE_BYTES: usize = 2 * 1024 * 1024;
const DEFAULT_MAX_PATCH_BYTES: usize = 2 * 1024 * 1024;
const DEFAULT_MAX_FINGERPRINT_BYTES: usize = 8 * 1024 * 1024;
const MAX_PATH_BYTES: usize = 16 * 1024;
const MAX_SELECTED_PATHS: usize = 1024;
const MAX_SELECTED_PATH_BYTES: usize = 256 * 1024;

/// Errors returned by status, diff, and source-control operations.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GitError {
    InvalidTarget(String),
    InvalidPath(String),
    InvalidRef(String),
    InvalidPatch(String),
    ConfirmationRequired,
    ConfirmationMismatch(String),
    NoStagedChanges,
    CommandFailed {
        args: Vec<String>,
        code: Option<i32>,
        stderr: String,
    },
    TimedOut,
    OutputLimit,
    Io(String),
    Parse(String),
}

impl fmt::Display for GitError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidTarget(message) => write!(f, "invalid workspace target: {message}"),
            Self::InvalidPath(message) => write!(f, "invalid workspace path: {message}"),
            Self::InvalidRef(reference) => write!(f, "invalid Git ref: {reference}"),
            Self::InvalidPatch(message) => write!(f, "invalid patch: {message}"),
            Self::ConfirmationRequired => write!(f, "explicit confirmation is required"),
            Self::ConfirmationMismatch(message) => write!(f, "confirmation is stale: {message}"),
            Self::NoStagedChanges => write!(f, "there are no staged changes to commit"),
            Self::CommandFailed { stderr, code, .. } => {
                if stderr.is_empty() {
                    write!(f, "git failed with status {:?}", code)
                } else {
                    write!(f, "git failed with status {:?}: {stderr}", code)
                }
            }
            Self::TimedOut => write!(f, "git command timed out"),
            Self::OutputLimit => write!(f, "git output exceeded the configured bound"),
            Self::Io(message) => write!(f, "I/O error: {message}"),
            Self::Parse(message) => write!(f, "could not parse Git output: {message}"),
        }
    }
}

impl std::error::Error for GitError {}

impl From<io::Error> for GitError {
    fn from(error: io::Error) -> Self {
        Self::Io(error.to_string())
    }
}

/// The stable workspace identity and canonical root used for every operation.
/// The identity is carried through all results and action receipts so a caller
/// cannot accidentally apply an approval intended for a different workspace.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceTarget {
    workspace_id: String,
    root: PathBuf,
}

impl WorkspaceTarget {
    pub fn new(workspace_id: impl Into<String>, root: impl AsRef<Path>) -> Result<Self, GitError> {
        let workspace_id = workspace_id.into();
        if workspace_id.trim().is_empty() || workspace_id.contains('\0') {
            return Err(GitError::InvalidTarget(
                "workspace id must be non-empty and contain no NUL".to_string(),
            ));
        }
        let root = fs::canonicalize(root.as_ref()).map_err(|error| {
            GitError::InvalidTarget(format!("workspace root is not readable: {error}"))
        })?;
        if !root.is_dir() {
            return Err(GitError::InvalidTarget(
                "workspace root must be a directory".to_string(),
            ));
        }
        Ok(Self { workspace_id, root })
    }

    pub fn workspace_id(&self) -> &str {
        &self.workspace_id
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    /// Resolve a client-provided relative path and reject parent traversal,
    /// absolute paths, and symlinks that leave the workspace.  Missing paths
    /// remain valid when their nearest existing ancestor is inside the root,
    /// which allows a deletion or newly-created untracked file to be acted on.
    pub fn authorize_path(&self, path: &str) -> Result<PathBuf, GitError> {
        if path.is_empty() || path.len() > MAX_PATH_BYTES || path.contains('\0') {
            return Err(GitError::InvalidPath(
                "empty, NUL, or oversized path".to_string(),
            ));
        }
        let input = Path::new(path);
        if input.is_absolute() {
            return Err(GitError::InvalidPath(
                "absolute paths are not allowed".to_string(),
            ));
        }

        let mut relative = PathBuf::new();
        for component in input.components() {
            match component {
                Component::Normal(part) => relative.push(part),
                Component::CurDir => {}
                Component::ParentDir => {
                    return Err(GitError::InvalidPath(
                        "parent traversal is not allowed".to_string(),
                    ))
                }
                Component::RootDir | Component::Prefix(_) => {
                    return Err(GitError::InvalidPath(
                        "absolute paths are not allowed".to_string(),
                    ))
                }
            }
        }
        if relative.as_os_str().is_empty() {
            return Err(GitError::InvalidPath(
                "path resolves to the workspace root".to_string(),
            ));
        }

        let candidate = self.root.join(&relative);
        let mut existing = candidate.clone();
        while !existing.exists() {
            if !existing.pop() {
                return Err(GitError::InvalidPath(
                    "path has no workspace ancestor".to_string(),
                ));
            }
        }
        let canonical_existing = fs::canonicalize(&existing)
            .map_err(|error| GitError::InvalidPath(format!("cannot resolve path: {error}")))?;
        if !canonical_existing.starts_with(&self.root) {
            return Err(GitError::InvalidPath(
                "path escapes the workspace".to_string(),
            ));
        }
        Ok(relative)
    }

    fn authorize_paths(&self, paths: &[String]) -> Result<Vec<PathBuf>, GitError> {
        if paths.is_empty() {
            return Err(GitError::InvalidPath(
                "at least one path is required".to_string(),
            ));
        }
        if paths.len() > MAX_SELECTED_PATHS
            || paths
                .iter()
                .map(String::len)
                .try_fold(0usize, |total, length| total.checked_add(length))
                .is_none_or(|total| total > MAX_SELECTED_PATH_BYTES)
        {
            return Err(GitError::InvalidPath(
                "too many or oversized selected paths".to_string(),
            ));
        }
        let mut unique = BTreeSet::new();
        for path in paths {
            unique.insert(self.authorize_path(path)?);
        }
        Ok(unique.into_iter().collect())
    }
}

/// Configuration for the bounded Git runner and untracked-file synthesis.
#[derive(Debug, Clone)]
pub struct GitConfig {
    pub timeout: Duration,
    pub max_output_bytes: usize,
    pub max_file_bytes: usize,
    pub max_patch_bytes: usize,
}

impl Default for GitConfig {
    fn default() -> Self {
        Self {
            timeout: DEFAULT_TIMEOUT,
            max_output_bytes: DEFAULT_MAX_OUTPUT_BYTES,
            max_file_bytes: DEFAULT_MAX_FILE_BYTES,
            max_patch_bytes: DEFAULT_MAX_PATCH_BYTES,
        }
    }
}

/// Stateless service facade.  A caller may share one value between all
/// connections; workspace ownership is carried by each [`WorkspaceTarget`].
#[derive(Debug, Clone)]
pub struct GitService {
    config: GitConfig,
    /// Kept as a field so tests can exercise cancellation with a small
    /// helper executable without changing the process-wide PATH. Production
    /// callers use the normal `git` executable.
    git_binary: OsString,
}

impl Default for GitService {
    fn default() -> Self {
        Self::new(GitConfig::default())
    }
}

impl GitService {
    pub fn new(config: GitConfig) -> Self {
        Self {
            config,
            git_binary: OsString::from("git"),
        }
    }

    #[cfg(test)]
    fn with_git_binary(config: GitConfig, path: impl AsRef<Path>) -> Self {
        Self {
            config,
            git_binary: path.as_ref().as_os_str().to_os_string(),
        }
    }

    pub fn config(&self) -> &GitConfig {
        &self.config
    }

    pub async fn status(
        &self,
        target: &WorkspaceTarget,
        options: StatusOptions,
    ) -> Result<GitStatus, GitError> {
        let mut status_args = vec![
            OsString::from("status"),
            OsString::from("--porcelain=v1"),
            OsString::from("-z"),
            OsString::from("--untracked-files=all"),
        ];
        if options.include_ignored {
            status_args.push(OsString::from("--ignored=matching"));
        }
        let status_output = self.run(target.root(), &status_args, None).await?;
        if status_output.truncated {
            return Err(GitError::OutputLimit);
        }
        if status_output.code != Some(0) {
            return Err(command_failed(&status_args, &status_output));
        }
        let entries = parse_status_porcelain_z(&status_output.stdout)?;

        let branch = self
            .optional_text(target, &["branch", "--show-current"])
            .await;
        let head = self
            .optional_text(target, &["rev-parse", "--verify", "HEAD"])
            .await;
        let upstream = self
            .optional_text(
                target,
                &[
                    "rev-parse",
                    "--abbrev-ref",
                    "--symbolic-full-name",
                    "@{upstream}",
                ],
            )
            .await;
        let (ahead, behind) = if upstream.is_some() {
            self.optional_text(
                target,
                &["rev-list", "--left-right", "--count", "@{upstream}...HEAD"],
            )
            .await
            .and_then(|text| {
                let mut fields = text.split_whitespace();
                let behind = fields.next()?.parse().ok()?;
                let ahead = fields.next()?.parse().ok()?;
                Some((Some(ahead), Some(behind)))
            })
            .unwrap_or((None, None))
        } else {
            (None, None)
        };

        let observed_fingerprint = status_fingerprint(
            &entries,
            branch.as_deref(),
            head.as_deref(),
            upstream.as_deref(),
            ahead,
            behind,
        );
        Ok(GitStatus {
            workspace_id: target.workspace_id.clone(),
            root: target.root.display().to_string(),
            branch,
            head,
            upstream,
            ahead,
            behind,
            entries,
            observed_fingerprint,
        })
    }

    pub async fn branch_refs(&self, target: &WorkspaceTarget) -> Result<Vec<BranchRef>, GitError> {
        let args = [
            OsString::from("for-each-ref"),
            OsString::from("--format=%(refname)%00%(objectname)%00%(upstream:short)"),
            OsString::from("refs/heads"),
            OsString::from("refs/remotes"),
        ];
        let output = self.run(target.root(), &args, None).await?;
        if output.truncated {
            return Err(GitError::OutputLimit);
        }
        if output.code != Some(0) {
            return Err(command_failed(&args, &output));
        }
        let text = bounded_utf8(&output.stdout)?;
        let mut refs = Vec::new();
        for line in text.lines() {
            let mut fields = line.split('\0');
            let Some(full_name) = fields.next().filter(|v| !v.is_empty()) else {
                continue;
            };
            let target_oid = fields.next().unwrap_or_default().to_string();
            let remote = full_name.starts_with("refs/remotes/");
            let name = full_name
                .strip_prefix("refs/heads/")
                .or_else(|| full_name.strip_prefix("refs/remotes/"))
                .unwrap_or(full_name)
                .to_string();
            refs.push(BranchRef {
                name,
                target: target_oid,
                upstream: fields.next().filter(|v| !v.is_empty()).map(str::to_string),
                remote,
            });
        }
        refs.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(refs)
    }

    pub async fn diff(
        &self,
        target: &WorkspaceTarget,
        options: DiffOptions,
    ) -> Result<GitDiff, GitError> {
        let mut args = vec![
            OsString::from("diff"),
            OsString::from("--no-ext-diff"),
            OsString::from("--no-textconv"),
            OsString::from("--no-color"),
            OsString::from("--find-renames"),
            OsString::from(format!("--unified={}", options.context_lines.min(1000))),
        ];
        if options.ignore_whitespace {
            args.push(OsString::from("--ignore-all-space"));
        }
        match &options.target {
            DiffTarget::WorkingTree => {}
            DiffTarget::Staged => args.push(OsString::from("--cached")),
            DiffTarget::Head => args.push(OsString::from("HEAD")),
            DiffTarget::Compare { base, head } => {
                validate_ref(base)?;
                args.push(OsString::from(base));
                if let Some(head) = head {
                    validate_ref(head)?;
                    args.push(OsString::from(head));
                }
            }
        }
        args.push(OsString::from("--"));
        let path_filter = if let Some(path) = options.path.as_deref() {
            Some(target.authorize_path(path)?)
        } else {
            None
        };
        if let Some(path) = &path_filter {
            args.push(path.as_os_str().to_os_string());
        }

        let output = self.run(target.root(), &args, None).await?;
        if output.truncated {
            return Err(GitError::OutputLimit);
        }
        if output.code != Some(0) {
            return Err(command_failed(&args, &output));
        }
        let mut files = parse_unified_diff(&output.stdout)?;
        let include_untracked =
            options.include_untracked && !matches!(options.target, DiffTarget::Staged);
        if include_untracked {
            let status = self
                .status(
                    target,
                    StatusOptions {
                        include_ignored: false,
                    },
                )
                .await?;
            for entry in status.entries.iter().filter(|entry| entry.is_untracked()) {
                if path_filter
                    .as_ref()
                    .is_some_and(|path| path.to_string_lossy() != entry.path)
                {
                    continue;
                }
                if let Some(file) = synthetic_untracked_diff(
                    target,
                    &entry.path,
                    self.config.max_file_bytes,
                    options.context_lines,
                )? {
                    files.push(file);
                }
            }
        }
        files.sort_by(|a, b| {
            a.new_path
                .as_deref()
                .or(a.old_path.as_deref())
                .unwrap_or_default()
                .cmp(
                    b.new_path
                        .as_deref()
                        .or(b.old_path.as_deref())
                        .unwrap_or_default(),
                )
        });
        let hunk_count = files.iter().map(|file| file.hunks.len()).sum();
        Ok(GitDiff {
            workspace_id: target.workspace_id.clone(),
            target: options.target,
            files,
            hunk_count,
            truncated: false,
        })
    }

    /// Read the bounded source represented by one diff target and issue a
    /// content revision for review anchoring. `side` is the wire label
    /// (`old`, `new`, or `file`); invalid labels are rejected before any Git
    /// command runs. The caller must compare the returned revision with the
    /// revision it previously showed to the user.
    pub async fn review_source(
        &self,
        target: &WorkspaceTarget,
        diff_target: &DiffTarget,
        path: &str,
        side: &str,
    ) -> Result<ReviewSource, GitError> {
        if !matches!(side, "old" | "new" | "file") {
            return Err(GitError::InvalidPath("invalid review side".to_string()));
        }
        let path = target.authorize_path(path)?;
        let path_string = path.to_string_lossy().to_string();
        // Keep this matrix in lockstep with `git diff`'s two-sided targets.
        // The index is the visible new side of a staged diff and the visible
        // old side of a working-tree diff. For an explicit comparison the
        // requested head is authoritative; falling back to the worktree when
        // it is omitted preserves the usual "branch versus my edits" view.
        let source = match (diff_target, side) {
            (DiffTarget::WorkingTree, "old") => ReviewSourceLocation::Index,
            (DiffTarget::WorkingTree, "new" | "file") => ReviewSourceLocation::Worktree,
            (DiffTarget::Staged, "old") => ReviewSourceLocation::Reference("HEAD"),
            (DiffTarget::Staged, "new" | "file") => ReviewSourceLocation::Index,
            (DiffTarget::Head, "old") => ReviewSourceLocation::Reference("HEAD"),
            (DiffTarget::Head, "new" | "file") => ReviewSourceLocation::Worktree,
            (DiffTarget::Compare { base, .. }, "old") => {
                ReviewSourceLocation::Reference(base.as_str())
            }
            (
                DiffTarget::Compare {
                    head: Some(head), ..
                },
                "new",
            ) => ReviewSourceLocation::Reference(head.as_str()),
            (DiffTarget::Compare { head: None, .. }, "new") => ReviewSourceLocation::Worktree,
            (DiffTarget::Compare { .. }, "file") => ReviewSourceLocation::Worktree,
            _ => unreachable!("review side was validated above"),
        };
        let (source_label, bytes) = match source {
            ReviewSourceLocation::Worktree => {
                let full = target.root.join(&path);
                let bounded = tokio::task::spawn_blocking({
                    let max_file_bytes = self.config.max_file_bytes;
                    move || read_bounded_file(&full, max_file_bytes)
                })
                .await
                .map_err(|error| GitError::Io(error.to_string()))??;
                if bounded.truncated {
                    return Err(GitError::OutputLimit);
                }
                ("worktree".to_string(), bounded.data)
            }
            ReviewSourceLocation::Index => {
                let spec = format!(":{path_string}");
                let args = [OsString::from("show"), OsString::from(spec)];
                let output = self.run(target.root(), &args, None).await?;
                if output.truncated {
                    return Err(GitError::OutputLimit);
                }
                if output.code != Some(0) {
                    return Err(command_failed(&args, &output));
                }
                ("index".to_string(), output.stdout)
            }
            ReviewSourceLocation::Reference(reference) => {
                validate_ref(reference)?;
                let spec = format!("{reference}:{path_string}");
                let args = [OsString::from("show"), OsString::from(spec)];
                let output = self.run(target.root(), &args, None).await?;
                if output.truncated {
                    return Err(GitError::OutputLimit);
                }
                if output.code != Some(0) {
                    return Err(command_failed(&args, &output));
                }
                (format!("ref:{reference}"), output.stdout)
            }
        };
        let text = bounded_utf8(&bytes)?;
        let lines = text.lines().map(str::to_string).collect::<Vec<_>>();
        let selector =
            serde_json::to_vec(diff_target).map_err(|error| GitError::Parse(error.to_string()))?;
        let mut revision_input = Vec::with_capacity(
            selector.len() + path_string.len() + side.len() + source_label.len() + bytes.len() + 4,
        );
        revision_input.extend_from_slice(&selector);
        revision_input.push(0);
        revision_input.extend_from_slice(path_string.as_bytes());
        revision_input.push(0);
        revision_input.extend_from_slice(side.as_bytes());
        revision_input.push(0);
        revision_input.extend_from_slice(source_label.as_bytes());
        revision_input.push(0);
        revision_input.extend_from_slice(&bytes);
        Ok(ReviewSource {
            revision: digest(&revision_input),
            lines,
        })
    }

    pub async fn stage_paths(
        &self,
        target: &WorkspaceTarget,
        paths: &[String],
    ) -> Result<GitActionReceipt, GitError> {
        let paths = target.authorize_paths(paths)?;
        let mut args = vec![OsString::from("add"), OsString::from("--")];
        args.extend(paths.iter().map(|path| path.as_os_str().to_os_string()));
        self.run_checked(target.root(), &args, None).await?;
        self.receipt(
            target,
            GitAction::Stage,
            paths.iter().map(PathBuf::from).collect(),
        )
        .await
    }

    pub async fn unstage_paths(
        &self,
        target: &WorkspaceTarget,
        paths: &[String],
    ) -> Result<GitActionReceipt, GitError> {
        let paths = target.authorize_paths(paths)?;
        let mut args = vec![
            OsString::from("restore"),
            OsString::from("--staged"),
            OsString::from("--"),
        ];
        args.extend(paths.iter().map(|path| path.as_os_str().to_os_string()));
        self.run_checked(target.root(), &args, None).await?;
        self.receipt(
            target,
            GitAction::Unstage,
            paths.iter().map(PathBuf::from).collect(),
        )
        .await
    }

    pub async fn stage_patch(
        &self,
        target: &WorkspaceTarget,
        patch: &str,
    ) -> Result<GitActionReceipt, GitError> {
        let paths = validate_patch(target, patch, self.config.max_patch_bytes)?;
        let args = [
            OsString::from("apply"),
            OsString::from("--cached"),
            OsString::from("--whitespace=nowarn"),
            OsString::from("--"),
        ];
        self.run_checked(target.root(), &args, Some(patch.as_bytes()))
            .await?;
        self.receipt(
            target,
            GitAction::Stage,
            paths.iter().map(PathBuf::from).collect(),
        )
        .await
    }

    pub async fn unstage_patch(
        &self,
        target: &WorkspaceTarget,
        patch: &str,
    ) -> Result<GitActionReceipt, GitError> {
        let paths = validate_patch(target, patch, self.config.max_patch_bytes)?;
        let args = [
            OsString::from("apply"),
            OsString::from("--cached"),
            OsString::from("--reverse"),
            OsString::from("--whitespace=nowarn"),
            OsString::from("--"),
        ];
        self.run_checked(target.root(), &args, Some(patch.as_bytes()))
            .await?;
        self.receipt(
            target,
            GitAction::Unstage,
            paths.iter().map(PathBuf::from).collect(),
        )
        .await
    }

    /// Capture the exact status and path set that a destructive operation is
    /// about to show to a user.  The returned preview is inert until its
    /// `confirm()` method is called and passed back to [`Self::discard`].
    pub async fn preview_discard(
        &self,
        target: &WorkspaceTarget,
        mode: DiscardMode,
        paths: &[String],
    ) -> Result<DestructivePreview, GitError> {
        let paths = target.authorize_paths(paths)?;
        let status = self.status(target, StatusOptions::default()).await?;
        let status_fingerprint = self
            .strong_fingerprint(target, &status, &path_strings(&paths))
            .await?;
        Ok(DestructivePreview {
            operation: DestructiveOperation::Discard(mode),
            workspace_id: target.workspace_id.clone(),
            paths: path_strings(&paths),
            status_fingerprint,
            message_digest: None,
            status,
        })
    }

    pub async fn discard(
        &self,
        target: &WorkspaceTarget,
        confirmation: ActionConfirmation,
    ) -> Result<GitActionReceipt, GitError> {
        let (operation, paths) = self.validate_confirmation(target, &confirmation).await?;
        let DestructiveOperation::Discard(mode) = operation else {
            return Err(GitError::ConfirmationMismatch(
                "commit confirmation cannot be used for discard".to_string(),
            ));
        };
        let path_bufs = target.authorize_paths(&paths)?;
        let current = self.status(target, StatusOptions::default()).await?;
        let current_fingerprint = self.strong_fingerprint(target, &current, &paths).await?;
        self.check_confirmation(&confirmation, &current_fingerprint, None)?;
        let tracked: BTreeSet<String> = current
            .entries
            .iter()
            .filter(|entry| !entry.is_untracked() && !entry.is_ignored())
            .map(|entry| entry.path.clone())
            .collect();

        match mode {
            DiscardMode::Worktree => {
                let tracked_paths: Vec<PathBuf> = path_bufs
                    .iter()
                    .filter(|path| tracked.contains(&path.to_string_lossy().to_string()))
                    .cloned()
                    .collect();
                if !tracked_paths.is_empty() {
                    let mut args = vec![
                        OsString::from("restore"),
                        OsString::from("--worktree"),
                        OsString::from("--"),
                    ];
                    args.extend(
                        tracked_paths
                            .iter()
                            .map(|path| path.as_os_str().to_os_string()),
                    );
                    self.run_checked(target.root(), &args, None).await?;
                }
                self.clean_untracked(target, &path_bufs, &current).await?;
            }
            DiscardMode::Staged => {
                let staged_paths: Vec<PathBuf> = path_bufs
                    .iter()
                    .filter(|path| {
                        current
                            .entries
                            .iter()
                            .any(|entry| entry.path == path.to_string_lossy() && entry.staged)
                    })
                    .cloned()
                    .collect();
                if !staged_paths.is_empty() {
                    let mut args = vec![
                        OsString::from("restore"),
                        OsString::from("--staged"),
                        OsString::from("--"),
                    ];
                    args.extend(
                        staged_paths
                            .iter()
                            .map(|path| path.as_os_str().to_os_string()),
                    );
                    self.run_checked(target.root(), &args, None).await?;
                }
            }
            DiscardMode::All => {
                let tracked_paths: Vec<PathBuf> = path_bufs
                    .iter()
                    .filter(|path| tracked.contains(&path.to_string_lossy().to_string()))
                    .cloned()
                    .collect();
                if !tracked_paths.is_empty() {
                    let mut tracked_args = vec![
                        OsString::from("restore"),
                        OsString::from("--source=HEAD"),
                        OsString::from("--staged"),
                        OsString::from("--worktree"),
                        OsString::from("--"),
                    ];
                    tracked_args.extend(
                        tracked_paths
                            .iter()
                            .map(|path| path.as_os_str().to_os_string()),
                    );
                    self.run_checked(target.root(), &tracked_args, None).await?;
                }
                // Keep the untracked cleanup separate: `restore` correctly
                // refuses a path that has never existed in HEAD.
                self.clean_untracked(target, &path_bufs, &current).await?;
            }
        }
        self.receipt(target, GitAction::Discard, path_bufs).await
    }

    pub async fn preview_commit(
        &self,
        target: &WorkspaceTarget,
        message: &str,
    ) -> Result<CommitPreview, GitError> {
        validate_commit_message(message)?;
        let status = self.status(target, StatusOptions::default()).await?;
        let paths: Vec<String> = status
            .entries
            .iter()
            .filter(|entry| entry.staged)
            .map(|entry| entry.path.clone())
            .collect();
        if paths.is_empty() {
            return Err(GitError::NoStagedChanges);
        }
        let status_fingerprint = self.strong_fingerprint(target, &status, &paths).await?;
        Ok(CommitPreview {
            preview: DestructivePreview {
                operation: DestructiveOperation::Commit,
                workspace_id: target.workspace_id.clone(),
                paths,
                status_fingerprint,
                message_digest: Some(digest(message.as_bytes())),
                status: status.clone(),
            },
            message: message.to_string(),
        })
    }

    pub async fn commit(
        &self,
        target: &WorkspaceTarget,
        request: CommitRequest,
    ) -> Result<GitActionReceipt, GitError> {
        validate_commit_message(&request.message)?;
        let (operation, paths) = self
            .validate_confirmation(target, &request.confirmation)
            .await?;
        if operation != DestructiveOperation::Commit {
            return Err(GitError::ConfirmationMismatch(
                "discard confirmation cannot be used for commit".to_string(),
            ));
        }
        let current = self.status(target, StatusOptions::default()).await?;
        let current_fingerprint = self.strong_fingerprint(target, &current, &paths).await?;
        self.check_confirmation(
            &request.confirmation,
            &current_fingerprint,
            Some(&request.message),
        )?;
        let staged: BTreeSet<String> = current
            .entries
            .iter()
            .filter(|entry| entry.staged)
            .map(|entry| entry.path.clone())
            .collect();
        if staged.is_empty() {
            return Err(GitError::NoStagedChanges);
        }
        let confirmed: BTreeSet<String> = paths.into_iter().collect();
        if staged != confirmed {
            return Err(GitError::ConfirmationMismatch(
                "staged paths changed since the preview".to_string(),
            ));
        }
        let args = [
            OsString::from("commit"),
            OsString::from("-m"),
            OsString::from(&request.message),
        ];
        self.run_checked(target.root(), &args, None).await?;
        let commit_id = self
            .optional_text(target, &["rev-parse", "--verify", "HEAD"])
            .await;
        let mut receipt = self
            .receipt(
                target,
                GitAction::Commit,
                confirmed.into_iter().map(PathBuf::from).collect(),
            )
            .await?;
        receipt.commit_id = commit_id;
        Ok(receipt)
    }

    async fn clean_untracked(
        &self,
        target: &WorkspaceTarget,
        paths: &[PathBuf],
        status: &GitStatus,
    ) -> Result<(), GitError> {
        let untracked: Vec<PathBuf> = paths
            .iter()
            .filter(|path| {
                status
                    .entries
                    .iter()
                    .any(|entry| entry.is_untracked() && entry.path == path.to_string_lossy())
            })
            .cloned()
            .collect();
        if untracked.is_empty() {
            return Ok(());
        }
        let mut args = vec![
            OsString::from("clean"),
            OsString::from("-f"),
            OsString::from("--"),
        ];
        args.extend(untracked.iter().map(|path| path.as_os_str().to_os_string()));
        self.run_checked(target.root(), &args, None).await
    }

    async fn receipt(
        &self,
        target: &WorkspaceTarget,
        action: GitAction,
        paths: Vec<PathBuf>,
    ) -> Result<GitActionReceipt, GitError> {
        Ok(GitActionReceipt {
            workspace_id: target.workspace_id.clone(),
            action,
            paths: path_strings(&paths),
            status: self.status(target, StatusOptions::default()).await?,
            commit_id: None,
        })
    }

    /// Compute a strong, bounded token for the exact paths in a destructive
    /// preview/check. Ordinary `status()` deliberately uses only a cheap
    /// porcelain token so sidebar refreshes never hash every dirty file.
    async fn strong_fingerprint(
        &self,
        target: &WorkspaceTarget,
        status: &GitStatus,
        requested_paths: &[String],
    ) -> Result<String, GitError> {
        let paths = target.authorize_paths(requested_paths)?;
        let mut args = vec![
            OsString::from("ls-files"),
            OsString::from("-s"),
            OsString::from("-z"),
            OsString::from("--"),
        ];
        for path in &paths {
            args.push(path.as_os_str().to_os_string());
        }
        let index = self.run(target.root(), &args, None).await?;
        if index.truncated {
            return Err(GitError::OutputLimit);
        }
        if index.code != Some(0) {
            return Err(command_failed(&args, &index));
        }
        let selected = paths
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect::<Vec<_>>();
        let selected_entries = status
            .entries
            .iter()
            .filter(|entry| selected.iter().any(|path| path == &entry.path))
            .cloned()
            .collect::<Vec<_>>();
        let root = target.root.clone();
        let max_file_bytes = self.config.max_file_bytes;
        let branch = status.branch.clone();
        let head = status.head.clone();
        let upstream = status.upstream.clone();
        let ahead = status.ahead;
        let behind = status.behind;
        tokio::task::spawn_blocking(move || {
            strong_worktree_fingerprint(StrongFingerprintInput {
                root: &root,
                paths: &selected,
                entries: &selected_entries,
                index_output: &index.stdout,
                branch: branch.as_deref(),
                head: head.as_deref(),
                upstream: upstream.as_deref(),
                ahead,
                behind,
                max_file_bytes,
                max_total_bytes: DEFAULT_MAX_FINGERPRINT_BYTES,
            })
        })
        .await
        .map_err(|error| GitError::Io(error.to_string()))?
    }

    async fn validate_confirmation(
        &self,
        target: &WorkspaceTarget,
        confirmation: &ActionConfirmation,
    ) -> Result<(DestructiveOperation, Vec<String>), GitError> {
        if !confirmation.confirmed {
            return Err(GitError::ConfirmationRequired);
        }
        if confirmation.workspace_id != target.workspace_id {
            return Err(GitError::ConfirmationMismatch(
                "workspace identity does not match".to_string(),
            ));
        }
        let paths = target.authorize_paths(
            &confirmation
                .paths
                .iter()
                .map(String::clone)
                .collect::<Vec<_>>(),
        )?;
        let strings = path_strings(&paths);
        if strings != confirmation.paths {
            return Err(GitError::ConfirmationMismatch(
                "path set is not canonical".to_string(),
            ));
        }
        Ok((confirmation.operation, strings))
    }

    fn check_confirmation(
        &self,
        confirmation: &ActionConfirmation,
        status_fingerprint: &str,
        message: Option<&str>,
    ) -> Result<(), GitError> {
        if confirmation.status_fingerprint != status_fingerprint {
            return Err(GitError::ConfirmationMismatch(
                "workspace status changed since the preview".to_string(),
            ));
        }
        if let Some(message) = message {
            if confirmation.message_digest.as_deref() != Some(digest(message.as_bytes()).as_str()) {
                return Err(GitError::ConfirmationMismatch(
                    "commit message changed since the preview".to_string(),
                ));
            }
        }
        Ok(())
    }

    async fn optional_text(&self, target: &WorkspaceTarget, args: &[&str]) -> Option<String> {
        let args: Vec<OsString> = args.iter().map(OsString::from).collect();
        let output = self.run(target.root(), &args, None).await.ok()?;
        if output.code != Some(0) || output.truncated {
            return None;
        }
        let text = bounded_utf8(&output.stdout).ok()?;
        let text = text.trim().to_string();
        (!text.is_empty()).then_some(text)
    }

    async fn run_checked(
        &self,
        cwd: &Path,
        args: &[OsString],
        input: Option<&[u8]>,
    ) -> Result<(), GitError> {
        let output = self.run(cwd, args, input).await?;
        if output.truncated {
            return Err(GitError::OutputLimit);
        }
        if output.code != Some(0) {
            return Err(GitError::CommandFailed {
                args: display_args(args),
                code: output.code,
                stderr: bounded_utf8(&output.stderr)
                    .unwrap_or_else(|_| "non-UTF8 stderr".to_string()),
            });
        }
        Ok(())
    }

    async fn run(
        &self,
        cwd: &Path,
        args: &[OsString],
        input: Option<&[u8]>,
    ) -> Result<GitOutput, GitError> {
        if input.is_some_and(|bytes| bytes.len() > self.config.max_patch_bytes) {
            return Err(GitError::OutputLimit);
        }
        let mut command = Command::new(&self.git_binary);
        command
            .current_dir(cwd)
            .arg("--literal-pathspecs")
            .args(args)
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("GIT_OPTIONAL_LOCKS", "0")
            .env("GIT_LITERAL_PATHSPECS", "1")
            .env("LC_ALL", "C")
            .stdin(if input.is_some() {
                Stdio::piped()
            } else {
                Stdio::null()
            })
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        // Git may invoke a hook, filter, credential helper, or another
        // helper process.  A timeout must terminate that whole tree rather
        // than only the direct `git` child, otherwise inherited stdout/stderr
        // pipes can stay open indefinitely after the caller has given up.
        #[cfg(unix)]
        command.process_group(0);
        let mut child = command.spawn().map_err(GitError::from)?;
        let child_pid = child.id();
        let mut cleanup = ProcessCleanup::new(child_pid);
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| GitError::Io("git stdout was not piped".to_string()))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| GitError::Io("git stderr was not piped".to_string()))?;
        let max = self.config.max_output_bytes;
        let mut stdout_task = tokio::spawn(read_bounded(stdout, max));
        let mut stderr_task = tokio::spawn(read_bounded(stderr, max));
        let stdout_abort = stdout_task.abort_handle();
        let stderr_abort = stderr_task.abort_handle();
        cleanup.add_reader(stdout_abort.clone());
        cleanup.add_reader(stderr_abort.clone());

        // Keep the process future borrowing the child so the timeout branch
        // can kill and reap it explicitly.  The reader tasks are spawned only
        // so stdout and stderr drain concurrently; their abort handles stay
        // outside the future because dropping a JoinHandle merely detaches
        // its task.
        let mut process = Box::pin(async {
            let input_error = if let Some(input) = input {
                match child.stdin.take() {
                    Some(mut stdin) => stdin.write_all(input).await.err(),
                    None => Some(io::Error::new(
                        io::ErrorKind::BrokenPipe,
                        "git stdin was not piped",
                    )),
                }
            } else {
                None
            };
            if input_error.is_some() {
                terminate_process_group(child_pid);
                let _ = child.start_kill();
            }
            let status = child.wait().await.map_err(GitError::from);
            let stdout = (&mut stdout_task)
                .await
                .map_err(|error| GitError::Io(error.to_string()))
                .and_then(|result| result.map_err(GitError::from));
            let stderr = (&mut stderr_task)
                .await
                .map_err(|error| GitError::Io(error.to_string()))
                .and_then(|result| result.map_err(GitError::from));
            stdout_abort.abort();
            stderr_abort.abort();

            if let Some(error) = input_error {
                return Err(GitError::from(error));
            }
            let status = status?;
            let (stdout, stdout_truncated) = stdout?;
            let (stderr, stderr_truncated) = stderr?;
            Ok(GitOutput {
                stdout,
                stderr,
                truncated: stdout_truncated || stderr_truncated,
                code: status.code(),
            })
        });

        let result = tokio::select! {
            result = &mut process => result,
            _ = tokio::time::sleep(self.config.timeout) => {
                // Cancel both pipe readers before releasing the future. This
                // closes their handles even when a descendant inherited the
                // pipes, while the process-group kill below closes the other
                // end and prevents a leaked helper from lingering.
                cleanup.abort_readers();
                drop(process);
                terminate_process_group(child_pid);
                let _ = child.start_kill();
                let _ = child.wait().await;
                let _ = stdout_task.await;
                let _ = stderr_task.await;
                Err(GitError::TimedOut)
            }
        };
        cleanup.disarm();
        result
    }
}

/// Whether ignored entries should be included in a status response.
#[derive(Debug, Clone, Copy, Default)]
pub struct StatusOptions {
    pub include_ignored: bool,
}

/// A complete status snapshot for one workspace.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub workspace_id: String,
    pub root: String,
    pub branch: Option<String>,
    pub head: Option<String>,
    pub upstream: Option<String>,
    pub ahead: Option<u32>,
    pub behind: Option<u32>,
    pub entries: Vec<StatusEntry>,
    /// Index object ids plus bounded worktree content/metadata. Kept private
    /// because it is an approval token rather than a wire/display field.
    #[serde(skip)]
    observed_fingerprint: String,
}

impl GitStatus {
    pub fn dirty(&self) -> bool {
        !self.entries.is_empty()
    }

    pub fn conflicted(&self) -> bool {
        self.entries.iter().any(StatusEntry::is_conflicted)
    }

    pub fn staged_paths(&self) -> Vec<String> {
        self.entries
            .iter()
            .filter(|entry| entry.staged)
            .map(|entry| entry.path.clone())
            .collect()
    }
}

/// One porcelain status record, with index and worktree states kept separate.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StatusEntry {
    pub path: String,
    pub original_path: Option<String>,
    pub index: FileState,
    pub worktree: FileState,
    pub staged: bool,
    pub unstaged: bool,
}

impl StatusEntry {
    pub fn is_untracked(&self) -> bool {
        self.index == FileState::Untracked && self.worktree == FileState::Untracked
    }

    pub fn is_ignored(&self) -> bool {
        self.index == FileState::Ignored && self.worktree == FileState::Ignored
    }

    pub fn is_conflicted(&self) -> bool {
        self.index == FileState::Conflicted || self.worktree == FileState::Conflicted
    }

    pub fn is_renamed(&self) -> bool {
        self.index == FileState::Renamed || self.worktree == FileState::Renamed
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FileState {
    Unmodified,
    Modified,
    Added,
    Deleted,
    Renamed,
    Copied,
    TypeChanged,
    Untracked,
    Ignored,
    Conflicted,
    Unknown(char),
}

/// A local or remote branch ref discovered by `for-each-ref`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BranchRef {
    pub name: String,
    pub target: String,
    pub upstream: Option<String>,
    pub remote: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DiffTarget {
    WorkingTree,
    Staged,
    Head,
    Compare {
        base: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        head: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffOptions {
    pub target: DiffTarget,
    pub include_untracked: bool,
    pub ignore_whitespace: bool,
    pub context_lines: u32,
    pub path: Option<String>,
}

impl Default for DiffOptions {
    fn default() -> Self {
        Self {
            target: DiffTarget::WorkingTree,
            include_untracked: true,
            ignore_whitespace: false,
            context_lines: 3,
            path: None,
        }
    }
}

/// Bounded source text and the server-issued revision used to anchor a review
/// comment. The revision covers the selected target, path, side, and complete
/// file bytes, so a caller cannot reuse a token for a different source.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReviewSource {
    pub revision: String,
    pub lines: Vec<String>,
}

enum ReviewSourceLocation<'a> {
    Worktree,
    Index,
    Reference(&'a str),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitDiff {
    pub workspace_id: String,
    pub target: DiffTarget,
    pub files: Vec<DiffFile>,
    pub hunk_count: usize,
    pub truncated: bool,
}

impl GitDiff {
    pub fn is_empty(&self) -> bool {
        self.files.is_empty()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiffFile {
    pub old_path: Option<String>,
    pub new_path: Option<String>,
    pub status: DiffFileStatus,
    pub hunks: Vec<DiffHunk>,
    pub is_binary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DiffFileStatus {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    TypeChanged,
    Binary,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunk {
    pub old_start: u32,
    pub old_count: u32,
    pub new_start: u32,
    pub new_count: u32,
    pub header: String,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub kind: DiffLineKind,
    pub content: String,
    pub old_line: Option<u32>,
    pub new_line: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DiffLineKind {
    Context,
    Addition,
    Deletion,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DiscardMode {
    Worktree,
    Staged,
    All,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DestructiveOperation {
    Discard(DiscardMode),
    Commit,
}

/// A user approval bound to the target workspace, exact canonical paths, the
/// observed status fingerprint, and (for commits) the exact message.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActionConfirmation {
    workspace_id: String,
    operation: DestructiveOperation,
    paths: Vec<String>,
    status_fingerprint: String,
    message_digest: Option<String>,
    confirmed: bool,
}

impl ActionConfirmation {
    /// Reconstruct a confirmation only after the server has authenticated a
    /// persisted opaque preview receipt. This stays crate-private so callers
    /// cannot manufacture an approval from a client boolean.
    pub(crate) fn from_verified_parts(
        workspace_id: String,
        operation: DestructiveOperation,
        paths: Vec<String>,
        status_fingerprint: String,
        message_digest: Option<String>,
    ) -> Self {
        Self {
            workspace_id,
            operation,
            paths,
            status_fingerprint,
            message_digest,
            confirmed: true,
        }
    }

    pub fn workspace_id(&self) -> &str {
        &self.workspace_id
    }

    pub fn operation(&self) -> DestructiveOperation {
        self.operation
    }

    pub fn paths(&self) -> &[String] {
        &self.paths
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DestructivePreview {
    pub operation: DestructiveOperation,
    pub workspace_id: String,
    pub paths: Vec<String>,
    pub status_fingerprint: String,
    pub message_digest: Option<String>,
    pub status: GitStatus,
}

impl DestructivePreview {
    pub fn confirm(&self) -> ActionConfirmation {
        ActionConfirmation {
            workspace_id: self.workspace_id.clone(),
            operation: self.operation,
            paths: self.paths.clone(),
            status_fingerprint: self.status_fingerprint.clone(),
            message_digest: self.message_digest.clone(),
            confirmed: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CommitPreview {
    pub preview: DestructivePreview,
    pub message: String,
}

impl CommitPreview {
    pub fn confirm(&self) -> ActionConfirmation {
        self.preview.confirm()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CommitRequest {
    pub message: String,
    pub confirmation: ActionConfirmation,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum GitAction {
    Stage,
    Unstage,
    Discard,
    Commit,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitActionReceipt {
    pub workspace_id: String,
    pub action: GitAction,
    pub paths: Vec<String>,
    pub status: GitStatus,
    pub commit_id: Option<String>,
}

#[derive(Debug)]
struct GitOutput {
    stdout: Vec<u8>,
    stderr: Vec<u8>,
    truncated: bool,
    code: Option<i32>,
}

/// Cancellation cleanup for a running Git command. Tokio's `Child` can kill
/// the direct process on drop, but it cannot cancel spawned pipe readers or
/// descendants that inherited those pipes. Keep those operations in a small
/// synchronous drop guard so cancellation from a disconnected caller is as
/// safe as the explicit timeout path.
struct ProcessCleanup {
    pid: Option<u32>,
    reader_aborts: Vec<tokio::task::AbortHandle>,
}

impl ProcessCleanup {
    fn new(pid: Option<u32>) -> Self {
        Self {
            pid,
            reader_aborts: Vec::new(),
        }
    }

    fn add_reader(&mut self, abort: tokio::task::AbortHandle) {
        self.reader_aborts.push(abort);
    }

    fn abort_readers(&self) {
        for abort in &self.reader_aborts {
            abort.abort();
        }
    }

    fn disarm(&mut self) {
        self.pid = None;
        self.reader_aborts.clear();
    }
}

impl Drop for ProcessCleanup {
    fn drop(&mut self) {
        self.abort_readers();
        terminate_process_group(self.pid);
    }
}

async fn read_bounded<R: AsyncRead + Unpin>(
    mut reader: R,
    limit: usize,
) -> Result<(Vec<u8>, bool), io::Error> {
    let mut retained = Vec::with_capacity(limit.min(8192));
    let mut buffer = [0u8; 8192];
    let mut truncated = false;
    loop {
        let read = reader.read(&mut buffer).await?;
        if read == 0 {
            break;
        }
        if retained.len() < limit {
            let keep = (limit - retained.len()).min(read);
            retained.extend_from_slice(&buffer[..keep]);
            if keep < read {
                truncated = true;
            }
        } else {
            truncated = true;
        }
    }
    Ok((retained, truncated))
}

fn terminate_process_group(pid: Option<u32>) {
    #[cfg(unix)]
    if let Some(pid) = pid.filter(|pid| *pid > 0 && *pid <= i32::MAX as u32) {
        // `process_group(0)` gives the direct child a private process group;
        // a negative PID targets that group, including Git hooks and helpers.
        // The child handle is still killed/reaped by the caller afterward.
        unsafe {
            libc::kill(-(pid as libc::pid_t), libc::SIGKILL);
        }
    }
    #[cfg(not(unix))]
    let _ = pid;
}

fn parse_status_porcelain_z(raw: &[u8]) -> Result<Vec<StatusEntry>, GitError> {
    let records: Vec<&[u8]> = raw
        .split(|byte| *byte == 0)
        .filter(|record| !record.is_empty())
        .collect();
    let mut entries = Vec::new();
    let mut index = 0;
    while index < records.len() {
        let record = records[index];
        if record.len() < 3 || record[2] != b' ' {
            return Err(GitError::Parse(
                "malformed porcelain status record".to_string(),
            ));
        }
        let x = record[0] as char;
        let y = record[1] as char;
        let mut path = String::from_utf8_lossy(&record[3..]).into_owned();
        let mut original_path = None;
        if matches!(x, 'R' | 'C') && index + 1 < records.len() {
            let next = records[index + 1];
            if next.len() < 3 || next[2] != b' ' {
                original_path = Some(path);
                path = String::from_utf8_lossy(next).into_owned();
                index += 1;
            }
        }
        let index_state = file_state(x, true);
        let worktree_state = file_state(y, false);
        entries.push(StatusEntry {
            path,
            original_path,
            staged: !matches!(x, ' ' | '?' | '!'),
            unstaged: !matches!(y, ' ' | '?' | '!'),
            index: index_state,
            worktree: worktree_state,
        });
        index += 1;
    }
    entries.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(entries)
}

fn file_state(code: char, index: bool) -> FileState {
    match code {
        ' ' => FileState::Unmodified,
        'M' => FileState::Modified,
        'A' => FileState::Added,
        'D' => FileState::Deleted,
        'R' => FileState::Renamed,
        'C' => FileState::Copied,
        'T' => FileState::TypeChanged,
        '?' => FileState::Untracked,
        '!' => FileState::Ignored,
        'U' => FileState::Conflicted,
        _ if !index => FileState::Unknown(code),
        _ => FileState::Unknown(code),
    }
}

/// Parse Git's bounded unified diff output into line-numbered files/hunks.
pub fn parse_unified_diff(raw: &[u8]) -> Result<Vec<DiffFile>, GitError> {
    let text = bounded_utf8(raw)?;
    let mut files: Vec<DiffFile> = Vec::new();
    let mut current: Option<DiffFile> = None;
    let mut current_hunk: Option<DiffHunk> = None;
    let mut old_line = 0u32;
    let mut new_line = 0u32;

    let finish_hunk = |file: &mut Option<DiffFile>, hunk: &mut Option<DiffHunk>| {
        if let (Some(file), Some(hunk)) = (file.as_mut(), hunk.take()) {
            file.hunks.push(hunk);
        }
    };
    let finish_file =
        |files: &mut Vec<DiffFile>, file: &mut Option<DiffFile>, hunk: &mut Option<DiffHunk>| {
            finish_hunk(file, hunk);
            if let Some(file) = file.take() {
                files.push(file);
            }
        };

    for raw_line in text.split_inclusive('\n') {
        let line = raw_line.trim_end_matches(['\n', '\r']);
        if line.starts_with("diff --git ") {
            finish_file(&mut files, &mut current, &mut current_hunk);
            let (old_path, new_path) = parse_diff_git_header(line)?;
            current = Some(DiffFile {
                old_path,
                new_path,
                status: DiffFileStatus::Modified,
                hunks: Vec::new(),
                is_binary: false,
            });
            continue;
        }
        if current.is_none() {
            continue;
        }
        if let Some(path) = line.strip_prefix("--- ") {
            if let Some(file) = current.as_mut() {
                file.old_path = parse_file_header_path(path, "a/");
            }
            continue;
        }
        if let Some(path) = line.strip_prefix("+++ ") {
            if let Some(file) = current.as_mut() {
                file.new_path = parse_file_header_path(path, "b/");
            }
            continue;
        }
        if line.starts_with("similarity index") {
            if let Some(file) = current.as_mut() {
                file.status = DiffFileStatus::Renamed;
            }
            continue;
        }
        if line.starts_with("copy from") || line.starts_with("copy to") {
            if let Some(file) = current.as_mut() {
                file.status = DiffFileStatus::Copied;
            }
            continue;
        }
        if line.starts_with("new file mode") {
            if let Some(file) = current.as_mut() {
                file.status = DiffFileStatus::Added;
            }
            continue;
        }
        if line.starts_with("deleted file mode") {
            if let Some(file) = current.as_mut() {
                file.status = DiffFileStatus::Deleted;
            }
            continue;
        }
        if line.starts_with("old mode") || line.starts_with("new mode") {
            if let Some(file) = current.as_mut() {
                file.status = DiffFileStatus::TypeChanged;
            }
            continue;
        }
        if line.starts_with("Binary files ") || line.starts_with("GIT binary patch") {
            finish_hunk(&mut current, &mut current_hunk);
            if let Some(file) = current.as_mut() {
                file.is_binary = true;
                file.status = DiffFileStatus::Binary;
            }
            continue;
        }
        if line.starts_with("@@ ") {
            finish_hunk(&mut current, &mut current_hunk);
            let (old_start, old_count, new_start, new_count) = parse_hunk_header(line)?;
            old_line = old_start;
            new_line = new_start;
            current_hunk = Some(DiffHunk {
                old_start,
                old_count,
                new_start,
                new_count,
                header: line.to_string(),
                lines: Vec::new(),
            });
            continue;
        }
        if let Some(hunk) = current_hunk.as_mut() {
            let (kind, content) = match line.as_bytes().first().copied() {
                Some(b' ') => (DiffLineKind::Context, line[1..].to_string()),
                Some(b'+') => (DiffLineKind::Addition, line[1..].to_string()),
                Some(b'-') => (DiffLineKind::Deletion, line[1..].to_string()),
                Some(b'\\') => continue,
                _ => continue,
            };
            let (old_number, new_number) = match kind {
                DiffLineKind::Context => {
                    let numbers = (Some(old_line), Some(new_line));
                    old_line = old_line.saturating_add(1);
                    new_line = new_line.saturating_add(1);
                    numbers
                }
                DiffLineKind::Addition => {
                    let number = Some(new_line);
                    new_line = new_line.saturating_add(1);
                    (None, number)
                }
                DiffLineKind::Deletion => {
                    let number = Some(old_line);
                    old_line = old_line.saturating_add(1);
                    (number, None)
                }
            };
            hunk.lines.push(DiffLine {
                kind,
                content,
                old_line: old_number,
                new_line: new_number,
            });
        }
    }
    finish_file(&mut files, &mut current, &mut current_hunk);
    for file in &mut files {
        if file.status == DiffFileStatus::Modified {
            file.status = match (&file.old_path, &file.new_path) {
                (None, Some(_)) => DiffFileStatus::Added,
                (Some(_), None) => DiffFileStatus::Deleted,
                _ => DiffFileStatus::Modified,
            };
        }
    }
    Ok(files)
}

fn parse_diff_git_header(line: &str) -> Result<(Option<String>, Option<String>), GitError> {
    let rest = line.strip_prefix("diff --git ").unwrap_or_default();
    let mut fields = rest.split_whitespace();
    let old = fields
        .next()
        .ok_or_else(|| GitError::Parse("diff header has no old path".to_string()))?;
    let new = fields
        .next()
        .ok_or_else(|| GitError::Parse("diff header has no new path".to_string()))?;
    Ok((
        parse_file_header_path(old, "a/"),
        parse_file_header_path(new, "b/"),
    ))
}

fn parse_file_header_path(raw: &str, prefix: &str) -> Option<String> {
    let path = unquote_git_path(raw.trim());
    if path == "/dev/null" {
        None
    } else {
        Some(path.strip_prefix(prefix).unwrap_or(&path).to_string())
    }
}

fn parse_hunk_header(line: &str) -> Result<(u32, u32, u32, u32), GitError> {
    let mut fields = line.split_whitespace();
    let _at = fields.next();
    let old = fields
        .next()
        .ok_or_else(|| GitError::Parse("hunk has no old range".to_string()))?;
    let new = fields
        .next()
        .ok_or_else(|| GitError::Parse("hunk has no new range".to_string()))?;
    let (old_start, old_count) = parse_range(old, '-')?;
    let (new_start, new_count) = parse_range(new, '+')?;
    Ok((old_start, old_count, new_start, new_count))
}

fn parse_range(value: &str, marker: char) -> Result<(u32, u32), GitError> {
    let value = value
        .strip_prefix(marker)
        .ok_or_else(|| GitError::Parse(format!("range {value} has wrong marker")))?;
    let mut fields = value.splitn(2, ',');
    let start = fields
        .next()
        .and_then(|v| v.parse().ok())
        .ok_or_else(|| GitError::Parse(format!("invalid range {value}")))?;
    let count = fields.next().and_then(|v| v.parse().ok()).unwrap_or(1);
    Ok((start, count))
}

fn synthetic_untracked_diff(
    target: &WorkspaceTarget,
    path: &str,
    max_file_bytes: usize,
    _context_lines: u32,
) -> Result<Option<DiffFile>, GitError> {
    let relative = target.authorize_path(path)?;
    let full = target.root.join(&relative);
    let bytes = read_bounded_file(&full, max_file_bytes)?;
    if bytes.truncated {
        return Ok(Some(DiffFile {
            old_path: None,
            new_path: Some(path.to_string()),
            status: DiffFileStatus::Binary,
            hunks: Vec::new(),
            is_binary: true,
        }));
    }
    if bytes.data.contains(&0) || std::str::from_utf8(&bytes.data).is_err() {
        return Ok(Some(DiffFile {
            old_path: None,
            new_path: Some(path.to_string()),
            status: DiffFileStatus::Binary,
            hunks: Vec::new(),
            is_binary: true,
        }));
    }
    let text = String::from_utf8(bytes.data).map_err(|error| GitError::Io(error.to_string()))?;
    let mut lines = Vec::new();
    for line in text.split_inclusive('\n') {
        lines.push(line.trim_end_matches(['\n', '\r']).to_string());
    }
    if text.is_empty() {
        lines.clear();
    }
    let hunk = if lines.is_empty() {
        Vec::new()
    } else {
        vec![DiffHunk {
            old_start: 0,
            old_count: 0,
            new_start: 1,
            new_count: lines.len() as u32,
            header: format!("@@ -0,0 +1,{} @@", lines.len()),
            lines: lines
                .into_iter()
                .enumerate()
                .map(|(index, content)| DiffLine {
                    kind: DiffLineKind::Addition,
                    content,
                    old_line: None,
                    new_line: Some(index as u32 + 1),
                })
                .collect(),
        }]
    };
    Ok(Some(DiffFile {
        old_path: None,
        new_path: Some(path.to_string()),
        status: DiffFileStatus::Added,
        hunks: hunk,
        is_binary: false,
    }))
}

struct BoundedFile {
    data: Vec<u8>,
    truncated: bool,
}

fn read_bounded_file(path: &Path, limit: usize) -> Result<BoundedFile, GitError> {
    let canonical =
        fs::canonicalize(path).map_err(|error| GitError::InvalidPath(error.to_string()))?;
    let mut file = fs::File::open(&canonical)?;
    let mut bytes = Vec::with_capacity(limit.min(8192));
    file.by_ref()
        .take(limit.saturating_add(1) as u64)
        .read_to_end(&mut bytes)?;
    let truncated = bytes.len() > limit;
    if truncated {
        bytes.truncate(limit);
    }
    Ok(BoundedFile {
        data: bytes,
        truncated,
    })
}

fn status_fingerprint(
    entries: &[StatusEntry],
    branch: Option<&str>,
    head: Option<&str>,
    upstream: Option<&str>,
    ahead: Option<u32>,
    behind: Option<u32>,
) -> String {
    let mut text = format!(
        "{}\n{}\n{}\n{:?}\n{:?}\n",
        branch.unwrap_or_default(),
        head.unwrap_or_default(),
        upstream.unwrap_or_default(),
        ahead,
        behind
    );
    for entry in entries {
        text.push_str(&format!(
            "{}\0{:?}\0{:?}\0{}\0{}\n",
            entry.path, entry.index, entry.worktree, entry.staged, entry.unstaged
        ));
        if let Some(original) = &entry.original_path {
            text.push_str(original);
        }
        text.push('\n');
    }
    digest(text.as_bytes())
}

struct StrongFingerprintInput<'a> {
    root: &'a Path,
    paths: &'a [String],
    entries: &'a [StatusEntry],
    index_output: &'a [u8],
    branch: Option<&'a str>,
    head: Option<&'a str>,
    upstream: Option<&'a str>,
    ahead: Option<u32>,
    behind: Option<u32>,
    max_file_bytes: usize,
    max_total_bytes: usize,
}

fn strong_worktree_fingerprint(input: StrongFingerprintInput<'_>) -> Result<String, GitError> {
    let StrongFingerprintInput {
        root,
        paths,
        entries,
        index_output,
        branch,
        head,
        upstream,
        ahead,
        behind,
        max_file_bytes,
        max_total_bytes,
    } = input;
    let mut token = format!(
        "branch={};head={};upstream={};ahead={:?};behind={:?};index={}",
        branch.unwrap_or_default(),
        head.unwrap_or_default(),
        upstream.unwrap_or_default(),
        ahead,
        behind,
        digest(index_output)
    );
    let mut remaining = max_total_bytes;
    for path in paths {
        token.push_str("\npath=");
        token.push_str(path);
        if let Some(entry) = entries.iter().find(|entry| entry.path == *path) {
            token.push_str(&format!(
                ";index={:?};worktree={:?};",
                entry.index, entry.worktree
            ));
        }
        let full = root.join(path);
        match fs::symlink_metadata(&full) {
            Ok(metadata) => {
                let canonical = fs::canonicalize(&full)
                    .map_err(|error| GitError::InvalidPath(error.to_string()))?;
                if !canonical.starts_with(root) {
                    return Err(GitError::InvalidPath(
                        "path escapes the workspace".to_string(),
                    ));
                }
                let modified = metadata
                    .modified()
                    .ok()
                    .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|duration| duration.as_nanos())
                    .unwrap_or_default();
                token.push_str(&format!("len={};mtime={};", metadata.len(), modified));
                if metadata.is_file() {
                    let allowed = max_file_bytes.min(remaining);
                    let content = read_bounded_file(&full, allowed)?;
                    // A destructive confirmation must prove the full file
                    // version. If the bounded budget cannot cover it, refuse
                    // the preview instead of pretending a prefix is proof.
                    if content.truncated {
                        return Err(GitError::OutputLimit);
                    }
                    remaining = remaining.saturating_sub(content.data.len());
                    token.push_str(&format!("content={};", digest(&content.data)));
                }
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                token.push_str("missing=true;")
            }
            Err(error) => return Err(GitError::Io(error.to_string())),
        }
    }
    Ok(digest(token.as_bytes()))
}

fn validate_patch(
    target: &WorkspaceTarget,
    patch: &str,
    max_bytes: usize,
) -> Result<Vec<String>, GitError> {
    if patch.is_empty() || patch.len() > max_bytes || patch.contains('\0') {
        return Err(GitError::InvalidPatch(
            "empty, NUL, or oversized patch".to_string(),
        ));
    }
    let mut paths = BTreeSet::new();
    for line in patch.lines() {
        let raw = if let Some(path) = line.strip_prefix("+++ ") {
            path
        } else if let Some(path) = line.strip_prefix("--- ") {
            path
        } else {
            continue;
        };
        if raw == "/dev/null" {
            continue;
        }
        let raw = raw.split_once('\t').map(|(path, _)| path).unwrap_or(raw);
        let path = raw
            .strip_prefix("a/")
            .or_else(|| raw.strip_prefix("b/"))
            .unwrap_or(raw);
        paths.insert(
            target
                .authorize_path(&unquote_git_path(path))?
                .to_string_lossy()
                .to_string(),
        );
    }
    if paths.is_empty() {
        return Err(GitError::InvalidPatch(
            "patch contains no authorized file paths".to_string(),
        ));
    }
    Ok(paths.into_iter().collect())
}

fn validate_ref(reference: &str) -> Result<(), GitError> {
    if reference.is_empty()
        || reference.len() > MAX_PATH_BYTES
        || reference.starts_with('-')
        || reference.contains('\0')
        || reference
            .chars()
            .any(|ch| ch.is_ascii_control() || ch.is_whitespace())
        || reference.contains("..")
        || reference.contains("@{")
    {
        return Err(GitError::InvalidRef(reference.to_string()));
    }
    Ok(())
}

fn validate_commit_message(message: &str) -> Result<(), GitError> {
    if message.trim().is_empty() || message.len() > 64 * 1024 || message.contains('\0') {
        return Err(GitError::InvalidPatch(
            "commit message is empty, NUL, or oversized".to_string(),
        ));
    }
    Ok(())
}

fn unquote_git_path(path: &str) -> String {
    let path = path.trim();
    if !(path.starts_with('"') && path.ends_with('"') && path.len() >= 2) {
        return path.to_string();
    }
    let inner = &path[1..path.len() - 1];
    let mut output = String::new();
    let bytes = inner.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] != b'\\' {
            output.push(bytes[index] as char);
            index += 1;
            continue;
        }
        index += 1;
        if index >= bytes.len() {
            break;
        }
        match bytes[index] {
            b'n' => output.push('\n'),
            b't' => output.push('\t'),
            b'r' => output.push('\r'),
            b'\\' => output.push('\\'),
            b'"' => output.push('"'),
            digit @ b'0'..=b'7' => {
                let mut value = digit - b'0';
                let mut count = 1;
                while count < 3
                    && index + 1 < bytes.len()
                    && (b'0'..=b'7').contains(&bytes[index + 1])
                {
                    index += 1;
                    value = value.saturating_mul(8).saturating_add(bytes[index] - b'0');
                    count += 1;
                }
                output.push(value as char);
            }
            other => output.push(other as char),
        }
        index += 1;
    }
    output
}

fn bounded_utf8(bytes: &[u8]) -> Result<String, GitError> {
    String::from_utf8(bytes.to_vec())
        .map_err(|_| GitError::Parse("Git output is not UTF-8".to_string()))
}

fn display_args(args: &[OsString]) -> Vec<String> {
    args.iter()
        .map(|arg| arg.to_string_lossy().into_owned())
        .collect()
}

fn command_failed(args: &[OsString], output: &GitOutput) -> GitError {
    GitError::CommandFailed {
        args: display_args(args),
        code: output.code,
        stderr: bounded_utf8(&output.stderr).unwrap_or_else(|_| "non-UTF8 stderr".to_string()),
    }
}

fn path_strings(paths: &[PathBuf]) -> Vec<String> {
    paths
        .iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect()
}

fn digest(bytes: &[u8]) -> String {
    let hash = Sha256::digest(bytes);
    hash.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command as StdCommand;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_repo(name: &str) -> PathBuf {
        let path = temp_dir(name);
        git(&path, &["init", "-q"]);
        git(&path, &["config", "user.email", "perch@example.invalid"]);
        git(&path, &["config", "user.name", "Perch Test"]);
        path
    }

    fn temp_dir(name: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("perch-{name}-{stamp}"));
        fs::create_dir_all(&path).expect("temp repo dir");
        path
    }

    fn git(cwd: &Path, args: &[&str]) -> String {
        let output = StdCommand::new("git")
            .current_dir(cwd)
            .args(args)
            .output()
            .expect("git executable");
        assert!(
            output.status.success(),
            "git {:?}: {}",
            args,
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    }

    fn target(root: &Path) -> WorkspaceTarget {
        WorkspaceTarget::new("workspace-test", root).expect("target")
    }

    #[test]
    fn porcelain_parser_preserves_staged_unstaged_rename_conflict_and_untracked() {
        let raw = b"M  staged.txt\0 M work.txt\0R  old.txt\0new.txt\0UU conflict.txt\0?? new.txt\0";
        let entries = parse_status_porcelain_z(raw).expect("status parse");
        assert_eq!(entries.len(), 5);
        let staged = entries
            .iter()
            .find(|entry| entry.path == "staged.txt")
            .unwrap();
        assert!(staged.staged && !staged.unstaged);
        let renamed = entries
            .iter()
            .find(|entry| entry.path == "new.txt" && entry.original_path.is_some())
            .unwrap();
        assert!(renamed.is_renamed());
        assert!(entries.iter().any(StatusEntry::is_conflicted));
        assert!(entries.iter().any(StatusEntry::is_untracked));
    }

    #[test]
    fn unified_parser_assigns_both_side_line_numbers_and_hunks() {
        let raw = b"diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -2,2 +2,3 @@ context\n old\n+added\n changed\n";
        let files = parse_unified_diff(raw).expect("diff parse");
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].hunks.len(), 1);
        let lines = &files[0].hunks[0].lines;
        assert_eq!((lines[0].old_line, lines[0].new_line), (Some(2), Some(2)));
        assert_eq!((lines[1].old_line, lines[1].new_line), (None, Some(3)));
        assert_eq!((lines[2].old_line, lines[2].new_line), (Some(3), Some(4)));
    }

    #[tokio::test]
    async fn status_and_diff_include_untracked_and_branch_metadata() {
        let root = temp_repo("status");
        fs::write(root.join("tracked.txt"), "one\ntwo\n").unwrap();
        git(&root, &["add", "tracked.txt"]);
        git(&root, &["commit", "-qm", "base"]);
        fs::write(root.join("tracked.txt"), "one\nchanged\n").unwrap();
        fs::write(root.join("untracked.txt"), "new\n").unwrap();
        let service = GitService::default();
        let target = target(&root);
        let status = service
            .status(&target, StatusOptions::default())
            .await
            .unwrap();
        assert!(matches!(
            status.branch.as_deref(),
            Some("master") | Some("main")
        ));
        assert!(status
            .entries
            .iter()
            .any(|entry| entry.path == "tracked.txt" && entry.unstaged));
        assert!(status.entries.iter().any(StatusEntry::is_untracked));
        let diff = service.diff(&target, DiffOptions::default()).await.unwrap();
        assert_eq!(diff.workspace_id, "workspace-test");
        assert!(diff
            .files
            .iter()
            .any(|file| file.new_path.as_deref() == Some("untracked.txt")));
        assert!(diff.hunk_count >= 1);
        let _ = fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn review_source_reads_the_visible_index_worktree_and_compare_sides() {
        let root = temp_repo("review-source");
        fs::write(root.join("file.txt"), "head\n").unwrap();
        git(&root, &["add", "file.txt"]);
        git(&root, &["commit", "-qm", "base"]);
        let base_branch = git(&root, &["rev-parse", "--abbrev-ref", "HEAD"]);

        // A staged diff has a different index and worktree so selecting the
        // wrong source is observable. A working-tree diff has the inverse
        // relationship: its old side is the index, while its new side is the
        // file currently visible on disk.
        fs::write(root.join("file.txt"), "index\n").unwrap();
        git(&root, &["add", "file.txt"]);
        fs::write(root.join("file.txt"), "worktree\n").unwrap();
        let service = GitService::default();
        let target = target(&root);

        let working_old = service
            .review_source(&target, &DiffTarget::WorkingTree, "file.txt", "old")
            .await
            .unwrap();
        let working_new = service
            .review_source(&target, &DiffTarget::WorkingTree, "file.txt", "new")
            .await
            .unwrap();
        assert_eq!(working_old.lines, vec!["index"]);
        assert_eq!(working_new.lines, vec!["worktree"]);

        let staged_old = service
            .review_source(&target, &DiffTarget::Staged, "file.txt", "old")
            .await
            .unwrap();
        let staged_new = service
            .review_source(&target, &DiffTarget::Staged, "file.txt", "new")
            .await
            .unwrap();
        assert_eq!(staged_old.lines, vec!["head"]);
        assert_eq!(staged_new.lines, vec!["index"]);

        let head_new = service
            .review_source(&target, &DiffTarget::Head, "file.txt", "new")
            .await
            .unwrap();
        assert_eq!(head_new.lines, vec!["worktree"]);

        // Preserve the dirty index/worktree while creating a separate commit
        // to use as an explicit comparison head.
        git(&root, &["stash", "push", "-q", "-u"]);
        git(&root, &["branch", "compare-head"]);
        git(&root, &["checkout", "-q", "compare-head"]);
        fs::write(root.join("file.txt"), "compare-head\n").unwrap();
        git(&root, &["add", "file.txt"]);
        git(&root, &["commit", "-qm", "compare"]);
        let compare_head = git(&root, &["rev-parse", "HEAD"]);
        git(&root, &["checkout", "-q", &base_branch]);
        git(&root, &["stash", "pop", "-q"]);
        let compare = DiffTarget::Compare {
            base: "HEAD".to_string(),
            head: Some(compare_head),
        };
        let compare_new = service
            .review_source(&target, &compare, "file.txt", "new")
            .await
            .unwrap();
        assert_eq!(compare_new.lines, vec!["compare-head"]);

        // A staged rename uses the old path from HEAD and the new path from
        // the index. Both paths must remain authorized independently.
        git(&root, &["reset", "-q", "--hard", "HEAD"]);
        fs::write(root.join("old.txt"), "old name\n").unwrap();
        git(&root, &["add", "old.txt"]);
        git(&root, &["commit", "-qm", "old name"]);
        git(&root, &["mv", "old.txt", "new.txt"]);
        let renamed_old = service
            .review_source(&target, &DiffTarget::Staged, "old.txt", "old")
            .await
            .unwrap();
        let renamed_new = service
            .review_source(&target, &DiffTarget::Staged, "new.txt", "new")
            .await
            .unwrap();
        assert_eq!(renamed_old.lines, vec!["old name"]);
        assert_eq!(renamed_new.lines, vec!["old name"]);

        let _ = fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn status_rejects_a_non_repository_instead_of_reporting_clean() {
        let root = temp_dir("nonrepo");
        let service = GitService::default();
        let error = service
            .status(&target(&root), StatusOptions::default())
            .await
            .expect_err("a non-repository must not look clean");
        assert!(matches!(
            error,
            GitError::CommandFailed {
                code: Some(code), ..
            } if code != 0
        ));
        let _ = fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn ordinary_status_stays_cheap_and_selected_preview_refuses_partial_content() {
        let root = temp_repo("bounded-fingerprint");
        fs::write(root.join("large.txt"), "0123456789abcdef\n").unwrap();
        fs::write(root.join("small.txt"), "base\n").unwrap();
        git(&root, &["add", "large.txt", "small.txt"]);
        git(&root, &["commit", "-qm", "base"]);
        fs::write(root.join("large.txt"), "fedcba9876543210\n").unwrap();
        fs::write(root.join("small.txt"), "edit\n").unwrap();

        let service = GitService::new(GitConfig {
            max_file_bytes: 8,
            ..GitConfig::default()
        });
        let target = target(&root);
        let status = service
            .status(&target, StatusOptions::default())
            .await
            .expect("ordinary status does not read dirty file contents");
        assert!(status.dirty());

        // The strong fingerprint is selected-path scoped: an oversized dirty
        // file elsewhere does not prevent previewing the small file.
        let small_preview = service
            .preview_discard(&target, DiscardMode::Worktree, &["small.txt".to_string()])
            .await
            .expect("selected bounded file should be previewable");
        assert_eq!(small_preview.paths, vec!["small.txt"]);

        let error = service
            .preview_discard(&target, DiscardMode::Worktree, &["large.txt".to_string()])
            .await
            .expect_err("a partial content hash cannot authorize discard");
        assert_eq!(error, GitError::OutputLimit);
        let _ = fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn actions_require_fresh_explicit_confirmation_and_bind_paths() {
        let root = temp_repo("actions");
        fs::write(root.join("file.txt"), "base\n").unwrap();
        git(&root, &["add", "file.txt"]);
        git(&root, &["commit", "-qm", "base"]);
        fs::write(root.join("file.txt"), "changed\n").unwrap();
        let service = GitService::default();
        let target = target(&root);
        let preview = service
            .preview_discard(&target, DiscardMode::Worktree, &["file.txt".to_string()])
            .await
            .unwrap();
        let mut confirmation = preview.confirm();
        confirmation.confirmed = false;
        assert_eq!(
            service.discard(&target, confirmation).await.unwrap_err(),
            GitError::ConfirmationRequired
        );
        let confirmation = preview.confirm();
        let receipt = service.discard(&target, confirmation).await.unwrap();
        assert!(!receipt.status.dirty());
        assert_eq!(fs::read_to_string(root.join("file.txt")).unwrap(), "base\n");
        let _ = fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn commit_preview_requires_same_status_and_message() {
        let root = temp_repo("commit");
        fs::write(root.join("file.txt"), "base\n").unwrap();
        git(&root, &["add", "file.txt"]);
        git(&root, &["commit", "-qm", "base"]);
        fs::write(root.join("file.txt"), "changed\n").unwrap();
        let service = GitService::default();
        let target = target(&root);
        service
            .stage_paths(&target, &["file.txt".to_string()])
            .await
            .unwrap();
        let preview = service.preview_commit(&target, "feature").await.unwrap();
        let request = CommitRequest {
            message: "different".to_string(),
            confirmation: preview.confirm(),
        };
        assert!(matches!(
            service.commit(&target, request).await,
            Err(GitError::ConfirmationMismatch(_))
        ));
        let preview = service.preview_commit(&target, "feature").await.unwrap();
        let receipt = service
            .commit(
                &target,
                CommitRequest {
                    message: preview.message.clone(),
                    confirmation: preview.confirm(),
                },
            )
            .await
            .unwrap();
        assert!(receipt.commit_id.is_some());
        assert!(!receipt.status.dirty());
        let _ = fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn confirmation_is_invalidated_when_file_content_changes_with_same_xy_status() {
        let root = temp_repo("fingerprint");
        fs::write(root.join("file.txt"), "base\n").unwrap();
        git(&root, &["add", "file.txt"]);
        git(&root, &["commit", "-qm", "base"]);
        fs::write(root.join("file.txt"), "first edit\n").unwrap();
        let service = GitService::default();
        let target = target(&root);
        let preview = service
            .preview_discard(&target, DiscardMode::Worktree, &["file.txt".to_string()])
            .await
            .unwrap();
        fs::write(root.join("file.txt"), "second edit\n").unwrap();
        assert!(matches!(
            service.discard(&target, preview.confirm()).await,
            Err(GitError::ConfirmationMismatch(_))
        ));
        let _ = fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn discard_all_handles_mixed_tracked_and_untracked_paths() {
        let root = temp_repo("discard-mixed");
        fs::write(root.join("tracked.txt"), "base\n").unwrap();
        git(&root, &["add", "tracked.txt"]);
        git(&root, &["commit", "-qm", "base"]);
        fs::write(root.join("tracked.txt"), "changed\n").unwrap();
        fs::write(root.join("new.txt"), "new\n").unwrap();
        let service = GitService::default();
        let target = target(&root);
        let preview = service
            .preview_discard(
                &target,
                DiscardMode::All,
                &["tracked.txt".to_string(), "new.txt".to_string()],
            )
            .await
            .unwrap();
        let receipt = service.discard(&target, preview.confirm()).await.unwrap();
        assert!(!receipt.status.dirty());
        assert_eq!(
            fs::read_to_string(root.join("tracked.txt")).unwrap(),
            "base\n"
        );
        assert!(!root.join("new.txt").exists());
        let _ = fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn workspace_path_authorization_rejects_escape_and_literal_pathspecs_are_safe() {
        let root = temp_repo("paths");
        fs::write(root.join("-danger"), "safe\n").unwrap();
        fs::write(root.join(":(glob)**"), "literal\n").unwrap();
        let target = target(&root);
        assert!(target.authorize_path("../outside").is_err());
        assert_eq!(
            target.authorize_path("-danger").unwrap(),
            PathBuf::from("-danger")
        );
        let service = GitService::default();
        let receipt = service
            .stage_paths(&target, &["-danger".to_string(), ":(glob)**".to_string()])
            .await
            .unwrap();
        assert!(receipt
            .status
            .staged_paths()
            .iter()
            .any(|path| path == "-danger"));
        assert!(receipt
            .status
            .staged_paths()
            .iter()
            .any(|path| path == ":(glob)**"));
        let _ = fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn timeout_kills_git_process_group_and_pipe_readers() {
        use std::os::unix::fs::PermissionsExt;

        let root = temp_dir("git-timeout");
        let fake_git = root.join("fake-git");
        let descendant_pid = root.join("descendant.pid");
        let script = format!(
            "#!/bin/sh\n(sleep 30) &\nchild=$!\nprintf '%s\\n' \"$child\" > '{}'\nwait \"$child\"\n",
            descendant_pid.display()
        );
        fs::write(&fake_git, script).unwrap();
        let mut permissions = fs::metadata(&fake_git).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&fake_git, permissions).unwrap();

        let service = GitService::with_git_binary(
            GitConfig {
                timeout: Duration::from_millis(500),
                ..GitConfig::default()
            },
            &fake_git,
        );
        let error = service
            .status(&target(&root), StatusOptions::default())
            .await
            .expect_err("the fake Git command should time out");
        assert_eq!(error, GitError::TimedOut);

        for _ in 0..50 {
            if descendant_pid.exists() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        let pid = fs::read_to_string(&descendant_pid)
            .expect("fake Git recorded its descendant")
            .trim()
            .parse::<libc::pid_t>()
            .expect("valid descendant pid");
        for _ in 0..100 {
            // A process group kill can briefly leave a child as a zombie while
            // the shell is being reaped; wait for the kernel to release it.
            if unsafe { libc::kill(pid, 0) } != 0 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        assert_ne!(
            unsafe { libc::kill(pid, 0) },
            0,
            "timeout left a descendant process running"
        );
        let _ = fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn caller_cancellation_kills_git_process_group_and_pipe_readers() {
        use std::os::unix::fs::PermissionsExt;

        let root = temp_dir("git-cancel");
        let fake_git = root.join("fake-git");
        let descendant_pid = root.join("descendant.pid");
        let script = format!(
            "#!/bin/sh\n(sleep 30) &\nchild=$!\nprintf '%s\\n' \"$child\" > '{}'\nwait \"$child\"\n",
            descendant_pid.display()
        );
        fs::write(&fake_git, script).unwrap();
        let mut permissions = fs::metadata(&fake_git).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&fake_git, permissions).unwrap();

        let service = GitService::with_git_binary(
            GitConfig {
                timeout: Duration::from_secs(30),
                ..GitConfig::default()
            },
            &fake_git,
        );
        let result = tokio::time::timeout(
            Duration::from_secs(1),
            service.status(&target(&root), StatusOptions::default()),
        )
        .await;
        assert!(result.is_err(), "the caller should cancel before Git exits");

        for _ in 0..100 {
            if descendant_pid.exists() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        let pid = fs::read_to_string(&descendant_pid)
            .expect("fake Git recorded its descendant")
            .trim()
            .parse::<libc::pid_t>()
            .expect("valid descendant pid");
        for _ in 0..100 {
            if unsafe { libc::kill(pid, 0) } != 0 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        assert_ne!(
            unsafe { libc::kill(pid, 0) },
            0,
            "caller cancellation left a descendant process running"
        );
        let _ = fs::remove_dir_all(root);
    }
}
