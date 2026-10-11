/**
 * theme.spec.ts — Phase 1 (herdr-parity) e2e tests for the theme system.
 *
 * T1 "default theme is perch on first load":
 *   Fresh session, no theme override in the settings file — assert
 *   `getComputedStyle(document.documentElement).getPropertyValue("--accent")`
 *   matches the default theme's accent (perch, #c8c8c8).
 *
 * T2 "switching theme in Settings persists across reload":
 *   Open Settings, click the "dracula" theme option, assert the ✓ marker and
 *   the live `--accent` token update; reload; reopen Settings and assert the
 *   ✓ marker (and token) survived the round-trip via ~/.perch/settings.json.
 *
 * T3 "spot-check themes render without console errors":
 *   For catppuccin, dracula, one-light: select the theme, assert `--accent`
 *   matches that theme's value, and assert no new console errors appeared.
 *
 * Resets `theme` back to "perch" (the app's default — see
 * `default_theme()` in crates/perch-core/src/{protocol,settings}.rs and
 * `applyTheme("perch")` in store.ts) in the suite's settings file at start
 * and end so this spec — and any spec that runs after it — sees the app's
 * default look, matching settings.spec.ts's cleanup convention for other
 * fields.
 */

import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import { SETTINGS_FILE } from "./chatMode";
import { resolveTheme, THEME_NAMES } from "../packages/web/src/themes";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Match the public test handle declared by main.tsx; e2e files are checked
// separately from the web tsconfig, so that global isn't otherwise in scope.
declare global {
  interface Window {
    usePerchStore: typeof import("../packages/web/src/store").usePerchStore;
  }
}
const BASE_URL = "http://127.0.0.1:7799";

// Browser application/persistence checks use the resolved UI colors; unit
// tests separately protect source palette values and absolute contrast floors.
const ACCENT = Object.fromEntries(THEME_NAMES.map((name) => [name, resolveTheme(name).accent]));
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

/** Force `theme` back to "perch" (the app's default) in
 * the settings file, leaving every other field untouched. Safe to call
 * even if the file doesn't exist yet. */
function resetTheme(): void {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return;
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    data.theme = "perch";
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
  } catch {
    // Malformed file — leave it alone rather than destroy real settings.
  }
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/** Navigate to the app with a fresh session (localStorage cleared). */
async function freshSession(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("perch.sessionId")).forEach((k) => localStorage.removeItem(k)));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-testid="settings-gear"]')).toBeVisible({ timeout: 15000 });
}

/** Open the settings modal via the gear button and wait for it to appear. */
async function openSettings(page: Page): Promise<void> {
  await page.locator('[data-testid="settings-gear"]').click();
  await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible({ timeout: 8000 });
  await page.locator('[data-testid="settings-nav-appearance"]').click();
}

/** Close the settings modal by pressing Escape. */
async function closeSettingsEsc(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="settings-modal"]')).not.toBeVisible({ timeout: 5000 });
}

/** Read the live `--accent` custom property off `<html>`. */
async function getAccent(page: Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
  );
}

// ---------------------------------------------------------------------------
// Serial block
// ---------------------------------------------------------------------------

test.describe("Phase 1: theme system", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    resetTheme();
  });

  test.afterAll(() => {
    resetTheme();
  });

  // ---------------------------------------------------------------------------
  // T1 — default theme is "perch" on first load
  // ---------------------------------------------------------------------------
  test("T1. default theme is perch on first load", async ({ page }) => {
    await freshSession(page);

    const accent = await getAccent(page);
    expect(accent.toLowerCase()).toBe(ACCENT.perch);

    await page.screenshot({ path: "artifacts/T1-default-theme-perch.png" });
  });

  // ---------------------------------------------------------------------------
  // T2 — switching theme persists across reload
  // ---------------------------------------------------------------------------
  test("T2. switching theme persists across reload", async ({ page }) => {
    await freshSession(page);
    await openSettings(page);

    const modal = page.locator('[data-testid="settings-modal"]');
    const draculaOption = modal.locator('[data-testid="theme-option-dracula"]');
    await expect(draculaOption).toBeVisible({ timeout: 5000 });
    await draculaOption.click();

    // Live preview applies immediately.
    await expect
      .poll(async () => (await getAccent(page)).toLowerCase(), { timeout: 5000 })
      .toBe(ACCENT.dracula);

    // Checkmark moves to the newly-selected option.
    await expect(draculaOption).toHaveClass(/settings-modal__theme-option--active/);

    await page.screenshot({ path: "artifacts/T2-theme-dracula-selected.png" });

    // Close, reload, reopen — the persisted theme should survive.
    await closeSettingsEsc(page);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator(".sidebar")).toBeVisible({ timeout: 15000 });

    await expect
      .poll(async () => (await getAccent(page)).toLowerCase(), { timeout: 8000 })
      .toBe(ACCENT.dracula);

    await openSettings(page);
    const draculaOptionAfter = modal.locator('[data-testid="theme-option-dracula"]');
    await expect(draculaOptionAfter).toHaveClass(/settings-modal__theme-option--active/, {
      timeout: 5000,
    });

    await page.screenshot({ path: "artifacts/T2-theme-persisted-after-reload.png" });

    // Restore to perch (the app's default) for subsequent tests/specs.
    const perchOption = modal.locator('[data-testid="theme-option-perch"]');
    await perchOption.click();
    await expect
      .poll(async () => (await getAccent(page)).toLowerCase(), { timeout: 5000 })
      .toBe(ACCENT.perch);
    await closeSettingsEsc(page);
  });

  // ---------------------------------------------------------------------------
  // T3 — spot-check themes render without console errors
  // ---------------------------------------------------------------------------
  test("T3. spot-check themes render without console errors", async ({ page }) => {
    await freshSession(page);

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err)));

    await openSettings(page);
    const modal = page.locator('[data-testid="settings-modal"]');

    for (const name of ["catppuccin", "dracula", "one-light"] as const) {
      const option = modal.locator(`[data-testid="theme-option-${name}"]`);
      await expect(option).toBeVisible({ timeout: 5000 });
      await option.click();

      await expect
        .poll(async () => (await getAccent(page)).toLowerCase(), { timeout: 5000 })
        .toBe(ACCENT[name]);

      await page.screenshot({ path: `artifacts/T3-theme-${name}.png` });
    }

    expect(consoleErrors, `console errors while spot-checking themes: ${consoleErrors.join("; ")}`)
      .toHaveLength(0);

    // Restore to perch (the app's default) so this spec leaves no
    // visible side effect.
    const perchOption = modal.locator('[data-testid="theme-option-perch"]');
    await perchOption.click();
    await expect
      .poll(async () => (await getAccent(page)).toLowerCase(), { timeout: 5000 })
      .toBe(ACCENT.perch);
    await closeSettingsEsc(page);
  });

  for (const phone of [false, true]) {
    test(`T4. all themes keep harness badges and controls readable (${phone ? "phone" : "desktop"})`, async ({ page }) => {
      await freshSession(page);
      // Render-only fixture: no agent launches, model prompts, PTYs, or fake DB
      // rows. The public store test handle is also used by mixed-tabs.spec.ts.
      await page.evaluate(() => {
        const project = { id: "theme-project", hostId: "local", path: "/tmp/theme-preview", name: "Theme preview", favorite: false, createdAt: 1, updatedAt: 1 };
        const workspace = { id: "theme-workspace", projectId: project.id, hostId: "local", path: project.path, name: project.name, branch: "main", dirty: false, state: "active" as const, createdAt: 1, updatedAt: 1 };
        window.usePerchStore.setState({
          workspaceProjects: [project], workspaces: [workspace], activeWorkspaceId: workspace.id,
          activeProject: { hostId: "local", cwd: project.path }, sessionId: "theme-codex",
          sessions: ["codex", "pi", "claude", "omp", "terminal"].map((provider, i) => ({
            id: `theme-${provider}`, title: provider, cwd: project.path, hostId: "local", workspaceId: workspace.id,
            cliProviderId: provider, createdAt: i + 1, status: i === 1 ? "running" as const : "idle" as const,
            blocked: i === 2, unseen: i === 3,
          })),
        });
      });
      await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1280, height: 800 });
      try {
        for (const name of THEME_NAMES) {
          const p = resolveTheme(name);
          await openSettings(page);
          await page.getByTestId(`theme-option-${name}`).click();
          await expect.poll(() => page.evaluate(() => window.usePerchStore.getState().settings?.theme)).toBe(name);
          await expect.poll(() => getAccent(page)).toBe(p.accent);
          await expect(page.locator("html")).toHaveCSS("color-scheme", p.colorScheme);
          await closeSettingsEsc(page);

          if (phone) await page.getByTestId("mobile-switch").click();
          const area = phone ? page.getByTestId("mobile-switcher") : page.locator(".sidebar");
          const badge = area.locator('.agent-status-dot[data-provider="codex"]').first();
          await expect(badge).toBeVisible();
          await expect(badge).toHaveCSS("background-color", rgb(p.panelBg));
          await expect(badge.locator("svg")).toHaveCSS("fill", rgb(p.text));
          await expect(badge).toHaveCSS("border-top-color", rgb(p.green));
          for (const [provider, color] of [["pi", p.yellow], ["claude", p.red], ["omp", p.teal]] as const) {
            const mark = area.locator(`.agent-status-dot[data-provider="${provider}"]`).first();
            await expect(mark).toHaveCSS("border-top-color", rgb(color));
            const path = mark.locator("path").first();
            if (provider === "pi") {
              await expect(path).toHaveCSS("fill", rgb(p.text));
            } else {
              await expect(mark.locator("svg").locator("..")).toHaveCSS("background-color", rgb("#161616"));
              if (provider === "claude") await expect(path).toHaveCSS("fill", rgb("#d97757"));
              else await expect(path).toHaveAttribute("fill", /^url\(#[^)]+\)$/);
            }
          }

          if (!phone) {
            const selected = page.getByTestId("workspace-session-theme-codex");
            await expect(selected).toHaveAttribute("aria-current", "true");
            await expect(badge).toHaveCSS("outline-color", rgb(p.text));
            await expect(badge).toHaveCSS("outline-width", "1px");
            await selected.hover();
            await expect(badge).toHaveCSS("background-color", rgb(p.surface0));
            await expect(badge.locator("svg")).toHaveCSS("fill", rgb(p.text));
            const other = page.getByTestId("workspace-session-theme-pi");
            await page.keyboard.press("Tab"); // establish keyboard :focus-visible
            await other.focus();
            await expect(other.locator(".agent-status-dot")).toHaveCSS("outline-color", rgb(p.text));
            await expect(other.locator(".agent-status-dot")).toHaveCSS("outline-width", "1px");

            await page.getByTestId("workspace-project-menu-theme-project").click();
            const menuItem = page.getByRole("menu").locator(".pane-context-menu__item").first();
            await menuItem.hover();
            await expect(menuItem).toHaveCSS("background-color", rgb(p.surface0));
            await expect(menuItem).toHaveCSS("color", rgb(p.text));
            await page.screenshot({ path: `artifacts/T4-${name}-desktop.png` });
            await page.keyboard.press("Escape");
          } else {
            await area.screenshot({ path: `artifacts/T4-${name}-phone.png` });
            await page.getByTestId("mobile-switcher-close").click();
          }
        }
      } finally {
        await page.evaluate(() => window.usePerchStore.getState().updateSettings({ theme: "perch" }));
        await expect.poll(() => getAccent(page)).toBe(ACCENT.perch);
      }
    });
  }
});
