import { defineConfig, devices } from "@playwright/test";
import * as os from "os";
import * as path from "path";

// Worktree lifecycle (phase 3) against its own core on :7796 with scratch
// state, so it never shares the main suite's :7799 hub. Reuses a core that is
// already listening there.
const PORT = 7796;
const STATE = process.env.PERCH_E2E_STATE ?? path.join(os.tmpdir(), "perch-e2e-worktrees");
process.env.PERCH_E2E_BASE = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: ".",
  testMatch: ["worktrees.spec.ts"],
  outputDir: "artifacts",
  timeout: 120_000,
  workers: 1,
  use: {
    headless: true,
    baseURL: `http://127.0.0.1:${PORT}`,
    screenshot: "on",
    storageState: {
      cookies: [],
      origins: [{ origin: `http://127.0.0.1:${PORT}`, localStorage: [{ name: "perch.onboarding.seen", value: "1" }] }],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Stop the detached test daemon before deleting its socket directory.
    // Otherwise a second run leaves the live daemon unreachable (PTY opens hang).
    // Only runs when no core is listening; existing cores retain their state.
    command: `pkill -f '__perchd serve --dir ${STATE}/perchd$'; rm -rf '${STATE}' && cargo run -p perch-core -- --port ${PORT} --headless`,
    cwd: path.resolve(__dirname, ".."),
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      HOME: os.homedir(),
      PATH: `${os.homedir()}/.cargo/bin:${process.env.PATH ?? ""}`,
      PERCH_DB: path.join(STATE, "history.sqlite"),
      PERCH_HOSTS: path.join(STATE, "hosts.json"),
      PERCHD_DIR: path.join(STATE, "perchd"),
      PERCH_SETTINGS: path.join(STATE, "settings.json"),
      ANTHROPIC_MODEL: "claude-haiku-4-5",
    },
  },
});
