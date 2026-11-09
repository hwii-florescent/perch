import { useEffect, useState, useSyncExternalStore } from "react";
import type { ModInfo } from "@perch/shared";
import { usePerchStore } from "../store";
import { cloneMod, currentMods, enableMod, refreshMods, removeMod, setLayout, subscribeMods, useForStock } from "../mods";
import Select from "../stock-ui/select/main";
import { SELECT } from "./ui/settings";
import { SettingsGroup, SettingRow } from "./ui/setting-row";
import { Switch } from "./ui/switch";
import { GHOST_BUTTON } from "./ui/icon-button";
import { MUTED } from "./ui/settings";
import { resetWindowStore, windowStoreProblem, WINDOWS_KEY } from "../modUi";
import { SDK_VERSION, sdkSatisfies } from "../mod-runtime";
import { isPhoneScreen, setPhoneMods, useIsPhoneDevice, usePhoneModsOn } from "../phoneMods";

/** A package's provenance as Settings shows it: what it was copied from, and at which version. */
const copiedFrom = (mod: ModInfo) => mod.clonedFrom ? `copy of ${mod.clonedFrom.id}${mod.clonedFrom.version ? ` ${mod.clonedFrom.version}` : ""}` : "";

/** What changed since a copy was made, as Settings says it: a copy is never updated (it is the person's), so a newer
 * Perch only shows what it ships now; a copy whose `api` range this page's SDK is outside does not run, and Perch's
 * own screen stands in its place. Empty when nothing needs saying. */
export function upgradeNote(mod: ModInfo, shipped: ModInfo[] | undefined): string {
  const notes: string[] = [];
  const from = mod.clonedFrom;
  const now = from ? shipped?.find((screen) => screen.id === from.id) : undefined;
  if (from?.version && now?.version && now.version !== from.version) notes.push(`Perch now ships ${from.id} ${now.version}; your copy is unchanged`);
  if (mod.format === "esm" && mod.api && !sdkSatisfies(mod.api)) {
    notes.push(`needs @perch/sdk ${mod.api}, but this Perch has ${SDK_VERSION}, so it does not run${from ? ` and Perch's own ${from.id} is shown` : ""}; update its mod.json api once it works with ${SDK_VERSION}`);
  }
  return notes.join(". ");
}

const statusText = (mod: ModInfo) => mod.error ? `Cannot load: ${mod.error}` : mod.enabled ? "On" : "Off";

/** What a screen with a chosen copy shows, here: the copy, or Perch's own and why. */
function choiceText(screen: ModInfo, choice: ModInfo, phone: boolean, phoneModsOn: boolean): string {
  const mobile = isPhoneScreen(screen.id.slice(screen.id.indexOf(":") + 1));
  if (phone && !mobile) return `Your ${choice.name} is chosen for the computer; this phone shows Perch's own`;
  if (!phone && mobile) return `Your ${choice.name} is chosen for phones that turned on phone screens from your packages`;
  if (phone && !phoneModsOn) return `Your ${choice.name} is chosen; this phone shows Perch's own until phone screens from your packages are on`;
  if (choice.error) return `Showing your ${choice.name}, which cannot load (${choice.error}); Perch's own is shown`;
  if (!choice.enabled) return `Showing your ${choice.name}, which is off; Perch's own is shown`;
  if (choice.format === "esm" && choice.api && !sdkSatisfies(choice.api)) return `Your ${choice.name} needs @perch/sdk ${choice.api} (this Perch has ${SDK_VERSION}); Perch's own is shown`;
  return `Showing your ${choice.name}`;
}

/** A plain id for a new copy of stock screen `stock` (`stock:sidebar` -> `my-sidebar`, then `my-sidebar-2`, …). */
function freeId(stock: string, mods: ModInfo[]): string {
  const base = `my-${stock.slice(stock.indexOf(":") + 1)}`;
  let id = base;
  for (let n = 2; mods.some((mod) => mod.id === id); n++) id = `${base}-${n}`;
  return id;
}

/** A row of Settings > Mods > Window layout: Perch as shipped (no id), or one of the person's layout files. */
type WindowRow = { id: string | null; name: string; error: string | null; preview?: string; clonedFrom?: { id: string; version?: string } };
const SHIPPED_WINDOW: WindowRow = { id: null, name: "Perch as shipped", error: null };
/** Perch's own window as a layout file (`stock-ui/layouts/main.json`). */
const STOCK_LAYOUT = "stock:main";
/** A plain id for a new copy of the stock window: `my-window`, then `my-window-2`, … */
function freeLayoutId(layouts: { id: string }[]): string {
  let id = "my-window";
  for (let n = 2; layouts.some((layout) => layout.id === id); n++) id = `my-window-${n}`;
  return id;
}

/** Settings > Mods: a list of the mods you have, an off switch, and Turn off/on for each. Mods show
 * up where you work as soon as they are written; this is only for looking at them. */
export function ModsSection() {
  const phone = useIsPhoneDevice();
  const phoneModsOn = usePhoneModsOn();
  const off = usePerchStore((s) => s.settings?.mods?.off ?? false);
  // A core that answered but cannot list mods (no `mods.v1`) is older than this page: it never will.
  const olderCore = usePerchStore((s) => !!s.serverInfo && !(s.serverInfo.capabilities ?? []).includes("mods.v1"));
  const updateSettings = usePerchStore((s) => s.updateSettings);
  const state = useSyncExternalStore(subscribeMods, currentMods);
  // Stock screens (`stock:<id>`) are Perch itself, not something installed: nothing to turn off or remove.
  const installed = state?.mods.filter((mod) => mod.origin !== "stock");
  const stock = state?.mods.filter((mod) => mod.origin === "stock");
  const [message, setMessage] = useState<string | null>(null);
  // Read once per visit: it only changes when this page resets it.
  const [windowProblem, setWindowProblem] = useState(windowStoreProblem);

  // Asked again when the switch flips: mods that were off are listed, and the reverse.
  useEffect(() => refreshMods(), [off]);

  return (
    <>
      <SettingsGroup title="Mods">
        <SettingRow title="Turn all mods off" description="A mod is a folder you or an agent wrote that changes Perch and runs inside it with your full access. Turn this on if one breaks the page. Pressing ctrl+alt+shift+Escape or starting Perch with PERCH_MODS=off does the same.">
          <Switch label="Turn all mods off" testId="settings-mods-off" checked={off} onChange={(checked) => updateSettings({ mods: { off: checked } })} />
        </SettingRow>
        {state?.safeMode && !off && (
          <p className={`${MUTED} py-2`} data-testid="mods-safe-mode">Perch was started with PERCH_MODS=off, so every mod is off and Perch's own screens are shown until it is started without it.</p>
        )}
      </SettingsGroup>
      {phone && (
        <SettingsGroup title="This phone">
          <SettingRow
            title="Phone screens from my packages"
            description="A phone shows Perch's own screens and never runs the computer's mods. Turn this on to run the copies you chose for the phone's own screens (header, switcher, panes, files, terminal keys) on this phone. A package runs with your full access, and this phone keeps its pairing key where page code can read it: turn it on only for packages you trust. Turning it off, or revoking this phone in Settings > Devices on the computer, puts Perch's own back."
          >
            <Switch label="Phone screens from my packages" testId="settings-phone-mods" checked={phoneModsOn} onChange={(checked) => {
              try {
                setPhoneMods(checked);
                setMessage(null);
              } catch {
                setMessage("This browser would not save the choice (site storage is off), so Perch's own phone screens stay.");
              }
            }} />
          </SettingRow>
        </SettingsGroup>
      )}
      <SettingsGroup title="Installed mods">
        {!state && (olderCore
          ? <p className={`${MUTED} py-3`} data-testid="mods-older-core">This computer runs an older Perch that cannot list mods or Perch's screens, so Perch's own screens are shown. Update Perch on the computer to use your packages.</p>
          : <p className={`${MUTED} py-3`}>Loading…</p>)}
        {installed?.length === 0 && <p className={`${MUTED} py-3`}>No mods yet. Ask an agent in a Perch session to make one, or add a folder with a main.js to {state?.folder}.</p>}
        {installed?.map((mod) => (
          <div key={mod.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-1 py-[0.8rem] last:border-b-0" data-testid={`mod-${mod.id}`}>
            <div className="min-w-0">
              <div className="text-[0.85rem] font-medium text-fg">{mod.name}</div>
              {mod.description && <div className={MUTED}>{mod.description}</div>}
              {copiedFrom(mod) && <div className={MUTED} data-testid={`mod-${mod.id}-from`}>{copiedFrom(mod)}</div>}
              {upgradeNote(mod, stock) && <div className="text-[0.78rem] text-red" data-testid={`mod-${mod.id}-upgrade`}>{upgradeNote(mod, stock)}</div>}
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
      <SettingsGroup title="Screens">
        <p className={`${MUTED} py-2`}>Perch&apos;s own screens are packages you can copy and edit. Choose your copy to show it wherever Perch shows that screen; if it cannot run, Perch&apos;s own comes back and says why.</p>
        {stock?.map((screen) => {
          const chosen = state?.uses?.[screen.id] ?? "";
          const mine = (state?.mods ?? []).filter((mod) => mod.origin !== "stock" && mod.format === "esm")
            .sort((a, b) => Number(b.clonedFrom?.id === screen.id) - Number(a.clonedFrom?.id === screen.id));
          const options = [{ value: "", label: "Perch's own" }, ...mine.map((mod) => ({
            value: mod.id, label: `${mod.name}${copiedFrom(mod) ? ` (${copiedFrom(mod)})` : ""}${mod.enabled ? "" : ", off"}`, text: mod.name,
          }))];
          const choice = mine.find((mod) => mod.id === chosen);
          return (
            <div key={screen.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-1 py-[0.8rem] last:border-b-0" data-testid={`screen-${screen.id}`}>
              <div className="min-w-0 flex-1">
                <div className="text-[0.85rem] font-medium text-fg">{screen.name}</div>
                <div className={MUTED} data-testid={`screen-${screen.id}-status`}>
                  {screen.error ? `Cannot load: ${screen.error}` : choice ? choiceText(screen, choice, phone, phoneModsOn) : `Perch's own${screen.version ? ` ${screen.version}` : ""}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select className={SELECT} ariaLabel={`Show for ${screen.name}`} testId={`screen-${screen.id}-use`} value={chosen} options={options}
                  onChange={async (value) => setMessage((await useForStock(screen.id, value || null))?.error ?? null)} />
                <button type="button" className={GHOST_BUTTON} data-testid={`screen-${screen.id}-copy`} title={`Copies Perch's ${screen.name} into your mods folder to edit, and shows the copy here`}
                  onClick={async () => {
                    try {
                      const made = await cloneMod(screen.id, freeId(screen.id, state?.mods ?? []));
                      setMessage((await useForStock(screen.id, made))?.error ?? null);
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : String(error));
                    }
                  }}>Make my copy</button>
              </div>
            </div>
          );
        })}
      </SettingsGroup>
      <SettingsGroup title="Window layout">
        {[SHIPPED_WINDOW, ...(state?.layouts ?? [])].map((layout: WindowRow) => (
          <div key={layout.id ?? "stock"} className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-1 py-[0.8rem] last:border-b-0" data-testid={`layout-${layout.id ?? "stock"}`}>
            {layout.preview && <img src={layout.preview} alt="" className="h-12 w-20 shrink-0 rounded-ui object-cover" data-testid={`layout-${layout.id}-preview`} />}
            <div className="min-w-0 flex-1">
              <div className="text-[0.85rem] font-medium text-fg">{layout.name}</div>
              {layout.clonedFrom && <div className={MUTED} data-testid={`layout-${layout.id}-from`}>{`copy of ${layout.clonedFrom.id}${layout.clonedFrom.version ? ` ${layout.clonedFrom.version}` : ""}`}</div>}
              <div className={MUTED}>{layout.error ? `Cannot load: ${layout.error}${(state?.layout ?? null) === layout.id ? "; Perch as shipped is shown" : ""}` : (state?.layout ?? null) === layout.id ? "In use" : ""}</div>
            </div>
            <div className="flex gap-2">
              {!layout.error && (state?.layout ?? null) !== layout.id && (
                <button type="button" className={GHOST_BUTTON} onClick={async () => setMessage((await setLayout(layout.id))?.error ?? null)}>Use</button>
              )}
              {/* The stock window is a layout file too (`stock:main`): copy it to edit, and use the copy. */}
              {layout.id === null && (
                <button type="button" className={GHOST_BUTTON} data-testid="layout-stock-copy" title="Copies Perch's window into your layouts folder as a file to edit, and uses the copy"
                  onClick={async () => {
                    try {
                      const made = await cloneMod(STOCK_LAYOUT, freeLayoutId(state?.layouts ?? []));
                      setMessage((await setLayout(made))?.error ?? null);
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : String(error));
                    }
                  }}>Make my copy</button>
              )}
              {layout.id && (
                <button type="button" className={GHOST_BUTTON} title="Moves the file to mods-removed/ beside layouts/" data-testid={`layout-${layout.id}-remove`} onClick={async () => setMessage((await removeMod(layout.id!, "layout"))?.error ?? null)}>Remove</button>
              )}
            </div>
          </div>
        ))}
        {windowProblem && (
          <SettingRow title="Saved mod windows" description={`${windowProblem} Mod windows are remembered for this run only.`}>
            <button type="button" className={GHOST_BUTTON} data-testid="mod-windows-reset" title={`Deletes ${WINDOWS_KEY} on this device: window spots, sizes and kept windows`}
              onClick={() => { resetWindowStore(); setWindowProblem(null); }}>Reset</button>
          </SettingRow>
        )}
      </SettingsGroup>
    </>
  );
}
