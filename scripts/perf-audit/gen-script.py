"""Writes the test-mode scripts for the audit from the run's sessions and workspace.

python3 -I gen-script.py RUN_DIR REPEATS
  RUN_DIR/script-open.txt     opens 7 tabs (the owner's shape), then idles
  RUN_DIR/script-actions.txt  the same, then each timed action REPEATS times, 2 s apart
"""
import json, sqlite3, sys, pathlib

run = pathlib.Path(sys.argv[1]); repeats = int(sys.argv[2])
db = sqlite3.connect(run / "data/history.sqlite")
rows = db.execute("select id from sessions order by created_at").fetchall()
sessions = [r[0] for r in rows]
ws = (run / "workspace").read_text().strip()
projects = [r[0] for r in db.execute("select id from projects").fetchall()]
long_session = sessions[0]  # shell 1 holds 20,000 lines of scrollback
tabs = sessions[:7]
others = sessions[7:]

opening = ["pause 5000"] + [f"command session.open {json.dumps({'id': s})}\npause 700" for s in tabs] + ["pause 3000"]
(run / "script-open.txt").write_text("\n".join(opening + ["pause 3600000"]) + "\n")

gap = "pause 2000"
acts = list(opening)
acts += ["sidebar " + json.dumps({"showTerminals": True}), "pause 4000"]
for i in range(repeats):
    acts += [f"command tab.select {json.dumps({'id': tabs[(i + 1) % 7]})}", gap]
    acts += [f"command tab.select {json.dumps({'id': long_session})}", gap]
    acts += [f"command session.open {json.dumps({'id': others[i % len(others)]})}", gap]
    acts += ["command global.drawer", gap, "command global.drawer", gap]
    acts += ["sidebar " + json.dumps({"showTerminals": False}), gap]
    acts += ["sidebar " + json.dumps({"showTerminals": True}), gap]
    acts += [f"sidebar {json.dumps({'collapsedProjects': projects})}", gap]
    acts += ["sidebar " + json.dumps({"collapsedProjects": []}), gap]
    acts += ["command global.settings", gap, "command overlay.close", gap]
    acts += [f"file {ws} small.rs", gap, "close", gap]
    acts += [f"file {ws} big.rs", gap, "close", gap]
    acts += [f"command tab.select {json.dumps({'id': long_session})}", gap]
    acts += ["command terminal.scrollTop", gap, "command terminal.scrollPageDown", gap,
             "command terminal.scrollBottom", gap]
    acts += ["resize 1000x700", gap, "resize 1280x800", gap]
(run / "script-actions.txt").write_text("\n".join(acts + ["pause 3600000"]) + "\n")
print(f"{len(sessions)} sessions, {len(projects)} projects, workspace {ws}")
