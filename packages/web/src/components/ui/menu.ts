import { cva } from "class-variance-authority";

/** Context-menu chrome shared by `PaneContextMenu` and the workspace `RowMenu`
 * (herdr overlay chrome: accent border on the panel background). */
export const menuPanel =
  "overflow-hidden rounded-ui border border-accent bg-panel-bg py-[0.3rem] shadow-[0_8px_24px_rgba(0,0,0,0.45)]";

/** `pane-context-menu__item` is an unstyled hook: e2e counts the items. */
export const menuItem = cva(
  "pane-context-menu__item block w-full cursor-pointer bg-transparent px-[0.9rem] py-[0.45rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-1 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-40",
  { variants: { danger: { true: "text-red", false: "text-fg" } }, defaultVariants: { danger: false } },
);

export const menuDivider = "my-1 h-px bg-overlay-0";
