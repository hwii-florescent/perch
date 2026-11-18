//! The review in the window: the drawer's Git tab and review tabs, each a keyed `review` screen (`stock:review`, the
//! web's source) on the window's Git store.
//!
//! A review tab's id is the web's file tab key of kind `review` (`fileTabKey`): `<workspace id>\n\0review`. Its
//! screen is `review#<tab id>`; the drawer's is `review#drawer`, on the workspace shown, else the one `workspace.git`
//! named (as the web's `WorkspaceTools`). The review asks for its status and diff itself once its host offers Git.

use super::*;

/// The tail of a review tab's id, after its workspace.
const REVIEW: &str = "\0review";

/// A review tab's workspace.
pub fn review_tab(id: &str) -> Option<&str> {
    id.split_once('\n')
        .filter(|(_, rest)| *rest == REVIEW)
        .map(|(workspace, _)| workspace)
}

/// The id of workspace `workspace_id`'s review tab.
pub fn review_tab_id(workspace_id: &str) -> String {
    format!("{workspace_id}\n{REVIEW}")
}

impl Workspace {
    /// Opens workspace `workspace_id`'s review as a tab (a regular one: the web's review tab is never a preview), or
    /// shows the one already open.
    pub fn open_review(&mut self, workspace_id: &str, cx: &mut Context<Self>) {
        let id = review_tab_id(workspace_id);
        self.tabs.open(&id);
        self.tabs.pin(&id);
        self.after_change(cx);
    }

    /// The review screens the window places: the drawer's while it shows Git, one in each review tab on screen.
    pub(super) fn review_wanted(
        &self,
        want: &mut impl FnMut(&'static str, String, Value),
        cx: &App,
    ) {
        if self.chrome.tools() == Some(shell::Tools::Git) {
            let shown = self.drawer_scope(cx);
            if let Some(workspace_id) = shown.or_else(|| self.explorer_workspace.clone()) {
                want(
                    "review",
                    "review#drawer".into(),
                    json!({ "workspaceId": workspace_id }),
                );
            }
        }
        for id in self.tabs.shown() {
            if let Some(workspace_id) = review_tab(&id) {
                want(
                    "review",
                    format!("review#{id}"),
                    json!({ "workspaceId": workspace_id }),
                );
            }
        }
    }

    /// The drawer's Git body: the review of the workspace shown, once its screen is placed.
    pub(super) fn drawer_review(&self) -> Option<AnyElement> {
        let view = self.screens.inflow("review#drawer")?;
        Some(
            div()
                .flex_1()
                .min_h_0()
                .flex()
                .flex_col()
                .child(view)
                .into_any_element(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_review_tab_is_told_from_file_and_browser_tabs() {
        let id = review_tab_id("w1");
        assert_eq!(review_tab(&id), Some("w1"));
        assert_eq!(file_tab(&id), None, "a review tab is no file");
        assert_eq!(review_tab("w1\nsrc/main.rs"), None);
        assert_eq!(review_tab("w1\n\0browser\nhttps://example.com"), None);
        assert_eq!(review_tab("session-1"), None);
    }
}
