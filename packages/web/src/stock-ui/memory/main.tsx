//! Memory, the stock screen `stock:memory`: a Project's memory files (notes agents write for each other and for
//! you): list, open, edit, create, delete. Opened from the sidebar's project menu and by a package's `MemoryDialog`
//! from `@perch/sdk`; or the person's package chosen for it (`perch mod use stock:memory <id>`), with the same props.
//!
//! The core owns names, caps and revisions (`list`, `get`, `save`, `remove`): every write names the revision it was
//! based on and a stale one is refused, so a draft that lost the race stays here until the person reloads or
//! abandons it. Deleting asks first. The shell and the question are `Dialog` and `ConfirmDialog` from `@perch/sdk`,
//! so copies chosen for `stock:dialog` and `stock:confirm` draw them here too.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:memory` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files beside it
//! (docs/MOD-SDK.md).
import { useEffect, useState } from "react";
import { buttonClass as button, ConfirmDialog, Dialog, type MemoryEntry, type MemoryScreenProps, type MemoryState } from "@perch/sdk";

/** How long ago `at` was: `now`, `5m ago`, `3h ago`, `2d ago`. */
function ago(at: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - at) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

const FIELD = "w-full min-w-0 rounded-ui bg-surface-0 px-[0.5rem] py-[0.4rem] text-fg focus:[outline:1px_solid_var(--accent)] [font-family:inherit]";
const NO_ANSWER = "No answer from Perch. Try again.";

/** The file being edited. `base` is the revision it was opened at; absent for a new file. */
interface Draft { name: string; base?: string; text: string }

const byWho = (entry: MemoryEntry) => (entry.author.kind === "outside" ? "edited outside Perch" : entry.author.label);

export default function Memory({ projectId, name, onClose, list, get, save: store, remove: erase, setEnabled }: MemoryScreenProps) {
  const [index, setIndex] = useState<Pick<MemoryState, "files" | "maxFiles" | "maxChars">>({ files: [], maxFiles: 64, maxChars: 16000 });
  const [off, setOff] = useState(false);
  const [loaded, setLoaded] = useState<"loading" | "ready" | "unavailable">("loading");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<MemoryEntry | null>(null);

  const take = (state: MemoryState) => {
    setIndex({ files: state.files, maxFiles: state.maxFiles, maxChars: state.maxChars });
    setOff(!!state.off);
  };

  useEffect(() => {
    let current = true;
    void list().then((state) => {
      if (!current) return;
      if (!state || state.error) {
        setLoaded("unavailable");
        setError(state?.error ?? "This computer's Perch cannot keep Project memory.");
        return;
      }
      take(state);
      setLoaded("ready");
    });
    return () => { current = false; };
  }, [projectId]);

  async function open(file: string) {
    setBusy(true);
    setError(null);
    const answer = await get(file);
    setBusy(false);
    if (!answer) setError(NO_ANSWER);
    else if (!answer.file) setError(answer.error ?? "That file is gone.");
    else {
      setConflict(false);
      setDraft({ name: file, base: answer.file.entry.revision, text: answer.file.text });
    }
  }

  async function save() {
    if (!draft) return;
    const file = draft.base ? draft.name : /\.md$/.test(draft.name) ? draft.name : `${draft.name}.md`;
    setBusy(true);
    setError(null);
    const state = await store(file, draft.text, draft.base);
    setBusy(false);
    if (!state) return setError(NO_ANSWER);
    take(state);
    if (state.conflict) setConflict(true);
    else if (state.error) setError(state.error);
    else setDraft(null);
  }

  async function toggle() {
    if (!setEnabled) return;
    setBusy(true);
    setError(null);
    const state = await setEnabled(off);
    setBusy(false);
    if (!state) return setError(NO_ANSWER);
    take(state);
    if (state.error) setError(state.error);
  }

  /** Take the other version; the draft is replaced only when this is chosen. */
  async function reload() {
    if (!draft) return;
    await open(draft.name);
  }

  async function remove(entry: MemoryEntry) {
    setDeleting(null);
    setBusy(true);
    setError(null);
    const state = await erase(entry.name, entry.revision);
    setBusy(false);
    if (!state) return setError(NO_ANSWER);
    take(state);
    if (state.conflict) setError(`${entry.name} was changed by someone else, so it was not deleted. Open it to see the new version.`);
    else if (state.error) setError(state.error);
  }

  const { files, maxFiles, maxChars } = index;
  const now = Date.now();
  return (
    <>
      <Dialog title={`Memory for ${name}`} onClose={onClose} testId="memory-dialog">
        <p className="m-0 text-[0.75rem] text-subtext-0">
          Agents in this project write notes here for each other and for you. It is information, not instructions: nothing here is added to a session's prompt, and agents read it only when they choose to.
        </p>
        {draft ? (
          <>
            {draft.base ? (
              <span className="font-mono text-[0.8rem] text-fg" data-testid="memory-file-name">{draft.name}</span>
            ) : (
              <input
                className={`${FIELD} font-mono`}
                placeholder="name.md"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                aria-label="File name"
                data-testid="memory-name"
              />
            )}
            <label className="grid gap-[0.16rem] text-[0.7rem] text-subtext-0">
              <span>Text <span data-testid="memory-count">{draft.text.length} / {maxChars}</span></span>
              <textarea
                className={`${FIELD} font-mono`}
                rows={12}
                value={draft.text}
                onChange={(event) => setDraft({ ...draft, text: event.target.value })}
                data-testid="memory-text"
              />
            </label>
            {conflict && (
              <div className="grid gap-[0.3rem] text-[0.7rem] text-red" role="alert" data-testid="memory-conflict">
                <span>Someone else changed this file after you opened it. Your edit is kept below and was not saved.</span>
                <span><button type="button" className={button({ size: "sm" })} disabled={busy} onClick={() => void reload()} data-testid="memory-reload">Load their version</button> replaces your edit.</span>
              </div>
            )}
            {error && <span className="text-[0.7rem] text-red" role="alert" data-testid="memory-error">{error}</span>}
            <div className="flex justify-end gap-2">
              <button type="button" className={button({ size: "sm" })} onClick={() => { setDraft(null); setConflict(false); setError(null); }} data-testid="memory-back">Back</button>
              <button
                type="button"
                className={button({ size: "sm", variant: "primary" })}
                disabled={busy || conflict || !draft.name.trim() || draft.text.length > maxChars}
                onClick={() => void save()}
                data-testid="memory-save"
              >
                Save
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-baseline justify-between text-[0.7rem] text-subtext-0">
              <span data-testid="memory-caps">{files.length} / {maxFiles} files, up to {maxChars} characters each</span>
              <button
                type="button"
                className={button({ size: "sm" })}
                disabled={loaded !== "ready" || busy || files.length >= maxFiles}
                onClick={() => { setError(null); setDraft({ name: "", text: "" }); }}
                data-testid="memory-new"
              >
                New file
              </button>
            </div>
            {setEnabled && loaded === "ready" && (
              <label className="flex items-center gap-2 text-[0.75rem] text-subtext-0">
                <input type="checkbox" checked={!off} disabled={busy} onChange={() => void toggle()} data-testid="memory-enabled" />
                <span>Agents in this project use memory{off ? " (off: they are refused; the files stay and you can still edit them)" : ""}</span>
              </label>
            )}
            {loaded === "loading" && <span className="text-[0.75rem] text-subtext-0">Loading…</span>}
            {loaded === "ready" && files.length === 0 && <span className="text-[0.75rem] text-subtext-0" data-testid="memory-empty">No memory files yet.</span>}
            <ul className="m-0 grid list-none gap-[0.3rem] p-0">
              {files.map((entry) => (
                <li key={entry.name} className="flex items-start gap-2" data-testid={`memory-row-${entry.name}`}>
                  <button type="button" className="grid min-w-0 flex-1 gap-[0.1rem] rounded-ui bg-surface-0 px-[0.5rem] py-[0.35rem] text-left" disabled={busy} onClick={() => void open(entry.name)} data-testid={`memory-open-${entry.name}`}>
                    <span className="font-mono text-[0.8rem] text-fg">{entry.name}</span>
                    {entry.summary && <span className="truncate text-[0.75rem] text-subtext-0">{entry.summary}</span>}
                    <span className="text-[0.68rem] text-overlay-1">{byWho(entry)} · {ago(entry.updatedAt, now)} · {entry.size} chars</span>
                  </button>
                  <button type="button" className={button({ size: "sm" })} disabled={busy} onClick={() => setDeleting(entry)} data-testid={`memory-delete-${entry.name}`}>Delete</button>
                </li>
              ))}
            </ul>
            {error && <span className="text-[0.7rem] text-red" role="alert" data-testid="memory-error">{error}</span>}
            <div className="flex justify-end">
              <button type="button" className={button({ size: "sm" })} onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </Dialog>
      {deleting && (
        <ConfirmDialog
          message={`Delete ${deleting.name}? Agents and people lose this note.`}
          onConfirm={() => void remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
