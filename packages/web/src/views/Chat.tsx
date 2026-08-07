import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { diffLines } from "diff";
import { usePerchStore, type ChatMessage, type ToolCallEntry } from "../store";
import { AGENTS } from "../models";
import { renderMarkdown } from "../markdown";
import { ModelChip } from "../components/ModelChip";
import { EffortChip } from "../components/EffortChip";
import { SlashPopover } from "../components/SlashPopover";
import { PlanCard } from "../components/PlanCard";
import { AttachmentBar } from "../components/AttachmentBar";
import { computeAnchoredPopoverStyle } from "../components/popoverPosition";
import {
  AGENT_SIGIL,
  activeSigilToken,
  applyCommand,
  filterCommands,
} from "../composerCommands";
import { uploadAttachment, type StagedAttachment } from "../attachments";
import { AgentCliTerminal } from "./AgentCliTerminal";
import { CliStartPanel } from "../components/CliStartPanel";
import { NoSessionPanel } from "../components/NoSessionPanel";
import type { AgentKind, CommandEntry } from "@perch/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format elapsed seconds as "12s" or "3m 26s". */
function fmtElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function truncate(s: string, n: number): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > n ? `${oneLine.slice(0, n - 1)}…` : oneLine;
}

/** One-line summary of a tool call's "key" input argument, shown next to the
 * tool name in its collapsed row. */
function summarizeToolInput(input: unknown): string | undefined {
  if (input == null) return undefined;
  if (typeof input === "string") return truncate(input, 90);
  if (typeof input !== "object") return String(input);
  const obj = input as Record<string, unknown>;
  const preferredKeys = ["file_path", "path", "command", "pattern", "query", "url", "description"];
  for (const key of preferredKeys) {
    const v = obj[key];
    if (typeof v === "string") return truncate(v, 90);
  }
  for (const v of Object.values(obj)) {
    if (typeof v === "string" && v.length > 0) return truncate(v, 90);
  }
  return undefined;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard API can be unavailable (permissions, non-secure context);
    // silently no-op rather than throwing into a render/event handler.
  }
}

// ---------------------------------------------------------------------------
// Inline diffs for Edit/Write-style tool calls (item 3)
// ---------------------------------------------------------------------------

interface DiffLineOut {
  type: "add" | "remove" | "context";
  text: string;
}

interface EditDiffInfo {
  path: string;
  added: number;
  removed: number;
  lines: DiffLineOut[];
}

const MAX_DIFF_LINES = 400;

/** Turns a `diff` package `diffLines()` result into flat +/-/context lines,
 * counting added/removed lines as we go. */
function linesFromDiffLines(oldStr: string, newStr: string): { lines: DiffLineOut[]; added: number; removed: number } {
  const parts = diffLines(oldStr, newStr);
  const lines: DiffLineOut[] = [];
  let added = 0;
  let removed = 0;
  for (const part of parts) {
    const type: DiffLineOut["type"] = part.added ? "add" : part.removed ? "remove" : "context";
    const chunk = part.value.endsWith("\n") ? part.value.slice(0, -1) : part.value;
    if (chunk.length === 0) continue;
    for (const line of chunk.split("\n")) {
      lines.push({ type, text: line });
      if (type === "add") added += 1;
      if (type === "remove") removed += 1;
    }
    if (lines.length > MAX_DIFF_LINES) break;
  }
  return { lines: lines.slice(0, MAX_DIFF_LINES), added, removed };
}

/** Parses a Codex-style unified patch string (raw `+`/`-` lines, `+++`/`---`
 * headers) into the same flat line shape, for tool shapes that hand back a
 * ready-made patch instead of old/new strings. */
function linesFromPatch(patch: string): { lines: DiffLineOut[]; added: number; removed: number } {
  const lines: DiffLineOut[] = [];
  let added = 0;
  let removed = 0;
  for (const raw of patch.split("\n")) {
    if (raw.startsWith("+++") || raw.startsWith("---") || raw.startsWith("@@") || raw.startsWith("diff ") || raw.startsWith("index ")) {
      continue;
    }
    if (raw.startsWith("+")) {
      lines.push({ type: "add", text: raw.slice(1) });
      added += 1;
    } else if (raw.startsWith("-")) {
      lines.push({ type: "remove", text: raw.slice(1) });
      removed += 1;
    } else {
      lines.push({ type: "context", text: raw.replace(/^ /, "") });
    }
    if (lines.length > MAX_DIFF_LINES) break;
  }
  return { lines: lines.slice(0, MAX_DIFF_LINES), added, removed };
}

/** Detects an Edit/Write/MultiEdit-shaped tool call and computes its diff.
 * Returns null for tool calls that don't carry recognizable edit input —
 * those fall back to the generic JSON/Bash rendering in ToolCallDetail. */
function getEditDiffInfo(tool: ToolCallEntry): EditDiffInfo | null {
  const input = tool.input as Record<string, unknown> | undefined;
  if (!input || typeof input !== "object") return null;
  const path = typeof input.file_path === "string" ? input.file_path : typeof input.path === "string" ? input.path : undefined;
  if (!path) return null;

  if (typeof input.old_string === "string" && typeof input.new_string === "string") {
    const { lines, added, removed } = linesFromDiffLines(input.old_string, input.new_string);
    return { path, added, removed, lines };
  }

  // Write-style: brand-new content, no prior string to diff against — render
  // it as a pure-addition diff so it still gets the colored gutter treatment.
  if (typeof input.content === "string" && input.old_string === undefined) {
    const { lines, added, removed } = linesFromDiffLines("", input.content);
    return { path, added, removed, lines };
  }

  // MultiEdit: an array of { old_string, new_string } edits against one file.
  if (Array.isArray(input.edits)) {
    let lines: DiffLineOut[] = [];
    let added = 0;
    let removed = 0;
    for (const edit of input.edits as Array<Record<string, unknown>>) {
      if (typeof edit.old_string === "string" && typeof edit.new_string === "string") {
        const part = linesFromDiffLines(edit.old_string, edit.new_string);
        lines = lines.concat(part.lines);
        added += part.added;
        removed += part.removed;
      }
    }
    if (lines.length > 0) return { path, added, removed, lines: lines.slice(0, MAX_DIFF_LINES) };
  }

  // Codex tool events sometimes hand back a ready-made unified patch string.
  const patchField = input.patch ?? input.diff;
  if (typeof patchField === "string") {
    const { lines, added, removed } = linesFromPatch(patchField);
    return { path, added, removed, lines };
  }

  return null;
}

function DiffView({ diff }: { diff: EditDiffInfo }) {
  return (
    <div className="diff-view">
      {diff.lines.map((line, i) => (
        <div key={i} className={`diff-line diff-line--${line.type}`}>
          <span className="diff-line__gutter">{line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}</span>
          <span className="diff-line__text">{line.text.length > 0 ? line.text : " "}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-tool-call rows (item 2) — shared row primitive, grouped by consecutive
// same-name tool calls, collapsed by default.
// ---------------------------------------------------------------------------

/** Renders the body of a single tool call: an inline diff for Edit-style
 * calls, a command+output block for Bash, or a pretty-printed JSON
 * fallback for everything else (including Codex tool events whose shape
 * doesn't match any of the above). */
function ToolCallDetail({ tool }: { tool: ToolCallEntry }) {
  const diffInfo = useMemo(() => getEditDiffInfo(tool), [tool]);
  if (diffInfo) {
    return (
      <div className="tool-row__detail">
        <DiffView diff={diffInfo} />
      </div>
    );
  }

  const nameLower = tool.name.toLowerCase();
  if (nameLower === "bash" || nameLower === "shell" || nameLower === "exec" || nameLower === "local_shell") {
    const input = tool.input as Record<string, unknown> | undefined;
    const command =
      typeof input?.command === "string"
        ? input.command
        : Array.isArray(input?.command)
          ? (input!.command as unknown[]).join(" ")
          : undefined;
    const output =
      tool.done && tool.result !== undefined
        ? typeof tool.result === "string"
          ? tool.result
          : JSON.stringify(tool.result, null, 2)
        : undefined;
    return (
      <div className="tool-row__detail">
        {command && <pre className="tool-call__block tool-call__block--bash">$ {command}</pre>}
        {output !== undefined && <pre className="tool-call__block tool-call__block--result">{output}</pre>}
      </div>
    );
  }

  return (
    <div className="tool-row__detail">
      {tool.input !== undefined && (
        <pre className="tool-call__block">{JSON.stringify(tool.input, null, 2)}</pre>
      )}
      {tool.done && tool.result !== undefined && (
        <pre className="tool-call__block tool-call__block--result">
          {typeof tool.result === "string" ? tool.result : JSON.stringify(tool.result, null, 2)}
        </pre>
      )}
    </div>
  );
}

/** Groups an array of tool calls into runs of consecutive same-name calls
 * (jean's StackedGroup pattern), keeping the original array's chronological
 * order. Returns groups of *indices* into the original array so callers can
 * still address (and scroll to) an individual original tool call. */
function groupConsecutiveToolIndices(tools: ToolCallEntry[]): number[][] {
  const groups: number[][] = [];
  let lastName: string | undefined;
  tools.forEach((tool, idx) => {
    if (groups.length > 0 && lastName === tool.name) {
      groups[groups.length - 1]!.push(idx);
    } else {
      groups.push([idx]);
    }
    lastName = tool.name;
  });
  return groups;
}

function ToolRow({
  tools,
  rowIndex,
  registerRef,
}: {
  tools: ToolCallEntry[];
  rowIndex: number;
  registerRef: (el: HTMLDetailsElement | null) => void;
}) {
  // Callers always pass a non-empty group (see groupConsecutiveToolIndices).
  const primary = tools[0]!;
  const allDone = tools.every((t) => t.done);
  const label = tools.length === 1 ? primary.name : `${primary.name} ×${tools.length}`;
  const argSummary = tools.length === 1 ? summarizeToolInput(primary.input) : undefined;

  return (
    <details className="tool-row" data-testid={`tool-row-${rowIndex}`} ref={registerRef}>
      <summary className="tool-row__summary">
        <span className="tool-row__glyph tool-row__glyph--tool">{allDone ? "●" : "○"}</span>
        <span className="tool-row__name">{label}</span>
        {argSummary && (
          <span className="tool-row__arg" title={argSummary}>
            {argSummary}
          </span>
        )}
        <span className="tool-row__chevron" aria-hidden="true" />
      </summary>
      <div className="tool-row__body">
        {tools.map((tool, i) => (
          <ToolCallDetail key={i} tool={tool} />
        ))}
      </div>
    </details>
  );
}

function ThinkingRow({ text, rowIndex }: { text: string; rowIndex: number }) {
  return (
    <details className="tool-row tool-row--thinking" data-testid={`tool-row-${rowIndex}`}>
      <summary className="tool-row__summary">
        <span className="tool-row__glyph">◆</span>
        <span className="tool-row__name">Thinking</span>
        <span className="tool-row__chevron" aria-hidden="true" />
      </summary>
      <div className="tool-row__body">
        <div className="thinking__body">{text}</div>
      </div>
    </details>
  );
}

/** What the "Worked for Xs" summary line should say while a turn is still
 * streaming: the name of the tool currently in flight, or a generic
 * "Working…"/"Thinking…" fallback. */
function currentActivityLabel(message: ChatMessage): string {
  const lastTool = message.tools[message.tools.length - 1];
  if (lastTool && !lastTool.done) return `Working… ${lastTool.name}`;
  if (message.tools.length > 0) return "Working…";
  if (message.thinking) return "Thinking…";
  return "Working…";
}

// ---------------------------------------------------------------------------
// Per-file edit badges (item 3)
// ---------------------------------------------------------------------------

interface EditBadge {
  path: string;
  added: number;
  removed: number;
  /** Index of the *last* tool row (post-grouping) touching this path, so a
   * badge click can open + scroll to a single representative row. */
  rowIndex: number;
}

function computeEditBadges(tools: ToolCallEntry[], toolIndexToRow: number[]): EditBadge[] {
  const byPath = new Map<string, EditBadge>();
  tools.forEach((tool, idx) => {
    const diffInfo = getEditDiffInfo(tool);
    if (!diffInfo) return;
    const rowIndex = toolIndexToRow[idx] ?? 0;
    const existing = byPath.get(diffInfo.path);
    if (existing) {
      existing.added += diffInfo.added;
      existing.removed += diffInfo.removed;
      existing.rowIndex = rowIndex;
    } else {
      byPath.set(diffInfo.path, {
        path: diffInfo.path,
        added: diffInfo.added,
        removed: diffInfo.removed,
        rowIndex,
      });
    }
  });
  return Array.from(byPath.values());
}

// ---------------------------------------------------------------------------
// Code-block copy buttons (item 6/8) — injected into rendered markdown
// ---------------------------------------------------------------------------

/** Injects a small "Copy" button into every `<pre>` under `container` that
 * doesn't already have one. Runs after markdown re-renders (streaming
 * chunks, or once on completion); idempotent so re-running on every render
 * is cheap and safe. */
function injectCodeCopyButtons(container: HTMLElement | null): void {
  if (!container) return;
  const blocks = container.querySelectorAll("pre");
  blocks.forEach((pre) => {
    if (pre.querySelector(".codeblock-copy")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "codeblock-copy";
    btn.setAttribute("data-testid", "codeblock-copy");
    btn.textContent = "Copy";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const code = pre.querySelector("code");
      const text = code ? code.textContent ?? "" : pre.textContent ?? "";
      void copyText(text);
      const original = "Copy";
      btn.textContent = "Copied";
      window.setTimeout(() => {
        btn.textContent = original;
      }, 1200);
    });
    pre.appendChild(btn);
  });
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

const MessageBubble = memo(function MessageBubble({
  message,
  onCopyToInput,
}: {
  message: ChatMessage;
  onCopyToInput: (text: string) => void;
}) {
  const hasThinkingOrTools = message.thinking || message.tools.length > 0;
  const isStreaming = message.streaming;
  const markdownRef = useRef<HTMLDivElement>(null);
  const workedForRef = useRef<HTMLDetailsElement>(null);
  const rowRefs = useRef<Record<number, HTMLDetailsElement | null>>({});

  // Summary text: current activity while streaming, else "Worked for Xs".
  const workedForSummary = isStreaming
    ? currentActivityLabel(message)
    : message.elapsedSec != null
      ? `Worked for ${fmtElapsed(message.elapsedSec)}`
      : "Worked";

  const toolGroups = useMemo(() => groupConsecutiveToolIndices(message.tools), [message.tools]);
  const toolIndexToRow = useMemo(() => {
    // Row 0 is reserved for the thinking row when present; tool groups
    // follow, offset accordingly, so badge click-throughs can address them.
    const offset = message.thinking ? 1 : 0;
    const map: number[] = [];
    toolGroups.forEach((group, gi) => {
      group.forEach((toolIdx) => {
        map[toolIdx] = gi + offset;
      });
    });
    return map;
  }, [toolGroups, message.thinking]);

  const editBadges = useMemo(() => computeEditBadges(message.tools, toolIndexToRow), [message.tools, toolIndexToRow]);

  const renderedMarkdown = useMemo(
    () => renderMarkdown(message.text, isStreaming),
    [message.text, isStreaming],
  );

  useEffect(() => {
    injectCodeCopyButtons(markdownRef.current);
  }, [message.text, message.streaming]);

  const scrollToRow = (rowIndex: number) => {
    if (workedForRef.current) workedForRef.current.open = true;
    const el = rowRefs.current[rowIndex];
    if (el) {
      el.open = true;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleCopyAssistant = () => {
    void copyText(message.text);
  };

  const handleCopyUserToInput = () => {
    onCopyToInput(message.text);
  };

  return (
    <div className={`message message--${message.role}`}>
      <div className="message__actions">
        {message.role === "user" ? (
          <button
            type="button"
            className="message__action-btn"
            data-testid="msg-copy-user"
            onClick={handleCopyUserToInput}
            title="Copy to input"
          >
            ↺ input
          </button>
        ) : (
          message.text && (
            <button
              type="button"
              className="message__action-btn"
              data-testid="msg-copy-assistant"
              onClick={handleCopyAssistant}
              title="Copy response"
            >
              copy
            </button>
          )
        )}
      </div>
      {message.role === "assistant" && hasThinkingOrTools && (
        <details className="message__worked-for" open={isStreaming} ref={workedForRef}>
          <summary>{workedForSummary}</summary>
          <div className="tool-timeline">
            {message.thinking && <ThinkingRow text={message.thinking} rowIndex={0} />}
            {toolGroups.map((group, gi) => (
              <ToolRow
                key={gi}
                tools={group.map((idx) => message.tools[idx]!)}
                rowIndex={gi + (message.thinking ? 1 : 0)}
                registerRef={(el) => {
                  rowRefs.current[gi + (message.thinking ? 1 : 0)] = el;
                }}
              />
            ))}
          </div>
        </details>
      )}
      {message.text && message.role === "assistant" ? (
        <div
          ref={markdownRef}
          className="message__markdown"
          dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
        />
      ) : message.text ? (
        <div className="message__text">{message.text}</div>
      ) : null}
      {message.role === "assistant" && editBadges.length > 0 && (
        <div className="message__edit-badges">
          {editBadges.map((badge) => (
            <button
              key={badge.path}
              type="button"
              className="edit-badge"
              data-testid={`diff-badge-${badge.path}`}
              title={badge.path}
              onClick={() => scrollToRow(badge.rowIndex)}
            >
              <span className="edit-badge__path">{badge.path}</span>
              <span className="edit-badge__add">+{badge.added}</span>
              <span className="edit-badge__del">−{badge.removed}</span>
            </button>
          ))}
        </div>
      )}
      {message.error && <div className="message__error">{message.error}</div>}
      {message.streaming && !message.text && !message.thinking && message.tools.length === 0 && (
        <div className="message__pending">...</div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// ChatView
// ---------------------------------------------------------------------------

/** Below this many pixels from the bottom, the list counts as "at bottom"
 * for auto-stick and pill-visibility purposes. */
const BOTTOM_THRESHOLD_PX = 48;

/**
 * Genuinely-unavailable fallback (see this file's header block, and
 * `dockview/DockviewShell.tsx`'s `SessionChatPanel`) for a `ChatView`
 * instance whose `sessionId` prop names a session that no longer exists —
 * e.g. a persisted dockview layout referencing a session that was since
 * deleted, or restored on a host/db that never had it. A pane bound to a
 * session that DOES still exist renders the live chat below instead, even
 * when it isn't the globally active session — `store.ts`'s
 * `messagesBySession`/`streamingMessageIdBySession` are keyed per session
 * (not scoped to one active conversation), and `sendChat`/`cancelChat` take
 * an explicit `sessionId`, so a split pane genuinely streams that session's
 * own turns rather than showing a "switch to see it" placeholder.
 *
 * CLI mode never needed this — `AgentCliTerminal` already takes an explicit
 * `sessionId` and drives a PTY keyed by that id independent of which session
 * is globally active (see the `mode === "cli"` branch below, unchanged).
 */
function InactiveSessionPane({ sessionId }: { sessionId: string }) {
  return (
    <div className="inactive-session-pane" data-testid={`session-pane-inactive-${sessionId}`}>
      <div className="inactive-session-pane__note">This session is no longer available.</div>
    </div>
  );
}

/** Stable empty-array fallback for the `messages` selector below — a fresh
 * `[]` literal returned from a zustand selector on every call (one that
 * never actually changes) breaks `useSyncExternalStore`'s snapshot-equality
 * check and produces an infinite re-render loop (React error #185), since
 * the selector result never structurally settles. A session with no
 * `messagesBySession` entry yet (not loaded) reuses this one reference. */
const EMPTY_MESSAGES: ChatMessage[] = [];

/**
 * `sessionId`: which session this pane renders. Omitted (the default, and
 * what every pre-existing caller does) means "the globally active session" —
 * that path is 100% unchanged from before this prop existed. Passing an
 * explicit id is how `dockview/DockviewShell.tsx`'s `SessionChatPanel` binds
 * a split pane to a specific, possibly-non-active session — see
 * `InactiveSessionPane` above for what that renders when it isn't (yet, or
 * ever) the active one.
 */
export function ChatView({ sessionId: sessionIdProp }: { sessionId?: string } = {}) {
  const activeSessionId = usePerchStore((s) => s.sessionId);
  const sessionId = sessionIdProp ?? activeSessionId;
  // True for every pre-existing caller (no `sessionId` prop at all).
  const isActiveSession = sessionId === activeSessionId;
  // Hosted mode's live state is now keyed per session — see
  // `store.ts`'s `messagesBySession`/`streamingMessageIdBySession` — so a
  // pane bound to a non-active session reads its OWN bucket here, not the
  // active-session mirror.
  const messages = usePerchStore((s) =>
    sessionId ? (s.messagesBySession[sessionId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES,
  );
  const streamingMessageId = usePerchStore((s) =>
    sessionId ? (s.streamingMessageIdBySession[sessionId] ?? null) : null,
  );
  // Whether this pane's session still exists at all (as opposed to merely
  // being inactive) — the only remaining case that falls back to
  // `InactiveSessionPane`. The active session is exempt: it can legitimately
  // be brand-new and not yet in `sessions[]` (the DB row is deferred until
  // the first message — see server.rs), so it must never be treated as
  // "gone" just because it hasn't been listed yet.
  const sessionExists = usePerchStore((s) => isActiveSession || s.sessions.some((x) => x.id === sessionId));
  const ensureSessionLive = usePerchStore((s) => s.ensureSessionLive);
  const connected = usePerchStore((s) => s.connected);
  const sendChat = usePerchStore((s) => s.sendChat);
  const cancelChat = usePerchStore((s) => s.cancelChat);
  const agent = usePerchStore((s) => s.agent);
  const cliAgentBySession = usePerchStore((s) => s.cliAgentBySession);
  // CLI mode's provider choice (Bug 1) — per-session, falling back to the
  // global `agent` (Hosted mode's field) for a session with no recorded
  // choice, which is exactly how every pre-existing session already behaved.
  // This is *provider* selection only (which CLI binary launches), not
  // model/effort chrome — CLAUDE.md's "zero model chrome in CLI mode" stands;
  // see CliStartPanel.tsx's header comment for the full rationale.
  const cliAgent: AgentKind = sessionId ? (cliAgentBySession[sessionId] ?? agent) : agent;
  const cliError = usePerchStore((s) => s.cliError);
  const updateSettings = usePerchStore((s) => s.updateSettings);
  const sessionCommands = usePerchStore((s) => s.sessionCommands);
  const fetchCommands = usePerchStore((s) => s.fetchCommands);
  // Global chat mode (Settings > Chat Mode) — no longer per-chat client
  // state. Every open chat pane reads this same value, so flipping the
  // setting flips already-open chats too (see AgentCliTerminal's kill-on-
  // unmount effect for how the CLI->Hosted->CLI PTY lifecycle stays correct
  // when this value changes out from under a mounted pane).
  const mode: "hosted" | "cli" = usePerchStore((s) => s.settings?.chatMode ?? "hosted");

  // CLI mode only mounts a terminal once the user has actually chosen to work
  // somewhere — either they created this session (`cliStartedSessions`), or
  // it already has CLI history on the server (`cliStarted`) and is therefore
  // safe to resume unattended. Everything else gets the start panel. Without
  // this, the blank session the transport mints on every connect spawned an
  // agent process in the server's default cwd the moment the app opened.
  const cliStartedLocally = usePerchStore((s) =>
    sessionId ? (s.cliStartedSessions[sessionId] ?? false) : false,
  );
  const cliStartedOnServer = usePerchStore((s) =>
    sessionId ? (s.sessions.find((x) => x.id === sessionId)?.cliStarted ?? false) : false,
  );
  const cliReady = !!sessionId && (cliStartedLocally || cliStartedOnServer);

  // A split pane bound to a session this connection has never resumed
  // before (the common "split with an existing session" case) has no
  // messagesBySession entry yet — load it in the background, without
  // disturbing the actual active/foreground session. No-ops once loaded
  // (or for the active session, which loads through the normal switch
  // path) — see `ensureSessionLive`'s doc comment in store.ts.
  useEffect(() => {
    if (mode === "hosted" && sessionId && !isActiveSession && sessionExists) {
      ensureSessionLive(sessionId);
    }
  }, [mode, sessionId, isActiveSession, sessionExists, ensureSessionLive]);

  const [text, setText] = useState("");
  // Plan mode is a composer-level toggle, not a one-shot: leaving it ON after
  // sending matches how the CLI's `--permission-mode plan` behaves (it's a
  // standing mode you turn off), so the next turn on this session stays in
  // plan mode until the user flips it back. The one exception is the plan
  // card's own "Approve & run" button, which always sends with plan mode off
  // regardless of this flag — see PlanCard.tsx.
  const [planMode, setPlanMode] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Composer attachments
  //
  // `staged` holds successfully-uploaded files (server-side paths only — see
  // attachments.ts); `uploadError` is the last upload failure's message, one
  // slot shared across concurrent uploads (a fresh error replaces the old
  // one, successes don't clear it — the point is "something recently went
  // wrong", not a per-file log). `uploading` gates Send: a file mid-upload
  // has no path yet, so sending before it lands would silently drop it
  // rather than attach it. Switching sessions clears staged files — they're
  // tied to the session dir they were uploaded into (see uploads.rs).
  // -------------------------------------------------------------------------
  const [staged, setStaged] = useState<StagedAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    setStaged([]);
    setUploadError(null);
  }, [sessionId]);

  async function handleFiles(files: FileList | File[]) {
    if (!sessionId) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    const results = await Promise.allSettled(list.map((f) => uploadAttachment(sessionId, f)));
    const successes: StagedAttachment[] = [];
    let lastError: string | null = null;
    for (const r of results) {
      if (r.status === "fulfilled") successes.push(r.value);
      else lastError = r.reason instanceof Error ? r.reason.message : String(r.reason);
    }
    if (successes.length > 0) setStaged((prev) => [...prev, ...successes]);
    if (lastError) setUploadError(lastError);
    setUploading(false);
  }

  function handleRemoveAttachment(id: string) {
    setStaged((prev) => prev.filter((a) => a.id !== id));
  }

  // -------------------------------------------------------------------------
  // Slash-command / skill autocomplete (Hosted mode only)
  //
  // The "open" state is *derived*, not stored: on every render we recompute
  // which sigil token (if any) the caret sits inside from `text`+`caret`,
  // then filter that session's command list against its query. This keeps
  // the popover always in sync with the textarea without a separate
  // open/close flag that could drift out of sync with what's actually typed.
  //
  // The one bit of real state is `dismissedTokenStart`: Escape needs to close
  // the popover *without* touching the text, and since "open" is derived from
  // the token, closing it means remembering "the token starting at this
  // index was dismissed" until the user moves to a different token (a new
  // sigil, or this one gets edited into a different query). See
  // `composerCommands.ts` for `activeSigilToken`/`filterCommands`.
  // -------------------------------------------------------------------------
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const slashPopoverRef = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState(0);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dismissedTokenStart, setDismissedTokenStart] = useState<number | null>(null);

  const sigil = AGENT_SIGIL[agent];
  const slashToken = activeSigilToken(text, caret, sigil);
  const slashEntries: CommandEntry[] = slashToken
    ? filterCommands(sessionId ? (sessionCommands[sessionId]?.[agent] ?? []) : [], slashToken.query)
    : [];
  const slashOpen =
    slashToken !== null && slashEntries.length > 0 && slashToken.start !== dismissedTokenStart;

  // Ask the server for this session's command list as soon as a sigil token
  // opens. `fetchCommands` is internally deduped per session, so calling it
  // on every keystroke that leaves a token active is cheap.
  useEffect(() => {
    if (slashToken && sessionId) fetchCommands(sessionId);
  }, [slashToken !== null, sessionId, fetchCommands]);

  // A fresh token (new sigil, or the same one edited into a different query)
  // always starts back at the top of the list.
  useEffect(() => {
    setHighlightedIndex(0);
  }, [slashToken?.start, slashToken?.query]);

  // Clear a dismissal once there is no active token at all. Escape is scoped
  // to the token it was pressed in (keep typing that word and the popover
  // stays out of the way), but deleting the sigil and typing a new one — even
  // at the very same offset — has to bring the menu back, and the offset
  // alone can't tell those two cases apart.
  useEffect(() => {
    if (!slashToken) setDismissedTokenStart(null);
  }, [slashToken !== null]);

  // Click outside the textarea and the popover itself dismisses it, same
  // contract as EffortChip/ModelChip's click-outside handling.
  useEffect(() => {
    if (!slashOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const inTextarea = textareaRef.current?.contains(target) ?? false;
      const inPopover = slashPopoverRef.current?.contains(target) ?? false;
      if (!inTextarea && !inPopover && slashToken) setDismissedTokenStart(slashToken.start);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [slashOpen, slashToken]);

  const slashPopoverStyle =
    slashOpen && textareaRef.current
      ? computeAnchoredPopoverStyle(textareaRef.current, { align: "left" })
      : undefined;

  /** Replace the active sigil token with `entry.name` and land the caret
   * after the trailing space `applyCommand` appends. The caret restore has
   * to wait a frame: React hasn't re-rendered the (controlled) textarea with
   * the new value yet, so `setSelectionRange` right now would apply to the
   * stale DOM value and get clobbered by the re-render. */
  function acceptSlashCommand(entry: CommandEntry) {
    if (!slashToken) return;
    const result = applyCommand(text, slashToken, sigil, entry.name);
    setText(result.text);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(result.caret, result.caret);
      setCaret(result.caret);
    });
  }

  // Scroll-behavior fix (item 4/6): only auto-stick to the bottom while
  // already at the bottom. Otherwise a user reading earlier messages would
  // get yanked to the bottom by every incoming streaming chunk.
  useEffect(() => {
    if (stickToBottom) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }
  }, [messages, stickToBottom]);

  // A session switch is a wholesale replacement of the transcript — always
  // land at the bottom of the newly loaded history.
  useEffect(() => {
    setStickToBottom(true);
    setIsAtBottom(true);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [sessionId]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX;
    setIsAtBottom(atBottom);
    setStickToBottom(atBottom);
  };

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setStickToBottom(true);
    setIsAtBottom(true);
  };

  const submit = () => {
    if (!sessionId || !text.trim() || streamingMessageId || uploading) return;
    const options: { planMode?: boolean; attachments?: string[] } = {};
    if (planMode) options.planMode = true;
    if (staged.length > 0) options.attachments = staged.map((a) => a.path);
    sendChat(text, Object.keys(options).length > 0 ? options : undefined, sessionId);
    setText("");
    setStaged([]);
    setUploadError(null);
  };

  // Leaving CLI mode (globally, via Settings): clear any stale CLI error
  // overlay so it doesn't reappear stale the next time CLI mode is entered.
  useEffect(() => {
    if (mode !== "cli") {
      usePerchStore.setState({ cliError: null });
    }
  }, [mode]);

  return (
    <div className="chat">
      {!sessionId ? (
        // Bug 2: no active session (e.g. the last one was just deleted) —
        // render a real empty state instead of a disabled composer claiming
        // "Connecting..." even though the socket is fine. See NoSessionPanel.
        <NoSessionPanel connected={connected} />
      ) : mode === "cli" && cliReady ? (
        <AgentCliTerminal
          key={`${sessionId}-${cliAgent}`}
          sessionId={sessionId}
          agent={cliAgent}
          cliError={cliError}
          onExitCli={() => updateSettings({ chatMode: "hosted" })}
        />
      ) : mode === "cli" ? (
        <CliStartPanel agent={cliAgent} />
      ) : !sessionExists ? (
        // The session this pane is bound to no longer exists — see
        // `InactiveSessionPane`'s doc comment. A merely-inactive (but real)
        // session renders the live chat below like any other.
        <InactiveSessionPane sessionId={sessionId} />
      ) : (
        <>
          <div className="chat__list-container">
            <div className="chat__list" ref={listRef} onScroll={handleScroll}>
              {messages.map((m) =>
                m.kind === "plan" ? (
                  <PlanCard key={m.id} message={m} />
                ) : (
                  <MessageBubble key={m.id} message={m} onCopyToInput={setText} />
                ),
              )}
            </div>
            {!isAtBottom && (
              <button
                type="button"
                className="scroll-bottom-pill"
                data-testid="scroll-bottom-pill"
                onClick={scrollToBottom}
              >
                {streamingMessageId && <span className="scroll-bottom-pill__dot" />}
                ↓ Bottom
              </button>
            )}
          </div>
          <div
            className={"chat__input" + (dragActive ? " chat__input--drag-active" : "")}
            onDragOver={(e) => {
              e.preventDefault();
              if (sessionId) setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (sessionId && e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files);
            }}
          >
            <AttachmentBar
              staged={staged}
              onRemove={handleRemoveAttachment}
              onFiles={(files) => void handleFiles(files)}
              error={uploadError}
              disabled={!sessionId}
            />
            <textarea
              ref={textareaRef}
              value={text}
              placeholder="Message perch..."
              rows={1}
              onChange={(e) => {
                setText(e.target.value);
                setCaret(e.target.selectionStart ?? e.target.value.length);
              }}
              onKeyUp={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
              onClick={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
              onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
              onKeyDown={(e) => {
                if (slashOpen) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightedIndex((i) => (i + 1) % slashEntries.length);
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightedIndex((i) => (i - 1 + slashEntries.length) % slashEntries.length);
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    const entry = slashEntries[Math.min(highlightedIndex, slashEntries.length - 1)];
                    if (entry) acceptSlashCommand(entry);
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    if (slashToken) setDismissedTokenStart(slashToken.start);
                    return;
                  }
                  // Any other key falls through to normal typing — the popover
                  // will just re-derive from the resulting text/caret.
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <div className="chat__input-controls">
              {/* ModelChip/EffortChip/plan toggle only visible in Hosted mode */}
              <ModelChip />
              <EffortChip />
              <button
                type="button"
                className={"composer-plan-toggle" + (planMode ? " composer-plan-toggle--active" : "")}
                data-testid="composer-plan-toggle"
                onClick={() => setPlanMode((v) => !v)}
                title={
                  planMode
                    ? "Plan mode on — the agent will plan before making changes"
                    : "Plan mode off — turn on to have the agent plan before acting"
                }
              >
                Plan
              </button>
              {streamingMessageId ? (
                <button className="chat__cancel" onClick={() => cancelChat(sessionId ?? undefined)}>
                  Stop
                </button>
              ) : (
                <button
                  className="chat__send"
                  onClick={submit}
                  disabled={!sessionId || !text.trim() || uploading}
                >
                  {uploading ? "Uploading…" : "Send"}
                </button>
              )}
            </div>
          </div>
          {slashOpen &&
            slashPopoverStyle &&
            createPortal(
              <SlashPopover
                entries={slashEntries}
                sigil={sigil}
                highlightedIndex={Math.min(highlightedIndex, slashEntries.length - 1)}
                style={slashPopoverStyle}
                onSelect={acceptSlashCommand}
                onHover={setHighlightedIndex}
                popoverRef={slashPopoverRef}
              />,
              document.body,
            )}
        </>
      )}
    </div>
  );
}
