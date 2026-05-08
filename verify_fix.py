import json, math, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('data/foundation_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

fd1 = data['floorData']['1']
support_nodes = ['X8Y3', '4F4f', '4E4e', '4C2d4c', '4B4b', '4BY1']

def calc_column_T_fixed(colIndex, fd, current_floor_key):
    nodes = fd['nodes']
    cols = fd['columns']
    col = cols[colIndex]
    nodeIdx = col['nodeIndex']
    targetNode = nodes[nodeIdx]
    
    axisResults = {}
    fData = data['floorData'].get('1', {})
    
    # 1F, 2F
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
            
            # --- FIX LOGIC HERE ---
            try:
                pMult = float(w.get('multiplier', 'NaN'))
            except (ValueError, TypeError):
                pMult = float('nan')
            multVal = 1.0 if math.isnan(pMult) else pMult
            dQ = 1.96 * multVal * Hi
            # ----------------------
            
            isRight = (nRemote['x'] > fCenter['x']) or (nRemote['x'] == fCenter['x'] and nRemote['y'] > fCenter['y'])
            
            if isRight:
                res['Ni_bot_this'] += dQ * bi_bot
                res['Ni_top_this'] += dQ * bi_top
                if not is_current: res['sum_Ni_upper'] += dQ * bi_bot
            else:
                res['Ni_bot_this'] -= dQ * bi_bot
                res['Ni_top_this'] -= dQ * bi_top
                if not is_current: res['sum_Ni_upper'] -= dQ * bi_bot

    nw = float(col.get('nw') or col.get('longTermAxial') or 0)
    reduction = 0.6 * nw
    
    cases = []
    for axisName, res in axisResults.items():
        for dir_name, sign in [('左から (->)', 1), ('右から (<-)', -1)]:
            ni_top_this = res['Ni_top_this'] * sign
            ni_bot_this = res['Ni_bot_this'] * sign
            ni_upper = res['sum_Ni_upper'] * sign
            
            # Use absolute sum exactly as in JS sum...
            Ne_bot = ni_bot_this + ni_upper
            T_bot = Ne_bot - reduction
            cases.append({'name': f"{axisName} {dir_name}", 'Ne_bot': Ne_bot, 'T_bot': T_bot})
            
    return cases

print("=== Self-Check after applying FIX ===")
for sn in support_nodes:
    col_idx = next((i for i, c in enumerate(fd1['columns']) if c['id'] == sn), -1)
    if col_idx == -1: continue
    cases = calc_column_T_fixed(col_idx, fd1, '1')
    target_case_L = next((c for c in cases if '4' in c['name'] and '左から' in c['name']), None)
    target_case_R = next((c for c in cases if '4' in c['name'] and '右から' in c['name']), None)
    if target_case_L:
        print(f"[{sn}] 左加力 Ne_bot = {target_case_L['Ne_bot']:>8.4f}  |  右加力 Ne_bot = {target_case_R['Ne_bot']:>8.4f}")
