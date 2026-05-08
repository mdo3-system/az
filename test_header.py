import ezdxf

# DXFのヘッダー（$DWGCODEPAGE）を確認
doc = ezdxf.readfile('data/1F.dxf')
print('$DWGCODEPAGE:', doc.header.get('$DWGCODEPAGE', 'NOT FOUND'))
print('Encoding:', doc.encoding)

# auto-detect で読んだレイヤ名のマッチング
msp = doc.modelspace()
all_layers = set()
for e in msp:
    all_layers.add(e.dxf.layer)

print()
print('All layers:')
for l in sorted(all_layers):
    print(f'  {repr(l)}')

# RENAME_MAPはShift-JIS由来の文字列と一致させるため
# ezdxf がどの文字コードで読んでいるかをキーとして使う
# 正解: ezdxf が実際に返す '通り芯' 相当の文字列を見つける
target = '通り芯'
print(f'\n"通り芯" target bytes: {target.encode("utf-8").hex()}')
for l in sorted(all_layers):
    if '通' in l or '芯' in l or 'ID' in l:
        print(f'  Candidate: {repr(l)}  bytes: {l.encode("utf-8", "surrogateescape").hex()}')
