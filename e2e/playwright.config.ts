import { defineConfig, devices } from "@playwright/test";
import * as path from "path";
import * as os from "os";

export default defineConfig({
  testDir: ".",
  // ORDER MATTERS. `wave2.features.spec.ts` runs FIRST, before
  // `federation.spec.ts`: its T4 test needs to reach `sessionId: null`, which
  // is only possible when no non-archived session exists anywhere the hub can
  // see. The federated remote (:7800) accumulates sessions across runs in its
  // own db, and the hub keeps listing them without owning them — they can be
  // neither archived nor deleted from here, and any one of them is something
  // `switchAwayFromActiveSession` falls back to. Running before the federation
  // spec adds that host is the only cheap way to guarantee the precondition.
  // (T4 also removes any host left over from a previous run; federation.spec
  // re-adds its own.)
  testMatch: ["wave2.features.spec.ts", "sidebar.spec.ts", "cli-sync.spec.ts", "models.spec.ts", "restyle.spec.ts", "settings.spec.ts", "federation.spec.ts", "nav.spec.ts", "sessions.spec.ts", "theme.spec.ts", "status-glyphs.spec.ts", "workspace-tabs.spec.ts", "keybindings.spec.ts", "responsive.spec.ts", "pane-splitting.spec.ts", "workspace-git.spec.ts", "workspace-review.spec.ts", "toasts.spec.ts", "wave1.spec.ts", "worktrees.spec.ts", "wave2.spec.ts", "chat-ui.spec.ts", "chat-mode.spec.ts", "session-mode-policy.spec.ts", "detached.spec.ts", "chat-power.spec.ts", "workspace-foundation.spec.ts", "workspace-files-durable.spec.ts", "workspace-terminals.spec.ts", "workspace-recovery.spec.ts", "agent-turn-review.spec.ts", "workspace-visual-qa.spec.ts", "agent-hibernation.spec.ts", "device-pairing.spec.ts", "agent-terminal-ownership.spec.ts", "native-providers.spec.ts"],
  outputDir: "artifacts",
  timeout: 120000,
  use: {
    baseURL: "http://127.0.0.1:7799",
    screenshot: "on",
    // Wave 2 item 11 (onboarding modal) shows once per fresh browser
    // profile — but Playwright gives every test its own brand-new,
    // fully-isolated context by default, so *every* test's first page load
    // would otherwise be a fresh profile and get the modal (a fixed,
    // very-high-z-index overlay) blocking all interaction. Pre-seed the
    // "already seen" flag globally here so the existing suite (and wave2's
    // own X1/X2/X3/X5 tests) never see it; wave2.spec.ts's X4 test (which
    // specifically exercises the onboarding flow) overrides this back to an
    // empty storageState for just that one test via `test.use(...)`.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:7799",
          localStorage: [{ name: "perch.onboarding.seen", value: "1" }],
        },
      ],
    },
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
      // Instance A — the hub (UI runs against this one). Isolated /tmp
      // db+hosts (same pattern as instance B below) so e2e runs never touch
      // the developer's real ~/.perch/history.sqlite or hosts.json — a
      // previous version of this config pointed at the real paths and a
      // flaky run left ~165 junk sessions in the real DB.
      command: "cargo run -p perch-core -- --port 7799 --db-path /tmp/perch-e2e-hub.sqlite --hosts-path /tmp/perch-e2e-hub-hosts.json",
      cwd: path.resolve(__dirname, ".."),
      url: "http://127.0.0.1:7799/",
      reuseExistingServer: true,
      timeout: 60000,
      env: {
        // Point at real HOME so the claude CLI can find its credentials.
        // Sessions are created fresh by each test run against the isolated
        // db above — no more "pre-existing sessions are background noise".
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
