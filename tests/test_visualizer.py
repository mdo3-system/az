"""StructureVisualizer クラスのユニットテスト"""

import base64

import pytest

from az_bridge.models import ForceDirection
from az_bridge.polygon_analysis import FloorPolygon
from az_bridge.visualizer import StructureVisualizer


class TestStructureVisualizerBasic:
    """基本的な描画テスト。"""

    def setup_method(self) -> None:
        self.viz = StructureVisualizer(dpi=72, figsize=(6, 4))
        self.rect_poly = FloorPolygon(
            [(0, 0), (4000, 0), (4000, 3000), (0, 3000)]
        )

    def test_draw_comparison_returns_figure(self) -> None:
        equiv = self.rect_poly.equivalent_rect(ForceDirection.X)
        fig = self.viz.draw_comparison(self.rect_poly, equiv, ForceDirection.X)
        assert fig is not None
        # cleanup
        import matplotlib.pyplot as plt
        plt.close(fig)

    def test_to_base64_png_valid(self) -> None:
        equiv = self.rect_poly.equivalent_rect(ForceDirection.X)
        fig = self.viz.draw_comparison(self.rect_poly, equiv, ForceDirection.X)
        b64 = self.viz.to_base64_png(fig, dpi=72)
        # Base64 デコードが成功するか
        decoded = base64.b64decode(b64)
        # PNG ヘッダ (89 50 4E 47)
        assert decoded[:4] == b"\x89PNG"

    def test_generate_returns_base64(self) -> None:
        equiv = self.rect_poly.equivalent_rect(ForceDirection.X)
        b64 = self.viz.generate(self.rect_poly, equiv, ForceDirection.X)
        assert len(b64) > 100  # 意味のある長さのBase64
        decoded = base64.b64decode(b64)
        assert decoded[:4] == b"\x89PNG"


class TestStructureVisualizerLShape:
    """L字型（入隅あり）の描画テスト。"""

    def test_generates_with_warning(self) -> None:
        viz = StructureVisualizer(dpi=72, figsize=(6, 4))
        l_shape = FloorPolygon([
            (0, 0), (6000, 0), (6000, 2000),
            (3000, 2000), (3000, 4000), (0, 4000),
        ])
        assert l_shape.requires_subdivision_warning is True

        equiv = l_shape.equivalent_rect(ForceDirection.X)
        b64 = viz.generate(l_shape, equiv, ForceDirection.X)
        decoded = base64.b64decode(b64)
        assert decoded[:4] == b"\x89PNG"

    def test_custom_title(self) -> None:
        viz = StructureVisualizer(dpi=72)
        poly = FloorPolygon([(0, 0), (4000, 0), (4000, 3000), (0, 3000)])
        equiv = poly.equivalent_rect(ForceDirection.Y)
        b64 = viz.generate(poly, equiv, ForceDirection.Y, title="テスト図")
        assert len(b64) > 100
