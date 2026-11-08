import { useEffect, useState, useSyncExternalStore } from "react";
import type { ModInfo } from "@perch/shared";
import { usePerchStore } from "../store";
import { currentMods, enableMod, refreshMods, removeMod, setLayout, subscribeMods } from "../mods";
import { SettingsGroup, SettingRow } from "./ui/setting-row";
import { Switch } from "./ui/switch";
import { GHOST_BUTTON } from "./ui/icon-button";
import { MUTED } from "./ui/settings";

const statusText = (mod: ModInfo) => mod.error ? `Cannot load: ${mod.error}` : mod.enabled ? "On" : "Off";

/** Settings > Mods: a list of the mods you have, an off switch, and Turn off/on for each. Mods show
 * up where you work as soon as they are written; this is only for looking at them. */
export function ModsSection() {
  const off = usePerchStore((s) => s.settings?.mods?.off ?? false);
  const updateSettings = usePerchStore((s) => s.updateSettings);
  const state = useSyncExternalStore(subscribeMods, currentMods);
  const [message, setMessage] = useState<string | null>(null);

  // Asked again when the switch flips: mods that were off are listed, and the reverse.
  useEffect(() => refreshMods(), [off]);

  return (
    <>
      <SettingsGroup title="Mods">
        <SettingRow title="Turn all mods off" description="A mod is a folder you or an agent wrote that changes Perch and runs inside it with your full access. Turn this on if one breaks the page. Pressing ctrl+alt+shift+Escape or starting Perch with PERCH_MODS=off does the same.">
          <Switch label="Turn all mods off" testId="settings-mods-off" checked={off} onChange={(checked) => updateSettings({ mods: { off: checked } })} />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="Installed mods">
        {!state && <p className={`${MUTED} py-3`}>Loading…</p>}
        {state?.mods.length === 0 && <p className={`${MUTED} py-3`}>No mods yet. Ask an agent in a Perch session to make one, or add a folder with a main.js to {state.folder}.</p>}
        {state?.mods.map((mod) => (
          <div key={mod.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-1 py-[0.8rem] last:border-b-0" data-testid={`mod-${mod.id}`}>
            <div className="min-w-0">
              <div className="text-[0.85rem] font-medium text-fg">{mod.name}</div>
              {mod.description && <div className={MUTED}>{mod.description}</div>}
              <div className={MUTED} data-testid={`mod-${mod.id}-status`}>{statusText(mod)}</div>
            </div>
            <div className="flex gap-2">
              {!mod.error && (
                <button type="button" className={GHOST_BUTTON} onClick={async () => setMessage((await enableMod(mod.id, !mod.enabled))?.error ?? null)}>
                  {mod.enabled ? "Turn off" : "Turn on"}
                </button>
              )}
              <button type="button" className={GHOST_BUTTON} title="Moves the folder to mods-removed/ beside mods/" data-testid={`mod-${mod.id}-remove`} onClick={async () => setMessage((await removeMod(mod.id, "mod"))?.error ?? null)}>Remove</button>
            </div>
          </div>
        ))}
        {message && <p className="py-2 text-[0.8rem] text-red" role="alert" data-testid="mods-message">{message}</p>}
      </SettingsGroup>
      <SettingsGroup title="Window layout">
        {[{ id: null, name: "Perch as shipped", error: null }, ...(state?.layouts ?? [])].map((layout) => (
          <div key={layout.id ?? "stock"} className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-1 py-[0.8rem] last:border-b-0" data-testid={`layout-${layout.id ?? "stock"}`}>
            <div className="min-w-0">
              <div className="text-[0.85rem] font-medium text-fg">{layout.name}</div>
              <div className={MUTED}>{layout.error ? `Cannot load: ${layout.error}` : (state?.layout ?? null) === layout.id ? "In use" : ""}</div>
            </div>
            <div className="flex gap-2">
              {!layout.error && (state?.layout ?? null) !== layout.id && (
                <button type="button" className={GHOST_BUTTON} onClick={async () => setMessage((await setLayout(layout.id))?.error ?? null)}>Use</button>
              )}
              {layout.id && (
                <button type="button" className={GHOST_BUTTON} title="Moves the file to mods-removed/ beside layouts/" data-testid={`layout-${layout.id}-remove`} onClick={async () => setMessage((await removeMod(layout.id!, "layout"))?.error ?? null)}>Remove</button>
              )}
            </div>
          </div>
        ))}
      </SettingsGroup>
    </>
  );
}
