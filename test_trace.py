import sys
from pathlib import Path
from az_bridge.dxf_parser import DxfParser
import logging

logging.basicConfig(level=logging.DEBUG)

def run():
    filepath = Path(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\小屋伏図.dxf")
    parser = DxfParser(filepath, floor_layers=["LAYER79"], column_layers=["LAYER27"], wall_layers=["LAYER31"])
    doc = parser._read_dxf_with_fallback()
    msp = doc.modelspace()
    
    layer_blocks, _ = parser._expand_all_inserts(msp, doc)
    
    if "LAYER79" in layer_blocks:
        print(f"DxfParser found LAYER79 in layer_blocks! Number of blocks: {len(layer_blocks['LAYER79'])}")
        total_lines = sum(len(lines) for lines in layer_blocks["LAYER79"])
        print(f"Total lines in LAYER79 blocks: {total_lines}")
    else:
        print("DxfParser did NOT find LAYER79 in layer_blocks!")

if __name__ == "__main__":
    run()
