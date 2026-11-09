/**
 * KeybindingsSection.tsx — Settings > Keyboard: every application shortcut of `keybinds.ts`, and the commands
 * packages register, as rows with their key. The page is `stock:settings-keyboard`
 * (`stock-ui/settings-keyboard/main.tsx`) or the person's package chosen for it; this file builds its rows and binds
 * what recording does: reading the key press, moving the key off the commands that had it, and saving. Overrides live
 * in the server's `settings.keybindings` (action id → combo, "" = none). The phone has no shortcuts to rebind: Settings never lists this section there, so the route has no `exact`.
 */
import { useSyncExternalStore } from "react";
import { usePerchStore } from "../store";
import { SHORTCUTS, commandsSnapshot, effectiveSpec, plainShortcutAllowed, shortcutsBoundTo, subscribeCommands, type KeybindGroup } from "../keybinds";
import { IS_MAC, formatCombo, normalizeCombo, recordCombo } from "../keyCombo";
import KeyboardSettings from "../stock-ui/settings-keyboard/main";
import { StockRoute } from "./mod-root";

const GROUPS: [KeybindGroup, string][] = [
  ["global", "Global"], ["tabs", "Tabs"], ["nests", "Workspaces and projects"], ["panes", "Splits and panes"], ["terminal", "Terminal"], ["editor", "File editor"], ["navigator", "Navigator"], ["directory", "Folder picker"], ["leader", "Leader and follow-up keys"], ["resize", "Resize mode"],
];

const overrides = () => usePerchStore.getState().settings?.keybindings ?? {};
const save = (next: Record<string, string>) => usePerchStore.getState().updateSettings({ keybindings: next });

/** Gives `id` the key `spec`, taking it from the commands that had it: the note says which. */
function commit(id: string, spec: string): { kind: "saved"; note?: string } {
  const target = SHORTCUTS.find((s) => s.id === id);
  if (!target) return { kind: "saved" };
  const next = { ...overrides() };
  const taken = shortcutsBoundTo(spec, id);
  for (const other of taken) next[other.id] = "";
  const builtIn = target.keys[IS_MAC ? 0 : 1];
  // A package command with no key of its own has "" here.
  if (builtIn && normalizeCombo(builtIn) === normalizeCombo(spec)) delete next[id];
  else next[id] = spec;
  save(next);
  return { kind: "saved", note: taken.length ? `Moved from "${taken.map((other) => other.description).join('", "')}".` : undefined };
}

export function KeybindingsSection() {
  const settings = usePerchStore((s) => s.settings);
  // Package commands come and go while Settings is open.
  useSyncExternalStore(subscribeCommands, commandsSnapshot);
  const custom = settings?.keybindings ?? {};
  const rows = (group: KeybindGroup) => SHORTCUTS.filter((s) => s.group === group).map((s) => {
    const spec = effectiveSpec(s);
    return { id: s.id, description: s.description, keys: spec ? formatCombo(spec) : "", edited: custom[s.id] !== undefined, ...(s.conflict ? { conflict: s.conflict } : {}) };
  });
  const mods = rows("mods");
  const props = {
    groups: [...GROUPS.map(([id, title]) => ({ id, title, rows: rows(id) })), ...(mods.length ? [{ id: "mods", title: "Package commands", rows: mods }] : [])],
    hasOverrides: Object.keys(custom).length > 0,
    actions: {
      record: (id: string, event: KeyboardEvent) => {
        const target = SHORTCUTS.find((s) => s.id === id);
        if (!target) return null;
        const recorded = recordCombo(event, plainShortcutAllowed(target));
        if (!recorded) return null;
        return "error" in recorded ? { kind: "error" as const, text: recorded.error } : commit(id, recorded.spec);
      },
      clear: (id: string) => save({ ...overrides(), [id]: "" }),
      reset: (id: string) => { const next = { ...overrides() }; delete next[id]; save(next); },
      resetAll: () => save({}),
    },
  };
  return <StockRoute name="settings-keyboard" props={props} stock={KeyboardSettings} />;
}
