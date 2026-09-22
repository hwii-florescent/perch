import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { cheapModelEnv, CHEAP_CODEX_MODEL, CHEAP_CLAUDE_MODEL } from "./cheapModel";

// No browser, real credentials, provider process or paid request needed.
test("cheap model pins survive core restarts and setup failures cannot fall back", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "perch-model-check-"));
  const home = path.join(root, "user");
  const fixture = path.join(root, "fixture");
  try {
    for (const [provider, directory, configName, original] of [
      ["pi", ".pi/agent", "settings.json", '{"defaultModel":"expensive","extensions":["keep"]}'],
      ["omp", ".omp/agent", "config.yml", "models:\n  default: openai/expensive\n  smol: openai/expensive\n"],
      ["codex", ".codex", "config.toml", 'model = "expensive"\nmodel_reasoning_effort = "high"\n'],
    ]) {
      const real = path.join(home, directory);
      fs.mkdirSync(path.join(real, "extensions"), { recursive: true });
      fs.writeFileSync(path.join(real, "extensions", "keep.txt"), "unchanged");
      fs.writeFileSync(path.join(real, configName), original);
      const first = cheapModelEnv(provider, fixture, home);
      const overlay = first.CODEX_HOME ?? first.PI_CODING_AGENT_DIR;
      expect(overlay).toBeTruthy();
      expect(fs.readFileSync(path.join(overlay!, configName), "utf8")).toContain(CHEAP_CODEX_MODEL);
      expect(cheapModelEnv(provider, fixture, home)).toEqual(first);
      expect(fs.readFileSync(path.join(real, configName), "utf8")).toBe(original);
      expect(fs.readlinkSync(path.join(overlay!, "extensions"))).toBe(path.join(real, "extensions"));
      // A damaged config must stop setup, even after a prior successful launch.
      fs.unlinkSync(path.join(real, configName));
      expect(() => cheapModelEnv(provider, fixture, home)).toThrow();
    }
    expect(() => cheapModelEnv("unconfigured-provider", fixture, home)).toThrow();
    expect(cheapModelEnv("claude", fixture, home).ANTHROPIC_MODEL).toBe(CHEAP_CLAUDE_MODEL);
    const opencode = JSON.parse(cheapModelEnv("opencode", fixture, home).OPENCODE_CONFIG_CONTENT!);
    expect(opencode.model).toBe(`anthropic/${CHEAP_CLAUDE_MODEL}`);
    expect(opencode.small_model).toBe(opencode.model);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
