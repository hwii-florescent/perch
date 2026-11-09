//! Keyboard settings, the stock screen `stock:settings-keyboard`: every application shortcut as a row with its key.
//! Click the key to record a new one, × for no shortcut, ↺ for the built-in default. Commands that packages register
//! are listed too, under "Package commands", with the reason when a command asked for a key it could not have.
//! Settings > Keyboard shows it (not on the phone); or the person's package chosen for it
//! (`perch mod use stock:settings-keyboard <id>`) with the same props.
//!
//! The rows (which commands exist, their key as the person has it, the reason a package command has none) and what
//! recording does (reading the key press, moving a key off another command, saving) are Perch's: `actions.record`
//! is given each key press while a row records and answers what became of it. The rows' look is this screen's, and
//! they are `SettingsGroup` and `SettingRow` from `@perch/sdk`.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:settings-keyboard` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { useEffect, useRef, useState } from "react";
import { cn, SettingRow, SettingsGroup, type KeyboardSettingsProps } from "@perch/sdk";

const CHIP = "min-w-24 cursor-pointer rounded-ui bg-surface-1 px-2 py-[0.2rem] text-center [font-family:ui-monospace,SFMono-Regular,Menlo,monospace] text-[0.75rem] hover:bg-overlay-0";
const ICON = "cursor-pointer rounded-ui bg-transparent px-[0.4rem] py-[0.1rem] text-[0.85rem] leading-none text-subtext-0 [border:0] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg";

export default function KeyboardSettings({ groups, hasOverrides, actions }: KeyboardSettingsProps) {
  const [recording, setRecording] = useState<string | null>(null);
  const [note, setNote] = useState<{ id: string; text: string } | null>(null);
  const latest = useRef(actions);
  latest.current = actions;

  // While recording, every key is ours: capture before the app's own listeners run.
  useEffect(() => {
    if (!recording) return;
    const id = recording;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        setRecording(null);
        setNote(null);
        return;
      }
      const recorded = latest.current.record(id, e);
      if (!recorded) return;
      if (recorded.kind === "error") setNote({ id, text: recorded.text });
      else {
        setNote(recorded.note ? { id, text: recorded.note } : null);
        setRecording(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4 text-[0.78rem] text-subtext-0">
        <span>Click a key to record a new one, × for no shortcut, ↺ for the default. Leader and resize rows configure follow-up keys. Global Ctrl/Alt overrides also take precedence in terminals. Ordinary editing, arrows, Enter, Tab and Escape stay native.</span>
        <button type="button" className={cn(ICON, "shrink-0 text-[0.78rem]")} data-testid="keybindings-reset-all" disabled={!hasOverrides} onClick={() => actions.resetAll()}>
          Reset all
        </button>
      </div>
      {groups.map((group) => (
        <SettingsGroup key={group.id} title={group.title} testId={`keybindings-${group.id}`}>
          {group.rows.map((row) => {
            const active = recording === row.id;
            // A package command that asked for a key it could not have says why, until the person gives it one.
            const description = note?.id === row.id ? note.text
              : row.conflict && !row.keys ? <span data-testid={`keybinding-conflict-${row.id}`}>{row.conflict}</span>
              : undefined;
            return (
              <SettingRow key={row.id} title={row.description} description={description}>
                <button
                  type="button"
                  className={cn(CHIP, active && "bg-surface-0 text-accent", !row.keys && !active && "text-subtext-0")}
                  data-testid={`keybinding-${row.id}`}
                  aria-label={`Shortcut for ${row.description}`}
                  onClick={() => { setNote(null); setRecording(active ? null : row.id); }}
                  onBlur={() => active && setRecording(null)}
                >
                  {active ? "Press keys…" : row.keys || "Not set"}
                </button>
                <button type="button" className={cn(ICON, !row.keys && "invisible")} data-testid={`keybinding-clear-${row.id}`} title="Remove shortcut" aria-label={`Remove shortcut for ${row.description}`}
                  onClick={() => { setNote(null); actions.clear(row.id); }}>×</button>
                <button type="button" className={cn(ICON, !row.edited && "invisible")} data-testid={`keybinding-reset-${row.id}`} title="Back to the default" aria-label={`Reset shortcut for ${row.description}`}
                  onClick={() => { setNote(null); actions.reset(row.id); }}>↺</button>
              </SettingRow>
            );
          })}
        </SettingsGroup>
      ))}
    </>
  );
}
