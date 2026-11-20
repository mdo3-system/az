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
  '下階柱': 'LOWER_PILLAR', // 下絵専用（構造柱 COL として取り込まない）
  '柱': 'COL',
  '耐力壁': 'WALL_BRACED',
  '壁': 'WALL_NORMAL'
};

const EXCLUDE_LAYER_KEYWORDS = ['DEFPOINTS', 'ASHB', 'WORK', 'TMP', '印刷外'];

// 通り芯・斜め軸・耐力壁の判定閾値 (単位: mm / 度)
const GRID_MIN_LINE_LEN    = 300;   // バルーン十字線(約105mm)を除外する最小長さ
const GRID_AUX_MAX_LEN     = 1200;  // 斜め軸用の短い補助通り芯(AX/AY: 711〜909mm)の上限長さ
const SKEW_ANGLE_MIN_DEG   = 5;     // 直交(0°/90°)から外れた斜め通り芯とみなす最小角度
const SKEW_MIN_LEN         = 1500;  // 斜め通り芯本線の最小長さ(A1: 9959mm)
const WALL_SNAP_TOL_MM     = 250;   // 耐力壁端点のノードスナップ許容距離(909mmモジュールの半分未満)
const DEFAULT_WALL_MULT    = 2.0;   // 倍率テキスト未取得時のデフォルト倍率

/** モジュール版数（キャッシュ混在検知用。APP_VERSION と常に一致させること） */
export const DXF_MODULE_VERSION = '3.2.13';

let _lastImportSummary = null;

/** 直近の DXF インポート検収サマリーを取得する */
export function getLastDxfImportSummary() {
  return _lastImportSummary;
}

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
  const wallCandidates = [];
  const foundLayers = {};

  const items = Array.isArray(parsedItems) ? parsedItems : [{ dxf: parsedItems, floorTag: null }];

  // 各階のエンティティ走査（INSERT ブロックの座標変換・再帰展開・文字結合・耐力壁抽出を含む）
  for (const { dxf, floorTag } of items) {
    if (!dxf || !dxf.entities) continue;
    _scanEntities(
      dxf, dxf.entities, null, floorTag,
      lines, texts, pointsAndCircles, wallCandidates, foundLayers
    );
  }

  const layerVisibility = {};
  Object.keys(foundLayers).forEach(l => (layerVisibility[l] = true));

  // 1. グリッド交点算出（直交軸・斜め軸・補助通り芯の分離）
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

  // 4. 柱の自動取り込み（純粋な COL レイヤーのみ。LOWER_PILLAR 等は除外）
  const colPoints = pointsAndCircles.filter(p => /^COL($|_)/.test((p.layer || '').toUpperCase()));
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

  // 5. 耐力壁の自動取り込み（WALL_BRACED レイヤー）
  const [{ normalizeAllFloors, normalizeWall }, { repairFoundationData }] = await Promise.all([
    import('./data/data_normalizer.js'),
    import('./foundation_cad.js')
  ]);

  const unmatchedWalls = [];
  const defaultMultiplierWalls = [];

  wallCandidates.forEach(wc => {
    const targetFloor = _resolveFloor((wc.layer || '').toUpperCase());
    if (!targetFloor || !floorData[targetFloor]) return;
    const nodes = floorData[targetFloor].nodes || [];

    const findNearestNodeIdx = (px, py) => {
      let bestDist = WALL_SNAP_TOL_MM;
      let bestIdx = -1;
      for (let i = 0; i < nodes.length; i++) {
        const d = Math.hypot(nodes[i].x - px, nodes[i].y - py);
        if (d <= bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      return bestIdx;
    };

    const n1 = findNearestNodeIdx(wc.p1.x, wc.p1.y);
    const n2 = findNearestNodeIdx(wc.p2.x, wc.p2.y);

    if (n1 === -1 || n2 === -1) {
      unmatchedWalls.push({
        floor: targetFloor,
        x1: Math.round(wc.p1.x),
        y1: Math.round(wc.p1.y),
        x2: Math.round(wc.p2.x),
        y2: Math.round(wc.p2.y),
        multiplier: wc.multiplier,
        reason: `ノード未到達 (${WALL_SNAP_TOL_MM}mm超)`
      });
      return;
    }
    if (n1 === n2) {
      unmatchedWalls.push({
        floor: targetFloor,
        x1: Math.round(wc.p1.x),
        y1: Math.round(wc.p1.y),
        x2: Math.round(wc.p2.x),
        y2: Math.round(wc.p2.y),
        multiplier: wc.multiplier,
        reason: '始終点が同一ノードにスナップ'
      });
      return;
    }

    if (wc.usedDefaultMultiplier) {
      defaultMultiplierWalls.push({
        floor: targetFloor,
        x1: Math.round(wc.p1.x),
        y1: Math.round(wc.p1.y),
        x2: Math.round(wc.p2.x),
        y2: Math.round(wc.p2.y),
        multiplier: wc.multiplier
      });
    }

    floorData[targetFloor].walls.push(normalizeWall({
      id: 'W' + nextId.wall++,
      n1,
      n2,
      multiplier: wc.multiplier,
      axisName: ''
    }));
  });

  // 6. DXFデータを store にセット（第6引数に斜め通り芯 dxfSkewedAxes を反映）
  setDxfData(lines, texts, layerVisibility, gridNodes.vAxes, gridNodes.hAxes, gridNodes.skewedAxes || []);

  // 7. 正規化・修復・ID再構築（await で直列完了）
  normalizeAllFloors(floorData);
  if (typeof repairFoundationData === 'function') repairFoundationData(floorData);
  if (typeof window.rebuildAllColumnIds === 'function') window.rebuildAllColumnIds();
  pushHistory();

  // 8. 検収サマリーを記録
  const uploadedFloors = Array.from(new Set(
    items
      .map(it => it.floorTag ? _resolveFloor('_' + String(it.floorTag).toUpperCase()) : null)
      .filter(Boolean)
  ));
  const floorStats = {};
  FLOORS.forEach(f => {
    const fd = floorData[f];
    if (fd) {
      floorStats[f] = {
        columns: (fd.columns || []).length,
        walls: (fd.walls || []).length,
        nodes: (fd.nodes || []).length
      };
    }
  });
  _lastImportSummary = {
    vAxesCount: (gridNodes.vAxes || []).length,
    hAxesCount: (gridNodes.hAxes || []).length,
    skewedAxesCount: (gridNodes.skewedAxes || []).length,
    skewedAxisLabels: (gridNodes.skewedAxes || []).map(a => a.label),
    auxAxisCount: gridNodes.auxAxisCount || 0,
    uploadedFloors,
    floors: floorStats,
    unmatchedWalls,
    defaultMultiplierWalls
  };

  console.log('[DXF-6] 正規化・修復・ID再構築 完了', _lastImportSummary);
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
 * ブロック内テキストを座標順（左→右、同Xなら上→下）に結合する
 */
function _mergeSplitTexts(blkTexts) {
  if (!blkTexts || blkTexts.length === 0) return '';
  if (blkTexts.length === 1) return blkTexts[0].text;
  const sorted = [...blkTexts].sort((a, b) => {
    if (Math.abs(a.x - b.x) > 5) return a.x - b.x;
    return b.y - a.y;
  });
  return sorted.map(t => t.text).join('').trim();
}

/**
 * DXF エンティティを再帰的に走査（INSERT ブロック座標変換を含む）してライン/テキスト/点/耐力壁候補を収集する
 */
function _scanEntities(dxf, entities, parentLayer, floorTag, lines, texts, points, wallCandidates, foundLayers, tx = 0, ty = 0, sx = 1, sy = 1, rotDeg = 0, depth = 0) {
  if (!entities || depth > 12) return;
  const rad = (rotDeg * Math.PI) / 180;

  entities.forEach(ent => {
    if (!ent) return;
    const rawLayer = String(ent.layer || '0');
    const rawUp = rawLayer.toUpperCase();
    if (EXCLUDE_LAYER_KEYWORDS.some(k => rawUp.includes(k))) return;

    let layer;
    if (parentLayer && (/^COL($|_)/.test(parentLayer.toUpperCase()) || parentLayer.includes('WALL') || parentLayer.includes('LOWER_PILLAR'))) {
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

        const isTopGridBlock = (depth === 0 && layer === 'GLID');
        const isTopBracedWallBlock = (depth === 0 && layer.toUpperCase().startsWith('WALL_BRACED'));

        if (isTopGridBlock || isTopBracedWallBlock) {
          // ブロック単位で要素を収集（通り芯の分割TEXT結合・耐力壁の最長線分＆倍率抽出のため）
          const blkLines = [];
          const blkTexts = [];
          const blkPoints = [];
          _scanEntities(
            dxf, childEnts, layer, floorTag,
            blkLines, blkTexts, blkPoints, wallCandidates, foundLayers,
            worldOrigin.x, worldOrigin.y, nsx, nsy, nrot, depth + 1
          );

          if (isTopGridBlock) {
            const mergedLabel = _mergeSplitTexts(blkTexts);
            if (mergedLabel) {
              const sortedT = [...blkTexts].sort((a, b) => a.x - b.x);
              texts.push({ x: sortedT[0].x, y: sortedT[0].y, text: mergedLabel, layer: 'GLID' });
            }
            // ブロック内最長線分に blockLabel を紐づけ（全線分は下絵用に格納）
            let longestLine = null;
            let maxLen = -1;
            blkLines.forEach(bl => {
              const len = Math.hypot(bl.x2 - bl.x1, bl.y2 - bl.y1);
              if (len > maxLen) { maxLen = len; longestLine = bl; }
            });
            if (longestLine && mergedLabel) {
              longestLine.blockLabel = mergedLabel;
            }
            lines.push(...blkLines);
            points.push(...blkPoints);
          } else if (isTopBracedWallBlock) {
            lines.push(...blkLines);
            texts.push(...blkTexts);
            points.push(...blkPoints);

            // 最長線分（壁本線）を抽出
            let longestLine = null;
            let maxLen = -1;
            blkLines.forEach(bl => {
              const len = Math.hypot(bl.x2 - bl.x1, bl.y2 - bl.y1);
              if (len > maxLen) { maxLen = len; longestLine = bl; }
            });

            if (longestLine && maxLen > 50) {
              const mergedText = _mergeSplitTexts(blkTexts);
              const parsedMult = parseFloat(mergedText);
              const hasValidMult = !isNaN(parsedMult) && parsedMult > 0;
              wallCandidates.push({
                layer,
                p1: { x: longestLine.x1, y: longestLine.y1 },
                p2: { x: longestLine.x2, y: longestLine.y2 },
                multiplier: hasValidMult ? parsedMult : DEFAULT_WALL_MULT,
                usedDefaultMultiplier: !hasValidMult,
                rawText: mergedText
              });
            }
          }
        } else {
          _scanEntities(
            dxf, childEnts, layer, floorTag,
            lines, texts, points, wallCandidates, foundLayers,
            worldOrigin.x, worldOrigin.y, nsx, nsy, nrot, depth + 1
          );
        }
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
 * グリッド線と通り芯テキストからノード・直交通り芯・斜め通り芯リストを生成する（純粋関数）
 *
 * 仕様:
 *  - バルーン十字線等の短線 (length < GRID_MIN_LINE_LEN) は除外
 *  - 斜め本線 (直交から SKEW_ANGLE_MIN_DEG 以上傾き、長さ >= SKEW_MIN_LEN) は skewedAxes (dxfSkewedAxes) へ登録
 *  - 斜め軸用の短い補助通り芯 (maxLen <= GRID_AUX_MAX_LEN、AX/AY等) は直交軸 vAxes/hAxes には残さず、
 *    斜め本線との交点ノード計算のみに使用して、AX×AY の不要な直交ノード生成を防ぐ
 */
function _computeGridIntersections(gridLines, texts, keepExisting) {
  const hLines = [], vLines = [], skewLines = [];

  gridLines.forEach(l => {
    const dx = Math.abs(l.x2 - l.x1);
    const dy = Math.abs(l.y2 - l.y1);
    const len = Math.hypot(dx, dy);

    // バルーン十字線（約105mm）等の短線を除外
    if (len < GRID_MIN_LINE_LEN) return;

    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI; // 0〜90°
    if (angleDeg >= SKEW_ANGLE_MIN_DEG && angleDeg <= (90 - SKEW_ANGLE_MIN_DEG) && len >= SKEW_MIN_LEN) {
      skewLines.push({ ...l, len });
    } else if (dx > dy * 3) {
      hLines.push({ ...l, len });
    } else if (dy > dx * 3) {
      vLines.push({ ...l, len });
    }
  });

  const allTexts = texts.filter(t =>
    t.layer.toUpperCase().includes('GRID') || t.layer.toUpperCase().includes('GLID')
  ).length > 0
    ? texts.filter(t => t.layer.toUpperCase().includes('GRID') || t.layer.toUpperCase().includes('GLID'))
    : texts;

  // --- 1. 斜め通り芯 (skewedAxes) の抽出・統合 ---
  const skewedAxes = [];
  if (keepExisting && window.dxfSkewedAxes) {
    window.dxfSkewedAxes.forEach(sa => skewedAxes.push({
      p1: { ...sa.p1 }, p2: { ...sa.p2 }, label: sa.label, lines: [{ x1: sa.p1.x, y1: sa.p1.y, x2: sa.p2.x, y2: sa.p2.y }]
    }));
  }
  let unknownSkewCount = 1;
  skewLines.forEach(sl => {
    const existing = skewedAxes.find(sa =>
      (Math.hypot(sa.p1.x - sl.x1, sa.p1.y - sl.y1) < 50 && Math.hypot(sa.p2.x - sl.x2, sa.p2.y - sl.y2) < 50) ||
      (Math.hypot(sa.p1.x - sl.x2, sa.p1.y - sl.y2) < 50 && Math.hypot(sa.p2.x - sl.x1, sa.p2.y - sl.y1) < 50)
    );
    if (existing) {
      existing.lines.push(sl);
      if (!existing.label && sl.blockLabel) existing.label = sl.blockLabel;
    } else {
      let label = sl.blockLabel || '';
      if (!label) {
        let bestDist = 1500;
        allTexts.forEach(t => {
          const d = Math.min(
            Math.hypot(t.x - sl.x1, t.y - sl.y1),
            Math.hypot(t.x - sl.x2, t.y - sl.y2)
          );
          if (d < bestDist) { bestDist = d; label = t.text.replace(/[{}\\lL]/g, '').trim(); }
        });
      }
      skewedAxes.push({
        p1: { x: sl.x1, y: sl.y1 },
        p2: { x: sl.x2, y: sl.y2 },
        label: label || ('斜め' + unknownSkewCount++),
        lines: [sl]
      });
    }
  });

  // --- 2. 垂直通り芯のグルーピング ---
  const rawVAxes = [];
  if (keepExisting && window.dxfVAxes) {
    window.dxfVAxes.forEach(ax => rawVAxes.push({ x: ax.x, label: ax.label, lines: [], maxLen: Infinity, isExisting: true }));
  }
  let unknownVXCount = 1;
  vLines.forEach(v => {
    const x = (v.x1 + v.x2) / 2;
    let axis = rawVAxes.find(a => Math.abs(a.x - x) < 10);
    if (!axis) { axis = { x, lines: [], maxLen: 0, blockLabel: '' }; rawVAxes.push(axis); }
    axis.lines.push(v);
    if (v.len > axis.maxLen) axis.maxLen = v.len;
    if (!axis.blockLabel && v.blockLabel) axis.blockLabel = v.blockLabel;
  });
  rawVAxes.forEach(a => {
    if (a.isExisting) return;
    if (a.blockLabel) {
      a.label = a.blockLabel;
      return;
    }
    let bestText = '', bestDist = 1500;
    allTexts.forEach(t => {
      const dx = Math.abs(t.x - a.x);
      if (dx < bestDist) { bestDist = dx; bestText = t.text.replace(/[{}\\lL]/g, '').trim(); }
    });
    a.label = bestText || ('無名X' + unknownVXCount++);
  });

  // --- 3. 水平通り芯のグルーピング ---
  const rawHAxes = [];
  if (keepExisting && window.dxfHAxes) {
    window.dxfHAxes.forEach(ax => rawHAxes.push({ y: ax.y, label: ax.label, lines: [], maxLen: Infinity, isExisting: true }));
  }
  let unknownHYCount = 1;
  hLines.forEach(h => {
    const y = (h.y1 + h.y2) / 2;
    let axis = rawHAxes.find(a => Math.abs(a.y - y) < 10);
    if (!axis) { axis = { y, lines: [], maxLen: 0, blockLabel: '' }; rawHAxes.push(axis); }
    axis.lines.push(h);
    if (h.len > axis.maxLen) axis.maxLen = h.len;
    if (!axis.blockLabel && h.blockLabel) axis.blockLabel = h.blockLabel;
  });
  rawHAxes.forEach(a => {
    if (a.isExisting) return;
    if (a.blockLabel) {
      a.label = a.blockLabel;
      return;
    }
    let bestText = '', bestDist = 1500;
    allTexts.forEach(t => {
      const dy = Math.abs(t.y - a.y);
      if (dy < bestDist) { bestDist = dy; bestText = t.text.replace(/[{}\\lL]/g, '').trim(); }
    });
    a.label = bestText || ('無名Y' + unknownHYCount++);
  });

  // --- 4. 補助通り芯（AX/AY 等の短線）と正式な直交通り芯の分離 ---
  const isAuxiliaryAxis = (ax) => {
    if (ax.isExisting) return false;
    if (ax.maxLen > GRID_AUX_MAX_LEN) return false;
    if (/^A[XY]\d+/i.test(ax.label || '')) return true;
    // ラベルが一致しない場合でも、斜め本線と交差する短線であれば補助通り芯とみなす
    return skewedAxes.some(sa =>
      ax.lines.some(al => _lineIntersect({ x1: sa.p1.x, y1: sa.p1.y, x2: sa.p2.x, y2: sa.p2.y }, al, 0.2) !== null)
    );
  };

  const vAxes = [], auxVAxes = [];
  rawVAxes.forEach(ax => (isAuxiliaryAxis(ax) ? auxVAxes : vAxes).push(ax));

  const hAxes = [], auxHAxes = [];
  rawHAxes.forEach(ax => (isAuxiliaryAxis(ax) ? auxHAxes : hAxes).push(ax));

  // --- 5. 交点ノード生成 ---
  const nodes = [];
  let nCounter = 1;
  const addNodeUnique = (id, x, y) => {
    if (!nodes.some(n => Math.hypot(n.x - x, n.y - y) < 10)) {
      nodes.push({ id: id || ('N' + nCounter++), x, y });
    }
  };

  // (a) 正式な直交通り芯同士の交点（auxVAxes × auxHAxes は絶対に生成しない）
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
        addNodeUnique((va.label && ha.label) ? (va.label + ha.label) : '', sumX / count, sumY / count);
      }
    });
  });

  // (b) 斜め本線 × 正式な直交通り芯の交点
  skewedAxes.forEach(sa => {
    const sSeg = { x1: sa.p1.x, y1: sa.p1.y, x2: sa.p2.x, y2: sa.p2.y };
    vAxes.forEach(va => {
      va.lines.forEach(vl => {
        const pt = _lineIntersect(sSeg, vl, 0.05);
        if (pt) addNodeUnique(`${sa.label}_${va.label}`, pt.x, pt.y);
      });
    });
    hAxes.forEach(ha => {
      ha.lines.forEach(hl => {
        const pt = _lineIntersect(sSeg, hl, 0.05);
        if (pt) addNodeUnique(`${sa.label}_${ha.label}`, pt.x, pt.y);
      });
    });
  });

  // (c) 斜め本線 × 補助通り芯（AX/AY）の交点のみ生成（斜め軸上の柱位置をノード化）
  skewedAxes.forEach(sa => {
    const sSeg = { x1: sa.p1.x, y1: sa.p1.y, x2: sa.p2.x, y2: sa.p2.y };
    [...auxVAxes, ...auxHAxes].forEach(aux => {
      aux.lines.forEach(al => {
        const pt = _lineIntersect(sSeg, al, 0.25);
        if (pt) addNodeUnique(`${sa.label}_${aux.label}`, pt.x, pt.y);
      });
    });
  });

  // dxfSkewedAxes 保存用にシンプルなオブジェクトへ整形
  const cleanSkewedAxes = skewedAxes.map(sa => ({
    p1: sa.p1,
    p2: sa.p2,
    label: sa.label
  }));

  return {
    nodes,
    vAxes,
    hAxes,
    skewedAxes: cleanSkewedAxes,
    auxAxisCount: auxVAxes.length + auxHAxes.length
  };
}

/**
 * 2 直線の交点を返す（純粋関数）
 */
function _lineIntersect(l1, l2, margin = 0.05) {
  const { x1, y1, x2, y2 } = l1;
  const x3 = l2.x1, y3 = l2.y1, x4 = l2.x2, y4 = l2.y2;
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-6) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  if (t >= -margin && t <= 1 + margin && u >= -margin && u <= 1 + margin) {
    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
  }
  return null;
}
