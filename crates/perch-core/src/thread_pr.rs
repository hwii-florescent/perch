//! Branch and pull request of a thread's Workspace, for the family strip and the Project
//! overview (Claude Projects shows a branch and PR per thread; Perch reads them, it hosts no Git
//! service). Own design, not ported.
//!
//! The branch is read from `.git/HEAD` (`status::get_branch`). The PR is whatever the user's own
//! `gh` login answers for that branch (`gh pr view`), read only. A missing `gh`, no login, no
//! remote, no PR, a timeout or unreadable output is `None`: unknown is shown as nothing, never as
//! "no PR". Answers are cached for a minute and read from the cache only on a request; a miss
//! starts one background lookup and the answer shows on the next ask.

use std::collections::{HashMap, HashSet};
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

type Key = (String, String);
type Cache = HashMap<Key, (Instant, Option<PullRequest>)>;
static CACHE: Mutex<Option<Cache>> = Mutex::new(None);
/// Keys being refreshed now, so a burst of asks starts one `gh` per branch.
static REFRESHING: Mutex<Option<HashSet<Key>>> = Mutex::new(None);

fn store(key: Key, pr: Option<PullRequest>) {
    if let Ok(mut guard) = CACHE.lock() {
        let cache = guard.get_or_insert_with(HashMap::new);
        if cache.len() >= MAX_ENTRIES {
            cache.retain(|_, (at, _)| at.elapsed() < TTL);
        }
        if cache.len() >= MAX_ENTRIES {
            cache.clear(); // ponytail: wholesale reset past the cap; a per-entry LRU if this ever thrashes.
        }
        cache.insert(key, (Instant::now(), pr));
    }
}

/// The pull request of `branch` checked out in `cwd`, from the cache only: `gh` talks to the
/// network and a request must not wait for it. A missing or older-than-a-minute entry starts one
/// background refresh (the next ask sees its answer; a stale answer is returned meanwhile). A
/// detached HEAD (`branch` is a short sha) or an empty branch asks nothing.
pub fn for_branch(cwd: &str, branch: &str) -> Option<PullRequest> {
    if cwd.is_empty()
        || branch.is_empty()
        || branch.len() == 7 && branch.bytes().all(|b| b.is_ascii_hexdigit())
    {
        return None;
    }
    let key = (cwd.to_string(), branch.to_string());
    let known = CACHE
        .lock()
        .ok()?
        .as_ref()
        .and_then(|cache| cache.get(&key).cloned());
    if let Some((at, pr)) = &known {
        if at.elapsed() < TTL {
            return pr.clone();
        }
    }
    {
        let mut guard = REFRESHING.lock().ok()?;
        if !guard.get_or_insert_with(HashSet::new).insert(key.clone()) {
            return known.and_then(|(_, pr)| pr);
        }
    }
    let refresh_key = key.clone();
    let spawned = std::thread::Builder::new()
        .name("perch-pr".into())
        .spawn(move || {
            let pr = ask_gh(&refresh_key.0);
            store(refresh_key.clone(), pr);
            if let Ok(mut guard) = REFRESHING.lock() {
                if let Some(set) = guard.as_mut() {
                    set.remove(&refresh_key);
                }
            }
        });
    if spawned.is_err() {
        if let Ok(mut guard) = REFRESHING.lock() {
            if let Some(set) = guard.as_mut() {
                set.remove(&key);
            }
        }
    }
    known.and_then(|(_, pr)| pr)
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
    fn a_fresh_answer_is_served_from_the_cache_without_asking_gh() {
        let key = ("/cached/but/not/real".to_string(), "feature".to_string());
        let pr = PullRequest {
            number: 3,
            state: "open",
            url: "https://github.com/o/r/pull/3".into(),
        };
        store(key.clone(), Some(pr.clone()));
        assert_eq!(for_branch(&key.0, &key.1), Some(pr));
        // A fresh "none" is served too: unknown and none both show nothing.
        let none = ("/cached/none".to_string(), "feature".to_string());
        store(none.clone(), None);
        assert_eq!(for_branch(&none.0, &none.1), None);
    }

    #[test]
    fn a_detached_head_or_empty_branch_asks_nothing() {
        // Would spawn `gh` in a directory that does not exist; the guard returns first.
        assert!(for_branch("/definitely/not/here", "").is_none());
        assert!(for_branch("/definitely/not/here", "3ebb886").is_none());
        assert!(for_branch("", "main").is_none());
    }
}
