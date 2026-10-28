/** Private fixture lifecycle: explicit release, confirmed cleanup, then daemon stop.
 * A crash/disconnect alone never releases a production or fixture session.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";

export function fixtureRuntimeEnv(fixture: string) {
  const root = fs.realpathSync(fixture);
  const relative = path.relative(fs.realpathSync(os.tmpdir()), root);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Fixture runtime must be a private directory beneath the system temporary directory");
  }
  return {
    PERCH_DB: path.join(root, "history.sqlite"),
    PERCH_HOSTS: path.join(root, "hosts.json"),
    PERCH_SETTINGS: path.join(root, "settings.json"),
    PERCHD_DIR: path.join(root, "daemon"),
    PERCHD_IDLE_EXIT_SECS: "1",
    PERCH_CLEANUP_OWNER: `fixture:${root}`,
  };
}

/** Call only after the fixture core has exited. Failure preserves scratch evidence. */
export async function cleanupFixtureRuntime(repoRoot: string, fixture: string): Promise<void> {
  const env = fixtureRuntimeEnv(fixture);
  const dir = env.PERCHD_DIR;
  const core = path.join(repoRoot, "target/debug/perch-core");
  const run = (command: string, args: string[] = []) => execFileSync(core,
    ["__perchd", command, "--dir", dir, "--json", ...args],
    { encoding: "utf8", timeout: 120_000, env: { ...process.env, PERCHD_DIR: undefined }, stdio: ["ignore", "pipe", "pipe"] });
  run("release", ["--owner", env.PERCH_CLEANUP_OWNER, "--reason", "fixture core exited; test teardown released its runtimes"]);
  run("cleanup", ["--yes"]);
  let sessions: unknown;
  try { sessions = JSON.parse(run("ps")); }
  catch (error) { throw new Error(`Could not read fixture runtimes; preserving state: ${error}`); }
  if (!Array.isArray(sessions) || sessions.some((session) => !session || session.alive !== false || session.cleanup?.group_stopped !== true)) {
    throw new Error(`Fixture process-group shutdown unconfirmed; preserving daemon and state for manual review: ${JSON.stringify(sessions)}`);
  }
  // No PID signalling or process-name matching. Private fixture daemons use
  // the existing idle exit, which now refuses unconfirmed process groups.
  const pidFile = path.join(dir, "daemon-v1.pid");
  if (!fs.existsSync(pidFile)) return; // no daemon was started
  const pid = Number(fs.readFileSync(pidFile, "utf8"));
  if (!Number.isSafeInteger(pid) || pid <= 1) throw new Error("Unknown fixture daemon identity");
  const deadline = Date.now() + 10_000;
  do {
    try { process.kill(pid, 0); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") return;
      throw new Error(`Could not verify private daemon shutdown: ${error}`);
    }
    await setTimeout(25);
  } while (Date.now() < deadline);
  throw new Error("Private daemon idle exit unconfirmed; preserving fixture state");
}
