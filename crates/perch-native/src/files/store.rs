//! The window's file store, with no GPUI: directory listings, open documents with their drafts,
//! previews, searches and archive extractions of each workspace, as the web's
//! `filesystemStore.ts` keeps them (same states, same transitions, same names on the wire and in
//! the screen's snapshot).
//!
//! A draft is never only here: every edit is sent to the core's durable buffer (`fs.buffer.set`,
//! [`DEBOUNCE`] after the last key, at once before a save), a save is an `fs.write` with the
//! expected disk version and buffer revision, and a mismatch keeps the draft and turns the
//! document into a `conflict`. A reply that is not the newest for its request key is dropped. A
//! disconnect forgets every request in flight but no text; a reconnect reads each unsynced
//! buffer back first (`fs.buffer.get`) so a lost acknowledgement is never replayed as a second
//! write. At most [`MAX_CACHED_DOCUMENTS`] documents are kept per workspace; dirty, conflicted,
//! loading and saving ones are never dropped.
//!
//! Input is the screen's actions, the core's `fs.*` messages ([`FileStore::handle`]), connection
//! changes and the clock ([`FileStore::tick`]). Output is frames to send ([`FileStore::take_sent`])
//! and the workspaces whose snapshot moved ([`FileStore::take_changed`]).

use perch_core::filesystem::{DirectoryEntry, FileMetadata, PreviewKind};
use perch_core::protocol::{FileBuffer, FileBufferSummary, ServerMessage};
use serde::Serialize;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::time::{Duration, Instant};

/// How long typing must pause before the draft is sent to the core's buffer.
pub const DEBOUNCE: Duration = Duration::from_millis(350);

/// Documents kept per workspace before clean ones are dropped, oldest opened first.
pub const MAX_CACHED_DOCUMENTS: usize = 32;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Load {
    #[default]
    Idle,
    Loading,
    Ready,
    Error,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum DocState {
    #[default]
    Idle,
    Loading,
    Ready,
    Saving,
    Conflict,
    Error,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum BufferState {
    Idle,
    Loading,
    Saving,
    Ready,
    Conflict,
    Error,
}

/// One lazy directory level. Entries stay while a refresh is in flight.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Tree {
    pub workspace_id: String,
    pub path: String,
    pub entries: Vec<DirectoryEntry>,
    pub truncated: bool,
    pub state: Load,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Conflict {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_buffer_revision: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual_buffer_revision: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current: Option<FileMetadata>,
}

/// One open text document: `content` is the draft shown, `saved_content` what the last read or
/// write returned, so dirty is `content != saved_content`.
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub workspace_id: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<FileMetadata>,
    pub content: String,
    pub saved_content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub persisted_content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub buffer_revision: Option<u64>,
    /// Bumped by a discard-and-reload: the editor starts a fresh undo history.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reload_epoch: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub buffer_state: Option<BufferState>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub read_request_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub buffer_request_id: Option<String>,
    pub state: DocState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conflict: Option<Conflict>,
}

impl Document {
    pub fn dirty(&self) -> bool {
        self.content != self.saved_content
    }

    /// Text the core's buffer may not have yet.
    fn needs_buffer_sync(&self) -> bool {
        self.dirty()
            || self
                .persisted_content
                .as_ref()
                .is_some_and(|p| *p != self.content)
            || self.buffer_state == Some(BufferState::Saving)
    }
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    pub workspace_id: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<FileMetadata>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<PreviewKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_type: Option<String>,
    pub requires_sandbox: bool,
    pub truncated: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    pub state: Load,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Search {
    pub query: String,
    pub entries: Vec<DirectoryEntry>,
    pub truncated: bool,
    pub state: Load,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Extraction {
    pub state: Load,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub destination: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BufferList {
    pub state: Load,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
enum Kind {
    Search,
    Extract,
    Tree,
    Read,
    Preview,
    Write,
    BufferList,
    BufferGet,
    BufferSet,
    BufferClose,
}

/// A request in flight and what its reply needs to know.
#[derive(Clone, Debug)]
struct Pending {
    workspace_id: String,
    kind: Kind,
    path: String,
    reconnect: bool,
    /// A save waits on this reconnect read: the version it expects.
    after_save: Option<Option<String>>,
    content: Option<String>,
    expected_version: Option<String>,
    /// The text shown when a read began: typing since outranks the reply.
    baseline_content: Option<String>,
}

impl Pending {
    fn new(workspace_id: &str, kind: Kind, path: &str) -> Self {
        Self {
            workspace_id: workspace_id.into(),
            kind,
            path: path.into(),
            reconnect: false,
            after_save: None,
            content: None,
            expected_version: None,
            baseline_content: None,
        }
    }
}

/// A save chained after a buffer write or a reconnect.
#[derive(Clone, Debug)]
struct Save {
    workspace_id: String,
    path: String,
    content: String,
    expected_version: Option<String>,
}

type Key = (String, String);

/// The workspace documents in the order they were first opened (the eviction order).
type Documents = Vec<(String, Document)>;

#[derive(Default)]
pub struct FileStore {
    connected: bool,
    next_id: u64,
    pub wrap: bool,
    trees: HashMap<String, HashMap<String, Tree>>,
    searches: HashMap<String, Search>,
    extractions: HashMap<String, HashMap<String, Extraction>>,
    documents: HashMap<String, Documents>,
    previews: HashMap<String, HashMap<String, Preview>>,
    buffer_summaries: HashMap<String, Vec<FileBufferSummary>>,
    buffer_lists: HashMap<String, BufferList>,
    pending: HashMap<String, Pending>,
    latest: HashMap<(Kind, String, String), String>,
    reloads: HashMap<String, Key>,
    save_after_buffer: HashMap<String, Save>,
    save_after_reconnect: HashMap<Key, Save>,
    timers: HashMap<Key, Instant>,
    sent: Vec<Value>,
    changed: HashSet<String>,
}

/// A workspace-relative path as the store keys it: no `./`, no leading or trailing slash.
pub fn normalize(path: &str) -> String {
    let path = path.trim();
    if path.is_empty() || path == "." {
        return String::new();
    }
    let path = path.strip_prefix("./").unwrap_or(path);
    path.trim_start_matches('/').trim_end_matches('/').into()
}

impl FileStore {
    /// A store whose connection to the core is up.
    pub fn connected() -> Self {
        Self {
            connected: true,
            ..Self::default()
        }
    }

    pub fn is_connected(&self) -> bool {
        self.connected
    }

    /// The frames to send, oldest first.
    pub fn take_sent(&mut self) -> Vec<Value> {
        std::mem::take(&mut self.sent)
    }

    /// The workspaces whose snapshot moved since the last call.
    pub fn take_changed(&mut self) -> HashSet<String> {
        std::mem::take(&mut self.changed)
    }

    /// When [`Self::tick`] next has something to send.
    pub fn next_deadline(&self) -> Option<Instant> {
        self.timers.values().min().copied()
    }

    pub fn document(&self, workspace_id: &str, path: &str) -> Option<&Document> {
        self.documents
            .get(workspace_id)?
            .iter()
            .find(|(p, _)| p == path)
            .map(|(_, d)| d)
    }

    pub fn documents_of(&self, workspace_id: &str) -> impl Iterator<Item = &Document> {
        self.documents
            .get(workspace_id)
            .into_iter()
            .flatten()
            .map(|(_, d)| d)
    }

    pub fn tree(&self, workspace_id: &str, path: &str) -> Option<&Tree> {
        self.trees.get(workspace_id)?.get(path)
    }

    pub fn search(&self, workspace_id: &str) -> Option<&Search> {
        self.searches.get(workspace_id)
    }

    pub fn extraction(&self, workspace_id: &str, path: &str) -> Option<&Extraction> {
        self.extractions.get(workspace_id)?.get(path)
    }

    pub fn preview(&self, workspace_id: &str, path: &str) -> Option<&Preview> {
        self.previews.get(workspace_id)?.get(path)
    }

    pub fn buffer_list(&self, workspace_id: &str) -> Option<(&BufferList, &[FileBufferSummary])> {
        Some((
            self.buffer_lists.get(workspace_id)?,
            self.buffer_summaries
                .get(workspace_id)
                .map_or(&[][..], Vec::as_slice),
        ))
    }

    /// Whether any draft may not have reached the core's buffer yet.
    pub fn has_unsynced_draft(&self) -> bool {
        self.documents
            .values()
            .flatten()
            .any(|(_, d)| d.needs_buffer_sync())
    }

    /// `trees`, `documents`, `previews`, `search`, `extractions` and `wrap` of one workspace, by
    /// the web's names.
    pub fn snapshot(&self, workspace_id: &str) -> Value {
        fn value(v: &impl Serialize) -> Value {
            serde_json::to_value(v).unwrap_or(Value::Null)
        }
        let docs: Map<String, Value> = self
            .documents_of(workspace_id)
            .zip(self.documents.get(workspace_id).into_iter().flatten())
            .map(|(d, (path, _))| (path.clone(), value(d)))
            .collect();
        json!({
            "trees": self.trees.get(workspace_id).map_or(json!({}), value),
            "documents": docs,
            "previews": self.previews.get(workspace_id).map_or(json!({}), value),
            "search": value(&self.searches.get(workspace_id)),
            "extractions": self.extractions.get(workspace_id).map_or(json!({}), value),
            "wrap": self.wrap,
        })
    }

    // Requests ----------------------------------------------------------------------------------

    fn begin(&mut self, pending: Pending) -> Option<String> {
        if pending.workspace_id.is_empty() || !self.connected {
            return None;
        }
        self.next_id += 1;
        let id = format!("fs-{}", self.next_id);
        self.latest.insert(
            (
                pending.kind,
                pending.workspace_id.clone(),
                pending.path.clone(),
            ),
            id.clone(),
        );
        self.pending.insert(id.clone(), pending);
        Some(id)
    }

    fn finish(&mut self, id: &str, pending: &Pending) {
        self.pending.remove(id);
        let key = (
            pending.kind,
            pending.workspace_id.clone(),
            pending.path.clone(),
        );
        if self.latest.get(&key).map(String::as_str) == Some(id) {
            self.latest.remove(&key);
        }
    }

    fn is_latest(&self, id: &str, pending: &Pending) -> bool {
        let key = (
            pending.kind,
            pending.workspace_id.clone(),
            pending.path.clone(),
        );
        self.latest.get(&key).map(String::as_str) == Some(id)
    }

    fn send(&mut self, frame: Value) {
        self.sent.push(frame);
    }

    fn is_pending(&self, id: Option<&String>, kind: Kind) -> bool {
        id.and_then(|id| self.pending.get(id))
            .is_some_and(|p| p.kind == kind)
    }

    // Documents ---------------------------------------------------------------------------------

    fn document_for(&self, workspace_id: &str, path: &str) -> Document {
        self.document(workspace_id, path)
            .cloned()
            .unwrap_or_else(|| Document {
                workspace_id: workspace_id.into(),
                path: path.into(),
                ..Document::default()
            })
    }

    /// Puts `doc` at `path` (in place when known, else last) and drops the clean documents opened
    /// longest ago beyond [`MAX_CACHED_DOCUMENTS`].
    fn put(&mut self, workspace_id: &str, path: &str, doc: Document) {
        self.changed.insert(workspace_id.into());
        let docs = self.documents.entry(workspace_id.into()).or_default();
        match docs.iter_mut().find(|(p, _)| p == path) {
            Some(slot) => slot.1 = doc,
            None => docs.push((path.into(), doc)),
        }
        let over = docs.len().saturating_sub(MAX_CACHED_DOCUMENTS);
        if over == 0 {
            return;
        }
        let evictable: Vec<String> = docs
            .iter()
            .filter(|(p, d)| {
                p != path
                    && !d.dirty()
                    && matches!(d.state, DocState::Ready | DocState::Idle | DocState::Error)
            })
            .take(over)
            .map(|(p, _)| p.clone())
            .collect();
        docs.retain(|(p, _)| !evictable.contains(p));
    }

    fn update(&mut self, workspace_id: &str, path: &str, f: impl FnOnce(&mut Document)) {
        let mut doc = self.document_for(workspace_id, path);
        f(&mut doc);
        self.put(workspace_id, path, doc);
    }

    fn schedule(&mut self, workspace_id: &str, path: &str, now: Instant) {
        self.timers
            .insert((workspace_id.into(), path.into()), now + DEBOUNCE);
    }

    fn cancel_timer(&mut self, workspace_id: &str, path: &str) {
        self.timers
            .remove(&(workspace_id.to_string(), path.to_string()));
    }

    /// Sends the drafts whose pause has run out.
    pub fn tick(&mut self, now: Instant) {
        let due: Vec<Key> = self
            .timers
            .iter()
            .filter(|(_, at)| **at <= now)
            .map(|(k, _)| k.clone())
            .collect();
        for key in due {
            self.timers.remove(&key);
            self.send_buffer_set(&key.0, &key.1, None);
        }
    }

    fn send_write(
        &mut self,
        workspace_id: &str,
        path: &str,
        content: String,
        expected_version: Option<String>,
        expected_buffer_revision: Option<u64>,
    ) -> Option<String> {
        let mut pending = Pending::new(workspace_id, Kind::Write, path);
        pending.content = Some(content.clone());
        pending.expected_version = expected_version.clone();
        let id = self.begin(pending)?;
        self.update(workspace_id, path, |d| {
            d.state = DocState::Saving;
            d.request_id = Some(id.clone());
            d.error = None;
            d.conflict = None;
        });
        let mut frame = json!({"type": "fs.write", "requestId": id, "workspaceId": workspace_id, "path": path, "content": content});
        if let Some(v) = expected_version {
            frame["expectedVersion"] = json!(v);
        }
        if let Some(r) = expected_buffer_revision {
            frame["expectedBufferRevision"] = json!(r);
        }
        self.send(frame);
        Some(id)
    }

    /// Persists the draft to the core's buffer; `after_save` chains a disk save expecting that
    /// version once the buffer answers.
    fn send_buffer_set(
        &mut self,
        workspace_id: &str,
        path: &str,
        after_save: Option<Option<String>>,
    ) -> Option<String> {
        let current = self.document(workspace_id, path)?.clone();
        if !self.connected {
            return None;
        }
        if self.is_pending(current.buffer_request_id.as_ref(), Kind::BufferSet) {
            return current.buffer_request_id;
        }
        let base = current
            .base_content
            .clone()
            .unwrap_or_else(|| current.saved_content.clone());
        let mut pending = Pending::new(workspace_id, Kind::BufferSet, path);
        pending.content = Some(current.content.clone());
        let id = self.begin(pending)?;
        let saving = after_save.is_some();
        if let Some(expected_version) = after_save {
            self.save_after_buffer.insert(
                id.clone(),
                Save {
                    workspace_id: workspace_id.into(),
                    path: path.into(),
                    content: current.content.clone(),
                    expected_version,
                },
            );
        }
        self.update(workspace_id, path, |d| {
            d.state = if saving {
                DocState::Saving
            } else if d.state == DocState::Conflict {
                DocState::Conflict
            } else {
                DocState::Ready
            };
            if saving {
                d.request_id = Some(id.clone());
            }
            d.buffer_state = Some(BufferState::Saving);
            d.buffer_request_id = Some(id.clone());
            d.error = None;
        });
        let mut frame = json!({"type": "fs.buffer.set", "requestId": id, "workspaceId": workspace_id, "path": path, "content": current.content, "baseContent": base});
        if let Some(r) = current.buffer_revision {
            frame["expectedBufferRevision"] = json!(r);
        }
        self.send(frame);
        Some(id)
    }

    /// Reads the core's newest buffer before retrying after a dropped connection: the last set
    /// may have landed just before the drop.
    fn request_buffer_resync(
        &mut self,
        workspace_id: &str,
        path: &str,
        after_save: Option<Option<String>>,
    ) -> Option<String> {
        let current = self.document(workspace_id, path)?.clone();
        let mut pending = Pending::new(workspace_id, Kind::BufferGet, path);
        pending.baseline_content = Some(current.content);
        pending.reconnect = true;
        let saving = after_save.is_some();
        pending.after_save = after_save;
        let id = self.begin(pending)?;
        self.update(workspace_id, path, |d| {
            d.state = if saving {
                DocState::Saving
            } else {
                DocState::Loading
            };
            d.request_id = Some(id.clone());
            d.buffer_request_id = Some(id.clone());
            d.buffer_state = Some(BufferState::Loading);
            d.error = None;
        });
        self.send(json!({"type": "fs.buffer.get", "requestId": id, "workspaceId": workspace_id, "path": path}));
        Some(id)
    }

    // Actions -----------------------------------------------------------------------------------

    pub fn set_wrap(&mut self, wrap: bool, workspace_id: &str) {
        self.wrap = wrap;
        self.changed.insert(workspace_id.into());
    }

    pub fn search_files(&mut self, workspace_id: &str, query: &str) -> Option<String> {
        let id = self.begin(Pending::new(workspace_id, Kind::Search, ""));
        self.searches.insert(
            workspace_id.into(),
            Search {
                query: query.into(),
                entries: Vec::new(),
                truncated: false,
                state: if id.is_some() {
                    Load::Loading
                } else {
                    Load::Error
                },
                error: id
                    .is_none()
                    .then(|| "Disconnected. Reconnect and retry search.".into()),
            },
        );
        self.changed.insert(workspace_id.into());
        if let Some(id) = &id {
            self.send(json!({"type": "fs.search", "requestId": id, "workspaceId": workspace_id, "query": query}));
        }
        id
    }

    pub fn extract_archive(&mut self, workspace_id: &str, path: &str) -> Option<String> {
        if self.extraction(workspace_id, path).map(|e| e.state) == Some(Load::Loading) {
            return None;
        }
        let id = self.begin(Pending::new(workspace_id, Kind::Extract, path));
        self.set_extraction(
            workspace_id,
            path,
            Extraction {
                state: if id.is_some() {
                    Load::Loading
                } else {
                    Load::Error
                },
                destination: None,
                error: id
                    .is_none()
                    .then(|| "Disconnected. Reconnect before extracting.".into()),
            },
        );
        if let Some(id) = &id {
            self.send(json!({"type": "fs.extract", "requestId": id, "workspaceId": workspace_id, "path": path}));
        }
        id
    }

    fn set_extraction(&mut self, workspace_id: &str, path: &str, extraction: Extraction) {
        self.extractions
            .entry(workspace_id.into())
            .or_default()
            .insert(path.into(), extraction);
        self.changed.insert(workspace_id.into());
    }

    fn tree_for(&self, workspace_id: &str, path: &str) -> Tree {
        self.tree(workspace_id, path).cloned().unwrap_or(Tree {
            workspace_id: workspace_id.into(),
            path: path.into(),
            entries: Vec::new(),
            truncated: false,
            state: Load::Idle,
            request_id: None,
            error: None,
        })
    }

    fn set_tree(&mut self, workspace_id: &str, path: &str, tree: Tree) {
        self.trees
            .entry(workspace_id.into())
            .or_default()
            .insert(path.into(), tree);
        self.changed.insert(workspace_id.into());
    }

    pub fn request_tree(&mut self, workspace_id: &str, path: &str) -> Option<String> {
        let path = normalize(path);
        let id = self.begin(Pending::new(workspace_id, Kind::Tree, &path))?;
        let mut tree = self.tree_for(workspace_id, &path);
        tree.state = Load::Loading;
        tree.request_id = Some(id.clone());
        tree.error = None;
        self.set_tree(workspace_id, &path, tree);
        let mut frame = json!({"type": "fs.tree", "requestId": id, "workspaceId": workspace_id});
        if !path.is_empty() {
            frame["path"] = json!(path);
        }
        self.send(frame);
        Some(id)
    }

    pub fn request_buffer_list(&mut self, workspace_id: &str) -> Option<String> {
        let id = self.begin(Pending::new(workspace_id, Kind::BufferList, ""))?;
        self.buffer_lists.insert(
            workspace_id.into(),
            BufferList {
                state: Load::Loading,
                error: None,
                request_id: Some(id.clone()),
            },
        );
        self.changed.insert(workspace_id.into());
        self.send(json!({"type": "fs.buffer.list", "requestId": id, "workspaceId": workspace_id}));
        Some(id)
    }

    /// Reads a file and its durable buffer. A dirty document is left alone unless `force`.
    pub fn open_file(&mut self, workspace_id: &str, path: &str, force: bool) -> Option<String> {
        let path = normalize(path);
        if path.is_empty() {
            return None;
        }
        let current = self.document(workspace_id, &path);
        if current.is_some_and(|d| d.state == DocState::Saving) {
            return None;
        }
        if !force && current.is_some_and(Document::dirty) {
            return None;
        }
        let baseline = current.map(|d| d.content.clone()).unwrap_or_default();
        let mut get = Pending::new(workspace_id, Kind::BufferGet, &path);
        get.baseline_content = Some(baseline.clone());
        let buffer_id = self.begin(get);
        let mut read = Pending::new(workspace_id, Kind::Read, &path);
        read.baseline_content = Some(baseline);
        let read_id = self.begin(read);
        let id = buffer_id.clone().or_else(|| read_id.clone())?;
        self.update(workspace_id, &path, |d| {
            d.state = DocState::Loading;
            d.request_id = Some(id.clone());
            d.read_request_id = read_id.clone();
            d.buffer_request_id = buffer_id.clone();
            d.buffer_state = Some(if buffer_id.is_some() {
                BufferState::Loading
            } else {
                BufferState::Error
            });
            d.error = None;
            d.conflict = None;
        });
        if let Some(b) = &buffer_id {
            self.send(json!({"type": "fs.buffer.get", "requestId": b, "workspaceId": workspace_id, "path": path}));
        }
        if let Some(r) = &read_id {
            self.send(json!({"type": "fs.read", "requestId": r, "workspaceId": workspace_id, "path": path}));
        }
        Some(id)
    }

    /// Discards the draft and reads the file again (the caller asks the person first).
    pub fn reload_file(&mut self, workspace_id: &str, path: &str) -> Option<String> {
        let path = normalize(path);
        if path.is_empty() {
            return None;
        }
        let current = self.document(workspace_id, &path).cloned();
        // A buffer write in flight owns the newest revision: wait for its reply.
        if current.as_ref().and_then(|d| d.buffer_state) == Some(BufferState::Saving) {
            return None;
        }
        let revision = current.and_then(|d| d.buffer_revision);
        if let (Some(revision), true) = (revision, self.connected) {
            let id = self.begin(Pending::new(workspace_id, Kind::BufferClose, &path))?;
            self.reloads
                .insert(id.clone(), (workspace_id.into(), path.clone()));
            self.update(workspace_id, &path, |d| {
                d.state = DocState::Loading;
                d.request_id = Some(id.clone());
                d.buffer_request_id = Some(id.clone());
                d.buffer_state = Some(BufferState::Saving);
                d.error = None;
                d.conflict = None;
            });
            self.send(json!({"type": "fs.buffer.close", "requestId": id, "workspaceId": workspace_id, "path": path, "expectedBufferRevision": revision, "discard": true}));
            return Some(id);
        }
        self.open_file(workspace_id, &path, true)
    }

    pub fn request_preview(&mut self, workspace_id: &str, path: &str) -> Option<String> {
        let path = normalize(path);
        if path.is_empty() {
            return None;
        }
        let id = self.begin(Pending::new(workspace_id, Kind::Preview, &path))?;
        let mut preview = self.preview_for(workspace_id, &path);
        preview.state = Load::Loading;
        preview.request_id = Some(id.clone());
        preview.error = None;
        self.set_preview(workspace_id, &path, preview);
        self.send(json!({"type": "fs.preview", "requestId": id, "workspaceId": workspace_id, "path": path}));
        Some(id)
    }

    fn preview_for(&self, workspace_id: &str, path: &str) -> Preview {
        self.preview(workspace_id, path)
            .cloned()
            .unwrap_or_else(|| Preview {
                workspace_id: workspace_id.into(),
                path: path.into(),
                ..Preview::default()
            })
    }

    fn set_preview(&mut self, workspace_id: &str, path: &str, preview: Preview) {
        self.previews
            .entry(workspace_id.into())
            .or_default()
            .insert(path.into(), preview);
        self.changed.insert(workspace_id.into());
    }

    /// The person's edit: shown at once, sent to the core's buffer after [`DEBOUNCE`].
    pub fn update_draft(&mut self, workspace_id: &str, path: &str, content: String, now: Instant) {
        let path = normalize(path);
        if path.is_empty() {
            return;
        }
        self.update(workspace_id, &path, |d| {
            d.content = content;
            d.buffer_state = Some(if d.buffer_state == Some(BufferState::Conflict) {
                BufferState::Conflict
            } else {
                BufferState::Saving
            });
            d.error = None;
        });
        self.schedule(workspace_id, &path, now);
    }

    /// Saves the draft: through the buffer first when the core keeps one, so disk gets exactly
    /// the text shown when Save was pressed.
    pub fn save_file(
        &mut self,
        workspace_id: &str,
        path: &str,
        expected_version: Option<String>,
    ) -> Option<String> {
        let path = normalize(path);
        let current = self.document(workspace_id, &path)?.clone();
        if current.state == DocState::Saving || !self.connected {
            return None;
        }
        let expected = expected_version
            .or_else(|| current.base_version.clone())
            .or_else(|| current.version.clone());
        if self.is_pending(current.buffer_request_id.as_ref(), Kind::BufferSet) {
            let buffer_id = current.buffer_request_id.clone().unwrap();
            self.save_after_buffer.insert(
                buffer_id.clone(),
                Save {
                    workspace_id: workspace_id.into(),
                    path: path.clone(),
                    content: current.content.clone(),
                    expected_version: expected,
                },
            );
            self.update(workspace_id, &path, |d| {
                d.state = DocState::Saving;
                d.request_id = Some(buffer_id.clone());
                d.error = None;
                d.conflict = None;
            });
            return Some(buffer_id);
        }
        self.cancel_timer(workspace_id, &path);
        if current.buffer_state != Some(BufferState::Error) && current.buffer_revision.is_some() {
            return self.send_buffer_set(workspace_id, &path, Some(expected));
        }
        self.send_write(
            workspace_id,
            &path,
            current.content,
            expected,
            current.buffer_revision,
        )
    }

    /// Writes the draft over the disk version the conflict reported.
    pub fn overwrite_file(&mut self, workspace_id: &str, path: &str) -> Option<String> {
        let path = normalize(path);
        let current = self.document(workspace_id, &path)?.clone();
        if current.state == DocState::Saving || !self.connected {
            return None;
        }
        self.cancel_timer(workspace_id, &path);
        let expected = current
            .conflict
            .as_ref()
            .and_then(|c| c.actual_version.clone())
            .or(current.base_version)
            .or(current.version);
        self.send_write(
            workspace_id,
            &path,
            current.content,
            expected,
            current.buffer_revision,
        )
    }

    pub fn clear_workspace(&mut self, workspace_id: &str) {
        self.trees.remove(workspace_id);
        self.documents.remove(workspace_id);
        self.previews.remove(workspace_id);
        self.searches.remove(workspace_id);
        self.extractions.remove(workspace_id);
        self.buffer_summaries.remove(workspace_id);
        self.buffer_lists.remove(workspace_id);
        self.timers.retain(|k, _| k.0 != workspace_id);
        self.reloads.retain(|_, k| k.0 != workspace_id);
        self.save_after_buffer
            .retain(|_, s| s.workspace_id != workspace_id);
        self.save_after_reconnect
            .retain(|_, s| s.workspace_id != workspace_id);
        self.pending.retain(|_, p| p.workspace_id != workspace_id);
        self.latest.retain(|k, _| k.1 != workspace_id);
        self.changed.insert(workspace_id.into());
    }

    // Connection --------------------------------------------------------------------------------

    /// The connection to the core went down or came back.
    pub fn set_connected(&mut self, connected: bool) {
        if self.connected == connected {
            return;
        }
        self.connected = connected;
        if connected {
            self.resync_after_reconnect(None);
        } else {
            self.invalidate_on_disconnect();
        }
    }

    /// Forgets every request in flight (their replies can no longer arrive) but no text; a save
    /// that waited on a buffer write waits for the reconnect instead.
    fn invalidate_on_disconnect(&mut self) {
        for (_, save) in std::mem::take(&mut self.save_after_buffer) {
            self.save_after_reconnect
                .insert((save.workspace_id.clone(), save.path.clone()), save);
        }
        let pending: Vec<Pending> = self.pending.drain().map(|(_, p)| p).collect();
        for p in pending {
            match p.kind {
                Kind::Search => {
                    if let Some(s) = self.searches.get_mut(&p.workspace_id) {
                        s.state = Load::Error;
                        s.error = Some("Disconnected. Retry search after reconnecting.".into());
                        self.changed.insert(p.workspace_id.clone());
                    }
                }
                Kind::Extract => self.set_extraction(
                    &p.workspace_id,
                    &p.path,
                    Extraction {
                        state: Load::Error,
                        destination: None,
                        error: Some("Connection lost. Refresh the folder to check whether extraction finished before retrying.".into()),
                    },
                ),
                _ => {}
            }
        }
        self.reloads.clear();
        self.latest.clear();
        for (workspace_id, docs) in &mut self.documents {
            for (_, d) in docs.iter_mut() {
                let before = (
                    d.state,
                    d.buffer_state,
                    d.request_id.is_some()
                        || d.read_request_id.is_some()
                        || d.buffer_request_id.is_some(),
                );
                d.request_id = None;
                d.read_request_id = None;
                d.buffer_request_id = None;
                if matches!(d.state, DocState::Loading | DocState::Saving) {
                    d.state = if d.state == DocState::Loading && d.content.is_empty() {
                        DocState::Idle
                    } else {
                        DocState::Ready
                    };
                }
                if d.buffer_state == Some(BufferState::Saving) {
                    d.buffer_state = Some(BufferState::Idle);
                }
                if before != (d.state, d.buffer_state, false) {
                    self.changed.insert(workspace_id.clone());
                }
            }
        }
    }

    /// Sends every draft the core's buffer may lack now (window closing, reconnect). Whether any
    /// was seen.
    pub fn flush_pending_buffers(&mut self) -> bool {
        if !self.connected {
            return false;
        }
        let mut unsynced = false;
        let waiting: Vec<(Key, Save)> = self
            .save_after_reconnect
            .iter()
            .map(|(k, s)| (k.clone(), s.clone()))
            .collect();
        for (key, save) in waiting {
            let Some(doc) = self.document(&save.workspace_id, &save.path) else {
                self.save_after_reconnect.remove(&key);
                continue;
            };
            unsynced |= doc.needs_buffer_sync();
            if self
                .send_buffer_set(&save.workspace_id, &save.path, Some(save.expected_version))
                .is_some()
            {
                self.save_after_reconnect.remove(&key);
            }
        }
        for (workspace_id, path) in self.unsynced(None) {
            unsynced = true;
            self.timers.remove(&(workspace_id.clone(), path.clone()));
            self.send_buffer_set(&workspace_id, &path, None);
        }
        unsynced
    }

    fn unsynced(&self, only: Option<&HashSet<String>>) -> Vec<Key> {
        self.documents
            .iter()
            .filter(|(w, _)| only.is_none_or(|o| o.contains(*w)))
            .flat_map(|(w, docs)| {
                docs.iter()
                    .filter(|(_, d)| d.needs_buffer_sync())
                    .map(|(p, _)| (w.clone(), p.clone()))
            })
            .collect()
    }

    /// Reads back each unsynced buffer of `only` (all when `None`) before anything is retried.
    pub fn resync_after_reconnect(&mut self, only: Option<&HashSet<String>>) {
        if !self.connected {
            return;
        }
        let mut keys: Vec<Key> = self
            .save_after_reconnect
            .keys()
            .filter(|k| only.is_none_or(|o| o.contains(&k.0)))
            .cloned()
            .collect();
        for key in self.unsynced(only) {
            if !keys.contains(&key) {
                keys.push(key);
            }
        }
        for key in keys {
            if self.document(&key.0, &key.1).is_none() {
                continue;
            }
            let save = self.save_after_reconnect.get(&key).cloned();
            let id = self.request_buffer_resync(
                &key.0,
                &key.1,
                save.as_ref().map(|s| s.expected_version.clone()),
            );
            if id.is_some() && save.is_some() {
                self.save_after_reconnect.remove(&key);
            }
        }
    }

    // Replies -----------------------------------------------------------------------------------

    /// Takes one of the core's `fs.*` messages; false when it is not one this store reads.
    pub fn handle(&mut self, message: &ServerMessage, now: Instant) -> bool {
        use ServerMessage as M;
        if let M::FsChanged {
            workspace_id,
            path,
            version,
            metadata,
            buffer_revision,
            conflict,
            ..
        } = message
        {
            self.on_changed(
                workspace_id,
                &normalize(path),
                version,
                metadata,
                *buffer_revision,
                *conflict,
            );
            return true;
        }
        let (id, workspace_id, path): (&str, &str, Option<String>) = match message {
            M::FsSearchResult {
                request_id,
                workspace_id,
                ..
            }
            | M::FsReadResult {
                request_id,
                workspace_id,
                ..
            }
            | M::FsPreviewResult {
                request_id,
                workspace_id,
                ..
            }
            | M::FsWriteResult {
                request_id,
                workspace_id,
                ..
            } => (request_id, workspace_id, None),
            M::FsBufferListResult {
                request_id,
                workspace_id,
                ..
            } => (request_id, workspace_id, Some(String::new())),
            M::FsBufferResult {
                request_id,
                workspace_id,
                buffer,
            } => (request_id, workspace_id, Some(normalize(&buffer.path))),
            M::FsExtractResult {
                request_id,
                workspace_id,
                path,
                ..
            }
            | M::FsTreeResult {
                request_id,
                workspace_id,
                path,
                ..
            }
            | M::FsBufferCloseResult {
                request_id,
                workspace_id,
                path,
                ..
            } => (request_id, workspace_id, Some(normalize(path))),
            M::FsError {
                request_id,
                workspace_id,
                path,
                ..
            } => (request_id, workspace_id, path.as_deref().map(normalize)),
            _ => return false,
        };
        let Some(pending) = self.pending.get(id).cloned() else {
            return true;
        };
        if pending.workspace_id != workspace_id {
            return true;
        }
        let message_path = match pending.kind {
            Kind::Search | Kind::Extract => pending.path.clone(),
            _ => path.unwrap_or_else(|| pending.path.clone()),
        };
        if pending.path != message_path || !self.is_latest(id, &pending) {
            self.pending.remove(id);
            return true;
        }
        self.finish(id, &pending);
        let (w, p) = (pending.workspace_id.as_str(), pending.path.as_str());
        match message {
            M::FsSearchResult {
                query,
                entries,
                truncated,
                ..
            } => {
                self.searches.insert(
                    w.into(),
                    Search {
                        query: query.clone(),
                        entries: entries.clone(),
                        truncated: *truncated,
                        state: Load::Ready,
                        error: None,
                    },
                );
                self.changed.insert(w.into());
            }
            M::FsExtractResult {
                path, destination, ..
            } => {
                self.set_extraction(
                    w,
                    path,
                    Extraction {
                        state: Load::Ready,
                        destination: Some(destination.clone()),
                        error: None,
                    },
                );
                // Refresh the archive's parent, even if it was reached through search.
                let parent = path.rsplit_once('/').map_or("", |(dir, _)| dir).to_string();
                self.request_tree(w, &parent);
                if let Some(query) = self.searches.get(w).map(|s| s.query.clone()) {
                    if !query.is_empty() {
                        self.search_files(w, &query);
                    }
                }
            }
            M::FsTreeResult {
                path,
                entries,
                truncated,
                ..
            } => {
                let mut tree = self.tree_for(w, p);
                tree.path = normalize(path);
                tree.entries = entries.clone();
                tree.truncated = *truncated;
                tree.state = Load::Ready;
                tree.request_id = None;
                tree.error = None;
                self.set_tree(w, p, tree);
            }
            M::FsBufferListResult { buffers, .. } => {
                self.buffer_summaries.insert(w.into(), buffers.clone());
                self.buffer_lists.insert(
                    w.into(),
                    BufferList {
                        state: Load::Ready,
                        error: None,
                        request_id: None,
                    },
                );
                self.changed.insert(w.into());
            }
            M::FsBufferResult { buffer, .. } => self.on_buffer(id, &pending, buffer, now),
            M::FsBufferCloseResult { .. } => {
                if let Some((w, p)) = self.reloads.remove(id) {
                    // The close carried an explicit discard: clear the old draft and base so the
                    // fresh read is a new disk baseline, not typing to preserve.
                    self.update(&w, &p, |d| {
                        d.reload_epoch = Some(d.reload_epoch.unwrap_or(0) + 1);
                        d.content.clear();
                        d.saved_content.clear();
                        d.persisted_content = None;
                        d.base_content = None;
                        d.base_version = None;
                        d.external_version = None;
                        d.buffer_revision = None;
                        d.state = DocState::Loading;
                        d.request_id = None;
                        d.buffer_request_id = None;
                        d.buffer_state = Some(BufferState::Loading);
                        d.error = None;
                        d.conflict = None;
                    });
                    self.open_file(&w, &p, true);
                }
            }
            M::FsReadResult {
                metadata,
                content,
                version,
                ..
            } => self.on_read(id, &pending, metadata, content, version),
            M::FsPreviewResult {
                metadata,
                version,
                kind,
                content,
                media_type,
                requires_sandbox,
                truncated,
                message,
                ..
            } => self.set_preview(
                w,
                p,
                Preview {
                    workspace_id: w.into(),
                    path: metadata.path.clone(),
                    metadata: Some(metadata.clone()),
                    version: version.clone(),
                    kind: Some(*kind),
                    content: content.clone(),
                    media_type: media_type.clone(),
                    requires_sandbox: *requires_sandbox,
                    truncated: *truncated,
                    message: message.clone(),
                    state: Load::Ready,
                    request_id: None,
                    error: None,
                },
            ),
            M::FsWriteResult {
                metadata,
                version,
                buffer_revision,
                ..
            } => {
                let current = self.document_for(w, p);
                let saved = pending
                    .content
                    .clone()
                    .unwrap_or_else(|| current.content.clone());
                let in_flight =
                    self.is_pending(current.buffer_request_id.as_ref(), Kind::BufferSet);
                let schedule = current.content != saved && !in_flight;
                self.update(w, p, |d| {
                    d.path = metadata.path.clone();
                    d.metadata = Some(metadata.clone());
                    d.saved_content = saved.clone();
                    d.persisted_content = Some(saved.clone());
                    d.base_content = Some(saved);
                    d.base_version = Some(version.clone());
                    d.external_version = Some(version.clone());
                    d.version = Some(version.clone());
                    d.buffer_revision = buffer_revision.or(d.buffer_revision);
                    // Typing during the save stays dirty, to be saved against the new version.
                    let state = if in_flight {
                        BufferState::Saving
                    } else {
                        BufferState::Ready
                    };
                    d.buffer_state = Some(state);
                    d.state = if in_flight {
                        DocState::Saving
                    } else {
                        DocState::Ready
                    };
                    if d.request_id.as_deref() == Some(id) {
                        d.request_id = None;
                    }
                    d.error = None;
                    d.conflict = None;
                });
                if schedule {
                    self.schedule(w, p, now);
                }
            }
            M::FsError { .. } => self.on_error(id, &pending, message),
            _ => {}
        }
        true
    }

    /// A watcher's word that a file changed on disk: invalidation only. A clean document takes
    /// the new version; a dirty or in-flight draft stays and is marked conflicted.
    fn on_changed(
        &mut self,
        workspace_id: &str,
        path: &str,
        version: &Option<String>,
        metadata: &Option<FileMetadata>,
        buffer_revision: Option<u64>,
        conflict: bool,
    ) {
        let Some(current) = self.document(workspace_id, path) else {
            return;
        };
        let dirty = current.dirty()
            || matches!(
                current.buffer_state,
                Some(BufferState::Saving | BufferState::Conflict)
            );
        if !dirty && !conflict {
            self.update(workspace_id, path, |d| {
                d.external_version = version.clone().or(d.external_version.take());
                d.version = version.clone().or(d.version.take());
                d.metadata = metadata.clone().or(d.metadata.take());
            });
            return;
        }
        self.update(workspace_id, path, |d| {
            d.metadata = metadata.clone().or(d.metadata.take());
            d.external_version = version.clone().or(d.external_version.take());
            d.buffer_revision = buffer_revision.or(d.buffer_revision);
            d.buffer_state = Some(BufferState::Conflict);
            if d.state != DocState::Saving {
                d.state = DocState::Conflict;
            }
            d.conflict = Some(Conflict {
                message: "File changed on disk.".into(),
                expected_version: d.base_version.clone().or(d.version.clone()),
                actual_version: d.external_version.clone(),
                current: metadata.clone(),
                ..Conflict::default()
            });
        });
    }

    fn on_buffer(&mut self, id: &str, pending: &Pending, buffer: &FileBuffer, now: Instant) {
        let (w, p) = (pending.workspace_id.as_str(), pending.path.as_str());
        let chained = (pending.kind == Kind::BufferSet)
            .then(|| self.save_after_buffer.get(id).cloned())
            .flatten();
        // The save waiting on this reply: the version it expects.
        let pending_save: Option<Option<String>> = if pending.kind == Kind::BufferSet {
            chained.as_ref().map(|s| s.expected_version.clone())
        } else if pending.reconnect {
            pending.after_save.clone()
        } else {
            None
        };
        let current = self.document_for(w, p);
        let owns = current.buffer_request_id.as_deref() == Some(id);
        let preserve = pending.kind == Kind::BufferGet
            && (pending.reconnect
                // fs.read and fs.buffer.get race; only a dirty or pending local edit outranks
                // the durable buffer.
                || current.buffer_state == Some(BufferState::Saving)
                || current.dirty());
        let reconnect_conflict = pending.reconnect
            && current
                .buffer_revision
                .is_some_and(|r| r != buffer.revision)
            && current.content != buffer.content;
        let conflict = buffer.conflict || reconnect_conflict;
        let chain = pending.kind == Kind::BufferSet && pending_save.is_some();
        if chain {
            self.save_after_buffer.remove(id);
        }
        // The ack describes what was sent: text typed since outranks it.
        let typed_since = pending.kind == Kind::BufferSet
            && pending
                .content
                .as_ref()
                .is_some_and(|c| *c != current.content);
        let content = if preserve || typed_since {
            current.content.clone()
        } else {
            buffer.content.clone()
        };
        let schedule = !chain && !conflict && (preserve || typed_since);
        let retry = pending.reconnect
            && !reconnect_conflict
            && (pending_save.is_some() || current.content != buffer.content);
        let state = if conflict {
            DocState::Conflict
        } else if chain
            || (current.state == DocState::Saving && current.request_id.as_deref() != Some(id))
        {
            // A chained save, or a save another request owns, is still going.
            DocState::Saving
        } else {
            DocState::Ready
        };
        let mut d = current.clone();
        d.workspace_id = w.into();
        d.path = buffer.path.clone();
        d.content = content;
        d.saved_content = buffer.base_content.clone();
        d.persisted_content = Some(buffer.content.clone());
        d.base_content = Some(buffer.base_content.clone());
        d.base_version = buffer.base_version.clone();
        d.external_version = buffer.external_version.clone();
        d.buffer_revision = Some(buffer.revision);
        d.buffer_state = Some(if conflict {
            BufferState::Conflict
        } else {
            BufferState::Ready
        });
        // A metadata read may still be in flight: keep its id so its reply merges metadata only.
        d.request_id = if chain {
            None
        } else {
            current.read_request_id.clone().or(if owns {
                None
            } else {
                current.request_id.clone()
            })
        };
        if owns {
            d.buffer_request_id = None;
        }
        d.version = buffer
            .base_version
            .clone()
            .or(buffer.external_version.clone())
            .or(current.version.clone());
        d.state = state;
        d.error = None;
        d.conflict = conflict.then(|| Conflict {
            message: "File changed on disk.".into(),
            expected_version: buffer.base_version.clone(),
            actual_version: buffer.external_version.clone(),
            expected_buffer_revision: current.buffer_revision,
            actual_buffer_revision: Some(buffer.revision),
            current: None,
        });
        self.put(w, p, d);
        if retry {
            self.send_buffer_set(w, p, pending_save.clone());
        } else if schedule {
            self.schedule(w, p, now);
        }
        if let (true, Some(save)) = (chain, chained) {
            // The text of the Save click, which may be newer than this request's.
            self.send_write(
                w,
                p,
                save.content,
                save.expected_version,
                Some(buffer.revision),
            );
        }
    }

    fn on_read(
        &mut self,
        id: &str,
        pending: &Pending,
        metadata: &FileMetadata,
        content: &str,
        version: &str,
    ) {
        let (w, p) = (pending.workspace_id.as_str(), pending.path.as_str());
        let current = self.document_for(w, p);
        let mut d = current.clone();
        d.workspace_id = w.into();
        d.path = metadata.path.clone();
        d.metadata = Some(metadata.clone());
        if d.read_request_id.as_deref() == Some(id) {
            d.read_request_id = None;
        }
        d.request_id = current.buffer_request_id.clone();
        d.error = None;
        if current.buffer_revision.is_some() {
            // The durable buffer owns the text; the read only brings disk metadata and version.
            d.external_version = Some(version.into());
            d.version = current
                .base_version
                .clone()
                .or(current.version.clone())
                .or(Some(version.into()));
            if d.state == DocState::Loading {
                d.state = DocState::Ready;
            }
        } else {
            let preserve = pending
                .baseline_content
                .as_ref()
                .is_some_and(|b| *b != current.content);
            if !preserve {
                d.content = content.into();
            }
            d.saved_content = content.into();
            d.persisted_content = None;
            d.base_content = Some(content.into());
            d.base_version = Some(version.into());
            d.external_version = Some(version.into());
            d.version = Some(version.into());
            d.state = DocState::Ready;
            d.conflict = None;
        }
        self.put(w, p, d);
    }

    fn on_error(&mut self, id: &str, pending: &Pending, message: &ServerMessage) {
        let ServerMessage::FsError {
            code,
            message: text,
            metadata,
            expected_version,
            actual_version,
            current: disk,
            actual_buffer_revision,
            ..
        } = message
        else {
            return;
        };
        let (w, p) = (pending.workspace_id.as_str(), pending.path.as_str());
        let conflict_of = |d: &Document| Conflict {
            message: text.clone(),
            expected_version: d.base_version.clone().or(d.version.clone()),
            actual_version: actual_version.clone(),
            current: disk.clone(),
            ..Conflict::default()
        };
        match pending.kind {
            Kind::Search => {
                if let Some(s) = self.searches.get_mut(w) {
                    s.state = Load::Error;
                    s.error = Some(text.clone());
                }
                self.changed.insert(w.into());
            }
            Kind::Extract => self.set_extraction(
                w,
                p,
                Extraction {
                    state: Load::Error,
                    destination: None,
                    error: Some(text.clone()),
                },
            ),
            Kind::Tree => {
                let mut tree = self.tree_for(w, p);
                tree.state = Load::Error;
                tree.request_id = None;
                tree.error = Some(text.clone());
                self.set_tree(w, p, tree);
            }
            Kind::BufferList => {
                self.buffer_lists.insert(
                    w.into(),
                    BufferList {
                        state: Load::Error,
                        error: Some(text.clone()),
                        request_id: None,
                    },
                );
                self.changed.insert(w.into());
            }
            Kind::BufferGet => self.update(w, p, |d| {
                let read_in_flight = d.read_request_id.is_some();
                d.buffer_state = Some(BufferState::Error);
                if d.buffer_request_id.as_deref() == Some(id) {
                    d.buffer_request_id = None;
                }
                let was = d.state;
                d.state = if read_in_flight {
                    DocState::Loading
                } else if was == DocState::Loading {
                    DocState::Error
                } else {
                    was
                };
                d.request_id = d.read_request_id.clone();
                // An old peer may refuse the durable extension; the read's success clears it.
                d.error = (!read_in_flight && was != DocState::Ready).then(|| text.clone());
            }),
            Kind::BufferSet => {
                let is_conflict = code == "buffer_conflict"
                    || code == "conflict"
                    || actual_buffer_revision.is_some();
                self.save_after_buffer.remove(id);
                self.update(w, p, |d| {
                    let state = if is_conflict {
                        DocState::Conflict
                    } else {
                        DocState::Error
                    };
                    d.state = state;
                    d.buffer_state = Some(if is_conflict {
                        BufferState::Conflict
                    } else {
                        BufferState::Error
                    });
                    if d.buffer_request_id.as_deref() == Some(id) {
                        d.buffer_request_id = None;
                    }
                    if d.request_id.as_deref() == Some(id) {
                        d.request_id = None;
                    }
                    d.buffer_revision = actual_buffer_revision.or(d.buffer_revision);
                    d.error = Some(text.clone());
                    if is_conflict {
                        d.conflict = Some(conflict_of(d));
                    }
                });
            }
            Kind::BufferClose => {
                self.reloads.remove(id);
                let is_conflict = code == "buffer_conflict"
                    || code == "dirty_buffer"
                    || actual_buffer_revision.is_some();
                self.update(w, p, |d| {
                    d.state = if is_conflict {
                        DocState::Conflict
                    } else {
                        DocState::Error
                    };
                    d.buffer_state = Some(if is_conflict {
                        BufferState::Conflict
                    } else {
                        BufferState::Error
                    });
                    d.buffer_request_id = None;
                    d.request_id = None;
                    d.error = Some(text.clone());
                    if is_conflict {
                        d.conflict = Some(conflict_of(d));
                    }
                });
            }
            Kind::Read | Kind::Write => {
                let is_conflict = code == "conflict";
                self.update(w, p, |d| {
                    d.state = if is_conflict {
                        DocState::Conflict
                    } else {
                        DocState::Error
                    };
                    d.metadata = metadata.clone().or(d.metadata.take());
                    if d.request_id.as_deref() == Some(id) {
                        d.request_id = None;
                    }
                    if d.read_request_id.as_deref() == Some(id) {
                        d.read_request_id = None;
                    }
                    d.error = Some(text.clone());
                    if is_conflict {
                        d.conflict = Some(Conflict {
                            expected_version: expected_version
                                .clone()
                                .or(pending.expected_version.clone()),
                            ..conflict_of(d)
                        });
                    }
                });
            }
            Kind::Preview => {
                let mut preview = self.preview_for(w, p);
                preview.state = Load::Error;
                preview.request_id = None;
                preview.error = Some(text.clone());
                self.set_preview(w, p, preview);
            }
        }
    }
}
