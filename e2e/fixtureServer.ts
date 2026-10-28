/** Playwright webServer entry: keep final teardown alive after the core stops. */
import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fixtureRuntimeEnv, cleanupFixtureRuntime } from "./fixtureRuntime.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.PERCH_DB) throw new Error("Fixture server requires a private PERCH_DB");
const fixture = path.dirname(process.env.PERCH_DB);
const core = spawn(path.join(root, "target/debug/perch-core"), process.argv.slice(2), {
  cwd: root, env: { ...process.env, ...fixtureRuntimeEnv(fixture) }, stdio: "inherit",
});
let stopping = false;
let escalation: ReturnType<typeof setTimeout> | undefined;
function stop() {
  if (stopping || core.exitCode !== null || core.signalCode !== null) return;
  stopping = true;
  core.kill("SIGTERM");
  escalation = setTimeout(() => core.kill("SIGKILL"), 5000);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
try {
  await new Promise<void>((resolve, reject) => {
    core.once("error", reject);
    core.once("exit", (code, signal) => {
      if (!stopping) process.exitCode = code || (signal ? 1 : 0);
      resolve();
    });
  });
} finally {
  clearTimeout(escalation);
  await cleanupFixtureRuntime(root, fixture);
  fs.rmSync(fixture, { recursive: true, force: true });
}
