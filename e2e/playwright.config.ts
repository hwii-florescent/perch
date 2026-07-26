import { defineConfig, devices } from "@playwright/test";
import * as path from "path";
import * as os from "os";

export default defineConfig({
  testDir: ".",
  testMatch: ["sidebar.spec.ts", "cli-sync.spec.ts", "models.spec.ts", "restyle.spec.ts", "settings.spec.ts", "federation.spec.ts"],
  outputDir: "artifacts",
  timeout: 120000,
  use: {
    baseURL: "http://127.0.0.1:7799",
    screenshot: "on",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  workers: 1,
  webServer: [
    {
      // Instance A — the hub (UI runs against this one)
      command: "cargo run -p perch-core -- --port 7799",
      cwd: path.resolve(__dirname, ".."),
      url: "http://127.0.0.1:7799/",
      reuseExistingServer: true,
      timeout: 60000,
      env: {
        // Point at real HOME so the claude CLI can find its credentials.
        // Pre-existing sessions are treated as background noise — tests assert
        // on relative count changes and specific new items, not absolute counts.
        HOME: os.homedir(),
        // Include ~/.cargo/bin so cargo/rustc are on PATH for the webServer command.
        PATH: `${os.homedir()}/.cargo/bin:${process.env.PATH ?? ""}`,
      },
    },
    {
      // Instance B — the federated remote (isolated db + hosts so it never
      // accidentally loops back into A or shares ~/.perch state).
      command: "cargo run -p perch-core -- --port 7800 --db-path /tmp/perch-e2e-remote.sqlite --hosts-path /tmp/perch-e2e-remote-hosts.json",
      cwd: path.resolve(__dirname, ".."),
      url: "http://127.0.0.1:7800/",
      reuseExistingServer: true,
      timeout: 60000,
      env: {
        HOME: os.homedir(),
        PATH: `${os.homedir()}/.cargo/bin:${process.env.PATH ?? ""}`,
      },
    },
  ],
});
