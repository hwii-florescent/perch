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
import { cn, Select, SettingRow, SettingsGroup, settingsClass, useSettingsQuery, type AppearanceSettingsProps } from "@perch/sdk";

type Props = AppearanceSettingsProps;

function Theme({ settings, themes, actions }: Props) {
  const q = useSettingsQuery();
  if (!settings || (q && !"theme".includes(q))) return null; // the chips are no row: search finds them by the group title
  const current = settings.theme;
  return (
    <SettingsGroup title="Theme">
      <div className="py-3" data-setting-row>
      <ul className="m-0 mb-2 flex list-none flex-wrap gap-[0.4rem] p-0">
        {themes.map((name) => (
          <li key={name}>
            <button
              type="button"
              className={cn(
                "flex cursor-pointer items-center gap-[0.4rem] rounded-ui bg-surface-1 px-[0.65rem] py-[0.3rem] text-[0.8rem] hover:bg-overlay-0",
                name === current ? "settings-modal__theme-option--active bg-surface-0 text-accent" : "text-fg",
              )}
              data-testid={`theme-option-${name}`}
              onClick={() => actions.setTheme(name)}
            >
              <span className="settings-modal__theme-option-name">{name}</span>
              {name === current && (
                <span className="text-accent" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      </div>
    </SettingsGroup>
  );
}

function ChatText({ chatTextSizes, chatTextSize, sendWhileWorking, actions }: Props) {
  return (
    <SettingsGroup title="Chat">
      <SettingRow title="Text size" description="The size of messages in chat. Kept on this device only.">
        <Select className={settingsClass.select} testId="settings-chat-text-size" ariaLabel="Chat text size" value={chatTextSize} onChange={actions.setChatTextSize} options={chatTextSizes} />
      </SettingRow>
      <SettingRow title="Enter while the agent is working" description="Steer puts your message into the running turn; Queue runs it after the turn. Alt/Option+Enter does the other one. Claude and OpenCode have no separate steer, so they always take it their own way. Kept on this device only.">
        <Select className={settingsClass.select} testId="settings-chat-send-while-working" ariaLabel="Enter while the agent is working" value={sendWhileWorking} onChange={(value) => actions.setSendWhileWorking(value === "queue" ? "queue" : "steer")} options={[{ value: "steer", label: "Steer" }, { value: "queue", label: "Queue" }]} />
      </SettingRow>
    </SettingsGroup>
  );
}

function TabShape({ settings, actions }: Props) {
  return (
    <SettingsGroup title="Tabs">
      <SettingRow title="Tab shape" description="Choose square corners or rounded browser-style tabs.">
        <Select
          className={settingsClass.select}
          testId="settings-tab-shape"
          ariaLabel="Tab shape"
          value={settings?.tabShape ?? "square"}
          onChange={(value) => actions.updateSettings({ tabShape: value === "round" ? "round" : "square" })}
          options={[{ value: "square", label: "Square" }, { value: "round", label: "Rounded" }]}
        />
      </SettingRow>
    </SettingsGroup>
  );
}

export default function AppearanceSettings(props: Props) {
  return <><Theme {...props} /><ChatText {...props} /><TabShape {...props} /></>;
}
