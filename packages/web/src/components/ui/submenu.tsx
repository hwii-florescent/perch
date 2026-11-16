import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "../../lib/cn";
import { Chevron } from "./chevron";
import { menuItem, menuPanel } from "./menu";

export interface SubmenuItem {
  key: string;
  label: string;
  testId?: string;
  onSelect: () => void;
}

export interface SubmenuProps {
  /** The row's label; also the list's accessible name. */
  label: string;
  items: SubmenuItem[];
  testId?: string;
  /** Which side of the menu the list opens on: the caller knows where the menu sits on the screen. */
  side?: "right" | "left";
  /** Open upward from the row (its bottom edges meet), for a row low on the screen. */
  up?: boolean;
  /** The list scrolls past this height. */
  maxHeight?: number;
}

/** A menu row that opens a list of choices beside the menu, as a native menu's submenu: on hover (CSS, so the
 * native runtime draws it without calling the script), on a click, Right arrow, Enter or Space (focusing the first
 * choice); Up and Down move, Left arrow or Escape close it and return to the row. */
export function Submenu({ label, items, testId, side = "right", up = false, maxHeight = 320 }: SubmenuProps) {
  const [open, setOpen] = useState(false);
  const [focusFirst, setFocusFirst] = useState(false);
  const row = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const choices = () => [...(list.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];

  useEffect(() => {
    if (open && focusFirst) { choices()[0]?.focus(); setFocusFirst(false); }
  }, [open, focusFirst]);

  const show = () => { setOpen(true); setFocusFirst(true); };
  const onRowKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") { event.preventDefault(); show(); }
  };
  const onListKey = (event: KeyboardEvent) => {
    const all = choices();
    const at = all.findIndex((choice) => choice === document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      all[(at + (event.key === "ArrowDown" ? 1 : all.length - 1)) % all.length]?.focus();
    } else if (event.key === "ArrowLeft" || event.key === "Escape") {
      // Only the list closes; the menu around it stays.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      row.current?.focus();
    }
  };

  return (
    <div className="group/submenu relative">
      <button
        ref={row}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(menuItem(), "flex items-center justify-between gap-2")}
        data-testid={testId}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onRowKey}
      >
        <span className="truncate">{label}</span>
        <Chevron open={false} size={10} />
      </button>
      <div
        ref={list}
        role="menu"
        aria-label={label}
        className={cn(
          menuPanel,
          "absolute z-10 w-60 overflow-y-auto",
          side === "right" ? "left-full" : "right-full",
          up ? "bottom-0" : "top-0",
          open ? "block" : "hidden group-hover/submenu:block",
        )}
        style={{ maxHeight }}
        onKeyDown={onListKey}
      >
        {items.map((item) => (
          <button key={item.key} type="button" role="menuitem" className={menuItem()} data-testid={item.testId} onClick={item.onSelect}>
            <span className="block truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
