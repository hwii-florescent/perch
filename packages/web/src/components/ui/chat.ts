import { cn } from "../../lib/cn";

/** Chat chrome for `NativeCliChat.tsx`: the list, the scroll pill, the message shell, the
 * worked-for summary, the error line and the composer shell. What stays in chat.css is `.chat` and the markdown
 * descendants (`.message__markdown *`, from `dangerouslySetInnerHTML`). */
export const CHAT_LIST_CONTAINER = "relative flex min-h-0 flex-1 flex-col";
export const CHAT_LIST = "min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-2";
/** One centred reading column (Claude desktop, Orca), shared by the transcript and the composer. */
export const CHAT_COLUMN = "mx-auto flex w-full max-w-[46rem] flex-col";
export const SCROLL_PILL = "absolute right-4 bottom-3 z-5 flex cursor-pointer items-center gap-[0.4rem] rounded-ui [border:none] bg-accent px-3 py-[0.35rem] text-[0.8rem] font-semibold text-panel-bg [font-family:inherit] [box-shadow:0_4px_14px_rgba(0,0,0,0.35)] hover:[filter:brightness(1.08)]";

const MESSAGE = "relative max-w-[85%] text-[0.95rem] leading-[1.55] [word-break:break-word]";
const MESSAGE_USER = "self-end whitespace-pre-wrap rounded-soft bg-surface-1 px-3.5 py-2 text-fg";
// Assistant text is full width, unboxed and at full contrast: it is what you came to read.
const MESSAGE_ASSISTANT = "max-w-full self-stretch p-0 text-fg [background:none] [border:none]";
/** `message` and `message--<role>` stay as hooks (e2e, harness). */
export const messageClass = (role: string, extra?: string) =>
  cn("message", `message--${role}`, MESSAGE, role === "user" ? MESSAGE_USER : MESSAGE_ASSISTANT, extra);
export const MESSAGE_ERROR = "mt-[0.35rem] text-red";
export const MESSAGE_MARKDOWN = "whitespace-normal";
/** A quiet disclosure line: no box, a drawn chevron (as `Chevron`) before the label, a hover fill. */
export const WORKED_FOR =
  "text-[0.83rem] text-subtext-0 " +
  "[&>summary]:flex [&>summary]:cursor-pointer [&>summary]:list-none [&>summary]:items-center [&>summary]:gap-[0.4rem] [&>summary]:rounded-ui [&>summary]:px-[0.4rem] [&>summary]:py-[0.25rem] [&>summary]:select-none [&>summary:hover]:bg-surface-1 [&>summary:hover]:text-fg " +
  "[&>summary]:before:inline-block [&>summary]:before:size-[0.4rem] [&>summary]:before:shrink-0 [&>summary]:before:[border-right:1.3px_solid_currentColor] [&>summary]:before:[border-bottom:1.3px_solid_currentColor] [&>summary]:before:[transform:rotate(-45deg)] [&>summary]:before:content-[''] [&>summary]:before:[transition:transform_0.15s_ease] " +
  "[&[open]>summary]:before:[transform:rotate(45deg)] " +
  "[&_pre]:m-[0.2rem_0_0.3rem_1.2rem] [&_pre]:max-h-72 [&_pre]:overflow-auto [&_pre]:rounded-ui [&_pre]:bg-surface-0 [&_pre]:p-2 [&_pre]:text-[0.78rem] [&_pre]:text-fg";
/** `NativeCliChat`'s composer textarea: borderless, inherits the font, marks keyboard focus inside its box. */
export const NATIVE_TEXTAREA = "box-border max-h-[30vh] min-h-[2.5rem] w-full resize-none overflow-y-auto rounded-soft bg-transparent px-3 pt-2.5 pb-1 text-inherit [border:0] [font:inherit] focus:outline-none";
/** The composer's one round button: Send / Queue (accent) or Stop (neutral), in the same place. */
export const SEND_BUTTON = "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full [border:0] disabled:cursor-not-allowed disabled:opacity-40 ";
export const SEND_BUTTON_GO = SEND_BUTTON + "bg-accent text-panel-bg";
export const SEND_BUTTON_STOP = SEND_BUTTON + "bg-surface-1 text-fg";
/** The composer is one filled card in the column; focus is a 1px accent outline on the card (DECISIONS 2026-11-04). */
export const CHAT_INPUT = "flex flex-col rounded-soft bg-surface-0 focus-within:outline-1 focus-within:outline-solid focus-within:outline-accent";
