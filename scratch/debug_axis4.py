import json
import math

path = r'e:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\foundation_data_kisohari.json'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

fd2 = data.get('floorData', {}).get('2', {})
walls = fd2.get('walls', [])
nodes = fd2.get('nodes', [])

theta_deg = 65.8
theta_rad = math.radians(theta_deg)

print(f"--- Detailed Analysis for Floor 2 (theta={theta_deg}°) ---")

axis4_walls = [w for w in walls if w.get('axisName') == '4' and w.get('multiplier', 0) > 0]
print(f"Axis 4: {len(axis4_walls)} walls found")

total_pa_x = 0
total_pa_y = 0

for w in axis4_walls:
    n1 = nodes[w['n1']]
    n2 = nodes[w['n2']]
    dx = n2['x'] - n1['x']
    dy = n2['y'] - n1['y']
    length_m = math.hypot(dx, dy) / 1000
    
    # Rotated angle
    # The current code uses Math.atan2(dyp, dxp) where dyp, dxp are rotated
    # Let's simulate:
    cos_t = math.cos(-theta_rad)
    sin_t = math.sin(-theta_rad)
    dxp = dx * cos_t - dy * sin_t
    dyp = dx * sin_t + dy * cos_t
    wall_angle_rotated = math.atan2(dyp, dxp)
    
    cos2 = math.cos(wall_angle_rotated)**2
    sin2 = math.sin(wall_angle_rotated)**2
    
    pa_base = w['multiplier'] * length_m * 1.96
    pa_x = pa_base * cos2
    pa_y = pa_base * sin2
    
    print(f"  Wall {w.get('id')}: L={length_m:.3f}m, Mult={w['multiplier']}, BasePa={pa_base:.2f}, cos2={cos2:.2f}, sin2={sin2:.2f}")
    total_pa_x += pa_x
    total_pa_y += pa_y

print(f"TOTAL Axis 4: Pa_X'={total_pa_x:.2f}, Pa_Y'={total_pa_y:.2f}")
