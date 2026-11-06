/** Composer chrome shared by `SlashPopover` and the UI/CLI `ModeSwitch`. */
const OVERLAY = "z-[9999] rounded-ui bg-surface-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]";

/** Portal-rendered into document.body, anchored to the textarea's left edge. */
export const SLASH_POPOVER = `${OVERLAY} min-w-[260px] overflow-y-auto py-[0.25rem]`;
const SLASH_ITEM = "flex w-full cursor-pointer flex-col items-start gap-[0.1rem] px-[0.75rem] py-[0.35rem] text-left [border:none] [transition:background_0.1s_ease] hover:bg-surface-0";
export const SLASH_ITEM_ON = `${SLASH_ITEM} bg-surface-0`;
export const SLASH_ITEM_OFF = `${SLASH_ITEM} bg-transparent`;
const SLASH_NAME = "text-[0.82rem] [font-family:var(--font-mono)]";
export const SLASH_NAME_ON = `${SLASH_NAME} text-accent`;
export const SLASH_NAME_OFF = `${SLASH_NAME} text-fg`;
export const SLASH_DESC = "text-[0.72rem] text-subtext-0";

/** Pill track + sliding thumb on theme tokens only. `group-aria-*` reads the root's `aria-checked`. The thumb moves with
 * `transform` (not Tailwind's `translate`) so the transition still animates. */
export const MODE_SWITCH = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]";
const MODE_LABEL = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]";
export const MODE_LABEL_UI = `${MODE_LABEL} group-aria-[checked=false]:text-accent`;
export const MODE_LABEL_CLI = `${MODE_LABEL} group-aria-checked:text-accent`;
export const MODE_TRACK = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg";
export const MODE_THUMB = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
