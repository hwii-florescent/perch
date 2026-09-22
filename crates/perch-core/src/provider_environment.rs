//! Apply provider environment rules to the actual process inside tmux.
//!
//! Passing secrets with `env KEY=value ...` or `tmux -e KEY=value` exposes
//! them in process arguments. A private bootstrap instead exports quoted
//! values and replaces itself with the provider. It unlinks itself before
//! exec; the runtime also owns a cleanup guard for failed or unused launches.

use std::collections::BTreeMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

use anyhow::{Context, Result};

use crate::agent_fleet::EnvironmentPolicy;

const MAX_BOOTSTRAP_BYTES: usize = 512 * 1024;

pub(crate) struct BootstrapFile(PathBuf);
impl Drop for BootstrapFile {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

pub(crate) struct PreparedCommand {
    pub argv: Vec<String>,
    pub bootstrap: Option<BootstrapFile>,
}

/// Every policy takes a bounded snapshot of this process's environment;
/// values never enter the wrapper's argv.
///
/// Even the default "inherit everything" policy needs the bootstrap, because
/// the CLI is launched with `tmux new-session`: a tmux **server** that
/// predates this core hands the new session *its own* environment, so the
/// login-shell PATH `boot.rs` works to adopt, and anything the user exported
/// for their CLI (an API key, `ANTHROPIC_MODEL`, `CODEX_HOME`), silently never
/// arrives. Inheriting worked only when perch happened to start the server.
pub(crate) fn prepare(argv: Vec<String>, policy: &EnvironmentPolicy) -> Result<PreparedCommand> {
    // Elsewhere there is no tmux and no bootstrap: the child inherits directly.
    #[cfg(not(unix))]
    if *policy == EnvironmentPolicy::default() {
        return Ok(PreparedCommand {
            argv,
            bootstrap: None,
        });
    }
    let mut parent = BTreeMap::new();
    for (name, value) in std::env::vars_os() {
        let name = name
            .into_string()
            .map_err(|_| anyhow::anyhow!("provider environment contains a non-UTF-8 name"))?;
        if (policy.inherit && policy.allow.is_empty()) || policy.allow.contains(&name) {
            parent.insert(
                name,
                value.into_string().map_err(|_| {
                    anyhow::anyhow!("provider environment contains a non-UTF-8 value")
                })?,
            );
        }
    }
    prepare_with_parent(argv, policy, parent)
}

fn quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}
fn valid_name(name: &str) -> bool {
    let mut chars = name.bytes();
    matches!(chars.next(), Some(b'a'..=b'z' | b'A'..=b'Z' | b'_'))
        && chars.all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
}

fn prepare_with_parent(
    argv: Vec<String>,
    policy: &EnvironmentPolicy,
    parent: BTreeMap<String, String>,
) -> Result<PreparedCommand> {
    anyhow::ensure!(!argv.is_empty(), "provider command is empty");
    // A name this shell cannot export (bash's exported functions arrive as
    // `BASH_FUNC_x%%`) is dropped rather than failing the launch; an invalid
    // name in the manifest's own `set` rules is still an error below.
    let mut environment: BTreeMap<_, _> = parent
        .into_iter()
        .filter(|(name, _)| {
            valid_name(name)
                && ((policy.inherit && policy.allow.is_empty()) || policy.allow.contains(name))
        })
        .collect();
    // Describe the actual xterm-backed terminal even with a cleared parent
    // environment. Explicit manifest set/unset rules can override these hints.
    environment.insert("TERM".into(), "xterm-256color".into());
    environment.insert("COLORTERM".into(), "truecolor".into());
    environment.insert("TERM_PROGRAM".into(), "perch".into());
    environment
        .entry("LANG".into())
        .or_insert_with(|| "en_US.UTF-8".into());
    environment.extend(policy.set.clone());
    for name in &policy.unset {
        environment.remove(name);
    }
    let mut script = String::from("#!/bin/sh\n/bin/rm -f -- \"$0\"\n");
    for (name, value) in environment {
        anyhow::ensure!(
            valid_name(&name) && !value.contains('\0'),
            "provider environment contains an invalid name or value"
        );
        script.push_str(&format!("export {name}={}\n", quote(&value)));
        anyhow::ensure!(
            script.len() <= MAX_BOOTSTRAP_BYTES,
            "provider environment exceeds the launch limit"
        );
    }
    script.push_str("exec");
    for argument in argv {
        anyhow::ensure!(
            !argument.contains('\0'),
            "provider argument contains a null byte"
        );
        script.push(' ');
        script.push_str(&quote(&argument));
        anyhow::ensure!(
            script.len() <= MAX_BOOTSTRAP_BYTES,
            "provider command exceeds the launch limit"
        );
    }
    script.push('\n');
    // A restrictive policy means what it says, so it starts from an empty
    // environment. The default policy only *adds* this core's environment on
    // top of whatever tmux gave the session, keeping tmux's own `TMUX`/
    // `TMUX_PANE` (which a CLI reads to detect its terminal) intact.
    write_bootstrap(script.as_bytes(), *policy != EnvironmentPolicy::default())
}

#[cfg(unix)]
fn write_bootstrap(script: &[u8], clear_environment: bool) -> Result<PreparedCommand> {
    use std::os::unix::fs::OpenOptionsExt;
    let path = std::env::temp_dir().join(format!("perch-provider-{}.sh", uuid::Uuid::new_v4()));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(&path)
        .context("cannot create private provider bootstrap")?;
    let bootstrap = BootstrapFile(path.clone());
    file.write_all(script)
        .context("cannot write private provider bootstrap")?;
    file.sync_all()?;
    drop(file);
    let mut argv: Vec<String> = Vec::new();
    if clear_environment {
        argv.extend(["/usr/bin/env".to_string(), "-i".to_string()]);
    }
    argv.extend(["/bin/sh".to_string(), path.to_string_lossy().into_owned()]);
    Ok(PreparedCommand {
        argv,
        bootstrap: Some(bootstrap),
    })
}

#[cfg(not(unix))]
fn write_bootstrap(_: &[u8], _: bool) -> Result<PreparedCommand> {
    anyhow::bail!("custom provider environment policies require a Unix host")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    #[test]
    fn environment_rules_reach_child_without_expansion_or_secret_arguments() {
        let policy = EnvironmentPolicy {
            inherit: false,
            allow: ["ALLOWED".to_string()].into_iter().collect(),
            set: [(
                "VALUE".to_string(),
                "literal '$HOME' $(exit 99); newline\nsecond".to_string(),
            )]
            .into_iter()
            .collect(),
            unset: ["REMOVED".to_string()].into_iter().collect(),
        };
        let parent = [
            ("ALLOWED".into(), "kept".into()),
            ("REMOVED".into(), "hidden".into()),
        ]
        .into_iter()
        .collect();
        let prepared = prepare_with_parent(vec!["/bin/sh".into(), "-c".into(),
            "printf '%s|%s|%s|%s' \"$ALLOWED\" \"${REMOVED-unset}\" \"${OUTSIDE-unset}\" \"$VALUE\"".into()], &policy, parent).unwrap();
        assert!(!prepared
            .argv
            .iter()
            .any(|argument| argument.contains("literal")));
        let path = prepared.bootstrap.as_ref().unwrap().0.clone();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
        let result = Command::new(&prepared.argv[0])
            .args(&prepared.argv[1..])
            .env("OUTSIDE", "must-not-leak")
            .output()
            .unwrap();
        assert!(result.status.success());
        assert_eq!(
            String::from_utf8(result.stdout).unwrap(),
            "kept|unset|unset|literal '$HOME' $(exit 99); newline\nsecond"
        );
        assert!(
            !path.exists(),
            "bootstrap should unlink itself before provider exec"
        );
    }

    /// The default policy is what every built-in CLI launches with, and its
    /// child is started by `tmux new-session` — which hands over the *tmux
    /// server's* environment, not this core's. So the bootstrap has to carry
    /// this process's variables in, while leaving the ones tmux itself sets
    /// on the session (`TMUX`, `TMUX_PANE`) alone.
    #[test]
    fn the_default_policy_adds_this_environment_without_discarding_tmux_own() {
        let parent = [
            (
                "ANTHROPIC_MODEL".to_string(),
                "claude-haiku-4-5".to_string(),
            ),
            // bash exports functions under a name no shell can `export`.
            ("BASH_FUNC_helper%%".to_string(), "() { :; }".to_string()),
        ]
        .into_iter()
        .collect();
        let prepared = prepare_with_parent(
            vec![
                "/bin/sh".into(),
                "-c".into(),
                "printf '%s|%s' \"$ANTHROPIC_MODEL\" \"${TMUX-unset}\"".into(),
            ],
            &EnvironmentPolicy::default(),
            parent,
        )
        .unwrap();
        assert_eq!(prepared.argv[0], "/bin/sh", "must not clear the child env");
        let result = Command::new(&prepared.argv[0])
            .args(&prepared.argv[1..])
            .env("TMUX", "/tmp/tmux-501/default,123,4")
            .env("ANTHROPIC_MODEL", "a-stale-tmux-server-value")
            .output()
            .unwrap();
        assert!(result.status.success());
        assert_eq!(
            String::from_utf8(result.stdout).unwrap(),
            "claude-haiku-4-5|/tmp/tmux-501/default,123,4"
        );
    }

    #[test]
    fn unused_bootstrap_is_removed_with_its_runtime_guard() {
        let prepared = prepare_with_parent(
            vec!["/bin/true".into()],
            &EnvironmentPolicy::default(),
            BTreeMap::new(),
        )
        .unwrap();
        let path = prepared.bootstrap.as_ref().unwrap().0.clone();
        assert!(path.exists());
        drop(prepared);
        assert!(!path.exists());
    }
}
