/** User-initiated file drops for agent and ordinary shell terminals.
 * Remote transfers require an explicit Option/Alt-drop onto a configured host.
 * Paste paths through xterm's normal input/lease handling, without Enter. */
import { uploadAttachment } from "./attachments";
import { usePerchStore } from "./store";

export type FileDropNotice = { message: string; error?: boolean } | null;

/** Literal POSIX shell word, including expansion characters inside double quotes. */
export function quoteDroppedPath(path: string, doubleQuotes: boolean): string {
  if (/[\x00-\x1f\x7f]/.test(path)) throw new Error("Upload returned an unsafe path");
  if (!doubleQuotes) return `'${path.replace(/'/g, "'\\''")}'`;
  // A single-quoted segment also prevents interactive bash/zsh history expansion.
  return `"${path.replace(/[\\"$`]/g, "\\$&").replace(/!/g, `"'!'"`)}"`;
}

type DropTarget = { terminalId: string; hostId: string; sshHost?: string };

export function attachAgentFileDrop(
  element: HTMLElement,
  sessionId: string,
  getTerminalId: () => string | null,
  paste: (text: string) => void,
  report: (notice: FileDropNotice) => void,
): () => void {
  let active = true;
  let uploading = false;
  const getTarget = (): DropTarget | null => {
    const state = usePerchStore.getState();
    const session = state.sessions.find((entry) => entry.id === sessionId);
    const terminalId = getTerminalId();
    if (!active || !state.connected || !session || !terminalId) return null;
    const hostId = session.hostId ?? "local";
    if (hostId !== "local") {
      const host = state.hosts.find((entry) => entry.id === hostId);
      if (!state.serverInfo?.capabilities?.includes("upload.scp.v1") || !host?.enabled || host.directUrl || !host.sshHost) return null;
      return { terminalId, hostId, sshHost: host.sshHost };
    }
    return { terminalId, hostId };
  };
  const matches = (target: DropTarget) => {
    const current = getTarget();
    return current?.terminalId === target.terminalId && current.hostId === target.hostId && current.sshHost === target.sshHost;
  };
  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
  const handleDragOver = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const target = getTarget();
    if (event.dataTransfer) event.dataTransfer.dropEffect = !uploading && target && (target.hostId === "local" || event.altKey) ? "copy" : "none";
  };
  const handleDrop = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (uploading) return;
    const target = getTarget();
    if (!target) {
      report({ message: "File drops require a connected, writable terminal. Remote drops also require a configured SSH host and an updated Perch server.", error: true });
      return;
    }
    if (target.hostId !== "local" && !event.altKey) {
      report({ message: "Hold Option (Mac) or Alt while dropping to upload via SCP to this terminal's remote host.", error: true });
      return;
    }
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (!files.length) {
      report({ message: "Drop files or images, not folders.", error: true });
      return;
    }
    uploading = true;
    const label = files.length === 1 ? "file" : `${files.length} files`;
    report({ message: `Uploading ${label}${target.hostId === "local" ? "" : " via SCP"}…` });
    void uploadFiles(files, target, usePerchStore.getState().settings?.droppedPathDoubleQuotes === true);
  };
  async function uploadFiles(files: File[], target: DropTarget, doubleQuotes: boolean) {
    const paths: string[] = [];
    const errors: string[] = [];
    try {
      for (const file of files) {
        if (!matches(target)) break;
        try {
          const { path } = target.hostId === "local"
            ? await uploadAttachment(sessionId, file)
            : await uploadAttachment(sessionId, file, target.hostId);
          paths.push(quoteDroppedPath(path, doubleQuotes));
        } catch (reason) {
          errors.push(`${file.name}: ${reason instanceof Error ? reason.message : String(reason)}`);
        }
      }
      if (!active) return;
      if (!matches(target)) {
        report({ message: "Terminal input changed during upload. No paths were inserted; drop again when the terminal is writable.", error: true });
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
