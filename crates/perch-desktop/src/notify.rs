//! Native notification authorization, delivery and click-to-open. macOS uses
//! UserNotifications: the Tauri desktop plugin reports Granted unconditionally
//! and cannot tell us whether macOS permits banners. Only the main UI has IPC.
//! Permission requests and System Settings are explicit user actions; sending
//! an alert never requests consent. Enqueue errors reach the UI's toast fallback.

#[cfg(target_os = "macos")]
use tauri::{AppHandle, Manager};

#[cfg(any(target_os = "macos", test))]
const OPEN_SESSION_EVENT: &str = "perch:open-session";

#[cfg(any(target_os = "macos", test))]
fn open_session_script(session_id: &str) -> String {
    let id = serde_json::to_string(session_id).unwrap_or_else(|_| "\"\"".into());
    format!("window.dispatchEvent(new CustomEvent('{OPEN_SESSION_EVENT}', {{ detail: {id} }}))")
}

#[tauri::command]
pub async fn notification_status() -> Result<serde_json::Value, String> {
    #[cfg(target_os = "macos")]
    return tauri::async_runtime::spawn_blocking(macos::status)
        .await
        .map_err(|error| error.to_string())?;
    #[cfg(not(target_os = "macos"))]
    Err("Native notification settings are macOS only".into())
}

#[tauri::command]
pub async fn notification_request_permission() -> Result<serde_json::Value, String> {
    #[cfg(target_os = "macos")]
    return tauri::async_runtime::spawn_blocking(macos::request_permission)
        .await
        .map_err(|error| error.to_string())?;
    #[cfg(not(target_os = "macos"))]
    Err("Native notification permissions are macOS only".into())
}

#[tauri::command]
pub async fn notification_open_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let pane = if objc2::available!(macos = 13.0) {
            "x-apple.systempreferences:com.apple.Notifications-Settings.extension"
        } else {
            "x-apple.systempreferences:com.apple.preference.notifications"
        };
        let result = tokio::process::Command::new("/usr/bin/open")
            .arg(pane)
            .output()
            .await
            .map_err(|error| error.to_string())?;
        if result.status.success() {
            Ok(())
        } else {
            Err("Could not open macOS Notifications settings".into())
        }
    }
    #[cfg(not(target_os = "macos"))]
    Err("Native notification settings are macOS only".into())
}

#[tauri::command]
pub async fn notify_session(title: String, body: String, session_id: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return tauri::async_runtime::spawn_blocking(move || macos::send(&title, &body, &session_id))
        .await
        .map_err(|error| error.to_string())?;
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (title, body, session_id);
        Err("Native session notifications are macOS only".into())
    }
}

#[cfg(target_os = "macos")]
pub fn init(app: &AppHandle) -> Result<(), String> {
    macos::init(app)
}

#[cfg(target_os = "macos")]
mod macos {
    use super::*;
    use block2::{DynBlock, RcBlock};
    use objc2::{
        define_class, msg_send, rc::Retained, runtime::ProtocolObject, AnyThread, DeclaredClass,
    };
    use objc2_foundation::{NSBundle, NSError, NSObject, NSObjectProtocol, NSString};
    use objc2_user_notifications::*;
    use std::{cell::RefCell, sync::mpsc, time::Duration};

    define_class!(
        #[unsafe(super(NSObject))]
        #[ivars = AppHandle]
        struct NotificationDelegate;

        unsafe impl NSObjectProtocol for NotificationDelegate {}

        unsafe impl UNUserNotificationCenterDelegate for NotificationDelegate {
            #[unsafe(method(userNotificationCenter:willPresentNotification:withCompletionHandler:))]
            fn will_present(
                &self,
                _center: &UNUserNotificationCenter,
                _notification: &UNNotification,
                completion: &DynBlock<dyn Fn(UNNotificationPresentationOptions)>,
            ) {
                // The web delivery policy already suppresses the focused, viewed session.
                // Keep other sessions' system alerts visible while Perch is foreground.
                let options = if objc2::available!(macos = 11.0) {
                    UNNotificationPresentationOptions::Banner
                        | UNNotificationPresentationOptions::List
                } else {
                    #[allow(deprecated)] // macOS 10.15 deployment target.
                    UNNotificationPresentationOptions::Alert
                };
                completion.call((options,));
            }

            #[unsafe(method(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:))]
            fn did_respond(
                &self,
                _center: &UNUserNotificationCenter,
                response: &UNNotificationResponse,
                completion: &DynBlock<dyn Fn()>,
            ) {
                if &*response.actionIdentifier() == unsafe { UNNotificationDefaultActionIdentifier }
                {
                    let session_id = response.notification().request().identifier().to_string();
                    let app = self.ivars().clone();
                    let ui = app.clone();
                    let _ = app.run_on_main_thread(move || {
                        if let Some(window) = ui.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.eval(open_session_script(&session_id));
                        }
                    });
                }
                completion.call(());
            }
        }
    );

    // Apple's delegate is weak. Retain exactly one on the app/event-loop thread.
    thread_local! {
        static DELEGATE: RefCell<Option<Retained<NotificationDelegate>>> = const { RefCell::new(None) };
    }

    fn center() -> Result<Retained<UNUserNotificationCenter>, String> {
        // currentNotificationCenter raises an ObjC exception for an unbundled
        // executable. Do not impersonate Terminal (or change its permissions).
        if NSBundle::mainBundle().bundleIdentifier().is_none() {
            return Err(
                "Notifications require the bundled Perch desktop app, not cargo run".into(),
            );
        }
        Ok(UNUserNotificationCenter::currentNotificationCenter())
    }

    pub(super) fn init(app: &AppHandle) -> Result<(), String> {
        let center = center()?;
        let delegate = NotificationDelegate::alloc().set_ivars(app.clone());
        let delegate: Retained<NotificationDelegate> = unsafe { msg_send![super(delegate), init] };
        center.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));
        DELEGATE.with(|slot| *slot.borrow_mut() = Some(delegate));
        Ok(())
    }

    fn permission(status: UNAuthorizationStatus) -> &'static str {
        match status {
            UNAuthorizationStatus::NotDetermined => "default",
            UNAuthorizationStatus::Denied => "denied",
            UNAuthorizationStatus::Authorized => "granted",
            UNAuthorizationStatus::Provisional => "provisional",
            _ => "unknown",
        }
    }

    pub(super) fn status() -> Result<serde_json::Value, String> {
        let (tx, rx) = mpsc::channel();
        center()?.getNotificationSettingsWithCompletionHandler(&RcBlock::new(move |settings: std::ptr::NonNull<UNNotificationSettings>| {
            // The settings pointer is valid for this callback only; copy plain data.
            let settings = unsafe { settings.as_ref() };
            let _ = tx.send(serde_json::json!({
                "permission": permission(settings.authorizationStatus()),
                "alerts": settings.alertSetting() == UNNotificationSetting::Enabled,
                "alertStyle": match settings.alertStyle() {
                    UNAlertStyle::None => "none",
                    UNAlertStyle::Banner => "banner",
                    UNAlertStyle::Alert => "alert",
                    _ => "unknown",
                },
                "notificationCenter": settings.notificationCenterSetting() == UNNotificationSetting::Enabled,
            }));
        }));
        rx.recv_timeout(Duration::from_secs(5))
            .map_err(|error| format!("Could not read macOS notification settings: {error}"))
    }

    static REQUEST: std::sync::Mutex<()> = std::sync::Mutex::new(());

    pub(super) fn request_permission() -> Result<serde_json::Value, String> {
        let _request = REQUEST
            .try_lock()
            .map_err(|_| "A notification permission request is already open")?;
        let current = status()?;
        if current["permission"] != "default" && current["permission"] != "provisional" {
            return Ok(current); // A denied grant must be changed in System Settings.
        }
        let (tx, rx) = mpsc::channel();
        center()?.requestAuthorizationWithOptions_completionHandler(
            UNAuthorizationOptions::Alert | UNAuthorizationOptions::Sound,
            &RcBlock::new(move |_granted, error: *mut NSError| {
                let result = match unsafe { error.as_ref() } {
                    Some(error) => Err(error.localizedDescription().to_string()),
                    None => Ok(()),
                };
                let _ = tx.send(result);
            }),
        );
        // ponytail: one bounded blocking worker while consent is open (2 min);
        // move this to an async callback if permission UI ever needs longer.
        rx.recv_timeout(Duration::from_secs(120))
            .map_err(|error| {
                format!("Notification permission request did not finish: {error}")
            })??;
        status()
    }

    pub(super) fn send(title: &str, body: &str, session_id: &str) -> Result<(), String> {
        let settings = status()?;
        if settings["permission"] != "granted" && settings["permission"] != "provisional" {
            return Err(
                "Notifications are not allowed. Enable them in Settings → Notifications.".into(),
            );
        }
        let content = UNMutableNotificationContent::new();
        content.setTitle(&NSString::from_str(title));
        content.setBody(&NSString::from_str(body));
        // No native sound: soundEnabled owns the independent in-app tone.
        let request = UNNotificationRequest::requestWithIdentifier_content_trigger(
            &NSString::from_str(session_id),
            &content,
            None,
        );
        let (tx, rx) = mpsc::channel();
        center()?.addNotificationRequest_withCompletionHandler(
            &request,
            Some(&RcBlock::new(move |error: *mut NSError| {
                let result = match unsafe { error.as_ref() } {
                    Some(error) => Err(error.localizedDescription().to_string()),
                    None => Ok(()),
                };
                let _ = tx.send(result);
            })),
        );
        rx.recv_timeout(Duration::from_secs(5))
            .map_err(|error| format!("Could not submit the notification to macOS: {error}"))?
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        #[test]
        fn native_authorization_is_not_assumed_granted() {
            assert_eq!(permission(UNAuthorizationStatus::NotDetermined), "default");
            assert_eq!(permission(UNAuthorizationStatus::Denied), "denied");
            assert_eq!(permission(UNAuthorizationStatus::Authorized), "granted");
            assert_eq!(
                permission(UNAuthorizationStatus::Provisional),
                "provisional"
            );
            assert_eq!(permission(UNAuthorizationStatus(99)), "unknown");
        }
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
