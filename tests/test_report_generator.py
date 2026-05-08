"""ReportGenerator クラスのユニットテスト"""

import json

import pytest

from az_bridge.diagonal_wall import DiagonalWall
from az_bridge.models import (
    AxialForceRecord,
    ColumnPoint,
    ForceDirection,
    MatchReport,
    MappedColumn,
)
from az_bridge.polygon_analysis import FloorPolygon
from az_bridge.report_generator import ReportGenerator


class TestPolygonReport:
    """構面レポートのテスト。"""

    def setup_method(self) -> None:
        self.gen = ReportGenerator()

    def test_rectangle_report(self) -> None:
        fp = FloorPolygon([(0, 0), (4000, 0), (4000, 3000), (0, 3000)])
        report = self.gen.polygon_report(fp, ForceDirection.X)

        assert report["direction"] == "X"
        assert report["area_mm2"] == pytest.approx(12_000_000)
        assert report["projected_width_mm"] == pytest.approx(3000)
        assert report["equivalent_depth_mm"] == pytest.approx(4000)
        assert report["subdivision_warning"] is False
        assert report["reentrant_count"] == 0

    def test_l_shape_report(self) -> None:
        fp = FloorPolygon([
            (0, 0), (6000, 0), (6000, 2000),
            (3000, 2000), (3000, 4000), (0, 4000),
        ])
        report = self.gen.polygon_report(fp, ForceDirection.X)

        assert report["subdivision_warning"] is True
        assert report["reentrant_count"] >= 1
        assert len(report["reentrant_corners"]) >= 1

    def test_report_is_json_serializable(self) -> None:
        fp = FloorPolygon([(0, 0), (4000, 0), (4000, 3000), (0, 3000)])
        report = self.gen.polygon_report(fp, ForceDirection.X)
        # JSON シリアライズが例外なく行える
        json_str = json.dumps(report, ensure_ascii=False)
        assert len(json_str) > 0


class TestWallReport:
    """壁分解レポートのテスト。"""

    def setup_method(self) -> None:
        self.gen = ReportGenerator()

    def test_45deg_wall_report(self) -> None:
        wall = DiagonalWall(
            start=(0, 0), end=(3000, 3000),
            shear_capacity=20.0, stiffness=5.0,
        )
        report = self.gen.wall_report(wall, ForceDirection.X)

        assert report["angle_deg"] == pytest.approx(45.0, abs=0.01)
        assert report["decomposed_stiffness_kn_mm"] == pytest.approx(2.5, abs=0.01)
        assert report["reduction_applied"] is False

    def test_wall_with_reduction(self) -> None:
        wall = DiagonalWall(
            start=(0, 0), end=(3000, 3000),
            shear_capacity=20.0, stiffness=5.0,
            reduction_factor=0.8,
            note="テスト低減",
        )
        report = self.gen.wall_report(wall, ForceDirection.X)

        assert report["reduction_applied"] is True
        assert report["reduction_factor"] == 0.8
        assert report["note"] == "テスト低減"

    def test_report_is_json_serializable(self) -> None:
        wall = DiagonalWall(
            start=(0, 0), end=(3000, 0),
            shear_capacity=20.0, stiffness=5.0,
        )
        report = self.gen.wall_report(wall, ForceDirection.X)
        json_str = json.dumps(report, ensure_ascii=False)
        assert len(json_str) > 0


class TestMatchingReport:
    """マッチングレポートのテスト。"""

    def test_matching_report_structure(self) -> None:
        gen = ReportGenerator()
        match = MatchReport(
            matched=[
                MappedColumn(
                    column=ColumnPoint(label="C1", x=1000, y=2000),
                    axial_force=AxialForceRecord(
                        label="C1", x=1001, y=2000, axial_force_n=15.0
                    ),
                    distance=1.0,
                ),
            ],
            unmatched_columns=[ColumnPoint(label="C2", x=3000, y=4000)],
            unmatched_forces=[],
            tolerance=5.0,
        )
        report = gen.matching_report(match)
        assert report["matched_count"] == 1
        assert report["unmatched_column_count"] == 1
        assert report["tolerance_mm"] == 5.0


class TestFullReport:
    """統合レポートのテスト。"""

    def test_full_report_structure(self) -> None:
        gen = ReportGenerator()
        fp = FloorPolygon([(0, 0), (4000, 0), (4000, 3000), (0, 3000)])
        wall = DiagonalWall(
            start=(0, 0), end=(3000, 3000),
            shear_capacity=20.0, stiffness=5.0,
        )

        report = gen.full_report(
            polygons=[fp],
            walls=[wall],
            directions=[ForceDirection.X],
        )

        assert "generated_at" in report
        assert "summary" in report
        assert report["summary"]["floor_count"] == 1
        assert report["summary"]["wall_count"] == 1
        assert len(report["floor_analyses"]) == 1
        assert len(report["wall_decompositions"]) == 1

        # JSON シリアライズ
        json_str = json.dumps(report, ensure_ascii=False)
        parsed = json.loads(json_str)
        assert parsed["summary"]["floor_count"] == 1
