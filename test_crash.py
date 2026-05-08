import sys
from pathlib import Path
import traceback

sys.path.append(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az")

def run_test():
    filepath = Path(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\小屋伏図.dxf")
    try:
        from az_bridge.dxf_parser import DxfParser
        parser = DxfParser(filepath, floor_layers=["LAYER79", "79"], column_layers=["LAYER27"], wall_layers=["LAYER31"])
        print("Parsing DXF...")
        cols, walls, floors = parser.parse()
        print(f"Result: {len(cols)} cols, {len(walls)} walls, {len(floors)} floors")
    except Exception as e:
        print("Caught exception:")
        traceback.print_exc()

if __name__ == "__main__":
    run_test()
