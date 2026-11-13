//! The web side of the native parity check: `cd e2e && npx playwright test -c native-parity/playwright.config.ts`.
//! Headless WebKit (the Mac app is a WKWebView) against the reference page (`harness/`), which Playwright starts
//! on a fixed port and stops again. No core, no agent turn, no network beyond the loopback.
import { defineConfig, devices } from "@playwright/test";
import * as path from "node:path";

const here = __dirname;
const PORT = 7810; // vite.config.ts pins the same port; a busy port fails the run instead of moving it
export default defineConfig({
  testDir: here,
  testMatch: "web-reference.spec.ts",
  outputDir: path.resolve(here, "../artifacts-native-parity/results"),
  timeout: 120_000,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, headless: true },
  projects: [{ name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1000, height: 800 }, deviceScaleFactor: 2 } }],
  webServer: {
    command: "npm run parity:serve -w @perch/web",
    cwd: path.resolve(here, "../.."),
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    timeout: 60_000,
  },
});
