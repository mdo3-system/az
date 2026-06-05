import sys
import os
from collections import Counter

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# 標準出力のエンコーディングを UTF-8 に変更
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import ezdxf
from az_bridge.dxf_parser import DxfParser
from az_bridge.dxf_merger import ensure_utf8_dxf

filepath = "data/1F20260605.dxf"
print(f"--- Detailed DxfParser analysis for {filepath} ---")

# 事前に UTF-8 変換を確実に行う
ensure_utf8_dxf(filepath)

# 1. DxfParserの内部動作を手動でシミュレートして詳細を表示
doc = ezdxf.readfile(filepath)
parser = DxfParser(filepath)

# _expand_all_inserts の実行
layer_blocks, layer_polygons = parser._expand_all_inserts(doc)

print("\n[Layer Blocks Summary]")
for layer, blocks in sorted(layer_blocks.items()):
    total_lines = sum(len(lines) for lines in blocks)
    print(f"  Layer {repr(layer)}: {len(blocks)} blocks, {total_lines} total lines")

print("\n[Layer Polygons Summary]")
for layer, polys in sorted(layer_polygons.items()):
    print(f"  Layer {repr(layer)}: {len(polys)} polygons")

# 2. 柱レイヤの解析 (柱は '柱' レイヤまたは 'COL' などのレイヤ)
print("\n[Column Analysis]")
column_candidates = ["柱", "COL", "LAYER27", "LAYER28", "LAYER29", "LAYER30"]
for col_layer in column_candidates:
    matched_layers = [l for l in layer_blocks.keys() if col_layer.upper() in l.upper()]
    for ml in matched_layers:
        blocks = layer_blocks[ml]
        # 重心計算による柱の検出シミュレーション
        columns_in_layer = []
        for block_lines in blocks:
            for i in range(0, len(block_lines), 4):
                chunk = block_lines[i:i+4]
                if len(chunk) < 4: continue
                pts = []
                for (sx, sy), (ex, ey) in chunk:
                    pts.extend([(sx, sy), (ex, ey)])
                cx = sum(p[0] for p in pts) / len(pts)
                cy = sum(p[1] for p in pts) / len(pts)
                columns_in_layer.append((cx, cy))
        print(f"  Layer {repr(ml)}: Detected {len(columns_in_layer)} columns (using 4-lines rectangles)")

# 3. 通り芯レイヤの解析
print("\n[Grid Analysis]")
grid_candidates = ["通り芯", "芯", "GRID", "GLID"]
for grid_layer in grid_candidates:
    matched_layers = [l for l in layer_blocks.keys() if grid_layer.upper() in l.upper()]
    for ml in matched_layers:
        blocks = layer_blocks[ml]
        total_lines = sum(len(lines) for lines in blocks)
        print(f"  Layer {repr(ml)}: {len(blocks)} blocks, {total_lines} lines (raw)")
        
        # 実際に computeGridIntersections に通した際の挙動
        # (水平・垂直に分類される線)
        h_count = 0
        v_count = 0
        for block_lines in blocks:
            for (sx, sy), (ex, ey) in block_lines:
                dx = abs(ex - sx)
                dy = abs(ey - sy)
                if dx > dy * 3:
                    h_count += 1
                elif dy > dx * 3:
                    v_count += 1
        print(f"    -> Classified as Horizontal: {h_count}, Vertical: {v_count}")
