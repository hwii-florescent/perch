/**
 * The phone's half of the relay's sealed session. The host's half, and the
 * reasoning, are in `crates/perch-core/src/relay/wire.rs`; `wire.test.ts`
 * opens the same bytes the Rust test seals.
 */

export const KEY_LEN = 32;
export const NONCE_LEN = 16;
const IV_LEN = 12;

export const HELLO_GUEST = 0x10;
export const HELLO_HOST = 0x11;
export const REQ_HEAD = 1;
export const REQ_BODY = 2;
export const REQ_END = 3;
export const RES_HEAD = 4;
export const RES_BODY = 5;
export const RES_END = 6;
export const WS_OPEN = 7;
export const WS_OPENED = 8;
export const WS_TEXT = 9;
export const WS_BIN = 10;
export const WS_CLOSE = 11;
/** Non-final piece of a text message too big for one frame (see wire.rs). */
export const WS_TEXT_PART = 12;

const text = new TextEncoder();

export function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** IV (random unless a test pins it) followed by ciphertext and tag. */
export async function seal(key: CryptoKey, aad: Uint8Array, plain: Uint8Array, iv: Uint8Array = crypto.getRandomValues(new Uint8Array(IV_LEN))): Promise<Uint8Array> {
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource, additionalData: aad as BufferSource }, key, plain as BufferSource));
  return concat(iv, body);
}

/** `null` when the frame was not sealed for exactly this session, place and order. */
export async function open(key: CryptoKey, aad: Uint8Array, sealed: Uint8Array): Promise<Uint8Array | null> {
  if (sealed.length < IV_LEN + 16) return null;
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: sealed.slice(0, IV_LEN) as BufferSource, additionalData: aad as BufferSource }, key, sealed.slice(IV_LEN) as BufferSource);
    return new Uint8Array(plain);
  } catch {
    return null;
  }
}

export function helloAad(fromHost: boolean, guestNonce?: Uint8Array): Uint8Array {
  const base = text.encode(fromHost ? "perch-relay-v1/hello-host" : "perch-relay-v1/hello-guest");
  return guestNonce ? concat(base, guestNonce) : base;
}

export function dataAad(guest: Uint8Array, host: Uint8Array, fromHost: boolean, counter: number): Uint8Array {
  const tail = new Uint8Array(9);
  tail[0] = fromHost ? 1 : 0;
  new DataView(tail.buffer).setBigUint64(1, BigInt(counter));
  return concat(text.encode("perch-relay-v1/data"), guest, host, tail);
}

export function frame(kind: number, id: number, payload: Uint8Array = new Uint8Array(0)): Uint8Array {
  const out = new Uint8Array(5 + payload.length);
  out[0] = kind;
  new DataView(out.buffer).setUint32(1, id);
  out.set(payload, 5);
  return out;
}

export function parseFrame(plain: Uint8Array): { kind: number; id: number; payload: Uint8Array } | null {
  const kind = plain[0];
  if (kind === undefined || plain.length < 5) return null;
  return { kind, id: new DataView(plain.buffer, plain.byteOffset).getUint32(1), payload: plain.subarray(5) };
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

export function base64urlDecode(textValue: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(textValue.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}
