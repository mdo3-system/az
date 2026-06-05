import ezdxf
import os
import sys

files = [
    "data/1F20260605.dxf",
    "data/2F20260605.dxf",
    "data/3F20260605.dxf"
]

for filepath in files:
    print(f"=== Testing {filepath} ===")
    if not os.path.exists(filepath):
        print(f"Error: File does not exist!")
        continue
    
    size = os.path.getsize(filepath)
    print(f"File size: {size} bytes ({size / 1024 / 1024:.2f} MB)")
    
    # 1. auto-detect encoding
    try:
        doc = ezdxf.readfile(filepath)
        print(f"Successfully read with auto-detect encoding. Encoding: {doc.encoding}")
        msp = doc.modelspace()
        print(f"Entities in modelspace: {len(list(msp))}")
    except Exception as e:
        print(f"Failed to read with auto-detect: {type(e).__name__}: {e}")
        
    # 2. explicit cp932
    try:
        doc = ezdxf.readfile(filepath, encoding='cp932')
        print(f"Successfully read with cp932.")
        msp = doc.modelspace()
        print(f"Entities in modelspace (cp932): {len(list(msp))}")
    except Exception as e:
        print(f"Failed to read with cp932: {type(e).__name__}: {e}")

    # 3. explicit utf-8
    try:
        doc = ezdxf.readfile(filepath, encoding='utf-8')
        print(f"Successfully read with utf-8.")
        msp = doc.modelspace()
        print(f"Entities in modelspace (utf-8): {len(list(msp))}")
    except Exception as e:
        print(f"Failed to read with utf-8: {type(e).__name__}: {e}")
    print()
