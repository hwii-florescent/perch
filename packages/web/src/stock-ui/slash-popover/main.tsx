//! Slash popover, the stock screen `stock:slash-popover`: the composer's one autocomplete list (slash commands,
//! skills, `@` file mentions), above the native chat's composer. The chat (`stock:chat`, or a copy of it) draws it
//! through the SDK's `SlashPopover`, which is this screen or the person's package chosen for it (`perch mod use
//! stock:slash-popover <id>`), with the same props.
//!
//! Focus stays in the composer: it owns the arrow, Enter, Tab and Escape keys and names the active row by
//! `optionId(index)` (`aria-activedescendant`), so a row's mouse press must not take focus from it. Picking a row only
//! rewrites the composer's text; nothing is sent and nothing reaches the agent's terminal.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:slash-popover` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { useEffect, useRef } from "react";
import { cn, menuPanel, type SlashPopoverProps } from "@perch/sdk";

const ITEM = "flex w-full cursor-pointer flex-col items-start gap-[0.1rem] px-[0.75rem] py-[0.35rem] text-left [border:none] [transition:background_0.1s_ease] hover:bg-surface-0";
const ITEM_ON = `${ITEM} bg-surface-0`;
const ITEM_OFF = `${ITEM} bg-transparent`;
const NAME = "text-[0.82rem] [font-family:var(--font-mono)]";
const NAME_ON = `${NAME} text-accent`;
const NAME_OFF = `${NAME} text-fg`;
const DESC = "text-[0.72rem] text-subtext-0";

export default function SlashPopover({ items, active, label, optionId, onPick, onHover }: SlashPopoverProps) {
  const current = useRef<HTMLButtonElement>(null);
  useEffect(() => { current.current?.scrollIntoView({ block: "nearest" }); }, [active]);
  return <div role="listbox" aria-label={label} data-testid="native-cli-menu" className={cn("absolute inset-x-2 bottom-full z-10 mb-1 max-h-56 overflow-y-auto", menuPanel)}>
    {items.map((item, index) => <button key={item.key} id={optionId(index)} ref={index === active ? current : undefined} type="button" role="option" aria-selected={index === active}
      className={index === active ? ITEM_ON : ITEM_OFF}
      onMouseDown={(event) => { event.preventDefault(); onPick(index); }} onMouseEnter={() => onHover(index)}>
      <span className={index === active ? NAME_ON : NAME_OFF}>{item.label}</span>
      {item.detail && <span className={DESC}>{item.detail}</span>}
    </button>)}
  </div>;
}
