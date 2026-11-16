"""Memory budgets of the native client (docs/TESTING.md), checked against the results file of
scripts/measure-native-memory.sh: one `app state value` line per measurement, MB medians of the
hidden window under `native-hidden1` (or, from an --offscreen run, `native-offscreen`), and
`native-hidden1-webcontent-gone h 1|0` for the closed pane. An offscreen run presents every frame into
GPU targets a hidden window does not hold, so its idle footprint is not judged against the idle budget:
only the growth over its own idle is.

    python3 -I scripts/native-memory-budgets.py <results.tsv>   prints the table, exits 1 when over
    python3 -I scripts/native-memory-budgets.py --self-test
"""
import sys

IDLE_MB = 120
OVER_IDLE_MB = {"t": ("files, 5,000 entries", 60), "e": ("10,000-line file open", 35),
                "f": ("review, 5,000 lines", 80), "g": ("one browser pane", 100)}
CLOSED_PANE_MB = 40  # client plus the GPU and Networking helpers WebKit keeps for the app's life


def judge(rows):
    """rows: {(app, state): value} -> (table lines, every budget held)."""
    app = "native-hidden1" if any(a == "native-hidden1" for a, _ in rows) else "native-offscreen"
    get = lambda s: rows.get((app, s))
    idle, lines, ok_all = get("a"), [], True

    def check(label, measured, limit, ok):
        nonlocal ok_all
        ok_all &= ok
        lines.append(f"{label:30}{measured:>16}{limit:>22}  {'ok' if ok else 'OVER'}")

    if idle is not None and app == "native-offscreen":
        lines.append(f"{'a idle (offscreen, not judged)':30}{idle:>13.1f} MB")
    elif idle is not None:
        check("a idle", f"{idle:.1f} MB", f"{IDLE_MB} MB", idle <= IDLE_MB)
    for s, (name, budget) in OVER_IDLE_MB.items():
        if get(s) is None:
            continue
        if idle is None:
            raise ValueError(f"state {s} needs state a in the same run for its budget")
        check(f"{s} {name}", f"+{get(s) - idle:.1f} MB", f"+{budget} MB", get(s) - idle <= budget)
    if get("h") is not None:
        if idle is None:
            raise ValueError("state h needs state a in the same run for its budget")
        gone = rows.get(("native-hidden1-webcontent-gone", "h")) == 1
        check("h pane closed: WebContent gone", "yes" if gone else "no", "within 5 s", gone)
        check("h pane closed: memory", f"+{get('h') - idle:.1f} MB", f"+{CLOSED_PANE_MB} MB",
              get("h") - idle <= CLOSED_PANE_MB)
    return lines, ok_all


def self_test():
    rows = lambda **kv: {(("native-hidden1-webcontent-gone" if k == "gone" else "native-hidden1"), "h" if k == "gone" else k): v for k, v in kv.items()}
    assert judge(rows(a=115, e=140, g=210, h=155, gone=1))[1]
    assert not judge(rows(a=115, e=150.1))[1], "e over +35"
    assert not judge(rows(a=120.1))[1], "idle over 120"
    assert not judge(rows(a=115, h=120, gone=0))[1], "WebContent left"
    assert not judge(rows(a=115, h=155.1, gone=1))[1], "closed pane kept memory"
    assert judge(rows(a=115, b=300))[1], "states without a budget are not judged"
    offscreen = lambda e: {("native-offscreen", "a"): 230.0, ("native-offscreen", "e"): e}
    assert judge(offscreen(265))[1], "an offscreen run's idle is not judged"
    assert not judge(offscreen(265.1))[1], "an offscreen run's growth is judged by the same budgets"
    try:
        judge(rows(e=140))
        raise AssertionError("a budget over idle needs idle")
    except ValueError:
        pass
    print("native-memory-budgets self-test: ok")


def main(argv):
    if argv == ["--self-test"]:
        self_test()
        return 0
    if len(argv) != 1:
        print(__doc__, file=sys.stderr)
        return 2
    rows = {}
    for line in open(argv[0]):
        app, state, value = line.split()
        rows[(app, state)] = float(value)
    try:
        lines, ok = judge(rows)
    except ValueError as error:
        print(error, file=sys.stderr)
        return 1
    if lines:
        print("\nBudgets, native client, window hidden (median MB over state a of this run)")
        print(f"{'state':30}{'measured':>16}{'budget':>22}")
        print("\n".join(lines))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
