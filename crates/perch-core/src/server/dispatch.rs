//! `handle_message` — the single dispatch point for every
//! `ClientMessage` variant. Pure move from `server.rs` — see the
//! refactor plan's Phase 3. No logic changed: the match, its
//! exhaustiveness, and every arm (already reduced to one-line calls
//! into the domain modules by the rest of Phase 3) are untouched.

use super::*;

pub(super) fn handle_message(state: &Arc<ConnState>, msg: ClientMessage, raw_text: &str) {
    if state
        .app
        .hub
        .route_workspace_request(&state.conn_id, &state.out_tx, &msg, raw_text)
    {
        return;
    }
    match msg {
        ClientMessage::ContextPreview {
            request_id,
            workspace_id,
            source,
            instruction,
        } => context_bridge::preview(state, request_id, workspace_id, source, instruction),
        ClientMessage::ContextSend {
            request_id,
            workspace_id,
            source,
            instruction,
            digest,
            target_session_id,
            operation_id,
        } => context_bridge::send(
            state,
            request_id,
            workspace_id,
            source,
            instruction,
            digest,
            target_session_id,
            operation_id,
        ),
        ClientMessage::SessionCreate { cwd, host_id } => {
            session::handle_session_create(state, cwd, host_id)
        }
        ClientMessage::SessionResume { session_id } => {
            session::handle_session_resume(state, session_id)
        }
        ClientMessage::AgentManifestList {
            request_id,
            host_id,
        } => agents::handle_agent_manifest_list(state, raw_text, request_id, host_id),
        ClientMessage::AgentModelsList { request_id } => {
            reporter::handle_models_list(state, request_id)
        }
        ClientMessage::AgentUiGet {
            request_id,
            session_id,
            provider_id,
        } => native_ui::get(state, raw_text, request_id, session_id, provider_id),
        ClientMessage::AgentUiFind {
            request_id,
            session_id,
            provider_id,
            query,
        } => native_ui::find(state, raw_text, request_id, session_id, provider_id, query),
        ClientMessage::AgentUiDraft {
            request_id,
            session_id,
            provider_id,
        } => native_ui::draft(state, raw_text, request_id, session_id, provider_id),
        ClientMessage::AgentUiOlder {
            request_id,
            session_id,
            provider_id,
        } => native_ui::older(state, raw_text, request_id, session_id, provider_id),
        ClientMessage::AgentUiPrompt {
            request_id,
            session_id,
            provider_id,
            operation_id,
            generation,
            text,
            replaces,
            delivery,
        } => native_ui::control(
            state,
            raw_text,
            request_id,
            session_id,
            provider_id,
            generation,
            Some((operation_id, text, replaces, delivery)),
        ),
        ClientMessage::AgentUiAnswer {
            request_id,
            session_id,
            provider_id,
            generation,
            prompt_id,
            key,
        } => native_ui::answer(
            state,
            raw_text,
            request_id,
            session_id,
            provider_id,
            generation,
            prompt_id,
            key,
        ),
        ClientMessage::AgentUiOption {
            request_id,
            session_id,
            provider_id,
            generation,
            option,
            value,
        } => native_ui::option(
            state,
            raw_text,
            request_id,
            session_id,
            provider_id,
            generation,
            option,
            value,
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
            if_unowned,
        } => agents::handle_agent_control_acquire(
            state,
            raw_text,
            request_id,
            session_id,
            workspace_id,
            agent_id,
            channel,
            if_unowned,
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
        ClientMessage::BrowserHistoryRecord {
            ref url,
            ref title,
            visit,
        } => super::browser_history::handle_record(state, url, title, visit),
        ClientMessage::BrowserHistorySearch {
            request_id,
            ref query,
            limit,
        } => super::browser_history::handle_search(state, request_id, query, limit),
        ClientMessage::BrowserSuggest { request_id, query } => {
            super::browser_suggest::handle_suggest(state, request_id, query)
        }
        ClientMessage::CrewGet {
            request_id,
            session_id,
        } => super::crew::handle_get(state, request_id, session_id),
        ClientMessage::InboundGet {
            request_id,
            session_id,
        } => super::inbound::handle_get(state, request_id, session_id),
        ClientMessage::InboundAct {
            request_id,
            session_id,
            action,
            mode,
            message_id,
            generation,
        } => super::inbound::handle_act(
            state, request_id, session_id, action, mode, message_id, generation,
        ),
        ClientMessage::SuggestionsGet {
            request_id,
            session_id,
        } => super::suggestions::handle_get(state, request_id, session_id),
        ClientMessage::SuggestionAct {
            request_id,
            session_id,
            action,
            card_id,
            suggestion_id,
            generation,
            agent,
            model,
            worktree,
        } => super::suggestions::handle_act(
            state,
            request_id,
            session_id,
            action,
            card_id,
            suggestion_id,
            generation,
            agent,
            model,
            worktree,
        ),
        ClientMessage::CrewAct {
            request_id,
            session_id,
            child_session_id,
            action,
            generation,
            text,
        } => super::crew_actions::handle_act(
            state,
            request_id,
            session_id,
            child_session_id,
            action,
            generation,
            text,
        ),
        ClientMessage::InstructionsGet {
            request_id,
            scope,
            id,
        } => super::instructions::handle_get(state, request_id, scope, id),
        ClientMessage::InstructionsSet {
            request_id,
            scope,
            id,
            text,
            folders,
        } => super::instructions::handle_set(state, request_id, scope, id, text, folders),
        ClientMessage::ModsList { request_id } => super::mods::handle_list(state, request_id),
        ClientMessage::ModsReport {
            id,
            revision,
            error,
        } => super::mods::handle_report(state, id, revision, error),
        ClientMessage::ModsSnapshot {
            request_id,
            html,
            text,
            error,
        } => super::mods::handle_snapshot(state, request_id, html, text, error),
        ClientMessage::ModsSet {
            request_id,
            id,
            op,
            as_id,
        } => super::mods::handle_set(state, request_id, id, op, as_id),
        ClientMessage::MemoryList {
            request_id,
            project_id,
        } => super::memory::handle_list(state, request_id, project_id),
        ClientMessage::MemoryGet {
            request_id,
            project_id,
            name,
        } => super::memory::handle_get(state, request_id, project_id, name),
        ClientMessage::MemorySet {
            request_id,
            project_id,
            name,
            text,
            base_revision,
        } => super::memory::handle_set(state, request_id, project_id, name, text, base_revision),
        ClientMessage::MemoryDelete {
            request_id,
            project_id,
            name,
            base_revision,
        } => super::memory::handle_delete(state, request_id, project_id, name, base_revision),
        ClientMessage::BrowserHistoryRemove { ref url } => {
            super::browser_history::handle_remove(state, url)
        }
        ClientMessage::BrowserHistoryClear {} => super::browser_history::handle_clear(state),
        ClientMessage::AttentionList {} => super::attention::handle_list(state),
        ClientMessage::AttentionUpdate { ref ids, dismiss } => {
            super::attention::handle_update(state, ids, dismiss)
        }
        ClientMessage::CommandsList { ref session_id } => {
            session::handle_commands_list(state, raw_text, session_id)
        }
        ClientMessage::UsageGet { force } => {
            let state = state.clone();
            tokio::spawn(async move {
                // What the reporter's own model calls cost is in the estimate: no agent log holds it.
                let own = state
                    .app
                    .db
                    .reporter_runs_since(wall_clock_millis() - 31 * 24 * 3600 * 1000)
                    .unwrap_or_default()
                    .into_iter()
                    .map(|run| crate::usage::spend::OwnCall {
                        at_ms: run.at,
                        provider: run.provider,
                        model: run.model,
                        session: run.session_id,
                        input: run.input,
                        cache_read: run.cache_read,
                        cache_write: run.cache_write,
                        output: run.output,
                        cost_usd: run.cost_usd,
                    })
                    .collect();
                let (accounts, spend) = tokio::join!(
                    crate::usage::current(force),
                    crate::usage::spend::spend_with(own)
                );
                // The shared alert state dedupes, so however many clients poll,
                // each alert is announced once, to everyone.
                let settings = state.app.settings.get();
                let alerts = crate::usage::alerts::check_now(
                    &accounts,
                    &spend,
                    settings.usage_limit_alert,
                    settings.usage_daily_budget_usd,
                );
                let _ = state.out_tx.send(ServerMessage::UsageResult {
                    accounts,
                    spend: Some(spend),
                });
                for alert in alerts {
                    let _ = state
                        .app
                        .hub
                        .hub_events_tx
                        .send(Arc::new(ServerMessage::UsageAlert {
                            kind: alert.kind.to_string(),
                            title: alert.title,
                            body: alert.body,
                        }));
                }
            });
        }
        ClientMessage::UsageRedeemReset { account_id } => {
            let out_tx = state.out_tx.clone();
            // Spends a paid, irreversible credit: never from a paired phone.
            let refused = state.device_id.is_some();
            tokio::spawn(async move {
                let (outcome, message) = if refused {
                    (
                        "error",
                        Some("Resets can only be redeemed on the computer itself.".to_string()),
                    )
                } else {
                    crate::usage::redeem_reset(&account_id).await
                };
                let _ = out_tx.send(ServerMessage::UsageRedeemResult {
                    account_id,
                    outcome: outcome.to_string(),
                    message,
                });
            });
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

        ClientMessage::SurfaceOpen {
            request_id,
            viewer_id,
            workspace_id,
            kind,
            locator,
        } => surfaces::handle_open(state, request_id, viewer_id, workspace_id, kind, locator),
        ClientMessage::SurfaceList {
            request_id,
            workspace_id,
        } => surfaces::handle_list(state, request_id, workspace_id),
        ClientMessage::SurfaceClose {
            request_id,
            viewer_id,
            workspace_id,
            resource_id,
        } => surfaces::handle_close(state, request_id, viewer_id, workspace_id, resource_id),
        ClientMessage::ViewerPresentationGet {
            request_id,
            viewer_id,
            workspace_id,
        } => surfaces::handle_presentation_get(state, request_id, viewer_id, workspace_id),
        ClientMessage::ViewerPresentationSet {
            request_id,
            viewer_id,
            workspace_id,
            presentation,
        } => surfaces::handle_presentation_set(
            state,
            request_id,
            viewer_id,
            workspace_id,
            presentation,
        ),
        ClientMessage::SurfaceImport {
            request_id,
            viewer_id,
            workspace_id,
            files,
            session_order,
        } => surfaces::handle_import(
            state,
            request_id,
            viewer_id,
            workspace_id,
            files,
            session_order,
        ),
        ClientMessage::WorkspaceRun {
            request_id,
            workspace_id,
            command,
        } => terminal::handle_workspace_run(state, request_id, workspace_id, command),
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
            shared,
        } => {
            terminal::handle_terminal_input(state, raw_text, terminal_id, data, generation, shared)
        }
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
        ClientMessage::PhoneAccessGet { request_id } => {
            config::handle_phone_access_get(state, request_id)
        }
        ClientMessage::MachineHosts { request_id } => {
            config::handle_machine_hosts(state, request_id)
        }
        ClientMessage::MachineProbe {
            request_id,
            ssh_host,
        } => config::handle_machine(state, request_id, ssh_host, false),
        ClientMessage::MachineInstall {
            request_id,
            ssh_host,
        } => config::handle_machine(state, request_id, ssh_host, true),
        ClientMessage::DeviceRevoke {
            request_id,
            device_id,
        } => config::handle_device_revoke(state, request_id, device_id),

        ClientMessage::SettingsGet {} => config::handle_settings_get(state),
        ClientMessage::SettingsUpdate { patch } => config::handle_settings_update(state, *patch),
        ClientMessage::HostsList {} => config::handle_hosts_list(state),
        ClientMessage::HostsUpsert { host } => config::handle_hosts_upsert(state, host),
        ClientMessage::HostsDelete { id } => config::handle_hosts_delete(state, id),

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
        ClientMessage::FsSearch {
            request_id,
            workspace_id,
            query,
        } => fs::spawn_fs_search(state, request_id, workspace_id, query),
        ClientMessage::FsExtract {
            request_id,
            workspace_id,
            path,
        } => fs::spawn_fs_extract(state, request_id, workspace_id, path),
        ClientMessage::FsMutate {
            request_id,
            workspace_id,
            op,
            path,
            to,
        } => fs::spawn_fs_mutate(state, request_id, workspace_id, op, path, to),
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
        ClientMessage::FsLinks {
            request_id,
            workspace_id,
            hrefs,
        } => fs::spawn_fs_links(state, request_id, workspace_id, hrefs),
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
        } => workspace::handle_project_list(state, request_id, host_id),
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
        ClientMessage::ProjectRemove {
            request_id,
            project_id,
        } => workspace::handle_project_remove(state, request_id, project_id),
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
        ClientMessage::WorkspaceOrderSet {
            request_id,
            host_id,
            projects,
            sessions,
        } => workspace::handle_workspace_order_set(state, request_id, host_id, projects, sessions),
        ClientMessage::WorkspaceVisibility {
            request_id,
            workspace_id,
            hidden,
        } => workspace::handle_workspace_mutation(
            state,
            request_id,
            workspace_id,
            "workspace_visibility_failed",
            |db, id| db.set_workspace_hidden(id, hidden),
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
