import { PersistentAgentTerminal } from "./PersistentAgentTerminal";
import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { AgentKind } from "@perch/shared";
import { usePerchStore } from "../store";
import { onTerminalData } from "../terminalBus";
import { createPerchTerminal, type PerchTerminal } from "../xtermSetup";
import { useTerminalSearch } from "../terminalSearch";
import { TerminalSearchBar } from "../components/TerminalSearchBar";
import { attachClipboardImagePaste } from "../clipboardImagePaste";
import { attachAgentFileDrop, type FileDropNotice } from "../agentFileDrop";
import { BorrowTerminals, borrowLentTerminal, lendTerminal } from "../terminalKeeper";

function LegacyAgentCliTerminal({
  sessionId,
  agent,
  cliError,
  onClose,
}: {
  sessionId: string;
  agent: AgentKind;
  cliError?: string | null;
  onClose?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const perchTermRef = useRef<PerchTerminal | null>(null);
  const terminalIdRef = useRef<string | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [termInstance, setTermInstance] = useState<Terminal | null>(null);
  const [fileDrop, setFileDrop] = useState<FileDropNotice>(null);
  const search = useTerminalSearch(termInstance);

  const attachAgentCli = usePerchStore((s) => s.attachAgentCli);
  const sendTerminalInput = usePerchStore((s) => s.sendTerminalInput);
  const resizeTerminal = usePerchStore((s) => s.resizeTerminal);
  const killTerminal = usePerchStore((s) => s.killTerminal);
  const exitCode = usePerchStore((s) =>
    terminalId ? (s.terminals[terminalId]?.exitCode ?? null) : null,
  );

  // Create (or reattach to) the PTY exactly once per mount, and kill it again
  // on unmount. Root cause of the UI->CLI->UI->CLI "lags and never
  // renders" bug: leaving CLI mode never terminated the spawned
  // `claude --resume` process, so a still-alive PTY sat there with no
  // listener; terminalBus.ts drops any output emitted while unsubscribed
  // (no buffering/replay), and xterm.js itself has no way to redraw a
  // process's current screen from nothing. Re-entering CLI mode created a
  // brand-new, blank xterm instance and reattached to that same live PTY
  // (attachAgentCli only respawns when the cached terminal's exitCode is
  // non-null) — so the new xterm just sat there waiting for the next output
  // byte, which might not come for a long time (or ever, if the CLI's ink
  // renderer has nothing new to repaint). Explicitly killing the PTY here
  // (via the new terminal.kill protocol message) and evicting it from the
  // store's cliTerminalIds cache guarantees every CLI-mode entry gets a
  // *fresh* attach — a fresh process paired with a fresh xterm, which always
  // renders its own initial screen correctly. Session/model continuity is
  // unaffected: the server resumes the same claude session id either way.
  useEffect(() => {
    if (!containerRef.current) return;
    // The terminal draws in an element of its own (not React's), so a borrowing surface (a peek) can move this one
    // view in and back instead of attaching a second viewer, which would also stop the CLI when it closed.
    const surface = document.createElement("div");
    surface.className = "terminal__host";
    containerRef.current.appendChild(surface);
    const perchTerm = createPerchTerminal(
      surface,
      (cols, rows) => {
        const id = terminalIdRef.current;
        if (id) usePerchStore.getState().resizeTerminal(id, cols, rows);
      },
      // Read at construction time rather than subscribed: the profile is sent
      // once per connection and never changes mid-session, and xterm takes
      // its font/theme at construction anyway.
      usePerchStore.getState().terminalProfile,
      undefined,
      sessionId,
    );
    const term = perchTerm.term;
    xtermRef.current = term;
    perchTermRef.current = perchTerm;
    setTermInstance(term);

    let disposed = false;
    let currentId: string | null = null;
    // Spawn the CLI already sized to this pane. Attaching at a hardcoded
    // 80x24 and resizing afterwards made the agent draw its first frame at
    // the wrong width and then reflow — visible as a garbled banner that only
    // straightened out on the next full repaint.
    attachAgentCli(sessionId, agent, term.cols, term.rows).then((id) => {
      if (disposed) {
        // Unmounted before the attach round-trip resolved — the PTY was
        // still spawned server-side, so kill it now rather than leaking an
        // orphaned CLI process no view will ever attach to.
        killTerminal(id);
        return;
      }
      currentId = id;
      terminalIdRef.current = id;
      setTerminalId(id);
    });

    const dataSub = term.onData((data) => {
      if (currentId) sendTerminalInput(currentId, data);
    });

    // Wave 2 item 9: paste a clipboard image -> upload -> type its staged
    // path into the PTY (see clipboardImagePaste.ts).
    const detachClipboardPaste = attachClipboardImagePaste(surface, () => terminalIdRef.current);
    const withdraw = lendTerminal(sessionId, containerRef.current, surface, () => perchTerm.fit());

    setFileDrop(null);
    const detachFileDrop = attachAgentFileDrop(
      surface, sessionId,
      () => {
        const state = usePerchStore.getState();
        const id = terminalIdRef.current;
        if (disposed || !id || state.terminals[id]?.exitCode != null) return null;
        return id;
      },
      (text) => { term.paste(text); term.focus(); }, setFileDrop,
    );

    return () => {
      disposed = true;
      terminalIdRef.current = null;
      detachFileDrop();
      detachClipboardPaste();
      dataSub.dispose();
      withdraw();
      perchTerm.dispose();
      surface.remove();
      if (currentId) killTerminal(currentId);
    };
    // Deliberately run only on mount: sessionId/agent are fixed for the lifetime of this
    // component instance (key prop in Chat.tsx ensures a remount when session
    // or agent changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The process ended (the user left the CLI and its shell): the session is done, so close it like its tab's ×,
  // with no banner, as any terminal emulator closes a tab on `exit`.
  useEffect(() => {
    if (exitCode !== null) onClose?.();
    // The exit is the only trigger: `onClose` is a fresh function on every render of the pane.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exitCode]);

  // Stream PTY output straight into xterm, bypassing React state.
  useEffect(() => {
    if (!terminalId) return;
    return onTerminalData(terminalId, (data) => xtermRef.current?.write(data));
  }, [terminalId]);

  // Container-size changes are handled by the ResizeObserver inside
  // `createPerchTerminal`; this only syncs the PTY once the terminal id
  // finally exists, since fits that completed before then had no id to
  // forward the new grid to.
  useEffect(() => {
    if (!terminalId) return;
    const term = xtermRef.current;
    if (term) resizeTerminal(terminalId, term.cols, term.rows);
  }, [terminalId, resizeTerminal]);

  return (
    <div className="terminal">
      <div className="terminal__surface" ref={containerRef} />
      <TerminalSearchBar controller={search} />
      {fileDrop && (
        <div
          className={fileDrop.error ? "terminal__cli-error max-w-full break-words" : "terminal__exited"}
          role={fileDrop.error ? "alert" : "status"}
        >
          {fileDrop.message}
        </div>
      )}
      {cliError && (
        <div className="terminal__cli-error">{cliError}</div>
      )}
    </div>
  );
}

/** A borrowing surface's view of a session whose terminal is not kept (a remote one): the view already showing it
 * moves in and goes back on close; with none, a placeholder, never a second attach. */
function BorrowedLegacyTerminal({ sessionId, hostName }: { sessionId: string; hostName: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [lent, setLent] = useState(true);
  useLayoutEffect(() => {
    const release = ref.current ? borrowLentTerminal(sessionId, ref.current) : null;
    setLent(release !== null);
    return release ?? undefined;
  }, [sessionId]);
  return (
    <div className="terminal" data-testid="borrowed-legacy-terminal" data-session-id={sessionId}>
      <div className="terminal__surface" ref={ref} />
      {!lent && (
        <div className="terminal__exited" role="status">
          This terminal runs on {hostName} and is shown only in its own tab; open the tab to see it.
        </div>
      )}
    </div>
  );
}

export function AgentCliTerminal(props: { sessionId: string; agent: string; cliError?: string | null; onClose?: () => void }) {
  const hostId = usePerchStore((state) => state.sessions.find((session) => session.id === props.sessionId)?.hostId ?? state.activeHostId);
  const hostName = usePerchStore((state) => state.hosts.find((host) => host.id === hostId)?.name ?? hostId);
  const persistent = usePerchStore((state) => hostId === "local" && state.serverInfo?.capabilities?.includes("agent.terminal.open") === true);
  const borrow = useContext(BorrowTerminals);
  if (persistent) return <PersistentAgentTerminal {...props} />;
  if (borrow) return <BorrowedLegacyTerminal sessionId={props.sessionId} hostName={hostName} />;
  if (props.agent === "claude" || props.agent === "codex") return <LegacyAgentCliTerminal {...props} agent={props.agent} />;
  return <div className="terminal__cli-error" role="alert">This host does not support configured CLI providers.</div>;
}
