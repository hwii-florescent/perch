import { useEffect } from "react";
import { usePerchStore } from "../store";
import { NativeCliChat } from "./NativeCliChat";
import { AgentCliTerminal } from "./AgentCliTerminal";
import { CliStartPanel } from "../components/CliStartPanel";
import { NoSessionPanel } from "../components/NoSessionPanel";

/**
 * One pane showing one agent session. It is always the same real CLI process;
 * the global `chatMode` setting (Terminal by default) only decides the view:
 * `cli` is the terminal, `ui` is the native chat (`NativeCliChat`) over that
 * same process. Agents or hosts with no native bridge always get the terminal.
 *
 * `sessionId`: omitted means "the globally active session"; a split pane
 * passes its own id.
 */
export function AgentPane({ sessionId: sessionIdProp }: { sessionId?: string } = {}) {
  const activeSessionId = usePerchStore((s) => s.sessionId);
  const sessionId = sessionIdProp ?? activeSessionId;
  const connected = usePerchStore((s) => s.connected);
  const chatMode = usePerchStore((s) => s.settings?.chatMode ?? "cli");
  const cliError = usePerchStore((s) => s.cliError);
  const deleteSession = usePerchStore((s) => s.deleteSession);
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const session = usePerchStore((s) => (sessionId ? s.sessions.find((candidate) => candidate.id === sessionId) : undefined));
  const cliAgent = usePerchStore((s) => (sessionId ? s.cliAgentBySession[sessionId] : undefined)) ?? session?.cliProviderId ?? "claude";
  // An agent typed into a Terminal tab is the tab's chat provider while it runs.
  const chatAgent = cliAgent === "terminal" ? session?.chatProviderId : cliAgent;
  const owningHostId = session?.hostId ?? activeHostId;
  const capabilities = usePerchStore((s) => (owningHostId === "local" ? s.serverInfo?.capabilities : s.workspaceCapabilitiesByHost[owningHostId]));
  const manifests = usePerchStore((s) => s.agentManifestsByHost[owningHostId]);
  const fetchAgentManifests = usePerchStore((s) => s.fetchAgentManifests);
  const canListManifests = connected && Boolean(capabilities?.includes("agent.manifest.list"));
  useEffect(() => { if (canListManifests) fetchAgentManifests(owningHostId); }, [canListManifests, owningHostId, fetchAgentManifests]);
  const nativeUiAvailable = Boolean(capabilities?.includes("agent.ui.get") && manifests?.manifests.some((entry) => entry.id === chatAgent && entry.nativeUi));
  // Capabilities and manifests arrive after `connected`; do not flash a
  // terminal (and its PTY attach) while the answer is still pending.
  const nativeUiPending = !nativeUiAvailable && canListManifests && manifests?.state !== "ready" && manifests?.state !== "error";

  // A terminal mounts only once the user has chosen to work somewhere: they
  // created this session (`cliStartedSessions`) or the server says it already
  // ran one (`cliStarted`). Otherwise the blank connect-time session gets the
  // start panel, never a surprise agent process.
  const startedLocally = usePerchStore((s) => (sessionId ? (s.cliStartedSessions[sessionId] ?? false) : false));
  const ready = !!sessionId && (startedLocally || (session?.cliStarted ?? false));

  return (
    <div className="chat">
      {!sessionId ? (
        <NoSessionPanel connected={connected} />
      ) : !ready ? (
        <CliStartPanel />
      ) : chatMode === "ui" && nativeUiAvailable ? (
        <NativeCliChat key={`${sessionId}-${chatAgent}`} sessionId={sessionId} providerId={chatAgent!} terminalProviderId={cliAgent} />
      ) : chatMode === "ui" && nativeUiPending ? (
        <div className="p-4 text-[12px] text-subtext-0" role="status">Checking agent…</div>
      ) : (
        <AgentCliTerminal
          key={`${sessionId}-${cliAgent}`}
          sessionId={sessionId}
          agent={cliAgent}
          cliError={cliError}
          onClose={() => deleteSession(sessionId)}
        />
      )}
    </div>
  );
}
