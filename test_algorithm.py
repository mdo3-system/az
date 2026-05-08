from az_bridge.dxf_parser import DxfParser
from az_bridge.models import WallLine, ColumnPoint
from az_bridge.n_value_calculator import Column, Wall
import math

def test_binding_and_evaluation():
    parser = DxfParser(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\2階 床伏図.dxf")
    
    # 疑似データ作成
    # 柱: (0,0), (1000,0), (0, 1000), (1000, 1000) -> 四角形のコーナー
    # 柱: (500, 0) -> 中間柱（T字）
    # 柱: (500, 500) -> 十字柱
    cols = [
        Column(id="C1", x=0, y=0),
        Column(id="C2", x=1000, y=0),
        Column(id="C3", x=0, y=1000),
        Column(id="C4", x=1000, y=1000),
        Column(id="C5", x=500, y=0),   # T junction
    ]
    
    # 壁: 四辺形とT字部分
    walls = [
        WallLine(start=(0,0), end=(500,0), layer="W"),
        WallLine(start=(500,0), end=(1000,0), layer="W"),
        WallLine(start=(1000,0), end=(1000,1000), layer="W"),
        WallLine(start=(0,1000), end=(1000,1000), layer="W"),
        WallLine(start=(0,0), end=(0,1000), layer="W"),
        WallLine(start=(500,0), end=(500,1000), layer="W"), # 縦の中央壁
        # 追加: 新たな斜め壁
        WallLine(start=(0,0), end=(1000,1000), layer="W"), 
    ]
    
    bound_walls = parser._bind_walls_to_columns(walls, cols, tolerance=5.0)
    
    print(f"Bound walls: {len(bound_walls)}")
    
    for c in cols:
        print(f"Column {c.id} ({c.x}, {c.y}) -> type: {c.position_type}")
        for w in c.attached_walls:
            print(f"  - Attached: {w.id} (length: {w.length:.1f}, diag: {w.is_diagonal})")

if __name__ == "__main__":
    test_binding_and_evaluation()
