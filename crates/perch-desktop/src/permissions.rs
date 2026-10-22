//! Native permission IPC, granted only to the loopback main webview. Never
//! expose arbitrary settings URLs or Apple Event targets to browser content.

#[tauri::command]
pub async fn permissions_status() -> Result<perch_core::permissions::PermissionReport, String> {
    tauri::async_runtime::spawn_blocking(perch_core::permissions::status)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn permissions_verify() -> Result<perch_core::permissions::PermissionReport, String> {
    tauri::async_runtime::spawn_blocking(perch_core::permissions::verify)
        .await
        .map_err(|e| e.to_string())?
}

// Never stack native consent dialogs from multiple app windows or IPC calls.
static REQUEST: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[tauri::command]
pub async fn permissions_allow(id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _request = REQUEST.try_lock().map_err(|_| {
            "A permission request is already open. Finish it before trying again.".to_string()
        })?;
        perch_core::permissions::allow(&id)
    })
    .await
    .map_err(|e| e.to_string())?
}
