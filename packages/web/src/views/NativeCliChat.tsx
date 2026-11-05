import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { AgentLifecycleStatus, NativeUiMessage, NativeUiSnapshot } from "@perch/shared";
import { usePerchStore } from "../store";
import { openAgentTerminal, agentInputGeneration } from "../agentTerminals";
import { NativeUiError, requestNativeUi, subscribeNativeUi } from "../nativeUi";
import { socket } from "../ws";
import { renderMarkdown } from "../markdown";
import { newId } from "../ids";
import { CHAT_INPUT, CHAT_LIST, CHAT_LIST_CONTAINER, MESSAGE_ERROR, MESSAGE_MARKDOWN, NATIVE_TEXTAREA, SCROLL_PILL, SEND_BUTTON_GO, SEND_BUTTON_STOP, WORKED_FOR, messageClass } from "../components/ui/chat";
import { sendState } from "./nativeChat/sendState";
import { cn } from "../lib/cn";

const HINT = "text-[12px] text-subtext-0";

// Keep drafts and retry identities across UI/CLI switches, bounded like the
// transcript. A lost acknowledgement never turns Retry into a new operation.
const drafts = new Map<string, { text: string; operationId: string }>();

// A message this view sent that the transcript does not show yet. `unconfirmed` means delivery is unknown:
// it is never replayed as the same message, only restored to the composer as a new one.
type Outbox = { operationId: string; text: string; phase: "sending" | "delivered" | "unconfirmed"; baseline: number };
const sentCount = (snapshot: NativeUiSnapshot | null, text: string) => snapshot?.messages.filter((message) => message.role === "user" && message.text.trim() === text.trim()).length ?? 0;
const NativeMessage = memo(function NativeMessage({ message, streaming }: { message: NativeUiMessage; streaming: boolean }) {
  const html = useMemo(() => message.role === "assistant" ? renderMarkdown(message.text, streaming) : "", [message.role, message.text, streaming]);
  return <article className={messageClass(message.role === "user" ? "user" : "assistant")} data-native-role={message.role}>
    {message.thinking && <details className={cn("message__worked-for", WORKED_FOR)}><summary>Thinking</summary><pre>{message.thinking}</pre></details>}
    {message.tools.map((tool, index) => <details className={cn("message__worked-for", WORKED_FOR)} key={`${index}-${tool.name}`}><summary>{tool.name}</summary><pre>{tool.input}</pre></details>)}
    {message.role === "toolResult" ? <details className={cn("message__worked-for", WORKED_FOR)}><summary>{message.toolName ?? "Tool"} result</summary><pre>{message.text}</pre></details>
      : message.role === "assistant" ? <div className={cn("message__markdown", MESSAGE_MARKDOWN)} dangerouslySetInnerHTML={{ __html: html }} />
      : <div className="message__text">{message.text}</div>}
    {message.error && <div className={cn("message__error", MESSAGE_ERROR)} role="alert">{message.error}</div>}
  </article>;
}, (before, after) => before.streaming === after.streaming && JSON.stringify(before.message) === JSON.stringify(after.message));

export function NativeCliChat({ sessionId, providerId }: { sessionId: string; providerId: string }) {
  const connected = usePerchStore((state) => state.connected);
  const draftKey = JSON.stringify([sessionId, providerId]);
  const [text, setText] = useState(() => drafts.get(draftKey)?.text ?? "");
  const [snapshot, setSnapshot] = useState<NativeUiSnapshot | null>(null);
  const [status, setStatus] = useState<AgentLifecycleStatus | null>(null);
  const [controlling, setControlling] = useState(false);
  const [pending, setPending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [outbox, setOutbox] = useState<Outbox | null>(null);
  const latest = useRef<NativeUiSnapshot | null>(null);
  latest.current = snapshot;
  const field = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [exited, setExited] = useState(false);
  const binding = useRef<ReturnType<typeof openAgentTerminal> | null>(null);
  const terminalId = useRef<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [showBottom, setShowBottom] = useState(false);
  useEffect(() => {
    if (!connected) { setControlling(false); return; }
    let disposed = false;
    let initiallyUnowned = false;
    setSnapshot(null); setError(null); setControlling(false); setPending(false); setStopping(false); setExited(false);
    const unsubscribe = subscribeNativeUi(sessionId, providerId, (next) => { if (!disposed) { setSnapshot(next); } });
    const opened = openAgentTerminal(sessionId, providerId, 80, 24,
      (id, next) => { terminalId.current = id; initiallyUnowned = !next.inputOwner; },
      () => {},
      (next, owned) => { if (!disposed) { setStatus(next); setControlling(owned); } },
    );
    binding.current = opened;
    const stopExit = socket.onMessage((message) => {
      if (message.type === "terminal.exit" && message.terminalId === terminalId.current && !disposed) {
        setExited(true); setControlling(false); setSnapshot(null);
        setError("The CLI exited. Switch to CLI view to restart it.");
      }
    });
    opened.ready.then(async () => {
      if (disposed) return;
      const history = requestNativeUi({ type: "agent.ui.get", requestId: newId(), sessionId, providerId });
      if (initiallyUnowned) await opened.takeControl().catch((reason: Error) => { if (!disposed) setError(reason.message); });
      await history;
    }).catch((reason: Error) => { if (!disposed) setError(reason.message); });
    return () => { disposed = true; unsubscribe(); stopExit(); opened.release(); binding.current = null; terminalId.current = null; };
  }, [connected, sessionId, providerId, retry]);
  useEffect(() => { if (atBottom.current && list.current) list.current.scrollTop = list.current.scrollHeight; }, [snapshot, outbox]);
  // The transcript is the proof of delivery: drop the pending copy once it shows the message (or, if it
  // never does, a while after the CLI confirmed it).
  useEffect(() => {
    if (outbox && outbox.phase !== "sending" && sentCount(snapshot, outbox.text) > outbox.baseline) setOutbox(null);
  }, [snapshot, outbox]);
  useEffect(() => {
    if (outbox?.phase !== "delivered") return;
    const timer = setTimeout(() => setOutbox(null), 8000);
    return () => clearTimeout(timer);
  }, [outbox]);
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  function updateDraft(value: string) {
    if (new TextEncoder().encode(value).length > 64 * 1024) return;
    setText(value);
    drafts.set(draftKey, { text: value, operationId: newId() });
    if (drafts.size > 128) drafts.delete(drafts.keys().next().value!);
  }
  async function takeControl() {
    if (!binding.current || pending) return;
    setPending(true); setError(null);
    try { await binding.current.takeControl(); }
    catch (reason) { setError((reason as Error).message); }
    finally { setPending(false); }
  }
  async function send() {
    const generation = terminalId.current ? agentInputGeneration(terminalId.current) : undefined;
    if (generation === undefined || pending || outbox?.phase === "sending" || !connected || !text.trim()) return;
    const draft = drafts.get(draftKey) ?? { text, operationId: newId() };
    drafts.set(draftKey, draft);
    setError(null);
    const sent: Outbox = { operationId: draft.operationId, text: draft.text, phase: "sending", baseline: sentCount(latest.current, draft.text) };
    setOutbox(sent);
    const settled = () => { if (drafts.get(draftKey)?.operationId === draft.operationId) { drafts.delete(draftKey); setText(""); } };
    try {
      const reply = await requestNativeUi({ type: "agent.ui.prompt", requestId: newId(), sessionId, providerId, generation, ...draft });
      if (reply.type !== "agent.ui.result" || !reply.accepted) throw new Error("The CLI did not accept this action.");
      settled();
      setOutbox({ ...sent, phase: "delivered" });
    } catch (reason) {
      if (reason instanceof NativeUiError && reason.uncertain) { settled(); setOutbox({ ...sent, phase: "unconfirmed" }); }
      else { setOutbox(null); }
      setError((reason as Error).message);
    }
  }
  async function stop() {
    const generation = terminalId.current ? agentInputGeneration(terminalId.current) : undefined;
    if (generation === undefined || stopping || !connected) return;
    setStopping(true); setError(null);
    try {
      const reply = await requestNativeUi({ type: "agent.ui.cancel", requestId: newId(), sessionId, providerId, generation });
      if (reply.type !== "agent.ui.result" || !reply.accepted) throw new Error("The CLI did not accept this action.");
    } catch (reason) { setError((reason as Error).message); }
    finally { setStopping(false); }
  }
  // Delivery was unknown, so the text comes back as a new message for the user to judge against the transcript.
  function restoreUnconfirmed() {
    if (!outbox) return;
    setText(outbox.text);
    drafts.set(draftKey, { text: outbox.text, operationId: newId() });
    setOutbox(null); setError(null);
    field.current?.focus();
  }
  const sendable = sendState({ draft: text, connected, ready: !!snapshot, controlling, exited, working: !!snapshot?.running, sending: outbox?.phase === "sending", stopping });
  const label = !connected ? "Reconnecting…" : exited ? "CLI exited" : !snapshot ? "Connecting to CLI…" : snapshot.running ? "Working" : "Ready";
  return <div className="native-cli-chat flex min-h-0 min-w-0 flex-1 flex-col [&_pre]:whitespace-pre-wrap [&_pre]:[overflow-wrap:anywhere]" data-testid="native-cli-chat" data-provider={providerId} data-native-pid={snapshot?.pid} data-native-session={snapshot?.providerSessionId}>
    <div className="terminal__toolbar flex-wrap">
      <span role="status">{label}</span>
      {snapshot?.model && <span className="native-cli-chat__model ml-auto max-w-[45%] overflow-hidden text-ellipsis" title={snapshot.model}>{snapshot.model}</span>}
      {!controlling && <button type="button" disabled={!status || !connected || pending || exited} onClick={() => void takeControl()}>Take control</button>}
    </div>
    <div className={cn("chat__list-container", CHAT_LIST_CONTAINER)}>
      <div className={cn("chat__list", CHAT_LIST)} ref={list} onScroll={() => { if (list.current) { atBottom.current = list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight < 64; setShowBottom(!atBottom.current); } }}>
        {snapshot?.truncated && <p className={HINT}>Showing recent messages. The complete conversation remains in the CLI.</p>}
        {snapshot && !snapshot.messages.length && <p className={HINT}>Start a conversation with {providerId === "omp" ? "OMP" : providerId === "claude" ? "Claude Code" : providerId === "codex" ? "Codex" : providerId === "opencode" ? "OpenCode" : "Pi"}. You can switch to CLI at any time.</p>}
        {snapshot?.messages.map((message, index) => <NativeMessage key={message.id} message={message} streaming={snapshot.running && index === snapshot.messages.length - 1} />)}
        {outbox && <article className={messageClass("user", outbox.phase === "unconfirmed" ? "opacity-70" : undefined)} data-native-outbox={outbox.phase}>
          <div className="message__text">{outbox.text}</div>
          {outbox.phase === "sending" && <div className={HINT} role="status">Sending…</div>}
          {outbox.phase === "unconfirmed" && <div className={cn(HINT, "mt-1 flex flex-wrap items-center gap-2")} role="alert">Not confirmed — check the transcript before sending again.
            <button type="button" onClick={restoreUnconfirmed}>Edit and resend</button>
            <button type="button" onClick={() => setOutbox(null)}>Dismiss</button></div>}
        </article>}
      </div>
      {showBottom && <button className={cn("scroll-bottom-pill", SCROLL_PILL)} type="button" onClick={() => { atBottom.current = true; setShowBottom(false); if (list.current) list.current.scrollTop = list.current.scrollHeight; }}>↓ Bottom</button>}
    </div>
    {error && <div className="terminal__cli-error" role="alert">{error} {!snapshot && !exited && <button type="button" onClick={() => setRetry((value) => value + 1)}>Reconnect UI</button>}</div>}
    <form className={cn("chat__input", CHAT_INPUT)} onSubmit={(event) => { event.preventDefault(); if (sendable.action === "stop") void stop(); else void send(); }}>
      <textarea ref={field} className={NATIVE_TEXTAREA} aria-label="Message CLI" data-testid="native-cli-composer" value={text} disabled={!connected || !controlling || !snapshot} placeholder={controlling ? "Message this CLI…" : "Take control to send a message"} rows={1}
        onChange={(event) => updateDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (text.trim()) void send(); }
          else if (event.key === "Escape" && snapshot?.running && controlling) { event.preventDefault(); void stop(); }
        }} />
      <div className="flex items-center gap-2 px-2 py-1">
        <span className={cn(HINT, "flex-1")}>{controlling ? (snapshot?.running ? "Esc stops the turn" : "") : status?.inputOwner ? "Another view is typing in this agent" : "Viewing agent"}</span>
        <button type="submit" className={sendable.action === "stop" || sendable.action === "stopping" ? SEND_BUTTON_STOP : SEND_BUTTON_GO} aria-label={sendable.label} title={sendable.reason ?? sendable.label} disabled={sendable.disabled}
          onMouseDown={(event) => event.preventDefault()}>
          {sendable.action === "stop" || sendable.action === "stopping"
            ? <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="2" y="2" width="8" height="8" rx="1.5" /></svg>
            : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" /></svg>}
        </button>
      </div>
    </form>
  </div>;
}
