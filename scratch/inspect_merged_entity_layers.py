import sys
import os
import ezdxf
from collections import Counter

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
msp = doc.modelspace()

print("\n--- Entities by Layer in Merged DXF ---")
layers_in_entities = [entity.dxf.layer for entity in msp]
counter = Counter(layers_in_entities)
for layer, count in counter.most_common():
    print(f"  {repr(layer)}: {count} entities")

# 一時ファイルを削除
if os.path.exists(output_fn):
    os.remove(output_fn)
