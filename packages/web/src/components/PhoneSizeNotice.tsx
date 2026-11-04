import { useState } from "react";
import { cn } from "../lib/cn";
import { button } from "./ui/button";
import { glass } from "./ui/glass";
import { ICON_BUTTON } from "./ui/icon-button";

/**
 * Over a desktop terminal whose size a phone holds (Orca's "your phone is in control", for
 * Perch's shared typing: the desktop can still type, but the screen is phone-sized).
 * Offers the size back for this tab or for every terminal a phone holds, and folds to a
 * chip so the notice does not sit over the output the user is watching. A new phone
 * (a new lease generation) opens it again.
 */
export function PhoneSizeNotice({ generation, pending, onThisTab, onAllTabs }: {
  generation: number;
  pending: boolean;
  onThisTab: () => void;
  onAllTabs: () => void;
}) {
  const [foldedGeneration, setFoldedGeneration] = useState<number | null>(null);
  const folded = foldedGeneration === generation;
  const place = cn(glass, "absolute top-2 right-3 z-[2] text-[0.8rem] text-subtext-0");
  if (folded) {
    return (
      <div className={cn(place, "flex items-center p-0.5")} data-testid="phone-size-chip">
        <button type="button" className={button({ size: "md" })} onClick={() => setFoldedGeneration(null)}>Phone size</button>
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
        <button type="button" className={cn(ICON_BUTTON, "text-[1rem]")} aria-label="Keep phone size and hide this" onClick={() => setFoldedGeneration(generation)}>×</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button({ variant: "primary", size: "md" })} disabled={pending} onClick={onThisTab}>Take back this tab</button>
        <button type="button" className={button({ variant: "soft", size: "md" })} disabled={pending} onClick={onAllTabs}>Take back all tabs</button>
      </div>
    </div>
  );
}
