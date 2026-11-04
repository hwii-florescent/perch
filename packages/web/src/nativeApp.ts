/**
 * The Perch iPhone app's bridge (`ios/Perch/DesktopView.swift`), present only
 * when this page runs inside it. Paste reads the system clipboard natively,
 * which a plain-http page (Wi-Fi, Tailscale) cannot do with
 * `navigator.clipboard`; disconnect returns the app to its Connect screen.
 */
type Bridge = { postMessage(message: string): Promise<unknown> };

function bridge(): Bridge | undefined {
  return (window as { webkit?: { messageHandlers?: { perchApp?: Bridge } } }).webkit?.messageHandlers?.perchApp;
}

export const inNativeApp = () => bridge() !== undefined;

/** The clipboard's text, from the app when there is one, else the browser (secure pages only). */
export async function readClipboardText(): Promise<string> {
  const app = bridge();
  if (app) return String((await app.postMessage("paste")) ?? "");
  return (await navigator.clipboard?.readText()) ?? "";
}

export function disconnectNativeApp(): void {
  void bridge()?.postMessage("disconnect");
}
