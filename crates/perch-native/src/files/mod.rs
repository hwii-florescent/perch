//! Workspace files for the window: the store that keeps listings, documents and drafts as the
//! web's `filesystemStore.ts` does ([`store`]), and [`Files`], which ties it to the window: its
//! frames go to the core, the core's `fs.*` messages and connection changes come in, and the
//! draft debounce runs on the window's clock.

pub mod store;

use serde_json::Value;
use std::collections::{BTreeSet, HashMap};
use std::time::Instant;
use store::FileStore;

/// A file editor's document key, as the web's files screen makes it: `<workspace id>\0<path>\0<reload
/// epoch>`. Its workspace, path and epoch.
pub fn doc_key(key: &str) -> Option<(&str, &str, u64)> {
    let mut parts = key.split('\0');
    let (workspace, path, epoch) = (parts.next()?, parts.next()?, parts.next()?);
    (parts.next().is_none() && !workspace.is_empty())
        .then_some(())
        .and(epoch.parse().ok())
        .map(|epoch| (workspace, path, epoch))
}

/// The window's file store and the clock its debounce waits on.
#[derive(Default)]
pub struct Files {
    pub store: FileStore,
    /// The deadline a timer is already set for, so one is set per deadline.
    armed: Option<Instant>,
    /// Whether the window's editors hand this store their edits ([`crate::editor::Editors::bind`]).
    pub bound: bool,
    /// Each file editor's caret by document key, for the screen's status line.
    pub carets: HashMap<String, (usize, usize)>,
    /// Workspaces whose typing the screen has not been shown yet, and a count of the edits held,
    /// so only the timer of the last one shows them.
    pub held: BTreeSet<String>,
    pub typed: u64,
    /// The editors are to take the store's text (a load, a reload, an overwrite) at the next frame.
    pub resync: bool,
}

impl Files {
    /// A store that starts connected when the window opens on a live connection.
    pub fn new(connected: bool) -> Self {
        let mut files = Self::default();
        files.store.set_connected(connected);
        files
    }

    /// What to send now, the workspaces whose snapshot moved, and a deadline that needs a timer
    /// (none when one is already set for it).
    pub fn drain(&mut self) -> (Vec<Value>, Vec<String>, Option<Instant>) {
        let sent = self.store.take_sent();
        let changed = self.store.take_changed().into_iter().collect();
        let next = self.store.next_deadline();
        let arm = next.filter(|at| self.armed.is_none_or(|armed| *at < armed));
        if arm.is_some() {
            self.armed = arm;
        }
        (sent, changed, arm)
    }

    /// The snapshot a screen reads of workspace `workspace_id`: the store's, with the carets of
    /// its editors.
    pub fn snapshot(&self, workspace_id: &str) -> Value {
        let mut snapshot = self.store.snapshot(workspace_id);
        let carets: serde_json::Map<String, Value> = self
            .carets
            .iter()
            .filter(|(key, _)| doc_key(key).is_some_and(|(w, _, _)| w == workspace_id))
            .map(|(key, (line, col))| {
                (key.clone(), serde_json::json!({ "line": line, "col": col }))
            })
            .collect();
        snapshot["carets"] = Value::Object(carets);
        snapshot
    }

    /// A timer set by [`Self::drain`] ran out at `now`.
    pub fn fired(&mut self, now: Instant) {
        if self.armed.is_some_and(|at| at <= now) {
            self.armed = None;
        }
        self.store.tick(now);
    }
}
