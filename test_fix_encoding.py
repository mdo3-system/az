import ezdxf

# surrogateescape で読まれた文字列を正しいUTF-8に直す関数
def fix_encoding(s):
    try:
        return s.encode('utf-8', 'surrogateescape').decode('cp932')
    except Exception:
        try:
            return s.encode('utf-16-le', 'surrogatepass').decode('utf-16-le')
        except Exception:
            return s

doc = ezdxf.readfile('data/1F.dxf', encoding='cp932')
msp = doc.modelspace()

RENAME_MAP = {
    '通り芯': 'GLID',
    '柱': 'COL',
    '耐力壁': 'WALL_BRACED',
    '壁': 'WALL_NORMAL'
}

print('Testing fix_encoding + RENAME_MAP:')
layers_tested = set()
matches = 0
for entity in msp:
    if entity.dxftype() == 'INSERT':
        try:
            for ve in list(entity.virtual_entities())[:2]:
                l = ve.dxf.layer
                if l in layers_tested:
                    continue
                layers_tested.add(l)
                fixed = fix_encoding(l)
                for k, v in RENAME_MAP.items():
                    if k in fixed:
                        matches += 1
                        print(f'  HIT: {repr(l)} -> {repr(fixed)} matched key {repr(k)} -> {v}')
        except Exception:
            pass
    if len(layers_tested) > 50:
        break

print(f'\nTotal matches: {matches} in {len(layers_tested)} unique layers tested')
