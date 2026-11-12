//! The sound for a session that finished or needs you: the system's own alert, through the
//! platform API, so it follows the person's alert volume and output device.
//!
//! The follower only reports that a sound is due (`Update::Alert`, which already honours the
//! person's Settings switch and whether they are looking at the session); the app calls [`play`].
//! Tests never call it.

use crate::sidebar::{Alert, Heard};
use std::path::{Component, Path, PathBuf};

/// What the core accepts as a notification sound (`mods::sound`).
const KINDS: [&str; 5] = ["mp3", "wav", "ogg", "m4a", "flac"];
const MAX_BYTES: u64 = 2 * 1024 * 1024;

/// The file a sound setting names, inside `folder` (the one that holds `mods/`): a relative path
/// of a kind the core accepts, no larger than it serves, that stays inside the folder once
/// links are resolved. `None` for anything else, in which case the system's sound stands in,
/// as the web's tone does when its file will not play.
pub fn file_in(folder: &Path, rel: &str) -> Option<PathBuf> {
    let relative = Path::new(rel);
    if rel.is_empty()
        || !relative
            .components()
            .all(|c| matches!(c, Component::Normal(_)))
    {
        return None;
    }
    let kind = relative.extension()?.to_str()?.to_ascii_lowercase();
    if !KINDS.contains(&kind.as_str()) {
        return None;
    }
    let base = folder.canonicalize().ok()?;
    let path = base.join(relative).canonicalize().ok()?;
    (path.starts_with(&base) && std::fs::metadata(&path).ok()?.len() <= MAX_BYTES).then_some(path)
}

#[cfg(target_os = "macos")]
#[link(name = "AppKit", kind = "framework")]
extern "C" {
    /// `NSBeep`: the user's chosen alert sound.
    fn NSBeep();
}

/// Play what is due, once it is known the person should hear it: their own file when they chose
/// one that can be played, else the system's alert, once when a session is done and twice when
/// one is waiting on an answer, so the two are told apart. Returns at once.
pub fn play(heard: &Heard) {
    if !heard.sound {
        return;
    }
    let (alert, file) = (heard.alert, heard.file.clone());
    #[cfg(target_os = "macos")]
    std::thread::spawn(move || {
        // `afplay` plays through the system's output and volume; a file it cannot play falls
        // back to the alert.
        if let Some(file) = file {
            let played = std::process::Command::new("/usr/bin/afplay")
                .arg(file)
                .status()
                .is_ok_and(|status| status.success());
            if played {
                return;
            }
        }
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
    let _ = (alert, file);
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

    #[test]
    fn only_a_playable_file_inside_the_folder_is_the_persons_sound() {
        let folder = std::env::temp_dir().join(format!("perch-sound-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(folder.join("sounds")).unwrap();
        std::fs::write(folder.join("sounds/ding.mp3"), b"x").unwrap();
        std::fs::write(folder.join("sounds/notes.txt"), b"x").unwrap();
        std::fs::write(folder.join("sounds/huge.wav"), vec![0; 2 * 1024 * 1024 + 1]).unwrap();
        let outside = folder.with_extension("outside.mp3");
        std::fs::write(&outside, b"x").unwrap();
        std::os::unix::fs::symlink(&outside, folder.join("sounds/link.mp3")).unwrap();

        let found = file_in(&folder, "sounds/ding.mp3").unwrap();
        assert!(found.ends_with("sounds/ding.mp3"));
        for bad in [
            "",
            "sounds/notes.txt",
            "sounds/huge.wav",
            "sounds/missing.mp3",
            "../x.mp3",
            "/etc/x.mp3",
            "sounds/link.mp3",
        ] {
            assert_eq!(file_in(&folder, bad), None, "{bad:?}");
        }
        let _ = std::fs::remove_dir_all(&folder);
        let _ = std::fs::remove_file(&outside);
    }
}
