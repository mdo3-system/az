import ezdxf
import tempfile
import os

filepath = "data/1F20260605.dxf"
print(f"Testing header hack on {filepath}...")

# 1. ファイルをテキストとして読み込み、AC1027 を AC1009 に書き換える
# (errors='ignore' で読み込んで書き換える)
with open(filepath, "r", encoding="cp932", errors="ignore") as f:
    content = f.read()

# AC1027 を AC1009 に置換
hacked_content = content.replace("AC1027", "AC1009")

# 一時ファイルに保存
with tempfile.NamedTemporaryFile(delete=False, suffix=".dxf", mode="w", encoding="cp932", errors="ignore") as tmp:
    tmp.write(hacked_content)
    tmp_path = tmp.name

try:
    # 2. AC1009 として cp932 で読み込む
    doc = ezdxf.readfile(tmp_path, encoding="cp932")
    msp = doc.modelspace()
    
    layer_names = set()
    for entity in msp:
        layer_names.add(entity.dxf.layer)
        
    print("\n--- Layers read with Header Hack (AC1009 + cp932) ---")
    for name in sorted(layer_names):
        print(f"  {repr(name)}")
finally:
    if os.path.exists(tmp_path):
        os.remove(tmp_path)
