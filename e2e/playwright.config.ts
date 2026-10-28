import { defineConfig, devices } from "@playwright/test";
import * as path from "path";
import * as os from "os";
import { CHEAP_CLAUDE_MODEL } from "./cheapModel";
import * as fs from "node:fs";
import { fixtureRuntimeEnv } from "./fixtureRuntime";

// One fresh scope per run, inherited by workers. Never delete another run's
// database or kill its daemon to obtain clean state.
const state = process.env.PERCH_E2E_STATE ??= fs.mkdtempSync(path.join(os.tmpdir(), "perch-suite-"));
const hub = path.join(state, "hub"), remote = path.join(state, "remote");
fs.mkdirSync(hub, { recursive: true });
fs.mkdirSync(remote, { recursive: true });
Object.assign(process.env, fixtureRuntimeEnv(hub));
// Every core this config starts (including spec-owned spawns) inherits Haiku.
process.env.ANTHROPIC_MODEL = CHEAP_CLAUDE_MODEL;

export default defineConfig({
  testDir: ".",
  // ORDER MATTERS. `wave2.features.spec.ts` runs FIRST, before
  // `federation.spec.ts`: its T4 test needs to reach `sessionId: null`, which
  // is only possible when no session exists anywhere the hub can
  // see. Sessions federation.spec leaves on the remote (:7800) stay listed by
  // the hub without it owning them — they cannot be deleted from here, and
  // any one of them is something
  // `switchAwayFromActiveSession` falls back to. Running before the federation
  // spec adds that host is the only cheap way to guarantee the precondition.
  // (T4 also removes any host left over from a previous run; federation.spec
  // re-adds its own.)
  testMatch: ["wave2.features.spec.ts", "sidebar.spec.ts", "cli-sync.spec.ts", "settings.spec.ts", "federation.spec.ts", "remote-git.spec.ts", "nav.spec.ts", "sessions.spec.ts", "theme.spec.ts", "status-glyphs.spec.ts", "workspace-tabs.spec.ts", "terminal-width.spec.ts", "mixed-tabs.spec.ts", "keybindings.spec.ts", "responsive.spec.ts", "pane-splitting.spec.ts", "workspace-git.spec.ts", "workspace-review.spec.ts", "toasts.spec.ts", "wave1.spec.ts", "worktrees.spec.ts", "wave2.spec.ts", "detached.spec.ts", "workspace-foundation.spec.ts", "workspace-files-durable.spec.ts", "workspace-file-browser.spec.ts", "explorer-keyboard.spec.ts", "workspace-terminals.spec.ts", "workspace-recovery.spec.ts", "agent-turn-review.spec.ts", "workspace-visual-qa.spec.ts", "agent-hibernation.spec.ts", "device-pairing.spec.ts", "phone-access.spec.ts", "agent-terminal-ownership.spec.ts", "native-providers.spec.ts", "cheap-model.spec.ts", "native-ui.spec.ts", "native-review.spec.ts", "paired-phone-flows.spec.ts", "provider-config.spec.ts", "needs-you.spec.ts", "context-bridge.spec.ts"],
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
    // The Mac app is a WKWebView: PERCH_E2E_WEBKIT=1 npx playwright test --project=webkit <spec>
    ...(process.env.PERCH_E2E_WEBKIT ? [{ name: "webkit", use: { ...devices["Desktop Safari"] } }] : []),
  ],
  workers: 1,
  webServer: [
    {
      // Instance A — private hub. The wrapper cleans PTYs after core exit.
      command: "cargo build -p perch-core && exec node --experimental-strip-types e2e/fixtureServer.ts --port 7799",
      cwd: path.resolve(__dirname, ".."),
      url: "http://127.0.0.1:7799/",
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 120_000 },
      timeout: 60000,
      env: {
        ...fixtureRuntimeEnv(hub),
        PERCH_NO_LOGIN_PATH: "1",
        // Keep credentials available, but never share Perch state.
        HOME: os.homedir(),
        // Include ~/.cargo/bin so cargo/rustc are on PATH for the webServer command.
        PATH: `${os.homedir()}/.cargo/bin:${process.env.PATH ?? ""}`,
      },
    },
    {
      // Instance B — independent owner, settings, database and daemon.
      command: "cargo build -p perch-core && exec node --experimental-strip-types e2e/fixtureServer.ts --port 7800",
      cwd: path.resolve(__dirname, ".."),
      url: "http://127.0.0.1:7800/",
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 120_000 },
      timeout: 60000,
      env: {
        ...fixtureRuntimeEnv(remote),
        PERCH_NO_LOGIN_PATH: "1",
        HOME: os.homedir(),
        PATH: `${os.homedir()}/.cargo/bin:${process.env.PATH ?? ""}`,
      },
    },
  ],
});
