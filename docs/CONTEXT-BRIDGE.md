# Context Bridge

Context Bridge brings an excerpt from a local nest into an existing agent's
conversation without manually reconstructing its location or copying between
surfaces. It is a CLI workflow, not an extension of Hosted chat.

## Use it

- **Editor:** select code and right-click → **Ask agent about selection…**.
  With no selection, the action captures the document. **Ask agent…** in the
  editor toolbar uses the same selection. Line numbers refer to the captured
  editor document, not necessarily disk.
- **Explorer:** right-click a file → **Ask agent about file…**. An unsaved
  draft in this view takes precedence over disk.
- **Git:** **Ask agent about diff…** captures a displayed file diff.
  Select a line (Shift-click for a range), then **Ask agent about lines…**
  for a focused excerpt with old/new line coordinates.
- **Terminal:** select output and right-click → **Ask agent about selection…**.
  In a mouse-reporting TUI, use the terminal's Shift-selection gesture.

The shared dialog shows the exact prepared text, its nest identity, and an
optional question. Opening, typing a question, refreshing, copying and cancelling
never send input, start an agent, save a file, or execute a command.

**Copy context** works without choosing an agent. If clipboard access is denied,
the read-only preview remains selectable. An already prepared packet can still
be copied while disconnected.

Choose an agent in the same nest, review the packet, then explicitly click
**Send to agent**. This starts a turn in that existing Claude CLI. **Open agent**
returns to its tab; the original file and unsaved draft remain open.

## Safety and limits

- Local nests only in v1 (`context.bridge.v1`). Remote workspaces are not
  guessed from paths and never fall back to a local workspace.
- Direct send currently supports **Claude only**. Other harnesses have Copy
  context until their native transport can prove it will not disturb an
  unsubmitted TUI draft. No arbitrary shell/terminal receives pasted input.
- The core rechecks durable workspace/host/provider identity, live runtime,
  native idle/nonblocked status, input authority, and Claude's actual PID and
  empty prompt before dispatch. It refuses another view's input lease rather
  than silently taking over. Any borrowed lease is released on failure as
  well as success. Preview never takes a lease.
- A rejected preflight creates no phantom user turn. A dispatched prompt uses
  the existing SQLite `prompt_operations` ledger (not an in-memory cache).
  Double-clicks/replayed IDs
  cannot dispatch it twice. Disconnects and unconfirmed deliveries are never
  retried automatically: inspect the CLI before making another send.
- Editor excerpts, terminal selections and Git diffs are **captured view
  snapshots**. The packet labels unsaved drafts and possibly outdated diffs;
  it does not claim they match current disk/Git state. It never saves a draft.
  Whole-file disk references are confined through FileService, re-read at
  Send, and rejected if their prepared digest changed.
- Excerpts are limited to 32 KiB, questions to 4 KiB, and prepared packets to
  48 KiB. Overlarge content is rejected with guidance to narrow the selection,
  never silently truncated. Control characters are refused; Markdown fences
  are longer than any backtick run in the excerpt.
- Review text before sharing: output and source files can contain secrets.
  Packets include the absolute nest path and workspace UUID, including when
  copied outside Perch. Common secret-file names get an additional warning. This is not a secret
  scanner. Only explicitly sent prompts enter the existing prompt history;
  merely prepared captures have no new persistence layer.

Claude's installed prompt-layout check is deliberately conservative. A new CLI
layout may become Copy-only until the check is updated. Native snapshot and
prompt checks are not a transaction with input from outside Perch; the bridge
uses the existing CLI transport rather than claiming a new exactly-once provider
protocol.

## Checks

```sh
cargo test -p perch-core
npm test
npm run build
cargo build -p perch-core
cd e2e && npx playwright test -c context-bridge.config.ts
```

The isolated headless Chromium/WebKit probe verifies all four entry points,
desktop/mobile layouts, an unsaved-draft Haiku roundtrip, stale-file and
cross-nest refusal, CLI draft preservation, lease cleanup, deduplication and
refusal after Claude exits back to its shell. It pins and checks Haiku before
the prompt, owns scratch settings/DB/hosts/perchd, and cleans up its processes.
