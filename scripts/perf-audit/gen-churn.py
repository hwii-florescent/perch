import json, sqlite3, sys, pathlib
run = pathlib.Path(sys.argv[1]); cycles = int(sys.argv[2])
db = sqlite3.connect(run / "data/history.sqlite")
s = [r[0] for r in db.execute("select id from sessions order by created_at")]
ws = (run / "workspace").read_text().strip()
proj = [r[0] for r in db.execute("select id from projects")]
o = lambda i: f"command session.open {json.dumps({'id': i})}"
tabs = s[:7]
acts = ["pause 5000"] + [f"{o(i)}\npause 700" for i in tabs] + ["sidebar " + json.dumps({"showTerminals": True}), "pause 3000"]
g = "pause 1000"
for c in range(cycles):
    for t in tabs: acts += [f"command tab.select {json.dumps({'id': t})}", g]
    acts += [f"file {ws} big.rs", g, "close", g, f"file {ws} small.rs", g, "close", g]
    acts += ["command global.drawer", g, "command global.drawer", g]
    acts += ["command global.settings", g, "command overlay.close", g]
    acts += ["sidebar " + json.dumps({"showTerminals": c % 2 == 1}), g]
    acts += [f"sidebar {json.dumps({'collapsedProjects': proj if c % 2 else []})}", g]
(run / "script-churn.txt").write_text("\n".join(acts + ["pause 3600000"]) + "\n")
print(len(acts))
