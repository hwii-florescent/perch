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
    patch: crate::protocol::SettingsPatch,
) {
    // Convert protocol::SettingsPatch → settings::SettingsPatch.
    let store_patch = crate::settings::SettingsPatch {
        custom_models: patch.custom_models.map(custom_models_to_store),
        default_cwd: patch.default_cwd,
        theme: patch.theme,
        sound_enabled: patch.sound_enabled,
        toast_delivery: patch.toast_delivery,
        chat_mode: patch.chat_mode,
        terminal_scrollback: patch.terminal_scrollback,
        terminal_login_shell: patch.terminal_login_shell,
    };
    match state.app.settings.update(store_patch) {
        Ok(updated) => {
            let _ = state.out_tx.send(ServerMessage::SettingsCurrent {
                settings: settings_to_wire(&updated),
            });
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
        custom_models: CustomModelsData {
            claude: s.custom_models.claude.clone(),
            codex: s.custom_models.codex.clone(),
        },
        default_cwd: s.default_cwd.clone(),
        theme: s.theme.clone(),
        sound_enabled: s.sound_enabled,
        toast_delivery: s.toast_delivery.clone(),
        chat_mode: s.chat_mode.clone(),
        terminal_scrollback: s.terminal_scrollback,
        terminal_login_shell: s.terminal_login_shell,
    }
}

pub(super) fn custom_models_to_store(cm: CustomModelsData) -> crate::settings::CustomModelsData {
    crate::settings::CustomModelsData {
        claude: cm.claude,
        codex: cm.codex,
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
