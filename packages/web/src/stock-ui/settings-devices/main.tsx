//! Devices settings, the stock screen `stock:settings-devices`: phone access (the switch, the addresses, the relay),
//! pairing a device with a code and its QR, and the devices already paired. Settings > Devices shows it (the phone
//! keeps Perch's own, without the Phone access group: a phone must not switch off the only way it reaches the
//! computer); or the person's package chosen for it (`perch mod use stock:settings-devices <id>`) with the same props.
//!
//! Access, the pairing code and its expiry, the paired devices, and every change (`actions`) are Perch's; so is the
//! link the QR carries (`actions.pairLink`). The relay address being typed is kept by Perch under
//! `settings:devices:relayUrl` until it is saved. The QR is `QrCode` from `@perch/sdk`.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:settings-devices` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { useEffect, useState } from "react";
import { QrCode, SettingsGroup, settingsClass, type DevicesSettingsProps } from "@perch/sdk";
import { PhoneAccessRows, pickAddress } from "./phone-access";

export default function DevicesSettings({ settings, isMobile, phone, devices, pairing, actions }: DevicesSettingsProps) {
  const [addressKind, setAddressKind] = useState<string | null>(null);
  const address = pickAddress(phone, addressKind);
  const [now, setNow] = useState(() => Date.now());
  const { muted, empty, list, hostRow, name, addr } = settingsClass;

  // Only ticks while a code is on screen: the countdown is the only reason this page needs a clock at all.
  useEffect(() => {
    if (!pairing) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pairing]);
  const remaining = pairing ? Math.max(0, Math.round((pairing.expiresAt - now) / 1000)) : 0;

  return (
    <>
    {!isMobile && (
      <SettingsGroup title="Phone access" testId="settings-phone-access">
        <PhoneAccessRows status={phone} saved={settings?.relayUrl ?? ""} kind={addressKind} onKind={setAddressKind} actions={actions} />
      </SettingsGroup>
    )}
    <SettingsGroup testId="settings-devices">
      <div className="py-3">
      <p className={muted}>
        Anything reaching this host from another machine needs a paired device. Local access never does.
      </p>
      {pairing ? (
        <div className="my-2 flex flex-wrap items-center gap-[0.8rem] rounded-ui bg-surface-0 px-3 py-[0.6rem]" data-testid="pair-code">
          {address && <QrCode text={actions.pairLink(address.url, pairing.code)} />}
          <div className="flex min-w-0 flex-1 basis-[14rem] flex-col gap-[0.4rem]">
          <strong className="tracking-[0.22em] [font:1.15rem/1_var(--font-mono)]">{pairing.code}</strong>
          <span className={muted}>
            {address ? (address.kind === "relay" ? "Scan the QR with the phone." : "Scan the QR with the phone, or open the address above and enter the code.") : "Enter it on the other device."} Expires in {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}.
          </span>
          </div>
          <button type="button" data-testid="pair-cancel" onClick={() => actions.pairCancel()}>
            Cancel
          </button>
        </div>
      ) : phone?.enabled === false && !phone.relay ? (
        <p className={muted} data-testid="pair-needs-access">Turn on Phone access or set a relay to pair a phone.</p>
      ) : (
        <button type="button" data-testid="pair-start" onClick={() => actions.pairStart()}>
          Pair a device
        </button>
      )}
      {devices.length === 0 ? (
        <p className={empty}>No paired devices.</p>
      ) : (
        <ul className={list} data-testid="paired-devices">
          {devices.map((device) => (
            <li key={device.id} className={hostRow}>
              <span className={name}>{device.name}</span>
              <span className={addr}>
                last seen {new Date(device.lastSeenAt).toLocaleString()}
              </span>
              <button type="button" data-testid={`device-revoke-${device.id}`} onClick={() => actions.revoke(device.id)}>
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
      </div>
    </SettingsGroup>
    </>
  );
}
