import re, sys
from collections import Counter
rules = [
 ("QuickJS heap (mod runtimes)", r"\bJS_|js_|quickjs|rquickjs|__JS_|JSRuntime"),
 ("Ghostty terminal (vt pages/scrollback)", r"ghostty|terminal\d*vt|libghostty|_vt_|perch_native8terminal2vt"),
 ("Terminal views (perch terminal)", r"perch_native8terminal"),
 ("Fonts/CoreText", r"CoreText|libFontParser|TFont|CTFont|font_kit|text_system"),
 ("GPUI layout (taffy)", r"taffy"),
 ("GPUI scene/frame/element arena", r"gpui\d*window|gpui\d*scene|gpui\d*arena|gpui\d*element"),
 ("gpui-shell (mod engine, describe/materialize)", r"gpui_shell"),
 ("Metal/AGX driver", r"AGX|Metal|IOGPU|MTL"),
 ("perch client/model (serde)", r"perch_native6client|perch_native7sidebar|serde_json|perch_core"),
 ("perch mods (Rust)", r"perch_native4mods"),
 ("perch workspace/other", r"perch_native"),
 ("AppKit/system", r"AppKit|HIToolbox|CoreFoundation|Foundation|libobjc|dyld"),
]
tot=Counter(); cnt=Counter(); top={}
for line in open(sys.argv[1], errors="replace"):
    m=re.match(r"(\d+) calls? for (\d+) bytes: (.*)", line)
    if not m: continue
    n,b,st=int(m[1]),int(m[2]),m[3]
    cat="other"
    for name,pat in rules:
        if re.search(pat, st): cat=name; break
    tot[cat]+=b; cnt[cat]+=n
    if cat not in top or top[cat][0]<b: top[cat]=(b,st)
all_b=sum(tot.values())
print(f"live total {all_b/1048576:.1f} MB")
for k,v in tot.most_common(): print(f"{v/1048576:8.1f} MB {cnt[k]:8d} blocks  {k}")
