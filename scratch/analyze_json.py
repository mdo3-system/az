import json
import os

path = r'e:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\foundation_data_rooffloor.json'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"File: {os.path.basename(path)}")
if 'floorData' in data:
    for floor, floor_obj in data['floorData'].items():
        nodes_count = len(floor_obj.get('nodes', []))
        dxf_count = len(floor_obj.get('dxfLines', []))
        print(f"Floor {floor}: nodes={nodes_count}, dxfLines={dxf_count}")

if 'underlayVisibility' in data:
    print(f"underlayVisibility: {data['underlayVisibility']}")
else:
    print("underlayVisibility: NOT FOUND")

if 'showDxf' in data:
    print(f"showDxf: {data['showDxf']}")
else:
    print("showDxf: NOT FOUND")
