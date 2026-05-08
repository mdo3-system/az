import json
import math

def calculate_wall_props(wall, nodes):
    n1 = nodes[wall.get("n1")]
    n2 = nodes[wall.get("n2")]
    dx = n2["x"] - n1["x"]
    dy = n2["y"] - n1["y"]
    L = math.hypot(dx, dy)
    if L < 1: return
    angleRad_X = math.atan2(dy, dx)
    angleDeg_X = angleRad_X * 180 / math.pi
    wall["multiplier_x"] = abs(math.cos(angleRad_X)) * wall.get("multiplier", 1.0)
    wall["multiplier_y"] = abs(math.sin(angleRad_X)) * wall.get("multiplier", 1.0)
    wall["length_m"] = L / 1000.0

def check_overlap(n1, n2, wn1, wn2):
    return "mock"

def test():
    with open('E:/Dropbox/■設計ｻﾎﾟｰﾄ/■note/antigravity/az/data/foundation_data_betakiso.json', encoding='utf-8') as f:
        data = json.load(f)
    
    fd = data['floorData']['1']
    for w in fd.get("walls", []):
        calculate_wall_props(w, fd["nodes"])
        
    for beam_idx, beam in enumerate(fd.get("beams", [])):
        try:
            n1 = fd["nodes"][beam["n1"]]
            n2 = fd["nodes"][beam["n2"]]
            totalL = math.hypot(n2["x"] - n1["x"], n2["y"] - n1["y"]) / 1000.0
            supports = beam.get("internalSupports", [])
            
            rawPoints = []
            rawPoints.append({"type": 'start', "dist": 0})
            for s in supports:
                colIndex = fd["columns"].index(s["col"]) if s["col"] in fd["columns"] else -1
                rawPoints.append({"type": 'column', "colIndex": colIndex, "dist": s["distFromStart"]})
            rawPoints.append({"type": 'end', "dist": totalL})
            
            points = rawPoints
            points.sort(key=lambda p: p["dist"])
            
            colIndices = [i for i, p in enumerate(points) if p["type"] == 'column']
            if len(colIndices) == 0:
                supportIdx1 = 0
                supportIdx2 = len(points) - 1
            elif len(colIndices) == 1:
                supportIdx1 = colIndices[0]
                supportIdx2 = colIndices[0]
            else:
                supportIdx1 = colIndices[0]
                supportIdx2 = colIndices[-1]
                
            d1 = points[supportIdx1]["dist"]
            d2 = points[supportIdx2]["dist"]
            supportL = d2 - d1
            
            # mock loop points
            for p in points:
                if p["type"] == 'column':
                    pass
        except Exception as e:
            print(f"Error on beam {beam_idx}: {e}")

if __name__ == '__main__':
    test()
