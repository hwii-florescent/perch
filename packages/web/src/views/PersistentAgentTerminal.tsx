import { useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AgentLifecycleStatus } from "@perch/shared";
import { usePerchStore } from "../store";
import { socket } from "../ws";
import { openAgentTerminal, sizedByOtherDevice, takeBackAllSizes } from "../agentTerminals";
import { createPerchTerminal, onTerminalInput, type PerchTerminal } from "../xtermSetup";
import { useTerminalSearch } from "../terminalSearch";
import { TerminalSearchBar } from "../components/TerminalSearchBar";
import { attachClipboardImagePaste } from "../clipboardImagePaste";
import { attachAgentFileDrop, type FileDropNotice } from "../agentFileDrop";
import { BorrowTerminals, KeptTerminal, forgetTerminal, showTerminal } from "../terminalKeeper";
import { MobileKeyBar } from "../components/MobileKeyBar";
import { useIsMobileWidth } from "../responsive";
import { StockRoute } from "../components/mod-root";
import type { AgentControlProps } from "@perch/sdk";
// The chip, the error line and the exited/sleeping banner are the stock screen `stock:agent-control` (or the person's
// copy); the lease, starting and closing stay this file's.
import AgentControl from "../stock-ui/agent-control/main";
import { PhoneSizeNotice } from "../components/PhoneSizeNotice";
import { TerminalSuggestions } from "./nativeChat/TerminalSuggestions";

/** The PTY's size, in-band in its output (`terminal::pty_size_marker`). */
const SIZE_MARKER = /\x1b\[8;(\d+);(\d+)t/g;

interface ViewState {
  terminalId: string | null;
  status: AgentLifecycleStatus | null;
  controlling: boolean;
  /** This view holds the PTY's size. */
  resizing: boolean;
  writable: boolean;
  shared: boolean;
  pending: boolean;
  error: string | null;
  exitCode: number | null;
}
const OPENING: ViewState = { terminalId: null, status: null, controlling: false, resizing: false, writable: false, shared: false, pending: false, error: null, exitCode: null };

/** One agent terminal and its connection, kept across unmounts
 * (`terminalKeeper.ts`). */
class AgentView extends KeptTerminal<ViewState> {
  readonly created: PerchTerminal;
  /** The terminal id while this view may type into it. */
  inputId: string | null = null;
  /** A phone fits the PTY to itself once, on opening; after that "Fit here" is the user's call. */
  autoFitted = false;
  private binding: ReturnType<typeof openAgentTerminal>;
  private stop: () => void;

  constructor(sessionId: string, agent: string, container: HTMLElement) {
    super(OPENING, container);
    let attachedId: string | null = null;
    let replayDone = false;
    let ownsInput = false;
    let ownsResize = false;
    let sharedInput = false;
    let ready = false;
    let claimingResize = false;
    let exited = false;
    let initialControl = false;
    let responses = "";
    // Until attached, the fitted size is what a new PTY starts at; after,
    // only the controlling view sizes it and the others follow its markers.
    const created = createPerchTerminal(this.host, (cols, rows) => {
      if (this.inputId) usePerchStore.getState().resizeTerminal(this.inputId, cols, rows);
    }, usePerchStore.getState().terminalProfile, () => !attachedId || ownsResize, sessionId);
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
      this.inputId = !this.disposed && replayDone && (sharedInput || ownsInput) && !exited ? attachedId : null;
      created.term.options.disableStdin = this.inputId === null;
      this.set({ writable: this.inputId !== null });
      if (this.inputId && (sharedInput ? ownsResize : ownsInput) && responses) {
        usePerchStore.getState().sendTerminalInput(this.inputId, responses);
        responses = "";
      }
    };
    const input = onTerminalInput(created.term, (data, user) => {
      if (this.inputId && (!sharedInput || user || ownsResize)) usePerchStore.getState().sendTerminalInput(this.inputId, data);
      // Only fresh query replies may wait for a response-owner lease. Never
      // send replies to history replay, or let passive views answer twice.
      else if (replayDone && !user && (initialControl || claimingResize || (sharedInput && !this.state.status?.resizeOwner)) && !exited && responses.length + data.length <= 2048) responses += data;
    });
    const advertised = usePerchStore.getState().serverInfo?.capabilities?.includes("terminal.sharedInput") === true;
    sharedInput = advertised && input.tracksUserInput;
    this.set({ shared: sharedInput, ...(advertised && !input.tracksUserInput ? { error: "Shared typing is unavailable in this terminal version. Use Take control." } : {}) });
    const claimUnownedResize = async () => {
      if (!sharedInput || !ready || this.disposed || exited || claimingResize || this.state.status?.resizeOwner) return;
      claimingResize = true;
      try { await opened.takeResize(true); }
      catch (reason) { if (!this.disposed) this.set({ error: (reason as Error).message }); }
      finally { claimingResize = false; if (!ownsResize) responses = ""; }
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
      (snapshot, owned, resizing) => {
        if (this.disposed) return;
        ownsInput = owned;
        ownsResize = resizing;
        this.set({ status: snapshot, controlling: owned, resizing });
        updateInput();
        if (ownsResize) created.fit();
        void claimUnownedResize();
      },
      () => ({ cols: created.term.cols, rows: created.term.rows }),
      sharedInput,
    );
    this.binding = opened;
    opened.ready.then(async () => {
      if (!this.disposed && initialControl) {
        this.set({ pending: true });
        try { await opened.takeControl(sharedInput); }
        catch (reason) { if (!this.disposed) this.set({ error: (reason as Error).message }); }
        finally { initialControl = false; responses = ""; if (!this.disposed) { this.set({ pending: false }); created.fit(); } }
      }
      ready = true;
      await claimUnownedResize();
    }).catch((reason: Error) => { if (!this.disposed) this.set({ error: reason.message }); });
    const stopExit = socket.onMessage((message) => {
      if (message.type !== "terminal.exit" || message.terminalId !== attachedId) return;
      exited = true;
      ownsInput = false;
      this.inputId = null;
      created.term.options.disableStdin = true;
      this.set({ controlling: false, writable: false, exitCode: message.code });
    });
    this.stop = () => { opened.release(); input.dispose(); stopExit(); created.dispose(); };
  }

  /** Type `data` as if on the keyboard from any writable attached view. */
  sendKey(data: string) {
    if (this.inputId) usePerchStore.getState().sendTerminalInput(this.inputId, data);
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

  /** Take the size back from a phone: this terminal (with its stop authority, as "Fit here" did), or every one a phone holds. */
  async takeBack(all: boolean) {
    if (this.state.pending) return;
    this.set({ pending: true, error: null });
    try {
      if (all) await takeBackAllSizes();
      else await this.binding.takeControl();
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
  // Under a borrowing surface (an overlay, a peek) the kept terminal moves here and back, never a second copy.
  const borrow = useContext(BorrowTerminals);
  const container = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<AgentView | null>(null);
  const [restart, setRestart] = useState(0);
  const [fileDrop, setFileDrop] = useState<FileDropNotice>(null);
  const { terminalId, status, controlling, resizing, writable, shared, pending, error, exitCode } = useSyncExternalStore(
    view?.subscribe ?? noSubscription, view?.getState ?? openingState,
  );
  const search = useTerminalSearch(view?.created.term ?? null);
  const isMobile = useIsMobileWidth();
  // A phone cannot show a desktop-sized grid, so it sizes the PTY on opening.
  const fitOnOpen = isMobile && shared && !!terminalId && !!status && !controlling && !!view && !view.autoFitted;
  useEffect(() => {
    if (!fitOnOpen || !view) return;
    view.autoFitted = true;
    void view.takeControl();
  }, [fitOnOpen, view]);

  useEffect(() => {
    if (!connected || !container.current) return;
    const surface = container.current;
    const shown = showTerminal(keyOf(sessionId, agent), sessionId, surface, () => new AgentView(sessionId, agent, surface), { borrow });
    setView(shown.view);
    const stopPaste = attachClipboardImagePaste(surface, () => shown.view.inputId);
    setFileDrop(null);
    const stopDrop = attachAgentFileDrop(
      surface, sessionId, () => shown.view.inputId,
      (text) => { shown.view.created.term.paste(text); shown.view.created.term.focus(); }, setFileDrop,
    );
    return () => { stopDrop(); stopPaste(); shown.hide(); };
  }, [connected, sessionId, agent, restart, borrow]);

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
  // Shared typing never needs takeover. On a phone, Fit here moves sizing/stop authority
  // without making the other screens read-only; the desktop has the take-back notice instead.
  // A phone holds the size of this computer's terminal: the notice offers it back, in place of "Fit here".
  const phoneSized = !isMobile && shared && !resizing && !!terminalId && sizedByOtherDevice(status);
  const label = !connected ? "Reconnecting…" : phoneSized ? null : sleeping || exitCode !== null ? null : error && !terminalId ? "Agent unavailable" : !status ? "Opening agent…" : controlling ? null : shared ? (isMobile ? "Shared terminal" : null) : status.inputOwner ? "Another view is typing in this agent" : "Viewing agent";
  const controls: Omit<AgentControlProps, "part"> = {
    agent,
    label,
    connected,
    pending,
    onRetry: !terminalId && error && connected ? startOver : null,
    control: terminalId && status && !controlling && (isMobile || !shared)
      ? { label: pending ? (shared ? "Fitting…" : "Taking control…") : shared ? "Fit here" : "Take control", disabled: pending || !connected, onClick: () => void view?.takeControl() }
      : null,
    error: error || cliError || null,
    ended: exitCode !== null || sleeping ? { sleeping, exitCode, onRestart: startOver, onClose: onClose ?? null } : null,
    state: { controlling, shared, writable, phone: isMobile },
  };
  return <div className="terminal terminal--persistent" data-testid="persistent-agent-terminal" data-session-id={sessionId} data-terminal-id={terminalId ?? undefined} data-controlling={controlling || undefined} data-writable={writable || undefined}>
    <StockRoute name="agent-control" stock={AgentControl} props={{ ...controls, part: "top" }} />
    {phoneSized && status?.resizeOwner && <PhoneSizeNotice generation={status.resizeOwner.generation} pending={pending} onThisTab={() => void view?.takeBack(false)} onAllTabs={() => void view?.takeBack(true)} />}
    <div className="terminal__surface" ref={container} />
    <TerminalSearchBar controller={search} />
    <TerminalSuggestions sessionId={sessionId} terminalId={terminalId} controlling={controlling} />
    {fileDrop && (
      <div
        className={fileDrop.error ? "terminal__cli-error max-w-full break-words" : "terminal__exited"}
        role={fileDrop.error ? "alert" : "status"}
      >
        {fileDrop.message}
      </div>
    )}
    {isMobile && writable && exitCode === null && !sleeping && view && <MobileKeyBar term={view.created.term} send={(data) => view.sendKey(data)} />}
    <StockRoute name="agent-control" stock={AgentControl} props={{ ...controls, part: "bottom" }} />
  </div>;
}

const noSubscription = () => () => {};
const openingState = () => OPENING;
