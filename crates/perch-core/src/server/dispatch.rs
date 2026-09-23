//! `handle_message` — the single dispatch point for every
//! `ClientMessage` variant. Pure move from `server.rs` — see the
//! refactor plan's Phase 3. No logic changed: the match, its
//! exhaustiveness, and every arm (already reduced to one-line calls
//! into the domain modules by the rest of Phase 3) are untouched.

use super::*;

pub(super) fn handle_message(state: &Arc<ConnState>, msg: ClientMessage, raw_text: &str) {
    match msg {
        ClientMessage::SessionCreate { cwd, host_id } => {
            session::handle_session_create(state, cwd, host_id)
        }
        ClientMessage::SessionResume { session_id } => {
            session::handle_session_resume(state, session_id)
        }
        ClientMessage::SessionModeGet {
            request_id,
            session_id,
            device_id,
            workspace_id,
        } => session::handle_session_mode_get(
            state,
            raw_text,
            request_id,
            session_id,
            device_id,
            workspace_id,
        ),
        ClientMessage::SessionModeSet {
            request_id,
            session_id,
            device_id,
            scope,
            workspace_id,
            mode,
            clear_override,
        } => session::handle_session_mode_set(
            state,
            raw_text,
            request_id,
            session_id,
            device_id,
            scope,
            workspace_id,
            mode,
            clear_override,
        ),
        ClientMessage::AgentManifestList {
            request_id,
            host_id,
        } => agents::handle_agent_manifest_list(state, raw_text, request_id, host_id),
        ClientMessage::AgentUiGet {
            request_id,
            session_id,
            provider_id,
        } => native_ui::get(state, raw_text, request_id, session_id, provider_id),
        ClientMessage::AgentUiPrompt {
            request_id,
            session_id,
            provider_id,
            operation_id,
            generation,
            text,
        } => native_ui::control(
            state,
            raw_text,
            request_id,
            session_id,
            provider_id,
            generation,
            Some((operation_id, text)),
        ),
        ClientMessage::AgentUiCancel {
            request_id,
            session_id,
            provider_id,
            generation,
        } => native_ui::control(
            state,
            raw_text,
            request_id,
            session_id,
            provider_id,
            generation,
            None,
        ),
        ClientMessage::AgentProviderConfigure {
            request_id,
            host_id,
            provider_id,
            enabled,
            is_default,
        } => agents::handle_agent_provider_configure(
            state,
            raw_text,
            request_id,
            host_id,
            provider_id,
            enabled,
            is_default,
        ),
        ClientMessage::AgentLifecycleGet {
            request_id,
            session_id,
            workspace_id,
            agent_id,
        } => agents::handle_agent_lifecycle_get(
            state,
            raw_text,
            request_id,
            session_id,
            workspace_id,
            agent_id,
        ),
        ClientMessage::AgentControlAcquire {
            request_id,
            session_id,
            workspace_id,
            agent_id,
            channel,
        } => agents::handle_agent_control_acquire(
            state,
            raw_text,
            request_id,
            session_id,
            workspace_id,
            agent_id,
            channel,
        ),
        ClientMessage::AgentControlRelease {
            request_id,
            session_id,
            workspace_id,
            agent_id,
            channel,
            generation,
        } => agents::handle_agent_control_release(
            state,
            raw_text,
            request_id,
            session_id,
            workspace_id,
            agent_id,
            channel,
            generation,
        ),
        ClientMessage::SessionSubscribe { session_id } => {
            session::handle_session_subscribe(state, raw_text, session_id)
        }
        ClientMessage::SessionList {} => session::handle_session_list(state),
        ClientMessage::ChatSend {
            ref session_id,
            ref text,
            ref operation_id,
            agent,
            ref model,
            plan_mode,
            ref effort,
            ref attachments,
        } => session::handle_chat_send(
            state,
            raw_text,
            session_id,
            text,
            operation_id,
            agent,
            model,
            plan_mode,
            effort,
            attachments,
        ),
        ClientMessage::ChatCancel { session_id } => {
            session::handle_chat_cancel(state, raw_text, session_id)
        }
        ClientMessage::CommandsList { ref session_id } => {
            session::handle_commands_list(state, raw_text, session_id)
        }
        ClientMessage::TerminalOpen {
            request_id,
            session_id,
            pane_id,
            view_id,
            cols,
            rows,
        } => terminal::handle_terminal_open(
            state, request_id, session_id, pane_id, view_id, cols, rows,
        ),
        ClientMessage::TerminalList {
            request_id,
            session_id,
        } => terminal::handle_terminal_list(state, request_id, session_id),
        ClientMessage::TerminalRelease {
            terminal_id,
            view_id,
        } => terminal::handle_terminal_release(state, terminal_id, view_id),
        ClientMessage::TerminalClose {
            request_id,
            session_id,
            terminal_id,
        } => terminal::handle_terminal_close(state, request_id, session_id, terminal_id),
        ClientMessage::AgentTerminalOpen {
            request_id,
            session_id,
            provider_id,
            view_id,
            cols,
            rows,
        } => terminal::handle_agent_terminal_open(
            state,
            request_id,
            session_id,
            provider_id,
            view_id,
            cols,
            rows,
        ),
        ClientMessage::AgentTerminalRelease {
            session_id,
            provider_id,
            view_id,
        } => terminal::handle_agent_terminal_release(state, session_id, provider_id, view_id),
        ClientMessage::TerminalCreate {
            cols,
            rows,
            cwd,
            ref agent_attach,
        } => terminal::handle_terminal_create(state, raw_text, cols, rows, cwd, agent_attach),
        ClientMessage::TerminalInput {
            terminal_id,
            data,
            generation,
        } => terminal::handle_terminal_input(state, raw_text, terminal_id, data, generation),
        ClientMessage::TerminalResize {
            terminal_id,
            cols,
            rows,
            generation,
        } => terminal::handle_terminal_resize(state, raw_text, terminal_id, cols, rows, generation),
        ClientMessage::TerminalKill { terminal_id } => {
            terminal::handle_terminal_kill(state, raw_text, terminal_id)
        }

        // -----------------------------------------------------------------------
        // Settings & hosts (Stage D)
        // -----------------------------------------------------------------------
        ClientMessage::DevicePairStart { request_id } => {
            config::handle_device_pair_start(state, request_id)
        }
        ClientMessage::DevicePairCancel { request_id } => {
            config::handle_device_pair_cancel(state, request_id)
        }
        ClientMessage::DeviceList { request_id } => config::handle_device_list(state, request_id),
        ClientMessage::DeviceRevoke {
            request_id,
            device_id,
        } => config::handle_device_revoke(state, request_id, device_id),

        ClientMessage::SettingsGet {} => config::handle_settings_get(state),
        ClientMessage::SettingsUpdate { patch } => config::handle_settings_update(state, patch),
        ClientMessage::HostsList {} => config::handle_hosts_list(state),
        ClientMessage::HostsUpsert { host } => config::handle_hosts_upsert(state, host),
        ClientMessage::HostsDelete { id } => config::handle_hosts_delete(state, id),

        // Fix 4: Archive / unarchive a session.
        ClientMessage::SessionArchive {
            session_id,
            archived,
        } => session::handle_session_archive(state, raw_text, session_id, archived),

        // Permanently delete a session: cancel any in-flight turn, kill any
        // CLI-attached terminal, drop it from every in-memory bookkeeping
        // structure, delete its DB rows, then fan the deletion out to every
        // connection (not just this one — there is no DB row left for the
        // usual session.updated broadcast path to look up).
        ClientMessage::SessionDelete { session_id } => {
            session::handle_session_delete(state, raw_text, session_id)
        }
        // Phase 3: Workspace → Tab → Pane model — per-session dockview layout
        // persistence. The layout blob is opaque JSON; the server only stores
        // and echoes it.
        ClientMessage::SessionLayoutGet { session_id } => {
            session::handle_session_layout_get(state, raw_text, session_id)
        }

        ClientMessage::SessionLayoutSet { session_id, layout } => {
            session::handle_session_layout_set(state, raw_text, session_id, layout)
        }

        // User-set title override (item 2: session rename). Persists across
        // the auto-title-from-first-message logic — see db.rs::list_sessions.
        ClientMessage::SessionRename { session_id, title } => {
            session::handle_session_rename(state, raw_text, session_id, title)
        }

        // Item 1: directory browser for new-session cwd picker.
        ClientMessage::FsBrowse {
            request_id,
            host_id,
            path,
        } => fs::handle_fs_browse(state, raw_text, request_id, host_id, path),

        // Durable workspace filesystem operations. These requests carry only
        // a workspace id plus a workspace-relative path. The service resolves
        // the authorized root from the DB and all blocking descriptor/hash/
        // atomic-write work runs off the WebSocket message loop.
        ClientMessage::FsTree {
            request_id,
            workspace_id,
            path,
        } => fs::spawn_fs_tree(state, request_id, workspace_id, path),
        ClientMessage::FsRead {
            request_id,
            workspace_id,
            path,
        } => fs::spawn_fs_read(state, request_id, workspace_id, path),
        ClientMessage::FsPreview {
            request_id,
            workspace_id,
            path,
        } => fs::spawn_fs_preview(state, request_id, workspace_id, path),
        ClientMessage::FsWrite {
            request_id,
            workspace_id,
            path,
            content,
            expected_version,
            expected_buffer_revision,
        } => fs::spawn_fs_write(
            state,
            request_id,
            workspace_id,
            path,
            content,
            expected_version,
            expected_buffer_revision,
        ),
        ClientMessage::FsBufferList {
            request_id,
            workspace_id,
        } => fs::spawn_fs_buffer_list(state, request_id, workspace_id),
        ClientMessage::FsBufferGet {
            request_id,
            workspace_id,
            path,
        } => fs::spawn_fs_buffer_get(state, request_id, workspace_id, path),
        ClientMessage::FsBufferSet {
            request_id,
            workspace_id,
            path,
            content,
            base_content,
            expected_buffer_revision,
        } => fs::spawn_fs_buffer_set(
            state,
            request_id,
            workspace_id,
            path,
            content,
            base_content,
            expected_buffer_revision,
        ),
        ClientMessage::FsBufferClose {
            request_id,
            workspace_id,
            path,
            expected_buffer_revision,
            discard,
        } => fs::spawn_fs_buffer_close(
            state,
            request_id,
            workspace_id,
            path,
            expected_buffer_revision,
            discard,
        ),

        ClientMessage::GitStatus {
            request_id,
            workspace_id,
            session_id,
            host_id,
            include_ignored,
        } => git::handle_git_status(
            state,
            raw_text,
            request_id,
            workspace_id,
            session_id,
            host_id,
            include_ignored,
        ),
        ClientMessage::GitRefs {
            request_id,
            workspace_id,
            host_id,
        } => git::handle_git_refs(state, raw_text, request_id, workspace_id, host_id),
        ClientMessage::GitDiff {
            request_id,
            workspace_id,
            host_id,
            target,
            include_untracked,
            ignore_whitespace,
            context_lines,
            path,
        } => git::handle_git_diff(
            state,
            raw_text,
            request_id,
            workspace_id,
            host_id,
            target,
            include_untracked,
            ignore_whitespace,
            context_lines,
            path,
        ),
        ClientMessage::GitStage {
            request_id,
            workspace_id,
            host_id,
            paths,
            patch,
        } => git::handle_git_stage(
            state,
            raw_text,
            request_id,
            workspace_id,
            host_id,
            paths,
            patch,
        ),
        ClientMessage::GitUnstage {
            request_id,
            workspace_id,
            host_id,
            paths,
            patch,
        } => git::handle_git_unstage(
            state,
            raw_text,
            request_id,
            workspace_id,
            host_id,
            paths,
            patch,
        ),
        ClientMessage::GitDiscardPreview {
            request_id,
            workspace_id,
            host_id,
            mode,
            paths,
        } => git::handle_git_discard_preview(
            state,
            raw_text,
            request_id,
            workspace_id,
            host_id,
            mode,
            paths,
        ),
        ClientMessage::GitDiscard {
            request_id,
            workspace_id,
            host_id,
            preview_id,
        } => git::handle_git_discard(
            state,
            raw_text,
            request_id,
            workspace_id,
            host_id,
            preview_id,
        ),
        ClientMessage::GitCommitPreview {
            request_id,
            workspace_id,
            host_id,
            message,
        } => git::handle_git_commit_preview(
            state,
            raw_text,
            request_id,
            workspace_id,
            host_id,
            message,
        ),
        ClientMessage::GitCommit {
            request_id,
            workspace_id,
            host_id,
            preview_id,
            message,
        } => git::handle_git_commit(
            state,
            raw_text,
            request_id,
            workspace_id,
            host_id,
            preview_id,
            message,
        ),
        ClientMessage::ReviewList {
            request_id,
            workspace_id,
            host_id,
        } => reviews::handle_review_list(state, raw_text, request_id, workspace_id, host_id),
        ClientMessage::ReviewCreate {
            request_id,
            workspace_id,
            host_id,
            id,
            session_id,
            agent_id,
            path,
            base,
            base_revision,
            side,
            range,
            body,
        } => reviews::handle_review_create(
            state,
            raw_text,
            request_id,
            workspace_id,
            host_id,
            id,
            session_id,
            agent_id,
            path,
            base,
            base_revision,
            side,
            range,
            body,
        ),
        ClientMessage::ReviewUpdate {
            request_id,
            workspace_id,
            host_id,
            comment_id,
            body,
            expected_version,
        } => reviews::handle_review_update(
            state,
            raw_text,
            request_id,
            workspace_id,
            host_id,
            comment_id,
            body,
            expected_version,
        ),
        ClientMessage::ReviewResolve {
            request_id,
            workspace_id,
            host_id,
            comment_id,
            resolved,
            expected_version,
        } => reviews::handle_review_resolve(
            state,
            raw_text,
            request_id,
            workspace_id,
            host_id,
            comment_id,
            resolved,
            expected_version,
        ),
        ClientMessage::ReviewDelete {
            request_id,
            workspace_id,
            host_id,
            comment_id,
            expected_version,
        } => reviews::handle_review_delete(
            state,
            raw_text,
            request_id,
            workspace_id,
            host_id,
            comment_id,
            expected_version,
        ),
        ClientMessage::ReviewBatchPreview {
            request_id,
            workspace_id,
            host_id,
            send_operation_id,
            target_session_id,
            target_agent_id,
            current_revision,
            instruction,
        } => reviews::handle_review_batch_preview(
            state,
            raw_text,
            request_id,
            workspace_id,
            host_id,
            send_operation_id,
            target_session_id,
            target_agent_id,
            current_revision,
            instruction,
        ),
        ClientMessage::ReviewBatchSend {
            request_id,
            workspace_id,
            host_id,
            packet_id,
            send_operation_id,
        } => reviews::handle_review_batch_send(
            state,
            raw_text,
            request_id,
            workspace_id,
            host_id,
            packet_id,
            send_operation_id,
        ),

        // -------------------------------------------------------------------
        // Wave 2: git worktree management (ported from herdr — see
        // `worktree.rs` for the git plumbing and the herdr provenance).
        //
        // All three arms share the same shape:
        //   1. hub-route to the owning host when `hostId` is non-local,
        //      registering a single-shot `PendingKey::Worktree(requestId)`
        //      slot so the reply comes back to *this* connection only;
        //   2. otherwise run the (async, timeout-bounded) git operation on a
        //      spawned task so the connection's message loop never blocks on
        //      a subprocess;
        //   3. reply with exactly one message — `worktree.list.result` /
        //      `worktree.done` / `worktree.error` — always echoing requestId.
        // -------------------------------------------------------------------
        ClientMessage::WorktreeList {
            request_id,
            host_id,
            repo_path,
        } => workspace::handle_worktree_list(state, raw_text, request_id, host_id, repo_path),
        ClientMessage::WorktreeCreate {
            request_id,
            host_id,
            repo_path,
            branch,
            new_branch,
            path,
            name,
            start_from,
            parent_workspace_id,
        } => workspace::handle_worktree_create(
            state,
            raw_text,
            request_id,
            host_id,
            crate::worktree::CreateRequest {
                repo_path,
                branch,
                name,
                new_branch,
                path,
                start_from,
            },
            parent_workspace_id,
        ),
        ClientMessage::WorktreeRemove {
            request_id,
            host_id,
            repo_path,
            path,
            force,
            delete_branch,
        } => workspace::handle_worktree_remove(
            state,
            raw_text,
            request_id,
            host_id,
            repo_path,
            path,
            force,
            delete_branch,
        ),
        ClientMessage::WorktreeBranchDelete {
            request_id,
            host_id,
            repo_path,
            branch,
            expected_head,
        } => workspace::handle_worktree_branch_delete(
            state,
            raw_text,
            request_id,
            host_id,
            repo_path,
            branch,
            expected_head,
        ),
        ClientMessage::WorktreeJobStart {
            request_id,
            repo_path,
            branch,
            new_branch,
            path,
            name,
            start_from,
            parent_workspace_id,
        } => worktree_jobs::handle_start(
            state,
            request_id,
            crate::worktree::CreateRequest {
                repo_path,
                branch,
                name,
                new_branch,
                path,
                start_from,
            },
            parent_workspace_id,
        ),
        ClientMessage::WorktreeJobCancel { job_id } => {
            worktree_jobs::handle_cancel(&state.app, &job_id)
        }
        ClientMessage::WorktreeJobRetry { job_id } => {
            worktree_jobs::handle_retry(&state.app, &job_id)
        }
        ClientMessage::WorktreeJobDismiss { job_id } => {
            worktree_jobs::handle_dismiss(&state.app, &job_id)
        }

        // -------------------------------------------------------------------
        // Durable project/workspace foundation. This first slice is local
        // only. A configured remote perch can advertise its own capability in
        // a later protocol revision; direct-mode hosts have no metadata
        // service, so returning an explicit unsupported error is safer than
        // accidentally reading a same-looking local path.
        // -------------------------------------------------------------------
        ClientMessage::ProjectList {
            request_id,
            host_id,
            include_archived,
        } => workspace::handle_project_list(state, request_id, host_id, include_archived),
        ClientMessage::ProjectCreate {
            request_id,
            host_id,
            path,
            name,
        } => {
            let state = state.clone();
            tokio::spawn(async move {
                workspace::handle_project_create(&state, request_id, host_id, path, name).await;
            });
        }
        ClientMessage::ProjectRename {
            request_id,
            project_id,
            name,
        } => workspace::handle_project_rename(state, request_id, project_id, name),
        ClientMessage::ProjectArchive {
            request_id,
            project_id,
            archived,
        } => workspace::handle_project_archive(state, request_id, project_id, archived),
        ClientMessage::ProjectFocus {
            request_id,
            project_id,
        } => workspace::handle_project_focus(state, request_id, project_id),
        ClientMessage::WorkspaceSnapshot {
            request_id,
            host_id,
            project_id,
        } => workspace::handle_workspace_snapshot(state, request_id, host_id, project_id),
        ClientMessage::WorkspaceFocus {
            request_id,
            workspace_id,
        } => workspace::handle_workspace_focus(state, request_id, workspace_id),
        ClientMessage::WorkspaceRename {
            request_id,
            workspace_id,
            name,
        } => workspace::handle_workspace_rename(state, request_id, workspace_id, name),
        ClientMessage::WorkspacePin {
            request_id,
            workspace_id,
            pinned,
        } => workspace::handle_workspace_mutation(
            state,
            request_id,
            workspace_id,
            "workspace_pin_failed",
            |db, id| db.set_workspace_pinned(id, pinned),
        ),
        ClientMessage::WorkspaceNest {
            request_id,
            workspace_id,
            parent_workspace_id,
        } => workspace::handle_workspace_mutation(
            state,
            request_id,
            workspace_id,
            "workspace_nest_failed",
            |db, id| db.set_workspace_parent(id, parent_workspace_id.as_deref()),
        ),
        ClientMessage::WorkspaceRestore {
            request_id,
            workspace_id,
        } => workspace::handle_workspace_restore(state, request_id, workspace_id),
    }
}
