/**
 * StartScreen.tsx: what the main area shows with nothing open, bound to Perch. The screen is `stock:start`
 * (`stock-ui/start/main.tsx`) or the person's package chosen for it; this file gathers its data and binds what each
 * action does. A phone keeps Perch's own.
 *
 * `NoSessionPanel`: no session is open (`sessionId === null`), e.g. after the last tab of a workspace is closed or its
 * agent and shell exit. Disconnected, nothing can start. With a workspace focused (clicking one that has no sessions,
 * `openEmptyWorkspace`) it is that workspace's start picker; otherwise the home screen.
 *
 * `CliStartPanel`: what CLI mode shows *instead of* a terminal until the person has said where to work. The transport
 * mints a blank session on every WS connect (ws.ts); gating on an explicit choice (`cliStartedSessions` in store.ts)
 * leaves that session with nothing to render, and this is it: the session already open (when it is listed and has a
 * cwd), a listed project, or Quickchat. Clicking an agent starts it there; this is also the only place CLI mode lets
 * the person pick which agent CLI to launch (provider selection only, AGENTS.md's "zero model chrome in CLI mode").
 *
 * The chosen place is kept here, outside the screen, so it survives a swap to a copy. Add project from a picker runs
 * the sidebar's add flow and selects the project it creates.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { StartScreenProps, StartTarget } from "@perch/sdk";
import { usePerchStore, effectiveActiveProject } from "../store";
import { AGENTS } from "../models";
import { requestAddProject } from "../appEvents";
import { useIsMobileWidth } from "../responsive";
import perchLogo from "../assets/perch-logo-texture-medium.webp";
import Start from "../stock-ui/start/main";
import { useAgentChoices } from "./AgentPicker";
import { StockRoute } from "./mod-root";

const QUICKCHAT = "~";

function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

/** The chosen place, and Add project that selects the project it creates. Choosing another place, or leaving, stops
 * waiting for one. */
function useStartPlace(initial: string | null) {
  const [key, setKey] = useState(initial);
  const stopWaiting = useRef<(() => void) | null>(null);
  useEffect(() => () => stopWaiting.current?.(), []);
  const choose = useCallback((next: string) => {
    stopWaiting.current?.();
    stopWaiting.current = null;
    setKey(next);
  }, []);
  const addProject = useCallback(() => {
    stopWaiting.current?.();
    const known = new Set(usePerchStore.getState().workspaceProjects.map((project) => project.id));
    // Listens on the store, not a render: the sidebar clears the request as soon as it sees success.
    // ponytail: a dismissed dialog keeps this armed until the next project is added or another folder is picked.
    const stop = usePerchStore.subscribe((state) => {
      const request = state.workspaceProjectCreate;
      if (request?.status !== "success") return;
      stop(); stopWaiting.current = null;
      const created = state.workspaceProjects.find((project) => project.hostId === request.hostId && !known.has(project.id))
        ?? state.workspaceProjects.find((project) => project.hostId === request.hostId && project.path === request.path);
      if (created) setKey(created.path);
    });
    stopWaiting.current = stop;
    requestAddProject();
  }, []);
  return { key, choose, addProject };
}

const openSettings = () => usePerchStore.getState().setSettingsOpen(true);
const manageAgents = () => usePerchStore.getState().openAgentCatalog();
const noop = () => {};

function StartRoute(props: StartScreenProps) {
  return <StockRoute name="start" props={props} stock={Start} exact={useIsMobileWidth()} />;
}

export function NoSessionPanel({ connected }: { connected: boolean }) {
  const activeHostId = usePerchStore((s) => s.activeHostId);
  // The fallback project is derived; subscribe to its scalar path so a
  // disconnect cannot turn repeated snapshot reads into a render loop.
  const projectCwd = usePerchStore((s) => effectiveActiveProject(s)?.cwd);
  const workspace = usePerchStore((s) => s.workspaces.find((candidate) => candidate.id === s.activeWorkspaceId));
  const projects = usePerchStore((s) => s.workspaceProjects);

  if (connected && workspace) {
    // A project's own checkout goes by the project's name ("Chats", not "scratch").
    const projectName = projects.find((p) => p.id === workspace.projectId && p.path === workspace.path)?.name;
    // Quickchat sessions run in HOME, so show that rather than its bookkeeping folder.
    const quickchat = workspace.path.endsWith("/.perch/scratch");
    return <WorkspaceStart key={workspace.id} hostId={workspace.hostId} name={quickchat ? "Quickchat" : workspace.name || projectName || basename(workspace.path)} path={quickchat ? "~" : workspace.path} startPath={workspace.path} quickchat={quickchat} />;
  }
  const props: StartScreenProps = {
    kind: connected ? "home" : "connecting",
    hostId: activeHostId, logo: perchLogo,
    projectCwds: projectCwd ? [projectCwd] : [],
    targets: [], targetKey: "", choices: [], discovery: null, disabled: !connected, canManageAgents: false,
    actions: {
      choose: noop, addProject: requestAddProject, start: noop, retry: noop, manageAgents, openSettings,
      startIn: (cwd, agent) => usePerchStore.getState().createSessionOnHost(activeHostId, cwd, agent),
    },
  };
  return <StartRoute {...props} />;
}

/** The focused workspace's start picker: what to open in it, in this folder (the default) or another project. */
function WorkspaceStart({ hostId, name, path, startPath, quickchat }: { hostId: string; name: string; path: string; startPath: string; quickchat: boolean }) {
  const projects = usePerchStore((s) => s.workspaceProjects);
  const { choices } = useAgentChoices(hostId);
  const place = useStartPlace(startPath);
  const targets: StartTarget[] = [
    { key: startPath, label: `${name} (current folder)`, name, path },
    ...projects.filter((project) => project.hostId === hostId && project.path !== startPath).map((project) => ({ key: project.path, label: project.name || basename(project.path), name: project.name || basename(project.path), path: project.path })),
    ...(quickchat ? [] : [{ key: QUICKCHAT, label: "No project (Quickchat)", name: "Quickchat", path: "~" }]),
  ];
  const target = targets.find((candidate) => candidate.key === place.key) ?? targets[0]!;
  const props: StartScreenProps = {
    kind: "workspace", hostId, logo: perchLogo, projectCwds: [],
    targets, targetKey: target.key,
    choices: choices.map(({ id, label }) => ({ id, label })),
    discovery: null, disabled: false, canManageAgents: false,
    actions: {
      choose: place.choose, addProject: place.addProject, retry: noop, manageAgents, openSettings,
      start: (agent) => usePerchStore.getState().createSessionOnHost(hostId, target.key, agent),
      startIn: (cwd, agent) => usePerchStore.getState().createSessionOnHost(hostId, cwd, agent),
    },
  };
  return <StartRoute {...props} />;
}

export function CliStartPanel() {
  const sessionId = usePerchStore((s) => s.sessionId);
  const sessions = usePerchStore((s) => s.sessions);
  const activeHostId = usePerchStore((s) => s.activeHostId);
  const serverInfo = usePerchStore((s) => s.serverInfo);
  const workspaceCapabilitiesByHost = usePerchStore((s) => s.workspaceCapabilitiesByHost);
  const manifestState = usePerchStore((s) => s.agentManifestsByHost[activeHostId]);
  const fetchAgentManifests = usePerchStore((s) => s.fetchAgentManifests);
  const workspaceProjects = usePerchStore((s) => s.workspaceProjects);
  const place = useStartPlace(null);

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

  // Sessions start only in a project listed in perch, or in Quickchat:
  // the same choices the sidebar's "New session" offers, so they agree.
  const targets: StartTarget[] = [
    ...(current?.cwd ? [{ key: "here", label: `${basename(current.cwd)} (this session)`, name: basename(current.cwd), path: current.cwd }] : []),
    ...workspaceProjects
      .filter((project) => project.hostId === activeHostId && project.path !== current?.cwd)
      .map((project) => ({ key: project.path, label: basename(project.path), name: basename(project.path), path: project.path })),
    { key: QUICKCHAT, label: "No project (Quickchat)", name: "Quickchat", path: "~" },
  ];
  const target = targets.find((candidate) => candidate.key === place.key) ?? targets[0]!;
  const discovery: StartScreenProps["discovery"] = !manifestCapability ? null
    : manifestState?.state === "loading" ? { state: "loading", hostLabel: activeHostId === "local" ? "this host" : activeHostId }
    : manifestState?.state === "error" ? { state: "error", error: manifestState.error, hostLabel: activeHostId === "local" ? "this host" : activeHostId }
    : manifestState?.state === "ready" && !choices.length ? { state: "empty", hostLabel: activeHostId === "local" ? "this host" : activeHostId }
    : null;

  const props: StartScreenProps = {
    kind: "cli", hostId: activeHostId, logo: perchLogo, projectCwds: [],
    targets, targetKey: target.key, choices, discovery,
    disabled: !ready || !choices.length,
    canManageAgents: manifestCapability,
    actions: {
      choose: place.choose, addProject: place.addProject, manageAgents, openSettings,
      retry: () => fetchAgentManifests(activeHostId),
      start: (agent) => {
        const store = usePerchStore.getState();
        if (target.key === "here" && current) store.startCli(current.id, agent);
        else store.createSessionOnHost(activeHostId, target.key, agent);
      },
      startIn: (cwd, agent) => usePerchStore.getState().createSessionOnHost(activeHostId, cwd, agent),
    },
  };
  return <StartRoute {...props} />;
}
