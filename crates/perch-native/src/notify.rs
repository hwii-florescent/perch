//! The desktop client's notifications, as the Tauri app's (`crates/perch-desktop/src/notify.rs`):
//! system notifications only, never a message in the window (those are the phone's). The window
//! decides when one is due; the app calls [`show`]. Tests never call it.
//!
//! macOS attributes a notification to the app that posts it, so it goes through
//! `UNUserNotificationCenter` under the app's own identity, which exists only inside an app
//! bundle (`scripts/reinstall-desktop-native.sh`). An unbundled binary (`target/release` dev runs)
//! has no identity, and posting through a helper such as `osascript` would be labelled "Script
//! Editor": [`available`] is false there and nothing is posted.

use futures::channel::mpsc::UnboundedSender;

/// Whether a system notification can be posted under this app's own name: the binary runs inside
/// an app bundle. Off macOS there is none.
pub fn available() -> bool {
    #[cfg(target_os = "macos")]
    return macos::bundled();
    #[cfg(not(target_os = "macos"))]
    false
}

/// Set up delivery while the app is in front, and send the session id of each notification the
/// person clicks to `opened`. Call once on the main thread at start-up; a no-op when not
/// [`available`].
pub fn init(opened: UnboundedSender<String>) {
    #[cfg(target_os = "macos")]
    macos::init(opened);
    #[cfg(not(target_os = "macos"))]
    let _ = opened;
}

/// Show a notification in the system's notification centre; `id` is the session it is about, so
/// a newer one for the same session replaces it. Returns at once; one that cannot be shown (no
/// bundle, permission refused) is dropped, so callers check [`available`] first.
pub fn show(title: &str, body: &str, id: &str) {
    #[cfg(target_os = "macos")]
    macos::show(title, body, id);
    #[cfg(not(target_os = "macos"))]
    let _ = (title, body, id);
}

#[cfg(target_os = "macos")]
mod macos {
    use super::UnboundedSender;
    use block2::{DynBlock, RcBlock};
    use objc2::{
        define_class, msg_send, rc::Retained, runtime::ProtocolObject, AnyThread, DeclaredClass,
    };
    use objc2_foundation::{NSBundle, NSError, NSObject, NSObjectProtocol, NSString};
    use objc2_user_notifications::*;
    use std::{sync::mpsc, sync::Once, time::Duration};

    define_class!(
        /// Without a delegate macOS holds a notification back while its app is in front.
        #[unsafe(super(NSObject))]
        #[name = "PerchNativeNotificationDelegate"]
        #[ivars = UnboundedSender<String>]
        struct Delegate;

        unsafe impl NSObjectProtocol for Delegate {}

        unsafe impl UNUserNotificationCenterDelegate for Delegate {
            #[unsafe(method(userNotificationCenter:willPresentNotification:withCompletionHandler:))]
            fn will_present(
                &self,
                _center: &UNUserNotificationCenter,
                _notification: &UNNotification,
                completion: &DynBlock<dyn Fn(UNNotificationPresentationOptions)>,
            ) {
                completion.call((UNNotificationPresentationOptions::Banner
                    | UNNotificationPresentationOptions::List,));
            }

            /// A click on the banner opens its session, as the Tauri app's does.
            #[unsafe(method(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:))]
            fn did_respond(
                &self,
                _center: &UNUserNotificationCenter,
                response: &UNNotificationResponse,
                completion: &DynBlock<dyn Fn()>,
            ) {
                if &*response.actionIdentifier() == unsafe { UNNotificationDefaultActionIdentifier }
                {
                    let id = response.notification().request().identifier().to_string();
                    let _ = self.ivars().unbounded_send(id);
                }
                completion.call(());
            }
        }
    );

    pub fn bundled() -> bool {
        // currentNotificationCenter raises an ObjC exception for an unbundled executable.
        NSBundle::mainBundle().bundleIdentifier().is_some()
    }

    pub fn init(opened: UnboundedSender<String>) {
        if !bundled() {
            return;
        }
        let delegate: Retained<Delegate> =
            unsafe { msg_send![super(Delegate::alloc().set_ivars(opened)), init] };
        UNUserNotificationCenter::currentNotificationCenter()
            .setDelegate(Some(ProtocolObject::from_ref(&*delegate)));
        // The center holds its delegate weakly, and the app lives as long as the process.
        std::mem::forget(delegate);
    }

    /// Ask for permission the first time only; macOS shows its prompt once and remembers the
    /// answer, so later calls need no round trip.
    fn authorize(center: &UNUserNotificationCenter) {
        static ASKED: Once = Once::new();
        ASKED.call_once(|| {
            let (tx, rx) = mpsc::channel();
            center.requestAuthorizationWithOptions_completionHandler(
                UNAuthorizationOptions::Alert | UNAuthorizationOptions::Sound,
                &RcBlock::new(move |_granted, _error: *mut NSError| {
                    let _ = tx.send(());
                }),
            );
            // ponytail: one worker blocks while the prompt is open (2 min); a later alert
            // waits behind it. Make it a callback if the prompt ever needs longer.
            let _ = rx.recv_timeout(Duration::from_secs(120));
        });
    }

    pub fn show(title: &str, body: &str, id: &str) {
        if !bundled() {
            return;
        }
        let (title, body, id) = (title.to_string(), body.to_string(), id.to_string());
        std::thread::spawn(move || {
            let center = UNUserNotificationCenter::currentNotificationCenter();
            authorize(&center);
            let content = UNMutableNotificationContent::new();
            content.setTitle(&NSString::from_str(&title));
            content.setBody(&NSString::from_str(&body));
            // No native sound: `soundEnabled` owns the app's own tone.
            let request = UNNotificationRequest::requestWithIdentifier_content_trigger(
                &NSString::from_str(&id),
                &content,
                None,
            );
            // A refused permission makes the center fail the request; nothing to do then.
            center.addNotificationRequest_withCompletionHandler(&request, None);
        });
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    /// The test binary is no app bundle: asking for the notification center there would raise.
    #[test]
    fn an_unbundled_binary_has_no_system_notifications() {
        assert!(!super::available());
        super::init(futures::channel::mpsc::unbounded().0);
        super::show("Session finished", "dropped", "s");
    }
}
