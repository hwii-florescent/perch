//! Instructions, the stock screen `stock:instructions`: the dialog that edits a Project's or Workspace's
//! Instructions, the shared text and reference files and folders every new session there starts with. Opened from the sidebar
//! (a project's or workspace's menu) and by a package's `InstructionsDialog` from `@perch/sdk`; or the person's
//! package chosen for it (`perch mod use stock:instructions <id>`), with the same props.
//!
//! The core checks and stores them (`load`, `save`); running sessions keep what they started with. The form's
//! layout, wording and the line-per-folder editing are this screen's. The shell is `Dialog` from `@perch/sdk`, so a
//! copy chosen for `stock:dialog` frames this one too.
//!
//! This file is the source of a package: `scripts/export-stock-ui.mjs` turns it into the plain JS the app runs and
//! `perch mod clone stock:instructions` copies. It may import only `react`, `react-dom`, `@perch/sdk` and files
//! beside it (docs/MOD-SDK.md).
import { useEffect, useState } from "react";
import { buttonClass as button, Dialog, type InstructionsScreenProps } from "@perch/sdk";

const folderLines = (folders: string[]) => folders.join("\n");
const parseFolderLines = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);

const FIELD = "w-full min-w-0 rounded-ui bg-surface-0 px-[0.5rem] py-[0.4rem] text-fg focus:[outline:1px_solid_var(--accent)] [font-family:inherit]";

export default function Instructions({ scope, id, name, onClose, load, save: store }: InstructionsScreenProps) {
  const [text, setText] = useState("");
  const [folders, setFolders] = useState("");
  const [maxChars, setMaxChars] = useState(16000);
  const [loaded, setLoaded] = useState<"loading" | "ready" | "unavailable">("loading");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void load().then((state) => {
      if (!current) return;
      if (!state || state.error) {
        setLoaded("unavailable");
        setError(state?.error ?? "This computer's Perch cannot store Instructions.");
        return;
      }
      setText(state.text);
      setFolders(folderLines(state.folders));
      setMaxChars(state.maxChars);
      setLoaded("ready");
    });
    return () => { current = false; };
  }, [scope, id]);

  async function save() {
    setSaving(true);
    setError(null);
    const state = await store(text, parseFolderLines(folders));
    setSaving(false);
    if (!state) setError("No answer from Perch. Try again.");
    else if (state.error) setError(state.error);
    else onClose();
  }

  const label = scope === "project" ? "project" : "workspace";
  return (
    <Dialog title={`Instructions for ${name}`} onClose={onClose} testId="instructions-dialog">
      <p className="m-0 text-[0.75rem] text-subtext-0">
        New sessions in this {label} start with these. Running sessions keep what they started with. The repository's own AGENTS.md and CLAUDE.md still load.
      </p>
      <label className="grid gap-[0.16rem] text-[0.7rem] text-subtext-0">
        <span>Instructions <span data-testid="instructions-count">{text.length} / {maxChars}</span></span>
        <textarea
          className={FIELD}
          rows={9}
          value={text}
          disabled={loaded !== "ready"}
          onChange={(event) => setText(event.target.value)}
          data-testid="instructions-text"
        />
      </label>
      <label className="grid gap-[0.16rem] text-[0.7rem] text-subtext-0">
        <span>Reference files and folders <em className="text-overlay-1 not-italic">one absolute path per line</em></span>
        <textarea
          className={`${FIELD} font-mono`}
          rows={4}
          value={folders}
          disabled={loaded !== "ready"}
          onChange={(event) => setFolders(event.target.value)}
          data-testid="instructions-folders"
        />
      </label>
      {error && <span className="text-[0.7rem] text-red" role="alert" data-testid="instructions-error">{error}</span>}
      <div className="flex justify-end gap-2">
        <button type="button" className={button({ size: "sm" })} onClick={onClose}>Cancel</button>
        <button type="button" className={button({ size: "sm", variant: "primary" })} disabled={loaded !== "ready" || saving || text.length > maxChars} onClick={() => void save()} data-testid="instructions-save">
          Save
        </button>
      </div>
    </Dialog>
  );
}
