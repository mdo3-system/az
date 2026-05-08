import ezdxf
from collections import Counter

def dump_layers():
    doc = ezdxf.readfile(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\2階 床伏図.dxf")
    msp = doc.modelspace()
    
    counts = Counter()
    for e in msp:
        counts[(e.dxf.layer, e.dxftype())] += 1
        
    print("Top 20 layer-entity combinations:")
    for (layer, etype), count in counts.most_common(20):
        print(f"{layer} - {etype}: {count}")

if __name__ == "__main__":
    dump_layers()
