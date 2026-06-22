import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..n_value_calculator import calculate_column_n_value

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1")

class NValueRequestItem(BaseModel):
    column_id: str
    height_mm: float
    multiplier: float
    length_mm: float
    upper_tension: float
    nw_load: float

class NValuesRequest(BaseModel):
    items: list[NValueRequestItem]

@router.post("/calculate-n-values")
async def calculate_n_values(req: NValuesRequest):
    """各柱のN値・引抜金物を計算する。"""
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
