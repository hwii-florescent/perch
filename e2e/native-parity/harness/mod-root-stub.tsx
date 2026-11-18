//! `StockView` for the reference page: the app's own loads a stock screen from the build's catalog (`catalog.json`),
//! which only a full web build has. Here a stock screen is its source in this page, the way the screens' own references
//! mount it, so `StockWindow` draws its three parts with the real stock sidebar, tab strip and start page. Everything
//! else `mod-root` exports is the app's.
import { lazy, Suspense, useMemo, type ReactNode } from "react";

export * from "../../../packages/web/src/components/mod-root";

const SCREENS = import.meta.glob<{ default: (props: Record<string, unknown>) => ReactNode }>("../../../packages/web/src/stock-ui/*/main.tsx");

export function StockView({ name, props, className = "contents", placeholder = null }: { name: string; props?: Record<string, unknown>; className?: string; instance?: string; exact?: boolean; placeholder?: ReactNode }) {
  const Screen = useMemo(() => lazy(SCREENS[`../../../packages/web/src/stock-ui/${name}/main.tsx`]!), [name]);
  return <div className={className}><Suspense fallback={placeholder}><Screen {...(props ?? {})} /></Suspense></div>;
}
