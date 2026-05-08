import sys
from pathlib import Path
from az_bridge.dxf_parser import DxfParser

def deep_debug():
    filepath = Path(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\小屋伏図.dxf")
    parser = DxfParser(filepath, floor_layers=["LAYER79", "79"])
    doc = parser._read_dxf_with_fallback()
    msp = doc.modelspace()
    
    layer_blocks, layer_polygons = parser._expand_all_inserts(msp, doc)
    
    print("Layer Blocks Keys:", list(layer_blocks.keys()))
    
    if "LAYER79" in layer_blocks:
        print(f"LAYER79 is IN layer_blocks. Blocks count: {len(layer_blocks['LAYER79'])}")
    else:
        print("LAYER79 is NOT IN layer_blocks!")
    
    polys = parser._build_floor_polygons(layer_blocks, layer_polygons)
    print(f"Found {len(polys)} polygons built.")
    
if __name__ == "__main__":
    deep_debug()
