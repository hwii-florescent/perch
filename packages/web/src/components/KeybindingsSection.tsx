/**
 * KeybindingsSection.tsx — Settings > Keyboard: every direct shortcut of
 * `keybinds.ts`, as a row with its key. Click the key to record a new one,
 * × for no shortcut, ↺ for the built-in default. Overrides live in the
 * server's `settings.keybindings` (action id → combo, "" = none).
 */
import { useEffect, useState } from "react";
import { usePerchStore } from "../store";
import { SHORTCUTS, effectiveSpec, shortcutsBoundTo, type KeybindGroup } from "../keybinds";
import { IS_MAC, formatCombo, normalizeCombo, recordCombo } from "../keyCombo";
import { SettingRow, SettingsGroup } from "./ui/setting-row";
import { cn } from "../lib/cn";

const GROUPS: [KeybindGroup, string][] = [
  ["global", "Global"], ["tabs", "Tabs"], ["nests", "Nests and birdhouses"], ["panes", "Splits and panes"], ["terminal", "Terminal"],
];

const CHIP = "min-w-24 cursor-pointer rounded-ui border bg-surface-1 px-2 py-[0.2rem] text-center [font-family:ui-monospace,SFMono-Regular,Menlo,monospace] text-[0.75rem] hover:border-accent focus-visible:border-accent";
const ICON = "cursor-pointer rounded-ui bg-transparent px-[0.4rem] py-[0.1rem] text-[0.85rem] leading-none text-subtext-0 [border:0] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg";

export function KeybindingsSection() {
  const settings = usePerchStore((s) => s.settings);
  const updateSettings = usePerchStore((s) => s.updateSettings);
  const [recording, setRecording] = useState<string | null>(null);
  const [note, setNote] = useState<{ id: string; text: string } | null>(null);
  const custom = settings?.keybindings ?? {};

  const save = (next: Record<string, string>) => updateSettings({ keybindings: next });

  function commit(id: string, spec: string) {
    const target = SHORTCUTS.find((s) => s.id === id);
    if (!target) return;
    const next = { ...custom };
    const taken = shortcutsBoundTo(spec, id);
    for (const other of taken) next[other.id] = "";
    setNote(taken.length ? { id, text: `Moved from "${taken.map((other) => other.description).join('", "')}".` } : null);
    const builtIn = target.keys[IS_MAC ? 0 : 1];
    if (builtIn !== null && normalizeCombo(builtIn) === normalizeCombo(spec)) delete next[id];
    else next[id] = spec;
    save(next);
    setRecording(null);
  }

  // While recording, every key is ours: capture before the app's own listeners run.
  useEffect(() => {
    if (!recording) return;
    function onKey(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        setRecording(null);
        setNote(null);
        return;
      }
      const recorded = recordCombo(e);
      if (!recorded) return;
      if ("error" in recorded) setNote({ id: recording!, text: recorded.error });
      else commit(recording!, recorded.spec);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, custom]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4 text-[0.78rem] text-subtext-0">
        <span>Click a key to record a new one, × for no shortcut, ↺ for the default. The Ctrl+Space leader chords, ? and Esc are fixed.</span>
        <button type="button" className={cn(ICON, "shrink-0 text-[0.78rem]")} data-testid="keybindings-reset-all" disabled={Object.keys(custom).length === 0} onClick={() => save({})}>
          Reset all
        </button>
      </div>
      {GROUPS.map(([group, title]) => (
        <SettingsGroup key={group} title={title} testId={`keybindings-${group}`}>
          {SHORTCUTS.filter((s) => s.group === group).map((s) => {
            const spec = effectiveSpec(s);
            const edited = custom[s.id] !== undefined;
            const active = recording === s.id;
            return (
              <SettingRow key={s.id} title={s.description} description={note?.id === s.id ? note.text : undefined}>
                <button
                  type="button"
                  className={cn(CHIP, active ? "border-accent text-accent" : "border-overlay-0", !spec && !active && "text-subtext-0")}
                  data-testid={`keybinding-${s.id}`}
                  aria-label={`Shortcut for ${s.description}`}
                  onClick={() => { setNote(null); setRecording(active ? null : s.id); }}
                  onBlur={() => active && setRecording(null)}
                >
                  {active ? "Press keys…" : spec ? formatCombo(spec) : "Not set"}
                </button>
                <button type="button" className={cn(ICON, !spec && "invisible")} data-testid={`keybinding-clear-${s.id}`} title="Remove shortcut" aria-label={`Remove shortcut for ${s.description}`}
                  onClick={() => { setNote(null); save({ ...custom, [s.id]: "" }); }}>×</button>
                <button type="button" className={cn(ICON, !edited && "invisible")} data-testid={`keybinding-reset-${s.id}`} title="Back to the default" aria-label={`Reset shortcut for ${s.description}`}
                  onClick={() => { setNote(null); const next = { ...custom }; delete next[s.id]; save(next); }}>↺</button>
              </SettingRow>
            );
          })}
        </SettingsGroup>
      ))}
    </>
  );
}
