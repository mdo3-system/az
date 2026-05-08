import { floorData, FLOORS, nextId, pushHistory, setDxfData } from './foundation_cad.js';

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
 * DXFから耐力壁レイヤにあるユニークな記号を抽出する
 */
export function extractDxfSymbols(file, callback) {
    console.log(`[Step Symbol-1] Starting extractDxfSymbols for ${file.name}`);
    const reader = new FileReader();
    reader.onload = ev => {
        console.log("[Step Symbol-2] FileReader finished.");
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
                        // ブロック内も再帰的に検索
                        if (ent.entities) scanForSymbols(ent.entities, layer);
                        else if (dxf.blocks && dxf.blocks[ent.name]) {
                            scanForSymbols(dxf.blocks[ent.name].entities, layer);
                        }
                    }
                });
            };

            scanForSymbols(dxf.entities);
            const result = Array.from(symbols).sort();
            console.log(`[Step Symbol-4] Extraction finished. Found ${result.length} symbols:`, result);
            callback(null, result);
        } catch (err) {
            console.error("[Step Symbol-ERROR] Symbol extraction failed:", err);
            callback(err, null);
        }
    };
    reader.readAsText(file, 'utf-8');
}

function processDxfData(dxf, keepExisting, symbolMap = null) {
  let lines = [];
  let texts = [];
  let pointsAndCircles = [];
  let foundLayers = {};

  console.log(`[DXF Parser] Starting deep scan. Total entities: ${dxf.entities?.length || 0}`);
  if (dxf.tables && dxf.tables.layer) {
    console.log(`[DXF Parser] DXF Layers:`, Object.keys(dxf.tables.layer.layers || {}));
  }

  function scanEntities(entities, parentLayer = null) {
    if (!entities) return;
    entities.forEach(ent => {
      // レイヤ0の場合は親（INSERT）のレイヤを引き継ぐ
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
          if (ent.shape && pts.length > 2) {
            const first = pts[0], last = pts[pts.length - 1];
            lines.push({ type: 'LINE', x1: last.x, y1: last.y, x2: first.x, y2: first.y, layer });
          }
        }
      } else if (ent.type === 'TEXT' || ent.type === 'MTEXT') {
        const textStr = ent.text || ent.string || ent.value || '';
        const pos = ent.startPoint || ent.position || ent.insertionPoint;
        if (textStr !== undefined && pos) {
          texts.push({ x: pos.x, y: pos.y, text: textStr.toString().trim(), layer });
        }
      } else if (ent.type === 'POINT' || ent.type === 'CIRCLE') {
        const pos = ent.position || ent.center;
        if (pos) {
          pointsAndCircles.push({ x: pos.x, y: pos.y, layer });
        }
      } else if (ent.type === 'INSERT') {
        // 配置点自体をポイントとして追加 (柱などの位置情報として重要)
        const pos = ent.position || ent.insertionPoint;
        if (pos) {
            pointsAndCircles.push({ x: pos.x, y: pos.y, layer });
        }
        // ブロック内のエンティティを再帰的に取得。レイヤ情報を引き継ぐ。
        if (ent.entities) scanEntities(ent.entities, layer);
        else if (dxf.blocks && dxf.blocks[ent.name]) {
            scanEntities(dxf.blocks[ent.name].entities, layer);
        }
      }
    });
  }

  // 1. トップレベルのエンティティ
  scanEntities(dxf.entities);

  // 2. ブロック定義内のエンティティ (展開されていない場合への備え)
  if (dxf.blocks) {
      Object.values(dxf.blocks).forEach(block => {
          if (block.entities) scanEntities(block.entities);
      });
  }

  console.log(`[DXF Parser] Deep scan finished: ${lines.length} lines, ${texts.length} texts, ${pointsAndCircles.length} points/circles.`);
  if (lines.length === 0) {
    console.error(`[DXF Parser] ERROR: No lines were extracted from DXF entities.`);
    console.log(`[DXF Debug] First 5 entities in DXF:`, dxf.entities ? dxf.entities.slice(0, 5) : "None");
  }

  if (dxf.entities) {
     let typeCounts = {};
     dxf.entities.forEach(e => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1; });
     console.log(`[DXF Debug] Entity types found by dxf-parser:`);
     console.table(typeCounts);
  }
  console.log("[DXF Parser] Layers found in this DXF:");
  console.table(Object.keys(foundLayers).sort());

  // レイヤの可視性初期化（すべて表示）
  const layerVisibility = {};
  Object.keys(foundLayers).forEach(l => layerVisibility[l] = true);

  // To be passed later with nodes

  // --- 1. 厳格な交点算出 (GRID/GLID) ---
  // ✅ 強化: 統合済みDXF(GLID)だけでなく、元の日本語レイヤ名(通り芯/芯)も対象に含める
  const gridLines = lines.filter(l => {
    const ln = l.layer.toUpperCase();
    return ln === 'GLID' || ln === 'GRID' || ln.includes('通り芯') || ln.includes('芯');
  });
  console.log(`[DXF Parser] Filtering for grid: Found ${gridLines.length} lines for grid intersection.`);
  const gridNodes = computeGridIntersections(gridLines, texts, keepExisting);

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
         // ✅ 修正: 許容誤差を 5mm -> 20mm に拡大 (通り芯の微細なズレに対応)
         const ni = newNodes.findIndex(nn => Math.hypot(nn.x - onode.x, nn.y - onode.y) < 20);
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

      // ✅ 構面（ダイアフラム）の node index も再マッピング
      floorData[f].diaphragms = (oldFloorData[f].diaphragms || []).map(d => {
         d.nodeIds = d.nodeIds.map(oi => idMap[oi]).filter(ni => ni !== -1);
         return d;
      }).filter(d => d.nodeIds.length >= 3);

    } else {
      floorData[f].columns = [];
      floorData[f].beams = [];
      floorData[f].slabs = [];
      floorData[f].walls = []; 
      floorData[f].diaphragms = [];
    }
    // 下絵は常に最新のものに置き換えるため、keepExistingに関わらずリセット
    floorData[f].dxfLines = [];
    floorData[f].dxfTexts = [];
  });

  console.log(`[DXF Parser] Extracted raw entities: ${lines.length} lines, ${texts.length} texts, ${pointsAndCircles.length} points/circles`);
  
  // デバッグ用：レイヤごとの図形数を集計
  const layerStats = {};
  const updateStats = (layer, type) => {
      const ln = (layer || "0").toUpperCase();
      if (!layerStats[ln]) layerStats[ln] = { total:0, points:0, lines:0, texts:0 };
      layerStats[ln][type]++;
      layerStats[ln].total++;
  };
  pointsAndCircles.forEach(p => updateStats(p.layer, 'points'));
  lines.forEach(l => updateStats(l.layer, 'lines'));
  texts.forEach(t => updateStats(t.layer, 'texts'));
  console.log("[DXF Parser] Detailed Layer Stats:", layerStats);

  // --- 下絵の階層振り分け (レイヤ名のサフィックス判定) ---
  lines.forEach(l => {
    const ln = l.layer.toUpperCase();
    if (ln.includes('GLID') || ln.includes('GRID')) {
        FLOORS.forEach(f => floorData[f].dxfLines.push(l));
        return;
    }
    // 優先順位をつけて判定
    let target = null;
    if (ln.includes('_PH')) target = 'PH';
    else if (ln.includes('_R')) target = 'R';
    else if (ln.includes('_3F')) target = '3';
    else if (ln.includes('_2F')) target = '2';
    else if (ln.includes('_1F')) target = '1';
    else if (ln.includes('基礎') || ln.includes('_F')) target = '1';
    
    if (target && floorData[target]) {
        floorData[target].dxfLines.push(l);
    } else {
        // 判定不能なものは暫定的に1Fへ
        floorData['1'].dxfLines.push(l);
    }
  });

  // ✅ 診断ログ追加
  console.log(`%c[Underlay Debug] Distribution of lines per floor:`, "color: #2ecc71; font-weight: bold;");
  FLOORS.forEach(f => {
      console.log(`  - Floor ${f}: ${floorData[f].dxfLines.length} lines, ${floorData[f].dxfTexts.length} texts`);
  });

  texts.forEach(t => {
    const ln = t.layer.toUpperCase();
    if (ln.includes('GLID') || ln.includes('GRID')) {
        FLOORS.forEach(f => floorData[f].dxfTexts.push(t));
        return;
    }
    let target = null;
    if (ln.includes('_PH')) target = 'PH';
    else if (ln.includes('_R')) target = 'R';
    else if (ln.includes('_3F')) target = '3';
    else if (ln.includes('_2F')) target = '2';
    else if (ln.includes('_1F')) target = '1';
    else if (ln.includes('基礎') || ln.includes('_F')) target = '1';

    if (target && floorData[target]) {
        floorData[target].dxfTexts.push(t);
    } else {
        floorData['1'].dxfTexts.push(t);
    }
  });

  console.log("[DXF Parser] Floor separation results:");
  FLOORS.forEach(f => {
      console.log(`  [${f}F] ${floorData[f].dxfLines.length} lines, ${floorData[f].dxfTexts.length} texts`);
  });

  if (!keepExisting) {
    nextId.node = 1;
    nextId.beam = 1;
    nextId.slab = 1;
  }

  // --- 柱の自動取り込み ---
  let colCount = 0;
  const colPoints = pointsAndCircles.filter(p => (p.layer || "").toUpperCase().includes('COL'));
  console.log(`[Deep Diagnosis] Grid Nodes: ${gridNodes.nodes.length}, Points on COL layers: ${colPoints.length}`);
  
  if (gridNodes.nodes.length > 0 && colPoints.length > 0) {
      console.log("[Deep Diagnosis] Sample Grid Node (0):", gridNodes.nodes[0]);
      console.log("[Deep Diagnosis] Sample COL Point (0):", colPoints[0]);
  }

  colPoints.forEach(pt => {
    const lName = pt.layer.toUpperCase();
    let targetFloor = null;
    if (lName.includes('_PH')) targetFloor = 'PH';
    else if (lName.includes('_R')) targetFloor = 'R';
    else if (lName.includes('_3F')) targetFloor = '3';
    else if (lName.includes('_2F')) targetFloor = '2';
    else if (lName.includes('_1F')) targetFloor = '1';
    else if (lName.includes('基礎') || lName.includes('_F')) targetFloor = '1';

    if (!targetFloor || !floorData[targetFloor]) return;

    // 柱を最も近いグリッド交点(node)にスナップさせる (TOL: 600mmに拡大)
    let bestDist = 600;
    let bestMatchIndex = -1;
    gridNodes.nodes.forEach((gn, i) => {
      const d = Math.hypot(gn.x - pt.x, gn.y - pt.y);
      if (d < bestDist) {
        bestDist = d;
        bestMatchIndex = i;
      }
    });

    if (bestMatchIndex !== -1) {
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
        colCount++;
      }
    }
  });
  console.log(`[DXF Parser] Successfully imported ${colCount} columns across all floors.`);

  // --- 壁の自動取り込み (ユーザー要望により停止中) ---
  /*
  let wallCount = 0;
  const WALL_SNAP_TOL = 300; 
  const SYMBOL_SEARCH_RADIUS = 600; 

  lines.forEach(line => {
    // ...
  });
  */

  console.log(`[DXF Parser] setDxfData called with V:${gridNodes.vAxes.length}, H:${gridNodes.hAxes.length} axes.`);
  setDxfData(lines, texts, layerVisibility, gridNodes.vAxes, gridNodes.hAxes, []);
  
  // ✅ 修正: 解析完了後に少し遅延させて履歴を保存
  setTimeout(() => {
    console.log(`[DXF Import] Requesting pushHistory... Current V-Axes: ${window.dxfVAxes.length}`);
    
    // インポート直後に符号を確実に整合させる
    if (typeof window.rebuildAllColumnIds === 'function') {
      window.rebuildAllColumnIds();
    }
    
    pushHistory();
    console.log(`[DXF Import] Import complete. History pushed.`);
  }, 200);

  return Object.keys(foundLayers);
}

function computeGridIntersections(gridLines, texts, keepExisting) {
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
  // 既存の通り芯を初期値としてセット（重複回避のため）
  if (keepExisting && window.dxfVAxes) {
      window.dxfVAxes.forEach(ax => vAxes.push({ x: ax.x, label: ax.label, lines: [], isExisting: true }));
  }

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
    if (a.isExisting) return; // 既存軸はラベル更新しない（優先）
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
  if (keepExisting && window.dxfHAxes) {
      window.dxfHAxes.forEach(ax => hAxes.push({ y: ax.y, label: ax.label, lines: [], isExisting: true }));
  }

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
    if (a.isExisting) return; // 既存軸はラベル更新しない（優先）
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
