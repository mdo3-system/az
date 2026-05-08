import xml.etree.ElementTree as ET

tree = ET.parse('scratch/xlsx_unzipped/xl/sharedStrings.xml')
root = tree.getroot()
ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

for i, si in enumerate(root.findall('ns:si', ns)):
    t = si.find('.//ns:t', ns)
    if t is not None and t.text and 'X3Y3' in t.text:
        print(f"Index {i}: {t.text}")
