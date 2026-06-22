"""WEB API エンドポイント — 機能①特化版

DXFファイル単体を受け取り、壁LINE線分から閉ポリゴンを自動検出し、
各ポリゴンの等価奥行き L = S / W を算出して返す。
"""

from __future__ import annotations

import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .routers import dxf, project, nw

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(
    title="AZ Bridge Tool API",
    description="ARCHITREND ZERO連携 水平構面等価奥行き算定ツール",
    version="3.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーターのインクルード
app.include_router(dxf.router)
app.include_router(project.router)
app.include_router(nw.router)

# ヘルスチェック
@app.get("/api/v1/health")
async def health_check() -> dict[str, str]:
    """ヘルスチェックエンドポイント。"""
    return {"status": "ok", "service": "az-bridge-tool", "version": "3.2.0"}

# フロントエンド静的ファイル配信
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

# データディレクトリを配信（foundation_data.json等）
_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
if _DATA_DIR.exists():
    app.mount("/data", StaticFiles(directory=str(_DATA_DIR)), name="data")
