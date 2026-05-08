import ezdxf

# CP932で読んで全INSERTをvirtual_entitiesで展開した場合の完全統計
doc = ezdxf.readfile('data/1F.dxf', encoding='cp932')
msp = doc.modelspace()

total = {'LINE': 0, 'TEXT': 0, 'CIRCLE': 0, 'ARC': 0, 'OTHER': 0}
layer_found = set()

for ent in msp:
    etype = ent.dxftype()
    if etype == 'LINE':
        total['LINE'] += 1
        layer_found.add(ent.dxf.layer)
    elif hasattr(ent, 'virtual_entities'):
        try:
            for ve in ent.virtual_entities():
                vt = ve.dxftype()
                if vt in total:
                    total[vt] += 1
                else:
                    total['OTHER'] += 1
                layer_found.add(ve.dxf.layer)
        except Exception as ex:
            pass

print('1F.dxf fully expanded stats:', total)
print('Unique layers found:', len(layer_found))
for l in sorted(layer_found):
    print('  layer:', repr(l))
