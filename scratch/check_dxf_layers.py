import ezdxf

def list_all_layers(filename):
    try:
        # ezdxf auto-detects, but let's try explicit cp932 for listing
        doc = ezdxf.readfile(filename, encoding='cp932')
        print(f"File: {filename}")
        
        layers = sorted([layer.dxf.name for layer in doc.layers])
        for name in layers:
            # Print normally and with hex to be sure
            h = name.encode('utf-8', errors='replace').hex(' ')
            print(f"Layer: '{name}' | Hex: {h}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    list_all_layers("data/1F.dxf")
