import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "context-bridge.spec.ts", outputDir: "/tmp/perch-context-bridge-artifacts",
  timeout: 180_000, workers: 1,
  use: { headless: true, actionTimeout: 15_000, viewport: { width: 1400, height: 900 } },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"], deviceScaleFactor: 2 } },
  ],
});
