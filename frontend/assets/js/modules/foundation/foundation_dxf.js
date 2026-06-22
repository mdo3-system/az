/**
 * foundation_dxf.js  — DXF インポートモジュール
 *
 * 設計原則:
 *   - 単一責任: DXFファイルの解析と floorData への反映のみ担当
 *   - 非同期統一: すべての処理を Promise/async-await に統一し、
 *     コールバックと非同期 import() の競合（初回描画失敗）を根本解決
 *   - 純粋関数分離: computeGridIntersections / lineIntersect はピュア関数として独立
 */
import {
  floorData, FLOORS, nextId, pushHistory, setDxfData,
  findNearestAxisName, currentFloor
} from './foundation_cad.js';

// ──────────────────────────────────────────────────────────────────────────────
// 公開 API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * DXF ファイルを解析して floorData へ反映する（Promise ベース）
 *
 * @param {File} file         解析対象の DXF ファイル
 * @param {boolean} keepExisting  既存データ（柱・梁等）を保持するか
 * @param {Object|null} symbolMap  壁記号マッピング（未使用ならnull）
 * @returns {Promise<string[]>} 検出したレイヤー名の配列
 */
export async function parseDxfFile(file, keepExisting = false, symbolMap = null) {
  console.log(`[DXF-1] parseDxfFile 開始: ${file.name} (${file.size} bytes)`);

  // 1. FileReader で文字列として読み込む
  const rawText = await _readFileAsText(file);
  console.log('[DXF-2] ファイル読み込み完了');

  // 2. dxf-parser でパース
  if (!window.DxfParser) {
    throw new Error('[DXF] window.DxfParser が見つかりません。dxf-parser ライブラリの読み込みを確認してください。');
  }
  const parser = new window.DxfParser();
  console.log('[DXF-3] dxf-parser parseSync 開始...');
  const dxf = parser.parseSync(rawText);
  console.log(`[DXF-4] parseSync 完了: エンティティ数 = ${dxf.entities ? dxf.entities.length : 0}`);

  // 3. エンティティ走査・グリッド計算・floorData 更新（await で正規化まで完結）
  const layerNames = await _processDxfData(dxf, keepExisting, symbolMap);
  console.log('[DXF-5] processDxfData 完了');

  return layerNames;
}

/**
 * DXF ファイルから壁記号を抽出する（Promise ベース）
 */
export async function extractDxfSymbols(file) {
  console.log(`[Symbol-1] extractDxfSymbols: ${file.name}`);
  const rawText = await _readFileAsText(file);
  const dxf = new window.DxfParser().parseSync(rawText);
  const symbols = new Set();
  _scanForSymbols(dxf, dxf.entities, null, symbols);
  return Array.from(symbols).sort();
}

// ──────────────────────────────────────────────────────────────────────────────
// 内部実装（非公開）
// ──────────────────────────────────────────────────────────────────────────────

/**
 * FileReader を Promise でラップする
 * @param {File} file
 * @returns {Promise<string>}
 */
function _readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target.result);
    reader.onerror = (err) => reject(new Error(`FileReader エラー: ${err}`));
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * DXF データを解析して floorData へ反映する（すべて await で直列完了）
 * @returns {Promise<string[]>} レイヤー名一覧
 */
async function _processDxfData(dxf, keepExisting, symbolMap = null) {
  const lines = [];
  const texts = [];
  const pointsAndCircles = [];
  const foundLayers = {};

  // エンティティ走査
  _scanEntities(dxf, dxf.entities, null, lines, texts, pointsAndCircles, foundLayers);
  if (dxf.blocks) {
    Object.values(dxf.blocks).forEach(block =>
      _scanEntities(dxf, block.entities, null, lines, texts, pointsAndCircles, foundLayers)
    );
  }

  const layerVisibility = {};
  Object.keys(foundLayers).forEach(l => (layerVisibility[l] = true));

  // 1. グリッド交点算出
  const gridLines = lines.filter(l => {
    const ln = l.layer.toUpperCase();
    return ln === 'GLID' || ln === 'GRID' || ln.includes('通り芯') || ln.includes('芯');
  });
  const gridNodes = _computeGridIntersections(gridLines, texts, keepExisting);

  // 2. 既存データの再マッピング
  const oldFloorData = JSON.parse(JSON.stringify(floorData));
  FLOORS.forEach(f => {
    const oldNodes = oldFloorData[f].nodes || [];
    const newNodes = gridNodes.nodes;
    floorData[f].nodes = JSON.parse(JSON.stringify(newNodes));

    if (keepExisting) {
      const idMap = Array(oldNodes.length).fill(-1);
      oldNodes.forEach((onode, oi) => {
        const ni = newNodes.findIndex(nn => Math.hypot(nn.x - onode.x, nn.y - onode.y) < 20);
        idMap[oi] = ni;
      });
      floorData[f].columns = (oldFloorData[f].columns || []).map(c => { c.nodeIndex = idMap[c.nodeIndex]; return c; }).filter(c => c.nodeIndex !== -1);
      floorData[f].beams   = (oldFloorData[f].beams   || []).map(b => { b.n1 = idMap[b.n1]; b.n2 = idMap[b.n2]; return b; }).filter(b => b.n1 !== -1 && b.n2 !== -1);
      floorData[f].slabs   = (oldFloorData[f].slabs   || []).map(s => { s.nodeIds = s.nodeIds.map(oi => idMap[oi]).filter(ni => ni !== -1); return s; }).filter(s => s.nodeIds.length >= 3);
      floorData[f].walls   = (oldFloorData[f].walls   || []).map(w => { w.n1 = idMap[w.n1]; w.n2 = idMap[w.n2]; return w; }).filter(w => w.n1 !== -1 && w.n2 !== -1);
      floorData[f].diaphragms = (oldFloorData[f].diaphragms || []).map(d => { d.nodeIds = d.nodeIds.map(oi => idMap[oi]).filter(ni => ni !== -1); return d; }).filter(d => d.nodeIds.length >= 3);
    } else {
      floorData[f].columns = []; floorData[f].beams = []; floorData[f].slabs = [];
      floorData[f].walls   = []; floorData[f].diaphragms = [];
    }
    floorData[f].dxfLines = []; floorData[f].dxfTexts = [];
  });

  // 3. 下絵の階層振り分け
  lines.forEach(l => {
    const ln = l.layer.toUpperCase();
    if (ln.includes('GLID') || ln.includes('GRID')) { FLOORS.forEach(f => floorData[f].dxfLines.push(l)); return; }
    const target = _resolveFloor(ln);
    if (floorData[target]) floorData[target].dxfLines.push(l);
  });
  texts.forEach(t => {
    const ln = t.layer.toUpperCase();
    if (ln.includes('GLID') || ln.includes('GRID')) { FLOORS.forEach(f => floorData[f].dxfTexts.push(t)); return; }
    const target = _resolveFloor(ln);
    if (floorData[target]) floorData[target].dxfTexts.push(t);
  });

  // 4. 柱の自動取り込み（COL レイヤー）
  const colPoints = pointsAndCircles.filter(p => (p.layer || '').toUpperCase().includes('COL'));
  colPoints.forEach(pt => {
    const lName = pt.layer.toUpperCase();
    const targetFloor = _resolveFloor(lName);
    if (!targetFloor || !floorData[targetFloor]) return;
    let bestDist = 600, bestIdx = -1;
    gridNodes.nodes.forEach((gn, i) => {
      const d = Math.hypot(gn.x - pt.x, gn.y - pt.y);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    if (bestIdx !== -1 && !floorData[targetFloor].columns.some(c => c.nodeIndex === bestIdx)) {
      const hitNode = gridNodes.nodes[bestIdx];
      floorData[targetFloor].columns.push({
        id: (hitNode.id || '').replace(/_\d+$/, ''),
        nodeIndex: bestIdx,
        longTermAxial: 0,
        shortTermAxial: 0
      });
    }
  });

  // 5. DXFデータを store にセット
  setDxfData(lines, texts, layerVisibility, gridNodes.vAxes, gridNodes.hAxes, []);

  // 6. 正規化・修復・ID再構築（await で直列完了 ← これが根本修正）
  const [{ normalizeAllFloors }, { repairFoundationData }] = await Promise.all([
    import('./data/data_normalizer.js'),
    import('./foundation_cad.js')
  ]);
  normalizeAllFloors(floorData);
  if (typeof repairFoundationData === 'function') repairFoundationData(floorData);
  if (typeof window.rebuildAllColumnIds === 'function') window.rebuildAllColumnIds();
  pushHistory();

  console.log('[DXF-6] 正規化・修復・ID再構築 完了');
  return Object.keys(foundLayers);
}

// ──────────────────────────────────────────────────────────────────────────────
// ヘルパー
// ──────────────────────────────────────────────────────────────────────────────

/** レイヤー名から対象階を解決する */
function _resolveFloor(ln) {
  if (ln.includes('_PH'))                          return 'PH';
  if (ln.includes('_R'))                           return 'R';
  if (ln.includes('_3F'))                          return '3';
  if (ln.includes('_2F'))                          return '2';
  if (ln.includes('_1F') || ln.includes('基礎') || ln.includes('_F')) return '1';
  return '1'; // デフォルト
}

/** DXF エンティティを再帰的に走査してライン/テキスト/点を収集する */
function _scanEntities(dxf, entities, parentLayer, lines, texts, points, foundLayers) {
  if (!entities) return;
  entities.forEach(ent => {
    const layer = (ent.layer === '0' && parentLayer) ? parentLayer : (ent.layer || '0');
    foundLayers[layer] = true;

    if (ent.type === 'LINE' || ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
      const pts = ent.vertices || (ent.start && ent.end ? [ent.start, ent.end] : null);
      if (pts && pts.length >= 2) {
        for (let i = 0; i < pts.length - 1; i++) {
          if (pts[i].x !== undefined && pts[i + 1].x !== undefined) {
            lines.push({ type: 'LINE', x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y, layer });
          }
        }
      }
    } else if (ent.type === 'TEXT' || ent.type === 'MTEXT') {
      const textStr = ent.text || ent.string || ent.value || '';
      const pos = ent.startPoint || ent.position || ent.insertionPoint;
      if (textStr !== undefined && pos) {
        texts.push({ x: pos.x, y: pos.y, text: textStr.toString().trim(), layer });
      }
    } else if (ent.type === 'POINT' || ent.type === 'CIRCLE' || ent.type === 'INSERT') {
      const pos = ent.position || ent.center || ent.insertionPoint;
      if (pos) points.push({ x: pos.x, y: pos.y, layer });
      if (ent.type === 'INSERT') {
        if (ent.entities) _scanEntities(dxf, ent.entities, layer, lines, texts, points, foundLayers);
        else if (dxf.blocks && dxf.blocks[ent.name]) _scanEntities(dxf, dxf.blocks[ent.name].entities, layer, lines, texts, points, foundLayers);
      }
    }
  });
}

/** 壁記号抽出用の再帰スキャン */
function _scanForSymbols(dxf, entities, parentLayer, symbols) {
  if (!entities) return;
  entities.forEach(ent => {
    const layer = (ent.layer === '0' && parentLayer) ? parentLayer : (ent.layer || '0');
    if (ent.type === 'TEXT' || ent.type === 'MTEXT') {
      const ln = layer.toUpperCase();
      if (ln.includes('WALL_BRACED') || ln.includes('耐力壁') || ln.includes('壁記号')) {
        const val = (ent.text || '').trim();
        if (val) symbols.add(val);
      }
    } else if (ent.type === 'INSERT') {
      if (ent.entities) _scanForSymbols(dxf, ent.entities, layer, symbols);
      else if (dxf.blocks && dxf.blocks[ent.name]) _scanForSymbols(dxf, dxf.blocks[ent.name].entities, layer, symbols);
    }
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// グリッド計算（純粋関数）
// ──────────────────────────────────────────────────────────────────────────────

/**
 * グリッド線と通り芯テキストからノード・通り芯リストを生成する（純粋関数）
 */
function _computeGridIntersections(gridLines, texts, keepExisting) {
  const hLines = [], vLines = [];
  gridLines.forEach(l => {
    const dx = Math.abs(l.x2 - l.x1), dy = Math.abs(l.y2 - l.y1);
    if (dx > dy * 3) hLines.push(l);
    else if (dy > dx * 3) vLines.push(l);
  });

  const allTexts = texts.filter(t =>
    t.layer.toUpperCase().includes('GRID') || t.layer.toUpperCase().includes('GLID')
  ).length > 0
    ? texts.filter(t => t.layer.toUpperCase().includes('GRID') || t.layer.toUpperCase().includes('GLID'))
    : texts;

  // 垂直通り芯
  const vAxes = [];
  if (keepExisting && window.dxfVAxes) {
    window.dxfVAxes.forEach(ax => vAxes.push({ x: ax.x, label: ax.label, lines: [], isExisting: true }));
  }
  let unknownVXCount = 1;
  vLines.forEach(v => {
    const x = (v.x1 + v.x2) / 2;
    let axis = vAxes.find(a => Math.abs(a.x - x) < 10);
    if (!axis) { axis = { x, lines: [] }; vAxes.push(axis); }
    axis.lines.push(v);
  });
  vAxes.forEach(a => {
    if (a.isExisting) return;
    let bestText = '', bestDist = 1500;
    allTexts.forEach(t => {
      const dx = Math.abs(t.x - a.x);
      if (dx < bestDist) { bestDist = dx; bestText = t.text.replace(/[{}\\lL]/g, '').trim(); }
    });
    a.label = bestText || ('無名X' + unknownVXCount++);
  });

  // 水平通り芯
  const hAxes = [];
  if (keepExisting && window.dxfHAxes) {
    window.dxfHAxes.forEach(ax => hAxes.push({ y: ax.y, label: ax.label, lines: [], isExisting: true }));
  }
  let unknownHYCount = 1;
  hLines.forEach(h => {
    const y = (h.y1 + h.y2) / 2;
    let axis = hAxes.find(a => Math.abs(a.y - y) < 10);
    if (!axis) { axis = { y, lines: [] }; hAxes.push(axis); }
    axis.lines.push(h);
  });
  hAxes.forEach(a => {
    if (a.isExisting) return;
    let bestText = '', bestDist = 1500;
    allTexts.forEach(t => {
      const dy = Math.abs(t.y - a.y);
      if (dy < bestDist) { bestDist = dy; bestText = t.text.replace(/[{}\\lL]/g, '').trim(); }
    });
    a.label = bestText || ('無名Y' + unknownHYCount++);
  });

  // 交点ノード生成
  const nodes = [];
  let nCounter = 1;
  vAxes.forEach(va => {
    hAxes.forEach(ha => {
      let sumX = 0, sumY = 0, count = 0;
      va.lines.forEach(vl =>
        ha.lines.forEach(hl => {
          const pt = _lineIntersect(vl, hl);
          if (pt) { sumX += pt.x; sumY += pt.y; count++; }
        })
      );
      if (count > 0) {
        nodes.push({
          id: (va.label && ha.label) ? (va.label + ha.label) : ('N' + nCounter++),
          x: sumX / count,
          y: sumY / count
        });
      }
    });
  });

  return { nodes, vAxes, hAxes };
}

/**
 * 2 直線の交点を返す（純粋関数）
 */
function _lineIntersect(l1, l2) {
  const { x1, y1, x2, y2 } = l1;
  const x3 = l2.x1, y3 = l2.y1, x4 = l2.x2, y4 = l2.y2;
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-6) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  if (t >= -0.05 && t <= 1.05 && u >= -0.05 && u <= 1.05) {
    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
  }
  return null;
}
