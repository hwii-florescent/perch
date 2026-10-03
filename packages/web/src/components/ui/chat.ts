/** Hosted transcript chrome used by `Chat.tsx` only. The shared message shell (`.message*`, `.message__worked-for`,
 * markdown, scroll pill, `.chat__list`) stays in chat.css because `NativeCliChat` renders it too. The legacy
 * `tool-row__*`, `diff-line--*`, `edit-badge__*` tokens stay in the markup as unstyled hooks. */
export const MESSAGE_GROUP = "group/msg";
const ACTIONS = "absolute flex gap-1 opacity-0 [transition:opacity_0.12s_ease] group-hover/msg:opacity-100 focus-within:opacity-100";
export const ACTIONS_USER = `${ACTIONS} top-1 right-[0.35rem]`;
export const ACTIONS_ASSISTANT = `${ACTIONS} bottom-0 left-0`;
export const ACTION_BTN = "cursor-pointer rounded-ui border border-overlay-0 bg-surface-1 px-[0.4rem] py-[0.1rem] text-[0.72rem] leading-[1.4] text-subtext-0 [font-family:inherit] hover:border-accent hover:text-fg";
export const PENDING = "text-subtext-0";

export const TOOL_TIMELINE = "flex flex-col gap-[0.3rem] border-t border-t-overlay-0 px-2 py-[0.35rem]";
/** `group/row` lets the open row drive the glyph colour and the chevron rotation. */
export const TOOL_ROW = "group/row overflow-hidden rounded-ui border border-overlay-0 bg-surface-dim";
export const TOOL_SUMMARY = "flex cursor-pointer list-none items-center gap-[0.4rem] px-2 py-[0.25rem] text-[0.8rem] select-none [&::-webkit-details-marker]:hidden";
const GLYPH = "shrink-0 text-[0.75em]";
export const GLYPH_TOOL = `${GLYPH} text-overlay-1 group-open/row:text-green`;
export const GLYPH_THINKING = `${GLYPH} text-mauve`;
export const TOOL_NAME = "shrink-0 font-semibold text-fg";
export const TOOL_ARG = "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-subtext-0";
export const TOOL_CHEVRON = "ml-auto shrink-0 before:inline-block before:content-['›'] before:[transition:transform_0.15s_ease] group-open/row:before:[transform:rotate(90deg)]";
export const TOOL_BODY = "flex flex-col gap-[0.35rem] border-t border-t-overlay-0 px-2 py-[0.35rem]";
/** A detail that follows another one in the same body gets a dashed rule. */
export const TOOL_DETAIL_NEXT = "border-t border-dashed border-t-overlay-0 pt-[0.35rem]";
export const THINKING_BODY = "text-[0.82rem] whitespace-pre-wrap text-subtext-0 [word-break:break-word]";
export const TOOL_BLOCK = "m-0 overflow-x-auto rounded-[0.4rem] border border-overlay-0 bg-panel-bg px-2 py-[0.4rem] text-[0.8rem] whitespace-pre-wrap [word-break:break-word]";
export const TOOL_BLOCK_BASH = `${TOOL_BLOCK} text-green`;
export const TOOL_BLOCK_RESULT = `${TOOL_BLOCK} text-fg`;

export const DIFF_VIEW = "max-h-[300px] overflow-auto rounded-[0.4rem] border border-overlay-0 bg-panel-bg text-[0.8rem]";
const DIFF_LINE = "flex px-[0.4rem] whitespace-pre-wrap [word-break:break-word]";
const GUTTER = "w-[1.2em] shrink-0 text-center select-none";
export const DIFF_LINE_CLASS = {
  add: `${DIFF_LINE} bg-[color-mix(in_srgb,var(--green)_16%,transparent)]`,
  remove: `${DIFF_LINE} bg-[color-mix(in_srgb,var(--red)_16%,transparent)]`,
  context: DIFF_LINE,
};
export const DIFF_GUTTER_CLASS = {
  add: `${GUTTER} text-green`,
  remove: `${GUTTER} text-red`,
  context: `${GUTTER} text-overlay-1`,
};
export const DIFF_TEXT = "min-w-0 flex-1";

export const EDIT_BADGES = "mt-[0.4rem] flex flex-wrap gap-[0.35rem]";
export const EDIT_BADGE = "inline-flex max-w-full cursor-pointer items-center gap-[0.35rem] rounded-ui border border-overlay-0 bg-surface-dim px-2 py-[0.15rem] text-[0.75rem] text-subtext-0 [font-family:inherit] hover:border-accent hover:text-fg";
export const EDIT_BADGE_PATH = "max-w-[22rem] overflow-hidden text-ellipsis whitespace-nowrap";
