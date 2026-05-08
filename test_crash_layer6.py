import sys
from pathlib import Path
import traceback

def run_test():
    filepath = Path(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\小屋伏図.dxf")
    try:
        from az_bridge.dxf_parser import DxfParser
        parser = DxfParser(filepath, floor_layers=["LAYER6"], column_layers=[], wall_layers=[])
        print("Parsing DXF on LAYER6...")
        cols, walls, detected = parser.parse()
        print(f"Result: {len(cols)} cols, {len(walls)} walls, {len(detected)} floors")
    except Exception as e:
        print("Caught exception:")
        traceback.print_exc()

if __name__ == "__main__":
    run_test()
