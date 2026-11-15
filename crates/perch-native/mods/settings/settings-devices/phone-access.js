// phone-access.tsx of Perch's stock screen "stock:settings-devices", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
//! Phone access, as shown in Settings > Devices: the switch that lets a phone reach this computer, the addresses it can
//! use, and the relay for phones on any network. The status comes from Perch (`phone`, kept current); the QR a phone
//! scans to pair is drawn by `main.tsx`.
import { buttonClass as button, cn, SettingRow, settingsClass, Switch } from "@perch/sdk";
import { useState } from "react";
import { useDraft } from "./draft.js";
const TAILSCALE_HINT = {
    missing: "Install Tailscale on this computer and on the phone, signed in to the same account, to reach this computer from anywhere.",
    needsLogin: "Tailscale is installed but not signed in. Open it and sign in, then sign in on the phone with the same account.",
    stopped: "Tailscale is installed but not connected. Open it and turn it on, here and on the phone.",
};
/** The address a phone should use: Tailscale reaches it from anywhere, the LAN address only on the same Wi-Fi. */
export function pickAddress(status, kind) {
    return status?.addresses.find((a) => a.kind === kind) ?? status?.addresses[0];
}
const KIND_LABEL = { tailscale: "Tailscale", lan: "Same Wi-Fi", relay: "Relay" };
/** The address as shown: the relay's link carries the end-to-end key after the `#`, which doesn't belong on a screen
 * others can see. */
function shownAddress(address) {
    return address.kind === "relay" ? address.url.split("#")[0] ?? address.url : address.url;
}
function RelayState({ relay }) {
    const text = relay?.state === "online" ? "Connected" : relay?.state === "connecting" ? "Connecting…" : relay?.state === "error" ? relay.message : null;
    if (!text)
        return null;
    return _jsx("span", {
        className: cn("mt-1 block", relay?.state === "error" ? "text-red" : ""),
        role: "status",
        "data-testid": "relay-status",
        children: text
    });
}
/** The relay at an address you choose (your own deployment of `relay/`). */
function OwnRelayRow({ saved, status, title, actions }) {
    const [url, setUrl] = useDraft("settings:devices:relayUrl", saved);
    const save = () => {
        const next = url.trim();
        setUrl(next);
        actions.updateSettings({ relayUrl: next });
    };
    return (_jsxs(SettingRow, {
        title: title,
        description: _jsxs(_Fragment, { children: ["Reach this computer from any network with only a browser on the phone. You run the relay yourself (a free Cloudflare Worker, see ", _jsx("code", { children: "relay/README.md" }), "); it forwards data it cannot read. Pairing is still required.", _jsx(RelayState, { relay: status?.relay })] }),
        children: [
            _jsx("input", {
                type: "text",
                className: cn(settingsClass.input, "w-[16rem] flex-none"),
                placeholder: "perch-relay.you.workers.dev",
                "aria-label": "Relay address",
                "data-testid": "relay-url",
                value: url,
                onChange: (event) => setUrl(event.target.value),
                onKeyDown: (event) => event.key === "Enter" && save()
            }),
            _jsx("button", {
                type: "button",
                className: button({ variant: "soft", size: "sm" }),
                "data-testid": "relay-save",
                disabled: url.trim() === saved,
                onClick: save,
                children: url.trim() === "" ? "Turn off" : "Save"
            })
        ]
    }));
}
/** Remote access: one switch when this build offers a relay, always the option of your own. */
function RelayRow({ saved, status, actions }) {
    const [showOwn, setShowOwn] = useState(false);
    const hosted = status?.defaultRelay;
    if (!hosted)
        return _jsx(OwnRelayRow, {
            saved: saved,
            status: status,
            title: "Relay",
            actions: actions
        });
    const own = saved !== "" && saved !== hosted;
    return (_jsxs(_Fragment, { children: [_jsx(SettingRow, {
                title: "Remote access",
                description: _jsxs(_Fragment, { children: ["Reach this computer from any network with only a browser on the phone. Everything is encrypted end to end; the relay passes it along and cannot read it. Pairing is still required.", !own && _jsx(RelayState, { relay: status?.relay })] }),
                children: _jsx(Switch, {
                    label: "Remote access",
                    testId: "remote-access-switch",
                    checked: saved === hosted,
                    onChange: (on) => actions.updateSettings({ relayUrl: on ? hosted : "" })
                })
            }), own || showOwn ? (_jsx(OwnRelayRow, {
                saved: saved,
                status: status,
                title: "Your own relay",
                actions: actions
            })) : (_jsx("div", {
                className: "py-2",
                children: _jsx("button", {
                    type: "button",
                    className: button({ variant: "ghost", size: "sm" }),
                    "data-testid": "relay-own",
                    onClick: () => setShowOwn(true),
                    children: "Use your own relay instead"
                })
            }))] }));
}
export function PhoneAccessRows({ status, saved, kind, onKind, actions }) {
    const enabled = status?.enabled ?? false;
    const address = pickAddress(status, kind);
    const hasTailscale = status?.addresses.some((a) => a.kind === "tailscale") ?? false;
    // Headless `perch-core` already listens on the network, so it has no Wi-Fi switch. The relay works either way, and
    // its address shows beside the others whenever there is one.
    const alwaysOn = status?.alwaysOn ?? false;
    return (_jsxs(_Fragment, { children: [!alwaysOn && (_jsx(SettingRow, {
                title: "Phone access",
                description: "Let a paired phone reach this computer on your Wi-Fi or over Tailscale. Off, only this app can. Pairing is still required.",
                children: _jsx(Switch, {
                    label: "Phone access",
                    testId: "phone-access-switch",
                    checked: enabled,
                    onChange: (on) => actions.updateSettings({ phoneAccess: on })
                })
            })), status?.error && _jsx("p", {
                className: "m-0 py-1 text-[0.78rem] text-red",
                role: "alert",
                "data-testid": "phone-access-error",
                children: status.error
            }), (enabled || (status?.addresses.length ?? 0) > 0) && (_jsxs("div", {
                className: "flex flex-col gap-[0.4rem] py-2",
                "data-testid": "phone-access-addresses",
                children: [
                    status.addresses.length > 1 && (_jsx("div", {
                        className: "flex gap-1",
                        role: "group",
                        "aria-label": "Address for the phone",
                        children: status.addresses.map((a) => (_jsx("button", {
                            type: "button",
                            className: cn("min-h-8 cursor-pointer rounded-ui bg-transparent px-3 text-[0.78rem] [font-family:inherit] max-[700px]:min-h-11", a.kind === address?.kind ? "bg-surface-1 text-fg" : "bg-surface-0 text-subtext-0 hover:text-fg"),
                            "aria-pressed": a.kind === address?.kind,
                            "data-testid": `phone-address-${a.kind}`,
                            onClick: () => onKind(a.kind),
                            children: KIND_LABEL[a.kind] ?? a.kind
                        }, a.kind)))
                    })),
                    address ? (_jsx("span", {
                        className: settingsClass.addr,
                        "data-testid": "phone-address-url",
                        children: shownAddress(address)
                    })) : (_jsx("span", {
                        className: settingsClass.muted,
                        children: "No network address found. Connect this computer to Wi-Fi or Tailscale."
                    })),
                    enabled && !hasTailscale && (_jsxs("div", {
                        className: "flex flex-col items-start gap-[0.4rem]",
                        "data-testid": "phone-tailscale-hint",
                        children: [
                            _jsxs("span", {
                                className: settingsClass.muted,
                                children: [
                                    TAILSCALE_HINT[status.tailscale ?? ""] ?? "Tailscale isn’t running on this computer. Turn it on here and on the phone (same account) to reach this computer from anywhere.",
                                    " ",
                                    "Until then the phone must be on this Wi-Fi, which many campus, office and apartment networks block. This updates by itself."
                                ]
                            }),
                            status.tailscale === "missing" && (_jsx("button", {
                                type: "button",
                                className: button({ variant: "soft", size: "sm" }),
                                "data-testid": "phone-get-tailscale",
                                onClick: () => actions.openExternal("https://tailscale.com/download"),
                                children: "Get Tailscale"
                            }))
                        ]
                    }))
                ]
            })), _jsx(RelayRow, {
                saved: saved,
                status: status,
                actions: actions
            })] }));
}
