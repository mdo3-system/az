"""DXFインスペクション v3 — 塗りつぶし・ハッチング構造解析

2つのAZ出力DXFの内部構造を詳細調査:
1. 2階 床伏図.dxf — 「塗りつぶし」がどう格納されているか
2. 小屋伏図.dxf   — 「ハッチング」がどう格納されているか
"""

import ezdxf
from pathlib import Path
from collections import defaultdict

DATA_DIR = Path(__file__).parent / "data"

FILES = [
    DATA_DIR / "2階 床伏図.dxf",
    DATA_DIR / "小屋伏図.dxf",
]

# 面要素として興味あるエンティティタイプ
FILL_TYPES = {"HATCH", "SOLID", "3DFACE", "LWPOLYLINE", "POLYLINE", "MPOLYGON", "REGION"}


def read_dxf(path: Path):
    for enc in [None, "cp932", "utf-8"]:
        try:
            doc = ezdxf.readfile(str(path), encoding=enc) if enc else ezdxf.readfile(str(path))
            print(f"  [OK] encoding={enc or 'auto'}")
            return doc
        except (UnicodeDecodeError, ezdxf.DXFError) as e:
            print(f"  [WARN] encoding={enc or 'auto'}: {e}")
    raise RuntimeError(f"読み込み失敗: {path}")


def inspect_file(path: Path):
    print(f"\n{'='*70}")
    print(f"■ ファイル: {path.name}")
    print(f"{'='*70}")

    doc = read_dxf(path)
    msp = doc.modelspace()

    # === Part 1: 全レイヤ概要 (MSP直接) ===
    layer_types_msp = defaultdict(lambda: defaultdict(int))
    for e in msp:
        layer_types_msp[e.dxf.layer][e.dxftype()] += 1

    print(f"\n  [MSP直接] レイヤ別エンティティ:")
    for layer in sorted(layer_types_msp):
        types = layer_types_msp[layer]
        total = sum(types.values())
        bd = ", ".join(f"{k}={v}" for k, v in sorted(types.items()))
        print(f"    {layer:<20} {total:>4}  {bd}")

    # === Part 2: INSERT展開後の全レイヤ集計 ===
    layer_types_expanded = defaultdict(lambda: defaultdict(int))

    for e in msp:
        if e.dxftype() == "INSERT":
            _expand(doc, e.dxf.name, layer_types_expanded, depth=0)
        else:
            layer_types_expanded[e.dxf.layer][e.dxftype()] += 1

    print(f"\n  [INSERT展開後] レイヤ別エンティティ:")
    for layer in sorted(layer_types_expanded):
        types = layer_types_expanded[layer]
        total = sum(types.values())
        bd = ", ".join(f"{k}={v}" for k, v in sorted(types.items()))
        print(f"    {layer:<20} {total:>4}  {bd}")

    # === Part 3: 面要素の探索 (全階層) ===
    print(f"\n  [面要素探索] HATCH/SOLID/3DFACE/LWPOLYLINE/MPOLYGON/REGION:")
    found_any = False

    # MSP直接
    for e in msp:
        if e.dxftype() in FILL_TYPES:
            _dump_fill_entity(e, "MSP")
            found_any = True

    # ブロック内
    for block in doc.blocks:
        if block.name.startswith("*"):
            # *Model_Space, *Paper_Space 等は特別なブロック
            # ただしHATCHが入っている可能性あり
            pass
        for e in block:
            if e.dxftype() in FILL_TYPES:
                _dump_fill_entity(e, f"Block '{block.name}'")
                found_any = True

    if not found_any:
        print("    >>> 面要素はどの階層にも存在しない")

    # === Part 4: ブロック定義サマリ (面要素を含むブロックのみ) ===
    print(f"\n  [面要素を含むブロック定義]:")
    for block in doc.blocks:
        has_fill = False
        for e in block:
            if e.dxftype() in FILL_TYPES:
                has_fill = True
                break
        if has_fill:
            types = defaultdict(int)
            for e in block:
                types[e.dxftype()] += 1
            bd = ", ".join(f"{k}={v}" for k, v in sorted(types.items()))
            print(f"    Block '{block.name}': {bd}")

    # === Part 5: 全ブロックのレイヤ内訳（どのレイヤにLINE群があるか） ===
    print(f"\n  [ブロック内レイヤ別集計 (上位)]:")
    block_layer_summary = defaultdict(lambda: defaultdict(int))
    for block in doc.blocks:
        if block.name.startswith("*"):
            continue
        for e in block:
            block_layer_summary[e.dxf.layer][e.dxftype()] += 1

    for layer in sorted(block_layer_summary):
        types = block_layer_summary[layer]
        total = sum(types.values())
        bd = ", ".join(f"{k}={v}" for k, v in sorted(types.items()))
        print(f"    {layer:<20} {total:>4}  {bd}")


def _expand(doc, block_name, layer_types, depth=0):
    if depth > 5:
        return
    try:
        block = doc.blocks.get(block_name)
    except:
        return
    if not block:
        return
    for e in block:
        et = e.dxftype()
        if et == "INSERT":
            _expand(doc, e.dxf.name, layer_types, depth+1)
        else:
            layer_types[e.dxf.layer][et] += 1


def _dump_fill_entity(entity, location):
    et = entity.dxftype()
    layer = entity.dxf.layer
    color = entity.dxf.get("color", "ByLayer")

    if et == "HATCH":
        pattern = getattr(entity.dxf, 'pattern_name', '?')
        paths = entity.paths
        print(f"    [{location}] HATCH layer={layer}, color={color}, pattern='{pattern}', paths={len(paths)}")
        for pi, path in enumerate(paths):
            ptype = type(path).__name__
            if hasattr(path, 'vertices'):
                verts = path.vertices
                print(f"      Path{pi} ({ptype}): 頂点数={len(verts)}")
                for vi, v in enumerate(verts[:6]):  # 最大6点表示
                    print(f"        V{vi}: ({v[0]:.1f}, {v[1]:.1f})")
                if len(verts) > 6:
                    print(f"        ... ({len(verts)-6} more)")
            elif hasattr(path, 'edges'):
                print(f"      Path{pi} ({ptype}): エッジ数={len(path.edges)}")
                for ei, edge in enumerate(path.edges[:4]):
                    etype = type(edge).__name__
                    print(f"        Edge{ei}: {etype}")
            else:
                print(f"      Path{pi} ({ptype})")

    elif et == "LWPOLYLINE":
        pts = list(entity.get_points(format="xy"))
        closed = entity.closed
        print(f"    [{location}] LWPOLYLINE layer={layer}, color={color}, closed={closed}, 頂点数={len(pts)}")
        for i, (x, y) in enumerate(pts[:6]):
            print(f"      P{i}: ({x:.1f}, {y:.1f})")
        if len(pts) > 6:
            print(f"      ... ({len(pts)-6} more)")

    elif et == "SOLID":
        pts = []
        for i in range(4):
            v = entity.dxf.get(f"vtx{i}", None)
            if v:
                pts.append((v.x, v.y))
        print(f"    [{location}] SOLID layer={layer}, color={color}, 頂点数={len(pts)}")
        for i, (x, y) in enumerate(pts):
            print(f"      V{i}: ({x:.1f}, {y:.1f})")

    elif et == "3DFACE":
        print(f"    [{location}] 3DFACE layer={layer}, color={color}")

    else:
        print(f"    [{location}] {et} layer={layer}, color={color}")


if __name__ == "__main__":
    for f in FILES:
        if f.exists():
            inspect_file(f)
        else:
            print(f"\n  *** ファイル未検出: {f}")
