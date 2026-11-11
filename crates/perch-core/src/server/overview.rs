//! `project.overview.get`: a Project's threads (the sub-sessions of its leads) grouped by state
//! (capability `project.overview.v1`). Read only. The grouping rules are `crate::overview`; each
//! thread carries the same row the family strip shows, so the two never disagree. Only a Project on
//! this computer is answered; a remote Project is an error, never a fallback.
use super::crew::{crew_row, member_of};
use super::sub_sessions::reconcile;
use super::*;
use crate::crew::{Role, Row};
use crate::overview::{group_of, Facts, GROUPS};
use crate::protocol::{OverviewGroup, OverviewThread};

pub(super) fn groups_for(app: &AppState, project_id: &str) -> Result<Vec<OverviewGroup>, String> {
    match app.db.get_project(project_id) {
        Ok(Some(project)) if project.host_id == "local" => {}
        Ok(Some(_)) => return Err("This Project is not on this computer.".into()),
        Ok(None) => return Err("This Project does not exist.".into()),
        Err(error) => return Err(error.to_string()),
    }
    let mut children = app
        .db
        .sub_sessions_in_project(project_id)
        .map_err(|error| error.to_string())?;
    // Newest activity first inside each group.
    children.sort_by_key(|child| std::cmp::Reverse(child.updated_at));
    let mut groups: Vec<OverviewGroup> = GROUPS
        .iter()
        .map(|(key, label)| OverviewGroup {
            key: (*key).into(),
            label: (*label).into(),
            threads: Vec::new(),
        })
        .collect();
    for child in &children {
        let state = reconcile(app, child);
        let member = member_of(
            app,
            &child.child_session_id,
            &child.provider_id,
            Some((child, state)),
            &child.parent_run_id,
        );
        let row = crew_row(
            app,
            Row {
                role: Role::Worker,
                member,
                latest: None,
            },
        );
        let key = group_of(&Facts {
            lifecycle: &row.lifecycle,
            dispatch: row.dispatch.as_deref(),
            needs_you: row.needs_you.is_some(),
            has_report: row.report.is_some(),
            pr: row.pr.as_ref().map(|pr| pr.state.as_str()),
        });
        if let Some(group) = groups.iter_mut().find(|group| group.key == key) {
            group.threads.push(OverviewThread {
                lead_session_id: child.parent_session_id.clone(),
                row,
            });
        }
    }
    groups.retain(|group| !group.threads.is_empty());
    Ok(groups)
}

pub(super) fn handle_get(state: &Arc<ConnState>, request_id: String, project_id: String) {
    let state = state.clone();
    tokio::task::spawn_blocking(move || {
        let (groups, error) = match groups_for(&state.app, &project_id) {
            Ok(groups) => (groups, None),
            Err(error) => (Vec::new(), Some(error)),
        };
        let _ = state.out_tx.send(ServerMessage::ProjectOverview {
            request_id,
            project_id,
            groups,
            error,
        });
    });
}
