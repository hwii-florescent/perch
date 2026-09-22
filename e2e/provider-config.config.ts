import { defineConfig, devices } from "@playwright/test";

// Each test starts its own core with a temporary manifest, database, and
// project. Build the web client and perch-core before running this suite.
export default defineConfig({
  testDir: ".",
  testMatch: ["provider-config.spec.ts", "native-providers.spec.ts", "cheap-model.spec.ts"],
  outputDir: "artifacts-provider-config",
  timeout: 120_000,
  workers: 1,
  use: { headless: true, viewport: { width: 1400, height: 900 } },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"], deviceScaleFactor: 2 } },
  ],
});
