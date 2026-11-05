# Agent workspaces, Claude/Codex desktop features and CLI reach (2026-11-05)

Condensed research behind the "Projects, sub-sessions and orchestration" plan in
[ROADMAP](../ROADMAP.md). Web pages were mostly undated; "fetched" means read on
2026-11-05. Local checks used Claude Code 2.1.318 and codex-cli 0.166.0 on macOS.
This is a dated snapshot, not a requirement list.

## Verified locally

- Claude subagent transcripts: `~/.claude/projects/<project>/<session>/subagents/agent-<id>.jsonl`
  (lines carry `isSidechain: true`, `agentId`) plus `agent-<id>.meta.json` with keys
  `agentType, isBuiltIn, worktreePath, spawnedWithWorktree, worktreeBranch, description,
  toolUseId, spawnDepth, requestShape, requestNonInteractive, model, finished`.
  Undocumented format; treat as best-effort observation.
- `claude --help`: `--fork-session`, `--bg` + `claude agents/attach/logs/stop`, `-n/--name`,
  `-w/--worktree`, `--agents`, `--append-system-prompt[-file]`, `--add-dir`,
  `--remote-control`, `--from-pr`, `--forward-subagent-text` (print mode only).
- Orca source (gh, 2026-11-05): structured Claude chat launches through the Agent SDK in
  stream-json mode (`src/main/claude/structured/launch/claude-structured-launch-args.ts`
  owns `--print`, `--input-format`, `--permission-prompt-tool`, `--fork-session`,
  `--resume-session-at`, `--append-system-prompt-file`); Codex uses its app-server
  (`src/main/codex/app-server/`). Terminal-backed chat is the fallback for WSL/SSH.

## Claude Code (docs: code.claude.com/docs/en/{desktop,sub-agents,agent-teams,hooks,cross-session-messaging,agent-view,claude-projects,memory})

- Subagents: in-session workers that return a summary; `model: haiku` frontmatter or
  `CLAUDE_CODE_SUBAGENT_MODEL`. Hooks `SubagentStart` (`agent_id`, `agent_type`) and
  `SubagentStop` (`agent_transcript_path`, `last_assistant_message`).
- Agent teams: full teammate sessions that message each other and share a task list.
  Experimental (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`), interactive only, since v2.1.32
  (2026-02-05). Files `~/.claude/teams/<team>/{config.json,inboxes/*.json}`,
  `~/.claude/tasks/<team>/`; hooks `TeammateIdle`, `TaskCreated`, `TaskCompleted`.
  No documented external API to message, create or stop a teammate.
- Cross-session messaging (v2.1.224+): `ListAgents`/`SendMessage` over a per-session socket.
- Desktop Code tab: parallel sessions, worktree toggle, Tasks/subagent panes, side chats
  (`/btw`, never saved), plan/permission modes, diff pane. New Projects (beta): a
  coordinating conversation with cloud threads and an Overview (Waiting on you / Idle /
  Resolved); no CLI equivalent. Classic chat Projects: instructions + knowledge (hosted RAG).
- Terms (code.claude.com/docs/en/legal-and-compliance; support article 15036540, updated
  2026-10-07): end users may sign in to the unmodified binary with their own plan;
  developers may not offer Claude.ai login, route requests through users' plan credentials
  or handle their tokens, and "should use API key authentication" for SDK products. Agent
  SDK, `claude -p` and third-party app usage "still draw from your subscription limits";
  previously announced SDK changes were paused 2026-06-15, not withdrawn.

## Codex (developers.openai.com/codex/app-server, learn.chatgpt.com/docs/*)

- App-server JSON-RPC exposes threads, `thread/fork`, approvals
  (`item/*/requestApproval`), `turn/steer`, `review/start`, skills, MCP status. Subagent
  threads carry `parentThreadId` (PR #25113, merged 2026-06-01) and are hidden from
  `thread/list` unless their source kinds are requested. Hooks include
  `SubagentStart/Stop`. `codex fork <id>`, `codex review`, `codex queue`.
- Projects in the app are folders grouping threads; worktree mode, automations and the
  review pane are app-side. App-server is labelled experimental; no public statement on
  third-party commercial use was found.

## Peers

- Orca (onorca.dev docs, releases to v1.4.250, 2026-11-05): structured Chat UI per agent
  (queue cards, Steer, Stop, Rewind, `/compact`, slash/skill picker, `@file`, model/effort
  pills, context ring, inline diff cards, background-task strip, subagent child rows,
  send states Sending/Not sent/unconfirmed, move chat<->terminal). Orchestration CLI
  (experimental): Run, Task, Dispatch, Message, decision gates; `worker-start --agent
  --model --effort --worktree`, `send --type worker_done --outcome`, `check --wait`,
  `worker-read/stop/release`; heartbeats; group addresses.
- T3 Code (pingdotgg/t3code): Codex app-server and Claude Agent SDK; own event store;
  orchestration via an app MCP server (`delegate_task`, child threads on any provider).
- herdr: daemon-owned PTYs, idle/working/blocked/done rollups, TOML screen manifests with
  `agent explain`, `agent wait`. cmux: OSC 9/99/777 + hook notifications, unread jump,
  listening ports. MXterm Pro: MCP "Control Room", Dock badge, banner focuses pane.
  Nimbalyst: workstreams with a combined files-changed view. Zed: ACP external agents
  and terminal threads. DeepSeek Harness (`dsh`): plugin desktop preview with an ACP profile.
