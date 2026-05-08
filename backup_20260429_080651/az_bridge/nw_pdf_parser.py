import logging
import re
from typing import Dict

logger = logging.getLogger(__name__)

def parse_nw_pdf(pdf_path: str) -> Dict[str, Dict[str, float]]:
    """
    ARCHITREND ZEROの「引張耐力検討用軸力.pdf」から、
    柱符号（ID）と Nw（引張耐力検討用軸力 ΣP）を抽出して階層別辞書で返す。
    
    期待する戻り値形式:
    {
      "1": {"X1Y1": 15.5, "X2Y1": 12.0, ...},
      "2": {"X1Y1": 10.0, ...},
      ...
    }
    """
    try:
        import pdfplumber
    except ImportError:
        logger.error("pdfplumber is not installed.")
        raise ImportError("pdfplumber is required to parse Nw PDFs.")

    # 階層ごとにデータを格納する辞書 (動的に拡張)
    nw_dict: Dict[str, Dict[str, float]] = {}
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    if not table:
                        continue
                    
                    # ヘッダー行のインデックスを特定
                    header_row_idx = -1
                    id_col_idx = -1
                    floor_col_idx = -1
                    sp_col_idx = -1

                    for i, row in enumerate(table):
                        row_str = "".join([str(c) for c in row if c is not None])
                        if "符号" in row_str and "ΣP" in row_str:
                            header_row_idx = i
                            # 列の特定
                            for j, col in enumerate(row):
                                if not col: continue
                                col_s = str(col).replace('\n', '')
                                if "符号" in col_s: id_col_idx = j
                                if "階" in col_s: floor_col_idx = j
                                if "ΣP" in col_s or "引張" in col_s: sp_col_idx = j
                            break
                    
                    # ヘッダーが見つからない場合は、デフォルトの列配置（0=符号, 1=階, 7=ΣP）を試行
                    if id_col_idx == -1: id_col_idx = 0
                    if floor_col_idx == -1: floor_col_idx = 1
                    if sp_col_idx == -1: sp_col_idx = 7 if len(table[0]) > 7 else len(table[0]) - 1

                    start_row = header_row_idx + 1 if header_row_idx != -1 else 0

                    for row in table[start_row:]:
                        if not row or len(row) <= max(id_col_idx, floor_col_idx, sp_col_idx):
                            continue
                        
                        raw_id = str(row[id_col_idx] or "").replace('\n', '').strip()
                        raw_floor = str(row[floor_col_idx] or "").replace('\n', '').strip()
                        raw_sp = str(row[sp_col_idx] or "").replace('\n', '').strip()

                        # 符号が空、またはヘッダー行の再来ならスキップ
                        if not raw_id or "符号" in raw_id:
                            continue

                        # 階の正規化（"1F", "1階", "1" -> "1"）
                        floor_match = re.search(r'(\d+)', raw_floor)
                        if not floor_match:
                            continue
                        floor_key = floor_match.group(1)

                        # ΣPの抽出（数値のみ取り出し）
                        val_match = re.search(r'([\d\.]+)', raw_sp)
                        if val_match:
                            try:
                                val = float(val_match.group(1))
                                if floor_key not in nw_dict:
                                    nw_dict[floor_key] = {}
                                nw_dict[floor_key][raw_id] = val
                            except ValueError:
                                continue

    except Exception as e:
        logger.error("Failed to parse PDF: %s", e)
        raise RuntimeError(f"PDF解析中に致命的なエラーが発生しました: {e}")

    return nw_dict
