//! cwd + branch status, mirroring `reference/node-server-spec/src/status.ts`.
//! Reads the current branch by walking up from `cwd` to find `.git/HEAD` and
//! parsing it directly, rather than shelling out to `git`.

use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Default)]
pub struct LastUsage {
    pub context_tokens: Option<u64>,
    pub cost_usd: Option<f64>,
}

pub struct StatusInfo {
    pub cwd: String,
    pub branch: String,
    pub context_tokens: Option<u64>,
    pub cost_usd: Option<f64>,
}

/// Reads the current branch by walking up from `cwd` to find `.git/HEAD`.
pub fn get_branch(cwd: &str) -> String {
    let Some(head_path) = find_git_head(Path::new(cwd)) else {
        return String::new();
    };
    let Ok(head) = std::fs::read_to_string(&head_path) else {
        return String::new();
    };
    let head = head.trim();
    if let Some(branch) = head.strip_prefix("ref: refs/heads/") {
        return branch.to_string();
    }
    head.chars().take(7).collect() // detached HEAD: short sha
}

fn find_git_head(start_dir: &Path) -> Option<PathBuf> {
    let mut dir = start_dir
        .canonicalize()
        .unwrap_or_else(|_| start_dir.to_path_buf());
    loop {
        let git_dir = dir.join(".git");
        let head_file = git_dir.join("HEAD");
        if git_dir.is_dir() && head_file.is_file() {
            return Some(head_file);
        }
        match dir.parent() {
            Some(parent) if parent != dir => dir = parent.to_path_buf(),
            _ => return None,
        }
    }
}

/// cwd + branch, plus context/cost placeholders filled in from the last
/// `chat.done` usage seen for the session (`None` until a turn completes).
pub fn get_status(cwd: &str, last: Option<&LastUsage>) -> StatusInfo {
    StatusInfo {
        cwd: cwd.to_string(),
        branch: get_branch(cwd),
        context_tokens: last.and_then(|l| l.context_tokens),
        cost_usd: last.and_then(|l| l.cost_usd),
    }
}
