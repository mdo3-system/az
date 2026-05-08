FROM python:3.12-slim

# 作業ディレクトリ
WORKDIR /app

# 依存関係をコピー・インストール（キャッシュ利用のため先に実行）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
COPY az_bridge/ ./az_bridge/
COPY frontend/ ./frontend/

# ポート公開
EXPOSE 8000

# 非root ユーザーで実行
RUN adduser --disabled-password --gecos "" appuser
USER appuser

# uvicorn でサーバー起動
CMD ["uvicorn", "az_bridge.api:app", "--host", "0.0.0.0", "--port", "8000"]
