// main.tsx of Perch's stock screen "stock:settings-notifications", exported by scripts/export-stock-ui.mjs. A copy is yours to edit.
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
//! Notifications settings, the stock screen `stock:settings-notifications`: sound and how alerts are delivered, the
//! system notification permission, the usage alerts, the limits on sub-sessions a lead may start, and the small
//! model that summarises a finished sub-session turn. Settings > Notifications shows it (the phone keeps Perch's own);
//! or the person's package chosen for it (`perch mod use stock:settings-notifications <id>`) with the same props.
//!
//! The permission check and request (`permission`, `actions.notification`, which never run twice at once) and every
//! write are Perch's, and so is what choosing "System notifications" does (`actions.setToastDelivery` also asks for
//! permission). A limit or model name being typed is kept by Perch under `settings:notifications:*` until it is saved,
//! so swapping this page for a copy loses nothing. The rows are `SettingsGroup` and `SettingRow` from `@perch/sdk`.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:settings-notifications` copies. It may import only `react`, `react-dom`, `@perch/sdk` and
//! files beside it (docs/MOD-SDK.md).
import { useEffect, useState } from "react";
import { ghostButton, Select, SettingRow, SettingsGroup, settingsClass, Switch } from "@perch/sdk";
import { useDraft } from "./draft.js";
/** The models `harness`'s installed CLI offers, as suggestions that narrow while typing. Until the list arrives, or when this core cannot list or the harness is not installed, it is the plain text field. */
function HarnessModelPicker({ harness, models, ...rest }) {
    const offered = models[harness];
    const draftKey = `settings:notifications:model:${harness}`;
    if (!offered?.length)
        return _jsx(ModelInput, {
            draftKey: draftKey,
            ...rest
        });
    const choices = offered.map((model) => ({ value: model.id, label: model.label === model.id ? model.id : `${model.label} · ${model.id}`, text: `${model.label} ${model.id}` }));
    return _jsx(ModelInput, {
        draftKey: draftKey,
        ...rest,
        choices: choices
    });
}
/** A model name saved when the field is left or Enter is pressed, or at once when a suggestion in `choices` is picked. An empty field restores the stored name, unless `allowEmpty` (a harness with no default model), where it clears it. */
function ModelInput({ draftKey, value, onCommit, testId, label, disabled, allowEmpty, placeholder, choices }) {
    const [draft, setDraft, discard] = useDraft(draftKey, value);
    const commit = (text = draft) => {
        const next = text.trim();
        if (!next && !allowEmpty)
            discard();
        else if (next !== value)
            onCommit(next);
    };
    if (choices) {
        return _jsx("span", {
            className: "contents",
            onBlur: () => commit(),
            children: _jsx(Select, {
                freeText: true,
                className: settingsClass.inputWide,
                testId: testId,
                ariaLabel: label,
                disabled: disabled,
                placeholder: placeholder,
                options: choices,
                value: draft,
                onChange: (next) => { setDraft(next); if (choices.some((choice) => choice.value === next))
                    commit(next); },
                onKeyDown: (event) => { if (event.key === "Enter")
                    commit(); }
            })
        });
    }
    return _jsx("input", {
        type: "text",
        className: settingsClass.inputWide,
        "data-testid": testId,
        "aria-label": label,
        disabled: disabled,
        value: draft,
        placeholder: placeholder,
        onChange: (event) => setDraft(event.target.value),
        onBlur: () => commit(),
        onKeyDown: (event) => { if (event.key === "Enter")
            commit(); }
    });
}
const RUN_LIMIT_FIELDS = [
    { key: "maxLiveSubSessions", title: "Live sub-sessions per run", description: "Running at once under one lead.", fallback: 4, min: 1, max: 16 },
    { key: "maxSubSessions", title: "Sub-sessions per run", description: "All a lead may start in a run, stopped ones included. At least the live limit.", fallback: 8, min: 1, max: 64 },
    { key: "maxMessagesPerRun", title: "Messages per run", description: "Messages the run's agents may send each other. Notes do not count.", fallback: 50, min: 1, max: 1000 },
    { key: "maxInterruptsPerSubSession", title: "Interrupts per sub-session", description: "Times a lead may interrupt the same sub-session.", fallback: 3, min: 1, max: 20 },
    { key: "maxWaitingSuggestions", title: "Waiting suggested tasks", description: "Suggested-task cards waiting for you before new ones are refused.", fallback: 10, min: 1, max: 50 },
];
function RunLimitRow({ field, saved, disabled, onCommit }) {
    const current = saved ?? field.fallback;
    const [text, setText] = useDraft(`settings:notifications:limit:${field.key}`, String(current));
    const parsed = Number(text);
    const valid = text.trim() !== "" && Number.isInteger(parsed) && parsed >= field.min && parsed <= field.max;
    // Show what was typed; save only a value in range (as the scrollback box does).
    const change = (value) => {
        setText(value);
        const next = Number(value);
        if (value.trim() !== "" && Number.isInteger(next) && next >= field.min && next <= field.max && next !== current)
            onCommit(next);
    };
    return (_jsx(SettingRow, {
        title: field.title,
        description: valid ? `${field.description} ${field.min}–${field.max}.` : `Enter a whole number from ${field.min} to ${field.max}.`,
        children: _jsx("input", {
            type: "number",
            className: settingsClass.inputPort,
            "data-testid": `settings-${field.key}`,
            "aria-label": field.title,
            "aria-invalid": !valid,
            min: field.min,
            max: field.max,
            disabled: disabled,
            value: text,
            onChange: (e) => change(e.target.value)
        })
    }));
}
function Delivery({ settings, native, permission: status, pending, error, testResult, actions }) {
    // Local optimistic mirrors of the saved values: the control flips the instant the user acts, not after the
    // settings.update round-trip (and does not briefly "un-toggle" if a stale settings.current lands after the click).
    const [soundEnabled, setSoundEnabled] = useState(settings?.soundEnabled ?? false);
    const [toastDelivery, setToastDelivery] = useState(settings?.toastDelivery ?? "app");
    useEffect(() => {
        if (!settings)
            return;
        setSoundEnabled(settings.soundEnabled ?? false);
        setToastDelivery(settings.toastDelivery ?? "app");
    }, [settings?.soundEnabled, settings?.toastDelivery]);
    const permission = status?.permission;
    const permissionText = permission === "granted"
        ? native && (!status?.alerts || status.alertStyle === "none")
            ? "Allowed, but macOS banners are off. In System Settings → Notifications → perch, choose Banners or Alerts."
            : "Allowed. System notifications can be sent from this app."
        : permission === "denied" ? native
            ? "Blocked by macOS. Enable Allow Notifications for perch in System Settings."
            : "Blocked by your browser. Change this site's notification permission in browser settings."
            : permission === "default" ? "Not requested. Allow notifications to receive system alerts."
                : permission === "provisional" ? "Quiet delivery only. Allow notifications to request banners and alerts."
                    : permission === "unsupported" ? "System notifications are not supported in this browser. In-app alerts still work."
                        : pending ? "Checking notification permission…" : "Notification permission could not be verified. Try Refresh.";
    return (_jsxs(SettingsGroup, { children: [_jsx(SettingRow, {
                title: "Sound",
                description: "Play a sound when a session finishes or needs attention.",
                children: _jsx(Switch, {
                    label: "Play a sound when a session finishes or needs attention",
                    testId: "settings-sound-enabled",
                    checked: soundEnabled,
                    onChange: (checked) => { setSoundEnabled(checked); actions.updateSettings({ soundEnabled: checked }); }
                })
            }), _jsx(SettingRow, {
                title: "Notification delivery",
                description: "In-app alerts also try system notifications while Perch is unfocused. Off disables visual alerts, not sound.",
                children: _jsx(Select, {
                    className: settingsClass.select,
                    testId: "settings-toast-delivery",
                    ariaLabel: "Notification delivery",
                    value: toastDelivery,
                    onChange: (value) => { setToastDelivery(value); actions.setToastDelivery(value); },
                    options: [
                        { value: "off", label: "Off" }, { value: "app", label: "In-app" }, { value: "system", label: "System notifications" }
                    ]
                })
            }), _jsx(SettingRow, {
                title: "Notification permission",
                description: _jsx("span", {
                    role: "status",
                    "data-testid": "notification-permission-status",
                    children: permissionText
                }),
                children: (permission === "default" || permission === "provisional") ? (_jsx("button", {
                    type: "button",
                    className: settingsClass.primary,
                    disabled: pending,
                    onClick: () => actions.notification("request"),
                    children: "Allow notifications"
                })) : native && (_jsx("button", {
                    type: "button",
                    className: ghostButton,
                    disabled: pending,
                    onClick: () => actions.notification("settings"),
                    children: "Open macOS Settings"
                }))
            }), _jsxs(SettingRow, {
                title: "Test notification",
                description: testResult ?? "Send a system notification without running an agent or changing delivery preferences.",
                children: [
                    _jsx("button", {
                        type: "button",
                        className: ghostButton,
                        disabled: pending || (permission !== "granted" && permission !== "provisional"),
                        onClick: () => actions.notification("test"),
                        children: "Send test"
                    }),
                    _jsx("button", {
                        type: "button",
                        className: ghostButton,
                        disabled: pending,
                        onClick: () => actions.notification("refresh"),
                        children: "Refresh"
                    })
                ]
            }), native && _jsx("p", {
                className: `${settingsClass.muted} pb-4`,
                children: "Sound is independent of macOS notification permission. Focus and notification summaries can delay or hide banners even when permission is allowed."
            }), error && _jsxs("p", {
                className: "m-0 pb-4 text-[0.8rem] text-red",
                role: "alert",
                children: [
                    "Notification action failed: ",
                    error
                ]
            })] }));
}
function Usage({ settings, actions }) {
    return (_jsxs(SettingsGroup, {
        title: "Usage",
        children: [
            _jsx(SettingRow, {
                title: "Plan limit alert",
                description: "Notify when a plan window crosses this share.",
                children: _jsx(Select, {
                    className: settingsClass.select,
                    testId: "settings-usage-limit-alert",
                    ariaLabel: "Plan limit alert",
                    disabled: !settings,
                    value: String(settings?.usageLimitAlert ?? 80),
                    onChange: (value) => actions.updateSettings({ usageLimitAlert: Number(value) }),
                    options: [
                        { value: "0", label: "Off" }, ...[50, 75, 80, 90, 95].map((percent) => ({ value: String(percent), label: `${percent}%` }))
                    ]
                })
            }),
            _jsx(SettingRow, {
                title: "Daily spend alert",
                description: "Notify once a day when API-equivalent spend passes this.",
                children: _jsx(Select, {
                    className: settingsClass.select,
                    testId: "settings-usage-daily-budget",
                    ariaLabel: "Daily spend alert",
                    disabled: !settings,
                    value: String(settings?.usageDailyBudgetUsd ?? 0),
                    onChange: (value) => actions.updateSettings({ usageDailyBudgetUsd: Number(value) }),
                    options: [
                        { value: "0", label: "Off" }, ...[5, 10, 25, 50, 100, 250].map((dollars) => ({ value: String(dollars), label: `$${dollars}` }))
                    ]
                })
            })
        ]
    }));
}
function SubSessions({ settings, actions }) {
    return (_jsxs(SettingsGroup, {
        title: "Sub-sessions",
        children: [
            _jsx(SettingRow, {
                title: "Let leads start sub-sessions without asking",
                description: "Off: when an agent wants to start a sub-session it puts a suggested task in its chat, and nothing starts until you press Start. On: it starts one itself, in any turn, and the limits below bound the run. You can stop any of them.",
                children: _jsx(Switch, {
                    label: "Let leads start sub-sessions without asking",
                    testId: "settings-leads-start-without-asking",
                    checked: settings?.leadsStartWithoutAsking ?? true,
                    onChange: (checked) => actions.updateSettings({ leadsStartWithoutAsking: checked })
                })
            }),
            RUN_LIMIT_FIELDS.map((field) => (_jsx(RunLimitRow, {
                field: field,
                saved: settings?.[field.key],
                disabled: !settings,
                onCommit: (value) => actions.updateSettings({ [field.key]: value })
            }, field.key)))
        ]
    }));
}
function Summaries({ settings, models, actions }) {
    return (_jsxs(SettingsGroup, {
        title: "Sub-session summaries",
        children: [
            _jsx(SettingRow, {
                title: "Summarise finished turns",
                description: "When a sub-session finishes a turn without reporting, a small model writes a short summary for the session that started it. Off keeps the start of its last message.",
                children: _jsx(Switch, {
                    label: "Summarise finished sub-session turns",
                    testId: "settings-reporter-enabled",
                    checked: settings?.reporterEnabled ?? true,
                    onChange: (checked) => actions.updateSettings({ reporterEnabled: checked })
                })
            }),
            _jsx(SettingRow, {
                title: "Claude model",
                description: "Asked of the claude command, signed in as you, with no tools. The default, haiku, follows the current Haiku model; a full name such as claude-haiku-4-5 pins one.",
                children: _jsx(HarnessModelPicker, {
                    harness: "claude",
                    models: models,
                    testId: "settings-reporter-claude-model",
                    label: "Summary model for Claude",
                    disabled: !settings,
                    value: settings?.reporterClaudeModel ?? "haiku",
                    onCommit: (value) => actions.updateSettings({ reporterClaudeModel: value })
                })
            }),
            _jsx(SettingRow, {
                title: "Codex model",
                description: "Asked of the codex command, read-only, with no shell. If your Codex does not offer gpt-6-luna, use gpt-5.6-luna.",
                children: _jsx(HarnessModelPicker, {
                    harness: "codex",
                    models: models,
                    testId: "settings-reporter-codex-model",
                    label: "Summary model for Codex",
                    disabled: !settings,
                    value: settings?.reporterCodexModel ?? "gpt-6-luna",
                    onCommit: (value) => actions.updateSettings({ reporterCodexModel: value })
                })
            }),
            _jsx(SettingRow, {
                title: "Pi model",
                description: "Asked of the pi command as provider/model, with no tools, extensions or saved session, so any provider Pi is set up for works. Empty: Pi's sessions are summarised by Claude or Codex when installed, else by the start of their last message.",
                children: _jsx(HarnessModelPicker, {
                    harness: "pi",
                    models: models,
                    testId: "settings-reporter-pi-model",
                    label: "Summary model for Pi",
                    allowEmpty: true,
                    placeholder: "provider/model",
                    disabled: !settings,
                    value: settings?.reporterPiModel ?? "",
                    onCommit: (value) => actions.updateSettings({ reporterPiModel: value })
                })
            }),
            _jsx(SettingRow, {
                title: "OMP model",
                description: "Asked of the omp command as provider/model, with no tools, extensions or saved session. Empty: OMP's sessions are summarised by Claude or Codex when installed, else by the start of their last message.",
                children: _jsx(HarnessModelPicker, {
                    harness: "omp",
                    models: models,
                    testId: "settings-reporter-omp-model",
                    label: "Summary model for OMP",
                    allowEmpty: true,
                    placeholder: "provider/model",
                    disabled: !settings,
                    value: settings?.reporterOmpModel ?? "",
                    onCommit: (value) => actions.updateSettings({ reporterOmpModel: value })
                })
            })
        ]
    }));
}
export default function NotificationsSettings(props) {
    return _jsxs(_Fragment, { children: [_jsx(Delivery, { ...props }), _jsx(Usage, { ...props }), _jsx(SubSessions, { ...props }), _jsx(Summaries, { ...props })] });
}
