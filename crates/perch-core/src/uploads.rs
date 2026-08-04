//! Per-session staging for composer attachments (files and photos).
//!
//! The web composer uploads a file to `POST {base}upload?sessionId=…&name=…`
//! (see `server.rs`'s `attachment_upload`); we write it under
//! `~/.perch/uploads/<sessionId>/` and hand back the absolute path. That path
//! is what the client puts in `chat.send`'s `attachments`, and what the
//! runners turn into either a `-i <path>` (codex, images) or a
//! `[Attached files: …]` note the CLI reads for itself.
//!
//! This mirrors `clipboard_image.rs`'s staging model — same `~/.perch` home
//! resolution, same `0700`/`0600` permissions, same 24h sweep — but keys by
//! session rather than by uuid so a session's attachments stay together and
//! are trivially inspectable.

use std::fs;
use std::io::{self, Write as _};
use std::path::{Path, PathBuf};
use std::time::Duration;

const STAGED_UPLOAD_MAX_AGE: Duration = Duration::from_secs(24 * 60 * 60);

fn uploads_root() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    Path::new(&home).join(".perch").join("uploads")
}

/// Reduce a client-supplied filename to something safe to join onto a
/// directory: basename only, `[A-Za-z0-9._-]` kept, everything else folded to
/// `_`. That removes `/` and neutralizes `..`, so the result can never escape
/// the session directory.
pub fn sanitize_filename(name: &str) -> String {
    let base = name.rsplit(['/', '\\']).next().unwrap_or(name);
    let cleaned: String = base
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let cleaned = cleaned.trim_matches('.').to_string();
    if cleaned.is_empty() {
        "attachment".to_string()
    } else {
        // Long names are a filesystem hazard, not a security one; cap them.
        cleaned.chars().take(120).collect()
    }
}

/// Session ids are server-minted uuids, but this endpoint takes one from the
/// client, so it gets the same treatment as the filename.
fn sanitize_session_id(session_id: &str) -> String {
    let cleaned: String = session_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    if cleaned.is_empty() {
        "unknown".to_string()
    } else {
        cleaned.chars().take(64).collect()
    }
}

#[cfg(unix)]
fn restrict_dir_permissions(dir: &Path) -> io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(dir, fs::Permissions::from_mode(0o700))
}

#[cfg(not(unix))]
fn restrict_dir_permissions(_dir: &Path) -> io::Result<()> {
    Ok(())
}

#[cfg(unix)]
fn restrict_file_options(options: &mut fs::OpenOptions) {
    use std::os::unix::fs::OpenOptionsExt;
    options.mode(0o600);
}

#[cfg(not(unix))]
fn restrict_file_options(_options: &mut fs::OpenOptions) {}

/// Delete session upload directories nobody has touched in 24h.
fn cleanup_stale(root: &Path) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let Ok(modified) = metadata.modified() else {
            continue;
        };
        if modified.elapsed().unwrap_or_default() > STAGED_UPLOAD_MAX_AGE {
            let path = entry.path();
            if metadata.is_dir() {
                let _ = fs::remove_dir_all(path);
            } else {
                let _ = fs::remove_file(path);
            }
        }
    }
}

/// Write `data` to `~/.perch/uploads/<sessionId>/<name>`, returning the
/// absolute path. An existing file of the same name is superseded by a
/// `-1`, `-2`, … suffix rather than overwritten, so re-attaching a file under
/// a name a *previous* turn already used can't change what that turn referred
/// to.
pub fn stage(session_id: &str, name: &str, data: &[u8]) -> io::Result<PathBuf> {
    let root = uploads_root();
    fs::create_dir_all(&root)?;
    restrict_dir_permissions(&root)?;
    cleanup_stale(&root);

    let dir = root.join(sanitize_session_id(session_id));
    fs::create_dir_all(&dir)?;
    restrict_dir_permissions(&dir)?;

    let name = sanitize_filename(name);
    let (stem, ext) = match name.rsplit_once('.') {
        Some((s, e)) if !s.is_empty() => (s.to_string(), format!(".{e}")),
        _ => (name.clone(), String::new()),
    };
    for attempt in 0..100 {
        let candidate = if attempt == 0 {
            name.clone()
        } else {
            format!("{stem}-{attempt}{ext}")
        };
        let path = dir.join(&candidate);
        let mut options = fs::OpenOptions::new();
        options.write(true).create_new(true);
        restrict_file_options(&mut options);
        let mut file = match options.open(&path) {
            Ok(f) => f,
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e),
        };
        file.write_all(data)?;
        return Ok(path);
    }
    Err(io::Error::new(
        io::ErrorKind::AlreadyExists,
        "failed to allocate a unique upload path",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_filename_strips_paths_and_hostile_characters() {
        assert_eq!(sanitize_filename("../../etc/passwd"), "passwd");
        assert_eq!(sanitize_filename("my photo (1).png"), "my_photo__1_.png");
        assert_eq!(sanitize_filename("..."), "attachment");
        // Only the basename survives, so shell metacharacters in a directory
        // component are gone before sanitisation even runs.
        assert_eq!(sanitize_filename("a;rm -rf /shot.png"), "shot.png");
        assert_eq!(sanitize_filename("a;rm$(x).png"), "a_rm__x_.png");
    }

    #[test]
    fn stage_writes_into_a_per_session_directory_without_clobbering() {
        let tmp = std::env::temp_dir().join(format!("perch-upload-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&tmp).unwrap();
        // Safety: test-only; no concurrent HOME mutation in this suite.
        unsafe {
            std::env::set_var("HOME", &tmp);
        }
        let first = stage("sess-1", "shot.png", b"one").unwrap();
        let second = stage("sess-1", "shot.png", b"two").unwrap();
        assert!(first.starts_with(tmp.join(".perch").join("uploads").join("sess-1")));
        assert_ne!(first, second);
        assert_eq!(fs::read(&first).unwrap(), b"one");
        assert_eq!(fs::read(&second).unwrap(), b"two");
        assert_eq!(second.file_name().unwrap(), "shot-1.png");
    }
}
