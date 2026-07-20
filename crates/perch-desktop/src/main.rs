//! Skeleton only — NOT built on this devpod (no webkit2gtk/display available).
//! Build/run on the Mac. See Phase 4 in plans.md.
//!
//! Intended shape: boot `perch_core`'s axum server bound to localhost on a
//! free port, then open a Tauri window pointed at `http://127.0.0.1:<port>/`.
//! The desktop shell is thin — all logic lives in perch-core; Tauri just
//! supplies the native window.

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running perch-desktop");
}
