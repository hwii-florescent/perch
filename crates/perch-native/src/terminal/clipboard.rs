//! Where copied and pasted text goes. The terminal asks this trait, never the system, so a test
//! (or a view that must not touch the user's clipboard) holds a [`MemoryClipboard`]; the window
//! installs [`SystemClipboard`].

use gpui::{App, ClipboardEntry, ClipboardItem, ImageFormat};
use std::cell::RefCell;
use std::path::PathBuf;

pub trait Clipboard {
    fn read_text(&self, cx: &mut App) -> Option<String>;
    /// Files copied in the file manager, if that is what the clipboard holds.
    fn read_paths(&self, cx: &mut App) -> Option<Vec<PathBuf>>;
    /// An image the clipboard holds, as the system gave it.
    fn read_image(&self, cx: &mut App) -> Option<(ImageFormat, Vec<u8>)>;
    fn write_text(&self, text: &str, cx: &mut App);
}

/// An image ready for the core to stage: its bytes and the extension it is named by.
#[derive(Debug, PartialEq, Eq)]
pub struct StagedImage {
    pub extension: &'static str,
    pub bytes: Vec<u8>,
}

/// What a clipboard image becomes on disk: formats programs read are kept as they are, TIFF
/// (what the system clipboard holds for a screenshot) and BMP become PNG. `None` for a format
/// no terminal program is expected to take, or bytes that do not decode.
pub fn staged_image(format: ImageFormat, bytes: Vec<u8>) -> Option<StagedImage> {
    let extension = match format {
        ImageFormat::Png => "png",
        ImageFormat::Jpeg => "jpg",
        ImageFormat::Gif => "gif",
        ImageFormat::Webp => "webp",
        ImageFormat::Tiff | ImageFormat::Bmp => {
            let from = if format == ImageFormat::Tiff {
                image::ImageFormat::Tiff
            } else {
                image::ImageFormat::Bmp
            };
            let decoded = image::load_from_memory_with_format(&bytes, from).ok()?;
            let mut png = std::io::Cursor::new(Vec::new());
            decoded.write_to(&mut png, image::ImageFormat::Png).ok()?;
            return Some(StagedImage {
                extension: "png",
                bytes: png.into_inner(),
            });
        }
        _ => return None,
    };
    Some(StagedImage { extension, bytes })
}

/// The system clipboard.
pub struct SystemClipboard;

impl Clipboard for SystemClipboard {
    fn read_text(&self, cx: &mut App) -> Option<String> {
        cx.read_from_clipboard().and_then(|item| item.text())
    }

    fn read_paths(&self, cx: &mut App) -> Option<Vec<PathBuf>> {
        let item = cx.read_from_clipboard()?;
        let paths: Vec<PathBuf> = item
            .into_entries()
            .filter_map(|entry| match entry {
                ClipboardEntry::ExternalPaths(paths) => Some(paths.paths().to_vec()),
                _ => None,
            })
            .flatten()
            .collect();
        (!paths.is_empty()).then_some(paths)
    }

    fn read_image(&self, cx: &mut App) -> Option<(ImageFormat, Vec<u8>)> {
        cx.read_from_clipboard()?
            .into_entries()
            .find_map(|entry| match entry {
                ClipboardEntry::Image(image) => Some((image.format, image.bytes)),
                _ => None,
            })
    }

    fn write_text(&self, text: &str, cx: &mut App) {
        cx.write_to_clipboard(ClipboardItem::new_string(text.to_owned()));
    }
}

/// A clipboard of its own, in memory: what a view holds until it is given the system's.
#[derive(Default)]
pub struct MemoryClipboard {
    text: RefCell<Option<String>>,
    paths: RefCell<Option<Vec<PathBuf>>>,
    image: RefCell<Option<(ImageFormat, Vec<u8>)>>,
}

impl MemoryClipboard {
    pub fn new(text: Option<&str>) -> Self {
        Self {
            text: RefCell::new(text.map(str::to_owned)),
            paths: RefCell::new(None),
            image: RefCell::new(None),
        }
    }

    pub fn text(&self) -> Option<String> {
        self.text.borrow().clone()
    }

    /// Put files in as if the file manager had copied them.
    pub fn write_paths_for_test(&self, paths: Vec<PathBuf>) {
        *self.paths.borrow_mut() = Some(paths);
    }

    /// Put an image in as if a screenshot had been copied.
    pub fn write_image_for_test(&self, format: ImageFormat, bytes: Vec<u8>) {
        *self.image.borrow_mut() = Some((format, bytes));
    }

    /// Put text in as if something else had copied it.
    pub fn write_text_for_test(&self, text: &str) {
        *self.text.borrow_mut() = Some(text.to_owned());
    }
}

impl Clipboard for MemoryClipboard {
    fn read_text(&self, _: &mut App) -> Option<String> {
        self.text()
    }

    fn read_paths(&self, _: &mut App) -> Option<Vec<PathBuf>> {
        self.paths.borrow().clone()
    }

    fn read_image(&self, _: &mut App) -> Option<(ImageFormat, Vec<u8>)> {
        self.image.borrow().clone()
    }

    fn write_text(&self, text: &str, _: &mut App) {
        *self.text.borrow_mut() = Some(text.to_owned());
        *self.paths.borrow_mut() = None;
        *self.image.borrow_mut() = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encoded(format: image::ImageFormat) -> Vec<u8> {
        let picture = image::RgbImage::from_pixel(3, 2, image::Rgb([200, 10, 10]));
        let mut out = std::io::Cursor::new(Vec::new());
        picture.write_to(&mut out, format).unwrap();
        out.into_inner()
    }

    #[test]
    fn a_screenshot_becomes_a_png_and_other_pictures_stay_as_they_are() {
        for (format, source) in [
            (ImageFormat::Tiff, image::ImageFormat::Tiff),
            (ImageFormat::Bmp, image::ImageFormat::Bmp),
        ] {
            let staged = staged_image(format, encoded(source)).unwrap();
            assert_eq!(staged.extension, "png");
            let back = image::load_from_memory_with_format(&staged.bytes, image::ImageFormat::Png)
                .unwrap();
            assert_eq!((back.width(), back.height()), (3, 2));
        }
        let png = encoded(image::ImageFormat::Png);
        assert_eq!(
            staged_image(ImageFormat::Png, png.clone()),
            Some(StagedImage {
                extension: "png",
                bytes: png
            })
        );
        assert_eq!(
            staged_image(ImageFormat::Jpeg, vec![1]).unwrap().extension,
            "jpg"
        );
        assert_eq!(staged_image(ImageFormat::Svg, vec![1]), None);
        assert_eq!(
            staged_image(ImageFormat::Tiff, vec![1, 2, 3]),
            None,
            "bytes that are no TIFF"
        );
    }
}
