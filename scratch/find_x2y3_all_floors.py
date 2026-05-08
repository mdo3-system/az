import json

file_path = 'data/foundation_data 0426.json'
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    floor_data = data.get('floorData', data)
    
    for f in ['1', '2', '3', 'R']:
        if f in floor_data:
            cols = floor_data[f].get('columns', [])
            ids = [c.get('id') for c in cols]
            print(f"Floor {f}: {len(cols)} columns")
            print(f"  IDs: {ids[:10]} ...")
            if any('X2Y3' in (nid or "") for nid in ids):
                print(f"  !!! Found X2Y3 on Floor {f}")
except Exception as e:
    print(f"Error: {e}")
