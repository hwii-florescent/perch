//! Git worktree management — Wave 2's largest herdr port.
//!
//! Behavioral spec: `reference/herdr/src/worktree.rs` (path expansion, branch
//! slugging, `git worktree add` command construction for new-vs-existing
//! branches, `worktree remove` with leftover-checkout recovery,
//! `worktree list --porcelain` parsing, dirty-checkout detection) plus
//! `reference/herdr/src/app/worktrees.rs` (the flows: default checkout root,
//! the "worktree actions start from the repo *parent* workspace" rule, the
//! dirty guard that escalates a refused remove into a force confirmation).
//!
//! # Subprocess policy
//!
//! `status.rs` states the module policy: parse `.git` directly, never shell
//! out — with one documented exception (`get_ahead_behind`, which would
//! otherwise require reimplementing commit-graph traversal over packed
//! objects). **This module is the second such documented exception, and a
//! much clearer one**: `git worktree add/remove` are *mutating* porcelain
//! operations that create/destroy the linked-worktree admin directories under
//! `.git/worktrees/<name>/`, rewrite `gitdir`/`commondir` pointer files, and
//! register/prune entries. Reimplementing that bookkeeping by hand would be
//! reimplementing git, with a corrupted-repo failure mode. Every git
//! invocation here is therefore a `tokio::process::Command` (never blocking
//! the runtime) wrapped in a hard `GIT_TIMEOUT` so a hung/prompting git can
//! never wedge a connection task.
//!
//! # Default checkout location
//!
//! herdr puts generated checkouts under `~/.herdr/worktrees/<repo>/<slug>`
//! (`app/worktrees.rs`'s `state.worktree_directory` + `default_checkout_path`).
//! perch's analog is `~/.perch/worktrees/<repo-name>/<branch-slug>`, alongside
//! the other perch state files (`history.sqlite`, `settings.json`,
//! `hosts.json`). A caller-supplied absolute path always wins.

use std::path::{Path, PathBuf};
use std::time::Duration;

use tokio::process::Command;

/// Hard bound on any single git invocation. `worktree add` on a large repo is
/// the slowest of these (it materializes a full checkout), hence 60s rather
/// than something tighter; list/status/show-ref use `GIT_QUICK_TIMEOUT`.
const GIT_TIMEOUT: Duration = Duration::from_secs(60);
/// Bound for the read-only queries (list, status, show-ref, rev-parse).
const GIT_QUICK_TIMEOUT: Duration = Duration::from_secs(15);

/// Fallback slug when a branch name contains no alphanumerics at all
/// (herdr's `DEFAULT_WORKTREE_PREFIX`).
const DEFAULT_WORKTREE_SLUG: &str = "worktree";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// One entry of `git worktree list --porcelain`, enriched with a dirty flag.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorktreeInfo {
    pub path: String,
    /// Short branch name (`refs/heads/` stripped); `None` for detached HEAD.
    pub branch: Option<String>,
    /// Commit sha the worktree's HEAD points at.
    pub head: Option<String>,
    /// The repo's main working tree (git always lists it first).
    pub is_primary: bool,
    /// `git status --porcelain --untracked-files=all` produced output.
    pub is_dirty: bool,
}

/// Result of a successful `worktree.list`.
#[derive(Debug, Clone)]
pub struct WorktreeListing {
    pub worktrees: Vec<WorktreeInfo>,
    /// `~/.perch/worktrees/<repo-name>` — the directory new checkouts land in
    /// by default, so the client can prefill the optional custom-path field.
    pub default_root: String,
}

/// A remove failure, distinguishing the dirty-checkout guard (recoverable by
/// retrying with `force`) from every other error. Mirrors herdr's
/// `WorktreeRemoveState::force_confirmation` escalation in
/// `app/worktrees.rs::handle_worktree_remove_finished`.
#[derive(Debug, Clone)]
pub struct WorktreeOpError {
    pub message: String,
    /// True when the operation was refused *only* because the checkout has
    /// uncommitted or untracked files.
    pub dirty: bool,
}

impl WorktreeOpError {
    fn plain(message: impl Into<String>) -> Self {
        WorktreeOpError {
            message: message.into(),
            dirty: false,
        }
    }
}

/// Intermediate parse of the porcelain listing (pre dirty-check).
#[derive(Debug, Clone, PartialEq, Eq)]
struct ParsedWorktree {
    path: String,
    branch: Option<String>,
    head: Option<String>,
    is_bare: bool,
    is_prunable: bool,
}

// ---------------------------------------------------------------------------
// Path helpers (ported from herdr's `worktree.rs`)
// ---------------------------------------------------------------------------

/// Expand a leading `~` / `~/` against `$HOME` (unix-only — perch does not
/// target Windows, so herdr's `USERPROFILE`/`HOMEDRIVE` ladder is dropped).
pub fn expand_tilde(path: &str) -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    if path == "~" {
        return home;
    }
    if let Some(rest) = path.strip_prefix("~/") {
        return format!("{home}/{rest}");
    }
    path.to_string()
}

/// Make a branch name safe to use as a single directory component: lowercase
/// alphanumerics kept, every other run of characters collapsed to a single
/// `-`, leading/trailing dashes trimmed. Port of herdr's
/// `worktree::branch_to_path_slug`. This is also what prevents a branch like
/// `../../etc` from escaping the worktrees root.
pub fn branch_to_path_slug(branch: &str) -> String {
    let mut slug = String::new();
    let mut last_was_dash = false;
    for ch in branch.chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch.to_ascii_lowercase());
            last_was_dash = false;
        } else if !last_was_dash {
            slug.push('-');
            last_was_dash = true;
        }
    }
    let trimmed = slug.trim_matches('-').to_string();
    if trimmed.is_empty() {
        DEFAULT_WORKTREE_SLUG.to_string()
    } else {
        trimmed
    }
}

/// `~/.perch/worktrees` — perch's analog of herdr's `~/.herdr/worktrees`.
pub fn worktrees_root() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_default();
    PathBuf::from(home).join(".perch").join("worktrees")
}

/// `~/.perch/worktrees/<repo-name>/<branch-slug>` (herdr's
/// `default_checkout_path`).
pub fn default_checkout_path(repo_name: &str, branch: &str) -> PathBuf {
    worktrees_root()
        .join(repo_name)
        .join(branch_to_path_slug(branch))
}

fn canonical_or_original(path: &Path) -> PathBuf {
    std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

fn basename_of(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

// ---------------------------------------------------------------------------
// Error-message classification (ported from herdr's `worktree.rs`)
// ---------------------------------------------------------------------------

fn is_dirty_remove_error(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    lower.contains("contains modified or untracked files") && lower.contains("use --force")
}

fn is_not_working_tree_error(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    lower.contains("is not a working tree") || lower.contains("is not a worktree")
}

// ---------------------------------------------------------------------------
// git subprocess plumbing
// ---------------------------------------------------------------------------

/// Run `git <args>`, bounded by `timeout`. `Ok(stdout)` on exit 0, otherwise
/// `Err(stderr-or-stdout-or-status)`. Never inherits stdin — a git that
/// decides to prompt gets EOF instead of hanging (perch's counterpart to
/// herdr's `noninteractive_process::command`).
async fn run_git(args: &[&str], timeout: Duration) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.args(args)
        .stdin(std::process::Stdio::null())
        .kill_on_drop(true);
    let fut = cmd.output();
    let output = match tokio::time::timeout(timeout, fut).await {
        Ok(Ok(output)) => output,
        Ok(Err(err)) => return Err(format!("failed to run git: {err}")),
        Err(_) => {
            return Err(format!(
                "git timed out after {}s: git {}",
                timeout.as_secs(),
                args.join(" ")
            ))
        }
    };
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Err(if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        format!("git exited with status {}", output.status)
    })
}

// ---------------------------------------------------------------------------
// `git worktree list --porcelain` parsing (port of herdr's parser)
// ---------------------------------------------------------------------------

fn parse_worktree_list_porcelain(output: &str) -> Vec<ParsedWorktree> {
    let mut entries: Vec<ParsedWorktree> = Vec::new();
    let mut path: Option<String> = None;
    let mut branch: Option<String> = None;
    let mut head: Option<String> = None;
    let mut is_bare = false;
    let mut is_prunable = false;

    fn finish(
        entries: &mut Vec<ParsedWorktree>,
        path: &mut Option<String>,
        branch: &mut Option<String>,
        head: &mut Option<String>,
        is_bare: &mut bool,
        is_prunable: &mut bool,
    ) {
        if let Some(p) = path.take() {
            entries.push(ParsedWorktree {
                path: p,
                branch: branch.take(),
                head: head.take(),
                is_bare: *is_bare,
                is_prunable: *is_prunable,
            });
        }
        *is_bare = false;
        *is_prunable = false;
    }

    for line in output.lines() {
        if line.trim().is_empty() {
            finish(
                &mut entries,
                &mut path,
                &mut branch,
                &mut head,
                &mut is_bare,
                &mut is_prunable,
            );
            continue;
        }
        if let Some(value) = line.strip_prefix("worktree ") {
            path = Some(value.to_string());
        } else if let Some(value) = line.strip_prefix("branch ") {
            branch = Some(
                value
                    .strip_prefix("refs/heads/")
                    .unwrap_or(value)
                    .to_string(),
            );
        } else if let Some(value) = line.strip_prefix("HEAD ") {
            head = Some(value.to_string());
        } else if line == "bare" {
            is_bare = true;
        } else if line.starts_with("prunable") {
            is_prunable = true;
        }
        // "detached" needs no flag of its own: `branch` stays None.
    }
    // Trailing entry when the output does not end with a blank line.
    finish(
        &mut entries,
        &mut path,
        &mut branch,
        &mut head,
        &mut is_bare,
        &mut is_prunable,
    );
    entries
}

// ---------------------------------------------------------------------------
// Public operations
// ---------------------------------------------------------------------------

/// `git status --porcelain --untracked-files=all` in `path` produced output.
/// A missing/unreadable checkout counts as clean (nothing to lose) — this
/// mirrors herdr's `checkout_has_dirty_files(...).unwrap_or(false)` usage in
/// `app/worktrees.rs::submit_worktree_remove_via_api`.
pub async fn is_dirty(path: &str) -> bool {
    if !Path::new(path).is_dir() {
        return false;
    }
    match run_git(
        &["-C", path, "status", "--porcelain", "--untracked-files=all"],
        GIT_QUICK_TIMEOUT,
    )
    .await
    {
        Ok(stdout) => !stdout.trim().is_empty(),
        Err(_) => false,
    }
}

/// The repo's main working tree — the first non-bare entry of
/// `worktree list --porcelain` (git documents the main worktree as always
/// listed first).
///
/// This is perch's adaptation of herdr's "New and open worktree actions start
/// from the repo parent workspace" rule
/// (`app/worktrees.rs::worktree_source_metadata`, which *refuses* the action
/// when invoked from a linked worktree). Refusing makes sense for herdr,
/// where the action mutates the invoking workspace's grouping; in perch the
/// menu is purely a view over the repo, so instead of refusing we *normalize*:
/// whichever checkout of the repo the project cwd happens to be, every
/// operation is resolved against — and named after — the primary checkout.
async fn primary_worktree(repo_path: &str) -> Result<String, String> {
    let listing = run_git(
        &["-C", repo_path, "worktree", "list", "--porcelain"],
        GIT_QUICK_TIMEOUT,
    )
    .await?;
    parse_worktree_list_porcelain(&listing)
        .into_iter()
        .find(|w| !w.is_bare)
        .map(|w| w.path)
        .ok_or_else(|| format!("no git worktree found for {repo_path}"))
}

/// List every worktree of the repo containing `repo_path`, marking the
/// primary checkout and flagging dirty ones.
///
/// Bare and prunable (stale-admin-entry) worktrees are filtered out, matching
/// herdr's `open_existing_worktree_dialog` entry filter.
pub async fn list(repo_path: &str) -> Result<WorktreeListing, String> {
    let repo_path = expand_tilde(repo_path);
    let stdout = run_git(
        &["-C", &repo_path, "worktree", "list", "--porcelain"],
        GIT_QUICK_TIMEOUT,
    )
    .await?;
    let parsed: Vec<ParsedWorktree> = parse_worktree_list_porcelain(&stdout)
        .into_iter()
        .filter(|w| !w.is_bare && !w.is_prunable)
        .collect();

    let primary = parsed.first().map(|w| w.path.clone());
    let repo_name = primary.as_deref().map(basename_of).unwrap_or_default();

    let mut worktrees = Vec::with_capacity(parsed.len());
    for entry in parsed {
        let dirty = is_dirty(&entry.path).await;
        worktrees.push(WorktreeInfo {
            is_primary: Some(&entry.path) == primary.as_ref(),
            path: entry.path,
            branch: entry.branch,
            head: entry.head,
            is_dirty: dirty,
        });
    }

    Ok(WorktreeListing {
        worktrees,
        default_root: worktrees_root()
            .join(&repo_name)
            .to_string_lossy()
            .to_string(),
    })
}

/// Create a linked worktree and return its absolute path.
///
/// `new_branch` is a *hint*, not a hard mode: when the branch already exists
/// locally the existing-branch form is used regardless, exactly as herdr's
/// `run_worktree_add_command` does (it calls `local_branch_exists` first and
/// picks the command shape from that). Requesting an existing branch with
/// `new_branch: false` when it does not exist is a plain error.
pub async fn create(
    repo_path: &str,
    branch: &str,
    new_branch: bool,
    path: Option<&str>,
) -> Result<String, WorktreeOpError> {
    let repo_path = expand_tilde(repo_path);
    let branch = branch.trim();
    if branch.is_empty() {
        return Err(WorktreeOpError::plain("branch is required"));
    }

    // Normalize to the parent checkout so the default location is named after
    // the repo, not after whichever linked worktree the user started from.
    let primary = primary_worktree(&repo_path)
        .await
        .map_err(WorktreeOpError::plain)?;
    let repo_name = basename_of(&primary);

    let target = match path.map(str::trim).filter(|p| !p.is_empty()) {
        Some(p) => {
            let expanded = expand_tilde(p);
            if !Path::new(&expanded).is_absolute() {
                return Err(WorktreeOpError::plain(format!(
                    "worktree path must be absolute: {expanded}"
                )));
            }
            PathBuf::from(expanded)
        }
        None => default_checkout_path(&repo_name, branch),
    };

    if let Some(parent) = target.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|err| {
            WorktreeOpError::plain(format!(
                "failed to create {}: {err}",
                parent.to_string_lossy()
            ))
        })?;
    }

    let target_str = target.to_string_lossy().to_string();
    let branch_exists = run_git(
        &[
            "-C",
            &primary,
            "show-ref",
            "--verify",
            "--quiet",
            &format!("refs/heads/{branch}"),
        ],
        GIT_QUICK_TIMEOUT,
    )
    .await
    .is_ok();

    if !branch_exists && !new_branch {
        return Err(WorktreeOpError::plain(format!(
            "branch '{branch}' does not exist — tick \"new branch\" to create it"
        )));
    }

    let args: Vec<&str> = if branch_exists {
        // herdr: build_worktree_add_existing_branch_command
        vec!["-C", &primary, "worktree", "add", &target_str, branch]
    } else {
        // herdr: build_worktree_add_new_branch_command (base = HEAD)
        vec![
            "-C",
            &primary,
            "worktree",
            "add",
            "-b",
            branch,
            &target_str,
            "HEAD",
        ]
    };

    run_git(&args, GIT_TIMEOUT)
        .await
        .map_err(WorktreeOpError::plain)?;
    Ok(target_str)
}

/// Remove a linked worktree.
///
/// Two-stage dirty guard, mirroring herdr:
///   1. Pre-flight: when `force` is false and the checkout is dirty, refuse
///      *before* invoking git (herdr's `submit_worktree_remove_via_api`
///      `checkout_has_dirty_files` pre-check).
///   2. Post-hoc: if git itself refuses with the "contains modified or
///      untracked files, use --force" message, translate that into the same
///      `dirty: true` error (herdr's `is_dirty_worktree_remove_error` →
///      `force_confirmation = true`).
///
/// The branch is deliberately *not* deleted — `git worktree remove` only
/// removes the checkout, which is herdr's documented behavior
/// (`worktree_remove_command_preserves_branch_by_not_deleting_it`).
pub async fn remove(repo_path: &str, path: &str, force: bool) -> Result<(), WorktreeOpError> {
    let repo_path = expand_tilde(repo_path);
    let path = expand_tilde(path);

    if !force && is_dirty(&path).await {
        return Err(WorktreeOpError {
            message: format!(
                "'{path}' contains modified or untracked files — force remove to delete it anyway"
            ),
            dirty: true,
        });
    }

    let mut args: Vec<&str> = vec!["-C", &repo_path, "worktree", "remove"];
    if force {
        args.push("--force");
    }
    args.push(&path);

    match run_git(&args, GIT_TIMEOUT).await {
        Ok(_) => Ok(()),
        Err(err) if !force && is_dirty_remove_error(&err) => Err(WorktreeOpError {
            message: err,
            dirty: true,
        }),
        Err(err) if force && is_not_working_tree_error(&err) => {
            recover_leftover_checkout(&repo_path, &path, &err).await
        }
        Err(err) => Err(WorktreeOpError::plain(err)),
    }
}

/// Port of herdr's `run_worktree_remove_command_with_recovery`: a forced
/// remove that fails with "is not a working tree" can mean the admin entry is
/// already gone but the directory survived. Delete the leftover directory —
/// but only after proving (a) git no longer lists it, and (b) its `.git` file
/// points into *this* repo's `worktrees` admin dir, so an unrelated directory
/// that merely reused the path is never destroyed.
async fn recover_leftover_checkout(
    repo_path: &str,
    path: &str,
    original_err: &str,
) -> Result<(), WorktreeOpError> {
    let still_listed = match list(repo_path).await {
        Ok(listing) => {
            let expected = canonical_or_original(Path::new(path));
            listing
                .worktrees
                .iter()
                .any(|w| canonical_or_original(Path::new(&w.path)) == expected)
        }
        Err(_) => true, // can't prove it's gone — do not delete anything
    };
    if still_listed {
        return Err(WorktreeOpError::plain(original_err.to_string()));
    }
    if !Path::new(path).exists() {
        return Ok(());
    }
    if !leftover_checkout_matches_repo(repo_path, path).await {
        return Err(WorktreeOpError::plain(original_err.to_string()));
    }
    tokio::fs::remove_dir_all(path).await.map_err(|err| {
        WorktreeOpError::plain(format!(
            "{original_err}; failed to remove leftover checkout {path}: {err}"
        ))
    })
}

async fn leftover_checkout_matches_repo(repo_path: &str, path: &str) -> bool {
    let Ok(content) = tokio::fs::read_to_string(Path::new(path).join(".git")).await else {
        return false;
    };
    let Some(gitdir) = content.trim().strip_prefix("gitdir:") else {
        return false;
    };
    let gitdir = PathBuf::from(gitdir.trim());
    let gitdir = if gitdir.is_absolute() {
        gitdir
    } else {
        Path::new(path).join(gitdir)
    };
    let Ok(common_dir) = run_git(
        &["-C", repo_path, "rev-parse", "--git-common-dir"],
        GIT_QUICK_TIMEOUT,
    )
    .await
    else {
        return false;
    };
    let common_dir = common_dir.trim();
    if common_dir.is_empty() {
        return false;
    }
    let common_dir = PathBuf::from(common_dir);
    let common_dir = if common_dir.is_absolute() {
        common_dir
    } else {
        Path::new(repo_path).join(common_dir)
    };
    canonical_or_original(&gitdir).starts_with(canonical_or_original(&common_dir.join("worktrees")))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_git_worktree_list_porcelain() {
        let output = "\
worktree /repo/main
HEAD abc123
branch refs/heads/main

worktree /repo/feature
HEAD def456
branch refs/heads/worktree/feature

worktree /repo/detached
HEAD fed789
detached
prunable stale

";
        let parsed = parse_worktree_list_porcelain(output);
        assert_eq!(parsed.len(), 3);
        assert_eq!(parsed[0].path, "/repo/main");
        assert_eq!(parsed[0].branch.as_deref(), Some("main"));
        assert_eq!(parsed[0].head.as_deref(), Some("abc123"));
        assert_eq!(parsed[1].branch.as_deref(), Some("worktree/feature"));
        assert_eq!(parsed[2].branch, None);
        assert!(parsed[2].is_prunable);
    }

    #[test]
    fn parses_bare_repo_entry() {
        let parsed = parse_worktree_list_porcelain("worktree /repo/bare\nbare\n\n");
        assert_eq!(parsed.len(), 1);
        assert!(parsed[0].is_bare);
    }

    #[test]
    fn branch_slug_makes_a_safe_single_path_component() {
        assert_eq!(branch_to_path_slug("feature/login"), "feature-login");
        assert_eq!(
            branch_to_path_slug("issue/137 Worktree Spaces"),
            "issue-137-worktree-spaces"
        );
        assert_eq!(branch_to_path_slug("///"), "worktree");
        // Traversal attempts collapse to a harmless single component.
        assert_eq!(branch_to_path_slug("../../etc"), "etc");
    }

    #[test]
    fn default_checkout_path_is_under_perch_worktrees_root() {
        let path = default_checkout_path("myrepo", "feature/login");
        assert!(path.ends_with("myrepo/feature-login"));
        assert!(path.starts_with(worktrees_root()));
    }

    #[test]
    fn dirty_remove_error_detection_matches_git_force_hint() {
        assert!(is_dirty_remove_error(
            "fatal: '/w/x' contains modified or untracked files, use --force to delete it"
        ));
        assert!(!is_dirty_remove_error(
            "fatal: '/w/x' is a missing but already registered worktree"
        ));
        assert!(is_not_working_tree_error("fatal: '/w/x' is not a working tree"));
    }
}
