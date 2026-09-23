//! Background worktree creates (`worktree.job.*`, capability `worktree.job`),
//! after Orca's "Creation runs in the background" (`docs/model/worktrees.mdx`):
//! the create form closes at once, the project shows a progress row, and the
//! row offers Cancel while running and Retry / Dismiss after a failure.
//!
//! The job table lives in `AppState` so jobs outlive the connection that
//! started them; every change is broadcast as the full `worktree.jobs` list
//! (and sent to each new connection). One task owns each job's lifecycle:
//! cancel drops the in-flight git future (`kill_on_drop` kills git) and the
//! same task then runs `worktree::discard_create`, so nothing a cancelled or
//! failed job created is left behind. Registration of the finished checkout
//! is not cancellable: once `git worktree add` succeeded the job completes.
//!
//! Local host only. Remote projects keep the synchronous `worktree.create`.

use super::*;
use crate::protocol::WorktreeJob;
use crate::worktree::{self, CreatePlan, CreateRequest};

pub(super) struct JobEntry {
    job: WorktreeJob,
    /// The request as first prepared, with a derived branch pinned so a retry
    /// reuses (or recreates) the same name instead of moving on to `-2`.
    params: CreateRequest,
    cancel: Option<tokio::sync::oneshot::Sender<()>>,
}

pub(super) type JobTable = Arc<Mutex<HashMap<String, JobEntry>>>;

pub(super) fn jobs_message(app: &AppState) -> ServerMessage {
    let mut jobs: Vec<WorktreeJob> = app
        .worktree_jobs
        .lock()
        .unwrap()
        .values()
        .map(|entry| entry.job.clone())
        .collect();
    jobs.sort_by_key(|job| job.started_at);
    ServerMessage::WorktreeJobs { jobs }
}

fn publish(app: &AppState) {
    let _ = app.hub.hub_events_tx.send(Arc::new(jobs_message(app)));
}

/// Mutate one job (if it still exists) and broadcast the new list.
fn update(app: &AppState, job_id: &str, f: impl FnOnce(&mut JobEntry)) {
    if let Some(entry) = app.worktree_jobs.lock().unwrap().get_mut(job_id) {
        f(entry);
    }
    publish(app);
}

fn remove(app: &AppState, job_id: &str) {
    app.worktree_jobs.lock().unwrap().remove(job_id);
    publish(app);
}

pub(super) fn handle_start(state: &Arc<ConnState>, request_id: String, mut params: CreateRequest) {
    let app = state.app.clone();
    let out_tx = state.out_tx.clone();
    tokio::spawn(async move {
        // Validation errors (bad branch name, missing branch) answer the form
        // directly instead of becoming a failed row.
        let plan = match prepare(&params).await {
            Ok(plan) => plan,
            Err(message) => {
                let _ = out_tx.send(ServerMessage::WorktreeError {
                    request_id,
                    host_id: "local".to_string(),
                    message,
                    dirty: false,
                });
                return;
            }
        };
        params.branch = plan.branch.clone();
        params.path = Some(plan.target.clone());
        let job = WorktreeJob {
            job_id: Uuid::new_v4().to_string(),
            repo_path: params.repo_path.clone(),
            branch: plan.branch.clone(),
            path: plan.target.clone(),
            status: "running".to_string(),
            phase: if plan.fetch.is_some() {
                "Fetching"
            } else {
                "Checking out"
            }
            .to_string(),
            error: None,
            started_at: now_ms(),
        };
        {
            let mut jobs = app.worktree_jobs.lock().unwrap();
            if jobs.values().any(|entry| entry.job.path == plan.target) {
                drop(jobs);
                let _ = out_tx.send(ServerMessage::WorktreeError {
                    request_id,
                    host_id: "local".to_string(),
                    message: format!("a worktree is already being created at {}", plan.target),
                    dirty: false,
                });
                return;
            }
            jobs.insert(
                job.job_id.clone(),
                JobEntry {
                    job: job.clone(),
                    params,
                    cancel: None,
                },
            );
        }
        let _ = out_tx.send(ServerMessage::WorktreeJobStarted {
            request_id,
            job: job.clone(),
        });
        spawn_run(app, job.job_id, Some(plan));
    });
}

pub(super) fn handle_cancel(app: &AppState, job_id: &str) {
    update(app, job_id, |entry| {
        if let Some(cancel) = entry.cancel.take() {
            entry.job.status = "cancelling".to_string();
            entry.job.phase = "Cancelling".to_string();
            let _ = cancel.send(());
        }
    });
}

pub(super) fn handle_retry(app: &AppState, job_id: &str) {
    let retry = {
        let mut jobs = app.worktree_jobs.lock().unwrap();
        match jobs.get_mut(job_id) {
            Some(entry) if entry.job.status == "failed" => {
                entry.job.status = "running".to_string();
                entry.job.phase = "Preparing".to_string();
                entry.job.error = None;
                true
            }
            _ => false,
        }
    };
    if retry {
        publish(app);
        spawn_run(app.clone(), job_id.to_string(), None);
    }
}

pub(super) fn handle_dismiss(app: &AppState, job_id: &str) {
    let removed = {
        let mut jobs = app.worktree_jobs.lock().unwrap();
        let failed = jobs
            .get(job_id)
            .is_some_and(|entry| entry.job.status == "failed");
        failed && jobs.remove(job_id).is_some()
    };
    if removed {
        publish(app);
    }
}

async fn prepare(params: &CreateRequest) -> Result<CreatePlan, String> {
    worktree::prepare_create(params)
        .await
        .map_err(|error| error.message)
}

/// Run one attempt. `plan` is `None` on retry: the repo may have changed since
/// the failed attempt, so it is prepared again.
fn spawn_run(app: AppState, job_id: String, plan: Option<CreatePlan>) {
    let (cancel_tx, mut cancel_rx) = tokio::sync::oneshot::channel::<()>();
    let params = {
        let mut jobs = app.worktree_jobs.lock().unwrap();
        let Some(entry) = jobs.get_mut(&job_id) else {
            return;
        };
        entry.cancel = Some(cancel_tx);
        entry.params.clone()
    };
    tokio::spawn(async move {
        let fail = |message: String| {
            update(&app, &job_id, |entry| {
                entry.cancel = None;
                entry.job.status = "failed".to_string();
                entry.job.phase = "Failed".to_string();
                entry.job.error = Some(message);
            })
        };
        let plan = match plan {
            Some(plan) => plan,
            None => tokio::select! {
                prepared = prepare(&params) => match prepared {
                    Ok(plan) => plan,
                    Err(message) => return fail(message),
                },
                _ = &mut cancel_rx => return remove(&app, &job_id),
            },
        };
        if plan.fetch.is_some() {
            update(&app, &job_id, |entry| {
                entry.job.phase = "Fetching".to_string()
            });
        }
        let created = tokio::select! {
            created = async {
                worktree::fetch_start_ref(&plan).await;
                update(&app, &job_id, |entry| entry.job.phase = "Checking out".to_string());
                worktree::execute_create(&plan).await
            } => created,
            _ = &mut cancel_rx => {
                // Dropping the create future killed git; undo what it made.
                worktree::discard_create(&plan).await;
                return remove(&app, &job_id);
            }
        };
        if let Err(error) = created {
            update(&app, &job_id, |entry| {
                entry.job.phase = "Cleaning up".to_string()
            });
            worktree::discard_create(&plan).await;
            return fail(error.message);
        }
        update(&app, &job_id, |entry| {
            entry.cancel = None;
            entry.job.phase = "Registering".to_string();
        });
        match register_created_checkout(&app, &plan).await {
            Ok(()) => remove(&app, &job_id),
            // The checkout is kept: a retry reuses it (`CreatePlan::reuse`).
            Err(error) => fail(error.to_string()),
        }
    });
}

async fn register_created_checkout(app: &AppState, plan: &CreatePlan) -> anyhow::Result<()> {
    let listing = worktree::list(&plan.primary)
        .await
        .map_err(anyhow::Error::msg)?;
    workspace::register_worktree_listing(app, &listing)?;
    Ok(())
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or_default()
}
