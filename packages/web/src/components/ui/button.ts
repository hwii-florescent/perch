import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { GHOST_BUTTON } from "./icon-button";

const base = cva(`${GHOST_BUTTON} shrink-0 focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]`, {
  variants: {
    // `soft` is a ghost button on a resting fill, for empty-state calls to action;
    // `primary` is the one filled button of a surface.
    variant: {
      ghost: "",
      soft: "bg-surface-0",
      primary: "bg-accent font-semibold text-panel-bg hover:bg-accent hover:text-panel-bg hover:brightness-110 focus-visible:bg-accent focus-visible:text-panel-bg",
    },
    size: {
      xs: "px-[0.3rem] py-[0.14rem] text-[0.6rem] leading-[1.1]",
      sm: "px-[0.4rem] py-[0.15rem] text-[0.7rem]",
      md: "px-[0.85rem] py-[0.35rem] text-[0.82rem]",
      lg: "px-[0.9rem] py-2 text-[0.85rem]",
    },
    // Only recolours the label; the hover fill stays the ghost one.
    tone: {
      default: "",
      danger: "hover:text-red focus-visible:text-red",
      warn: "text-yellow hover:text-yellow focus-visible:text-yellow",
    },
  },
  defaultVariants: { variant: "ghost", size: "md", tone: "default" },
});

/** The one text button. Ghost by default (no fill, no border; the hover fill is
 * the affordance, docs/UI-UX-DIRECTION.md Appendix E); `primary` is the single
 * filled action of a dialog. Later classes in `className` win (twMerge). */
export function button({ className, ...variants }: Omit<VariantProps<typeof base>, "class" | "className"> & { className?: string } = {}): string {
  return cn(base(variants), className);
}
