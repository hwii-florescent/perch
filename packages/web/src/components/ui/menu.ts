import { cva } from "class-variance-authority";

/** Popup chrome for every menu: the hover fill (surface-1), no border, a
 * shadow. Items hover one step lighter. Never an accent border. */
export const menuPanel =
  "overflow-hidden rounded-ui bg-surface-1 py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]";

/** `pane-context-menu__item` is an unstyled hook: e2e counts the items. */
export const menuItem = cva(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-overlay-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: false } },
);

export const menuDivider = "my-1 h-px bg-overlay-0";
