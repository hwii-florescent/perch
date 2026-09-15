/**
 * One random-id helper for the whole client.
 *
 * `crypto.randomUUID` only exists in a *secure context*: https, or localhost.
 * A phone opening perch over the LAN (`http://192.168.x.x:7788`) is neither,
 * and every unguarded call there threw `crypto.randomUUID is not a function`
 * and took the React tree down with it. `crypto.getRandomValues` is available
 * in both contexts, so this builds the same v4-shaped id from it when the
 * convenience wrapper is missing.
 *
 * Four modules had grown their own copy of this fallback; this is the one they
 * now share.
 */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
