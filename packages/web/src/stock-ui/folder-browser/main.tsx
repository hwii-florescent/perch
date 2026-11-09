//! Folder browser, the stock screen `stock:folder-browser`: picks a folder on a host (a new project, a session's
//! folder). The sidebar's Add project and a package's `FolderBrowser` from `@perch/sdk` place it; or the person's
//! package chosen for it (`perch mod use stock:folder-browser <id>`) with the same props.
//!
//! Browse (default): breadcrumb path, folders only (a small git badge), a live filter, Enter or a click to go in,
//! Backspace on an empty filter to go up, and "Use this folder" (also the `directory.use` keys). Type path: a plain
//! input for paths browsing cannot reach. `browse(path?)` lists a folder through the host (the core routes a remote
//! host's listing); the last folder per host is remembered in this browser's localStorage.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:folder-browser` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { buttonClass as button, shortcutFor, shortcutLabel, useKeybindings, type FolderBrowserProps, type FolderEntry } from "@perch/sdk";

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

const EMPTY = "px-3 py-[0.4rem] text-[0.76rem] text-subtext-0";
// A function, not a constant: `@perch/sdk` may still be loading while this module runs.
const useButton = () => button({ variant: "primary", size: "sm", className: "px-[0.65rem] py-[0.32rem] text-[0.78rem]" });

export default function FolderBrowser({ hostId, onUseFolder, browse }: FolderBrowserProps) {
  // Re-drawn when the person changes a binding.
  useKeybindings();
  const folderKeys = [shortcutLabel("directory.use"), shortcutLabel("directory.useAlt")].filter(Boolean).join(" / ");
  const [mode, setMode] = useState<"browse" | "type">("browse");
  const [typedPath, setTypedPath] = useState("");
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [parent, setParent] = useState<string | undefined>(undefined);
  const [entries, setEntries] = useState<FolderEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const requestSeq = useRef(0);
  const filterInputRef = useRef<HTMLInputElement>(null);

  function load(path?: string) {
    const seq = ++requestSeq.current;
    setLoading(true);
    browse(path).then((result) => {
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

  function descend(entry: FolderEntry) {
    load(entry.path);
  }

  function confirmCurrent() {
    if (currentPath) {
      setLastPath(hostId, currentPath);
      onUseFolder(currentPath);
    }
  }

  function handleFilterKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.isDefaultPrevented() || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
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
    <div className="flex min-h-[13rem] w-full flex-1 flex-col" data-testid="dir-browser" onKeyDown={(e) => {
      if (shortcutFor(e.nativeEvent, "directory")?.scope !== "directory") return;
      e.preventDefault();
      e.stopPropagation();
      if (mode === "type") { if (typedPath.trim()) onUseFolder(typedPath.trim()); }
      else confirmCurrent();
    }}>
      <div className="flex shrink-0 justify-end px-2 py-[0.2rem]">
        <button
          type="button"
          className={button({ size: "sm" })}
          data-testid="dir-browser-mode-toggle"
          onClick={() => setMode(mode === "browse" ? "type" : "browse")}
        >
          {mode === "browse" ? "Type path" : "Browse"}
        </button>
      </div>

      {mode === "browse" ? (
        <>
          <div className="flex shrink-0 items-center gap-[0.3rem] overflow-hidden px-2 py-[0.15rem]" title={currentPath ?? ""}>
            <button
              type="button"
              className={button({ size: "sm", className: "leading-none text-fg" })}
              data-testid="dir-browser-up"
              disabled={!parent}
              onClick={goUp}
              title="Go up one level"
            >
              ↑
            </button>
            <span className="min-w-0 flex-1 overflow-hidden text-[0.72rem] text-ellipsis whitespace-nowrap text-subtext-0">
              {isAbsolute ? "/" : ""}
              {segments.map((seg, i) => {
                const segPath = "/" + segments.slice(0, i + 1).join("/");
                const isLast = i === segments.length - 1;
                return (
                  <span key={segPath}>
                    <button
                      type="button"
                      className="cursor-pointer bg-transparent p-0 text-[0.72rem] text-subtext-0 [font-family:inherit] [border:none] [&:hover:not(:disabled)]:text-accent disabled:cursor-default disabled:text-fg"
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
            className="mx-2 my-[0.2rem] shrink-0 rounded-ui bg-surface-1 px-2 py-[0.3rem] text-[0.78rem] text-fg [font-family:inherit] focus:[outline:1px_solid_var(--accent)]"
            data-testid="dir-browser-filter"
            placeholder="Filter…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={handleFilterKeyDown}
          />

          <div className="max-h-[260px] min-h-[60px] flex-1 overflow-y-auto py-[0.1rem]">
            {loading ? (
              <div className={EMPTY}>Loading…</div>
            ) : filteredEntries.length === 0 ? (
              <div className={EMPTY}>No subfolders</div>
            ) : (
              filteredEntries.map((entry) => (
                <button
                  type="button"
                  key={entry.path}
                  className="flex w-full cursor-pointer items-center justify-between bg-transparent px-3 py-[0.32rem] text-left text-[0.8rem] text-fg [font-family:inherit] [border:none] hover:bg-surface-1"
                  data-testid={`dir-browser-entry-${entry.name}`}
                  onClick={() => descend(entry)}
                  title={entry.path}
                >
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">{entry.name}</span>
                  {entry.isGitRepo && (
                    <span className="ml-[0.4rem] shrink-0 rounded-ui bg-surface-1 px-[0.3rem] py-0 text-[0.62rem] text-accent" title="Git repository">
                      git
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="flex shrink-0 justify-end px-2 py-[0.4rem]">
            <button
              type="button"
              className={useButton()}
              data-testid="dir-browser-use"
              disabled={!currentPath}
              onClick={confirmCurrent}
              title={folderKeys ? `Use this folder (${folderKeys})` : "Use this folder"}
            >
              Use this folder
            </button>
          </div>
        </>
      ) : (
        <div className="flex shrink-0 items-center gap-[0.35rem] px-2 py-[0.4rem]">
          <input
            type="text"
            className="min-w-0 flex-1 rounded-ui bg-surface-1 px-2 py-[0.3rem] text-[0.78rem] text-fg [font-family:inherit] focus:[outline:1px_solid_var(--accent)]"
            data-testid="project-path-input"
            placeholder="/path/to/project"
            value={typedPath}
            onChange={(e) => setTypedPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.nativeEvent.isComposing && typedPath.trim()) onUseFolder(typedPath.trim());
            }}
          />
          <button
            type="button"
            className={useButton()}
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
