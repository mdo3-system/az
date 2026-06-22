import tempfile
import logging
from pathlib import Path
from fastapi import APIRouter, File, UploadFile, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1")

@router.post("/upload-nw-pdf")
def upload_nw_pdf(file: UploadFile = File(...)):
    """PDFを受け取り、符号とNwのデータをパースして返す。"""
    if file.filename and not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail={
            "error": "INVALID_FILE_TYPE",
            "message": "PDF形式のファイル (.pdf) をアップロードしてください。"
        })
    
    tmp_pdf_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as t:
            t.write(file.file.read())
            tmp_pdf_path = t.name
            
        from ..nw_pdf_parser import parse_nw_pdf
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
