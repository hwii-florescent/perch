import type { CommandEntry } from "@perch/shared";
import { cn } from "../lib/cn";
import { SLASH_DESC, SLASH_ITEM_OFF, SLASH_ITEM_ON, SLASH_NAME_OFF, SLASH_NAME_ON, SLASH_POPOVER } from "./ui/composer";

/**
 * SlashPopover — the floating suggestion list for the Hosted composer's
 * slash-command / skill autocomplete.
 *
 * This component is purely presentational: `Chat.tsx` owns the actual state
 * machine (when the sigil token is active, what it filters to, which row is
 * highlighted, and how accepting a row rewrites the textarea) using the pure
 * helpers in `composerCommands.ts`. That split mirrors `EffortChip`/
 * `ModelChip`, except here the "pill" being anchored to is the composer
 * textarea itself rather than a dedicated button, so the open/close and
 * positioning state lives one level up instead of inside this file.
 *
 * Selecting an entry needs `onMouseDown` to call `preventDefault()` — without
 * it, the mousedown fires before `onClick`, blurs the textarea, and the caret
 * position the parent is about to restore would be racing a fresh blur/focus
 * cycle instead of a clean "still focused" one.
 *
 * data-testid="composer-slash-popover" on the container.
 * data-testid="composer-slash-item-<name>" on each row (bare name, no sigil
 * — matches `CommandEntry.name`, which the e2e suite asserts against directly).
 */
export function SlashPopover(props: {
  entries: CommandEntry[];
  /** The sigil ("/" or "$") prepended for display only — `CommandEntry.name`
   * itself is always bare. */
  sigil: string;
  highlightedIndex: number;
  style: React.CSSProperties;
  onSelect: (entry: CommandEntry) => void;
  onHover: (index: number) => void;
  popoverRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { entries, sigil, highlightedIndex, style, onSelect, onHover, popoverRef } = props;
  return (
    <div
      className={cn("slash-popover", SLASH_POPOVER)}
      data-testid="composer-slash-popover"
      ref={popoverRef}
      style={style}
    >
      {entries.map((entry, index) => {
        const active = index === highlightedIndex;
        return (
          <button
            key={entry.name}
            type="button"
            className={cn(
              "slash-popover__item",
              active && "slash-popover__item--active",
              active ? SLASH_ITEM_ON : SLASH_ITEM_OFF,
            )}
            data-testid={`composer-slash-item-${entry.name}`}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => onHover(index)}
            onClick={() => onSelect(entry)}
          >
            <span className={cn("slash-popover__name", active ? SLASH_NAME_ON : SLASH_NAME_OFF)}>
              {sigil}
              {entry.name}
            </span>
            {entry.description && <span className={cn("slash-popover__desc", SLASH_DESC)}>{entry.description}</span>}
          </button>
        );
      })}
    </div>
  );
}
