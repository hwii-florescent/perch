//! The native editor: `gpui-base`'s editor with Perch's incremental highlighter ([`highlight`]), syntax colours from
//! Perch's theme tokens ([`theme`]), and the `perch-editor` host module that gives a screen what the web's
//! `CodeEditor.tsx` gives the web ([`host`]).

pub mod highlight;
pub mod host;
pub mod keys;
pub mod theme;

pub use host::Editors;
