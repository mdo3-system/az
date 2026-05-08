"""FloorPolygon クラスのユニットテスト"""

import math

import pytest

from az_bridge.models import ForceDirection
from az_bridge.polygon_analysis import FloorPolygon


class TestFloorPolygonBasic:
    """基本的な矩形ポリゴンのテスト。"""

    def setup_method(self) -> None:
        # 4000mm × 3000mm の矩形
        self.rect = FloorPolygon(
            [(0, 0), (4000, 0), (4000, 3000), (0, 3000)]
        )

    def test_area(self) -> None:
        assert self.rect.area == pytest.approx(4000 * 3000)

    def test_projected_width_x(self) -> None:
        # X方向加力 → Y方向投影幅 = 3000
        assert self.rect.projected_width(ForceDirection.X) == pytest.approx(3000)

    def test_projected_width_y(self) -> None:
        # Y方向加力 → X方向投影幅 = 4000
        assert self.rect.projected_width(ForceDirection.Y) == pytest.approx(4000)

    def test_equivalent_rect_x(self) -> None:
        result = self.rect.equivalent_rect(ForceDirection.X)
        assert result.width == pytest.approx(3000)
        assert result.depth == pytest.approx(4000)  # L_eff = 12e6 / 3000
        assert result.area == pytest.approx(12_000_000)
        assert result.direction == ForceDirection.X

    def test_equivalent_rect_y(self) -> None:
        result = self.rect.equivalent_rect(ForceDirection.Y)
        assert result.width == pytest.approx(4000)
        assert result.depth == pytest.approx(3000)  # L_eff = 12e6 / 4000
        assert result.area == pytest.approx(12_000_000)

    def test_vertices(self) -> None:
        assert len(self.rect.vertices) == 4


class TestFloorPolygonLShape:
    """L字型凹多角形のテスト。"""

    def setup_method(self) -> None:
        # L字型: 全体 6000×4000 から右上 3000×2000 を除いた形状
        #   (0,4000)-----(3000,4000)
        #   |                |
        #   |         (3000,2000)---(6000,2000)
        #   |                          |
        #   (0,0)---------------(6000,0)
        self.l_shape = FloorPolygon([
            (0, 0), (6000, 0), (6000, 2000),
            (3000, 2000), (3000, 4000), (0, 4000),
        ])

    def test_area(self) -> None:
        # 全体 6000×4000 - 除外 3000×2000 = 24e6 - 6e6 = 18e6
        assert self.l_shape.area == pytest.approx(18_000_000)

    def test_projected_width_x(self) -> None:
        # Y方向投影: 0 → 4000 = 4000
        assert self.l_shape.projected_width(ForceDirection.X) == pytest.approx(4000)

    def test_projected_width_y(self) -> None:
        # X方向投影: 0 → 6000 = 6000
        assert self.l_shape.projected_width(ForceDirection.Y) == pytest.approx(6000)

    def test_equivalent_rect_x(self) -> None:
        result = self.l_shape.equivalent_rect(ForceDirection.X)
        # L_eff = 18e6 / 4000 = 4500
        assert result.depth == pytest.approx(4500)

    def test_equivalent_rect_y(self) -> None:
        result = self.l_shape.equivalent_rect(ForceDirection.Y)
        # L_eff = 18e6 / 6000 = 3000
        assert result.depth == pytest.approx(3000)


class TestFloorPolygonTriangle:
    """三角形ポリゴンのテスト。"""

    def test_triangle_area(self) -> None:
        tri = FloorPolygon([(0, 0), (6000, 0), (3000, 4000)])
        # 面積 = 0.5 × 6000 × 4000 = 12e6
        assert tri.area == pytest.approx(12_000_000)

    def test_triangle_equivalent_rect(self) -> None:
        tri = FloorPolygon([(0, 0), (6000, 0), (3000, 4000)])
        result = tri.equivalent_rect(ForceDirection.X)
        # W = 4000 (Y投影幅), L_eff = 12e6 / 4000 = 3000
        assert result.width == pytest.approx(4000)
        assert result.depth == pytest.approx(3000)


class TestFloorPolygonSelfIntersecting:
    """自己交差ポリゴンのテスト。"""

    def test_bowtie_polygon_is_repaired(self) -> None:
        # ボウタイ形状（蝶ネクタイ型）— 自己交差する
        bowtie = FloorPolygon([
            (0, 0), (4000, 4000), (4000, 0), (0, 4000)
        ])
        # make_valid 後、面積が正の値であること
        assert bowtie.area > 0
        # Shapely ポリゴンとして有効であること
        assert bowtie.shapely_polygon.is_valid


class TestFloorPolygonEdgeCases:
    """エッジケースのテスト。"""

    def test_less_than_3_vertices_raises(self) -> None:
        with pytest.raises(ValueError, match="最低 3 頂点"):
            FloorPolygon([(0, 0), (1000, 0)])

    def test_calculation_log_contains_key_values(self) -> None:
        fp = FloorPolygon([(0, 0), (4000, 0), (4000, 3000), (0, 3000)])
        log = fp.calculation_log(ForceDirection.X)
        assert "構面面積 S" in log
        assert "有効受圧幅 W" in log
        assert "等価奥行き L_eff" in log

    def test_repr(self) -> None:
        fp = FloorPolygon([(0, 0), (4000, 0), (4000, 3000), (0, 3000)])
        r = repr(fp)
        assert "FloorPolygon" in r
        assert "4pts" in r


class TestFloorPolygonReentrantCorners:
    """入隅検知のテスト。"""

    def test_rectangle_no_reentrant(self) -> None:
        """矩形は入隅なし。"""
        fp = FloorPolygon([(0, 0), (4000, 0), (4000, 3000), (0, 3000)])
        corners = fp.find_reentrant_corners()
        assert len(corners) == 0
        assert fp.requires_subdivision_warning is False

    def test_l_shape_one_reentrant(self) -> None:
        """L字型は入隅 1 箇所。"""
        #   (0,4000)-----(3000,4000)
        #   |                |
        #   |         (3000,2000)---(6000,2000)  ← 入隅
        #   |                          |
        #   (0,0)---------------(6000,0)
        fp = FloorPolygon([
            (0, 0), (6000, 0), (6000, 2000),
            (3000, 2000), (3000, 4000), (0, 4000),
        ])
        corners = fp.find_reentrant_corners()
        assert len(corners) == 1
        assert fp.requires_subdivision_warning is True

        # 入隅の座標を確認
        _, coord, angle = corners[0]
        assert coord[0] == pytest.approx(3000)
        assert coord[1] == pytest.approx(2000)
        # 入隅は内角 > 180°
        assert angle > 180.0

    def test_u_shape_two_reentrants(self) -> None:
        """コの字型は入隅 2 箇所。"""
        #   (0,4000)---(2000,4000)      (4000,4000)---(6000,4000)
        #   |               |                |              |
        #   |          (2000,2000)------(4000,2000)         |
        #   |                                               |
        #   (0,0)--------------------------------------(6000,0)
        fp = FloorPolygon([
            (0, 0), (6000, 0), (6000, 4000),
            (4000, 4000), (4000, 2000), (2000, 2000),
            (2000, 4000), (0, 4000),
        ])
        corners = fp.find_reentrant_corners()
        assert len(corners) == 2
        assert fp.requires_subdivision_warning is True

    def test_triangle_no_reentrant(self) -> None:
        """三角形（凸）は入隅なし。"""
        fp = FloorPolygon([(0, 0), (6000, 0), (3000, 4000)])
        assert fp.requires_subdivision_warning is False

    def test_calculation_log_with_reentrant(self) -> None:
        """入隅がある場合、ログに警告が含まれる。"""
        fp = FloorPolygon([
            (0, 0), (6000, 0), (6000, 2000),
            (3000, 2000), (3000, 4000), (0, 4000),
        ])
        log = fp.calculation_log(ForceDirection.X)
        assert "入隅検出" in log
        assert "ブロック分割" in log

