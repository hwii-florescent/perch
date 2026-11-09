/**
 * NewSessionPopover.tsx: Perch's agent launcher at a button (the tab strip's "+", Cmd+T, the home screen, a folder
 * project's "+"). The screen is `stock:new-session` (`stock-ui/new-session/main.tsx`) or the person's package chosen
 * for it, given these props; packages place it through `@perch/sdk`'s `NewSessionMenu`.
 */
import type { ReactNode } from "react";
import NewSessionMenu from "../stock-ui/new-session/main";
import { StockRoute } from "./mod-root";

export interface NewSessionPopoverProps {
  hostId: string;
  /** Known project cwds for this host, derived from existing sessions. */
  projectCwds: string[];
  /** A scoped launcher chooses only the harness, never a different project. */
  fixedCwd?: string;
  anchorRect: DOMRect;
  onClose: () => void;
  /** Provider selected before opening a session in the chosen directory. */
  onSelect: (cwd: string | undefined, agent: string) => void;
  /** Non-agent things to open in a scoped launcher (the tab strip's "+": a browser, a file). */
  extras?: { id: string; label: string; icon: ReactNode; onSelect: () => void }[];
}

export function NewSessionPopover(props: NewSessionPopoverProps) {
  return <StockRoute name="new-session" props={props} stock={NewSessionMenu} />;
}
