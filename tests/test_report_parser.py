"""ReportParser クラスのユニットテスト

一時 CSV/TSV テキストを用いてパースをテストする。
"""

import pytest

from az_bridge.report_parser import ReportParser


class TestReportParserCSV:
    """CSV 形式のパーステスト。"""

    def test_basic_csv(self) -> None:
        csv_text = (
            "符号,X,Y,軸力\n"
            "C1,1000,2000,15.5\n"
            "C2,3000,4000,20.3\n"
            "C3,5000,6000,10.0\n"
        )
        records = ReportParser.parse_text(csv_text)
        assert len(records) == 3
        assert records[0].label == "C1"
        assert records[0].x == pytest.approx(1000)
        assert records[0].y == pytest.approx(2000)
        assert records[0].axial_force_n == pytest.approx(15.5)

    def test_with_spaces_and_commas_in_values(self) -> None:
        csv_text = (
            "符号,X,Y,軸力\n"
            "C1, 1000 , 2000 , 15.5 \n"
        )
        records = ReportParser.parse_text(csv_text)
        assert len(records) == 1
        assert records[0].x == pytest.approx(1000)

    def test_skip_unparsable_rows(self) -> None:
        csv_text = (
            "符号,X,Y,軸力\n"
            "C1,1000,2000,15.5\n"
            ",,,,\n"
            "C2,3000,4000,20.0\n"
        )
        records = ReportParser.parse_text(csv_text)
        assert len(records) == 2

    def test_empty_input(self) -> None:
        records = ReportParser.parse_text("")
        assert len(records) == 0

    def test_raw_fields_preserved(self) -> None:
        csv_text = (
            "符号,X,Y,軸力,備考\n"
            "C1,1000,2000,15.5,テスト\n"
        )
        records = ReportParser.parse_text(csv_text)
        assert records[0].raw_fields["備考"] == "テスト"


class TestReportParserTSV:
    """TSV 形式のパーステスト。"""

    def test_tab_delimited(self) -> None:
        tsv_text = (
            "符号\tX\tY\t軸力\n"
            "C1\t1000\t2000\t15.5\n"
            "C2\t3000\t4000\t20.3\n"
        )
        records = ReportParser.parse_text(tsv_text, delimiter="\t")
        assert len(records) == 2
        assert records[0].label == "C1"
        assert records[1].axial_force_n == pytest.approx(20.3)


class TestReportParserFileNotFound:
    """ファイル不存在テスト。"""

    def test_file_not_found(self) -> None:
        with pytest.raises(FileNotFoundError):
            ReportParser("nonexistent.csv")
