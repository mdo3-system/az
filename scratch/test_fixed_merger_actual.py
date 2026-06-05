import ezdxf

def fix_encoding(s: str) -> str:
    try:
        # UTF-8 + surrogateescape で化けた Shift-JIS バイト列を復元して再デコード
        return s.encode('utf-8', 'surrogateescape').decode('cp932')
    except Exception:
        return s

filepath = "data/1F20260605.dxf"
print(f"Testing fix_encoding on actual layer names of {filepath}...")

# AC1027なので強制的に UTF-8 で読み込まれる
doc = ezdxf.readfile(filepath)
msp = doc.modelspace()

layer_names = set()
for entity in msp:
    layer_names.add(entity.dxf.layer)

print("\n--- Original vs Fixed Layer Names ---")
for name in sorted(layer_names):
    fixed = fix_encoding(name)
    if fixed != name:
        print(f"  Original: {repr(name)} -> Fixed: {repr(fixed)}")
    else:
        print(f"  Unchanged: {repr(name)}")
