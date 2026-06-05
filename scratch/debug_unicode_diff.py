import ezdxf

filepath = "data/1F20260605.dxf"
doc = ezdxf.readfile(filepath, encoding='cp932')
msp = doc.modelspace()

layer_names = set()
for entity in msp:
    layer_names.add(entity.dxf.layer)

print("--- Comparing Unicode Code Points ---")
target_keyword = "柱"
print(f"Target keyword: {repr(target_keyword)}")
print(f"Target bytes (utf-8): {target_keyword.encode('utf-8').hex()}")
print(f"Target code points: {[hex(ord(c)) for c in target_keyword]}")

for name in sorted(layer_names):
    if "柱" in name or name.strip() == "柱" or "譟ｱ" in name:
        print(f"\nFound layer name in DXF: {repr(name)}")
        print(f"Name bytes (utf-8): {name.encode('utf-8').hex()}")
        print(f"Name code points: {[hex(ord(c)) for c in name]}")
        
        # マッチングテスト
        print(f"  Is '柱' == name? : {target_keyword == name}")
        print(f"  Is '柱' in name? : {target_keyword in name}")
        
        # なぜマッチしないのかバイトレベルで比較
        print(f"  Length of target: {len(target_keyword)}")
        print(f"  Length of name: {len(name)}")
