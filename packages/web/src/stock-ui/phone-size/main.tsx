//! Phone size, the stock screen `stock:phone-size`: over a desktop terminal whose size a phone holds (Orca's "your
//! phone is in control", for Perch's shared typing: the desktop can still type, but the screen is phone-sized). It
//! offers the size back for this tab or for every terminal a phone holds, and folds to a chip so the notice does not
//! sit over the output the person is watching. A new phone (a new `generation`) opens it again. Perch shows it, or the
//! person's package chosen for it (`perch mod use stock:phone-size <id>`), with the same props.
//!
//! Taking the size back is Perch's (the terminal's resize lease): this screen only asks.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:phone-size` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside
//! it (docs/MOD-SDK.md).
import { useState } from "react";
import { buttonClass, cn, iconButton, type PhoneSizeProps } from "@perch/sdk";

/** Floating chrome over a terminal: a translucent surface over a blur, rounded like the panes. */
const GLASS = "[--radius:var(--radius-pane)] rounded-soft bg-surface-1/70 shadow-[0_6px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl backdrop-saturate-150";

export default function PhoneSize({ generation, pending, onThisTab, onAllTabs }: PhoneSizeProps) {
  const [foldedGeneration, setFoldedGeneration] = useState<number | null>(null);
  const folded = foldedGeneration === generation;
  const place = cn(GLASS, "absolute top-2 right-3 z-[2] text-[0.8rem] text-subtext-0");
  if (folded) {
    return (
      <div className={cn(place, "flex items-center p-0.5")} data-testid="phone-size-chip">
        <button type="button" className={buttonClass({ size: "md" })} onClick={() => setFoldedGeneration(null)}>Phone size</button>
      </div>
    );
  }
  return (
    <div className={cn(place, "grid max-w-[min(22rem,calc(100%-1.5rem))] gap-2 p-3")} role="status" data-testid="phone-size-notice">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <span className="font-semibold text-fg">Your phone is sizing this terminal</span>
          <span>It shows at phone size so it fits. You can still type here. Take it back to return to this window&apos;s size.</span>
        </div>
        <button type="button" className={cn(iconButton, "text-[1rem]")} aria-label="Keep phone size and hide this" onClick={() => setFoldedGeneration(generation)}>×</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass({ variant: "primary", size: "md" })} disabled={pending} onClick={onThisTab}>Take back this tab</button>
        <button type="button" className={buttonClass({ variant: "soft", size: "md" })} disabled={pending} onClick={onAllTabs}>Take back all tabs</button>
      </div>
    </div>
  );
}
