/** The program table (herdr's `programs.json`): every pane, agent and terminal has a `program` with a
 * name, tile colour and optional icon, from one table, so every mod shows the same. A built-in table
 * (agents, editors, runtimes, tools) is changed or added to by `programs.json` field by field. */
export interface Program {
  id: string;
  name: string;
  /** A path in the home folder; `tint` says it is a one-colour glyph drawn in `color`. */
  icon?: string;
  tint?: boolean;
  tile: string;
  color?: string;
  /** Other process names (or an agent's `app` name) for the entry. */
  match?: string[];
  /** How to start it, for agents a menu launches: `["cursor-agent"]`. */
  run?: string[];
}
export interface ProgramsFile {
  programs?: Record<string, Partial<Program>>;
  shells?: string[];
  interpreters?: string[];
}

const BUILTIN: Record<string, Omit<Program, "id">> = {
  claude: { name: "Claude", tile: "#d97757", run: ["claude"] },
  codex: { name: "Codex", tile: "#10a37f", run: ["codex", "--no-daemon"] },
  pi: { name: "Pi", tile: "#6366f1", run: ["pi"] },
  omp: { name: "Oh My Pi", tile: "#8b5cf6", match: ["oh-my-pi"], run: ["omp"] },
  opencode: { name: "OpenCode", tile: "#1f2937", run: ["opencode"] },
  gemini: { name: "Gemini", tile: "#4285f4", run: ["gemini"] },
  aider: { name: "Aider", tile: "#16a34a", run: ["aider"] },
  amp: { name: "Amp", tile: "#f43f5e", run: ["amp"] },
  kiro: { name: "Kiro", tile: "#8e5cf6", match: ["kiro-cli"], run: ["kiro-cli"] },
  "cursor-agent": { name: "Cursor", tile: "#111827", run: ["cursor-agent"] },
  droid: { name: "Droid", tile: "#ea580c", run: ["droid"] },
  copilot: { name: "Copilot", tile: "#6e40c9", run: ["copilot"] },
  git: { name: "Git", tile: "#f05032", match: ["lazygit", "tig", "gitui"] },
  nvim: { name: "Neovim", tile: "#57a143", match: ["neovim"] },
  vim: { name: "Vim", tile: "#019733", match: ["vi"] },
  emacs: { name: "Emacs", tile: "#7f5ab6" },
  hx: { name: "Helix", tile: "#5a4a78", match: ["helix"] },
  nano: { name: "Nano", tile: "#4b5563" },
  code: { name: "VS Code", tile: "#007acc" },
  node: { name: "Node.js", tile: "#5fa04e", match: ["nodejs"] },
  bun: { name: "Bun", tile: "#f9a8d4" },
  deno: { name: "Deno", tile: "#111827" },
  python: { name: "Python", tile: "#3776ab", match: ["python3", "python3.12", "python3.13"] },
  ruby: { name: "Ruby", tile: "#cc342d", match: ["irb"] },
  go: { name: "Go", tile: "#00add8" },
  cargo: { name: "Cargo", tile: "#dea584", match: ["rustc", "rustup"] },
  java: { name: "Java", tile: "#e76f00" },
  npm: { name: "npm", tile: "#cb3837" },
  pnpm: { name: "pnpm", tile: "#f69220" },
  yarn: { name: "Yarn", tile: "#2c8ebb" },
  vite: { name: "Vite", tile: "#646cff" },
  vitest: { name: "Vitest", tile: "#6e9f18" },
  jest: { name: "Jest", tile: "#c21325" },
  playwright: { name: "Playwright", tile: "#2ead33" },
  tsc: { name: "TypeScript", tile: "#3178c6", match: ["tsx", "ts-node"] },
  make: { name: "Make", tile: "#6b7280" },
  docker: { name: "Docker", tile: "#2496ed", match: ["docker-compose", "podman"] },
  kubectl: { name: "Kubernetes", tile: "#326ce5", match: ["k9s", "helm"] },
  terraform: { name: "Terraform", tile: "#7b42bc", match: ["tofu"] },
  psql: { name: "PostgreSQL", tile: "#336791", match: ["postgres"] },
  mysql: { name: "MySQL", tile: "#00758f" },
  sqlite3: { name: "SQLite", tile: "#0f80cc" },
  "redis-cli": { name: "Redis", tile: "#dc382d", match: ["redis-server"] },
  ssh: { name: "SSH", tile: "#475569", match: ["mosh"] },
  tmux: { name: "tmux", tile: "#1bb91f", match: ["screen"] },
  htop: { name: "htop", tile: "#0ea5e9", match: ["btop", "top"] },
  less: { name: "less", tile: "#6b7280", match: ["man", "bat"] },
};
const SHELLS = ["bash", "zsh", "sh", "fish", "dash", "ksh", "nu", "pwsh", "tcsh", "csh"];
const INTERPRETERS = ["node", "python", "python3", "ruby", "perl", "php", "bun", "deno", "npx", "bunx", "pnpx", "uv", "uvx", "pipx"];

const base = (path: string) => path.split("/").pop()!.replace(/\.(m?js|cjs|ts|py|rb|sh)$/, "");
/** An unlisted program gets a colour of its own, the same each time. */
const tileFor = (name: string) => `hsl(${[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)} 45% 40%)`;

/** The table: built-ins with `programs.json` merged over them field by field. */
export function programTable(file?: ProgramsFile): Program[] {
  const merged = new Map<string, Program>(Object.entries(BUILTIN).map(([id, entry]) => [id, { id, ...entry }]));
  for (const [id, entry] of Object.entries(file?.programs ?? {})) {
    const known = merged.get(id);
    merged.set(id, { ...(known ?? { id, name: id, tile: tileFor(id) }), ...entry, id });
  }
  return [...merged.values()];
}

/** What a command line is: `"npx vitest run"` or `["node", "/x/vite.js"]` → Vitest / Vite; a shell is `shell`; else `program`. */
export function programFor(command: string | string[], file?: ProgramsFile): Program {
  const words = (typeof command === "string" ? command.trim().split(/\s+/) : command).filter(Boolean);
  const table = programTable(file);
  const find = (name: string) => table.find((p) => p.id === name || p.match?.includes(name));
  let name = base(words[0] ?? "");
  const shells = [...SHELLS, ...(file?.shells ?? [])];
  const interpreters = [...INTERPRETERS, ...(file?.interpreters ?? [])];
  // An interpreter shows what it runs: the first argument (not a flag) that is a known program (`pipx run vitest`).
  if (interpreters.includes(name)) {
    const ran = words.slice(1).filter((word) => !word.startsWith("-")).map(base).find(find);
    if (ran) name = ran;
  }
  if (shells.includes(name)) return { id: "shell", name: "Shell", tile: "#4b5563" };
  return find(name) ?? { id: "program", name: name || "program", tile: tileFor(name) };
}
