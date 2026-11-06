//! The agent's own to-do list, read from its plan tool calls: what the chat docks above the
//! composer and what a plan call's step says it changed.
//!
//! Ported from Orca's `shared/native-chat/input/native-chat-task-list.ts` and
//! `native-chat-task-list-history.ts` (normalization, the diff, the change sentences, the
//! per-tool predecessor rule) and `renderer/.../native-chat-task-list-state.ts` (the docked list
//! is the latest accepted one), with their tests (commit 308b5000, MIT; see
//! THIRD_PARTY_NOTICES.md).
//!
//! Claude's `TodoWrite` and Codex's `update_plan` are read as in Orca. Orca's projection of Codex
//! `turn/plan/updated` notifications into an `update_plan` call has no input here: Perch's Codex
//! bridge does not surface that notification, so a Codex plan reaches this module only if a
//! provider reports it as an `update_plan` tool call.
//!
//! Claude 2.1.319 no longer offers `TodoWrite` in its interactive CLI: it keeps its list with
//! `TaskCreate` and `TaskUpdate` calls instead, one task per call. Orca does not read those, so
//! that part is Perch's own, written from what the calls and results look like in a live
//! transcript (checked with claude-haiku-4-5): `TaskCreate` carries `subject` (and optionally
//! `activeForm`) and its result names the new task, "Task #N created successfully"; `TaskUpdate`
//! carries `taskId` and any of `status`, `subject`, `activeForm`, with `status` "deleted"
//! removing the task. A `TaskCreate` whose result is not in yet, or names no number, adds
//! nothing; a `TaskUpdate` for a task this transcript never saw changes nothing.
//!
//! A failed call, or one whose result is an error, is not a list. A call whose input was clipped
//! before the bridge handed it over does not parse and is ignored, never half-shown.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Pending,
    InProgress,
    Completed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub content: String,
    pub status: TaskStatus,
    /// Claude's present-tense phrasing; shown only while the task is in progress.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_form: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskList {
    pub tasks: Vec<Task>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub explanation: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChangeKind {
    Added,
    Removed,
    Started,
    Completed,
    Pending,
    Updated,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Change {
    pub kind: ChangeKind,
    pub task: Task,
}

/// The two plan tools, named exactly (lowercased and trimmed): an MCP lookalike is not one.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Tool {
    TodoWrite,
    UpdatePlan,
    /// One task added to Claude's task list (not a whole list: see the header).
    TaskCreate,
    /// One task of that list changed.
    TaskUpdate,
}

pub fn tool(name: &str) -> Option<Tool> {
    match name.trim().to_lowercase().as_str() {
        "todowrite" => Some(Tool::TodoWrite),
        "update_plan" => Some(Tool::UpdatePlan),
        "taskcreate" => Some(Tool::TaskCreate),
        "taskupdate" => Some(Tool::TaskUpdate),
        _ => None,
    }
}

fn nonempty(value: Option<&Value>) -> Option<String> {
    let text = value?.as_str()?.trim();
    (!text.is_empty()).then(|| text.to_string())
}

/// Orca `normalizeNativeChatTaskList`. `input` is the call's JSON text.
pub fn normalize(name: &str, input: &str) -> Option<TaskList> {
    let tool = tool(name)?;
    let value: Value = serde_json::from_str(input).ok()?;
    let entries = match tool {
        Tool::TodoWrite => value.get("todos"),
        Tool::UpdatePlan => value.get("plan"),
        Tool::TaskCreate | Tool::TaskUpdate => return None,
    }?
    .as_array()?;
    let mut tasks = Vec::new();
    for entry in entries {
        let Some(item) = entry.as_object() else {
            continue;
        };
        let Some(content) = nonempty(item.get(match tool {
            Tool::TodoWrite => "content",
            _ => "step",
        })) else {
            continue;
        };
        let status = match item.get("status").and_then(Value::as_str) {
            Some("in_progress") => TaskStatus::InProgress,
            Some("inProgress") if tool == Tool::UpdatePlan => TaskStatus::InProgress,
            Some("completed") => TaskStatus::Completed,
            _ => TaskStatus::Pending,
        };
        let active_form = match tool {
            Tool::TodoWrite => nonempty(item.get("activeForm")),
            _ => None,
        };
        tasks.push(Task {
            content,
            status,
            active_form,
        });
    }
    if !entries.is_empty() && tasks.is_empty() {
        return None;
    }
    let explanation = match tool {
        Tool::UpdatePlan => nonempty(value.get("explanation")),
        _ => None,
    };
    Some(TaskList { tasks, explanation })
}

/// Orca `nativeChatTaskLabel`.
pub fn label(task: &Task) -> &str {
    match (&task.status, &task.active_form) {
        (TaskStatus::InProgress, Some(active)) => active,
        _ => &task.content,
    }
}

pub fn completed_count(list: &TaskList) -> usize {
    list.tasks
        .iter()
        .filter(|task| task.status == TaskStatus::Completed)
        .count()
}

/// Orca `diffNativeChatTaskLists`: content plus occurrence is the only identity the providers
/// give these entries.
pub fn diff(previous: &TaskList, current: &TaskList) -> Vec<Change> {
    let mut by_content: HashMap<&str, Vec<usize>> = HashMap::new();
    for (index, task) in previous.tasks.iter().enumerate() {
        by_content.entry(&task.content).or_default().push(index);
    }
    let mut occurrences: HashMap<&str, usize> = HashMap::new();
    let mut consumed = vec![false; previous.tasks.len()];
    let mut changes = Vec::new();
    for task in &current.tasks {
        let occurrence = occurrences.entry(&task.content).or_default();
        let before = by_content
            .get(task.content.as_str())
            .and_then(|matches| matches.get(*occurrence))
            .copied();
        *occurrence += 1;
        let Some(before) = before else {
            changes.push(Change {
                kind: ChangeKind::Added,
                task: task.clone(),
            });
            continue;
        };
        consumed[before] = true;
        let before = &previous.tasks[before];
        if before.status != task.status {
            let kind = match task.status {
                TaskStatus::Completed => ChangeKind::Completed,
                TaskStatus::InProgress => ChangeKind::Started,
                TaskStatus::Pending => ChangeKind::Pending,
            };
            changes.push(Change {
                kind,
                task: task.clone(),
            });
        } else if before.active_form != task.active_form {
            changes.push(Change {
                kind: ChangeKind::Updated,
                task: task.clone(),
            });
        }
    }
    for (index, task) in previous.tasks.iter().enumerate() {
        if !consumed[index] {
            changes.push(Change {
                kind: ChangeKind::Removed,
                task: task.clone(),
            });
        }
    }
    changes
}

/// Orca `nativeChatTaskChangeWords` with its English copy (`NATIVE_CHAT_TASK_LIST_COPY`).
pub fn sentence(change: &Change) -> String {
    let content = &change.task.content;
    match change.kind {
        ChangeKind::Added => format!("Added {content}"),
        ChangeKind::Removed => format!("Removed {content}"),
        ChangeKind::Started => format!("Started {content}"),
        ChangeKind::Completed => format!("Completed {content}"),
        ChangeKind::Pending => format!("Marked pending: {content}"),
        ChangeKind::Updated => format!("Updated {}", label(&change.task)),
    }
}

/// Walks plan calls in transcript order. Each tool family has its own predecessor, so Claude's
/// and Codex's lists never diff against each other (Orca `nativeChatTaskListPredecessors`).
#[derive(Default)]
pub struct History {
    previous: HashMap<Tool, TaskList>,
    latest: Option<TaskList>,
    /// Claude's task list, built one `TaskCreate`/`TaskUpdate` at a time, by task number.
    numbered: Vec<(String, Task)>,
}

/// The task number in "Task #3 created successfully: ...".
fn created_number(result: &str) -> Option<String> {
    let digits: String = result
        .trim_start()
        .strip_prefix("Task #")?
        .chars()
        .take_while(char::is_ascii_digit)
        .collect();
    (!digits.is_empty()).then_some(digits)
}

/// `taskId` as the model wrote it: a string, or a bare number.
fn task_id(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::String(text) => Some(text.trim().trim_start_matches('#').to_string()),
        Value::Number(number) => Some(number.to_string()),
        _ => None,
    }
    .filter(|id| !id.is_empty())
}

impl History {
    /// Apply one `TaskCreate` or `TaskUpdate`; the list as it now stands, or `None` if the call
    /// changed nothing we can know.
    fn apply_task_call(
        &mut self,
        tool: Tool,
        input: &str,
        result: Option<&str>,
    ) -> Option<TaskList> {
        let value: Value = serde_json::from_str(input).ok()?;
        match tool {
            Tool::TaskCreate => {
                let content = nonempty(value.get("subject"))?;
                let id = created_number(result?)?;
                let task = Task {
                    content,
                    status: TaskStatus::Pending,
                    active_form: nonempty(value.get("activeForm")),
                };
                match self.numbered.iter_mut().find(|(known, _)| *known == id) {
                    Some((_, existing)) => *existing = task,
                    None => self.numbered.push((id, task)),
                }
            }
            Tool::TaskUpdate => {
                let id = task_id(value.get("taskId"))?;
                let at = self.numbered.iter().position(|(known, _)| *known == id)?;
                let status = value.get("status").and_then(Value::as_str);
                if status == Some("deleted") {
                    self.numbered.remove(at);
                } else {
                    let task = &mut self.numbered[at].1;
                    match status {
                        Some("in_progress") => task.status = TaskStatus::InProgress,
                        Some("completed") => task.status = TaskStatus::Completed,
                        Some("pending") => task.status = TaskStatus::Pending,
                        _ => {}
                    }
                    if let Some(subject) = nonempty(value.get("subject")) {
                        task.content = subject;
                    }
                    if let Some(active) = nonempty(value.get("activeForm")) {
                        task.active_form = Some(active);
                    }
                }
            }
            _ => return None,
        }
        Some(TaskList {
            tasks: self.numbered.iter().map(|(_, task)| task.clone()).collect(),
            explanation: None,
        })
    }

    /// Take one call that was not rejected, with its result text if it has one. `None` if it is
    /// not a plan call or says nothing we can read; otherwise what it changed, one sentence per
    /// change.
    pub fn accept(&mut self, name: &str, input: &str, result: Option<&str>) -> Option<String> {
        let tool = tool(name)?;
        let (tool, list) = match tool {
            Tool::TaskCreate | Tool::TaskUpdate => {
                (Tool::TaskCreate, self.apply_task_call(tool, input, result)?)
            }
            _ => (tool, normalize(name, input)?),
        };
        let changes = diff(
            self.previous.get(&tool).unwrap_or(&TaskList::default()),
            &list,
        );
        let text = if changes.is_empty() {
            "Tasks unchanged".to_string()
        } else {
            changes.iter().map(sentence).collect::<Vec<_>>().join("\n")
        };
        self.previous.insert(tool, list.clone());
        self.latest = Some(list);
        Some(text)
    }

    /// The docked list: the last accepted one, if it has tasks.
    pub fn docked(self) -> Option<TaskList> {
        self.latest.filter(|list| !list.tasks.is_empty())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn task(content: &str, status: TaskStatus) -> Task {
        Task {
            content: content.into(),
            status,
            active_form: None,
        }
    }
    fn pending(content: &str) -> Task {
        task(content, TaskStatus::Pending)
    }
    fn list(tasks: Vec<Task>) -> TaskList {
        TaskList {
            tasks,
            explanation: None,
        }
    }
    fn change(kind: ChangeKind, task: Task) -> Change {
        Change { kind, task }
    }

    // Orca `native-chat-task-list.test.ts`.
    #[test]
    fn claude_tasks_use_active_form_only_while_in_progress() {
        let input = json!({"todos": [
            {"content": "Read", "status": "completed", "activeForm": "Reading"},
            {"content": "Write", "status": "in_progress", "activeForm": "Writing"},
            {"content": "Test", "status": "pending", "activeForm": "Testing"},
        ]})
        .to_string();
        let result = normalize("TodoWrite", &input).unwrap();
        assert_eq!(
            result.tasks.iter().map(label).collect::<Vec<_>>(),
            ["Read", "Writing", "Test"]
        );
        assert_eq!(
            result
                .tasks
                .iter()
                .map(|task| task.status)
                .collect::<Vec<_>>(),
            [
                TaskStatus::Completed,
                TaskStatus::InProgress,
                TaskStatus::Pending
            ]
        );
    }

    #[test]
    fn codex_plan_reads_steps_and_explanation() {
        let input = json!({
            "explanation": "Proceed with verification",
            "plan": [{"step": "Test", "status": "in_progress"}, {"step": "Ship", "status": "inProgress"}]
        })
        .to_string();
        assert_eq!(
            normalize("update_plan", &input),
            Some(TaskList {
                tasks: vec![
                    task("Test", TaskStatus::InProgress),
                    task("Ship", TaskStatus::InProgress)
                ],
                explanation: Some("Proceed with verification".into()),
            })
        );
    }

    #[test]
    fn unknown_statuses_default_and_invalid_entries_are_ignored() {
        let input = json!({"todos": [
            null, [], 4, {}, {"content": " "}, {"content": 7},
            {"content": " One ", "status": "unknown", "activeForm": 4},
            {"content": "Two"},
        ]})
        .to_string();
        assert_eq!(
            normalize(" TodoWrite ", &input),
            Some(list(vec![pending("One"), pending("Two")]))
        );
    }

    #[test]
    fn malformed_input_is_not_a_list() {
        for input in [
            "",
            "null",
            "42",
            "[]",
            "{",
            "{}",
            r#"{"todos": null}"#,
            r#"{"todos": [{}]}"#,
        ] {
            assert_eq!(normalize("TodoWrite", input), None, "{input:?}");
        }
    }

    #[test]
    fn empty_lists_are_valid_and_only_the_exact_tool_families_count() {
        assert_eq!(
            normalize("update_plan", r#"{"plan": []}"#),
            Some(list(vec![]))
        );
        assert_eq!(
            normalize("TodoWrite", r#"{"todos": []}"#),
            Some(list(vec![]))
        );
        assert_eq!(
            normalize("mcp__server__TodoWrite", r#"{"todos": []}"#),
            None
        );
        assert_eq!(normalize("ExitPlanMode", r#"{"plan": []}"#), None);
        assert_eq!(normalize("update_plan", r#"{"todos": []}"#), None);
    }

    #[test]
    fn diffs_report_completions_and_starts_and_skip_the_unchanged() {
        let before = list(vec![
            task("Read", TaskStatus::InProgress),
            pending("Write"),
            pending("Test"),
        ]);
        let after = list(vec![
            task("Read", TaskStatus::Completed),
            task("Write", TaskStatus::InProgress),
            pending("Test"),
        ]);
        assert_eq!(
            diff(&before, &after),
            [
                change(ChangeKind::Completed, task("Read", TaskStatus::Completed)),
                change(ChangeKind::Started, task("Write", TaskStatus::InProgress)),
            ]
        );
    }

    #[test]
    fn reorders_and_explanations_are_not_changes() {
        let after = TaskList {
            tasks: vec![pending("B"), pending("A")],
            explanation: Some("Reordered".into()),
        };
        assert_eq!(diff(&list(vec![pending("A"), pending("B")]), &after), []);
    }

    #[test]
    fn duplicate_contents_match_by_occurrence() {
        assert_eq!(
            diff(
                &list(vec![pending("A"), task("A", TaskStatus::InProgress)]),
                &list(vec![
                    task("A", TaskStatus::Completed),
                    task("A", TaskStatus::InProgress)
                ]),
            ),
            [change(
                ChangeKind::Completed,
                task("A", TaskStatus::Completed)
            )]
        );
    }

    #[test]
    fn a_rename_is_an_addition_and_a_removal() {
        assert_eq!(
            diff(&list(vec![pending("Old")]), &list(vec![pending("New")])),
            [
                change(ChangeKind::Added, pending("New")),
                change(ChangeKind::Removed, pending("Old")),
            ]
        );
    }

    #[test]
    fn resets_reopening_and_active_form_edits_are_reported() {
        let changed = Task {
            active_form: Some("Checking C".into()),
            ..task("C", TaskStatus::InProgress)
        };
        assert_eq!(
            diff(
                &list(vec![
                    task("A", TaskStatus::Completed),
                    task("B", TaskStatus::Completed),
                    task("C", TaskStatus::InProgress),
                ]),
                &list(vec![
                    pending("A"),
                    task("B", TaskStatus::InProgress),
                    changed.clone()
                ]),
            ),
            [
                change(ChangeKind::Pending, pending("A")),
                change(ChangeKind::Started, task("B", TaskStatus::InProgress)),
                change(ChangeKind::Updated, changed.clone()),
            ]
        );
        assert_eq!(
            sentence(&change(ChangeKind::Updated, changed)),
            "Updated Checking C"
        );
    }

    #[test]
    fn clearing_a_list_and_removing_a_duplicate_are_removals() {
        assert_eq!(
            diff(&list(vec![pending("A")]), &list(vec![])),
            [change(ChangeKind::Removed, pending("A"))]
        );
        assert_eq!(
            diff(
                &list(vec![pending("A"), pending("A")]),
                &list(vec![pending("A")])
            ),
            [change(ChangeKind::Removed, pending("A"))]
        );
    }

    // Orca `native-chat-task-list-history.test.ts`, and `native-chat-task-list-state.test.ts`
    // for the docked list.
    fn todo(content: &str, status: &str) -> String {
        json!({"todos": [{"content": content, "status": status}]}).to_string()
    }

    /// `History::accept` for a call with no result yet.
    fn accept(history: &mut History, name: &str, input: &str) -> Option<String> {
        history.accept(name, input, None)
    }

    #[test]
    fn each_tool_family_diffs_against_its_own_predecessor() {
        let mut history = History::default();
        let plan = json!({"plan": [{"step": "Test", "status": "pending"}]}).to_string();
        assert_eq!(
            accept(&mut history, "TodoWrite", &todo("Test", "pending")).as_deref(),
            Some("Added Test")
        );
        assert_eq!(
            accept(&mut history, "update_plan", &plan).as_deref(),
            Some("Added Test")
        );
        assert_eq!(
            accept(&mut history, "mcp__x__TodoWrite", &todo("Test", "pending")),
            None
        );
        assert_eq!(
            accept(&mut history, "TodoWrite", &todo("Test", "completed")).as_deref(),
            Some("Completed Test")
        );
        assert_eq!(
            accept(&mut history, "TodoWrite", &todo("Test", "completed")).as_deref(),
            Some("Tasks unchanged")
        );
    }

    #[test]
    fn a_malformed_call_is_skipped_and_does_not_reset_the_predecessor() {
        let mut history = History::default();
        accept(&mut history, "TodoWrite", &todo("Test", "pending"));
        assert_eq!(accept(&mut history, "TodoWrite", "{"), None);
        assert_eq!(
            accept(&mut history, "TodoWrite", &todo("Test", "in_progress")).as_deref(),
            Some("Started Test")
        );
    }

    #[test]
    fn the_docked_list_is_the_latest_accepted_one_with_tasks() {
        let mut history = History::default();
        assert_eq!(History::default().docked(), None);
        accept(&mut history, "TodoWrite", &todo("One", "pending"));
        accept(&mut history, "TodoWrite", &todo("Two", "completed"));
        accept(&mut history, "TodoWrite", "not json");
        let docked = history.docked().unwrap();
        assert_eq!(docked.tasks, [task("Two", TaskStatus::Completed)]);
        assert_eq!(completed_count(&docked), 1);
        let mut cleared = History::default();
        accept(&mut cleared, "TodoWrite", &todo("One", "pending"));
        accept(&mut cleared, "TodoWrite", r#"{"todos": []}"#);
        assert_eq!(cleared.docked(), None);
    }

    // Perch's own: Claude's one-task-per-call list, shaped as a live claude-haiku-4-5 transcript
    // showed it (see the module header).
    fn create(history: &mut History, subject: &str, result: Option<&str>) -> Option<String> {
        let input =
            json!({"subject": subject, "description": format!("{subject} task")}).to_string();
        history.accept("TaskCreate", &input, result)
    }
    fn update(history: &mut History, fields: Value) -> Option<String> {
        history.accept("TaskUpdate", &fields.to_string(), Some("Updated task"))
    }

    #[test]
    fn claude_task_calls_build_a_list_by_task_number() {
        let mut history = History::default();
        assert_eq!(
            create(
                &mut history,
                "Read the notes",
                Some("Task #1 created successfully: Read the notes")
            )
            .as_deref(),
            Some("Added Read the notes")
        );
        assert_eq!(
            create(
                &mut history,
                "Write the summary",
                Some("Task #2 created successfully: Write the summary")
            )
            .as_deref(),
            Some("Added Write the summary")
        );
        assert_eq!(
            update(&mut history, json!({"taskId": "1", "status": "completed"})).as_deref(),
            Some("Completed Read the notes")
        );
        assert_eq!(
            update(
                &mut history,
                json!({"taskId": 2, "status": "in_progress", "activeForm": "Writing the summary"})
            )
            .as_deref(),
            Some("Started Write the summary")
        );
        let docked = history.docked().unwrap();
        assert_eq!(docked.tasks.len(), 2);
        assert_eq!(completed_count(&docked), 1);
        assert_eq!(label(&docked.tasks[1]), "Writing the summary");
    }

    #[test]
    fn a_claude_task_call_that_names_nothing_we_know_changes_nothing() {
        let mut history = History::default();
        // No result yet, or a result with no task number: the task cannot be told apart later.
        assert_eq!(create(&mut history, "Early", None), None);
        assert_eq!(create(&mut history, "Odd", Some("created")), None);
        // An update for a task this transcript never saw, or without a task id.
        assert_eq!(
            update(&mut history, json!({"taskId": "9", "status": "completed"})),
            None
        );
        assert_eq!(update(&mut history, json!({"status": "completed"})), None);
        assert_eq!(history.docked(), None);
    }

    #[test]
    fn claude_tasks_can_be_renamed_and_deleted() {
        let mut history = History::default();
        create(
            &mut history,
            "One",
            Some("Task #1 created successfully: One"),
        );
        create(
            &mut history,
            "Two",
            Some("Task #2 created successfully: Two"),
        );
        assert_eq!(
            update(&mut history, json!({"taskId": "#2", "subject": "Second"})).as_deref(),
            Some("Added Second\nRemoved Two")
        );
        assert_eq!(
            update(&mut history, json!({"taskId": "1", "status": "deleted"})).as_deref(),
            Some("Removed One")
        );
        assert_eq!(history.docked().unwrap().tasks, [pending("Second")]);
    }
}
