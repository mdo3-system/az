from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import ezdxf
import os

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# 名寄せルール
RENAME_MAP = {"通り芯": "GLID", "柱": "COL", "耐力壁": "BG", "壁": "BG"}

def flatten_entity(entity, target_layer, out_msp):
    """
    複雑な図形（ブロックやポリライン）を「単純な線」に分解して抽出する魔法の関数
    """
    count = 0
    try:
        etype = entity.dxftype()
        # ブラウザが大好物な基本図形はそのままコピー
        if etype == 'LINE':
            out_msp.add_line(entity.dxf.start, entity.dxf.end, dxfattribs={'layer': target_layer})
            count += 1
        elif etype == 'CIRCLE':
            out_msp.add_circle(entity.dxf.center, entity.dxf.radius, dxfattribs={'layer': target_layer})
            count += 1
        elif etype == 'ARC':
            out_msp.add_arc(entity.dxf.center, entity.dxf.radius, entity.dxf.start_angle, entity.dxf.end_angle, dxfattribs={'layer': target_layer})
            count += 1
        # ブロック（INSERT）やポリラインなどの複雑な塊は、内部の線を計算して抽出
        elif hasattr(entity, 'virtual_entities'):
            for v_ent in entity.virtual_entities():
                # マトリョーシカのように再帰的に分解する
                count += flatten_entity(v_ent, target_layer, out_msp)
    except Exception:
        pass
    return count

@app.post("/merge-floors")
async def merge_floors(
    file_1f: UploadFile = File(None),
    file_2f: UploadFile = File(None),
    file_3f: UploadFile = File(None),
    file_ph: UploadFile = File(None)
):
    # 【超重要】世界で最も互換性の高い「R12」形式の空DXFを作成（ブラウザはこれしか確実には読めません）
    out_dxf = ezdxf.new('R12')
    out_msp = out_dxf.modelspace()
    
    files = {"1F": file_1f, "2F": file_2f, "3F": file_3f, "PH": file_ph}
    total_lines = 0
    
    print("\n--- 統合処理開始（究極のフラット化・R12モード） ---")
    
    for label, up_file in files.items():
        if not up_file: continue
        temp_path = f"temp_{label}.dxf"
        with open(temp_path, "wb") as f: f.write(await up_file.read())
        
        try:
            in_dxf = ezdxf.readfile(temp_path)
            in_msp = in_dxf.modelspace()
            
            count = 0
            for entity in in_msp:
                orig_layer = entity.dxf.layer
                new_layer = next((("GLID" if v == "GLID" else f"{v}_{label}") 
                                      for k, v in RENAME_MAP.items() if k in orig_layer), 
                                     f"{orig_layer}_{label}")

                if new_layer not in out_dxf.layers:
                    out_dxf.layers.new(name=new_layer)

                # 図形を極限まで分解して新しいモデルスペースに焼き付ける
                count += flatten_entity(entity, new_layer, out_msp)

            print(f"[{label}] 完了: {count} 本の「生きた線」として抽出しました")
            total_lines += count
            
        except Exception as e:
            print(f"[{label}] エラー発生: {e}")
        finally:
            if os.path.exists(temp_path): os.remove(temp_path)

    print(f"最終生成ライン数: {total_lines}")
    if total_lines == 0:
        return {"success": False, "error": "図形を抽出できませんでした。"}

    output_fn = "merged_structure.dxf"
    out_dxf.saveas(output_fn)
    return FileResponse(output_fn, filename="merged_structure.dxf", media_type="application/dxf")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)