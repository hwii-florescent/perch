import { useEffect, useRef, useState } from "react";
import type { AgentLifecycleStatus } from "@perch/shared";
import { usePerchStore } from "../store";
import { socket } from "../ws";
import { openAgentTerminal } from "../agentTerminals";
import { createPerchTerminal, type PerchTerminal } from "../xtermSetup";
import { useTerminalSearch } from "../terminalSearch";
import { TerminalSearchBar } from "../components/TerminalSearchBar";
import { attachClipboardImagePaste } from "../clipboardImagePaste";

export function PersistentAgentTerminal({ sessionId, agent, cliError, onExitCli }: {
  sessionId: string; agent: string; cliError?: string | null; onExitCli?: () => void;
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
    const created = createPerchTerminal(container.current, (cols, rows) => {
      if (inputId.current) usePerchStore.getState().resizeTerminal(inputId.current, cols, rows);
    }, usePerchStore.getState().terminalProfile);
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
        created.term.write(replay, () => {
          suppressClipboard.dispose();
          replayDone = true;
          if (!disposed) { updateInput(); created.fit(); }
        });
      },
      (data) => { if (!disposed) created.term.write(data); },
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

  async function changeControl() {
    if (!binding.current || pending) return;
    setPending(true);
    setError(null);
    try {
      if (controlling) await binding.current.releaseControl();
      else await binding.current.takeControl();
      emulator.current?.fit();
    } catch (reason) { setError((reason as Error).message); }
    finally { setPending(false); }
  }
  // A hibernated agent has no process, so the pty closes exactly like an
  // exit — but its conversation is kept and reattaching resumes it. Saying
  // "exited (code 0)" for that would read as lost work.
  const sleeping = status?.state === "sleeping";
  const label = !connected ? "Reconnecting…" : sleeping ? "Agent sleeping" : exitCode !== null ? "Agent exited" : error && !terminalId ? "Agent unavailable" : !status ? "Opening agent…" : controlling ? "You control this agent" : status.inputOwner ? "Another viewer has control" : "Viewing agent";
  return <div className="terminal terminal--persistent" data-testid="persistent-agent-terminal" data-terminal-id={terminalId ?? undefined}>
    <div className="terminal__toolbar">
      <span role="status">{label}</span>
      {!terminalId && error && connected && <button type="button" disabled={pending} onClick={() => setRestart((value) => value + 1)}>Retry CLI</button>}
      {exitCode === null && <button type="button" disabled={!terminalId || pending || !connected} onClick={() => void changeControl()}>
        {pending ? "Updating control…" : controlling ? "Release control" : "Take control"}
      </button>}
      {exitCode === null && controlling && <button type="button" disabled={pending || !connected} onClick={() => binding.current?.stop()}>Stop CLI</button>}
    </div>
    <div className="terminal__surface" ref={container} />
    <TerminalSearchBar controller={search} />
    {(error || cliError) && <div className="terminal__cli-error" role="alert">{error || cliError}</div>}
    {(exitCode !== null || sleeping) && <div className="terminal__exited terminal__exited--cli" data-testid={sleeping ? "cli-sleeping" : "cli-exited"}>
      <span className="terminal__exited-text">{sleeping ? `${agent} is sleeping to save memory — its conversation is kept` : `${agent} exited (code ${exitCode})`}</span>
      <span className="terminal__exited-actions">
        <button type="button" className="terminal__exited-btn terminal__exited-btn--primary" data-testid={sleeping ? "cli-resume" : "cli-restart"} onClick={() => setRestart((value) => value + 1)}>{sleeping ? "Resume agent" : "Restart CLI"}</button>
        {onExitCli && <button type="button" className="terminal__exited-btn" onClick={onExitCli}>Back to Hosted</button>}
      </span>
    </div>}
  </div>;
}
