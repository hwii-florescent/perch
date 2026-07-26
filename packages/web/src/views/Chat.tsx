import { useEffect, useRef, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { usePerchStore, type ChatMessage, type ToolCallEntry } from "../store";
import { AGENTS } from "../models";
import { ModeSwitch } from "../components/ModeSwitch";
import { ModelChip } from "../components/ModelChip";
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

/** Render markdown text to sanitized HTML. Guard: only runs in browser. */
function renderMarkdown(text: string): string {
  if (typeof window === "undefined") return text;
  const html = marked.parse(text, { async: false }) as string;
  return DOMPurify.sanitize(html);
}

// ---------------------------------------------------------------------------
// ToolCall (used inside WorkedFor details)
// ---------------------------------------------------------------------------

function ToolCall({ tool }: { tool: ToolCallEntry }) {
  return (
    <details className="tool-call" open={!tool.done}>
      <summary>
        {tool.done ? "✓" : "…"} {tool.name}
      </summary>
      {tool.input !== undefined && (
        <pre className="tool-call__block">{JSON.stringify(tool.input, null, 2)}</pre>
      )}
      {tool.done && tool.result !== undefined && (
        <pre className="tool-call__block tool-call__block--result">
          {typeof tool.result === "string" ? tool.result : JSON.stringify(tool.result, null, 2)}
        </pre>
      )}
    </details>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: ChatMessage }) {
  const hasThinkingOrTools = message.thinking || message.tools.length > 0;
  const isStreaming = message.streaming;

  // Summary text: "Working…" while streaming, else "Worked for Xs"
  const workedForSummary = isStreaming
    ? "Working…"
    : message.elapsedSec != null
      ? `Worked for ${fmtElapsed(message.elapsedSec)}`
      : "Worked";

  return (
    <div className={`message message--${message.role}`}>
      {message.role === "assistant" && hasThinkingOrTools && (
        <details className="message__worked-for" open={isStreaming}>
          <summary>{workedForSummary}</summary>
          {message.thinking && (
            <div className="thinking__body">{message.thinking}</div>
          )}
          {message.tools.map((tool, i) => (
            <ToolCall key={i} tool={tool} />
          ))}
        </details>
      )}
      {message.text && message.role === "assistant" ? (
        <div
          className="message__markdown"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.text) }}
        />
      ) : message.text ? (
        <div className="message__text">{message.text}</div>
      ) : null}
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

export function ChatView() {
  const messages = usePerchStore((s) => s.messages);
  const streamingMessageId = usePerchStore((s) => s.streamingMessageId);
  const sessionId = usePerchStore((s) => s.sessionId);
  const sendChat = usePerchStore((s) => s.sendChat);
  const cancelChat = usePerchStore((s) => s.cancelChat);
  const agent = usePerchStore((s) => s.agent);
  const cliError = usePerchStore((s) => s.cliError);

  const [text, setText] = useState("");
  const [mode, setMode] = useState<"hosted" | "cli">("hosted");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const submit = () => {
    if (!text.trim() || streamingMessageId) return;
    sendChat(text);
    setText("");
  };

  const handleModeChange = (newMode: "hosted" | "cli") => {
    if (newMode !== "cli") {
      // Leaving CLI mode: clear any stale CLI error overlay.
      usePerchStore.setState({ cliError: null });
    }
    setMode(newMode);
  };

  return (
    <div className="chat">
      {mode === "cli" && sessionId ? (
        <>
          {/* In CLI mode: ModeSwitch lives in a slim row above the terminal
              so the user can always toggle back to Hosted. */}
          <div className="chat__mode-row">
            <ModeSwitch mode={mode} onChange={handleModeChange} />
          </div>
          <AgentCliTerminal
            key={`${sessionId}-${agent}`}
            sessionId={sessionId}
            agent={agent}
            cliError={cliError}
            onExitCli={() => handleModeChange("hosted")}
          />
        </>
      ) : (
        <>
          <div className="chat__list" ref={listRef}>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
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
              {/* ModeSwitch always visible in Hosted mode input row */}
              <ModeSwitch mode={mode} onChange={handleModeChange} />
              {/* ModelChip only visible in Hosted mode */}
              <ModelChip />
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
