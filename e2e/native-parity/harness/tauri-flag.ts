//! Imported before everything else: the `window` screen is the Mac app's, which marks its window `__TAURI_INTERNALS__`
//! (`StockWindow.tsx` reads it once, when it is first imported) so the sidebar toggle leaves room for the traffic lights.
if (new URLSearchParams(location.search).get("screen") === "window") (window as unknown as { __TAURI_INTERNALS__: object }).__TAURI_INTERNALS__ = {};
