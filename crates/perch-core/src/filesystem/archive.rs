//! Confined archive extraction: exclusive sibling folder, no links/special
//! files, no overwrite, bounded input, entries and expanded bytes. On failure
//! the partial folder is kept and named in the error; existing data is untouched.
use super::*;

const MAX_ARCHIVE_BYTES: u64 = 512 * 1024 * 1024;
const MAX_EXPANDED_BYTES: u64 = 512 * 1024 * 1024;
const MAX_MEMBER_BYTES: u64 = 128 * 1024 * 1024;
const MAX_MEMBERS: usize = 10_000;

impl FileService {
    pub fn extract_archive(&self, path: &str) -> Result<String, FsError> {
        let (file, metadata) = self.open_content(path)?;
        let lower = metadata.name.to_ascii_lowercase();
        let suffix = [".tar.gz", ".tgz", ".zip", ".tar", ".gz"]
            .into_iter()
            .find(|suffix| lower.ends_with(suffix))
            .ok_or_else(|| FsError::Unsupported {
                path: path.into(),
                reason: "Supported archives: ZIP, TAR, TAR.GZ, TGZ and GZ".into(),
            })?;
        if metadata.size > MAX_ARCHIVE_BYTES {
            return Err(FsError::Unsupported {
                path: path.into(),
                reason: "Archive exceeds 512 MB".into(),
            });
        }
        let components = normalized_components(Path::new(path))?;
        let (parent, _) = self.open_parent(&components, path)?;
        let stem = &metadata.name[..metadata.name.len() - suffix.len()];
        let folder = format!("{stem}-extracted");
        let destination = Path::new(&metadata.path)
            .with_file_name(&folder)
            .to_string_lossy()
            .to_string();
        let root = mkdir_at(&parent, OsStr::new(&folder), false).map_err(|error| {
            FsError::io(
                "create extraction folder (choose a different archive name if the folder exists)",
                &destination,
                error,
            )
        })?;
        let mut budget = Budget::default();
        let result: io::Result<()> = (|| {
            if suffix == ".zip" {
                let mut archive = zip::ZipArchive::new(file)?;
                if archive.len() > MAX_MEMBERS {
                    return Err(invalid("Too many archive entries"));
                }
                for index in 0..archive.len() {
                    let mut member = archive.by_index(index)?;
                    let name = member.name().to_owned();
                    if member.unix_mode().is_some_and(|mode| {
                        let kind = mode & u32::from(libc::S_IFMT);
                        kind != 0
                            && kind != u32::from(libc::S_IFREG)
                            && kind != u32::from(libc::S_IFDIR)
                    }) {
                        return Err(invalid("Archive links and special files are not supported"));
                    }
                    budget.unpack(&root, &name, member.is_dir(), &mut member)?;
                }
            } else if suffix == ".gz" {
                let mut decoder = flate2::read::MultiGzDecoder::new(file);
                budget.unpack(&root, stem, false, &mut decoder)?;
            } else {
                let reader: Box<dyn Read> = if suffix == ".tar" {
                    Box::new(file)
                } else {
                    Box::new(flate2::read::MultiGzDecoder::new(file))
                };
                let mut archive = tar::Archive::new(reader);
                for member in archive.entries()? {
                    let mut member = member?;
                    let kind = member.header().entry_type();
                    if !kind.is_file() && !kind.is_dir() {
                        return Err(invalid("Archive links and special files are not supported"));
                    }
                    let name = member.path()?.to_string_lossy().to_string();
                    budget.unpack(&root, &name, kind.is_dir(), &mut member)?;
                }
            }
            root.sync_all()?;
            parent.sync_all()
        })();
        result.map_err(|error| {
            FsError::io(
                "extract archive; partial output kept in",
                &destination,
                error,
            )
        })?;
        Ok(destination)
    }
}

#[derive(Default)]
struct Budget {
    members: usize,
    bytes: u64,
}
impl Budget {
    fn unpack(
        &mut self,
        root: &File,
        name: &str,
        directory: bool,
        reader: &mut dyn Read,
    ) -> io::Result<()> {
        self.members += 1;
        if self.members > MAX_MEMBERS {
            return Err(invalid("Too many archive entries"));
        }
        // Reject Windows separators/prefixes too, even on Unix.
        if name.contains(['\\', ':']) {
            return Err(invalid("Unsafe archive path"));
        }
        let components =
            normalized_components(Path::new(name)).map_err(|_| invalid("Unsafe archive path"))?;
        if components.len() > 64 {
            return Err(invalid("Archive path is too deep"));
        }
        if components.is_empty() {
            return if directory {
                Ok(())
            } else {
                Err(invalid("Empty archive file path"))
            };
        }
        let (name, parents) = components.split_last().unwrap();
        let mut parent = root.try_clone()?;
        for component in parents {
            parent = mkdir_at(&parent, component, true)?;
        }
        if directory {
            mkdir_at(&parent, name, true)?;
            return Ok(());
        }
        let mut output = create_temp_at(&parent, name)?; // O_EXCL + O_NOFOLLOW
        let limit = MAX_MEMBER_BYTES.min(MAX_EXPANDED_BYTES.saturating_sub(self.bytes));
        let copied = io::copy(&mut reader.take(limit + 1), &mut output)?;
        self.bytes += copied;
        if copied > limit {
            return Err(invalid(
                "Archive expansion limit exceeded (128 MB/file, 512 MB total)",
            ));
        }
        output.sync_all()
    }
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

#[cfg(unix)]
fn mkdir_at(parent: &File, name: &OsStr, allow_existing: bool) -> io::Result<File> {
    let c_name = CStringPath::new(name)?;
    if unsafe { libc::mkdirat(parent.as_raw_fd(), c_name.as_ptr(), 0o700) } != 0 {
        let error = io::Error::last_os_error();
        if !allow_existing || error.kind() != io::ErrorKind::AlreadyExists {
            return Err(error);
        }
    }
    open_dir_at(parent, name)
}
#[cfg(not(unix))]
fn mkdir_at(_parent: &File, _name: &OsStr, _allow_existing: bool) -> io::Result<File> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "Extraction requires Unix no-follow primitives",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn extraction_confines_paths_rejects_links_and_never_overwrites() {
        let root = std::env::temp_dir().join(format!("perch-archives-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let service = FileService::new(&root).unwrap();
        let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
        zip.start_file("nested/hello.txt", zip::write::SimpleFileOptions::default())
            .unwrap();
        zip.write_all(b"hello").unwrap();
        fs::write(root.join("sample.zip"), zip.finish().unwrap().into_inner()).unwrap();
        assert_eq!(
            service.extract_archive("sample.zip").unwrap(),
            "sample-extracted"
        );
        assert_eq!(
            fs::read(root.join("sample-extracted/nested/hello.txt")).unwrap(),
            b"hello"
        );
        assert!(service.extract_archive("sample.zip").is_err());
        let output = open_dir_at(&service.root_handle, OsStr::new("sample-extracted")).unwrap();
        let mut budget = Budget::default();
        for path in [
            "../escape.txt",
            "/escape.txt",
            "C:\\escape.txt",
            "nested/../../escape.txt",
        ] {
            assert!(budget
                .unpack(&output, path, false, &mut Cursor::new(b"bad"))
                .is_err());
        }
        assert!(budget
            .unpack(&output, "nested/hello.txt", false, &mut Cursor::new(b"bad"))
            .is_err());
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&root, root.join("sample-extracted/link")).unwrap();
            assert!(budget
                .unpack(&output, "link/escape.txt", false, &mut Cursor::new(b"bad"))
                .is_err());
        }
        let mut tar = tar::Builder::new(Vec::new());
        let mut header = tar::Header::new_gnu();
        header.set_size(0);
        header.set_mode(0o777);
        header.set_entry_type(tar::EntryType::Symlink);
        header.set_link_name("../escape").unwrap();
        header.set_cksum();
        tar.append_data(&mut header, "link", io::empty()).unwrap();
        fs::write(root.join("links.tar"), tar.into_inner().unwrap()).unwrap();
        assert!(service.extract_archive("links.tar").is_err());
        assert!(!root.join("links-extracted/link").exists());
        let mut gz = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        gz.write_all(b"gzip text").unwrap();
        fs::write(root.join("text.txt.gz"), gz.finish().unwrap()).unwrap();
        service.extract_archive("text.txt.gz").unwrap();
        assert_eq!(
            fs::read(root.join("text.txt-extracted/text.txt")).unwrap(),
            b"gzip text"
        );
        budget.bytes = MAX_EXPANDED_BYTES;
        assert!(budget
            .unpack(&output, "too-big", false, &mut Cursor::new(b"x"))
            .is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
