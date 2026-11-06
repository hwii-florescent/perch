import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { useDismissOnOutsideClick } from "../popoverPosition";
import { Chevron } from "./chevron";
import { menuPanel } from "./menu";

export interface SelectOption {
  value: string;
  label: ReactNode;
  /** Plain text for type-ahead; defaults to a string label, else the value. */
  text?: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Appearance of the trigger. The caller's own field classes; Select adds layout only. */
  className?: string;
  ariaLabel?: string;
  testId?: string;
  id?: string;
  title?: string;
  disabled?: boolean;
  /** Shown while `value` matches no option. */
  placeholder?: string;
  /** The trigger is a text input: any text is a value and the options are suggestions
   * (a git ref, a SHA). Enter accepts an option only after the arrows picked one;
   * otherwise it reaches `onKeyDown` untouched. */
  freeText?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}

const GAP = 4;
const EDGE = 8;
const OPTION =
  "flex w-full cursor-pointer items-center justify-between gap-3 px-[0.9rem] py-[0.4rem] text-left text-[0.82rem] text-fg max-[700px]:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-40";

const textOf = (option: SelectOption) => option.text ?? (typeof option.label === "string" ? option.label : option.value);

/** The one dropdown. Replaces the browser's `<select>` and `<datalist>`: a trigger that keeps focus,
 * and a portal-rendered `role="listbox"` that escapes clipping panes and sits above dialogs. */
export function Select({ value, onChange, options, className, ariaLabel, testId, id, title, disabled, placeholder, freeText, onKeyDown }: SelectProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Free text only narrows the suggestions once the user has typed.
  const [typed, setTyped] = useState(false);
  const anchor = useRef<HTMLElement | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const search = useRef({ text: "", at: 0 });

  const shown = freeText && typed && value ? options.filter((option) => textOf(option).toLowerCase().includes(value.toLowerCase()) || option.value.toLowerCase().includes(value.toLowerCase())) : options;
  const selected = options.find((option) => option.value === value);
  const optionId = (index: number) => `${listId}-${index}`;

  function show(from: number) {
    if (disabled) return;
    setActive(from);
    setOpen(true);
  }
  function close() { setOpen(false); setTyped(false); setActive(-1); }
  function pick(option: SelectOption | undefined) {
    if (!option || option.disabled) return;
    onChange(option.value);
    close();
  }
  /** The next enabled option from `from` in `step` direction, wrapping. */
  function step(from: number, direction: 1 | -1) {
    for (let count = 1; count <= shown.length; count++) {
      const index = (from + direction * count + shown.length * count) % shown.length;
      if (!shown[index]!.disabled) return index;
    }
    return from;
  }
  const first = () => shown.findIndex((option) => !option.disabled);
  const last = () => shown.length - 1 - [...shown].reverse().findIndex((option) => !option.disabled);

  useLayoutEffect(() => {
    if (!open || !anchor.current) { setStyle((current) => (current.left === undefined ? current : {})); return; }
    const rect = anchor.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - GAP - EDGE;
    const above = rect.top - GAP - EDGE;
    const flip = below < 160 && above > below;
    setStyle({
      position: "fixed",
      left: Math.min(Math.max(EDGE, rect.left), Math.max(EDGE, window.innerWidth - rect.width - EDGE)),
      // As wide as its longest label (a session title, a path), never wider than the window.
      width: "max-content",
      minWidth: rect.width,
      maxWidth: window.innerWidth - 2 * EDGE,
      maxHeight: Math.min(flip ? above : below, 320),
      ...(flip ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
      overflowY: "auto",
    });
  }, [open, shown.length]);
  // The trigger may sit near the right edge while the list is wider than it: slide the list back inside.
  useLayoutEffect(() => {
    const box = list.current;
    if (!open || !box || style.left === undefined) return;
    const right = box.getBoundingClientRect().right;
    const limit = window.innerWidth - EDGE;
    if (right > limit) setStyle((current) => ({ ...current, left: Math.max(EDGE, Number(current.left) - (right - limit)) }));
  }, [open, style]);
  useEffect(() => {
    if (!open) return;
    // Anchored to a pixel position: any move of the page under it, or a resize, would strand it.
    // Only a scroll of something the trigger sits in: a terminal repainting elsewhere must not close it.
    const moved = (event: Event) => { const target = event.target; if (target === document || (target instanceof Node && anchor.current && target.contains(anchor.current))) close(); };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", moved, true);
    return () => { window.removeEventListener("resize", close); window.removeEventListener("scroll", moved, true); };
  }, [open]);
  useEffect(() => {
    // Scrolls the list only: scrollIntoView would also scroll the page, which dismisses the list.
    const row = open && active >= 0 ? document.getElementById(optionId(active)) : null;
    const box = list.current;
    if (!row || !box) return;
    if (row.offsetTop < box.scrollTop) box.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = row.offsetTop + row.offsetHeight - box.clientHeight;
  }, [open, active]);
  useDismissOnOutsideClick(open, (next) => { if (!next) close(); }, anchor, list);

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    if (event.nativeEvent.isComposing) return;
    const consume = () => { event.preventDefault(); event.stopPropagation(); };
    const { key } = event;
    if (!open) {
      if (key === "ArrowDown" || key === "ArrowUp" || (!freeText && (key === "Enter" || key === " "))) {
        consume();
        show(Math.max(0, shown.findIndex((option) => option.value === value)));
        return;
      }
    } else if (key === "Escape") {
      // Closes this list only: an enclosing dialog or page handler must not see it.
      consume(); close(); return;
    } else if (key === "Tab") {
      close();
    } else if (key === "ArrowDown" || key === "ArrowUp") {
      consume(); if (shown.length) setActive(active < 0 ? (key === "ArrowDown" ? first() : last()) : step(active, key === "ArrowDown" ? 1 : -1)); return;
    } else if (key === "Home" && !freeText) {
      consume(); setActive(first()); return;
    } else if (key === "End" && !freeText) {
      consume(); setActive(last()); return;
    } else if (key === "Enter" || (key === " " && !freeText)) {
      if (active >= 0 && shown[active]) { consume(); pick(shown[active]); return; }
      if (!freeText) { consume(); close(); return; }
    } else if (!freeText && key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now();
      search.current = { text: (now - search.current.at > 600 ? "" : search.current.text) + key.toLowerCase(), at: now };
      const from = Math.max(active, 0);
      const hit = [...shown.slice(from + (search.current.text.length === 1 ? 1 : 0)), ...shown.slice(0, from + 1)]
        .find((option) => !option.disabled && textOf(option).toLowerCase().startsWith(search.current.text));
      if (hit) { consume(); setActive(shown.indexOf(hit)); }
      return;
    }
    onKeyDown?.(event);
  }

  const shared = {
    ref: (element: HTMLElement | null) => { anchor.current = element; },
    id,
    title,
    disabled,
    "aria-label": ariaLabel,
    "aria-expanded": open,
    "aria-controls": open ? listId : undefined,
    "aria-activedescendant": open && active >= 0 ? optionId(active) : undefined,
    "data-testid": testId,
    onKeyDown: handleKey,
  } as const;

  return (
    <>
      {freeText ? (
        <input
          {...shared}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={placeholder}
          className={className}
          value={value}
          onChange={(event) => { onChange(event.target.value); setTyped(true); if (!open) { setActive(-1); setOpen(true); } else setActive(-1); }}
          onBlur={() => close()}
        />
      ) : (
        <button
          {...shared}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          data-value={value}
          className={cn("inline-flex items-center justify-between gap-2 text-left [font-family:inherit] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50", className)}
          onClick={() => (open ? close() : show(Math.max(0, shown.findIndex((option) => option.value === value))))}
        >
          <span className="min-w-0 flex-1 truncate">{selected ? selected.label : (placeholder ?? "")}</span>
          <Chevron open className="shrink-0 text-subtext-0" />
        </button>
      )}
      {open && shown.length > 0 && createPortal(
        <div ref={list} id={listId} role="listbox" aria-label={ariaLabel} className={cn("z-[9999]", menuPanel)} style={style}
          // Focus stays on the trigger, and a menu or dialog holding this select must not see the press
          // as an outside click (its document listener would unmount us before the option's click).
          onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
          // React events cross portals: a click here would otherwise reach the select's React ancestors
          // (a row that toggles on click, say) although the list is not inside them in the page.
          onClick={(event) => event.stopPropagation()}>
          {shown.map((option, index) => (
            <div
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              data-value={option.value}
              className={cn(OPTION, index === active && !option.disabled && "bg-surface-0")}
              onMouseEnter={() => { if (!option.disabled) setActive(index); }}
              onClick={() => pick(option)}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              {option.value === value && <span aria-hidden="true" className="shrink-0 text-accent">✓</span>}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
