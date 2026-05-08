"""幾何データ（DXF）パース処理

ARCHITREND ZERO から出力された平面図・伏図の DXF ファイルから、
柱（点）・壁（線分）・水平構面（閉ポリゴン）の座標データを抽出する。

AZ 固有仕様:
    - レイヤ名は "LAYER" + 数字 (例: LAYER27)
    - 全エンティティが INSERT (FcPack%d...) ブロック内に格納
    - 柱: 4本のLINEで矩形描画 → 中心座標を抽出
    - 壁: 4本のLINEで矩形描画 → 両端中心を結ぶ線分を抽出
    - 構面: 4本のLINEで矩形パネル描画 → 閉ポリゴンとして抽出

推奨ライブラリ: ezdxf
"""

from __future__ import annotations

import logging
import math
from pathlib import Path
from typing import Sequence

import ezdxf
from ezdxf.document import Drawing
from ezdxf.layouts import BaseLayout

from .models import ColumnPoint, DetectedPolygon, WallLine

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# AZ レイヤルール定義
# ------------------------------------------------------------------

# デフォルトレイヤマッピング (AZ標準)
DEFAULT_COLUMN_LAYERS = {"LAYER27", "LAYER28", "LAYER29", "LAYER30"}
DEFAULT_WALL_LAYERS = {"LAYER31"}
DEFAULT_FLOOR_LAYERS = {"LAYER49"}
DEFAULT_IGNORE_LAYERS = {"LAYER1", "LAYER6", "LAYER57", "LAYER90"}


class DxfParser:
    """DXF ファイルから柱・壁・構面ポリゴンを抽出するパーサー。

    AZ 出力 DXF の INSERT ブロック構造を再帰展開し、
    レイヤルールに基づいてエンティティを分類する。

    Parameters
    ----------
    filepath : str | Path
        DXF ファイルのパス
    column_layers : Sequence[str] | None
        柱レイヤ名リスト (None → AZデフォルト)
    wall_layers : Sequence[str] | None
        壁レイヤ名リスト (None → AZデフォルト)
    floor_layers : Sequence[str] | None
        構面レイヤ名リスト (None → AZデフォルト)
    """

    def __init__(
        self,
        filepath: str | Path,
        column_layers: Sequence[str] | None = None,
        wall_layers: Sequence[str] | None = None,
        floor_layers: Sequence[str] | None = None,
    ) -> None:
        self._filepath = Path(filepath)
        self._column_layers = set(column_layers) if column_layers else DEFAULT_COLUMN_LAYERS
        self._wall_layers = set(wall_layers) if wall_layers else DEFAULT_WALL_LAYERS
        self._floor_layers = set(floor_layers) if floor_layers else DEFAULT_FLOOR_LAYERS
        self.raw_points_by_layer: dict[str, list[tuple[float, float]]] = {}

        if not self._filepath.exists():
            raise FileNotFoundError(f"DXF ファイルが見つかりません: {self._filepath}")

    def parse(self) -> tuple[list[ColumnPoint], list[WallLine], list[DetectedPolygon], list]:
        """各種エンティティを整理・展開して返す。

        Returns:
            columns: 柱座標のリスト
            wall_lines: 壁LINEのリスト
            detected_polygons: 閉じた水平構面ポリゴンのリスト
            bound_walls: N値算定用にバインドされたWallのリスト
        """
        logger.info("DXF 読み込み開始: %s", self._filepath.name)
        doc = self._read_dxf_with_fallback()
        if not doc:
            return [], [], [], []

        layer_blocks, layer_polygons = self._expand_all_inserts(doc)
        columns = self._build_columns(layer_blocks)
        wall_lines = self._build_walls(layer_blocks)
        detected_polygons = self._build_floor_polygons(layer_blocks, layer_polygons)
        
        # N値算定モデルへのバインド
        from az_bridge.n_value_calculator import Column, Wall
        
        unique_columns: list[Column] = []
        # ColumnPointからColumnへの重複排除変換
        for cp in columns:
            duplicate = False
            for uc in unique_columns:
                if math.hypot(uc.x - cp.x, uc.y - cp.y) < 1.0:
                    duplicate = True
                    break
            if not duplicate:
                unique_columns.append(Column(id=f"C{len(unique_columns)+1}", x=cp.x, y=cp.y))
                
        # 生の点（POINT, CIRCLE, INSERT原点）からの追加
        for layer, pts in getattr(self, "raw_points_by_layer", {}).items():
            if layer in self._column_layers:
                for pt in pts:
                    duplicate = False
                    for uc in unique_columns:
                        if math.hypot(uc.x - pt[0], uc.y - pt[1]) < 1.0:
                            duplicate = True
                            break
                    if not duplicate:
                        unique_columns.append(Column(id=f"C{len(unique_columns)+1}", x=pt[0], y=pt[1]))
                        
        bound_walls = self._bind_walls_to_columns(wall_lines, unique_columns, tolerance=5.0)

        self._log_summary(layer_blocks, layer_polygons, columns, wall_lines, detected_polygons)

        return columns, wall_lines, detected_polygons, bound_walls

    def _find_nearest_column(self, x: float, y: float, columns: list, tolerance: float):
        nearest_col = None
        min_dist = float('inf')
        for col in columns:
            dist = math.hypot(col.x - x, col.y - y)
            if dist <= tolerance and dist < min_dist:
                min_dist = dist
                nearest_col = col
        return nearest_col

    def _bind_walls_to_columns(self, wall_lines: list[WallLine], columns: list, tolerance: float = 5.0):
        from az_bridge.n_value_calculator import Wall
        bound_walls = []
        for i, w in enumerate(wall_lines):
            wall = Wall(id=f"W{i+1}")
            wall.start_column = self._find_nearest_column(w.start[0], w.start[1], columns, tolerance)
            wall.end_column = self._find_nearest_column(w.end[0], w.end[1], columns, tolerance)
            
            if wall.start_column and wall.end_column:
                dx = wall.end_column.x - wall.start_column.x
                dy = wall.end_column.y - wall.start_column.y
                wall.length = math.hypot(dx, dy)
                wall.angle_rad = math.atan2(dy, dx)
                
                wall.start_column.attached_walls.append(wall)
                wall.end_column.attached_walls.append(wall)
                bound_walls.append(wall)
                
        for col in columns:
            col.evaluate_position_type()
            
        return bound_walls

    # ------------------------------------------------------------------
    # DXF読み込み（エンコーディングフォールバック）
    # ------------------------------------------------------------------

    def _read_dxf_with_fallback(self) -> Drawing:
        """ezdxf → cp932 → utf-8 のフォールバックチェーン。"""
        for enc in [None, "cp932", "utf-8"]:
            try:
                if enc:
                    doc = ezdxf.readfile(str(self._filepath), encoding=enc)
                else:
                    doc = ezdxf.readfile(str(self._filepath))
                enc_label = enc or "default"
                logger.info("DXF '%s' を '%s' で読み込み成功", self._filepath.name, enc_label)
                return doc
            except (UnicodeDecodeError, ezdxf.DXFError) as e:
                enc_label = enc or "default"
                logger.debug("'%s' 読み込み失敗: %s", enc_label, e)
        raise RuntimeError(f"全エンコーディングで DXF 読み込み失敗: {self._filepath}")

    # ------------------------------------------------------------------
    # INSERT ブロック再帰展開
    # ------------------------------------------------------------------

    def _expand_all_inserts(
        self,
        doc: Drawing,
    ) -> tuple[dict[str, list[list]], dict[str, list[list[tuple[float, float]]]]]:
        """モデルスペースの全INSERTを再帰展開し、レイヤ別・ブロック別にLINEとポリゴンを収集。"""
        layer_blocks: dict[str, list[list]] = {}
        layer_polygons: dict[str, list[list[tuple[float, float]]]] = {}

        # ユーザーが直接モデルスペースに描画した「生のLINE」をレイヤ別に収集するプール
        raw_lines_by_layer: dict[str, list] = {}
        raw_points_by_layer: dict[str, list] = {}

        for entity in doc.modelspace():
            etype = entity.dxftype()
            layer = entity.dxf.layer

            if etype == "INSERT":
                block_name = entity.dxf.name
                insert_pt = entity.dxf.insert
                scale_x = entity.dxf.get("xscale", 1.0)
                scale_y = entity.dxf.get("yscale", 1.0)
                rotation = entity.dxf.get("rotation", 0.0)

                block_lines: dict[str, list] = {}
                block_polygons: dict[str, list] = {}
                self._expand_block(
                    doc, block_name, block_lines, block_polygons, raw_points_by_layer,
                    offset_x=insert_pt.x, offset_y=insert_pt.y,
                    scale_x=scale_x, scale_y=scale_y,
                    rotation_deg=rotation, depth=0,
                )
                
                # INSERTの原点をポイントとしても保持しておく（柱レイヤ指定対策）
                raw_points_by_layer.setdefault(layer, []).append((insert_pt.x, insert_pt.y))
                for blayer, lines in block_lines.items():
                    layer_blocks.setdefault(blayer, []).append(lines)
                for blayer, polys in block_polygons.items():
                    layer_polygons.setdefault(blayer, []).extend(polys)

            elif etype == "LINE":
                s = entity.dxf.start
                e = entity.dxf.end
                raw_lines_by_layer.setdefault(layer, []).append(
                    ((s.x, s.y), (e.x, e.y))
                )
                
            elif etype in ("LWPOLYLINE", "POLYLINE"):
                pts = self._extract_polygon_points(entity)
                is_closed = getattr(entity, "closed", False)
                if pts and (is_closed or pts[0] == pts[-1]):
                    layer_polygons.setdefault(layer, []).append(pts)

            elif etype == "POINT":
                p = entity.dxf.location
                raw_points_by_layer.setdefault(layer, []).append((p.x, p.y))

            elif etype == "CIRCLE":
                c = entity.dxf.center
                raw_points_by_layer.setdefault(layer, []).append((c.x, c.y))

        # 生のLINE群を「1つの集約ブロック」としてレイヤごとに追加する
        # これにより、同一レイヤに手動描画された個別の線分から一括でポリゴンが復元される
        for layer, lines in raw_lines_by_layer.items():
            if lines:
                layer_blocks.setdefault(layer, []).append(lines)

        self.raw_points_by_layer = raw_points_by_layer
        return layer_blocks, layer_polygons

    def _extract_polygon_points(self, entity) -> list[tuple[float, float]]:
        """ポリラインから頂点座標リストを抽出する。"""
        pts = []
        etype = entity.dxftype()
        if etype == "LWPOLYLINE":
            for p in entity:
                if len(p) >= 2:
                    pts.append((p[0], p[1]))
        elif etype == "POLYLINE":
            for v in entity.vertices:
                pts.append((v.dxf.location.x, v.dxf.location.y))
        return pts

    def _expand_block(
        self,
        doc: Drawing,
        block_name: str,
        layer_lines: dict,
        layer_polygons: dict,
        raw_points_by_layer: dict,
        offset_x: float,
        offset_y: float,
        scale_x: float = 1.0,
        scale_y: float = 1.0,
        rotation_deg: float = 0.0,
        depth: int = 0,
    ) -> None:
        """ブロック内のエンティティをグローバル座標に変換して収集。"""
        if depth > 5:
            return
        try:
            block = doc.blocks.get(block_name)
        except Exception:
            return
        if block is None:
            return

        rad = math.radians(rotation_deg)
        cos_r = math.cos(rad)
        sin_r = math.sin(rad)

        def to_global(lx: float, ly: float) -> tuple[float, float]:
            sx, sy = lx * scale_x, ly * scale_y
            gx = offset_x + sx * cos_r - sy * sin_r
            gy = offset_y + sx * sin_r + sy * cos_r
            return (gx, gy)

        for sub in block:
            sub_type = sub.dxftype()
            sub_layer = sub.dxf.layer

            if sub_type == "LINE":
                s = sub.dxf.start
                e = sub.dxf.end
                gs = to_global(s.x, s.y)
                ge = to_global(e.x, e.y)
                layer_lines.setdefault(sub_layer, []).append((gs, ge))

            elif sub_type in ("LWPOLYLINE", "POLYLINE"):
                pts = self._extract_polygon_points(sub)
                is_closed = getattr(sub, "closed", False)
                if pts and (is_closed or pts[0] == pts[-1]):
                    global_pts = [to_global(p[0], p[1]) for p in pts]
                    layer_polygons.setdefault(sub_layer, []).append(global_pts)

            elif sub_type == "POINT":
                p = sub.dxf.location
                raw_points_by_layer.setdefault(sub_layer, []).append(to_global(p.x, p.y))

            elif sub_type == "CIRCLE":
                c = sub.dxf.center
                raw_points_by_layer.setdefault(sub_layer, []).append(to_global(c.x, c.y))

            elif sub_type == "INSERT":
                sub_insert = sub.dxf.insert
                gi = to_global(sub_insert.x, sub_insert.y)
                raw_points_by_layer.setdefault(sub_layer, []).append(gi)
                self._expand_block(
                    doc, sub.dxf.name, layer_lines, layer_polygons, raw_points_by_layer,
                    offset_x=gi[0], offset_y=gi[1],
                    scale_x=scale_x * sub.dxf.get("xscale", 1.0),
                    scale_y=scale_y * sub.dxf.get("yscale", 1.0),
                    rotation_deg=rotation_deg + sub.dxf.get("rotation", 0.0),
                    depth=depth + 1,
                )

    # ------------------------------------------------------------------
    # 柱: LINE 矩形 → 中心座標
    # ------------------------------------------------------------------

    def _build_columns(
        self, layer_blocks: dict,
    ) -> list[ColumnPoint]:
        """柱レイヤのブロック群から中心座標を抽出する。

        AZの柱は4本のLINEで矩形を描画。各ブロック内の線分から重心を計算。
        """
        columns: list[ColumnPoint] = []

        for layer in self._column_layers:
            blocks = layer_blocks.get(layer, [])
            for block_lines in blocks:
                if not block_lines:
                    continue

                # 4LINEずつ区切って重心計算
                for i in range(0, len(block_lines), 4):
                    chunk = block_lines[i:i+4]
                    if len(chunk) < 4:
                        continue
                    pts = []
                    for (sx, sy), (ex, ey) in chunk:
                        pts.extend([(sx, sy), (ex, ey)])
                    cx = sum(p[0] for p in pts) / len(pts)
                    cy = sum(p[1] for p in pts) / len(pts)
                    columns.append(ColumnPoint(
                        label="", x=cx, y=cy, layer=layer,
                    ))

        logger.info("柱抽出: %d 本 (layers=%s)", len(columns), list(self._column_layers))
        return columns

    # ------------------------------------------------------------------
    # 壁: LINE 矩形 → 長辺の線分
    # ------------------------------------------------------------------

    def _build_walls(
        self, layer_blocks: dict,
    ) -> list[WallLine]:
        """壁レイヤのブロック群から壁線分を抽出する。"""
        walls: list[WallLine] = []

        for layer in self._wall_layers:
            blocks = layer_blocks.get(layer, [])
            for block_lines in blocks:
                for (sx, sy), (ex, ey) in block_lines:
                    walls.append(WallLine(
                        start=(sx, sy), end=(ex, ey), layer=layer,
                    ))

        logger.info("壁LINE抽出: %d 本 (layers=%s)", len(walls), list(self._wall_layers))
        return walls

    # ------------------------------------------------------------------
    # 構面: LINE矩形 → 閉ポリゴン
    # ------------------------------------------------------------------

    def _build_floor_polygons(
        self, layer_blocks: dict, layer_polygons: dict,
    ) -> list[DetectedPolygon]:
        """構面レイヤから閉ポリゴンを検出する。

        1. LWPOLYLINE または POLYLINE として描画されたポリゴンの頂点を抽出
        2. LINEの集合（ブロック毎）から、polygonize を用いてポリゴンを復元
        いずれも 0.1mm の丸め処理を通し、微小誤差やノイズ（面積 10000 未満等）を弾く。
        """
        from shapely.geometry import MultiLineString
        from shapely.ops import polygonize

        detected: list[DetectedPolygon] = []

        # 座標の丸め込み (0.1mm精度)
        def snap(v: float) -> float:
            return round(v, 1)

        for layer in self._floor_layers:
            # 1. 閉じたポリゴン (LWPOLYLINE / POLYLINE) そのもの
            polygons = layer_polygons.get(layer, [])
            for pts in polygons:
                if len(pts) < 3:
                    continue
                
                snapped = [(snap(p[0]), snap(p[1])) for p in pts]
                if snapped[0] == snapped[-1]:
                    snapped = snapped[:-1]
                
                if len(snapped) < 3:
                    continue

                area = self._area(snapped)
                if area < 10000:
                    continue

                detected.append(DetectedPolygon(
                    polygon_id="",
                    vertices=snapped,
                    source_layer=layer,
                ))

            # 2. ブロック毎に分割された LINE の集合を閉じたポリゴンに復元する
            blocks = layer_blocks.get(layer, [])
            for block_lines in blocks:
                if not block_lines:
                    continue

                snapped_lines = []
                for (sx, sy), (ex, ey) in block_lines:
                    s = (snap(sx), snap(sy))
                    e = (snap(ex), snap(ey))
                    if s != e:
                        snapped_lines.append((s, e))

                if not snapped_lines:
                    continue

                mls = MultiLineString(snapped_lines)
                raw_polys = list(polygonize(mls))

                for poly in raw_polys:
                    if not poly.is_valid or poly.is_empty or poly.area < 10000:
                        continue
                    coords = list(poly.exterior.coords)[:-1]
                    detected.append(DetectedPolygon(
                        polygon_id="",
                        vertices=[(c[0], c[1]) for c in coords],
                        source_layer=layer,
                    ))

        # 面積降順ソート + ID
        detected.sort(key=lambda d: self._area(d.vertices), reverse=True)
        for i, dp in enumerate(detected):
            dp.polygon_id = f"F{i + 1}"

        logger.info("構面ポリゴン検出完了: %d 個", len(detected))
        return detected

    @staticmethod
    def _area(vertices: list[tuple[float, float]]) -> float:
        n = len(vertices)
        if n < 3:
            return 0.0
        a = 0.0
        for i in range(n):
            j = (i + 1) % n
            a += vertices[i][0] * vertices[j][1]
            a -= vertices[j][0] * vertices[i][1]
        return abs(a) / 2.0

    # ------------------------------------------------------------------
    # ログ
    # ------------------------------------------------------------------

    def _log_summary(
        self,
        layer_blocks: dict,
        layer_polygons: dict,
        columns: list[ColumnPoint],
        walls: list[WallLine],
        floor_polygons: list[DetectedPolygon],
    ) -> None:
        """抽出結果のサマリをログ出力する。"""
        total_lines = sum(len(lines) for blocks in layer_blocks.values() for lines in blocks)
        total_blocks = sum(len(blocks) for blocks in layer_blocks.values())
        total_polygons = sum(len(polys) for polys in layer_polygons.values())
        
        all_layers = sorted(set(layer_blocks.keys()) | set(layer_polygons.keys()))
        logger.info("DXF パース完了: LINE合計 %d 本 / %d ブロック, ポリゴン合計 %d 個 (レイヤ: %s)",
                     total_lines, total_blocks, total_polygons, all_layers)
        for layer in all_layers:
            blocks = layer_blocks.get(layer, [])
            polys = layer_polygons.get(layer, [])
            n_lines = sum(len(lines) for lines in blocks)
            if n_lines > 0 or len(polys) > 0:
                logger.info("  %s: %d 本 (%d ブロック), %d ポリゴン", layer, n_lines, len(blocks), len(polys))
        logger.info("  → 柱=%d, 壁=%d, 構面=%d",
                     len(columns), len(walls), len(floor_polygons))

    @classmethod
    def parse_from_doc(
        cls,
        doc: Drawing,
        column_layers: Sequence[str] | None = None,
        wall_layers: Sequence[str] | None = None,
        floor_layers: Sequence[str] | None = None,
    ) -> tuple[list[ColumnPoint], list[WallLine], list[DetectedPolygon]]:
        """既に読み込み済みの Drawing から直接パースする。"""
        col_set = set(column_layers) if column_layers else DEFAULT_COLUMN_LAYERS
        wal_set = set(wall_layers) if wall_layers else DEFAULT_WALL_LAYERS
        flr_set = set(floor_layers) if floor_layers else DEFAULT_FLOOR_LAYERS

        msp = doc.modelspace()

        instance = cls.__new__(cls)
        instance._column_layers = col_set
        instance._wall_layers = wal_set
        instance._floor_layers = flr_set
        instance._filepath = Path("<in-memory>")

        layer_blocks, layer_polygons = instance._expand_all_inserts(msp, doc)

        columns = instance._build_columns(layer_blocks)
        walls = instance._build_walls(layer_blocks)
        floor_polygons = instance._build_floor_polygons(layer_blocks, layer_polygons)

        return columns, walls, floor_polygons

    def __repr__(self) -> str:
        return (
            f"DxfParser(file='{self._filepath.name}', "
            f"column_layers={self._column_layers}, "
            f"wall_layers={self._wall_layers}, "
            f"floor_layers={self._floor_layers})"
        )
