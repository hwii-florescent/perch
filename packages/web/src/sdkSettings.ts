//! The Settings pages' shared parts for `@perch/sdk` 1.8 (`sdk.ts` re-exports and lists them). Each wraps the host
//! component or class string the pages are drawn with and owns no state. `SettingsGroup` and `SettingRow` are the
//! host's own, so the Settings search (`SettingsQuery`) filters a copy's rows exactly as it filters Perch's.
import { useContext } from "react";
import { ModeSwitch } from "./components/ModeSwitch";
import { QrCode } from "./components/QrCode";
import { SettingRow, SettingsGroup, SettingsQuery } from "./components/ui/setting-row";
import { ADD_ROW, ADDR, BTN_DANGER, BTN_PRIMARY, CATALOG_TOGGLE, EMPTY, HOST_ROW, INPUT, INPUT_PORT, INPUT_WIDE, LIST, MUTED, NAME, SELECT, SELECT_HOST } from "./components/ui/settings";
import { Switch } from "./components/ui/switch";

export { ModeSwitch, QrCode, SettingRow, SettingsGroup, Switch };

/** The Settings search text ("" when not searching); a group whose title matches clears it for its rows. */
export const useSettingsQuery = (): string => useContext(SettingsQuery);

/** The class strings the Settings pages style their controls with. */
export const settingsClass = {
  select: SELECT, selectHost: SELECT_HOST, input: INPUT, inputPort: INPUT_PORT, inputWide: INPUT_WIDE, addRow: ADD_ROW,
  list: LIST, hostRow: HOST_ROW, name: NAME, addr: ADDR, muted: MUTED, empty: EMPTY,
  primary: BTN_PRIMARY, danger: BTN_DANGER, catalogToggle: CATALOG_TOGGLE,
};

/** What `sdkSurface()` adds in 1.8. */
export const settingsSurface = { SettingsGroup, SettingRow, Switch, ModeSwitch, QrCode, settingsClass, useSettingsQuery };
