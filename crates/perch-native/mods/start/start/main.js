// main.tsx of Perch's stock screen "stock:start", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
//! Start, the stock screen `stock:start`: what the main area shows with nothing open. Perch shows it, or the person's
//! package chosen for it (`perch mod use stock:start <id>`), with the same props; `kind` says which page it is:
//!
//! - `connecting`: the connection is down, so nothing can start until it is back;
//! - `home` (Orca's): the name, a hint, Add project and New session, and the keys worth knowing;
//! - `workspace`: the focused workspace's start picker, one button per agent, in its folder or another place;
//! - `cli`: CLI mode before this session has a place to run, with the host's agent list and its loading/error state.
//!
//! Starting is Perch's (`actions.start`, `actions.startIn`): a session is created on the right host in the chosen
//! folder, or this session is resumed in place. Which place is chosen is Perch's too (`targetKey`, `actions.choose`),
//! so it survives a swap to a copy; Add project selects the project it creates.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:start` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside it
//! (docs/MOD-SDK.md).
import { useState } from "react";
import { cn, NewSessionMenu } from "@perch/sdk";
import { FolderPicker, START_HINT, START_LINK, START_NAME, START_PANEL, StartCard, startAction } from "./card.js";
const FONT = "[font-family:inherit] [font-weight:inherit] [line-height:inherit]";
const KBD = `min-w-6 rounded-ui bg-surface-0 px-[0.35rem] py-[0.1rem] text-center text-[0.75rem] text-fg ${FONT}`;
const STATUS = "flex items-baseline gap-[0.45rem] text-[0.78rem] text-subtext-0";
const STATUS_BUTTON = "cursor-pointer bg-transparent p-0 text-accent underline [border:0] [font:inherit]";
const SHORTCUTS = [
    ["New session", ["Ctrl", "Space", "C"]],
    ["Jump to a session", ["Ctrl", "K"]],
    ["Toggle sidebar", ["Ctrl", "Space", "B"]],
    ["All shortcuts", ["?"]],
];
export default function Start(props) {
    if (props.kind === "connecting") {
        return (_jsx("div", {
            className: cn(START_PANEL, "items-start"),
            "data-testid": "no-session-panel",
            children: _jsxs("div", {
                className: "flex w-full max-w-[26rem] flex-col gap-3",
                children: [
                    _jsx("h2", {
                        className: "m-0 text-[1rem] font-semibold text-fg",
                        children: "Connecting\u2026"
                    }),
                    _jsx("p", {
                        className: "m-0 text-[0.85rem] leading-[1.45] text-subtext-0",
                        children: "Waiting for the connection to perch to come back."
                    })
                ]
            })
        }));
    }
    if (props.kind === "home")
        return _jsx(Home, { ...props });
    const { kind, targets, targetKey, choices, discovery, disabled, canManageAgents, actions } = props;
    const target = targets.find((candidate) => candidate.key === targetKey) ?? targets[0];
    if (!target)
        return null;
    const cli = kind === "cli";
    return (_jsx(StartCard, {
        name: target.name,
        path: target.path,
        choices: choices,
        idPrefix: cli ? "cli-start-agent" : "workspace-start",
        testId: cli ? "cli-start-panel" : "no-session-panel",
        disabled: disabled,
        onPick: actions.start,
        openSettings: actions.openSettings,
        target: _jsx(FolderPicker, {
            targets: targets,
            value: target.key,
            onChange: actions.choose,
            onAdd: actions.addProject,
            testId: cli ? "cli-start-target" : "workspace-start-target"
        }),
        status: discovery && _jsxs(_Fragment, { children: [discovery.state === "empty" && (_jsxs("div", {
                    className: STATUS,
                    role: "status",
                    children: [
                        "No CLI providers are available on this host. Install a provider or check its configuration, then retry.",
                        _jsx("button", {
                            type: "button",
                            className: STATUS_BUTTON,
                            onClick: actions.retry,
                            children: "Retry"
                        })
                    ]
                })), discovery.state === "loading" && (_jsxs("div", {
                    className: STATUS,
                    role: "status",
                    "data-testid": "cli-manifest-loading",
                    children: [
                        "Checking providers on ",
                        discovery.hostLabel,
                        "\u2026"
                    ]
                })), discovery.state === "error" && (_jsxs("div", {
                    className: cn(STATUS, "text-red"),
                    role: "alert",
                    children: [
                        discovery.error || "Provider discovery failed.",
                        _jsx("button", {
                            type: "button",
                            className: STATUS_BUTTON,
                            onClick: actions.retry,
                            children: "Retry"
                        })
                    ]
                }))] }),
        extraLinks: cli && canManageAgents && (_jsx("button", {
            type: "button",
            className: START_LINK,
            "data-testid": "cli-manage-agents",
            onClick: actions.manageAgents,
            children: "Manage agents"
        }))
    }));
}
/** Nothing focused: the name, a hint, the two ways in (Add project, New session) and the keys worth knowing. */
function Home({ hostId, logo, projectCwds, actions }) {
    const [anchor, setAnchor] = useState(null);
    return (_jsxs("div", {
        className: cn(START_PANEL, "items-center"),
        "data-testid": "no-session-panel",
        children: [
            _jsxs("div", {
                className: "flex w-full max-w-[24rem] flex-col items-center gap-4",
                children: [
                    _jsx("img", {
                        src: logo,
                        alt: "",
                        width: 80,
                        height: 80,
                        className: "rounded-ui",
                        draggable: false
                    }),
                    _jsx("h1", {
                        className: START_NAME,
                        children: "perch"
                    }),
                    _jsx("p", {
                        className: START_HINT,
                        children: "Select a workspace from the sidebar to begin."
                    }),
                    _jsxs("div", {
                        className: "flex flex-wrap justify-center gap-[0.6rem]",
                        children: [
                            _jsx("button", {
                                type: "button",
                                className: startAction(),
                                "data-testid": "home-add-project",
                                onClick: actions.addProject,
                                children: "Add project"
                            }),
                            _jsx("button", {
                                type: "button",
                                className: startAction(),
                                "data-testid": "no-session-create",
                                onClick: (e) => setAnchor(e.currentTarget.getBoundingClientRect()),
                                children: "New session"
                            })
                        ]
                    }),
                    _jsx("dl", {
                        className: "mx-0 mt-4 mb-0 flex w-full flex-col gap-[0.45rem]",
                        children: SHORTCUTS.map(([label, keys]) => (_jsxs("div", {
                            className: "flex items-center justify-between gap-4 text-[0.8rem] text-subtext-0",
                            children: [
                                _jsx("dt", { children: label }),
                                _jsx("dd", {
                                    className: "m-0 flex gap-1",
                                    children: keys.map((key) => _jsx("kbd", {
                                        className: KBD,
                                        children: key
                                    }, key))
                                })
                            ]
                        }, label)))
                    })
                ]
            }),
            anchor && (_jsx(NewSessionMenu, {
                hostId: hostId,
                cwd: null,
                projects: projectCwds,
                anchorRect: anchor,
                onClose: () => setAnchor(null),
                onSelect: actions.startIn
            }))
        ]
    }));
}
