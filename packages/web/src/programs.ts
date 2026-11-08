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
  goose: { name: "Goose", tile: "#f59e0b", run: ["goose"] },
  crush: { name: "Crush", tile: "#ec4899", run: ["crush"] },
  qwen: { name: "Qwen", tile: "#6d28d9", run: ["qwen"] },
  cline: { name: "Cline", tile: "#0ea5e9", run: ["cline"] },
  kilo: { name: "Kilo", tile: "#111827", run: ["kilo"] },
  ollama: { name: "Ollama", tile: "#374151" },
  micro: { name: "micro", tile: "#2563eb" },
  kak: { name: "Kakoune", tile: "#7c3aed", match: ["kakoune"] },
  zed: { name: "Zed", tile: "#084ccf" },
  subl: { name: "Sublime", tile: "#ff9800", match: ["sublime_text"] },
  idea: { name: "IntelliJ", tile: "#fe315d", match: ["webstorm", "pycharm", "goland", "clion"] },
  php: { name: "PHP", tile: "#777bb4", match: ["composer"] },
  perl: { name: "Perl", tile: "#39457e" },
  lua: { name: "Lua", tile: "#000080", match: ["luajit"] },
  julia: { name: "Julia", tile: "#9558b2" },
  R: { name: "R", tile: "#276dc3", match: ["Rscript"] },
  elixir: { name: "Elixir", tile: "#6e4a7e", match: ["mix", "iex"] },
  erl: { name: "Erlang", tile: "#a90533", match: ["erlang", "rebar3"] },
  ghc: { name: "Haskell", tile: "#5e5086", match: ["stack", "cabal", "ghci"] },
  ocaml: { name: "OCaml", tile: "#ee6a1a", match: ["dune", "opam"] },
  zig: { name: "Zig", tile: "#f7a41d" },
  swift: { name: "Swift", tile: "#f05138", match: ["swiftc", "xcodebuild"] },
  kotlin: { name: "Kotlin", tile: "#7f52ff", match: ["kotlinc"] },
  dotnet: { name: ".NET", tile: "#512bd4" },
  gradle: { name: "Gradle", tile: "#02303a", match: ["gradlew"] },
  mvn: { name: "Maven", tile: "#c71a36" },
  scala: { name: "Scala", tile: "#dc322f", match: ["sbt"] },
  dart: { name: "Dart", tile: "#0175c2", match: ["flutter"] },
  pip: { name: "pip", tile: "#3776ab", match: ["pip3"] },
  uv: { name: "uv", tile: "#de5fe9", match: ["uvx"] },
  poetry: { name: "Poetry", tile: "#60a5fa" },
  conda: { name: "Conda", tile: "#44a833", match: ["mamba"] },
  pytest: { name: "pytest", tile: "#0a9edc" },
  cmake: { name: "CMake", tile: "#064f8c", match: ["ninja"] },
  gcc: { name: "GCC", tile: "#6b7280", match: ["clang", "cc", "c++", "g++"] },
  eslint: { name: "ESLint", tile: "#4b32c3" },
  prettier: { name: "Prettier", tile: "#f7b93e" },
  webpack: { name: "webpack", tile: "#8dd6f9" },
  esbuild: { name: "esbuild", tile: "#ffcf00" },
  next: { name: "Next.js", tile: "#000000" },
  astro: { name: "Astro", tile: "#ff5d01" },
  turbo: { name: "Turborepo", tile: "#ef4444", match: ["nx"] },
  tailwindcss: { name: "Tailwind", tile: "#06b6d4" },
  storybook: { name: "Storybook", tile: "#ff4785" },
  cypress: { name: "Cypress", tile: "#17202c" },
  mocha: { name: "Mocha", tile: "#8d6748" },
  curl: { name: "curl", tile: "#073551", match: ["wget", "http", "xh"] },
  rsync: { name: "rsync", tile: "#475569", match: ["scp", "sftp"] },
  jq: { name: "jq", tile: "#475569", match: ["yq"] },
  fzf: { name: "fzf", tile: "#f59e0b" },
  rg: { name: "ripgrep", tile: "#475569", match: ["grep", "ag", "fd", "find"] },
  yazi: { name: "Yazi", tile: "#16a34a", match: ["ranger", "lf", "nnn", "mc"] },
  gh: { name: "GitHub", tile: "#24292f", match: ["glab", "hub"] },
  brew: { name: "Homebrew", tile: "#fbb040", match: ["apt", "dnf", "pacman", "nix"] },
  aws: { name: "AWS", tile: "#ff9900" },
  gcloud: { name: "Google Cloud", tile: "#4285f4" },
  az: { name: "Azure", tile: "#0078d4" },
  ansible: { name: "Ansible", tile: "#ee0000", match: ["ansible-playbook"] },
  vagrant: { name: "Vagrant", tile: "#1868f2" },
  nginx: { name: "nginx", tile: "#009639", match: ["caddy", "httpd"] },
  mongosh: { name: "MongoDB", tile: "#47a248", match: ["mongod", "mongo"] },
  clickhouse: { name: "ClickHouse", tile: "#ffcc00", match: ["clickhouse-client"] },
  duckdb: { name: "DuckDB", tile: "#fff000" },
  cockroach: { name: "CockroachDB", tile: "#6933ff" },
  watch: { name: "watch", tile: "#6b7280", match: ["tail", "cat", "tee"] },
  ping: { name: "ping", tile: "#475569", match: ["traceroute", "mtr", "dig", "nslookup"] },
  lazydocker: { name: "Lazydocker", tile: "#2496ed" },
  just: { name: "just", tile: "#6b7280", match: ["task", "invoke"] },
  watchexec: { name: "watchexec", tile: "#6b7280", match: ["nodemon", "entr", "cargo-watch"] },
  ngrok: { name: "ngrok", tile: "#1f1e37", match: ["cloudflared", "tailscale"] },
  gpg: { name: "GnuPG", tile: "#0093dd", match: ["age", "pass"] },
  neofetch: { name: "fetch", tile: "#6b7280", match: ["fastfetch"] },
  cursor: { name: "Cursor", tile: "#111827" },
  windsurf: { name: "Windsurf", tile: "#0b100f" },
};
const SHELLS = ["bash", "zsh", "sh", "fish", "dash", "ksh", "nu", "pwsh", "tcsh", "csh"];
const INTERPRETERS = ["node", "python", "python3", "ruby", "perl", "php", "bun", "deno", "npx", "bunx", "pnpx", "uv", "uvx", "pipx"];

const base = (path: string) => path.split("/").pop()!.replace(/\.(m?js|cjs|ts|py|rb|sh)$/, "");
/** An unlisted program gets a colour of its own, the same each time. */
const tileFor = (name: string) => `hsl(${[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)} 45% 40%)`;

/** The table: built-ins with `programs.json` merged over them field by field. */
/** What the table holds: the built-in entries, whether or not a `programs.json` adds to them. */
export const BUILTIN_COUNT = Object.keys(BUILTIN).length;

/** The `programs.json` the core last sent; the sidebar, toasts and `api.program()` read through it. */
let userFile: ProgramsFile | undefined;
export const setProgramsFile = (file: ProgramsFile | undefined) => { userFile = file; };
export const currentPrograms = () => userFile;

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
