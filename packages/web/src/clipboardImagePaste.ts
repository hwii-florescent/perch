/**
 * clipboardImagePaste.ts — Wave 2 item 9: paste a clipboard image into a
 * terminal/CLI pane.
 *
 * Ported from herdr's clipboard-image-to-path paste trick (behavioral
 * reference: `reference/herdr/src/server/clipboard_image.rs` +
 * herdr's TUI paste handling), adapted to perch's browser+xterm terminals.
 * Most CLI coding agents accept a file path argument for image input, so
 * rather than trying to pipe raw bytes into a PTY, we stage the pasted image
 * to disk server-side (`POST {base}clipboard-image`, see server.rs) and type
 * the resulting path into the PTY as literal (shell-quoted) text.
 *
 * v1 scope: local host only. There is no HTTP route from the browser to a
 * *remote* (federated) perch instance's filesystem — only its WS traffic is
 * tunneled through the hub — so this is a documented no-op (with a console
 * warning) when the active session is on a federated host.
 */
import { getClipboardImageUploadUrl } from "./base";
import { usePerchStore } from "./store";

/** Attach a `paste` listener to `element` (a terminal's container div) that
 * detects an image on the clipboard, uploads it, and writes the staged path
 * into `terminalId`'s PTY. `getTerminalId` is read lazily on each paste
 * (rather than captured once) so callers can pass a ref that's still `null`
 * at attach time and gets filled in once the backing PTY finishes creating.
 * Returns a cleanup function. */
export function attachClipboardImagePaste(
  element: HTMLElement,
  getTerminalId: () => string | null,
): () => void {
  function handlePaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;
    const imageItem = Array.from(items).find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;

    const terminalId = getTerminalId();
    if (!terminalId) return;

    const hostId = usePerchStore.getState().activeHostId;
    if (hostId !== "local") {
      // Federated/remote-host paste is out of scope for v1 (see module doc).
      console.warn("perch: clipboard image paste is only supported on the local host");
      return;
    }

    const file = imageItem.getAsFile();
    if (!file) return;

    // We're handling this paste ourselves (uploading + typing a path); don't
    // let the browser also insert raw image data/text into the terminal.
    event.preventDefault();

    const ext = (file.type.split("/")[1] || "png").toLowerCase();
    void uploadAndInsertPath(file, ext, getTerminalId);
  }

  element.addEventListener("paste", handlePaste);
  return () => element.removeEventListener("paste", handlePaste);
}

async function uploadAndInsertPath(
  file: File,
  ext: string,
  getTerminalId: () => string | null,
): Promise<void> {
  try {
    const body = await file.arrayBuffer();
    const res = await fetch(getClipboardImageUploadUrl(ext), {
      method: "POST",
      headers: { "Content-Type": file.type || "image/png" },
      body,
    });
    if (!res.ok) {
      throw new Error(`upload failed with status ${res.status}`);
    }
    const data = (await res.json()) as { path?: string };
    const terminalId = getTerminalId();
    if (terminalId && data.path) {
      usePerchStore.getState().sendTerminalInput(terminalId, quoteForShell(data.path));
    }
  } catch (err) {
    console.error("perch: clipboard image paste failed", err);
  }
}

/** Single-quote a path for literal insertion into a POSIX shell, escaping any
 * embedded single quotes (`'` -> `'\''`). Staged paths are uuid-named under
 * `~/.perch/clipboard-images/`, so this is defense-in-depth rather than a
 * load-bearing escape — but it costs nothing to do properly. */
function quoteForShell(path: string): string {
  return `'${path.replace(/'/g, `'\\''`)}'`;
}
