"""軸力データ（CSV/TXT）パース処理

ARCHITREND ZERO の計算結果レポート（引張耐力検定時軸力など）をパースし、
各柱の符号・座標・軸力値を抽出する。

想定フォーマット: CSV または タブ区切りテキスト
"""

from __future__ import annotations

import csv
import logging
import re
from pathlib import Path
from typing import Sequence

from .models import AxialForceRecord

logger = logging.getLogger(__name__)


# ヘッダ自動検出用キーワード（日本語・英語混在を想定）
_HEADER_KEYWORDS = {"符号", "記号", "label", "x", "y", "軸力", "N", "axial"}


class ReportParser:
    """AZ 計算レポートの軸力データパーサー。

    CSV / TSV 形式のレポートファイルを読み込み、
    `AxialForceRecord` のリストを返す。

    Parameters
    ----------
    filepath : str | Path
        レポートファイルのパス
    encoding : str
        ファイルエンコーディング (デフォルト: shift_jis)
    delimiter : str | None
        区切り文字 (None の場合は自動検出: カンマ or タブ)
    label_col : str
        符号列の名前 (デフォルト: "符号")
    x_col : str
        X座標列の名前 (デフォルト: "X")
    y_col : str
        Y座標列の名前 (デフォルト: "Y")
    force_col : str
        軸力列の名前 (デフォルト: "軸力")

    Examples
    --------
    >>> parser = ReportParser("axial_force.csv")
    >>> records = parser.parse()
    """

    def __init__(
        self,
        filepath: str | Path,
        encoding: str = "shift_jis",
        delimiter: str | None = None,
        label_col: str = "符号",
        x_col: str = "X",
        y_col: str = "Y",
        force_col: str = "軸力",
    ) -> None:
        self._filepath = Path(filepath)
        self._encoding = encoding
        self._delimiter = delimiter
        self._label_col = label_col
        self._x_col = x_col
        self._y_col = y_col
        self._force_col = force_col

        if not self._filepath.exists():
            raise FileNotFoundError(
                f"レポートファイルが見つかりません: {self._filepath}"
            )

    def parse(self) -> list[AxialForceRecord]:
        """レポートファイルを読み込み、軸力レコードを返す。

        エンコーディングは utf-8 → cp932 → 指定値 → latin-1 の
        フォールバックチェーンで自動検出する。

        Returns
        -------
        list[AxialForceRecord]
            抽出された軸力データのリスト
        """
        text = self._read_with_fallback()
        delimiter = self._delimiter or self._detect_delimiter(text)

        lines = text.strip().splitlines()
        if not lines:
            return []

        # ヘッダ行を検出
        header_idx = self._detect_header_index(lines, delimiter)
        if header_idx is None:
            raise ValueError(
                "ヘッダ行を検出できません。"
                f"期待するカラム名: {self._label_col}, {self._x_col}, "
                f"{self._y_col}, {self._force_col}"
            )

        reader = csv.DictReader(
            lines[header_idx:], delimiter=delimiter
        )

        records: list[AxialForceRecord] = []
        for row in reader:
            try:
                label = self._get_field(row, self._label_col)
                x = self._parse_float(self._get_field(row, self._x_col))
                y = self._parse_float(self._get_field(row, self._y_col))
                force = self._parse_float(self._get_field(row, self._force_col))
            except (KeyError, ValueError):
                # パース不能な行はスキップ（空行・テキスト行等）
                continue

            records.append(
                AxialForceRecord(
                    label=label.strip(),
                    x=x,
                    y=y,
                    axial_force_n=force,
                    raw_fields=dict(row),
                )
            )

        return records

    @classmethod
    def parse_text(
        cls,
        text: str,
        delimiter: str = ",",
        label_col: str = "符号",
        x_col: str = "X",
        y_col: str = "Y",
        force_col: str = "軸力",
    ) -> list[AxialForceRecord]:
        """文字列から直接パースする（テスト用ユーティリティ）。

        Parameters
        ----------
        text : str
            CSV/TSV テキスト
        delimiter : str
            区切り文字
        label_col, x_col, y_col, force_col : str
            カラム名

        Returns
        -------
        list[AxialForceRecord]
        """
        lines = text.strip().splitlines()
        if not lines:
            return []

        reader = csv.DictReader(lines, delimiter=delimiter)

        records: list[AxialForceRecord] = []
        for row in reader:
            try:
                label = row[label_col]
                x = cls._parse_float(row[x_col])
                y = cls._parse_float(row[y_col])
                force = cls._parse_float(row[force_col])
            except (KeyError, ValueError):
                continue

            records.append(
                AxialForceRecord(
                    label=label.strip(),
                    x=x,
                    y=y,
                    axial_force_n=force,
                    raw_fields=dict(row),
                )
            )

        return records

    # ------------------------------------------------------------------
    # 内部メソッド
    # ------------------------------------------------------------------

    def _read_with_fallback(self) -> str:
        """エンコーディングフォールバック付きファイル読み込み。

        utf-8 → cp932 → 指定エンコーディング → latin-1 の順で試行。
        """
        encodings = ["utf-8", "cp932"]
        if self._encoding not in encodings:
            encodings.append(self._encoding)
        encodings.append("latin-1")  # 最終フォールバック（常に成功）

        for enc in encodings:
            try:
                text = self._filepath.read_text(encoding=enc)
                logger.info(
                    "レポート '%s' をエンコーディング '%s' で読み込み成功",
                    self._filepath.name, enc,
                )
                return text
            except (UnicodeDecodeError, LookupError) as e:
                logger.debug(
                    "エンコーディング '%s' で読み込み失敗: %s", enc, e
                )
                continue

        # ここには到達しない（latin-1 で常に成功するため）
        raise RuntimeError(f"ファイル読み込み不可: {self._filepath}")

    def _detect_delimiter(self, text: str) -> str:
        """区切り文字を自動検出する。タブが多ければ TSV、そうでなければ CSV。"""
        first_lines = text.splitlines()[:5]
        tab_count = sum(line.count("\t") for line in first_lines)
        comma_count = sum(line.count(",") for line in first_lines)
        detected = "\t" if tab_count > comma_count else ","
        logger.debug("区切り文字検出: '%s' (tab=%d, comma=%d)",
                     'TAB' if detected == '\t' else 'COMMA', tab_count, comma_count)
        return detected

    def _detect_header_index(
        self, lines: list[str], delimiter: str
    ) -> int | None:
        """ヘッダ行のインデックスを検出する。

        カラム名キーワードが含まれる最初の行を返す。
        """
        target_cols = {
            self._label_col.lower(),
            self._x_col.lower(),
            self._y_col.lower(),
            self._force_col.lower(),
        }

        for i, line in enumerate(lines):
            fields = {f.strip().lower() for f in line.split(delimiter)}
            # 必要なカラム名が全て含まれているか
            if target_cols.issubset(fields):
                logger.info("ヘッダ行検出: 行 %d", i)
                return i

        logger.warning("ヘッダ行を検出できません。期待カラム: %s", target_cols)
        return None

    def _get_field(self, row: dict, col_name: str) -> str:
        """DictReader の行から指定カラムの値を取得する。

        完全一致を優先し、見つからなければ部分一致で探す。
        """
        if col_name in row:
            return row[col_name]

        # 部分一致フォールバック
        col_lower = col_name.lower()
        for key in row:
            if col_lower in key.lower():
                return row[key]

        raise KeyError(f"カラム '{col_name}' が見つかりません: {list(row.keys())}")

    @staticmethod
    def _parse_float(value: str) -> float:
        """数値文字列をfloatに変換。カンマ区切り・空白対応。"""
        cleaned = re.sub(r"[,\s]", "", value.strip())
        if not cleaned:
            raise ValueError("空の値")
        return float(cleaned)

    def __repr__(self) -> str:
        return (
            f"ReportParser(file='{self._filepath.name}', "
            f"encoding='{self._encoding}')"
        )
