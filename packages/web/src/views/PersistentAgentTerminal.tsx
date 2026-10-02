import { useEffect, useRef, useState } from "react";
import type { AgentLifecycleStatus } from "@perch/shared";
import { usePerchStore } from "../store";
import { socket } from "../ws";
import { openAgentTerminal } from "../agentTerminals";
import { createPerchTerminal, type PerchTerminal } from "../xtermSetup";
import { useTerminalSearch } from "../terminalSearch";
import { TerminalSearchBar } from "../components/TerminalSearchBar";
import { attachClipboardImagePaste } from "../clipboardImagePaste";

/** The PTY's size, in-band in its output (`terminal::pty_size_marker`). */
const SIZE_MARKER = /\x1b\[8;(\d+);(\d+)t/g;

export function PersistentAgentTerminal({ sessionId, agent, cliError, onClose }: {
  sessionId: string; agent: string; cliError?: string | null; onClose?: () => void;
}) {
  const connected = usePerchStore((state) => state.connected);
  const container = useRef<HTMLDivElement>(null);
  const emulator = useRef<PerchTerminal | null>(null);
  const binding = useRef<ReturnType<typeof openAgentTerminal> | null>(null);
  const inputId = useRef<string | null>(null);
  const [term, setTerm] = useState<PerchTerminal["term"] | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [status, setStatus] = useState<AgentLifecycleStatus | null>(null);
  const [controlling, setControlling] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [restart, setRestart] = useState(0);
  const search = useTerminalSearch(term);

  useEffect(() => {
    if (!connected || !container.current) return;
    let disposed = false;
    let attachedId: string | null = null;
    let replayDone = false;
    let ownsInput = false;
    let exited = false;
    let initialControl = false;
    let responses = "";
    inputId.current = null;
    setTerminalId(null);
    setStatus(null);
    setError(null);
    setPending(false);
    setExitCode(null);
    setControlling(false);
    // Until attached, the fitted size is what a new PTY starts at; after,
    // only the controlling view sizes it and the others follow its markers.
    const created = createPerchTerminal(container.current, (cols, rows) => {
      if (inputId.current) usePerchStore.getState().resizeTerminal(inputId.current, cols, rows);
    }, usePerchStore.getState().terminalProfile, () => !attachedId || ownsInput);
    function write(data: string, callback?: () => void) {
      let last = 0;
      for (const match of data.matchAll(SIZE_MARKER)) {
        created.term.write(data.slice(last, match.index));
        created.follow(Number(match[2]), Number(match[1]));
        last = match.index + match[0].length;
      }
      created.term.write(data.slice(last), callback);
    }
    emulator.current = created;
    created.term.options.disableStdin = true;
    setTerm(created.term);
    function updateInput() {
      inputId.current = !disposed && replayDone && ownsInput && !exited ? attachedId : null;
      created.term.options.disableStdin = inputId.current === null;
      if (inputId.current && responses) {
        usePerchStore.getState().sendTerminalInput(inputId.current, responses);
        responses = "";
      }
    }
    const opened = openAgentTerminal(sessionId, agent, created.term.cols, created.term.rows,
      (id, snapshot, replay) => {
        if (disposed) return;
        attachedId = id;
        setTerminalId(id);
        setStatus(snapshot);
        initialControl = !snapshot.inputOwner;
        const suppressClipboard = created.term.parser.registerOscHandler(52, () => true);
        write(replay, () => {
          suppressClipboard.dispose();
          replayDone = true;
          if (!disposed) { updateInput(); created.fit(); }
        });
      },
      (data) => { if (!disposed) write(data); },
      (snapshot, owned) => {
        if (disposed) return;
        ownsInput = owned;
        setStatus(snapshot);
        setControlling(owned);
        updateInput();
      },
      () => ({ cols: created.term.cols, rows: created.term.rows }),
    );
    binding.current = opened;
    opened.ready.then(async () => {
      if (!disposed && initialControl) {
        setPending(true);
        try { await opened.takeControl(); }
        catch (reason) { if (!disposed) setError((reason as Error).message); }
        finally { initialControl = false; responses = ""; if (!disposed) { setPending(false); created.fit(); } }
      }
    }).catch((reason: Error) => { if (!disposed) setError(reason.message); });
    const input = created.term.onData((data) => {
      if (inputId.current) usePerchStore.getState().sendTerminalInput(inputId.current, data);
      // Historical queries are dropped. Fresh startup queries can wait for
      // this viewer's initial lease without accepting keyboard input early.
      else if (replayDone && initialControl && !ownsInput && !exited && responses.length + data.length <= 2048) responses += data;
    });
    const stopExit = socket.onMessage((message) => {
      if (message.type !== "terminal.exit" || message.terminalId !== attachedId) return;
      exited = true;
      ownsInput = false;
      inputId.current = null;
      created.term.options.disableStdin = true;
      setControlling(false);
      setExitCode(message.code);
    });
    const stopPaste = attachClipboardImagePaste(container.current, () => inputId.current);
    return () => {
      disposed = true;
      inputId.current = null;
      binding.current = null;
      opened.release();
      input.dispose();
      stopExit();
      stopPaste();
      created.dispose();
      emulator.current = null;
    };
  }, [connected, sessionId, agent, restart]);

  // The agent and the shell it runs in have both exited (the user left the
  // shell): the session is done, so close it like its tab's ×. Hibernation
  // also closes the pty but leaves the agent `sleeping`, never `exited`.
  const finished = exitCode !== null && status?.state === "exited";
  useEffect(() => {
    if (finished) onClose?.();
  }, [finished, onClose]);

  async function takeControl() {
    if (!binding.current || pending) return;
    setPending(true);
    setError(null);
    try {
      await binding.current.takeControl();
      emulator.current?.fit();
    } catch (reason) { setError((reason as Error).message); }
    finally { setPending(false); }
  }
  // A hibernated agent has no process, so the pty closes exactly like an
  // exit — but its conversation is kept and reattaching resumes it. Saying
  // "exited (code 0)" for that would read as lost work.
  const sleeping = status?.state === "sleeping";
  // Only a view that can't type gets a bar: driving the agent is the normal
  // case and needs no chrome. Taking control moves it from any other view.
  const label = !connected ? "Reconnecting…" : sleeping || exitCode !== null ? null : error && !terminalId ? "Agent unavailable" : !status ? "Opening agent…" : controlling ? null : status.inputOwner ? "Another view is typing in this agent" : "Viewing agent";
  return <div className="terminal terminal--persistent" data-testid="persistent-agent-terminal" data-terminal-id={terminalId ?? undefined} data-controlling={controlling || undefined}>
    {label && <div className="terminal__toolbar terminal__toolbar--overlay">
      <span role="status">{label}</span>
      {!terminalId && error && connected && <button type="button" disabled={pending} onClick={() => setRestart((value) => value + 1)}>Retry CLI</button>}
      {terminalId && status && !controlling && <button type="button" disabled={pending || !connected} onClick={() => void takeControl()}>
        {pending ? "Taking control…" : "Take control"}
      </button>}
    </div>}
    <div className="terminal__surface" ref={container} />
    <TerminalSearchBar controller={search} />
    {(error || cliError) && <div className="terminal__cli-error" role="alert">{error || cliError}</div>}
    {(exitCode !== null || sleeping) && <div className="terminal__exited terminal__exited--cli" data-testid={sleeping ? "cli-sleeping" : "cli-exited"}>
      <span className="terminal__exited-text">{sleeping ? `${agent} is sleeping to save memory — its conversation is kept` : `${agent} exited (code ${exitCode})`}</span>
      <span className="terminal__exited-actions">
        <button type="button" className="terminal__exited-btn terminal__exited-btn--primary" data-testid={sleeping ? "cli-resume" : "cli-restart"} onClick={() => setRestart((value) => value + 1)}>{sleeping ? "Resume agent" : "Restart CLI"}</button>
        {onClose && <button type="button" className="terminal__exited-btn" data-testid="cli-close-session" onClick={onClose}>Close session</button>}
      </span>
    </div>}
  </div>;
}
