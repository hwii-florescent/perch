import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { anchoredPopoverStyle as computeAnchoredPopoverStyle, cn, menuItemClass as menuItem, menuPanel, useDismissOnOutsideClick } from "@perch/sdk";
import { PlusIcon } from "./icons";

export interface AddMenuEntry { id: string; label: string; detail?: string; disabled?: boolean; run: () => void }

/** The composer's `+`: one menu for everything that adds to a message (files now; Orca/ChatGPT/Claude all
 * group these here). Entries are the caller's, so an entry the provider cannot honour is simply not passed. */
export function AddMenu({ entries, disabled }: { entries: AddMenuEntry[]; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (open && trigger.current) setStyle(computeAnchoredPopoverStyle(trigger.current, { align: "left", minWidth: 240 })); }, [open]);
  useDismissOnOutsideClick(open, setOpen, trigger, panel);
  return <>
    <button ref={trigger} type="button" data-testid="native-cli-add" aria-label="Add to message" title="Add to message" aria-haspopup="menu" aria-expanded={open} disabled={disabled}
      className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-transparent text-subtext-0 [border:0] hover:bg-surface-1 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
      onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen((value) => !value)}><PlusIcon size={16} /></button>
    {open && createPortal(
      <div ref={panel} role="menu" aria-label="Add to message" style={style} className={cn("z-[9999]", menuPanel)}>
        {entries.map((entry) => <button key={entry.id} type="button" role="menuitem" disabled={entry.disabled} className={cn(menuItem(), "flex flex-col")}
          onMouseDown={(event) => event.preventDefault()} onClick={() => { setOpen(false); entry.run(); }}>
          <span>{entry.label}</span>
          {entry.detail && <span className="text-[0.72rem] text-subtext-0">{entry.detail}</span>}
        </button>)}
      </div>, document.body)}
  </>;
}
