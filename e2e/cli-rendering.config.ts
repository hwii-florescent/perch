/**
 * cli-rendering.config.ts — focused Chromium/WebKit interaction checks.
 *
 * Focused cross-engine checks for the desktop WebKit path and Chromium.
 * Includes terminal rendering, lifecycle/recovery and workspace review.
 * Keeping these separate avoids doubling every main-suite test by default.
 *
 *   npx playwright test --config=cli-rendering.config.ts                # both
 *   npx playwright test --config=cli-rendering.config.ts --project=webkit
 *
 * Test attachments land in `artifacts-cli-rendering/` (wiped each run).
 * The rendering fixture also keeps its named captures in
 * `screenshots-cli-rendering/<engine>/`; copy other keepers there explicitly.
 */
import { defineConfig, devices } from "@playwright/test";
import * as path from "path";
import * as os from "os";

export default defineConfig({
  testDir: ".",
  testMatch: ["cli-rendering.spec.ts", "workspace-terminals.spec.ts", "agent-terminal-ownership.spec.ts", "workspace-recovery.spec.ts", "workspace-review.spec.ts", "agent-turn-review.spec.ts", "agent-hibernation.spec.ts", "device-pairing.spec.ts", "paired-phone-flows.spec.ts"],
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
