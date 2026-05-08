import sys
import math
from pathlib import Path
import traceback

def run_test():
    filepath = Path(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\2階 床伏図.dxf")
    try:
        from az_bridge.dxf_parser import DxfParser
        parser = DxfParser(filepath)
        print("Parsing DXF with default fallback layers...")
        cols, walls, detected, bound_walls = parser.parse()
        print(f"Result: {len(cols)} column entities, {len(walls)} wall lines")
        print(f"Bound Walls: {len(bound_walls)}")
        
        # 検証：壁の実長と斜め壁判定がどうか、隅柱かどうかの自己評価
        corner_count = 0
        general_count = 0
        
        # 結びついた全柱から評価を出力
        processed_cols = set()
        for w in bound_walls:
            for c in (w.start_column, w.end_column):
                if c and c.id not in processed_cols:
                    processed_cols.add(c.id)
                    if c.position_type == "corner":
                        corner_count += 1
                    else:
                        general_count += 1
                        
        print(f"Columns processed: corner={corner_count}, general={general_count}")
        
        # ランダムに5つ壁を取り出して表示
        for i, w in enumerate(bound_walls[:5]):
            print(f"Wall {w.id}: length={math.floor(w.length)}mm, diag={w.is_diagonal}, "
                  f"start={w.start_column.position_type if w.start_column else 'None'}, "
                  f"end={w.end_column.position_type if w.end_column else 'None'}")
            
    except Exception as e:
        print("Caught exception:")
        traceback.print_exc()

if __name__ == "__main__":
    run_test()
