//! Give agents typed in a Perch shell the same native status adapters as picker
//! launches. Private command shims preserve argv, auth and user configuration;
//! they never type into a PTY or restart an existing process. The shell remains
//! the runtime owner, even when a nested agent publishes native observations.
use crate::{agent_fleet::AgentKey, native_ui};
use anyhow::Context;
use std::{
    fs,
    path::{Path, PathBuf},
};

use native_ui::PROVIDERS;

fn quote(text: &str) -> String {
    format!("'{}'", text.replace('\'', "'\\''"))
}
fn quoted(path: &Path) -> String {
    quote(&path.to_string_lossy())
}

/// The tab (owner key) each shell agent's bridge key was made for. The bridge key keeps the session
/// but not the tab's provider, and a tab started from the picker (Claude exited, then `pi`) is not a
/// `terminal` one: without this its PTY would be looked up under the wrong key and every screen read
/// and input check would fail closed.
/// ponytail: bounded by sessions x providers and never pruned; a registry on the runtime would drop
/// entries with their tab.
static OWNERS: std::sync::Mutex<Option<std::collections::HashMap<AgentKey, AgentKey>>> =
    std::sync::Mutex::new(None);

pub(crate) fn bridge_key(key: &AgentKey, provider: &str) -> anyhow::Result<AgentKey> {
    let bridge = AgentKey::new(
        &key.workspace_id,
        format!("shell-{}", key.session_id),
        provider,
    )?;
    OWNERS
        .lock()
        .unwrap()
        .get_or_insert_with(Default::default)
        .insert(bridge.clone(), key.clone());
    Ok(bridge)
}
/// The PTY a native bridge's agent runs in. A shim-launched agent's bridge key is
/// `shell-<tab>`; its terminal is the tab's own (whatever provider the tab was started with), not one
/// derived from the bridge key.
pub(crate) fn pty_key(key: &AgentKey) -> String {
    let tab = key.session_id.strip_prefix("shell-").and_then(|session| {
        let owner = OWNERS
            .lock()
            .unwrap()
            .as_ref()
            .and_then(|owners| owners.get(key).cloned());
        owner.or_else(|| {
            AgentKey::new(
                &key.workspace_id,
                session,
                crate::agent_fleet::TERMINAL_PROVIDER,
            )
            .ok()
        })
    });
    crate::agent_runtime::terminal_key(tab.as_ref().unwrap_or(key))
}
/// Every generated wrapper directory has this file, including those written before the recursion fix,
/// so another Perch shell can tell an inherited wrapper `ZDOTDIR` from the user's own.
const MARKER: &str = "bash-launch";

/// A private command wrapper is not evidence that its underlying CLI exists.
/// Call with a canonical path so symlinks to wrappers are recognized too.
pub(crate) fn is_command_shim(path: &Path) -> bool {
    path.parent().is_some_and(|bin| {
        bin.file_name().is_some_and(|name| name == "bin")
            && bin.parent().is_some_and(|dir| dir.join(MARKER).is_file())
    })
}

fn directory(key: &AgentKey) -> anyhow::Result<PathBuf> {
    Ok(native_ui::paths(key)?.socket.with_extension("shell"))
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ShellAgent {
    pub key: AgentKey,
    pub pid: u32,
}

/// Read only our bounded launch marker. Liveness/ancestry is checked against
/// the runtime's successful process snapshot, never inferred from a missing file.
pub(crate) fn launched(key: &AgentKey) -> anyhow::Result<Option<ShellAgent>> {
    let path = directory(key)?.join("active");
    let text = match fs::read_to_string(&path) {
        Ok(text) if text.len() <= 128 => text,
        Ok(_) => anyhow::bail!("oversized shell agent marker"),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    let mut fields = text.split_whitespace();
    let provider = fields.next().context("missing shell agent provider")?;
    anyhow::ensure!(
        PROVIDERS.contains(&provider),
        "unknown shell agent provider"
    );
    let pid = fields
        .next()
        .context("missing shell agent PID")?
        .parse::<u32>()?;
    anyhow::ensure!(
        pid > 1 && fields.next().is_none(),
        "invalid shell agent marker"
    );
    Ok(Some(ShellAgent {
        key: bridge_key(key, provider)?,
        pid,
    }))
}

pub(crate) fn snapshot_matches(agent: &ShellAgent, pid: u32) -> bool {
    if agent.key.agent_id != "codex" {
        return pid == agent.pid;
    }
    native_ui::paths(&agent.key)
        .ok()
        .and_then(|paths| fs::read_to_string(paths.extension.with_extension("pid")).ok())
        .and_then(|text| text.trim().parse::<u32>().ok())
        .is_some_and(|server| server == pid)
}

/// Add integration only to new local runtime launches. Existing daemon
/// attachments keep their original environment and processes unchanged. `pinned` is the
/// Instructions snapshot of the shell's session: every agent typed into it starts with it.
/// `cli` is the real `perch` binary: given one, the private shim directory (already first on
/// the PATH of everything launched here) gets a `perch` entry that runs it by absolute path.
pub(crate) fn prepare(
    key: &AgentKey,
    command: Vec<String>,
    pinned: Option<&crate::instructions::Pinned>,
    cli: Option<&Path>,
) -> anyhow::Result<Vec<String>> {
    prepare_with(
        key,
        command,
        &std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into()),
        pinned,
        cli,
    )
}

fn prepare_with(
    key: &AgentKey,
    command: Vec<String>,
    real_shell: &str,
    pinned: Option<&crate::instructions::Pinned>,
    cli: Option<&Path>,
) -> anyhow::Result<Vec<String>> {
    #[cfg(not(unix))]
    return Ok(command);
    #[cfg(unix)]
    {
        use std::os::unix::fs::{DirBuilderExt, MetadataExt, PermissionsExt};
        let dir = directory(key)?;
        if let Err(error) = fs::DirBuilder::new().mode(0o700).create(&dir) {
            if error.kind() != std::io::ErrorKind::AlreadyExists {
                return Err(error.into());
            }
        }
        let metadata = fs::symlink_metadata(&dir)?;
        anyhow::ensure!(
            metadata.is_dir()
                && !metadata.file_type().is_symlink()
                && metadata.uid() == unsafe { libc::geteuid() }
                && metadata.permissions().mode() & 0o077 == 0,
            "unsafe shell integration directory"
        );
        let bin = dir.join("bin");
        fs::create_dir_all(&bin)?;
        fs::set_permissions(&bin, fs::Permissions::from_mode(0o700))?;
        for provider in PROVIDERS {
            let bridge = bridge_key(key, provider)?;
            let paths = native_ui::prepare(&bridge, provider, false)?;
            // The Instructions file is the shell session's, shared by every shim in it.
            let instructions = match pinned.filter(|_| crate::instructions::supported(provider)) {
                Some(pin) => {
                    let file = native_ui::write_instructions_file(key, provider, pin)?;
                    crate::instructions::launch_args(provider, pin, &file)
                }
                None => Default::default(),
            };
            let args = match *provider {
                "codex" => {
                    // Root flags go before any subcommand the person types.
                    let mut command = vec!["__PERCH_EXECUTABLE__".to_string()];
                    command.extend(instructions.cli);
                    native_ui::codex::launch(&bridge, command, &instructions.codex_server)?
                }
                "opencode" => {
                    native_ui::opencode::launch(&bridge, vec!["__PERCH_EXECUTABLE__".into()])?
                }
                _ => {
                    let mut args = vec![
                        "__PERCH_EXECUTABLE__".to_string(),
                        if *provider == "claude" {
                            "--settings"
                        } else {
                            "--extension"
                        }
                        .into(),
                        paths.extension.to_string_lossy().into_owned(),
                    ];
                    args.extend(instructions.cli);
                    args
                }
            };
            let exec = args
                .iter()
                .map(|arg| {
                    if arg == "__PERCH_EXECUTABLE__" {
                        "\"$perch_executable\"".into()
                    } else {
                        quote(arg)
                    }
                })
                .collect::<Vec<_>>()
                .join(" ");
            // A single foreground agent per pane owns native status. A second
            // background launch must not steal its endpoint or kill its process.
            // ponytail: aliases/functions/absolute executable paths can bypass
            // PATH shims; a provider-side auto-loaded plugin is the upgrade path.
            let script = format!(
                r#"#!/bin/sh
perch_bin={bin}
perch_path=; perch_separator=; perch_rest=$PATH
while :; do
  case "$perch_rest" in
    *:*) perch_entry=${{perch_rest%%:*}}; perch_rest=${{perch_rest#*:}}; perch_more=1;;
    *) perch_entry=$perch_rest; perch_more=0;;
  esac
  if [ "$perch_entry" != "$perch_bin" ]; then
    perch_path="$perch_path$perch_separator$perch_entry"; perch_separator=:
  fi
  [ "$perch_more" = 1 ] || break
done
PATH=$perch_path; export PATH
unset -f {provider} 2>/dev/null || :
perch_executable=$(command -v {provider}) || exit 127
for perch_arg do
  case "$perch_arg" in
    --help|--version|-h|-v|--print|-p|--mode|--mode=*|--remote|--remote=*|--no-extensions|-ne|--pure|--mini) exec "$perch_executable" "$@";;
  esac
  case {provider}:"$perch_arg" in
    codex:exec|codex:app-server|codex:login|codex:logout|codex:mcp*|codex:review|codex:debug|codex:completion|codex:apply) exec "$perch_executable" "$@";;
  esac
done
case {provider}:"${{1-}}" in
  codex:exec|codex:app-server|codex:login|codex:logout|codex:mcp*|codex:review|codex:debug|codex:completion|codex:apply|claude:mcp|claude:auth|claude:install|claude:update|claude:doctor|pi:install|pi:remove|pi:update|pi:list|pi:config|omp:install|omp:remove|omp:update|omp:list|omp:config|opencode:run|opencode:serve|opencode:web|opencode:auth|opencode:models|opencode:mcp|opencode:acp|opencode:debug|opencode:session|opencode:stats|opencode:export|opencode:import|opencode:upgrade|opencode:uninstall|opencode:attach) exec "$perch_executable" "$@";;
esac
perch_active={active}
if [ -f "$perch_active" ]; then
  read -r perch_provider perch_pid < "$perch_active"
  case "$perch_pid" in ''|*[!0-9]*) exec "$perch_executable" "$@";; esac
  if kill -0 "$perch_pid" 2>/dev/null; then exec "$perch_executable" "$@"; fi
fi
# This endpoint belongs to a completed invocation of this private shim.
rm -f -- {socket}
umask 077
printf '%s %s\n' {provider} "$$" > "$perch_active.$$" && mv -f -- "$perch_active.$$" "$perch_active" || exec "$perch_executable" "$@"
PATH="$perch_bin:$PATH"; export PATH
# A shell that holds a launcher has this agent issued an identity of its own, then becomes it.
if [ -n "${{PERCH_LAUNCH-}}" ] && [ -x {cli} ]; then
  exec {cli} __launch {provider} {exec} "$@"
fi
exec {exec} "$@"
"#,
                bin = quoted(&bin),
                active = quoted(&dir.join("active")),
                socket = quoted(&paths.socket),
                // Absent, the test above is never true: `[ -x '' ]` fails.
                cli = quote(
                    &cli.map(|cli| cli.to_string_lossy().into_owned())
                        .unwrap_or_default()
                )
            );
            write(&bin.join(provider), &script, 0o700)?;
        }
        // Not a provider shim: no PATH search, no recursion guard. The binary is named by
        // absolute path, so this entry can never run itself. Without a binary any entry from
        // an earlier launch is removed rather than left pointing at nothing.
        match cli {
            Some(cli) => write(
                &bin.join("perch"),
                &format!("#!/bin/sh\nexec {} \"$@\"\n", quoted(cli)),
                0o700,
            )?,
            None => {
                let _ = fs::remove_file(bin.join("perch"));
            }
        }
        let shell = dir.join("shell");
        // zsh sources each original startup file with the user's ZDOTDIR, then
        // restores the private shim directory for the next startup stage.
        for file in [".zshenv", ".zprofile", ".zshrc", ".zlogin"] {
            let source = format!(
                r#"ZDOTDIR=${{PERCH_USER_ZDOTDIR:-$HOME}}
[[ -e "$ZDOTDIR/{MARKER}" ]] && ZDOTDIR=$HOME
[[ ${{HISTFILE-}} == {dir}/.zsh_history ]] && HISTFILE=$ZDOTDIR/.zsh_history
[[ -r "$ZDOTDIR/{file}" ]] && source "$ZDOTDIR/{file}"
PERCH_USER_ZDOTDIR=$ZDOTDIR
ZDOTDIR={dir}
function __perch_path() {{ typeset -gU path; path=({bin} $path); }}
(( ${{precmd_functions[(Ie)__perch_path]}} )) || precmd_functions+=(__perch_path)
__perch_path
"#,
                dir = quoted(&dir),
                bin = quoted(&bin)
            );
            write(&dir.join(file), &source, 0o600)?;
        }
        // Exported functions survive Bash's normal login startup, including
        // profiles that replace PATH. Keep -l, profile selection and logout
        // semantics native instead of emulating them with --rcfile.
        let mut bash = String::new();
        for provider in PROVIDERS {
            bash.push_str(&format!(
                "{provider}() {{ {} \"$@\"; }}\nexport -f {provider}\n",
                quoted(&bin.join(provider))
            ));
        }
        bash.push_str(&format!("exec {} \"$@\"\n", quote(real_shell)));
        write(&dir.join("bash-launch"), &bash, 0o600)?;
        let shell_script = format!(
            r#"#!/bin/sh
export PATH={bin}:"$PATH"
case {name} in
  zsh) if [ "${{ZDOTDIR-}}" != {dir} ] && [ ! -e "${{ZDOTDIR-}}/{MARKER}" ]; then export PERCH_USER_ZDOTDIR="${{ZDOTDIR:-$HOME}}"; fi; export ZDOTDIR={dir};;
  bash) exec {real} --noprofile --norc {bash} "$@";;
  fish) exec {real} --init-command {fish} "$@";;
esac
exec {real} "$@"
"#,
            bin = quoted(&bin),
            name = quote(
                Path::new(&real_shell)
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or_default()
            ),
            dir = quoted(&dir),
            real = quote(real_shell),
            bash = quoted(&dir.join("bash-launch")),
            fish = quote(&format!("set -gx PATH {} $PATH", quoted(&bin)))
        );
        write(&shell, &shell_script, 0o700)?;
        let mut wrapped = vec![
            "/bin/sh".into(),
            "-c".into(),
            "export PERCH_SHELL=$1; export PATH=$2:$PATH; shift 2; exec \"$@\"".into(),
            "perch-shell-integration".into(),
            shell.to_string_lossy().into_owned(),
            bin.to_string_lossy().into_owned(),
        ];
        wrapped.extend(command);
        Ok(wrapped)
    }
}

#[cfg(unix)]
fn write(path: &Path, source: &str, mode: u32) -> anyhow::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let temporary = path.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()));
    fs::write(&temporary, source)?;
    fs::set_permissions(&temporary, fs::Permissions::from_mode(mode))?;
    fs::rename(temporary, path)?;
    Ok(())
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::process::Command;

    /// A Perch shell started from another Perch shell inherits its generated ZDOTDIR. That must not become
    /// "the user's" ZDOTDIR, or the generated startup files source themselves until zsh gives up.
    #[test]
    fn zsh_started_inside_another_perch_shell_does_not_recurse() {
        const ZSH: &str = "/bin/zsh";
        if !Path::new(ZSH).exists() {
            eprintln!(
                "SKIPPED: {ZSH} is not installed, so the zsh startup chain was not exercised"
            );
            return;
        }
        let root = std::env::temp_dir().join(format!("perch-zdot-{}", uuid::Uuid::new_v4()));
        // The user's own config lives in a custom ZDOTDIR; $HOME holds decoys that must never run.
        let (home, user) = (root.join("home"), root.join("user"));
        fs::create_dir_all(&home).unwrap();
        fs::create_dir_all(&user).unwrap();
        for file in [".zshenv", ".zprofile", ".zshrc", ".zlogin"] {
            fs::write(user.join(file), format!("export RAN=\"$RAN {file}\"\n")).unwrap();
            fs::write(home.join(file), "export DECOY=1\n").unwrap();
        }
        let new_key =
            || AgentKey::new("zdot", uuid::Uuid::new_v4().to_string(), "terminal").unwrap();
        let inner = new_key();
        prepare_with(&inner, vec!["true".into()], ZSH, None, None).unwrap();
        let run = |outer: &AgentKey, flags: &str, inherited_user: Option<&Path>| {
            let mut command = Command::new(directory(&inner).unwrap().join("shell"));
            command
                .args([flags, "print -r -- \"ran=$RAN decoy=$DECOY\""])
                .env_remove("RAN")
                .env("HOME", &home)
                .env("ZDOTDIR", directory(outer).unwrap())
                .env_remove("PERCH_USER_ZDOTDIR");
            if let Some(user) = inherited_user {
                command.env("PERCH_USER_ZDOTDIR", user);
            }
            let output = command.output().unwrap();
            String::from_utf8_lossy(&[output.stdout, output.stderr].concat()).into_owned()
        };
        for legacy in [false, true] {
            let outer = new_key();
            prepare_with(&outer, vec!["true".into()], ZSH, None, None).unwrap();
            if legacy {
                // Wrappers from before the fix: same files, but their startup files had no guard.
                for file in [".zshenv", ".zprofile", ".zshrc", ".zlogin"] {
                    let text = fs::read_to_string(directory(&outer).unwrap().join(file)).unwrap();
                    let old = text
                        .lines()
                        .filter(|line| !line.contains(MARKER))
                        .collect::<Vec<_>>()
                        .join("\n");
                    fs::write(directory(&outer).unwrap().join(file), old + "\n").unwrap();
                }
            }
            for (flags, expected) in [
                ("-ic", &[".zshenv", ".zshrc"][..]),
                ("-lic", &[".zshenv", ".zprofile", ".zshrc", ".zlogin"][..]),
            ] {
                let text = run(&outer, flags, Some(&user));
                assert!(
                    !text.contains("recursion"),
                    "legacy={legacy} {flags}: {text}"
                );
                assert!(
                    text.contains("decoy=\n") || text.ends_with("decoy="),
                    "HOME config ran instead of the user's: {text}"
                );
                assert!(
                    text.contains(&format!("ran= {}", expected.join(" "))),
                    "legacy={legacy} {flags}: the user's own startup must run in order: {text}"
                );
            }
            // A wrapper that lost its remembered user directory falls back to $HOME, not to itself.
            let text = run(&outer, "-lic", None);
            assert!(
                !text.contains("recursion"),
                "legacy={legacy} no PERCH_USER_ZDOTDIR: {text}"
            );
        }
        let _ = fs::remove_dir_all(&root);
    }

    /// macOS's /etc/zshrc sets `HISTFILE=${ZDOTDIR:-$HOME}/.zsh_history` while ZDOTDIR is still Perch's private
    /// directory, so the user's history silently moved there. Only that default is repaired; a path the user's
    /// own config chooses stays.
    #[test]
    fn zsh_history_stays_in_the_users_directory() {
        const ZSH: &str = "/bin/zsh";
        if !Path::new(ZSH).exists() {
            eprintln!("SKIPPED: {ZSH} is not installed");
            return;
        }
        let root = std::env::temp_dir().join(format!("perch-hist-{}", uuid::Uuid::new_v4()));
        let (home, user, custom) = (
            root.join("home"),
            root.join("user"),
            root.join("custom-history"),
        );
        for dir in [&home, &user] {
            fs::create_dir_all(dir).unwrap();
        }
        let key = AgentKey::new("hist", uuid::Uuid::new_v4().to_string(), "terminal").unwrap();
        prepare_with(&key, vec!["true".into()], ZSH, None, None).unwrap();
        let histfile = |zshrc: &str, zdotdir: &Path| {
            fs::write(user.join(".zshrc"), zshrc).unwrap();
            let output = Command::new(directory(&key).unwrap().join("shell"))
                .args(["-ic", "print -r -- \"histfile=$HISTFILE\""])
                .env("HOME", &home)
                .env_remove("ZDOTDIR")
                .env("ZDOTDIR", zdotdir)
                .env_remove("PERCH_USER_ZDOTDIR")
                .output()
                .unwrap();
            String::from_utf8_lossy(&output.stdout).into_owned()
        };
        // The user's own ZDOTDIR, and no HISTFILE in their config: the system default must land there.
        let text = histfile("", &user);
        let system_sets_it =
            fs::read_to_string("/etc/zshrc").is_ok_and(|rc| rc.contains("HISTFILE="));
        assert!(
            !text.contains(".shell/"),
            "history moved into Perch's private directory: {text}"
        );
        if system_sets_it {
            assert!(
                text.contains(&format!("histfile={}/.zsh_history", user.display())),
                "{text}"
            );
        }
        // A history path the user's config picks is theirs.
        let text = histfile(&format!("HISTFILE={}\n", custom.display()), &user);
        assert!(
            text.contains(&format!("histfile={}", custom.display())),
            "{text}"
        );
        let _ = fs::remove_dir_all(&root);
    }

    /// Perch's shell and a plain terminal (iTerm) are the same user's shells: a command typed in one is the
    /// latest history entry of the other, in both directions.
    #[test]
    fn perch_and_plain_zsh_share_one_history() {
        const ZSH: &str = "/bin/zsh";
        if !Path::new(ZSH).exists() {
            eprintln!("SKIPPED: {ZSH} is not installed");
            return;
        }
        let root = std::env::temp_dir().join(format!("perch-share-{}", uuid::Uuid::new_v4()));
        let (home, user) = (root.join("home"), root.join("user"));
        fs::create_dir_all(&home).unwrap();
        fs::create_dir_all(&user).unwrap();
        // Size options only: where history lives is left to the system default, which is what is under test.
        fs::write(user.join(".zshrc"), "HISTSIZE=100; SAVEHIST=100\n").unwrap();
        fs::write(user.join(".zsh_history"), "echo from-iterm\n").unwrap();
        let key = AgentKey::new("share", uuid::Uuid::new_v4().to_string(), "terminal").unwrap();
        prepare_with(&key, vec!["true".into()], ZSH, None, None).unwrap();
        let run = |program: PathBuf, script: &str| {
            let output = Command::new(program)
                .args(["-ic", script])
                .env("HOME", &home)
                .env("ZDOTDIR", &user)
                .env_remove("PERCH_USER_ZDOTDIR")
                .env_remove("HISTFILE")
                .output()
                .unwrap();
            String::from_utf8_lossy(&output.stdout).into_owned()
        };
        let perch = directory(&key).unwrap().join("shell");
        // Perch's shell sees what iTerm saved, and adds `ssh ABC` (saved when the shell exits).
        let seen = run(perch.clone(), "fc -R; fc -l -1; print -s -- 'ssh ABC'");
        assert!(
            seen.contains("echo from-iterm"),
            "Perch's shell lost the user's history: {seen}"
        );
        // A plain shell started afterwards has it as the newest entry.
        let newest = run(PathBuf::from(ZSH), "fc -R; fc -l -1");
        assert!(
            newest.contains("ssh ABC"),
            "plain zsh did not see Perch's command: {newest}"
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn bridge_pty_is_the_terminal_tab_not_a_derived_key() {
        let tab = AgentKey::new("w", "s1", "terminal").unwrap();
        let bridge = bridge_key(&tab, "pi").unwrap();
        assert_eq!(pty_key(&bridge), crate::agent_runtime::terminal_key(&tab));
        let picker = AgentKey::new("w", "s1", "pi").unwrap();
        assert_eq!(
            pty_key(&picker),
            crate::agent_runtime::terminal_key(&picker)
        );
    }

    /// A tab started as Claude whose CLI exited, with `pi` typed into its shell: the agent's terminal is
    /// the Claude tab's, not a `terminal` one that does not exist.
    #[test]
    fn a_shell_agent_in_a_picker_tab_reads_that_tabs_terminal() {
        let tab = AgentKey::new("w2", "s2", "claude").unwrap();
        let bridge = bridge_key(&tab, "pi").unwrap();
        assert_eq!(pty_key(&bridge), crate::agent_runtime::terminal_key(&tab));
    }

    #[test]
    fn shell_agents_receive_native_adapters_without_rewriting_arguments() {
        let key =
            AgentKey::new("shell-check", uuid::Uuid::new_v4().to_string(), "terminal").unwrap();
        let dir = directory(&key).unwrap();
        let command = prepare(
            &key,
            vec![
                "/bin/sh".into(),
                "-c".into(),
                "exec pi \"$@\"".into(),
                "check".into(),
                "a b".into(),
                "literal '$()".into(),
            ],
            None,
            None,
        )
        .unwrap();
        let fake = dir.join("real");
        fs::create_dir(&fake).unwrap();
        for provider in PROVIDERS {
            write(
                &fake.join(provider),
                "#!/bin/sh\nprintf '%s\\n' \"$@\"\n",
                0o700,
            )
            .unwrap();
            assert!(Command::new("/bin/sh")
                .args(["-n", dir.join("bin").join(provider).to_str().unwrap()])
                .status()
                .unwrap()
                .success());
        }
        assert!(Command::new("/bin/bash")
            .args(["-n", dir.join("bash-launch").to_str().unwrap()])
            .status()
            .unwrap()
            .success());
        let path = format!("{}:/usr/bin:/bin", fake.display());
        let run = |argv: &[String]| {
            let output = Command::new(&argv[0])
                .args(&argv[1..])
                .env("PATH", &path)
                .output()
                .unwrap();
            assert!(
                output.status.success(),
                "{}",
                String::from_utf8_lossy(&output.stderr)
            );
            String::from_utf8(output.stdout).unwrap()
        };
        let pi_paths = native_ui::paths(&bridge_key(&key, "pi").unwrap()).unwrap();
        assert_eq!(
            run(&command),
            format!(
                "--extension\n{}\na b\nliteral '$()\n",
                pi_paths.extension.display()
            )
        );
        let agent = launched(&key).unwrap().unwrap();
        assert_eq!(agent.key.agent_id, "pi");
        assert!(snapshot_matches(&agent, agent.pid));
        assert!(!snapshot_matches(&agent, agent.pid + 1));
        for provider in ["claude", "omp", "opencode"] {
            let command = prepare(
                &key,
                vec![
                    "/bin/sh".into(),
                    "-c".into(),
                    format!("exec {provider} \"$@\""),
                    "check".into(),
                    "a b".into(),
                ],
                None,
                None,
            )
            .unwrap();
            let output = run(&command);
            assert!(output.ends_with("a b\n"), "{provider}: {output}");
            if provider == "claude" {
                assert!(output.starts_with("--settings\n"));
            }
            if provider == "omp" {
                assert!(output.starts_with("--extension\n"));
            }
            if provider == "opencode" {
                assert_eq!(output, "a b\n");
            }
        }
        // Codex's native launcher must start the existing adapter (not a
        // separate Perch turn loop) and preserve the TUI's literal argv.
        write(&fake.join("codex"), "#!/bin/sh\nif [ \"$1\" = app-server ]; then exec sleep 10; fi\nprintf '%s\\n' \"$@\"\n", 0o700).unwrap();
        let codex = prepare(
            &key,
            vec![
                "/bin/sh".into(),
                "-c".into(),
                "exec codex --model 'my model' 'literal $()'".into(),
            ],
            None,
            None,
        )
        .unwrap();
        let codex_paths = native_ui::paths(&bridge_key(&key, "codex").unwrap()).unwrap();
        let socket = codex_paths.socket.clone();
        let pid_file = codex_paths.extension.with_extension("pid");
        let listener = std::thread::spawn(move || {
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
            while !pid_file.exists() && std::time::Instant::now() < deadline {
                std::thread::sleep(std::time::Duration::from_millis(10));
            }
            assert!(pid_file.exists());
            let _listener = std::os::unix::net::UnixListener::bind(&socket).unwrap();
            while pid_file.exists() && std::time::Instant::now() < deadline {
                std::thread::sleep(std::time::Duration::from_millis(10));
            }
            fs::remove_file(socket).unwrap();
        });
        assert_eq!(
            run(&codex),
            format!(
                "--remote\nunix://{}\n--model\nmy model\nliteral $()\n",
                codex_paths.socket.display()
            )
        );
        listener.join().unwrap();
        for (provider, args) in [
            ("pi", "--mode rpc"),
            ("claude", "--print"),
            ("codex", "exec"),
            ("opencode", "run"),
            ("omp", "--help"),
        ] {
            let command = prepare(
                &key,
                vec![
                    "/bin/sh".into(),
                    "-c".into(),
                    format!("exec {provider} {args} 'a b'"),
                ],
                None,
                None,
            )
            .unwrap();
            assert_eq!(run(&command), format!("{}\na b\n", args.replace(' ', "\n")));
        }
        // The real shell's configuration can prepend an agent installation;
        // the integration is installed *after* that configuration runs.
        if Path::new("/bin/zsh").exists() {
            let user = dir.join("user-zdotdir");
            fs::create_dir(&user).unwrap();
            fs::write(
                user.join(".zshrc"),
                format!(
                    "export PATH={}:$PATH\nexport PERCH_RC_LOADED=yes\n",
                    quoted(&fake)
                ),
            )
            .unwrap();
            let output = Command::new(dir.join("shell"))
                .args([
                    "-i",
                    "-c",
                    "[ \"$PERCH_RC_LOADED\" = yes ] && pi 'from zsh'",
                ])
                .env("SHELL", "/bin/zsh")
                .env("ZDOTDIR", user)
                .env("PATH", &path)
                .output()
                .unwrap();
            // The generated shell follows the parent's SHELL, not this child's
            // environment. Check zsh startup files directly as well.
            let output = if std::env::var("SHELL").as_deref() == Ok("/bin/zsh") {
                output
            } else {
                Command::new("/bin/zsh")
                    .args([
                        "-i",
                        "-c",
                        "[ \"$PERCH_RC_LOADED\" = yes ] && pi 'from zsh'",
                    ])
                    .env("ZDOTDIR", &dir)
                    .env("PERCH_USER_ZDOTDIR", dir.join("user-zdotdir"))
                    .env("PATH", &path)
                    .output()
                    .unwrap()
            };
            assert!(
                output.status.success(),
                "{}",
                String::from_utf8_lossy(&output.stderr)
            );
            assert!(String::from_utf8_lossy(&output.stdout).starts_with("--extension\n"));
        }
        fs::write(dir.join("active"), "pi 0\n").unwrap();
        assert!(launched(&key).is_err());
        fs::remove_dir_all(&dir).unwrap();
        for provider in PROVIDERS {
            let paths = native_ui::paths(&bridge_key(&key, provider).unwrap()).unwrap();
            let _ = fs::remove_file(&paths.extension);
            let _ = fs::remove_file(paths.extension.with_extension("tui.json"));
        }
    }

    /// The shim directory is first on the PATH of everything launched in the shell, so a
    /// `perch` entry there makes the command available to every provider, typed or picked. It
    /// runs the real binary by absolute path (never by searching, so it cannot run itself), and
    /// is gone again when a later launch has no binary.
    #[test]
    fn the_perch_command_is_on_the_shim_path_only_with_a_real_binary() {
        let key =
            AgentKey::new("shell-perch", uuid::Uuid::new_v4().to_string(), "terminal").unwrap();
        let dir = directory(&key).unwrap();
        let real = std::env::temp_dir().join(format!("perch-real-cli-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&real).unwrap();
        let cli = real.join("perch real");
        write(&cli, "#!/bin/sh\nprintf 'real perch:%s' \"$*\"\n", 0o700).unwrap();
        // The wrapper puts the shim directory on PATH; `command -v` must find our entry first,
        // ahead of a decoy `perch` further along.
        let decoy = real.join("decoy");
        fs::create_dir_all(&decoy).unwrap();
        write(&decoy.join("perch"), "#!/bin/sh\nprintf decoy\n", 0o700).unwrap();
        let ask = |script: &str, cli: Option<&Path>| {
            let command = prepare(
                &key,
                vec!["/bin/sh".into(), "-c".into(), script.into()],
                None,
                cli,
            )
            .unwrap();
            let output = Command::new(&command[0])
                .args(&command[1..])
                .env("PATH", format!("{}:/usr/bin:/bin", decoy.display()))
                .output()
                .unwrap();
            String::from_utf8(output.stdout).unwrap()
        };
        assert_eq!(
            ask("perch whoami --json", Some(&cli)),
            "real perch:whoami --json"
        );
        assert_eq!(
            fs::read_to_string(dir.join("bin/perch")).unwrap(),
            format!("#!/bin/sh\nexec '{}' \"$@\"\n", cli.display())
        );
        // No binary on a later launch: the old entry is removed and the decoy shows through.
        assert_eq!(ask("perch", None), "decoy");
        assert!(!dir.join("bin/perch").exists());
        let _ = fs::remove_dir_all(&real);
        let _ = fs::remove_dir_all(&dir);
    }

    /// A shell that holds a launcher (`PERCH_LAUNCH`) has each agent typed into it started through
    /// `perch __launch`, which names the provider and the real executable; one without runs the
    /// agent as before. Without a CLI beside the core the shim never reaches for it.
    #[test]
    fn a_typed_agent_is_started_through_the_launch_exchange_only_when_the_shell_holds_a_launcher() {
        let key =
            AgentKey::new("shell-launch", uuid::Uuid::new_v4().to_string(), "terminal").unwrap();
        let root = std::env::temp_dir().join(format!("perch-launch-{}", uuid::Uuid::new_v4()));
        let bin = root.join("bin");
        fs::create_dir_all(&bin).unwrap();
        write(
            &bin.join("pi"),
            "#!/bin/sh\nprintf 'plain pi:%s' \"$*\"\n",
            0o700,
        )
        .unwrap();
        let cli = root.join("perch-cli");
        write(&cli, "#!/bin/sh\nprintf 'launch:%s' \"$*\"\n", 0o700).unwrap();
        let ask = |cli: Option<&Path>, launcher: bool| {
            let command = prepare(
                &key,
                vec!["/bin/sh".into(), "-c".into(), "pi one two".into()],
                None,
                cli,
            )
            .unwrap();
            let mut run = Command::new(&command[0]);
            run.args(&command[1..])
                .env("PATH", format!("{}:/usr/bin:/bin", bin.display()))
                .env_remove("PERCH_LAUNCH");
            if launcher {
                run.env("PERCH_LAUNCH", "perch_agent_launch_x");
            }
            String::from_utf8(run.output().unwrap().stdout).unwrap()
        };
        let launched = ask(Some(&cli), true);
        assert!(
            launched.starts_with(&format!("launch:__launch pi {}", bin.join("pi").display())),
            "{launched}"
        );
        assert!(launched.ends_with(" one two"), "{launched}");
        assert_eq!(
            ask(Some(&cli), false),
            "plain pi:--extension".to_string() + &launched_tail(&key) + " one two"
        );
        assert!(
            ask(None, true).starts_with("plain pi:"),
            "no CLI, no exchange"
        );
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(directory(&key).unwrap());
    }

    fn launched_tail(key: &AgentKey) -> String {
        let bridge = bridge_key(key, "pi").unwrap();
        format!(
            " {}",
            native_ui::paths(&bridge).unwrap().extension.display()
        )
    }

    /// An agent typed into a shell starts with that shell session's pinned Instructions, ahead
    /// of the arguments the person typed, which stay untouched.
    #[test]
    fn typed_agents_start_with_their_sessions_instructions() {
        use crate::instructions::{compose, Instructions, Source};
        let key =
            AgentKey::new("shell-instr", uuid::Uuid::new_v4().to_string(), "terminal").unwrap();
        let dir = directory(&key).unwrap();
        let folder = std::env::temp_dir()
            .to_string_lossy()
            .trim_end_matches('/')
            .to_string();
        let pin = compose(&[(
            Source {
                scope: "project".into(),
                id: "p".into(),
                revision: 1,
            },
            Instructions {
                text: "Typed-agent marker".into(),
                folders: vec![folder.clone()],
            },
        )])
        .unwrap();
        let ask = |provider: &str| {
            prepare(
                &key,
                vec![
                    "/bin/sh".into(),
                    "-c".into(),
                    format!("exec {provider} \"$@\""),
                    "check".into(),
                    "a b".into(),
                ],
                Some(&pin),
                None,
            )
            .unwrap()
        };
        let command = ask("claude");
        let fake = dir.join("real");
        fs::create_dir(&fake).unwrap();
        for provider in PROVIDERS {
            write(
                &fake.join(provider),
                "#!/bin/sh\nprintf '%s\\n' \"$@\"\n",
                0o700,
            )
            .unwrap();
        }
        let path = format!("{}:/usr/bin:/bin", fake.display());
        let run = |argv: &[String]| {
            let output = Command::new(&argv[0])
                .args(&argv[1..])
                .env("PATH", &path)
                .output()
                .unwrap();
            assert!(
                output.status.success(),
                "{}",
                String::from_utf8_lossy(&output.stderr)
            );
            String::from_utf8(output.stdout).unwrap()
        };
        let file = |provider: &str| {
            native_ui::paths(&key)
                .unwrap()
                .extension
                .with_extension(format!("instructions.{provider}.md"))
        };
        let claude_settings = native_ui::paths(&bridge_key(&key, "claude").unwrap())
            .unwrap()
            .extension;
        assert_eq!(
            run(&command),
            format!(
                "--settings\n{}\n--append-system-prompt-file\n{}\n--add-dir={folder}\na b\n",
                claude_settings.display(),
                file("claude").display()
            )
        );
        assert_eq!(
            fs::read_to_string(file("claude")).unwrap(),
            "Typed-agent marker"
        );
        let omp_extension = native_ui::paths(&bridge_key(&key, "omp").unwrap())
            .unwrap()
            .extension;
        assert_eq!(
            run(&ask("omp")),
            format!(
                "--extension\n{}\n--append-system-prompt={}\n--add-dir={folder}\na b\n",
                omp_extension.display(),
                file("omp").display()
            )
        );
        let pi_extension = native_ui::paths(&bridge_key(&key, "pi").unwrap())
            .unwrap()
            .extension;
        assert_eq!(
            run(&ask("pi")),
            format!(
                "--extension\n{}\n--append-system-prompt\n{}\na b\n",
                pi_extension.display(),
                file("pi").display()
            )
        );
        // Pi's file carries the folders as text, since it has no flag for them.
        assert!(fs::read_to_string(file("pi"))
            .unwrap()
            .contains(&format!("- {folder}")));
        // The Perch pointer rides in the same pin, for every provider that takes one, and a
        // shell whose session pinned nothing still gets it.
        for pinned in [
            crate::agent_identity::with_pointer(Some(&pin)),
            crate::agent_identity::with_pointer(None),
        ] {
            prepare(&key, vec!["true".into()], Some(&pinned), None).unwrap();
            for provider in ["claude", "omp", "pi"] {
                let text = fs::read_to_string(file(provider)).unwrap();
                assert!(
                    text.contains(crate::agent_identity::POINTER),
                    "{provider}: {text}"
                );
            }
            // Codex takes it as the app-server's developer instructions.
            let codex = fs::read_to_string(dir.join("bin/codex")).unwrap();
            assert!(codex.contains("perch guide"), "codex shim: {codex}");
        }
        // Put the shims back as the plain pin made them for the assertions that follow.
        ask("claude");
        // Codex: the instructions go to the app-server the shim's launcher starts (checked in
        // codex.rs against the launcher itself); here, the shim hands them over before the
        // typed arguments, and a person's own subcommand still comes last.
        let shim = fs::read_to_string(dir.join("bin").join("codex")).unwrap();
        let wanted = [
            "'2'".to_string(),
            "'-c'".to_string(),
            format!(
                "'developer_instructions=\"Typed-agent marker\\n\\nReference folders you may read:\\n- {folder}\"'"
            ),
        ];
        let at: Vec<_> = wanted.iter().map(|part| shim.find(part)).collect();
        assert!(
            at.iter().all(Option::is_some) && at.windows(2).all(|pair| pair[0] < pair[1]),
            "{shim}"
        );
        assert!(!shim.contains("--add-dir"), "{shim}");
        // No pin, no change: the earlier test's expectations hold for every provider.
        assert_eq!(
            prepare(&key, vec!["true".into()], None, None)
                .unwrap()
                .len(),
            prepare(&key, vec!["true".into()], Some(&pin), None)
                .unwrap()
                .len()
        );
        fs::remove_dir_all(&dir).unwrap();
        for provider in PROVIDERS {
            let paths = native_ui::paths(&bridge_key(&key, provider).unwrap()).unwrap();
            let _ = fs::remove_file(&paths.extension);
            let _ = fs::remove_file(file(provider));
        }
    }
}
