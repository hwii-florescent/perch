//! Branch and pull request of a thread's Workspace, for the family strip and the Project
//! overview (Claude Projects shows a branch and PR per thread; Perch reads them, it hosts no Git
//! service). Own design, not ported.
//!
//! The branch is read from `.git/HEAD` (`status::get_branch`). The PR is whatever the user's own
//! `gh` login answers for that branch (`gh pr view`), read only. A missing `gh`, no login, no
//! remote, no PR, a timeout or unreadable output is `None`: unknown is shown as nothing, never as
//! "no PR". Answers are cached for a short time because the strip refetches in bursts.

use std::collections::HashMap;
use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// How long an answer (including "none") is reused.
const TTL: Duration = Duration::from_secs(60);
/// `gh` talks to the network; give up after this.
const TIMEOUT: Duration = Duration::from_secs(4);
/// Entries kept; the oldest are dropped past this (a few hundred threads at most).
const MAX_ENTRIES: usize = 256;

/// A pull request for a branch, as `gh` reports it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PullRequest {
    pub number: u64,
    /// `open`, `draft`, `merged` or `closed`.
    pub state: &'static str,
    pub url: String,
}

/// Reads the output of `gh pr view --json number,state,isDraft,url`. Anything else is `None`.
pub fn parse(output: &str) -> Option<PullRequest> {
    let value: serde_json::Value = serde_json::from_str(output).ok()?;
    let number = value.get("number")?.as_u64()?;
    let draft = value
        .get("isDraft")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let state = match value.get("state")?.as_str()? {
        "OPEN" if draft => "draft",
        "OPEN" => "open",
        "MERGED" => "merged",
        "CLOSED" => "closed",
        _ => return None,
    };
    let url = value.get("url")?.as_str()?;
    // Only a web link is ever handed to the UI to open.
    url.starts_with("https://").then(|| PullRequest {
        number,
        state,
        url: url.to_string(),
    })
}

type Cache = HashMap<(String, String), (Instant, Option<PullRequest>)>;
static CACHE: Mutex<Option<Cache>> = Mutex::new(None);

/// The pull request of `branch` checked out in `cwd`, cached for a minute. Blocking: call from a
/// blocking task. A detached HEAD (`branch` is a short sha) or an empty branch asks nothing.
pub fn for_branch(cwd: &str, branch: &str) -> Option<PullRequest> {
    if cwd.is_empty()
        || branch.is_empty()
        || branch.len() == 7 && branch.bytes().all(|b| b.is_ascii_hexdigit())
    {
        return None;
    }
    let key = (cwd.to_string(), branch.to_string());
    if let Some((at, pr)) = CACHE
        .lock()
        .ok()?
        .as_ref()
        .and_then(|cache| cache.get(&key))
    {
        if at.elapsed() < TTL {
            return pr.clone();
        }
    }
    let pr = ask_gh(cwd);
    if let Ok(mut guard) = CACHE.lock() {
        let cache = guard.get_or_insert_with(HashMap::new);
        if cache.len() >= MAX_ENTRIES {
            cache.retain(|_, (at, _)| at.elapsed() < TTL);
        }
        if cache.len() >= MAX_ENTRIES {
            cache.clear(); // ponytail: wholesale reset past the cap; a per-entry LRU if this ever thrashes.
        }
        cache.insert(key, (Instant::now(), pr.clone()));
    }
    pr
}

fn ask_gh(cwd: &str) -> Option<PullRequest> {
    let mut child = Command::new("gh")
        .args(["pr", "view", "--json", "number,state,isDraft,url"])
        .current_dir(cwd)
        .env("GH_PROMPT_DISABLED", "1")
        .env("GH_NO_UPDATE_NOTIFIER", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    let started = Instant::now();
    loop {
        match child.try_wait().ok()? {
            Some(status) if status.success() => break,
            Some(_) => return None,
            None if started.elapsed() > TIMEOUT => {
                let _ = child.kill();
                let _ = child.wait();
                return None;
            }
            None => std::thread::sleep(Duration::from_millis(25)),
        }
    }
    let mut out = String::new();
    child
        .stdout
        .take()?
        .take(64 * 1024)
        .read_to_string(&mut out)
        .ok()?;
    parse(&out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_each_state_and_refuses_the_rest() {
        let json = |state: &str, draft: bool, url: &str| {
            format!(r#"{{"number":7,"state":"{state}","isDraft":{draft},"url":"{url}"}}"#)
        };
        let ok = "https://github.com/o/r/pull/7";
        assert_eq!(parse(&json("OPEN", false, ok)).unwrap().state, "open");
        assert_eq!(parse(&json("OPEN", true, ok)).unwrap().state, "draft");
        assert_eq!(parse(&json("MERGED", false, ok)).unwrap().state, "merged");
        assert_eq!(parse(&json("CLOSED", false, ok)).unwrap().state, "closed");
        assert_eq!(parse(&json("OPEN", false, ok)).unwrap().number, 7);
        assert!(parse(&json("WEIRD", false, ok)).is_none());
        assert!(parse(&json("OPEN", false, "javascript:alert(1)")).is_none());
        assert!(parse("").is_none());
        assert!(parse("no pull requests found").is_none());
    }

    #[test]
    fn a_detached_head_or_empty_branch_asks_nothing() {
        // Would spawn `gh` in a directory that does not exist; the guard returns first.
        assert!(for_branch("/definitely/not/here", "").is_none());
        assert!(for_branch("/definitely/not/here", "3ebb886").is_none());
        assert!(for_branch("", "main").is_none());
    }
}
