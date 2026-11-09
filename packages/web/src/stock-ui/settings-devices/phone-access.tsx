//! Phone access, as shown in Settings > Devices: the switch that lets a phone reach this computer, the addresses it can
//! use, and the relay for phones on any network. The status comes from Perch (`phone`, kept current); the QR a phone
//! scans to pair is drawn by `main.tsx`.
import { buttonClass as button, cn, SettingRow, settingsClass, Switch, type DevicesSettingsProps, type PhoneAccessStatus, type PhoneAddress } from "@perch/sdk";
import { useState } from "react";
import { useDraft } from "./draft";

type Actions = DevicesSettingsProps["actions"];

const TAILSCALE_HINT: Record<string, string> = {
  missing: "Install Tailscale on this computer and on the phone, signed in to the same account, to reach this computer from anywhere.",
  needsLogin: "Tailscale is installed but not signed in. Open it and sign in, then sign in on the phone with the same account.",
  stopped: "Tailscale is installed but not connected. Open it and turn it on, here and on the phone.",
};

/** The address a phone should use: Tailscale reaches it from anywhere, the LAN address only on the same Wi-Fi. */
export function pickAddress(status: PhoneAccessStatus | null, kind: string | null): PhoneAddress | undefined {
  return status?.addresses.find((a) => a.kind === kind) ?? status?.addresses[0];
}

const KIND_LABEL: Record<string, string> = { tailscale: "Tailscale", lan: "Same Wi-Fi", relay: "Relay" };

/** The address as shown: the relay's link carries the end-to-end key after the `#`, which doesn't belong on a screen
 * others can see. */
function shownAddress(address: PhoneAddress): string {
  return address.kind === "relay" ? address.url.split("#")[0] ?? address.url : address.url;
}

function RelayState({ relay }: { relay: PhoneAccessStatus["relay"] }) {
  const text = relay?.state === "online" ? "Connected" : relay?.state === "connecting" ? "Connecting…" : relay?.state === "error" ? relay.message : null;
  if (!text) return null;
  return <span className={cn("mt-1 block", relay?.state === "error" ? "text-red" : "")} role="status" data-testid="relay-status">{text}</span>;
}

/** The relay at an address you choose (your own deployment of `relay/`). */
function OwnRelayRow({ saved, status, title, actions }: { saved: string; status: PhoneAccessStatus | null; title: string; actions: Actions }) {
  const [url, setUrl] = useDraft("settings:devices:relayUrl", saved);
  const save = () => {
    const next = url.trim();
    setUrl(next);
    actions.updateSettings({ relayUrl: next });
  };
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
        className={cn(settingsClass.input, "w-[16rem] flex-none")}
        placeholder="perch-relay.you.workers.dev"
        aria-label="Relay address"
        data-testid="relay-url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && save()}
      />
      <button type="button" className={button({ variant: "soft", size: "sm" })} data-testid="relay-save" disabled={url.trim() === saved} onClick={save}>
        {url.trim() === "" ? "Turn off" : "Save"}
      </button>
    </SettingRow>
  );
}

/** Remote access: one switch when this build offers a relay, always the option of your own. */
function RelayRow({ saved, status, actions }: { saved: string; status: PhoneAccessStatus | null; actions: Actions }) {
  const [showOwn, setShowOwn] = useState(false);
  const hosted = status?.defaultRelay;
  if (!hosted) return <OwnRelayRow saved={saved} status={status} title="Relay" actions={actions} />;
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
        <Switch label="Remote access" testId="remote-access-switch" checked={saved === hosted} onChange={(on) => actions.updateSettings({ relayUrl: on ? hosted : "" })} />
      </SettingRow>
      {own || showOwn ? (
        <OwnRelayRow saved={saved} status={status} title="Your own relay" actions={actions} />
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

export function PhoneAccessRows({ status, saved, kind, onKind, actions }: { status: PhoneAccessStatus | null; saved: string; kind: string | null; onKind: (kind: string) => void; actions: Actions }) {
  const enabled = status?.enabled ?? false;
  const address = pickAddress(status, kind);
  const hasTailscale = status?.addresses.some((a) => a.kind === "tailscale") ?? false;

  // Headless `perch-core` already listens on the network, so it has no Wi-Fi switch. The relay works either way, and
  // its address shows beside the others whenever there is one.
  const alwaysOn = status?.alwaysOn ?? false;
  return (
    <>
      {!alwaysOn && (
        <SettingRow title="Phone access" description="Let a paired phone reach this computer on your Wi-Fi or over Tailscale. Off, only this app can. Pairing is still required.">
          <Switch label="Phone access" testId="phone-access-switch" checked={enabled} onChange={(on) => actions.updateSettings({ phoneAccess: on })} />
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
            <span className={settingsClass.addr} data-testid="phone-address-url">{shownAddress(address)}</span>
          ) : (
            <span className={settingsClass.muted}>No network address found. Connect this computer to Wi-Fi or Tailscale.</span>
          )}
          {enabled && !hasTailscale && (
            <div className="flex flex-col items-start gap-[0.4rem]" data-testid="phone-tailscale-hint">
              <span className={settingsClass.muted}>
                {TAILSCALE_HINT[status!.tailscale ?? ""] ?? "Tailscale isn’t running on this computer. Turn it on here and on the phone (same account) to reach this computer from anywhere."}
                {" "}Until then the phone must be on this Wi-Fi, which many campus, office and apartment networks block. This updates by itself.
              </span>
              {status!.tailscale === "missing" && (
                <button type="button" className={button({ variant: "soft", size: "sm" })} data-testid="phone-get-tailscale" onClick={() => actions.openExternal("https://tailscale.com/download")}>
                  Get Tailscale
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <RelayRow saved={saved} status={status} actions={actions} />
    </>
  );
}
