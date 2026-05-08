"""api.py のエンドポイント結合テスト（レイヤルール版）"""

import tempfile
from pathlib import Path

import ezdxf
import pytest
from fastapi.testclient import TestClient

from az_bridge.api import app

client = TestClient(app)


# ------------------------------------------------------------------
# テスト用DXF生成（AZ構造を模擬: INSERTブロック内にLINE）
# ------------------------------------------------------------------


def _create_test_dxf_bytes(
    wall_layer: str = "LAYER31",
    floor_layer: str = "LAYER49",
) -> bytes:
    """矩形壁+矩形構面をもつテスト用DXF (AZ INSERT構造模擬)。"""
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    doc.layers.add(wall_layer)
    doc.layers.add(floor_layer)

    # 壁ブロック: 4本のLINEで矩形
    wall_block = doc.blocks.new(name="FcPack%d001")
    wall_rect = [
        ((0, 0), (6000, 0)),
        ((6000, 0), (6000, 100)),
        ((6000, 100), (0, 100)),
        ((0, 100), (0, 0)),
    ]
    for start, end in wall_rect:
        wall_block.add_line(start, end, dxfattribs={"layer": wall_layer})

    # 構面ブロック: 4本のLINEで矩形
    floor_block = doc.blocks.new(name="FcPack%d002")
    floor_rect = [
        ((0, 0), (6000, 0)),
        ((6000, 0), (6000, 4000)),
        ((6000, 4000), (0, 4000)),
        ((0, 4000), (0, 0)),
    ]
    for start, end in floor_rect:
        floor_block.add_line(start, end, dxfattribs={"layer": floor_layer})

    # INSERT
    msp.add_blockref("FcPack%d001", insert=(0, 0), dxfattribs={"layer": wall_layer})
    msp.add_blockref("FcPack%d002", insert=(0, 0), dxfattribs={"layer": floor_layer})

    with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False) as tmp:
        tmp_path = tmp.name
    doc.saveas(tmp_path)
    data = Path(tmp_path).read_bytes()
    Path(tmp_path).unlink(missing_ok=True)
    return data


# ------------------------------------------------------------------
# テストクラス
# ------------------------------------------------------------------


class TestHealthEndpoint:
    def test_health_ok(self):
        res = client.get("/api/v1/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["version"] == "2.0.0"


class TestAnalyzeFloorEndpoint:
    def setup_method(self):
        self.dxf_bytes = _create_test_dxf_bytes()

    def test_basic_analysis(self):
        res = client.post(
            "/api/v1/analyze-floor",
            files={"dxf_file": ("test.dxf", self.dxf_bytes, "application/octet-stream")},
            data={
                "wall_layers": '["LAYER31"]',
                "floor_layers": '["LAYER49"]',
                "min_area": "10000",
                "generate_images": "true",
            },
        )
        assert res.status_code == 200
        data = res.json()

        # サマリ: 構面が検出されること
        assert data["summary"]["polygon_count"] >= 1
        assert data["summary"]["wall_line_count"] >= 4

        # 算定結果（X,Yの2方向）
        floors = data["floor_analyses"]
        assert len(floors) >= 2

        # 画像
        assert "polygon_map" in data["images"]
        assert len(data["images"]["comparisons"]) >= 2

    def test_no_images(self):
        res = client.post(
            "/api/v1/analyze-floor",
            files={"dxf_file": ("test.dxf", self.dxf_bytes, "application/octet-stream")},
            data={
                "wall_layers": '["LAYER31"]',
                "floor_layers": '["LAYER49"]',
                "generate_images": "false",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["images"] == {}

    def test_wrong_layer_no_polygons(self):
        res = client.post(
            "/api/v1/analyze-floor",
            files={"dxf_file": ("test.dxf", self.dxf_bytes, "application/octet-stream")},
            data={
                "wall_layers": '["NONEXISTENT"]',
                "floor_layers": '["NONEXISTENT"]',
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["summary"]["polygon_count"] == 0
        assert len(data["floor_analyses"]) == 0
