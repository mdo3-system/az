import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# 標準出力のエンコーディングを UTF-8 に変更
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from az_bridge.dxf_parser import DxfParser
import ezdxf

filepath = "data/1F20260605.dxf"
print(f"Running DxfParser on {filepath}...")

parser = DxfParser(
    filepath=filepath,
    column_layers=["LAYER27", "LAYER28", "LAYER29", "LAYER30", "柱"],
    wall_layers=["LAYER31", "壁", "耐力壁"],
    floor_layers=["LAYER49", "通り芯"] # 構面レイヤ設定
)

# ezdxf で直接読み込んで中身を確認
print("\n--- Raw Layer analysis ---")
doc = ezdxf.readfile(filepath)
# 元のレイヤ名
layers = [layer.dxf.name for layer in doc.layers]
print(f"Total layers: {len(layers)}")

# パースの実行
columns, wall_lines, detected_polygons, bound_walls = parser.parse()

print("\n--- Parsed Results ---")
print(f"Parsed Columns count: {len(columns)}")
print(f"Parsed Wall lines count: {len(wall_lines)}")
print(f"Parsed Detected Polygons (Slabs): {len(detected_polygons)}")
print(f"Parsed Bound Walls (N-value walls): {len(bound_walls)}")

# 通り芯の統計（computeGridIntersections の検証）
grid_lines = []
msp = doc.modelspace()
from az_bridge.dxf_merger import ensure_utf8_dxf
# 一度UTF-8に変換されたファイルを読み込んで検証
ensure_utf8_dxf(filepath)
doc_fixed = ezdxf.readfile(filepath)
for entity in doc_fixed.modelspace():
    ln = entity.dxf.layer.upper()
    if ln == 'GLID' or ln == 'GRID' or '通り芯' in ln or '芯' in ln:
        if entity.dxftype() == 'LINE':
            grid_lines.append(entity)
            
print(f"\nGrid Lines (通り芯) found: {len(grid_lines)}")
