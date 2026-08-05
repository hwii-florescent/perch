/**
 * cli-rendering.spec.ts — does a CLI-mode pane render the agent TUI the way a
 * real terminal does?
 *
 * This spec exists because the previous verification pass was wrong in a way
 * worth recording: it ran only in headless **Chromium** and passed, while the
 * shipped desktop app renders in **WebKit** (WKWebView) and was visibly
 * broken. Font matching, glyph fallback and sub-pixel cell metrics all differ
 * between the two engines, so a terminal emulator — which is entirely a
 * question of "does a character land in exactly one cell" — has to be checked
 * in the engine the user actually runs.
 *
 * It therefore runs under **both** projects (see `cli-rendering.config.ts`)
 * and writes screenshots to `screenshots-cli-rendering/<engine>/`. Those are
 * **committed on purpose** (unlike `artifacts/`, which the main config wipes
 * every run): rendering is the one thing an assertion can only partly
 * describe, so the images are kept to be looked at.
 *
 * The assertions target the specific failures that were seen by hand:
 *  - U+FFFD anywhere means the pty byte path corrupted a multi-byte glyph.
 *  - Rows must not collide: the composer's rule and the text the user typed
 *    have to land on different lines. Measured structurally (see
 *    `rowGeometry`) rather than by reading text, because the visible symptom
 *    was overlap, not wrong characters.
 *  - Every row box must be exactly the same height and evenly spaced; an
 *    uneven step is what makes glyphs bleed into the neighbouring line.
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const SHOTS = path.join(__dirname, "screenshots-cli-rendering");

// Chat mode is global and lives in the developer's real ~/.perch/settings.json
// (it is NOT isolated by --db-path/--hosts-path), so this spec has to set it
// to "cli" and put back whatever was there — including on failure — or every
// later spec, and the developer's own app, is left in the wrong mode.
const SETTINGS_FILE = path.join(os.homedir(), ".perch", "settings.json");
let savedChatMode: unknown;

function setChatMode(mode: string | undefined): void {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return;
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) as Record<string, unknown>;
    if (mode === undefined) delete data.chatMode;
    else data.chatMode = mode;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
  } catch {
    /* leave alone */
  }
}

function shotDir(engine: string): string {
  const dir = path.join(SHOTS, engine);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Structural facts about the rendered grid — the things that must hold for
 * the emulator to be correct, independent of what the CLI happens to print. */
async function rowGeometry(page: Page) {
  return page.evaluate(() => {
    const rows = Array.from(
      document.querySelectorAll(".xterm-rows > div"),
    ) as HTMLElement[];
    const boxes = rows.map((r) => r.getBoundingClientRect());
    const heights = boxes.map((b) => Math.round(b.height * 100) / 100);
    // Vertical distance between consecutive row origins. Any variation here
    // means rows are not on a uniform baseline grid, which is exactly how a
    // glyph ends up drawn over its neighbour.
    const steps: number[] = [];
    for (let i = 1; i < boxes.length; i++) {
      steps.push(Math.round((boxes[i].top - boxes[i - 1].top) * 100) / 100);
    }
    const rowsEl = document.querySelector(".xterm-rows") as HTMLElement | null;
    const text = rows.map((r) => r.textContent ?? "");

    // Does the requested font *actually* match, or is the browser silently
    // falling back? Computed style only echoes what was asked for, so compare
    // the advance width against an explicit fallback: a real match measures
    // differently from Menlo. Also check the Nerd Font private-use range the
    // agent CLIs decorate with — those are the glyphs that showed up as "?".
    const size = rowsEl ? getComputedStyle(rowsEl).fontSize : "13px";
    const measure = (family: string, sample: string) => {
      const el = document.createElement("span");
      el.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font-size:${size};font-family:${family}`;
      el.textContent = sample;
      document.body.appendChild(el);
      const w = el.getBoundingClientRect().width;
      el.remove();
      return Math.round(w * 100) / 100;
    };
    const ascii = "W".repeat(50);
    const pua = ""; // powerline + nerd-font icons

    return {
      dpr: window.devicePixelRatio,
      fontMatches:
        typeof document.fonts?.check === "function"
          ? document.fonts.check(`${size} "MesloLGS NF"`)
          : null,
      asciiWidthProfile: measure('"MesloLGS NF", monospace', ascii),
      asciiWidthMenlo: measure("Menlo, monospace", ascii),
      puaWidthProfile: measure('"MesloLGS NF", monospace', pua),
      puaWidthAscii3: measure('"MesloLGS NF", monospace', "WWW"),
      rowCount: rows.length,
      uniqueHeights: Array.from(new Set(heights)),
      uniqueSteps: Array.from(new Set(steps)),
      // A row taller than its own step overlaps the row beneath it.
      maxHeight: Math.max(...heights, 0),
      minStep: steps.length ? Math.min(...steps) : 0,
      fontFamily: rowsEl ? getComputedStyle(rowsEl).fontFamily : null,
      fontSize: rowsEl ? parseFloat(getComputedStyle(rowsEl).fontSize) : null,
      widestRow: text.reduce((m, t) => Math.max(m, t.length), 0),
      replacementChars: text.join("").split("�").length - 1,
      text,
    };
  });
}

/** Start a CLI session in $HOME and wait for the agent to paint its banner. */
async function openCliSession(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("perch.sessionId");
    localStorage.setItem("perch.onboarding.seen", "1");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".sidebar")).toBeVisible({ timeout: 20000 });

  await expect(page.locator('[data-testid="cli-start-panel"]')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-testid="cli-start-browse"]').click();
  const useFolder = page.locator('button:has-text("Use this folder")');
  await expect(useFolder).toBeVisible({ timeout: 15000 });
  await useFolder.click();

  const surface = page.locator(".terminal__surface");
  await expect(surface).toBeVisible({ timeout: 25000 });
  await expect(async () => {
    const t = await surface.innerText();
    expect(t.replace(/\s+/g, "")).not.toHaveLength(0);
  }).toPass({ timeout: 60000 });
  await page.waitForTimeout(4000);
}

test.describe("CLI-mode terminal rendering", () => {
  test.describe.configure({ mode: "serial" });

  let claudeAvailable = false;
  test.beforeAll(async () => {
    try {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) as Record<string, unknown>;
      savedChatMode = data.chatMode;
    } catch {
      savedChatMode = undefined;
    }
    setChatMode("cli");
    const { execSync } = await import("child_process");
    try {
      execSync("which claude", { encoding: "utf8" });
      claudeAvailable = true;
    } catch {
      claudeAvailable = false;
    }
  });

  test.afterAll(() => {
    setChatMode(savedChatMode as string | undefined);
  });

  test("R1. the agent TUI lands on a uniform grid with no corruption", async ({
    page,
  }, testInfo) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found");
      return;
    }
    const dir = shotDir(testInfo.project.name);
    await openCliSession(page);

    const banner = await rowGeometry(page);
    await page.screenshot({ path: path.join(dir, "01-banner.png") });
    console.log(`[${testInfo.project.name}] banner`, {
      dpr: banner.dpr,
      fontMatches: banner.fontMatches,
      asciiProfile: banner.asciiWidthProfile,
      asciiMenlo: banner.asciiWidthMenlo,
      puaWidth: banner.puaWidthProfile,
      threeAsciiWidth: banner.puaWidthAscii3,
      font: banner.fontFamily,
      size: banner.fontSize,
      heights: banner.uniqueHeights,
      steps: banner.uniqueSteps,
      widest: banner.widestRow,
      fffd: banner.replacementChars,
    });

    // The pty byte path must not have eaten a multi-byte glyph.
    expect(banner.replacementChars).toBe(0);

    // Every row is the same height, on an even step, and no row is taller
    // than the step between rows (which is what makes lines collide).
    expect(banner.uniqueHeights).toHaveLength(1);
    expect(banner.uniqueSteps.length).toBeLessThanOrEqual(1);
    expect(banner.maxHeight).toBeLessThanOrEqual(banner.minStep + 0.01);
  });

  test("R2. typed input stays on its own row, not merged into the rule", async ({
    page,
  }, testInfo) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found");
      return;
    }
    const dir = shotDir(testInfo.project.name);
    await openCliSession(page);

    const xi = page.locator(".xterm-helper-textarea");
    await expect(xi).toBeAttached({ timeout: 15000 });
    await xi.click({ force: true });
    await page.waitForTimeout(1200);
    await xi.press("Enter"); // dismiss a trust prompt if one is shown
    await page.waitForTimeout(2500);

    await xi.pressSequentially("asd", { delay: 60 });
    await page.waitForTimeout(2500);

    const typed = await rowGeometry(page);
    await page.screenshot({ path: path.join(dir, "02-typed.png") });
    console.log(`[${testInfo.project.name}] typed`, {
      heights: typed.uniqueHeights,
      steps: typed.uniqueSteps,
      fffd: typed.replacementChars,
    });

    expect(typed.replacementChars).toBe(0);
    expect(typed.uniqueHeights).toHaveLength(1);
    expect(typed.maxHeight).toBeLessThanOrEqual(typed.minStep + 0.01);

    // The row carrying what was typed must not also be a box rule: the
    // reported bug was "the text is on line with the dash".
    const typedRow = typed.text.find((t) => t.includes("asd"));
    expect(typedRow, "a row containing the typed text").toBeTruthy();
    const ruleChars = (typedRow!.match(/[─━—]/g) ?? []).length;
    expect(ruleChars, `typed row must not be a rule: ${JSON.stringify(typedRow)}`).toBe(0);
  });

  test("R3. a narrow pane scales the font instead of reflowing", async ({
    page,
  }, testInfo) => {
    if (!claudeAvailable) {
      test.skip(true, "claude binary not found");
      return;
    }
    const dir = shotDir(testInfo.project.name);
    await openCliSession(page);

    const wide = await rowGeometry(page);
    await page.screenshot({ path: path.join(dir, "03-wide.png") });

    await page.setViewportSize({ width: 720, height: 800 });
    await page.waitForTimeout(3500);
    const narrow = await rowGeometry(page);
    await page.screenshot({ path: path.join(dir, "04-narrow.png") });
    console.log(`[${testInfo.project.name}] scale`, {
      wide: wide.fontSize,
      narrow: narrow.fontSize,
      narrowWidest: narrow.widestRow,
    });

    expect(narrow.fontSize!).toBeLessThan(wide.fontSize!);
    expect(narrow.widestRow).toBeGreaterThanOrEqual(80);
    expect(narrow.uniqueHeights).toHaveLength(1);

    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(3000);
    const restored = await rowGeometry(page);
    await page.screenshot({ path: path.join(dir, "05-restored.png") });
    expect(restored.fontSize!).toBeCloseTo(wide.fontSize!, 1);
  });
});
