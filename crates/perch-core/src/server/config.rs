//! `settings.*` and `hosts.*` arm bodies, plus the wire/store mappers they
//! (and a couple of other call sites in `mod.rs`) share.
//!
//! Pure move from `server.rs` — see the refactor plan's Phase 3. No logic
//! changed.

use super::*;

pub(super) fn handle_settings_get(state: &Arc<ConnState>) {
    let s = state.app.settings.get();
    let _ = state.out_tx.send(ServerMessage::SettingsCurrent {
        settings: settings_to_wire(&s),
    });
}

pub(super) fn handle_settings_update(
    state: &Arc<ConnState>,
    mut patch: crate::protocol::SettingsPatch,
) {
    // A paired phone must not be able to cut off (or widen) its own way in:
    // Phone access is changed only from this computer, never by a device token.
    let mut rejected = None;
    if (patch.phone_access.is_some() || patch.relay_url.is_some()) && state.device_id.is_some() {
        patch.phone_access = None;
        patch.relay_url = None;
        rejected = Some("Phone access can only be changed on the computer itself.".to_string());
    } else if let Some(url) = patch.relay_url.as_deref().filter(|u| !u.trim().is_empty()) {
        if let Err(message) = crate::relay::parse_target(url) {
            patch.relay_url = None;
            rejected = Some(message);
        }
    }
    if rejected.is_some() {
        let app = state.app.clone();
        let out = state.out_tx.clone();
        tokio::spawn(async move {
            let _ = out.send(phone_access_status(&app, String::new(), rejected).await);
        });
    }
    // Convert protocol::SettingsPatch → settings::SettingsPatch.
    let store_patch = crate::settings::SettingsPatch {
        default_cwd: patch.default_cwd,
        theme: patch.theme,
        sound_enabled: patch.sound_enabled,
        toast_delivery: patch.toast_delivery,
        chat_mode: patch.chat_mode,
        terminal_scrollback: patch.terminal_scrollback,
        terminal_login_shell: patch.terminal_login_shell,
        dropped_path_double_quotes: patch.dropped_path_double_quotes,
        empty_workspace_agent: patch.empty_workspace_agent,
        keybindings: patch.keybindings,
        warn_close_agent: patch.warn_close_agent,
        preview_tabs: patch.preview_tabs,
        tab_shape: patch.tab_shape,
        minimum_contrast: patch.minimum_contrast,
        clipboard_write: patch.clipboard_write,
        pane_scrollbars: patch.pane_scrollbars,
        terminal_padding: patch.terminal_padding,
        terminal_opacity: patch.terminal_opacity,
        option_as_alt: patch.option_as_alt,
        sound_done: patch.sound_done,
        sound_blocked: patch.sound_blocked,
        phone_access: patch.phone_access,
        relay_url: patch.relay_url.clone(),
        permissions_setup_dismissed: patch.permissions_setup_dismissed,
        browser_search_engine: patch.browser_search_engine,
        browser_search_suggestions: patch.browser_search_suggestions,
        usage_limit_alert: patch.usage_limit_alert,
        usage_daily_budget_usd: patch.usage_daily_budget_usd,
        reporter_enabled: patch.reporter_enabled,
        reporter_claude_model: patch.reporter_claude_model,
        reporter_codex_model: patch.reporter_codex_model,
        leads_start_without_asking: patch.leads_start_without_asking,
        mods: patch.mods,
        reporter_pi_model: patch.reporter_pi_model,
        reporter_omp_model: patch.reporter_omp_model,
        max_live_sub_sessions: patch.max_live_sub_sessions,
        max_sub_sessions: patch.max_sub_sessions,
        max_messages_per_run: patch.max_messages_per_run,
        max_lead_wakes_per_run: patch.max_lead_wakes_per_run,
        max_interrupts_per_sub_session: patch.max_interrupts_per_sub_session,
        max_waiting_suggestions: patch.max_waiting_suggestions,
    };
    let phone_access = patch.phone_access;
    let relay_url = patch.relay_url;
    match state.app.settings.update(store_patch) {
        Ok(updated) => {
            // The admission rules read the limits the database holds.
            state.app.db.set_limits(updated.run_limits);
            if phone_access.is_some() {
                apply_phone_access(state.app.clone());
            }
            if relay_url.is_some() {
                apply_relay(state.app.clone());
            }
            // Settings are global (one chat mode for every client), so every
            // connection hears the change, the requester included.
            let _ = state
                .app
                .hub
                .hub_events_tx
                .send(Arc::new(ServerMessage::SettingsCurrent {
                    settings: settings_to_wire(&updated),
                }));
        }
        Err(e) => {
            let _ = state.out_tx.send(ServerMessage::Error {
                message: format!("settings.update failed: {e}"),
                request_id: None,
                code: None,
                retryable: false,
            });
        }
    }
}

/// Turn the LAN listener on or off to match the saved setting (re-read when
/// it is this call's turn, so quick toggles end in the last one), then tell
/// every client where phones can reach this host. A listener that cannot start
/// (no network, no free port) puts the setting back rather than showing "on".
fn apply_phone_access(app: AppState) {
    tokio::spawn(async move {
        let mut error = None;
        if let Err(e) = app.phone.apply(|| app.settings.get().phone_access).await {
            error = Some(format!("could not open the port: {e}"));
            let _ = app.settings.update(crate::settings::SettingsPatch {
                phone_access: Some(false),
                ..Default::default()
            });
        }
        let status = phone_access_status(&app, String::new(), error).await;
        let _ = app.hub.hub_events_tx.send(Arc::new(status));
    });
}

/// Connect the relay to match the saved address (`""` = off), then tell every
/// client. An address that cannot be used (no identity file, server not ready)
/// is cleared rather than left claiming to be on.
pub(super) fn apply_relay(app: AppState) {
    tokio::spawn(async move {
        let mut error = None;
        if let Err(e) = app.relay.apply(&app.settings.get().relay_url).await {
            error = Some(format!("could not start the relay: {e}"));
            let _ = app.settings.update(crate::settings::SettingsPatch {
                relay_url: Some(String::new()),
                ..Default::default()
            });
            let _ = app.relay.apply("").await;
        }
        app.phone.set_relay_on(app.relay.configured());
        let status = phone_access_status(&app, String::new(), error).await;
        let _ = app.hub.hub_events_tx.send(Arc::new(status));
    });
}

pub(super) async fn phone_access_status(
    app: &AppState,
    request_id: String,
    error: Option<String>,
) -> ServerMessage {
    use crate::relay::RelayState;
    let (mut addresses, tailscale) = app.phone.addresses().await;
    let relay = app.relay.status();
    if let Some(url) = relay.link {
        addresses.push(crate::protocol::PhoneAddress {
            kind: "relay".into(),
            url,
        });
    }
    let relay = match relay.state {
        RelayState::Off => None,
        RelayState::Connecting => Some(("connecting", None)),
        RelayState::Online => Some(("online", None)),
        RelayState::Error(message) => Some(("error", Some(message))),
    }
    .map(|(state, message)| crate::protocol::RelayInfo {
        state: state.into(),
        message,
    });
    ServerMessage::PhoneAccessStatus {
        request_id,
        enabled: app.phone.enabled(),
        always_on: app.phone.always_on(),
        addresses,
        tailscale: tailscale.map(|t| t.wire().to_string()),
        relay,
        default_relay: crate::relay::default_relay(),
        error,
    }
}

pub(super) fn handle_phone_access_get(state: &Arc<ConnState>, request_id: String) {
    let app = state.app.clone();
    let out = state.out_tx.clone();
    tokio::spawn(async move {
        let _ = out.send(phone_access_status(&app, request_id, None).await);
    });
}

pub(super) fn handle_machine_hosts(state: &Arc<ConnState>, request_id: String) {
    let hosts = std::env::var_os("HOME")
        .map(|home| crate::machine::ssh_config_hosts(std::path::Path::new(&home)))
        .unwrap_or_default();
    let _ = state
        .out_tx
        .send(ServerMessage::MachineHosts { request_id, hosts });
}

/// `machine.probe` (look) and `machine.install` (put `perch-core` there, then look again). ssh can
/// take seconds, so the answer comes later as `machine.result`; a failure carries what to do next.
pub(super) fn handle_machine(
    state: &Arc<ConnState>,
    request_id: String,
    ssh_host: String,
    install: bool,
) {
    let out = state.out_tx.clone();
    let reply = move |probe, installed_path, error: Option<crate::machine::MachineError>| {
        let login_argv = error
            .as_ref()
            .filter(|e| e.kind == crate::machine::Fault::NeedsLogin)
            .map(|_| crate::machine::login_argv(&ssh_host));
        ServerMessage::MachineResult {
            request_id: request_id.clone(),
            ssh_host: ssh_host.clone(),
            probe,
            installed_path,
            error,
            login_argv,
        }
    };
    // A paired phone looks at machines but does not put programs on them.
    if install && state.device_id.is_some() {
        let _ = out.send(reply(
            None,
            None,
            Some(crate::machine::MachineError {
                kind: crate::machine::Fault::Failed,
                message: "Installing on a machine can only be done on the computer itself.".into(),
                hint: "Open Perch on the computer and add the machine there.".into(),
            }),
        ));
        return;
    }
    let target = reply(None, None, None);
    let ServerMessage::MachineResult { ssh_host, .. } = &target else {
        unreachable!()
    };
    if let Err(message) = crate::ssh::validate_upload_host(ssh_host) {
        let _ = out.send(reply(
            None,
            None,
            Some(crate::machine::MachineError {
                kind: crate::machine::Fault::Failed,
                message,
                hint: "Use a name from ~/.ssh/config or user@host.".into(),
            }),
        ));
        return;
    }
    let ssh_host = ssh_host.clone();
    tokio::spawn(async move {
        let message = match run_machine(&ssh_host, install).await {
            Ok((probe, path)) => reply(Some(probe), path, None),
            Err(error) => reply(None, None, Some(error)),
        };
        let _ = out.send(message);
    });
}

async fn run_machine(
    ssh_host: &str,
    install: bool,
) -> Result<(crate::machine::Probe, Option<String>), crate::machine::MachineError> {
    let found = crate::machine::probe(ssh_host).await?;
    if !install {
        return Ok((found, None));
    }
    let path = crate::machine::install(ssh_host, &found).await?;
    Ok((crate::machine::probe(ssh_host).await?, Some(path)))
}

pub(super) fn handle_hosts_list(state: &Arc<ConnState>) {
    let hosts = state.app.hosts.list();
    let _ = state.out_tx.send(ServerMessage::HostsList {
        hosts: hosts.into_iter().map(host_to_wire).collect(),
    });
}

pub(super) fn handle_hosts_upsert(state: &Arc<ConnState>, host: SshHostEntry) {
    let store_host = wire_to_host(host);
    match state.app.hosts.upsert(store_host) {
        Ok(all) => {
            // Reload the hub with the updated host list (starts/stops tasks).
            state.app.hub.reload_hosts(&all);
            let wire: Vec<SshHostEntry> = all.into_iter().map(host_to_wire).collect();
            // Broadcast hosts.updated to ALL connections via hub channel.
            let _ = state.app.hub.hub_events_tx.send(std::sync::Arc::new(
                ServerMessage::HostsUpdated { hosts: wire },
            ));
        }
        Err(e) => {
            let _ = state.out_tx.send(ServerMessage::Error {
                message: format!("hosts.upsert failed: {e}"),
                request_id: None,
                code: None,
                retryable: false,
            });
        }
    }
}

pub(super) fn handle_hosts_delete(state: &Arc<ConnState>, id: String) {
    match state.app.hosts.delete(&id) {
        Ok(all) => {
            // Reload the hub (stops the deleted host's task).
            state.app.hub.reload_hosts(&all);
            let wire: Vec<SshHostEntry> = all.into_iter().map(host_to_wire).collect();
            // Broadcast hosts.updated to ALL connections via hub channel.
            let _ = state.app.hub.hub_events_tx.send(std::sync::Arc::new(
                ServerMessage::HostsUpdated { hosts: wire },
            ));
        }
        Err(e) => {
            let _ = state.out_tx.send(ServerMessage::Error {
                message: format!("hosts.delete failed: {e}"),
                request_id: None,
                code: None,
                retryable: false,
            });
        }
    }
}

pub(super) fn settings_to_wire(s: &crate::settings::Settings) -> SettingsData {
    SettingsData {
        default_cwd: s.default_cwd.clone(),
        theme: s.theme.clone(),
        sound_enabled: s.sound_enabled,
        toast_delivery: s.toast_delivery.clone(),
        chat_mode: s.chat_mode.clone(),
        terminal_scrollback: s.terminal_scrollback,
        terminal_login_shell: s.terminal_login_shell,
        dropped_path_double_quotes: s.dropped_path_double_quotes,
        empty_workspace_agent: s.empty_workspace_agent.clone(),
        keybindings: s.keybindings.clone(),
        warn_close_agent: s.warn_close_agent,
        preview_tabs: s.preview_tabs,
        tab_shape: s.tab_shape.clone(),
        minimum_contrast: s.minimum_contrast,
        clipboard_write: s.clipboard_write,
        pane_scrollbars: s.pane_scrollbars,
        terminal_padding: s.terminal_padding,
        terminal_opacity: s.terminal_opacity,
        option_as_alt: s.option_as_alt.clone(),
        sound_done: s.sound_done.clone(),
        sound_blocked: s.sound_blocked.clone(),
        phone_access: s.phone_access,
        relay_url: s.relay_url.clone(),
        permissions_setup_dismissed: s.permissions_setup_dismissed,
        browser_search_engine: s.browser_search_engine.clone(),
        browser_search_suggestions: s.browser_search_suggestions,
        usage_limit_alert: s.usage_limit_alert,
        usage_daily_budget_usd: s.usage_daily_budget_usd,
        reporter_enabled: s.reporter_enabled,
        reporter_claude_model: s.reporter_claude_model.clone(),
        reporter_codex_model: s.reporter_codex_model.clone(),
        leads_start_without_asking: s.leads_start_without_asking,
        mods: s.mods.clone(),
        reporter_pi_model: s.reporter_pi_model.clone(),
        reporter_omp_model: s.reporter_omp_model.clone(),
        max_live_sub_sessions: Some(s.run_limits.live),
        max_sub_sessions: Some(s.run_limits.total),
        max_messages_per_run: Some(s.run_limits.messages),
        max_lead_wakes_per_run: Some(s.run_limits.wakes),
        max_interrupts_per_sub_session: Some(s.run_limits.interrupts),
        max_waiting_suggestions: Some(s.run_limits.waiting_cards),
    }
}

pub(super) fn host_to_wire(h: crate::hosts::SshHost) -> SshHostEntry {
    SshHostEntry {
        id: h.id,
        name: h.name,
        ssh_host: h.ssh_host,
        remote_port: h.remote_port,
        enabled: h.enabled,
        mode: h.mode,
        direct_url: h.direct_url,
        remote_cmd: h.remote_cmd,
    }
}

pub(super) fn wire_to_host(h: SshHostEntry) -> crate::hosts::SshHost {
    crate::hosts::SshHost {
        id: h.id,
        name: h.name,
        ssh_host: h.ssh_host,
        remote_port: h.remote_port,
        enabled: h.enabled,
        // An unrecognised value from a client degrades to `"perch"` rather
        // than being stored verbatim, so a typo can't leave a host in a mode
        // nothing handles (see `hosts::HostMode`).
        mode: if h.mode == "direct" {
            h.mode
        } else {
            "perch".to_string()
        },
        direct_url: h.direct_url,
        remote_cmd: h.remote_cmd,
    }
}

// ---------------------------------------------------------------------------
// Paired devices
// ---------------------------------------------------------------------------

fn device_to_wire(device: crate::devices::DeviceRecord) -> crate::protocol::DeviceSummary {
    crate::protocol::DeviceSummary {
        id: device.id,
        name: device.name,
        created_at: device.created_at,
        last_seen_at: device.last_seen_at,
    }
}

fn send_device_list(state: &Arc<ConnState>, request_id: String) {
    let _ = state.out_tx.send(ServerMessage::DeviceListResult {
        request_id,
        devices: state
            .app
            .devices
            .list()
            .into_iter()
            .map(device_to_wire)
            .collect(),
    });
}

/// Offer a pairing code. Reaching this handler already means the connection
/// passed `authorize_request`, so only a paired device or a local client can
/// invite another one.
pub(super) fn handle_device_pair_start(state: &Arc<ConnState>, request_id: String) {
    let now = std::time::Instant::now();
    let code = state.app.devices.start_pairing(now);
    let expires_in_ms = crate::devices::CODE_TTL.as_millis() as i64;
    let _ = state.out_tx.send(ServerMessage::DevicePairCode {
        request_id,
        code,
        expires_in_ms,
    });
}

pub(super) fn handle_device_pair_cancel(state: &Arc<ConnState>, request_id: String) {
    state.app.devices.cancel_pairing();
    send_device_list(state, request_id);
}

pub(super) fn handle_device_list(state: &Arc<ConnState>, request_id: String) {
    send_device_list(state, request_id);
}

pub(super) fn handle_device_revoke(state: &Arc<ConnState>, request_id: String, device_id: String) {
    match state.app.devices.revoke(&device_id) {
        Ok(devices) => {
            let _ = state.out_tx.send(ServerMessage::DeviceListResult {
                request_id,
                devices: devices.into_iter().map(device_to_wire).collect(),
            });
        }
        Err(error) => {
            let _ = state.out_tx.send(ServerMessage::Error {
                message: format!("could not revoke that device: {error}"),
                request_id: Some(request_id),
                code: Some("device_revoke_failed".to_string()),
                retryable: true,
            });
        }
    }
}
