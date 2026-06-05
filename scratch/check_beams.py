import json

with open('data/foundation_data.json', encoding='utf-8') as f:
    data = json.load(f)

floor_1 = data.get('floorData', {}).get('1', {})
beams = floor_1.get('beams', [])
perimBeams = floor_1.get('perimeterBeams', [])

print(f"beams count: {len(beams)}, perimeterBeams count: {len(perimBeams)}")

for b in (beams + perimBeams)[:5]:
    print(f"\nid={b.get('id')} depth={b.get('depth')} width={b.get('width')} dt={b.get('dt')} axisName={b.get('axisName')}")
    spans = b.get('spans', [])
    spanProps = b.get('spanProps', [])
    print(f"  spans count={len(spans)}, spanProps count={len(spanProps)}")
    for i, s in enumerate(spans[:3]):
        print(f"  spans[{i}] D={s.get('D')} b={s.get('b')} dt={s.get('dt')} depth={s.get('depth')} width={s.get('width')}")
    for i, s in enumerate(spanProps[:3]):
        print(f"  spanProps[{i}] D={s.get('D')} b={s.get('b')} dt={s.get('dt')} depth={s.get('depth')} width={s.get('width')}")
    
    print(f"  groundPressure={b.get('groundPressure')} tributaryWidth={b.get('tributaryWidth')}")
    spanLoads = b.get('spanLoads', [])
    print(f"  spanLoads count={len(spanLoads)}")
    for sl in spanLoads[:2]:
        print(f"    spanLoad B={sl.get('B')} sigma_e={sl.get('sigma_e')}")

print("\nSlabs:")
slabs = floor_1.get('slabs', [])
print(f"slabs count: {len(slabs)}")
for s in slabs[:3]:
    print(f"  id={s.get('id')} groundPressure={s.get('groundPressure')} thickness={s.get('thickness')}")
    print(f"  edgeLs={s.get('edgeLs')}")
    print(f"  nodeIds={s.get('nodeIds')}")
