import { cn } from "../../lib/cn";

/** Chat chrome for `NativeCliChat.tsx`: the list, the scroll pill, the message shell, the
 * worked-for summary, the error line and the composer shell. What stays in chat.css is `.chat` and the markdown
 * descendants (`.message__markdown *`, from `dangerouslySetInnerHTML`). */
export const CHAT_LIST_CONTAINER = "relative flex min-h-0 flex-1 flex-col";
export const CHAT_LIST = "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3";
export const SCROLL_PILL = "absolute right-4 bottom-3 z-5 flex cursor-pointer items-center gap-[0.4rem] rounded-ui [border:none] bg-accent px-3 py-[0.35rem] text-[0.8rem] font-semibold text-panel-bg [font-family:inherit] [box-shadow:0_4px_14px_rgba(0,0,0,0.35)] hover:[filter:brightness(1.08)]";

const MESSAGE = "relative max-w-[85%] text-[0.95rem] leading-[1.45] [word-break:break-word]";
const MESSAGE_USER = "self-end whitespace-pre-wrap rounded-ui border border-overlay-0 bg-surface-0 px-3 py-[0.55rem] text-fg";
// Assistant text is full width and unboxed; the bottom padding leaves room for the hover "copy" action.
const MESSAGE_ASSISTANT = "max-w-full self-stretch p-0 pb-[1.15rem] text-subtext-0 [background:none] [border:none]";
/** `message` and `message--<role>` stay as hooks (e2e, harness). */
export const messageClass = (role: string, extra?: string) =>
  cn("message", `message--${role}`, MESSAGE, role === "user" ? MESSAGE_USER : MESSAGE_ASSISTANT, extra);
export const MESSAGE_ERROR = "mt-[0.35rem] text-red";
export const MESSAGE_MARKDOWN = "whitespace-normal";
export const WORKED_FOR =
  "mb-[0.4rem] overflow-hidden rounded-[0.4rem] border border-overlay-0 bg-panel-bg text-[0.83rem] text-subtext-0 " +
  "[&>summary]:flex [&>summary]:cursor-pointer [&>summary]:list-none [&>summary]:items-center [&>summary]:gap-[0.4rem] [&>summary]:px-[0.55rem] [&>summary]:py-[0.3rem] [&>summary]:select-none " +
  "[&>summary]:before:inline-block [&>summary]:before:text-[0.9em] [&>summary]:before:content-['›'] [&>summary]:before:[transition:transform_0.15s_ease] " +
  "[&[open]>summary]:before:[transform:rotate(90deg)]";
/** `NativeCliChat`'s composer textarea: borderless, inherits the font, marks keyboard focus inside its box. */
export const NATIVE_TEXTAREA = "box-border max-h-[30vh] min-h-[2.5rem] w-full resize-none overflow-y-auto rounded-ui bg-transparent p-2 text-inherit [border:0] [font:inherit] focus:outline-1 focus:outline-solid focus:outline-accent focus-visible:outline-2 focus-visible:-outline-offset-2";
/** The composer's one round button: Send / Queue (accent) or Stop (neutral), in the same place. */
export const SEND_BUTTON = "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full [border:0] disabled:cursor-not-allowed disabled:opacity-40 ";
export const SEND_BUTTON_GO = SEND_BUTTON + "bg-accent text-panel-bg";
export const SEND_BUTTON_STOP = SEND_BUTTON + "bg-surface-1 text-fg";
export const CHAT_INPUT = "flex shrink-0 flex-col gap-[0.35rem] border-t border-t-overlay-0 bg-surface-0 p-[0.6rem]";
