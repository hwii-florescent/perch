import { useEffect, useState } from "react";
import type { DirectoryEntry } from "@perch/shared";
import { socket } from "../../ws";
import { newId } from "../../ids";

/** Workspace files matching `query` for `@file` mentions. Uses its own request ids, so it never touches
 * the Explorer's search state. `null` workspace or `enabled: false` searches nothing. */
export function useFileSearch(workspaceId: string | undefined, query: string | null, enabled: boolean): DirectoryEntry[] {
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  useEffect(() => {
    if (!enabled || !workspaceId || query === null) { setEntries([]); return; }
    const requestId = newId();
    let done = false;
    const stop = socket.onMessage((message) => {
      if (done || !("requestId" in message) || message.requestId !== requestId) return;
      done = true;
      setEntries(message.type === "fs.search.result" ? message.entries.filter((entry) => entry.kind === "file") : []);
    });
    const timer = setTimeout(() => socket.send({ type: "fs.search", requestId, workspaceId, query }), 120);
    return () => { done = true; clearTimeout(timer); stop(); };
  }, [workspaceId, query, enabled]);
  return entries;
}
