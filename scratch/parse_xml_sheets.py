import xml.etree.ElementTree as ET
import os

# Load shared strings
sst_path = 'scratch/xlsx_unzipped/xl/sharedStrings.xml'
tree = ET.parse(sst_path)
root = tree.getroot()
ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
sst = []
for si in root.findall('ns:si', ns):
    t = si.find('.//ns:t', ns)
    sst.append(t.text if t is not None else "")

# Load sheet1
sheet_path = 'scratch/xlsx_unzipped/xl/worksheets/sheet1.xml'
tree = ET.parse(sheet_path)
root = tree.getroot()

extracted = []
last_id = ""
for row in root.findall('.//ns:row', ns):
    row_data = {}
    for c in row.findall('ns:c', ns):
        r = c.get('r') # A1, B1, etc.
        col = "".join([char for char in r if char.isalpha()])
        v = c.find('ns:v', ns)
        if v is not None:
            val = v.text
            if c.get('t') == 's':
                val = sst[int(val)]
            row_data[col] = val
    
    if not row_data: continue
    
    rid = row_data.get('A', "")
    if rid and not rid.isdigit():
        last_id = rid
    
    floor = row_data.get('B', "")
    val = row_data.get('H', "")
    
    if last_id and floor == "1" and val:
        extracted.append((last_id, val))

print(f"Sheet 1 - Floor 1 Extracted:")
for item in extracted:
    print(item)
