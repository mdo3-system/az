// core/slab_calc.js
import { clipPolygonStrict, dedupPolygon, calcPolygonAreaStrict } from './geometry_utils.js';
import { getRebarArea } from './beam_calc.js';

export const calculateSlabTributary = function(slab, nodes, beams) {
    if (!slab.nodeIds || slab.nodeIds.length < 3) return;
    const initialPts = slab.nodeIds.map(nid => nodes[nid]).filter(Boolean);
    if (initialPts.length < 3) return;

    let signedArea = 0;
    for (let i = 0; i < initialPts.length; i++) {
        const p1 = initialPts[i], p2 = initialPts[(i + 1) % initialPts.length];
        signedArea += (p1.x * p2.y - p2.x * p1.y);
    }
    const CCW_PTS = signedArea > 0 ? [...initialPts] : [...initialPts].reverse();
    const NUM_PTS = CCW_PTS.length;

    const edgeLines = [];
    for (let i = 0; i < NUM_PTS; i++) {
        const p1 = CCW_PTS[i], p2 = CCW_PTS[(i + 1) % NUM_PTS];
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) continue;
        const nx = -dy / len, ny = dx / len;
        const d = nx * p1.x + ny * p1.y;
        edgeLines.push({ p1, p2, nx, ny, d, len });
    }
    const NUM_EDGES = edgeLines.length;

    slab.tributaryPolygons = [];
    slab.edgeLs = [];
    slab.edgeAreas = [];
    slab.edgeLengths = []; 

    for (let i = 0; i < NUM_EDGES; i++) {
        const Ei = edgeLines[i];
        let pi_poly = [...CCW_PTS];

        for (let j = 0; j < NUM_EDGES; j++) {
            if (i === j) continue;
            const Ej = edgeLines[j];

            const coeffA = Ei.nx - Ej.nx;
            const coeffB = Ei.ny - Ej.ny;
            const coeffC = Ej.d - Ei.d;

            if (Math.hypot(coeffA, coeffB) > 1e-7) {
                pi_poly = clipPolygonStrict(pi_poly, coeffA, coeffB, coeffC);
            } else {
                if (coeffC > 1e-7) { pi_poly = []; }
            }
            if (pi_poly.length === 0) break;
        }

        const EPS_MM = 5; 
        const deduped = dedupPolygon(pi_poly, EPS_MM);

        if (deduped.length >= 3) {
            const area_mm2 = calcPolygonAreaStrict(deduped);
            const area_m2 = area_mm2 / 1e6;
            const edgeLen_m = Ei.len / 1000;
            const mult = slab.triangleMultiplier || 1.33;
            const isTri = deduped.length === 3;
            const finalL = isTri ? (area_m2 * mult) / edgeLen_m : area_m2 / edgeLen_m;

            slab.tributaryPolygons.push(deduped);
            slab.edgeAreas.push(area_m2);
            slab.edgeLs.push(finalL);
            slab.edgeLengths.push(edgeLen_m);
        } else {
            slab.tributaryPolygons.push([]);
            slab.edgeAreas.push(0);
            slab.edgeLs.push(0);
            slab.edgeLengths.push(0);
        }
    }

    const origPolygons = new Array(NUM_PTS).fill([]);
    const origAreas = new Array(NUM_PTS).fill(0);
    const origLs = new Array(NUM_PTS).fill(0);
    const origLengths = new Array(NUM_PTS).fill(0);

    for (let i = 0; i < NUM_PTS; i++) {
        const origIdx = (signedArea > 0) ? i : (NUM_PTS - 2 - i + NUM_PTS) % NUM_PTS;
        origPolygons[origIdx] = slab.tributaryPolygons[i];
        origAreas[origIdx] = slab.edgeAreas[i];
        origLs[origIdx] = slab.edgeLs[i];
        origLengths[origIdx] = slab.edgeLengths[i];
    }

    slab.tributaryPolygons = origPolygons;
    slab.edgeAreas = origAreas;
    slab.edgeLs = origLs;
    slab.edgeLengths = origLengths;
};

export const normalizeSupportCondition = function(cond) {
    if (!cond) return '4辺固定';
    let normalized = cond.replace(/\(/g, '（').replace(/\)/g, '）').replace(/\s+/g, '').trim();
    
    const standardMap = {
        '3辺固定1辺ピン(長辺ピン)': '3辺固定1辺ピン（長辺ピン）',
        '3辺固定1辺ピン(短辺ピン)': '3辺固定1辺ピン（短辺ピン）',
        '3辺固定1辺ピン': '3辺固定1辺ピン（長辺ピン）',
        '1辺固定3辺ピン': '1辺固定3辺ピン（長辺固定）',
        '1辺固定3辺ピン(長辺固定)': '1辺固定3辺ピン（長辺固定）',
        '1辺固定3辺ピン(短辺固定)': '1辺固定3辺ピン（短辺固定）',
        '片持ち': '片持ち（跳出し）',
        '片持ち(跳出し)': '片持ち（跳出し）'
    };
    if (standardMap[normalized]) return standardMap[normalized];
    return normalized;
};

function autoDetectSlabSupportPattern(slab, nodes) {
    if (!slab || !slab.edgeConditions || slab.edgeConditions.length < 3) return '4辺固定';
    
    const conditions = slab.edgeConditions;
    const numEdges = conditions.length;
    
    let fixedCount = 0;
    let pinCount = 0;
    let freeCount = 0;
    
    conditions.forEach(c => {
        if (c === 'pin') pinCount++;
        else if (c === 'free') freeCount++;
        else fixedCount++; 
    });

    if (fixedCount === numEdges) return '4辺固定';
    if (pinCount === numEdges) return '4辺ピン';
    if (fixedCount === 1 && freeCount >= 2) return '片持ち(跳出し)';
    if (fixedCount === 3 && pinCount === 1) {
        return '3辺固定1辺ピン（長辺ピン）';
    }
    if (fixedCount === 2) {
        return '2隣辺固定2隣辺ピン';
    }
    if (fixedCount === 1) {
        return '1辺固定3辺ピン（長辺固定）';
    }
    return '4辺固定';
}

export const calculateSlabStress = function(slab, nodes) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    if (slab && slab.nodeIds && slab.nodeIds.length >= 3) {
      slab.nodeIds.forEach(nid => {
        const p = nodes[nid];
        if (p) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
      });
    }

    const W = minX === Infinity ? 0 : (maxX - minX);
    const H = minY === Infinity ? 0 : (maxY - minY);
    const lx = Math.max(0.1, Math.min(W, H)) / 1000.0;
    const ly = Math.max(0.1, Math.max(W, H)) / 1000.0;

    let sigma_e = 30.0;
    if (slab && slab.groundPressure !== undefined && slab.groundPressure !== null) {
        sigma_e = parseFloat(slab.groundPressure);
        if (isNaN(sigma_e)) sigma_e = 30.0;
    }

    const D = slab ? (slab.thickness || slab.D || slab.t || 150) : 150;
    const dtValue = (slab && slab.dt !== undefined) ? parseFloat(slab.dt) : 70.0;
    const j = (7/8) * (D - dtValue);

    let cond = slab ? (slab.supportCondition || '4辺固定') : '4辺固定';
    if (cond === '自動判定' && slab) {
        cond = autoDetectSlabSupportPattern(slab, nodes);
    }
    cond = normalizeSupportCondition(cond);

    const migrationMap = {
      '1辺ピン端': '3辺固定1辺ピン（長辺ピン）',
      '4辺ピン端': '4辺ピン',
      '3辺ピン（長辺接続）': '1辺固定3辺ピン（長辺固定）',
      '3辺ピン（短辺接続）': '1辺固定3辺ピン（短辺固定）',
      '2隣辺固定2隣辺ピン': '2辺隣辺固定2辺ピン',
      '長辺2辺固定短辺2辺ピン': '2辺長辺固定2辺ピン',
      '短辺2辺固定長辺2辺ピン': '2辺短辺固定2辺ピン'
    };
    if (migrationMap[cond]) cond = migrationMap[cond];

    const B = slab && slab.cantilever_B !== undefined ? parseFloat(slab.cantilever_B) : 0.9;
    const b = slab && slab.cantilever_b !== undefined ? parseFloat(slab.cantilever_b) : 0.15;

    if (minX === Infinity || lx <= 0.001 || !slab || !slab.nodeIds || slab.nodeIds.length < 3) {
        return { lx:1.0, ly:1.0, Mx1: 0, Mx2: 0, My1: 0, My2: 0, sigma_ex: 0, w:0, cond:'4辺固定', B:0, b:0, D, j };
    }

    const sigma_ex = (Math.pow(ly, 4) / (Math.pow(lx, 4) + Math.pow(ly, 4))) * sigma_e;
    const lx2 = Math.pow(lx, 2);

    let Mx1 = 0, Mx2 = 0, My1 = 0, My2 = 0;

    switch (cond) {
        case '4辺固定':
            Mx1 = (1/12) * sigma_ex * lx2;
            Mx2 = (1/18) * sigma_ex * lx2;
            My1 = (1/24) * sigma_e * lx2;
            My2 = (1/36) * sigma_e * lx2;
            break;
        case '3辺固定1辺ピン（長辺ピン）':
            Mx1 = (1/9) * sigma_ex * lx2;
            Mx2 = (1/18) * sigma_ex * lx2;
            My1 = (1/14) * sigma_e * lx2;
            My2 = (1/36) * sigma_e * lx2;
            break;
        case '3辺固定1辺ピン（短辺ピン）':
            Mx1 = (1/14) * sigma_ex * lx2;
            Mx2 = (1/36) * sigma_ex * lx2;
            My1 = (1/9) * sigma_e * lx2;
            My2 = (1/18) * sigma_e * lx2;
            break;
        case '2辺隣辺固定2辺ピン':
            Mx1 = (1/8) * sigma_ex * lx2;
            Mx2 = (1/18) * sigma_ex * lx2;
            My1 = (1/12) * sigma_e * lx2;
            My2 = (1/36) * sigma_e * lx2;
            break;
        case '2辺長辺固定2辺ピン':
            Mx1 = 0;
            Mx2 = 0;
            My1 = (1/12) * sigma_e * lx2;
            My2 = (1/24) * sigma_e * lx2;
            break;
        case '2辺短辺固定2辺ピン':
            Mx1 = (1/12) * sigma_e * lx2;
            Mx2 = (1/24) * sigma_e * lx2;
            My1 = 0;
            My2 = 0;
            break;
        case '1辺固定3辺ピン（長辺固定）':
            Mx1 = (1/12) * sigma_ex * lx2; 
            Mx2 = (1/8) * sigma_ex * lx2;
            My1 = 0;
            My2 = (1/27) * sigma_e * lx2;
            break;
        case '1辺固定3辺ピン（短辺固定）':
            Mx1 = 0;
            Mx2 = (1/8) * sigma_ex * lx2;
            My1 = (1/12) * sigma_e * lx2;
            My2 = (1/27) * sigma_e * lx2;
            break;
        case '4辺ピン':
            Mx1 = 0;
            Mx2 = (1/8) * sigma_ex * lx2;
            My1 = 0;
            My2 = (1/27) * sigma_e * lx2;
            break;
        case '片持ち（跳出し）':
            Mx1 = 0.5 * sigma_e * Math.pow((B - (b / 2)), 2);
            Mx2 = 0;
            My1 = 0;
            My2 = 0;
            break;
        default:
            Mx1 = 0; Mx2 = 0; My1 = 0; My2 = 0;
            break;
    }

    return { lx, ly, Mx1, Mx2, My1, My2, sigma_ex, w: sigma_e, cond, B, b, D, j };
};

export const calculateAndSetSlabAIJStress = function(slab, nodes) {
    if (!slab || !nodes) return;
    
    const stress = calculateSlabStress(slab, nodes);
    
    const t = slab.thickness !== undefined ? slab.thickness : (slab.t !== undefined ? slab.t : (slab.D !== undefined ? slab.D : 150));
    const dt = slab.dt !== undefined ? slab.dt : 70;
    const ft = slab.ft !== undefined ? slab.ft : 195;
    const w = stress.w; 
    
    const j = Math.max(stress.j, 1);

    const reqAtX_Top = stress.Mx2 * 1e6 / (ft * j);    
    const reqAtX_Bottom = stress.Mx1 * 1e6 / (ft * j); 
    const reqAtY_Top = stress.My2 * 1e6 / (ft * j);    
    const reqAtY_Bottom = stress.My1 * 1e6 / (ft * j); 
    
    const sR = slab.shortRebar || 'D13';
    const sP = slab.shortPitch !== undefined ? slab.shortPitch : 200;
    const lR = slab.longRebar || 'D13';
    const lP = slab.longPitch !== undefined ? slab.longPitch : 200;

    const actualAtX = getRebarArea(sR, 'average') * (1000 / Math.max(sP, 1));
    const actualAtY = getRebarArea(lR, 'average') * (1000 / Math.max(lP, 1));

    const ratioX_Top = reqAtX_Top / Math.max(actualAtX, 1);
    const ratioX_Bottom = reqAtX_Bottom / Math.max(actualAtX, 1);
    const ratioY_Top = reqAtY_Top / Math.max(actualAtY, 1);
    const ratioY_Bottom = reqAtY_Bottom / Math.max(actualAtY, 1);

    const ratioX = Math.max(ratioX_Top, ratioX_Bottom);
    const ratioY = Math.max(ratioY_Top, ratioY_Bottom);
    
    slab.aijData = {
        lx: stress.lx,
        ly: stress.ly,
        lambda: stress.ly / stress.lx,
        cond: stress.cond,
        w: w, t: t, dt: dt, ft: ft,
        Mx1: stress.Mx1, Mx2: stress.Mx2, 
        My1: stress.My1, My2: stress.My2,
        shortLabel: '短辺',
        longLabel: '長辺',
        j: j,
        reqAtX_Top, reqAtX_Bottom,
        actualAtX_Top: actualAtX, actualAtX_Bottom: actualAtX,
        ratioX_Top, ratioX_Bottom,
        reqAtY_Top, reqAtY_Bottom,
        actualAtY_Top: actualAtY, actualAtY_Bottom: actualAtY,
        ratioY_Top, ratioY_Bottom,
        reqAtX: Math.max(reqAtX_Top, reqAtX_Bottom),
        reqAtY: Math.max(reqAtY_Top, reqAtY_Bottom),
        actualAtX: actualAtX,
        actualAtY: actualAtY,
        ratioX: ratioX,
        ratioY: ratioY,
        isOK: (ratioX <= 1.0 && ratioY <= 1.0),
        sR: sR, sP: sP, lR: lR, lP: lP, 
        sTR: sR, sTP: sP, lTR: lR, lTP: lP,
        sBR: sR, sBP: sP, lBR: lR, lBP: lP
    };
};

export const calculateDiaphragmProps = function(allFloorData, floorList) {
    if (!allFloorData || !floorList) {
        console.warn("[System] calculateDiaphragmProps: 必要なデータ(allFloorData, floorList)が不足しています。");
        return;
    }
    
    floorList.forEach(floorKey => {
        const fd = allFloorData[floorKey];
        if (!fd || !fd.diaphragms) return;

        fd.diaphragms.forEach(diaph => {
            if (diaph.nodeIds && diaph.nodeIds.length >= 3 && fd.nodes) {
                const pts = diaph.nodeIds.map(nid => fd.nodes[nid]).filter(Boolean);
                if (pts.length >= 3) {
                    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                    let calcArea = 0;
                    
                    for (let i = 0; i < pts.length; i++) {
                        const p1 = pts[i];
                        const p2 = pts[(i + 1) % pts.length];
                        minX = Math.min(minX, p1.x); 
                        maxX = Math.max(maxX, p1.x);
                        minY = Math.min(minY, p1.y); 
                        maxY = Math.max(maxY, p1.y);
                        calcArea += (p1.x * p2.y) - (p2.x * p1.y);
                    }
                    diaph.BBox_X = (maxX - minX) / 1000;
                    diaph.BBox_Y = (maxY - minY) / 1000;
                    diaph.area = Math.abs(calcArea) / 2 / 1000000;
                    
                    diaph.Lx = diaph.BBox_X;
                    diaph.Ly = diaph.BBox_Y;
                }
            }

            const S = diaph.area || 0;
            const X = diaph.BBox_X || 0;
            const Y = diaph.BBox_Y || 0;

            if (X > 0 && Y > 0 && S > 0) {
                diaph.Lx_eq = S / Y;
                diaph.Ly_eq = S / X;

                diaph.eta_x = Math.min(1.0, diaph.Lx_eq / X);
                diaph.eta_y = Math.min(1.0, diaph.Ly_eq / Y);

                diaph.W_design_x = diaph.Lx_eq * diaph.eta_x;
                diaph.W_design_y = diaph.Ly_eq * diaph.eta_y;
                
                diaph.Lex = diaph.W_design_x;
                diaph.Ley = diaph.W_design_y;
            } else {
                diaph.Lx_eq = X; diaph.Ly_eq = Y;
                diaph.eta_x = 1.0; diaph.eta_y = 1.0;
                diaph.W_design_x = X; diaph.W_design_y = Y;
                diaph.Lex = X; diaph.Ley = Y;
            }

            const dQa = diaph.delta_qa || diaph.Qa || 0;
            diaph.qx = dQa * diaph.Lex;
            diaph.qy = dQa * diaph.Ley;
        });
    });
};


