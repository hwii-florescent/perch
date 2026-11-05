import { useEffect, useRef } from "react";
import { cn } from "../../lib/cn";
import { SLASH_DESC, SLASH_ITEM_OFF, SLASH_ITEM_ON, SLASH_NAME_OFF, SLASH_NAME_ON } from "../../components/ui/composer";

export interface MenuItem { key: string; label: string; detail?: string }

export const menuOptionId = (index: number) => `native-menu-option-${index}`;

/** The composer's one autocomplete list, above the textarea. Focus stays in the textarea: it owns the
 * arrow/Enter/Esc keys and points at the highlighted option with `aria-activedescendant`. */
export function MenuList({ items, active, label, onPick, onHover }: { items: MenuItem[]; active: number; label: string; onPick: (index: number) => void; onHover: (index: number) => void }) {
  const current = useRef<HTMLButtonElement>(null);
  useEffect(() => { current.current?.scrollIntoView({ block: "nearest" }); }, [active]);
  return <div role="listbox" aria-label={label} data-testid="native-cli-menu" className={cn("absolute inset-x-2 bottom-full z-10 mb-1 max-h-56 overflow-y-auto rounded-ui border border-accent bg-panel-bg py-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]")}>
    {items.map((item, index) => <button key={item.key} id={menuOptionId(index)} ref={index === active ? current : undefined} type="button" role="option" aria-selected={index === active}
      className={index === active ? SLASH_ITEM_ON : SLASH_ITEM_OFF}
      onMouseDown={(event) => { event.preventDefault(); onPick(index); }} onMouseEnter={() => onHover(index)}>
      <span className={index === active ? SLASH_NAME_ON : SLASH_NAME_OFF}>{item.label}</span>
      {item.detail && <span className={SLASH_DESC}>{item.detail}</span>}
    </button>)}
  </div>;
}
