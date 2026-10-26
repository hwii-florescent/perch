//! Native app menu, shared with the hidden keyboard probe. Deliberately excludes Close Window:
//! Close Tab owns its configured key across main and page WKWebViews. The red button still
//! closes the window, and Cmd+Q quits.

#[cfg(target_os = "macos")]
pub fn app_menu(app: &tauri::AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{Menu, PredefinedMenuItem as P, Submenu};
    let sep = || P::separator(app);
    Menu::with_items(
        app,
        &[
            &Submenu::with_items(
                app,
                "perch",
                true,
                &[
                    &P::about(app, None, None)?,
                    &sep()?,
                    &P::services(app, None)?,
                    &sep()?,
                    &P::hide(app, None)?,
                    &P::hide_others(app, None)?,
                    &P::show_all(app, None)?,
                    &sep()?,
                    &P::quit(app, None)?,
                ],
            )?,
            &Submenu::with_items(
                app,
                "Edit",
                true,
                &[
                    &P::undo(app, None)?,
                    &P::redo(app, None)?,
                    &sep()?,
                    &P::cut(app, None)?,
                    &P::copy(app, None)?,
                    &P::paste(app, None)?,
                    &P::select_all(app, None)?,
                ],
            )?,
            &crate::browser::file_menu(app)?,
            &Submenu::with_items(app, "View", true, &[&P::fullscreen(app, None)?])?,
            &Submenu::with_items(
                app,
                "Window",
                true,
                &[&P::minimize(app, None)?, &P::maximize(app, None)?],
            )?,
        ],
    )
}
