import sys
import os
import ezdxf

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from az_bridge.dxf_merger import merge_dxf_files

files_dict = {
    "1F": "data/1F20260605.dxf",
    "2F": "data/2F20260605.dxf",
    "3F": "data/3F20260605.dxf"
}

output_fn, total_lines = merge_dxf_files(files_dict)
print(f"Merged output: {output_fn}")

doc = ezdxf.readfile(output_fn)
print("\n--- Layers in Merged DXF ---")
layer_names = [layer.dxf.name for layer in doc.layers]
for name in sorted(layer_names):
    print(f"  {repr(name)}")

# 一時ファイルを削除
if os.path.exists(output_fn):
    os.remove(output_fn)
