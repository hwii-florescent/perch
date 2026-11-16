"""Growth of live malloc between two `malloc_history -allBySize` dumps, by the deepest perch/gpui/JS frame pair.

python3 -I mh-diff.py A B
"""
import re, sys
from collections import Counter


def load(path):
    out = Counter(); n = Counter()
    for line in open(path, errors="replace"):
        m = re.match(r"(\d+) calls? for (\d+) bytes: (.*)", line)
        if not m:
            continue
        frames = [f.strip() for f in m[3].split("|")]
        leaf = frames[-1]
        if not re.search(r"malloc|calloc|realloc|memalign", leaf):
            continue
        ours = [re.sub(r"0x[0-9a-f]+ \([^)]*\) ", "", f) for f in frames
                if re.search(r"perch-native|measure_offscreen", f)]
        ours = [re.sub(r"_R[A-Za-z0-9]*?Cs[0-9A-Za-z_]{9,13}_|Cs[0-9A-Za-z_]{9,13}_", "", f)[:70] for f in ours]
        js = [f for f in ours if f.startswith(("JS_", "js_", "__JS"))]
        rust = [f for f in ours if not f.startswith(("JS_", "js_", "__JS", "_RNvMs1_Nt10async_task"))]
        key = " > ".join(rust[-3:]) + (" || " + " > ".join(js[-2:]) if js else "")
        out[key] += int(m[2]); n[key] += int(m[1])
    return out, n


a, na = load(sys.argv[1]); b, nb = load(sys.argv[2])
print(f"live malloc: {sum(a.values())/1048576:.1f} MB -> {sum(b.values())/1048576:.1f} MB")
growth = Counter({k: b[k] - a.get(k, 0) for k in b})
for k, v in growth.most_common(15):
    print(f"{v/1048576:+7.1f} MB ({nb[k] - na.get(k, 0):+d} blocks)  {k}")
