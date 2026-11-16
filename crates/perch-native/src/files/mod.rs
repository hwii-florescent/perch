//! Files: media in the file pane (`media`, with Quick Look on macOS).

pub mod media;
#[cfg(target_os = "macos")]
pub mod quick_look;
