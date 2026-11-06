#!/usr/bin/env python3
"""Regenerate crates/perch-core/src/native_ui/slash_commands.json from the installed CLIs.

No CLI exposes its built-in slash commands to another process, so this reads what a person sees: it
opens each CLI in a throwaway tmux pane, types `/`, and scrolls the menu (Claude, Codex, OMP); Pi's
list comes from its exported BUILTIN_SLASH_COMMANDS. Needs tmux, node, and the CLIs on PATH.
Costs no tokens and sends no prompt. Review the diff: menus vary with account, plugins and flags.

Claude: a menu entry counts as built-in when its name appears in the binary's command registry and
is not one of the session's skills (so the user's own skills and plugins stay out of the data).
OMP: its menu shows live state ("Plan: off"), so those rows get the neutral prose in OMP_PROSE.

A missing CLI, an unreadable file or an unexpected output stops the script with its traceback:
a half-written catalog is worse than none, and nothing is written until every requested CLI answered.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "../crates/perch-core/src/native_ui/slash_commands.json")
CWD = os.path.join(HERE, "..")
# Promotional or account-only entries that would only be noise in a picker.
CLAUDE_SKIP = {"stickers", "radio", "powerup", "rate-limit-options"}
OMP_LIVE = {"skill:", "skill", "autoresearch", "green", "review", "annotate"}  # added by the session itself
OMP_PROSE = {"model": "Select the model", "switch": "Select a temporary model", "plan": "Toggle plan mode",
  "compact": "Compact the conversation context", "clear": "Clear context, keep the session", "context": "Show estimated context usage",
  "fast": "Toggle fast mode", "effort": "Set the thinking effort", "goal": "Set or view the goal", "loop": "Toggle loop mode",
  "jobs": "Show background jobs", "todo": "Show todos", "tools": "Show available tools", "fresh": "Start fresh from this context",
  "advisor": "Configure the advisor", "extended-context": "Toggle extended context", "collab": "Toggle collaboration",
  "slow": "Toggle slow mode", "skillful": "Toggle skill listing", "computer": "Toggle computer use",
  "modelpreset": "Manage model presets", "plan-review": "Review the current plan", "vibe": "Toggle vibe mode",
  "browser": "Choose the browser mode", "login": "Choose a provider to log in to", "force": "Force tool use",
  "leave": "Leave a collab session", "reload-plugins": "Reload plugins, skills, commands and hooks"}


def clean(text):
    return re.sub(r"[│┃\s]+$", "", text.strip()).rstrip("…").strip()


def run(*args, **kwargs):
    return subprocess.run(args, capture_output=True, text=True, **kwargs).stdout


def read_json(path):
    try:
        with open(path, encoding="utf-8") as file:
            return json.load(file)
    except (OSError, ValueError) as error:
        sys.exit(f"cannot read {path}: {error}")


def write_json(path, value):
    try:
        with open(path, "w", encoding="utf-8") as file:
            json.dump(value, file, indent=1, ensure_ascii=False)
            file.write("\n")
    except OSError as error:
        sys.exit(f"cannot write {path}: {error}")


def require(name):
    path = shutil.which(name)
    if path is None:
        sys.exit(f"{name} is not on PATH")
    return path


def scrape(command, pages=30):
    """Every menu row the CLI shows after `/`, by paging down; returns the captured screen text."""
    name = f"slashcap{os.getpid()}"
    subprocess.run(["tmux", "new-session", "-d", "-s", name, "-x", "220", "-y", "80", f"cd {CWD} && {command}"], check=True)
    try:
        time.sleep(10)  # the CLI has to finish starting before it reads keys
        subprocess.run(["tmux", "send-keys", "-t", name, "/"], check=True)
        time.sleep(2)
        screens = []
        for _ in range(pages):
            screens.append(run("tmux", "capture-pane", "-t", name, "-p"))
            for _ in range(8):
                subprocess.run(["tmux", "send-keys", "-t", name, "Down"], check=True)
            time.sleep(0.25)
        return "\n".join(screens)
    finally:
        subprocess.run(["tmux", "kill-session", "-t", name])


def rows(screen, pattern):
    seen = {}
    for line in screen.splitlines():
        match = re.match(pattern, line)
        if match and match.group(1) not in seen:
            seen[match.group(1)] = clean(match.group(2))
    return seen


def claude():
    binary = os.path.realpath(require("claude"))
    init = None
    probe = run("claude", "-p", "/effort", "--output-format", "stream-json", "--verbose", "--no-session-persistence",
                stdin=subprocess.DEVNULL, cwd=tempfile.gettempdir())
    for line in probe.splitlines():
        try:
            value = json.loads(line)
        except ValueError:
            continue
        if value.get("type") == "system" and value.get("subtype") == "init":
            init = value
            break
    if init is None:
        sys.exit("claude printed no system/init line")
    registry = set(re.findall(r'name:"([a-z][a-z0-9:-]*)"', run("strings", "-n", "4", binary)))
    menu = rows(scrape("claude --model claude-haiku-4-5"), r"^\s+/([a-zA-Z0-9:_-]+)\s{2,}(.*\S)\s*$")
    skills = set(init["skills"])
    commands = [{"name": n, "description": d} for n, d in menu.items() if n in registry and n not in skills and n not in CLAUDE_SKIP]
    return run("claude", "--version").split()[0], commands


def codex():
    require("codex")
    menu = rows(scrape("codex"), r"^[^/]*/([a-z][a-z0-9-]*)\s{2,}(\S.*?)\s*$")
    return run("codex", "--version").split()[-1], [{"name": n, "description": d} for n, d in menu.items()]


def omp():
    require("omp")
    menu = rows(scrape("omp"), r"^(?:❯)?\s*\S+\s+([a-z][a-z0-9:-]*):?\s{2,}(\S.*?)\s*$")
    commands = []
    for name, prose in menu.items():
        if name in OMP_LIVE:
            continue
        stateful = bool(re.match(r"^[A-Za-z ]+: ", prose))
        description = OMP_PROSE.get(name, "" if stateful else prose)
        commands.append({"name": name, **({"description": description} if description else {})})
    return run("omp", "--version").split("/")[-1].strip(), commands


def pi():
    root = run("npm", "root", "-g").strip()
    package = f"{root}/@earendil-works/pi-coding-agent"
    script = f'import("{package}/dist/core/slash-commands.js").then(m=>console.log(JSON.stringify(m.BUILTIN_SLASH_COMMANDS)))'
    try:
        listed = json.loads(run("node", "-e", script))
    except ValueError as error:
        sys.exit(f"pi's BUILTIN_SLASH_COMMANDS did not print JSON: {error}")
    version = read_json(f"{package}/package.json")["version"]
    return version, [{"name": c["name"], "description": c["description"], **({"argumentHint": c["argumentHint"]} if c.get("argumentHint") else {})} for c in listed]


if __name__ == "__main__":
    captures = {"claude": claude, "codex": codex, "pi": pi, "omp": omp}
    wanted = sys.argv[1:] or list(captures)
    require("tmux")
    data = read_json(OUT)
    for agent in wanted:
        version, commands = captures[agent]()
        data[agent] = {"version": version, "commands": commands}
        print(f"{agent} {version}: {len(commands)} commands")
    write_json(OUT, data)
