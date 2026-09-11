/**
 * cli-rendering.config.ts — dedicated config for `cli-rendering.spec.ts`.
 *
 * Separate from `playwright.config.ts` because this is the one spec that must
 * run in **more than one browser engine**: the desktop app renders in WebKit
 * (WKWebView) while the main suite runs Chromium, and terminal rendering is
 * exactly the area where the two disagree — font matching, glyph fallback and
 * cell metrics. Bolting a second project onto the main config would double
 * every other spec's runtime for no benefit.
 *
 *   npx playwright test --config=cli-rendering.config.ts                # both
 *   npx playwright test --config=cli-rendering.config.ts --project=webkit
 *
 * Screenshots land in `screenshots-cli-rendering/<engine>/` and are kept
 * between runs (unlike `artifacts/`, which the main config wipes).
 */
import { defineConfig, devices } from "@playwright/test";
import * as path from "path";
import * as os from "os";

export default defineConfig({
  testDir: ".",
  testMatch: ["cli-rendering.spec.ts", "workspace-terminals.spec.ts", "agent-terminal-ownership.spec.ts"],
  outputDir: "artifacts-cli-rendering",
  timeout: 180000,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:7799",
    viewport: { width: 1400, height: 900 },
  },
  projects: [
    // WebKit first: it is the engine the shipped desktop app uses, so a
    // failure there is the one that matters most.
    // deviceScaleFactor 2 mirrors the Retina display the desktop app runs
    // on: cell width/height become fractional CSS pixels there, which is
    // where a terminal grid drifts out of alignment.
    { name: "webkit", use: { ...devices["Desktop Safari"], deviceScaleFactor: 2 } },
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command:
        "cargo run -p perch-core -- --port 7799 --db-path /tmp/perch-e2e-hub.sqlite --hosts-path /tmp/perch-e2e-hub-hosts.json",
      cwd: path.resolve(__dirname, ".."),
      url: "http://127.0.0.1:7799/",
      reuseExistingServer: true,
      timeout: 90000,
      env: {
        HOME: os.homedir(),
        PATH: `${os.homedir()}/.cargo/bin:${process.env.PATH ?? ""}`,
      },
    },
  ],
});
