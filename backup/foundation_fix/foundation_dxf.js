import { floorData, FLOORS, nextId, pushHistory, setDxfData } from './foundation_cad.js';

export function parseDxfFile(file, keepExisting, callback) {
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parser = new window.DxfParser();
      const dxf = parser.parseSync(ev.target.result);
      processDxfData(dxf, keepExisting);
      callback(null, dxf);
    } catch (err) {
      console.error(err);
      callback(err, null);
    }
  };
  reader.readAsText(file, 'utf-8');
}

function processDxfData(dxf, keepExisting) {
  let lines = [];
  let texts = [];
  let pointsAndCircles = [];
  let foundLayers = {};

  // エンティティのパース（安全処理の徹底）
  dxf.entities.forEach(ent => {
    if (!ent.layer) return;
    const layer = ent.layer;
    foundLayers[layer] = true;

    if (ent.type === 'LINE') {
      if (!ent.vertices || ent.vertices.length < 2) return;
      if (ent.vertices[0].x === undefined || ent.vertices[1].x === undefined) return;
      lines.push({
        type: ent.type,
        x1: ent.vertices[0].x, y1: ent.vertices[0].y,
        x2: ent.vertices[1].x, y2: ent.vertices[1].y,
        layer: layer
      });
    } else if (ent.type === 'TEXT' || ent.type === 'MTEXT') {
      // 文字列の取得も text.text || text.string || "" のように確実に行う
      const textStr = ent.text || ent.string || ent.value || '';
      if (!textStr) return;
      // 文字の座標を text.startPoint と text.position の両方でフォールバック
      const pos = ent.startPoint || ent.position || ent.insertionPoint;
      if (!pos || pos.x === undefined || pos.y === undefined) return;
      texts.push({
        x: pos.x, y: pos.y,
        text: textStr.toString().trim(),
        layer: layer
      });
    } else if (ent.type === 'POINT') {
      if (!ent.position || ent.position.x === undefined || ent.position.y === undefined) return;
      pointsAndCircles.push({
        x: ent.position.x, y: ent.position.y,
        layer: layer
      });
    } else if (ent.type === 'CIRCLE') {
      if (!ent.center || ent.center.x === undefined || ent.center.y === undefined) return;
      pointsAndCircles.push({
        x: ent.center.x, y: ent.center.y,
        layer: layer
      });
    }
  });

  // レイヤの可視性初期化（すべて表示）
  const layerVisibility = {};
  Object.keys(foundLayers).forEach(l => layerVisibility[l] = true);

  // To be passed later with nodes

  // --- 1. 厳格な交点算出 (GRID/GLID) ---
  const gridLines = lines.filter(l => l.layer.toUpperCase().includes('GRID') || l.layer.toUpperCase().includes('GLID'));
  const gridNodes = computeGridIntersections(gridLines, texts);

  // --- 2 & 3. 柱の自動取り込み (ポイントが交点と1mm以内で一致するか) ---
  const oldFloorData = JSON.parse(JSON.stringify(floorData));
  
  // 各階データリセット・スマートリロード
  FLOORS.forEach(f => {
    const oldNodes = oldFloorData[f].nodes || [];
    const newNodes = gridNodes.nodes;
    floorData[f].nodes = JSON.parse(JSON.stringify(gridNodes.nodes));

    if (keepExisting) {
      const idMap = Array(oldNodes.length).fill(-1);
      oldNodes.forEach((onode, oi) => {
         const ni = newNodes.findIndex(nn => Math.hypot(nn.x - onode.x, nn.y - onode.y) < 5);
         idMap[oi] = ni;
      });

      floorData[f].columns = (oldFloorData[f].columns || []).map(c => {
         c.nodeIndex = idMap[c.nodeIndex];
         return c;
      }).filter(c => c.nodeIndex !== -1);

      floorData[f].beams = (oldFloorData[f].beams || []).map(b => {
         b.n1 = idMap[b.n1];
         b.n2 = idMap[b.n2];
         return b;
      }).filter(b => b.n1 !== -1 && b.n2 !== -1);

      floorData[f].slabs = (oldFloorData[f].slabs || []).map(s => {
         s.nodeIds = s.nodeIds.map(oi => idMap[oi]).filter(ni => ni !== -1);
         return s;
      }).filter(s => s.nodeIds.length >= 3);

      // ✅ 壁の node index も再マッピング（ここが澏れていたため壁が消失していた）
      floorData[f].walls = (oldFloorData[f].walls || []).map(w => {
         const n1new = w.n1 !== undefined ? idMap[w.n1] : -1;
         const n2new = w.n2 !== undefined ? idMap[w.n2] : -1;
         w.n1 = n1new;
         w.n2 = n2new;
         return w;
      }).filter(w => w.n1 !== -1 && w.n2 !== -1);

    } else {
      floorData[f].columns = [];
      floorData[f].beams = [];
      floorData[f].slabs = [];
      floorData[f].walls = []; // ⚠ walls も初期化（澏れていた）
    }
  });

  if (!keepExisting) {
    nextId.node = 1;
    nextId.beam = 1;
    nextId.slab = 1;
  }

  // フロア別にレイヤ名を判定 (例: COL_1F, 1F_COL, 基礎_柱, F_COL等)
  pointsAndCircles.forEach(pt => {
    const lName = pt.layer.toUpperCase();
    let targetFloor = null;
    
    // 簡易判定
    if (lName.includes('PH')) targetFloor = 'PH';
    else if (lName.includes('R')) targetFloor = 'R';
    else if (lName.includes('3F')) targetFloor = '3';
    else if (lName.includes('2F')) targetFloor = '2';
    else if (lName.includes('1F')) targetFloor = '1';
    else if (lName.includes('F') || lName.includes('基礎')) targetFloor = 'F';

    if (!targetFloor || !lName.includes('COL')) return; // COLレイヤまたは柱レイヤのみ対象と想定

    // 柱を最も近いグリッド交点(node)にスナップさせる (TOL: 300mm程度)
    let bestDist = 300;
    let bestMatchIndex = -1;
    gridNodes.nodes.forEach((gn, i) => {
      const d = Math.hypot(gn.x - pt.x, gn.y - pt.y);
      if (d < bestDist) {
        bestDist = d;
        bestMatchIndex = i;
      }
    });

    if (bestMatchIndex !== -1) {
      // 交点のIDをそのまま柱のIDとして採用 (C1のような連番は廃止)
      const hitNode = gridNodes.nodes[bestMatchIndex];
      const pureId = (hitNode.id || "").replace(/_\d+$/, "");

      const exists = floorData[targetFloor].columns.some(c => c.nodeIndex === bestMatchIndex);
      if (!exists) {
        floorData[targetFloor].columns.push({
          id: pureId,
          nodeIndex: bestMatchIndex,
          longTermAxial: 0,
          shortTermAxial: 0
        });
      }
    }
  });

  setDxfData(lines, texts, layerVisibility, gridNodes.vAxes, gridNodes.hAxes);
  pushHistory();
  return Object.keys(foundLayers);
}

function computeGridIntersections(gridLines, texts) {
  const hLines = [];
  const vLines = [];
  gridLines.forEach(l => {
    const dx = Math.abs(l.x2 - l.x1);
    const dy = Math.abs(l.y2 - l.y1);
    if (dx > dy * 3) hLines.push(l);
    else if (dy > dx * 3) vLines.push(l);
  });

  const gridTexts = texts.filter(t => t.layer.toUpperCase().includes('GRID') || t.layer.toUpperCase().includes('GLID'));
  const allTexts = gridTexts.length > 0 ? gridTexts : texts;

  // Y軸ベース（垂直軸）のグループ化
  const vAxes = [];
  let unknownVXCount = 1;
  vLines.forEach(v => {
    let x = (v.x1 + v.x2) / 2;
    let axis = vAxes.find(a => Math.abs(a.x - x) < 10); // 10mm以内で厳密に統合
    if (!axis) {
      axis = { x: x, lines: [] };
      vAxes.push(axis);
    }
    axis.lines.push(v);
  });
  vAxes.forEach(a => {
    let bestText = '', bestDist = 1500;
    allTexts.forEach(t => {
      const dx = Math.abs(t.x - a.x);
      if (dx < bestDist) {
        bestDist = dx;
        bestText = t.text.replace(/[{}\\lL]/g, '').trim();
      }
    });
    a.label = bestText || ('無名X' + unknownVXCount++);
  });

  // X軸ベース（水平軸）のグループ化
  const hAxes = [];
  let unknownHYCount = 1;
  hLines.forEach(h => {
    let y = (h.y1 + h.y2) / 2;
    let axis = hAxes.find(a => Math.abs(a.y - y) < 10); // 10mm以内で厳密に統合
    if (!axis) {
      axis = { y: y, lines: [] };
      hAxes.push(axis);
    }
    axis.lines.push(h);
  });
  hAxes.forEach(a => {
    let bestText = '', bestDist = 1500;
    allTexts.forEach(t => {
      const dy = Math.abs(t.y - a.y);
      if (dy < bestDist) {
        bestDist = dy;
        bestText = t.text.replace(/[{}\\lL]/g, '').trim();
      }
    });
    a.label = bestText || ('無名Y' + unknownHYCount++);
  });

  const nodes = [];
  let nCounter = 1;
  vAxes.forEach(va => {
    hAxes.forEach(ha => {
      let sumX = 0, sumY = 0, count = 0;
      va.lines.forEach(vl => {
        ha.lines.forEach(hl => {
          const pt = lineIntersect(vl, hl);
          if (pt) { sumX += pt.x; sumY += pt.y; count++; }
        });
      });
      if (count > 0) {
        const pt = { x: sumX / count, y: sumY / count };
        const baseId = (va.label && ha.label) ? (va.label + ha.label) : ('N' + nCounter++);
        
        // 枝番（_1等）の完全禁止: すでに同名のIDが存在しても純粋な名前のまま登録する
        // 許容誤差(10mm)でマージ済みのため、通常は重複しない前提
        nodes.push({ id: baseId, x: pt.x, y: pt.y });
      }
    });
  });

  return {nodes, vAxes, hAxes};
}

function lineIntersect(l1, l2) {
  const x1=l1.x1, y1=l1.y1, x2=l1.x2, y2=l1.y2;
  const x3=l2.x1, y3=l2.y1, x4=l2.x2, y4=l2.y2;
  const denom = (x1-x2)*(y3-y4) - (y1-y2)*(x3-x4);
  // ゼロ除算等の数理的安全処理
  const EPSILON = 1e-6;
  if (Math.abs(denom) < EPSILON) return null;
  const t = ((x1-x3)*(y3-y4) - (y1-y3)*(x3-x4)) / denom;
  const u = -((x1-x2)*(y1-y3) - (y1-y2)*(x1-x3)) / denom;
  // check if strictly intersect within line segments extended slightly
  if (t >= -0.05 && t <= 1.05 && u >= -0.05 && u <= 1.05) {
    return { x: x1 + t*(x2-x1), y: y1 + t*(y2-y1) };
  }
  return null;
}
