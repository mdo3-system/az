// core/grid_manager.js
import { floorData, FLOORS, dxfVAxes, dxfHAxes, dxfSkewedAxes } from '../data/state_store.js';

/**
 * 通り芯の削除と連動する要素のクリーンアップ
 */
export function removeAxis(dir, idx) {
  let removedPos;
  const NODE_MATCH_TOL = 10; 

  if (dir === 'v') {
    removedPos = dxfVAxes[idx].x;
    dxfVAxes.splice(idx, 1);
  } else if (dir === 'h') {
    removedPos = dxfHAxes[idx].y;
    dxfHAxes.splice(idx, 1);
  } else if (dir === 's') {
    dxfSkewedAxes.splice(idx, 1);
    return;
  }

  FLOORS.forEach(f => {
    let nds = floorData[f].nodes;
    for (let i = nds.length - 1; i >= 0; i--) {
      const n = nds[i];
      const isHit = (dir === 'v' && Math.abs(n.x - removedPos) < NODE_MATCH_TOL) || (dir === 'h' && Math.abs(n.y - removedPos) < NODE_MATCH_TOL);
      if (isHit) {
        nds.splice(i, 1);
        updateIndicesAfterNodeRemoval(f, i);
      }
    }
  });
}

function updateIndicesAfterNodeRemoval(floorKey, removedIndex) {
    const fd = floorData[floorKey];
    const i = removedIndex;
    fd.columns.forEach(c => {
        if (c.nodeIndex === i) fd.columns.splice(fd.columns.indexOf(c), 1);
        else if (c.nodeIndex > i) c.nodeIndex--;
    });
    fd.beams.forEach((b, bi) => {
        if (b.n1 === i || b.n2 === i) fd.beams.splice(bi, 1);
        else { if (b.n1 > i) b.n1--; if (b.n2 > i) b.n2--; }
    });
    fd.slabs.forEach((s, si) => {
        if (s.nodeIds.includes(i)) fd.slabs.splice(si, 1);
        else s.nodeIds = s.nodeIds.map(nid => nid > i ? nid - 1 : nid);
    });
    if (fd.walls) {
        fd.walls.forEach((w, wi) => {
            if (w.n1 === i || w.n2 === i) fd.walls.splice(wi, 1);
            else { if (w.n1 > i) w.n1--; if (w.n2 > i) w.n2--; }
        });
    }
}

/**
 * 現在の通り芯設定に基づいてノードID（通り芯名）を再生成する
 */
export function rebuildNodeIds() {
  const TOL = 20;
  FLOORS.forEach(f => {
    if (!floorData[f] || !floorData[f].nodes) return;
    floorData[f].nodes.forEach(n => {
      // 💡 許容範囲内にあるすべての通り芯を抽出し、最も近いものを選択する
      let vas = dxfVAxes.filter(a => Math.abs(a.x - n.x) < TOL);
      let has = dxfHAxes.filter(a => Math.abs(a.y - n.y) < TOL);
      
      let bestVa = vas.sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0];
      let bestHa = has.sort((a, b) => Math.abs(a.y - n.y) - Math.abs(b.y - n.y))[0];

      if (bestVa && bestHa) {
        n.id = (bestVa.label || "?") + (bestHa.label || "?");
      } else {
        // もし軸が見つからない場合は座標から生成
        n.id = `N_${Math.round(n.x)}_${Math.round(n.y)}`;
      }
    });
  });
}

/**
 * 最寄りの通り芯名を取得する
 */
export function findNearestAxisName(x, y, tol = 500) {
    let bestVa = dxfVAxes.find(a => Math.abs(a.x - x) < tol);
    let bestHa = dxfHAxes.find(a => Math.abs(a.y - y) < tol);
    if (bestVa && bestHa) return bestVa.label + bestHa.label;
    return "";
}

/**
 * 通り芯の追加（連動ノード生成含む）
 */
export function addAxis(dir, idx, dist) {
  const numericDist = Number(dist);
  if (!Number.isFinite(numericDist)) throw new Error(`[addAxis] 無効な距離: ${dist}`);

  if (dir === 'v') {
     const axObj = dxfVAxes[idx];
     if (!axObj) return;
     const newX = Math.round(axObj.x + numericDist);
     const newL = axObj.label ? axObj.label + "'" : '';
     dxfVAxes.push({x: newX, lines: [], label: newL});
     FLOORS.forEach(f => {
       const fd = floorData[f];
       dxfHAxes.forEach(ha => { fd.nodes.push({ id: 'NEW', x: newX, y: ha.y }); });
       dxfSkewedAxes.forEach(sa => {
         const dx = sa.p2.x - sa.p1.x, dy = sa.p2.y - sa.p1.y;
         if (Math.abs(dx) > 1e-6) {
           const y = sa.p1.y + ((newX - sa.p1.x) / dx) * dy;
           fd.nodes.push({ id: (newL && sa.label ? newL + sa.label : 'NEW'), x: newX, y: y });
         }
       });
     });
  } else {
     const axObj = dxfHAxes[idx];
     if (!axObj) return;
     const newY = Math.round(axObj.y + numericDist);
     const newL = axObj.label ? axObj.label + "'" : '';
     dxfHAxes.push({y: newY, lines: [], label: newL});
     FLOORS.forEach(f => {
       const fd = floorData[f];
       dxfVAxes.forEach(va => { fd.nodes.push({ id: 'NEW', x: va.x, y: newY }); });
       dxfSkewedAxes.forEach(sa => {
         const dx = sa.p2.x - sa.p1.x, dy = sa.p2.y - sa.p1.y;
         if (Math.abs(dy) > 1e-6) {
           const x = sa.p1.x + ((newY - sa.p1.y) / dy) * dx;
           fd.nodes.push({ id: (sa.label && newL ? sa.label + newL : 'NEW'), x: x, y: newY });
         }
       });
     });
  }
}

/**
 * 斜め軸に対する交点ノード生成
 */
export function generateNodesForSkewedAxis(ax) {
  const dx = ax.p2.x - ax.p1.x, dy = ax.p2.y - ax.p1.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return;

  const newPts = [];
  if (Math.abs(dx) > 1e-6) dxfVAxes.forEach(va => newPts.push({ x: va.x, y: ax.p1.y + ((va.x - ax.p1.x) / dx) * dy, labelV: va.label }));
  if (Math.abs(dy) > 1e-6) dxfHAxes.forEach(ha => newPts.push({ x: ax.p1.x + ((ha.y - ax.p1.y) / dy) * dx, y: ha.y, labelH: ha.label }));

  const TOL = 10;
  FLOORS.forEach(f => {
    const fd = floorData[f];
    newPts.forEach(pt => {
      if (!fd.nodes.some(n => Math.hypot(n.x - pt.x, n.y - pt.y) < TOL)) {
        let baseId = (pt.labelV && ax.label) ? pt.labelV + ax.label : (pt.labelH && ax.label ? ax.label + pt.labelH : 'NEW');
        fd.nodes.push({ id: baseId, x: pt.x, y: pt.y });
      }
    });
  });
}

/**
 * 削除時の影響個数集計
 */
export function getAffectedElementsCount(dir, idx) {
  const axes = dir === 'v' ? dxfVAxes : (dir === 'h' ? dxfHAxes : dxfSkewedAxes);
  const axis = axes[idx];
  if (!axis || dir === 's') return { nodes: 0, columns: 0, beams: 0, walls: 0, slabs: 0, diaphragms: 0 };

  const targetPos = dir === 'v' ? axis.x : axis.y;
  const TOL = 10;
  const counts = { nodes: 0, columns: 0, beams: 0, walls: 0, slabs: 0, diaphragms: 0 };

  FLOORS.forEach(f => {
    const fd = floorData[f];
    const nodeSet = new Set();
    fd.nodes.forEach((n, ni) => {
      if ((dir === 'v' ? Math.abs(n.x - targetPos) : Math.abs(n.y - targetPos)) < TOL) {
        counts.nodes++; nodeSet.add(ni);
      }
    });
    if (nodeSet.size > 0) {
      fd.columns.forEach(c => { if (nodeSet.has(c.nodeIndex)) counts.columns++; });
      fd.beams.forEach(b => { if (nodeSet.has(b.n1) || nodeSet.has(b.n2)) counts.beams++; });
      fd.walls.forEach(w => { if (nodeSet.has(w.n1) || nodeSet.has(w.n2)) counts.walls++; });
      fd.slabs.forEach(s => { if (s.nodeIds.some(nid => nodeSet.has(nid))) counts.slabs++; });
      if (fd.diaphragms) fd.diaphragms.forEach(d => { if (d.nodeIds.some(nid => nodeSet.has(nid))) counts.diaphragms++; });
    }
  });
  return counts;
}

/**
 * 全階層の柱IDを再構成
 */
export function rebuildAllColumnIds() {
  rebuildNodeIds();
  FLOORS.forEach(f => {
    const fd = floorData[f];
    if (!fd || !fd.columns) return;
    fd.columns.forEach(c => {
      const node = fd.nodes[c.nodeIndex];
      if (node && node.id) c.id = node.id.replace(/_[0-9]+$/, "");
    });
  });
}
