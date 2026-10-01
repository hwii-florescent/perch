/**
 * Shared Hosted/CLI chat-mode handling for the suite.
 *
 * Chat mode is a single global setting. The suite runs against an isolated
 * settings file (`PERCH_SETTINGS`, default "cli"), so specs that need Hosted
 * chrome (`model-chip`, `.chat__input textarea`) must switch to it explicitly
 * and put it back.
 *
 * So: remember what the user had, set what the spec needs through the real UI
 * (which also updates the running server, unlike a file write), and put the
 * original back.
 */
import { expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const SETTINGS_FILE = process.env.PERCH_SETTINGS ?? path.join(os.homedir(), ".perch", "settings.json");

export type ChatMode = "hosted" | "cli";

/** Captured once per process, before any spec has flipped anything. */
let original: ChatMode | undefined;

function readChatMode(): ChatMode | undefined {
  try {
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) as Record<string, unknown>;
    return data.chatMode === "cli" || data.chatMode === "hosted" ? data.chatMode : undefined;
  } catch {
    return undefined;
  }
}

/** Remember the user's chat mode so `restoreChatMode` can put it back. */
export function rememberChatMode(): void {
  if (original === undefined) original = readChatMode() ?? "cli";
}

/**
 * Put the user's own chat mode back. Writes the file rather than driving the
 * UI because it runs from `afterAll`, where there is no page; the long-lived
 * e2e server keeps its in-memory value for the rest of the run, which is what
 * the remaining specs expect anyway.
 */
export function restoreChatMode(): void {
  if (original === undefined) return;
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return;
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) as Record<string, unknown>;
    data.chatMode = original;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
  } catch {
    // Malformed file — leave it alone rather than destroy real settings.
  }
}

/** Open Settings, flip the global Chat Mode toggle to `mode` (no-op if it is
 * already there), and close the modal. */
export async function setChatMode(page: Page, mode: ChatMode): Promise<void> {
  rememberChatMode();
  await page.locator('[data-testid="settings-gear"]').click();
  const modal = page.locator('[data-testid="settings-modal"]');
  await expect(modal).toBeVisible({ timeout: 8000 });
  const toggle = page.locator('[data-testid="settings-chat-mode"]');
  await expect(toggle).toBeVisible({ timeout: 5000 });
  const wantChecked = mode === "cli" ? "true" : "false";
  if ((await toggle.getAttribute("aria-checked")) !== wantChecked) {
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", wantChecked, { timeout: 3000 });
  }
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible({ timeout: 5000 });
}

/**
 * For specs that need the Hosted composer. Call it after the first navigation;
 * it is a no-op when the app is already in Hosted mode, and it restores the
 * user's own preference through `restoreChatMode` in the spec's `afterAll`.
 */
export async function useHostedMode(page: Page): Promise<void> {
  await setChatMode(page, "hosted");
}
