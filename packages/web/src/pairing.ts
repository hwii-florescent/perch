/**
 * Device pairing (see `crates/perch-core/src/devices.rs`).
 *
 * perch's host binds `0.0.0.0`, so anything reaching it from off the loopback
 * interface must present a device token. The browser cannot read the status of
 * a rejected WebSocket handshake, so `isPaired()` asks the one HTTP endpoint
 * that answers that question; `claimPairing()` exchanges a code typed by the
 * user for a token, which the server also sets as a cookie so the next WS
 * handshake carries it.
 */
import { getBasePath } from "./base";

function pairUrl(): string {
  return `${window.location.origin}${getBasePath()}pair`;
}

/** Whether this browser may reach perch's data plane right now. */
export async function isPaired(): Promise<boolean> {
  try {
    const response = await fetch(pairUrl(), { credentials: "include" });
    if (!response.ok) return true; // An older host has no gate at all.
    const body = (await response.json()) as { paired?: boolean };
    return body.paired !== false;
  } catch {
    // The host is unreachable, which is a disconnect, not a pairing problem.
    return true;
  }
}

/** Exchange a pairing code for this device's token. Throws with the host's
 * own message ("that pairing code has expired", …) so the user sees why. */
export async function claimPairing(code: string, name: string): Promise<void> {
  const response = await fetch(pairUrl(), {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: code.trim(), name: name.trim() }),
  });
  if (!response.ok) throw new Error((await response.text()) || "pairing failed");
}
