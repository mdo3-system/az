// core/constants.js

// --- 金物マスターデータ (Hardware Master: Ra値は Jozan Ryusui氏指定の正確な許容耐力) ---
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
  { id: 'u35', name: 'U35', cap: 35.00 },
  { id: 'hi43', name: 'Hi43', cap: 43.00 },
  { id: 'hi68', name: 'Hi68', cap: 68.00 },
  { id: 'custom', name: '任意入力', cap: 0.0, isCustom: true }
];
window.HARDWARE_MASTER = HARDWARE_MASTER;

// --- アンカーボルト許容せん断耐力マスター (Jozan Ryusui氏指定値) ---
export const ANCHOR_BOLT_MASTER = {
  J1: { m12: 9.180, m16: 16.320 },
  J2: { m12: 8.620, m16: 15.330 },
  J3: { m12: 8.020, m16: 14.260 }
};
window.ANCHOR_BOLT_MASTER = ANCHOR_BOLT_MASTER;

// 計算時の許容誤差（距離や応力の微小誤差判定用）
export const STRESS_TOLERANCE = 50;

/**
 * 2つの座標がほぼ同一地点（許容誤差eps以内）か判定する
 */
export function isSamePoint(p1, p2, eps = STRESS_TOLERANCE) {
  if (!p1 || !p2) return false;
  return Math.hypot(p1.x - p2.x, p1.y - p2.y) < eps;
}
window.isSamePoint = isSamePoint;
