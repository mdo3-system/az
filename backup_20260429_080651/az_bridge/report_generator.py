"""算定プロセスレポート生成

審査機関提出用の計算プロセスレポートを構造化データ（JSON互換 dict）
として出力する。フロントエンド側での帳票レンダリング用の生データ。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional, Sequence

from .diagonal_wall import DiagonalWall
from .models import (
    ForceDirection,
    MatchReport,
)
from .polygon_analysis import FloorPolygon


class ReportGenerator:
    """審査向け算定プロセスレポートを生成するクラス。

    FloorPolygon / DiagonalWall / MatchReport のデータを統合し、
    JSON シリアライズ可能な辞書として出力する。

    Examples
    --------
    >>> gen = ReportGenerator()
    >>> report = gen.polygon_report(fp, ForceDirection.X)
    """

    def polygon_report(
        self,
        polygon: FloorPolygon,
        direction: ForceDirection,
    ) -> dict[str, Any]:
        """構面ポリゴンの算定レポートを辞書で返す。

        Parameters
        ----------
        polygon : FloorPolygon
        direction : ForceDirection

        Returns
        -------
        dict
        """
        equiv = polygon.equivalent_rect(direction)
        reentrant = polygon.find_reentrant_corners()

        return {
            "direction": direction.value,
            "vertices": polygon.vertices,
            "area_mm2": equiv.area,
            "projected_width_mm": equiv.width,
            "equivalent_depth_mm": equiv.depth,
            "verification_area_mm2": equiv.width * equiv.depth,
            "reentrant_corners": [
                {
                    "vertex_index": idx,
                    "coord": list(coord),
                    "interior_angle_deg": round(angle, 2),
                }
                for idx, coord, angle in reentrant
            ],
            "reentrant_count": len(reentrant),
            "subdivision_warning": polygon.requires_subdivision_warning,
        }

    def wall_report(
        self,
        wall: DiagonalWall,
        direction: ForceDirection,
    ) -> dict[str, Any]:
        """斜め壁の分解レポートを辞書で返す。

        Parameters
        ----------
        wall : DiagonalWall
        direction : ForceDirection

        Returns
        -------
        dict
        """
        decomp = wall.decompose(direction)

        return {
            "start": list(wall.start),
            "end": list(wall.end),
            "wall_length_mm": round(wall.wall_length, 2),
            "angle_deg": round(decomp.angle_deg, 4),
            "angle_rad": round(decomp.angle_rad, 6),
            "direction": direction.value,
            "original_shear_capacity_kn": wall.shear_capacity,
            "original_stiffness_kn_mm": wall.stiffness,
            "decomposed_shear_capacity_kn": round(decomp.shear_capacity, 4),
            "decomposed_stiffness_kn_mm": round(decomp.stiffness, 4),
            "reduction_factor": decomp.reduction_factor,
            "reduction_applied": decomp.reduction_applied,
            "note": decomp.note,
        }

    def matching_report(self, match_report: MatchReport) -> dict[str, Any]:
        """座標マッチング結果のレポートを辞書で返す。

        Parameters
        ----------
        match_report : MatchReport

        Returns
        -------
        dict
        """
        return {
            "tolerance_mm": match_report.tolerance,
            "matched_count": len(match_report.matched),
            "unmatched_column_count": len(match_report.unmatched_columns),
            "unmatched_force_count": len(match_report.unmatched_forces),
            "matched": [
                {
                    "column_label": m.column.label,
                    "column_coord": [m.column.x, m.column.y],
                    "force_label": m.axial_force.label,
                    "force_coord": [m.axial_force.x, m.axial_force.y],
                    "axial_force_kn": m.axial_force.axial_force_n,
                    "distance_mm": round(m.distance, 4),
                }
                for m in match_report.matched
            ],
            "unmatched_columns": [
                {
                    "label": c.label,
                    "coord": [c.x, c.y],
                }
                for c in match_report.unmatched_columns
            ],
            "unmatched_forces": [
                {
                    "label": f.label,
                    "coord": [f.x, f.y],
                    "axial_force_kn": f.axial_force_n,
                }
                for f in match_report.unmatched_forces
            ],
        }

    def full_report(
        self,
        polygons: Sequence[FloorPolygon],
        walls: Sequence[DiagonalWall],
        match_report: Optional[MatchReport] = None,
        directions: Sequence[ForceDirection] = (ForceDirection.X, ForceDirection.Y),
    ) -> dict[str, Any]:
        """全体レポートを辞書で返す。

        Parameters
        ----------
        polygons : Sequence[FloorPolygon]
            構面ポリゴンのリスト
        walls : Sequence[DiagonalWall]
            斜め壁のリスト
        match_report : MatchReport, optional
            座標マッチング結果
        directions : Sequence[ForceDirection]
            算定する加力方向（デフォルト: X, Y 両方）

        Returns
        -------
        dict
            JSON シリアライズ可能な完全レポート
        """
        floor_analyses = []
        for polygon in polygons:
            for d in directions:
                floor_analyses.append(self.polygon_report(polygon, d))

        wall_decompositions = []
        for wall in walls:
            for d in directions:
                wall_decompositions.append(self.wall_report(wall, d))

        report: dict[str, Any] = {
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "summary": {
                "floor_count": len(polygons),
                "wall_count": len(walls),
                "directions_analyzed": [d.value for d in directions],
            },
            "floor_analyses": floor_analyses,
            "wall_decompositions": wall_decompositions,
        }

        if match_report is not None:
            report["coordinate_matching"] = self.matching_report(match_report)

        return report
