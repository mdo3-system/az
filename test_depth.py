import sys
from pathlib import Path
import ezdxf

def analyze_depth():
    filepath = Path(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\小屋伏図.dxf")
    doc = ezdxf.readfile(str(filepath))
    msp = doc.modelspace()
    
    max_depth = 0
    layer79_depths = []
    
    def process_block(block, depth=0):
        nonlocal max_depth
        if depth > max_depth:
            max_depth = depth
            
        for entity in block:
            etype = entity.dxftype()
            if etype == "LINE":
                layer = entity.dxf.layer if hasattr(entity.dxf, 'layer') else 'UNKNOWN'
                if layer in ("LAYER79", "79"):
                    layer79_depths.append(depth)
            elif etype == "INSERT":
                b_name = entity.dxf.name
                if b_name in doc.blocks:
                    process_block(doc.blocks[b_name], depth + 1)
                    
    process_block(msp)
    print(f"Max depth: {max_depth}")
    if layer79_depths:
        print(f"LAYER79 is at depths: {set(layer79_depths)}")
    else:
        print("LAYER79 not found.")

if __name__ == "__main__":
    analyze_depth()
