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

pub(crate) fn bridge_key(key: &AgentKey, provider: &str) -> anyhow::Result<AgentKey> {
    AgentKey::new(
        &key.workspace_id,
        format!("shell-{}", key.session_id),
        provider,
    )
    .map_err(Into::into)
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
/// attachments keep their original environment and processes unchanged.
pub(crate) fn prepare(key: &AgentKey, command: Vec<String>) -> anyhow::Result<Vec<String>> {
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
            let args = match *provider {
                "codex" => native_ui::codex::launch(&bridge, vec!["__PERCH_EXECUTABLE__".into()])?,
                "opencode" => {
                    native_ui::opencode::launch(&bridge, vec!["__PERCH_EXECUTABLE__".into()])?
                }
                _ => vec![
                    "__PERCH_EXECUTABLE__".into(),
                    if *provider == "claude" {
                        "--settings"
                    } else {
                        "--extension"
                    }
                    .into(),
                    paths.extension.to_string_lossy().into_owned(),
                ],
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
exec {exec} "$@"
"#,
                bin = quoted(&bin),
                active = quoted(&dir.join("active")),
                socket = quoted(&paths.socket)
            );
            write(&bin.join(provider), &script, 0o700)?;
        }
        let real_shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into());
        let shell = dir.join("shell");
        // zsh sources each original startup file with the user's ZDOTDIR, then
        // restores the private shim directory for the next startup stage.
        for file in [".zshenv", ".zprofile", ".zshrc", ".zlogin"] {
            let source = format!(
                r#"ZDOTDIR=${{PERCH_USER_ZDOTDIR:-$HOME}}
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
        bash.push_str(&format!("exec {} \"$@\"\n", quote(&real_shell)));
        write(&dir.join("bash-launch"), &bash, 0o600)?;
        let shell_script = format!(
            r#"#!/bin/sh
export PATH={bin}:"$PATH"
case {name} in
  zsh) if [ "${{ZDOTDIR-}}" != {dir} ]; then export PERCH_USER_ZDOTDIR="${{ZDOTDIR:-$HOME}}"; fi; export ZDOTDIR={dir};;
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
            real = quote(&real_shell),
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
}
