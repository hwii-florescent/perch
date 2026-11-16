//! The window's file store against the web's own cases (`packages/web/src/filesystemStore.test.ts`),
//! one test each, plus what only the native window does with it.

use perch_core::protocol::ServerMessage;
use perch_native::files::store::{BufferState, DocState, FileStore, Load, MAX_CACHED_DOCUMENTS};
use serde_json::{json, Value};
use std::time::{Duration, Instant};

struct Fs {
    store: FileStore,
    sent: Vec<Value>,
    now: Instant,
}

impl Fs {
    fn new() -> Self {
        Self {
            store: FileStore::connected(),
            sent: Vec::new(),
            now: Instant::now(),
        }
    }

    fn drain(&mut self) {
        self.sent.extend(self.store.take_sent());
    }

    /// The newest frame sent of `kind`, for `workspace` and `path` when given.
    fn outgoing(&mut self, kind: &str, workspace: &str, path: Option<&str>) -> Value {
        self.drain();
        self.sent
            .iter()
            .rev()
            .find(|f| {
                f["type"] == kind
                    && f["workspaceId"] == workspace
                    && path.is_none_or(|p| f["path"] == p)
            })
            .cloned()
            .unwrap_or_else(|| panic!("no outgoing {kind} for {workspace} {path:?}"))
    }

    fn count(&mut self, kind: &str, workspace: &str) -> usize {
        self.drain();
        self.sent
            .iter()
            .filter(|f| f["type"] == kind && f["workspaceId"] == workspace)
            .count()
    }

    fn respond(&mut self, message: Value) {
        let message: ServerMessage = serde_json::from_value(message).expect("a server message");
        assert!(self.store.handle(&message, self.now));
        self.drain();
    }

    fn advance(&mut self, ms: u64) {
        self.now += Duration::from_millis(ms);
        self.store.tick(self.now);
        self.drain();
    }

    fn draft(&mut self, workspace: &str, path: &str, text: &str) {
        self.store
            .update_draft(workspace, path, text.into(), self.now);
        self.drain();
    }

    fn open_and_load(&mut self, workspace: &str, path: &str, content: &str) {
        assert!(self.store.open_file(workspace, path, false).is_some());
        let read = self.outgoing("fs.read", workspace, Some(path));
        let get = self.outgoing("fs.buffer.get", workspace, Some(path));
        self.respond(json!({"type": "fs.read.result", "requestId": read["requestId"], "workspaceId": workspace,
            "metadata": metadata(path, content.len()), "content": content, "version": "v1"}));
        self.respond(buffer(
            &get["requestId"],
            workspace,
            path,
            content,
            content,
            0,
            "v1",
        ));
    }

    fn doc(&self, workspace: &str, path: &str) -> &perch_native::files::store::Document {
        self.store.document(workspace, path).expect("the document")
    }
}

fn metadata(path: &str, size: usize) -> Value {
    json!({"path": path, "name": path.rsplit('/').next().unwrap(), "size": size, "readonly": false,
        "executable": false, "kind": "file"})
}

fn buffer(
    id: &Value,
    workspace: &str,
    path: &str,
    content: &str,
    base: &str,
    revision: u64,
    base_version: &str,
) -> Value {
    json!({"type": "fs.buffer.result", "requestId": id, "workspaceId": workspace, "buffer": {
        "workspaceId": workspace, "path": path, "content": content, "baseContent": base,
        "baseVersion": base_version, "externalVersion": base_version, "revision": revision,
        "dirty": content != base, "conflict": false, "updatedAt": 0}})
}

fn entry(path: &str) -> Value {
    json!({"name": path, "path": path, "kind": "file", "size": 1, "readonly": false, "executable": false})
}

#[test]
fn ignores_stale_searches_and_keeps_workspace_search_results_separate() {
    let mut fs = Fs::new();
    let first = fs.store.search_files("search-a", "old").unwrap();
    let latest = fs.store.search_files("search-a", "new").unwrap();
    let other = fs.store.search_files("search-b", "other").unwrap();
    fs.respond(json!({"type": "fs.search.result", "requestId": latest, "workspaceId": "search-a", "query": "new", "entries": [], "truncated": true}));
    fs.respond(json!({"type": "fs.search.result", "requestId": first, "workspaceId": "search-a", "query": "old", "entries": [], "truncated": false}));
    fs.respond(json!({"type": "fs.search.result", "requestId": other, "workspaceId": "search-b", "query": "other", "entries": [], "truncated": false}));
    let a = fs.store.search("search-a").unwrap();
    assert_eq!((a.query.as_str(), a.truncated), ("new", true));
    assert_eq!(fs.store.search("search-b").unwrap().query, "other");
}

#[test]
fn refreshes_an_extracted_archives_parent_and_exposes_errors_and_uncertain_disconnects() {
    let mut fs = Fs::new();
    let id = fs
        .store
        .extract_archive("extract", "sub/files.zip")
        .unwrap();
    assert!(fs
        .store
        .extract_archive("extract", "sub/files.zip")
        .is_none());
    fs.respond(json!({"type": "fs.extract.result", "requestId": id, "workspaceId": "extract", "path": "sub/files.zip", "destination": "sub/files-extracted"}));
    fs.outgoing("fs.tree", "extract", Some("sub"));
    assert_eq!(
        fs.store
            .extraction("extract", "sub/files.zip")
            .unwrap()
            .destination
            .as_deref(),
        Some("sub/files-extracted")
    );
    let retry = fs
        .store
        .extract_archive("extract", "sub/files.zip")
        .unwrap();
    fs.respond(json!({"type": "fs.error", "requestId": retry, "workspaceId": "extract", "code": "io_error", "message": "Folder exists", "path": "sub/files-extracted"}));
    assert_eq!(
        fs.store
            .extraction("extract", "sub/files.zip")
            .unwrap()
            .error
            .as_deref(),
        Some("Folder exists")
    );
    fs.store.extract_archive("extract", "another.zip");
    fs.store.set_connected(false);
    assert_eq!(
        fs.store.extraction("extract", "another.zip").unwrap().state,
        Load::Error
    );
}

#[test]
fn keeps_binary_metadata_for_the_media_viewer() {
    let mut fs = Fs::new();
    fs.store.open_file("media", "clip.mp4", false);
    let read = fs.outgoing("fs.read", "media", Some("clip.mp4"));
    let mut meta = metadata("clip.mp4", 4);
    meta["mediaType"] = json!("video/mp4");
    fs.respond(json!({"type": "fs.error", "requestId": read["requestId"], "workspaceId": "media", "code": "binary", "message": "Not text", "path": "clip.mp4", "metadata": meta}));
    let doc = fs.doc("media", "clip.mp4");
    assert_eq!(
        doc.metadata.as_ref().unwrap().media_type.as_deref(),
        Some("video/mp4")
    );
}

#[test]
fn keeps_lazy_tree_replies_scoped_to_their_workspace() {
    let mut fs = Fs::new();
    let a = fs.store.request_tree("workspace-a", "").unwrap();
    let b = fs.store.request_tree("workspace-b", "").unwrap();
    fs.respond(json!({"type": "fs.tree.result", "requestId": b, "workspaceId": "workspace-b", "path": "", "entries": [entry("b.md")], "truncated": false}));
    fs.respond(json!({"type": "fs.tree.result", "requestId": a, "workspaceId": "workspace-a", "path": "", "entries": [entry("a.md")], "truncated": false}));
    let paths = |w: &str| -> Vec<String> {
        fs.store
            .tree(w, "")
            .unwrap()
            .entries
            .iter()
            .map(|e| e.path.clone())
            .collect()
    };
    assert_eq!(paths("workspace-a"), ["a.md"]);
    assert_eq!(paths("workspace-b"), ["b.md"]);
}

#[test]
fn loads_a_bounded_durable_buffer_list() {
    let mut fs = Fs::new();
    let id = fs.store.request_buffer_list("workspace-buffers").unwrap();
    fs.respond(json!({"type": "fs.buffer.list.result", "requestId": id, "workspaceId": "workspace-buffers", "truncated": false,
        "buffers": [{"workspaceId": "workspace-buffers", "path": "src/main.ts", "baseVersion": "v1", "externalVersion": "v1",
            "revision": 2, "dirty": true, "conflict": false, "updatedAt": 0}]}));
    let (list, buffers) = fs.store.buffer_list("workspace-buffers").unwrap();
    assert_eq!(list.state, Load::Ready);
    assert_eq!(buffers[0].path, "src/main.ts");
}

#[test]
fn a_late_read_or_buffer_reply_never_overwrites_a_newer_draft() {
    let mut fs = Fs::new();
    let w = "workspace-late-read";
    fs.store.open_file(w, "README.md", false).unwrap();
    let read = fs.outgoing("fs.read", w, Some("README.md"));
    let get = fs.outgoing("fs.buffer.get", w, Some("README.md"));
    fs.draft(w, "README.md", "typed before disk replied");
    fs.respond(
        json!({"type": "fs.read.result", "requestId": read["requestId"], "workspaceId": w,
        "metadata": metadata("README.md", 4), "content": "disk", "version": "disk-v1"}),
    );
    fs.respond(buffer(
        &get["requestId"],
        w,
        "README.md",
        "disk",
        "disk",
        1,
        "disk-v1",
    ));
    let doc = fs.doc(w, "README.md");
    assert_eq!(doc.content, "typed before disk replied");
    assert_eq!(doc.saved_content, "disk");
    assert_eq!(doc.persisted_content.as_deref(), Some("disk"));
    assert_eq!(doc.base_version.as_deref(), Some("disk-v1"));
    assert!(doc.dirty());
}

#[test]
fn restores_the_durable_draft_when_the_read_wins_the_race() {
    let mut fs = Fs::new();
    let w = "workspace-reload-race";
    fs.store.open_file(w, "README.md", false).unwrap();
    let read = fs.outgoing("fs.read", w, Some("README.md"));
    let get = fs.outgoing("fs.buffer.get", w, Some("README.md"));
    fs.respond(
        json!({"type": "fs.read.result", "requestId": read["requestId"], "workspaceId": w,
        "metadata": metadata("README.md", 4), "content": "disk baseline", "version": "v2"}),
    );
    fs.respond(buffer(
        &get["requestId"],
        w,
        "README.md",
        "durable draft",
        "disk baseline",
        7,
        "v2",
    ));
    let doc = fs.doc(w, "README.md");
    assert_eq!(doc.content, "durable draft");
    assert_eq!(doc.saved_content, "disk baseline");
    assert_eq!(doc.buffer_revision, Some(7));
}

#[test]
fn an_unsolicited_disk_change_marks_a_dirty_buffer_conflicted_without_clobbering_it() {
    let mut fs = Fs::new();
    let w = "workspace-watcher";
    fs.open_and_load(w, "README.md", "original");
    fs.draft(w, "README.md", "local draft");
    fs.respond(json!({"type": "fs.changed", "workspaceId": w, "path": "README.md", "version": "v2", "kind": "changed", "conflict": true}));
    let doc = fs.doc(w, "README.md");
    assert_eq!(doc.content, "local draft");
    assert_eq!(doc.state, DocState::Conflict);
    assert_eq!(doc.buffer_state, Some(BufferState::Conflict));
    assert_eq!(
        doc.conflict.as_ref().unwrap().actual_version.as_deref(),
        Some("v2")
    );
}

#[test]
fn a_disk_change_to_a_clean_document_takes_the_new_version_and_keeps_the_text() {
    let mut fs = Fs::new();
    let w = "workspace-clean-change";
    fs.open_and_load(w, "README.md", "original");
    fs.respond(json!({"type": "fs.changed", "workspaceId": w, "path": "README.md", "version": "v2", "kind": "changed"}));
    let doc = fs.doc(w, "README.md");
    assert_eq!(
        (doc.content.as_str(), doc.state),
        ("original", DocState::Ready)
    );
    assert_eq!(doc.version.as_deref(), Some("v2"));
    assert!(doc.conflict.is_none());
}

#[test]
fn flushes_the_buffer_before_saving_and_keeps_typing_made_during_the_save() {
    let mut fs = Fs::new();
    let w = "workspace-save";
    fs.open_and_load(w, "README.md", "original");
    fs.draft(w, "README.md", "first draft");
    assert!(fs.store.save_file(w, "README.md", None).is_some());
    let set = fs.outgoing("fs.buffer.set", w, Some("README.md"));
    assert_eq!(set["content"], "first draft");
    assert_eq!(set["expectedBufferRevision"], 0);
    fs.respond(buffer(
        &set["requestId"],
        w,
        "README.md",
        "first draft",
        "original",
        1,
        "v1",
    ));
    let write = fs.outgoing("fs.write", w, Some("README.md"));
    assert_eq!(write["content"], "first draft");
    assert_eq!(write["expectedVersion"], "v1");
    assert_eq!(write["expectedBufferRevision"], 1);
    fs.draft(w, "README.md", "newer local typing");
    fs.respond(json!({"type": "fs.write.result", "requestId": write["requestId"], "workspaceId": w,
        "metadata": metadata("README.md", 11), "bytesWritten": 11, "version": "v2", "bufferRevision": 2}));
    let doc = fs.doc(w, "README.md");
    assert_eq!(doc.content, "newer local typing");
    assert_eq!(doc.saved_content, "first draft");
    assert_eq!(doc.persisted_content.as_deref(), Some("first draft"));
    assert_eq!(doc.base_version.as_deref(), Some("v2"));
    assert_eq!(doc.state, DocState::Ready);
}

#[test]
fn keeps_typing_made_while_a_buffer_set_is_in_flight() {
    let mut fs = Fs::new();
    fs.open_and_load("ws-ack", "a.txt", "alpha");
    fs.draft("ws-ack", "a.txt", "draft A");
    fs.advance(400);
    let first = fs.outgoing("fs.buffer.set", "ws-ack", Some("a.txt"));
    assert_eq!(first["content"], "draft A");
    fs.draft("ws-ack", "a.txt", "draft B");
    fs.respond(buffer(
        &first["requestId"],
        "ws-ack",
        "a.txt",
        "draft A",
        "alpha",
        1,
        "v1",
    ));
    assert_eq!(fs.doc("ws-ack", "a.txt").content, "draft B");
    fs.advance(400);
    let second = fs.outgoing("fs.buffer.set", "ws-ack", Some("a.txt"));
    assert_ne!(second["requestId"], first["requestId"]);
    assert_eq!(second["content"], "draft B");
}

#[test]
fn typing_waits_for_the_pause_before_the_buffer_is_written() {
    let mut fs = Fs::new();
    fs.open_and_load("ws-pause", "a.txt", "alpha");
    for (i, text) in ["a", "ab", "abc"].into_iter().enumerate() {
        fs.draft("ws-pause", "a.txt", text);
        fs.advance(if i < 2 { 200 } else { 0 });
    }
    assert_eq!(fs.count("fs.buffer.set", "ws-pause"), 0);
    assert!(fs.store.next_deadline().is_some());
    fs.advance(349);
    assert_eq!(fs.count("fs.buffer.set", "ws-pause"), 0);
    fs.advance(1);
    assert_eq!(
        fs.outgoing("fs.buffer.set", "ws-pause", None)["content"],
        "abc"
    );
    assert!(fs.store.next_deadline().is_none());
}

#[test]
fn discard_and_reload_bumps_the_reload_epoch() {
    let mut fs = Fs::new();
    fs.open_and_load("ws-epoch", "a.txt", "alpha");
    assert!(fs.store.reload_file("ws-epoch", "a.txt").is_some());
    let close = fs.outgoing("fs.buffer.close", "ws-epoch", Some("a.txt"));
    assert_eq!(close["discard"], true);
    fs.respond(json!({"type": "fs.buffer.close.result", "requestId": close["requestId"], "workspaceId": "ws-epoch", "path": "a.txt", "removed": true}));
    assert_eq!(fs.doc("ws-epoch", "a.txt").reload_epoch, Some(1));
    fs.outgoing("fs.read", "ws-epoch", Some("a.txt"));
}

#[test]
fn saves_the_text_of_the_save_click() {
    let mut fs = Fs::new();
    fs.open_and_load("ws-save2", "a.txt", "alpha");
    fs.draft("ws-save2", "a.txt", "first draft");
    fs.advance(400);
    let set = fs.outgoing("fs.buffer.set", "ws-save2", Some("a.txt"));
    fs.draft("ws-save2", "a.txt", "new draft at Cmd+S");
    fs.store.save_file("ws-save2", "a.txt", None);
    fs.respond(buffer(
        &set["requestId"],
        "ws-save2",
        "a.txt",
        "first draft",
        "alpha",
        1,
        "v1",
    ));
    assert_eq!(
        fs.outgoing("fs.write", "ws-save2", Some("a.txt"))["content"],
        "new draft at Cmd+S"
    );
}

#[test]
fn keeps_the_draft_on_a_version_conflict_and_overwrites_against_disk() {
    let mut fs = Fs::new();
    let w = "workspace-conflict";
    fs.open_and_load(w, "README.md", "original");
    fs.draft(w, "README.md", "my draft");
    fs.store.save_file(w, "README.md", None).unwrap();
    let set = fs.outgoing("fs.buffer.set", w, Some("README.md"));
    fs.respond(buffer(
        &set["requestId"],
        w,
        "README.md",
        "my draft",
        "original",
        1,
        "v1",
    ));
    let write = fs.outgoing("fs.write", w, Some("README.md"));
    fs.respond(json!({"type": "fs.error", "requestId": write["requestId"], "workspaceId": w, "code": "conflict",
        "message": "File changed on disk", "path": "README.md", "expectedVersion": "v1", "actualVersion": "v2",
        "current": metadata("README.md", 8)}));
    let doc = fs.doc(w, "README.md");
    assert_eq!(doc.state, DocState::Conflict);
    assert_eq!(doc.content, "my draft");
    assert_eq!(
        doc.conflict.as_ref().unwrap().actual_version.as_deref(),
        Some("v2")
    );
    let id = fs.store.overwrite_file(w, "README.md").unwrap();
    let overwrite = fs.outgoing("fs.write", w, Some("README.md"));
    assert_eq!(overwrite["requestId"], id);
    assert_eq!(overwrite["expectedVersion"], "v2");
    assert_eq!(overwrite["expectedBufferRevision"], 1);
    assert_eq!(overwrite["content"], "my draft");
}

#[test]
fn flushes_unsent_drafts_at_once() {
    let mut fs = Fs::new();
    fs.open_and_load("workspace-reconnect", "README.md", "original");
    fs.draft("workspace-reconnect", "README.md", "offline draft");
    assert!(fs.store.flush_pending_buffers());
    let set = fs.outgoing("fs.buffer.set", "workspace-reconnect", Some("README.md"));
    assert_eq!(set["content"], "offline draft");
    assert_eq!(set["expectedBufferRevision"], 0);
}

#[test]
fn retransmits_the_newest_draft_after_a_dead_buffer_request() {
    let mut fs = Fs::new();
    let w = "workspace-disconnect";
    fs.open_and_load(w, "README.md", "original");
    fs.draft(w, "README.md", "draft before drop");
    fs.store.flush_pending_buffers();
    let first = fs.outgoing("fs.buffer.set", w, Some("README.md"));
    fs.store.set_connected(false);
    assert!(fs.doc(w, "README.md").buffer_request_id.is_none());
    fs.store.set_connected(true);
    let resync = fs.outgoing("fs.buffer.get", w, Some("README.md"));
    // The first set landed but its answer was lost: the matching row is adopted, nothing resent.
    fs.respond(buffer(
        &resync["requestId"],
        w,
        "README.md",
        "draft before drop",
        "original",
        1,
        "v1",
    ));
    assert_eq!(fs.count("fs.buffer.set", w), 1);
    assert_eq!(fs.doc(w, "README.md").state, DocState::Ready);

    // The first set never landed: the old row comes back and the draft is sent against it.
    let r = "workspace-disconnect-retry";
    fs.open_and_load(r, "README.md", "original");
    fs.draft(r, "README.md", "retry draft");
    fs.store.flush_pending_buffers();
    fs.store.set_connected(false);
    fs.store.set_connected(true);
    let resync = fs.outgoing("fs.buffer.get", r, Some("README.md"));
    fs.respond(buffer(
        &resync["requestId"],
        r,
        "README.md",
        "original",
        "original",
        0,
        "v1",
    ));
    let second = fs.outgoing("fs.buffer.set", r, Some("README.md"));
    assert_eq!(second["content"], "retry draft");
    assert_eq!(second["expectedBufferRevision"], 0);
    assert_eq!(first["content"], "draft before drop");
}

#[test]
fn reconciles_only_the_reconnected_hosts_buffers_and_never_repeats_a_save() {
    let mut fs = Fs::new();
    let remote = r#"remote:["host-a","workspace"]"#;
    fs.open_and_load(remote, "README.md", "original");
    fs.open_and_load("local-workspace", "README.md", "local");
    fs.draft(remote, "README.md", "remote draft");
    fs.draft("local-workspace", "README.md", "local draft");
    fs.store.flush_pending_buffers();
    let pending = fs.outgoing("fs.buffer.set", remote, Some("README.md"));
    fs.respond(json!({"type": "fs.error", "requestId": pending["requestId"], "workspaceId": remote, "path": "README.md",
        "code": "remote_outcome_unknown", "message": "Remote disconnected; reconcile before retrying"}));
    fs.sent.clear();
    fs.store
        .resync_after_reconnect(Some(&[remote.to_string()].into_iter().collect()));
    fs.drain();
    assert_eq!(fs.sent.len(), 1, "{:?}", fs.sent);
    assert_eq!(
        (
            fs.sent[0]["type"].as_str(),
            fs.sent[0]["workspaceId"].as_str()
        ),
        (Some("fs.buffer.get"), Some(remote))
    );
    let id = fs.sent[0]["requestId"].clone();
    // A lost acknowledgement: the owning core already has this exact draft.
    fs.respond(buffer(
        &id,
        remote,
        "README.md",
        "remote draft",
        "original",
        1,
        "v1",
    ));
    assert!(
        fs.sent
            .iter()
            .skip(1)
            .all(|f| f["type"] != "fs.write" && f["type"] != "fs.buffer.set"),
        "{:?}",
        fs.sent
    );
    assert_eq!(fs.doc(remote, "README.md").content, "remote draft");
    assert_eq!(
        fs.doc("local-workspace", "README.md").content,
        "local draft"
    );
}

#[test]
fn a_pending_unacknowledged_draft_is_reported_before_close() {
    let mut fs = Fs::new();
    fs.open_and_load("workspace-beforeunload", "README.md", "original");
    assert!(!fs.store.has_unsynced_draft());
    fs.draft(
        "workspace-beforeunload",
        "README.md",
        "draft before refresh",
    );
    assert!(fs.store.has_unsynced_draft());
    assert!(fs.store.flush_pending_buffers());
    assert_eq!(
        fs.outgoing("fs.buffer.set", "workspace-beforeunload", Some("README.md"))["content"],
        "draft before refresh"
    );
}

#[test]
fn bounds_clean_documents_and_keeps_the_active_draft() {
    let mut fs = Fs::new();
    let w = "workspace-bounded";
    fs.open_and_load(w, "draft.md", "keep");
    fs.draft(w, "draft.md", "unsaved");
    for i in 0..MAX_CACHED_DOCUMENTS + 5 {
        let path = format!("file-{i}.md");
        fs.store.open_file(w, &path, false).unwrap();
        let read = fs.outgoing("fs.read", w, Some(&path));
        fs.respond(json!({"type": "fs.read.result", "requestId": read["requestId"], "workspaceId": w,
            "metadata": metadata(&path, 4), "content": format!("disk-{i}"), "version": format!("v-{i}")}));
    }
    assert!(fs.store.documents_of(w).count() <= MAX_CACHED_DOCUMENTS);
    assert!(fs
        .store
        .document(w, &format!("file-{}.md", MAX_CACHED_DOCUMENTS + 4))
        .is_some());
    assert!(fs.store.document(w, "file-0.md").is_none());
    assert_eq!(fs.doc(w, "draft.md").content, "unsaved");
}

#[test]
fn nothing_is_asked_while_disconnected_and_a_late_reply_after_a_drop_is_dropped() {
    let mut fs = Fs::new();
    let id = fs.store.request_tree("ws-drop", "").unwrap();
    fs.store.set_connected(false);
    assert!(fs.store.request_tree("ws-drop", "src").is_none());
    assert!(fs.store.open_file("ws-drop", "a.txt", false).is_none());
    fs.respond(json!({"type": "fs.tree.result", "requestId": id, "workspaceId": "ws-drop", "path": "", "entries": [entry("a")], "truncated": false}));
    assert_eq!(fs.store.tree("ws-drop", "").unwrap().state, Load::Loading);
}

#[test]
fn the_snapshot_names_what_the_screen_reads() {
    let mut fs = Fs::new();
    fs.open_and_load("ws-snap", "src/a.txt", "alpha");
    fs.draft("ws-snap", "src/a.txt", "alpha!");
    fs.store.take_changed();
    let snapshot = fs.store.snapshot("ws-snap");
    let doc = &snapshot["documents"]["src/a.txt"];
    assert_eq!(doc["content"], "alpha!");
    assert_eq!(doc["savedContent"], "alpha");
    assert_eq!(doc["state"], "ready");
    assert_eq!(doc["bufferState"], "saving");
    assert_eq!(snapshot["trees"], json!({}));
    assert_eq!(snapshot["wrap"], false);
    fs.store.set_wrap(true, "ws-snap");
    assert!(fs.store.take_changed().contains("ws-snap"));
}
