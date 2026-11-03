// Runnable close/routing regression; no Cloudflare account, network, or new dependencies.
// node --experimental-strip-types relay/check.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";

const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "cloudflare:workers") return {
      url: "data:text/javascript,export class DurableObject { constructor(ctx) { this.ctx = ctx; } }",
      shortCircuit: true,
    };
    return next(specifier, context);
  },
});
const { Room } = await import("./src/index.ts");
hooks.deregister();

class Socket {
  readyState = WebSocket.OPEN;
  sent = [];
  closes = [];
  constructor(tags, gid = 7) { this.tags = tags; this.gid = gid; }
  deserializeAttachment() { return { gid: this.gid }; }
  send(bytes) { assert.equal(this.readyState, WebSocket.OPEN, "send to a closing socket"); this.sent.push(bytes); }
  close(code) { this.closes.push(code); this.readyState = WebSocket.CLOSING; }
}
function room(sockets) {
  const ctx = {
    getWebSockets: (tag) => sockets.filter((socket) => socket.tags.includes(tag) && socket.readyState !== WebSocket.CLOSED),
    getTags: (socket) => socket.tags,
    acceptWebSocket: (socket, tags) => { socket.tags = tags; sockets.push(socket); },
  };
  return new Room(ctx);
}

// Closing a host must detach its old sealed sessions and finish the host handshake.
{
  const host = new Socket(["host"]), guest = new Socket(["guest", "7"]);
  host.readyState = WebSocket.CLOSING;
  room([host, guest]).webSocketClose(host, 1000);
  assert.deepEqual(guest.closes, [4004]);
  assert.deepEqual(host.closes, [1000]);
}
// A late close from the replaced host must not kill the new host's guests.
{
  const stale = new Socket(["host"]), current = new Socket(["host"]), guest = new Socket(["guest", "7"]);
  stale.readyState = WebSocket.CLOSING;
  room([stale, current, guest]).webSocketClose(stale, 1000);
  assert.deepEqual(guest.closes, []);
  assert.deepEqual(stale.closes, [1000]);
}
// Hibernation can return closing sockets before the live host in tag order.
{
  const stale = new Socket(["host"]), current = new Socket(["host"]), guest = new Socket(["guest", "7"]);
  stale.readyState = WebSocket.CLOSING;
  room([stale, current, guest]).webSocketMessage(guest, new Uint8Array([5, 6]).buffer);
  assert.equal(stale.sent.length, 0);
  assert.deepEqual([...current.sent[0]], [0, 0, 0, 0, 7, 5, 6]);
  guest.readyState = WebSocket.CLOSING;
  room([current, guest]).webSocketMessage(current, new Uint8Array([0, 0, 0, 0, 7, 5]).buffer);
  assert.equal(guest.sent.length, 0);
}
// Host replacement explicitly closes guests, independent of Rust task cleanup timing.
{
  const NativeResponse = globalThis.Response;
  const NativePair = globalThis.WebSocketPair;
  globalThis.Response = class { constructor(_body, init) { Object.assign(this, init); } };
  globalThis.WebSocketPair = class { constructor() { this[0] = new Socket([]); this[1] = new Socket([]); } };
  try {
    const host = new Socket(["host"]), guest = new Socket(["guest", "7"]);
    const secret = Buffer.alloc(32, 7);
    const id = createHash("sha256").update(secret).digest("base64url");
    const response = await room([host, guest]).fetch(new Request(`https://relay.example/r/${id}?role=host&auth=${secret.toString("base64url")}`));
    assert.equal(response.status, 101);
    assert.deepEqual(host.closes, [4001]);
    assert.deepEqual(guest.closes, [4004]);
  } finally {
    globalThis.Response = NativeResponse;
    globalThis.WebSocketPair = NativePair;
  }
}
console.log("Relay close/routing check passed.");
