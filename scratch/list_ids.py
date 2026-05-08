import json

file_path = 'data/foundation_data 0426.json'
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Floor 1 columns
    floor = '1'
    columns = []
    if floor in data:
        columns = data[floor].get('columns', [])
    elif 'floorData' in data and floor in data['floorData']:
        columns = data['floorData'][floor].get('columns', [])
    
    print(f"Floor 1: {len(columns)} columns")
    ids = [c.get('id') for c in columns]
    print(f"IDs: {ids}")
except Exception as e:
    print(f"Error: {e}")
