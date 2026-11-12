//! A system notification, for `toastDelivery: "system"`. The window decides when one is due; the
//! app calls [`show`]. Tests never call it.

/// Show `text` in the system's notification centre. Returns at once; a notification that cannot
/// be shown is dropped (the window's own toast is the fallback only when it is the chosen way).
pub fn show(text: &str) {
    #[cfg(target_os = "macos")]
    {
        let text = text.to_string();
        std::thread::spawn(move || {
            // The text goes in as an argument, not into the script, so nothing in a session's
            // title can be run.
            let _ = std::process::Command::new("/usr/bin/osascript")
                .args([
                    "-e",
                    "on run argv",
                    "-e",
                    "display notification (item 1 of argv) with title \"Perch\"",
                    "-e",
                    "end run",
                ])
                .arg(text)
                .status();
        });
    }
    #[cfg(not(target_os = "macos"))]
    let _ = text;
}
