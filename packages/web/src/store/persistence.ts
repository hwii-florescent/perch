/**
 * localStorage read/write pairs for the nav scope (active host/project/
 * workspace), device id, and last-agent-choice. Pure move from store.ts —
 * see the refactor plan's Phase 6. No logic changed.
 *
 * Every function here is exported (even ones with no consumer outside
 * index.ts) because index.ts's own store body calls them extensively;
 * `navSeedPending` is an exported `let` — index.ts reads its live value
 * after `writeActiveHostStored` (defined here) sets it, which is a correct
 * ES-module live binding, not a snapshot copy.
 */
import type { AgentKind } from "@perch/shared";
import type { ActiveProject } from "./index";
import { newId } from "./index";

const ACTIVE_HOST_STORAGE_KEY = "perch.activeHostId";
const ACTIVE_PROJECT_STORAGE_KEY = "perch.activeProject";
export const ACTIVE_PROJECT_ID_STORAGE_KEY = "perch.activeProjectId";
export const ACTIVE_WORKSPACE_ID_STORAGE_KEY = "perch.activeWorkspaceId";

export function readActiveHostStored(): string {
  try {
    return localStorage.getItem(ACTIVE_HOST_STORAGE_KEY) || "local";
  } catch {
    return "local";
  }
}

/**
 * True until the nav scope has been established for this profile. Only a
 * profile that has never picked a host/project gets its host *and* project
 * seeded from the most recent session (see the `"session.list"` handler).
 * Once anything has set the scope — a persisted value, a host switch, a
 * project click, opening a session — later `session.list` pushes must never
 * move the sidebar off the host the user is looking at. That matters
 * concretely with federation: the hub re-broadcasts `session.list` whenever a
 * remote host's list changes, and without this latch the newest session
 * (usually a local one) would yank the sidebar back to "local" moments after
 * the user switched to a remote host.
 */
export let navSeedPending = (() => {
  try {
    return (
      localStorage.getItem(ACTIVE_HOST_STORAGE_KEY) == null &&
      localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) == null
    );
  } catch {
    return false;
  }
})();

export function writeActiveHostStored(hostId: string): void {
  navSeedPending = false;
  try {
    localStorage.setItem(ACTIVE_HOST_STORAGE_KEY, hostId);
  } catch {
    // ignore — worst case the scope doesn't survive a reload
  }
}

export function readActiveProjectStored(): ActiveProject | null {
  try {
    const raw = localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const { hostId, cwd } = parsed as Partial<ActiveProject>;
      if (typeof hostId === "string" && typeof cwd === "string") return { hostId, cwd };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeActiveProjectStored(project: ActiveProject | null): void {
  try {
    if (project) localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, JSON.stringify(project));
    else localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function readStoredId(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredId(key: string, value: string | null): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // ignore — the legacy host/project scope remains available in memory
  }
}

/** Keep one opaque browser identity stable across reconnects and mode policy
 * reads. A fresh tab/profile gets a new id; no provider or host identity is
 * derived from it. */
const DEVICE_ID_STORAGE_KEY = "perch.deviceId";

export function readDeviceIdStored(): string {
  const existing = readStoredId(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const created = newId();
  try {
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
  } catch {
    // The in-memory value still correlates this connection when storage is
    // unavailable (private browsing, test DOM, or a blocked origin).
  }
  return created;
}

/** localStorage key backing `lastAgentChoice` — same convention as
 * `ACTIVE_HOST_STORAGE_KEY`/`ACTIVE_PROJECT_STORAGE_KEY` above. */
const LAST_AGENT_CHOICE_STORAGE_KEY = "perch.lastAgentChoice";

/** Only "claude"/"codex" are ever written; anything else (a stale/foreign
 * value, or localStorage unavailable) falls back to "claude". */
export function readLastAgentChoiceStored(): AgentKind {
  try {
    const raw = localStorage.getItem(LAST_AGENT_CHOICE_STORAGE_KEY);
    return raw === "claude" || raw === "codex" ? raw : "claude";
  } catch {
    return "claude";
  }
}

export function writeLastAgentChoiceStored(agent: AgentKind): void {
  try {
    localStorage.setItem(LAST_AGENT_CHOICE_STORAGE_KEY, agent);
  } catch {
    // ignore — worst case the choice doesn't survive a reload
  }
}
