import math
from dataclasses import dataclass, field
from typing import List, Optional

@dataclass
class Wall:
    id: str
    start_column: Optional['Column'] = field(default=None, repr=False)
    end_column: Optional['Column'] = field(default=None, repr=False)
    length: float = 0.0
    multiplier: float = 0.0  # アーキのDXFからは取れない前提のため、初期値0.0
    angle_rad: float = 0.0   # ユークリッド距離算出時に角度も保持

    @property
    def is_diagonal(self) -> bool:
        """壁が斜め壁（X軸・Y軸に平行でない）かどうかを判定する"""
        if self.length == 0:
            return False
        # ラジアンを度数に変換し、90度で割った余りをチェック
        deg = math.degrees(self.angle_rad) % 90
        # 許容誤差（例: 1度）を設定して判定
        return 1.0 < deg < 89.0

@dataclass
class Column:
    id: str
    x: float
    y: float
    attached_walls: List[Wall] = field(default_factory=list, repr=False)
    position_type: str = "general"  # "general"(一般柱), "corner"(隅柱)

    def evaluate_position_type(self):
        """
        取り付いている壁の情報から柱の配置タイプ（隅柱か否か）を判定する。
        """
        if not self.attached_walls:
            return

        # 1. 斜め壁が1つでも取り付いていれば隅柱
        if any(w.is_diagonal for w in self.attached_walls):
            self.position_type = "corner"
            return
            
        # 2. 直交する2つの壁が取り付いている場合も隅柱（N値計算の基本ルール）
        if len(self.attached_walls) == 2:
            angle1 = math.degrees(self.attached_walls[0].angle_rad) % 180
            angle2 = math.degrees(self.attached_walls[1].angle_rad) % 180
            diff = abs(angle1 - angle2)
            # 約90度の交差なら隅柱
            if 85.0 < diff < 95.0:  # プレカットや作図の僅かなブレを考慮し±5度程度の許容
                self.position_type = "corner"
                return

        # それ以外は一般柱
        self.position_type = "general"

@dataclass
class NValueResult:
    column_id: str
    n_value: float
    tension_force: float
    recommended_hardware: str

HARDWARE_LIMITS = [
    ("VP", 3.4, 2.9),
    ("CP-T", 5.3, 4.8),
    ("CP-L", 7.4, 6.9),
    ("HD-B10", 10.0, 9.5),
    ("HD-B15", 15.0, 14.5),
    ("HD-B20", 20.0, 19.5),
    ("HD-B25", 25.0, 24.5),
]

def calculate_hardware(tension: float) -> str:
    """引抜力から適切な金物を選定する（実耐力 - 0.5kNの判定基準）"""
    if tension <= 0:
        return "不要"
    
    for name, actual, limit in HARDWARE_LIMITS:
        if tension <= limit:
            return name
            
    return "特注 (要検討)"

def calculate_column_n_value(
    column_id: str, 
    height_mm: float,
    multiplier: float,
    length_mm: float,
    upper_tension: float,
    nw_load: float
) -> NValueResult:
    """エクセルおよび計算書に準拠した連動引抜力計算を行う"""
    # 1. 当該階の引抜力成分 = 壁倍率 * 1.96 * 階高(m)
    # ※ 実長を通じたモーメント計算でLは相殺されるため、壁倍率×高さベースとなる
    current_tension = multiplier * 1.96 * (height_mm / 1000.0)
    
    # 2. 上下階の計算: T = (当該階成分 + 上階からの力) - Nw
    tension = (current_tension + upper_tension) - nw_load
    tension = max(0.0, tension)
    
    # 参考Nw相当N値逆算
    n_value = tension / 5.3 if tension > 0 else 0.0
    
    hw = calculate_hardware(tension)
    return NValueResult(
        column_id=column_id,
        n_value=round(n_value, 2),
        tension_force=round(tension, 2),
        recommended_hardware=hw
    )
