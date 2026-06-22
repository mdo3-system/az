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
export function rebuildNodeIds(force = false) {
  const TOL = 100; // 💡 20から100に拡大（微小な座標のずれを許容）
  FLOORS.forEach(f => {
    if (!floorData[f] || !floorData[f].nodes) return;
    floorData[f].nodes.forEach(n => {
      // 💡 許容範囲内にあるすべての通り芯を抽出し、最も近いものを選択する
      let vas = dxfVAxes.filter(a => Math.abs(a.x - n.x) < TOL);
      let has = dxfHAxes.filter(a => Math.abs(a.y - n.y) < TOL);
      
      let bestVa = vas.sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0];
      let bestHa = has.sort((a, b) => Math.abs(a.y - n.y) - Math.abs(b.y - n.y))[0];

      if (bestVa && bestHa) {
        const newId = (bestVa.label || "?") + (bestHa.label || "?");
        // 💡 すでに有効な名前がある場合は上書きしない（自動生成名や"?"を含む場合のみ更新、force=trueの時は強制上書き）
        if (force || !n.id || n.id.startsWith('N_') || n.id.includes('?')) {
          n.id = newId;
        }
      } else {
        // もし軸が見つからない場合は座標から生成
        if (force || !n.id || n.id.includes('?')) {
          n.id = `N_${Math.round(n.x)}_${Math.round(n.y)}`;
        }
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
 * 全階層の全要素（柱、壁、梁等）の符号を現在の通り芯に合わせて再構成する
 */
/**
 * 全階層の全要素（柱、壁、梁等）の符号を現在の通り芯に合わせて再構成する
 * @param {boolean} force - 強制的に上書きするかどうか
 */
export function syncAllElementSymbols(force = false) {
  rebuildNodeIds(force);
  const TOL_COORD = 20; // 座標一致の許容誤差

  FLOORS.forEach(f => {
    const fd = floorData[f];
    if (!fd) return;

    // 1. 柱の符号更新
    if (fd.columns) {
      fd.columns.forEach(c => {
        const node = fd.nodes[c.nodeIndex];
        if (node && node.id) {
          const newId = node.id.replace(/_[0-9]+$/, "");
          // 強制更新でない場合、すでに何らかの符号が存在していれば手動修正を保護するためスキップ
          if (!force && c.id) return;
          c.id = newId;
        }
      });
    }

    // 2. 壁、梁、基礎梁の通り芯名 (axisName) 更新
    const elements = [...(fd.walls || []), ...(fd.beams || [])];
    elements.forEach(el => {
      const n1 = fd.nodes[el.n1];
      const n2 = fd.nodes[el.n2];
      if (!n1 || !n2) return;

      let bestAxis = "";
      const MATCH_TOL = 20; // 💡 5mmから20mmに緩和（緩やかな斜め通り芯の誤判定や吸着ズレを許容）
      
      // A. 垂直判定 (X座標がほぼ同じ) -> X軸名を採用
      if (Math.abs(n1.x - n2.x) < TOL_COORD) {
        // 最も座標が近い垂直軸を選択
        const sorted = dxfVAxes.filter(a => Math.abs(a.x - n1.x) < MATCH_TOL)
                              .sort((a, b) => Math.abs(a.x - n1.x) - Math.abs(b.x - n1.x));
        if (sorted[0]) bestAxis = sorted[0].label || "";
      } 
      // B. 水平判定 (Y座標がほぼ同じ) -> Y軸名を採用
      else if (Math.abs(n1.y - n2.y) < TOL_COORD) {
        // 最も座標が近い水平軸を選択
        const sorted = dxfHAxes.filter(a => Math.abs(a.y - n1.y) < MATCH_TOL)
                              .sort((a, b) => Math.abs(a.y - n1.y) - Math.abs(b.y - n1.y));
        if (sorted[0]) bestAxis = sorted[0].label || "";
      }
      
      // C. 斜め軸判定 (垂直・水平でない場合、または上記で見つからない場合)
      if (!bestAxis) {
        const midX = (n1.x + n2.x) / 2;
        const midY = (n1.y + n2.y) / 2;
        
        let candidates = [];
        dxfSkewedAxes.forEach(sa => {
          const dx = sa.p2.x - sa.p1.x;
          const dy = sa.p2.y - sa.p1.y;
          const len = Math.sqrt(dx*dx + dy*dy);
          if (len < 1) return;
          const dist = Math.abs(dy*midX - dx*midY + sa.p2.x*sa.p1.y - sa.p2.y*sa.p1.x) / len;
          if (dist < MATCH_TOL) {
            candidates.push({ dist, label: sa.label });
          }
        });
        
        if (candidates.length > 0) {
          candidates.sort((a, b) => a.dist - b.dist);
          bestAxis = candidates[0].label || "";
        }
      }
      
      // 反映 (強制更新、または未設定/不完全な場合)
      if (bestAxis && (force || !el.axisName || el.axisName.includes('?'))) {
        el.axisName = bestAxis;
        el.axis = bestAxis;
      }
    });
  });
}

/**
 * 全階層の柱IDを再構成 (互換性維持のためのエイリアス)
 */
export function rebuildAllColumnIds() {
  syncAllElementSymbols();
}
