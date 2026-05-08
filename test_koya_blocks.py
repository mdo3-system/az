import sys
from pathlib import Path
import ezdxf

def run_test():
    filepath = Path(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\小屋伏図.dxf")
    doc = ezdxf.readfile(str(filepath))
    msp = doc.modelspace()
    
    print("--- Block Structure Analysis ---")
    
    insert_blocks = []
    bare_lines = []
    
    for e in msp:
        if e.dxftype() == 'INSERT':
            b_name = e.dxf.name
            if b_name in doc.blocks:
                block_layer_lines = [se for se in doc.blocks[b_name] if se.dxftype() == 'LINE' and se.dxf.layer in ("LAYER79", "79")]
                if block_layer_lines:
                    insert_blocks.append((b_name, len(block_layer_lines)))
        elif e.dxftype() == 'LINE' and e.dxf.layer in ("LAYER79", "79"):
            bare_lines.append(e)
            
    print(f"Bare LINEs on LAYER79 in modelspace: {len(bare_lines)}")
    print(f"INSERT blocks containing LAYER79 LINEs: {len(insert_blocks)}")
    if insert_blocks:
        print("Block samples:")
        for name, count in insert_blocks[:10]:
            print(f"  {name}: {count} LAYER79 LINES")

if __name__ == "__main__":
    run_test()
