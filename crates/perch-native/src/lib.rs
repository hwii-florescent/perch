//! Native Perch client: `client` talks to a running perch-core, `sidebar` reduces what it says
//! into what the window shows, `ui` draws that with GPUI, and `handoff` opens the rest in Perch.

pub mod client;
pub mod handoff;
pub mod sidebar;
pub mod terminal;
pub mod ui;
