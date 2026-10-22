//! Non-prompting macOS permission checks, shared by the desktop and terminal host.
//! These measure this process only, not every tool it might launch. No protected
//! folder is enumerated, screen captured, or TCC database content read. Requests
//! are separate and may only be called in response to an explicit user action.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PermissionState {
    Granted,
    NotGranted,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionCheck {
    pub id: String,
    pub title: String,
    pub description: String,
    pub state: PermissionState,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PermissionSnapshot {
    pub pid: u32,
    pub checks: Vec<PermissionCheck>,
}

pub fn snapshot() -> PermissionSnapshot {
    PermissionSnapshot {
        pid: std::process::id(),
        checks: checks(),
    }
}

#[cfg(not(target_os = "macos"))]
fn checks() -> Vec<PermissionCheck> {
    Vec::new()
}

/// Read-only *heuristic*, not a public FDA status API. Any readable probe is
/// evidence of access; missing databases and unrelated errors prove neither
/// grant nor denial and must not mask another probe's result.
#[cfg(any(target_os = "macos", test))]
fn file_access_state(
    results: impl IntoIterator<Item = std::io::Result<std::fs::File>>,
) -> PermissionState {
    results
        .into_iter()
        .fold(PermissionState::Unknown, |state, result| match result {
            Ok(_) => PermissionState::Granted,
            Err(e)
                if state != PermissionState::Granted
                    && e.kind() == std::io::ErrorKind::PermissionDenied =>
            {
                PermissionState::NotGranted
            }
            Err(_) => state,
        })
}

#[cfg(any(target_os = "macos", test))]
fn automation_state(status: i32) -> PermissionState {
    match status {
        0 => PermissionState::Granted,
        -1743 | -1744 => PermissionState::NotGranted, // denied / consent needed
        _ => PermissionState::Unknown,                // e.g. -600: target is not running
    }
}

#[cfg(target_os = "macos")]
fn checks() -> Vec<PermissionCheck> {
    use PermissionState::{Granted, NotGranted, Unknown};
    let home = user_home();
    // The per-user database may not exist, even with FDA enabled. Probe the
    // system database too; only open/close these files, never read their content.
    let fda = file_access_state(
        std::iter::once(std::fs::File::open(
            "/Library/Application Support/com.apple.TCC/TCC.db",
        ))
        .chain(home.as_ref().map(|home| {
            std::fs::File::open(home.join("Library/Application Support/com.apple.TCC/TCC.db"))
        })),
    );
    let state = |allowed| if allowed { Granted } else { NotGranted };
    let mut checks = vec![
        PermissionCheck {
            id: "fullDiskAccess".into(),
            title: "Full Disk Access".into(),
            description: if fda == Unknown {
                "Broad access to protected folders and personal data. The read-only probe could not determine access on this Mac; review it in System Settings."
            } else {
                "Broad access to protected folders and personal data. Tools you run may gain this access too; verify terminals separately."
            }.into(),
            state: fda,
        },
        PermissionCheck {
            id: "screenRecording".into(),
            title: "Screen Recording".into(),
            description: "Lets computer-use tools see your screen. macOS may require restarting the app or terminal host after a grant.".into(),
            state: state(unsafe { native::CGPreflightScreenCaptureAccess() }),
        },
        PermissionCheck {
            id: "accessibility".into(),
            title: "Accessibility".into(),
            description: "Lets computer-use tools inspect windows, click controls, and send keystrokes.".into(),
            state: state(unsafe { native::AXIsProcessTrusted() } != 0),
        },
    ];
    for (id, title, bundle, path) in AUTOMATION_TARGETS {
        if *id != "automationSystemEvents"
            && !std::path::Path::new(path).exists()
            && !home
                .as_ref()
                .is_some_and(|home| home.join(path.trim_start_matches('/')).exists())
        {
            continue;
        }
        checks.push(PermissionCheck {
            id: (*id).into(),
            title: format!("Automation · {title}"),
            description: format!("Allows AppleScript control of {title}. Open the app to check. Allow may start it; macOS grants Automation separately for each target app."),
            state: automation_state(native::automation(bundle, false)),
        });
    }
    checks
}

/// User-specific checks belong to the logged-in account, not a tool's mutable HOME.
#[cfg(target_os = "macos")]
fn user_home() -> Option<std::path::PathBuf> {
    use std::os::unix::ffi::OsStrExt;
    // SAFETY: reentrant lookup into caller-owned storage; copy pw_dir before
    // releasing that storage. A failed lookup yields unknown, never a fake grant.
    unsafe {
        let mut entry: libc::passwd = std::mem::zeroed();
        let mut result = std::ptr::null_mut();
        // ponytail: passwd records over 16 KiB yield unknown; grow on ERANGE
        // if directory-service accounts ever need larger records.
        let mut buffer = vec![0u8; 16 * 1024];
        let code = libc::getpwuid_r(
            libc::getuid(),
            &mut entry,
            buffer.as_mut_ptr().cast(),
            buffer.len(),
            &mut result,
        );
        if code != 0 || result.is_null() || entry.pw_dir.is_null() {
            return None;
        }
        Some(std::path::PathBuf::from(std::ffi::OsStr::from_bytes(
            std::ffi::CStr::from_ptr(entry.pw_dir).to_bytes(),
        )))
    }
}

#[cfg(target_os = "macos")]
const AUTOMATION_TARGETS: &[(&str, &str, &str, &str)] = &[
    (
        "automationSystemEvents",
        "System Events",
        "com.apple.systemevents",
        "/System/Library/CoreServices/System Events.app",
    ),
    (
        "automationSafari",
        "Safari",
        "com.apple.Safari",
        "/Applications/Safari.app",
    ),
    (
        "automationChrome",
        "Google Chrome",
        "com.google.Chrome",
        "/Applications/Google Chrome.app",
    ),
];

/// Allowlisted settings destinations. Never accept a URL or bundle id from UI content.
#[cfg(target_os = "macos")]
pub fn allow(id: &str) -> Result<(), String> {
    let pane = match id {
        "fullDiskAccess" => "Privacy_AllFiles",
        "screenRecording" => {
            unsafe { native::CGRequestScreenCaptureAccess() };
            "Privacy_ScreenCapture"
        }
        "accessibility" => {
            native::request_accessibility();
            "Privacy_Accessibility"
        }
        id => {
            let (_, _, bundle, _) = AUTOMATION_TARGETS
                .iter()
                .find(|t| t.0 == id)
                .ok_or("Unknown permission")?;
            // Explicit opt-in only: unlike preflight, this can block for consent.
            // The caller runs it on a blocking worker, never the UI thread.
            // A target must be running for macOS to register its consent entry.
            if native::automation(bundle, false) == -600 {
                let launched = std::process::Command::new("/usr/bin/open")
                    .args(["-g", "-b", bundle])
                    .status()
                    .map_err(|e| e.to_string())?;
                if !launched.success() {
                    return Err("Open the target app, then click Allow again.".into());
                }
                // open returns before an app necessarily finishes registering.
                for _ in 0..20 {
                    if native::automation(bundle, false) != -600 {
                        break;
                    }
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
            }
            let status = native::automation(bundle, true);
            if status != 0 && status != -1743 && status != -1744 {
                return Err(format!("macOS could not request Automation (error {status}). Open the target app and try again."));
            }
            "Privacy_Automation"
        }
    };
    let status = std::process::Command::new("/usr/bin/open")
        .arg(format!(
            "x-apple.systempreferences:com.apple.preference.security?{pane}"
        ))
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err("Could not open macOS System Settings".into())
    }
}

#[cfg(not(target_os = "macos"))]
pub fn allow(_: &str) -> Result<(), String> {
    Err("macOS permissions are unavailable on this platform".into())
}

#[cfg(target_os = "macos")]
mod native {
    use std::ffi::c_void;
    use std::ptr;

    #[link(name = "CoreGraphics", kind = "framework")]
    unsafe extern "C" {
        pub fn CGPreflightScreenCaptureAccess() -> bool;
        pub fn CGRequestScreenCaptureAccess() -> bool;
    }
    #[link(name = "ApplicationServices", kind = "framework")]
    unsafe extern "C" {
        pub fn AXIsProcessTrusted() -> u8;
        fn AXIsProcessTrustedWithOptions(options: *const c_void) -> u8;
        static kAXTrustedCheckOptionPrompt: *const c_void;
    }
    #[link(name = "CoreFoundation", kind = "framework")]
    unsafe extern "C" {
        static kCFBooleanTrue: *const c_void;
        fn CFDictionaryCreate(
            allocator: *const c_void,
            keys: *const *const c_void,
            values: *const *const c_void,
            count: isize,
            key_callbacks: *const c_void,
            value_callbacks: *const c_void,
        ) -> *const c_void;
        fn CFRelease(value: *const c_void);
    }
    #[repr(C)]
    struct AEDesc {
        descriptor_type: u32,
        data_handle: *mut c_void,
    }
    #[link(name = "Carbon", kind = "framework")]
    unsafe extern "C" {
        fn AECreateDesc(kind: u32, data: *const c_void, size: isize, result: *mut AEDesc) -> i32;
        fn AEDisposeDesc(desc: *mut AEDesc) -> i32;
        fn AEDeterminePermissionToAutomateTarget(
            target: *const AEDesc,
            event_class: u32,
            event_id: u32,
            ask: u8,
        ) -> i32;
    }

    pub fn automation(bundle: &str, ask: bool) -> i32 {
        // SAFETY: fixed bundle ids, byte lengths and C-layout descriptor; disposed on success.
        unsafe {
            let mut desc = AEDesc {
                descriptor_type: 0,
                data_handle: ptr::null_mut(),
            };
            let status = AECreateDesc(
                u32::from_be_bytes(*b"bund"),
                bundle.as_ptr().cast(),
                bundle.len() as isize,
                &mut desc,
            );
            if status != 0 {
                return status;
            }
            let wildcard = u32::from_be_bytes(*b"****");
            let status =
                AEDeterminePermissionToAutomateTarget(&desc, wildcard, wildcard, u8::from(ask));
            AEDisposeDesc(&mut desc);
            status
        }
    }

    pub fn request_accessibility() {
        // SAFETY: borrowed constant CF keys/values; dictionary lifetime covers the call.
        unsafe {
            let options = CFDictionaryCreate(
                ptr::null(),
                &kAXTrustedCheckOptionPrompt,
                &kCFBooleanTrue,
                1,
                ptr::null(),
                ptr::null(),
            );
            if !options.is_null() {
                AXIsProcessTrustedWithOptions(options);
                CFRelease(options);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checks_never_turn_unknown_errors_into_a_grant_or_denial() {
        assert!(allow("untrusted-settings-url").is_err());
        #[cfg(target_os = "macos")]
        assert!(user_home().unwrap().is_absolute());
        assert_eq!(automation_state(0), PermissionState::Granted);
        for code in [-1743, -1744] {
            assert_eq!(automation_state(code), PermissionState::NotGranted);
        }
        for code in [-600, -1] {
            assert_eq!(automation_state(code), PermissionState::Unknown);
        }
    }

    #[test]
    fn fda_probe_handles_missing_user_database_without_masking_access() {
        let error = |code| Err(std::io::Error::from_raw_os_error(code));
        let readable = || std::fs::File::open(std::env::current_exe().unwrap());
        for code in [libc::ENOENT, libc::EPERM, libc::EACCES, libc::EIO] {
            assert_eq!(
                file_access_state([readable(), error(code)]),
                PermissionState::Granted
            );
            assert_eq!(
                file_access_state([error(code), readable()]),
                PermissionState::Granted
            );
        }
        for code in [libc::EPERM, libc::EACCES] {
            assert_eq!(
                file_access_state([error(code), error(libc::ENOENT)]),
                PermissionState::NotGranted
            );
            assert_eq!(
                file_access_state([error(libc::ENOENT), error(code)]),
                PermissionState::NotGranted
            );
        }
        assert_eq!(
            file_access_state([error(libc::ENOENT), error(libc::EIO)]),
            PermissionState::Unknown
        );
        assert_eq!(file_access_state([]), PermissionState::Unknown);
    }
}
