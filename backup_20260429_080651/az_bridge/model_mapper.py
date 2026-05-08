"""座標マッチング・マッピング処理

DXF から取得した柱座標と計算レポート上の柱座標を、
許容誤差（トレランス）付きのユークリッド距離で突き合わせて統合する。

マッチング条件:
    d = √((x₁ - x₂)² + (y₁ - y₂)²) ≤ tolerance
"""

from __future__ import annotations

import logging
import math
from typing import Sequence

from .models import (
    AxialForceRecord,
    ColumnPoint,
    MappedColumn,
    MatchReport,
)

logger = logging.getLogger(__name__)

class ModelMapper:
    """柱座標と軸力データの座標マッチングエンジン。

    CAD 上の座標と計算レポート上の座標の丸め誤差を吸収するため、
    許容誤差（トレランス）を設けた近傍探索でマッチングを行う。

    Parameters
    ----------
    tolerance : float
        許容誤差 (mm)。デフォルト 5.0 mm。

    Examples
    --------
    >>> mapper = ModelMapper(tolerance=5.0)
    >>> report = mapper.match(columns, force_records)
    >>> print(f"マッチ: {len(report.matched)}, 未マッチ柱: {len(report.unmatched_columns)}")
    """

    def __init__(self, tolerance: float = 5.0) -> None:
        if tolerance < 0:
            raise ValueError(f"許容誤差は 0 以上でなければなりません: {tolerance}")
        self._tolerance = tolerance

    @property
    def tolerance(self) -> float:
        """許容誤差 (mm)。"""
        return self._tolerance

    def match(
        self,
        columns: Sequence[ColumnPoint],
        forces: Sequence[AxialForceRecord],
    ) -> MatchReport:
        """柱座標と軸力データを突き合わせてマッチングする。

        アルゴリズム:
        1. 各 ColumnPoint に対し、未マッチの AxialForceRecord 全てとの
           ユークリッド距離を計算
        2. d ≤ tolerance かつ最小距離のレコードを 1 対 1 でマッチ
        3. 距離が近い柱ペアから優先的にマッチングする（貪欲法）

        Parameters
        ----------
        columns : Sequence[ColumnPoint]
            DXF 由来の柱座標リスト
        forces : Sequence[AxialForceRecord]
            レポート由来の軸力データリスト

        Returns
        -------
        MatchReport
            マッチング結果
        """
        # 全ペアの距離を計算してソート（貪欲法: 距離が近い順に優先マッチ）
        candidates: list[tuple[float, int, int]] = []
        for ci, col in enumerate(columns):
            for fi, force in enumerate(forces):
                d = self._euclidean_distance(col.x, col.y, force.x, force.y)
                if d <= self._tolerance:
                    candidates.append((d, ci, fi))

        # 距離昇順ソート
        candidates.sort(key=lambda t: t[0])

        matched: list[MappedColumn] = []
        matched_col_indices: set[int] = set()
        matched_force_indices: set[int] = set()

        for dist, ci, fi in candidates:
            if ci in matched_col_indices or fi in matched_force_indices:
                continue
            matched.append(
                MappedColumn(
                    column=columns[ci],
                    axial_force=forces[fi],
                    distance=dist,
                )
            )
            matched_col_indices.add(ci)
            matched_force_indices.add(fi)

        unmatched_columns = [
            col for i, col in enumerate(columns) if i not in matched_col_indices
        ]
        unmatched_forces = [
            f for i, f in enumerate(forces) if i not in matched_force_indices
        ]

        report = MatchReport(
            matched=matched,
            unmatched_columns=unmatched_columns,
            unmatched_forces=unmatched_forces,
            tolerance=self._tolerance,
        )
        self._log_match_warnings(report)
        return report

    def _log_match_warnings(self, report: MatchReport) -> None:
        """マッチング結果の警告をログ出力する。"""
        logger.info(
            "座標マッチング完了: 成功=%d, 未マッチ柱=%d, 未マッチ軸力=%d (tolerance=%.1fmm)",
            len(report.matched), len(report.unmatched_columns),
            len(report.unmatched_forces), report.tolerance,
        )
        if report.unmatched_columns:
            logger.warning(
                "許容誤差外の柱 %d 本:", len(report.unmatched_columns),
            )
            for col in report.unmatched_columns:
                logger.warning(
                    "  ✗ %s (%.1f, %.1f) layer=%s",
                    col.label or '(無名)', col.x, col.y, col.layer or '-',
                )
        if report.unmatched_forces:
            logger.warning(
                "マッチしなかった軸力データ %d 件:", len(report.unmatched_forces),
            )
            for f in report.unmatched_forces:
                logger.warning(
                    "  ✗ %s (%.1f, %.1f) N=%.2fkN",
                    f.label, f.x, f.y, f.axial_force_n,
                )

    def match_log(self, report: MatchReport) -> str:
        """マッチング結果のログを文字列として返す。

        Parameters
        ----------
        report : MatchReport
            マッチング結果

        Returns
        -------
        str
            ログ文字列
        """
        lines = [
            "=" * 60,
            "【座標マッチング結果ログ】",
            f"  許容誤差      : {report.tolerance:.1f} mm",
            f"  マッチ成功    : {len(report.matched)} 件",
            f"  未マッチ（柱）: {len(report.unmatched_columns)} 件",
            f"  未マッチ（軸力）: {len(report.unmatched_forces)} 件",
            "-" * 60,
        ]

        for m in report.matched:
            lines.append(
                f"  ✓ {m.column.label or '(無名)'} "
                f"CAD({m.column.x:.1f}, {m.column.y:.1f}) ↔ "
                f"Report({m.axial_force.x:.1f}, {m.axial_force.y:.1f}) "
                f"d={m.distance:.2f}mm  N={m.axial_force.axial_force_n:.2f}kN"
            )

        if report.unmatched_columns:
            lines.append("-" * 60)
            lines.append("  未マッチ（柱）:")
            for col in report.unmatched_columns:
                lines.append(
                    f"  ✗ {col.label or '(無名)'} ({col.x:.1f}, {col.y:.1f})"
                )

        if report.unmatched_forces:
            lines.append("-" * 60)
            lines.append("  未マッチ（軸力データ）:")
            for f in report.unmatched_forces:
                lines.append(
                    f"  ✗ {f.label} ({f.x:.1f}, {f.y:.1f}) N={f.axial_force_n:.2f}kN"
                )

        lines.append("=" * 60)
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # 内部メソッド
    # ------------------------------------------------------------------

    @staticmethod
    def _euclidean_distance(x1: float, y1: float, x2: float, y2: float) -> float:
        """2点間のユークリッド距離を算出する。"""
        return math.hypot(x1 - x2, y1 - y2)

    def __repr__(self) -> str:
        return f"ModelMapper(tolerance={self._tolerance}mm)"
