import { useEffect, useState } from "react";
import { requestNativeUi } from "../../nativeUi";
import { newId } from "../../ids";

/** Ids of the transcript blocks containing `query`; the core decides what matches. Asked again when the
 * transcript moves (`revision`), debounced so typing and streaming do not flood it; a reply that arrives
 * after the query or transcript changed is dropped. Only asked of a host that sent a projection
 * (`supported`): an older one does not know the question and finds nothing. */
export function useFindHits(sessionId: string, providerId: string, query: string | null, revision: number | undefined, supported: boolean): string[] {
  const [hits, setHits] = useState<string[]>([]);
  useEffect(() => {
    if (!supported || !query?.trim()) { setHits([]); return; }
    let live = true;
    const timer = setTimeout(() => {
      requestNativeUi({ type: "agent.ui.find", requestId: newId(), sessionId, providerId, query })
        .then((reply) => { if (live && reply.type === "agent.ui.found") setHits(reply.blocks); })
        .catch(() => { if (live) setHits([]); });
    }, 150);
    return () => { live = false; clearTimeout(timer); };
  }, [sessionId, providerId, query, revision, supported]);
  return hits;
}
