//! Imported before everything else: the `window` screen is the Mac app's, which marks its window `__TAURI_INTERNALS__`
//! (`StockWindow.tsx` reads it once, when it is first imported) so the sidebar toggle leaves room for the traffic lights.
if (new URLSearchParams(location.search).get("screen") === "window") (window as unknown as { __TAURI_INTERNALS__: object }).__TAURI_INTERNALS__ = {};
// Settings is the Mac app's too: its section list has Permissions (`macPermissionsAvailable`, which needs the Tauri bridge). The bridge
// never answers here, so the section stays as it is before the app has checked.
if (new URLSearchParams(location.search).get("screen") === "settings") (window as unknown as { __TAURI_INTERNALS__: object }).__TAURI_INTERNALS__ = { invoke: () => new Promise(() => {}) };
