import json

path = r'e:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\foundation_data_kisohari.json'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

fd2 = data.get('floorData', {}).get('2', {})
walls = fd2.get('walls', [])

print("--- Floor 2 Walls axisNames ---")
axis_names = {}
for w in walls:
    name = w.get('axisName', '(none)')
    axis_names[name] = axis_names.get(name, 0) + 1

for name, count in axis_names.items():
    print(f"  Axis: {name}, Count: {count}")
