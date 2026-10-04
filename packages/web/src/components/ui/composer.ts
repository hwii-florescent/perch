/** Hosted composer chrome shared by `ModelChip`, `EffortChip`, `SlashPopover` and `Chat`.
 * The legacy `model-chip__*` / `slash-popover__*` tokens stay in the markup as unstyled hooks. */
const OVERLAY = "z-[9999] rounded-ui border border-accent bg-panel-bg shadow-[0_8px_24px_rgba(0,0,0,0.45)]";

/** position/bottom/right come from inline style (position:fixed) so the popover escapes overflow:hidden ancestors. */
export const CHIP_POPOVER = `${OVERLAY} min-w-[220px] overflow-hidden`;
export const CHIP = "relative ml-auto shrink-0";
export const CHIP_PILL = "cursor-pointer rounded-ui border border-overlay-0 bg-surface-1 px-[0.65rem] py-[0.25rem] text-[0.78rem] whitespace-nowrap text-fg [font-family:inherit] [transition:border-color_0.12s_ease] hover:border-accent";
export const CHIP_AGENTS = "flex gap-[0.25rem] border-b border-b-overlay-0 p-[0.3rem]";
const CHIP_AGENT_BTN = "flex-1 cursor-pointer rounded-ui border bg-transparent px-[0.5rem] py-[0.3rem] text-[0.8rem] [font-family:inherit] [transition:background_0.1s_ease,color_0.1s_ease] hover:bg-surface-1 hover:text-fg";
export const CHIP_AGENT_BTN_ON = `${CHIP_AGENT_BTN} border-overlay-0 bg-surface-1 text-accent`;
export const CHIP_AGENT_BTN_OFF = `${CHIP_AGENT_BTN} border-transparent text-subtext-0`;
export const CHIP_MODELS = "py-[0.25rem]";
const CHIP_MODEL_BTN = "flex w-full cursor-pointer items-center gap-[0.4rem] bg-transparent px-[0.75rem] py-[0.4rem] text-left text-[0.82rem] [border:none] [font-family:inherit] [transition:background_0.1s_ease] hover:bg-surface-1";
export const CHIP_MODEL_BTN_ON = `${CHIP_MODEL_BTN} text-accent`;
export const CHIP_MODEL_BTN_OFF = `${CHIP_MODEL_BTN} text-fg`;
export const CHIP_CHECK = "w-[0.8rem] shrink-0 text-[0.75rem] text-accent";
export const CHIP_EMPTY = "px-[0.75rem] py-[0.5rem] text-[0.8rem] text-subtext-0";

/** Portal-rendered into document.body, anchored to the textarea's left edge. */
export const SLASH_POPOVER = `${OVERLAY} min-w-[260px] overflow-y-auto py-[0.25rem]`;
const SLASH_ITEM = "flex w-full cursor-pointer flex-col items-start gap-[0.1rem] px-[0.75rem] py-[0.35rem] text-left [border:none] [transition:background_0.1s_ease] hover:bg-surface-1";
export const SLASH_ITEM_ON = `${SLASH_ITEM} bg-surface-1`;
export const SLASH_ITEM_OFF = `${SLASH_ITEM} bg-transparent`;
const SLASH_NAME = "text-[0.82rem] [font-family:var(--font-mono)]";
export const SLASH_NAME_ON = `${SLASH_NAME} text-accent`;
export const SLASH_NAME_OFF = `${SLASH_NAME} text-fg`;
export const SLASH_DESC = "text-[0.72rem] text-subtext-0";

const PLAN_TOGGLE = "cursor-pointer rounded-ui border px-[0.6rem] py-[0.3rem] text-[0.78rem] leading-[1.2] [font-family:inherit] hover:border-accent hover:text-fg";
export const PLAN_TOGGLE_ON = `${PLAN_TOGGLE} border-accent bg-accent font-semibold text-surface-0`;
export const PLAN_TOGGLE_OFF = `${PLAN_TOGGLE} border-overlay-0 bg-surface-1 text-subtext-0`;

const SEND = "shrink-0 cursor-pointer rounded-ui px-[0.9rem] py-[0.35rem] text-[0.9rem] font-semibold text-panel-bg [border:none] [font-family:inherit]";
export const SEND_BTN = `${SEND} bg-accent disabled:cursor-not-allowed disabled:opacity-40`;
export const CANCEL_BTN = `${SEND} bg-red`;
export const INPUT_CONTROLS = "flex items-center gap-2";

/** A bordered artifact awaiting a decision, deliberately distinct from the borderless assistant bubble. */
export const PLAN_CARD = "max-w-full self-stretch rounded-ui border border-mauve bg-surface-0 px-[0.9rem] py-[0.75rem] text-fg";
export const PLAN_HEADER = "mb-2 flex items-center gap-[0.4rem] text-[0.8rem] font-semibold tracking-[0.04em] text-mauve uppercase";
export const PLAN_GLYPH = "text-[0.9rem]";
export const PLAN_BODY = "text-fg";
export const PLAN_FOOTER = "mt-[0.75rem] flex justify-end";
export const PLAN_APPROVE = "cursor-pointer rounded-ui border border-green bg-green px-[0.85rem] py-[0.35rem] text-[0.82rem] font-semibold text-surface-0 [font-family:inherit] enabled:hover:brightness-[1.08] disabled:cursor-default disabled:border-overlay-0 disabled:bg-surface-1 disabled:font-normal disabled:text-subtext-0";

/** Name-only chips by design: never a thumbnail from file bytes, so the DOM stays free of data:/blob: URIs (e2e checks). */
export const ATTACH_BAR = "flex flex-wrap items-start gap-[0.4rem]";
export const ATTACH_BTN = "shrink-0 cursor-pointer rounded-ui border border-overlay-0 bg-surface-1 px-[0.5rem] py-[0.3rem] text-[0.9rem] leading-none text-subtext-0 enabled:hover:border-accent enabled:hover:text-fg disabled:cursor-not-allowed disabled:opacity-40";
export const ATTACH_CHIPS = "flex flex-wrap items-center gap-[0.35rem]";
export const ATTACH_CHIP = "inline-flex max-w-[14rem] items-center gap-[0.3rem] rounded-ui border border-overlay-0 bg-surface-1 px-[0.4rem] py-[0.2rem] text-[0.78rem] text-fg";
export const ATTACH_NAME = "overflow-hidden text-ellipsis whitespace-nowrap";
export const ATTACH_REMOVE = "shrink-0 cursor-pointer bg-transparent p-0 text-[0.9rem] leading-none text-subtext-0 [border:none] hover:text-red";
export const ATTACH_ERROR = "basis-full text-[0.78rem] text-red";

/** Pill track + sliding thumb on theme tokens only. `group-aria-*` reads the root's `aria-checked`. The thumb moves with
 * `transform` (not Tailwind's `translate`) so the transition still animates. */
export const MODE_SWITCH = "mode-switch group ml-auto flex items-center gap-[0.4rem] bg-transparent p-[0.2rem] [border:none] [font-family:inherit]";
const MODE_LABEL = "text-[0.72rem] font-semibold tracking-[0.03em] text-overlay-1 uppercase [transition:color_0.15s_ease]";
export const MODE_LABEL_HOSTED = `${MODE_LABEL} group-aria-[checked=false]:text-accent`;
export const MODE_LABEL_CLI = `${MODE_LABEL} group-aria-checked:text-accent`;
export const MODE_TRACK = "relative h-[1.3rem] w-[2.4rem] shrink-0 rounded-[999px] border border-overlay-0 bg-surface-1 [transition:background_0.15s_ease] group-aria-checked:border-accent group-aria-checked:bg-panel-bg";
export const MODE_THUMB = "absolute top-px left-px h-[1.1rem] w-[1.1rem] rounded-[50%] bg-fg [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] [transition:transform_0.15s_ease,background_0.15s_ease] group-aria-checked:bg-accent group-aria-checked:[transform:translateX(1.1rem)]";
