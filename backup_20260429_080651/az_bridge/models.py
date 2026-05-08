"""共通データモデル — 加力方向・等価矩形結果など"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class ForceDirection(Enum):
    """加力方向を表す列挙型。

    X — 水平方向（東西）
    Y — 鉛直方向（南北）
    """

    X = "X"
    Y = "Y"


@dataclass(frozen=True)
class EquivalentRect:
    """等価矩形化の計算結果を保持するデータモデル。

    Attributes:
        width:     有効受圧幅 W (mm)
        depth:     等価奥行き L_eff = S / W (mm)
        area:      元の構面面積 S (mm²)
        direction: 加力方向
    """

    width: float
    depth: float
    area: float
    direction: ForceDirection

    def __post_init__(self) -> None:
        if self.width <= 0:
            raise ValueError(f"有効受圧幅 W は正の値でなければなりません: {self.width}")
        if self.area <= 0:
            raise ValueError(f"面積 S は正の値でなければなりません: {self.area}")


@dataclass(frozen=True)
class WallDecomposition:
    """壁の分解計算結果を保持するデータモデル。

    Attributes:
        direction:          分解方向
        shear_capacity:     分解後の許容せん断耐力 (kN)
        stiffness:          分解後の剛性 (kN/mm)
        angle_rad:          壁の角度 θ (rad)
        angle_deg:          壁の角度 θ (°)
        wall_length:        壁の実長 (mm)
        reduction_factor:   耐力低減係数
        reduction_applied:  低減係数が適用されたか
        note:               注釈（低減適用時の説明等）
    """

    direction: ForceDirection
    shear_capacity: float
    stiffness: float
    angle_rad: float
    angle_deg: float
    wall_length: float
    reduction_factor: float = 1.0
    reduction_applied: bool = False
    note: Optional[str] = None


@dataclass
class DetectedPolygon:
    """DXF壁LINE線分から自動検出された閉ポリゴン。

    Attributes:
        polygon_id: ポリゴン識別子 ("F1", "F2", ...)
        vertices:   頂点座標リスト [(x, y), ...]
        source_layer: 元DXFレイヤ名
    """

    polygon_id: str
    vertices: list[tuple[float, float]] = field(default_factory=list)
    source_layer: str = ""


# ------------------------------------------------------------------
# Phase 2: パーサー / マッピング用データモデル
# ------------------------------------------------------------------


@dataclass
class ColumnPoint:
    """DXFから抽出した柱の座標データ。

    Attributes:
        label: 柱の符号（図面上のテキスト等から取得、不明時は空文字）
        x:     X座標 (mm)
        y:     Y座標 (mm)
        layer: DXFレイヤ名
    """

    label: str
    x: float
    y: float
    layer: str = ""


@dataclass
class WallLine:
    """DXFから抽出した壁の線分データ。

    Attributes:
        start: 始点座標 (x, y) (mm)
        end:   終点座標 (x, y) (mm)
        layer: DXFレイヤ名
    """

    start: tuple[float, float] = field(default_factory=tuple)
    end: tuple[float, float] = field(default_factory=tuple)
    layer: str = ""


@dataclass
class AxialForceRecord:
    """計算レポートから抽出した柱の軸力データ。

    Attributes:
        label:         柱の符号
        x:             X座標 (mm)
        y:             Y座標 (mm)
        axial_force_n: 軸力 N (kN)
        raw_fields:    元のCSV行の全フィールド（デバッグ用）
    """

    label: str
    x: float
    y: float
    axial_force_n: float
    raw_fields: dict = field(default_factory=dict)


@dataclass(frozen=True)
class MappedColumn:
    """座標マッチングで結合された柱データ。

    Attributes:
        column:      DXF由来の柱座標
        axial_force: レポート由来の軸力データ
        distance:    マッチング時のユークリッド距離 (mm)
    """

    column: ColumnPoint
    axial_force: AxialForceRecord
    distance: float


@dataclass(frozen=True)
class MatchReport:
    """座標マッチング全体の結果サマリ。

    Attributes:
        matched:            マッチ成功リスト
        unmatched_columns:  マッチしなかった柱リスト
        unmatched_forces:   マッチしなかった軸力データリスト
        tolerance:          使用した許容誤差 (mm)
    """

    matched: list[MappedColumn]
    unmatched_columns: list[ColumnPoint]
    unmatched_forces: list[AxialForceRecord]
    tolerance: float
