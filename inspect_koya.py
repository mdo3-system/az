import sys
from pathlib import Path
import ezdxf
from collections import defaultdict
from shapely.geometry import MultiLineString
from shapely.ops import polygonize

def analyze_dxf(filepath):
    print(f"--- Analyzing {filepath.name} ---")
    try:
        doc = ezdxf.readfile(str(filepath))
    except Exception:
        doc = ezdxf.readfile(str(filepath), encoding="cp932")
        
    msp = doc.modelspace()
    
    # Collect all lines by layer (including inside INSERT blocks)
    lines_by_layer = defaultdict(list)
    
    def process_block(block, offset_x=0, offset_y=0):
        for entity in block:
            etype = entity.dxftype()
            layer = entity.dxf.layer if hasattr(entity.dxf, 'layer') else 'UNKNOWN'
            
            if etype == "LINE":
                s = entity.dxf.start
                e = entity.dxf.end
                lines_by_layer[layer].append(((s.x + offset_x, s.y + offset_y), (e.x + offset_x, e.y + offset_y)))
            elif etype == "INSERT":
                b_name = entity.dxf.name
                insert_pt = entity.dxf.insert
                if b_name in doc.blocks:
                    process_block(doc.blocks[b_name], offset_x + insert_pt.x, offset_y + insert_pt.y)
                    
    process_block(msp)
    
    # 1. Check LAYER110 or 110
    layer110_candidates = [l for l in lines_by_layer.keys() if l in ("LAYER110", "110", "LAYER 110", "110 ")]
    print(f"\n1. LAYER110 存在確認:")
    if layer110_candidates:
        for lc in layer110_candidates:
            print(f"  レイヤ '{lc}' に {len(lines_by_layer[lc])} 本の LINE が存在します。")
    else:
        print("  LAYER110 または 110 に該当するレイヤは見つかりませんでした。")
        
    print(f"\n2. LINE/LWPOLYLINE が多い抽出候補上位レイヤ:")
    top_layers = sorted(lines_by_layer.items(), key=lambda x: -len(x[1]))[:5]
    for layer, lines in top_layers:
        print(f"  {layer:15}: {len(lines)} 本の LINE")
        
    # 3. Simulate polygonize
    print(f"\n3. ポリゴン化のシミュレーション:")
    target_layers = layer110_candidates if layer110_candidates else ["LAYER79"] # Assuming 79 might be the target based on previous dump
    
    def snap(v): return round(v, 1)
    
    for layer in target_layers:
        lines = lines_by_layer.get(layer, [])
        if not lines:
            continue
            
        print(f"\n  [{layer}] の線分（{len(lines)}本）に対する polygonize テスト...")
        snapped_lines = []
        for (sx, sy), (ex, ey) in lines:
            s = (snap(sx), snap(sy))
            e = (snap(ex), snap(ey))
            if s != e:
                snapped_lines.append((s, e))
                
        mls = MultiLineString(snapped_lines)
        raw_polys = list(polygonize(mls))
        
        valid_polys = [p for p in raw_polys if p.is_valid and not p.is_empty and p.area >= 10000]
        
        print(f"    結果: {len(raw_polys)} 個のポリゴン（うち面積10,000mm2以上: {len(valid_polys)} 個）が復元されました。")
        
        if len(raw_polys) == 0:
            print("    -> 【エラー】閉じたポリゴンが全く形成されませんでした。線分の端点（隙間）に問題がある可能性があります。")
            import pprint
            # 抽出された端点の一部を表示して隙間を確認
            endpoints = set()
            for (sx, sy), (ex, ey) in snapped_lines:
                endpoints.add((sx, sy))
                endpoints.add((ex, ey))
            print(f"    -> スナップ済みのユニークな端点数: {len(endpoints)}")

if __name__ == "__main__":
    d2 = Path(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\小屋伏図.dxf")
    analyze_dxf(d2)
