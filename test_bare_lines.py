import sys
from pathlib import Path
import ezdxf

def check_bare_lines():
    filepath = Path(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\小屋伏図.dxf")
    doc = ezdxf.readfile(str(filepath))
    msp = doc.modelspace()
    
    bare_lines_by_layer = {}
    for e in msp:
        if e.dxftype() == 'LINE':
            L = e.dxf.layer
            bare_lines_by_layer[L] = bare_lines_by_layer.get(L, 0) + 1
            
    print("Bare LINES by layer:")
    for k, v in bare_lines_by_layer.items():
        print(f"  {k}: {v}")

if __name__ == "__main__":
    check_bare_lines()
