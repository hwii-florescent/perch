/**
 * Perch relay: a blind pipe between a computer running Perch (the host) and
 * the phones paired to it (guests), plus the static web app they open.
 *
 * It forwards opaque binary frames and nothing else. Every frame is sealed
 * end to end with a key that lives only in the link's #fragment (see
 * crates/perch-core/src/relay/wire.rs), so this code cannot read, alter or
 * replay a session, only drop it. It keeps no data: a room is its
 * open sockets.
 *
 *   /r/<room>?role=host&auth=<secret>   the computer; <room> = base64url(sha256(secret))
 *   /r/<room>?role=guest                a phone
 *   anything else                       the web app (static assets)
 *
 * Frames between this relay and the host are  [kind][guest id u32 BE][payload]:
 *   host -> relay  kind 0: send payload to that guest;  kind 2: close that guest
 *   relay -> host  kind 0: payload came from that guest; kind 2: that guest left
 * Guests send and receive the bare payload.
 */
import { DurableObject } from "cloudflare:workers";

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
  ASSETS: Fetcher;
}

const ROOM_ID = /^[A-Za-z0-9_-]{43}$/;
/** Phones per room. A room is one person's computer. */
const MAX_GUESTS = 16;
/** Frames are well under this (48 KiB of plaintext); anything bigger is abuse. */
const MAX_FRAME = 1 << 20;
const DATA = 0;
const LEFT = 2;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const match = /^\/r\/([^/]+)$/.exec(new URL(request.url).pathname);
    if (!match) return env.ASSETS.fetch(request);
    if (!ROOM_ID.test(match[1])) return new Response("bad room", { status: 400 });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("expected a websocket", { status: 426 });
    return env.ROOM.get(env.ROOM.idFromName(match[1])).fetch(request);
  },
};

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text: string): Uint8Array | null {
  try {
    const padded = text.replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** The room id is the hash of the host's secret, so the relay stores nothing
 * and a guest, who knows only the id, cannot become the host. */
async function ownsRoom(room: string, auth: string | null): Promise<boolean> {
  const secret = auth ? fromBase64url(auth) : null;
  if (!secret || secret.length !== 32) return false;
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", secret))) === room;
}

function envelope(kind: number, gid: number, payload?: Uint8Array): Uint8Array {
  const out = new Uint8Array(5 + (payload?.length ?? 0));
  out[0] = kind;
  new DataView(out.buffer).setUint32(1, gid);
  if (payload) out.set(payload, 5);
  return out;
}

export class Room extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const role = url.searchParams.get("role");
    const { 0: client, 1: server } = new WebSocketPair();
    if (role === "host") {
      const room = url.pathname.split("/").pop()!;
      if (!(await ownsRoom(room, url.searchParams.get("auth")))) return new Response("not this room's host", { status: 403 });
      // One host per room: a restarted computer replaces its stale socket.
      for (const old of this.ctx.getWebSockets("host")) old.close(4001, "replaced by a newer host");
      this.ctx.acceptWebSocket(server, ["host"]);
    } else if (role === "guest") {
      const guests = this.ctx.getWebSockets("guest");
      if (guests.length >= MAX_GUESTS) return new Response("room is full", { status: 429 });
      const taken = new Set(guests.map((ws) => (ws.deserializeAttachment() as { gid: number }).gid));
      let gid = 0;
      do gid = crypto.getRandomValues(new Uint32Array(1))[0]; while (taken.has(gid) || gid === 0);
      server.serializeAttachment({ gid });
      this.ctx.acceptWebSocket(server, ["guest", String(gid)]);
      if (this.ctx.getWebSockets("host").length === 0) server.close(4004, "host offline");
    } else {
      return new Response("role must be host or guest", { status: 400 });
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message === "string" || message.byteLength > MAX_FRAME) return ws.close(1009, "binary frames only, 1 MiB at most");
    const bytes = new Uint8Array(message);
    if (this.ctx.getTags(ws).includes("host")) {
      if (bytes.length < 5) return;
      const gid = new DataView(message).getUint32(1);
      const guest = this.ctx.getWebSockets(String(gid))[0];
      if (bytes[0] === DATA) guest?.send(bytes.subarray(5));
      else if (bytes[0] === LEFT) guest?.close(4005, "closed by host");
      return;
    }
    const host = this.ctx.getWebSockets("host")[0];
    if (!host) return ws.close(4004, "host offline");
    const { gid } = ws.deserializeAttachment() as { gid: number };
    host.send(envelope(DATA, gid, bytes));
  }

  webSocketClose(ws: WebSocket, code: number): void {
    if (!this.ctx.getTags(ws).includes("guest")) return;
    const { gid } = ws.deserializeAttachment() as { gid: number };
    this.ctx.getWebSockets("host")[0]?.send(envelope(LEFT, gid));
    // Echo the close so the socket finishes; 1005/1006 are not sendable codes.
    // A socket that is already closed throws, and then there is nothing to do.
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code);
    } catch {
      return;
    }
  }

  webSocketError(ws: WebSocket): void {
    this.webSocketClose(ws, 1011);
  }
}
