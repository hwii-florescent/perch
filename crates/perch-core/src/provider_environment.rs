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

/// Native/default policies retain the established launch path. Restrictive
/// policies take a bounded snapshot; values never enter the wrapper's argv.
pub(crate) fn prepare(argv: Vec<String>, policy: &EnvironmentPolicy) -> Result<PreparedCommand> {
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
    let mut environment: BTreeMap<_, _> = parent
        .into_iter()
        .filter(|(name, _)| {
            (policy.inherit && policy.allow.is_empty()) || policy.allow.contains(name)
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
    write_bootstrap(script.as_bytes())
}

#[cfg(unix)]
fn write_bootstrap(script: &[u8]) -> Result<PreparedCommand> {
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
    Ok(PreparedCommand {
        argv: vec![
            "/usr/bin/env".into(),
            "-i".into(),
            "/bin/sh".into(),
            path.to_string_lossy().into_owned(),
        ],
        bootstrap: Some(bootstrap),
    })
}

#[cfg(not(unix))]
fn write_bootstrap(_: &[u8]) -> Result<PreparedCommand> {
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
