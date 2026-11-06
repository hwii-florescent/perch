# Agents started inside Terminal tabs

Status integration must follow the agent, not the launch picker. New local
Perch-managed terminal sessions install private command shims for every provider
with a native bridge: Claude, Codex, Pi, OMP and OpenCode. Typing those commands
uses the existing hooks/extensions/app-server adapters and projects their native
working/blocked/ready events into the terminal session's lifecycle and sidebar.
The shell remains the launch/resume/stop owner; a nested conversation never
replaces the shell's durable provider identity.

- No user dotfiles, authentication or provider settings are rewritten. The
  adapters are additive; native command arguments remain separate and literal.
  Headless/management commands bypass the interactive adapters.
- zsh sources the original startup files; Bash keeps its native login startup
  and inherits command functions; fish uses its native init-command option.
- Existing native events outrank titles and terminal output. Leaving an agent
  clears its authority so another provider or a shell cannot inherit stale
  working/idle evidence. Configured providers without a native bridge retain
  their marker/title detection, selected from the observed foreground provider.
- A quiet working agent stays working; the legacy 700 ms output debounce does
  not complete managed turns. Core restart reattaches existing shell runtimes,
  without launching replacement agents, even before a viewer opens each tab.
- Existing live shells keep their original environment. After upgrading core or
  desktop, open a **new Terminal tab** to load integration. Running agents are
  never restarted or reconfigured automatically.

## Limits

This is local managed-terminal integration, not injection into arbitrary
external terminals or remote SSH hosts. Auxiliary workspace shell panes are
still a separate runtime family. Absolute executable paths and custom shell
functions/aliases that bypass the shims can bypass integration. User options
that disable plugins/hooks, or OpenCode's explicit custom TUI configuration,
retain their native behavior rather than being silently overridden.

One agent invocation per terminal owns the native endpoint. Additional
concurrent background agents in that same terminal do not steal it. Providers
without native events or meaningful marker/title evidence cannot have verified
turn state merely from output volume, process liveness or silence.

## Chat view

In UI mode a Terminal tab shows the native chat while a shim-launched agent
runs in it (`SessionSummary.chatProviderId`, set only while that invocation is
live) and returns to the shell when it exits. The tab keeps owning the PTY,
leases and lifecycle (`server/native_ui.rs` `Target { key, bridge, shell }`);
the agent's bridge only supplies the transcript and prompt delivery, and
`pty_key` points its screen reads at the tab's PTY. Checked live for Pi and
Claude by `e2e/native-terminal.spec.ts`.

## Startup files

The generated zsh files must behave like a plain zsh: the user's history file
is the system default under the *user's* `ZDOTDIR` (macOS `/etc/zshrc` runs
while `ZDOTDIR` is still Perch's), and a Perch shell started inside another
Perch shell never mistakes the outer wrapper directory for the user's.
Covered by the `shell_integration` zsh tests, including a Perch shell and a
plain zsh sharing one history.

## Checks

```sh
cargo test -p perch-core --lib shell_integration
cargo build -p perch-core
node --experimental-strip-types e2e/shell-agent-status.check.mjs
```

The Rust check covers all five command shims, literal argv, management-command
bypass, the Codex launcher and zsh startup configuration. The isolated real-core
check uses deterministic Pi/OMP extension, Claude hook, OpenCode socket and
Aider-title fixtures; it checks working, needs-you, ready, quiet working, return
to the same shell and a later agent launch. No provider calls or paid turns.
These fixtures are not certification against every installed provider version.
