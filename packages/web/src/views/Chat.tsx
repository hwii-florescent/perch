import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { diffLines } from "diff";
import { usePerchStore, PLAN_APPROVAL_TEXT, type ChatMessage, type ToolCallEntry } from "../store";
import { AGENTS } from "../models";
import { repairMarkdown } from "../markdownRepair";
import { ModelChip } from "../components/ModelChip";
import { EffortChip } from "../components/EffortChip";
import { computeAnchoredPopoverStyle } from "../components/popoverPosition";
import {
  AGENT_SIGIL,
  activeSigilToken,
  applyCommand,
  filterCommands,
  type SigilToken,
} from "../composerCommands";
import { uploadAttachment, type StagedAttachment } from "../attachments";
import { AgentCliTerminal } from "./AgentCliTerminal";
import type { AgentKind } from "@perch/shared";

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

/** Render markdown text to sanitized HTML. Guard: only runs in browser.
 * While a message is still streaming, run it through `repairMarkdown` first
 * so a growing, incomplete string (open code fence, dangling `**`, etc.)
 * doesn't render visibly broken for a frame or two — see markdownRepair.ts. */
function renderMarkdown(text: string, streaming: boolean): string {
  if (typeof window === "undefined") return text;
  const source = streaming ? repairMarkdown(text) : text;
  const html = marked.parse(source, { async: false }) as string;
  return DOMPurify.sanitize(html);
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

function MessageBubble({ message, onCopyToInput }: { message: ChatMessage; onCopyToInput: (text: string) => void }) {
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
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.text, isStreaming) }}
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
}

// ---------------------------------------------------------------------------
// ChatView
// ---------------------------------------------------------------------------

/** Below this many pixels from the bottom, the list counts as "at bottom"
 * for auto-stick and pill-visibility purposes. */
const BOTTOM_THRESHOLD_PX = 48;

export function ChatView() {
  const messages = usePerchStore((s) => s.messages);
  const streamingMessageId = usePerchStore((s) => s.streamingMessageId);
  const sessionId = usePerchStore((s) => s.sessionId);
  const sendChat = usePerchStore((s) => s.sendChat);
  const cancelChat = usePerchStore((s) => s.cancelChat);
  const agent = usePerchStore((s) => s.agent);
  const cliError = usePerchStore((s) => s.cliError);
  const updateSettings = usePerchStore((s) => s.updateSettings);
  // Global chat mode (Settings > Chat Mode) — no longer per-chat client
  // state. Every open chat pane reads this same value, so flipping the
  // setting flips already-open chats too (see AgentCliTerminal's kill-on-
  // unmount effect for how the CLI->Hosted->CLI PTY lifecycle stays correct
  // when this value changes out from under a mounted pane).
  const mode: "hosted" | "cli" = usePerchStore((s) => s.settings?.chatMode ?? "hosted");

  const [text, setText] = useState("");
  const [stickToBottom, setStickToBottom] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

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
    if (!text.trim() || streamingMessageId) return;
    sendChat(text);
    setText("");
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
      {mode === "cli" && sessionId ? (
        <AgentCliTerminal
          key={`${sessionId}-${agent}`}
          sessionId={sessionId}
          agent={agent}
          cliError={cliError}
          onExitCli={() => updateSettings({ chatMode: "hosted" })}
        />
      ) : (
        <>
          <div className="chat__list-container">
            <div className="chat__list" ref={listRef} onScroll={handleScroll}>
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} onCopyToInput={setText} />
              ))}
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
          <div className="chat__input">
            <textarea
              value={text}
              placeholder={sessionId ? "Message perch..." : "Connecting..."}
              disabled={!sessionId}
              rows={1}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <div className="chat__input-controls">
              {/* ModelChip/EffortChip only visible in Hosted mode */}
              <ModelChip />
              <EffortChip />
              {streamingMessageId ? (
                <button className="chat__cancel" onClick={cancelChat}>
                  Stop
                </button>
              ) : (
                <button
                  className="chat__send"
                  onClick={submit}
                  disabled={!sessionId || !text.trim()}
                >
                  Send
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
