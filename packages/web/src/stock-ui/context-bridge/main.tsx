//! Ask agent, the stock screen `stock:context-bridge`: Context Bridge's UI. The terminal selection's small menu ("Ask
//! agent about selection…") and the dialog that prepares context (a file, an editor selection, a terminal selection,
//! a review comment) and sends it to an agent of the workspace only when the person clicks Send
//! (docs/CONTEXT-BRIDGE.md). Perch opens them; or the person's package chosen for it
//! (`perch mod use stock:context-bridge <id>`) with the same props.
//!
//! The contract is Perch's and a copy cannot change it: `actions.preview` asks the core to prepare the packet (the
//! captured context never changes), `actions.send` is the one explicit send of this capture (Perch keeps one
//! operation id, never retries an uncertain delivery, refuses a second send, and the core also deduplicates and
//! rejects a changed digest), and `sendState` says how far it got, so a copy shown mid-send shows the same. The
//! wording, layout and focus handling are this screen's. The shell is `Dialog` and the agent choice `Select` from
//! `@perch/sdk`.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:context-bridge` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog, ghostButton as GHOST_BUTTON, menuItemClass as menuItem, menuPanel, Select, Slot, type ContextBridgeScreenProps, type ContextPreview } from "@perch/sdk";

const CONTROL = "min-h-11 w-full rounded-ui bg-surface-0 px-2 py-2 text-[0.8rem] text-fg [font-family:inherit] focus-visible:outline focus-visible:outline-1 focus-visible:outline-fg";
const BUTTON = `${GHOST_BUTTON} min-h-11 px-3 text-[0.8rem] disabled:cursor-not-allowed disabled:opacity-40`;

export default function ContextBridge({ menu, capture, connected, sendState, actions }: ContextBridgeScreenProps) {
  return <>
    {menu && <TerminalMenu key={`${menu.x}:${menu.y}`} menu={menu} actions={actions} />}
    {capture && <ContextDialog key={capture.id} capture={capture} connected={connected} sendState={sendState} actions={actions} />}
  </>;
}

function TerminalMenu({ menu, actions }: Pick<ContextBridgeScreenProps, "actions"> & { menu: NonNullable<ContextBridgeScreenProps["menu"]> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = actions.closeMenu;
    const outside = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) close(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape" || event.key === "Tab") close(); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("blur", close);
    ref.current?.querySelector("button")?.focus();
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", key); window.removeEventListener("blur", close); };
  }, [actions]);
  return createPortal(<div ref={ref} className={menuPanel} style={{ position: "fixed", zIndex: 2200, left: Math.max(8, Math.min(menu.x, window.innerWidth - 260)), top: Math.max(8, Math.min(menu.y, window.innerHeight - 72)) }}>
    <Slot
      name="terminal-menu"
      data={{ x: menu.x, y: menu.y, workspaceId: menu.workspaceId, sessionId: menu.sessionId, selection: menu.selection }}
      actions={{ ask: actions.ask, close: actions.closeMenu }}
    >
      <button type="button" className={menuItem()} onClick={actions.ask}>Ask agent about selection…</button>
    </Slot>
  </div>, document.body);
}

function ContextDialog({ capture, connected, sendState, actions }: Omit<ContextBridgeScreenProps, "menu" | "capture"> & { capture: NonNullable<ContextBridgeScreenProps["capture"]> }) {
  const { source } = capture;
  // A send already made for this capture (this or an earlier copy of the screen) is shown as it was made.
  const sent = sendState.sent;
  const [instruction, setInstruction] = useState(sent?.instruction ?? "");
  const [preview, setPreview] = useState<(ContextPreview & { instruction: string }) | null>(sent ? { ...sent.preview, instruction: sent.instruction } : null);
  const [targetId, setTargetId] = useState(sent?.targetSessionId ?? "");
  const [error, setError] = useState<string | null>(sendState.error ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const form = useRef<HTMLDivElement>(null);
  const { attempted, sending, delivered } = sendState;
  const target = preview?.agents.find((agent) => agent.sessionId === targetId);
  const current = preview && preview.instruction === instruction;
  const ready = current && connected;
  const close = actions.close;

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
      void actions.preview(instruction).then((reply) => {
        if (active) setPreview({ ...reply, instruction });
      }).catch((reason: Error) => { if (active) setError(reason.message); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [actions, instruction, refresh, connected, attempted]);

  async function copy() {
    if (!current) return;
    try { await navigator.clipboard.writeText(preview.packet.markdown); setNotice("Context copied. Paste it when you are ready."); }
    catch { setError("Clipboard access was denied. Select and copy the prepared context below."); }
  }
  async function send() {
    if (attempted || !ready || !target?.canSend) return;
    setError(null); setNotice(null);
    // Perch sends once for this capture (one operation id, never retried); a second call is refused.
    try {
      await actions.send({ instruction, preview, targetSessionId: target.sessionId });
      setNotice("Context delivered. The agent has started a turn in its existing CLI.");
    } catch (reason) { setError((reason as Error).message); }
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
      <label className="grid gap-1 text-[0.78rem] text-fg">Agent in this workspace
        <Select className={CONTROL} ariaLabel="Agent in this workspace" value={targetId} disabled={attempted || !ready} onChange={setTargetId}
          options={[{ value: "", label: "Choose an agent…" }, ...(preview?.agents.map((agent) => ({ value: agent.sessionId, label: `${agent.title} · ${agent.providerId}${agent.canSend ? "" : " · copy only"}` })) ?? [])]} />
      </label>
      <p className="m-0 text-[0.75rem] text-subtext-0">{target?.reason || (ready && !preview.agents.length ? "No agents in this nest. Close this dialog and start one from +, then try again. Nothing is started here." : "Send starts a turn in an existing Claude CLI with an empty prompt. Other agents support Copy context. Nothing is sent until you click Send.")}</p>
      {!connected && <p className="m-0 text-[0.78rem] text-subtext-0" role="status">Disconnected. Prepared context can still be copied; reconnect before sending.</p>}
      {notice && <p className="m-0 text-[0.78rem] text-fg" role="status">{notice}</p>}
      {error && <p className="m-0 break-words text-[0.78rem] text-red" role="alert">{error}</p>}
      <div className="flex flex-wrap justify-end gap-1">
        <button type="button" className={BUTTON} disabled={sending} onClick={close}>{delivered ? "Done" : "Cancel"}</button>
        {!attempted && <button type="button" className={BUTTON} onClick={() => setRefresh((value) => value + 1)} disabled={sending}>Refresh preview</button>}
        <button type="button" className={BUTTON} disabled={!current || sending} onClick={() => void copy()}>Copy context</button>
        {delivered && target ? <button type="button" className={BUTTON} onClick={() => { if (actions.openAgent(target.sessionId)) close(); else setError("This agent was closed. Your prepared context is still available to copy."); }}>Open agent</button>
          : <button type="button" className={`${BUTTON} bg-surface-1 text-fg`} disabled={!ready || !target?.canSend || attempted} onClick={() => void send()}>{sending ? "Sending…" : "Send to agent"}</button>}
      </div>
    </div>
  </Dialog>;
}
