import ezdxf

# encoding='cp932'を指定せず読み込んでみる（auto-detect）
print('=== Without encoding override (auto-detect) ===')
doc1 = ezdxf.readfile('data/1F.dxf')
msp1 = doc1.modelspace()
layers1 = set()
for e in msp1:
    layers1.add(e.dxf.layer)
print('Sample layers (auto-detect):')
for l in sorted(layers1)[:8]:
    print(f'  {repr(l)}  bytes: {l.encode("utf-8","surrogateescape").hex()[:30]}')

print()
print('=== With encoding=cp932 ===')
doc2 = ezdxf.readfile('data/1F.dxf', encoding='cp932')
msp2 = doc2.modelspace()
layers2 = set()
for e in msp2:
    layers2.add(e.dxf.layer)
print('Sample layers (cp932):')
for l in sorted(layers2)[:8]:
    print(f'  {repr(l)}  bytes: {l.encode("utf-8","surrogateescape").hex()[:30]}')

# RENAME_MAPのキーのバイト列
print()
print('=== RENAME_MAP key bytes ===')
RENAME_MAP = {'通り芯': 'GLID', '柱': 'COL', '耐力壁': 'WALL_BRACED', '壁': 'WALL_NORMAL'}
for k in RENAME_MAP:
    print(f'  {repr(k)}  bytes: {k.encode("utf-8").hex()}')

# autodetectで読んだ際のマッチング確認
print()
print('=== Match test (auto-detect) ===')
for l in sorted(layers1)[:10]:
    for k, v in RENAME_MAP.items():
        if k in l:
            print(f'  HIT: {repr(k)} in {repr(l)}')
