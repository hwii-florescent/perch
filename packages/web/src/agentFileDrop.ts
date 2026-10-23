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
  const getWritableTerminalId = () => {
    const state = usePerchStore.getState();
    const session = state.sessions.find((entry) => entry.id === sessionId);
    if (!active || !state.connected || !session || (session.hostId ?? "local") !== "local") return null;
    return getTerminalId();
  };
  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
  const handleDragOver = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = !uploading && getWritableTerminalId() ? "copy" : "none";
  };
  const handleDrop = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (uploading) return;
    const terminalId = getWritableTerminalId();
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
    const label = files.length === 1 ? "file" : `${files.length} files`;
    report({ message: `Uploading ${label}…` });
    void uploadFiles(files, terminalId);
  };
  async function uploadFiles(files: File[], terminalId: string) {
    const paths: string[] = [];
    const errors: string[] = [];
    try {
      for (const file of files) {
        if (getWritableTerminalId() !== terminalId) break;
        try {
          const { path } = await uploadAttachment(sessionId, file);
          if (/[\x00-\x1f\x7f]/.test(path)) throw new Error("Upload returned an unsafe path");
          paths.push(`'${path.replace(/'/g, "'\\''")}'`);
        } catch (reason) {
          errors.push(`${file.name}: ${reason instanceof Error ? reason.message : String(reason)}`);
        }
      }
      if (!active) return;
      if (getWritableTerminalId() !== terminalId) {
        report({ message: "Agent input changed during upload. No paths were inserted; drop again when the agent is writable.", error: true });
        return;
      }
      // One native paste preserves drop order and bracketed-paste behavior.
      // A trailing space separates the paths from whatever the user types next.
      if (paths.length) paste(`${paths.join(" ")} `);
      report(errors.length ? { message: errors.join("; "), error: true } : null);
    } finally { uploading = false; }
  }
  element.addEventListener("dragover", handleDragOver);
  element.addEventListener("drop", handleDrop);
  return () => {
    active = false;
    element.removeEventListener("dragover", handleDragOver);
    element.removeEventListener("drop", handleDrop);
  };
}
