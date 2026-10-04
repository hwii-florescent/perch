import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AgentLifecycleStatus } from "@perch/shared";
import { usePerchStore } from "../store";
import { socket } from "../ws";
import { openAgentTerminal } from "../agentTerminals";
import { createPerchTerminal, type PerchTerminal } from "../xtermSetup";
import { useTerminalSearch } from "../terminalSearch";
import { TerminalSearchBar } from "../components/TerminalSearchBar";
import { attachClipboardImagePaste } from "../clipboardImagePaste";
import { KeptTerminal, forgetTerminal, showTerminal } from "../terminalKeeper";

/** The PTY's size, in-band in its output (`terminal::pty_size_marker`). */
const SIZE_MARKER = /\x1b\[8;(\d+);(\d+)t/g;

interface ViewState {
  terminalId: string | null;
  status: AgentLifecycleStatus | null;
  controlling: boolean;
  pending: boolean;
  error: string | null;
  exitCode: number | null;
}
const OPENING: ViewState = { terminalId: null, status: null, controlling: false, pending: false, error: null, exitCode: null };

/** One agent terminal and its connection, kept across unmounts
 * (`terminalKeeper.ts`). */
class AgentView extends KeptTerminal<ViewState> {
  readonly created: PerchTerminal;
  /** The terminal id while this view may type into it. */
  inputId: string | null = null;
  private binding: ReturnType<typeof openAgentTerminal>;
  private stop: () => void;

  constructor(sessionId: string, agent: string, container: HTMLElement) {
    super(OPENING, container);
    let attachedId: string | null = null;
    let replayDone = false;
    let ownsInput = false;
    let exited = false;
    let initialControl = false;
    let responses = "";
    // Until attached, the fitted size is what a new PTY starts at; after,
    // only the controlling view sizes it and the others follow its markers.
    const created = createPerchTerminal(this.host, (cols, rows) => {
      if (this.inputId) usePerchStore.getState().resizeTerminal(this.inputId, cols, rows);
    }, usePerchStore.getState().terminalProfile, () => !attachedId || ownsInput);
    this.created = created;
    const write = (data: string, callback?: () => void) => {
      let last = 0;
      for (const match of data.matchAll(SIZE_MARKER)) {
        created.term.write(data.slice(last, match.index));
        created.follow(Number(match[2]), Number(match[1]));
        last = match.index + match[0].length;
      }
      created.term.write(data.slice(last), callback);
    };
    created.term.options.disableStdin = true;
    const updateInput = () => {
      this.inputId = !this.disposed && replayDone && ownsInput && !exited ? attachedId : null;
      created.term.options.disableStdin = this.inputId === null;
      if (this.inputId && responses) {
        usePerchStore.getState().sendTerminalInput(this.inputId, responses);
        responses = "";
      }
    };
    const opened = openAgentTerminal(sessionId, agent, created.term.cols, created.term.rows,
      (id, snapshot, replay) => {
        if (this.disposed) return;
        attachedId = id;
        this.set({ terminalId: id, status: snapshot });
        initialControl = !snapshot.inputOwner;
        const suppressClipboard = created.term.parser.registerOscHandler(52, () => true);
        write(replay, () => {
          suppressClipboard.dispose();
          replayDone = true;
          if (!this.disposed) { updateInput(); created.fit(); }
        });
      },
      (data) => { if (!this.disposed) write(data); },
      (snapshot, owned) => {
        if (this.disposed) return;
        ownsInput = owned;
        this.set({ status: snapshot, controlling: owned });
        updateInput();
      },
      () => ({ cols: created.term.cols, rows: created.term.rows }),
    );
    this.binding = opened;
    opened.ready.then(async () => {
      if (!this.disposed && initialControl) {
        this.set({ pending: true });
        try { await opened.takeControl(); }
        catch (reason) { if (!this.disposed) this.set({ error: (reason as Error).message }); }
        finally { initialControl = false; responses = ""; if (!this.disposed) { this.set({ pending: false }); created.fit(); } }
      }
    }).catch((reason: Error) => { if (!this.disposed) this.set({ error: reason.message }); });
    const input = created.term.onData((data) => {
      if (this.inputId) usePerchStore.getState().sendTerminalInput(this.inputId, data);
      // Historical queries are dropped. Fresh startup queries can wait for
      // this viewer's initial lease without accepting keyboard input early.
      else if (replayDone && initialControl && !ownsInput && !exited && responses.length + data.length <= 2048) responses += data;
    });
    const stopExit = socket.onMessage((message) => {
      if (message.type !== "terminal.exit" || message.terminalId !== attachedId) return;
      exited = true;
      ownsInput = false;
      this.inputId = null;
      created.term.options.disableStdin = true;
      this.set({ controlling: false, exitCode: message.code });
    });
    this.stop = () => { opened.release(); input.dispose(); stopExit(); created.dispose(); };
  }

  async takeControl() {
    if (this.state.pending) return;
    this.set({ pending: true, error: null });
    try {
      await this.binding.takeControl();
      this.created.fit();
    } catch (reason) { this.set({ error: (reason as Error).message }); }
    finally { this.set({ pending: false }); }
  }

  protected teardown() {
    this.inputId = null;
    this.stop();
  }
}

const keyOf = (sessionId: string, agent: string) => `agent\0${sessionId}\0${agent}`;

export function PersistentAgentTerminal({ sessionId, agent, cliError, onClose }: {
  sessionId: string; agent: string; cliError?: string | null; onClose?: () => void;
}) {
  const connected = usePerchStore((state) => state.connected);
  const container = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<AgentView | null>(null);
  const [restart, setRestart] = useState(0);
  const { terminalId, status, controlling, pending, error, exitCode } = useSyncExternalStore(
    view?.subscribe ?? noSubscription, view?.getState ?? openingState,
  );
  const search = useTerminalSearch(view?.created.term ?? null);

  useEffect(() => {
    if (!connected || !container.current) return;
    const surface = container.current;
    const shown = showTerminal(keyOf(sessionId, agent), sessionId, surface, () => new AgentView(sessionId, agent, surface));
    setView(shown.view);
    const stopPaste = attachClipboardImagePaste(container.current, () => shown.view.inputId);
    return () => { stopPaste(); shown.hide(); };
  }, [connected, sessionId, agent, restart]);

  function startOver() {
    forgetTerminal(keyOf(sessionId, agent));
    setRestart((value) => value + 1);
  }

  // The agent and the shell it runs in have both exited (the user left the
  // shell): the session is done, so close it like its tab's ×. Hibernation
  // also closes the pty but leaves the agent `sleeping`, never `exited`.
  const finished = exitCode !== null && status?.state === "exited";
  useEffect(() => {
    if (finished) onClose?.();
  }, [finished, onClose]);

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
      {!terminalId && error && connected && <button type="button" disabled={pending} onClick={startOver}>Retry CLI</button>}
      {terminalId && status && !controlling && <button type="button" disabled={pending || !connected} onClick={() => void view?.takeControl()}>
        {pending ? "Taking control…" : "Take control"}
      </button>}
    </div>}
    <div className="terminal__surface" ref={container} />
    <TerminalSearchBar controller={search} />
    {(error || cliError) && <div className="terminal__cli-error" role="alert">{error || cliError}</div>}
    {(exitCode !== null || sleeping) && <div className="terminal__exited terminal__exited--cli" data-testid={sleeping ? "cli-sleeping" : "cli-exited"}>
      <span className="terminal__exited-text">{sleeping ? `${agent} is sleeping to save memory — its conversation is kept` : `${agent} exited (code ${exitCode})`}</span>
      <span className="terminal__exited-actions">
        <button type="button" className="terminal__exited-btn terminal__exited-btn--primary" data-testid={sleeping ? "cli-resume" : "cli-restart"} onClick={startOver}>{sleeping ? "Resume agent" : "Restart CLI"}</button>
        {onClose && <button type="button" className="terminal__exited-btn" data-testid="cli-close-session" onClick={onClose}>Close session</button>}
      </span>
    </div>}
  </div>;
}

const noSubscription = () => () => {};
const openingState = () => OPENING;
