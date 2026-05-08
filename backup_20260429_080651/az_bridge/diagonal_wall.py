"""鉛直構面（斜め耐力壁）の分解ロジック

加力方向に対する斜め壁の角度 θ を元に、
許容せん断耐力 P および剛性 K を分解する。

耐力の分解:
    P_x = P · cos(θ),  P_y = P · sin(θ)

剛性の分解:
    K_x = K · cos²(θ),  K_y = K · sin²(θ)
"""

from __future__ import annotations

import math
from typing import Optional

from .models import ForceDirection, WallDecomposition


class DiagonalWall:
    """斜め耐力壁の分解計算クラス。

    端点座標から壁の角度 θ を算出し、
    許容せん断耐力 P と剛性 K を加力方向に分解する。

    Parameters
    ----------
    start : tuple[float, float]
        壁の始点座標 (x, y) (mm)
    end : tuple[float, float]
        壁の終点座標 (x, y) (mm)
    shear_capacity : float
        許容せん断耐力 P (kN)
    stiffness : float
        剛性 K (kN/mm)
    reduction_factor : float, optional
        耐力低減係数 (デフォルト 1.0 = 低減なし)
    note : str, optional
        低減理由などの注釈

    Raises
    ------
    ValueError
        始点と終点が同一座標の場合、または耐力・剛性が負の場合。

    Examples
    --------
    >>> wall = DiagonalWall((0, 0), (3000, 3000), shear_capacity=20.0, stiffness=5.0)
    >>> wall.angle_deg  # 45°
    45.0
    >>> result = wall.decompose(ForceDirection.X)
    >>> round(result.shear_capacity, 4)  # 20 * cos(45°)
    14.1421
    >>> round(result.stiffness, 4)       # 5 * cos²(45°)
    2.5
    """

    def __init__(
        self,
        start: tuple[float, float],
        end: tuple[float, float],
        shear_capacity: float,
        stiffness: float,
        reduction_factor: float = 1.0,
        note: Optional[str] = None,
    ) -> None:
        if start == end:
            raise ValueError("始点と終点が同一座標です。壁の長さが 0 になります。")
        if shear_capacity < 0:
            raise ValueError(f"許容せん断耐力は 0 以上でなければなりません: {shear_capacity}")
        if stiffness < 0:
            raise ValueError(f"剛性は 0 以上でなければなりません: {stiffness}")
        if not (0 < reduction_factor <= 1.0):
            raise ValueError(
                f"耐力低減係数は 0 < factor ≤ 1.0 の範囲でなければなりません: {reduction_factor}"
            )

        self._start = start
        self._end = end
        self._shear_capacity = shear_capacity
        self._stiffness = stiffness
        self._reduction_factor = reduction_factor
        self._note = note

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def start(self) -> tuple[float, float]:
        """壁の始点座標。"""
        return self._start

    @property
    def end(self) -> tuple[float, float]:
        """壁の終点座標。"""
        return self._end

    @property
    def shear_capacity(self) -> float:
        """元の許容せん断耐力 P (kN)。"""
        return self._shear_capacity

    @property
    def stiffness(self) -> float:
        """元の剛性 K (kN/mm)。"""
        return self._stiffness

    @property
    def reduction_factor(self) -> float:
        """耐力低減係数。"""
        return self._reduction_factor

    @property
    def wall_length(self) -> float:
        """壁の実長 (mm)。"""
        dx = self._end[0] - self._start[0]
        dy = self._end[1] - self._start[1]
        return math.hypot(dx, dy)

    @property
    def angle_rad(self) -> float:
        """壁の角度 θ (ラジアン)。X軸正方向を 0 とする。

        返り値は [0, π) の範囲に正規化される
        （壁の方向はどちらの端点を始点にしても同じ角度を返す）。
        """
        dx = self._end[0] - self._start[0]
        dy = self._end[1] - self._start[1]
        angle = math.atan2(abs(dy), abs(dx))
        return angle

    @property
    def angle_deg(self) -> float:
        """壁の角度 θ (度数法)。"""
        return math.degrees(self.angle_rad)

    # ------------------------------------------------------------------
    # 分解計算
    # ------------------------------------------------------------------

    def decompose(self, direction: ForceDirection) -> WallDecomposition:
        """加力方向に対して耐力・剛性を分解する。

        Parameters
        ----------
        direction : ForceDirection
            加力方向 (X or Y)

        Returns
        -------
        WallDecomposition
            分解後の耐力・剛性・角度・注釈等
        """
        theta = self.angle_rad
        p = self._shear_capacity
        k = self._stiffness
        rf = self._reduction_factor
        reduction_applied = rf < 1.0

        if direction == ForceDirection.X:
            cos_t = math.cos(theta)
            p_decomposed = p * cos_t * rf
            k_decomposed = k * cos_t ** 2
        else:  # ForceDirection.Y
            sin_t = math.sin(theta)
            p_decomposed = p * sin_t * rf
            k_decomposed = k * sin_t ** 2

        note = self._note
        if reduction_applied and note is None:
            note = f"耐力低減係数 {rf} を適用"

        return WallDecomposition(
            direction=direction,
            shear_capacity=p_decomposed,
            stiffness=k_decomposed,
            angle_rad=theta,
            angle_deg=self.angle_deg,
            wall_length=self.wall_length,
            reduction_factor=rf,
            reduction_applied=reduction_applied,
            note=note,
        )

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
        result = self.decompose(direction)
        cos_t = math.cos(result.angle_rad)
        sin_t = math.sin(result.angle_rad)

        lines = [
            "=" * 60,
            "【斜め壁分解 算定ログ】",
            f"  始点            : ({self._start[0]:,.1f}, {self._start[1]:,.1f})",
            f"  終点            : ({self._end[0]:,.1f}, {self._end[1]:,.1f})",
            f"  壁実長          : {result.wall_length:,.2f} mm",
            f"  角度 θ          : {result.angle_deg:.2f}°"
            f" ({result.angle_rad:.4f} rad)",
            f"  cos(θ)          : {cos_t:.6f}",
            f"  sin(θ)          : {sin_t:.6f}",
            f"  元の耐力 P      : {self._shear_capacity:,.4f} kN",
            f"  元の剛性 K      : {self._stiffness:,.4f} kN/mm",
            f"  分解方向        : {direction.value}",
        ]

        if direction == ForceDirection.X:
            lines.append(
                f"  P_{direction.value} = P·cos(θ)   : "
                f"{self._shear_capacity:.4f} × {cos_t:.6f}"
                f" = {result.shear_capacity:.4f} kN"
            )
            lines.append(
                f"  K_{direction.value} = K·cos²(θ)  : "
                f"{self._stiffness:.4f} × {cos_t:.6f}²"
                f" = {result.stiffness:.4f} kN/mm"
            )
        else:
            lines.append(
                f"  P_{direction.value} = P·sin(θ)   : "
                f"{self._shear_capacity:.4f} × {sin_t:.6f}"
                f" = {result.shear_capacity:.4f} kN"
            )
            lines.append(
                f"  K_{direction.value} = K·sin²(θ)  : "
                f"{self._stiffness:.4f} × {sin_t:.6f}²"
                f" = {result.stiffness:.4f} kN/mm"
            )

        if result.reduction_applied:
            lines.append(f"  ※ 耐力低減係数  : {result.reduction_factor}")
            if result.note:
                lines.append(f"  ※ 注釈          : {result.note}")

        lines.append("=" * 60)
        return "\n".join(lines)

    def __repr__(self) -> str:
        return (
            f"DiagonalWall("
            f"start={self._start}, end={self._end}, "
            f"θ={self.angle_deg:.1f}°, "
            f"P={self._shear_capacity}kN, K={self._stiffness}kN/mm"
            f")"
        )
