//! Click-to-open OS notifications. The notification plugin's `window.Notification`
//! is fire-and-forget (no click event), so a "session finished" alert that should
//! jump to its session goes through `notify_session`: macOS only, waits for the
//! click on its own thread (the wait ends when the alert is clicked, closed or
//! leaves Notification Center), then raises the window and tells the UI which
//! session to open. Other platforms return Err and the UI falls back to the plugin.

use tauri::{AppHandle, Manager};

/// DOM event the UI listens for (`store/index.ts`); `detail` is the session id.
const OPEN_SESSION_EVENT: &str = "perch:open-session";

/// Script that asks the UI to open `session_id`. The id is JSON-quoted, never spliced raw.
fn open_session_script(session_id: &str) -> String {
    let id = serde_json::to_string(session_id).unwrap_or_else(|_| "\"\"".into());
    format!("window.dispatchEvent(new CustomEvent('{OPEN_SESSION_EVENT}', {{ detail: {id} }}))")
}

#[tauri::command]
pub fn notify_session(
    app: AppHandle,
    title: String,
    body: String,
    session_id: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use mac_notification_sys::{Notification, NotificationResponse};
        // Dev runs are not a registered app, so borrow Terminal's identity (as the plugin does).
        let bundle = if tauri::is_dev() {
            "com.apple.Terminal".to_string()
        } else {
            app.config().identifier.clone()
        };
        // Err(AlreadySet) after the first call is fine.
        let _ = mac_notification_sys::set_application(&bundle);
        // One thread per alert, ended by click/close/auto-dismiss (see mac-notification-sys).
        std::thread::spawn(move || {
            let mut options = Notification::new();
            options.wait_for_click(true);
            let sent = mac_notification_sys::send_notification(&title, None, &body, Some(&options));
            if matches!(sent, Ok(NotificationResponse::Click)) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.eval(open_session_script(&session_id));
                }
            }
        });
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, title, body, session_id);
        Err("click-to-open notifications are macOS only".into())
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn session_id_is_quoted_not_spliced() {
        let script = super::open_session_script("a\"});alert(1);//");
        assert!(script.contains(r#"detail: "a\"});alert(1);//""#));
    }
}
