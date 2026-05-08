"""polygon_builder.py のユニットテスト"""

import pytest

from az_bridge.models import WallLine
from az_bridge.polygon_builder import PolygonBuilder


# ------------------------------------------------------------------
# ヘルパー
# ------------------------------------------------------------------


def _rect_walls(x0=0, y0=0, w=4000, h=3000, layer="壁"):
    """矩形を構成する4本の壁LINEを返す。"""
    return [
        WallLine(start=(x0, y0), end=(x0 + w, y0), layer=layer),
        WallLine(start=(x0 + w, y0), end=(x0 + w, y0 + h), layer=layer),
        WallLine(start=(x0 + w, y0 + h), end=(x0, y0 + h), layer=layer),
        WallLine(start=(x0, y0 + h), end=(x0, y0), layer=layer),
    ]


def _l_shape_walls(layer="壁"):
    """L字型ポリゴンを構成する6本の壁LINE。"""
    return [
        WallLine(start=(0, 0), end=(6000, 0), layer=layer),
        WallLine(start=(6000, 0), end=(6000, 2000), layer=layer),
        WallLine(start=(6000, 2000), end=(3000, 2000), layer=layer),
        WallLine(start=(3000, 2000), end=(3000, 4000), layer=layer),
        WallLine(start=(3000, 4000), end=(0, 4000), layer=layer),
        WallLine(start=(0, 4000), end=(0, 0), layer=layer),
    ]


# ------------------------------------------------------------------
# テストクラス
# ------------------------------------------------------------------


class TestPolygonBuilderRectangle:
    """矩形（4本のLINE → 1ポリゴン）。"""

    def setup_method(self):
        self.builder = PolygonBuilder(snap_tolerance=1.0)
        self.walls = _rect_walls()
        self.result = self.builder.build(self.walls)

    def test_detect_one_polygon(self):
        assert len(self.result) == 1

    def test_polygon_id(self):
        assert self.result[0].polygon_id == "F1"

    def test_polygon_has_4_vertices(self):
        assert len(self.result[0].vertices) == 4

    def test_polygon_layer(self):
        assert self.result[0].source_layer == "壁"


class TestPolygonBuilderLShape:
    """L字型（6本のLINE → 1ポリゴン）。"""

    def setup_method(self):
        self.builder = PolygonBuilder(snap_tolerance=1.0)
        self.walls = _l_shape_walls()
        self.result = self.builder.build(self.walls)

    def test_detect_one_polygon(self):
        assert len(self.result) == 1

    def test_polygon_has_6_vertices(self):
        assert len(self.result[0].vertices) == 6


class TestPolygonBuilderMultiple:
    """2つの独立した矩形 → 2ポリゴン。"""

    def setup_method(self):
        self.builder = PolygonBuilder(snap_tolerance=1.0)
        walls = _rect_walls(0, 0, 4000, 3000) + _rect_walls(10000, 0, 5000, 2000)
        self.result = self.builder.build(walls)

    def test_detect_two_polygons(self):
        assert len(self.result) == 2

    def test_sorted_by_area_desc(self):
        """面積降順ソート: 4000×3000 > 5000×2000 """
        assert self.result[0].polygon_id == "F1"
        assert self.result[1].polygon_id == "F2"


class TestPolygonBuilderEdgeCases:
    """エッジケース。"""

    def test_empty_input(self):
        builder = PolygonBuilder()
        assert builder.build([]) == []

    def test_open_lines_no_polygon(self):
        """閉じていない線分 → ポリゴンなし。"""
        builder = PolygonBuilder()
        walls = [
            WallLine(start=(0, 0), end=(1000, 0), layer="壁"),
            WallLine(start=(1000, 0), end=(1000, 1000), layer="壁"),
        ]
        result = builder.build(walls)
        assert len(result) == 0

    def test_negative_tolerance_raises(self):
        with pytest.raises(ValueError):
            PolygonBuilder(snap_tolerance=-1)

    def test_snap_merges_close_endpoints(self):
        """微小な丸め誤差（0.5mm）をスナップで吸収。"""
        builder = PolygonBuilder(snap_tolerance=1.0)
        walls = [
            WallLine(start=(0, 0), end=(4000, 0)),
            WallLine(start=(4000.5, 0), end=(4000.5, 3000)),
            WallLine(start=(4000, 3000), end=(0, 3000)),
            WallLine(start=(0, 3000.5), end=(0, 0)),
        ]
        result = builder.build(walls)
        assert len(result) == 1

    def test_min_area_filters_small(self):
        """最小面積フィルタ: 100mm×100mm (10000mm²) 以下はスキップ。"""
        builder = PolygonBuilder(min_area=50000)
        walls = _rect_walls(0, 0, 100, 100)  # 10000 mm²
        result = builder.build(walls)
        assert len(result) == 0


class TestPolygonBuilderRepr:
    def test_repr(self):
        builder = PolygonBuilder(snap_tolerance=2.0, min_area=5000)
        assert "snap=2.0mm" in repr(builder)
