import json, math, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/foundation_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

fd1 = data['floorData']['1']
support_nodes = ['X8Y3', '4BY1']

print("=== Check X8Y3 and 4BY1 Ne_bot explicitly ===")

def calc_column_T(colIndex, fd, current_floor_key):
    # Same simplified logic as before
    nodes = fd['nodes']
    cols = fd['columns']
    
    col = cols[colIndex]
    nodeIdx = col['nodeIndex']
    targetNode = nodes[nodeIdx]
    
    axisResults = {}
    fData = data['floorData'].get('1', {})
    
    # Just checking 1F and 2F for simplicity
    for fk in ['2', '1']:
        is_current = (fk == '1')
        fD = data['floorData'].get(fk, {})
        fNodes = fD.get('nodes', [])
        fCols = fD.get('columns', [])
        fWalls = fD.get('walls', [])
        
        cIdx = -1
        for j, c in enumerate(fCols):
            n = fNodes[c['nodeIndex']]
            if math.hypot(n['x'] - targetNode['x'], n['y'] - targetNode['y']) < 50:
                cIdx = j
                break
        
        if cIdx == -1: continue
        fCol = fCols[cIdx]
        fNodeIdx = fCol['nodeIndex']
        Hi = (fCol.get('heightOverride') or fD.get('floorHeight') or 2730) / 1000
        bi_bot = 0.8 if fCol.get('biSetting') == '0.8' else 0.5
        bi_top = 0.5
        fCenter = fNodes[fNodeIdx]
        
        linked_walls = []
        for w in fWalls:
            wn1 = fNodes[w['n1']]
            wn2 = fNodes[w['n2']]
            d1 = math.hypot(wn1['x'] - fCenter['x'], wn1['y'] - fCenter['y'])
            d2 = math.hypot(wn2['x'] - fCenter['x'], wn2['y'] - fCenter['y'])
            if (d1 < 50 or d2 < 50) and w.get('axisName'):
                linked_walls.append(w)
                
        for w in linked_walls:
            ax = w['axisName']
            if ax not in axisResults:
                axisResults[ax] = {'Ni_top_this': 0, 'Ni_bot_this': 0, 'sum_Ni_upper': 0}
            
            res = axisResults[ax]
            onidx = w['n2'] if w['n1'] == fNodeIdx else w['n1']
            nRemote = fNodes[onidx]
            dQ = 1.96 * (float(w.get('multiplier', 0)) or 0) * Hi
            isRight = (nRemote['x'] > fCenter['x']) or (nRemote['x'] == fCenter['x'] and nRemote['y'] > fCenter['y'])
            deltaPower = dQ if isRight else -dQ
            
            if is_current:
                res['Ni_bot_this'] += deltaPower * bi_bot
                res['Ni_top_this'] += deltaPower * bi_top
            else:
                res['sum_Ni_upper'] += deltaPower * bi_bot

    nw = float(col.get('nw') or col.get('longTermAxial') or 0)
    reduction = 0.6 * nw
    
    cases = []
    for axisName, res in axisResults.items():
        for dir_name, sign in [('左から (->)', 1), ('右から (<-)', -1)]:
            ni_top_this = res['Ni_top_this'] * sign
            ni_bot_this = res['Ni_bot_this'] * sign
            ni_upper = res['sum_Ni_upper'] * sign
            Ne_bot = ni_bot_this + ni_upper
            T_bot = Ne_bot - reduction
            cases.append({'name': f"{axisName} {dir_name}", 'Ne_bot': Ne_bot, 'T_bot': T_bot})
            
    return cases

for sn in support_nodes:
    col_idx = next(i for i, c in enumerate(fd1['columns']) if c['id'] == sn)
    cases = calc_column_T(col_idx, fd1, '1')
    print(f"[{sn}] Nw = {fd1['columns'][col_idx].get('nw', '?')} reduction = {0.6 * float(fd1['columns'][col_idx].get('nw', 0))}")
    for c in cases:
        print(f"  {c['name']}: Ne_bot={c['Ne_bot']:.4f} T_bot={c['T_bot']:.4f}")
    
