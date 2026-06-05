import ezdxf

filepath = "data/1F20260605.dxf"
print(f"Reading layers for {filepath}...")
doc = ezdxf.readfile(filepath, encoding='cp932')

print("\n--- Layers in document ---")
layer_names = [layer.dxf.name for layer in doc.layers]
for name in sorted(layer_names):
    print(f"  {repr(name)}")

# 通り芯、柱、壁、COL, WALL などのキーワードを含むレイヤがあるか
print("\n--- Keyword Matching ---")
keywords = ["通り芯", "芯", "GRID", "GLID", "柱", "COL", "壁", "WALL", "耐力"]
for name in sorted(layer_names):
    matched = [kw for kw in keywords if kw.lower() in name.lower()]
    if matched:
        print(f"  {repr(name)} matches: {matched}")
