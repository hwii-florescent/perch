/**
 * responsive.ts — Phase 5 (Pane splitting/zoom/context-menu + narrow-width
 * collapse) narrow-width support. Below `MOBILE_WIDTH_BREAKPOINT`, `App.tsx`
 * swaps the desktop `<Sidebar/>`+`<TabBar/>` chrome for `<MobileHeader/>`+
 * `<MobileSwitcher/>` (herdr §5.14 parity) while keeping the dockview area
 * and `<StatusBar/>` mounted unchanged.
 *
 * Backed by `matchMedia` (not a resize listener + manual width check) so it
 * fires exactly on breakpoint crossings and works with the same
 * `page.setViewportSize()`-driven resize events Playwright dispatches.
 */
import { useEffect, useState } from "react";

export const MOBILE_WIDTH_BREAKPOINT = 700;

function mobileQuery(): string {
  return `(max-width: ${MOBILE_WIDTH_BREAKPOINT}px)`;
}

/** True when the viewport is at or below `MOBILE_WIDTH_BREAKPOINT`. Updates
 * live as the viewport crosses the breakpoint (resize, phone rotation, or a
 * test harness's `page.setViewportSize()`). */
export function useIsMobileWidth(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(mobileQuery()).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(mobileQuery());
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    // Re-sync on mount in case the breakpoint changed between the initial
    // useState() evaluation (e.g. during SSR-less first paint) and effect run.
    setIsMobile(mql.matches);
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handleChange);
      return () => mql.removeEventListener("change", handleChange);
    }
    // Safari <14 fallback (deprecated but still the only API there).
    mql.addListener(handleChange);
    return () => mql.removeListener(handleChange);
  }, []);

  return isMobile;
}
