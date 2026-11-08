import { useEffect, useState } from "react";
import { folderLines, loadInstructions, parseFolderLines, saveInstructions, type InstructionsScope } from "../instructions";
import { button } from "./ui/button";
import { Dialog } from "./ui/dialog";

const FIELD = "w-full min-w-0 rounded-ui bg-surface-0 px-[0.5rem] py-[0.4rem] text-fg focus:[outline:1px_solid_var(--accent)] [font-family:inherit]";

/** Edit the Instructions of a Project or Workspace: shared text and reference folders that every new
 * session there starts with. The core checks and stores them; running sessions keep what they
 * started with. */
export function InstructionsDialog({ scope, id, name, onClose }: { scope: InstructionsScope; id: string; name: string; onClose: () => void }) {
  const [text, setText] = useState("");
  const [folders, setFolders] = useState("");
  const [maxChars, setMaxChars] = useState(16000);
  const [loaded, setLoaded] = useState<"loading" | "ready" | "unavailable">("loading");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void loadInstructions(scope, id).then((state) => {
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
    const state = await saveInstructions(scope, id, text, parseFolderLines(folders));
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
        <span>Reference folders <em className="text-overlay-1 not-italic">one absolute path per line</em></span>
        <textarea
          className={`${FIELD} font-mono`}
          rows={3}
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
