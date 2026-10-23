import { defineConfig, devices } from "@playwright/test";
import * as path from "node:path";

// Dedicated headless, unpaid federation checks. Never share the installed
// app's DB, hosts, settings or daemon (nor the main e2e suite's state).
const root = path.resolve(__dirname, "..");
const scratch = "/tmp/perch-e2e-remote-workspace";
process.env.PERCH_E2E_HUB_PORT = "7794";
process.env.PERCH_E2E_REMOTE_PORT = "7795";
export default defineConfig({
  testDir: ".",
  testMatch: ["remote-workspace.spec.ts", "remote-git.spec.ts"],
  outputDir: "artifacts/remote-workspace",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:7794",
    headless: true,
    storageState: { cookies: [], origins: [{ origin: "http://127.0.0.1:7794", localStorage: [{ name: "perch.onboarding.seen", value: "1" }] }] },
  },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  webServer: [7794, 7795].map((port) => ({
    command: `mkdir -p ${scratch}/${port} && cargo run -p perch-core -- --port ${port}`,
    cwd: root,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      PERCH_DB: `${scratch}/${port}/history.sqlite`,
      PERCH_HOSTS: `${scratch}/${port}/hosts.json`,
      PERCH_SETTINGS: `${scratch}/${port}/settings.json`,
      PERCHD_DIR: `${scratch}/${port}/daemon`,
    },
  })),
});
