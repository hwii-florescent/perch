import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";

/** A glyph button at the end of a sidebar row: ⋯, +, new chat, close. A compact 24px box centred on
 * the glyph, not a column as tall as the row. Its hover fill is the row's own hover fill
 * (`surface-1`), so only the glyph itself lights up (subtext → text colour).
 *
 * `reveal` says which row group shows it: `project` is a header row (`group/ph`), `session` a
 * session row (`group/row`). Both also show it on keyboard focus, an open menu, and on touch. */
const base = cva(
  "mx-0.5 grid size-6 shrink-0 cursor-pointer place-items-center self-center rounded-ui bg-transparent p-0 leading-none text-subtext-0 [border:0] [font-family:inherit] [font-size:inherit] [font-weight:inherit] hover:bg-surface-1 hover:text-fg focus-visible:bg-surface-1 focus-visible:text-fg",
  {
    variants: {
      reveal: {
        always: "",
        project: "opacity-0 group-hover/ph:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100",
        session: "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
      },
      tone: { default: "", danger: "hover:text-red focus-visible:text-red" },
    },
    defaultVariants: { reveal: "always", tone: "default" },
  },
);

export function rowAction({ className, ...variants }: NonNullable<Parameters<typeof base>[0]> & { className?: string } = {}): string {
  return cn(base(variants), className);
}
