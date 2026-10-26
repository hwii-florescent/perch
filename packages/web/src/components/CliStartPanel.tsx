/**
 * CliStartPanel.tsx — what CLI mode shows *instead of* a terminal until the
 * user has said where to work.
 *
 * The transport mints a blank session on every WS connect (see ws.ts), and
 * CLI mode used to react to that by immediately spawning `claude --resume`
 * into whatever the server's default cwd happened to be — so opening perch
 * launched an agent in the wrong directory, every time, before the user had
 * done anything. Gating on an explicit choice (see `cliStartedSessions` in
 * store.ts) leaves that blank session with nothing to render, and this is it.
 *
 * It is the focused-workspace start screen (`StartCard`, the same one
 * `NoSessionPanel` shows) plus a "where" picker: the session already open
 * (when it exists and has a cwd — an old session that predates any CLI use),
 * a listed project, or the Scratchpad. Clicking an agent starts it there; a
 * new session is self-starting because the create was user-initiated.
 *
 * This is also the only place CLI mode lets the user pick which agent CLI to
 * launch — Hosted mode's provider/model chrome deliberately never renders in
 * CLI mode (AGENTS.md's "zero model chrome in CLI mode"). The choice is
 * provider selection only, threaded through `startCli`/`createSessionOnHost`
 * into `cliAgentBySession` (store.ts) so it's remembered per session.
 */
import { useEffect, useState } from "react";
import { usePerchStore } from "../store";
import { AGENTS } from "../models";
import { cn } from "../lib/cn";
import { AGENT_PICKER } from "./AgentPicker";
import { START_LINK, StartCard } from "./StartCard";

const STATUS = "flex items-baseline gap-[0.45rem] text-[0.78rem] text-subtext-0";
const STATUS_BUTTON = "cursor-pointer bg-transparent p-0 text-accent underline [border:0] [font:inherit]";
const SCRATCHPAD = "~";

function basename(path: string): string {
  const parts = path.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || path;
}

export function CliStartPanel() {
  const sessionId = usePerchStore((s) => s.sessionId);
  const sessions = usePerchStore((s) => s.sessions);
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const serverInfo = usePerchStore((s) => s.serverInfo);
  const workspaceCapabilitiesByHost = usePerchStore((s) => s.workspaceCapabilitiesByHost);
  const manifestState = usePerchStore((s) => s.agentManifestsByHost[activeHostId]);
  const fetchAgentManifests = usePerchStore((s) => s.fetchAgentManifests);
  const startCli = usePerchStore((s) => s.startCli);
  const workspaceProjects = usePerchStore((s) => s.workspaceProjects);
  const createSessionOnHost = usePerchStore((s) => s.createSessionOnHost);
  const openAgentCatalog = usePerchStore((s) => s.openAgentCatalog);
  const [targetKey, setTargetKey] = useState<string | null>(null);

  const capabilities = activeHostId === "local"
    ? serverInfo?.capabilities ?? []
    : workspaceCapabilitiesByHost[activeHostId] ?? [];
  const manifestCapability = capabilities.includes("agent.manifest.list");

  useEffect(() => {
    if (manifestCapability) fetchAgentManifests(activeHostId);
  }, [activeHostId, fetchAgentManifests, manifestCapability]);

  const choices = manifestCapability
    ? (manifestState?.manifests ?? [])
      .filter((manifest) => manifest.available && manifest.enabled !== false && manifest.supportedModes.includes("cli") && manifest.capabilities.includes("interactiveTerminal"))
      .sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault)) // the host's default agent first
      .map((manifest) => ({ id: manifest.id, label: manifest.displayName }))
    : AGENTS.map((candidate) => ({ id: candidate.id, label: candidate.label }));
  // Once a host advertises manifest discovery, wait for its authoritative
  // answer before allowing a real CLI process to start. Legacy peers keep the
  // historical provider choices because they cannot describe availability.
  const ready = !manifestCapability || manifestState?.state === "ready";

  // Only a *listed* session can be resumed in place. The blank connect-time
  // session is deliberately invisible in `sessions` (db.rs hides sessions
  // with no messages and no CLI activity), so this is exactly the "the user
  // picked an existing session" case and never the housekeeping one.
  const current = sessions.find((s) => s.id === sessionId);

  // Sessions start only in a project listed in perch, or in the Scratchpad —
  // the same choices the sidebar's "New session" offers, so they agree.
  const projectCwds = workspaceProjects
    .filter((project) => project.hostId === activeHostId && project.path !== current?.cwd)
    .map((project) => project.path);
  const targets = [
    ...(current?.cwd ? [{ key: "here", label: `${basename(current.cwd)} (this session)`, name: basename(current.cwd), path: current.cwd }] : []),
    ...projectCwds.map((cwd) => ({ key: cwd, label: basename(cwd), name: basename(cwd), path: cwd })),
    { key: SCRATCHPAD, label: "No birdhouse (Scratchpad)", name: "Scratchpad", path: "No birdhouse" },
  ];
  const target = targets.find((candidate) => candidate.key === targetKey) ?? targets[0]!;

  function pick(agent: string) {
    if (target.key === "here" && current) startCli(current.id, agent);
    else createSessionOnHost(activeHostId, target.key, agent);
  }

  return (
    <StartCard
      name={target.name}
      path={target.path}
      choices={choices}
      idPrefix="cli-start-agent"
      testId="cli-start-panel"
      disabled={!ready || !choices.length}
      onPick={pick}
      target={targets.length > 1 && (
        <select
          className={cn(AGENT_PICKER, "max-w-full text-[0.8rem] [--picker-bg:var(--surface-0)]")}
          aria-label="Where to open"
          data-testid="cli-start-target"
          value={target.key}
          onChange={(event) => setTargetKey(event.target.value)}
        >
          {targets.map((candidate) => <option key={candidate.key} value={candidate.key}>{candidate.label}</option>)}
        </select>
      )}
      status={<>
        {manifestCapability && manifestState?.state === "ready" && !choices.length && (
          <div className={STATUS} role="status">
            No CLI providers are available on this host. Install a provider or check its configuration, then retry.
            <button type="button" className={STATUS_BUTTON} onClick={() => fetchAgentManifests(activeHostId)}>Retry</button>
          </div>
        )}
        {manifestState?.state === "loading" && (
          <div className={STATUS} role="status" data-testid="cli-manifest-loading">
            Checking providers on {activeHostId === "local" ? "this host" : activeHostId}…
          </div>
        )}
        {manifestState?.state === "error" && (
          <div className={cn(STATUS, "text-red")} role="alert">
            {manifestState.error || "Provider discovery failed."}
            <button type="button" className={STATUS_BUTTON} onClick={() => fetchAgentManifests(activeHostId)}>Retry</button>
          </div>
        )}
      </>}
      extraLinks={manifestCapability && (
        <button type="button" className={START_LINK} data-testid="cli-manage-agents" onClick={openAgentCatalog}>Manage agents</button>
      )}
    />
  );
}
