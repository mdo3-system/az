import AppEventBus from './event_bus.js';
import { 
    floorData, currentFloor, nextId, updateNextId, 
    dxfVAxes, dxfHAxes, dxfSkewedAxes, getCurrentFloorData 
} from '../foundation_cad.js';
import { calculateSlabTributary } from './slab_calc.js';
import { autoMergeCollinearBeams, findSupportsOnBeam, cleanupOverlappingBeams } from './beam_calc.js';
import { callRender } from '../rendering_helpers.js';
import { distToBeamLine } from './geometry_utils.js';

/**
 * スラブ荷重を梁に同期させるメインロジック
 */
export const syncSlabDataToBeams = function(overrideFd = null) {
    const fd = overrideFd || getCurrentFloorData();
    if (!fd || !fd.nodes) return;

    // 0. 通り芯上の基礎梁を自動統合
    autoMergeCollinearBeams(fd);

    // 1. 各スラブの負担領域計算
    (fd.slabs || []).forEach(slab => {
        calculateSlabTributary(slab, fd.nodes, fd.beams);
    });

    // 2. 梁の荷重プロパティを初期化
    const allBeamRefs = [
        ...(fd.beams || []),
        ...(fd.perimeterBeams || [])
    ];
    allBeamRefs.forEach(b => {
        b.tributaryWidth = 0;
        b.B = 0;
        b.groundPressure = 0;
        b.sigma_e = 0;
        b.spanLoads = [];
    });

    const getTOnBeam = (p, n1, n2) => {
        const dx = n2.x - n1.x, dy = n2.y - n1.y;
        const L2 = dx*dx + dy*dy;
        if (L2 < 1) return 0;
        return ((p.x - n1.x)*dx + (p.y - n1.y)*dy) / L2;
    };
    const distToLine = (p, n1, n2) => {
        const dx = n2.x - n1.x, dy = n2.y - n1.y;
        const L2 = dx*dx + dy*dy;
        if (L2 < 1) return Math.hypot(p.x - n1.x, p.y - n1.y);
        const t = Math.max(0, Math.min(1, getTOnBeam(p, n1, n2)));
        return Math.hypot(p.x - (n1.x + t*dx), p.y - (n1.y + t*dy));
    };
    const distToInfiniteLine = (p, n1, n2) => {
        const dx = n2.x - n1.x, dy = n2.y - n1.y;
        const L2 = dx*dx + dy*dy;
        if (L2 < 1) return Math.hypot(p.x - n1.x, p.y - n1.y);
        const t = getTOnBeam(p, n1, n2);
        return Math.hypot(p.x - (n1.x + t*dx), p.y - (n1.y + t*dy));
    };

    // 3. スラブ辺と梁の対応付け
    const beamMapping = new Map();

    (fd.slabs || []).forEach((slab, sIdx) => {
        if (!slab.nodeIds || !slab.edgeLs) return;
        const nids = slab.nodeIds;
        for (let i = 0; i < nids.length; i++) {
            const p1 = fd.nodes[nids[i]];
            const p2 = fd.nodes[nids[(i + 1) % nids.length]];
            if (!p1 || !p2) continue;

            let edgeB = slab.edgeLs[i] || 0;
            let edgeSigma = (slab.groundPressure !== undefined && slab.groundPressure !== null && slab.groundPressure !== "") 
                ? parseFloat(slab.groundPressure) 
                : 30.0;
            if (isNaN(edgeSigma) || edgeSigma <= 0) edgeSigma = 30.0;

            // 💡 凹多角形（変形スラブ）などで半平面交差による負担面積計算が破綻した場合の救済措置
            if (edgeB < 0.05) {
                let lx = 2.0;
                if (slab.aijData && slab.aijData.lx) {
                    lx = slab.aijData.lx;
                } else if (slab.nodeIds && slab.nodeIds.length >= 3) {
                    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                    slab.nodeIds.forEach(nid => {
                        const p = fd.nodes[nid];
                        if (p) {
                            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
                            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
                        }
                    });
                    const W = (maxX - minX) / 1000, H = (maxY - minY) / 1000;
                    if (W > 0 && H > 0) lx = Math.min(W, H);
                }
                edgeB = lx / 2;
            }

            if (edgeB <= 0) continue;

            let centerX = 0, centerY = 0;
            nids.forEach(nid => { 
                const n = fd.nodes[nid];
                if (n) { centerX += n.x; centerY += n.y; }
            });
            centerX /= nids.length; centerY /= nids.length;

            allBeamRefs.forEach(b => {
                const bn1 = fd.nodes[b.n1];
                const bn2 = fd.nodes[b.n2];
                if (!bn1 || !bn2) return;

                const d1 = distToInfiniteLine(p1, bn1, bn2);
                const d2 = distToInfiniteLine(p2, bn1, bn2);

                if (d1 < 15 && d2 < 15) {
                    const t1 = getTOnBeam(p1, bn1, bn2);
                    const t2 = getTOnBeam(p2, bn1, bn2);
                    const minT = Math.max(0, Math.min(t1, t2));
                    const maxT = Math.min(1, Math.max(t1, t2));

                    if (maxT - minT > 0.005) {
                        const bdx = bn2.x - bn1.x, bdy = bn2.y - bn1.y;
                        const vcx = centerX - bn1.x, vcy = centerY - bn1.y;
                        const cross = bdx * vcy - bdy * vcx;
                        const side = cross >= 0 ? 1 : -1;

                        if (!beamMapping.has(b)) beamMapping.set(b, []);
                        beamMapping.get(b).push({ minT, maxT, B: edgeB, sigma: edgeSigma, side });
                    }
                }
            });
        }
    });

    // 4. 各梁の詳細集計
    allBeamRefs.forEach(b => {
        const edges = beamMapping.get(b) || [];
        const supports = findSupportsOnBeam(b, fd.nodes, fd.columns);
        const bn1 = fd.nodes[b.n1], bn2 = fd.nodes[b.n2];
        const beamTotalL = bn1 && bn2 ? Math.hypot(bn2.x - bn1.x, bn2.y - bn1.y) / 1000 : 0;

        const spanLoads = [];
        let cursorT = 0;
        let totalArea = 0;

        for (let i = 0; i <= supports.length; i++) {
            const sT = cursorT;
            const eT = (i === supports.length) ? 1.0 : supports[i].t;
            if (eT - sT < 0.005) { cursorT = Math.max(cursorT, eT); continue; }

            const spanLenFraction = eT - sT;
            const sideConts = { "1": [], "-1": [] };
            edges.forEach(edge => {
                const overlapStart = Math.max(sT, edge.minT);
                const overlapEnd = Math.min(eT, edge.maxT);
                const overlapLen = Math.max(0, overlapEnd - overlapStart);
                if (overlapLen > 1e-4) sideConts[edge.side].push({ ...edge, overlapLen });
            });

            let combinedB = 0;
            let weightedSigmaSum = 0;
            [1, -1].forEach(sideKey => {
                const contribs = sideConts[sideKey];
                if (contribs.length === 0) return;
                let sideB = 0, sideSigma = 0;
                if (contribs.length === 1) {
                    sideB = contribs[0].B; sideSigma = contribs[0].sigma;
                } else {
                    let sideSumBLen = 0, sideSumSigmaBLen = 0;
                    contribs.forEach(c => { sideSumBLen += (c.B * c.overlapLen); sideSumSigmaBLen += (c.sigma * c.B * c.overlapLen); });
                    sideB = sideSumBLen / spanLenFraction;
                    sideSigma = sideSumBLen > 0 ? (sideSumSigmaBLen / sideSumBLen) : 0;
                }
                combinedB += sideB; weightedSigmaSum += (sideSigma * sideB);
            });

            const finalSigma = combinedB > 0 ? (weightedSigmaSum / combinedB) : 0;
            spanLoads.push({ sT, eT, B: combinedB, sigma_e: finalSigma });
            totalArea += (combinedB * (spanLenFraction * beamTotalL));
            cursorT = eT;
        }

        b.spanLoads = spanLoads;
        b.tributaryArea = totalArea;
        if (spanLoads.length > 0) {
            const representative = spanLoads.reduce((prev, curr) => (curr.B > prev.B) ? curr : prev, spanLoads[0]);
            b.tributaryWidth = representative.B;
            b.B = representative.B;
            b.groundPressure = representative.sigma_e;
            b.sigma_e = representative.sigma_e;
        }
    });

    cleanupOverlappingBeams(fd);
    if (currentFloor === '1' && typeof window.updateAllBeamsShortTermStress === 'function') {
        window.updateAllBeamsShortTermStress(fd);
    }
};

/**
 * 2点間のセグメントに最も近い通り芯の名称を取得する (梁・壁共用)
 */
export const getAxisNameForSegment = function(p1, p2) {
    if (!p1 || !p2) return '';

    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const TOL = 100; // 100mm以内の通り芯を探す

    // 1. 斜め通り芯チェック
    const sAxes = window.dxfSkewedAxes || dxfSkewedAxes || [];
    for (const ax of sAxes) {
        if (!ax.p1 || !ax.p2) continue;
        const d = distToBeamLine(midX, midY, ax.p1.x, ax.p1.y, ax.p2.x, ax.p2.y);
        if (d < TOL) return ax.label || '';
    }

    // 2. 垂直通り芯 (X座標固定)
    const vAxes = window.dxfVAxes || dxfVAxes || [];
    const vMatch = vAxes.find(ax => Math.abs(ax.x - midX) < TOL);
    if (vMatch) return vMatch.label || '';

    // 3. 水平通り芯 (Y座標固定)
    const hAxes = window.dxfHAxes || dxfHAxes || [];
    const hMatch = hAxes.find(ax => Math.abs(ax.y - midY) < TOL);
    if (hMatch) return hMatch.label || '';

    return '';
};

/**
 * スラブの辺に沿って基礎梁を自動生成する
 */
export const autoGenerateBeamsFromSlabs = function(fd) {
    if (!fd || !fd.slabs || !fd.nodes) return;
    
    let createdCount = 0;
    fd.slabs.forEach(slab => {
        if (!slab.nodeIds) return;
        for (let i = 0; i < slab.nodeIds.length; i++) {
            const n1 = slab.nodeIds[i];
            const n2 = slab.nodeIds[(i + 1) % slab.nodeIds.length];
            
            const node1 = fd.nodes[n1];
            const node2 = fd.nodes[n2];
            if (!node1 || !node2) continue;

            const exists = [
                ...(fd.beams || []), 
                ...(fd.perimeterBeams || [])
            ].some(b => 
                (b.n1 === n1 && b.n2 === n2) || (b.n1 === n2 && b.n2 === n1)
            );
            
            if (!exists) {
                const dp = (window.defaultProperties && window.defaultProperties['fbeam']) || 
                           (window.defaultProperties && window.defaultProperties['beam']) || {};
                
                if (!fd.beams) fd.beams = [];
                
                const newIdNum = nextId.beam++;
                const autoAxisName = getAxisNameForSegment(node1, node2);
                
                fd.beams.push({
                    id: 'FB' + newIdNum,
                    type: 'foundation_beam',
                    n1: n1,
                    n2: n2,
                    axisName: autoAxisName, 
                    width: dp.width || 300,
                    depth: dp.depth || 640,
                    topRebar: dp.topRebar || '1-D13',
                    bottomRebar: dp.bottomRebar || '1-D13',
                    stirrupRebar: dp.stirrupRebar || 'D10',
                    stirrupPitch: dp.stirrupPitch || 200,
                    dt: dp.dt || 70,
                    groundPressure: 0,
                    tributaryWidth: 0
                });
                createdCount++;
            }
        }
    });

    if (createdCount > 0) {
        updateNextId(nextId);
    }
};

/**
 * 壁に対して通り芯名を自動付与する
 */
export const autoAssignWallAxes = function(fd) {
    if (!fd || !fd.walls || !fd.nodes) return;
    fd.walls.forEach(w => {
        if (!w.axisName) {
            const n1 = fd.nodes[w.n1], n2 = fd.nodes[w.n2];
            if (n1 && n2) {
                w.axisName = getAxisNameForSegment(n1, n2);
            }
        }
    });
};

/**
 * 全データの再計算と同期
 */
export const recalcAllTributaries = function() {
    const fd = getCurrentFloorData();
    if (!fd) return;

    autoAssignWallAxes(fd);
    autoGenerateBeamsFromSlabs(fd);
    syncSlabDataToBeams();

    if (currentFloor === '1' && typeof window.updateAllBeamsShortTermStress === 'function') {
        window.updateAllBeamsShortTermStress(fd);
    }

    AppEventBus.emit('UI_REFRESH_REQUIRED', { type: 'recalc_all' });
};

// Global registrations have been moved to state_manager.js
