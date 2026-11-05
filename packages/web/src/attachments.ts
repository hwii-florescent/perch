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
 * Ordinary composer uploads stay local. Agent Option/Alt-drops pass a host id
 * and explicit SCP intent; core validates session ownership, streams a local
 * staging file, then transfers it into a private folder on that SSH host.
 * Send the File itself so native fetch can stream it without an ArrayBuffer.
 */
import { getAttachmentUploadUrl } from "./base";
import { isRelayMode } from "./relay/transport";

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
export const MAX_ATTACHMENT_BYTES = 1024 * 1024 * 1024;
// ponytail: the sealed relay buffers each request; stream its protocol before raising this cap.
export const MAX_RELAY_ATTACHMENT_BYTES = 64 * 1024 * 1024;

export async function uploadAttachment(sessionId: string, file: File, hostId?: string): Promise<StagedAttachment> {
  if (file.size === 0) throw new Error(`${file.name} is empty`);
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error(`${file.name} is larger than 1 GiB`);
  if (isRelayMode() && file.size > MAX_RELAY_ATTACHMENT_BYTES) {
    throw new Error("The phone relay supports files up to 64 MiB. Use a direct connection for files up to 1 GiB.");
  }
  const res = await fetch(getAttachmentUploadUrl(sessionId, file.name, hostId), {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500).trim();
    throw new Error(`upload failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  const data = (await res.json()) as { path?: string; name?: string };
  if (!data.path) throw new Error("upload returned no path");
  return {
    path: data.path,
    name: data.name || file.name,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
}
