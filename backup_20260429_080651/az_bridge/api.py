"""WEB API エンドポイント — 機能①特化版

DXFファイル単体を受け取り、壁LINE線分から閉ポリゴンを自動検出し、
各ポリゴンの等価奥行き L = S / W を算出して返す。
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import traceback
from pathlib import Path
from typing import Any

import ezdxf

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .dxf_parser import DxfParser
from .models import ForceDirection
from .polygon_analysis import FloorPolygon
from .polygon_builder import PolygonBuilder
from .visualizer import StructureVisualizer

app = FastAPI(
    title="AZ Bridge Tool API",
    description="ARCHITREND ZERO連携 水平構面等価奥行き算定ツール",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------
# 定数とヘルパー関数
# ------------------------------------------------------------------

# 名寄せルール
RENAME_MAP = {
    "通り芯": "GLID",
    "柱": "COL",
    "耐力壁": "WALL_BRACED",
    "壁": "WALL_NORMAL"
}

def flatten_entity(entity, target_layer, out_msp):
    """
    複雑な図形（ブロックやポリライン）を「単純な要素」に分解して抽出する魔法の関数
    """
    count = 0
    try:
        etype = entity.dxftype()
        # 基本図形はそのままコピー
        if etype == 'LINE':
            out_msp.add_line(entity.dxf.start, entity.dxf.end, dxfattribs={'layer': target_layer})
            count += 1
        elif etype == 'CIRCLE':
            out_msp.add_circle(entity.dxf.center, entity.dxf.radius, dxfattribs={'layer': target_layer})
            count += 1
        elif etype == 'ARC':
            out_msp.add_arc(entity.dxf.center, entity.dxf.radius, entity.dxf.start_angle, entity.dxf.end_angle, dxfattribs={'layer': target_layer})
            count += 1
        elif etype == 'TEXT':
            # R12互換形式で文字を追加
            out_msp.add_text(entity.dxf.text, dxfattribs={
                'insert': entity.dxf.insert,
                'height': entity.dxf.height,
                'rotation': entity.dxf.rotation,
                'layer': target_layer
            })
            count += 1
        elif etype == 'MTEXT':
            # MTEXTの制御コード（\f...; \P 等）を除去して純粋なテキストのみを抽出
            import re
            clean_text = re.sub(r'\\[f|F|p|P|l|L|O|o|A|H|Q|S|T|W].*?;', '', entity.text)
            clean_text = re.sub(r'\\P', '\n', clean_text)
            clean_text = re.sub(r'[{}]', '', clean_text)
            
            out_msp.add_text(clean_text, dxfattribs={
                'insert': entity.dxf.insert,
                'height': entity.dxf.char_height if hasattr(entity.dxf, 'char_height') else 200,
                'layer': target_layer
            })
            count += 1
        elif etype == 'POINT':
            out_msp.add_point(entity.dxf.location, dxfattribs={'layer': target_layer})
            count += 1
        elif etype in ('SOLID', 'TRACE'):
            out_msp.add_solid([entity.dxf.vtx0, entity.dxf.vtx1, entity.dxf.vtx2, entity.dxf.vtx3], dxfattribs={'layer': target_layer})
            count += 1
        elif etype == 'ELLIPSE':
            # 楕円は近似する（R12互換のためには本来分解が必要だが、R2010なのでそのまま追加を試みるか、
            # あるいは簡易的に何もしないか。ここではスキップまたは分解を検討）
            pass 
        # ブロック（INSERT）やポリラインなどの複雑な塊は、内部の要素を計算して抽出
        elif hasattr(entity, 'virtual_entities'):
            # HATCHなどは重いため軽量化のため除外
            if etype == 'HATCH':
                return 0
            v_ents = list(entity.virtual_entities())
            for v_ent in v_ents:
                count += flatten_entity(v_ent, target_layer, out_msp)
    except Exception as e:
        print(f"  [Error] flatten_entity failed for {etype}: {e}")
    return count


# ------------------------------------------------------------------
# ヘルスチェック
# ------------------------------------------------------------------


@app.get("/api/v1/health")
async def health_check() -> dict[str, str]:
    """ヘルスチェックエンドポイント。"""
    return {"status": "ok", "service": "az-bridge-tool", "version": "2.0.0"}


# ------------------------------------------------------------------
# 構造用DXF 統合エンドポイント
# ------------------------------------------------------------------

@app.post("/api/v1/merge-floors")
def merge_floors(
    file_1f: UploadFile = File(None),
    file_2f: UploadFile = File(None),
    file_3f: UploadFile = File(None),
    file_ph: UploadFile = File(None)
):
    """複数階のDXFを統合し、フラットなDXFを生成して返す。"""
    # ✅ 修正: 現代的なR2010形式（UTF-8）を採用。Unicodeを直接扱えるようにする。
    out_dxf = ezdxf.new('R2010')
    out_msp = out_dxf.modelspace()
    
    files = {"1F": file_1f, "2F": file_2f, "3F": file_3f, "PH": file_ph}
    total_lines = 0
    
    logger.info("--- 統合処理開始（R12 Shift-JISモード） ---")
    
    for label, up_file in files.items():
        if not up_file: continue
        
        # 一時ファイルとして保存
        with tempfile.NamedTemporaryFile(delete=False, suffix=".dxf") as tmp:
            tmp.write(up_file.file.read())
            temp_path = tmp.name
        
        try:
            # ✅ encoding未指定（auto-detect）にすることでレイヤ名がUTF-8文字列として正しく取得され
            # RENAME_MAPのキーとのin演算子マッチングが正常に動作する
            doc = ezdxf.readfile(temp_path)
            msp = doc.modelspace()
            floor_ent_count = 0

            def resolve_layer(orig, lbl):
                """レイヤ名をRENAME_MAPで名寄せ。未一致は元の名前+階層タグ。"""
                # UTF-8前提なので、日本語文字列がそのまま比較可能
                for k, v in RENAME_MAP.items():
                    if k in orig:
                        return v if v == "GLID" else f"{v}_{lbl}"
                return f"{orig}_{lbl}"

            for entity in msp:
                orig_layer = entity.dxf.layer
                
                # ✅ 軽量化：不要なレイヤを除外
                ol_up = str(orig_layer).upper()
                if any(x in ol_up for x in ["DEFPOINTS", "ASHB", "WORK", "TMP", "印刷外"]):
                    continue

                new_layer = resolve_layer(orig_layer, label)

                # ✅ INSERTブロックは virtual_entities() で完全展開して内部の全図形を個別に取り出す
                if entity.dxftype() == 'INSERT':
                    try:
                        # ブロック全体の代表レイヤを決定（柱_1F など）
                        parent_resolved_layer = resolve_layer(entity.dxf.layer, label)
                        
                        # ✅ 修正: ブロックの「配置位置」自体に POINT を打つ
                        # これにより、内部図形が何であれ、柱の正確な座標がフロントエンドに伝わる
                        if "COL" in parent_resolved_layer or "WALL" in parent_resolved_layer:
                            out_msp.add_point(entity.dxf.insert, dxfattribs={'layer': parent_resolved_layer})
                            floor_ent_count += 1

                        for ve in entity.virtual_entities():
                            # ✅ 修正: 柱や壁ブロックの中身は、元のレイヤに関わらず親のレイヤを強制継承させる
                            if "COL" in parent_resolved_layer or "WALL" in parent_resolved_layer:
                                ve_new_layer = parent_resolved_layer
                            elif ve.dxf.layer == '0':
                                ve_new_layer = parent_resolved_layer
                            else:
                                ve_new_layer = resolve_layer(ve.dxf.layer, label)
                            floor_ent_count += flatten_entity(ve, ve_new_layer, out_msp)
                    except Exception as ex:
                        print(f"  [warn] virtual_entities failed: {ex}")
                else:
                    floor_ent_count += flatten_entity(entity, new_layer, out_msp)

            print(f"  -> [{label}] Extracted {floor_ent_count} entities")
            total_lines += floor_ent_count

        except Exception as e:
            import traceback as _tb
            print(f"  !! [{label}] Error: {e}")
            _tb.print_exc()
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    print(f"--- Total Merged Entities: {total_lines} ---")

    if total_lines == 0:
        return JSONResponse(status_code=400, content={"success": False, "error": "図面から図形を1つも抽出できませんでした。"})

    # ✅ 修正: カレントディレクトリに保存すると Live Server 等の監視に引っかかってリロードされるため、
    # システムの一時ディレクトリを使用する。
    with tempfile.NamedTemporaryFile(delete=False, suffix=".dxf") as out_tmp:
        output_fn = out_tmp.name
    
    out_dxf.saveas(output_fn)
    
    size = os.path.getsize(output_fn)
    logger.info(f"--- 統合完了: {output_fn} ({size} bytes) を返します ---")
    
    # 完了後に一時ファイルを削除する仕組み (BackgroundTasks等) も検討可能だが、
    # まずは確実にリロードを止めるためパスを変更。
    return FileResponse(output_fn, filename="merged_structure.dxf", media_type="application/dxf")


# ------------------------------------------------------------------
# Nw PDF解析エンドポイント
# ------------------------------------------------------------------

@app.post("/api/v1/upload-nw-pdf")
def upload_nw_pdf(file: UploadFile = File(...)):
    """引張耐力検討用軸力のPDFを受け取り、符号とNwの階層別辞書を返す。"""
    if file.filename and not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail={
            "error": "INVALID_FILE_TYPE",
            "message": "PDF形式のファイル (.pdf) をアップロードしてください。"
        })
    
    tmp_pdf_path = ""
    try:
        # PDFを一時保存
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as t:
            t.write(file.file.read())
            tmp_pdf_path = t.name
            
        from .nw_pdf_parser import parse_nw_pdf
        nw_dict = parse_nw_pdf(tmp_pdf_path)
        
        logger.info("PDF 解析成功: %d 階層分のデータを取得", len(nw_dict))
        return {"nw_dict": nw_dict}
        
    except ImportError as ie:
        logger.error("依存ライブラリ不足: %s", ie)
        raise HTTPException(status_code=500, detail={
            "error": "DEPENDENCY_ERROR",
            "message": "サーバー側でPDF解析ライブラリがセットアップされていません。"
        })
    except Exception as e:
        logger.error("Nw PDF 解析エラー: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail={
            "error": "PARSE_ERROR",
            "message": f"PDFの解析に失敗しました: {str(e)}"
        })
    finally:
        if tmp_pdf_path:
            try:
                Path(tmp_pdf_path).unlink(missing_ok=True)
            except Exception:
                pass


# ------------------------------------------------------------------
# DXF → 構面解析エンドポイント
# ------------------------------------------------------------------



@app.post("/api/v1/analyze-floor")
def analyze_floor(
    dxf_file: UploadFile = File(..., description="AZ出力DXFファイル"),
    wall_layers: str = Form('["LAYER31"]', description="壁レイヤ名(JSON配列)"),
    floor_layers: str = Form('["LAYER110"]', description="構面レイヤ名(JSON配列)"),
    min_area: float = Form(10000.0, description="最小ポリゴン面積(mm²)"),
    generate_images: bool = Form(True, description="画像を生成するか"),
) -> dict[str, Any]:
    """DXF → INSERT展開 → レイヤ別分類 → 等価奥行き L 算出。"""
    from fastapi.responses import JSONResponse
    tmp_dxf_path = None

    try:
        # --- パラメータパース ---
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

        # --- DXF一時ファイル保存 ---
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

        # --- DXF パース (INSERT展開 + レイヤ分類 + ポリゴン検出) ---
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


        # --- 各ポリゴンの等価奥行き算出 ---
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

        # --- 画像生成 ---
        images: dict[str, Any] = {}
        if generate_images and detected:
            viz = StructureVisualizer()

            # 俯瞰図
            try:
                images["polygon_map"] = viz.generate_map(detected, wall_lines)
            except Exception as e:
                logger.warning("俯瞰図生成エラー: %s", e)

            # 個別比較図
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


# ------------------------------------------------------------------
# 壁・柱データ抽出 APIエンドポイント (機能②)
# ------------------------------------------------------------------

@app.post("/api/v1/extract-walls")
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
                "multiplier": w.multiplier, # 0.0 default
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

# ------------------------------------------------------------------
# N値・引抜力計算 APIエンドポイント (機能②)
# ------------------------------------------------------------------

class NValueRequestItem(BaseModel):
    column_id: str
    height_mm: float
    multiplier: float
    length_mm: float
    upper_tension: float
    nw_load: float

class NValuesRequest(BaseModel):
    items: list[NValueRequestItem]

@app.post("/api/v1/calculate-n-values")
async def calculate_n_values(req: NValuesRequest):
    """フロントエンドから送られた各柱のA, B, Lパラメータを受け取り、N値と引抜力・必要金物を計算する"""
    from .n_value_calculator import calculate_column_n_value
    try:
        results = []
        for item in req.items:
            res = calculate_column_n_value(
                column_id=item.column_id,
                height_mm=item.height_mm,
                multiplier=item.multiplier,
                length_mm=item.length_mm,
                upper_tension=item.upper_tension,
                nw_load=item.nw_load
            )
            results.append({
                "column_id": res.column_id,
                "n_value": res.n_value,
                "tension_force": res.tension_force,
                "hardware": res.recommended_hardware,
            })
        return {"results": results}
    except Exception as e:
        logger.error("N値計算エラー: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail={"error": "CALCULATION_ERROR", "message": str(e)})




# ------------------------------------------------------------------
# フロントエンド静的ファイル配信
# ------------------------------------------------------------------

_FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


@app.get("/")
async def root() -> FileResponse:
    """フロントエンドの index.html を返す。"""
    index_path = _FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path), media_type="text/html")
    return FileResponse(str(index_path))


if _FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(_FRONTEND_DIR)), name="static")
