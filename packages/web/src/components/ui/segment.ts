import { cva } from "class-variance-authority";

/** A full-bleed button for a strip or a column: square, no gap or inset around
 * it, so the fill (active or hover) covers its whole cell edge to edge instead
 * of floating as a small box. The parent must be a flex row with
 * `items-stretch` (or `self-stretch` here) and no padding or gap. Tab strip
 * tabs, the Files/Git switch and the sidebar's action rows all use this. */
export const segment = cva(
  "flex cursor-pointer items-center self-stretch rounded-none [border:0] [font-family:inherit] [transition:color_0.1s_ease,background_0.1s_ease] disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      active: {
        true: "bg-surface-1 text-fg",
        false: "bg-transparent text-subtext-0 hover:bg-surface-0 hover:text-fg",
      },
    },
    defaultVariants: { active: false },
  },
);
