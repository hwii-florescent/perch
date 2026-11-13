/**
 * terminalScope.ts — Files/Git follow the terminal: once a terminal's shell leaves
 * its workspace's folder, its scope id (`term:<session id>:<base64url directory>`)
 * stands where the workspace id does in every fs.* / git.* request; the core
 * (`resolve_tool_workspace`) accepts only a directory that terminal has been in, and keeps
 * accepting that scope (a persisted grant) after the terminal closes.
 * A terminal still in its workspace's folder keeps the plain workspace id.
 */
import type { SessionSummary } from "@perch/shared";
import type { usePerchStore, WorkspaceProject, WorkspaceRecord } from "./store";

type State = ReturnType<typeof usePerchStore.getState>;

/** The Chats project: the scratch folder "No project" sessions are filed under
 * (`session::chats_pair`). Listed as a flat chat list after the projects. */
export function isChatsProject(project: WorkspaceProject): boolean {
  return project.path.endsWith("/.perch/scratch");
}

const PREFIX = "term:";
const DIR_PREFIX = "dir:";

const encode = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const decode = (text: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0)));

/** The terminal a scope id names, or null for a plain workspace id. */
export const scopeSessionId = (id: string): string | null => (id.startsWith(PREFIX) ? id.slice(PREFIX.length).split(":")[0] ?? null : null);

/** `session`'s Files/Git scope: only for a terminal on this machine whose shell is known to
 * be outside its workspace's own folder. Anything else keeps its workspace. */
export function terminalScopeId(state: Pick<State, "workspaces">, session: SessionSummary | undefined): string | null {
  if (!session?.currentCwd || !session.workspaceId || (session.hostId ?? "local") !== "local") return null;
  const workspace = state.workspaces.find((candidate) => candidate.id === session.workspaceId);
  return workspace && workspace.path !== session.currentCwd ? `${PREFIX}${session.id}:${encode(session.currentCwd)}` : null;
}

// One stable object per scope and session update: store selectors must not return a new one each call.
const records = new Map<string, { session: SessionSummary | undefined; record: WorkspaceRecord }>();

/** The scope id for local directory `path`, chosen on purpose (the New file prompt) and filed
 * under `workspaceId`: files in it are read and saved through the id, even outside the workspace. */
export const dirScopeId = (workspaceId: string, path: string): string => `${DIR_PREFIX}${workspaceId}:${encode(path)}`;

/** The workspace row for `id`; a terminal scope gets one made from its directory and, while
 * its terminal is open, that session. The core keeps resolving a verified scope after its
 * terminal closes, so the row then stands on the directory alone. */
export function workspaceRecord(state: Pick<State, "workspaces" | "sessions">, id: string): WorkspaceRecord | undefined {
  if (id.startsWith(DIR_PREFIX)) return dirRecord(state, id);
  const sessionId = scopeSessionId(id);
  if (!sessionId) return state.workspaces.find((candidate) => candidate.id === id);
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  const cached = records.get(id);
  if (cached && cached.session === session) return cached.record;
  let path = "";
  try { path = decode(id.slice(PREFIX.length + sessionId.length + 1)); } catch { return undefined; }
  const record: WorkspaceRecord = {
    id,
    projectId: session?.projectId ?? "",
    hostId: "local",
    path,
    name: path.replace(/\/+$/, "").split("/").pop() || "/",
    branch: session && path === session.currentCwd ? session.currentBranch : undefined,
    dirty: false,
    state: "active",
    createdAt: session?.createdAt ?? 0,
    updatedAt: session?.createdAt ?? 0,
    hidden: true,
  };
  records.set(id, { session, record });
  return record;
}

const dirRecords = new Map<string, WorkspaceRecord>();

function dirRecord(state: Pick<State, "workspaces">, id: string): WorkspaceRecord | undefined {
  const cached = dirRecords.get(id);
  if (cached) return cached;
  const [workspaceId = "", encoded = ""] = id.slice(DIR_PREFIX.length).split(":");
  const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);
  let path = "";
  try { path = decode(encoded); } catch { return undefined; }
  if (!workspace || !path) return undefined;
  const record: WorkspaceRecord = { ...workspace, id, path, name: path.replace(/\/+$/, "").split("/").pop() || "/", branch: undefined, dirty: false, hidden: true };
  dirRecords.set(id, record);
  return record;
}
