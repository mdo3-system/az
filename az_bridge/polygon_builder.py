"""壁LINE線分からの閉ポリゴン自動検出エンジン

DXFから抽出した壁のLINE線分群を入力とし、
端点を結合して閉じたポリゴン（水平構面）を自動検出する。

アルゴリズム:
    1. LINE端点をスナップ許容誤差で丸めて重複排除
    2. shapely の polygonize() で閉ループを検出
    3. 有効ポリゴン（面積>0）を連番IDで返却
"""

from __future__ import annotations

import logging
from typing import Sequence

from shapely.geometry import MultiLineString
from shapely.ops import polygonize, snap

from .models import DetectedPolygon, WallLine

logger = logging.getLogger(__name__)


class PolygonBuilder:
    """壁LINE群から閉じたポリゴンを自動検出するビルダー。

    Parameters
    ----------
    snap_tolerance : float
        端点スナップ許容誤差 (mm)。DXFの丸め誤差を吸収する。
        デフォルト 1.0 mm。
    min_area : float
        有効ポリゴンの最小面積 (mm²)。ノイズ除外用。
        デフォルト 10000.0 mm² (100mm四方相当)。

    Examples
    --------
    >>> builder = PolygonBuilder(snap_tolerance=1.0)
    >>> polygons = builder.build(wall_lines)
    """

    def __init__(
        self,
        snap_tolerance: float = 1.0,
        min_area: float = 10000.0,
    ) -> None:
        if snap_tolerance < 0:
            raise ValueError(f"snap_tolerance は 0 以上: {snap_tolerance}")
        self._snap_tolerance = snap_tolerance
        self._min_area = min_area

    @property
    def snap_tolerance(self) -> float:
        return self._snap_tolerance

    def build(self, wall_lines: Sequence[WallLine]) -> list[DetectedPolygon]:
        """壁LINE群から閉ポリゴンを検出する。

        Parameters
        ----------
        wall_lines : Sequence[WallLine]
            DXFから抽出した壁の線分リスト

        Returns
        -------
        list[DetectedPolygon]
            検出されたポリゴンのリスト (面積降順ソート)
        """
        if not wall_lines:
            logger.info("壁LINE 0 本 → ポリゴン検出スキップ")
            return []

        # --- LINE群を shapely MultiLineString に変換 ---
        lines = []
        for wl in wall_lines:
            # 端点をスナップ丸め
            sx = self._snap(wl.start[0])
            sy = self._snap(wl.start[1])
            ex = self._snap(wl.end[0])
            ey = self._snap(wl.end[1])
            # 零長線分を除外
            if (sx, sy) != (ex, ey):
                lines.append(((sx, sy), (ex, ey)))

        if not lines:
            logger.warning("有効なLINE線分なし")
            return []

        logger.info("ポリゴン構築開始: LINE %d 本 (snap=%.1fmm)", len(lines), self._snap_tolerance)

        mls = MultiLineString(lines)

        # --- polygonize で閉ループ検出 ---
        raw_polygons = list(polygonize(mls))

        logger.info("polygonize 結果: %d 個の閉ポリゴン候補", len(raw_polygons))

        # --- フィルタリング + ID付与 ---
        detected: list[DetectedPolygon] = []
        layer = wall_lines[0].layer if wall_lines else ""

        for poly in raw_polygons:
            if not poly.is_valid or poly.is_empty:
                continue
            area = poly.area
            if area < self._min_area:
                logger.debug("面積 %.0f mm² < 閾値 → スキップ", area)
                continue

            coords = list(poly.exterior.coords)[:-1]  # 閉じた最後の重複点を除外
            detected.append(
                DetectedPolygon(
                    polygon_id="",  # 後で連番振り
                    vertices=[(c[0], c[1]) for c in coords],
                    source_layer=layer,
                )
            )

        # 面積降順ソート + ID付与
        detected.sort(
            key=lambda d: self._polygon_area(d.vertices),
            reverse=True,
        )
        for i, dp in enumerate(detected):
            dp.polygon_id = f"F{i + 1}"

        logger.info(
            "ポリゴン検出完了: %d 個 (面積: %s)",
            len(detected),
            ", ".join(
                f"{dp.polygon_id}={self._polygon_area(dp.vertices):,.0f}mm²"
                for dp in detected
            ) or "なし",
        )

        return detected

    def _snap(self, value: float) -> float:
        """座標値をスナップ許容誤差で丸める。"""
        if self._snap_tolerance <= 0:
            return value
        return round(value / self._snap_tolerance) * self._snap_tolerance

    @staticmethod
    def _polygon_area(vertices: list[tuple[float, float]]) -> float:
        """Shoelace formula で面積を計算。"""
        n = len(vertices)
        if n < 3:
            return 0.0
        area = 0.0
        for i in range(n):
            j = (i + 1) % n
            area += vertices[i][0] * vertices[j][1]
            area -= vertices[j][0] * vertices[i][1]
        return abs(area) / 2.0

    def __repr__(self) -> str:
        return f"PolygonBuilder(snap={self._snap_tolerance}mm, min_area={self._min_area}mm²)"
