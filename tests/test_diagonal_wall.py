"""DiagonalWall クラスのユニットテスト"""

import math

import pytest

from az_bridge.diagonal_wall import DiagonalWall
from az_bridge.models import ForceDirection


class TestDiagonalWall0Degrees:
    """X軸に平行な壁（0°）のテスト。"""

    def setup_method(self) -> None:
        self.wall = DiagonalWall(
            start=(0, 0), end=(3000, 0),
            shear_capacity=20.0, stiffness=5.0,
        )

    def test_angle(self) -> None:
        assert self.wall.angle_deg == pytest.approx(0.0)

    def test_wall_length(self) -> None:
        assert self.wall.wall_length == pytest.approx(3000.0)

    def test_decompose_x(self) -> None:
        result = self.wall.decompose(ForceDirection.X)
        # cos(0) = 1 → P_x = 20, K_x = 5
        assert result.shear_capacity == pytest.approx(20.0)
        assert result.stiffness == pytest.approx(5.0)

    def test_decompose_y(self) -> None:
        result = self.wall.decompose(ForceDirection.Y)
        # sin(0) = 0 → P_y ≈ 0, K_y ≈ 0
        assert result.shear_capacity == pytest.approx(0.0, abs=1e-10)
        assert result.stiffness == pytest.approx(0.0, abs=1e-10)


class TestDiagonalWall90Degrees:
    """Y軸に平行な壁（90°）のテスト。"""

    def setup_method(self) -> None:
        self.wall = DiagonalWall(
            start=(0, 0), end=(0, 3000),
            shear_capacity=20.0, stiffness=5.0,
        )

    def test_angle(self) -> None:
        assert self.wall.angle_deg == pytest.approx(90.0)

    def test_decompose_x(self) -> None:
        result = self.wall.decompose(ForceDirection.X)
        # cos(90°) = 0 → P_x ≈ 0, K_x ≈ 0
        assert result.shear_capacity == pytest.approx(0.0, abs=1e-10)
        assert result.stiffness == pytest.approx(0.0, abs=1e-10)

    def test_decompose_y(self) -> None:
        result = self.wall.decompose(ForceDirection.Y)
        # sin(90°) = 1 → P_y = 20, K_y = 5
        assert result.shear_capacity == pytest.approx(20.0)
        assert result.stiffness == pytest.approx(5.0)


class TestDiagonalWall45Degrees:
    """45° 壁のテスト。"""

    def setup_method(self) -> None:
        self.wall = DiagonalWall(
            start=(0, 0), end=(3000, 3000),
            shear_capacity=20.0, stiffness=5.0,
        )

    def test_angle(self) -> None:
        assert self.wall.angle_deg == pytest.approx(45.0)

    def test_decompose_x(self) -> None:
        result = self.wall.decompose(ForceDirection.X)
        # cos(45°) = 1/√2 → P_x = 20/√2 ≈ 14.1421
        assert result.shear_capacity == pytest.approx(20.0 / math.sqrt(2))
        # cos²(45°) = 0.5 → K_x = 2.5
        assert result.stiffness == pytest.approx(2.5)

    def test_decompose_y(self) -> None:
        result = self.wall.decompose(ForceDirection.Y)
        # sin(45°) = 1/√2 → P_y = 20/√2 ≈ 14.1421
        assert result.shear_capacity == pytest.approx(20.0 / math.sqrt(2))
        # sin²(45°) = 0.5 → K_y = 2.5
        assert result.stiffness == pytest.approx(2.5)


class TestDiagonalWall30Degrees:
    """30° 壁のテスト。"""

    def test_decompose_30deg(self) -> None:
        # 30° の壁: end = (cos30°×L, sin30°×L)
        length = 3000
        end_x = length * math.cos(math.radians(30))
        end_y = length * math.sin(math.radians(30))
        wall = DiagonalWall(
            start=(0, 0), end=(end_x, end_y),
            shear_capacity=20.0, stiffness=5.0,
        )
        assert wall.angle_deg == pytest.approx(30.0)

        result_x = wall.decompose(ForceDirection.X)
        # P_x = 20 * cos(30°) = 20 * √3/2
        assert result_x.shear_capacity == pytest.approx(20.0 * math.cos(math.radians(30)))
        # K_x = 5 * cos²(30°) = 5 * 3/4 = 3.75
        assert result_x.stiffness == pytest.approx(5.0 * math.cos(math.radians(30)) ** 2)

        result_y = wall.decompose(ForceDirection.Y)
        # P_y = 20 * sin(30°) = 10
        assert result_y.shear_capacity == pytest.approx(10.0)
        # K_y = 5 * sin²(30°) = 5 * 0.25 = 1.25
        assert result_y.stiffness == pytest.approx(1.25)


class TestDiagonalWallReductionFactor:
    """耐力低減係数のテスト。"""

    def test_reduction_applied(self) -> None:
        wall = DiagonalWall(
            start=(0, 0), end=(3000, 3000),
            shear_capacity=20.0, stiffness=5.0,
            reduction_factor=0.8,
        )
        result = wall.decompose(ForceDirection.X)
        # P_x = 20 * cos(45°) * 0.8
        expected_p = 20.0 * math.cos(math.radians(45)) * 0.8
        assert result.shear_capacity == pytest.approx(expected_p)
        # 剛性には低減係数を乗じない
        assert result.stiffness == pytest.approx(2.5)
        assert result.reduction_applied is True
        assert result.reduction_factor == 0.8
        assert result.note is not None

    def test_no_reduction(self) -> None:
        wall = DiagonalWall(
            start=(0, 0), end=(3000, 3000),
            shear_capacity=20.0, stiffness=5.0,
        )
        result = wall.decompose(ForceDirection.X)
        assert result.reduction_applied is False

    def test_custom_note(self) -> None:
        wall = DiagonalWall(
            start=(0, 0), end=(3000, 3000),
            shear_capacity=20.0, stiffness=5.0,
            reduction_factor=0.9,
            note="開口部近接による低減",
        )
        result = wall.decompose(ForceDirection.X)
        assert result.note == "開口部近接による低減"


class TestDiagonalWallEdgeCases:
    """エッジケースのテスト。"""

    def test_same_point_raises(self) -> None:
        with pytest.raises(ValueError, match="同一座標"):
            DiagonalWall(
                start=(0, 0), end=(0, 0),
                shear_capacity=20.0, stiffness=5.0,
            )

    def test_negative_capacity_raises(self) -> None:
        with pytest.raises(ValueError, match="0 以上"):
            DiagonalWall(
                start=(0, 0), end=(3000, 0),
                shear_capacity=-1.0, stiffness=5.0,
            )

    def test_negative_stiffness_raises(self) -> None:
        with pytest.raises(ValueError, match="0 以上"):
            DiagonalWall(
                start=(0, 0), end=(3000, 0),
                shear_capacity=20.0, stiffness=-1.0,
            )

    def test_invalid_reduction_factor_raises(self) -> None:
        with pytest.raises(ValueError, match="0 < factor"):
            DiagonalWall(
                start=(0, 0), end=(3000, 0),
                shear_capacity=20.0, stiffness=5.0,
                reduction_factor=1.5,
            )

    def test_calculation_log(self) -> None:
        wall = DiagonalWall(
            start=(0, 0), end=(3000, 3000),
            shear_capacity=20.0, stiffness=5.0,
        )
        log = wall.calculation_log(ForceDirection.X)
        assert "斜め壁分解" in log
        assert "cos(θ)" in log

    def test_repr(self) -> None:
        wall = DiagonalWall(
            start=(0, 0), end=(3000, 3000),
            shear_capacity=20.0, stiffness=5.0,
        )
        r = repr(wall)
        assert "DiagonalWall" in r
        assert "45.0°" in r

    def test_reverse_direction_same_angle(self) -> None:
        """始点・終点を入れ替えても同じ角度になることを確認。"""
        wall_a = DiagonalWall(
            start=(0, 0), end=(3000, 3000),
            shear_capacity=20.0, stiffness=5.0,
        )
        wall_b = DiagonalWall(
            start=(3000, 3000), end=(0, 0),
            shear_capacity=20.0, stiffness=5.0,
        )
        assert wall_a.angle_deg == pytest.approx(wall_b.angle_deg)
