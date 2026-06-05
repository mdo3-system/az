import ezdxf
import tempfile
import os
import sys

# 標準出力のエンコーディングを UTF-8 に変更 (errors='replace' で出力時の文字化けによるクラッシュを防ぐ)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

filepath = "data/1F20260605.dxf"
print(f"Testing encoding conversion (sjis -> utf-8) on {filepath}...")

try:
    with open(filepath, "rb") as f:
        binary_content = f.read()
    
    # cp932でデコードして、utf-8で書き出し
    text_content = binary_content.decode("cp932", errors="replace")
    
    if "$DWGCODEPAGE" in text_content:
        text_content = text_content.replace("ANSI_932", "UTF-8")
    
    utf8_content = text_content.encode("utf-8", errors="replace")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".dxf") as tmp:
        tmp.write(utf8_content)
        tmp_path = tmp.name
        
    print(f"Converted temporary file created: {tmp_path}")
    
    doc = ezdxf.readfile(tmp_path)
    msp = doc.modelspace()
    
    layer_names = set()
    for entity in msp:
        layer_names.add(entity.dxf.layer)
        
    print("\n--- Layers read after sjis->utf8 conversion ---")
    for name in sorted(layer_names):
        # repr(name) ではなく、直接 print して safe にする
        print(f"  Layer: {name}")
        
except Exception as e:
    import traceback
    print("Error:")
    traceback.print_exc()
finally:
    if 'tmp_path' in locals() and os.path.exists(tmp_path):
        os.remove(tmp_path)
