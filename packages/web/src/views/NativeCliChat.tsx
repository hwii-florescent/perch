import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { AgentLifecycleStatus, NativeUiMessage, NativeUiSnapshot } from "@perch/shared";
import { usePerchStore } from "../store";
import { openAgentTerminal, agentInputGeneration } from "../agentTerminals";
import { requestNativeUi, subscribeNativeUi } from "../nativeUi";
import { socket } from "../ws";
import { renderMarkdown } from "../markdown";

// Keep drafts and retry identities across UI/CLI switches, bounded like the
// transcript. A lost acknowledgement never turns Retry into a new operation.
const drafts = new Map<string, { text: string; operationId: string }>();
const NativeMessage = memo(function NativeMessage({ message, streaming }: { message: NativeUiMessage; streaming: boolean }) {
  const html = useMemo(() => message.role === "assistant" ? renderMarkdown(message.text, streaming) : "", [message.role, message.text, streaming]);
  return <article className={`message message--${message.role === "user" ? "user" : "assistant"}`} data-native-role={message.role}>
    {message.thinking && <details className="message__worked-for"><summary>Thinking</summary><pre>{message.thinking}</pre></details>}
    {message.tools.map((tool, index) => <details className="message__worked-for" key={`${index}-${tool.name}`}><summary>{tool.name}</summary><pre>{tool.input}</pre></details>)}
    {message.role === "toolResult" ? <details className="message__worked-for"><summary>{message.toolName ?? "Tool"} result</summary><pre>{message.text}</pre></details>
      : message.role === "assistant" ? <div className="message__markdown" dangerouslySetInnerHTML={{ __html: html }} />
      : <div className="message__text">{message.text}</div>}
    {message.error && <div className="message__error" role="alert">{message.error}</div>}
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
    setSnapshot(null); setError(null); setControlling(false); setPending(false); setExited(false);
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
      const history = requestNativeUi({ type: "agent.ui.get", requestId: crypto.randomUUID(), sessionId, providerId });
      if (initiallyUnowned) await opened.takeControl().catch((reason: Error) => { if (!disposed) setError(reason.message); });
      await history;
    }).catch((reason: Error) => { if (!disposed) setError(reason.message); });
    return () => { disposed = true; unsubscribe(); stopExit(); opened.release(); binding.current = null; terminalId.current = null; };
  }, [connected, sessionId, providerId, retry]);
  useEffect(() => { if (atBottom.current && list.current) list.current.scrollTop = list.current.scrollHeight; }, [snapshot]);
  function updateDraft(value: string) {
    if (new TextEncoder().encode(value).length > 64 * 1024) return;
    setText(value);
    drafts.set(draftKey, { text: value, operationId: crypto.randomUUID() });
    if (drafts.size > 128) drafts.delete(drafts.keys().next().value!);
  }
  async function changeControl() {
    if (!binding.current || pending) return;
    setPending(true); setError(null);
    try { await (controlling ? binding.current.releaseControl() : binding.current.takeControl()); }
    catch (reason) { setError((reason as Error).message); }
    finally { setPending(false); }
  }
  async function send(cancel = false) {
    const generation = terminalId.current ? agentInputGeneration(terminalId.current) : undefined;
    if (generation === undefined || pending || !connected || (!cancel && !text.trim())) return;
    const draft = drafts.get(draftKey) ?? { text, operationId: crypto.randomUUID() };
    drafts.set(draftKey, draft);
    setPending(true); setError(null);
    try {
      const base = { requestId: crypto.randomUUID(), sessionId, providerId, generation };
      const reply = await requestNativeUi(cancel ? { type: "agent.ui.cancel", ...base } : { type: "agent.ui.prompt", ...base, ...draft });
      if (reply.type !== "agent.ui.result" || !reply.accepted) throw new Error("The CLI did not accept this action.");
      if (!cancel && drafts.get(draftKey)?.operationId === draft.operationId) { drafts.delete(draftKey); setText(""); }
    } catch (reason) { setError((reason as Error).message); }
    finally { setPending(false); }
  }
  const label = !connected ? "Reconnecting…" : exited ? "CLI exited" : !snapshot ? "Connecting to CLI…" : snapshot.running ? "Working" : "Ready";
  return <div className="native-cli-chat" data-testid="native-cli-chat" data-provider={providerId} data-native-pid={snapshot?.pid} data-native-session={snapshot?.providerSessionId}>
    <div className="terminal__toolbar native-cli-chat__toolbar">
      <span role="status">{label}</span>
      {snapshot?.model && <span className="native-cli-chat__model" title={snapshot.model}>{snapshot.model}</span>}
      <button type="button" disabled={!status || !connected || pending || exited} onClick={() => void changeControl()}>{controlling ? "Release control" : "Take control"}</button>
    </div>
    <div className="chat__list-container">
      <div className="chat__list" ref={list} onScroll={() => { if (list.current) { atBottom.current = list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight < 64; setShowBottom(!atBottom.current); } }}>
        {snapshot?.truncated && <p className="native-cli-chat__hint">Showing recent messages. The complete conversation remains in the CLI.</p>}
        {snapshot && !snapshot.messages.length && <p className="native-cli-chat__hint">Start a conversation with {providerId === "omp" ? "OMP" : providerId === "claude" ? "Claude Code" : "Pi"}. You can switch to CLI at any time.</p>}
        {snapshot?.messages.map((message, index) => <NativeMessage key={message.id} message={message} streaming={snapshot.running && index === snapshot.messages.length - 1} />)}
      </div>
      {showBottom && <button className="scroll-bottom-pill" type="button" onClick={() => { atBottom.current = true; setShowBottom(false); if (list.current) list.current.scrollTop = list.current.scrollHeight; }}>↓ Bottom</button>}
    </div>
    {error && <div className="terminal__cli-error" role="alert">{error} {!snapshot && !exited && <button type="button" onClick={() => setRetry((value) => value + 1)}>Reconnect UI</button>}</div>}
    <form className="chat__input native-cli-chat__input" onSubmit={(event) => { event.preventDefault(); void send(); }}>
      <textarea aria-label="Message CLI" data-testid="native-cli-composer" value={text} disabled={!connected || !controlling || !snapshot} placeholder={controlling ? "Message this CLI…" : "Take control to send a message"} rows={3} onChange={(event) => updateDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
      <div className="native-cli-chat__actions">
        <span className="native-cli-chat__hint">{controlling ? "You control this agent" : status?.inputOwner ? "Another viewer has control" : "Viewing agent"}</span>
        {snapshot?.running && <button type="button" disabled={!controlling || !connected || pending} onClick={() => void send(true)}>Cancel turn</button>}
        <button type="submit" disabled={!controlling || !connected || !snapshot || !text.trim() || pending}>{pending ? "Sending…" : snapshot?.running ? "Queue message" : "Send"}</button>
      </div>
    </form>
  </div>;
}
