// main.tsx of Perch's stock screen "stock:settings-devices", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { QrCode, SettingsGroup, settingsClass } from "@perch/sdk";
import { PhoneAccessRows, pickAddress } from "./phone-access.js";
export default function DevicesSettings({ settings, isMobile, phone, devices, pairing, actions }) {
    const [addressKind, setAddressKind] = useState(null);
    const address = pickAddress(phone, addressKind);
    const [now, setNow] = useState(() => Date.now());
    const { muted, empty, list, hostRow, name, addr } = settingsClass;
    // Only ticks while a code is on screen: the countdown is the only reason this page needs a clock at all.
    useEffect(() => {
        if (!pairing)
            return;
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [pairing]);
    const remaining = pairing ? Math.max(0, Math.round((pairing.expiresAt - now) / 1000)) : 0;
    return (_jsxs(_Fragment, { children: [!isMobile && (_jsx(SettingsGroup, {
                title: "Phone access",
                testId: "settings-phone-access",
                children: _jsx(PhoneAccessRows, {
                    status: phone,
                    saved: settings?.relayUrl ?? "",
                    kind: addressKind,
                    onKind: setAddressKind,
                    actions: actions
                })
            })), _jsx(SettingsGroup, {
                testId: "settings-devices",
                children: _jsxs("div", {
                    className: "py-3",
                    children: [
                        _jsx("p", {
                            className: muted,
                            children: "Anything reaching this host from another machine needs a paired device. Local access never does."
                        }),
                        pairing ? (_jsxs("div", {
                            className: "my-2 flex flex-wrap items-center gap-[0.8rem] rounded-ui bg-surface-0 px-3 py-[0.6rem]",
                            "data-testid": "pair-code",
                            children: [
                                address && _jsx(QrCode, { text: actions.pairLink(address.url, pairing.code) }),
                                _jsxs("div", {
                                    className: "flex min-w-0 flex-1 basis-[14rem] flex-col gap-[0.4rem]",
                                    children: [
                                        _jsx("strong", {
                                            className: "tracking-[0.22em] [font:1.15rem/1_var(--font-mono)]",
                                            children: pairing.code
                                        }),
                                        _jsxs("span", {
                                            className: muted,
                                            children: [
                                                address ? (address.kind === "relay" ? "Scan the QR with the phone." : "Scan the QR with the phone, or open the address above and enter the code.") : "Enter it on the other device.",
                                                " Expires in ",
                                                Math.floor(remaining / 60),
                                                ":",
                                                String(remaining % 60).padStart(2, "0"),
                                                "."
                                            ]
                                        })
                                    ]
                                }),
                                _jsx("button", {
                                    type: "button",
                                    "data-testid": "pair-cancel",
                                    onClick: () => actions.pairCancel(),
                                    children: "Cancel"
                                })
                            ]
                        })) : phone?.enabled === false && !phone.relay ? (_jsx("p", {
                            className: muted,
                            "data-testid": "pair-needs-access",
                            children: "Turn on Phone access or set a relay to pair a phone."
                        })) : (_jsx("button", {
                            type: "button",
                            "data-testid": "pair-start",
                            onClick: () => actions.pairStart(),
                            children: "Pair a device"
                        })),
                        devices.length === 0 ? (_jsx("p", {
                            className: empty,
                            children: "No paired devices."
                        })) : (_jsx("ul", {
                            className: list,
                            "data-testid": "paired-devices",
                            children: devices.map((device) => (_jsxs("li", {
                                className: hostRow,
                                children: [
                                    _jsx("span", {
                                        className: name,
                                        children: device.name
                                    }),
                                    _jsxs("span", {
                                        className: addr,
                                        children: [
                                            "last seen ",
                                            new Date(device.lastSeenAt).toLocaleString()
                                        ]
                                    }),
                                    _jsx("button", {
                                        type: "button",
                                        "data-testid": `device-revoke-${device.id}`,
                                        onClick: () => actions.revoke(device.id),
                                        children: "Revoke"
                                    })
                                ]
                            }, device.id)))
                        }))
                    ]
                })
            })] }));
}
