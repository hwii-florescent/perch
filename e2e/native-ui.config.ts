import { defineConfig, devices } from "@playwright/test";
import { localStorageState } from "./localAuth";
export default defineConfig({
  testDir: ".", testMatch: ["native-ui.spec.ts", "native-providers.spec.ts"], outputDir: "artifacts-native-ui",
  timeout: 240_000, workers: 1,
  use: { headless: true, actionTimeout: 15_000, viewport: { width: 1400, height: 900 }, storageState: localStorageState() },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"], deviceScaleFactor: 2 } },
  ],
});
