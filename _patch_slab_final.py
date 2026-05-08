#!/usr/bin/env python3
# -*- coding: utf-8 -*-

JS_PATH = r'e:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\frontend\assets\js\modules\foundation\foundation_main.js'

NEW_FUNCTION = r"""window.calculateSlabTributary = function(slab, nodes, beams) {
    // [KNIFE-SLICE + CORNER BISECTOR RULE] DO NOT TOUCH N-VALUE LOGIC.
    // =========================================================================
    // 順次分割（ナイフ・スライス法）ロジック:
    // スラブを1つの親ポリゴン(P_root)とし、Y_mid による順次スライスで帯を構築。
    // その帯に対し、各エッジの「外周角での二等分線面取り」を適用し、不整形な角を削る。
    // さらに、同じYに並ぶ梁同士はX_midで分割する。
    // =========================================================================
    if (!slab.nodeIds || slab.nodeIds.length < 3) return;
    const initialPts = slab.nodeIds.map(nid => nodes[nid]).filter(Boolean);
    if (initialPts.length < 3) return;

    const gp = slab.groundPressure || 0;
    const triMult = slab.triangleMultiplier !== undefined ? parseFloat(slab.triangleMultiplier) : 1.33;

    slab.edgeLs = [];
    slab.edgeAreas = [];
    slab.edgeIsTriangle = [];
    slab.tributaryPolygons = [];

    // --- 幾何ユーティリティ ---
    const getPolyArea = (pts) => {
        let a = 0;
        for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i], p2 = pts[(i+1)%pts.length];
            a += (p1.x * p2.y - p2.x * p1.y);
        }
        return Math.abs(a) / 2;
    };

    function clipHP(poly, a, b, c) {
        const res = [], eps = 1e-6;
        if (!poly || poly.length < 1) return [];
        for (let k = 0, n = poly.length; k < n; k++) {
            const p1 = poly[k], p2 = poly[(k+1)%n];
            const v1 = a * p1.x + b * p1.y + c;
            const v2 = a * p2.x + b * p2.y + c;
            if (v1 >= -eps) {
                if (v2 >= -eps) { res.push(p2); }
                else {
                    const t = v1 / (v1 - v2);
                    res.push({ x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) });
                }
            } else {
                if (v2 > eps) {
                    const t = v1 / (v1 - v2);
                    res.push({ x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) });
                    res.push(p2);
                }
            }
        }
        return res;
    }

    // CCW判定とエッジ定義
    let signArea = 0;
    for (let i = 0; i < initialPts.length; i++) {
        const p1 = initialPts[i], p2 = initialPts[(i+1)%initialPts.length];
        signArea += (p1.x * p2.y - p2.x * p1.y);
    }
    const isCCW = signArea > 0;

    const N = initialPts.length;
    const edges = initialPts.map((p, i) => {
        const pnext = initialPts[(i+1)%N];
        const dx = pnext.x - p.x, dy = pnext.y - p.y;
        const len = Math.hypot(dx, dy);
        let nx = isCCW ? -dy : dy, ny = isCCW ? dx : -dx;
        const nl = Math.hypot(nx, ny);
        nx /= (nl || 1); ny /= (nl || 1);
        return { p1: p, p2: pnext, dx, dy, len, nx, ny, isHorizontal: Math.abs(dy) < Math.abs(dx) * 0.20 };
    });

    // --- 1. スライス用ナイフ (Y_mid) の抽出 ---
    let hYs = [];
    edges.forEach(e => { if (e.isHorizontal) hYs.push((e.p1.y + e.p2.y) / 2); });
    hYs.sort((a,b) => a - b);
    let uniqueY = hYs.length > 0 ? [hYs[0]] : [];
    for (let i = 1; i < hYs.length; i++) {
        if (hYs[i] - uniqueY[uniqueY.length - 1] > 10.0) uniqueY.push(hYs[i]);
    }
    
    // --- 2. 各エッジ領域の生成と完全分配 ---
    for (let i = 0; i < N; i++) {
        const Ei = edges[i];
        let trib = [...initialPts];

        // ルールA: 自信の属する帯（バンド）を確保する Y-slice の適用 (水平梁のみ)
        if (Ei.isHorizontal) {
            const myY = (Ei.p1.y + Ei.p2.y) / 2;
            const yIndex = uniqueY.findIndex(y => Math.abs(y - myY) < 10.0);
            if (yIndex > 0) {
                const topMid = (uniqueY[yIndex - 1] + myY) / 2;
                trib = clipHP(trib, 0, 1, -topMid);  // y >= topMid
            }
            if (yIndex < uniqueY.length - 1) {
                const botMid = (myY + uniqueY[yIndex + 1]) / 2;
                trib = clipHP(trib, 0, -1, botMid);  // y <= botMid
            }

            // ルールC: 同じY座標に並ぶ他の梁との区別 (垂直分割スプリット)
            for (let j = 0; j < N; j++) {
                if (i === j) continue;
                const Ej = edges[j];
                if (Ej.isHorizontal && Math.abs((Ej.p1.y + Ej.p2.y)/2 - myY) < 10.0) {
                    const cxI = (Ei.p1.x + Ei.p2.x)/2;
                    const cxJ = (Ej.p1.x + Ej.p2.x)/2;
                    const xMid = (cxI + cxJ) / 2;
                    if (cxI < cxJ) {
                        trib = clipHP(trib, -1, 0, xMid); // x <= xMid
                    } else if (cxI > cxJ) {
                        trib = clipHP(trib, 1, 0, -xMid); // x >= xMid
                    }
                }
            }
        } else {
            // 垂直・斜め梁は負担面積なし (帯生成優先のルールに従う)
            slab.tributaryPolygons.push([]); slab.edgeLs.push(0); slab.edgeAreas.push(0); slab.edgeIsTriangle.push(false);
            continue;
        }

        // ルールB: スラブ外周角（Corner）の二等分線（45度等）クリッピング
        // 梁の端点 p1
        {
            const j = (i - 1 + N) % N; // p1 で接続する手前のエッジ
            const N_in = edges[j], N_out = edges[i];
            let ax = N_in.nx - N_out.nx, ay = N_in.ny - N_out.ny;
            if (Math.hypot(ax, ay) < 1e-4) { ax = N_out.dx; ay = N_out.dy; }
            trib = clipHP(trib, ax, ay, -(ax * N_out.p1.x + ay * N_out.p1.y));
        }

        // 梁の端点 p2
        {
            const j = (i + 1) % N; // p2 で接続する次のエッジ
            const N_in = edges[i], N_out = edges[j];
            let ax = N_out.nx - N_in.nx, ay = N_out.ny - N_in.ny;
            if (Math.hypot(ax, ay) < 1e-4) { ax = -N_in.dx; ay = -N_in.dy; }
            trib = clipHP(trib, ax, ay, -(ax * N_in.p2.x + ay * N_in.p2.y));
        }

        slab.tributaryPolygons.push(trib);
        const a_mm2 = trib.length >= 3 ? getPolyArea(trib) : 0;
        const a_m2 = a_mm2 / 1000000;
        let L = (Ei.len > 1) ? a_m2 / (Ei.len / 1000) : 0;

        let isTri = false;
        if (trib.length >= 3 && a_m2 > 0) {
            const tYs = trib.map(p => p.y);
            const h = Math.max(...tYs) - Math.min(...tYs);
            if (h > 10.0 && a_m2 / ((h / 1000) * (Ei.len / 1000)) < 0.6) isTri = true;
        }
        if (isTri) L *= triMult;

        slab.edgeLs.push(L);
        slab.edgeAreas.push(a_m2);
        slab.edgeIsTriangle.push(isTri);
    }

    // 荷重反映
    if (gp > 0) {
        for (let i = 0; i < N; i++) {
            const L = slab.edgeLs[i], len_m = edges[i].len / 1000;
            if (L <= 0) continue;
            const load_kN = L * len_m * gp;
            const mx = (edges[i].p1.x + edges[i].p2.x)/2, my = (edges[i].p1.y + edges[i].p2.y)/2;
            beams.forEach(b => {
                const bn1 = nodes[b.n1], bn2 = nodes[b.n2];
                if (!bn1 || !bn2) return;
                const bl2 = Math.pow(bn2.x - bn1.x, 2) + Math.pow(bn2.y - bn1.y, 2);
                if (bl2 === 0) return;
                let tp = ((mx - bn1.x) * (bn2.x - bn1.x) + (my - bn1.y) * (bn2.y - bn1.y)) / bl2;
                tp = Math.max(0, Math.min(1, tp));
                if (Math.hypot(mx - (bn1.x + tp * (bn2.x - bn1.x)), my - (bn1.y + tp * (bn2.y - bn1.y))) < 50) {
                    b.slabLoad = (b.slabLoad || 0) + load_kN;
                    b.groundPressure = Math.max(b.groundPressure || 0, gp);
                }
            });
        }
    }
}"""

with open(JS_PATH, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_line = None
end_line = None
for idx, line in enumerate(lines):
    if 'window.calculateSlabTributary = function(slab, nodes, beams) {' in line:
        if start_line is None:
            start_line = idx
    if start_line is not None and end_line is None and idx > start_line + 5:
        if line.strip() == '}':
            end_line = idx + 1
            break

before = lines[:start_line]
after  = lines[end_line:]

with open(JS_PATH, 'w', encoding='utf-8') as f:
    f.writelines(before)
    f.write(NEW_FUNCTION + '\n')
    f.writelines(after)

print("Done. Replaced script with Knife-Slice + specific corner rules.")
