import { useEffect, useRef, useState } from "react";
import type { WorkspaceTerminal } from "@perch/shared";
import { usePerchStore } from "../store";
import { socket } from "../ws";
import { createPerchTerminal, type PerchTerminal } from "../xtermSetup";
import { useTerminalSearch } from "../terminalSearch";
import { TerminalSearchBar } from "../components/TerminalSearchBar";
import { attachClipboardImagePaste } from "../clipboardImagePaste";
import { closeWorkspaceTerminal, listWorkspaceTerminals, openWorkspaceTerminal } from "../workspaceTerminals";
import { getDockviewController } from "../dockview/dockviewController";
import { newId } from "../ids";

export function PersistentTerminal({ active, sessionId, paneId, layoutPanelId, onPaneChange }: {
  active: boolean; sessionId: string; paneId?: string; layoutPanelId?: string; onPaneChange?: (paneId: string) => void;
}) {
  const connected = usePerchStore((state) => state.connected);
  const container = useRef<HTMLDivElement>(null);
  const emulator = useRef<PerchTerminal | null>(null);
  const terminalId = useRef<string | null>(null);
  const explicitlyClosed = useRef(false);
  const [term, setTerm] = useState<PerchTerminal["term"] | null>(null);
  const [selected, setSelected] = useState<string | null>(paneId ?? null);
  const [terminals, setTerminals] = useState<WorkspaceTerminal[]>([]);
  const [current, setCurrent] = useState<WorkspaceTerminal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  const search = useTerminalSearch(term);

  useEffect(() => {
    if (!connected) return;
    let disposed = false;
    listWorkspaceTerminals(sessionId).then((rows) => {
      if (disposed) return;
      setTerminals(rows);
      setSelected((previous) => previous ?? (explicitlyClosed.current ? null : rows[0]?.paneId ?? "primary-shell"));
    }).catch((reason: Error) => { if (!disposed) setError(reason.message); });
    return () => { disposed = true; };
  }, [sessionId, connected]);

  useEffect(() => {
    if (!connected || !selected || !container.current) return;
    let disposed = false;
    let attachedId: string | null = null;
    let exited = false;
    let exitCode: number | undefined;
    terminalId.current = null;
    setCurrent(null);
    setError(null);
    setClosed(false);
    const created = createPerchTerminal(container.current, (cols, rows) => {
      if (terminalId.current) usePerchStore.getState().resizeTerminal(terminalId.current, cols, rows);
    }, usePerchStore.getState().terminalProfile);
    emulator.current = created;
    created.term.options.disableStdin = true;
    setTerm(created.term);
    const binding = openWorkspaceTerminal(sessionId, selected, created.term.cols, created.term.rows, (row, replay) => {
      if (disposed) return;
      attachedId = row.id;
      // Historical terminal queries must not send fresh responses to a shell
      // that already received them. xterm parses writes asynchronously, so
      // activate input only after the replay parser reaches this barrier.
      // Replaying an old OSC 52 must not copy into the user's clipboard again.
      const suppressClipboard = created.term.parser.registerOscHandler(52, () => true);
      created.term.write(replay, () => {
        suppressClipboard.dispose();
        if (!disposed) {
          terminalId.current = row.state === "running" && !exited ? row.id : null;
          created.term.options.disableStdin = terminalId.current === null;
          setCurrent(exited ? { ...row, state: "exited", exitCode } : row);
          created.fit();
        }
      });
      setTerminals((rows) => [...rows.filter((item) => item.id !== row.id), row]);
      usePerchStore.setState((state) => ({ terminals: { ...state.terminals, [row.id]: {
        id: row.id, cols: row.cols, rows: row.rows, exitCode: row.exitCode ?? null,
      } } }));
      created.fit();
    }, (data) => created.term.write(data));
    binding.ready.catch((reason: Error) => { if (!disposed) setError(reason.message); });
    const input = created.term.onData((data) => {
      if (terminalId.current) usePerchStore.getState().sendTerminalInput(terminalId.current, data);
    });
    const stopExit = socket.onMessage((message) => {
      if (message.type !== "terminal.exit" || message.terminalId !== attachedId) return;
      exited = true;
      exitCode = message.code;
      terminalId.current = null;
      created.term.options.disableStdin = true;
      setCurrent((row) => row && { ...row, state: "exited", exitCode: message.code });
    });
    const stopPaste = attachClipboardImagePaste(container.current, () => terminalId.current);
    return () => {
      disposed = true;
      terminalId.current = null;
      binding.release();
      input.dispose();
      stopPaste();
      stopExit();
      created.dispose();
      emulator.current = null;
    };
  }, [connected, sessionId, selected]);

  useEffect(() => { if (active) emulator.current?.fit(); }, [active, current]);

  async function closeShell() {
    if (!current || closing) return;
    setClosing(true);
    try {
      await closeWorkspaceTerminal(sessionId, current.id);
      explicitlyClosed.current = true;
      terminalId.current = null;
      setSelected(null);
      setTerminals((rows) => rows.filter((row) => row.id !== current.id));
      setCurrent(null);
      setClosed(true);
    } catch (reason) { setError((reason as Error).message); }
    finally { setClosing(false); }
  }

  const status = !connected ? "Reconnecting to shell…" : error ?? (closed ? "Shell closed." : current?.state === "lost"
    ? "This shell process is no longer available. Open a new shell to continue."
    : current?.state === "exited" ? `Shell exited (code ${current.exitCode ?? "unknown"}).`
    : !current ? "Opening shell…" : null);

  return <div className="terminal terminal--persistent" data-terminal-id={current?.id} data-pane-id={selected ?? undefined}>
    <div className="terminal__toolbar">
      {terminals.length > 0 && <select aria-label="Shell pane" disabled={closing || !connected} value={selected ?? ""} onChange={(event) => { explicitlyClosed.current = false; setSelected(event.target.value); onPaneChange?.(event.target.value); }}>
        {!selected && <option value="" disabled>Choose a shell</option>}
        {terminals.map((row, index) => <option key={row.id} value={row.paneId}>Shell {index + 1}{row.state === "lost" ? " · unavailable" : ""}</option>)}
      </select>}
      <span className="terminal__connection">{current?.state === "running" ? "Shell running" : "Shell"}</span>
      <button type="button" disabled={!connected || closing} onClick={() => {
        explicitlyClosed.current = false;
        if (layoutPanelId) getDockviewController()?.addTerminalTabInGroup(layoutPanelId);
        else setSelected(newId());
      }}>New shell</button>
      <button type="button" disabled={!connected || !current || closing} onClick={() => void closeShell()}>{closing ? "Closing…" : "Close shell"}</button>
    </div>
    <div className="terminal__surface" ref={container} />
    <TerminalSearchBar controller={search} />
    {status && <div className="terminal__notice" role={error ? "alert" : "status"}>{status}</div>}
  </div>;
}
