import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: ["native-composer.spec.ts", "native-terminal.spec.ts", "native-slash-send.spec.ts"], outputDir: "artifacts-native-composer",
  timeout: 420_000, workers: 1,
  use: { headless: true, actionTimeout: 15_000, viewport: { width: 1400, height: 900 } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
