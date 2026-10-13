/** The file editor is CodeMirror: its DOM holds only the visible lines, so a spec reads the whole
 * document through the hook `CodeEditor.tsx` installs when `navigator.webdriver` is set. */
import { expect, type Locator } from "@playwright/test";

/** CodeMirror's `Mod`: Cmd on a Mac, Ctrl elsewhere (the browser reports the host's platform). */
export const MOD = process.platform === "darwin" ? "Meta" : "Control";

export const docOf = (editor: Locator): Promise<string> =>
  editor.evaluate((element) => (element as HTMLElement & { __doc: () => string }).__doc());

/** `expect(editor).toHaveValue(text)` for the CodeMirror editor: waits for the document to equal `text`. */
export async function expectDoc(editor: Locator, text: string, options: { timeout?: number } = {}): Promise<void> {
  await expect.poll(() => docOf(editor), { timeout: options.timeout ?? 5000 }).toBe(text);
}
