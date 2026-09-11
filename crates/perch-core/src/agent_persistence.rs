//! Durable provider identity, lifecycle snapshots, and session-mode policy.
//!
//! The runtime registry is intentionally in memory: terminal handles, client
//! leases, and focus are process/connection scoped.  This module persists the
//! small part that must survive a Perch restart and keeps the SQLite owner at
//! the call site.  [`SqliteConnectionAdapter`] is implemented by the existing
//! `HistoryDb`; the module never opens a second database or owns a competing
//! source of truth.
//!
//! A backend should call [`AgentPersistence::ensure_schema`] once against its
//! normal `HistoryDb` connection, then save a [`PersistedAgentSnapshot`] after
//! lifecycle changes.  On restart, [`AgentPersistence::load_snapshots`]
//! delegates to `AgentLifecycleRegistry::restore`: transient Working/Blocked
//! rows become Reconnecting, provider session identities remain intact, and
//! all connection-scoped authority is cleared.

use crate::agent_fleet::{
    now_millis, AgentKey, AgentLifecycleRegistry, AgentMode, AgentSnapshot, AgentState,
    AgentTransition, MAX_AGENTS, MAX_IDENTIFIER_LENGTH, MAX_TOKEN_LENGTH, MAX_TRANSITION_HISTORY,
};
use anyhow::anyhow;
use rusqlite::{
    params, params_from_iter,
    types::{Value, ValueRef},
    Connection, OptionalExtension, Transaction, TransactionBehavior,
};
use std::collections::VecDeque;
use std::sync::Arc;

/// Schema owned by this module and created on the application's existing
/// SQLite connection.  The lifecycle row contains current compact state;
/// transition history is relational so one malformed JSON value cannot turn a
/// restart into an unbounded allocation.
pub const AGENT_PERSISTENCE_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS agent_lifecycle (
    workspace_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    provider_session_id TEXT,
    resumable INTEGER NOT NULL CHECK (resumable IN (0, 1)),
    state TEXT NOT NULL,
    reason TEXT NOT NULL,
    snapshot_revision INTEGER NOT NULL DEFAULT 1,
    last_transition_ms INTEGER NOT NULL,
    last_activity_ms INTEGER NOT NULL,
    transition_sequence INTEGER NOT NULL,
    unsettled INTEGER NOT NULL DEFAULT 0 CHECK (unsettled IN (0, 1)),
    active_typing_until_ms INTEGER,
    mode TEXT NOT NULL DEFAULT 'hosted' CHECK (mode IN ('hosted', 'cli')),
    mode_revision INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (workspace_id, session_id, agent_id)
);
CREATE INDEX IF NOT EXISTS agent_lifecycle_session
    ON agent_lifecycle(session_id, workspace_id, agent_id);

CREATE TABLE IF NOT EXISTS agent_lifecycle_transitions (
    workspace_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    reason TEXT NOT NULL,
    at_ms INTEGER NOT NULL,
    changed INTEGER NOT NULL CHECK (changed IN (0, 1)),
    PRIMARY KEY (workspace_id, session_id, agent_id, sequence)
);
CREATE INDEX IF NOT EXISTS agent_lifecycle_transitions_agent
    ON agent_lifecycle_transitions(workspace_id, session_id, agent_id, sequence DESC);

CREATE TABLE IF NOT EXISTS device_mode_defaults (
    device_id TEXT PRIMARY KEY,
    mode TEXT NOT NULL CHECK (mode IN ('hosted', 'cli')),
    revision INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_mode_overrides (
    scope TEXT NOT NULL CHECK (scope IN ('session', 'workspace')),
    scope_id TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('hosted', 'cli')),
    revision INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (scope, scope_id)
);

-- One monotonic policy epoch orders effective mode results across scopes.
-- Per-row revisions remain useful for snapshot CAS, while this epoch prevents
-- clearing a high-precedence override from making the visible revision move
-- backwards to an unrelated lower-precedence row.
CREATE TABLE IF NOT EXISTS agent_mode_epoch (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    revision INTEGER NOT NULL CHECK (revision > 0)
);
INSERT OR IGNORE INTO agent_mode_epoch (id, revision) VALUES (1, 1);
"#;

/// The persistence layer borrows the process-wide SQLite connection from its
/// owning database.  `HistoryDb` can implement this by locking its existing
/// `Mutex<rusqlite::Connection>`; no database path or connection is accepted
/// here, which prevents a second runtime database from becoming authoritative.
pub trait SqliteConnectionAdapter {
    fn with_connection<R, F>(&self, operation: F) -> anyhow::Result<R>
    where
        F: FnOnce(&mut Connection) -> anyhow::Result<R>;
}

impl<T> SqliteConnectionAdapter for Arc<T>
where
    T: SqliteConnectionAdapter + ?Sized,
{
    fn with_connection<R, F>(&self, operation: F) -> anyhow::Result<R>
    where
        F: FnOnce(&mut Connection) -> anyhow::Result<R>,
    {
        (**self).with_connection(operation)
    }
}

/// The durable mode selected for one agent/session row.  Runtime authority is
/// intentionally absent from this value; it is reconstructed on attach.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PersistedAgentSnapshot {
    pub snapshot: AgentSnapshot,
    pub mode: AgentMode,
    /// Revision of the mode value in this snapshot.  Lifecycle and mode can
    /// advance independently, so persistence compares both revisions rather
    /// than treating `transition_sequence` or wall-clock time as ordering.
    pub mode_revision: u64,
}

impl PersistedAgentSnapshot {
    /// Construct a snapshot for the common case where the mode was read at
    /// the same lifecycle revision as the snapshot.
    pub fn new(snapshot: AgentSnapshot, mode: AgentMode) -> Self {
        let mode_revision = snapshot.revision.max(1);
        Self {
            snapshot,
            mode,
            mode_revision,
        }
    }

    pub fn with_mode_revision(mut self, mode_revision: u64) -> Self {
        self.mode_revision = mode_revision;
        self
    }
}

/// Scope for a mode override.  Session wins over workspace, and either wins
/// over the device default.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModeScope {
    Session,
    Workspace,
}

impl ModeScope {
    fn as_sql(self) -> &'static str {
        match self {
            Self::Session => "session",
            Self::Workspace => "workspace",
        }
    }
}

/// Source of an effective mode value. Unlike [`ModeScope`], this includes
/// the lower-precedence sources that may win after an override is cleared.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EffectiveModeScope {
    Session,
    Workspace,
    Device,
    Default,
}

/// A mode value together with the per-key revision used to order writes.  The
/// timestamp is informational; revision, rather than wall-clock time, is the
/// conflict authority.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModePreference {
    pub mode: AgentMode,
    pub revision: u64,
    pub updated_at_ms: u64,
}

/// SQLite-backed persistence facade.  `C` is normally `Arc<HistoryDb>` after
/// the backend adds its small `SqliteConnectionAdapter` implementation.
pub struct AgentPersistence<C> {
    connection: C,
}

impl<C> AgentPersistence<C> {
    pub fn new(connection: C) -> Self {
        Self { connection }
    }

    pub fn connection(&self) -> &C {
        &self.connection
    }
}

impl<C: SqliteConnectionAdapter> AgentPersistence<C> {
    /// Create the additive tables on the same connection used by sessions,
    /// messages, detached runs, and workspaces.
    pub fn ensure_schema(&self) -> anyhow::Result<()> {
        self.connection.with_connection(|connection| {
            connection.execute_batch(AGENT_PERSISTENCE_SCHEMA)?;
            // The table definitions above are used for fresh installs. Keep
            // startup additive for a development database created by an
            // earlier revision of this module.
            ensure_column(
                connection,
                "agent_lifecycle",
                "snapshot_revision",
                "INTEGER NOT NULL DEFAULT 1",
            )?;
            ensure_column(
                connection,
                "agent_lifecycle",
                "mode_revision",
                "INTEGER NOT NULL DEFAULT 1",
            )?;
            ensure_column(
                connection,
                "device_mode_defaults",
                "revision",
                "INTEGER NOT NULL DEFAULT 1",
            )?;
            ensure_column(
                connection,
                "agent_mode_overrides",
                "revision",
                "INTEGER NOT NULL DEFAULT 1",
            )?;
            Ok(())
        })
    }

    /// Persist one lifecycle snapshot and its bounded transition history in a
    /// single SQLite transaction.  Client observers, focus, mobile flags,
    /// and control leases are deliberately excluded because they cannot be
    /// trusted after a connection or process restart.
    pub fn save_snapshot(&self, persisted: &PersistedAgentSnapshot) -> anyhow::Result<()> {
        self.save_snapshots(std::slice::from_ref(persisted))
    }

    /// Persist a bounded batch atomically.  A batch larger than the registry
    /// capacity is rejected before any SQL is executed.
    pub fn save_snapshots(&self, persisted: &[PersistedAgentSnapshot]) -> anyhow::Result<()> {
        if persisted.len() > MAX_AGENTS {
            return Err(anyhow!(
                "agent persistence batch exceeds {MAX_AGENTS} records"
            ));
        }
        for record in persisted {
            validate_persisted_snapshot(record)?;
        }
        self.connection.with_connection(|connection| {
            let transaction =
                connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
            for record in persisted {
                write_snapshot(&transaction, record)?;
            }
            transaction.commit()?;
            Ok(())
        })
    }

    /// Delete an agent and its transition rows atomically.
    pub fn delete_snapshot(&self, key: &AgentKey) -> anyhow::Result<()> {
        validate_key(key)?;
        self.connection.with_connection(|connection| {
            let transaction =
                connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
            delete_snapshot_rows(&transaction, key)?;
            transaction.commit()?;
            Ok(())
        })
    }

    /// Load all durable agent rows with bounded SQL limits, then apply the
    /// registry's restart recovery transformation.  A process that died while
    /// Working/Blocked comes back Reconnecting; provider identity and mode are
    /// retained so the backend can issue an explicit same-session resume.
    pub fn load_snapshots(&self, now_ms: u64) -> anyhow::Result<Vec<PersistedAgentSnapshot>> {
        self.connection.with_connection(|connection| {
            let mut records = load_agent_rows(connection)?;
            for record in &mut records {
                record.snapshot.recent_transitions =
                    load_transition_history(connection, &record.snapshot.key)?;
            }

            let modes = records
                .iter()
                .map(|record| {
                    (
                        record.snapshot.key.clone(),
                        (record.mode, record.mode_revision),
                    )
                })
                .collect::<std::collections::HashMap<_, _>>();
            let snapshots = records.into_iter().map(|record| record.snapshot);
            let restored = AgentLifecycleRegistry::restore(snapshots, now_ms)
                .map_err(|error| anyhow!("invalid persisted agent snapshot: {error}"))?;
            restored
                .list()
                .into_iter()
                .map(|snapshot| {
                    let (mode, mode_revision) =
                        modes.get(&snapshot.key).copied().ok_or_else(|| {
                            anyhow!("restored agent has no persisted mode: {:?}", snapshot.key)
                        })?;
                    Ok(PersistedAgentSnapshot {
                        snapshot,
                        mode,
                        mode_revision,
                    })
                })
                .collect()
        })
    }

    /// Set or replace the device-wide default.  An unset device is treated as
    /// Hosted by [`Self::resolve_mode`], matching the existing settings
    /// default while allowing the choice to become durable in SQLite.
    pub fn set_device_default(
        &self,
        device_id: &str,
        mode: AgentMode,
        at_ms: u64,
    ) -> anyhow::Result<u64> {
        validate_identifier(device_id, "device")?;
        let at_ms = sqlite_u64(at_ms, "timestamp")?;
        self.connection.with_connection(|connection| {
            let transaction =
                connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let policy_revision = next_mode_epoch(&transaction)?;
            let revision = next_mode_revision(
                transaction
                    .query_row(
                        "SELECT revision FROM device_mode_defaults WHERE device_id = ?1",
                        params![device_id],
                        |row| row.get::<_, i64>(0),
                    )
                    .optional()?,
                "device mode revision",
            )?;
            transaction.execute(
                "INSERT INTO device_mode_defaults (device_id, mode, revision, updated_at)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(device_id) DO UPDATE SET mode = excluded.mode,
                    revision = excluded.revision, updated_at = excluded.updated_at",
                params![device_id, mode_to_sql(mode), revision, at_ms],
            )?;
            transaction.commit()?;
            sql_u64(policy_revision, "mode policy revision")
        })
    }

    /// Clear a device default so the effective policy falls back to the
    /// session/workspace override or Hosted. This is separate from setting
    /// Hosted because callers need the returned scope to remain `default`.
    pub fn clear_device_default(&self, device_id: &str) -> anyhow::Result<u64> {
        validate_identifier(device_id, "device")?;
        self.connection.with_connection(|connection| {
            let transaction =
                connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let policy_revision = next_mode_epoch(&transaction)?;
            transaction.execute(
                "DELETE FROM device_mode_defaults WHERE device_id = ?1",
                params![device_id],
            )?;
            transaction.commit()?;
            sql_u64(policy_revision, "mode policy revision")
        })
    }

    /// Return the authoritative effective-policy epoch. It advances on every
    /// device/session/workspace mode mutation, including a clear.
    pub fn mode_policy_revision(&self) -> anyhow::Result<u64> {
        self.connection.with_connection(|connection| {
            let revision = connection
                .query_row(
                    "SELECT revision FROM agent_mode_epoch WHERE id = 1",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .optional()?;
            Ok(revision
                .map(|value| sql_u64(value, "mode policy revision"))
                .transpose()?
                .unwrap_or(1))
        })
    }

    pub fn device_default_preference(
        &self,
        device_id: &str,
    ) -> anyhow::Result<Option<ModePreference>> {
        validate_identifier(device_id, "device")?;
        self.connection.with_connection(|connection| {
            read_mode_preference(
                connection,
                "SELECT mode, revision, updated_at
                 FROM device_mode_defaults WHERE device_id = ?1",
                params![device_id],
            )
        })
    }

    /// Set or clear a session override.  `None` deletes the row and reveals a
    /// workspace override or device default.
    pub fn set_session_override(
        &self,
        session_id: &str,
        mode: Option<AgentMode>,
        at_ms: u64,
    ) -> anyhow::Result<u64> {
        self.set_mode_override(ModeScope::Session, session_id, mode, at_ms)
    }

    /// Set or clear a workspace override.  It applies to sessions without a
    /// more specific session override on the same device.
    pub fn set_workspace_override(
        &self,
        workspace_id: &str,
        mode: Option<AgentMode>,
        at_ms: u64,
    ) -> anyhow::Result<u64> {
        self.set_mode_override(ModeScope::Workspace, workspace_id, mode, at_ms)
    }

    pub fn mode_override_preference(
        &self,
        scope: ModeScope,
        scope_id: &str,
    ) -> anyhow::Result<Option<ModePreference>> {
        validate_identifier(scope_id, "mode scope")?;
        self.connection.with_connection(|connection| {
            read_mode_preference(
                connection,
                "SELECT mode, revision, updated_at FROM agent_mode_overrides
                 WHERE scope = ?1 AND scope_id = ?2",
                params![scope.as_sql(), scope_id],
            )
        })
    }

    /// Resolve the mode with the explicit precedence required by MODE-002:
    /// session, workspace, device, then the Hosted default.
    pub fn resolve_mode(
        &self,
        device_id: &str,
        session_id: &str,
        workspace_id: Option<&str>,
    ) -> anyhow::Result<AgentMode> {
        self.resolve_mode_with_revision(device_id, session_id, workspace_id)
            .map(|(mode, _, _)| mode)
    }

    /// Resolve the effective mode and policy revision using one read
    /// transaction. Independent reads can observe a mode row from before a
    /// concurrent mutation and an epoch from after it; returning both values
    /// from this snapshot prevents a stale mode from being labelled current.
    pub fn resolve_mode_with_revision(
        &self,
        device_id: &str,
        session_id: &str,
        workspace_id: Option<&str>,
    ) -> anyhow::Result<(AgentMode, EffectiveModeScope, u64)> {
        validate_identifier(device_id, "device")?;
        validate_identifier(session_id, "session")?;
        if let Some(workspace_id) = workspace_id {
            validate_identifier(workspace_id, "workspace")?;
        }
        self.connection.with_connection(|connection| {
            let transaction =
                connection.transaction_with_behavior(TransactionBehavior::Deferred)?;
            let policy_revision = transaction
                .query_row(
                    "SELECT revision FROM agent_mode_epoch WHERE id = 1",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .optional()?
                .map(|value| sql_u64(value, "mode policy revision"))
                .transpose()?
                .unwrap_or(1);
            let resolved = if let Some(mode) = read_mode(
                &transaction,
                "SELECT mode FROM agent_mode_overrides
                 WHERE scope = 'session' AND scope_id = ?1",
                params![session_id],
            )? {
                (mode, EffectiveModeScope::Session)
            } else if let Some(workspace_id) = workspace_id {
                if let Some(mode) = read_mode(
                    &transaction,
                    "SELECT mode FROM agent_mode_overrides
                     WHERE scope = 'workspace' AND scope_id = ?1",
                    params![workspace_id],
                )? {
                    (mode, EffectiveModeScope::Workspace)
                } else if let Some(mode) = read_mode(
                    &transaction,
                    "SELECT mode FROM device_mode_defaults WHERE device_id = ?1",
                    params![device_id],
                )? {
                    (mode, EffectiveModeScope::Device)
                } else {
                    (AgentMode::Hosted, EffectiveModeScope::Default)
                }
            } else if let Some(mode) = read_mode(
                &transaction,
                "SELECT mode FROM device_mode_defaults WHERE device_id = ?1",
                params![device_id],
            )? {
                (mode, EffectiveModeScope::Device)
            } else {
                (AgentMode::Hosted, EffectiveModeScope::Default)
            };
            transaction.commit()?;
            Ok((resolved.0, resolved.1, policy_revision))
        })
    }

    fn set_mode_override(
        &self,
        scope: ModeScope,
        scope_id: &str,
        mode: Option<AgentMode>,
        at_ms: u64,
    ) -> anyhow::Result<u64> {
        validate_identifier(scope_id, "mode scope")?;
        let at_ms = sqlite_u64(at_ms, "timestamp")?;
        self.connection.with_connection(|connection| {
            let transaction =
                connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
            let policy_revision = next_mode_epoch(&transaction)?;
            if let Some(mode) = mode {
                let revision = next_mode_revision(
                    transaction
                        .query_row(
                            "SELECT revision FROM agent_mode_overrides
                             WHERE scope = ?1 AND scope_id = ?2",
                            params![scope.as_sql(), scope_id],
                            |row| row.get::<_, i64>(0),
                        )
                        .optional()?,
                    "mode override revision",
                )?;
                transaction.execute(
                    "INSERT INTO agent_mode_overrides
                        (scope, scope_id, mode, revision, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5)
                     ON CONFLICT(scope, scope_id) DO UPDATE SET mode = excluded.mode,
                        revision = excluded.revision, updated_at = excluded.updated_at",
                    params![scope.as_sql(), scope_id, mode_to_sql(mode), revision, at_ms],
                )?;
            } else {
                transaction.execute(
                    "DELETE FROM agent_mode_overrides
                     WHERE scope = ?1 AND scope_id = ?2",
                    params![scope.as_sql(), scope_id],
                )?;
            }
            transaction.commit()?;
            sql_u64(policy_revision, "mode policy revision")
        })
    }
}

fn ensure_column(
    connection: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> anyhow::Result<()> {
    let mut statement = connection.prepare(&format!("PRAGMA table_info({table})"))?;
    let mut rows = statement.query([])?;
    let mut present = false;
    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?;
        if name == column {
            present = true;
            break;
        }
    }
    drop(rows);
    drop(statement);
    if !present {
        connection.execute(
            &format!("ALTER TABLE {table} ADD COLUMN {column} {definition}"),
            [],
        )?;
    }
    Ok(())
}

fn write_snapshot(
    transaction: &Transaction<'_>,
    persisted: &PersistedAgentSnapshot,
) -> anyhow::Result<()> {
    let snapshot = &persisted.snapshot;
    let snapshot_revision = snapshot.revision;
    let snapshot_revision_sql = sqlite_u64(snapshot_revision, "snapshot revision")?;
    let mode_revision = persisted.mode_revision;
    let mode_revision_sql = sqlite_u64(mode_revision, "mode revision")?;
    let current = transaction
        .query_row(
            "SELECT snapshot_revision, mode_revision
             FROM agent_lifecycle
             WHERE workspace_id = ?1 AND session_id = ?2 AND agent_id = ?3",
            params![
                snapshot.key.workspace_id,
                snapshot.key.session_id,
                snapshot.key.agent_id
            ],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
        )
        .optional()?;
    let snapshot_is_newer = match current {
        None => true,
        Some((stored_snapshot_revision, _)) => {
            snapshot_revision > sql_u64(stored_snapshot_revision, "snapshot revision")?
        }
    };
    let mode_is_newer = match current {
        None => true,
        Some((_, stored_mode_revision)) => {
            mode_revision > sql_u64(stored_mode_revision, "mode revision")?
        }
    };

    if current.is_none() {
        transaction.execute(
            "INSERT INTO agent_lifecycle (
                workspace_id, session_id, agent_id, provider_id, provider_session_id,
                resumable, state, reason, snapshot_revision, last_transition_ms,
                last_activity_ms, transition_sequence, unsettled,
                active_typing_until_ms, mode, mode_revision, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                       ?13, ?14, ?15, ?16, ?17)",
            params_from_iter(snapshot_params(
                snapshot,
                persisted,
                snapshot_revision_sql,
                mode_revision_sql,
            )?),
        )?;
    } else if snapshot_is_newer {
        transaction.execute(
            "UPDATE agent_lifecycle SET
                provider_id = ?4,
                provider_session_id = ?5,
                resumable = ?6,
                state = ?7,
                reason = ?8,
                snapshot_revision = ?9,
                last_transition_ms = ?10,
                last_activity_ms = ?11,
                transition_sequence = ?12,
                unsettled = ?13,
                active_typing_until_ms = ?14,
                updated_at = ?17
             WHERE workspace_id = ?1 AND session_id = ?2 AND agent_id = ?3",
            params_from_iter(snapshot_params(
                snapshot,
                persisted,
                snapshot_revision_sql,
                mode_revision_sql,
            )?),
        )?;
    }
    if current.is_some() && mode_is_newer {
        transaction.execute(
            "UPDATE agent_lifecycle SET mode = ?15, mode_revision = ?16,
                updated_at = ?17
             WHERE workspace_id = ?1 AND session_id = ?2 AND agent_id = ?3",
            params_from_iter(snapshot_params(
                snapshot,
                persisted,
                snapshot_revision_sql,
                mode_revision_sql,
            )?),
        )?;
    }
    // Transition rows belong to the lifecycle revision.  A stale snapshot can
    // update neither the current row nor history, even when it arrives after
    // a newer asynchronous callback.
    if snapshot_is_newer {
        transaction.execute(
            "DELETE FROM agent_lifecycle_transitions
             WHERE workspace_id = ?1 AND session_id = ?2 AND agent_id = ?3",
            params![
                snapshot.key.workspace_id,
                snapshot.key.session_id,
                snapshot.key.agent_id
            ],
        )?;
        for transition in &snapshot.recent_transitions {
            transaction.execute(
                "INSERT INTO agent_lifecycle_transitions (
                    workspace_id, session_id, agent_id, sequence, from_state,
                    to_state, reason, at_ms, changed
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    snapshot.key.workspace_id,
                    snapshot.key.session_id,
                    snapshot.key.agent_id,
                    sqlite_u64(transition.sequence, "transition sequence")?,
                    state_to_sql(transition.from),
                    state_to_sql(transition.to),
                    transition.reason,
                    sqlite_u64(transition.at_ms, "transition timestamp")?,
                    bool_to_sql(transition.changed),
                ],
            )?;
        }
    }
    Ok(())
}

fn snapshot_params(
    snapshot: &AgentSnapshot,
    persisted: &PersistedAgentSnapshot,
    snapshot_revision: i64,
    mode_revision: i64,
) -> anyhow::Result<Vec<Value>> {
    let updated_at = sqlite_u64(now_millis(), "updated_at")?;
    let provider_session_id = snapshot
        .provider_session_id
        .as_ref()
        .map(|value| Value::Text(value.clone()))
        .unwrap_or(Value::Null);
    let active_typing_until_ms = snapshot
        .active_typing_until_ms
        .map(|value| sqlite_u64(value, "active_typing_until_ms"))
        .transpose()?
        .map(Value::Integer)
        .unwrap_or(Value::Null);
    Ok(vec![
        Value::Text(snapshot.key.workspace_id.clone()),
        Value::Text(snapshot.key.session_id.clone()),
        Value::Text(snapshot.key.agent_id.clone()),
        Value::Text(snapshot.provider_id.clone()),
        provider_session_id,
        Value::Integer(bool_to_sql(snapshot.resumable)),
        Value::Text(state_to_sql(snapshot.state).to_string()),
        Value::Text(snapshot.reason.clone()),
        Value::Integer(snapshot_revision),
        Value::Integer(sqlite_u64(
            snapshot.last_transition_ms,
            "last_transition_ms",
        )?),
        Value::Integer(sqlite_u64(snapshot.last_activity_ms, "last_activity_ms")?),
        Value::Integer(sqlite_u64(
            snapshot.transition_sequence,
            "transition_sequence",
        )?),
        Value::Integer(bool_to_sql(snapshot.unsettled)),
        active_typing_until_ms,
        Value::Text(mode_to_sql(persisted.mode).to_string()),
        Value::Integer(mode_revision),
        Value::Integer(updated_at),
    ])
}

fn delete_snapshot_rows(transaction: &Transaction<'_>, key: &AgentKey) -> anyhow::Result<()> {
    transaction.execute(
        "DELETE FROM agent_lifecycle_transitions
         WHERE workspace_id = ?1 AND session_id = ?2 AND agent_id = ?3",
        params![key.workspace_id, key.session_id, key.agent_id],
    )?;
    transaction.execute(
        "DELETE FROM agent_lifecycle
         WHERE workspace_id = ?1 AND session_id = ?2 AND agent_id = ?3",
        params![key.workspace_id, key.session_id, key.agent_id],
    )?;
    Ok(())
}

fn load_agent_rows(connection: &Connection) -> anyhow::Result<Vec<PersistedAgentSnapshot>> {
    let limit = i64::try_from(MAX_AGENTS)
        .ok()
        .and_then(|value| value.checked_add(1))
        .ok_or_else(|| anyhow!("agent capacity does not fit SQLite"))?;
    let mut records = Vec::new();
    {
        let mut statement = connection.prepare(
            "SELECT workspace_id, session_id, agent_id, provider_id,
                    provider_session_id, resumable, state, reason,
                    snapshot_revision, last_transition_ms, last_activity_ms,
                    transition_sequence, unsettled, active_typing_until_ms,
                    mode, mode_revision
             FROM agent_lifecycle
             ORDER BY workspace_id ASC, session_id ASC, agent_id ASC
             LIMIT ?1",
        )?;
        let mut rows = statement.query(params![limit])?;
        while let Some(row) = rows.next()? {
            if records.len() >= MAX_AGENTS {
                return Err(anyhow!(
                    "agent persistence contains more than {MAX_AGENTS} records"
                ));
            }
            let workspace_id = bounded_text(row, 0, MAX_IDENTIFIER_LENGTH, "workspace_id")?;
            let session_id = bounded_text(row, 1, MAX_IDENTIFIER_LENGTH, "session_id")?;
            let agent_id = bounded_text(row, 2, MAX_IDENTIFIER_LENGTH, "agent_id")?;
            let key = AgentKey::new(&workspace_id, &session_id, &agent_id)
                .map_err(|error| anyhow!("invalid persisted agent key: {error}"))?;
            let provider_id = bounded_text(row, 3, MAX_IDENTIFIER_LENGTH, "provider_id")?;
            let provider_session_id =
                bounded_optional_text(row, 4, MAX_TOKEN_LENGTH, "provider_session_id")?;
            let resumable = sql_bool(row.get(5)?, "resumable")?;
            let state = state_from_sql(&bounded_text(row, 6, 32, "state")?)?;
            let reason = bounded_text(row, 7, MAX_TOKEN_LENGTH, "reason")?;
            let snapshot_revision = sql_u64(row.get(8)?, "snapshot revision")?;
            if snapshot_revision == 0 {
                return Err(anyhow!("persisted snapshot revision is zero"));
            }
            let last_transition_ms = sql_u64(row.get(9)?, "last_transition_ms")?;
            let last_activity_ms = sql_u64(row.get(10)?, "last_activity_ms")?;
            let transition_sequence = sql_u64(row.get(11)?, "transition_sequence")?;
            let unsettled = sql_bool(row.get(12)?, "unsettled")?;
            let active_typing_until_ms = row
                .get::<_, Option<i64>>(13)?
                .map(|value| sql_u64(value, "active_typing_until_ms"))
                .transpose()?;
            let mode = mode_from_sql(&bounded_text(row, 14, 32, "mode")?)?;
            let mode_revision = sql_u64(row.get(15)?, "mode revision")?;
            if mode_revision == 0 {
                return Err(anyhow!("persisted mode revision is zero"));
            }
            records.push(PersistedAgentSnapshot {
                snapshot: AgentSnapshot {
                    key,
                    provider_id,
                    provider_session_id,
                    resumable,
                    revision: snapshot_revision,
                    state,
                    reason,
                    last_transition_ms,
                    last_activity_ms,
                    transition_sequence,
                    input_owner: None,
                    resize_owner: None,
                    observers: Default::default(),
                    focused_clients: Default::default(),
                    focused_by: None,
                    foreground_clients: Default::default(),
                    foreground: false,
                    mobile_driven_clients: Default::default(),
                    mobile_driven: false,
                    unsettled,
                    active_typing_until_ms,
                    recent_transitions: VecDeque::new(),
                },
                mode,
                mode_revision,
            });
        }
    }
    Ok(records)
}

fn load_transition_history(
    connection: &Connection,
    key: &AgentKey,
) -> anyhow::Result<VecDeque<AgentTransition>> {
    let mut transitions = Vec::new();
    {
        let mut statement = connection.prepare(
            "SELECT sequence, from_state, to_state, reason, at_ms, changed
             FROM agent_lifecycle_transitions
             WHERE workspace_id = ?1 AND session_id = ?2 AND agent_id = ?3
             ORDER BY sequence DESC LIMIT ?4",
        )?;
        let mut rows = statement.query(params![
            key.workspace_id,
            key.session_id,
            key.agent_id,
            i64::try_from(MAX_TRANSITION_HISTORY).unwrap_or(i64::MAX),
        ])?;
        while let Some(row) = rows.next()? {
            transitions.push(AgentTransition {
                sequence: sql_u64(row.get(0)?, "transition sequence")?,
                from: state_from_sql(&bounded_text(row, 1, 32, "transition from")?)?,
                to: state_from_sql(&bounded_text(row, 2, 32, "transition to")?)?,
                reason: bounded_text(row, 3, MAX_TOKEN_LENGTH, "transition reason")?,
                at_ms: sql_u64(row.get(4)?, "transition timestamp")?,
                changed: sql_bool(row.get(5)?, "transition changed")?,
            });
        }
    }
    transitions.reverse();
    Ok(transitions.into_iter().collect())
}

fn read_mode(
    connection: &Connection,
    sql: &str,
    parameters: impl rusqlite::Params,
) -> anyhow::Result<Option<AgentMode>> {
    let mut statement = connection.prepare(sql)?;
    let mut rows = statement.query(parameters)?;
    let Some(row) = rows.next()? else {
        return Ok(None);
    };
    let mode = bounded_text(row, 0, 32, "mode")?;
    Ok(Some(mode_from_sql(&mode)?))
}

fn read_mode_preference(
    connection: &Connection,
    sql: &str,
    parameters: impl rusqlite::Params,
) -> anyhow::Result<Option<ModePreference>> {
    let mut statement = connection.prepare(sql)?;
    let mut rows = statement.query(parameters)?;
    let Some(row) = rows.next()? else {
        return Ok(None);
    };
    let mode = mode_from_sql(&bounded_text(row, 0, 32, "mode")?)?;
    let revision = sql_u64(row.get(1)?, "mode revision")?;
    if revision == 0 {
        return Err(anyhow!("persisted mode revision is zero"));
    }
    let updated_at_ms = sql_u64(row.get(2)?, "mode updated_at")?;
    Ok(Some(ModePreference {
        mode,
        revision,
        updated_at_ms,
    }))
}

fn next_mode_revision(current: Option<i64>, label: &str) -> anyhow::Result<i64> {
    let current = current.unwrap_or(0);
    if current < 0 {
        return Err(anyhow!("persisted {label} is negative"));
    }
    current
        .checked_add(1)
        .ok_or_else(|| anyhow!("{label} overflowed SQLite INTEGER"))
}

/// Advance the process independent mode-policy epoch inside the same
/// transaction as the row mutation. Per-scope row revisions answer whether a
/// single row is newer, while this epoch is the revision exposed on an
/// effective `session.mode` result. In particular, clearing a session or
/// workspace override must still produce a newer effective result when the
/// value falls back to an older lower-precedence row.
fn next_mode_epoch(transaction: &Transaction<'_>) -> anyhow::Result<i64> {
    let current = transaction
        .query_row(
            "SELECT revision FROM agent_mode_epoch WHERE id = 1",
            [],
            |row| row.get::<_, i64>(0),
        )
        .optional()?;
    let current = current.unwrap_or(1);
    if current <= 0 {
        return Err(anyhow!("persisted mode policy revision is not positive"));
    }
    let next = current
        .checked_add(1)
        .ok_or_else(|| anyhow!("mode policy revision overflowed SQLite INTEGER"))?;
    transaction.execute(
        "INSERT INTO agent_mode_epoch (id, revision) VALUES (1, ?1)
         ON CONFLICT(id) DO UPDATE SET revision = excluded.revision",
        params![next],
    )?;
    Ok(next)
}

fn validate_persisted_snapshot(record: &PersistedAgentSnapshot) -> anyhow::Result<()> {
    validate_key(&record.snapshot.key)?;
    validate_identifier(&record.snapshot.provider_id, "provider")?;
    if let Some(provider_session_id) = &record.snapshot.provider_session_id {
        validate_text(provider_session_id, MAX_TOKEN_LENGTH, "provider_session_id")?;
    }
    validate_text(&record.snapshot.reason, MAX_TOKEN_LENGTH, "reason")?;
    if record.snapshot.revision == 0 {
        return Err(anyhow!("snapshot revision is zero"));
    }
    if record.mode_revision == 0 {
        return Err(anyhow!("mode revision is zero"));
    }
    if record.snapshot.recent_transitions.len() > MAX_TRANSITION_HISTORY {
        return Err(anyhow!(
            "transition history exceeds {MAX_TRANSITION_HISTORY} records"
        ));
    }
    let mut previous_sequence = None;
    for transition in &record.snapshot.recent_transitions {
        validate_text(&transition.reason, MAX_TOKEN_LENGTH, "transition reason")?;
        if let Some(previous) = previous_sequence {
            if transition.sequence < previous {
                return Err(anyhow!("transition history is not ordered"));
            }
        }
        previous_sequence = Some(transition.sequence);
        sqlite_u64(transition.sequence, "transition sequence")?;
        sqlite_u64(transition.at_ms, "transition timestamp")?;
    }
    sqlite_u64(record.snapshot.last_transition_ms, "last_transition_ms")?;
    sqlite_u64(record.snapshot.last_activity_ms, "last_activity_ms")?;
    sqlite_u64(record.snapshot.transition_sequence, "transition_sequence")?;
    if let Some(active_until) = record.snapshot.active_typing_until_ms {
        sqlite_u64(active_until, "active_typing_until_ms")?;
    }
    // Reuse the authoritative lifecycle validation for provider identity,
    // sleeping resumability, and bounded client collections.  The returned
    // registry is intentionally discarded: persistence must retain the exact
    // current state supplied by the runtime, including a Working row that
    // will only be converted during a later restart load.
    AgentLifecycleRegistry::restore(
        std::iter::once(record.snapshot.clone()),
        record.snapshot.last_transition_ms,
    )
    .map_err(|error| anyhow!("invalid lifecycle snapshot: {error}"))?;
    match record.mode {
        AgentMode::Hosted | AgentMode::Cli => {}
    }
    Ok(())
}

fn validate_key(key: &AgentKey) -> anyhow::Result<()> {
    AgentKey::new(&key.workspace_id, &key.session_id, &key.agent_id)
        .map(|_| ())
        .map_err(|error| anyhow!("invalid agent key: {error}"))
}

fn validate_identifier(value: &str, label: &str) -> anyhow::Result<()> {
    validate_text(value, MAX_IDENTIFIER_LENGTH, label)?;
    if value.chars().any(|character| character.is_control()) {
        return Err(anyhow!("{label} contains a control character"));
    }
    Ok(())
}

fn validate_text(value: &str, max_bytes: usize, label: &str) -> anyhow::Result<()> {
    if value.is_empty() {
        return Err(anyhow!("{label} is empty"));
    }
    if value.len() > max_bytes {
        return Err(anyhow!("{label} exceeds {max_bytes} bytes"));
    }
    if value.contains('\0') {
        return Err(anyhow!("{label} contains NUL"));
    }
    Ok(())
}

fn bounded_text(
    row: &rusqlite::Row<'_>,
    index: usize,
    max_bytes: usize,
    label: &str,
) -> anyhow::Result<String> {
    match row.get_ref(index)? {
        ValueRef::Text(bytes) => {
            if bytes.is_empty() {
                return Err(anyhow!("persisted {label} is empty"));
            }
            if bytes.len() > max_bytes {
                return Err(anyhow!("persisted {label} exceeds {max_bytes} bytes"));
            }
            let value = std::str::from_utf8(bytes)
                .map_err(|error| anyhow!("persisted {label} is not UTF-8: {error}"))?;
            validate_text(value, max_bytes, label)?;
            Ok(value.to_string())
        }
        ValueRef::Null => Err(anyhow!("persisted {label} is NULL")),
        _ => Err(anyhow!("persisted {label} is not text")),
    }
}

fn bounded_optional_text(
    row: &rusqlite::Row<'_>,
    index: usize,
    max_bytes: usize,
    label: &str,
) -> anyhow::Result<Option<String>> {
    match row.get_ref(index)? {
        ValueRef::Null => Ok(None),
        ValueRef::Text(bytes) => {
            if bytes.len() > max_bytes {
                return Err(anyhow!("persisted {label} exceeds {max_bytes} bytes"));
            }
            let value = std::str::from_utf8(bytes)
                .map_err(|error| anyhow!("persisted {label} is not UTF-8: {error}"))?;
            validate_text(value, max_bytes, label)?;
            Ok(Some(value.to_string()))
        }
        _ => Err(anyhow!("persisted {label} is not text")),
    }
}

fn sqlite_u64(value: u64, label: &str) -> anyhow::Result<i64> {
    i64::try_from(value).map_err(|_| anyhow!("{label} does not fit SQLite INTEGER"))
}

fn sql_u64(value: i64, label: &str) -> anyhow::Result<u64> {
    u64::try_from(value).map_err(|_| anyhow!("persisted {label} is negative"))
}

fn bool_to_sql(value: bool) -> i64 {
    i64::from(value)
}

fn sql_bool(value: i64, label: &str) -> anyhow::Result<bool> {
    match value {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(anyhow!("persisted {label} is not 0 or 1")),
    }
}

fn state_to_sql(state: AgentState) -> &'static str {
    match state {
        AgentState::Working => "working",
        AgentState::Blocked => "blocked",
        AgentState::Done => "done",
        AgentState::Idle => "idle",
        AgentState::Sleeping => "sleeping",
        AgentState::Exited => "exited",
        AgentState::Error => "error",
        AgentState::Reconnecting => "reconnecting",
    }
}

fn state_from_sql(value: &str) -> anyhow::Result<AgentState> {
    match value {
        "working" => Ok(AgentState::Working),
        "blocked" => Ok(AgentState::Blocked),
        "done" => Ok(AgentState::Done),
        "idle" => Ok(AgentState::Idle),
        "sleeping" => Ok(AgentState::Sleeping),
        "exited" => Ok(AgentState::Exited),
        "error" => Ok(AgentState::Error),
        "reconnecting" => Ok(AgentState::Reconnecting),
        other => Err(anyhow!("unknown persisted agent state `{other}`")),
    }
}

fn mode_to_sql(mode: AgentMode) -> &'static str {
    match mode {
        AgentMode::Hosted => "hosted",
        AgentMode::Cli => "cli",
    }
}

fn mode_from_sql(value: &str) -> anyhow::Result<AgentMode> {
    match value {
        "hosted" => Ok(AgentMode::Hosted),
        "cli" => Ok(AgentMode::Cli),
        other => Err(anyhow!("unknown persisted agent mode `{other}`")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent_fleet::{AgentRegistration, ProviderSignal};
    use std::sync::Mutex;

    struct TestConnection(Mutex<Connection>);

    impl TestConnection {
        fn new() -> Self {
            Self(Mutex::new(Connection::open_in_memory().unwrap()))
        }
    }

    impl SqliteConnectionAdapter for TestConnection {
        fn with_connection<R, F>(&self, operation: F) -> anyhow::Result<R>
        where
            F: FnOnce(&mut Connection) -> anyhow::Result<R>,
        {
            operation(&mut self.0.lock().unwrap())
        }
    }

    fn key() -> AgentKey {
        AgentKey::new("workspace-1", "session-1", "claude").unwrap()
    }

    fn registry() -> AgentLifecycleRegistry {
        let registry = AgentLifecycleRegistry::new();
        registry
            .register(AgentRegistration {
                key: key(),
                provider_id: "claude".to_string(),
                provider_session_id: Some("provider-session-1".to_string()),
                resumable: true,
                now_ms: 10,
            })
            .unwrap();
        registry
    }

    #[test]
    fn lifecycle_round_trip_preserves_identity_mode_and_bounded_history() {
        let db = Arc::new(TestConnection::new());
        let persistence = AgentPersistence::new(db);
        persistence.ensure_schema().unwrap();
        let registry = registry();
        registry
            .signal(&key(), ProviderSignal::Started, 20)
            .unwrap();
        registry
            .signal(
                &key(),
                ProviderSignal::Completed {
                    reason: "provider finished".to_string(),
                },
                30,
            )
            .unwrap();
        let snapshot = registry.get(&key()).unwrap();
        persistence
            .save_snapshot(&PersistedAgentSnapshot::new(snapshot, AgentMode::Cli))
            .unwrap();

        let loaded = persistence.load_snapshots(40).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].mode, AgentMode::Cli);
        assert_eq!(loaded[0].snapshot.state, AgentState::Done);
        assert_eq!(
            loaded[0].snapshot.provider_session_id.as_deref(),
            Some("provider-session-1")
        );
        assert_eq!(loaded[0].snapshot.recent_transitions.len(), 2);
        assert!(loaded[0].snapshot.observers.is_empty());
        assert!(loaded[0].snapshot.input_owner.is_none());
    }

    #[test]
    fn restart_recovery_reconnects_transient_state_without_losing_provider_session() {
        let persistence = AgentPersistence::new(Arc::new(TestConnection::new()));
        persistence.ensure_schema().unwrap();
        let registry = registry();
        registry
            .signal(&key(), ProviderSignal::Started, 20)
            .unwrap();
        persistence
            .save_snapshot(&PersistedAgentSnapshot::new(
                registry.get(&key()).unwrap(),
                AgentMode::Hosted,
            ))
            .unwrap();

        let loaded = persistence.load_snapshots(100).unwrap();
        assert_eq!(loaded[0].snapshot.state, AgentState::Reconnecting);
        assert_eq!(loaded[0].snapshot.last_transition_ms, 100);
        assert_eq!(
            loaded[0].snapshot.provider_session_id.as_deref(),
            Some("provider-session-1")
        );
    }

    #[test]
    fn mode_resolution_uses_session_workspace_device_precedence_and_clear() {
        let persistence = AgentPersistence::new(Arc::new(TestConnection::new()));
        persistence.ensure_schema().unwrap();
        assert_eq!(
            persistence
                .resolve_mode("device-1", "session-1", Some("workspace-1"))
                .unwrap(),
            AgentMode::Hosted
        );
        persistence
            .set_device_default("device-1", AgentMode::Cli, 10)
            .unwrap();
        assert_eq!(
            persistence
                .resolve_mode("device-1", "session-1", Some("workspace-1"))
                .unwrap(),
            AgentMode::Cli
        );
        persistence
            .set_workspace_override("workspace-1", Some(AgentMode::Hosted), 20)
            .unwrap();
        assert_eq!(
            persistence
                .resolve_mode("device-1", "session-1", Some("workspace-1"))
                .unwrap(),
            AgentMode::Hosted
        );
        persistence
            .set_session_override("session-1", Some(AgentMode::Cli), 30)
            .unwrap();
        assert_eq!(
            persistence
                .resolve_mode("device-1", "session-1", Some("workspace-1"))
                .unwrap(),
            AgentMode::Cli
        );
        persistence
            .set_session_override("session-1", None, 40)
            .unwrap();
        assert_eq!(
            persistence
                .resolve_mode("device-1", "session-1", Some("workspace-1"))
                .unwrap(),
            AgentMode::Hosted
        );
        persistence
            .set_workspace_override("workspace-1", None, 50)
            .unwrap();
        assert_eq!(
            persistence
                .resolve_mode("device-1", "session-1", Some("workspace-1"))
                .unwrap(),
            AgentMode::Cli
        );
    }

    #[test]
    fn mode_policy_epoch_advances_on_every_mutation_including_clear() {
        let persistence = AgentPersistence::new(Arc::new(TestConnection::new()));
        persistence.ensure_schema().unwrap();
        assert_eq!(persistence.mode_policy_revision().unwrap(), 1);

        persistence
            .set_device_default("device-epoch", AgentMode::Cli, 10)
            .unwrap();
        let after_device = persistence.mode_policy_revision().unwrap();
        assert_eq!(after_device, 2);

        persistence
            .set_workspace_override("workspace-epoch", Some(AgentMode::Hosted), 20)
            .unwrap();
        let after_workspace = persistence.mode_policy_revision().unwrap();
        assert_eq!(after_workspace, after_device + 1);

        persistence
            .set_session_override("session-epoch", Some(AgentMode::Cli), 30)
            .unwrap();
        let after_session = persistence.mode_policy_revision().unwrap();
        assert_eq!(after_session, after_workspace + 1);

        // Clearing the high-precedence row reveals the older workspace row,
        // but the effective revision must still move forward.
        persistence
            .set_session_override("session-epoch", None, 40)
            .unwrap();
        let after_clear = persistence.mode_policy_revision().unwrap();
        assert_eq!(after_clear, after_session + 1);
        assert_eq!(
            persistence
                .resolve_mode("device-epoch", "session-epoch", Some("workspace-epoch"))
                .unwrap(),
            AgentMode::Hosted
        );

        persistence.clear_device_default("device-epoch").unwrap();
        assert_eq!(persistence.mode_policy_revision().unwrap(), after_clear + 1);
    }

    #[test]
    fn delete_removes_snapshot_and_transition_rows() {
        let persistence = AgentPersistence::new(Arc::new(TestConnection::new()));
        persistence.ensure_schema().unwrap();
        let registry = registry();
        registry
            .signal(&key(), ProviderSignal::Started, 20)
            .unwrap();
        persistence
            .save_snapshot(&PersistedAgentSnapshot::new(
                registry.get(&key()).unwrap(),
                AgentMode::Cli,
            ))
            .unwrap();
        persistence.delete_snapshot(&key()).unwrap();
        assert!(persistence.load_snapshots(30).unwrap().is_empty());
    }

    #[test]
    fn out_of_order_snapshots_cannot_overwrite_newer_identity_state_or_mode() {
        let persistence = AgentPersistence::new(Arc::new(TestConnection::new()));
        persistence.ensure_schema().unwrap();
        let registry = registry();
        registry
            .signal(
                &key(),
                ProviderSignal::Completed {
                    reason: "new provider finished".to_string(),
                },
                30,
            )
            .unwrap();
        let latest = registry.get(&key()).unwrap();
        let mut stale = latest.clone();
        stale.revision = latest.revision.saturating_sub(1);
        stale.state = AgentState::Working;
        stale.reason = "late stale callback".to_string();
        stale.provider_session_id = Some("old-provider-session".to_string());

        persistence
            .save_snapshot(&PersistedAgentSnapshot::new(latest, AgentMode::Hosted))
            .unwrap();
        persistence
            .save_snapshot(
                &PersistedAgentSnapshot::new(stale, AgentMode::Cli).with_mode_revision(1),
            )
            .unwrap();

        let loaded = persistence.load_snapshots(40).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].snapshot.state, AgentState::Done);
        assert_eq!(loaded[0].mode, AgentMode::Hosted);
        assert_eq!(
            loaded[0].snapshot.provider_session_id.as_deref(),
            Some("provider-session-1")
        );
        assert_eq!(
            loaded[0].snapshot.revision,
            registry.get(&key()).unwrap().revision
        );
    }

    #[test]
    fn concurrent_out_of_order_batches_keep_the_highest_revision() {
        let persistence = Arc::new(AgentPersistence::new(Arc::new(TestConnection::new())));
        persistence.ensure_schema().unwrap();
        let registry = registry();
        let mut older = registry.get(&key()).unwrap();
        older.revision = 2;
        older.state = AgentState::Idle;
        older.reason = "older batch".to_string();
        let mut newer = older.clone();
        newer.revision = 3;
        newer.state = AgentState::Done;
        newer.reason = "newer batch".to_string();
        newer.provider_session_id = Some("provider-session-new".to_string());
        let barrier = Arc::new(std::sync::Barrier::new(2));
        let first = {
            let persistence = persistence.clone();
            let barrier = barrier.clone();
            std::thread::spawn(move || {
                barrier.wait();
                persistence
                    .save_snapshots(&[PersistedAgentSnapshot::new(older, AgentMode::Hosted)])
                    .unwrap();
            })
        };
        let second = {
            let persistence = persistence.clone();
            let barrier = barrier.clone();
            std::thread::spawn(move || {
                barrier.wait();
                persistence
                    .save_snapshots(&[PersistedAgentSnapshot::new(newer, AgentMode::Cli)])
                    .unwrap();
            })
        };
        first.join().unwrap();
        second.join().unwrap();
        let loaded = persistence.load_snapshots(40).unwrap();
        assert_eq!(loaded[0].snapshot.revision, 3);
        assert_eq!(loaded[0].snapshot.state, AgentState::Done);
        assert_eq!(loaded[0].mode, AgentMode::Cli);
        assert_eq!(
            loaded[0].snapshot.provider_session_id.as_deref(),
            Some("provider-session-new")
        );
    }

    #[test]
    fn save_after_restart_recovery_advances_revision_over_pre_restart_state() {
        let persistence = AgentPersistence::new(Arc::new(TestConnection::new()));
        persistence.ensure_schema().unwrap();
        let registry = registry();
        registry
            .signal(&key(), ProviderSignal::Started, 20)
            .unwrap();
        let pre_restart = registry.get(&key()).unwrap();
        persistence
            .save_snapshot(&PersistedAgentSnapshot::new(
                pre_restart.clone(),
                AgentMode::Cli,
            ))
            .unwrap();

        let recovered = persistence.load_snapshots(100).unwrap();
        assert_eq!(recovered[0].snapshot.state, AgentState::Reconnecting);
        assert!(recovered[0].snapshot.revision > pre_restart.revision);
        persistence.save_snapshot(&recovered[0]).unwrap();
        // A delayed callback from before the restart must not put Working
        // back into the durable row after recovery has been saved.
        persistence
            .save_snapshot(&PersistedAgentSnapshot::new(pre_restart, AgentMode::Cli))
            .unwrap();

        let loaded = persistence.load_snapshots(200).unwrap();
        assert_eq!(loaded[0].snapshot.state, AgentState::Reconnecting);
        assert_eq!(loaded[0].snapshot.revision, recovered[0].snapshot.revision);
    }

    #[test]
    fn independent_mode_revision_updates_do_not_replace_lifecycle_state() {
        let persistence = AgentPersistence::new(Arc::new(TestConnection::new()));
        persistence.ensure_schema().unwrap();
        let registry = registry();
        registry
            .signal(
                &key(),
                ProviderSignal::Completed {
                    reason: "finished".to_string(),
                },
                20,
            )
            .unwrap();
        let snapshot = registry.get(&key()).unwrap();
        persistence
            .save_snapshot(&PersistedAgentSnapshot::new(
                snapshot.clone(),
                AgentMode::Hosted,
            ))
            .unwrap();
        persistence
            .save_snapshot(
                &PersistedAgentSnapshot::new(snapshot.clone(), AgentMode::Cli)
                    .with_mode_revision(snapshot.revision + 1),
            )
            .unwrap();
        // A lifecycle callback with the same revision but an older mode must
        // not roll the independent mode change back.
        persistence
            .save_snapshot(
                &PersistedAgentSnapshot::new(snapshot, AgentMode::Hosted).with_mode_revision(1),
            )
            .unwrap();

        let loaded = persistence.load_snapshots(30).unwrap();
        assert_eq!(loaded[0].snapshot.state, AgentState::Done);
        assert_eq!(loaded[0].mode, AgentMode::Cli);
    }

    #[test]
    fn oversized_transition_history_is_rejected_before_sql_write() {
        let persistence = AgentPersistence::new(Arc::new(TestConnection::new()));
        persistence.ensure_schema().unwrap();
        let registry = registry();
        let mut snapshot = registry.get(&key()).unwrap();
        for sequence in 0..=MAX_TRANSITION_HISTORY {
            snapshot.recent_transitions.push_back(AgentTransition {
                sequence: sequence as u64,
                from: AgentState::Idle,
                to: AgentState::Done,
                reason: "bounded".to_string(),
                at_ms: sequence as u64,
                changed: true,
            });
        }
        assert!(persistence
            .save_snapshot(&PersistedAgentSnapshot::new(snapshot, AgentMode::Hosted))
            .is_err());
        assert!(persistence.load_snapshots(30).unwrap().is_empty());
    }
}
