import ezdxf

doc = ezdxf.readfile('data/1F.dxf', encoding='cp932')
msp = doc.modelspace()

RENAME_MAP = {
    '\u901a\u308a\u82af': 'GLID',
    '\u67f1': 'COL',
    '\u8017\u529b\u58c1': 'WALL_BRACED',
    '\u58c1': 'WALL_NORMAL'
}

print('RENAME_MAP keys:')
for k in RENAME_MAP:
    print(f'  repr: {repr(k)}  bytes: {k.encode("utf-8").hex()}')

print()
print('Testing against virtual_entities layers:')
layers_found = set()
for entity in msp:
    if entity.dxftype() == 'INSERT':
        try:
            for ve in list(entity.virtual_entities())[:3]:
                layers_found.add(ve.dxf.layer)
        except Exception:
            pass
    if len(layers_found) > 10:
        break

for layer_name in sorted(layers_found)[:8]:
    print(f'  Layer: {repr(layer_name)}')
    print(f'  Layer bytes: {layer_name.encode("utf-8", errors="replace").hex()}')
    for k, v in RENAME_MAP.items():
        matched = k in layer_name
        status = "HIT" if matched else "---"
        print(f'    [{status}] {repr(k)} in layer: {matched}')
