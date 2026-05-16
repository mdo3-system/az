// core/constants.js

export const APP_VERSION = '3.1.1';

/**
 * 許容誤差 (Tolerances)
 * 単位: mm
 */
export const TOLERANCES = {
  GRID_MATCH: 5,       // グリッド整合判定用 (全符号整合時など)
  STRUCTURAL_CONN: 50, // 構造的な接続判定用 (一般的なノード間)
  WALL_CONN: 10,       // 耐力壁の接合判定用 (柱・ノードへの吸着)
  CALC_EPSILON: 1.0,   // 計算判定時の微小バッファ (左右判定など)
  COORD_PRECISION: 0.001 // 座標計算の丸め精度
};

// 💡 互換性のためのエイリアス
export const STRESS_TOLERANCE = TOLERANCES.STRUCTURAL_CONN;

// --- 金物マスターデータ (Hardware Master) ---
export const HARDWARE_MASTER = [
  { id: 'none', name: '（不要／標準金物）', cap: 0.0 },
  { id: 'cpl', name: 'L字型かど金物 (CP-L)', cap: 3.38 },
  { id: 'cpt', name: 'T字型かど金物 (CP-T)', cap: 5.07 },
  { id: 'vp', name: '山形プレート (VP)', cap: 5.88 },
  { id: 'sbf2', name: '羽子板ボルト、短冊金物 (SB-F2)', cap: 7.50 },
  { id: 'sbf', name: '羽子板ボルト＋スクリュー釘 (SB-F)', cap: 8.50 },
  { id: 'hdb10', name: 'HD-B10', cap: 10.00 },
  { id: 'hdb15', name: 'HD-B15', cap: 15.00 },
  { id: 'hdb20', name: 'HD-B20', cap: 20.00 },
  { id: 'hdb25', name: 'HD-B25', cap: 25.00 },
  { id: 'u25', name: 'ビスどめホールダウン金物U25 (U25)', cap: 28.70 },
  { id: 'u35', name: 'U35', cap: 35.40 },
  { id: 'hi43', name: 'Hi43', cap: 43.70 },
  { id: 'hi68', name: 'Hi68', cap: 68.10 },
  { id: 'custom', name: '任意入力', cap: 0.0, isCustom: true }
];

// --- アンカーボルト許容せん断耐力マスター ---
export const ANCHOR_BOLT_MASTER = {
  J1: { m12: 9.180, m16: 16.320 },
  J2: { m12: 8.620, m16: 15.330 },
  J3: { m12: 8.020, m16: 14.260 }
};

/**
 * 2つの座標がほぼ同一地点（許容誤差eps以内）か判定する
 */
export function isSamePoint(p1, p2, eps = TOLERANCES.STRUCTURAL_CONN) {
  if (!p1 || !p2) return false;
  return Math.hypot(p1.x - p2.x, p1.y - p2.y) < eps;
}

// グローバル公開 (移行用)
window.HARDWARE_MASTER = HARDWARE_MASTER;
window.ANCHOR_BOLT_MASTER = ANCHOR_BOLT_MASTER;
window.isSamePoint = isSamePoint;
window.TOLERANCES = TOLERANCES;
