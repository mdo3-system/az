import sys
from pathlib import Path
import ezdxf
from collections import Counter

def dump_entities(filepath):
    print(f"\n--- Dumping entities for {filepath.name} ---")
    try:
        doc = ezdxf.readfile(str(filepath))
    except Exception:
        doc = ezdxf.readfile(str(filepath), encoding="cp932")
        
    msp = doc.modelspace()
    entity_counts = Counter()
    
    def count_block(block):
        for e in block:
            layer = e.dxf.layer if hasattr(e.dxf, 'layer') else 'UNKNOWN'
            entity_counts[(layer, e.dxftype())] += 1
            if e.dxftype() == 'INSERT':
                b_name = e.dxf.name
                if b_name in doc.blocks:
                    count_block(doc.blocks[b_name])
                    
    count_block(msp)
    
    # Print sorted by count
    print(f"Total entries: {sum(entity_counts.values())}")
    for (layer, etype), count in sorted(entity_counts.items(), key=lambda x: -x[1])[:30]:
        print(f"  Layer: {layer:15} Type: {etype:12} Count: {count}")

if __name__ == "__main__":
    d1 = Path(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\2階 床伏図.dxf")
    d2 = Path(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\小屋伏図.dxf")
    dump_entities(d1)
    dump_entities(d2)
