"""構面ポリゴン解析・等価矩形化エンジン

不整形な水平構面（多角形）の頂点座標から面積 S を算出し、
加力方向に対する投影長さ（有効受圧幅 W）から等価奥行き L_eff を算出する。

計算式:
    L_eff = S / W

対応:
    - 凸多角形・凹多角形
    - 自己交差ポリゴンの自動補正 (make_valid)
    - 入隅（内角 > 180°）の検知
"""

from __future__ import annotations

import math
from typing import Sequence

from shapely.geometry import Polygon as ShapelyPolygon
from shapely.validation import make_valid

from .models import EquivalentRect, ForceDirection


class FloorPolygon:
    """水平構面（床・屋根面）のポリゴン解析クラス。

    頂点座標リストから Shapely Polygon を生成し、
    面積計算・加力方向ごとの投影幅算出・等価矩形化を行う。

    Parameters
    ----------
    vertices : Sequence[tuple[float, float]]
        構面の頂点座標 [(x1, y1), (x2, y2), ...] (mm 単位を想定)

    Raises
    ------
    ValueError
        頂点が 3 点未満、または有効なポリゴンを生成できない場合。

    Examples
    --------
    >>> fp = FloorPolygon([(0, 0), (4000, 0), (4000, 3000), (0, 3000)])
    >>> fp.area
    12000000.0
    >>> result = fp.equivalent_rect(ForceDirection.X)
    >>> result.width   # Y方向の投影長さ = 3000
    3000.0
    >>> result.depth   # L_eff = 12000000 / 3000 = 4000
    4000.0
    """

    def __init__(self, vertices: Sequence[tuple[float, float]]) -> None:
        if len(vertices) < 3:
            raise ValueError(
                f"ポリゴンの生成には最低 3 頂点が必要です（{len(vertices)} 点が指定されました）"
            )

        raw_polygon = ShapelyPolygon(vertices)

        # 自己交差ポリゴンの場合は make_valid で補正
        if not raw_polygon.is_valid:
            repaired = make_valid(raw_polygon)
            # make_valid は MultiPolygon を返す場合がある — 最大面積のポリゴンを採用
            if repaired.geom_type == "MultiPolygon":
                self._polygon = max(repaired.geoms, key=lambda g: g.area)
            elif repaired.geom_type == "Polygon":
                self._polygon = repaired
            else:
                raise ValueError(
                    f"有効なポリゴンに変換できません（結果: {repaired.geom_type}）"
                )
        else:
            self._polygon = raw_polygon

        self._vertices = list(vertices)

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def vertices(self) -> list[tuple[float, float]]:
        """元の入力頂点座標を返す。"""
        return list(self._vertices)

    @property
    def shapely_polygon(self) -> ShapelyPolygon:
        """内部の Shapely Polygon オブジェクトを返す。"""
        return self._polygon

    @property
    def area(self) -> float:
        """構面の面積 S を返す。"""
        return self._polygon.area

    # ------------------------------------------------------------------
    # 投影幅・等価矩形
    # ------------------------------------------------------------------

    def projected_width(self, direction: ForceDirection) -> float:
        """加力方向に対する有効受圧幅 W を算出する。

        バウンディングボックスから取得した投影長さを返す。

        - X方向加力: W = Y軸方向の投影長さ (max_y - min_y)
        - Y方向加力: W = X軸方向の投影長さ (max_x - min_x)

        Parameters
        ----------
        direction : ForceDirection
            加力方向 (X or Y)

        Returns
        -------
        float
            有効受圧幅 W (mm)
        """
        min_x, min_y, max_x, max_y = self._polygon.bounds

        if direction == ForceDirection.X:
            return max_y - min_y
        else:  # ForceDirection.Y
            return max_x - min_x

    def equivalent_rect(self, direction: ForceDirection) -> EquivalentRect:
        """等価矩形化を行い、結果を返す。

        L_eff = S / W

        Parameters
        ----------
        direction : ForceDirection
            加力方向 (X or Y)

        Returns
        -------
        EquivalentRect
            等価矩形化の結果（W, L_eff, S, direction）

        Raises
        ------
        ValueError
            投影幅 W が 0 の場合（ライン状のポリゴンなど）。
        """
        s = self.area
        w = self.projected_width(direction)

        if w == 0:
            raise ValueError(
                f"投影幅 W が 0 です。加力方向 {direction.value} に対して"
                "有効な構面幅がありません。"
            )

        l_eff = s / w

        return EquivalentRect(width=w, depth=l_eff, area=s, direction=direction)

    # ------------------------------------------------------------------
    # 入隅検知
    # ------------------------------------------------------------------

    def find_reentrant_corners(self) -> list[tuple[int, tuple[float, float], float]]:
        """内角が 180° を超える頂点（入隅）を検出する。

        外積の符号とポリゴンの巡回方向（CCW/CW）を比較し、
        入隅を判定する。

        Returns
        -------
        list[tuple[int, tuple[float, float], float]]
            各入隅の (頂点インデックス, 座標, 内角[度]) のリスト。
            入隅がなければ空リスト。
        """
        coords = list(self._polygon.exterior.coords)[:-1]  # 閉合点を除く
        n = len(coords)

        if n < 3:
            return []

        # ポリゴンの巡回方向を判定
        # Shapely の exterior は CCW が正規形
        is_ccw = self._polygon.exterior.is_ccw

        reentrant: list[tuple[int, tuple[float, float], float]] = []

        for i in range(n):
            # 前の頂点、現在の頂点、次の頂点
            p_prev = coords[(i - 1) % n]
            p_curr = coords[i]
            p_next = coords[(i + 1) % n]

            # ベクトル: prev→curr, curr→next
            v1x = p_curr[0] - p_prev[0]
            v1y = p_curr[1] - p_prev[1]
            v2x = p_next[0] - p_curr[0]
            v2y = p_next[1] - p_curr[1]

            # 外積 (v1 × v2)
            cross = v1x * v2y - v1y * v2x

            # CCW の場合、外積 < 0 → 入隅（内角 > 180°）
            # CW  の場合、外積 > 0 → 入隅（内角 > 180°）
            is_reentrant = (is_ccw and cross < 0) or (not is_ccw and cross > 0)

            if is_reentrant:
                # 内角を算出
                interior_angle = self._calc_interior_angle(
                    v1x, v1y, v2x, v2y, is_reentrant=True
                )
                reentrant.append((i, (p_curr[0], p_curr[1]), interior_angle))

        return reentrant

    @property
    def requires_subdivision_warning(self) -> bool:
        """入隅が存在する場合 True を返す。

        True の場合:
        「L字・コの字等の不整形構面のため、ブロック分割の検討を推奨」

        Returns
        -------
        bool
        """
        return len(self.find_reentrant_corners()) > 0

    @staticmethod
    def _calc_interior_angle(
        v1x: float, v1y: float, v2x: float, v2y: float, *, is_reentrant: bool
    ) -> float:
        """2つのベクトルから内角を度数法で算出する。"""
        dot = v1x * v2x + v1y * v2y
        mag1 = math.hypot(v1x, v1y)
        mag2 = math.hypot(v2x, v2y)

        if mag1 == 0 or mag2 == 0:
            return 0.0

        cos_val = max(-1.0, min(1.0, dot / (mag1 * mag2)))
        angle = math.degrees(math.acos(cos_val))

        # 外角を算出してから内角に変換
        # 凸の場合: 内角 = 180° - 外角 (外角 = angle between direction vectors)
        # 入隅の場合: 内角 = 180° + 外角
        exterior_angle = 180.0 - angle
        if is_reentrant:
            return 180.0 + exterior_angle  # > 180°
        else:
            return 180.0 - exterior_angle  # < 180°

    # ------------------------------------------------------------------
    # ユーティリティ
    # ------------------------------------------------------------------

    def calculation_log(self, direction: ForceDirection) -> str:
        """算定プロセスログを文字列として返す。

        Parameters
        ----------
        direction : ForceDirection
            加力方向

        Returns
        -------
        str
            計算根拠ログ
        """
        result = self.equivalent_rect(direction)
        lines = [
            "=" * 60,
            "【構面ポリゴン等価矩形化 算定ログ】",
            f"  加力方向        : {direction.value}",
            f"  頂点数          : {len(self._vertices)}",
            f"  構面面積 S      : {result.area:,.2f} mm²",
            f"  有効受圧幅 W    : {result.width:,.2f} mm",
            f"  等価奥行き L_eff: {result.depth:,.2f} mm",
            f"  (検算: W × L_eff = {result.width * result.depth:,.2f} mm²)",
        ]

        reentrant = self.find_reentrant_corners()
        if reentrant:
            lines.append(f"  ⚠ 入隅検出      : {len(reentrant)} 箇所")
            for idx, coord, angle in reentrant:
                lines.append(
                    f"    - 頂点{idx}: ({coord[0]:.0f}, {coord[1]:.0f}) "
                    f"内角={angle:.1f}°"
                )
            lines.append(
                "  ⚠ L字・コの字等の不整形構面のため、ブロック分割の検討を推奨"
            )

        lines.append("=" * 60)
        return "\n".join(lines)

    def __repr__(self) -> str:
        return (
            f"FloorPolygon(vertices={len(self._vertices)}pts, "
            f"area={self.area:,.1f}mm²)"
        )

