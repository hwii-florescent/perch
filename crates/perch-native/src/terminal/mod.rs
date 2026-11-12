//! The terminal pane: libghostty-vt run client-side ([`vt`]) and drawn by GPUI ([`view`]), attached
//! to a session in a running core ([`attach`]).

pub mod actions;
pub mod attach;
pub mod clipboard;
pub mod context;
pub mod graphics;
pub mod keys;
pub mod layout;
pub mod links;
pub mod scroll;
pub mod scrollbar;
pub mod search;
pub mod select;
pub mod settings;
pub mod sprites;
pub mod view;
pub mod vt;

pub use view::{Status, TerminalEvent, TerminalView};
