/**
 * DirectoryBrowser.tsx — Wave 1 item 1: directory browser for the new-session
 * cwd picker, embedded inside `NewSessionPopover` (Sidebar.tsx) and the
 * tab-bar "+" popover (TabBar.tsx), replacing the raw path-only input as the
 * default entry point (the plain text input is kept as a "Type path"
 * fallback toggle for arbitrary/unlisted paths).
 *
 * Two modes:
 *  - Browse (default): breadcrumb path, dirs-only listing (with a small
 *    git-repo badge), a live substring filter, Enter/click to descend,
 *    Backspace-with-empty-filter to go up, and an explicit "Use this
 *    folder" button (also bound to Cmd/Ctrl+Enter).
 *  - Type path: the original manual text input, for paths not reachable by
 *    browsing (or just faster to type).
 *
 * Listings are fetched via `usePerchStore().browseDirectory(hostId, path)`,
 * which round-trips the `fs.browse` / `fs.browse.result` protocol messages
 * (hub-routed transparently for remote hosts — see `hub.rs`'s
 * `PendingKey::Browse`). The last-used path is remembered per hostId in
 * localStorage so re-opening the picker resumes where the user left off.
 */
import { useEffect, useRef, useState } from "react";
import { usePerchStore } from "../store";
import type { FsEntry } from "@perch/shared";

function lastPathKey(hostId: string): string {
  return `perch.dirBrowser.lastPath.${hostId}`;
}

function getLastPath(hostId: string): string | undefined {
  try {
    return localStorage.getItem(lastPathKey(hostId)) ?? undefined;
  } catch {
    return undefined;
  }
}

function setLastPath(hostId: string, path: string): void {
  try {
    localStorage.setItem(lastPathKey(hostId), path);
  } catch {
    // ignore (private browsing / quota)
  }
}

export interface DirectoryBrowserProps {
  hostId: string;
  /** Called with the final chosen path when the user confirms ("Use this
   * folder" / Cmd-Enter in browse mode, or Enter/Create in type-path mode). */
  onUseFolder: (path: string) => void;
}

export function DirectoryBrowser({ hostId, onUseFolder }: DirectoryBrowserProps) {
  const browseDirectory = usePerchStore((s) => s.browseDirectory);
  const [mode, setMode] = useState<"browse" | "type">("browse");
  const [typedPath, setTypedPath] = useState("");
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [parent, setParent] = useState<string | undefined>(undefined);
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const requestSeq = useRef(0);
  const filterInputRef = useRef<HTMLInputElement>(null);

  function load(path?: string) {
    const seq = ++requestSeq.current;
    setLoading(true);
    browseDirectory(hostId, path).then((result) => {
      if (requestSeq.current !== seq) return; // stale reply, a newer nav happened
      setCurrentPath(result.path);
      setParent(result.parent);
      setEntries(result.entries);
      setFilter("");
      setLoading(false);
      setLastPath(hostId, result.path);
    });
  }

  // Load the initial listing once, at the last-used path for this host (else
  // the server defaults to $HOME).
  useEffect(() => {
    load(getLastPath(hostId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId]);

  useEffect(() => {
    if (mode === "browse") filterInputRef.current?.focus();
  }, [mode, currentPath]);

  const filteredEntries = filter.trim()
    ? entries.filter((e) => e.name.toLowerCase().includes(filter.trim().toLowerCase()))
    : entries;

  function goUp() {
    if (parent) load(parent);
  }

  function descend(entry: FsEntry) {
    load(entry.path);
  }

  function confirmCurrent() {
    if (currentPath) {
      setLastPath(hostId, currentPath);
      onUseFolder(currentPath);
    }
  }

  function handleFilterKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" && (e.metaKey || e.ctrlKey)) ) {
      e.preventDefault();
      confirmCurrent();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const first = filteredEntries[0];
      if (first) descend(first);
      return;
    }
    if (e.key === "Backspace" && filter === "") {
      e.preventDefault();
      goUp();
    }
  }

  // Breadcrumb segments for the current path, each clickable to jump there.
  const segments = (currentPath ?? "").split("/").filter(Boolean);
  const isAbsolute = (currentPath ?? "").startsWith("/");

  return (
    <div className="dir-browser" data-testid="dir-browser">
      <div className="dir-browser__header">
        <button
          type="button"
          className="dir-browser__mode-toggle"
          data-testid="dir-browser-mode-toggle"
          onClick={() => setMode(mode === "browse" ? "type" : "browse")}
        >
          {mode === "browse" ? "Type path" : "Browse"}
        </button>
      </div>

      {mode === "browse" ? (
        <>
          <div className="dir-browser__breadcrumb" title={currentPath ?? ""}>
            <button
              type="button"
              className="dir-browser__crumb"
              data-testid="dir-browser-up"
              disabled={!parent}
              onClick={goUp}
              title="Go up one level"
            >
              ↑
            </button>
            <span className="dir-browser__path">
              {isAbsolute ? "/" : ""}
              {segments.map((seg, i) => {
                const segPath = "/" + segments.slice(0, i + 1).join("/");
                const isLast = i === segments.length - 1;
                return (
                  <span key={segPath}>
                    <button
                      type="button"
                      className="dir-browser__crumb-segment"
                      disabled={isLast}
                      onClick={() => load(segPath)}
                    >
                      {seg}
                    </button>
                    {!isLast && "/"}
                  </span>
                );
              })}
            </span>
          </div>

          <input
            type="text"
            ref={filterInputRef}
            className="dir-browser__filter"
            data-testid="dir-browser-filter"
            placeholder="Filter…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={handleFilterKeyDown}
          />

          <div className="dir-browser__list">
            {loading ? (
              <div className="dir-browser__empty">Loading…</div>
            ) : filteredEntries.length === 0 ? (
              <div className="dir-browser__empty">No subfolders</div>
            ) : (
              filteredEntries.map((entry) => (
                <button
                  type="button"
                  key={entry.path}
                  className="dir-browser__entry"
                  data-testid={`dir-browser-entry-${entry.name}`}
                  onClick={() => descend(entry)}
                  title={entry.path}
                >
                  <span className="dir-browser__entry-name">{entry.name}</span>
                  {entry.isGitRepo && (
                    <span className="dir-browser__entry-badge" title="Git repository">
                      git
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="dir-browser__footer">
            <button
              type="button"
              className="dir-browser__use-btn"
              data-testid="dir-browser-use"
              disabled={!currentPath}
              onClick={confirmCurrent}
              title="Use this folder (Cmd/Ctrl+Enter)"
            >
              Use this folder
            </button>
          </div>
        </>
      ) : (
        <div className="dir-browser__type">
          <input
            type="text"
            className="dir-browser__type-input"
            data-testid="project-path-input"
            placeholder="/path/to/project"
            value={typedPath}
            onChange={(e) => setTypedPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && typedPath.trim()) onUseFolder(typedPath.trim());
            }}
          />
          <button
            type="button"
            className="dir-browser__use-btn"
            data-testid="dir-browser-use"
            disabled={!typedPath.trim()}
            onClick={() => {
              if (typedPath.trim()) onUseFolder(typedPath.trim());
            }}
          >
            Use this path
          </button>
        </div>
      )}
    </div>
  );
}
