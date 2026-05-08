import { 
  drawDxf, drawSlabs, drawDiaphragms, drawBeams, 
  drawPreviews, drawWalls, drawNodes, drawColumns, drawGrid 
} from './rendering/diagram_renderer.js';

export const FLOORS = ['PH', 'R', '3', '2', '1'];

/** 1つ下の階キーを取得する。最下階の場合は null を返す。 */
export function getFloorBelow(floorKey) {
  const idx = FLOORS.indexOf(floorKey);
  if (idx !== -1 && idx < FLOORS.length - 1) {
    return FLOORS[idx + 1];
  }
  return null;
}

// 階別データストア
export const floorData = {};
FLOORS.forEach(f => {
  floorData[f] = {
    nodes: [],   // {id, x, y}
    columns: [], // {id, nodeIndex, force_long, ratio_b}
    beams: [],   // {id, n1, n2}
    slabs: [],   // {id, nodeIds:[], edgeConditions:[]}
    diaphragms: [], // {id, nodeIds:[]}
    walls: [], // {id, n1, n2, multiplier, axisName:""}
    anchorBolts: {}, // { axisName: { species: 'J1', m12: 0, m16: 0 } }
    floorHeight: 2730, // 基準階高 (mm)
    dxfLines: [], // その階固有の下絵線分
    dxfTexts: [], // その階固有の下絵テキスト
  };
});
// 1階（基礎）データにグローバル設定を保持
floorData['1'].globalDiaphragmSpecs = {
  'PH': { roof: 1.96, floor: 7.84 },
  'R':  { roof: 1.96, floor: 7.84 },
  '3':  { roof: 1.96, floor: 7.84 },
  '2':  { roof: 1.96, floor: 7.84 },
  '1':  { roof: 1.96, floor: 7.84 }
};
export let currentFloor = '1';
 
// DXF表示用（foundation_dxf.jsからセットされる）
export let dxfLines = [];
export let dxfTexts = [];
export let dxfLayerVisibility = {};
export let dxfVAxes = [];
export let dxfHAxes = [];
export let dxfSkewedAxes = []; // { p1: {x,y}, p2: {x,y}, label: "X1'" }
 
// グローバル登録（初期化時）
window.dxfLines = dxfLines;
window.dxfTexts = dxfTexts;
window.dxfVAxes = dxfVAxes;
window.dxfHAxes = dxfHAxes;
window.dxfSkewedAxes = dxfSkewedAxes;
window.dxfLayerVisibility = dxfLayerVisibility;

// Undo/Redo履歴
export let history = [];
export let historyIndex = -1;

// 採番用
export let nextId = { node: 1, beam: 1, slab: 1, diaphragm: 1, wall: 1 };

export function setFloor(f) {
  // --- 階層名の正規化 (F, 基礎, 0 などを 1階に集約) ---
  let target = f;
  if (f === 'F' || f === '基礎' || f === '0') target = '1';
  
  // 有効な階層かチェック
  if (!FLOORS.includes(target)) {
    console.warn(`[setFloor] Invalid floor: ${f}. Falling back to '1'.`);
    target = '1';
  }
  
  currentFloor = target;

  // 💡 修正：UI側の参照を最新のデータに向き直させる
  if (window.state) {
    window.state.floorData = floorData[currentFloor];
  }

  // --- [Task 1 修正点] デバッグ・ダッシュボード ---
  console.log(`%c--- Floor Data Dashboard (${target}F selected) ---`, "color: #3498db; font-weight: bold;");
  FLOORS.forEach(floor => {
    const d = floorData[floor];
    if (d) {
      const counts = [
        `柱:${d.columns.length}`,
        `梁:${d.beams.length}`,
        `壁:${d.walls.length}`,
        `盤:${d.slabs.length}`,
        `構:${d.diaphragms.length}`
      ].join(' / ');
      console.log(`[${floor}F] ${counts}`);
    }
  });
  // --- 修正点ここまで ---
}

export function getCurrentFloorData(floorKey = currentFloor) {
  // 💡 修正: 常にローカルの最新 floorData を優先し、window経由の参照は予備とする
  return floorData[floorKey] || (window.floorData && window.floorData[floorKey]);
}

// 履歴の記録
export function pushHistory() {
  // メモリ節約のため、非常に重い下書き線分データ(dxfLines, dxfTexts)を除外したスナップショットを作成
  const cleanFloorData = {};
  Object.keys(floorData).forEach(f => {
    const d = floorData[f];
    cleanFloorData[f] = {
      ...d,
      dxfLines: [], // 重いので履歴には含めない
      dxfTexts: []
    };
  });

  const snapshot = {
    floorData: cleanFloorData,
    nextId: nextId,
    dxfVAxes: [...dxfVAxes],
    dxfHAxes: [...dxfHAxes],
    dxfSkewedAxes: [...dxfSkewedAxes],
    dxfLayerVisibility: {...dxfLayerVisibility}
  };

  // JSON化してディープコピー（参照を切る）
  const snapshotStr = JSON.stringify(snapshot);

  console.log(`[History Internal] Snapshot generated. Size: ${(snapshotStr.length / 1024).toFixed(1)} KB. Grids in snapshot: V=${snapshot.dxfVAxes.length}`);

  if (historyIndex < history.length - 1) {
    history = history.slice(0, historyIndex + 1);
  }
  history.push(snapshotStr);
  
  if (history.length > 50) {
    history.shift();
  } else {
    historyIndex++;
  }
  console.log(`%c[History Save] Index: ${historyIndex}, Grids: V=${dxfVAxes.length} H=${dxfHAxes.length}`, "color: #3498db; font-weight: bold;");
}

export function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    const snapshot = JSON.parse(history[historyIndex]);
    
    console.log(`%c[History Undo] New Index: ${historyIndex}, Restoring Grids: V=${snapshot.dxfVAxes.length} H=${snapshot.dxfHAxes.length}`, "color: #e67e22; font-weight: bold;");

    // 下絵データ（dxfLines等）を現在の状態から退避
    const currentUnderlays = {};
    Object.keys(floorData).forEach(f => {
      currentUnderlays[f] = { lines: floorData[f].dxfLines, texts: floorData[f].dxfTexts };
    });

    Object.keys(snapshot.floorData).forEach(f => {
      floorData[f] = snapshot.floorData[f];
      floorData[f].dxfLines = currentUnderlays[f].lines;
      floorData[f].dxfTexts = currentUnderlays[f].texts;
    });

    Object.assign(nextId, snapshot.nextId);

    // 通り芯情報の復元
    if (snapshot.dxfVAxes) { dxfVAxes.length = 0; dxfVAxes.push(...snapshot.dxfVAxes); }
    if (snapshot.dxfHAxes) { dxfHAxes.length = 0; dxfHAxes.push(...snapshot.dxfHAxes); }
    if (snapshot.dxfSkewedAxes) { dxfSkewedAxes.length = 0; dxfSkewedAxes.push(...snapshot.dxfSkewedAxes); }
    if (snapshot.dxfLayerVisibility) {
        Object.keys(dxfLayerVisibility).forEach(k => delete dxfLayerVisibility[k]);
        Object.assign(dxfLayerVisibility, snapshot.dxfLayerVisibility);
    }
    
    if (window.state) {
      window.state.floorData = floorData[currentFloor];
    }
    return true;
  }
  return false;
}

export function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    const snapshot = JSON.parse(history[historyIndex]);
    
    const currentUnderlays = {};
    Object.keys(floorData).forEach(f => {
      currentUnderlays[f] = { lines: floorData[f].dxfLines, texts: floorData[f].dxfTexts };
    });

    Object.keys(snapshot.floorData).forEach(f => {
      floorData[f] = snapshot.floorData[f];
      floorData[f].dxfLines = currentUnderlays[f].lines;
      floorData[f].dxfTexts = currentUnderlays[f].texts;
    });

    Object.assign(nextId, snapshot.nextId);

    if (snapshot.dxfVAxes) { dxfVAxes.length = 0; dxfVAxes.push(...snapshot.dxfVAxes); }
    if (snapshot.dxfHAxes) { dxfHAxes.length = 0; dxfHAxes.push(...snapshot.dxfHAxes); }
    if (snapshot.dxfSkewedAxes) { dxfSkewedAxes.length = 0; dxfSkewedAxes.push(...snapshot.dxfSkewedAxes); }
    if (snapshot.dxfLayerVisibility) {
        Object.keys(dxfLayerVisibility).forEach(k => delete dxfLayerVisibility[k]);
        Object.assign(dxfLayerVisibility, snapshot.dxfLayerVisibility);
    }

    if (window.state) {
      window.state.floorData = floorData[currentFloor];
    }
    
    console.log(`[History] Redo executed. Index: ${historyIndex}`);
    return true;
  }
  return false;
}

// 初期履歴
pushHistory();

// DXF表示用（foundation_dxf.jsからセットされる）
export function updateNextId(val) {
  if (val && typeof val === 'object') {
    Object.assign(nextId, val);
  }
}

// DXF表示用データの更新（foundation_dxf.jsからセットされる）

export function setDxfData(lines, texts, layers, vA = [], hA = [], sA = []) {
  // 配列の参照を維持したまま中身を入れ替える
  dxfLines.length = 0; dxfLines.push(...lines);
  dxfTexts.length = 0; dxfTexts.push(...texts);
  
  Object.keys(dxfLayerVisibility).forEach(k => delete dxfLayerVisibility[k]);
  Object.assign(dxfLayerVisibility, layers);
  
  dxfVAxes.length = 0; dxfVAxes.push(...vA);
  dxfHAxes.length = 0; dxfHAxes.push(...hA);
  dxfSkewedAxes.length = 0; dxfSkewedAxes.push(...sA);

  // グローバルアクセスを保証
  window.dxfLines = dxfLines;
  window.dxfTexts = dxfTexts;
  window.dxfVAxes = dxfVAxes;
  window.dxfHAxes = dxfHAxes;
  window.dxfSkewedAxes = dxfSkewedAxes;
}
// 初期化時にもグローバル登録
// (先頭に移動済み)

export function findAxisNear(wcX, wcY, tolerance = 400) {
  let closest = null;
  let minDistance = tolerance;

  // 垂直軸
  for (let i = 0; i < dxfVAxes.length; i++) {
    const dist = Math.abs(dxfVAxes[i].x - wcX);
    if (dist < minDistance) {
      minDistance = dist;
      closest = { dir: 'v', index: i };
    }
  }
  // 水平軸
  for (let i = 0; i < dxfHAxes.length; i++) {
    const dist = Math.abs(dxfHAxes[i].y - wcY);
    if (dist < minDistance) {
      minDistance = dist;
      closest = { dir: 'h', index: i };
    }
  }
  // 斜め軸
  for (let i = 0; i < dxfSkewedAxes.length; i++) {
    const ax = dxfSkewedAxes[i];
    const dx = ax.p2.x - ax.p1.x, dy = ax.p2.y - ax.p1.y;
    const l2 = dx*dx + dy*dy;
    if (l2 < 1) continue;
    const dist = Math.abs(dy * wcX - dx * wcY + ax.p2.x * ax.p1.y - ax.p2.y * ax.p1.x) / Math.sqrt(l2);
    if (dist < minDistance) {
      minDistance = dist;
      closest = { dir: 's', index: i };
    }
  }
  return closest;
}

export function removeAxis(dir, idx) {
  let removedPos;
  // ノードのスナップ判定しきい値 (mm)
  const NODE_MATCH_TOL = 10; 

  if (dir === 'v') {
    removedPos = dxfVAxes[idx].x;
    dxfVAxes.splice(idx, 1);
  } else if (dir === 'h') {
    removedPos = dxfHAxes[idx].y;
    dxfHAxes.splice(idx, 1);
  } else if (dir === 's') {
    dxfSkewedAxes.splice(idx, 1);
    return; // 斜め軸の場合は連動削除なし
  }

  FLOORS.forEach(f => {
    let nds = floorData[f].nodes;
    for (let i = nds.length - 1; i >= 0; i--) {
      const n = nds[i];
      const isHit = (dir === 'v' && Math.abs(n.x - removedPos) < NODE_MATCH_TOL) || (dir === 'h' && Math.abs(n.y - removedPos) < NODE_MATCH_TOL);
      if (isHit) {
        // --- 節点削除とそれに依存する要素の削除 ---
        nds.splice(i, 1);
        for (let j = floorData[f].columns.length - 1; j >= 0; j--) {
          let c = floorData[f].columns[j];
          if (c.nodeIndex === i) floorData[f].columns.splice(j, 1);
          else if (c.nodeIndex > i) c.nodeIndex--;
        }
        for (let j = floorData[f].beams.length - 1; j >= 0; j--) {
          let b = floorData[f].beams[j];
          if (b.n1 === i || b.n2 === i) floorData[f].beams.splice(j, 1);
          else {
            if (b.n1 > i) b.n1--;
            if (b.n2 > i) b.n2--;
          }
        }
        for (let j = floorData[f].slabs.length - 1; j >= 0; j--) {
          let s = floorData[f].slabs[j];
          if (s.nodeIds.includes(i)) floorData[f].slabs.splice(j, 1);
          else {
            for (let k = 0; k < s.nodeIds.length; k++) {
              if (s.nodeIds[k] > i) s.nodeIds[k]--;
            }
          }
        }
        if (floorData[f].diaphragms) {
          for (let j = floorData[f].diaphragms.length - 1; j >= 0; j--) {
            let d = floorData[f].diaphragms[j];
            if (d.nodeIds.includes(i)) floorData[f].diaphragms.splice(j, 1);
            else {
              for (let k = 0; k < d.nodeIds.length; k++) {
                if (d.nodeIds[k] > i) d.nodeIds[k]--;
              }
            }
          }
        }
        if (floorData[f].walls) {
          for (let j = floorData[f].walls.length - 1; j >= 0; j--) {
            let w = floorData[f].walls[j];
            if (w.n1 === i || w.n2 === i) floorData[f].walls.splice(j, 1);
            else {
              if (w.n1 > i) w.n1--;
              if (w.n2 > i) w.n2--;
            }
          }
        }
      }
    }
  });
}

// --- ビューポート・描画ステート (オブジェクト化して同期を保証) ---
export let canvas = null;
export let ctx = null;
export let W = 800;
export let H = 600;

// 💡 修正：プリミティブ型ではなくオブジェクトとしてエクスポートすることで、全モジュールで参照を共有する
export const viewState = {
  scale: 1.0,
  panX: 0,
  panY: 0
};

export function initCanvas(el) { canvas = el; ctx = el.getContext('2d'); }
export function resizeCanvas(w, h) { W = w; H = h; if(canvas) { canvas.width = w; canvas.height = h; } }
export function setPanScale(px, py, s) { 
  viewState.panX = px; 
  viewState.panY = py; 
  viewState.scale = s; 
}

export function worldToScreen(wx, wy) {
  return { 
    x: wx * viewState.scale + viewState.panX, 
    y: -wy * viewState.scale + viewState.panY 
  };
}
export function screenToWorld(sx, sy) {
  return { 
    x: (sx - viewState.panX) / viewState.scale, 
    y: (viewState.panY - sy) / viewState.scale 
  };
}

export function panCanvas(dx, dy) {
  setPanScale(viewState.panX + dx, viewState.panY + dy, viewState.scale);
}

// Renderロジック
export function render(state) {
  const canvasEl = document.getElementById('cadCanvas');
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');
  if (!ctx) return;

  const { 
    currentTool, hoveredNode, selectedElement, selectedElements = [],
    beamStartNode, currentPolygon, mouseWorld,
    showGrid, showDxf, showLabels, viewMode
  } = state;

  // 複数選択ハイライト判定ヘルパー
  const isMultiSel = (type, idx) => {
    if (selectedElement && selectedElement.type === type && selectedElement.index === idx) return true;
    return selectedElements.some(el => el.type === type && el.index === idx);
  };

  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  const fd = floorData[currentFloor];

  const showCol   = document.getElementById('vis-col')   ? document.getElementById('vis-col').checked   : true;
  const showBeam  = document.getElementById('vis-beam')  ? document.getElementById('vis-beam').checked  : true;
  const showFbeam = document.getElementById('vis-fbeam') ? document.getElementById('vis-fbeam').checked : true;
  const showSlab  = document.getElementById('vis-slab')  ? document.getElementById('vis-slab').checked  : true;
  const showDiaph = document.getElementById('vis-diaph') ? document.getElementById('vis-diaph').checked : true;
  const showWall  = document.getElementById('vis-wall')  ? document.getElementById('vis-wall').checked  : true;

  const isSlabDivideMode = (currentTool === 'slabDivide');

  // ─── 下絵（DXF）の描画 ───
  if (showDxf) {
    // 階別下絵表示設定に基づいて、チェックされている全ての階の下絵を描画
    FLOORS.forEach(f => {
      const showUnderlay = document.getElementById(`vis-underlay-${f.toLowerCase()}`)?.checked;
      if (showUnderlay) {
        drawDxf(ctx, floorData[f], isSlabDivideMode);
      }
    });
  }

  // 分割された描画関数を順次実行
  drawSlabs(ctx, fd, isMultiSel, showSlab);
  drawDiaphragms(ctx, fd, isMultiSel, showDiaph, isSlabDivideMode);
  drawBeams(ctx, fd, isMultiSel, showBeam, showFbeam, viewMode);
  drawPreviews(ctx, state, fd); // ゴムバンド
  drawWalls(ctx, fd, selectedElement, showWall, isSlabDivideMode);
  drawNodes(ctx, fd, hoveredNode, isSlabDivideMode);
  drawColumns(ctx, fd, hoveredNode, selectedElement, showCol, isSlabDivideMode);
  drawGrid(ctx, selectedElement, showGrid);

  // ─── 分割モード用オーバーレイ描画 ───
  if (isSlabDivideMode) {
    drawSlabDivideOverlay();
  }
}

// スラブ亀甲分割モード用のオーバーレイ描画（今後、ガイド線などを記述）
export function drawSlabDivideOverlay() {
}
  

export function addAxis(dir, idx, dist) {
  const numericDist = Number(dist);
  if (!Number.isFinite(numericDist)) {
    throw new Error(`[addAxis] 無効な距離が指定されました: ${dist}`);
  }

  if (dir === 'v') {
     const axObj = dxfVAxes[idx];
     if (!axObj) return;
     const newX = Math.round(axObj.x + numericDist);
     const newL = axObj.label ? axObj.label + "'" : '';
     dxfVAxes.push({x: newX, lines: [], label: newL});
     FLOORS.forEach(f => {
       const fd = floorData[f];
       if (!fd || !fd.nodes) return;
       dxfHAxes.forEach(ha => {
          fd.nodes.push({ id: 'NEW', x: newX, y: ha.y });
       });
       dxfSkewedAxes.forEach(sa => {
         const dx = sa.p2.x - sa.p1.x, dy = sa.p2.y - sa.p1.y;
         if (Math.abs(dx) > 1e-6) {
           const t = (newX - sa.p1.x) / dx;
           const y = sa.p1.y + t * dy;
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
       if (!fd || !fd.nodes) return;
       dxfVAxes.forEach(va => {
          fd.nodes.push({ id: 'NEW', x: va.x, y: newY });
       });
       dxfSkewedAxes.forEach(sa => {
         const dx = sa.p2.x - sa.p1.x, dy = sa.p2.y - sa.p1.y;
         if (Math.abs(dy) > 1e-6) {
           const t = (newY - sa.p1.y) / dy;
           const x = sa.p1.x + t * dx;
           fd.nodes.push({ id: (sa.label && newL ? sa.label + newL : 'NEW'), x: x, y: newY });
         }
       });
     });
  }
}

export function generateNodesForSkewedAxis(ax) {
  const dx = ax.p2.x - ax.p1.x;
  const dy = ax.p2.y - ax.p1.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return;

  const newPts = [];

  if (Math.abs(dx) > 1e-6) {
    dxfVAxes.forEach(va => {
      const vX = va.x;
      const t = (vX - ax.p1.x) / dx;
      const y = ax.p1.y + t * dy;
      newPts.push({ x: vX, y: y, labelV: va.label });
    });
  }

  if (Math.abs(dy) > 1e-6) {
    dxfHAxes.forEach(ha => {
      const hY = ha.y;
      const t = (hY - ax.p1.y) / dy;
      const x = ax.p1.x + t * dx;
      newPts.push({ x: x, y: hY, labelH: ha.label });
    });
  }

  const TOL = 10;
  FLOORS.forEach(f => {
    const fd = floorData[f];
    if (!fd || !fd.nodes) return;
    newPts.forEach(pt => {
      const exists = fd.nodes.some(n => Math.hypot(n.x - pt.x, n.y - pt.y) < TOL);
      if (!exists) {
        let baseId = 'NEW';
        if (pt.labelV && ax.label) baseId = pt.labelV + ax.label;
        else if (pt.labelH && ax.label) baseId = ax.label + pt.labelH;
        fd.nodes.push({ id: baseId, x: pt.x, y: pt.y });
      }
    });
  });
}

/**
 * 通り芯削除時の影響要素（節点、柱、梁、壁、スラブ、構面）の個数を全階層から集計する
 */
export function getAffectedElementsCount(dir, idx) {
  const axes = dir === 'v' ? dxfVAxes : (dir === 'h' ? dxfHAxes : dxfSkewedAxes);
  const axis = axes[idx];
  if (!axis) return null;

  const counts = { nodes: 0, columns: 0, beams: 0, walls: 0, slabs: 0, diaphragms: 0 };
  if (dir === 's') return counts; // 斜め軸は現在連動削除なし

  const targetPos = dir === 'v' ? axis.x : axis.y;
  const NODE_MATCH_TOL = 10; // 通り芯から10mm以内を「その通りに乗っている」と判定

  FLOORS.forEach(f => {
    const fd = floorData[f];
    const nodesOnAxisIndices = [];
    fd.nodes.forEach((n, ni) => {
      const dist = dir === 'v' ? Math.abs(n.x - targetPos) : Math.abs(n.y - targetPos);
      if (dist < NODE_MATCH_TOL) {
        counts.nodes++;
        nodesOnAxisIndices.push(ni);
      }
    });

    if (nodesOnAxisIndices.length > 0) {
      const nodeSet = new Set(nodesOnAxisIndices);
      fd.columns.forEach(c => { if (nodeSet.has(c.nodeIndex)) counts.columns++; });
      fd.beams.forEach(b => { if (nodeSet.has(b.n1) || nodeSet.has(b.n2)) counts.beams++; });
      fd.walls.forEach(w => { if (nodeSet.has(w.n1) || nodeSet.has(w.n2)) counts.walls++; });
      fd.slabs.forEach(s => { if (s.nodeIds.some(nid => nodeSet.has(nid))) counts.slabs++; });
      if (fd.diaphragms) fd.diaphragms.forEach(d => { if (d.nodeIds.some(nid => nodeSet.has(nid))) counts.diaphragms++; });
    }
  });
  return counts;
}

export function rebuildNodeIds() {
  const GRID_ID_TOL = 20; // 許容誤差を20mmに拡大

  FLOORS.forEach(f => {
    if (!floorData[f] || !floorData[f].nodes) return;
    const nds = floorData[f].nodes;
    nds.forEach(n => {
      // 最も近い垂直軸を探す
      let bestVa = null, minVaD = GRID_ID_TOL;
      dxfVAxes.forEach(a => {
        const d = Math.abs(a.x - n.x);
        if (d < minVaD) { minVaD = d; bestVa = a; }
      });

      // 最も近い水平軸を探す
      let bestHa = null, minHaD = GRID_ID_TOL;
      dxfHAxes.forEach(a => {
        const d = Math.abs(a.y - n.y);
        if (d < minHaD) { minHaD = d; bestHa = a; }
      });

      if (bestVa && bestHa) {
        const baseId = (bestVa.label && bestHa.label) ? (bestVa.label + bestHa.label) : '';
        // 以前の符号が何であれ、現在のグリッドから再生成されたものをセット
        n.id = baseId || n.id; 
      } else {
        // 交点から外れた場合は、古いグリッド由来のIDは消去する（必要なら）
        // ただし ID がユーザー設定値の可能性もあるため、完全に消すかは要検討
        // ここでは、通り芯名の不整合を防ぐため、グリッド由来と思われるものは更新対象とする
      }
    });
  });
}

/**
 * 全階層の柱IDを、現在の通り芯設定に基づいて一括更新する
 */
export function rebuildAllColumnIds() {
  rebuildNodeIds();
  FLOORS.forEach(f => {
    const fd = floorData[f];
    if (!fd || !fd.columns || !fd.nodes) return;
    fd.columns.forEach(c => {
      const node = fd.nodes[c.nodeIndex];
      if (node && node.id) {
        c.id = node.id.replace(/_[0-9]+$/, "");
      }
    });
  });
}

export function findSnapNode(wx, wy, tolWorld = null) {
  const SNAP_RADIUS_WORLD = tolWorld !== null ? tolWorld : (10 / viewState.scale);
  const fd = floorData[currentFloor];
  if (!fd || !fd.nodes) return null;
  let best = null, bestD = SNAP_RADIUS_WORLD;
  fd.nodes.forEach((n, i) => {
    const d = Math.hypot(n.x - wx, n.y - wy);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

export function findBeamNear(wx, wy) {
  const fd = floorData[currentFloor];
  if (!fd || !fd.beams || !fd.nodes) return null;
  const TOL_WORLD = 10 / viewState.scale; // 画面上の10px相当
  const showBeam = document.getElementById('vis-beam') ? document.getElementById('vis-beam').checked : true;
  const showFbeam = document.getElementById('vis-fbeam') ? document.getElementById('vis-fbeam').checked : true;

  // 1. 通常の梁リスト (beams)
  for (let i = 0; i < fd.beams.length; i++) {
    const b = fd.beams[i];
    const isFbeam = (b.type === 'foundation_beam' || b.tributaryWidth !== undefined || b.groundPressure !== undefined);
    if (isFbeam && !showFbeam) continue;
    if (!isFbeam && !showBeam) continue;

    const n1 = fd.nodes[b.n1];
    const n2 = fd.nodes[b.n2];
    if (!n1 || !n2) continue;
    const d = distToSegment(wx, wy, n1.x, n1.y, n2.x, n2.y);
    if (d < TOL_WORLD) return { type: 'beam', index: i };
  }

  // 2. 外周自動基礎梁 (perimeterBeams)
  if (showFbeam && fd.perimeterBeams) {
    for (let i = 0; i < fd.perimeterBeams.length; i++) {
        const b = fd.perimeterBeams[i];
        const n1 = fd.nodes[b.n1];
        const n2 = fd.nodes[b.n2];
        if (!n1 || !n2) continue;
        const d = distToSegment(wx, wy, n1.x, n1.y, n2.x, n2.y);
        if (d < TOL_WORLD) return { type: 'perimeterBeam', index: i };
    }
  }

  return null;
}

export function findWallNear(wx, wy) {
  const fd = floorData[currentFloor];
  if (!fd || !fd.walls || !fd.nodes) return null;
  const TOL_WORLD = 10 / viewState.scale; // 8px から 10px に緩和
  const showWall = document.getElementById('vis-wall') ? document.getElementById('vis-wall').checked : true;
  if (!showWall || !fd.walls) return null;

  for (let i = 0; i < fd.walls.length; i++) {
    const w = fd.walls[i];
    const n1 = fd.nodes[w.n1];
    const n2 = fd.nodes[w.n2];
    if (!n1 || !n2) continue;
    const d = distToSegment(wx, wy, n1.x, n1.y, n2.x, n2.y);
    if (d < TOL_WORLD) return i;
  }
  return null;
}

export function findSlabAt(wx, wy) {
  const showSlab = document.getElementById('vis-slab') ? document.getElementById('vis-slab').checked : true;
  if (!showSlab) return null;

  const fd = floorData[currentFloor];
  if (!fd || !fd.slabs || !fd.nodes) return null;
  for (let i = fd.slabs.length - 1; i >= 0; i--) {
    const sl = fd.slabs[i];
    const pts = sl.nodeIds.map(ni => fd.nodes[ni]).filter(Boolean);
    if (pts.length < 3) continue;
    if (pointInPolygon(wx, wy, pts)) return i;
  }
  return null;
}

export function findDiaphragmAt(wx, wy) {
  const showDiaph = document.getElementById('vis-diaph') ? document.getElementById('vis-diaph').checked : true;
  if (!showDiaph) return null;

  const fd = floorData[currentFloor];
  if (!fd || !fd.diaphragms || !fd.nodes) return null;
  for (let i = fd.diaphragms.length - 1; i >= 0; i--) {
    const dia = fd.diaphragms[i];
    const pts = dia.nodeIds.map(ni => fd.nodes[ni]).filter(Boolean);
    if (pts.length < 3) continue;
    if (pointInPolygon(wx, wy, pts)) return i;
  }
}

// --- 幾何計算ユーティリティ ---

/**
 * 点 (px, py) から線分 (ax, ay)-(bx, by) への最短距離を返す
 */
export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * 点 (x, y) が多角形 pts 内にあるか判定する (Winding Number / Ray Casting)
 */
export function pointInPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * 点から線（無限直線）への最短距離
 */
export function distToBeamLine(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    // 💡 distToSegment との違い: t を 0〜1 にクランプしない
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function repairFoundationData(data) {
  if (!data) return;

  // 1階（基礎）にグローバル設定がない場合は初期化
  if (data['1'] && !data['1'].globalDiaphragmSpecs) {
    data['1'].globalDiaphragmSpecs = {
      'PH': { roof: 1.96, floor: 7.84 },
      'R':  { roof: 1.96, floor: 7.84 },
      '3':  { roof: 1.96, floor: 7.84 },
      '2':  { roof: 1.96, floor: 7.84 },
      '1':  { roof: 1.96, floor: 7.84 }
    };
  }

  Object.keys(data).forEach(f => {
    const fd = data[f];
    if (!fd) return;

    // 💡 修正: 各ノードに自身のインデックスを保持させ、ID検索でも救済可能にする
    if (fd.nodes) {
      fd.nodes.forEach((n, i) => {
        if (n && n.index === undefined) n.index = i;
      });
    }

    // 構面の補完
    if (fd.diaphragms) {
      fd.diaphragms.forEach((d, idx) => {
        // subTypeがない場合は delta_qa から推測するかデフォルト 'roof' を割り当て
        if (!d.subType) {
          if (d.delta_qa > 5.0) d.subType = 'floor';
          else d.subType = 'roof';
        }
        if (!d.id) d.id = `D-${idx + 1}`;
        if (!d.nodeIds) d.nodeIds = [];
      });
    }

    if (fd.walls) {
      fd.walls.forEach(w => {
        if (w.multiplier === undefined) w.multiplier = 1.0;
        if (w.axisName === undefined) w.axisName = "";
        if (w.isExterior === undefined) w.isExterior = false;
        // 💡 showReport は使用しなくなったため削除または無視（ここでは初期化しないことでクリーンアップ）
      });
    }
    if (fd.columns) {
      fd.columns.forEach(c => {
        if (c.nw === undefined) c.nw = 0;
      });
    }
    if (!fd.floorHeight) fd.floorHeight = 2730;
    if (!fd.dxfLines) fd.dxfLines = [];
    if (!fd.dxfTexts) fd.dxfTexts = [];
  });
}

/**
 * ノードIDからノードオブジェクトを取得する (インデックス不一致対策)
 */
export function findNodeById(nodes, id) {
  if (!nodes || id === undefined || id === null) return null;
  // 配列インデックスとして試行
  if (nodes[id] && nodes[id].id == id) return nodes[id];
  // 全検索
  return nodes.find(n => n && n.id == id);
}

/**
 * 指定座標の最寄りの通り芯名を探す
 */
export function findNearestAxisName(x, y, tolerance = 50) {
  let bestName = "";
  let bestDist = tolerance;

  // 垂直軸 (X座標固定)
  dxfVAxes.forEach(a => {
    const d = Math.abs(x - a.x);
    if (d < bestDist) {
      bestDist = d;
      bestName = a.label;
    }
  });

  // 水平軸 (Y座標固定)
  dxfHAxes.forEach(a => {
    const d = Math.abs(y - a.y);
    if (d < bestDist) {
      bestDist = d;
      bestName = a.label;
    }
  });

  // 斜め軸
  dxfSkewedAxes.forEach(a => {
    const d = distToBeamLine(x, y, a.p1.x, a.p1.y, a.p2.x, a.p2.y);
    if (d < bestDist) {
      bestDist = d;
      bestName = a.label;
    }
  });

  return bestName;
}
