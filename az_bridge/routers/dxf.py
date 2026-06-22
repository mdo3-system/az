import os
import tempfile
import json
import logging
from pathlib import Path
from typing import Any
from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from ..dxf_parser import DxfParser
from ..models import ForceDirection
from ..polygon_analysis import FloorPolygon
from ..dxf_merger import merge_dxf_files

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1")

@router.post("/merge-floors")
def merge_floors(
    file_1f: UploadFile = File(None),
    file_2f: UploadFile = File(None),
    file_3f: UploadFile = File(None),
    file_ph: UploadFile = File(None)
):
    """複数階のDXFを統合し、フラットなDXFを生成して返す。"""
    files_dict = {}
    
    for label, up_file in {"1F": file_1f, "2F": file_2f, "3F": file_3f, "PH": file_ph}.items():
        if up_file:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".dxf") as tmp:
                tmp.write(up_file.file.read())
                files_dict[label] = tmp.name

    try:
        output_fn, total_lines = merge_dxf_files(files_dict)
    finally:
        for tmp_path in files_dict.values():
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    if total_lines == 0 or not output_fn:
        return JSONResponse(status_code=400, content={"success": False, "error": "図面から図形を1つも抽出できませんでした。"})
    
    size = os.path.getsize(output_fn)
    logger.info(f"--- 統合完了: {output_fn} ({size} bytes) を返します ---")
    
    return FileResponse(output_fn, filename="merged_structure.dxf", media_type="application/dxf")

@router.post("/analyze-floor")
def analyze_floor(
    dxf_file: UploadFile = File(..., description="AZ出力DXFファイル"),
    wall_layers: str = Form('["LAYER31"]', description="壁レイヤ名(JSON配列)"),
    floor_layers: str = Form('["LAYER110"]', description="構面レイヤ名(JSON配列)"),
    min_area: float = Form(10000.0, description="最小ポリゴン面積(mm²)"),
    generate_images: bool = Form(True, description="画像を生成するか"),
) -> dict[str, Any]:
    """DXF → INSERT展開 → レイヤ別分類 → 等価奥行き L 算出。"""
    from ..visualizer import StructureVisualizer
    tmp_dxf_path = None

    try:
        try:
            wal_layers: list[str] = json.loads(wall_layers)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail={
                "error": "PARAM_ERROR",
                "message": f"wall_layers のJSONパースエラー: {e}",
            })
        try:
            flr_layers: list[str] = json.loads(floor_layers)
            if not flr_layers:
                flr_layers = ["LAYER110"]
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail={
                "error": "PARAM_ERROR",
                "message": f"floor_layers のJSONパースエラー: {e}",
            })

        try:
            dxf_content = dxf_file.file.read()
            dxf_suffix = Path(dxf_file.filename or "upload.dxf").suffix or ".dxf"
            with tempfile.NamedTemporaryFile(suffix=dxf_suffix, delete=False) as tmp_dxf:
                tmp_dxf.write(dxf_content)
                tmp_dxf_path = tmp_dxf.name
        except Exception as e:
            raise HTTPException(status_code=400, detail={
                "error": "FILE_ERROR",
                "message": f"ファイル保存エラー: {e}",
            })

        try:
            dxf_parser = DxfParser(
                tmp_dxf_path,
                wall_layers=wal_layers,
                floor_layers=flr_layers,
            )
            columns, wall_lines, detected, bound_walls = dxf_parser.parse()
            logger.info("DXF パース完了: 柱=%d, 壁=%d, 構面=%d, N値壁=%d",
                        len(columns), len(wall_lines), len(detected), len(bound_walls))
        except Exception as e:
            logger.error("DXF パースエラー: %s", e, exc_info=True)
            raise HTTPException(status_code=400, detail={
                "error": "DXF_PARSE_ERROR",
                "message": f"DXF ファイルの解析に失敗: {type(e).__name__}: {e}",
                "stage": "dxf_parsing",
            })

        directions = [ForceDirection.X, ForceDirection.Y]
        floor_results: list[dict[str, Any]] = []

        for dp in detected:
            try:
                fp = FloorPolygon(dp.vertices)
                reentrant = fp.find_reentrant_corners()
                for d in directions:
                    equiv = fp.equivalent_rect(d)
                    floor_results.append({
                        "polygon_id": dp.polygon_id,
                        "direction": d.value,
                        "area_mm2": round(equiv.area, 1),
                        "projected_width_mm": round(equiv.width, 1),
                        "equivalent_depth_mm": round(equiv.depth, 1),
                        "vertex_count": len(dp.vertices),
                        "reentrant_count": len(reentrant),
                        "subdivision_warning": fp.requires_subdivision_warning,
                    })
            except ValueError as ve:
                logger.warning("ポリゴン %s 算出スキップ: %s", dp.polygon_id, ve)
                continue

        images: dict[str, Any] = {}
        if generate_images and detected:
            viz = StructureVisualizer()
            try:
                images["polygon_map"] = viz.generate_map(detected, wall_lines)
            except Exception as e:
                logger.warning("俯瞰図生成エラー: %s", e)

            comparison_images: list[dict[str, Any]] = []
            for dp in detected:
                try:
                    fp = FloorPolygon(dp.vertices)
                    for d in directions:
                        equiv = fp.equivalent_rect(d)
                        b64 = viz.generate(
                            fp, equiv, d,
                            title=f"{dp.polygon_id} — {d.value}方向",
                        )
                        comparison_images.append({
                            "polygon_id": dp.polygon_id,
                            "direction": d.value,
                            "image_base64": b64,
                        })
                except ValueError:
                    continue
            images["comparisons"] = comparison_images

        response = {
            "summary": {
                "polygon_count": len(detected),
                "wall_line_count": len(wall_lines),
                "column_count": len(columns),
            },
            "floor_analyses": floor_results,
            "images": images,
        }

        logger.info("解析完了: ポリゴン=%d", len(detected))
        return response

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error("重大なサーバーエラー(Failed to fetch 回避):\n%s", tb)
        return JSONResponse(status_code=500, content={
            "error": "CRITICAL_CRASH",
            "message": f"{type(e).__name__}: {str(e)}",
            "traceback": tb
        })
    finally:
        if tmp_dxf_path:
            try:
                Path(tmp_dxf_path).unlink(missing_ok=True)
            except Exception:
                pass

@router.post("/extract-walls")
def extract_walls(
    file: UploadFile = File(...),
    column_layers_json: str = Form(default='["LAYER27", "LAYER28", "LAYER29", "LAYER30"]'),
    wall_layers_json: str = Form(default='["LAYER31"]'),
):
    """DXFをアップロードし、N値計算用の壁・柱データを抽出して返す。"""
    try:
        col_layers = json.loads(column_layers_json)
        wal_layers = json.loads(wall_layers_json)
    except json.JSONDecodeError:
        col_layers = ["LAYER27", "LAYER28", "LAYER29", "LAYER30"]
        wal_layers = ["LAYER31"]

    if not col_layers:
        col_layers = ["LAYER27", "LAYER28", "LAYER29", "LAYER30"]
    if not wal_layers:
        wal_layers = ["LAYER31"]

    tmp_dxf_path = ""
    try:
        dxf_suffix = Path(file.filename or "unknown.dxf").suffix
        dxf_content = file.file.read()

        try:
            with tempfile.NamedTemporaryFile(suffix=dxf_suffix, delete=False) as tmp_dxf:
                tmp_dxf.write(dxf_content)
                tmp_dxf_path = tmp_dxf.name
        except Exception as e:
            raise HTTPException(status_code=400, detail={
                "error": "FILE_ERROR",
                "message": f"ファイル保存エラー: {e}",
            })

        try:
            dxf_parser = DxfParser(
                tmp_dxf_path,
                column_layers=col_layers,
                wall_layers=wal_layers,
            )
            columns, wall_lines, detected, bound_walls = dxf_parser.parse()
            logger.info("DXF パース完了 (extract-walls): N値壁=%d", len(bound_walls))
        except Exception as e:
            logger.error("DXF パースエラー: %s", e, exc_info=True)
            raise HTTPException(status_code=400, detail={
                "error": "DXF_PARSE_ERROR",
                "message": f"DXF ファイルの解析に失敗: {type(e).__name__}: {e}",
                "stage": "dxf_parsing",
            })

        serialized_walls = []
        cols_dict = {}
        
        for w in bound_walls:
            serialized_walls.append({
                "wall_id": w.id,
                "length": round(w.length, 1),
                "start_col": w.start_column.id if w.start_column else None,
                "end_col": w.end_column.id if w.end_column else None,
                "is_diagonal": w.is_diagonal,
                "multiplier": w.multiplier,
            })
            
            for c in (w.start_column, w.end_column):
                if c and c.id not in cols_dict:
                    cols_dict[c.id] = {
                        "id": c.id,
                        "x": round(c.x, 1),
                        "y": round(c.y, 1),
                        "position_type": c.position_type
                    }

        return {
            "walls": serialized_walls,
            "columns": list(cols_dict.values())
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error("重大なサーバーエラー(extract-walls):\n%s", tb)
        return JSONResponse(status_code=500, content={
            "error": "CRITICAL_CRASH",
            "message": f"{type(e).__name__}: {str(e)}",
            "traceback": tb
        })
    finally:
        if tmp_dxf_path:
            try:
                Path(tmp_dxf_path).unlink(missing_ok=True)
            except Exception:
                pass
