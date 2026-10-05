import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
import { KeptTerminal, forgetTerminal, showTerminal } from "../terminalKeeper";

interface ShellState { current: WorkspaceTerminal | null; error: string | null }
const OPENING: ShellState = { current: null, error: null };
export const shellTerminalKey = (sessionId: string, paneId: string) => `shell\0${sessionId}\0${paneId}`;

/** One shell pane's terminal and connection, kept across unmounts
 * (`terminalKeeper.ts`). */
class ShellView extends KeptTerminal<ShellState> {
  readonly created: PerchTerminal;
  /** The terminal id while its shell runs. */
  inputId: string | null = null;
  private stop: () => void;

  constructor(sessionId: string, paneId: string, container: HTMLElement) {
    super(OPENING, container);
    let attachedId: string | null = null;
    let exited = false;
    let exitCode: number | undefined;
    const created = createPerchTerminal(this.host, (cols, rows) => {
      if (this.inputId) usePerchStore.getState().resizeTerminal(this.inputId, cols, rows);
    }, usePerchStore.getState().terminalProfile);
    this.created = created;
    created.term.options.disableStdin = true;
    const binding = openWorkspaceTerminal(sessionId, paneId, created.term.cols, created.term.rows, (row, replay) => {
      if (this.disposed) return;
      attachedId = row.id;
      // Historical terminal queries must not send fresh responses to a shell
      // that already received them. xterm parses writes asynchronously, so
      // activate input only after the replay parser reaches this barrier.
      // Replaying an old OSC 52 must not copy into the user's clipboard again.
      const suppressClipboard = created.term.parser.registerOscHandler(52, () => true);
      created.term.write(replay, () => {
        suppressClipboard.dispose();
        if (!this.disposed) {
          this.inputId = row.state === "running" && !exited ? row.id : null;
          created.term.options.disableStdin = this.inputId === null;
          this.set({ current: exited ? { ...row, state: "exited", exitCode } : row });
          created.fit();
        }
      });
      usePerchStore.setState((state) => ({ terminals: { ...state.terminals, [row.id]: {
        id: row.id, cols: row.cols, rows: row.rows, exitCode: row.exitCode ?? null,
      } } }));
      created.fit();
    }, (data) => created.term.write(data));
    binding.ready.catch((reason: Error) => { if (!this.disposed) this.set({ error: reason.message }); });
    const input = created.term.onData((data) => {
      if (this.inputId) usePerchStore.getState().sendTerminalInput(this.inputId, data);
    });
    const stopExit = socket.onMessage((message) => {
      if (message.type !== "terminal.exit" || message.terminalId !== attachedId) return;
      exited = true;
      exitCode = message.code;
      this.inputId = null;
      created.term.options.disableStdin = true;
      const current = this.state.current;
      if (current) this.set({ current: { ...current, state: "exited", exitCode: message.code } });
    });
    this.stop = () => { binding.release(); input.dispose(); stopExit(); created.dispose(); };
  }

  protected teardown() {
    this.inputId = null;
    this.stop();
  }
}

export function PersistentTerminal({ active, sessionId, paneId, layoutPanelId, onPaneChange }: {
  active: boolean; sessionId: string; paneId?: string; layoutPanelId?: string; onPaneChange?: (paneId: string) => void;
}) {
  const connected = usePerchStore((state) => state.connected);
  const container = useRef<HTMLDivElement>(null);
  const explicitlyClosed = useRef(false);
  const [view, setView] = useState<ShellView | null>(null);
  const [selected, setSelected] = useState<string | null>(paneId ?? null);
  const [terminals, setTerminals] = useState<WorkspaceTerminal[]>([]);
  const [listError, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  const shell = useSyncExternalStore(view?.subscribe ?? noSubscription, view?.getState ?? openingState);
  const current = closed ? null : shell.current;
  const error = listError ?? shell.error;
  const search = useTerminalSearch(view?.created.term ?? null);

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
    setClosed(false);
    const surface = container.current;
    const shown = showTerminal(shellTerminalKey(sessionId, selected), sessionId, surface, () => new ShellView(sessionId, selected, surface));
    setView(shown.view);
    const stopPaste = attachClipboardImagePaste(surface, () => shown.view.inputId);
    return () => { stopPaste(); shown.hide(); };
  }, [connected, sessionId, selected]);

  useEffect(() => {
    if (current) setTerminals((rows) => [...rows.filter((item) => item.id !== current.id), current]);
  }, [current]);

  useEffect(() => { if (active) view?.created.fit(); }, [active, current, view]);

  async function closeShell() {
    if (!current || closing) return;
    setClosing(true);
    try {
      await closeWorkspaceTerminal(sessionId, current.id);
      explicitlyClosed.current = true;
      if (selected) forgetTerminal(shellTerminalKey(sessionId, selected));
      setSelected(null);
      setTerminals((rows) => rows.filter((row) => row.id !== current.id));
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

const noSubscription = () => () => {};
const openingState = () => OPENING;
