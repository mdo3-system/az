import os
import io
import ezdxf
import ezdxf.addons.importer
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import numpy as np

app = FastAPI(title="Structural DXF Optimizer API")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "online", "message": "Structural DXF Optimizer API is running"}

@app.post("/merge-floors")
async def merge_floors(
    file_1f: UploadFile = File(None),
    file_2f: UploadFile = File(None),
    file_3f: UploadFile = File(None),
    file_ph: UploadFile = File(None)
):
    try:
        output_doc = ezdxf.new('R2010')
        # 出力用ドキュメントに必要な共通設定があればここで行う
        
        floors = [
            ("1F", file_1f),
            ("2F", file_2f),
            ("3F", file_3f),
            ("PH", file_ph)
        ]
        
        for prefix, file in floors:
            if not file: continue
            
            # ファイル名をチェック（空ファイル対策）
            if file.filename == "": continue
            
            content = await file.read()
            if not content: continue
            
            # メモリ内のストリームとして読み込み
            try:
                doc_in = ezdxf.read(io.BytesIO(content))
            except ezdxf.DXFError as e:
                print(f"Error reading DXF for {prefix}: {e}")
                continue

            msp_in = doc_in.modelspace()
            
            # Importer をドキュメントごとに1回作成（ループの外）
            importer = ezdxf.addons.importer.Importer(doc_in, output_doc)
            
            for entity in msp_in:
                try:
                    # 元のレイヤ名を取得
                    orig_layer = entity.dxf.layer
                    new_layer = f"{prefix}_{orig_layer}"
                    
                    # 新しいレイヤをターゲットドキュメントに作成（色などは元を継承）
                    if new_layer not in output_doc.layers:
                        try:
                            source_layer = doc_in.layers.get(orig_layer)
                            output_doc.layers.new(new_layer, dxfattribs={
                                'color': source_layer.dxf.color,
                                'linetype': source_layer.dxf.linetype
                            })
                        except:
                            output_doc.layers.new(new_layer)
                    
                    # インポート実行
                    imported_entities = importer.import_entity(entity)
                    
                    # インポートされた全てのエンティティのレイヤを書き換え
                    for ie in imported_entities:
                        ie.dxf.layer = new_layer
                        
                except Exception as ent_err:
                    import traceback
                    print(f"Skipping entity due to error: {ent_err}")
                    print(traceback.format_exc())
            
            # 最後に1回だけファイナライズ
            importer.finalize()

        output_path = "merged_structural_output.dxf"
        output_doc.saveas(output_path)
        
        return FileResponse(
            output_path, 
            filename="merged_structural.dxf", 
            media_type="application/dxf",
            background=lambda: os.path.exists(output_path) and os.remove(output_path)
        )

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
