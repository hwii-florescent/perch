import { useEffect, useRef, useState } from "react";
import { usePerchStore, type ChatMessage, type ToolCallEntry } from "../store";
import { AGENTS, MODELS } from "../models";
import { ModeSwitch } from "../components/ModeSwitch";
import { AgentCliTerminal } from "./AgentCliTerminal";

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

function agentModelLabel(message: ChatMessage): string | null {
  if (!message.agent) return null;
  const agentLabel = AGENTS.find((a) => a.id === message.agent)?.label ?? message.agent;
  const modelLabel = MODELS[message.agent].find((m) => m.id === message.model)?.label ?? message.model;
  return modelLabel ? `${agentLabel} · ${modelLabel}` : agentLabel;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const meta = message.role === "assistant" ? agentModelLabel(message) : null;
  return (
    <div className={`message message--${message.role}`}>
      {meta && <div className="message__meta">{meta}</div>}
      {message.thinking && (
        <details className="thinking">
          <summary>Thinking</summary>
          <div className="thinking__body">{message.thinking}</div>
        </details>
      )}
      {message.tools.map((tool, i) => (
        <ToolCall key={i} tool={tool} />
      ))}
      {message.text && <div className="message__text">{message.text}</div>}
      {message.error && <div className="message__error">{message.error}</div>}
      {message.streaming && !message.text && !message.thinking && message.tools.length === 0 && (
        <div className="message__pending">...</div>
      )}
    </div>
  );
}

export function ChatView() {
  const messages = usePerchStore((s) => s.messages);
  const streamingMessageId = usePerchStore((s) => s.streamingMessageId);
  const sessionId = usePerchStore((s) => s.sessionId);
  const sendChat = usePerchStore((s) => s.sendChat);
  const cancelChat = usePerchStore((s) => s.cancelChat);
  const agent = usePerchStore((s) => s.agent);
  const model = usePerchStore((s) => s.model);
  const setAgent = usePerchStore((s) => s.setAgent);
  const setModel = usePerchStore((s) => s.setModel);

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

  return (
    <div className="chat">
      <div className="chat__agent-bar">
        <select
          className="chat__select"
          value={agent}
          onChange={(e) => setAgent(e.target.value as (typeof AGENTS)[number]["id"])}
          aria-label="Agent"
        >
          {AGENTS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <select
          className="chat__select"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          aria-label="Model"
        >
          {MODELS[agent].map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <ModeSwitch mode={mode} onChange={setMode} />
      </div>
      {mode === "cli" && sessionId ? (
        <AgentCliTerminal sessionId={sessionId} agent={agent} />
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
        </>
      )}
    </div>
  );
}
