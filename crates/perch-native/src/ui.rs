//! The window: a sidebar of projects and their sessions beside the main area, where the
//! terminal pane will go.

use crate::client::Snapshot;
use gpui::{div, prelude::*, px, rgb, Context, IntoElement, Window};

/// Sidebar text: a session title is bright, a project name and a hint dim. The render test
/// counts the bright pixels, so nothing else in the window may be this bright.
pub const TITLE_COLOR: u32 = 0xeeeeee;
const DIM_COLOR: u32 = 0x8a8a90;
const SIDEBAR_BG: u32 = 0x1c1c1f;
const MAIN_BG: u32 = 0x131315;
pub const SIDEBAR_WIDTH: f32 = 240.;

/// What the sidebar has to show.
pub enum Load {
    Loading,
    Failed(String),
    Ready(Snapshot),
}

pub struct Workspace {
    pub load: Load,
}

/// One project and the titles of its sessions.
pub struct Group {
    pub name: String,
    pub titles: Vec<String>,
}

/// Sessions under their project, in the core's order. A session whose project is not listed
/// goes under "Other".
pub fn groups(snapshot: &Snapshot) -> Vec<Group> {
    let mut groups: Vec<(Option<&str>, Group)> = snapshot
        .projects
        .iter()
        .map(|p| {
            (
                Some(p.id.as_str()),
                Group {
                    name: p.name.clone(),
                    titles: Vec::new(),
                },
            )
        })
        .collect();
    for session in &snapshot.sessions {
        let index = groups
            .iter()
            .position(|(id, _)| id.is_some() && *id == session.project_id.as_deref())
            .unwrap_or_else(|| {
                if !groups.iter().any(|(id, _)| id.is_none()) {
                    groups.push((
                        None,
                        Group {
                            name: "Other".into(),
                            titles: Vec::new(),
                        },
                    ));
                }
                groups.len() - 1
            });
        groups[index].1.titles.push(title(session));
    }
    groups.into_iter().map(|(_, group)| group).collect()
}

/// The session's title, else the folder its shell is in.
fn title(session: &perch_core::protocol::SessionSummary) -> String {
    let title = session.title.trim();
    if !title.is_empty() {
        return title.to_string();
    }
    let cwd = session.current_cwd.as_deref().unwrap_or(&session.cwd);
    std::path::Path::new(cwd)
        .file_name()
        .map_or_else(|| "Terminal".into(), |n| n.to_string_lossy().into_owned())
}

impl gpui::Render for Workspace {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        let mut sidebar = div()
            .flex()
            .flex_col()
            .flex_none()
            .w(px(SIDEBAR_WIDTH))
            .h_full()
            .p_3()
            .gap_3()
            .bg(rgb(SIDEBAR_BG));
        match &self.load {
            Load::Loading => sidebar = sidebar.child(hint("Connecting")),
            Load::Failed(error) => sidebar = sidebar.child(hint(error.clone())),
            Load::Ready(snapshot) => {
                let groups = groups(snapshot);
                if groups.is_empty() {
                    sidebar = sidebar.child(hint("No projects"));
                }
                for group in groups {
                    let mut column = div()
                        .flex()
                        .flex_col()
                        .gap_1()
                        .child(div().text_xs().text_color(rgb(DIM_COLOR)).child(group.name));
                    for title in group.titles {
                        column = column.child(
                            div()
                                .px_2()
                                .py_1()
                                .text_sm()
                                .text_color(rgb(TITLE_COLOR))
                                .child(title),
                        );
                    }
                    sidebar = sidebar.child(column);
                }
            }
        }
        div()
            .flex()
            .size_full()
            .bg(rgb(MAIN_BG))
            .child(sidebar)
            .child(
                // Placeholder for the terminal pane.
                div()
                    .flex()
                    .flex_1()
                    .items_center()
                    .justify_center()
                    .text_sm()
                    .text_color(rgb(DIM_COLOR))
                    .child("Terminal"),
            )
    }
}

fn hint(text: impl Into<gpui::SharedString>) -> gpui::Div {
    div()
        .text_sm()
        .text_color(rgb(DIM_COLOR))
        .child(text.into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use perch_core::protocol::{ProjectSummary, SessionSummary};

    fn session(title: &str, project_id: Option<&str>) -> SessionSummary {
        serde_json::from_value(serde_json::json!({
            "id": title, "title": title, "cwd": "/work/api", "createdAt": 0,
            "status": "idle", "projectId": project_id,
        }))
        .unwrap()
    }

    fn project(id: &str, name: &str) -> ProjectSummary {
        serde_json::from_value(serde_json::json!({
            "id": id, "hostId": "local", "name": name, "path": "/p", "favorite": false,
            "createdAt": 0, "updatedAt": 0,
        }))
        .unwrap()
    }

    #[test]
    fn sessions_group_under_their_project() {
        let snapshot = Snapshot {
            projects: vec![project("a", "Alpha"), project("b", "Beta")],
            sessions: vec![
                session("one", Some("b")),
                session("", Some("a")),
                session("lost", None),
            ],
        };
        let groups = groups(&snapshot);
        let shown: Vec<_> = groups
            .iter()
            .map(|g| (g.name.as_str(), &g.titles))
            .collect();
        assert_eq!(shown[0], ("Alpha", &vec!["api".to_string()]));
        assert_eq!(shown[1], ("Beta", &vec!["one".to_string()]));
        assert_eq!(shown[2], ("Other", &vec!["lost".to_string()]));
    }
}
