// core/axis_manager.js - 通り芯の判定や名称取得ロジック
import { 
  floorData, currentFloor, FLOORS,
  dxfVAxes, dxfHAxes, dxfSkewedAxes, 
  getAffectedElementsCount, removeAxis, addAxis, 
  pushHistory, render, rebuildAllColumnIds 
} from '../foundation_cad.js';

/**
 * 柱が乗っている通りの名称を取得する
 */
export function getAxisName(colIndex, fd) {
  const col = fd.columns[colIndex];
  if (!col) return '—';
  const startNodeIdx = col.nodeIndex;
  const walls = fd.walls || [];
  const nodes = fd.nodes || [];
  const TOL_DEG = 2; // 許容角度誤差（度）

  // 指定ノードから接続されている壁一覧
  const getConnectedWalls = (nodeIdx) =>
    walls.map((w, wi) => ({
      wi, w,
      otherNode: w.n1 === nodeIdx ? w.n2 : (w.n2 === nodeIdx ? w.n1 : -1),
    })).filter(({ otherNode }) => otherNode >= 0);

  // 一直線上の壁を一方向にたどる
  const traceDir = (fromNode, curNode, visitedWalls) => {
    const fromN = nodes[fromNode];
    const curN = nodes[curNode];
    if (!fromN || !curN) return curNode;

    const inAngle = Math.atan2(curN.y - fromN.y, curN.x - fromN.x) * 180 / Math.PI;

    const candidates = getConnectedWalls(curNode).filter(({ wi }) => !visitedWalls.has(wi));
    for (const { wi, w, otherNode } of candidates) {
      const nextN = nodes[otherNode];
      if (!nextN) continue;
      const outAngle = Math.atan2(nextN.y - curN.y, nextN.x - curN.x) * 180 / Math.PI;
      let diff = Math.abs(inAngle - outAngle) % 360;
      if (diff > 180) diff = 360 - diff;
      if (diff < TOL_DEG) {
        visitedWalls.add(wi);
        return traceDir(curNode, otherNode, visitedWalls);
      }
    }
    return curNode;
  };

  const usedWalls = new Set();
  const axes = [];

  const connectedAtStart = getConnectedWalls(startNodeIdx);
  connectedAtStart.forEach(({ wi, w, otherNode }) => {
    if (usedWalls.has(wi)) return;
    usedWalls.add(wi);

    const fwdVisited = new Set([wi]);
    const endFwd = traceDir(startNodeIdx, otherNode, fwdVisited);

    const revVisited = new Set([wi]);
    const endRev = traceDir(otherNode, startNodeIdx, revVisited);

    fwdVisited.forEach(id => usedWalls.add(id));
    revVisited.forEach(id => usedWalls.add(id));

    const nameStart = nodes[endRev]?.id || `N${endRev}`;
    const nameEnd = nodes[endFwd]?.id || `N${endFwd}`;
    if (nameStart !== nameEnd) {
      axes.push(`${nameStart}〜${nameEnd}軸`);
    }
  });

  return axes.length > 0 ? axes.join(' / ') : '（通り未検出）';
}

/**
 * 通り芯の操作
 */
export const renameAxis = (dir, idx, newName) => {
    const axes = dir === 'v' ? dxfVAxes : (dir === 'h' ? dxfHAxes : dxfSkewedAxes);
    const axis = axes[idx];
    if (axis) {
        axis.label = newName;

        // 全要素の符号と通り芯名を一括同期
        import('./grid_manager.js').then(({ syncAllElementSymbols }) => {
            syncAllElementSymbols();
            if (typeof window.updatePropertyPanel === 'function') window.updatePropertyPanel();
            if (typeof window.updateDataList === 'function') window.updateDataList();
            pushHistory();
            render();
        });
    }
};

/**
 * 全符号と通り芯名の強制同期
 */
export const forceSyncAllSymbols = () => {
    import('./grid_manager.js').then(({ syncAllElementSymbols }) => {
        syncAllElementSymbols();
        alert("すべての柱符号および要素の通り芯名を現在のラベルに整合させました。");
        if (typeof window.updatePropertyPanel === 'function') window.updatePropertyPanel();
        if (typeof window.updateDataList === 'function') window.updateDataList();
        pushHistory();
        render();
    });
};



/**
 * 通り芯の削除
 */
export const deleteAxis = (dir, idx) => {
    const axes = dir === 'v' ? dxfVAxes : (dir === 'h' ? dxfHAxes : dxfSkewedAxes);
    const axis = axes[idx];
    const label = axis ? (axis.label || '無名') : '';
    
    const counts = getAffectedElementsCount(dir, idx);
    let details = '';
    if (counts && counts.nodes > 0) {
      const parts = [];
      if (counts.nodes) parts.push(`節点 ${counts.nodes}個`);
      if (counts.columns) parts.push(`柱 ${counts.columns}本`);
      if (counts.beams) parts.push(`梁 ${counts.beams}本`);
      if (counts.walls) parts.push(`壁 ${counts.walls}枚`);
      if (counts.slabs) parts.push(`スラブ ${counts.slabs}枚`);
      if (counts.diaphragms) parts.push(`構面 ${counts.diaphragms}枚`);
      details = `\nこの操作により、関連する以下の要素が削除されます：\n・${parts.join('\n・')}\n`;
    }

    const msg = `通り芯「${label}」を削除しますか？${details}\nこの操作は元に戻せません（履歴で Undo は可能です）。`;
    if (!confirm(msg)) return;

    removeAxis(dir, idx);
    rebuildAllColumnIds(); 
    
    if (typeof window.updatePropertyPanel === 'function') window.updatePropertyPanel();
    if (typeof window.updateDataList === 'function') window.updateDataList();
    pushHistory();
    render();
};

/**
 * 通り芯の追加（オフセット）
 */
export const addAxisNear = (dir, idx, dist) => {
    const d = parseFloat(dist);
    if (isNaN(d)) return;
    addAxis(dir, idx, d);
    
    if (typeof window.updatePropertyPanel === 'function') window.updatePropertyPanel();
    if (typeof window.updateDataList === 'function') window.updateDataList();
    pushHistory();
    render();
};

/**
 * 斜め軸回転モデル確認用のドロップダウンを更新する
 */
export const updateSkewedVizDropdown = function() {
    const select = document.getElementById('vis-skewed-axis-select');
    const container = document.getElementById('skewed-viz-container');
    const exteriorVizCb = document.getElementById('vis-exterior-viz');
    if (!select || !container) return;

    if (!exteriorVizCb?.checked) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';

    const currentVal = select.value;
    select.innerHTML = '<option value="">-- 全体(標準) --</option>';
    
    const skewedAxes = dxfSkewedAxes || [];
    skewedAxes.forEach(ax => {
        if (!ax.label) return;
        const opt = document.createElement('option');
        opt.value = ax.label;
        opt.textContent = `${ax.label} (斜め軸モデル)`;
        if (ax.label === currentVal) opt.selected = true;
        select.appendChild(opt);
    });
};

window.getAxisName = getAxisName;
window.renameAxis = renameAxis;
window.deleteAxis = deleteAxis;
window.addAxisNear = addAxisNear;
window.updateSkewedVizDropdown = updateSkewedVizDropdown;
