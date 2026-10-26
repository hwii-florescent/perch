import type { GitFileState, GitStatusEntry } from "@perch/shared";
import { cn } from "../lib/cn";

/** Filename conventions only: icons do not claim package ownership or diagnostics. */
export function fileAppearance(name: string, directory = false): { kind: string; tone: string; text?: string } {
  const lower = name.toLowerCase();
  if (directory) return { kind: /^(node_modules|packages|crates|vendor)$/.test(lower) ? "package" : lower === "lib" ? "library" : "folder", tone: "text-subtext-0" };
  if (/^(package\.json|cargo\.toml|go\.mod|pyproject\.toml|gemfile|composer\.json)$/.test(lower)) return { kind: "package", tone: "text-peach" };
  if (/^(dockerfile|containerfile)(\.|$)/.test(lower)) return { kind: "package", tone: "text-blue" };
  if (/^(\.gitignore|\.gitattributes|\.gitmodules)$/.test(lower)) return { kind: "branch", tone: "text-subtext-0" };
  if (/\.(tsx|jsx)$/.test(lower)) return { kind: "react", tone: "text-blue" };
  if (/\.(css|scss|sass|less)$/.test(lower)) return { kind: "style", tone: "text-mauve" };
  if (/\.(md|mdx|txt|rst)$/.test(lower) || /^(readme|license|copying)(\.|$)/.test(lower)) return { kind: "book", tone: "text-subtext-0" };
  if (/\.(json|jsonc|ya?ml|toml|lock|ini|conf)$/.test(lower) || /^\.env(\.|$)/.test(lower)) return { kind: "config", tone: "text-yellow" };
  if (/\.(png|jpe?g|gif|webp|svg|ico|avif)$/.test(lower)) return { kind: "image", tone: "text-mauve" };
  const ext = lower.split(".").at(-1) ?? "";
  const language: Record<string, [string, string]> = {
    ts: ["TS", "text-blue"], mts: ["TS", "text-blue"], cts: ["TS", "text-blue"],
    js: ["JS", "text-yellow"], mjs: ["JS", "text-yellow"], cjs: ["JS", "text-yellow"],
    rs: ["RS", "text-peach"], py: ["PY", "text-blue"], go: ["GO", "text-blue"],
    sh: ["SH", "text-green"], bash: ["SH", "text-green"], zsh: ["SH", "text-green"],
    c: ["C", "text-blue"], h: ["C", "text-blue"], cpp: ["C+", "text-blue"], java: ["J", "text-peach"],
  };
  const match = name.includes(".") && Object.hasOwn(language, ext) ? language[ext] : undefined;
  if (match) return { kind: "language", tone: match[1], text: match[0] };
  if (/\.(html?|vue|svelte)$/.test(lower)) return { kind: "code", tone: "text-peach" };
  return { kind: "file", tone: "text-subtext-0" };
}

const PATHS: Record<string, string> = {
  file: "M9 2H3v12h10V6zM9 2v4h4",
  folder: "M2 5V4a1 1 0 0 1 1-1h3l2 2h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5Z",
  package: "m8 1 6 3.5v7L8 15l-6-3.5v-7zM2 4.5 8 8l6-3.5M8 8v7M5 2.75l6 3.5v3",
  library: "M2 2h3v12H2zM7 2h3v12H7zM11 3l2-1 2 11-2 1z",
  style: "m6 2-2 12M12 2l-2 12M2 6h12M1 10h12",
  book: "M2 3h5l1 1 1-1h5v10H9l-1 1-1-1H2zM8 4v10",
  code: "m5 5-3 3 3 3m6-6 3 3-3 3M9 3 7 13",
  config: "M5 2H4a1 1 0 0 0-1 1v3L1 8l2 2v3a1 1 0 0 0 1 1h1M11 2h1a1 1 0 0 1 1 1v3l2 2-2 2v3a1 1 0 0 1-1 1h-1",
  branch: "M4 4.5v7M4 9h4a4 4 0 0 0 4-4v-.5",
  image: "M2 2h12v12H2zM2 11l4-4 3 3 2-2 3 3",
};

export function FileIcon({ name, directory = false, open = false }: { name: string; directory?: boolean; open?: boolean }) {
  const { kind, tone, text } = fileAppearance(name, directory);
  return <svg className={cn("size-[calc(14px*var(--zoom,1))] shrink-0", tone)} data-file-icon={kind} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "react" ? <><ellipse cx="8" cy="8" rx="7" ry="2.5" /><ellipse cx="8" cy="8" rx="7" ry="2.5" transform="rotate(60 8 8)" /><ellipse cx="8" cy="8" rx="7" ry="2.5" transform="rotate(120 8 8)" /><circle cx="8" cy="8" r="1" /></>
      : text ? <text x="8" y="11" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="600" fontFamily="var(--font-mono)">{text}</text>
      : <path d={kind === "folder" && open ? "M2 5V3h4l2 2h5v2M2 7h13l-2 6H2z" : PATHS[kind]} />}
    {kind === "branch" && <><circle cx="4" cy="3" r="1.5" /><circle cx="4" cy="13" r="1.5" /><circle cx="12" cy="3" r="1.5" /></>}
    {kind === "image" && <circle cx="10.5" cy="5" r="1" />}
  </svg>;
}

const SYMBOLS: Record<string, string> = { unmodified: "", modified: "M", added: "A", deleted: "D", renamed: "R", copied: "C", typeChanged: "T", untracked: "U", ignored: "I", conflicted: "!" };
const symbol = (state: GitFileState) => typeof state === "string" ? SYMBOLS[state] ?? "?" : "?";
const description = (state: GitFileState) => typeof state === "string" ? state === "unmodified" ? "unmodified" : state === "typeChanged" ? "type changed" : state : `unknown (${state.unknown})`;

export function gitPresentation(entry: GitStatusEntry): { label: string; title: string; tone: string } {
  const index = symbol(entry.index);
  const worktree = symbol(entry.worktree);
  const conflict = index === "!" || worktree === "!";
  const label = conflict ? "!" : entry.staged && entry.unstaged ? `${index || "?"}/${worktree || "?"}` : entry.staged ? index : worktree || index;
  const title = `Git · Index: ${description(entry.index)}; working tree: ${description(entry.worktree)}${entry.originalPath ? `; from ${entry.originalPath}` : ""}`;
  const tone = conflict || label.includes("D") ? "text-red" : label === "U" || label === "A" || label === "C" ? "text-green" : label.includes("?") || label === "I" ? "text-subtext-0" : "text-yellow";
  return { label, title, tone };
}

export interface GitDecoration { entry?: GitStatusEntry; containsChanges?: boolean; conflicted?: boolean }

/** Presentation index over the core's bounded snapshot; never scan the filesystem. */
export function indexGitDecorations(entries: GitStatusEntry[]): Map<string, GitDecoration> {
  const result = new Map<string, GitDecoration>();
  for (const entry of entries) {
    const path = entry.path.replace(/\/+$/, "");
    result.set(path, { ...result.get(path), entry });
    if (!gitPresentation(entry).label || entry.index === "ignored" || entry.worktree === "ignored") continue;
    const paths = [path];
    if (entry.originalPath && (entry.index === "renamed" || entry.worktree === "renamed")) paths.push(entry.originalPath);
    for (const changedPath of paths) {
      let parent = changedPath.lastIndexOf("/");
      while (parent > 0) {
        const folder = changedPath.slice(0, parent);
        const previous = result.get(folder);
        result.set(folder, { ...previous, containsChanges: true, conflicted: previous?.conflicted || entry.index === "conflicted" || entry.worktree === "conflicted" });
        parent = folder.lastIndexOf("/");
      }
    }
  }
  return result;
}

export function GitMarker({ decoration, directory = false }: { decoration?: GitDecoration; directory?: boolean }) {
  if (!decoration) return null;
  if (directory && decoration.containsChanges) return <span className={cn("ml-1 size-1 shrink-0 rounded-full", decoration.conflicted ? "bg-red" : "bg-yellow")} role="img" aria-label={decoration.conflicted ? "Contains Git conflicts" : "Contains Git changes"} title={decoration.conflicted ? "Contains Git conflicts" : "Contains Git changes"} data-testid="file-git-summary" />;
  if (!decoration.entry) return null;
  const { label, title, tone } = gitPresentation(decoration.entry);
  return label ? <span className={cn("ml-1 shrink-0 text-[10px] tabular-nums [font-family:var(--font-mono)]", tone)} aria-label={title} title={title} data-testid="file-git-marker">{label}</span> : null;
}
