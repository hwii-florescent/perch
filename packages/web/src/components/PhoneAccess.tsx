/**
 * Phone access, the host's side of Settings → Devices: the engine that keeps the host's status current and what the
 * pairing QR carries (`crates/perch-core/src/server/phone_access.rs`). The rows themselves are the screen
 * `stock:settings-devices` (`stock-ui/settings-devices/`), drawn by `settingsRoutes.tsx`.
 *
 * The QR carries a link, `<address>#pair=<code>`; opening it on the phone
 * lands on the connect screen, which claims the code (`pairing.ts`). The code
 * rides in the #hash so it never reaches a server log. The relay's link already
 * has a #fragment (its key), so the code joins it with `&` (`pairLink`).
 */
import { useEffect, useState } from "react";
import type { PhoneAccessStatusMessage } from "@perch/shared";
import { socket } from "../ws";
import { newId } from "../ids";

export type PhoneStatus = Omit<PhoneAccessStatusMessage, "type" | "requestId">;

/** The host's phone-access status, kept current as the setting changes. */
export function usePhoneAccess(): PhoneStatus | null {
  const [status, setStatus] = useState<PhoneStatus | null>(null);
  useEffect(() => {
    const off = socket.onMessage((message) => {
      if (message.type === "phone.access.status") setStatus(message);
    });
    socket.send({ type: "phone.access.get", requestId: newId() });
    return off;
  }, []);
  // While Tailscale is being set up, look again so its address appears on its own.
  const waiting = !!status?.enabled && !!status.tailscale && status.tailscale !== "running";
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => socket.send({ type: "phone.access.get", requestId: newId() }), 5000);
    return () => clearInterval(timer);
  }, [waiting]);
  return status;
}

/** What the QR encodes: the address plus the pairing code, in the #hash. */
export function pairLink(address: string, code: string): string {
  return `${address}${address.includes("#") ? "&" : "#"}pair=${code}`;
}
