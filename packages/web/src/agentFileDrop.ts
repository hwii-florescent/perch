/** User-initiated file drops for CLI agents, never ordinary shell panes.
 * Reuse the bounded local upload endpoint; remote paths cannot be staged here.
 * Paste paths through xterm's normal input/lease handling, without Enter. */
import { uploadAttachment } from "./attachments";
import { usePerchStore } from "./store";

export type FileDropNotice = { message: string; error?: boolean } | null;

export function attachAgentFileDrop(
  element: HTMLElement,
  sessionId: string,
  getTerminalId: () => string | null,
  paste: (text: string) => void,
  report: (notice: FileDropNotice) => void,
): () => void {
  let active = true;
  let uploading = false;
  const target = () => {
    const state = usePerchStore.getState();
    const session = state.sessions.find((entry) => entry.id === sessionId);
    return active && state.connected && session && (session.hostId ?? "local") === "local"
      ? getTerminalId() : null;
  };
  const isFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
  const dragover = (event: DragEvent) => {
    if (!isFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = !uploading && target() ? "copy" : "none";
  };
  const drop = (event: DragEvent) => {
    if (!isFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (uploading) return;
    const terminalId = target();
    if (!terminalId) {
      report({ message: "File drops require a connected, writable agent on the local host.", error: true });
      return;
    }
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (!files.length) {
      report({ message: "Drop files or images, not folders.", error: true });
      return;
    }
    uploading = true;
    report({ message: `Uploading ${files.length === 1 ? "file" : `${files.length} files`}…` });
    void stage(files, terminalId);
  };
  async function stage(files: File[], terminalId: string) {
    const paths: string[] = [];
    const errors: string[] = [];
    try {
      for (const file of files) {
        if (target() !== terminalId) break;
        try {
          const { path } = await uploadAttachment(sessionId, file);
          if (/[\x00-\x1f\x7f]/.test(path)) throw new Error("Upload returned an unsafe path");
          paths.push(`'${path.replace(/'/g, "'\\''")}'`);
        } catch (reason) {
          errors.push(`${file.name}: ${reason instanceof Error ? reason.message : String(reason)}`);
        }
      }
      if (!active) return;
      if (target() !== terminalId) {
        report({ message: "Agent input changed during upload. No paths were inserted; drop again when the agent is writable.", error: true });
        return;
      }
      // One native paste preserves drop order and bracketed-paste behavior.
      // A trailing space separates the paths from whatever the user types next.
      if (paths.length) paste(`${paths.join(" ")} `);
      report(errors.length ? { message: errors.join("; "), error: true } : null);
    } finally { uploading = false; }
  }
  element.addEventListener("dragover", dragover);
  element.addEventListener("drop", drop);
  return () => {
    active = false;
    element.removeEventListener("dragover", dragover);
    element.removeEventListener("drop", drop);
  };
}
