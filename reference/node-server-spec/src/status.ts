import fs from "node:fs";
import path from "node:path";

export interface LastUsage {
  contextTokens?: number;
  costUsd?: number;
}

export interface StatusInfo {
  cwd: string;
  branch: string;
  contextTokens?: number;
  costUsd?: number;
}

/** Reads the current branch by walking up from `cwd` to find `.git/HEAD`
 * and parsing it directly, rather than shelling out to `git`. */
export function getBranch(cwd: string): string {
  try {
    const headPath = findGitHead(cwd);
    if (!headPath) return "";
    const head = fs.readFileSync(headPath, "utf8").trim();
    const match = head.match(/^ref:\s*refs\/heads\/(.+)$/);
    if (match?.[1]) return match[1];
    return head.slice(0, 7); // detached HEAD: short sha
  } catch {
    return "";
  }
}

function findGitHead(startDir: string): string | undefined {
  let dir = path.resolve(startDir);
  for (;;) {
    const gitDir = path.join(dir, ".git");
    const headFile = path.join(gitDir, "HEAD");
    if (fs.existsSync(headFile) && fs.statSync(gitDir).isDirectory()) {
      return headFile;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** cwd + branch, plus context/cost placeholders filled in from the last
 * `chat.done` usage seen for the session (undefined until a turn completes). */
export function getStatus(cwd: string, last?: LastUsage): StatusInfo {
  return {
    cwd,
    branch: getBranch(cwd),
    contextTokens: last?.contextTokens,
    costUsd: last?.costUsd,
  };
}
