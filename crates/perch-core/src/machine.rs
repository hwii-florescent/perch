//! Adding a remote computer, as herdr-core's `hc machine add|login` does: look at it over ssh,
//! put `perch-core` there if it is missing, and say plainly what is wrong when it does not work.
//!
//! Everything rides the OpenSSH CLI through `ssh.rs` (`BatchMode`, the shared control master, and
//! `PERCH_SSH` for tests). A password, code or host-key question needs a person at a terminal, so
//! a probe that hits one reports `NeedsLogin` and [`login_argv`] is the command to run in one.

use crate::ssh::{mux_opts, run_remote, run_remote_with_input, shell_quote};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Where the core lands on the remote, relative to `$HOME` (already on the PATH perch gives remote
/// commands, see `ssh::REMOTE_PATH_PREFIX`).
const REMOTE_BIN: &str = ".local/bin/perch-core";

/// What a probe found on the remote.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Probe {
    /// `linux` or `macos`.
    pub os: String,
    /// `x86_64` or `aarch64`.
    pub arch: String,
    pub home: String,
    pub tmux: bool,
    /// Where `perch-core` is on the remote, and the version it reports.
    pub core_path: Option<String>,
    pub core_version: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Fault {
    /// ssh wants a password, a code or a host-key answer from a person.
    NeedsLogin,
    /// No answer at all: wrong name, no network, nothing listening.
    Unreachable,
    Failed,
}

/// A failure a person can act on: what happened and the next step.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MachineError {
    pub kind: Fault,
    pub message: String,
    pub hint: String,
}

fn fault(kind: Fault, message: impl Into<String>, hint: impl Into<String>) -> MachineError {
    MachineError {
        kind,
        message: message.into(),
        hint: hint.into(),
    }
}

/// Sorts what ssh said (or what `ssh.rs` folded it into) into a fault with a next step.
pub fn classify(said: &str) -> MachineError {
    let low = said.to_lowercase();
    let one_line: String = said.trim().chars().take(300).collect();
    if low.contains("host key verification failed")
        || low.contains("keyboard-interactive")
        || (low.contains("permission denied") && low.contains("password"))
    {
        return fault(
            Fault::NeedsLogin,
            "ssh needs a person to log in to this machine",
            "Use Log in: it opens a terminal where ssh can ask for the password, code or host key.",
        );
    }
    if low.contains("permission denied") {
        return fault(
            Fault::Failed,
            "ssh refused this user's keys",
            "Add a key to the machine's authorized_keys, or fix the user name in the target.",
        );
    }
    if [
        "could not resolve",
        "connection refused",
        "no route to host",
        "timed out",
        "network is unreachable",
        "connection closed",
    ]
    .iter()
    .any(|needle| low.contains(needle))
    {
        return fault(
            Fault::Unreachable,
            format!("cannot reach the machine: {one_line}"),
            "Check the name, the network and that sshd is running; `ssh <target>` in a terminal shows the same.",
        );
    }
    fault(
        Fault::Failed,
        one_line,
        "Run `ssh <target>` in a terminal to see what it says.",
    )
}

const MARK: &str = "__PERCH_MACHINE__";

/// One round trip: the system, whether tmux and `perch-core` are there, and its version. Prints one
/// field per line after a marker, so a login banner cannot be mistaken for data.
fn probe_script() -> String {
    format!(
        r#"echo {MARK}; uname -s; uname -m; echo "$HOME"; command -v tmux >/dev/null 2>&1 && echo yes || echo no; p=$(command -v perch-core 2>/dev/null); if [ -n "$p" ] && [ -x "$p" ]; then echo "$p"; "$p" --version 2>/dev/null | head -1; else echo; echo; fi"#
    )
}

fn parse_probe(out: &str) -> Option<Probe> {
    let lines: Vec<&str> = out.lines().map(str::trim).collect();
    let start = lines.iter().position(|l| *l == MARK)? + 1;
    let field = |i: usize| lines.get(start + i).copied().unwrap_or("");
    let some = |s: &str| (!s.is_empty()).then(|| s.to_string());
    let os = match field(0) {
        "Linux" => "linux",
        "Darwin" => "macos",
        _ => return None,
    };
    let arch = match field(1) {
        "x86_64" | "amd64" => "x86_64",
        "aarch64" | "arm64" => "aarch64",
        _ => return None,
    };
    Some(Probe {
        os: os.into(),
        arch: arch.into(),
        home: field(2).into(),
        tmux: field(3) == "yes",
        core_path: some(field(4)),
        core_version: some(field(5)),
    })
}

pub async fn probe(ssh_host: &str) -> Result<Probe, MachineError> {
    let out = run_remote(ssh_host, &probe_script(), 20, "machine probe")
        .await
        .map_err(|e| classify(&e))?;
    parse_probe(&out).ok_or_else(|| {
        fault(
            Fault::Failed,
            "the machine answered, but not as a Mac or Linux computer",
            "Perch can add macOS and Linux machines (x86_64 or aarch64).",
        )
    })
}

/// Where the bytes of `perch-core` for the remote come from.
#[derive(Debug, PartialEq)]
pub enum Source {
    /// This computer's own `perch-core`: the remote runs the same OS and CPU.
    Upload(PathBuf),
    /// The remote downloads this release asset itself, and checks its `.sha256`.
    Release { url: String },
}

/// The release this build belongs to: CI sets `PERCH_RELEASE_TAG` for a tagged build.
fn release_tag() -> &'static str {
    option_env!("PERCH_RELEASE_TAG").unwrap_or(concat!("v", env!("CARGO_PKG_VERSION")))
}

const RELEASES: &str = "https://github.com/hwii-florescent/perch/releases/download";

pub fn this_os_arch() -> (&'static str, &'static str) {
    let os = if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    };
    let arch = if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else {
        "x86_64"
    };
    (os, arch)
}

/// A `perch-core` on this computer that can run on the remote: the one named by `PERCH_CORE_BIN`,
/// the running binary when it is `perch-core`, or one beside the running app.
fn local_core() -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("PERCH_CORE_BIN").map(PathBuf::from) {
        return path.is_file().then_some(path);
    }
    let exe = std::env::current_exe().ok()?;
    if exe.file_name()? == "perch-core" {
        return Some(exe);
    }
    let beside = exe.parent()?.join("perch-core");
    beside.is_file().then_some(beside)
}

/// Same OS and CPU and a local `perch-core`: upload it. Otherwise the release build for that target.
pub fn choose_source(remote: &Probe, local: Option<PathBuf>, here: (&str, &str)) -> Source {
    if (remote.os.as_str(), remote.arch.as_str()) == here {
        if let Some(path) = local {
            return Source::Upload(path);
        }
    }
    Source::Release {
        url: format!(
            "{RELEASES}/{}/perch-core-{}-{}",
            release_tag(),
            remote.os,
            remote.arch
        ),
    }
}

/// Puts `perch-core` at `~/.local/bin/perch-core` on the remote (atomically: a `.part` file, then
/// `mv`) and returns that path. An existing copy is replaced, which is also how it is updated.
pub async fn install(ssh_host: &str, remote: &Probe) -> Result<String, MachineError> {
    let source = choose_source(remote, local_core(), this_os_arch());
    install_from(ssh_host, remote, source).await
}

pub async fn install_from(
    ssh_host: &str,
    remote: &Probe,
    source: Source,
) -> Result<String, MachineError> {
    let dest = format!("{}/{REMOTE_BIN}", remote.home.trim_end_matches('/'));
    let part = format!("{dest}.part");
    let (q_dest, q_part) = (shell_quote(&dest), shell_quote(&part));
    let prepare = format!(r#"umask 022; mkdir -p "$(dirname {q_dest})""#);
    let finish = format!("chmod 755 {q_part} && mv -f {q_part} {q_dest}");
    let failed = |e: String| classify(&e);
    match source {
        Source::Upload(path) => {
            let bytes = std::fs::read(&path).map_err(|e| {
                fault(
                    Fault::Failed,
                    format!("cannot read {}: {e}", path.display()),
                    "Build perch-core first.",
                )
            })?;
            // ponytail: the whole binary is held in memory while it streams (tens of MB); chunk it if it grows.
            let out = run_remote_with_input(
                ssh_host,
                &format!("{prepare} && cat > {q_part} && {finish}"),
                bytes,
                600,
            )
            .await
            .map_err(failed)?;
            if !out.status.success() {
                return Err(classify(&String::from_utf8_lossy(&out.stderr)));
            }
        }
        Source::Release { url } => {
            let sum = format!("{url}.sha256");
            let script = format!(
                r#"{prepare} && {{ if command -v curl >/dev/null 2>&1; then get() {{ curl -fsSL "$1" -o "$2"; }}; elif command -v wget >/dev/null 2>&1; then get() {{ wget -qO "$2" "$1"; }}; else echo "neither curl nor wget is on this machine" >&2; exit 3; fi; }} && get {} {q_part} && get {} {q_part}.sha256 && want=$(cut -d' ' -f1 {q_part}.sha256) && if command -v sha256sum >/dev/null 2>&1; then have=$(sha256sum {q_part} | cut -d' ' -f1); else have=$(shasum -a 256 {q_part} | cut -d' ' -f1); fi && if [ "$want" = "$have" ]; then rm -f {q_part}.sha256 && {finish}; else rm -f {q_part} {q_part}.sha256; echo "checksum mismatch" >&2; exit 4; fi"#,
                shell_quote(&url),
                shell_quote(&sum),
            );
            let out = run_remote_with_input(ssh_host, &script, Vec::new(), 600)
                .await
                .map_err(failed)?;
            if !out.status.success() {
                let said = String::from_utf8_lossy(&out.stderr);
                let message = if said.contains("curl: (22)")
                    || said.to_lowercase().contains("404")
                    || said.contains("ERROR 404")
                {
                    format!("no build of perch-core is published at {url}")
                } else {
                    said.trim().chars().take(300).collect()
                };
                return Err(fault(
                    Fault::Failed,
                    message,
                    "Releases carry perch-core for macOS and Linux (x86_64, aarch64); on other systems build it there.",
                ));
            }
        }
    }
    Ok(dest)
}

/// The command a person runs in a terminal to log in once: ssh may ask for a password, a code or a
/// host key, and then stays up as the shared control master (10 minutes idle) that every
/// non-interactive perch call to this machine rides.
pub fn login_argv(ssh_host: &str) -> Vec<String> {
    let mut argv = vec!["ssh".to_string()];
    argv.extend(mux_opts());
    argv.extend([
        "-o".into(),
        "ConnectTimeout=15".into(),
        ssh_host.into(),
        "exit".into(),
    ]);
    argv
}

/// Host names `~/.ssh/config` offers (no wildcards), following `Include`s the way ssh does: `~` is
/// home, a relative path is under `~/.ssh`, a `*` pattern matches file names; ssh stops 16 deep.
pub fn ssh_config_hosts(home: &Path) -> Vec<String> {
    let mut hosts = Vec::new();
    collect_hosts(home, &home.join(".ssh/config"), 0, &mut hosts);
    hosts.sort();
    hosts.dedup();
    hosts
}

fn collect_hosts(home: &Path, file: &Path, depth: usize, hosts: &mut Vec<String>) {
    if depth > 16 {
        return;
    }
    let Ok(text) = std::fs::read_to_string(file) else {
        return;
    };
    for line in text.lines() {
        let line = line.trim();
        let (key, rest) = line
            .split_once(|c: char| c.is_whitespace() || c == '=')
            .map(|(k, r)| (k.to_lowercase(), r.trim().trim_start_matches('=').trim()))
            .unwrap_or_default();
        match key.as_str() {
            "host" => hosts.extend(
                rest.split_whitespace()
                    .filter(|h| !h.contains(['*', '?', '!']))
                    .map(str::to_string),
            ),
            "include" => {
                for pattern in rest.split_whitespace() {
                    for path in expand_include(home, pattern.trim_matches('"')) {
                        collect_hosts(home, &path, depth + 1, hosts);
                    }
                }
            }
            _ => {}
        }
    }
}

fn expand_include(home: &Path, pattern: &str) -> Vec<PathBuf> {
    let full = if let Some(rest) = pattern.strip_prefix("~/") {
        home.join(rest)
    } else if pattern.starts_with('/') {
        PathBuf::from(pattern)
    } else {
        home.join(".ssh").join(pattern)
    };
    let Some(name) = full
        .file_name()
        .and_then(|n| n.to_str())
        .map(str::to_string)
    else {
        return Vec::new();
    };
    if !name.contains('*') {
        return vec![full];
    }
    let (prefix, suffix) = name.split_once('*').unwrap_or((&name, ""));
    let Ok(entries) = std::fs::read_dir(full.parent().unwrap_or(Path::new("."))) else {
        return Vec::new();
    };
    let mut found: Vec<PathBuf> = entries
        .filter_map(Result::ok)
        .filter(|e| {
            let n = e.file_name().to_string_lossy().into_owned();
            n.len() >= prefix.len() + suffix.len() && n.starts_with(prefix) && n.ends_with(suffix)
        })
        .map(|e| e.path())
        .collect();
    found.sort();
    found
}

#[cfg(test)]
mod tests {
    use super::*;

    fn probe_of(os: &str, arch: &str) -> Probe {
        Probe {
            os: os.into(),
            arch: arch.into(),
            home: "/home/u".into(),
            tmux: true,
            core_path: None,
            core_version: None,
        }
    }

    #[test]
    fn a_probe_reads_past_a_login_banner_and_refuses_a_system_it_does_not_know() {
        let out = "Welcome to box\n__PERCH_MACHINE__\nLinux\nx86_64\n/home/u\nyes\n/home/u/.local/bin/perch-core\nperch-core 0.0.1\n";
        let probe = parse_probe(out).unwrap();
        assert_eq!(
            (probe.os.as_str(), probe.arch.as_str(), probe.tmux),
            ("linux", "x86_64", true)
        );
        assert_eq!(probe.core_version.as_deref(), Some("perch-core 0.0.1"));
        let bare = parse_probe("__PERCH_MACHINE__\nDarwin\narm64\n/Users/u\nno\n\n\n").unwrap();
        assert_eq!(
            (
                bare.os.as_str(),
                bare.arch.as_str(),
                bare.tmux,
                bare.core_path
            ),
            ("macos", "aarch64", false, None)
        );
        assert!(parse_probe("__PERCH_MACHINE__\nFreeBSD\namd64\n/h\nno\n\n\n").is_none());
        assert!(parse_probe("no marker at all").is_none());
    }

    #[test]
    fn ssh_failures_say_what_to_do_next() {
        use Fault::*;
        let cases = [
            ("remote command failed (machine probe, exit 255): u@h: Permission denied (publickey,password).", NeedsLogin),
            ("Host key verification failed.", NeedsLogin),
            ("remote command failed (x, exit 255): ssh: Could not resolve hostname nope: nodename nor servname", Unreachable),
            ("ssh: connect to host h port 22: Connection refused", Unreachable),
            ("ssh timed out (machine probe)", Unreachable),
            ("remote command failed (x, exit 255): u@h: Permission denied (publickey).", Failed),
            ("something else entirely", Failed),
        ];
        for (said, kind) in cases {
            let error = classify(said);
            assert_eq!(error.kind, kind, "{said}");
            assert!(!error.hint.is_empty());
        }
    }

    #[test]
    fn the_core_is_uploaded_only_to_the_same_system_otherwise_downloaded_from_the_release() {
        let local = Some(PathBuf::from("/usr/local/bin/perch-core"));
        assert_eq!(
            choose_source(
                &probe_of("macos", "aarch64"),
                local.clone(),
                ("macos", "aarch64")
            ),
            Source::Upload("/usr/local/bin/perch-core".into())
        );
        let Source::Release { url } =
            choose_source(&probe_of("linux", "x86_64"), local, ("macos", "aarch64"))
        else {
            panic!("a Linux remote cannot run a macOS binary");
        };
        assert!(url.ends_with("/perch-core-linux-x86_64"), "{url}");
        // The same system but nothing to copy (an app with no beside-it core) also downloads.
        assert!(matches!(
            choose_source(&probe_of("macos", "aarch64"), None, ("macos", "aarch64")),
            Source::Release { .. }
        ));
    }

    #[test]
    fn the_login_command_rides_the_shared_control_master() {
        let argv = login_argv("box");
        assert_eq!(argv.first().map(String::as_str), Some("ssh"));
        assert!(argv.iter().any(|a| a == "ControlMaster=auto"));
        assert!(argv.iter().any(|a| a.starts_with("ControlPersist=")));
        assert_eq!(&argv[argv.len() - 2..], ["box", "exit"]);
    }

    #[test]
    fn ssh_config_hosts_follow_includes_and_skip_wildcards() {
        let home = std::env::temp_dir().join(format!("perch-sshcfg-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(home.join(".ssh/conf.d")).unwrap();
        std::fs::write(
            home.join(".ssh/config"),
            "Include conf.d/*.conf\nInclude ~/.ssh/extra\nHost box devpod\n  HostName 10.0.0.1\nHost *\n  ServerAliveInterval 5\nHost !skip vps\nHost=eq\n",
        )
        .unwrap();
        std::fs::write(home.join(".ssh/conf.d/a.conf"), "Host from-include\n").unwrap();
        std::fs::write(home.join(".ssh/conf.d/b.txt"), "Host not-matched\n").unwrap();
        std::fs::write(home.join(".ssh/extra"), "Host extra\nInclude extra\n").unwrap(); // loops on itself: stops at 16
        assert_eq!(
            ssh_config_hosts(&home),
            ["box", "devpod", "eq", "extra", "from-include", "vps"]
        );
        assert!(ssh_config_hosts(&home.join("nowhere")).is_empty());
        std::fs::remove_dir_all(&home).unwrap();
    }
}
