import sys
from pathlib import Path
import ezdxf
import traceback

def inspect_dxf(filepath):
    print(f"--- Inspecting {filepath.name} ---")
    try:
        doc = None
        for enc in [None, "cp932", "utf-8"]:
            try:
                doc = ezdxf.readfile(str(filepath), encoding=enc)
                break
            except Exception:
                pass
        
        if not doc:
            print(f"Failed to read {filepath.name}")
            return
            
        msp = doc.modelspace()
        
        lw_polys = []
        polys = []
        
        def check_block(block, depth=0, parent_layer=None):
            for e in block:
                layer = e.dxf.layer if hasattr(e.dxf, 'layer') else parent_layer
                if e.dxftype() == 'LWPOLYLINE':
                    lw_polys.append((layer, depth, getattr(e, 'closed', False), len(list(e))))
                elif e.dxftype() == 'POLYLINE':
                    polys.append((layer, depth, getattr(e, 'closed', False), len(list(e.vertices))))
                elif e.dxftype() == 'INSERT':
                    b_name = e.dxf.name
                    if b_name in doc.blocks:
                        check_block(doc.blocks[b_name], depth + 1, layer)
                        
        check_block(msp)
        
        print(f"Found {len(lw_polys)} LWPOLYLINEs")
        for layer, depth, closed, vcount in lw_polys:
            print(f"  Layer: {layer}, Depth: {depth}, Closed: {closed}, Vertices: {vcount}")
            
        print(f"Found {len(polys)} POLYLINEs")
        for layer, depth, closed, vcount in polys:
            print(f"  Layer: {layer}, Depth: {depth}, Closed: {closed}, Vertices: {vcount}")
            
    except Exception as e:
        print(f"Error inspecting {filepath.name}: {e}")
        traceback.print_exc()

def debug_dxf_parser(filepath):
    print(f"--- Testing DxfParser on {filepath.name} ---")
    try:
        from az_bridge.dxf_parser import DxfParser
        parser = DxfParser(filepath, floor_layers=["LAYER49", "110", "LAYER110", "49"])
        cols, walls, floors = parser.parse()
        print(f"Result: {len(cols)} cols, {len(walls)} walls, {len(floors)} floors")
    except Exception as e:
        print(f"DxfParser crashed on {filepath.name}:")
        traceback.print_exc()

if __name__ == "__main__":
    d1 = Path(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\2階 床伏図.dxf")
    d2 = Path(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\小屋伏図.dxf")
    
    inspect_dxf(d1)
    debug_dxf_parser(d1)
    print("\n" + "="*50 + "\n")
    inspect_dxf(d2)
    debug_dxf_parser(d2)
