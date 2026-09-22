/**
 * Pin every real agent turn this suite runs to the cheapest available model.
 *
 * These specs drive *real* CLIs against the developer's own quota, and the
 * verification matrix asks for repeated five-provider sweeps — so a fixture
 * that inherits an expensive default (codex's `gpt-6-astra` at `high`, omp's
 * `gpt-reserve:max`) burns the quota that the *rest* of the sweep needs. One
 * run has already died mid-flow on a provider usage limit.
 *
 * Two constraints shape how this is done:
 *
 * - `goals.md` forbids changing global provider settings, so nothing here
 *   writes to `~/.codex` or `~/.omp`, and user extensions/plugins stay enabled.
 * - Perch's provider registry refuses a configured provider that reuses a
 *   built-in id (`ProviderRegistry::discover_configured` → `Duplicate`), so a
 *   fixture cannot add `-m <model>` to the built-in codex/omp launch args.
 *
 * What is left is each CLI's own "config home" env var. This builds a private
 * home per fixture whose entries are *symlinks* to the real one — so auth,
 * plugins, extensions, sessions and caches are untouched and unchanged — and
 * replaces only the single config file, with the model lines rewritten.
 *
 * Claude reads `ANTHROPIC_MODEL` directly. Pi gets its own settings overlay
 * so a changed personal default cannot select an expensive model.
 *
 * The specs assert the model chip afterwards, so a pin that silently fails to
 * take effect fails the test instead of quietly spending the quota.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** The cheap slug shared by the `openai-codex` providers used here. */
export const CHEAP_CODEX_MODEL = "gpt-5.6-luna";
export const CHEAP_CLAUDE_MODEL = "claude-haiku-4-5";

/**
 * Mirror `real` into `<fixture>/<name>`: every entry is symlinked, except the
 * names in `ownDirs` (created as private empty directories) and `configName`,
 * which is written from `rewrite(originalContents, overlayHomePath)`.
 */
function overlayHome(fixture: string, name: string, real: string, configName: string, rewrite: (config: string, home: string) => string, ownDirs: string[] = []): string {
  // Real path, not the `/var/...` spelling `os.tmpdir()` hands back: codex
  // resolves symlinks before it matches a config key against a file, so a
  // path with `/var` in it silently fails to match its own entries.
  fs.mkdirSync(path.join(fixture, name), { recursive: true });
  const home = fs.realpathSync(path.join(fixture, name));
  for (const entry of fs.readdirSync(real)) {
    if (entry === configName) continue;
    // `ownDirs` are runtime state the CLI insists on owning itself: codex
    // rejects a symlinked `app-server-control` outright. A private empty
    // directory is what a fixture wants there anyway.
    if (ownDirs.includes(entry)) fs.mkdirSync(path.join(home, entry), { recursive: true, mode: 0o700 });
    else {
      const target = path.join(real, entry);
      const link = path.join(home, entry);
      // Core restart reuses this overlay, including dangling runtime links.
      if (!fs.lstatSync(link, { throwIfNoEntry: false })) fs.symlinkSync(target, link);
      else if (fs.readlinkSync(link) !== target) throw new Error(`Unexpected fixture config link: ${link}`);
    }
  }
  fs.writeFileSync(path.join(home, configName), rewrite(fs.readFileSync(path.join(real, configName), "utf8"), home));
  return home;
}

/**
 * Environment additions that pin `provider` to its cheapest model for one
 * fixture. Setup errors stop the fixture; never inherit an expensive default.
 * Callers must also verify the actual model before sending any prompt.
 */
export function cheapModelEnv(provider: string, fixture: string, userHome = os.homedir()): NodeJS.ProcessEnv {
  if (provider === "claude") return { ANTHROPIC_MODEL: CHEAP_CLAUDE_MODEL };
  if (provider === "opencode") {
    // Runtime override merged by the CLI; user config and plugins stay intact.
    // https://opencode.ai/docs/config/#inline-config
    return { OPENCODE_CONFIG_CONTENT: JSON.stringify({
      ...JSON.parse(process.env.OPENCODE_CONFIG_CONTENT || "{}"),
      model: `anthropic/${CHEAP_CLAUDE_MODEL}`,
      small_model: `anthropic/${CHEAP_CLAUDE_MODEL}`,
    }) };
  }
  if (provider === "pi") {
    const home = overlayHome(fixture, "pi-agent", path.join(userHome, ".pi", "agent"), "settings.json", (config) =>
      JSON.stringify({ ...JSON.parse(config), defaultProvider: "openai-codex", defaultModel: CHEAP_CODEX_MODEL, defaultThinkingLevel: "low" }),
    );
    return { PI_CODING_AGENT_DIR: home };
  }
  if (provider === "codex") {
    const real = path.join(userHome, ".codex");
    const home = overlayHome(fixture, "codex-home", real, "config.toml", (config, overlay) =>
      config
        .replace(/^model = .*$/m, `model = "${CHEAP_CODEX_MODEL}"`)
        .replace(/^model_reasoning_effort = .*$/m, 'model_reasoning_effort = "low"')
        // `[hooks.state]` keys are absolute paths. Left pointing at the real
        // home they no longer match this home's hooks.json, and codex opens
        // a blocking "hooks are new or changed" prompt. Repointing them
        // keeps the user's own hooks and their existing trust decision.
        .split(`"${real}/hooks.json:`)
        .join(`"${overlay}/hooks.json:`),
      ["app-server-control"],
    );
    return { CODEX_HOME: home };
  }
  if (provider === "omp") {
    // Every role, so a subagent cannot escape to an expensive model either.
    const home = overlayHome(fixture, "omp-agent", path.join(userHome, ".omp", "agent"), "config.yml", (config) =>
      config.replace(/^(\s+\w+): \S+\/\S+$/gm, `$1: openai-codex/${CHEAP_CODEX_MODEL}:low`),
    );
    return { PI_CODING_AGENT_DIR: home };
  }
  throw new Error(`No cheap-model pin configured for ${provider}`);
}
