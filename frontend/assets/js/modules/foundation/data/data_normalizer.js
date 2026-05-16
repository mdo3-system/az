/**
 * data/data_normalizer.js
 * データの正規化・健全化モジュール
 * 
 * 目的:
 *   - 不正な値 (NaN, undefined) の排除
 *   - 欠落しているデフォルトプロパティの補完
 *   - データ型の強制 (文字列から数値への変換など)
 */

/** 数値として安全に変換するヘルパー */
function asNum(val, defaultValue = 0) {
  if (val === undefined || val === null || val === '') return defaultValue;
  const num = parseFloat(val);
  return isNaN(num) ? defaultValue : num;
}

/** ノードの正規化 */
export function normalizeNode(n) {
  return {
    id: n.id || '',
    x: asNum(n.x, 0),
    y: asNum(n.y, 0),
    index: n.index !== undefined ? parseInt(n.index) : undefined
  };
}

/** 耐力壁の正規化 */
export function normalizeWall(w) {
  return {
    id: w.id || '',
    n1: w.n1 !== undefined ? parseInt(w.n1) : -1,
    n2: w.n2 !== undefined ? parseInt(w.n2) : -1,
    multiplier: asNum(w.multiplier, 0),
    multiplier_x: asNum(w.multiplier_x, 0),
    multiplier_y: asNum(w.multiplier_y, 0),
    axisName: w.axisName || '',
    axis: w.axis || w.axisName || '', // 💡 axisプロパティも保持
    angle: asNum(w.angle, 0),
    length_m: asNum(w.length_m, 0),
    lengthOverride: w.lengthOverride || '',
    heightOverride: w.heightOverride || '', // 💡 階高個別設定
    showReport: w.showReport !== false,
    isExterior: !!w.isExterior,
    subType: w.subType || 'roof'
  };
}

/** 柱の正規化 */
export function normalizeColumn(c) {
  return {
    id: c.id || '',
    nodeIndex: c.nodeIndex !== undefined ? parseInt(c.nodeIndex) : -1,
    nw: asNum(c.nw !== undefined ? c.nw : (c.longTermAxial || c.force_long), 0), // 引張耐力検討用軸力
    biSetting: c.biSetting || 'auto', // N値計算用 Bi係数 (auto / 0.8 / 0.5)
    inflectionRatio: asNum(c.inflectionRatio !== undefined ? c.inflectionRatio : (c.ratio_b !== undefined ? c.ratio_b : 0.5), 0.5), // 反曲点高比B
    heightOverride: c.heightOverride || '', // 💡 壁連動階高
    showReport: c.showReport !== false,
    
    // 金物設定 (Top)
    top_metalMode: c.top_metalMode || 'auto',
    top_metalId: c.top_metalId || '',
    top_metalName: c.top_metalName || '',
    top_metalCap: asNum(c.top_metalCap, 0),

    // 金物設定 (Base)
    base_metalMode: c.base_metalMode || 'auto',
    base_metalId: c.base_metalId || '',
    base_metalName: c.base_metalName || '',
    base_metalCap: asNum(c.base_metalCap, 0),

    isCorner: !!c.isCorner, // 互換性のために保持
    
    // 手動補正プロパティ (ΣNi) - 軸ごとの詳細設定をサポート
    niUpperOverride_L: asNum(c.niUpperOverride_L, 0),
    niUpperOverride_R: asNum(c.niUpperOverride_R, 0),
    axisOverrides: c.axisOverrides || {} // { "X1": { L: 10, R: 5 }, ... }
  };
}

/** 基礎梁の正規化 */
export function normalizeBeam(b) {
  return {
    id: b.id || '',
    n1: b.n1 !== undefined ? parseInt(b.n1) : -1,
    n2: b.n2 !== undefined ? parseInt(b.n2) : -1,
    type: b.type || (b.id && b.id.startsWith('FB') ? 'foundation_beam' : 'beam'),
    axisName: b.axisName || b.axis || '',
    axis: b.axis || b.axisName || '', // 💡 axisプロパティも保持
    depth: asNum(b.depth, 600),   // 梁成 (mm)
    width: asNum(b.width, 150),   // 梁幅 (mm)
    topRebar: b.topRebar || '1-D13',
    bottomRebar: b.bottomRebar || '1-D13',
    stirrupRebar: b.stirrupRebar || 'D10',
    stirrupPitch: asNum(b.stirrupPitch, 200),
    dt: asNum(b.dt, 70),
    anchorM12: asNum(b.anchorM12, 0),
    anchorM16: asNum(b.anchorM16, 0),
    showReport: b.showReport !== false,
    // 応力・負担幅データも保持 (syncSlabDataToBeamsで上書きされるがロード時などは重要)
    tributaryWidth: asNum(b.tributaryWidth, 0),
    groundPressure: asNum(b.groundPressure, 0),
    spanLoads: b.spanLoads || [],
    
    // 💡 重要: スパン別詳細データ (spanProps, spans) を消失させないように保持
    spanProps: Array.isArray(b.spanProps) ? b.spanProps : (Array.isArray(b.spans) ? b.spans : []),
    spans: Array.isArray(b.spans) ? b.spans : (Array.isArray(b.spanProps) ? b.spanProps : []),
    
    // 応力データ等の中間計算値もロード・履歴復元用に保持
    stressData: b.stressData || null,
    calcResult: b.calcResult || null
  };
}

/** スラブの正規化 */
export function normalizeSlab(s) {
  // 厚みのエイリアス (D, t) を thickness に統一
  const thickness = asNum(s.thickness || s.D || s.t, 150);
  
  return {
    id: s.id || '',
    nodeIds: Array.isArray(s.nodeIds) ? s.nodeIds.map(id => parseInt(id)) : [],
    edgeConditions: Array.isArray(s.edgeConditions) ? s.edgeConditions : [],
    thickness: thickness,
    D: thickness, // 互換性のために保持
    t: thickness, // 互換性のために保持
    subType: s.subType || 'floor',
    showReport: s.showReport !== false,
    
    // 計算用の中間データが消えないように保持
    aijData: s.aijData || null,
    rebarX: s.rebarX || '',
    rebarY: s.rebarY || '',
    shortRebar: s.shortRebar || '',
    longRebar: s.longRebar || '',
    shortPitch: asNum(s.shortPitch, 200),
    longPitch: asNum(s.longPitch, 200),
    level: asNum(s.level, 0),
    dt: asNum(s.dt, 70),
    ft: asNum(s.ft, 195),
    supportCondition: s.supportCondition || '自動判定',

    // 💡 負担領域データも保持（これがないとロード直後に描画されない）
    tributaryPolygons: s.tributaryPolygons || [],
    edgeAreas: s.edgeAreas || [],
    edgeLs: s.edgeLs || [],
    edgeIsTriangle: s.edgeIsTriangle || [],
    groundPressure: asNum(s.groundPressure, 30.0)
  };
}

/** 水平構面の正規化 */
export function normalizeDiaphragm(d) {
  return {
    id: d.id || '',
    nodeIds: Array.isArray(d.nodeIds) ? d.nodeIds.map(id => parseInt(id)) : [],
    delta_qa: asNum(d.delta_qa, 0),
    skewAxisIndex: d.skewAxisIndex !== undefined ? (d.skewAxisIndex === null ? null : parseInt(d.skewAxisIndex)) : null,
    showReportEquiv: d.showReportEquiv !== false,
    showReportSkew: d.showReportSkew === true,
    hasIntermediateWall: !!d.hasIntermediateWall,
    subType: d.subType || 'floor'
  };
}

/** 階層データ全体の正規化（ディープコピーを兼ねる） */
export function normalizeFloorData(fd) {
  if (!fd) return null;

  return {
    ...fd,
    nodes: (fd.nodes || []).map(normalizeNode),
    walls: (fd.walls || []).map(normalizeWall),
    columns: (fd.columns || []).map(normalizeColumn),
    beams: (fd.beams || []).map(normalizeBeam),
    slabs: (fd.slabs || []).map(normalizeSlab),
    diaphragms: (fd.diaphragms || []).map(normalizeDiaphragm),
    floorHeight: asNum(fd.floorHeight, 2730)
  };
}

/** 全階層のデータを一括で正規化する */
export function normalizeAllFloors(allFloorData) {
  if (!allFloorData) return;
  const floors = ['PH', 'R', '3', '2', '1'];
  floors.forEach(f => {
    if (allFloorData[f]) {
      allFloorData[f] = normalizeFloorData(allFloorData[f]);
    }
  });
}
