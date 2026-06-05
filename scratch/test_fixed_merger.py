import sys
import os
import ezdxf
from collections import Counter

# surrogateescape で読まれた文字列を正しい文字列に直す関数
def fix_encoding(s):
    try:
        return s.encode('utf-8', 'surrogateescape').decode('cp932')
    except Exception:
        try:
            return s.encode('utf-16-le', 'surrogatepass').decode('utf-16-le')
        except Exception:
            return s

RENAME_MAP = {
    "通り芯": "GLID",
    "柱": "COL",
    "耐力壁": "WALL_BRACED",
    "壁": "WALL_NORMAL"
}

def resolve_layer(orig, lbl):
    fixed = fix_encoding(orig)
    for k, v in RENAME_MAP.items():
        if k in fixed:
            return v if v == "GLID" else f"{v}_{lbl}"
    return f"{fixed}_{lbl}"

filepath = "data/1F20260605.dxf"
print(f"Testing fix_encoding + resolve_layer on {filepath}...")

doc = ezdxf.readfile(filepath, encoding='cp932')
msp = doc.modelspace()

resolved_layers = []
for entity in msp:
    orig_layer = entity.dxf.layer
    new_layer = resolve_layer(orig_layer, "1F")
    resolved_layers.append(new_layer)

counter = Counter(resolved_layers)
print("\n--- Top 20 Resolved Layers ---")
for layer, count in counter.most_common(20):
    print(f"  {repr(layer)}: {count} entities")
