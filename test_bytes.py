import ezdxf

doc = ezdxf.readfile('data/1F.dxf', encoding='cp932')
msp = doc.modelspace()

# 実際のレイヤ名バイト列を詳細調査
print('=== Detailed layer byte analysis from virtual_entities ===')
seen = set()
for entity in msp:
    if entity.dxftype() == 'INSERT':
        try:
            for ve in list(entity.virtual_entities())[:2]:
                l = ve.dxf.layer
                if l in seen:
                    continue
                seen.add(l)
                # 様々な変換を試みる
                raw_bytes_utf8 = l.encode('utf-8', 'surrogateescape')
                raw_bytes_latin = l.encode('latin-1', 'surrogateescape')
                try:
                    decoded_cp932 = raw_bytes_latin.decode('cp932')
                except Exception as e:
                    decoded_cp932 = f'err:{e}'
                try:
                    decoded_cp932_2 = raw_bytes_utf8.decode('cp932')
                except Exception as e:
                    decoded_cp932_2 = f'err:{e}'
                    
                print(f'Original: {repr(l)}')
                print(f'  utf8 bytes: {raw_bytes_utf8.hex()}')
                print(f'  latin1 bytes: {raw_bytes_latin.hex()}')
                print(f'  latin1 -> cp932: {decoded_cp932}')
                print(f'  utf8 -> cp932: {decoded_cp932_2}')
                print()
        except Exception:
            pass
    if len(seen) >= 8:
        break
