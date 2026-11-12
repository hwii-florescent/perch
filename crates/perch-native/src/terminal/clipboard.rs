//! Where copied and pasted text goes. The terminal asks this trait, never the system, so a test
//! (or a view that must not touch the user's clipboard) holds a [`MemoryClipboard`]; the window
//! installs [`SystemClipboard`].

use gpui::{App, ClipboardEntry, ClipboardItem};
use std::cell::RefCell;
use std::path::PathBuf;

pub trait Clipboard {
    fn read_text(&self, cx: &mut App) -> Option<String>;
    /// Files copied in the file manager, if that is what the clipboard holds.
    fn read_paths(&self, cx: &mut App) -> Option<Vec<PathBuf>>;
    fn write_text(&self, text: &str, cx: &mut App);
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

    fn write_text(&self, text: &str, cx: &mut App) {
        cx.write_to_clipboard(ClipboardItem::new_string(text.to_owned()));
    }
}

/// A clipboard of its own, in memory: what a view holds until it is given the system's.
#[derive(Default)]
pub struct MemoryClipboard {
    text: RefCell<Option<String>>,
    paths: RefCell<Option<Vec<PathBuf>>>,
}

impl MemoryClipboard {
    pub fn new(text: Option<&str>) -> Self {
        Self {
            text: RefCell::new(text.map(str::to_owned)),
            paths: RefCell::new(None),
        }
    }

    pub fn text(&self) -> Option<String> {
        self.text.borrow().clone()
    }

    /// Put files in as if the file manager had copied them.
    pub fn write_paths_for_test(&self, paths: Vec<PathBuf>) {
        *self.paths.borrow_mut() = Some(paths);
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

    fn write_text(&self, text: &str, _: &mut App) {
        *self.text.borrow_mut() = Some(text.to_owned());
        *self.paths.borrow_mut() = None;
    }
}
