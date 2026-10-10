fn main() {
    // An app manifest makes `open_external` a permission (`allow-open-external`), which
    // capabilities/main.json grants to the loopback UI origin (remote origins need one).
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["open_external"])),
    )
    .expect("failed to run tauri-build")
}
