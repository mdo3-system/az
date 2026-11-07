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
// 定数（Python バックエンド dxf_merger.py と完全同一の名寄せ・除外定義）
// ──────────────────────────────────────────────────────────────────────────────
const RENAME_MAP = {
  '通り芯': 'GLID',
  '柱': 'COL',
  '耐力壁': 'WALL_BRACED',
  '壁': 'WALL_NORMAL'
};

const EXCLUDE_LAYER_KEYWORDS = ['DEFPOINTS', 'ASHB', 'WORK', 'TMP', '印刷外'];

// ──────────────────────────────────────────────────────────────────────────────
// 公開 API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * DXF ファイルを解析して floorData へ反映する（Promise ベース）
 *
 * @param {File} file           解析対象の DXF ファイル
 * @param {boolean} keepExisting  既存データ（柱・梁等）を保持するか
 * @param {Object|null} symbolMap 壁記号マッピング（未使用ならnull）
 * @param {string|null} floorTag  階層タグ（'1F', '2F', '3F', 'PH' 等。統合済みDXFならnull）
 * @returns {Promise<string[]>} 検出したレイヤー名の配列
 */
export async function parseDxfFile(file, keepExisting = false, symbolMap = null, floorTag = null) {
  console.log(`[DXF-1] parseDxfFile 開始: ${file.name} (${file.size} bytes)`);

  // 1. ArrayBuffer + TextDecoder (UTF-8 / Shift-JIS 自動判別) で文字列として読み込む
  const rawText = await _readFileAsText(file);
  console.log('[DXF-2] ファイル読み込み完了');

  // 2. dxf-parser でパース
  if (!window.DxfParser) {
    throw new Error('[DXF] window.DxfParser が見つかりません。dxf-parser ライブラリの読み込みを確認してください。');
  }
  const parser = new window.DxfParser();
  console.log('[DXF-3] dxf-parser parseSync 開始...');
  const dxf = parser.parseSync(rawText);
  console.log(`[DXF-4] parseSync 完了: エンティティ数 = ${dxf && dxf.entities ? dxf.entities.length : 0}`);

  // 3. エンティティ走査・グリッド計算・floorData 更新（await で正規化まで完結）
  const layerNames = await _processDxfData([{ dxf, floorTag }], keepExisting, symbolMap);
  console.log('[DXF-5] processDxfData 完了');

  return layerNames;
}

/**
 * 複数階の DXF ファイルをブラウザ内で直接統合・解析して floorData へ反映する
 * （Python バックエンド未起動時や Xserver 本番環境でもブラウザ単体で完結）
 *
 * @param {Object<string, File>} filesByFloor  例: { '1F': file1f, '2F': file2f, '3F': file3f, 'PH': filePh }
 * @param {boolean} keepExisting               既存データを保持するか
 * @param {Object|null} symbolMap              壁記号マッピング
 * @returns {Promise<string[]>} 検出したレイヤー名の配列
 */
export async function parseMultipleDxfFiles(filesByFloor, keepExisting = false, symbolMap = null) {
  if (!window.DxfParser) {
    throw new Error('[DXF] window.DxfParser が見つかりません。dxf-parser ライブラリの読み込みを確認してください。');
  }
  const parser = new window.DxfParser();
  const parsedList = [];

  for (const [rawKey, file] of Object.entries(filesByFloor || {})) {
    if (!file) continue;
    const floorTag = rawKey.toUpperCase(); // '1F', '2F', '3F', 'PH'
    console.log(`[DXF-Multi] ${floorTag} 読み込み開始: ${file.name} (${file.size} bytes)`);
    const rawText = await _readFileAsText(file);
    const dxf = parser.parseSync(rawText);
    console.log(`[DXF-Multi] ${floorTag} パース完了: エンティティ数 = ${dxf && dxf.entities ? dxf.entities.length : 0}`);
    if (dxf) {
      parsedList.push({ dxf, floorTag });
    }
  }

  if (parsedList.length === 0) {
    throw new Error('有効な DXF ファイルが選択されていません。');
  }

  const layerNames = await _processDxfData(parsedList, keepExisting, symbolMap);
  console.log('[DXF-Multi] 全階統合・正規化完了');
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
 * UTF-8 / Shift-JIS (CP932) を自動判別してファイルを文字列として読み込む
 * @param {File} file
 * @returns {Promise<string>}
 */
function _readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const buffer = ev.target.result;
        if (typeof buffer === 'string') {
          resolve(buffer);
          return;
        }
        let text;
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        } catch (_utf8Err) {
          text = new TextDecoder('shift-jis').decode(buffer);
        }
        resolve(text);
      } catch (err) {
        reject(new Error(`DXF デコードエラー: ${err.message || err}`));
      }
    };
    reader.onerror = (err) => reject(new Error(`FileReader エラー: ${err}`));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 1つまたは複数階のパース済み DXF データを解析して floorData へ反映する
 * @param {Array<{dxf: Object, floorTag: string|null}>} parsedItems
 * @param {boolean} keepExisting
 * @param {Object|null} symbolMap
 * @returns {Promise<string[]>} レイヤー名一覧
 */
async function _processDxfData(parsedItems, keepExisting, symbolMap = null) {
  const lines = [];
  const texts = [];
  const pointsAndCircles = [];
  const foundLayers = {};

  const items = Array.isArray(parsedItems) ? parsedItems : [{ dxf: parsedItems, floorTag: null }];

  // 各階のエンティティ走査（INSERT ブロックの座標変換・再帰展開を含む）
  for (const { dxf, floorTag } of items) {
    if (!dxf || !dxf.entities) continue;
    _scanEntities(dxf, dxf.entities, null, floorTag, lines, texts, pointsAndCircles, foundLayers);
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

/**
 * レイヤ名を RENAME_MAP で名寄せし、必要に応じて階層タグ（_1F, _2F 等）を付与する
 */
function _resolveLayerName(origLayer, floorTag) {
  const orig = String(origLayer || '0').trim();
  const up = orig.toUpperCase();
  if (up === 'GLID' || up === 'GRID') return 'GLID';

  const hasFloorSuffix = /_(1F|2F|3F|PH|R)$/i.test(orig);

  for (const [k, v] of Object.entries(RENAME_MAP)) {
    if (orig.includes(k)) {
      if (v === 'GLID') return 'GLID';
      if (floorTag) return `${v}_${floorTag}`;
      if (hasFloorSuffix) {
        const suffix = orig.match(/_(1F|2F|3F|PH|R)$/i)[0].toUpperCase();
        return `${v}${suffix}`;
      }
      return `${v}_1F`;
    }
  }

  if (floorTag && !hasFloorSuffix) {
    return `${orig}_${floorTag}`;
  }
  return orig;
}

/** 2D アフィン変換（スケール → 回転 → 平行移動） */
function _transformPoint(pt, tx, ty, sx, sy, rad) {
  const x0 = (pt.x || 0) * sx;
  const y0 = (pt.y || 0) * sy;
  if (rad === 0) {
    return { x: x0 + tx, y: y0 + ty };
  }
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: x0 * cos - y0 * sin + tx,
    y: x0 * sin + y0 * cos + ty
  };
}

/** MTEXT 等の制御コード除去 */
function _cleanDxfText(raw) {
  if (raw === undefined || raw === null) return '';
  return String(raw)
    .replace(/\\[fFpPlLOoAHQSTW][^;]*;/g, '')
    .replace(/\\P/g, '\n')
    .replace(/[{}]/g, '')
    .trim();
}

/**
 * DXF エンティティを再帰的に走査（INSERT ブロック座標変換を含む）してライン/テキスト/点を収集する
 */
function _scanEntities(dxf, entities, parentLayer, floorTag, lines, texts, points, foundLayers, tx = 0, ty = 0, sx = 1, sy = 1, rotDeg = 0, depth = 0) {
  if (!entities || depth > 12) return;
  const rad = (rotDeg * Math.PI) / 180;

  entities.forEach(ent => {
    if (!ent) return;
    const rawLayer = String(ent.layer || '0');
    const rawUp = rawLayer.toUpperCase();
    if (EXCLUDE_LAYER_KEYWORDS.some(k => rawUp.includes(k))) return;

    let layer;
    if (parentLayer && (parentLayer.includes('COL') || parentLayer.includes('WALL'))) {
      layer = parentLayer;
    } else if (!ent.layer || ent.layer === '0') {
      layer = parentLayer || _resolveLayerName('0', floorTag);
    } else {
      layer = _resolveLayerName(rawLayer, floorTag);
    }

    foundLayers[layer] = true;

    if (ent.type === 'LINE' || ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
      const pts = ent.vertices || (ent.start && ent.end ? [ent.start, ent.end] : null);
      if (pts && pts.length >= 2) {
        for (let i = 0; i < pts.length - 1; i++) {
          if (pts[i].x !== undefined && pts[i + 1].x !== undefined) {
            const p1 = _transformPoint(pts[i], tx, ty, sx, sy, rad);
            const p2 = _transformPoint(pts[i + 1], tx, ty, sx, sy, rad);
            lines.push({ type: 'LINE', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, layer });
          }
        }
        if (ent.shape && pts.length >= 3) {
          const p1 = _transformPoint(pts[pts.length - 1], tx, ty, sx, sy, rad);
          const p2 = _transformPoint(pts[0], tx, ty, sx, sy, rad);
          lines.push({ type: 'LINE', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, layer });
        }
      }
    } else if (ent.type === 'SOLID' || ent.type === 'TRACE') {
      const pts = ent.points || ent.vertices;
      if (pts && pts.length >= 3) {
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if (a && b && a.x !== undefined && b.x !== undefined && (a.x !== b.x || a.y !== b.y)) {
            const p1 = _transformPoint(a, tx, ty, sx, sy, rad);
            const p2 = _transformPoint(b, tx, ty, sx, sy, rad);
            lines.push({ type: 'LINE', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, layer });
          }
        }
      }
    } else if (ent.type === 'TEXT' || ent.type === 'MTEXT') {
      const textStr = ent.text ?? ent.string ?? ent.value ?? '';
      const pos = ent.startPoint || ent.position || ent.insertionPoint;
      if (textStr !== undefined && pos && pos.x !== undefined) {
        const p = _transformPoint(pos, tx, ty, sx, sy, rad);
        const cleaned = _cleanDxfText(textStr);
        if (cleaned) {
          texts.push({ x: p.x, y: p.y, text: cleaned, layer });
        }
      }
    } else if (ent.type === 'POINT' || ent.type === 'CIRCLE') {
      const pos = ent.position || ent.center || ent.insertionPoint;
      if (pos && pos.x !== undefined) {
        const p = _transformPoint(pos, tx, ty, sx, sy, rad);
        points.push({ x: p.x, y: p.y, layer });
      }
    } else if (ent.type === 'INSERT') {
      const insPos = ent.position || ent.insertionPoint || { x: 0, y: 0 };
      const worldPos = _transformPoint(insPos, tx, ty, sx, sy, rad);
      points.push({ x: worldPos.x, y: worldPos.y, layer });

      const blk = dxf.blocks && dxf.blocks[ent.name];
      const childEnts = ent.entities || (blk && blk.entities);
      if (childEnts) {
        const basePos = (blk && blk.position) ? blk.position : { x: 0, y: 0 };
        const nsx = sx * (ent.xScale ?? 1);
        const nsy = sy * (ent.yScale ?? 1);
        const nrot = rotDeg + (ent.rotation ?? 0);
        const worldOrigin = _transformPoint(
          { x: (insPos.x || 0) - (basePos.x || 0), y: (insPos.y || 0) - (basePos.y || 0) },
          tx, ty, sx, sy, rad
        );
        _scanEntities(
          dxf, childEnts, layer, floorTag,
          lines, texts, points, foundLayers,
          worldOrigin.x, worldOrigin.y, nsx, nsy, nrot, depth + 1
        );
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
