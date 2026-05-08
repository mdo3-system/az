"""DxfParser クラスのユニットテスト

ezdxf でメモリ上に AZ構造（INSERTブロック内LINE）の
モック DXF を生成してパースする。
"""

import pytest
import ezdxf

from az_bridge.dxf_parser import DxfParser
from az_bridge.models import ColumnPoint, WallLine, DetectedPolygon


# ------------------------------------------------------------------
# ヘルパー: AZ形式DXFの生成
# ------------------------------------------------------------------


def _make_az_doc(
    column_lines=None,  # [(layer, [(start, end), ...]), ...]
    wall_lines=None,
    floor_polys=None,   # [(layer, [(x, y), ...]), ...]
    floor_lines=None,   # [(layer, [(start, end), ...]), ...]
    direct_lines=None,  # modelspace直接LINE [(layer, start, end), ...]
):
    """AZ構造のモックDXFを生成する。"""
    doc = ezdxf.new()
    msp = doc.modelspace()
    block_id = 0

    for source, lines_data in [
        ("col", column_lines or []),
        ("wal", wall_lines or []),
        ("flr_line", floor_lines or []),
    ]:
        for layer, segs in lines_data:
            block_id += 1
            bname = f"FcPack{block_id}"
            block = doc.blocks.new(name=bname)
            for start, end in segs:
                block.add_line(start, end, dxfattribs={"layer": layer})
            msp.add_blockref(bname, insert=(0, 0), dxfattribs={"layer": layer})

    # Floor Polygons
    if floor_polys:
        for layer, pts in floor_polys:
            block_id += 1
            bname = f"FcPack{block_id}"
            block = doc.blocks.new(name=bname)
            block.add_lwpolyline(pts, close=True, dxfattribs={"layer": layer})
            msp.add_blockref(bname, insert=(0, 0), dxfattribs={"layer": layer})

    # 直接LINE（INSERT外）
    for layer, start, end in (direct_lines or []):
        msp.add_line(start, end, dxfattribs={"layer": layer})

    return doc


# ------------------------------------------------------------------
# テストクラス
# ------------------------------------------------------------------


class TestDxfParserWalls:
    """壁（LINE）の抽出テスト。"""

    def test_extract_wall_lines_from_insert(self) -> None:
        doc = _make_az_doc(wall_lines=[
            ("LAYER31", [((0, 0), (3000, 0)), ((0, 0), (0, 3000))]),
        ])
        _, walls, _ = DxfParser.parse_from_doc(
            doc, wall_layers=["LAYER31"],
        )
        assert len(walls) == 2
        assert walls[0].layer == "LAYER31"

    def test_extract_wall_lines_direct(self) -> None:
        """モデルスペース直接LINEも壁として取得する。"""
        doc = _make_az_doc(direct_lines=[
            ("LAYER31", (0, 0), (1000, 0)),
        ])
        _, walls, _ = DxfParser.parse_from_doc(
            doc, wall_layers=["LAYER31"],
        )
        assert len(walls) == 1

    def test_ignore_other_layers(self) -> None:
        doc = _make_az_doc(wall_lines=[
            ("LAYER99", [((0, 0), (1000, 0))]),
        ])
        _, walls, _ = DxfParser.parse_from_doc(
            doc, wall_layers=["LAYER31"],
        )
        assert len(walls) == 0


class TestDxfParserFloorPolygons:
    """構面（閉じたLWPOLYLINE / LINE群からの復元 ポリゴン）の抽出テスト。"""

    def test_detect_floor_polygon_from_polyline(self) -> None:
        """閉じたLWPOLYLINE → 1ポリゴン検出。"""
        rect_pts = [
            (0, 0),
            (6000, 0),
            (6000, 4000),
            (0, 4000),
        ]
        doc = _make_az_doc(floor_polys=[("LAYER49", rect_pts)])
        _, _, polygons = DxfParser.parse_from_doc(
            doc, floor_layers=["LAYER49"],
        )
        assert len(polygons) == 1
        assert polygons[0].polygon_id == "F1"
        assert len(polygons[0].vertices) == 4

    def test_detect_floor_polygon_from_lines(self) -> None:
        """4本の分割されたLINE（同一ブロック内） → 1ポリゴンとして復元検出。"""
        rect_lines = [
            ((0, 0), (6000, 0)),
            ((6000, 0), (6000, 4000)),
            ((6000, 4000), (0, 4000)),
            ((0, 4000), (0, 0)),
        ]
        doc = _make_az_doc(floor_lines=[("LAYER49", rect_lines)])
        _, _, polygons = DxfParser.parse_from_doc(
            doc, floor_layers=["LAYER49"],
        )
        assert len(polygons) == 1
        assert polygons[0].polygon_id == "F1"
        assert len(polygons[0].vertices) == 4

    def test_detect_floor_polygon_with_tiny_gap(self) -> None:
        """端点に0.01mmのズレがあるが、0.1mmスナップにより同一とみなされるか（ラインの場合）。"""
        rect_with_gap = [
            ((0.00, 0.00), (6000.01, -0.01)),  # わずかなズレ
            ((6000.00, 0.00), (6000.00, 4000.00)),
            ((6000.00, 4000.00), (-0.02, 4000.02)), # わずかなズレ
            ((0.00, 4000.00), (0.00, 0.00)),
        ]
        doc = _make_az_doc(floor_lines=[("LAYER49", rect_with_gap)])
        _, _, polygons = DxfParser.parse_from_doc(
            doc, floor_layers=["LAYER49"],
        )
        assert len(polygons) == 1
        assert len(polygons[0].vertices) == 4
        # 0.1mmで丸められているはず
        assert (0.0, 0.0) in polygons[0].vertices
        assert (6000.0, 0.0) in polygons[0].vertices

    def test_no_floor_on_wrong_layer(self) -> None:
        rect_lines = [
            ((0, 0), (6000, 0)),
            ((6000, 0), (6000, 4000)),
            ((6000, 4000), (0, 4000)),
            ((0, 4000), (0, 0)),
        ]
        doc = _make_az_doc(floor_lines=[("LAYER99", rect_lines)])
        _, _, polygons = DxfParser.parse_from_doc(
            doc, floor_layers=["LAYER49"],
        )
        assert len(polygons) == 0


class TestDxfParserColumns:
    """柱（4LINE矩形 → 中心座標）の抽出テスト。"""

    def test_extract_column_center(self) -> None:
        # 4本のLINEで 100x100mm の矩形 → 中心 = (50, 50)
        col_rect = [
            ((0, 0), (100, 0)),
            ((100, 0), (100, 100)),
            ((100, 100), (0, 100)),
            ((0, 100), (0, 0)),
        ]
        doc = _make_az_doc(column_lines=[("LAYER27", col_rect)])
        columns, _, _ = DxfParser.parse_from_doc(
            doc, column_layers=["LAYER27"],
        )
        assert len(columns) == 1
        assert columns[0].x == pytest.approx(50.0)
        assert columns[0].y == pytest.approx(50.0)


class TestDxfParserFileNotFound:
    """ファイル不存在テスト。"""

    def test_file_not_found(self) -> None:
        with pytest.raises(FileNotFoundError):
            DxfParser("nonexistent.dxf")
