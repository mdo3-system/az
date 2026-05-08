import json

file_path = 'data/foundation_data 0426.json'
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    floor = '1'
    nodes = []
    if floor in data:
        nodes = data[floor].get('nodes', [])
    elif 'floorData' in data and floor in data['floorData']:
        nodes = data['floorData'][floor].get('nodes', [])
    
    print(f"Floor 1: {len(nodes)} nodes")
    ids = [n.get('id') for n in nodes if n.get('id')]
    print(f"Sample Node IDs: {ids[:20]}")
    
    # Search for X2 in IDs
    x2_ids = [nid for nid in ids if 'X2' in nid]
    print(f"IDs containing 'X2': {x2_ids}")
    
except Exception as e:
    print(f"Error: {e}")
