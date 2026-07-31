/**
 * Composer attachments — upload a file to the local perch server and get back
 * the absolute staged path that `chat.send`'s `attachments` carries.
 *
 * The endpoint (`POST {base}upload?sessionId=…&name=…`, see server.rs's
 * `attachment_upload`) takes the raw file bytes as the body — no multipart,
 * one file per request — and stages them under `~/.perch/uploads/<sessionId>/`.
 * Only the path crosses the wire afterwards, so the transcript never holds
 * base64 image data.
 *
 * Staging is always *local*, exactly like clipboard-image paste: the browser
 * has no HTTP route to a federated remote's filesystem. Direct-mode hosts
 * still work — the server copies the staged file into the remote run
 * directory before launching the CLI (see detached.rs).
 */
import { getAttachmentUploadUrl } from "./base";

export interface StagedAttachment {
  /** Absolute path on the server — what goes into `chat.send.attachments`. */
  path: string;
  /** Server-sanitized display name. */
  name: string;
  /** Client-side id so a chip can be removed before send. */
  id: string;
}

/** Server's cap (`attachment_upload`); checked client-side too so an oversized
 * file fails immediately with a clear message instead of a 413. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export async function uploadAttachment(sessionId: string, file: File): Promise<StagedAttachment> {
  if (file.size === 0) throw new Error(`${file.name} is empty`);
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error(`${file.name} is larger than 25MB`);
  const res = await fetch(getAttachmentUploadUrl(sessionId, file.name), {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: await file.arrayBuffer(),
  });
  if (!res.ok) {
    throw new Error(`upload failed (${res.status})`);
  }
  const data = (await res.json()) as { path?: string; name?: string };
  if (!data.path) throw new Error("upload returned no path");
  return {
    path: data.path,
    name: data.name || file.name,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
}
