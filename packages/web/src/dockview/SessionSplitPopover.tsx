/**
 * SessionSplitPopover.tsx: the "Split with session" picker opened from a pane group's header actions
 * (`DockviewShell.tsx`'s `PaneGroupHeaderActions`). The screen is `stock:session-split`
 * (`stock-ui/session-split/main.tsx`) or the person's package chosen for it; the split itself is bound here: a click
 * splits the session in to the right of the group it was opened from (`addSessionChatPanel` dedupes an open one),
 * and a drag carries the session id in `sessionDrag.ts`'s mime type, which `DockviewShell.tsx` reads back on drop.
 * A phone keeps Perch's own.
 */
import type { SessionSummary } from "@perch/shared";
import type { SessionSplitProps } from "@perch/sdk";
import { StockRoute } from "../components/mod-root";
import { useIsMobileWidth } from "../responsive";
import SessionSplit from "../stock-ui/session-split/main";
import { beginSessionDrag } from "./sessionDrag";

export function SessionSplitPopover({ sessions, openSessionIds, x, y, onPick, onClose }: {
  /** Candidate sessions to split in; the caller has already excluded the session the triggering group shows. */
  sessions: SessionSummary[];
  /** Sessions with a chat panel open somewhere in this shell (`DockviewController.openSessionChatIds()`). */
  openSessionIds: string[];
  x: number;
  y: number;
  onPick: (sessionId: string, title: string) => void;
  onClose: () => void;
}) {
  const exact = useIsMobileWidth();
  const props: SessionSplitProps = {
    sessions: sessions.map((s) => ({ id: s.id, title: s.title, cwd: s.cwd, open: openSessionIds.includes(s.id) })),
    x, y, onClose, beginDrag: beginSessionDrag,
    onPick: (id) => {
      const session = sessions.find((s) => s.id === id);
      if (session) onPick(session.id, session.title);
    },
  };
  return <StockRoute name="session-split" props={props} stock={SessionSplit} exact={exact} />;
}
