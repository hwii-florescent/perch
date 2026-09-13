# CLI agents and providers

Perch includes Orca's 36-entry CLI catalog, adapted under the MIT license.
See [third-party notices](../THIRD_PARTY_NOTICES.md) for the pinned source.
Settings → Agents separates installed agents from agents available to install.
Enable or disable launcher choices, choose a default, or open an agent's
official install/docs page. **Install opens instructions**; it does not run a
package manager. After installing a CLI, Refresh checks the selected host.
OpenCode is included and offered for installation when its binary is absent.

The sidebar and tab-bar new-session pickers, CLI start view, and command
palette use the host's installed, enabled agents. A launch starts the chosen
CLI in the workspace folder and keeps its process attached to the session.
The command palette also opens ordinary persistent terminals. Enabled/default
preferences live in the host's SQLite database, survive restarts, and update
other connected clients. Disabling a launcher does not stop existing sessions.

Catalog launch arguments follow Orca's defaults, including its automatic
permission flags where supplied. The command is shown beside each agent.
Claude Agent Teams uses Claude's native `--teammate-mode in-process` inside
Perch rather than Orca's application-specific pane wrapper. This catalog does
not install, authenticate, or assert runtime support for all 36 external tools;
it discovers and launches their own CLIs.

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
Provider ids must be unique, including against every built-in catalog id. Perch
validates the complete configuration before accepting clients; a malformed
batch fails startup with file context. Files are limited to 256 KiB and the
registry holds at most 128 providers, including the built-ins.

The CLI start panel displays installed, enabled providers that support `cli`
mode and the `interactiveTerminal` capability. Missing executables remain in
the available-to-install section of Agents. Detection and launch share the
same executable resolver, including catalog aliases and standard install
locations. Loading a manifest does not execute its command.
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

Claude Code, Pi, and OMP support the native structured UI connection on Unix
hosts. Start a CLI session, then switch its view to **UI**. The same CLI
process supplies its recent conversation, thinking, tool calls/results, model,
and running state. Pi/OMP use native prompt/abort APIs; Claude uses its own
terminal editor and native receipt hooks. Take/Release control uses the same
ownership lease as terminal input. A second browser can observe and take
over after release. Switching views or restarting Perch reconnects to the
existing tmux-owned CLI and its native session file.

The extension runs inside Pi/OMP via `--extension`, with a user-private
socket directory (0700), socket/file permissions (0600), a 192 KiB recent
transcript, 256 KiB frames, and bounded command queues. Hidden extension
messages stay hidden; image/audio payloads remain in the CLI. Prompt receipt
metadata is stored outside model context. Perch journals delivery before
writing and never automatically resends an uncertain prompt after disconnect.
A CLI started before the extension was introduced needs an explicit restart
to load it; Perch never silently replaces that process.

Claude loads additional hook settings through `--settings`. Private hook files
report the native PID, session, transcript, prompt acceptance, and turn state.
Perch reads at most 2 MiB of recent native JSONL, follows its conversation
branch, and publishes at most 128 messages / 192 KiB. Hidden metadata, image
payloads, and thinking signatures are excluded. Unchanged transcripts are not
rebuilt or broadcast on each poll. The native prompt must be visibly empty
before UI input; finish drafts and startup/approval dialogs in CLI view.
Perch never clears that editor to make room for a UI prompt. Input and cancel
also verify that the active tmux pane belongs to this native Claude process.
This guard supports the observed Claude TUI layout and rejects an unfamiliar
layout rather than guessing where input will go.

Git review packets can be sent to an open Claude/Pi/OMP session in the same workspace.
The destination is its native CLI owner. Release control in another browser
before sending; a Git view briefly borrows unowned input and releases it after
enqueueing. Retrying a frozen packet returns its existing delivery status and
never dispatches a second copy. An uncertain receipt stays unconfirmed.

This UI connection is not yet available for Codex, OpenCode, or
configured generic CLIs. UI attachments, model
selection, approval dialogs, and complete queue verification remain
unfinished. Use the CLI's controls for these operations in the meantime.

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

The native UI integration suite is
`cd e2e && npx playwright test --config=native-ui.config.ts`. It uses real
installed Claude/Pi/OMP CLIs and their existing authentication in temporary workspace
folders, with isolated Perch databases/configuration and headless Chromium
and WebKit. It sends real prompts, tests native continuation and core crash
recovery, and transfers control to a separate phone-sized browser.

`cd e2e && npx playwright test --config=native-review.config.ts` verifies
two-note review delivery from a separate phone browser into those same native
CLIs, ownership refusal, release/retry, and duplicate prevention in both engines.
