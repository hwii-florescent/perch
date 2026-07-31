//! clipboard_image.rs — Wave 2 item 9: staging for pasted clipboard images.
//!
//! Ported from `reference/herdr/src/server/clipboard_image.rs` (behavioral
//! reference, not copied verbatim — herdr stages to a per-euid temp
//! directory since it's a multi-session daemon; perch is single-user per
//! `$HOME`, so staged images live under `~/.perch/clipboard-images/`,
//! mirroring `db.rs`'s `default_db_path()` HOME-resolution pattern).
//!
//! Flow: the web client uploads raw image bytes via `POST
//! {base}clipboard-image?ext=png` (see `server.rs`'s `clipboard_image_upload`
//! handler) when the user pastes an image while a terminal/CLI pane is
//! focused. We stage the bytes to a uuid-named file and hand back its path,
//! which the client then writes into the PTY as literal (quoted) text — the
//! same trick herdr uses, since most CLI agents accept a file path argument
//! for image input. Stale staged files (older than 24h) are swept on every
//! stage call, matching herdr's `cleanup_stale`.
//!
//! v1 scope: local host only. Federated/remote-host paste is out of scope —
//! there is no HTTP path from the browser to a remote perch's clipboard
//! endpoint (only the WS connection is tunneled through the hub), so pasting
//! an image while a *remote* terminal pane is focused is a documented no-op
//! for now (see `Terminal.tsx`/`AgentCliTerminal.tsx`).

use std::fs;
use std::io::{self, Write as _};
use std::path::{Path, PathBuf};
use std::time::Duration;

use uuid::Uuid;

const STAGED_CLIPBOARD_IMAGE_MAX_AGE: Duration = Duration::from_secs(24 * 60 * 60);

/// Resolve `~/.perch/clipboard-images/` (mirrors `db.rs::default_db_path`).
fn staging_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    Path::new(&home).join(".perch").join("clipboard-images")
}

fn ensure_staging_dir() -> io::Result<PathBuf> {
    let dir = staging_dir();
    fs::create_dir_all(&dir)?;
    restrict_dir_permissions(&dir)?;
    Ok(dir)
}

#[cfg(unix)]
fn restrict_dir_permissions(dir: &Path) -> io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(dir, fs::Permissions::from_mode(0o700))
}

#[cfg(windows)]
fn restrict_dir_permissions(_dir: &Path) -> io::Result<()> {
    Ok(())
}

#[cfg(unix)]
fn restrict_file_options(options: &mut fs::OpenOptions) {
    use std::os::unix::fs::OpenOptionsExt;
    options.mode(0o600);
}

#[cfg(windows)]
fn restrict_file_options(_options: &mut fs::OpenOptions) {}

/// Whitelist known image extensions (matches herdr's `sanitize_extension`);
/// anything unrecognized defaults to `png` rather than trusting arbitrary
/// client-supplied text as a filesystem extension.
fn sanitize_extension(extension: &str) -> &'static str {
    if extension.eq_ignore_ascii_case("png") {
        "png"
    } else if extension.eq_ignore_ascii_case("jpg") || extension.eq_ignore_ascii_case("jpeg") {
        "jpg"
    } else if extension.eq_ignore_ascii_case("gif") {
        "gif"
    } else if extension.eq_ignore_ascii_case("webp") {
        "webp"
    } else if extension.eq_ignore_ascii_case("bmp") {
        "bmp"
    } else {
        "png"
    }
}

fn cleanup_stale(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let Ok(modified) = metadata.modified() else {
            continue;
        };
        if modified.elapsed().unwrap_or_default() > STAGED_CLIPBOARD_IMAGE_MAX_AGE {
            let _ = fs::remove_file(path);
        }
    }
}

/// Stage `data` (raw image bytes) to a new uuid-named file under
/// `~/.perch/clipboard-images/` with the given (sanitized) extension.
/// Returns the absolute path on success.
pub fn stage(data: &[u8], extension: &str) -> io::Result<PathBuf> {
    let extension = sanitize_extension(extension);
    let dir = ensure_staging_dir()?;
    cleanup_stale(&dir);

    for _ in 0..10 {
        let path = dir.join(format!("{}.{extension}", Uuid::new_v4()));
        let mut options = fs::OpenOptions::new();
        options.write(true).create_new(true);
        restrict_file_options(&mut options);
        let mut file = match options.open(&path) {
            Ok(file) => file,
            Err(err) if err.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(err) => return Err(err),
        };
        file.write_all(data)?;
        return Ok(path);
    }

    Err(io::Error::new(
        io::ErrorKind::AlreadyExists,
        "failed to allocate unique clipboard image staging path",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_extension_accepts_known_image_extensions() {
        assert_eq!(sanitize_extension("PNG"), "png");
        assert_eq!(sanitize_extension("jpeg"), "jpg");
        assert_eq!(sanitize_extension("webp"), "webp");
        assert_eq!(sanitize_extension("sh"), "png");
    }

    #[test]
    fn stage_writes_bytes_and_returns_a_readable_path() {
        // Isolate this test's HOME so it doesn't touch the real
        // ~/.perch/clipboard-images/ directory.
        let tmp = std::env::temp_dir().join(format!("perch-clipimg-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&tmp).unwrap();
        // Safety: test-only, no concurrent std::env::set_var in this crate's
        // test suite touches HOME.
        unsafe {
            std::env::set_var("HOME", &tmp);
        }
        let path = stage(b"fake-image-bytes", "png").expect("stage should succeed");
        assert!(path.starts_with(tmp.join(".perch").join("clipboard-images")));
        assert_eq!(fs::read(&path).unwrap(), b"fake-image-bytes");
    }
}
