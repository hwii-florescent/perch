fn main() {
    // An app manifest makes each app command a permission (`allow-open-external`, …), which
    // capabilities/main.json grants to the loopback UI origin (remote origins need one).
    // Keep this list in step with `generate_handler!` in src/main.rs.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "open_external",
            "open_in_default_app",
            "reveal_in_finder",
            "permissions_status",
            "permissions_allow",
            "permissions_verify",
            "browser_show",
            "browser_hide",
            "browser_close",
            "browser_go",
            "browser_action",
            "browser_url",
            "browser_info",
            "browser_shortcuts",
        ]),
    ))
    .expect("failed to run tauri-build")
}
