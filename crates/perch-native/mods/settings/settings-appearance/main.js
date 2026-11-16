// main.tsx of Perch's stock screen "stock:settings-appearance", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
//! Appearance settings, the stock screen `stock:settings-appearance`: the theme, the chat's text size and what Enter
//! does while an agent works, and the tab shape. Settings > Appearance shows it (the phone keeps Perch's own); or the
//! person's package chosen for it (`perch mod use stock:settings-appearance <id>`) with the same props.
//!
//! Which themes exist, applying one live and saving it, and the per-device chat preferences are Perch's (`themes`,
//! `actions`). The look of the page is this screen's; its rows are `SettingsGroup` and `SettingRow` from `@perch/sdk`
//! so the Settings search finds them.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:settings-appearance` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { cn, Select, SettingRow, SettingsGroup, settingsClass, useSettingsQuery } from "@perch/sdk";
function Theme({ settings, themes, actions }) {
    const q = useSettingsQuery();
    if (!settings || (q && !"theme".includes(q)))
        return null; // the chips are no row: search finds them by the group title
    const current = settings.theme;
    return (_jsx(SettingsGroup, {
        title: "Theme",
        children: _jsx("div", {
            className: "py-3",
            "data-setting-row": true,
            children: _jsx("ul", {
                className: "m-0 mb-2 flex list-none flex-wrap gap-[0.4rem] p-0",
                children: themes.map((name) => (_jsx("li", { children: _jsxs("button", {
                        type: "button",
                        className: cn("flex cursor-pointer items-center gap-[0.4rem] rounded-ui bg-surface-1 px-[0.65rem] py-[0.3rem] text-[0.8rem] hover:bg-overlay-0", name === current ? "settings-modal__theme-option--active bg-surface-0 text-accent" : "text-fg"),
                        "data-testid": `theme-option-${name}`,
                        onClick: () => actions.setTheme(name),
                        children: [
                            _jsx("span", {
                                className: "settings-modal__theme-option-name",
                                children: name
                            }),
                            name === current && (_jsx("span", {
                                className: "text-accent",
                                "aria-hidden": "true",
                                children: "\u2713"
                            }))
                        ]
                    }) }, name)))
            })
        })
    }));
}
function ChatText({ chatTextSizes, chatTextSize, sendWhileWorking, actions }) {
    return (_jsxs(SettingsGroup, {
        title: "Chat",
        children: [
            _jsx(SettingRow, {
                title: "Text size",
                description: "The size of messages in chat. Kept on this device only.",
                children: _jsx(Select, {
                    className: settingsClass.select,
                    testId: "settings-chat-text-size",
                    ariaLabel: "Chat text size",
                    value: chatTextSize,
                    onChange: actions.setChatTextSize,
                    options: chatTextSizes
                })
            }),
            _jsx(SettingRow, {
                title: "Enter while the agent is working",
                description: "Steer puts your message into the running turn; Queue runs it after the turn. Alt/Option+Enter does the other one. Claude and OpenCode have no separate steer, so they always take it their own way. Kept on this device only.",
                children: _jsx(Select, {
                    className: settingsClass.select,
                    testId: "settings-chat-send-while-working",
                    ariaLabel: "Enter while the agent is working",
                    value: sendWhileWorking,
                    onChange: (value) => actions.setSendWhileWorking(value === "queue" ? "queue" : "steer"),
                    options: [
                        { value: "steer", label: "Steer" }, { value: "queue", label: "Queue" }
                    ]
                })
            })
        ]
    }));
}
function TabShape({ settings, actions }) {
    return (_jsx(SettingsGroup, {
        title: "Tabs",
        children: _jsx(SettingRow, {
            title: "Tab shape",
            description: "Choose square corners or rounded browser-style tabs.",
            children: _jsx(Select, {
                className: settingsClass.select,
                testId: "settings-tab-shape",
                ariaLabel: "Tab shape",
                value: settings?.tabShape ?? "square",
                onChange: (value) => actions.updateSettings({ tabShape: value === "round" ? "round" : "square" }),
                options: [
                    { value: "square", label: "Square" }, { value: "round", label: "Rounded" }
                ]
            })
        })
    }));
}
export default function AppearanceSettings(props) {
    return _jsxs(_Fragment, { children: [_jsx(Theme, { ...props }), _jsx(ChatText, { ...props }), _jsx(TabShape, { ...props })] });
}
