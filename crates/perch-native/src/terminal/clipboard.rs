//! Where copied and pasted text goes. The terminal asks this trait, never the system, so a test
//! (or a view that must not touch the user's clipboard) holds a [`MemoryClipboard`]; the window
//! installs [`SystemClipboard`].

use gpui::{App, ClipboardItem};
use std::cell::RefCell;

pub trait Clipboard {
    fn read_text(&self, cx: &mut App) -> Option<String>;
    fn write_text(&self, text: &str, cx: &mut App);
}

/// The system clipboard.
pub struct SystemClipboard;

impl Clipboard for SystemClipboard {
    fn read_text(&self, cx: &mut App) -> Option<String> {
        cx.read_from_clipboard().and_then(|item| item.text())
    }

    fn write_text(&self, text: &str, cx: &mut App) {
        cx.write_to_clipboard(ClipboardItem::new_string(text.to_owned()));
    }
}

/// A clipboard of its own, in memory: what a view holds until it is given the system's.
#[derive(Default)]
pub struct MemoryClipboard {
    text: RefCell<Option<String>>,
}

impl MemoryClipboard {
    pub fn new(text: Option<&str>) -> Self {
        Self {
            text: RefCell::new(text.map(str::to_owned)),
        }
    }

    pub fn text(&self) -> Option<String> {
        self.text.borrow().clone()
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

    fn write_text(&self, text: &str, _: &mut App) {
        *self.text.borrow_mut() = Some(text.to_owned());
    }
}
