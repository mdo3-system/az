import os
import tempfile
import logging
import ezdxf

logger = logging.getLogger(__name__)

# 名寄せルール
RENAME_MAP = {
    "通り芯": "GLID",
    "柱": "COL",
    "耐力壁": "WALL_BRACED",
    "壁": "WALL_NORMAL"
}

def flatten_entity(entity, target_layer, out_msp):
    """
    複雑な図形（ブロックやポリライン）を「単純な要素」に分解して抽出する魔法の関数
    """
    count = 0
    try:
        etype = entity.dxftype()
        # 基本図形はそのままコピー
        if etype == 'LINE':
            out_msp.add_line(entity.dxf.start, entity.dxf.end, dxfattribs={'layer': target_layer})
            count += 1
        elif etype == 'CIRCLE':
            out_msp.add_circle(entity.dxf.center, entity.dxf.radius, dxfattribs={'layer': target_layer})
            count += 1
        elif etype == 'ARC':
            out_msp.add_arc(entity.dxf.center, entity.dxf.radius, entity.dxf.start_angle, entity.dxf.end_angle, dxfattribs={'layer': target_layer})
            count += 1
        elif etype == 'TEXT':
            # R12互換形式で文字を追加
            out_msp.add_text(entity.dxf.text, dxfattribs={
                'insert': entity.dxf.insert,
                'height': entity.dxf.height,
                'rotation': entity.dxf.rotation,
                'layer': target_layer
            })
            count += 1
        elif etype == 'MTEXT':
            import re
            clean_text = re.sub(r'\\[f|F|p|P|l|L|O|o|A|H|Q|S|T|W].*?;', '', entity.text)
            clean_text = re.sub(r'\\P', '\n', clean_text)
            clean_text = re.sub(r'[{}]', '', clean_text)
            
            out_msp.add_text(clean_text, dxfattribs={
                'insert': entity.dxf.insert,
                'height': entity.dxf.char_height if hasattr(entity.dxf, 'char_height') else 200,
                'layer': target_layer
            })
            count += 1
        elif etype == 'POINT':
            out_msp.add_point(entity.dxf.location, dxfattribs={'layer': target_layer})
            count += 1
        elif etype in ('SOLID', 'TRACE'):
            out_msp.add_solid([entity.dxf.vtx0, entity.dxf.vtx1, entity.dxf.vtx2, entity.dxf.vtx3], dxfattribs={'layer': target_layer})
            count += 1
        elif etype == 'ELLIPSE':
            pass 
        elif hasattr(entity, 'virtual_entities'):
            if etype == 'HATCH':
                return 0
            v_ents = list(entity.virtual_entities())
            for v_ent in v_ents:
                count += flatten_entity(v_ent, target_layer, out_msp)
    except Exception as e:
        logger.debug(f"  [Error] flatten_entity failed for {etype}: {e}")
    return count

def resolve_layer(orig, lbl):
    """レイヤ名をRENAME_MAPで名寄せ。未一致は元の名前+階層タグ。"""
    for k, v in RENAME_MAP.items():
        if k in orig:
            return v if v == "GLID" else f"{v}_{lbl}"
    return f"{orig}_{lbl}"

def merge_dxf_files(files_dict: dict[str, str]) -> tuple[str, int]:
    """
    複数階のDXFファイルパスを受け取り、統合されたDXFファイルパスと抽出したエンティティ数を返す。
    files_dict: {"1F": "path/to/1f.dxf", "2F": "path/to/2f.dxf", ...}
    """
    out_dxf = ezdxf.new('R2010')
    out_msp = out_dxf.modelspace()
    
    total_lines = 0
    logger.info("--- 統合処理開始（R2010 モード） ---")
    
    for label, temp_path in files_dict.items():
        try:
            doc = ezdxf.readfile(temp_path)
            msp = doc.modelspace()
            floor_ent_count = 0

            for entity in msp:
                orig_layer = entity.dxf.layer
                
                ol_up = str(orig_layer).upper()
                if any(x in ol_up for x in ["DEFPOINTS", "ASHB", "WORK", "TMP", "印刷外"]):
                    continue

                new_layer = resolve_layer(orig_layer, label)

                if entity.dxftype() == 'INSERT':
                    try:
                        parent_resolved_layer = resolve_layer(entity.dxf.layer, label)
                        
                        if "COL" in parent_resolved_layer or "WALL" in parent_resolved_layer:
                            out_msp.add_point(entity.dxf.insert, dxfattribs={'layer': parent_resolved_layer})
                            floor_ent_count += 1

                        for ve in entity.virtual_entities():
                            if "COL" in parent_resolved_layer or "WALL" in parent_resolved_layer:
                                ve_new_layer = parent_resolved_layer
                            elif ve.dxf.layer == '0':
                                ve_new_layer = parent_resolved_layer
                            else:
                                ve_new_layer = resolve_layer(ve.dxf.layer, label)
                            floor_ent_count += flatten_entity(ve, ve_new_layer, out_msp)
                    except Exception as ex:
                        logger.debug(f"  [warn] virtual_entities failed: {ex}")
                else:
                    floor_ent_count += flatten_entity(entity, new_layer, out_msp)

            logger.info(f"  -> [{label}] Extracted {floor_ent_count} entities")
            total_lines += floor_ent_count

        except Exception as e:
            logger.error(f"  !! [{label}] Error: {e}", exc_info=True)

    logger.info(f"--- Total Merged Entities: {total_lines} ---")

    if total_lines == 0:
        return "", 0

    with tempfile.NamedTemporaryFile(delete=False, suffix=".dxf") as out_tmp:
        output_fn = out_tmp.name
    
    out_dxf.saveas(output_fn)
    return output_fn, total_lines
