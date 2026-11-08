import { getWorkspaceFileUrl } from "./base";
import { isRelayMode, relayBlobUrl } from "./relay/transport";

/** What a sandboxed mod panel may ask this page. The panel has no network and no cookie, so it
 * posts `{perch: "read-file", id, path}` and gets `{perch: "reply", id, ok, text | error}` back.
 * The core still confines the path to the workspace; this adds the mod's approved capability and
 * a size cap. Nothing else is answered. */
export const MAX_PANEL_READ = 256 * 1024;

export type PanelReply = { perch: "reply"; id: unknown; ok: true; text: string } | { perch: "reply"; id: unknown; ok: false; error: string };

type Read = (workspaceId: string, path: string) => Promise<string>;

async function fetchText(workspaceId: string, path: string): Promise<string> {
  const url = getWorkspaceFileUrl(workspaceId, path);
  const target = isRelayMode() ? await relayBlobUrl(url) : url;
  try {
    const response = await fetch(target, { credentials: "same-origin" });
    if (!response.ok) throw new Error("Cannot read that file.");
    const text = await response.text();
    if (text.length > MAX_PANEL_READ) throw new Error("That file is too large.");
    return text;
  } finally {
    if (target !== url) URL.revokeObjectURL(target);
  }
}

/** Answer one message from a panel. `allowed` is whether the mod's approved capabilities include
 * `read-project`; `workspaceId` is null when there is no local project open. */
export async function answerPanel(data: unknown, allowed: boolean, workspaceId: string | null, read: Read = fetchText): Promise<PanelReply | null> {
  if (typeof data !== "object" || data === null || (data as { perch?: unknown }).perch !== "read-file") return null;
  const { id, path } = data as { id?: unknown; path?: unknown };
  const fail = (error: string): PanelReply => ({ perch: "reply", id, ok: false, error });
  if (!allowed) return fail("This mod was not approved to read project files.");
  if (!workspaceId) return fail("No project is open.");
  if (typeof path !== "string" || !path || path.length > 1024) return fail("Give a file path.");
  try {
    return { perch: "reply", id, ok: true, text: await read(workspaceId, path) };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Cannot read that file.");
  }
}
