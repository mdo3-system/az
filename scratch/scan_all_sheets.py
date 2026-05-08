import xml.etree.ElementTree as ET
import os

sst_path = 'scratch/xlsx_unzipped/xl/sharedStrings.xml'
tree = ET.parse(sst_path)
root = tree.getroot()
ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
sst = []
for si in root.findall('ns:si', ns):
    t = si.find('.//ns:t', ns)
    sst.append(t.text if t is not None else "")

def parse_sheet(path):
    tree = ET.parse(path)
    root = tree.getroot()
    extracted = []
    last_id = ""
    last_floor = ""
    for row in root.findall('.//ns:row', ns):
        row_data = {}
        for c in row.findall('ns:c', ns):
            r = c.get('r')
            col = "".join([char for char in r if char.isalpha()])
            v = c.find('ns:v', ns)
            if v is not None:
                val = v.text
                if c.get('t') == 's':
                    val = sst[int(val)]
                row_data[col] = val
        if not row_data: continue
        rid = row_data.get('A', "")
        if rid and not rid.isdigit(): last_id = rid
        rfloor = row_data.get('B', "")
        if rfloor: last_floor = rfloor
        val = row_data.get('H', "")
        if last_id and last_floor == "2" and val:
            extracted.append((last_id, val))
    return extracted

for i in range(1, 14):
    path = f'scratch/xlsx_unzipped/xl/worksheets/sheet{i}.xml'
    res = parse_sheet(path)
    print(f"Sheet {i}: {len(res)} items for Floor 2")
    if res: print(f"  First item: {res[0]}")
