/**
 * Phone access, as shown in Settings → Devices: the switch that lets a phone
 * reach this computer, the addresses it can use, and the QR a phone scans to
 * pair (`crates/perch-core/src/server/phone_access.rs`).
 *
 * The QR carries a link, `<address>#pair=<code>`; opening it on the phone
 * lands on the connect screen, which claims the code (`pairing.ts`). The code
 * rides in the #hash so it never reaches a server log.
 */
import { useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import type { PhoneAccessStatusMessage, PhoneAddress } from "@perch/shared";
import { socket } from "../ws";
import { newId } from "../ids";
import { usePerchStore } from "../store";
import { Switch } from "./ui/switch";
import { SettingRow } from "./ui/setting-row";
import { cn } from "../lib/cn";
import { ADDR, MUTED } from "./ui/settings";

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
  return status;
}

/** The address a phone should use: Tailscale reaches it from anywhere, the LAN
 * address only on the same Wi-Fi. */
export function pickAddress(status: PhoneStatus | null, kind: string | null): PhoneAddress | undefined {
  return status?.addresses.find((a) => a.kind === kind) ?? status?.addresses[0];
}

const KIND_LABEL: Record<string, string> = { tailscale: "Tailscale", lan: "Same Wi-Fi" };

export function PhoneAccessRows({ status, kind, onKind }: { status: PhoneStatus | null; kind: string | null; onKind: (kind: string) => void }) {
  const updateSettings = usePerchStore((s) => s.updateSettings);
  const enabled = status?.enabled ?? false;
  const address = pickAddress(status, kind);
  const hasTailscale = status?.addresses.some((a) => a.kind === "tailscale") ?? false;

  // Headless `perch-core` already listens on the network; there is no switch.
  if (status?.alwaysOn) return null;
  return (
    <>
      <SettingRow title="Phone access" description="Let a paired phone reach this computer on your Wi-Fi or over Tailscale. Off, only this app can. Pairing is still required.">
        <Switch label="Phone access" testId="phone-access-switch" checked={enabled} onChange={(on) => updateSettings({ phoneAccess: on })} />
      </SettingRow>
      {status?.error && <p className="m-0 py-1 text-[0.78rem] text-red" role="alert" data-testid="phone-access-error">{status.error}</p>}
      {enabled && (
        <div className="flex flex-col gap-[0.4rem] py-2" data-testid="phone-access-addresses">
          {status!.addresses.length > 1 && (
            <div className="flex gap-1" role="group" aria-label="Address for the phone">
              {status!.addresses.map((a) => (
                <button
                  key={a.kind}
                  type="button"
                  className={cn("min-h-8 cursor-pointer rounded-ui border bg-transparent px-3 text-[0.78rem] [font-family:inherit] max-[700px]:min-h-11", a.kind === address?.kind ? "border-overlay-1 bg-surface-1 text-fg" : "border-overlay-0 text-subtext-0 hover:text-fg")}
                  aria-pressed={a.kind === address?.kind}
                  data-testid={`phone-address-${a.kind}`}
                  onClick={() => onKind(a.kind)}
                >
                  {KIND_LABEL[a.kind] ?? a.kind}
                </button>
              ))}
            </div>
          )}
          {address ? (
            <span className={ADDR} data-testid="phone-address-url">{address.url}</span>
          ) : (
            <span className={MUTED}>No network address found. Connect this computer to Wi-Fi or Tailscale.</span>
          )}
          {!hasTailscale && address && (
            <span className={MUTED}>Tailscale isn’t running here, so the phone must be on this Wi-Fi.</span>
          )}
        </div>
      )}
    </>
  );
}

/** Black on white with a quiet zone, whatever the theme: scanners need it. */
export function QrCode({ text }: { text: string }) {
  const { size, path } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    let d = "";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
    }
    return { size: count, path: d };
  }, [text]);
  return (
    <svg
      viewBox={`-4 -4 ${size + 8} ${size + 8}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Pairing QR code"
      data-testid="pair-qr"
      className="h-44 w-44 shrink-0 rounded-ui"
    >
      <rect x={-4} y={-4} width={size + 8} height={size + 8} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
