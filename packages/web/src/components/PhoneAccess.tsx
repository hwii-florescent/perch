/**
 * Phone access, as shown in Settings → Devices: the switch that lets a phone
 * reach this computer, the addresses it can use, and the QR a phone scans to
 * pair (`crates/perch-core/src/server/phone_access.rs`).
 *
 * The QR carries a link, `<address>#pair=<code>`; opening it on the phone
 * lands on the connect screen, which claims the code (`pairing.ts`). The code
 * rides in the #hash so it never reaches a server log. The relay's link already
 * has a #fragment (its key), so the code joins it with `&` (`pairLink`).
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
import { ADDR, INPUT, MUTED } from "./ui/settings";
import { button } from "./ui/button";
import { openExternal } from "../links";

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

const TAILSCALE_HINT: Record<string, string> = {
  missing: "Install Tailscale on this computer and on the phone, signed in to the same account, to reach this computer from anywhere.",
  needsLogin: "Tailscale is installed but not signed in. Open it and sign in, then sign in on the phone with the same account.",
  stopped: "Tailscale is installed but not connected. Open it and turn it on, here and on the phone.",
};

/** The address a phone should use: Tailscale reaches it from anywhere, the LAN
 * address only on the same Wi-Fi. */
export function pickAddress(status: PhoneStatus | null, kind: string | null): PhoneAddress | undefined {
  return status?.addresses.find((a) => a.kind === kind) ?? status?.addresses[0];
}

const KIND_LABEL: Record<string, string> = { tailscale: "Tailscale", lan: "Same Wi-Fi", relay: "Relay" };

/** What the QR encodes: the address plus the pairing code, in the #hash. */
export function pairLink(address: string, code: string): string {
  return `${address}${address.includes("#") ? "&" : "#"}pair=${code}`;
}

/** The address as shown: the relay's link carries the end-to-end key after the
 * `#`, which doesn't belong on a screen others can see. */
function shownAddress(address: PhoneAddress): string {
  return address.kind === "relay" ? address.url.split("#")[0] ?? address.url : address.url;
}

function RelayState({ relay }: { relay: PhoneStatus["relay"] }) {
  const text = relay?.state === "online" ? "Connected" : relay?.state === "connecting" ? "Connecting…" : relay?.state === "error" ? relay.message : null;
  if (!text) return null;
  return <span className={cn("mt-1 block", relay?.state === "error" ? "text-red" : "")} role="status" data-testid="relay-status">{text}</span>;
}

/** The relay at an address you choose (your own deployment of `relay/`). */
function OwnRelayRow({ status, title }: { status: PhoneStatus | null; title: string }) {
  const saved = usePerchStore((s) => s.settings?.relayUrl ?? "");
  const updateSettings = usePerchStore((s) => s.updateSettings);
  const [url, setUrl] = useState(saved);
  useEffect(() => setUrl(saved), [saved]);
  return (
    <SettingRow
      title={title}
      description={
        <>
          Reach this computer from any network with only a browser on the phone. You run the relay yourself (a free Cloudflare Worker, see <code>relay/README.md</code>); it forwards data it cannot read. Pairing is still required.
          <RelayState relay={status?.relay} />
        </>
      }
    >
      <input
        type="text"
        className={cn(INPUT, "w-[16rem] flex-none")}
        placeholder="perch-relay.you.workers.dev"
        aria-label="Relay address"
        data-testid="relay-url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && updateSettings({ relayUrl: url.trim() })}
      />
      <button type="button" className={button({ variant: "soft", size: "sm" })} data-testid="relay-save" disabled={url.trim() === saved} onClick={() => updateSettings({ relayUrl: url.trim() })}>
        {url.trim() === "" ? "Turn off" : "Save"}
      </button>
    </SettingRow>
  );
}

/** Remote access: one switch when this build offers a relay, always the option of your own. */
function RelayRow({ status }: { status: PhoneStatus | null }) {
  const saved = usePerchStore((s) => s.settings?.relayUrl ?? "");
  const updateSettings = usePerchStore((s) => s.updateSettings);
  const [showOwn, setShowOwn] = useState(false);
  const hosted = status?.defaultRelay;
  if (!hosted) return <OwnRelayRow status={status} title="Relay" />;
  const own = saved !== "" && saved !== hosted;
  return (
    <>
      <SettingRow
        title="Remote access"
        description={
          <>
            Reach this computer from any network with only a browser on the phone. Everything is encrypted end to end; the relay passes it along and cannot read it. Pairing is still required.
            {!own && <RelayState relay={status?.relay} />}
          </>
        }
      >
        <Switch label="Remote access" testId="remote-access-switch" checked={saved === hosted} onChange={(on) => updateSettings({ relayUrl: on ? hosted : "" })} />
      </SettingRow>
      {own || showOwn ? (
        <OwnRelayRow status={status} title="Your own relay" />
      ) : (
        <div className="py-2">
          <button type="button" className={button({ variant: "ghost", size: "sm" })} data-testid="relay-own" onClick={() => setShowOwn(true)}>
            Use your own relay instead
          </button>
        </div>
      )}
    </>
  );
}

export function PhoneAccessRows({ status, kind, onKind }: { status: PhoneStatus | null; kind: string | null; onKind: (kind: string) => void }) {
  const updateSettings = usePerchStore((s) => s.updateSettings);
  const enabled = status?.enabled ?? false;
  const address = pickAddress(status, kind);
  const hasTailscale = status?.addresses.some((a) => a.kind === "tailscale") ?? false;

  // Headless `perch-core` already listens on the network, so it has no Wi-Fi switch. The relay
  // works either way, and its address shows beside the others whenever there is one.
  const alwaysOn = status?.alwaysOn ?? false;
  return (
    <>
      {!alwaysOn && (
        <SettingRow title="Phone access" description="Let a paired phone reach this computer on your Wi-Fi or over Tailscale. Off, only this app can. Pairing is still required.">
          <Switch label="Phone access" testId="phone-access-switch" checked={enabled} onChange={(on) => updateSettings({ phoneAccess: on })} />
        </SettingRow>
      )}
      {status?.error && <p className="m-0 py-1 text-[0.78rem] text-red" role="alert" data-testid="phone-access-error">{status.error}</p>}
      {(enabled || (status?.addresses.length ?? 0) > 0) && (
        <div className="flex flex-col gap-[0.4rem] py-2" data-testid="phone-access-addresses">
          {status!.addresses.length > 1 && (
            <div className="flex gap-1" role="group" aria-label="Address for the phone">
              {status!.addresses.map((a) => (
                <button
                  key={a.kind}
                  type="button"
                  className={cn("min-h-8 cursor-pointer rounded-ui bg-transparent px-3 text-[0.78rem] [font-family:inherit] max-[700px]:min-h-11", a.kind === address?.kind ? "bg-surface-1 text-fg" : "bg-surface-0 text-subtext-0 hover:text-fg")}
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
            <span className={ADDR} data-testid="phone-address-url">{shownAddress(address)}</span>
          ) : (
            <span className={MUTED}>No network address found. Connect this computer to Wi-Fi or Tailscale.</span>
          )}
          {enabled && !hasTailscale && (
            <div className="flex flex-col items-start gap-[0.4rem]" data-testid="phone-tailscale-hint">
              <span className={MUTED}>
                {TAILSCALE_HINT[status!.tailscale ?? ""] ?? "Tailscale isn’t running on this computer. Turn it on here and on the phone (same account) to reach this computer from anywhere."}
                {" "}Until then the phone must be on this Wi-Fi, which many campus, office and apartment networks block. This updates by itself.
              </span>
              {status!.tailscale === "missing" && (
                <button type="button" className={button({ variant: "soft", size: "sm" })} data-testid="phone-get-tailscale" onClick={() => openExternal("https://tailscale.com/download")}>
                  Get Tailscale
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <RelayRow status={status} />
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
