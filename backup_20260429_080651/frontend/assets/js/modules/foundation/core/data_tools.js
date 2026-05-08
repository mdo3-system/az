// core/data_tools.js
import { floorData, currentFloor, dxfVAxes, dxfHAxes } from '../foundation_cad.js';
import { isSamePoint, STRESS_TOLERANCE } from './constants.js';

/**
 * 基礎CADデータ整合性修復エンジン (Physical Restorer)
 * 座標の微細なズレ、ノードIDの重複、孤立データの蓄積を物理的に洗浄する。
 */
export const repairFoundationData = window.repairFoundationData = function() {
    const fd = (typeof floorData !== 'undefined' ? floorData : null)?.[currentFloor] || window.floorData?.[window.currentFloor];
    if (!fd || !fd.nodes) return { success: false, message: "データが見つかりません" };

    console.log("%c--- 修復エンジン起動: 物理洗浄を開始します ---", "color: #e67e22; font-weight: bold;");
    const startTime = Date.now();
    
    const initialNodeCount = fd.nodes.length;
    const initialBeamCount = (fd.beams? fd.beams.length : 0) + (fd.perimeterBeams? fd.perimeterBeams.length : 0);

    const uniqueX = [...new Set((dxfVAxes || []).map(a => Math.round(a.x)))].sort((a,b) => a-b);
    const uniqueY = [...new Set((dxfHAxes || []).map(a => Math.round(a.y)))].sort((a,b) => a-b);

    const SNAP_TOLERANCE = 100;
    const EPS = 0.0001; // 💡 修正：浮動小数点の許容誤差

    fd.nodes.forEach(node => {
        const closeX = uniqueX.find(gx => Math.abs(gx - node.x) < SNAP_TOLERANCE);
        if (closeX !== undefined) node.x = closeX;

        const closeY = uniqueY.find(gy => Math.abs(gy - node.y) < SNAP_TOLERANCE);
        if (closeY !== undefined) node.y = closeY;
    });

    const indexMap = new Array(fd.nodes.length); 
    const newNodes = [];

    fd.nodes.forEach((node, oldIdx) => {
        // 💡 修正：Math.round を含むキー検索を廃止し、EPS（0.0001）による距離判定で近傍ノードを探す
        let matchIdx = newNodes.findIndex(nn => 
            Math.abs(nn.x - node.x) < EPS && Math.abs(nn.y - node.y) < EPS
        );

        if (matchIdx !== -1) {
            indexMap[oldIdx] = matchIdx;
        } else {
            const newIdx = newNodes.length;
            indexMap[oldIdx] = newIdx;
            
            if (!node.id || node.id === 'NEW') node.id = "N" + (newIdx + 1);
            newNodes.push(node);
        }
    });

    const remap = (idx) => (idx !== undefined && indexMap[idx] !== undefined) ? indexMap[idx] : idx;

    const processBeams = (beams) => {
        if (!beams) return [];
        return beams.map(b => ({
            ...b,
            n1: remap(b.n1),
            n2: remap(b.n2)
        })).filter(b => {
             if (b.n1 === b.n2) return false;
             return true;
        });
    };
    fd.beams = processBeams(fd.beams);
    fd.perimeterBeams = processBeams(fd.perimeterBeams);

    if (fd.columns) {
        fd.columns.forEach(col => {
            col.nodeIndex = remap(col.nodeIndex);
        });
        const colSet = new Set();
        fd.columns = fd.columns.filter(col => {
            if (colSet.has(col.nodeIndex)) return false;
            colSet.add(col.nodeIndex);
            return true;
        });
    }

    if (fd.walls) {
        fd.walls = fd.walls.map(w => ({
            ...w,
            n1: remap(w.n1),
            n2: remap(w.n2)
        })).filter(w => w.n1 !== w.n2);
    }

    if (fd.slabs) {
        fd.slabs.forEach(slab => {
            if (slab.nodeIds) {
                slab.nodeIds = [...new Set(slab.nodeIds.map(nid => remap(nid)))];
            }
        });
        fd.slabs = fd.slabs.filter(s => s.nodeIds && s.nodeIds.length >= 3);
    }

    if (fd.diaphragms) {
        fd.diaphragms.forEach(di => {
            if (di.nodeIds) {
                di.nodeIds = [...new Set(di.nodeIds.map(nid => remap(nid)))];
            }
        });
        fd.diaphragms = fd.diaphragms.filter(d => d.nodeIds && d.nodeIds.length >= 3);
    }

    fd.nodes = newNodes;

    const beamKeySet = new Set();
    fd.beams = fd.beams.filter(b => {
        const key = [b.n1, b.n2].sort().join('-');
        if (beamKeySet.has(key)) return false;
        beamKeySet.add(key);
        return true;
    });

    const duration = Date.now() - startTime;
    const resultMsg = `修復完了 (${duration}ms):
    - ノード: ${initialNodeCount} -> ${fd.nodes.length}
    - 梁: ${initialBeamCount} -> ${fd.beams.length + (fd.perimeterBeams? fd.perimeterBeams.length : 0)}
    - 重複・ズレ・不整合を全て物理洗浄しました。`;

    console.log(`%c${resultMsg}`, "color: #27ae60; font-weight: bold;");
    
    if (window.pushHistory) window.pushHistory();
    return { success: true, message: resultMsg };
};

/**
 * スラブ外周外に飛び出した孤立基礎梁の緊急クリーンアップ
 */
export const cleanupOutOfSlabBeams = window.cleanupOutOfSlabBeams = function(options = {}) {
    const fd = (typeof floorData !== 'undefined' ? floorData : null)?.[currentFloor] || window.floorData?.[window.currentFloor];
    if (!fd || !fd.nodes) {
        console.warn('[cleanupOutOfSlabBeams] データが見つかりません');
        return;
    }

    const colNodeSet = new Set((fd.columns || []).map(c => c.nodeIndex));
    const slabNodeSet = new Set((fd.slabs || []).flatMap(s => s.nodeIds || []));

    const isValidEndpoint = (nid) => colNodeSet.has(nid) || slabNodeSet.has(nid);

    const removedBeams = [];
    fd.beams = (fd.beams || []).filter((b, i) => {
        const ok = isValidEndpoint(b.n1) && isValidEndpoint(b.n2);
        if (!ok) removedBeams.push({ index: i, id: b.id, n1: b.n1, n2: b.n2 });
        return ok;
    });

    const removedPerimeterBeams = [];
    if (fd.perimeterBeams) {
        fd.perimeterBeams = fd.perimeterBeams.filter((b, i) => {
            const ok = isValidEndpoint(b.n1) && isValidEndpoint(b.n2);
            if (!ok) removedPerimeterBeams.push({ index: i, id: b.id, n1: b.n1, n2: b.n2 });
            return ok;
        });
    }

    const totalRemoved = removedBeams.length + removedPerimeterBeams.length;
    if (totalRemoved > 0) {
        console.log(`%c[cleanupOutOfSlabBeams] ${totalRemoved} 本のスラブ外基礎梁を除去しました。`, 'color:#e74c3c; font-weight:bold;');
        
        if (window.pushHistory) window.pushHistory();
        if (window.syncSlabDataToBeams) window.syncSlabDataToBeams();
        if (window.callRender) window.callRender();
        if (window.updateDataList) window.updateDataList();
        if (window.updatePropertyPanel) window.updatePropertyPanel();

        alert(`✅ クリーンアップ完了: ${totalRemoved} 本のスラブ外基礎梁を除去しました。\n詳細はコンソールを確認してください。`);
    } else {
        console.log('%c[cleanupOutOfSlabBeams] スラブ外の孤立梁なし。データは正常です。', 'color:#27ae60;');
        if (!options.silent) alert('✅ スラブ外の孤立梁は見つかりませんでした。データは正常です。');
    }

    return { removedBeams, removedPerimeterBeams };
};
