import ezdxf

filepath = "data/1F20260605.dxf"
print(f"Checking DXF version and header encoding for {filepath}...")

try:
    # 最低限のヘッダーのみ読み込み
    with open(filepath, "r", errors="ignore") as f:
        for i in range(30):
            line = f.readline().strip()
            print(f"Line {i}: {repr(line)}")
except Exception as e:
    print(f"Error reading header: {e}")
