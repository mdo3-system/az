"""根拠資料ビジュアライザー

元の不整形な多角形構面と等価矩形モデルを重ね合わせた
比較図（等価置換図）を生成し、Base64 PNG として出力する。
"""

from __future__ import annotations

import base64
import io
import platform
from typing import Optional

import matplotlib

matplotlib.use("Agg")  # 非GUI バックエンド

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.figure import Figure
from shapely.geometry import Polygon as ShapelyPolygon

from .models import EquivalentRect, ForceDirection
from .polygon_analysis import FloorPolygon
from .polygon_builder import PolygonBuilder
from .models import DetectedPolygon


def _configure_japanese_font() -> None:
    """日本語フォントを設定する。"""
    system = platform.system()
    if system == "Windows":
        candidates = ["MS Gothic", "Meiryo", "Yu Gothic"]
    elif system == "Darwin":
        candidates = ["Hiragino Sans", "Hiragino Kaku Gothic Pro"]
    else:
        candidates = ["IPAGothic", "IPAPGothic", "Noto Sans CJK JP"]

    for font in candidates:
        try:
            matplotlib.rcParams["font.family"] = font
            return
        except Exception:
            continue

    # フォールバック: sans-serif
    matplotlib.rcParams["font.family"] = "sans-serif"


_configure_japanese_font()

# 色分け用パレット（最大12色）
_PALETTE = [
    "#3498db", "#e74c3c", "#2ecc71", "#f39c12",
    "#9b59b6", "#1abc9c", "#e67e22", "#2980b9",
    "#c0392b", "#27ae60", "#8e44ad", "#16a085",
]


class StructureVisualizer:
    """構面の等価置換図を生成するビジュアライザー。

    FloorPolygon と EquivalentRect を入力とし、
    重ね合わせ比較図を matplotlib で描画して
    Base64 エンコードされた PNG 文字列として出力する。

    Examples
    --------
    >>> viz = StructureVisualizer()
    >>> fp = FloorPolygon([(0,0),(6000,0),(6000,2000),(3000,2000),(3000,4000),(0,4000)])
    >>> result = fp.equivalent_rect(ForceDirection.X)
    >>> b64 = viz.generate(fp, result, ForceDirection.X)
    """

    # 描画色定義
    POLYGON_FILL_COLOR = "#3498db"
    POLYGON_FILL_ALPHA = 0.25
    POLYGON_EDGE_COLOR = "#2980b9"
    RECT_EDGE_COLOR = "#e74c3c"
    RECT_FILL_ALPHA = 0.10
    WARNING_COLOR = "#e74c3c"
    DIMENSION_COLOR = "#555555"

    def __init__(self, dpi: int = 150, figsize: tuple[float, float] = (10, 8)) -> None:
        self._dpi = dpi
        self._figsize = figsize

    def draw_comparison(
        self,
        polygon: FloorPolygon,
        equiv_rect: EquivalentRect,
        direction: ForceDirection,
        title: Optional[str] = None,
    ) -> Figure:
        """元ポリゴンと等価矩形の比較図を描画する。

        Parameters
        ----------
        polygon : FloorPolygon
            元の構面ポリゴン
        equiv_rect : EquivalentRect
            等価矩形化の結果
        direction : ForceDirection
            加力方向
        title : str, optional
            図のタイトル

        Returns
        -------
        Figure
            matplotlib Figure オブジェクト
        """
        fig, ax = plt.subplots(1, 1, figsize=self._figsize)

        # --- 元ポリゴン描画 ---
        shapely_poly = polygon.shapely_polygon
        poly_coords = list(shapely_poly.exterior.coords)
        xs = [c[0] for c in poly_coords]
        ys = [c[1] for c in poly_coords]

        ax.fill(
            xs, ys,
            color=self.POLYGON_FILL_COLOR,
            alpha=self.POLYGON_FILL_ALPHA,
            label="元構面",
        )
        ax.plot(
            xs, ys,
            color=self.POLYGON_EDGE_COLOR,
            linewidth=2,
            solid_capstyle="round",
        )

        # 頂点番号ラベル
        vertices = list(shapely_poly.exterior.coords)[:-1]
        for i, (vx, vy) in enumerate(vertices):
            ax.annotate(
                f"P{i}",
                (vx, vy),
                textcoords="offset points",
                xytext=(8, 8),
                fontsize=8,
                color=self.POLYGON_EDGE_COLOR,
                fontweight="bold",
            )
            ax.plot(vx, vy, "o", color=self.POLYGON_EDGE_COLOR, markersize=5)

        # --- 等価矩形描画 ---
        min_x, min_y, max_x, max_y = shapely_poly.bounds

        if direction == ForceDirection.X:
            # X方向加力: W=Y投影幅, L_eff=X方向奥行き
            rect_x = min_x
            rect_y = min_y
            rect_w = equiv_rect.depth   # L_eff
            rect_h = equiv_rect.width   # W
        else:
            # Y方向加力: W=X投影幅, L_eff=Y方向奥行き
            rect_x = min_x
            rect_y = min_y
            rect_w = equiv_rect.width   # W
            rect_h = equiv_rect.depth   # L_eff

        rect_patch = mpatches.FancyBboxPatch(
            (rect_x, rect_y),
            rect_w,
            rect_h,
            boxstyle="square,pad=0",
            facecolor=self.RECT_EDGE_COLOR,
            edgecolor=self.RECT_EDGE_COLOR,
            alpha=self.RECT_FILL_ALPHA,
            linewidth=2,
            linestyle="--",
            label="等価矩形",
        )
        ax.add_patch(rect_patch)

        # 等価矩形の破線枠（パッチのlinestyleだけだと見えにくい場合の補助）
        rx = [rect_x, rect_x + rect_w, rect_x + rect_w, rect_x, rect_x]
        ry = [rect_y, rect_y, rect_y + rect_h, rect_y + rect_h, rect_y]
        ax.plot(rx, ry, color=self.RECT_EDGE_COLOR, linewidth=2, linestyle="--")

        # --- 寸法ラベル ---
        # W ラベル
        if direction == ForceDirection.X:
            # W は Y 方向
            ax.annotate(
                f"W = {equiv_rect.width:,.0f}",
                xy=(rect_x - 200, rect_y + rect_h / 2),
                fontsize=9,
                color=self.DIMENSION_COLOR,
                ha="right",
                va="center",
                rotation=90,
            )
            # L_eff ラベル
            ax.annotate(
                f"L_eff = {equiv_rect.depth:,.0f}",
                xy=(rect_x + rect_w / 2, rect_y - 200),
                fontsize=9,
                color=self.DIMENSION_COLOR,
                ha="center",
                va="top",
            )
        else:
            # W は X 方向
            ax.annotate(
                f"W = {equiv_rect.width:,.0f}",
                xy=(rect_x + rect_w / 2, rect_y - 200),
                fontsize=9,
                color=self.DIMENSION_COLOR,
                ha="center",
                va="top",
            )
            ax.annotate(
                f"L_eff = {equiv_rect.depth:,.0f}",
                xy=(rect_x - 200, rect_y + rect_h / 2),
                fontsize=9,
                color=self.DIMENSION_COLOR,
                ha="right",
                va="center",
                rotation=90,
            )

        # --- 面積テキスト ---
        cx = shapely_poly.centroid.x
        cy = shapely_poly.centroid.y
        ax.text(
            cx, cy,
            f"S = {equiv_rect.area:,.0f} mm²",
            fontsize=10,
            color=self.POLYGON_EDGE_COLOR,
            ha="center",
            va="center",
            alpha=0.8,
        )

        # --- 入隅警告 ---
        if polygon.requires_subdivision_warning:
            ax.text(
                0.98, 0.02,
                "⚠ 要ブロック分割検討\n（L字・コの字等の不整形構面）",
                transform=ax.transAxes,
                fontsize=11,
                color=self.WARNING_COLOR,
                fontweight="bold",
                ha="right",
                va="bottom",
                bbox=dict(
                    boxstyle="round,pad=0.4",
                    facecolor="white",
                    edgecolor=self.WARNING_COLOR,
                    alpha=0.9,
                ),
            )

        # --- 軸設定 ---
        margin = max(max_x - min_x, max_y - min_y) * 0.15
        ax.set_xlim(min_x - margin, max(max_x, rect_x + rect_w) + margin)
        ax.set_ylim(min_y - margin, max(max_y, rect_y + rect_h) + margin)
        ax.set_aspect("equal")
        ax.grid(True, alpha=0.3, linestyle=":")
        ax.set_xlabel("X (mm)", fontsize=10)
        ax.set_ylabel("Y (mm)", fontsize=10)

        if title:
            ax.set_title(title, fontsize=13, fontweight="bold")
        else:
            ax.set_title(
                f"構面等価置換図 — 加力方向: {direction.value}",
                fontsize=13,
                fontweight="bold",
            )

        ax.legend(loc="upper right", fontsize=9)
        fig.tight_layout()

        return fig

    @staticmethod
    def to_base64_png(fig: Figure, dpi: int = 150) -> str:
        """Figure を PNG 画像の Base64 文字列に変換する。

        Parameters
        ----------
        fig : Figure
            matplotlib Figure
        dpi : int
            解像度

        Returns
        -------
        str
            Base64 エンコードされた PNG データ
        """
        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=dpi, bbox_inches="tight")
        plt.close(fig)
        buf.seek(0)
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return b64

    def generate(
        self,
        polygon: FloorPolygon,
        equiv_rect: EquivalentRect,
        direction: ForceDirection,
        title: Optional[str] = None,
    ) -> str:
        """比較図を生成し、Base64 PNG 文字列を返す一括メソッド。

        Parameters
        ----------
        polygon : FloorPolygon
        equiv_rect : EquivalentRect
        direction : ForceDirection
        title : str, optional

        Returns
        -------
        str
            Base64 エンコードされた PNG データ
        """
        fig = self.draw_comparison(polygon, equiv_rect, direction, title)
        return self.to_base64_png(fig, dpi=self._dpi)

    # ------------------------------------------------------------------
    # 構面マッピング俯瞰図
    # ------------------------------------------------------------------

    def draw_polygon_map(
        self,
        detected_polygons: list[DetectedPolygon],
        wall_lines: list | None = None,
        title: str = "構面マッピング俯瞰図",
    ) -> Figure:
        """検出ポリゴンを色分けした俯瞰図を描画する。

        Parameters
        ----------
        detected_polygons : list[DetectedPolygon]
            検出されたポリゴンリスト
        wall_lines : list, optional
            背景に描画する壁LINE群
        title : str
            図のタイトル

        Returns
        -------
        Figure
        """
        fig, ax = plt.subplots(1, 1, figsize=self._figsize)

        # --- 背景：壁LINE描画 ---
        if wall_lines:
            for wl in wall_lines:
                ax.plot(
                    [wl.start[0], wl.end[0]],
                    [wl.start[1], wl.end[1]],
                    color="#888888", linewidth=0.5, alpha=0.4,
                )

        # --- ポリゴン描画 ---
        all_x, all_y = [], []
        for i, dp in enumerate(detected_polygons):
            color = _PALETTE[i % len(_PALETTE)]
            verts = dp.vertices + [dp.vertices[0]]  # 閉じる
            xs = [v[0] for v in verts]
            ys = [v[1] for v in verts]
            all_x.extend(xs)
            all_y.extend(ys)

            ax.fill(xs, ys, color=color, alpha=0.25)
            ax.plot(xs, ys, color=color, linewidth=2, solid_capstyle="round")

            # 重心にIDラベル
            cx = sum(v[0] for v in dp.vertices) / len(dp.vertices)
            cy = sum(v[1] for v in dp.vertices) / len(dp.vertices)
            ax.text(
                cx, cy, dp.polygon_id,
                fontsize=14, fontweight="bold", color=color,
                ha="center", va="center",
                bbox=dict(
                    boxstyle="round,pad=0.3",
                    facecolor="white",
                    edgecolor=color,
                    alpha=0.85,
                ),
            )

        # --- 軸設定 ---
        if all_x and all_y:
            margin_x = (max(all_x) - min(all_x)) * 0.1 + 500
            margin_y = (max(all_y) - min(all_y)) * 0.1 + 500
            ax.set_xlim(min(all_x) - margin_x, max(all_x) + margin_x)
            ax.set_ylim(min(all_y) - margin_y, max(all_y) + margin_y)

        ax.set_aspect("equal")
        ax.grid(True, alpha=0.3, linestyle=":")
        ax.set_xlabel("X (mm)", fontsize=10)
        ax.set_ylabel("Y (mm)", fontsize=10)
        ax.set_title(title, fontsize=14, fontweight="bold")
        fig.tight_layout()
        return fig

    def generate_map(
        self,
        detected_polygons: list[DetectedPolygon],
        wall_lines: list | None = None,
        title: str = "構面マッピング俯瞰図",
    ) -> str:
        """俯瞰図を生成し、Base64 PNG 文字列を返す。"""
        fig = self.draw_polygon_map(detected_polygons, wall_lines, title)
        return self.to_base64_png(fig, dpi=self._dpi)
