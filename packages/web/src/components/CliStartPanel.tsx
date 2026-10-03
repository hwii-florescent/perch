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
 * Two ways forward, in the order they usually apply:
 *  - the active session already exists and has a cwd (the user clicked into
 *    an old session that predates any CLI use) — offer to start there;
 *  - otherwise pick a project and create a new session, which is
 *    self-starting because the create was user-initiated.
 *
 * Bug 1 fix: this panel is also the *only* place CLI mode lets the user pick
 * which agent CLI to launch — Hosted mode's provider/model chrome
 * (ModelChip/EffortChip) deliberately never renders in CLI mode (AGENTS.md's
 * "zero model chrome in CLI mode"), so without a choice here CLI mode always
 * launched whatever the global `agent` field happened to be (in practice,
 * always Claude — nothing in CLI mode could ever change it). The toggle below
 * is provider selection only — which binary to spawn — not model/effort
 * chrome; that product decision is unaffected and intentionally not revisited
 * here. The choice is threaded through `startCli`/`createSessionOnHost` into
 * `cliAgentBySession` (store.ts) so it's remembered per session rather than
 * globally.
 */
import { useEffect, useState } from "react";
import { usePerchStore } from "../store";
import { AGENTS } from "../models";
import { cn } from "../lib/cn";
import { AGENT_PICKER } from "./AgentPicker";

// `font: inherit` plus a size is order-unsafe as utilities, so: family/weight/line-height inherit.
// Paths are long and the interesting end is the tail: clip from the left.
const CWD = "overflow-hidden text-left text-[0.75rem] font-normal text-ellipsis whitespace-nowrap text-subtext-0 [direction:rtl]";
const STATUS = "flex items-baseline gap-[0.45rem] text-[0.78rem] text-subtext-0";
const FONT = "[font-family:inherit] [font-weight:inherit] [line-height:inherit]";
const BTN = "flex cursor-pointer flex-col gap-[0.15rem] rounded-ui border px-3 py-[0.55rem] text-left hover:bg-surface-1";
const OFF = "disabled:cursor-not-allowed disabled:opacity-[0.55] disabled:hover:bg-surface-0";
const PRIMARY = `${BTN} ${OFF} border-[color:color-mix(in_srgb,var(--accent)_55%,var(--panel-bg))] bg-[color-mix(in_srgb,var(--accent)_12%,var(--panel-bg))] font-semibold text-fg [font-family:inherit] [font-size:inherit] [line-height:inherit]`;
const PROJECT = `${BTN} ${OFF} border-overlay-0 bg-surface-0 text-fg [font:inherit]`;
const SECONDARY = `cli-start__secondary ${BTN} border-dashed border-overlay-0 bg-transparent text-[0.85rem] text-subtext-0 ${FONT}`;
const STATUS_BUTTON = "cursor-pointer bg-transparent p-0 text-accent underline [border:0] [font:inherit]";

function basename(path: string): string {
  const parts = path.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || path;
}

export function CliStartPanel({ agent }: { agent: string }) {
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
  // The provider the user has picked in *this* panel, defaulting to whatever
  // Chat.tsx resolved (this session's remembered choice, or the global
  // fallback — see `cliAgentBySession`). Local state so the toggle is
  // instantly responsive; it's written back into the store only when the
  // user actually starts/creates a session (see the button handlers below).
  const [selectedAgent, setSelectedAgent] = useState(agent);
  const [picked, setPicked] = useState(false);

  const capabilities = activeHostId === "local"
    ? serverInfo?.capabilities ?? []
    : workspaceCapabilitiesByHost[activeHostId] ?? [];
  const manifestCapability = capabilities.includes("agent.manifest.list");

  useEffect(() => {
    if (manifestCapability) fetchAgentManifests(activeHostId);
  }, [activeHostId, fetchAgentManifests, manifestCapability]);

  // The resolved default can change out from under this component (e.g. the
  // user switches to a different not-yet-started session); follow it rather
  // than freezing on whatever it was at first mount.
  useEffect(() => {
    setSelectedAgent(agent);
  }, [agent]);

  const manifestByAgent = new Map(
    (manifestState?.manifests ?? []).map((manifest) => [manifest.id, manifest]),
  );
  const selectedManifest = manifestByAgent.get(selectedAgent);
  const choices = manifestCapability
    ? (manifestState?.manifests ?? [])
      .filter((manifest) => manifest.available && manifest.enabled !== false && manifest.supportedModes.includes("cli") && manifest.capabilities.includes("interactiveTerminal"))
      .map((manifest) => ({ id: manifest.id, label: manifest.displayName, available: manifest.available, reason: manifest.reason }))
    : AGENTS.map((candidate) => ({ ...candidate, available: true, reason: undefined }));
  // Once a host advertises manifest discovery, wait for its authoritative
  // answer before allowing a real CLI process to start. Legacy peers keep the
  // historical provider choices because they cannot describe availability.
  const selectedAvailable = !manifestCapability || (
    manifestState?.state === "ready" && choices.some((choice) => choice.id === selectedAgent && choice.available)
  );
  const firstAvailableId = choices.find((choice) => choice.available)?.id;
  const preferredId = manifestState?.manifests.find((manifest) => manifest.isDefault && manifest.available && manifest.enabled !== false)?.id;
  useEffect(() => { if (!picked && preferredId) setSelectedAgent(preferredId); }, [picked, preferredId]);

  useEffect(() => {
    if (manifestState?.state !== "ready" || selectedAvailable || !firstAvailableId) return;
    setSelectedAgent(firstAvailableId);
  }, [firstAvailableId, manifestState?.state, selectedAvailable]);

  // Only a *listed* session can be resumed in place. The blank connect-time
  // session is deliberately invisible in `sessions` (db.rs hides sessions
  // with no messages and no CLI activity), so this is exactly the "the user
  // picked an existing session" case and never the housekeeping one.
  const current = sessions.find((s) => s.id === sessionId);

  // Sessions start only in a project listed in perch, or in Chats — the
  // same choices the sidebar's "+" offers, so the two entry points agree.
  const projectCwds = workspaceProjects
    .filter((project) => project.hostId === activeHostId)
    .map((project) => project.path);

  const agentLabel = selectedManifest?.displayName ?? AGENTS.find((candidate) => candidate.id === selectedAgent)?.label ?? selectedAgent;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-start justify-center overflow-y-auto bg-panel-bg px-4 py-8" data-testid="cli-start-panel">
      <div className="cli-start__card flex w-full max-w-[26rem] flex-col gap-3">
        <h2 className="m-0 text-[1rem] font-semibold text-fg">Start a {agentLabel} session</h2>
        <p className="m-0 text-[0.85rem] leading-[1.45] text-subtext-0">
          CLI mode runs {agentLabel} in a terminal. Choose the
          provider and the project it should run in.
        </p>

        <select
          className={AGENT_PICKER}
          aria-label="CLI provider"
          data-testid="cli-start-agent"
          value={choices.some((a) => a.id === selectedAgent) ? selectedAgent : ""}
          disabled={!choices.length || (manifestCapability && manifestState?.state !== "ready")}
          onChange={(event) => { setPicked(true); setSelectedAgent(event.target.value); }}
        >
          {choices.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>

        {manifestCapability && <button type="button" className="agent-catalog__action" data-testid="cli-manage-agents" onClick={openAgentCatalog}>Manage agents</button>}

        {manifestCapability && manifestState?.state === "ready" && !firstAvailableId && (
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
        {manifestState?.state === "ready" && selectedManifest && !selectedManifest.available && (
          <div className={cn(STATUS, "text-red")} role="alert" data-testid="cli-provider-unavailable">
            {selectedManifest.displayName} is unavailable on this host. {selectedManifest.reason || "Choose an available provider."}
          </div>
        )}

        {current?.cwd && (
          <button
            type="button"
            className={PRIMARY}
            data-testid="cli-start-here"
            disabled={!selectedAvailable}
            onClick={() => startCli(current.id, selectedAgent)}
          >
            Start in {basename(current.cwd)}
            <span className={CWD}>{current.cwd}</span>
          </button>
        )}

        {projectCwds.length > 0 && (
          <div className="flex flex-col gap-[0.4rem]">
            <div className="text-[0.75rem] tracking-[0.04em] text-overlay-1 uppercase">New chat in</div>
            <div className="flex flex-col gap-[0.3rem]">
              {projectCwds.map((cwd, i) => (
                <button
                  key={cwd}
                  type="button"
                  className={PROJECT}
                  data-testid={`cli-start-project-${i}`}
                  title={cwd}
                  disabled={!selectedAvailable}
                  onClick={() => createSessionOnHost(activeHostId, cwd, selectedAgent)}
                >
                  {basename(cwd)}
                  <span className={CWD}>{cwd}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          className={SECONDARY}
          data-testid="cli-start-chats"
          disabled={!selectedAvailable}
          onClick={() => createSessionOnHost(activeHostId, "~", selectedAgent)}
        >
          No project (Chats)
        </button>
      </div>
    </div>
  );
}
