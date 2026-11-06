/**
 * terminalScope.ts — Files/Git follow the terminal: once a terminal's shell leaves
 * its workspace's folder, its scope id (`term:<session id>:<base64url directory>`)
 * stands where the workspace id does in every fs.* / git.* request; the core
 * (`resolve_tool_workspace`) accepts only a directory that terminal has been in.
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
const records = new Map<string, { session: SessionSummary; record: WorkspaceRecord }>();

/** The workspace row for `id`; a terminal scope gets one made from its session and directory. */
export function workspaceRecord(state: Pick<State, "workspaces" | "sessions">, id: string): WorkspaceRecord | undefined {
  const sessionId = scopeSessionId(id);
  if (!sessionId) return state.workspaces.find((candidate) => candidate.id === id);
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (!session) return undefined;
  const cached = records.get(id);
  if (cached?.session === session) return cached.record;
  let path = "";
  try { path = decode(id.slice(PREFIX.length + sessionId.length + 1)); } catch { return undefined; }
  const record: WorkspaceRecord = {
    id,
    projectId: session.projectId ?? "",
    hostId: "local",
    path,
    name: path.replace(/\/+$/, "").split("/").pop() || "/",
    branch: path === session.currentCwd ? session.currentBranch : undefined,
    dirty: false,
    state: "active",
    createdAt: session.createdAt,
    updatedAt: session.createdAt,
    hidden: true,
  };
  records.set(id, { session, record });
  return record;
}
