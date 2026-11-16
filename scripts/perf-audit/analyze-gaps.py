"""Latency per action from the offscreen harness's PERCH_NATIVE_PERF log.

The harness loop is: run tasks (and draw what changed), present, sleep 16 ms. So the gap between two
frame ticks is 16 ms plus whatever the main thread did. A tick gap over BUSY ms is a busy tick.
For each step: settle = end of the last busy tick of the burst after the step started (busy ticks no
more than QUIET ms apart); block = the longest single tick gap minus 16 ms (the longest freeze);
busy = total main-thread time over 16 ms per tick in the burst.
"""
import re, statistics, sys
from collections import defaultdict

BUSY, QUIET, SLEEP = 24.0, 300.0, 16.0
steps, ticks = [], []
for line in open(sys.argv[1], errors="replace"):
    m = re.match(r"perf-step t=([\d.]+) n=(\d+) (.*)", line)
    if m:
        steps.append((float(m[1]), m[3].strip()))
        continue
    m = re.match(r"perf-frame t=([\d.]+)", line)
    if m:
        ticks.append(float(m[1]))


def label(text):
    text = re.sub(r'String\("[0-9a-f-]{36}"\)', '…', text)
    text = re.sub(r'Array \[[^\]]+\]', '[all]', text)
    text = re.sub(r'workspace: "[^"]*"', 'workspace: …', text)
    return text.replace('Command { name: ', '').replace(', args: None }', '').replace('Object ', '')


out = defaultdict(list)
for i, (t0, text) in enumerate(steps):
    end = steps[i + 1][0] if i + 1 < len(steps) else float("inf")
    ts = [t0] + [t for t in ticks if t0 < t < end]
    gaps = [(b - a, b) for a, b in zip(ts, ts[1:])]
    busy = [(g, t) for g, t in gaps if g > BUSY]
    if not busy:
        out[label(text)].append((0.0, 0.0, 0.0))
        continue
    burst = [busy[0]]
    for g, t in busy[1:]:
        if t - g - burst[-1][1] > QUIET:
            break
        burst.append((g, t))
    settle = burst[-1][1] - t0
    out[label(text)].append((settle, max(g for g, _ in burst) - SLEEP, sum(g - SLEEP for g, _ in burst)))


def pct(v, q):
    v = sorted(v)
    return v[min(len(v) - 1, int(round(q * (len(v) - 1))))]


print(f"{'action':72} {'n':>2} {'settle p50':>10} {'p95':>6} {'worst':>6} {'block p50':>9} {'block max':>9} {'busy p50':>8}")
for name, runs in sorted(out.items(), key=lambda kv: -max(r[0] for r in kv[1])):
    s = [r[0] for r in runs]
    print(f"{name[:72]:72} {len(runs):2} {pct(s, .5):10.0f} {pct(s, .95):6.0f} {max(s):6.0f}"
          f" {pct([r[1] for r in runs], .5):9.0f} {max(r[1] for r in runs):9.0f} {pct([r[2] for r in runs], .5):8.0f}")
