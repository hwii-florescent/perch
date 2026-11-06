import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { requestNativeUi } from "../../nativeUi";
import { newId } from "../../ids";

/** Start loading when the top of the transcript is this close to the viewport (Orca: 600px). */
const PREFETCH_PX = 600;

export type OlderHistory = {
  sentinelRef: (node: HTMLElement | null) => void;
  loading: boolean;
  /** False once a page failed or added nothing, or the browser cannot observe scrolling: the person asks. */
  auto: boolean;
  loadNow: () => void;
};

/** Older history, a page at a time, as Orca's `useNativeChatOlderHistoryAutoload`: an observer on the top of the
 * list asks the core (`agent.ui.older`) while it is near the viewport and more exists. The core adds the page
 * to the snapshot; this keeps the reader's place by moving the scroll by what was added above it. A failed or
 * empty page stops the automatic loading until the person asks. */
export function useOlderHistory({ sessionId, providerId, available, list, revision }: {
  sessionId: string; providerId: string; available: boolean; list: RefObject<HTMLElement | null>; revision: number | undefined;
}): OlderHistory {
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [stopped, setStopped] = useState(false);
  const inFlight = useRef(false);
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const forgetAnchor = useRef<number | undefined>(undefined);
  const key = `${sessionId}:${providerId}`;
  useEffect(() => { setStopped(false); }, [key]);
  useEffect(() => () => window.clearTimeout(forgetAnchor.current), []);

  const load = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    const element = list.current;
    anchor.current = element ? { height: element.scrollHeight, top: element.scrollTop } : null;
    requestNativeUi({ type: "agent.ui.older", requestId: newId(), sessionId, providerId })
      .then((reply) => {
        if (reply.type !== "agent.ui.older.result") return;
        if (reply.outcome === "failed" || reply.outcome === "unchanged") setStopped(true);
        // The longer snapshot may land just after this reply: keep the place for a moment longer, then let go.
        window.clearTimeout(forgetAnchor.current);
        forgetAnchor.current = window.setTimeout(() => { anchor.current = null; }, 3000);
      })
      .catch(() => { setStopped(true); anchor.current = null; })
      .finally(() => { inFlight.current = false; setLoading(false); });
  }, [list, sessionId, providerId]);

  // The page was added above what was on screen: move down by its height so the same line stays put.
  useLayoutEffect(() => {
    const before = anchor.current;
    const element = list.current;
    if (!before || !element || element.scrollHeight === before.height) return;
    element.scrollTop = before.top + element.scrollHeight - before.height;
    anchor.current = null;
  }, [revision, list]);

  const canObserve = typeof IntersectionObserver !== "undefined";
  const auto = canObserve && !stopped;
  const observing = auto && available && !loading;
  useEffect(() => {
    const root = list.current;
    if (!observing || !sentinel || !root) return;
    // Observing again after each page makes the observer report a top that is still near, so loading continues.
    const observer = new IntersectionObserver((entries) => { if (entries.at(-1)?.isIntersecting) load(); }, { root, rootMargin: `${PREFETCH_PX}px 0px 0px 0px` });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [observing, sentinel, list, load, revision]);

  return { sentinelRef: setSentinel, loading, auto, loadNow: () => { setStopped(false); load(); } };
}
