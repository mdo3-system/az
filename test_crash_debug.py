import sys
from pathlib import Path

def debug_dxf_parser():
    filepath = Path(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\小屋伏図.dxf")
    try:
        from az_bridge.dxf_parser import DxfParser
        parser = DxfParser(filepath, floor_layers=["LAYER79"], column_layers=["LAYER27"], wall_layers=["LAYER31"])
        doc = parser._read_dxf_with_fallback()
        msp = doc.modelspace()
        layer_blocks, polys = parser._expand_all_inserts(msp, doc)
        
        print(f"Keys in layer_blocks: {list(layer_blocks.keys())}")
        if "LAYER79" in layer_blocks:
            l79 = layer_blocks["LAYER79"]
            print(f"LAYER79 has {len(l79)} blocks")
            for i, b in enumerate(l79):
                print(f"  Block {i}: {len(b)} lines")
                
            floors = parser._build_floor_polygons(layer_blocks, polys)
            print(f"Built {len(floors)} floor polygons!")
        else:
            print("LAYER79 not found in layer_blocks!")
    except Exception as e:
        print(e)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_dxf_parser()
