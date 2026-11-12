//! The sound for a session that finished or needs you: the system's own alert, through the
//! platform API, so it follows the person's alert volume and output device.
//!
//! The follower only reports that a sound is due (`Update::Alert`, which already honours the
//! person's Settings switch and whether they are looking at the session); the app calls [`play`].
//! Tests never call it.

use crate::sidebar::Alert;

#[cfg(target_os = "macos")]
#[link(name = "AppKit", kind = "framework")]
extern "C" {
    /// `NSBeep`: the user's chosen alert sound.
    fn NSBeep();
}

/// Play the alert: once when a session is done, twice when one is waiting on an answer, so the
/// two are told apart. Returns at once.
pub fn play(alert: Alert) {
    #[cfg(target_os = "macos")]
    std::thread::spawn(move || {
        for beep in 0..beeps(alert) {
            if beep > 0 {
                std::thread::sleep(std::time::Duration::from_millis(220));
            }
            // SAFETY: NSBeep takes no arguments, touches no memory of ours, and is safe to call
            // from any thread.
            unsafe { NSBeep() };
        }
    });
    #[cfg(not(target_os = "macos"))]
    let _ = alert;
}

#[cfg(any(target_os = "macos", test))]
fn beeps(alert: Alert) -> u32 {
    match alert {
        Alert::Done => 1,
        Alert::Blocked => 2,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_blocked_session_sounds_unlike_a_finished_one() {
        assert_ne!(beeps(Alert::Done), beeps(Alert::Blocked));
    }
}
