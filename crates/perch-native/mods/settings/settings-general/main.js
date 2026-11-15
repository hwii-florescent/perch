// main.tsx of Perch's stock screen "stock:settings-general", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
//! General settings, the stock screen `stock:settings-general`: the chat mode and agent warnings, the interface
//! toggle, the browser's search and history, and the default working directory. Settings > General shows it (the
//! phone keeps Perch's own); or the person's package chosen for it (`perch mod use stock:settings-general <id>`) with
//! the same props.
//!
//! The saved values and every write are Perch's (`actions`); the default folder being typed is kept by Perch under
//! `settings:general:defaultCwd` until Save, so swapping this page for a copy loses nothing. The rows are
//! `SettingsGroup` and `SettingRow` from `@perch/sdk`, which is what makes the Settings search find them.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:settings-general` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { useEffect, useState } from "react";
import { ModeSwitch, Select, SettingRow, SettingsGroup, settingsClass, Switch } from "@perch/sdk";
import { useDraft } from "./draft.js";
function ChatMode({ settings, isMobile, agentChoices, actions }) {
    // Optimistic local mirror: the control flips on click, the saved value follows once it lands.
    const [chatMode, setChatMode] = useState(settings?.chatMode ?? "cli");
    useEffect(() => {
        if (!settings)
            return;
        setChatMode(settings.chatMode ?? "cli");
    }, [settings?.chatMode]);
    const handleChange = (mode) => {
        setChatMode(mode);
        actions.updateSettings({ chatMode: mode });
    };
    return (_jsxs(SettingsGroup, {
        title: "Chat mode",
        children: [
            _jsx(SettingRow, {
                title: "UI / CLI",
                description: "CLI shows each agent's terminal; UI shows the native chat over the same agent. Agents without a chat view always use the terminal.",
                children: _jsx(ModeSwitch, {
                    mode: chatMode,
                    onChange: handleChange,
                    testId: "settings-chat-mode"
                })
            }),
            _jsx(SettingRow, {
                title: "Warn before closing an agent",
                description: "Ask first when closing a tab that runs an agent. Terminals close without asking.",
                children: _jsx(Switch, {
                    label: "Warn before closing an agent",
                    testId: "settings-warn-close-agent",
                    checked: settings?.warnCloseAgent !== false,
                    onChange: (on) => actions.updateSettings({ warnCloseAgent: on })
                })
            }),
            !isMobile && _jsx(SettingRow, {
                title: "Preview files in tabs",
                description: "A single-clicked file opens in an italic preview tab that the next clicked file replaces. Edit or double-click it to keep it. Off opens every clicked file in its own tab.",
                children: _jsx(Switch, {
                    label: "Preview files in tabs",
                    testId: "settings-preview-tabs",
                    checked: settings?.previewTabs !== false,
                    onChange: (on) => actions.updateSettings({ previewTabs: on })
                })
            }),
            _jsx(SettingRow, {
                title: "Empty workspace opens",
                description: "What clicking a workspace with no open tabs starts.",
                children: _jsx(Select, {
                    className: settingsClass.select,
                    testId: "settings-empty-workspace-agent",
                    ariaLabel: "Empty workspace opens",
                    value: settings?.emptyWorkspaceAgent ?? "",
                    onChange: (value) => actions.updateSettings({ emptyWorkspaceAgent: value }),
                    options: [
                        { value: "", label: "Ask (show the picker)" }, ...agentChoices.map((choice) => ({ value: choice.id, label: choice.label }))
                    ]
                })
            })
        ]
    }));
}
function Interface({ paneLabels, isMobile, actions }) {
    // Its only row labels a tab the phone doesn't have.
    if (isMobile)
        return null;
    return (_jsx(SettingsGroup, {
        title: "Interface",
        children: _jsx(SettingRow, {
            title: "Agent on the chat tab",
            description: 'Show the active agent on the chat pane\'s tab (e.g. "Chat · claude").',
            children: _jsx(Switch, {
                label: "Show the active agent on the chat pane's tab",
                testId: "settings-pane-labels",
                checked: paneLabels,
                onChange: actions.setPaneLabels
            })
        })
    }));
}
function Browser({ settings, searchEngines, actions }) {
    return (_jsxs(SettingsGroup, {
        title: "Browser",
        children: [
            _jsx(SettingRow, {
                title: "Default search engine",
                description: "Used for searches from the address bar in browser tabs and the drawer.",
                children: _jsx(Select, {
                    className: settingsClass.select,
                    testId: "settings-browser-search-engine",
                    ariaLabel: "Default search engine",
                    disabled: !settings,
                    value: settings?.browserSearchEngine ?? "google",
                    onChange: (value) => actions.updateSettings({ browserSearchEngine: value }),
                    options: searchEngines.map(({ id, label }) => ({ value: id, label }))
                })
            }),
            _jsx(SettingRow, {
                title: "Search suggestions",
                description: "Ask the search engine to complete what you type in the address bar. Off by default: everything you type, even if you never search, is sent to the engine. Addresses are never sent.",
                children: _jsx(Switch, {
                    label: "Search suggestions",
                    testId: "settings-browser-search-suggestions",
                    checked: settings?.browserSearchSuggestions === true,
                    onChange: (on) => actions.updateSettings({ browserSearchSuggestions: on })
                })
            }),
            _jsx(SettingRow, {
                title: "Browsing history",
                description: "Pages suggested in the address bar. Kept on this device only.",
                children: _jsx("button", {
                    type: "button",
                    className: settingsClass.select,
                    "data-testid": "settings-browser-clear-history",
                    onClick: () => actions.clearBrowsingHistory(),
                    children: "Clear history"
                })
            })
        ]
    }));
}
function DefaultCwd({ settings, actions }) {
    const [cwd, setCwd] = useDraft("settings:general:defaultCwd", settings?.defaultCwd ?? "");
    const handleSave = () => {
        const val = cwd.trim();
        setCwd(val);
        actions.updateSettings({ defaultCwd: val === "" ? null : val });
    };
    return (_jsx(SettingsGroup, {
        title: "Default Working Directory",
        children: _jsxs("div", {
            className: "py-3",
            children: [
                _jsxs("div", {
                    className: settingsClass.addRow,
                    children: [
                        _jsx("input", {
                            type: "text",
                            className: settingsClass.inputWide,
                            placeholder: "/path/to/your/project",
                            value: cwd,
                            onChange: (e) => setCwd(e.target.value)
                        }),
                        _jsx("button", {
                            type: "button",
                            className: settingsClass.primary,
                            onClick: handleSave,
                            children: "Save"
                        })
                    ]
                }),
                _jsx("p", {
                    className: settingsClass.muted,
                    children: "Used as the cwd for new sessions. Leave empty to use the server process directory."
                })
            ]
        })
    }));
}
export default function GeneralSettings(props) {
    return _jsxs(_Fragment, { children: [_jsx(ChatMode, { ...props }), _jsx(Interface, { ...props }), _jsx(Browser, { ...props }), _jsx(DefaultCwd, { ...props })] });
}
