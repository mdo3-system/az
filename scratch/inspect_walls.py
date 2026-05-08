import json

path = r'e:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\foundation_data_kisohari.json'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

for floor in ['2', '3']:
    fd = data.get('floorData', {}).get(floor, {})
    print(f"--- Floor {floor} ---")
    walls = fd.get('walls', [])
    nodes = fd.get('nodes', [])
    print(f"  Wall count: {len(walls)}, Node count: {len(nodes)}")
    
    if walls:
        valid_walls = 0
        missing_nodes = 0
        zero_mult = 0
        for w in walls:
            m = w.get('multiplier', 0)
            if m <= 0:
                zero_mult += 1
                continue
            
            n1_idx = w.get('n1')
            n2_idx = w.get('n2')
            
            p1 = nodes[n1_idx] if 0 <= n1_idx < len(nodes) else None
            p2 = nodes[n2_idx] if 0 <= n2_idx < len(nodes) else None
            
            if p1 and p2:
                valid_walls += 1
            else:
                missing_nodes += 1
                
        print(f"  Valid walls (with nodes & mult > 0): {valid_walls}")
        print(f"  Walls with multiplier <= 0: {zero_mult}")
        print(f"  Walls with missing nodes: {missing_nodes}")
        
        if valid_walls > 0:
            print("  Example valid wall:")
            for w in walls:
                if w.get('multiplier', 0) > 0:
                    print(f"    ID: {w.get('id')}, n1: {w.get('n1')}, n2: {w.get('n2')}, mult: {w.get('multiplier')}")
                    break
    else:
        print("  No walls found.")
