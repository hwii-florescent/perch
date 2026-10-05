/** Borderless glyph button that dims until hovered (project-row +, ±, ✕). Add
 * `self-center` etc. at the call site. */
export const ICON_BUTTON =
  "shrink-0 cursor-pointer rounded-ui bg-transparent px-[0.2rem] py-[0.1rem] text-[0.8rem] leading-none text-subtext-0 [font-family:inherit] [border:none] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-accent";

/** Text or icon button with no fill or border of its own; it takes the hover
 * fill (surface-1) only on hover or focus. The "+ Add", sort and header
 * actions all use this, so no button carries a colour of its own. */
export const GHOST_BUTTON =
  "cursor-pointer rounded-ui bg-transparent text-subtext-0 [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg disabled:cursor-not-allowed disabled:opacity-40";
