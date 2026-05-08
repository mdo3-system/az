"""
merge-floors エンドポイントと同じ処理をスクリプトで実行し、
500エラーの原因を特定する
"""
import ezdxf
import os
import sys

RENAME_MAP = {
    "通り芯": "GLID",
    "柱": "COL",
    "耐力壁": "WALL_BRACED",
    "壁": "WALL_NORMAL"
}


def flatten_entity(entity, target_layer, out_msp):
    count = 0
    try:
        etype = entity.dxftype()
        if etype == 'LINE':
            out_msp.add_line(entity.dxf.start, entity.dxf.end, dxfattribs={'layer': target_layer})
            count += 1
        elif etype == 'CIRCLE':
            out_msp.add_circle(entity.dxf.center, entity.dxf.radius, dxfattribs={'layer': target_layer})
            count += 1
        elif etype == 'ARC':
            out_msp.add_arc(entity.dxf.center, entity.dxf.radius,
                            entity.dxf.start_angle, entity.dxf.end_angle,
                            dxfattribs={'layer': target_layer})
            count += 1
        elif etype == 'TEXT':
            out_msp.add_text(entity.dxf.text, dxfattribs={
                'insert': entity.dxf.insert,
                'height': entity.dxf.height,
                'layer': target_layer
            })
            count += 1
        elif hasattr(entity, 'virtual_entities'):
            for v_ent in list(entity.virtual_entities()):
                count += flatten_entity(v_ent, target_layer, out_msp)
    except Exception as e:
        print(f"  [Error] flatten_entity failed for {entity.dxftype()}: {e}")
    return count


def simulate_merge(file_paths):
    out_dxf = ezdxf.new('R2010')  # UTF-8対応のR2010形式
    out_msp = out_dxf.modelspace()
    total = 0

    for label, fpath in file_paths.items():
        if not os.path.exists(fpath):
            print(f"  [{label}] File not found: {fpath}")
            continue

        print(f"\n  Processing [{label}]: {fpath}")
        try:
            doc = ezdxf.readfile(fpath, encoding='cp932')
            msp = doc.modelspace()
            floor_count = 0

            for entity in msp:
                orig_layer = entity.dxf.layer
                new_layer = orig_layer
                for k, v in RENAME_MAP.items():
                    if k in orig_layer:
                        new_layer = "GLID" if v == "GLID" else f"{v}_{label}"
                        break
                else:
                    new_layer = f"{orig_layer}_{label}"

                if entity.dxftype() == 'INSERT':
                    try:
                        for ve in entity.virtual_entities():
                            ve_layer = ve.dxf.layer
                            ve_new_layer = ve_layer
                            for k, v in RENAME_MAP.items():
                                if k in ve_layer:
                                    ve_new_layer = "GLID" if v == "GLID" else f"{v}_{label}"
                                    break
                            else:
                                ve_new_layer = f"{ve_layer}_{label}"
                            floor_count += flatten_entity(ve, ve_new_layer, out_msp)
                    except Exception as ex:
                        print(f"  [warn] virtual_entities failed: {ex}")
                        import traceback; traceback.print_exc()
                else:
                    floor_count += flatten_entity(entity, new_layer, out_msp)

            print(f"  -> [{label}] Extracted {floor_count} entities")
            total += floor_count

        except Exception as e:
            print(f"  !! [{label}] CRITICAL ERROR: {e}")
            import traceback; traceback.print_exc()

    print(f"\n--- Total Merged Entities: {total} ---")

    if total > 0:
        output_fn = "test_merge_direct.dxf"
        out_dxf.saveas(output_fn)
        print(f"Saved to: {output_fn}")

        # 生成されたDXFをfrontendでパースできるか確認
        import json
        check = ezdxf.readfile(output_fn)
        check_msp = list(check.modelspace())
        type_count = {}
        for e in check_msp:
            t = e.dxftype()
            type_count[t] = type_count.get(t, 0) + 1
        print(f"Output DXF entity types: {type_count}")
        print("Output DXF layer count:", len(check.layers))
    else:
        print("ERROR: No entities extracted!")


if __name__ == '__main__':
    simulate_merge({
        '1F': 'data/1F.dxf',
        '2F': 'data/2F.dxf',
        'R': 'data/RF.dxf',
    })
