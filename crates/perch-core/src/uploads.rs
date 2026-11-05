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
use std::io;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt};

pub const MAX_UPLOAD_BYTES: u64 = 1024 * 1024 * 1024;
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

/// An upload stays private until completed. Dropping it on error, cancellation,
/// or after an SCP transfer removes the local copy, including partial bytes.
#[derive(Debug)]
pub struct StagedUpload {
    path: Option<PathBuf>,
}

impl StagedUpload {
    pub fn path(&self) -> &Path {
        self.path.as_deref().expect("uncommitted upload")
    }

    pub fn persist(mut self) -> PathBuf {
        self.path.take().expect("uncommitted upload")
    }
}

impl Drop for StagedUpload {
    fn drop(&mut self) {
        if let Some(path) = &self.path {
            let _ = fs::remove_file(path);
        }
    }
}

/// Reserve without clobbering paths used by earlier turns.
fn reserve(root: &Path, session_id: &str, name: &str) -> io::Result<(StagedUpload, fs::File)> {
    fs::create_dir_all(root)?;
    restrict_dir_permissions(root)?;
    cleanup_stale(root);

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
        let file = match options.open(&path) {
            Ok(f) => f,
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e),
        };
        return Ok((StagedUpload { path: Some(path) }, file));
    }
    Err(io::Error::new(
        io::ErrorKind::AlreadyExists,
        "failed to allocate a unique upload path",
    ))
}

/// Receive with constant memory, a 1 GiB bound and a 60-second idle timeout.
pub async fn receive<R: AsyncRead + Unpin>(
    session_id: &str,
    name: &str,
    reader: R,
) -> io::Result<StagedUpload> {
    receive_at(&uploads_root(), session_id, name, reader, MAX_UPLOAD_BYTES).await
}

async fn receive_at<R: AsyncRead + Unpin>(
    root: &Path,
    session_id: &str,
    name: &str,
    mut reader: R,
    limit: u64,
) -> io::Result<StagedUpload> {
    let (upload, file) = reserve(root, session_id, name)?;
    let mut file = tokio::fs::File::from_std(file);
    let mut buffer = [0u8; 64 * 1024];
    let mut total = 0u64;
    loop {
        let count = tokio::time::timeout(Duration::from_secs(60), reader.read(&mut buffer))
            .await
            .map_err(|_| {
                io::Error::new(io::ErrorKind::TimedOut, "upload stalled for 60 seconds")
            })??;
        if count == 0 {
            break;
        }
        total += count as u64;
        if total > limit {
            return Err(io::Error::new(
                io::ErrorKind::FileTooLarge,
                "file too large (max 1 GiB)",
            ));
        }
        file.write_all(&buffer[..count]).await?;
    }
    if total == 0 {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "empty upload"));
    }
    file.flush().await?;
    drop(file);
    Ok(upload)
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

    #[tokio::test]
    async fn streamed_uploads_are_bounded_private_and_never_clobber() {
        let root = std::env::temp_dir().join(format!("perch-upload-test-{}", uuid::Uuid::new_v4()));
        let first = receive_at(&root, "sess-1", "shot.png", &b"one"[..], 3)
            .await
            .unwrap()
            .persist();
        let second = receive_at(&root, "sess-1", "shot.png", &b"two"[..], 3)
            .await
            .unwrap();
        assert_eq!(fs::read(&first).unwrap(), b"one");
        assert_eq!(fs::read(second.path()).unwrap(), b"two");
        assert_eq!(second.path().file_name().unwrap(), "shot-1.png");
        let temporary = second.path().to_path_buf();
        drop(second);
        assert!(!temporary.exists());
        for (bytes, kind) in [
            (&b"four"[..], io::ErrorKind::FileTooLarge),
            (&b""[..], io::ErrorKind::InvalidInput),
        ] {
            assert_eq!(
                receive_at(&root, "sess-1", "bad.bin", bytes, 3)
                    .await
                    .unwrap_err()
                    .kind(),
                kind
            );
            assert!(!root.join("sess-1/bad.bin").exists());
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(&first).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn failed_and_cancelled_readers_remove_partial_uploads() {
        let root = std::env::temp_dir().join(format!("perch-upload-test-{}", uuid::Uuid::new_v4()));
        let (mut writer, reader) = tokio::io::duplex(16);
        writer.write_all(b"partial").await.unwrap();
        assert!(tokio::time::timeout(
            Duration::from_millis(20),
            receive_at(&root, "sess", "partial.bin", reader, 100)
        )
        .await
        .is_err());
        assert!(!root.join("sess/partial.bin").exists());
        fs::remove_dir_all(root).unwrap();
    }
}
