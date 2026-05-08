import json, math, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/foundation_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

fd1 = data['floorData']['1']

def calculate_stress_sim(beam_id, fd):
    # Fix: dict access in Python
    beam = next(b for b in fd['perimeterBeams'] if b['id'] == beam_id)
    n1 = fd['nodes'][beam['n1']]
    n2 = fd['nodes'][beam['n2']]
    totalL = math.hypot(n2['x'] - n1['x'], n2['y'] - n1['y']) / 1000
    
    # supports
    supports = []
    for col in fd['columns']:
        cn = fd['nodes'][col['nodeIndex']]
        dx, dy = n2['x'] - n1['x'], n2['y'] - n1['y']
        L2 = dx*dx + dy*dy
        t = ((cn['x'] - n1['x'])*dx + (cn['y'] - n1['y'])*dy) / L2
        if -0.05 <= t <= 1.05:
            px, py = n1['x'] + t*dx, n1['y'] + t*dy
            if math.hypot(cn['x'] - px, cn['y'] - py) < 50:
                supports.append({'id': col['id'], 'dist': t * totalL})
    
    raw = [{'id': n1['id'], 'dist': 0, 'type': 'start'}]
    for s in supports:
        raw.append({'id': s['id'], 'dist': s['dist'], 'type': 'column'})
    raw.append({'id': n2['id'], 'dist': totalL, 'type': 'end'})
    raw.sort(key=lambda x: x['dist'])
    
    points = []
    for p in raw:
        if points and abs(points[-1]['dist'] - p['dist']) < 0.001:
            if p['type'] == 'column': points[-1] = p
            continue
        points.append(p)

    for p in points:
        p['Td'] = 1.0 if p['type'] == 'column' else 0
    
    col_indices = [i for i, p in enumerate(points) if p['type'] == 'column']
    if not col_indices:
        s1, s2 = 0, len(points)-1
    elif len(col_indices) == 1:
        s1, s2 = col_indices[0], col_indices[0]
    else:
        s1, s2 = col_indices[0], col_indices[-1]
        
    d1, d2 = points[s1]['dist'], points[s2]['dist']
    L_support = d2 - d1
    
    sum_Td = sum(p['Td'] for p in points)
    sum_M1 = sum(p['Td'] * (p['dist'] - d1) for p in points)
    
    R1, R2 = 0, 0
    if L_support > 0.001:
        R2 = -sum_M1 / L_support
        R1 = -sum_Td - R2
    else:
        R1 = -sum_Td
        R2 = 0
        
    print(f"Beam {beam_id}: L={totalL:.3f}m")
    print(f"Supports: s1={points[s1]['id']} at {d1:.3f}, s2={points[s2]['id']} at {d2:.3f}")
    print(f"Reactions: R1={R1:.3f}, R2={R2:.3f}")
    
    qe = 0
    m = 0
    p_dist = 0
    for i, p in enumerate(points):
        R = 0
        if i == s1: R += R1
        if i == s2 and s1 != s2: R += R2
        
        if i > 0:
            m += qe * (p['dist'] - p_dist)
        
        qe += p['Td'] + R
        print(f"  Point {p['id']} ({p['dist']:.3f}m): Td={p['Td']:.3f}, R={R:.3f}, Qe={qe:.3f}, M={m:.3f}")
        p_dist = p['dist']

calculate_stress_sim('SL3-B1', fd1)
