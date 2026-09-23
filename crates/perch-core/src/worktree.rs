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
    /// See `base_ref`.
    pub base_ref: Option<String>,
    /// Local branches and `remote/branch` names, for the start-from picker.
    pub refs: Vec<String>,
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
    // Drop progress chatter ("Preparing worktree …") ahead of git's verdict.
    let stderr = match stderr.find("fatal:").or_else(|| stderr.find("error:")) {
        Some(at) => stderr[at..].to_string(),
        None => stderr,
    };
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

    let primary = primary.unwrap_or(repo_path);
    let refs = run_git(
        &[
            "-C",
            &primary,
            "for-each-ref",
            "--format=%(refname)",
            "refs/heads",
            "refs/remotes",
        ],
        GIT_QUICK_TIMEOUT,
    )
    .await
    .unwrap_or_default()
    .lines()
    .filter(|r| !r.ends_with("/HEAD"))
    .filter_map(|r| {
        r.strip_prefix("refs/heads/")
            .or_else(|| r.strip_prefix("refs/remotes/"))
    })
    .map(str::to_string)
    .collect();
    Ok(WorktreeListing {
        worktrees,
        default_root: worktrees_root()
            .join(&repo_name)
            .to_string_lossy()
            .to_string(),
        base_ref: base_ref(&primary).await,
        refs,
    })
}

/// Everything `execute_create` needs, resolved up front so a failed or
/// cancelled create can be undone precisely (`discard_create`): only what did
/// not exist before the job started is ever removed.
#[derive(Debug, Clone)]
pub struct CreatePlan {
    pub primary: String,
    pub target: String,
    pub branch: String,
    /// The branch existed before this create: check it out, never delete it.
    pub branch_existed: bool,
    /// Something already sat at `target`: never delete it on cleanup.
    pub target_existed: bool,
    /// A previous attempt already produced exactly this checkout (lost reply,
    /// failed registration): `execute_create` is a no-op.
    pub reuse: bool,
    /// Fully qualified start point of a new branch (`refs/heads/x`,
    /// `refs/remotes/origin/x`, a commit id, or `HEAD`). `None` when an
    /// existing branch is checked out.
    pub start_ref: Option<String>,
    /// `(remote, branch)` to fetch before checking out a remote start ref.
    pub fetch: Option<(String, String)>,
}

/// What the caller asked for. `branch` is an explicit override; when it is
/// empty the branch is derived from `name` (Orca's task name), with a `-2`,
/// `-3`… suffix until neither a local or remote branch nor the default
/// checkout path is taken.
#[derive(Debug, Clone, Default)]
pub struct CreateRequest {
    pub repo_path: String,
    pub branch: String,
    pub name: Option<String>,
    pub new_branch: bool,
    pub path: Option<String>,
    /// Start-from ref for a new branch: a local branch, `remote/branch`, a
    /// commit, or empty for the repo's base ref (`origin/HEAD`, else `HEAD`).
    pub start_from: Option<String>,
}

/// Upper bound on derived-name suffixes (Orca's `WORKTREE_CREATE_MAX_SUFFIX_ATTEMPTS`
/// plays the same role).
const MAX_NAME_SUFFIX: usize = 100;

/// Orca's `slugifyForWorkspaceName`: a task name as a branch-safe slug —
/// lowercase `a-z0-9._-`, runs of anything else collapsed to one `-`, no `..`
/// (git rejects it), no leading/trailing `.`/`-`, at most 48 characters.
/// Intra-word apostrophes vanish so "don't" becomes `dont`, not `don-t`.
pub fn slugify_task_name(name: &str) -> String {
    let lower = name
        .trim()
        .to_lowercase()
        .replace(['\u{2018}', '\u{2019}'], "'");
    let chars: Vec<char> = lower.chars().collect();
    let mut slug = String::new();
    for (i, &ch) in chars.iter().enumerate() {
        let word = |c: Option<&char>| c.is_some_and(|c| c.is_alphanumeric());
        if ch == '\'' && i > 0 && word(chars.get(i - 1)) && word(chars.get(i + 1)) {
            continue;
        }
        let keep = ch.is_ascii_lowercase() || ch.is_ascii_digit() || matches!(ch, '.' | '_' | '-');
        let next = if keep { ch } else { '-' };
        let last = slug.chars().last();
        if (next == '-' && last == Some('-')) || (next == '.' && last == Some('.')) {
            continue;
        }
        slug.push(next);
    }
    let slug = slug.trim_matches(|c| c == '.' || c == '-');
    let slug: String = slug.chars().take(48).collect();
    slug.trim_end_matches(['-', '.', '_']).to_string()
}

/// Validate the request and resolve the branch, checkout path and start
/// point. Reads the repository but never changes it.
///
/// An explicit `branch` that already exists locally is checked out as is,
/// exactly as herdr's `run_worktree_add_command` does (`new_branch` is only a
/// hint); requesting a missing branch with `new_branch: false` is an error.
pub async fn prepare_create(req: &CreateRequest) -> Result<CreatePlan, WorktreeOpError> {
    let repo_path = expand_tilde(&req.repo_path);
    // Normalize to the parent checkout so the default location is named after
    // the repo, not after whichever linked worktree the user started from.
    let primary = primary_worktree(&repo_path)
        .await
        .map_err(WorktreeOpError::plain)?;
    let repo_name = basename_of(&primary);
    let custom_path = match req.path.as_deref().map(str::trim).filter(|p| !p.is_empty()) {
        Some(p) => {
            let expanded = expand_tilde(p);
            if !Path::new(&expanded).is_absolute() {
                return Err(WorktreeOpError::plain(format!(
                    "worktree path must be absolute: {expanded}"
                )));
            }
            Some(PathBuf::from(expanded))
        }
        None => None,
    };

    let explicit = req.branch.trim();
    let branch = if !explicit.is_empty() {
        explicit.to_string()
    } else {
        let name = req.name.as_deref().unwrap_or("");
        let seed = slugify_task_name(name);
        if seed.is_empty() {
            return Err(WorktreeOpError::plain(if name.trim().is_empty() {
                "a task name or branch is required".to_string()
            } else {
                format!(
                    "'{}' has no characters usable in a branch name",
                    name.trim()
                )
            }));
        }
        derive_free_branch(&primary, &repo_name, &seed, custom_path.is_some()).await?
    };
    run_git(
        &["check-ref-format", "--branch", &branch],
        GIT_QUICK_TIMEOUT,
    )
    .await
    .map_err(WorktreeOpError::plain)?;

    let target = custom_path.unwrap_or_else(|| default_checkout_path(&repo_name, &branch));
    let target_existed = target.exists();
    // A lost success reply or a failed metadata write must be retryable without
    // creating a second checkout. Reuse only Git's matching path AND branch.
    let mut reuse = false;
    if target_existed {
        let listing = list(&primary).await.map_err(WorktreeOpError::plain)?;
        reuse = listing.worktrees.iter().any(|entry| {
            !entry.is_primary
                && canonical_or_original(Path::new(&entry.path)) == canonical_or_original(&target)
                && entry.branch.as_deref() == Some(branch.as_str())
        });
    }
    let branch_existed = local_branch_exists(&primary, &branch).await;
    // A derived name is new by construction; only an explicit branch can be
    // "check out an existing one" (`new_branch: false`).
    if !branch_existed && !req.new_branch && !explicit.is_empty() {
        return Err(WorktreeOpError::plain(format!(
            "branch '{branch}' does not exist — tick \"new branch\" to create it"
        )));
    }
    let (start_ref, fetch) = if branch_existed {
        (None, None)
    } else {
        let start = resolve_start_ref(&primary, req.start_from.as_deref().unwrap_or("")).await?;
        let fetch = start
            .strip_prefix("refs/remotes/")
            .and_then(|rest| rest.split_once('/'))
            .filter(|(_, branch)| *branch != "HEAD")
            .map(|(remote, branch)| (remote.to_string(), branch.to_string()));
        (Some(start), fetch)
    };
    let target = if reuse {
        canonical_or_original(&target)
    } else {
        target
    };
    Ok(CreatePlan {
        primary,
        target: target.to_string_lossy().into_owned(),
        branch,
        branch_existed,
        target_existed,
        reuse,
        start_ref,
        fetch,
    })
}

/// First of `seed`, `seed-2`, `seed-3`… that is free as a local branch, as a
/// branch on any remote, and (unless a custom path was given) as a default
/// checkout directory — Orca's derived-name collision rule.
async fn derive_free_branch(
    primary: &str,
    repo_name: &str,
    seed: &str,
    custom_path: bool,
) -> Result<String, WorktreeOpError> {
    let taken = run_git(
        &[
            "-C",
            primary,
            "for-each-ref",
            "--format=%(refname)",
            "refs/heads",
            "refs/remotes",
        ],
        GIT_QUICK_TIMEOUT,
    )
    .await
    .map_err(WorktreeOpError::plain)?;
    let taken: std::collections::HashSet<&str> = taken
        .lines()
        .filter_map(|r| {
            r.strip_prefix("refs/heads/").or_else(|| {
                r.strip_prefix("refs/remotes/")
                    .and_then(|r| r.split_once('/'))
                    .map(|(_, b)| b)
            })
        })
        .collect();
    for n in 1..=MAX_NAME_SUFFIX {
        let candidate = if n == 1 {
            seed.to_string()
        } else {
            format!("{seed}-{n}")
        };
        if taken.contains(candidate.as_str()) {
            continue;
        }
        if !custom_path && default_checkout_path(repo_name, &candidate).exists() {
            continue;
        }
        return Ok(candidate);
    }
    Err(WorktreeOpError::plain(format!(
        "no free branch name for '{seed}'; pick a different task name"
    )))
}

/// Orca's `resolveWorktreeAddBaseRef`, plus the base-ref default. A bare name
/// is a local branch; `a/b` prefers the remote-tracking `refs/remotes/a/b`,
/// then a local branch literally named `a/b`; anything else must be a commit
/// (SHA, tag, `HEAD~2`…). Empty means the repo's base ref.
async fn resolve_start_ref(primary: &str, start_from: &str) -> Result<String, WorktreeOpError> {
    let start_from = start_from.trim();
    let is_ref = |r: String| async move {
        run_git(
            &["-C", primary, "show-ref", "--verify", "--quiet", &r],
            GIT_QUICK_TIMEOUT,
        )
        .await
        .is_ok()
        .then_some(r)
    };
    if start_from.is_empty() {
        return Ok(base_ref(primary).await.map_or_else(
            || "HEAD".to_string(),
            |short| format!("refs/remotes/{short}"),
        ));
    }
    if start_from.starts_with("refs/") {
        if let Some(r) = is_ref(start_from.to_string()).await {
            return Ok(r);
        }
    } else {
        if start_from.contains('/') {
            if let Some(r) = is_ref(format!("refs/remotes/{start_from}")).await {
                return Ok(r);
            }
        }
        if let Some(r) = is_ref(format!("refs/heads/{start_from}")).await {
            return Ok(r);
        }
    }
    let commit = format!("{start_from}^{{commit}}");
    run_git(
        &["-C", primary, "rev-parse", "--verify", "--quiet", &commit],
        GIT_QUICK_TIMEOUT,
    )
    .await
    .map(|oid| oid.trim().to_string())
    .map_err(|_| {
        WorktreeOpError::plain(format!(
            "start-from '{start_from}' is not a branch or commit"
        ))
    })
}

/// The repo's base ref as a short remote name (`origin/main`), from
/// `origin/HEAD`. `None` when the repo has no such remote default.
pub async fn base_ref(repo: &str) -> Option<String> {
    run_git(
        &[
            "-C",
            repo,
            "symbolic-ref",
            "--quiet",
            "refs/remotes/origin/HEAD",
        ],
        GIT_QUICK_TIMEOUT,
    )
    .await
    .ok()
    .and_then(|r| r.trim().strip_prefix("refs/remotes/").map(str::to_string))
}

async fn local_branch_exists(repo: &str, branch: &str) -> bool {
    run_git(
        &[
            "-C",
            repo,
            "show-ref",
            "--verify",
            "--quiet",
            &format!("refs/heads/{branch}"),
        ],
        GIT_QUICK_TIMEOUT,
    )
    .await
    .is_ok()
}

/// Refresh a remote start ref (`git fetch <remote> <branch>`) before checkout.
/// Best effort: offline, the already-known remote-tracking ref is used.
pub async fn fetch_start_ref(plan: &CreatePlan) {
    if let Some((remote, branch)) = &plan.fetch {
        let refspec = format!("+refs/heads/{branch}:refs/remotes/{remote}/{branch}");
        if let Err(err) = run_git(
            &["-C", &plan.primary, "fetch", "--no-tags", remote, &refspec],
            GIT_TIMEOUT,
        )
        .await
        {
            tracing::warn!(%remote, %branch, %err, "fetch before worktree create failed; using the local ref");
        }
    }
}

/// Run `git worktree add` for a prepared plan and return the checkout path.
/// Dropping this future kills git (`kill_on_drop`); follow a cancel or an
/// error with `discard_create`.
///
/// A new branch is created `--no-track` (Orca: no inherited upstream, so
/// `git status` does not report "behind" before the first push) and records
/// its start point as `branch.<name>.base`, which the delete review uses.
pub async fn execute_create(plan: &CreatePlan) -> Result<String, WorktreeOpError> {
    if plan.reuse {
        return Ok(plan.target.clone());
    }
    if let Some(parent) = Path::new(&plan.target).parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|err| {
            WorktreeOpError::plain(format!(
                "failed to create {}: {err}",
                parent.to_string_lossy()
            ))
        })?;
    }
    let (primary, target, branch) = (&plan.primary, &plan.target, &plan.branch);
    let args: Vec<&str> = match &plan.start_ref {
        // herdr: build_worktree_add_existing_branch_command
        None => vec!["-C", primary, "worktree", "add", target, branch],
        Some(start) => vec![
            "-C",
            primary,
            "worktree",
            "add",
            "--no-track",
            "-b",
            branch,
            target,
            start,
        ],
    };
    run_git(&args, GIT_TIMEOUT)
        .await
        .map_err(WorktreeOpError::plain)?;
    if let Some(start) = &plan.start_ref {
        let key = format!("branch.{branch}.base");
        let _ = run_git(
            &[
                "-C",
                target,
                "config",
                "--local",
                "--replace-all",
                &key,
                start,
            ],
            GIT_QUICK_TIMEOUT,
        )
        .await;
    }
    Ok(plan.target.clone())
}

/// Undo whatever a failed or cancelled `execute_create` left behind: the
/// checkout (registered or not), a half-written admin entry, and the branch —
/// each only when this create made it. Best effort; errors are logged.
pub async fn discard_create(plan: &CreatePlan) {
    if plan.reuse {
        return;
    }
    let target = Path::new(&plan.target);
    let registered = match list(&plan.primary).await {
        Ok(listing) => listing
            .worktrees
            .iter()
            .any(|w| canonical_or_original(Path::new(&w.path)) == canonical_or_original(target)),
        Err(_) => false,
    };
    if registered {
        // `-f -f` also removes a checkout git left locked mid-add.
        if let Err(err) = run_git(
            &[
                "-C",
                &plan.primary,
                "worktree",
                "remove",
                "--force",
                "--force",
                &plan.target,
            ],
            GIT_TIMEOUT,
        )
        .await
        {
            tracing::warn!(target = %plan.target, %err, "discard: worktree remove failed");
        }
    }
    if !plan.target_existed && target.exists() {
        if let Err(err) = tokio::fs::remove_dir_all(target).await {
            tracing::warn!(target = %plan.target, %err, "discard: could not delete checkout");
        }
    }
    let _ = run_git(
        &["-C", &plan.primary, "worktree", "prune"],
        GIT_QUICK_TIMEOUT,
    )
    .await;
    if !plan.branch_existed && local_branch_exists(&plan.primary, &plan.branch).await {
        if let Err(err) = run_git(
            &["-C", &plan.primary, "branch", "-D", "--", &plan.branch],
            GIT_QUICK_TIMEOUT,
        )
        .await
        {
            tracing::warn!(branch = %plan.branch, %err, "discard: could not delete new branch");
        }
    }
}

// ---------------------------------------------------------------------------
// `.worktreeinclude` copies and shared directories (Orca's
// `worktree-include-file.ts` and `worktree-shared-directories.ts`)
// ---------------------------------------------------------------------------

/// Repo-root list of gitignored files/directories to *copy* into each new
/// worktree (`.env`, `.vscode/settings.json`, …).
const INCLUDE_FILE: &str = ".worktreeinclude";
const INCLUDE_MAX_BYTES: u64 = 256 * 1024;
const INCLUDE_MAX_ENTRIES: usize = 1000;

/// What a new checkout gets from the primary one: `links` are symlinked
/// (shared, e.g. `node_modules`), `copies` are copied (owned per worktree).
/// Both hold repo-relative paths that exist in the primary and are gitignored.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Materialize {
    pub links: Vec<String>,
    pub copies: Vec<String>,
}

impl Materialize {
    pub fn is_empty(&self) -> bool {
        self.links.is_empty() && self.copies.is_empty()
    }
}

/// Orca's `parseWorktreeIncludeFile`: one literal path per line; blank lines
/// and `#` comments skipped; `\` → `/`; a leading `./` and trailing `/`
/// dropped; duplicates removed. Entries are anchored at the repo root.
pub fn parse_worktree_include(content: &str) -> Vec<String> {
    let mut entries: Vec<String> = Vec::new();
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let normalized = line.replace('\\', "/");
        let normalized = normalized.strip_prefix("./").unwrap_or(&normalized);
        let normalized = normalized.trim_end_matches('/');
        if !normalized.is_empty() && !entries.iter().any(|e| e == normalized) {
            entries.push(normalized.to_string());
        }
    }
    entries
}

/// `worktree.sharedDirectories` from `orca.yaml`, as a block list
/// (`- node_modules`) or a flow list (`[node_modules, .cache]`).
// ponytail: a line scanner for exactly that documented shape, not a YAML
// parser (anchors, multi-line strings and other keys are ignored). Swap in a
// YAML crate if more of orca.yaml gets ported.
pub fn parse_shared_directories(yaml: &str) -> Vec<String> {
    let unquote = |s: &str| s.trim().trim_matches(|c| c == '"' || c == '\'').to_string();
    let indent = |l: &str| l.len() - l.trim_start().len();
    let mut out = Vec::new();
    let mut in_worktree = false;
    let mut list_indent: Option<usize> = None;
    for line in yaml.lines() {
        let body = line.split(" #").next().unwrap_or("").trim_end();
        if body.trim().is_empty() || body.trim_start().starts_with('#') {
            continue;
        }
        if indent(body) == 0 {
            in_worktree = body.trim() == "worktree:";
            list_indent = None;
            continue;
        }
        if !in_worktree {
            continue;
        }
        let trimmed = body.trim();
        if let Some(level) = list_indent {
            if let Some(item) = trimmed.strip_prefix("- ").filter(|_| indent(body) >= level) {
                out.push(unquote(item));
                continue;
            }
            list_indent = None;
        }
        if let Some(rest) = trimmed.strip_prefix("sharedDirectories:") {
            let rest = rest.trim();
            if let Some(flow) = rest.strip_prefix('[').and_then(|r| r.strip_suffix(']')) {
                out.extend(flow.split(',').map(unquote).filter(|s| !s.is_empty()));
            } else {
                list_indent = Some(indent(body));
            }
        }
    }
    out.into_iter()
        .map(|p| p.trim_end_matches('/').to_string())
        .filter(|p| !p.is_empty())
        .collect()
}

/// Repo-relative, inside the repo, and not under `.git`.
fn is_safe_relative(path: &str) -> bool {
    !path.is_empty()
        && !Path::new(path).is_absolute()
        && path.split('/').all(|s| !s.is_empty() && s != "..")
        && path.split('/').next() != Some(".git")
}

/// The subset of `paths` that git ignores in `repo`. Tracked paths are never
/// reported (no `--no-index`). Any git failure means "none", so a broken
/// probe never copies or links a tracked file.
async fn ignored_subset(repo: &str, paths: &[String]) -> Vec<String> {
    if paths.is_empty() {
        return Vec::new();
    }
    let mut args = vec!["-C", repo, "check-ignore", "--"];
    args.extend(paths.iter().map(String::as_str));
    let out = run_git(&args, GIT_QUICK_TIMEOUT).await.unwrap_or_default();
    let ignored: std::collections::HashSet<&str> = out.lines().collect();
    paths
        .iter()
        .filter(|p| ignored.contains(p.as_str()))
        .cloned()
        .collect()
}

/// Resolve what a new worktree of `primary` should link and copy. Never
/// fails: an unreadable or malformed config means nothing is materialized.
/// A path both shared and listed in `.worktreeinclude` is only linked.
pub async fn resolve_materialize(primary: &str) -> Materialize {
    let root = Path::new(primary);
    let safe = |entries: Vec<String>, what: &str| -> Vec<String> {
        entries
            .into_iter()
            .filter(|e| {
                let ok = is_safe_relative(e);
                if !ok {
                    tracing::warn!(entry = %e, "skipping unsafe {what} entry");
                }
                ok
            })
            .collect()
    };
    let shared = std::fs::read_to_string(root.join("orca.yaml"))
        .map(|yaml| parse_shared_directories(&yaml))
        .unwrap_or_default();
    let shared: Vec<String> = safe(shared, "sharedDirectories")
        .into_iter()
        .filter(|p| root.join(p).is_dir())
        .collect();
    let include = match std::fs::symlink_metadata(root.join(INCLUDE_FILE)) {
        Ok(meta) if meta.is_file() && meta.len() <= INCLUDE_MAX_BYTES => {
            std::fs::read_to_string(root.join(INCLUDE_FILE))
                .map(|c| parse_worktree_include(&c))
                .unwrap_or_default()
        }
        _ => Vec::new(),
    };
    let include: Vec<String> = include
        .into_iter()
        .filter(|e| {
            let pattern = e.starts_with('!') || e.contains('*') || e.contains('?');
            if pattern {
                tracing::warn!(entry = %e, "{INCLUDE_FILE}: globs and negation are not supported");
            }
            !pattern
        })
        .take(INCLUDE_MAX_ENTRIES)
        .collect();
    let include: Vec<String> = safe(include, INCLUDE_FILE)
        .into_iter()
        .filter(|p| std::fs::symlink_metadata(root.join(p)).is_ok())
        .filter(|p| !shared.contains(p))
        .collect();
    let mut links = ignored_subset(primary, &shared).await;
    let mut copies = ignored_subset(primary, &include).await;
    links.sort();
    copies.sort();
    Materialize { links, copies }
}

/// Symlink `links` and copy `copies` from `primary` into the new checkout
/// `target`, skipping anything already there. Checks `stop` between entries
/// so a cancel can wait for it and then discard the checkout. Copies go
/// through `std::fs::copy`, which clones on APFS.
///
/// Each link is also written as `/<path>` to the repo's shared
/// `info/exclude`: `.gitignore`'s `node_modules/` matches only directories,
/// so without it git reports the symlink as untracked — the checkout would
/// read dirty and `git worktree remove` would refuse it.
pub fn materialize(
    primary: &str,
    target: &str,
    plan: &Materialize,
    stop: &std::sync::atomic::AtomicBool,
) -> Result<(), String> {
    use std::sync::atomic::Ordering;
    let (from, to) = (Path::new(primary), Path::new(target));
    if !plan.links.is_empty() {
        exclude_links(primary, &plan.links)?;
    }
    for rel in &plan.links {
        if stop.load(Ordering::SeqCst) {
            return Err("cancelled".into());
        }
        let dest = to.join(rel);
        if std::fs::symlink_metadata(&dest).is_ok() {
            continue;
        }
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("{rel}: {e}"))?;
        }
        std::os::unix::fs::symlink(from.join(rel), &dest)
            .map_err(|e| format!("link {rel}: {e}"))?;
    }
    for rel in &plan.copies {
        copy_tree(&from.join(rel), &to.join(rel), stop).map_err(|e| format!("copy {rel}: {e}"))?;
    }
    Ok(())
}

fn copy_tree(from: &Path, to: &Path, stop: &std::sync::atomic::AtomicBool) -> std::io::Result<()> {
    if stop.load(std::sync::atomic::Ordering::SeqCst) {
        return Err(std::io::Error::other("cancelled"));
    }
    if std::fs::symlink_metadata(to).is_ok() {
        return Ok(());
    }
    if let Some(parent) = to.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let meta = std::fs::symlink_metadata(from)?;
    if meta.file_type().is_symlink() {
        std::os::unix::fs::symlink(std::fs::read_link(from)?, to)
    } else if meta.is_dir() {
        std::fs::create_dir(to)?;
        for entry in std::fs::read_dir(from)? {
            let entry = entry?;
            copy_tree(&entry.path(), &to.join(entry.file_name()), stop)?;
        }
        Ok(())
    } else {
        std::fs::copy(from, to).map(|_| ())
    }
}

/// Append `/<path>` for each link to `<common-dir>/info/exclude` unless an
/// identical line is already there.
fn exclude_links(primary: &str, links: &[String]) -> Result<(), String> {
    let out = std::process::Command::new("git")
        .args([
            "-C",
            primary,
            "rev-parse",
            "--path-format=absolute",
            "--git-common-dir",
        ])
        .stdin(std::process::Stdio::null())
        .output()
        .map_err(|e| e.to_string())?;
    let common = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if !out.status.success() || common.is_empty() {
        return Err("could not find the repository's git dir".into());
    }
    let exclude = Path::new(&common).join("info").join("exclude");
    let current = std::fs::read_to_string(&exclude).unwrap_or_default();
    let missing: Vec<String> = links
        .iter()
        .map(|l| format!("/{l}"))
        .filter(|line| !current.lines().any(|l| l.trim() == line))
        .collect();
    if missing.is_empty() {
        return Ok(());
    }
    let mut text = current;
    if !text.is_empty() && !text.ends_with('\n') {
        text.push('\n');
    }
    text.push_str("# perch: shared worktree directories (symlinks)\n");
    for line in missing {
        text.push_str(&line);
        text.push('\n');
    }
    std::fs::create_dir_all(exclude.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(&exclude, text).map_err(|e| e.to_string())
}

/// Create a linked worktree and return its absolute path (the synchronous
/// `worktree.create` path; background jobs call the three steps themselves).
pub async fn create(req: &CreateRequest) -> Result<String, WorktreeOpError> {
    let plan = prepare_create(req).await?;
    fetch_start_ref(&plan).await;
    let target = execute_create(&plan).await?;
    let extras = resolve_materialize(&plan.primary).await;
    if !extras.is_empty() && !plan.reuse {
        let (primary, dest) = (plan.primary.clone(), target.clone());
        let stop = std::sync::atomic::AtomicBool::new(false);
        let copied =
            tokio::task::spawn_blocking(move || materialize(&primary, &dest, &extras, &stop))
                .await
                .map_err(|e| WorktreeOpError::plain(e.to_string()))
                .and_then(|r| r.map_err(WorktreeOpError::plain));
        if let Err(error) = copied {
            discard_create(&plan).await;
            return Err(error);
        }
    }
    Ok(target)
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

/// A branch `delete` kept because git would not prove it merged: the review
/// Orca offers before a force delete ("Preserved branches").
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreservedBranch {
    pub name: String,
    /// The commit reviewed; a force delete only succeeds while the branch
    /// still points here.
    pub head: String,
    /// Up to 20 `"<short sha> <subject>"` lines on no other branch or remote.
    pub commits: Vec<String>,
    /// How many such commits there are in total.
    pub unmerged: u32,
}

/// Remove a linked worktree *and* its branch (Orca's delete). The checkout
/// goes through `remove` (same dirty guard); the branch is then deleted with
/// `git branch -d`, which refuses unmerged work. A refused branch is kept and
/// returned for review — deleting a worktree never silently drops commits.
// ponytail: no squash-merge detection (Orca compares trees); a squash-merged
// branch is offered for review instead of being deleted outright.
pub async fn delete(
    repo_path: &str,
    path: &str,
    force: bool,
) -> Result<Option<PreservedBranch>, WorktreeOpError> {
    let primary = primary_worktree(&expand_tilde(repo_path))
        .await
        .map_err(WorktreeOpError::plain)?;
    let listing = list(&primary).await.map_err(WorktreeOpError::plain)?;
    let wanted = canonical_or_original(Path::new(&expand_tilde(path)));
    let entry = listing
        .worktrees
        .iter()
        .find(|w| canonical_or_original(Path::new(&w.path)) == wanted);
    if entry.is_some_and(|w| w.is_primary) {
        return Err(WorktreeOpError::plain(
            "the primary checkout cannot be deleted",
        ));
    }
    let branch = entry.and_then(|w| w.branch.clone());
    remove(&primary, path, force).await?;
    let Some(branch) = branch else {
        return Ok(None);
    };
    let delete = |flagged: &'static str| {
        let (primary, branch) = (primary.clone(), branch.clone());
        async move {
            run_git(
                &["-C", &primary, "branch", flagged, "--", &branch],
                GIT_QUICK_TIMEOUT,
            )
            .await
        }
    };
    let mut result = delete("-d").await;
    if result.as_ref().is_err_and(|e| e.contains("checked out")) {
        // A stale admin entry can still claim the branch (Orca prunes first).
        let _ = run_git(&["-C", &primary, "worktree", "prune"], GIT_QUICK_TIMEOUT).await;
        result = delete("-d").await;
    }
    if result.is_ok() || !local_branch_exists(&primary, &branch).await {
        return Ok(None);
    }
    let head = run_git(
        &["-C", &primary, "rev-parse", &format!("refs/heads/{branch}")],
        GIT_QUICK_TIMEOUT,
    )
    .await
    .map_err(WorktreeOpError::plain)?
    .trim()
    .to_string();
    let exclude = format!("--exclude={branch}");
    let range = ["--not", &exclude, "--branches", "--remotes"];
    let mut log = vec!["-C", &primary, "log", "--format=%h %s", "-n", "20", &head];
    log.extend(range);
    let mut count = vec!["-C", &primary, "rev-list", "--count", &head];
    count.extend(range);
    let commits = run_git(&log, GIT_QUICK_TIMEOUT)
        .await
        .unwrap_or_default()
        .lines()
        .map(str::to_string)
        .collect();
    let unmerged = run_git(&count, GIT_QUICK_TIMEOUT)
        .await
        .ok()
        .and_then(|n| n.trim().parse().ok())
        .unwrap_or(0);
    Ok(Some(PreservedBranch {
        name: branch,
        head,
        commits,
        unmerged,
    }))
}

/// Force-delete a preserved branch after review, but only while it still
/// points at `expected_head` (Orca's `forceDeleteLocalBranch`: `update-ref -d`
/// with the old value, so a branch that moved since the review survives) and
/// is not checked out anywhere.
pub async fn delete_branch(
    repo_path: &str,
    branch: &str,
    expected_head: &str,
) -> Result<(), WorktreeOpError> {
    let primary = primary_worktree(&expand_tilde(repo_path))
        .await
        .map_err(WorktreeOpError::plain)?;
    if branch.is_empty() || expected_head.is_empty() {
        return Err(WorktreeOpError::plain(
            "branch and expected head are required",
        ));
    }
    let listing = list(&primary).await.map_err(WorktreeOpError::plain)?;
    if listing
        .worktrees
        .iter()
        .any(|w| w.branch.as_deref() == Some(branch))
    {
        return Err(WorktreeOpError::plain(format!(
            "branch '{branch}' is checked out in another worktree"
        )));
    }
    run_git(
        &[
            "-C",
            &primary,
            "update-ref",
            "-d",
            &format!("refs/heads/{branch}"),
            expected_head,
        ],
        GIT_QUICK_TIMEOUT,
    )
    .await
    .map_err(|_| {
        WorktreeOpError::plain(format!(
            "branch '{branch}' changed since it was reviewed; review it again"
        ))
    })?;
    let _ = run_git(
        &[
            "-C",
            &primary,
            "config",
            "--remove-section",
            &format!("branch.{branch}"),
        ],
        GIT_QUICK_TIMEOUT,
    )
    .await;
    Ok(())
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
        assert!(is_not_working_tree_error(
            "fatal: '/w/x' is not a working tree"
        ));
    }

    // -- throwaway repos (never this repo) --------------------------------

    fn scratch(name: &str) -> PathBuf {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("perch-wt-{name}-{stamp}"));
        std::fs::create_dir_all(&path).unwrap();
        std::fs::canonicalize(&path).unwrap()
    }

    fn git(cwd: &Path, args: &[&str]) -> String {
        let out = std::process::Command::new("git")
            .current_dir(cwd)
            .args(args)
            .output()
            .unwrap();
        assert!(
            out.status.success(),
            "git {args:?}: {}",
            String::from_utf8_lossy(&out.stderr)
        );
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    }

    /// A repo with one commit on `main`, inside its own scratch dir.
    fn repo(name: &str) -> (PathBuf, PathBuf) {
        let root = scratch(name);
        let repo = root.join("repo");
        std::fs::create_dir_all(&repo).unwrap();
        git(&repo, &["init", "-q", "-b", "main"]);
        git(&repo, &["config", "user.email", "perch@example.invalid"]);
        git(&repo, &["config", "user.name", "Perch Test"]);
        std::fs::write(repo.join("README"), "hi\n").unwrap();
        git(&repo, &["add", "."]);
        git(&repo, &["commit", "-qm", "init"]);
        (root, repo)
    }

    fn branch_exists(repo: &Path, branch: &str) -> bool {
        std::process::Command::new("git")
            .current_dir(repo)
            .args([
                "show-ref",
                "--verify",
                "--quiet",
                &format!("refs/heads/{branch}"),
            ])
            .status()
            .unwrap()
            .success()
    }

    fn s(path: &Path) -> &str {
        path.to_str().unwrap()
    }

    fn req(repo: &Path, branch: &str, new_branch: bool, target: &Path) -> CreateRequest {
        CreateRequest {
            repo_path: s(repo).to_string(),
            branch: branch.to_string(),
            new_branch,
            path: Some(s(target).to_string()),
            ..Default::default()
        }
    }

    #[tokio::test]
    async fn discard_undoes_a_finished_create() {
        let (root, repo) = repo("discard");
        let target = root.join("wt");
        let plan = prepare_create(&req(&repo, "feat", true, &target))
            .await
            .unwrap();
        assert!(!plan.branch_existed && !plan.target_existed && !plan.reuse);
        execute_create(&plan).await.unwrap();
        assert!(target.join("README").exists());
        discard_create(&plan).await;
        assert!(!target.exists());
        assert!(!branch_exists(&repo, "feat"));
        assert_eq!(list(s(&repo)).await.unwrap().worktrees.len(), 1);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn cancelling_mid_add_leaves_nothing_behind() {
        let (root, repo) = repo("cancel");
        // A slow post-checkout hook holds `git worktree add` open.
        let hook = repo.join(".git/hooks/post-checkout");
        std::fs::write(&hook, "#!/bin/sh\nsleep 5\n").unwrap();
        std::fs::set_permissions(&hook, std::os::unix::fs::PermissionsExt::from_mode(0o755))
            .unwrap();
        let target = root.join("wt");
        let plan = prepare_create(&req(&repo, "slow", true, &target))
            .await
            .unwrap();
        let started = std::time::Instant::now();
        let timed_out =
            tokio::time::timeout(Duration::from_millis(700), execute_create(&plan)).await;
        assert!(timed_out.is_err(), "the hook should keep git busy");
        assert!(target.exists(), "git had started writing the checkout");
        discard_create(&plan).await;
        assert!(started.elapsed() < Duration::from_secs(5));
        assert!(!target.exists());
        assert!(!branch_exists(&repo, "slow"));
        assert!(!git(&repo, &["worktree", "list", "--porcelain"]).contains(s(&target)));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn discard_keeps_what_existed_before() {
        let (root, repo) = repo("keep");
        git(&repo, &["branch", "old"]);
        let target = root.join("occupied");
        std::fs::create_dir_all(&target).unwrap();
        std::fs::write(target.join("mine"), "x").unwrap();
        let plan = prepare_create(&req(&repo, "old", false, &target))
            .await
            .unwrap();
        assert!(plan.branch_existed && plan.target_existed);
        assert!(
            execute_create(&plan).await.is_err(),
            "git refuses a non-empty dir"
        );
        discard_create(&plan).await;
        assert!(target.join("mine").exists());
        assert!(branch_exists(&repo, "old"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn task_names_slugify_like_orca() {
        assert_eq!(slugify_task_name("Fix login bug!"), "fix-login-bug");
        assert_eq!(slugify_task_name("Don't panic"), "dont-panic");
        assert_eq!(slugify_task_name("../../etc"), "etc");
        assert_eq!(
            slugify_task_name("feature/Login Page"),
            "feature-login-page"
        );
        assert_eq!(slugify_task_name("v1.2..3"), "v1.2.3");
        assert_eq!(slugify_task_name("🚀"), "");
        assert_eq!(slugify_task_name(&"a".repeat(60)).len(), 48);
    }

    fn head(dir: &Path) -> String {
        git(dir, &["rev-parse", "HEAD"])
    }

    async fn create_from(repo: &Path, root: &Path, name: &str, start: &str) -> CreatePlan {
        let plan = prepare_create(&CreateRequest {
            repo_path: s(repo).to_string(),
            name: Some(name.to_string()),
            new_branch: true,
            path: Some(s(&root.join(slugify_task_name(name))).to_string()),
            start_from: Some(start.to_string()),
            ..Default::default()
        })
        .await
        .unwrap();
        fetch_start_ref(&plan).await;
        execute_create(&plan).await.unwrap();
        plan
    }

    #[tokio::test]
    async fn derived_branch_skips_local_and_remote_names() {
        let (root, repo) = repo("derive");
        git(&repo, &["branch", "fix-login"]);
        git(
            &repo,
            &["update-ref", "refs/remotes/origin/fix-login-2", "HEAD"],
        );
        let plan = prepare_create(&CreateRequest {
            repo_path: s(&repo).to_string(),
            name: Some("Fix login".to_string()),
            new_branch: false, // irrelevant for a derived name
            path: Some(s(&root.join("wt")).to_string()),
            ..Default::default()
        })
        .await
        .unwrap();
        assert_eq!(plan.branch, "fix-login-3");
        assert!(!plan.branch_existed);
        // An explicit branch that exists is checked out, not suffixed.
        let explicit = prepare_create(&req(&repo, "fix-login", true, &root.join("wt2")))
            .await
            .unwrap();
        assert_eq!(explicit.branch, "fix-login");
        assert!(explicit.branch_existed && explicit.start_ref.is_none());
        let err = prepare_create(&CreateRequest {
            repo_path: s(&repo).to_string(),
            name: Some("🚀".to_string()),
            new_branch: true,
            ..Default::default()
        })
        .await
        .unwrap_err();
        assert!(
            err.message.contains("no characters usable"),
            "{}",
            err.message
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn start_from_local_branch_and_commit() {
        let (root, repo) = repo("startfrom");
        let first = head(&repo);
        git(&repo, &["checkout", "-qb", "stack"]);
        git(&repo, &["commit", "-q", "--allow-empty", "-m", "stacked"]);
        let stacked = head(&repo);
        git(&repo, &["checkout", "-q", "main"]);

        let plan = create_from(&repo, &root, "on stack", "stack").await;
        let wt = Path::new(&plan.target);
        assert_eq!(head(wt), stacked);
        assert_eq!(
            git(wt, &["config", "branch.on-stack.base"]),
            "refs/heads/stack"
        );
        assert!(git(
            wt,
            &[
                "for-each-ref",
                "--format=%(upstream)",
                "refs/heads/on-stack"
            ]
        )
        .is_empty());

        let plan = create_from(&repo, &root, "at sha", &first[..10]).await;
        assert_eq!(head(Path::new(&plan.target)), first);

        let err = prepare_create(&CreateRequest {
            repo_path: s(&repo).to_string(),
            name: Some("x".into()),
            new_branch: true,
            start_from: Some("nope".into()),
            ..Default::default()
        })
        .await
        .unwrap_err();
        assert!(err.message.contains("not a branch or commit"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn remote_start_refs_are_fetched_and_base_ref_is_the_default() {
        let (root, upstream) = repo("remote");
        let clone = root.join("clone");
        git(&root, &["clone", "-q", s(&upstream), s(&clone)]);
        git(
            &upstream,
            &["commit", "-q", "--allow-empty", "-m", "moved on"],
        );
        let moved = head(&upstream);
        assert_ne!(head(&clone), moved, "the clone has not fetched yet");
        assert_eq!(base_ref(s(&clone)).await.as_deref(), Some("origin/main"));

        // Explicit remote branch: fetched, then branched from.
        let plan = create_from(&clone, &root, "from remote", "origin/main").await;
        assert_eq!(plan.fetch, Some(("origin".to_string(), "main".to_string())));
        assert_eq!(head(Path::new(&plan.target)), moved);

        // No start-from: the base ref (origin/main), not the clone's HEAD.
        git(&upstream, &["commit", "-q", "--allow-empty", "-m", "again"]);
        let plan = create_from(&clone, &root, "from base", "").await;
        assert_eq!(plan.start_ref.as_deref(), Some("refs/remotes/origin/main"));
        assert_eq!(head(Path::new(&plan.target)), head(&upstream));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn worktreeinclude_parses_like_orca() {
        let parsed = parse_worktree_include(
            "# secrets\n.env\n\n./.env\n.vscode\\settings.json\nconfig/local/\n  .env.local  \n",
        );
        assert_eq!(
            parsed,
            [
                ".env",
                ".vscode/settings.json",
                "config/local",
                ".env.local"
            ]
        );
        assert!(!is_safe_relative("../evil") && !is_safe_relative(".git/config"));
        assert!(!is_safe_relative("/etc/passwd") && is_safe_relative("a/b"));
    }

    #[test]
    fn orca_yaml_shared_directories() {
        let block = "name: x\nworktree:\n  other: 1\n  sharedDirectories:\n    - node_modules\n    - \".cache/\"  # rebuildable\n  after: 2\nscripts:\n  - nope\n";
        assert_eq!(parse_shared_directories(block), ["node_modules", ".cache"]);
        let flow = "worktree:\n  sharedDirectories: [node_modules, 'dist']\n";
        assert_eq!(parse_shared_directories(flow), ["node_modules", "dist"]);
        assert!(parse_shared_directories("sharedDirectories:\n  - x\n").is_empty());
    }

    #[tokio::test]
    async fn new_worktrees_link_shared_dirs_and_copy_includes() {
        let (root, repo) = repo("materialize");
        let w = |rel: &str, body: &str| {
            let p = repo.join(rel);
            std::fs::create_dir_all(p.parent().unwrap()).unwrap();
            std::fs::write(p, body).unwrap();
        };
        w(".gitignore", "node_modules/\n.env\nsecret/\n*.log\n");
        w(
            "orca.yaml",
            "worktree:\n  sharedDirectories:\n    - node_modules\n    - missing\n    - README\n",
        );
        w(
            ".worktreeinclude",
            ".env\nsecret\nnotes.txt\nREADME\n*.log\n../evil\nnode_modules\n",
        );
        git(&repo, &["add", "."]);
        git(&repo, &["commit", "-qm", "config"]);
        w("node_modules/pkg/index.js", "module\n");
        w(".env", "TOKEN=1\n");
        w("secret/key", "k\n");
        w("notes.txt", "untracked, not ignored\n");
        w("a.log", "log\n");

        let wanted = resolve_materialize(s(&repo)).await;
        assert_eq!(wanted.links, ["node_modules"]);
        assert_eq!(wanted.copies, [".env", "secret"]);

        let target = root.join("wt");
        let mut request = req(&repo, "mat", true, &target);
        request.start_from = Some("main".into());
        create(&request).await.unwrap();
        let link = std::fs::symlink_metadata(target.join("node_modules")).unwrap();
        assert!(link.file_type().is_symlink());
        assert!(target.join("node_modules/pkg/index.js").exists());
        assert!(!std::fs::symlink_metadata(target.join(".env"))
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(
            std::fs::read_to_string(target.join("secret/key")).unwrap(),
            "k\n"
        );
        assert!(!target.join("notes.txt").exists() && !target.join("a.log").exists());
        assert!(
            !is_dirty(s(&target)).await,
            "the shared symlink must not read as untracked"
        );

        remove(s(&repo), s(&target), false).await.unwrap();
        assert!(!target.exists());
        assert!(
            repo.join("node_modules/pkg/index.js").exists(),
            "remove must not follow the link"
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn delete_drops_merged_branches_and_preserves_unmerged_work() {
        let (root, repo) = repo("delete");
        let merged = root.join("merged");
        create(&req(&repo, "merged", true, &merged)).await.unwrap();
        assert_eq!(delete(s(&repo), s(&merged), false).await.unwrap(), None);
        assert!(!merged.exists() && !branch_exists(&repo, "merged"));

        let work = root.join("work");
        create(&req(&repo, "work", true, &work)).await.unwrap();
        git(&work, &["commit", "-q", "--allow-empty", "-m", "precious"]);
        let kept = delete(s(&repo), s(&work), false)
            .await
            .unwrap()
            .expect("preserved");
        assert!(!work.exists(), "the checkout goes either way");
        assert_eq!((kept.name.as_str(), kept.unmerged), ("work", 1));
        assert!(kept.commits[0].ends_with(" precious"), "{:?}", kept.commits);
        assert!(branch_exists(&repo, "work"));

        // A branch that moved after the review is not force-deleted.
        git(&repo, &["branch", "-f", "work", "main"]);
        let err = delete_branch(s(&repo), "work", &kept.head)
            .await
            .unwrap_err();
        assert!(err.message.contains("changed since"), "{}", err.message);
        git(&repo, &["branch", "-f", "work", &kept.head]);
        delete_branch(s(&repo), "work", &kept.head).await.unwrap();
        assert!(!branch_exists(&repo, "work"));

        let err = delete(s(&repo), s(&repo), true).await.unwrap_err();
        assert!(err.message.contains("primary"));
        std::fs::remove_dir_all(root).unwrap();
    }
}
