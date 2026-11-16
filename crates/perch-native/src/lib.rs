//! Native Perch client: `client` talks to a running perch-core, `sidebar` reduces what it says
//! into what the window shows, `actions` names what the sidebar's keys do, `ui` draws it with
//! GPUI, `sound` plays an alert, and `handoff` opens the rest in Perch.

pub mod actions;
pub mod browser;
pub mod client;
pub mod editor;
pub mod files;
pub mod handoff;
pub mod keymap;
pub mod mods;
pub mod notify;
pub mod settings;
pub mod shell;
pub mod sidebar;
pub mod sound;
pub mod tab_drag;
pub mod tabs;
pub mod terminal;
pub mod ui;
pub mod workspace;
pub mod zoom;
