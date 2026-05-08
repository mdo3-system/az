import sys
from pathlib import Path
import traceback

def run_test():
    filepath = Path(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\小屋伏図.dxf")
    try:
        from az_bridge.dxf_parser import DxfParser
        parser = DxfParser(filepath, floor_layers=["LAYER110"], column_layers=["LAYER27"], wall_layers=["LAYER31"])
        print("Parsing DXF...")
        cols, walls, detected = parser.parse()
        print(f"Result: {len(cols)} cols, {len(walls)} walls, {len(detected)} floors")
        
        from az_bridge.polygon_analysis import FloorPolygon
        from az_bridge.models import ForceDirection
        
        directions = [ForceDirection.X, ForceDirection.Y]
        floor_results = []
        for dp in detected:
            print(f"Processing polygon {dp.polygon_id} with {len(dp.vertices)} vertices...")
            fp = FloorPolygon(dp.vertices)
            reentrant = fp.find_reentrant_corners()
            print(f"  found {len(reentrant)} reentrant corners")
            for d in directions:
                equiv = fp.equivalent_rect(d)
                print(f"  {d.name}: equivalent={equiv}")
                
        print("Successfully processed all polygons!")
        
    except Exception as e:
        print("Caught exception:")
        traceback.print_exc()

if __name__ == "__main__":
    run_test()
