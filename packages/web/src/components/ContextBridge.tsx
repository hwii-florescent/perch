import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ContextAgent, ContextPacket, ContextSource } from "@perch/shared";
import { askAgent, requestContext, useContextBridge } from "../contextBridge";
import { usePerchStore } from "../store";
import { activateTab } from "../workspaceTabs";
import { newId } from "../ids";
import { Dialog } from "./ui/dialog";
import { Chevron } from "./ui/chevron";
import { GHOST_BUTTON } from "./ui/icon-button";
import { menuItem, menuPanel } from "./ui/menu";

const CONTROL = "min-h-11 w-full rounded-ui border border-overlay-0 bg-surface-0 px-2 py-2 text-[0.8rem] text-fg [font-family:inherit] focus-visible:outline focus-visible:outline-1 focus-visible:outline-fg";
const BUTTON = `${GHOST_BUTTON} min-h-11 px-3 text-[0.8rem] disabled:cursor-not-allowed disabled:opacity-40`;

export function ContextBridge() {
  const capture = useContextBridge((state) => state.capture);
  const menu = useContextBridge((state) => state.menu);
  return <>
    {menu && <TerminalMenu key={`${menu.x}:${menu.y}`} menu={menu} />}
    {capture && <ContextDialog key={capture.workspaceId} workspaceId={capture.workspaceId} source={capture.source} />}
  </>;
}

function TerminalMenu({ menu }: { menu: NonNullable<ReturnType<typeof useContextBridge.getState>["menu"]> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = () => useContextBridge.setState({ menu: null });
    const outside = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) close(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape" || event.key === "Tab") close(); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("blur", close);
    ref.current?.querySelector("button")?.focus();
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", key); window.removeEventListener("blur", close); };
  }, []);
  return createPortal(<div ref={ref} className={menuPanel} style={{ position: "fixed", zIndex: 2200, left: Math.max(8, Math.min(menu.x, window.innerWidth - 260)), top: Math.max(8, Math.min(menu.y, window.innerHeight - 72)) }}>
    <button type="button" className={menuItem()} onClick={() => askAgent(menu.workspaceId, menu.source)}>Ask agent about selection…</button>
  </div>, document.body);
}

function ContextDialog({ workspaceId, source }: { workspaceId: string; source: ContextSource }) {
  const [instruction, setInstruction] = useState("");
  const [preview, setPreview] = useState<{ packet: ContextPacket; instruction: string; agents: ContextAgent[] } | null>(null);
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const form = useRef<HTMLDivElement>(null);
  const sendLock = useRef(false);
  const connected = usePerchStore((state) => state.connected);
  const target = preview?.agents.find((agent) => agent.sessionId === targetId);
  const current = preview && preview.instruction === instruction;
  const ready = current && connected;
  const close = () => { if (!sendLock.current || !sending) useContextBridge.setState({ capture: null }); };

  // This dialog protects a deliberate send, so keep keyboard focus here and
  // return to the source without teaching the global Dialog a new lifecycle.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = form.current?.closest('[role="dialog"]');
    form.current?.querySelector("textarea")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); if (previous?.isConnected) previous.focus(); };
  }, []);

  useEffect(() => {
    if (attempted || !connected) return;
    let active = true;
    setPreview(null); setError(null); setNotice(null);
    const timer = setTimeout(() => {
      void requestContext({ type: "context.preview", requestId: newId(), workspaceId, source, instruction }).then((reply) => {
        if (active && reply.type === "context.preview.result" && reply.packet.workspaceId === workspaceId) setPreview({ packet: reply.packet, agents: reply.agents, instruction });
      }).catch((reason: Error) => { if (active) setError(reason.message); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [workspaceId, source, instruction, refresh, connected, attempted]);

  async function copy() {
    if (!current) return;
    try { await navigator.clipboard.writeText(preview.packet.markdown); setNotice("Context copied. Paste it when you are ready."); }
    catch { setError("Clipboard access was denied. Select and copy the prepared context below."); }
  }
  async function send() {
    if (sendLock.current || !ready || !target?.canSend) return;
    sendLock.current = true;
    setAttempted(true); setSending(true); setError(null); setNotice(null);
    // One operation id for this intent. Never retry uncertain delivery, even
    // after a transport reconnect; the core also durably deduplicates it.
    try {
      const reply = await requestContext({ type: "context.send", requestId: newId(), operationId: newId(), workspaceId, source, instruction, digest: preview.packet.digest, targetSessionId: target.sessionId });
      if (reply.type !== "agent.ui.result" || !reply.accepted || reply.sessionId !== target.sessionId) throw new Error("The agent did not confirm delivery. Inspect its CLI before sending again.");
      setDelivered(true); setNotice("Context delivered. The agent has started a turn in its existing CLI.");
    } catch (reason) { setError((reason as Error).message); }
    finally { setSending(false); }
  }
  const path = "path" in source ? source.path : null;
  const sensitive = path && /(^|\/)(\.env(?:\..*)?|id_(rsa|ed25519)|.*\.(pem|key))$/i.test(path);
  return <Dialog title="Ask agent about this" onClose={close} testId="context-bridge">
    <div ref={form} className="grid min-w-0 gap-3">
      <p className="m-0 break-words text-[0.78rem] text-subtext-0">{path ?? "Terminal selection"}{source.kind === "editor" ? ` · lines ${source.startLine}–${source.endLine}${source.dirty ? " · unsaved draft" : ""}` : ""}. Captured context stays unchanged; no files are saved.</p>
      <label className="grid gap-1 text-[0.78rem] text-fg">Question <span className="text-subtext-0">Optional — defaults to explaining and suggesting next steps.</span>
        <textarea className={`${CONTROL} min-h-20 resize-y`} aria-label="Question for agent" value={instruction} maxLength={4096} disabled={attempted} onChange={(event) => setInstruction(event.target.value)} />
      </label>
      {sensitive && <p className="m-0 text-[0.78rem] text-yellow" role="note">This file may contain secrets. Review every byte below before sharing.</p>}
      <label className="grid gap-1 text-[0.78rem] text-fg">Prepared context
        <textarea className={`${CONTROL} min-h-40 resize-y whitespace-pre [tab-size:2]`} aria-label="Prepared context" readOnly value={current ? preview.packet.markdown : ""} placeholder={error ? "Context unavailable" : "Preparing context…"} />
      </label>
      <label className="grid gap-1 text-[0.78rem] text-fg">Agent in this nest
        <span className="relative block">
        <select className={`${CONTROL} appearance-none pr-8`} aria-label="Agent in this nest" value={targetId} disabled={attempted || !ready} onChange={(event) => setTargetId(event.target.value)}>
          <option value="">Choose an agent…</option>
          {preview?.agents.map((agent) => <option key={agent.sessionId} value={agent.sessionId}>{agent.title} · {agent.providerId}{agent.canSend ? "" : " · copy only"}</option>)}
        </select>
        <Chevron open className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
        </span>
      </label>
      <p className="m-0 text-[0.75rem] text-subtext-0">{target?.reason || (ready && !preview.agents.length ? "No agents in this nest. Close this dialog and start one from +, then try again. Nothing is started here." : "Send starts a turn in an existing Claude CLI with an empty prompt. Other agents support Copy context. Nothing is sent until you click Send.")}</p>
      {!connected && <p className="m-0 text-[0.78rem] text-subtext-0" role="status">Disconnected. Prepared context can still be copied; reconnect before sending.</p>}
      {notice && <p className="m-0 text-[0.78rem] text-fg" role="status">{notice}</p>}
      {error && <p className="m-0 break-words text-[0.78rem] text-red" role="alert">{error}</p>}
      <div className="flex flex-wrap justify-end gap-1">
        <button type="button" className={BUTTON} disabled={sending} onClick={close}>{delivered ? "Done" : "Cancel"}</button>
        {!attempted && <button type="button" className={BUTTON} onClick={() => setRefresh((value) => value + 1)} disabled={sending}>Refresh preview</button>}
        <button type="button" className={BUTTON} disabled={!current || sending} onClick={() => void copy()}>Copy context</button>
        {delivered && target ? <button type="button" className={BUTTON} onClick={() => { const session = usePerchStore.getState().sessions.find((session) => session.id === target.sessionId); if (session) { activateTab({ kind: "session", id: session.id, session }); close(); } else setError("This agent was closed. Your prepared context is still available to copy."); }}>Open agent</button>
          : <button type="button" className={`${BUTTON} bg-surface-1 text-fg`} disabled={!ready || !target?.canSend || attempted} onClick={() => void send()}>{sending ? "Sending…" : "Send to agent"}</button>}
      </div>
    </div>
  </Dialog>;
}
