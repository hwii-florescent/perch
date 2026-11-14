//! PERCH: a picture a script names by absolute path, read under the script's own read grant.
//!
//! The upstream `image` loads from the application's directory (an asset) or a URI. A host that
//! gives each script its own folder (a mod, a plugin) needs a script's own picture by path, and
//! must not let the path reach anything else: GPUI reads a `Resource::Path` with a plain
//! `fs::read`, which follows any link, opens any device and reads until it ends (`/dev/zero`
//! never does). So the read happens here, while the script that named the path is the current
//! scope: the path goes through the same capability resolver the `fs` module uses (an open
//! directory handle that refuses to leave the granted roots, links included), the target must
//! be a regular file no larger than [`MAX_BYTES`], and the bytes are what GPUI draws. Anything
//! else gives no picture and reads nothing.

use std::{cell::RefCell, collections::HashMap, io::Read, path::Path, sync::Arc, time::SystemTime};

use crate::capability::{Access, Capabilities};

/// The largest picture read, as a document image may be.
pub(crate) const MAX_BYTES: u64 = 8 * 1024 * 1024;

/// Pictures already read, by the path named and the file's size and change time, so a script
/// that describes its tree every frame does not read the file every frame, and an edited file
/// is read again.
type Key = (String, u64, Option<SystemTime>);

thread_local! {
    static READ: RefCell<HashMap<Key, Arc<gpui::Image>>> = RefCell::new(HashMap::new());
}

/// What a script's absolute image path came to: the path, for a dump, and the picture when its
/// grant let it be read.
#[derive(Clone)]
pub(crate) struct FileImage {
    pub(crate) path: String,
    pub(crate) image: Option<Arc<gpui::Image>>,
}

impl FileImage {
    /// Reads `path` under the current script's grant.
    pub(crate) fn named(path: String) -> Self {
        let image = read(&path, &crate::engine::quickjs::host::capabilities());
        Self { path, image }
    }
}

impl PartialEq for FileImage {
    fn eq(&self, other: &Self) -> bool {
        self.path == other.path
            && match (&self.image, &other.image) {
                (Some(a), Some(b)) => Arc::ptr_eq(a, b),
                (None, None) => true,
                _ => false,
            }
    }
}

impl std::fmt::Debug for FileImage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FileImage")
            .field("path", &self.path)
            .field("read", &self.image.is_some())
            .finish()
    }
}

/// The cache is let go past this many pictures (it only spares re-reading).
const KEPT: usize = 64;

/// The picture at absolute `path` if `capabilities` lets the script read it, else `None`.
pub(crate) fn read(path: &str, capabilities: &Capabilities) -> Option<Arc<gpui::Image>> {
    let grant = capabilities.open(Path::new(path), Access::Read).ok()?;
    let (dir, relative) = grant.into_parts();
    // Through the handle: a link anywhere on the way that leads out of the root is refused.
    let mut file = dir.open(&relative).ok()?;
    let meta = file.metadata().ok()?;
    if !meta.is_file() || meta.len() > MAX_BYTES {
        return None;
    }
    let key = (
        path.to_string(),
        meta.len(),
        meta.modified().ok().map(|t| t.into_std()),
    );
    if let Some(image) = READ.with(|read| read.borrow().get(&key).cloned()) {
        return Some(image);
    }
    let mut bytes = Vec::with_capacity(meta.len() as usize);
    file.by_ref()
        .take(MAX_BYTES + 1)
        .read_to_end(&mut bytes)
        .ok()?;
    if bytes.len() as u64 > MAX_BYTES {
        return None;
    }
    let format = match image::guess_format(&bytes).ok()? {
        image::ImageFormat::Png => gpui::ImageFormat::Png,
        image::ImageFormat::Jpeg => gpui::ImageFormat::Jpeg,
        image::ImageFormat::WebP => gpui::ImageFormat::Webp,
        image::ImageFormat::Gif => gpui::ImageFormat::Gif,
        image::ImageFormat::Bmp => gpui::ImageFormat::Bmp,
        image::ImageFormat::Tiff => gpui::ImageFormat::Tiff,
        image::ImageFormat::Ico => gpui::ImageFormat::Ico,
        // An SVG may name other files to draw; it is not read this way.
        _ => return None,
    };
    let image = Arc::new(gpui::Image::from_bytes(format, bytes));
    READ.with(|read| {
        let mut read = read.borrow_mut();
        if read.len() >= KEPT {
            read.clear();
        }
        read.insert(key, image.clone());
    });
    Some(image)
}
