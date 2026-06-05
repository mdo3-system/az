import ezdxf

filepath = "data/1F20260605.dxf"
print(f"--- Reading layers for {filepath} with UTF-8 ---")
try:
    doc = ezdxf.readfile(filepath, encoding='utf-8')
    layer_names = [layer.dxf.name for layer in doc.layers]
    for name in sorted(layer_names):
        print(f"  {repr(name)}")
except Exception as e:
    print(f"Failed to read with UTF-8: {e}")

print(f"\n--- Reading layers for {filepath} with cp932 ---")
try:
    doc = ezdxf.readfile(filepath, encoding='cp932')
    layer_names = [layer.dxf.name for layer in doc.layers]
    for name in sorted(layer_names):
        print(f"  {repr(name)}")
except Exception as e:
    print(f"Failed to read with cp932: {e}")
