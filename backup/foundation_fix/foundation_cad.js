export const FLOORS = ['PH', 'R', '3', '2', '1'];

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
  };
});
export let currentFloor = '1';

// Undo/Redo履歴
export let history = [];
export let historyIndex = -1;

// 採番用
export let nextId = { node: 1, beam: 1, slab: 1, diaphragm: 1, wall: 1 };

export function setFloor(f) {
  currentFloor = f;

  // --- [Task 1 修正点] デバッグ・ダッシュボード ---
  console.log(`%c--- Floor Data Dashboard (${f}F selected) ---`, "color: #3498db; font-weight: bold;");
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

// 履歴の記録
export function pushHistory() {
  // 💡 修正：floorData だけでなく nextId（採番状態）もスナップショットに含める
  const snapshot = JSON.parse(JSON.stringify({
    floorData: floorData,
    nextId: nextId
  }));

  if (historyIndex < history.length - 1) {
    history = history.slice(0, historyIndex + 1);
  }
  history.push(snapshot);
  
  // 最大50件保持
  if (history.length > 50) {
    history.shift();
  } else {
    historyIndex++;
  }
  console.log(`[History] Pushed state. Index: ${historyIndex}, Length: ${history.length}`);
}

export function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    const snapshot = JSON.parse(JSON.stringify(history[historyIndex]));
    
    // 💡 修正：各階のデータ構造全体を確実に復元
    Object.keys(snapshot.floorData).forEach(f => {
      // 既存の floorData[f] の中身を一括置換（Object.assign より確実に参照を切り替える）
      floorData[f] = snapshot.floorData[f];
    });
    // nextId も同期
    Object.assign(nextId, snapshot.nextId);
    
    console.log(`[History] Undo executed. New Index: ${historyIndex}`, floorData[currentFloor]);
    return true;
  }
  console.warn("[History] Undo failed: at the beginning of history.");
  return false;
}

export function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    const snapshot = JSON.parse(JSON.stringify(history[historyIndex]));
    
    Object.keys(snapshot.floorData).forEach(f => {
      floorData[f] = snapshot.floorData[f];
    });
    Object.assign(nextId, snapshot.nextId);
    
    console.log(`[History] Redo executed. New Index: ${historyIndex}`);
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

// DXF表示用（foundation_dxf.jsからセットされる）
export let dxfLines = [];
export let dxfTexts = [];
export let dxfLayerVisibility = {};
export let dxfVAxes = [];
export let dxfHAxes = [];
export let dxfSkewedAxes = []; // { p1: {x,y}, p2: {x,y}, label: "X1'" }

export function setDxfData(lines, texts, layers, vA = [], hA = [], sA = []) {
  dxfLines = lines;
  dxfTexts = texts;
  dxfLayerVisibility = layers;
  dxfVAxes = vA;
  dxfHAxes = hA;
  dxfSkewedAxes = sA;
  // グローバルアクセスを保証（循環参照対策）
  window.dxfVAxes = dxfVAxes;
  window.dxfHAxes = dxfHAxes;
  window.dxfSkewedAxes = dxfSkewedAxes;
}
// 初期化時にもグローバル登録
window.dxfVAxes = dxfVAxes;
window.dxfHAxes = dxfHAxes;
window.dxfSkewedAxes = dxfSkewedAxes;

export function findAxisNear(wcX, wcY, tolerance = 150) {
  // 垂直軸
  for (let i = 0; i < dxfVAxes.length; i++) {
    if (Math.abs(dxfVAxes[i].x - wcX) < tolerance) return { dir: 'v', index: i };
  }
  // 水平軸
  for (let i = 0; i < dxfHAxes.length; i++) {
    if (Math.abs(dxfHAxes[i].y - wcY) < tolerance) return { dir: 'h', index: i };
  }
  // 斜め軸
  for (let i = 0; i < dxfSkewedAxes.length; i++) {
    const ax = dxfSkewedAxes[i];
    const dx = ax.p2.x - ax.p1.x, dy = ax.p2.y - ax.p1.y;
    const l2 = dx*dx + dy*dy;
    if (l2 < 1) continue;
    // 無限直線としての距離判定
    const dist = Math.abs(dy * wcX - dx * wcY + ax.p2.x * ax.p1.y - ax.p2.y * ax.p1.x) / Math.sqrt(l2);
    if (dist < tolerance) return { dir: 's', index: i };
  }
  return null;
}

export function removeAxis(dir, idx) {
  let removedPos;
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
      if ((dir === 'v' && Math.abs(n.x - removedPos) < 5) || (dir === 'h' && Math.abs(n.y - removedPos) < 5)) {
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

// --- ビューポート・描画ステート (定義元として復元) ---
export let canvas = null;
export let ctx = null;
export let W = 800;
export let H = 600;
export let scale = 1.0;
export let panX = 0;
export let panY = 0;

export function initCanvas(el) { canvas = el; ctx = el.getContext('2d'); }
export function resizeCanvas(w, h) { W = w; H = h; if(canvas) { canvas.width = w; canvas.height = h; } }
export function setPanScale(px, py, s) { panX = px; panY = py; scale = s; }

export function worldToScreen(wx, wy) {
  return { x: wx * scale + panX, y: -wy * scale + panY };
}
export function screenToWorld(sx, sy) {
  return { x: (sx - panX) / scale, y: (panY - sy) / scale };
}

export function panCanvas(dx, dy) {
  setPanScale(panX + dx, panY + dy, scale);
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

  // 分割された描画関数を順次実行
  drawDxf(ctx, isSlabDivideMode);
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
  if (dir === 'v') {
     const axObj = dxfVAxes[idx];
     const newX = axObj.x + dist;
     const newL = axObj.label ? axObj.label + "'" : '';
     dxfVAxes.push({x: newX, lines: [], label: newL});
     FLOORS.forEach(f => {
       dxfHAxes.forEach(ha => {
          floorData[f].nodes.push({ id: 'NEW', x: newX, y: ha.y });
       });
     });
  } else {
     const axObj = dxfHAxes[idx];
     const newY = axObj.y + dist;
     const newL = axObj.label ? axObj.label + "'" : '';
     dxfHAxes.push({y: newY, lines: [], label: newL});
     FLOORS.forEach(f => {
       dxfVAxes.forEach(va => {
          floorData[f].nodes.push({ id: 'NEW', x: va.x, y: newY });
       });
     });
  }
}

export function rebuildNodeIds() {
  FLOORS.forEach(f => {
    const nds = floorData[f].nodes;
    nds.forEach(n => {
      const va = dxfVAxes.find(a => Math.abs(a.x - n.x) < 5);
      const ha = dxfHAxes.find(a => Math.abs(a.y - n.y) < 5);
      if (va && ha) {
        const baseId = (va.label && ha.label) ? (va.label + ha.label) : '';
        if (!baseId) return; // keep current if unknown
        // 枝番（_1等）の完全禁止
        n.id = baseId;
      }
    });
  });
}

export function findSnapNode(wx, wy, tolWorld = null) {
  const SNAP_RADIUS_WORLD = tolWorld !== null ? tolWorld : (10 / scale);
  const fd = floorData[currentFloor];
  let best = null, bestD = SNAP_RADIUS_WORLD;
  fd.nodes.forEach((n, i) => {
    const d = Math.hypot(n.x - wx, n.y - wy);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

export function findBeamNear(wx, wy) {
  const fd = floorData[currentFloor];
  const TOL_WORLD = 10 / scale; // 画面上の10px相当
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
  const TOL_WORLD = 10 / scale; // 8px から 10px に緩和
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
  if (!fd.diaphragms) return null;
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
