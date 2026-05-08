import ezdxf, sys
print('Python sys.stdout.encoding:', sys.stdout.encoding)
print('Python default encoding:', sys.getdefaultencoding())

doc = ezdxf.readfile('data/1F.dxf')
msp = doc.modelspace()

# api.py の RENAME_MAP と同じキー
RENAME_MAP_A = {
    '\u901a\u308a\u82af': 'GLID',
    '\u67f1': 'COL',
    '\u8017\u529b\u58c1': 'WALL_BRACED',
    '\u58c1': 'WALL_NORMAL',
}

print()
print('RENAME_MAP_A keys (unicode escape):')
for k in RENAME_MAP_A:
    print(f'  repr={repr(k)}  hex={k.encode("utf-8").hex()}')

all_layers = set()
for e in msp:
    all_layers.add(e.dxf.layer)

print()
print('Matching test:')
for l in sorted(all_layers):
    for k, v in RENAME_MAP_A.items():
        if k in l:
            print(f'  HIT: {repr(k)} in {repr(l)} -> {v}')
print('Done.')
