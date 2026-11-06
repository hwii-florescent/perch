/** The $HOME every e2e core and everything it launches runs under.
 *
 * A fixture core's "Chats" sessions start in $HOME, and real agents started there (and the shells
 * around them) walk it. On macOS that reaches Desktop, Documents, Downloads, Pictures and Music, and
 * the OS asks the user for access, naming the test core's binary (a new identity on every rebuild).
 * So cores get a private home under the OS temp dir instead. It contains symlinks only to what agents
 * and shells need to start and sign in (config, binaries, shell startup files, `Library/Keychains`) and
 * never to a privacy-protected folder or to `~/.perch`, which also keeps the suite's own state (devices,
 * worktrees, uploads, the Chats scratch folder) out of the user's real Perch data.
 *
 * One home per run: the process that creates it publishes `PERCH_E2E_HOME` for the workers it starts and
 * deletes it when that process exits (a removal unlinks the symlinks; it never follows them).
 * Test code, which runs under the real home, reads the real one with `REAL_HOME`.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** The user's real home, remembered once so a nested run never mistakes the fixture for it. */
export const REAL_HOME = (process.env.PERCH_E2E_REAL_HOME ??= os.homedir());

// Agent state and credentials, the places their binaries live, toolchains, and the shell startup
// files a login shell reads (so the CLIs stay on PATH).
const LINKED = [
  ".claude", ".claude.json", ".codex", ".pi", ".omp", ".opencode",
  ".local", ".bun", ".npm", ".npm-global", ".cargo", ".rustup", ".config", ".gitconfig",
  ".zshenv", ".zprofile", ".zshrc", ".zlogin", ".bash_profile", ".bashrc", ".profile",
];

/** The fixture home for this run, created on first use. */
export function fixtureHome(): string {
  const existing = process.env.PERCH_E2E_HOME;
  if (existing && fs.existsSync(existing)) return existing;
  const home = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "perch-home-"));
  for (const name of LINKED) {
    const target = path.join(REAL_HOME, name);
    if (fs.existsSync(target)) fs.symlinkSync(target, path.join(home, name));
  }
  // The keychain search list is found through $HOME, and agents sign in from it (without it Claude
  // reports "Not logged in"). Only this one folder of ~/Library is linked, never ~/Library itself.
  const keychains = path.join(REAL_HOME, "Library", "Keychains");
  if (fs.existsSync(keychains)) {
    fs.mkdirSync(path.join(home, "Library"));
    fs.symlinkSync(keychains, path.join(home, "Library", "Keychains"));
  }
  process.env.PERCH_E2E_HOME = home;
  process.on("exit", () => fs.rmSync(home, { recursive: true, force: true }));
  return home;
}
