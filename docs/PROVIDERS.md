# Configured CLI providers

Perch loads additional CLI providers at startup from `~/.perch/providers.json`.
Claude Code, Codex, OMP, Pi, and OpenCode are built-in CLI choices, with
ordinary persistent shells available through terminal panes. An absent default
file is allowed; `--providers-path /path/to/providers.json` or the
`PERCH_PROVIDERS` environment variable selects an explicit file that must
exist. The command-line option takes precedence over the environment variable.
Restart the core after editing the file.

The file is a versioned JSON object. Start with
[the example manifest](examples/providers.json), replace its executable with
the absolute path to your CLI, and adjust its fixed arguments and environment.
Provider ids must be unique, including against `claude`, `codex`, `omp`,
`pi`, and `opencode`. Perch
validates the complete configuration before accepting clients; a malformed
batch fails startup with file context. Files are limited to 256 KiB and the
registry holds at most 128 providers, including the built-ins.

The CLI start panel displays the host's providers that support `cli` mode and
the `interactiveTerminal` capability. A missing executable remains listed as
unavailable with a reason. Loading a manifest does not execute its command.
The user chooses a provider and project before starting its process. Perch
persists that choice with the session, including before the first keystroke,
so reopening the session selects the same provider.

Launch recipes use an executable and separate `prefix_args`/`suffix_args`
tokens. They are passed as arguments, without shell expansion. Use absolute
executable paths when restricting `PATH`. `mode_overrides` can provide a
complete recipe for `cli` independently of the base recipe. `resume` accepts
`"Unsupported"`, `"Positional"`, or `{ "Flag": { "flag": "--resume" } }`;
only use a resume strategy your CLI actually supports. Optional
`resume_prefix_args` precede a supplied continuation identity. `prompt`
accepts `stdin`, `argument`, or `optionValue`. Custom providers currently run
through their interactive terminal; configuring a provider does not add a
native event/control connection or capture its native conversation id.
The required UI mode is a web view of the CLI-owned session. It must use that
CLI's history, tools, approvals, configuration, and input channel; Perch must
not replace them with a separate agent harness. The legacy Hosted runner is
still present and its migration is unfinished.

Environment rules apply inside the actual provider process, including when
tmux owns that process:

- `inherit: true` with an empty `allow` copies the parent environment.
- A nonempty `allow` copies only those named parent variables. With
  `inherit: false`, only explicitly allowed parent variables are copied.
- Perch adds terminal hints (`TERM`, `COLORTERM`, `TERM_PROGRAM`, and a default
  `LANG`), applies `set`, then applies `unset` last.
- Values are literal. Dollar signs, command substitutions, quotes, and
  newlines in values are not evaluated.

Non-default rules use a bounded private bootstrap file with mode `0600`,
which removes itself before replacing its process with the provider. Values
are not embedded in the wrapper process's command-line arguments. A cleanup
guard removes an unused bootstrap after a failed launch or runtime removal.
These environment rules require a Unix host. They change only a new process;
reattaching an existing process retains the environment it started with.

The current configuration path extends local CLI sessions. Existing remote
host transports retain their native provider behavior. Declarative status
detectors and resumability descriptions do not by themselves implement a
provider's structured events, conversation capture, or safe automatic
hibernation; those remain adapter responsibilities.

Validation uses `cargo test --workspace`, `npm test`, and `npm run build`.
After `cargo build -p perch-core`, the isolated browser fixture can be run
from `e2e` with
`npx playwright test --config=provider-config.config.ts --project=chromium`.
It loads two distinct fixture providers, exercises the real picker and
terminal input on desktop and phone layouts, and checks process identity,
environment isolation, and reload recovery without changing user settings.
