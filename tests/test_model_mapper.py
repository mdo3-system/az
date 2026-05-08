"""ModelMapper クラスのユニットテスト

モックデータを用いた座標マッチングのテスト。
"""

import math

import pytest

from az_bridge.model_mapper import ModelMapper
from az_bridge.models import AxialForceRecord, ColumnPoint


def _col(label: str, x: float, y: float) -> ColumnPoint:
    """ColumnPoint のヘルパー生成関数。"""
    return ColumnPoint(label=label, x=x, y=y)


def _force(label: str, x: float, y: float, n: float = 10.0) -> AxialForceRecord:
    """AxialForceRecord のヘルパー生成関数。"""
    return AxialForceRecord(label=label, x=x, y=y, axial_force_n=n)


class TestModelMapperExactMatch:
    """座標が完全一致するケース。"""

    def test_single_exact_match(self) -> None:
        mapper = ModelMapper(tolerance=5.0)
        columns = [_col("C1", 1000, 2000)]
        forces = [_force("C1", 1000, 2000, 15.0)]

        report = mapper.match(columns, forces)
        assert len(report.matched) == 1
        assert report.matched[0].distance == pytest.approx(0.0)
        assert report.matched[0].axial_force.axial_force_n == pytest.approx(15.0)
        assert len(report.unmatched_columns) == 0
        assert len(report.unmatched_forces) == 0

    def test_multiple_exact_matches(self) -> None:
        mapper = ModelMapper(tolerance=5.0)
        columns = [
            _col("C1", 1000, 2000),
            _col("C2", 3000, 4000),
            _col("C3", 5000, 6000),
        ]
        forces = [
            _force("C1", 1000, 2000),
            _force("C2", 3000, 4000),
            _force("C3", 5000, 6000),
        ]

        report = mapper.match(columns, forces)
        assert len(report.matched) == 3
        assert len(report.unmatched_columns) == 0
        assert len(report.unmatched_forces) == 0


class TestModelMapperWithinTolerance:
    """許容誤差内のマッチングテスト。"""

    def test_within_tolerance(self) -> None:
        mapper = ModelMapper(tolerance=5.0)
        # 3mm のズレ (3² + 0² = 9 → d = 3)
        columns = [_col("C1", 1000, 2000)]
        forces = [_force("C1", 1003, 2000, 15.0)]

        report = mapper.match(columns, forces)
        assert len(report.matched) == 1
        assert report.matched[0].distance == pytest.approx(3.0)

    def test_at_exact_tolerance_boundary(self) -> None:
        mapper = ModelMapper(tolerance=5.0)
        # d = 5.0 (ちょうど境界)
        columns = [_col("C1", 1000, 2000)]
        forces = [_force("C1", 1003, 2004, 15.0)]
        # d = √(3² + 4²) = 5.0

        report = mapper.match(columns, forces)
        assert len(report.matched) == 1
        assert report.matched[0].distance == pytest.approx(5.0)


class TestModelMapperBeyondTolerance:
    """許容誤差を超えるケース。"""

    def test_beyond_tolerance(self) -> None:
        mapper = ModelMapper(tolerance=5.0)
        # d = 10.0 (超過)
        columns = [_col("C1", 1000, 2000)]
        forces = [_force("C1", 1010, 2000, 15.0)]

        report = mapper.match(columns, forces)
        assert len(report.matched) == 0
        assert len(report.unmatched_columns) == 1
        assert len(report.unmatched_forces) == 1

    def test_partial_match(self) -> None:
        mapper = ModelMapper(tolerance=5.0)
        columns = [
            _col("C1", 1000, 2000),
            _col("C2", 3000, 4000),
        ]
        forces = [
            _force("C1", 1002, 2001),  # マッチ (d ≈ 2.24)
            _force("C2", 9999, 9999),  # マッチしない
        ]

        report = mapper.match(columns, forces)
        assert len(report.matched) == 1
        assert report.matched[0].column.label == "C1"
        assert len(report.unmatched_columns) == 1
        assert len(report.unmatched_forces) == 1


class TestModelMapperOneToOne:
    """1対1制約のテスト。"""

    def test_nearest_wins(self) -> None:
        """2 つの柱が同じ軸力データに近い場合、最近傍が優先。"""
        mapper = ModelMapper(tolerance=5.0)
        columns = [
            _col("C1", 1000, 2000),
            _col("C2", 1002, 2000),  # C2 のほうが近い
        ]
        forces = [
            _force("F1", 1003, 2000),  # C2: d=1, C1: d=3
        ]

        report = mapper.match(columns, forces)
        assert len(report.matched) == 1
        assert report.matched[0].column.label == "C2"
        assert len(report.unmatched_columns) == 1
        assert report.unmatched_columns[0].label == "C1"


class TestModelMapperEdgeCases:
    """エッジケースのテスト。"""

    def test_empty_columns(self) -> None:
        mapper = ModelMapper(tolerance=5.0)
        report = mapper.match([], [_force("F1", 0, 0)])
        assert len(report.matched) == 0
        assert len(report.unmatched_forces) == 1

    def test_empty_forces(self) -> None:
        mapper = ModelMapper(tolerance=5.0)
        report = mapper.match([_col("C1", 0, 0)], [])
        assert len(report.matched) == 0
        assert len(report.unmatched_columns) == 1

    def test_both_empty(self) -> None:
        mapper = ModelMapper(tolerance=5.0)
        report = mapper.match([], [])
        assert len(report.matched) == 0

    def test_negative_tolerance_raises(self) -> None:
        with pytest.raises(ValueError, match="0 以上"):
            ModelMapper(tolerance=-1.0)

    def test_match_log_output(self) -> None:
        mapper = ModelMapper(tolerance=5.0)
        columns = [_col("C1", 1000, 2000)]
        forces = [_force("C1", 1001, 2000, 15.0)]
        report = mapper.match(columns, forces)
        log = mapper.match_log(report)
        assert "マッチ成功" in log
        assert "1 件" in log

    def test_tolerance_zero(self) -> None:
        """tolerance=0 では完全一致のみ。"""
        mapper = ModelMapper(tolerance=0.0)
        columns = [_col("C1", 1000, 2000)]
        forces_exact = [_force("C1", 1000, 2000)]
        forces_off = [_force("C1", 1000.001, 2000)]

        report1 = mapper.match(columns, forces_exact)
        assert len(report1.matched) == 1

        report2 = mapper.match(columns, forces_off)
        assert len(report2.matched) == 0
