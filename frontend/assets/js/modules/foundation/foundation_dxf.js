import { 
  floorData, FLOORS, nextId, pushHistory, setDxfData, 
  findNearestAxisName, currentFloor 
} from './foundation_cad.js';

export function parseDxfFile(file, keepExisting, callback, symbolMap = null) {
  console.log(`[Step DXF-1] Starting parseDxfFile for ${file.name} (Size: ${file.size} bytes)`);
  const reader = new FileReader();
  reader.onload = ev => {
    console.log("[Step DXF-2] FileReader finished loading.");
    try {
      const parser = new window.DxfParser();
      console.log("[Step DXF-3] Starting dxf-parser parseSync...");
      const dxf = parser.parseSync(ev.target.result);
      console.log(`[Step DXF-4] parseSync finished. Found ${dxf.entities ? dxf.entities.length : 0} total entities.`);
      processDxfData(dxf, keepExisting, symbolMap);
      console.log("[Step DXF-5] processDxfData finished.");
      callback(null, dxf);
    } catch (err) {
      console.error("[Step DXF-ERROR] Critical error during DXF parse process:", err);
      callback(err, null);
    }
  };
  reader.readAsText(file, 'utf-8');
}

/**
 * DXFから耐力壁レイヤにあるユニークな記号を抽出する (現在は使用停止中)
 */
export function extractDxfSymbols(file, callback) {
    console.log(`[Step Symbol-1] Starting extractDxfSymbols for ${file.name}`);
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const parser = new window.DxfParser();
            const dxf = parser.parseSync(ev.target.result);
            const symbols = new Set();
            const scanForSymbols = (entities, parentLayer = null) => {
                if (!entities) return;
                entities.forEach(ent => {
                    const layer = (ent.layer === '0' && parentLayer) ? parentLayer : (ent.layer || "0");
                    if (ent.type === 'TEXT' || ent.type === 'MTEXT') {
                        const ln = layer.toUpperCase();
                        if (ln.includes('WALL_BRACED') || ln.includes('耐力壁') || ln.includes('壁記号')) {
                            const val = (ent.text || "").trim();
                            if (val) symbols.add(val);
                        }
                    } else if (ent.type === 'INSERT') {
                        if (ent.entities) scanForSymbols(ent.entities, layer);
                        else if (dxf.blocks && dxf.blocks[ent.name]) scanForSymbols(dxf.blocks[ent.name].entities, layer);
                    }
                });
            };
            scanForSymbols(dxf.entities);
            callback(null, Array.from(symbols).sort());
        } catch (err) { callback(err, null); }
    };
    reader.readAsText(file, 'utf-8');
}

function processDxfData(dxf, keepExisting, symbolMap = null) {
  let lines = [];
  let texts = [];
  let pointsAndCircles = [];
  let foundLayers = {};

  function scanEntities(entities, parentLayer = null) {
    if (!entities) return;
    entities.forEach(ent => {
      const layer = (ent.layer === '0' && parentLayer) ? parentLayer : (ent.layer || "0");
      foundLayers[layer] = true;

      if (ent.type === 'LINE' || ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
        const pts = ent.vertices || (ent.start && ent.end ? [ent.start, ent.end] : null);
        if (pts && pts.length >= 2) {
          for (let i = 0; i < pts.length - 1; i++) {
            if (pts[i].x !== undefined && pts[i+1].x !== undefined) {
              lines.push({ type: 'LINE', x1: pts[i].x, y1: pts[i].y, x2: pts[i+1].x, y2: pts[i+1].y, layer });
            }
          }
        }
      } else if (ent.type === 'TEXT' || ent.type === 'MTEXT') {
        const textStr = ent.text || ent.string || ent.value || '';
        const pos = ent.startPoint || ent.position || ent.insertionPoint;
        if (textStr !== undefined && pos) texts.push({ x: pos.x, y: pos.y, text: textStr.toString().trim(), layer });
      } else if (ent.type === 'POINT' || ent.type === 'CIRCLE' || ent.type === 'INSERT') {
        const pos = ent.position || ent.center || ent.insertionPoint;
        if (pos) pointsAndCircles.push({ x: pos.x, y: pos.y, layer });
        if (ent.type === 'INSERT') {
            if (ent.entities) scanEntities(ent.entities, layer);
            else if (dxf.blocks && dxf.blocks[ent.name]) scanEntities(dxf.blocks[ent.name].entities, layer);
        }
      }
    });
  }

  scanEntities(dxf.entities);
  if (dxf.blocks) Object.values(dxf.blocks).forEach(block => scanEntities(block.entities));

  const layerVisibility = {};
  Object.keys(foundLayers).forEach(l => layerVisibility[l] = true);

  // --- 1. グリッド交点算出 ---
  const gridLines = lines.filter(l => {
    const ln = l.layer.toUpperCase();
    return ln === 'GLID' || ln === 'GRID' || ln.includes('通り芯') || ln.includes('芯');
  });
  const gridNodes = computeGridIntersections(gridLines, texts, keepExisting);

  // --- 2. 既存データの再マッピング ---
  const oldFloorData = JSON.parse(JSON.stringify(floorData));
  FLOORS.forEach(f => {
    const oldNodes = oldFloorData[f].nodes || [];
    const newNodes = gridNodes.nodes;
    floorData[f].nodes = JSON.parse(JSON.stringify(gridNodes.nodes));

    if (keepExisting) {
      const idMap = Array(oldNodes.length).fill(-1);
      oldNodes.forEach((onode, oi) => {
         const ni = newNodes.findIndex(nn => Math.hypot(nn.x - onode.x, nn.y - onode.y) < 20);
         idMap[oi] = ni;
      });
      floorData[f].columns = (oldFloorData[f].columns || []).map(c => { c.nodeIndex = idMap[c.nodeIndex]; return c; }).filter(c => c.nodeIndex !== -1);
      floorData[f].beams = (oldFloorData[f].beams || []).map(b => { b.n1 = idMap[b.n1]; b.n2 = idMap[b.n2]; return b; }).filter(b => b.n1 !== -1 && b.n2 !== -1);
      floorData[f].slabs = (oldFloorData[f].slabs || []).map(s => { s.nodeIds = s.nodeIds.map(oi => idMap[oi]).filter(ni => ni !== -1); return s; }).filter(s => s.nodeIds.length >= 3);
      floorData[f].walls = (oldFloorData[f].walls || []).map(w => { w.n1 = idMap[w.n1]; w.n2 = idMap[w.n2]; return w; }).filter(w => w.n1 !== -1 && w.n2 !== -1);
      floorData[f].diaphragms = (oldFloorData[f].diaphragms || []).map(d => { d.nodeIds = d.nodeIds.map(oi => idMap[oi]).filter(ni => ni !== -1); return d; }).filter(d => d.nodeIds.length >= 3);
    } else {
      floorData[f].columns = []; floorData[f].beams = []; floorData[f].slabs = []; floorData[f].walls = []; floorData[f].diaphragms = [];
    }
    floorData[f].dxfLines = []; floorData[f].dxfTexts = [];
  });

  // --- 3. 下絵の階層振り分け ---
  lines.forEach(l => {
    const ln = l.layer.toUpperCase();
    if (ln.includes('GLID') || ln.includes('GRID')) { FLOORS.forEach(f => floorData[f].dxfLines.push(l)); return; }
    let target = ln.includes('_PH') ? 'PH' : ln.includes('_R') ? 'R' : ln.includes('_3F') ? '3' : ln.includes('_2F') ? '2' : (ln.includes('_1F') || ln.includes('基礎') || ln.includes('_F')) ? '1' : '1';
    if (floorData[target]) floorData[target].dxfLines.push(l);
  });
  texts.forEach(t => {
    const ln = t.layer.toUpperCase();
    if (ln.includes('GLID') || ln.includes('GRID')) { FLOORS.forEach(f => floorData[f].dxfTexts.push(t)); return; }
    let target = ln.includes('_PH') ? 'PH' : ln.includes('_R') ? 'R' : ln.includes('_3F') ? '3' : ln.includes('_2F') ? '2' : (ln.includes('_1F') || ln.includes('基礎') || ln.includes('_F')) ? '1' : '1';
    if (floorData[target]) floorData[target].dxfTexts.push(t);
  });

  // --- 4. 柱の自動取り込み ---
  const colPoints = pointsAndCircles.filter(p => (p.layer || "").toUpperCase().includes('COL'));
  colPoints.forEach(pt => {
    const lName = pt.layer.toUpperCase();
    let targetFloor = lName.includes('_PH') ? 'PH' : lName.includes('_R') ? 'R' : lName.includes('_3F') ? '3' : lName.includes('_2F') ? '2' : (lName.includes('_1F') || lName.includes('基礎') || lName.includes('_F')) ? '1' : null;
    if (!targetFloor || !floorData[targetFloor]) return;
    let bestDist = 600, bestMatchIndex = -1;
    gridNodes.nodes.forEach((gn, i) => {
      const d = Math.hypot(gn.x - pt.x, gn.y - pt.y);
      if (d < bestDist) { bestDist = d; bestMatchIndex = i; }
    });
    if (bestMatchIndex !== -1 && !floorData[targetFloor].columns.some(c => c.nodeIndex === bestMatchIndex)) {
      const hitNode = gridNodes.nodes[bestMatchIndex];
      floorData[targetFloor].columns.push({ id: (hitNode.id || "").replace(/_\d+$/, ""), nodeIndex: bestMatchIndex, longTermAxial: 0, shortTermAxial: 0 });
    }
  });

  // --- 5. 壁の自動取り込み (全壁を倍率0で取り込む) ---
  const WALL_SNAP_TOL = 300; 
  let wallCount = 0;
  /*
  lines.forEach(line => {
    const ln = line.layer.toUpperCase();
    if (ln.includes('WALL') && !ln.includes('耐力壁') && !ln.startsWith('W_')) {
      let n1 = -1, n2 = -1, d1 = WALL_SNAP_TOL, d2 = WALL_SNAP_TOL;
      gridNodes.nodes.forEach((gn, i) => {
        const dist1 = Math.hypot(gn.x - line.x1, gn.y - line.y1);
        const dist2 = Math.hypot(gn.x - line.x2, gn.y - line.y2);
        if (dist1 < d1) { d1 = dist1; n1 = i; }
        if (dist2 < d2) { d2 = dist2; n2 = i; }
      });
      if (n1 !== -1 && n2 !== -1 && n1 !== n2) {
        if (!floorData[currentFloor].walls.some(w => (w.n1 === n1 && w.n2 === n2) || (w.n1 === n2 && w.n2 === n1))) {
          const midX = (line.x1 + line.x2) / 2, midY = (line.y1 + line.y2) / 2;
          floorData[currentFloor].walls.push({ id: 'W' + nextId.wall++, n1: n1, n2: n2, multiplier: 0, axisName: findNearestAxisName(midX, midY) || "" });
          wallCount++;
        }
      }
    }
  });
  if (wallCount > 0) console.log(`[DXF Parser] Successfully imported ${wallCount} walls with multiplier 0.`);
  */

  setDxfData(lines, texts, layerVisibility, gridNodes.vAxes, gridNodes.hAxes, []);
  
  // 正規化と修復の実行
  Promise.all([
    import('./data/data_normalizer.js'),
    import('./foundation_cad.js')
  ]).then(([{ normalizeAllFloors }, { repairFoundationData }]) => {
      normalizeAllFloors(floorData);
      if (typeof repairFoundationData === 'function') repairFoundationData(floorData);
      setTimeout(() => {
        if (typeof window.rebuildAllColumnIds === 'function') window.rebuildAllColumnIds();
        pushHistory();
      }, 200);
  });

  return Object.keys(foundLayers);
}

function computeGridIntersections(gridLines, texts, keepExisting) {
  const hLines = [], vLines = [];
  gridLines.forEach(l => {
    const dx = Math.abs(l.x2 - l.x1), dy = Math.abs(l.y2 - l.y1);
    if (dx > dy * 3) hLines.push(l); else if (dy > dx * 3) vLines.push(l);
  });
  const allTexts = texts.filter(t => t.layer.toUpperCase().includes('GRID') || t.layer.toUpperCase().includes('GLID')).length > 0 
    ? texts.filter(t => t.layer.toUpperCase().includes('GRID') || t.layer.toUpperCase().includes('GLID')) : texts;

  const vAxes = [];
  if (keepExisting && window.dxfVAxes) window.dxfVAxes.forEach(ax => vAxes.push({ x: ax.x, label: ax.label, lines: [], isExisting: true }));
  let unknownVXCount = 1;
  vLines.forEach(v => {
    let x = (v.x1 + v.x2) / 2;
    let axis = vAxes.find(a => Math.abs(a.x - x) < 10);
    if (!axis) { axis = { x: x, lines: [] }; vAxes.push(axis); }
    axis.lines.push(v);
  });
  vAxes.forEach(a => {
    if (a.isExisting) return;
    let bestText = '', bestDist = 1500;
    allTexts.forEach(t => { const dx = Math.abs(t.x - a.x); if (dx < bestDist) { bestDist = dx; bestText = t.text.replace(/[{}\\lL]/g, '').trim(); } });
    a.label = bestText || ('無名X' + unknownVXCount++);
  });

  const hAxes = [];
  if (keepExisting && window.dxfHAxes) window.dxfHAxes.forEach(ax => hAxes.push({ y: ax.y, label: ax.label, lines: [], isExisting: true }));
  let unknownHYCount = 1;
  hLines.forEach(h => {
    let y = (h.y1 + h.y2) / 2;
    let axis = hAxes.find(a => Math.abs(a.y - y) < 10);
    if (!axis) { axis = { y: y, lines: [] }; hAxes.push(axis); }
    axis.lines.push(h);
  });
  hAxes.forEach(a => {
    if (a.isExisting) return;
    let bestText = '', bestDist = 1500;
    allTexts.forEach(t => { const dy = Math.abs(t.y - a.y); if (dy < bestDist) { bestDist = dy; bestText = t.text.replace(/[{}\\lL]/g, '').trim(); } });
    a.label = bestText || ('無名Y' + unknownHYCount++);
  });

  const nodes = [];
  let nCounter = 1;
  vAxes.forEach(va => {
    hAxes.forEach(ha => {
      let sumX = 0, sumY = 0, count = 0;
      va.lines.forEach(vl => ha.lines.forEach(hl => { const pt = lineIntersect(vl, hl); if (pt) { sumX += pt.x; sumY += pt.y; count++; } }));
      if (count > 0) nodes.push({ id: (va.label && ha.label) ? (va.label + ha.label) : ('N' + nCounter++), x: sumX / count, y: sumY / count });
    });
  });
  return {nodes, vAxes, hAxes};
}

function lineIntersect(l1, l2) {
  const x1=l1.x1, y1=l1.y1, x2=l1.x2, y2=l1.y2, x3=l2.x1, y3=l2.y1, x4=l2.x2, y4=l2.y2;
  const denom = (x1-x2)*(y3-y4) - (y1-y2)*(x3-x4);
  if (Math.abs(denom) < 1e-6) return null;
  const t = ((x1-x3)*(y3-y4) - (y1-y3)*(x3-x4)) / denom;
  const u = -((x1-x2)*(y1-y3) - (y1-y2)*(x1-x3)) / denom;
  if (t >= -0.05 && t <= 1.05 && u >= -0.05 && u <= 1.05) return { x: x1 + t*(x2-x1), y: y1 + t*(y2-y1) };
  return null;
}
