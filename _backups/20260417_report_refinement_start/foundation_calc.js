import { floorData, currentFloor, FLOORS } from './foundation_cad.js';
// foundation_calc.js - 計算エンジンの分離

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
const STRESS_TOLERANCE = 50;

/**
 * 2つの座標がほぼ同一地点（許容誤差eps以内）か判定する
 */
function isSamePoint(p1, p2, eps = STRESS_TOLERANCE) {
  if (!p1 || !p2) return false;
  return Math.hypot(p1.x - p2.x, p1.y - p2.y) < eps;
}

export const computeBeamStress = window.computeBeamStress = function(fd, beam) {
  if (!beam || (!beam.n1 && !beam.n2)) return null;
  const n1 = fd.nodes[beam.n1];
  const n2 = fd.nodes[beam.n2];
  if (!n1 || !n2) return null;
  
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const totalL = Math.hypot(dx, dy) / 1000; // m
  if (totalL < 0.01) return null;
  
  const w_slab = beam.slabLoadW !== undefined ? beam.slabLoadW : ((beam.tributaryWidth || 0) * (beam.groundPressure || 0));
  const w_self = ((beam.width || 0) / 1000) * ((beam.depth || 0) / 1000) * 24;
  let w = w_slab + w_self; // kN/m
  if (w < 0.1) w = 10.0;   // 描画ロジック確認用のダミー値 (荷重未設定時)
  beam.totalLoad = w;
  
  const c1 = beam.startCondition || 'fixed';
  const c2 = beam.endCondition || 'fixed';
  
  // 支点の検索・ソート
  const supports = window.findSupportsOnBeam(beam, fd.nodes, fd.columns);
  
  const spans = [];
  let currentT = 0;
  
  for(let i = 0; i <= supports.length; i++) {
      const isFirst = (i === 0);
      const isLast = (i === supports.length);
      const endT = isLast ? 1.0 : supports[i].t;
      
      const spanL = (endT - currentT) * totalL;
      if (spanL < 0.01) { currentT = endT; continue; } // 極端に短いものは無視
      
      // 連続梁の近似として、内部の支点上は「固定(剛結)」として単純化する（安全側または簡略化）
      // あるいは、ユーザーの指定に基づいて境界条件を適用
      const spanC1 = isFirst ? c1 : 'fixed';
      const spanC2 = isLast ? c2 : 'fixed';
      
      const res = calculateSingleSpanStress({ w, L: spanL, c1: spanC1, c2: spanC2 });
      res.startFraction = currentT;
      res.endFraction = endT;
      spans.push(res);
      
      currentT = endT;
  }
  
  if (spans.length === 0) return null;

  // 全体代表値（プロパティ表示用など）
  const M1_total = spans[0].M1;
  const M2_total = spans[spans.length - 1].M2;
  const Mc_total = Math.max(...spans.map(s => s.Mc));
  const Q1_total = spans[0].Q1;
  const Q2_total = spans[spans.length - 1].Q2;

  // スパンごとの長期応力算定 (Mission 3)
  const longTermSpans = [];
  spans.forEach(s => {
    // ユーザー指定の数式に基づく算定: Mmid = w*L^2/8, Mend = w*L^2/12, QL = w*L/2
    // w は接地圧・負担幅に基づく値 (w_slab) を使用して資料に準拠
    const targetW = w_slab || 0;
    const M_mid = targetW * s.L * s.L / 8;
    const M_end = targetW * s.L * s.L / 12;
    const Q_L = targetW * s.L / 2;
    longTermSpans.push({ L: s.L, M_mid, M_end, Q_L });
  });
  beam.longTermSpans = longTermSpans;

  return { w, L: totalL, M1: M1_total, M2: M2_total, Mc: Mc_total, Q1: Q1_total, Q2: Q2_total, w_slab, w_self, spans, longTermSpans };
};

export function calculateSingleSpanStress({w, L, c1, c2}) {
  let M1 = 0, M2 = 0, Mc = 0, Q1 = 0, Q2 = 0;
  if (c1 === 'pin') c1 = 'pin'; else if (c1 !== 'cantilever') c1 = 'fixed';
  if (c2 === 'pin') c2 = 'pin'; else if (c2 !== 'cantilever') c2 = 'fixed';

  if (c1 === 'fixed' && c2 === 'fixed') {
    M1 = w * L * L / 12;
    M2 = w * L * L / 12;
    Mc = w * L * L / 24;
    Q1 = w * L / 2;
    Q2 = w * L / 2;
  } else if ((c1 === 'pin' && c2 === 'fixed') || (c1 === 'fixed' && c2 === 'pin')) {
    const isFixedStart = (c1 === 'fixed');
    M1 = isFixedStart ? (w * L * L / 8) : 0;
    M2 = isFixedStart ? 0 : (w * L * L / 8);
    Q1 = isFixedStart ? (5 * w * L / 8) : (3 * w * L / 8);
    Q2 = isFixedStart ? (3 * w * L / 8) : (5 * w * L / 8);
    const maxM = w * L * L / 8;
    Mc = maxM - (isFixedStart ? M1/2 : M2/2);
  } else if (c1 === 'cantilever' && c2 !== 'cantilever') {
    M1 = 0;
    M2 = w * L * L / 2;
    Q1 = 0;
    Q2 = w * L;
  } else if (c1 !== 'cantilever' && c2 === 'cantilever') {
    M1 = w * L * L / 2;
    M2 = 0;
    Q1 = w * L;
    Q2 = 0;
  } else {
    // pin-pin default
    M1 = 0; M2 = 0;
    Mc = w * L * L / 8;
    Q1 = w * L / 2;
    Q2 = w * L / 2;
  }
  return { L, M1, M2, Mc, Q1, Q2 };
}

export const findSupportsOnBeam = window.findSupportsOnBeam = function(beam, nodes, columns) {
    const n1 = nodes[beam.n1];
    const n2 = nodes[beam.n2];
    const supports = [];
    if(!n1 || !n2) return [];
    
    const l2 = Math.pow(n2.x - n1.x, 2) + Math.pow(n2.y - n1.y, 2);
    if(l2 === 0) return [];
    
    columns.forEach(col => {
        const cn = nodes[col.nodeIndex];
        if(!cn) return;
        // 梁ベクトルの内積を用いた投影位置 t (0〜1)
        const dx = n2.x - n1.x, dy = n2.y - n1.y;
        const L2 = dx * dx + dy * dy;
        const t = L2 === 0 ? 0 : ((cn.x - n1.x) * dx + (cn.y - n1.y) * dy) / L2;

        // 🚨 端点付近のわずかなはみ出し（5%）を許容して支点漏れを防ぐ
        if(t >= -0.05 && t <= 1.05) {
            const projX = n1.x + t * dx;
            const projY = n1.y + t * dy;
            const dist = Math.hypot(cn.x - projX, cn.y - projY);
            if (dist < STRESS_TOLERANCE) { // 許容誤差範囲なら支点としてみなす
                supports.push({ col, distFromStart: t * Math.sqrt(L2) / 1000, t });
            }
        }
    });
    // 距離順にソート
    supports.sort((a,b) => a.t - b.t);
    beam.internalSupports = supports;
    return supports;
};

export function clipPolygonStrict(poly, a, b, c) {
    const res = [];
    if (!poly || poly.length === 0) return [];
    
    for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];

        const d1 = a * p1.x + b * p1.y + c;
        const d2 = a * p2.x + b * p2.y + c;

        const in1 = d1 <= 1e-8;
        const in2 = d2 <= 1e-8;

        if (in1) {
            if (in2) {
                res.push(p2);
            } else {
                // 出点
                const t = d1 / (d1 - d2);
                res.push({ x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) });
            }
        } else if (in2) {
            // 入点
            const t = d1 / (d1 - d2);
            res.push({ x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) });
            res.push(p2);
        }
    }
    return res;
}

export function dedupPolygon(poly, eps = 5) {
    if (!poly || poly.length < 3) return poly;
    const out = [];
    for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        const prev = out.length > 0 ? out[out.length - 1] : null;
        if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) < eps) continue;
        out.push(p);
    }
    // 末尾と先頭の重複チェック
    if (out.length > 1) {
        const first = out[0], last = out[out.length - 1];
        if (Math.hypot(last.x - first.x, last.y - first.y) < eps) out.pop();
    }
    return out;
}

export function calcPolygonAreaStrict(poly) {
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
        area += (p1.x * p2.y - p2.x * p1.y);
    }
    return Math.abs(area) / 2;
}

export function distToBeamLine(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export const calculateSlabTributary = window.calculateSlabTributary = function(slab, nodes, beams) {
    // 🚨 [案1] ビセクタ（垂直二等分領域）分割ロジック：クリーン実装
    if (!slab.nodeIds || slab.nodeIds.length < 3) return;
    const initialPts = slab.nodeIds.map(nid => nodes[nid]).filter(Boolean);
    if (initialPts.length < 3) return;

    // 1. 向きのCCW正規化
    let signedArea = 0;
    for (let i = 0; i < initialPts.length; i++) {
        const p1 = initialPts[i], p2 = initialPts[(i + 1) % initialPts.length];
        signedArea += (p1.x * p2.y - p2.x * p1.y);
    }
    const CCW_PTS = signedArea > 0 ? [...initialPts] : [...initialPts].reverse();
    const NUM_PTS = CCW_PTS.length;

    // 2. 各辺の直線パラメータ事前算出 (n: 内向き法線, d: 方程式定数)
    const edgeLines = [];
    for (let i = 0; i < NUM_PTS; i++) {
        const p1 = CCW_PTS[i], p2 = CCW_PTS[(i + 1) % NUM_PTS];
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) continue;
        const nx = -dy / len, ny = dx / len; // 内向き
        const d = nx * p1.x + ny * p1.y;
        edgeLines.push({ p1, p2, nx, ny, d, len });
    }
    const NUM_EDGES = edgeLines.length;

    slab.tributaryPolygons = [];
    slab.edgeLs = [];
    slab.edgeAreas = [];
    slab.edgeLengths = []; // 辺の長さ Lo を保持用追加

    // 3. 各辺 i について、全辺に対する相対的負担領域を求める
    // Voronoi領域の定義: h_i(P) <= h_j(P) for all j
    for (let i = 0; i < NUM_EDGES; i++) {
        const Ei = edgeLines[i];
        let pi_poly = [...CCW_PTS]; // 初期はスラブ全体

        for (let j = 0; j < NUM_EDGES; j++) {
            if (i === j) continue;
            const Ej = edgeLines[j];

            // 二等分線の方程式: (ni - nj)・P + (dj - di) <= 0
            const coeffA = Ei.nx - Ej.nx;
            const coeffB = Ei.ny - Ej.ny;
            const coeffC = Ej.d - Ei.d;

            if (Math.hypot(coeffA, coeffB) > 1e-7) {
                pi_poly = clipPolygonStrict(pi_poly, coeffA, coeffB, coeffC);
            } else {
                // 平行な辺：遠い方の辺を排除
                if (coeffC > 1e-7) { pi_poly = []; }
            }
            if (pi_poly.length === 0) break;
        }

        // 4. 結果の格納と面積計算
        // -- 重複頂点(微小誤差起因)の除去 --
        const EPS_MM = 5; // 5mm 以内は同一点とみなす
        const deduped = dedupPolygon(pi_poly, EPS_MM);

        if (deduped.length >= 3) {
            const area_mm2 = calcPolygonAreaStrict(deduped);
            const area_m2 = area_mm2 / 1e6;
            const edgeLen_m = Ei.len / 1000;
            const mult = slab.triangleMultiplier || 1.33;
            // dedup後の頂点数が3なら三角形とみなして係数を適用
            const isTri = deduped.length === 3;
            // L = 面積 / 底辺長さ  (三角形の場合は係数を乗算)
            const finalL = isTri ? (area_m2 * mult) / edgeLen_m : area_m2 / edgeLen_m;

            console.log(`[Debug] ${slab.id}-B${i+1}: rawVerts=${pi_poly.length} dedupVerts=${deduped.length} isTri=${isTri} mult=${mult} finalL=${finalL.toFixed(3)}`);

            slab.tributaryPolygons.push(deduped);
            slab.edgeAreas.push(area_m2);
            slab.edgeLs.push(finalL);
            slab.edgeLengths.push(edgeLen_m);
        } else {
            slab.tributaryPolygons.push([]);
            slab.edgeAreas.push(0);
            slab.edgeLs.push(0);
            slab.edgeLengths.push(0);
        }
    }

    // [Debug] 計算結果をコンソールで検証
    console.log(`[Debug] ${slab.id} triangleMultiplier=${slab.triangleMultiplier}, edgeLs=`, slab.edgeLs);

    // 5. 既存機能（梁への荷重累積・N値計算用データ）との連動
    const pressure = slab.groundPressure || 20.0; // 🚨 デフォルト値を 20.0 とし、初期状態での 0 表示を回避
    
    for (let i = 0; i < slab.edgeLs.length; i++) {
        const L_val = slab.edgeLs[i];
        const length_m = edgeLines[i].len / 1000;
        if (L_val <= 0) continue;

        const totalLoad_kN = L_val * length_m * pressure;
        const midP_x = (edgeLines[i].p1.x + edgeLines[i].p2.x) / 2;
        const midP_y = (edgeLines[i].p1.y + edgeLines[i].p2.y) / 2;

        beams.forEach(b => {
            const node1 = nodes[b.n1], node2 = nodes[b.n2];
            if (!node1 || !node2) return;
            const dist = distToBeamLine(midP_x, midP_y, node1.x, node1.y, node2.x, node2.y);
            if (dist < STRESS_TOLERANCE) { // 🚨 許容誤差 STRESS_TOLERANCE 以内の近接梁に荷重を分担
                // デバッグログ：どの梁に接地圧が伝達されたか可視化
                if (pressure > 0) {
                    console.log(`[Debug] Slab ${slab.id} -> Beam ${b.id} dist:${dist.toFixed(1)} pressure:${pressure.toFixed(3)}`);
                }
                b.slabLoad = (b.slabLoad || 0) + totalLoad_kN;
                // 🚨 プロパティ名の二重化代入（新旧テンプレート互換性確保）
                const pMax = Math.max(b.groundPressure || 0, pressure);
                b.groundPressure = b.sigma_e = pMax;
                
                const aSum = (b.tributaryArea || 0) + (slab.edgeAreas[i] || 0);
                b.tributaryArea = b.A = aSum;
                
                const wSum = (b.tributaryWidth || 0) + (slab.edgeLs[i] || 0);
                b.tributaryWidth = b.B = wSum;
            }
        });
    }
};

export const calculateSlabStress = window.calculateSlabStress = function(slab, nodes) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    if (slab && slab.nodeIds && slab.nodeIds.length >= 3) {
      slab.nodeIds.forEach(nid => {
        const p = nodes[nid];
        if (p) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
      });
    }

    const W = minX === Infinity ? 0 : (maxX - minX) / 1000.0;
    const H = minY === Infinity ? 0 : (maxY - minY) / 1000.0;
    const lx = Math.max(0.01, Math.min(W, H));
    const ly = Math.max(0.01, Math.max(W, H));

    const sigma_e = slab ? (slab.groundPressure || 10.0) : 10.0;
    const D = slab ? (slab.D || slab.t || 150) : 150;
    
    // 応力中心間距離 j (有効せい d = D - 70.0mm 固定)
    const j = (7/8) * (D - 70.0);

    let cond = slab ? (slab.supportCondition || '4辺固定') : '4辺固定';
    const migrationMap = {
      '1辺ピン端': '3辺固定1辺ピン（長辺ピン）',
      '4辺ピン端': '4辺ピン',
      '3辺ピン（長辺接続）': '1辺固定3辺ピン（長辺固定）',
      '3辺ピン（短辺接続）': '1辺固定3辺ピン（短辺固定）'
    };
    if (migrationMap[cond]) cond = migrationMap[cond];

    const B = slab && slab.cantilever_B !== undefined ? parseFloat(slab.cantilever_B) : 0.9;
    const b = slab && slab.cantilever_b !== undefined ? parseFloat(slab.cantilever_b) : 0.15;

    // 異常値弾き（フェイルセーフ）
    if (lx <= 0 || ly <= 0 || sigma_e <= 0 || !slab || !slab.nodeIds || slab.nodeIds.length < 3) {
        return { lx:1.0, ly:1.0, Mx1: 0, Mx2: 0, My1: 0, My2: 0, sigma_ex: 0, w:0, cond:'4辺固定', B:0, b:0, D, j };
    }

    // 荷重分配の基本計算
    const sigma_ex = (Math.pow(ly, 4) / (Math.pow(lx, 4) + Math.pow(ly, 4))) * sigma_e;
    const lx2 = Math.pow(lx, 2);

    let Mx1 = 0, Mx2 = 0, My1 = 0, My2 = 0;

    switch (cond) {
        case '4辺固定':
            Mx1 = (1/12) * sigma_ex * lx2;
            Mx2 = (1/18) * sigma_ex * lx2;
            My1 = (1/24) * sigma_e * lx2;
            My2 = (1/36) * sigma_e * lx2;
            break;
        case '3辺固定1辺ピン（長辺ピン）':
            Mx1 = (1/9) * sigma_ex * lx2;
            Mx2 = (1/18) * sigma_ex * lx2;
            My1 = (1/14) * sigma_e * lx2;
            My2 = (1/36) * sigma_e * lx2;
            break;
        case '3辺固定1辺ピン（短辺ピン）':
            Mx1 = (1/14) * sigma_ex * lx2;
            Mx2 = (1/36) * sigma_ex * lx2;
            My1 = (1/9) * sigma_e * lx2;
            My2 = (1/18) * sigma_e * lx2;
            break;
        case '2隣辺固定2隣辺ピン':
            Mx1 = (1/8) * sigma_ex * lx2;
            Mx2 = (1/18) * sigma_ex * lx2;
            My1 = (1/12) * sigma_e * lx2;
            My2 = (1/36) * sigma_e * lx2;
            break;
        case '長辺2辺固定短辺2辺ピン':
            Mx1 = 0;
            Mx2 = 0;
            My1 = (1/12) * sigma_e * lx2;
            My2 = (1/24) * sigma_e * lx2;
            break;
        case '短辺2辺固定長辺2辺ピン':
            Mx1 = (1/12) * sigma_e * lx2;
            Mx2 = (1/24) * sigma_e * lx2;
            My1 = 0;
            My2 = 0;
            break;
        case '1辺固定3辺ピン（長辺固定）':
            Mx1 = (1/8) * sigma_ex * lx2;
            Mx2 = (1/8) * sigma_ex * lx2;
            My1 = 0;
            My2 = (1/27) * sigma_e * lx2;
            break;
        case '1辺固定3辺ピン（短辺固定）':
            Mx1 = 0;
            Mx2 = (1/8) * sigma_ex * lx2;
            My1 = (1/12) * sigma_e * lx2;
            My2 = (1/27) * sigma_e * lx2;
            break;
        case '4辺ピン':
            Mx1 = 0;
            Mx2 = (1/8) * sigma_ex * lx2;
            My1 = 0;
            My2 = (1/27) * sigma_e * lx2;
            break;
        case '片持ち(跳出し)':
        case '片持ち':
            Mx1 = 0.5 * sigma_e * Math.pow((B - (b / 2)), 2);
            Mx2 = 0;
            My1 = 0;
            My2 = 0;
            break;
        default:
            Mx1 = 0; Mx2 = 0; My1 = 0; My2 = 0;
            break;
    }

    return { lx, ly, Mx1, Mx2, My1, My2, sigma_ex, w: sigma_e, cond, B, b, D, j };
};

export const calculateAndSetSlabAIJStress = window.calculateAndSetSlabAIJStress = function(slab, nodes) {
    if (!slab || !nodes) return;
    
    // ▼ 既存の応力計算ロジック（9パターン等）を変更せずに呼び出す
    const stress = window.calculateSlabStress(slab, nodes);
    
    // スラブのプロパティ（UI用、未定義時はデフォルト）
    const t = slab.t !== undefined ? slab.t : (slab.D !== undefined ? slab.D : 150);
    const dt = slab.dt !== undefined ? slab.dt : 70;
    const ft = slab.ft !== undefined ? slab.ft : 195;
    const w = slab.groundPressure !== undefined ? slab.groundPressure : 30.0;
    
    // Lxは短辺、Lyは長辺として計算されている
    const reqAtX = Math.max(stress.Mx1, stress.Mx2) * 1e6 / (ft * Math.max(stress.j, 1));
    const reqAtY = Math.max(stress.My1, stress.My2) * 1e6 / (ft * Math.max(stress.j, 1));
    
    const sR = slab.shortRebar || 'D10';
    const sP = slab.shortPitch !== undefined ? slab.shortPitch : 200;
    const lR = slab.longRebar || 'D10';
    const lP = slab.longPitch !== undefined ? slab.longPitch : 200;
    
    const actualAtX = window.getRebarArea(sR) * (1000 / Math.max(sP, 1));
    const actualAtY = window.getRebarArea(lR) * (1000 / Math.max(lP, 1));
    
    const ratioX = reqAtX / actualAtX;
    const ratioY = reqAtY / actualAtY;
    
    slab.aijData = {
        lx: stress.lx,
        ly: stress.ly,
        lambda: stress.ly / stress.lx,
        cond: stress.cond,
        w: w,             // モーダルが参照する変数
        t: t,             // モーダルが参照する変数
        dt: dt,           // モーダルが参照する変数
        ft: ft,           // モーダルが参照する変数
        Mx1: stress.Mx1, Mx2: stress.Mx2, 
        My1: stress.My1, My2: stress.My2,
        shortLabel: '短辺',
        longLabel: '長辺',
        reqAtX, reqAtY, 
        actualAtX, actualAtY, 
        ratioX, ratioY,
        isOK: (ratioX <= 1.0 && ratioY <= 1.0),
        sR: sR, sP: sP,
        lR: lR, lP: lP
    };
};

export const calculateDiaphragmProps = window.calculateDiaphragmProps = function() {
    // 🚨 修正：window.floorData の欠落対策として、モジュールの floorData にもフォールバック
    const targetData = (typeof floorData !== 'undefined' ? floorData : null) || window.floorData;
    
    if (!targetData) {
        console.warn("[System] calculateDiaphragmProps: floorDataが見つからないため計算をスキップします。");
        return;
    }
    
    Object.keys(targetData).forEach(floorKey => {
        const fd = targetData[floorKey];
        if (!fd || !fd.diaphragms) return;

        fd.diaphragms.forEach(diaph => {
            // 1. ジオメトリの強制再計算（靴ひも公式）
            if (diaph.nodeIds && diaph.nodeIds.length >= 3 && fd.nodes) {
                const pts = diaph.nodeIds.map(nid => fd.nodes[nid]).filter(Boolean);
                if (pts.length >= 3) {
                    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                    let calcArea = 0;
                    
                    for (let i = 0; i < pts.length; i++) {
                        const p1 = pts[i];
                        const p2 = pts[(i + 1) % pts.length];
                        minX = Math.min(minX, p1.x); 
                        maxX = Math.max(maxX, p1.x);
                        minY = Math.min(minY, p1.y); 
                        maxY = Math.max(maxY, p1.y);
                        calcArea += (p1.x * p2.y) - (p2.x * p1.y);
                    }
                    diaph.BBox_X = (maxX - minX) / 1000;
                    diaph.BBox_Y = (maxY - minY) / 1000;
                    diaph.area = Math.abs(calcArea) / 2 / 1000000;
                    
                    diaph.Lx = diaph.BBox_X;
                    diaph.Ly = diaph.BBox_Y;
                }
            }

            const S = diaph.area || 0;
            const X = diaph.BBox_X || 0;
            const Y = diaph.BBox_Y || 0;

            if (X > 0 && Y > 0 && S > 0) {
                diaph.Lx_eq = S / Y;
                diaph.Ly_eq = S / X;

                diaph.eta_x = Math.min(1.0, diaph.Lx_eq / X);
                diaph.eta_y = Math.min(1.0, diaph.Ly_eq / Y);

                diaph.W_design_x = diaph.Lx_eq * diaph.eta_x;
                diaph.W_design_y = diaph.Ly_eq * diaph.eta_y;
                
                diaph.Lex = diaph.W_design_x;
                diaph.Ley = diaph.W_design_y;
            } else {
                diaph.Lx_eq = X; diaph.Ly_eq = Y;
                diaph.eta_x = 1.0; diaph.eta_y = 1.0;
                diaph.W_design_x = X; diaph.W_design_y = Y;
                diaph.Lex = X; diaph.Ley = Y;
            }

            const dQa = diaph.delta_qa || diaph.Qa || 0;
            diaph.qx = dQa * diaph.Lex;
            diaph.qy = dQa * diaph.Ley;
        });
    });
};

export const calculateWallProps = window.calculateWallProps = function(wall, nodes) {
    if (!wall || !nodes) return;
    try {
        const n1 = nodes[wall.n1];
        const n2 = nodes[wall.n2];
        if (!n1 || !n2) return;

        const dx = (n2.x - n1.x);
        const dy = (n2.y - n1.y);
        const L = Math.hypot(dx, dy);
        if (L < 1) return;

        let angleRad_X = Math.atan2(dy, dx);
        let angleDeg_X = angleRad_X * 180 / Math.PI;
        
        let thetaDeg = 90 - angleDeg_X;
        while (thetaDeg < 0) thetaDeg += 180;
        while (thetaDeg >= 180) thetaDeg -= 180;

        if (thetaDeg < 10 || thetaDeg > 170) thetaDeg = 0;
        else if (Math.abs(90 - thetaDeg) < 10) thetaDeg = 90;

        wall.angle = thetaDeg; 

        const thetaRad = thetaDeg * Math.PI / 180;
        const cos2 = Math.pow(Math.cos(thetaRad), 2);
        const sin2 = Math.pow(Math.sin(thetaRad), 2);

        const M = wall.multiplier !== undefined ? parseFloat(wall.multiplier) : 1.0;
        
        wall.multiplier_x = M * sin2;
        wall.multiplier_y = M * cos2;
        wall.length_m = L / 1000;

        wall.calcFormulaX = `${M} × cos²(${angleDeg_X.toFixed(1)}°) = ${wall.multiplier_x.toFixed(3)}`;
        wall.calcFormulaY = `${M} × sin²(${angleDeg_X.toFixed(1)}°) = ${wall.multiplier_y.toFixed(3)}`;
        
        return { Mx: wall.multiplier_x, My: wall.multiplier_y, L_m: wall.length_m, angle: angleDeg_X };
    } catch (err) {
        console.warn("Wall calculation failed:", err);
    }
};

export const calculateColumnT = window.calculateColumnT = window.calculatePulloutForce = function(colIndex, fd, currentFloorKey) {
  const fk = currentFloorKey || currentFloor;
  const col = fd.columns[colIndex];
  if (!col) return { T: 0, metal: '-', ratio: 0, cases: [], criticalCase: { name: '-' } };

  const nodeIdx = col.nodeIndex;
  const targetNode = fd.nodes[nodeIdx];
  if (!targetNode) return { T: 0, metal: '-', ratio: 0, cases: [], criticalCase: { name: '-' } };

  // --- Bi係数判定ルール（柱頭 0.5固定 / 柱脚 0.5 or 0.8） ---
  var getBi = function(fCol) {
    var isCorner = (fCol && fCol.biSetting === '0.8');
    return { top: 0.5, bot: isCorner ? 0.8 : 0.5 };
  };

  var axisResults = {};
  var floorList = FLOORS;
  var targetFloorIdx = floorList.indexOf(fk);

  for (var i = 0; i <= targetFloorIdx; i++) {
    var fKey = floorList[i];
    var fData = floorData[fKey];
    var isCurrentFloor = (fKey === fk);
    if (!fData || !fData.nodes || !fData.columns) continue;

    var cIdx = fData.columns.findIndex(function(c) {
      var n = fData.nodes[c.nodeIndex];
      return n && Math.hypot(n.x - targetNode.x, n.y - targetNode.y) < STRESS_TOLERANCE;
    });
    if (cIdx === -1) continue;

    var fCol = fData.columns[cIdx];
    var fNodeIdx = fCol.nodeIndex;
    var Hi = (fCol.heightOverride || fData.floorHeight || 2730) / 1000;
    
    var biObj = getBi(fCol);
    var currentBiTop = biObj.top;
    var currentBiBot = biObj.bot;

    var allWalls = (fData.walls || []).filter(function(w) { 
        var nW1 = fData.nodes[w.n1], nW2 = fData.nodes[w.n2];
        var isLinked = (w.n1 === fNodeIdx || w.n2 === fNodeIdx) ||
                       (nW1 && isSamePoint(nW1, fData.nodes[fNodeIdx], STRESS_TOLERANCE)) ||
                       (nW2 && isSamePoint(nW2, fData.nodes[fNodeIdx], STRESS_TOLERANCE));
        return isLinked && w.axisName; 
    });
    var groups = {};
    allWalls.forEach(function(w) {
      if (!groups[w.axisName]) groups[w.axisName] = [];
      groups[w.axisName].push(w);
    });

    Object.keys(groups).forEach(function(axisName) {
      if (!axisResults[axisName]) {
        axisResults[axisName] = { 
          axisName: axisName, sum_Qail_Hi: 0, sum_Qair_Hi: 0, 
          sum_Ni_upper: 0, 
          Ni_top_this: 0, Ni_bot_this: 0,
          Bi_top: currentBiTop, Bi_bot: currentBiBot
        };
      }
      var res = axisResults[axisName];
      var qail = 0, qair = 0;
      var nCenter = fData.nodes[fNodeIdx];
      
      groups[axisName].forEach(function(w) {
        var onidx = (w.n1 === fNodeIdx) ? w.n2 : w.n1;
        var nRemote = fData.nodes[onidx];
        if (!nRemote || !nCenter) return;
        var pMult = parseFloat(w.multiplier);
        var multVal = isNaN(pMult) ? 1.0 : pMult;
        var deltaQ_Hi = 1.96 * multVal * Hi;
        var isRight = (nRemote.x > nCenter.x) || (nRemote.x === nCenter.x && nRemote.y > nCenter.y);
        if (isRight) qair += deltaQ_Hi; else qail += deltaQ_Hi;
      });

      var deltaPower = qair - qail;
      if (isCurrentFloor) {
        res.Ni_top_this = deltaPower * currentBiTop;
        res.Ni_bot_this = deltaPower * currentBiBot;
        res.sum_Qail_Hi = qail;
        res.sum_Qair_Hi = qair;
        res.Bi_top = currentBiTop;
        res.Bi_bot = currentBiBot;
      } else {
        // 上階累計には柱脚側(Ni_bot)を蓄積
        res.sum_Ni_upper += deltaPower * currentBiBot;
      }
    });
  }

  // 🚨 Nw (長期軸力) の取得を堅牢化: nw, longTermAxial, axialLoad のいずれかから取得
  var nw = parseFloat(col.nw !== undefined ? col.nw : (col.longTermAxial !== undefined ? col.longTermAxial : (col.axialLoad !== undefined ? col.axialLoad : 0))) || 0;
  var reduction = 0.6 * nw;

  var getAutoMetal = function(T) {
    var table = HARDWARE_MASTER.filter(function(m) { return !m.isCustom; });
    if (T <= 0.0001) return HARDWARE_MASTER[0]; 
    for (var j = 0; j < table.length; j++) {
      // ✅ 減歩した耐力（cap - 0.5）で判定して自動選定を行う
      const checkCap = table[j].cap > 0.01 ? table[j].cap - 0.5 : table[j].cap;
      if (T <= checkCap) return table[j];
    }
    return table[table.length - 1];
  };

  var getMetalInfo = function(mode, mId, mCap, mName, aMetal) {
    if (mode === 'manual') {
      var capVal = parseFloat(mCap) || 0;
      var master = HARDWARE_MASTER.find(function(m) { return m.id === mId; });
      var nameVal = mName || (master ? master.name : (mId === 'custom' ? '任意金物' : '未定義'));
      return { name: nameVal, cap: capVal, isManual: true };
    }
    return { name: aMetal.name, cap: aMetal.cap, isManual: false };
  };

  var cases = [];
  Object.keys(axisResults).forEach(function(axisName) {
    var res = axisResults[axisName];
    var dirs = [ { name: '左から (→)', sign: 1 }, { name: '右から (←)', sign: -1 } ];
    dirs.forEach(function(d) {
      const sign = d.sign;
      var ni_top_this = res.Ni_top_this * sign;
      var ni_bot_this = res.Ni_bot_this * sign;
      var ni_upper = res.sum_Ni_upper * sign;
      
      var T_top_raw = (ni_top_this + ni_upper) - reduction;
      var T_bot_raw = (ni_bot_this + ni_upper) - reduction;

      var topInfo = getMetalInfo(col.top_metalMode, col.top_metalId, col.top_metalCap, col.top_metalName, getAutoMetal(T_top_raw));
      var baseInfo = getMetalInfo(col.base_metalMode, col.base_metalId, col.base_metalCap, col.base_metalName, getAutoMetal(T_bot_raw));

      cases.push({
        name: axisName + ' ' + d.name,
        q1_Hi: res.sum_Qail_Hi, q2_Hi: res.sum_Qair_Hi,
        Bi_top: res.Bi_top, Bi_bot: res.Bi_bot,
        Ni_top: ni_top_this, Ni_bot: ni_bot_this, Ni_upper: ni_upper,
        totalNi_top: ni_top_this + ni_upper, totalNi_bot: ni_bot_this + ni_upper,
        T_top: T_top_raw, T_bot: T_bot_raw,
        Ne_top: ni_top_this + ni_upper, // 🚨絶対に係数を掛けない（純粋な地震時軸力）
        Ne_bot: ni_bot_this + ni_upper, // 🚨絶対に係数を掛けない（純粋な地震時軸力）
        topMetal: topInfo, baseMetal: baseInfo,
        isTopOk: (T_top_raw <= 0.0001 || T_top_raw <= (topInfo.cap > 0.01 ? topInfo.cap - 0.5 : topInfo.cap)),
        isBaseOk: (T_bot_raw <= 0.0001 || T_bot_raw <= (baseInfo.cap > 0.01 ? baseInfo.cap - 0.5 : baseInfo.cap))
      });
    });
  });

  if (cases.length === 0) return { T: 0, metal: '対象外', cases: [], Nw: nw, criticalCase: { name: '対象外' } };
  
  var crit = cases[0];
  for (var k = 0; k < cases.length; k++) {
    var cMax = Math.max(cases[k].T_top, cases[k].T_bot);
    var rMax = Math.max(crit.T_top, crit.T_bot);
    if (cMax > rMax) crit = cases[k];
  }

  return {
    T: Math.max(0, crit.T_bot), 
    T_top: Math.max(0, crit.T_top),
    Nw: nw, cases: cases, criticalCase: crit, Hi_m: (fd.floorHeight || 2730) / 1000
  };
};

export const calculateFoundationHorizontalStressData = window.calculateFoundationHorizontalStressData = function(beam, fd) {
  const n1 = fd.nodes[beam.n1];
  const n2 = fd.nodes[beam.n2];
  if (!n1 || !n2) return null;

  const supports = window.findSupportsOnBeam(beam, fd.nodes, fd.columns);
  const totalL = Math.hypot(n2.x - n1.x, n2.y - n1.y) / 1000;

  // 1. 計算ポイントの生成（始点、柱、終点）
  const rawPoints = [];
  rawPoints.push({ type: 'start', id: n1.id, x: n1.x, y: n1.y, dist: 0 });
  supports.forEach(s => {
    rawPoints.push({ 
      type: 'column', id: s.col.id, x: fd.nodes[s.col.nodeIndex].x, y: fd.nodes[s.col.nodeIndex].y, 
      dist: s.distFromStart, colIndex: fd.columns.indexOf(s.col) 
    });
  });
  rawPoints.push({ type: 'end', id: n2.id, x: n2.x, y: n2.y, dist: totalL });

  // 2. 距離順にソートし、重複（1mm未満）を排除（柱タイプを優先）
  rawPoints.sort((a, b) => a.dist - b.dist);
  const points = [];
  rawPoints.forEach(p => {
    const last = points[points.length - 1];
    if (last && Math.abs(last.dist - p.dist) < 0.001) {
      if (p.type === 'column') points[points.length - 1] = p;
      return;
    }
    points.push(p);
  });

  const isBeamHorizontal = Math.abs(n2.x - n1.x) > Math.abs(n2.y - n1.y);
  
  // 💡 壁の水平せん断力 (Q) を集計するループを追加
  let wallShearLoads = [];
  (fd.walls || []).forEach(w => {
    const wn1 = fd.nodes[w.n1], wn2 = fd.nodes[w.n2];
    if (!wn1 || !wn2) return;
    const wMidX = (wn1.x + wn2.x) / 2, wMidY = (wn1.y + wn2.y) / 2;
    
    // 梁の線分に対する壁中点の距離と位置係数tを算出
    const dx = n2.x - n1.x, dy = n2.y - n1.y;
    const l2_beam = dx * dx + dy * dy;
    const t = l2_beam === 0 ? 0 : ((wMidX - n1.x) * dx + (wMidY - n1.y) * dy) / l2_beam;
    const projX = n1.x + t * dx, projY = n1.y + t * dy;
    const dist = Math.hypot(wMidX - projX, wMidY - projY);

    // デバッグログの出力
    console.log("[Debug] Beam", beam.id, "checking wall", w.id, "Distance:", dist.toFixed(1), "t:", t.toFixed(2));

    // 🚨 判定緩和：50mm以内 かつ 範囲内（5%のはみ出し許容）
    if (dist < STRESS_TOLERANCE && t >= -0.05 && t <= 1.05) {
      const mult = isBeamHorizontal ? (w.multiplier_y || 0) : (w.multiplier_x || 0);
      const Q_wall = 1.96 * mult * (w.length_m || 0);
      if (Q_wall > 0) {
        wallShearLoads.push({ t, Q: Q_wall });
      }
    }
  });

  const calcDir = (mode) => {
    const results = [];
    let sum_Td = 0;
    let sum_Q_wall = 0;
    let sum_M_at_start = 0;

    points.forEach(p => {
      let Td = 0;
      let cIdx = -1;
      
      if (p.type === 'column') {
        cIdx = p.colIndex;
      } else {
        cIdx = fd.columns.findIndex(c => {
          const cn = fd.nodes[c.nodeIndex];
          return cn && isSamePoint(cn, p, STRESS_TOLERANCE);
        });
      }

      if (cIdx !== -1) {
        const res = calculateColumnT(cIdx, fd, '1');
        const axisMode = mode === 'L' ? '左から' : '右から';
        const beamAxis = beam.axisName || beam.axis;
        
        let targetCase = null;
        if (beamAxis) {
          // 通り芯名の完全一致または部分一致をより柔軟に判定
          targetCase = (res.cases || []).find(c => {
             const cleanAxis = beamAxis.replace('通り', '').trim();
             return c.name.includes(cleanAxis) && c.name.includes(axisMode);
          });
        }
        
        if (!targetCase) {
          const matchingDirs = (res.cases || []).filter(c => c.name.includes(axisMode));
          if (matchingDirs.length > 0) {
            // 🚨 T_bot ではなく「絶対値が最も大きい Ne_bot」を採用する
            targetCase = matchingDirs.reduce((prev, curr) => (Math.abs(curr.Ne_bot) > Math.abs(prev.Ne_bot)) ? curr : prev);
          }
        }

        // 🚨 低減前の地震時軸力変動(Ne_bot)をそのまま基礎梁のTdに渡す
        Td = (targetCase && targetCase.Ne_bot !== undefined) ? targetCase.Ne_bot : 0;
        
        // デバッグログ：どのケースが採用されたか出力
        console.log(`[Debug] Beam: ${beam.id}, Axis: ${beamAxis || 'none'}, Direction: ${mode}, Selected Td(Ne_bot): ${Td.toFixed(3)} from Case: ${targetCase ? targetCase.name : 'N/A'}`);
        console.log(`  -> Ne_bot(low reduce前)=${(targetCase?.Ne_bot||0).toFixed(3)}, T_bot(low reduce後)=${(targetCase?.T_bot||0).toFixed(3)}`);
      }
      p[`temp_Td_${mode}`] = Td;
      sum_Td += Td;
      sum_M_at_start += Td * p.dist;
    });

    // 壁のせん断力によるモーメントと合計せん断力を加算
    wallShearLoads.forEach(wl => {
      sum_Q_wall += wl.Q;
      sum_M_at_start += wl.Q * (wl.t * totalL);
    });

    // 🚨 片持ちスパンを考慮した反力(R)の計算
    // 支点（柱）のインデックスを取得
    const colIndices = points.map((p, idx) => p.type === 'column' ? idx : -1).filter(i => i !== -1);
    
    let supportIdx1, supportIdx2;
    if (colIndices.length === 0) {
      // 柱がない場合は従来通り両端を支点とする
      supportIdx1 = 0;
      supportIdx2 = points.length - 1;
    } else if (colIndices.length === 1) {
      // 支点が1つの場合はその1点のみ
      supportIdx1 = colIndices[0];
      supportIdx2 = colIndices[0];
    } else {
      // 複数ある場合は最初と最後の柱を主支点とする（静定計算）
      supportIdx1 = colIndices[0];
      supportIdx2 = colIndices[colIndices.length - 1];
    }

    const d1 = points[supportIdx1].dist;
    const d2 = points[supportIdx2].dist;
    const supportL = d2 - d1;

    // 支点1（左端の柱）まわりのモーメント集計
    let sum_M_at_s1 = 0;
    points.forEach(p => {
      sum_M_at_s1 += p[`temp_Td_${mode}`] * (p.dist - d1);
    });
    wallShearLoads.forEach(wl => {
      sum_M_at_s1 += wl.Q * (wl.t * totalL - d1);
    });

    let R1 = 0, R2 = 0;
    if (supportL > 0.001) {
      R2 = -sum_M_at_s1 / supportL;
      R1 = -(sum_Td + sum_Q_wall) - R2;
    } else {
      R1 = -(sum_Td + sum_Q_wall);
      R2 = 0;
    }

    let qe = 0;
    let m_water = 0;
    let prevDist = 0;

    points.forEach((p, i) => {
      // 特定の支点インデックスに対して反力を割り当て
      let R = 0;
      if (i === supportIdx1) R += R1;
      if (i === supportIdx2 && supportIdx1 !== supportIdx2) R += R2;
      
      const current_Td = p[`temp_Td_${mode}`];
      
      // 当該スパン（一つ前のポイントから今のポイントまで）に含まれる壁のQを追加
      let spanQ = 0;
      const currentDist = p.dist;
      wallShearLoads.forEach(wl => {
        const wDist = wl.t * totalL;
        if (wDist > prevDist && wDist <= currentDist) spanQ += wl.Q;
      });

      if (i > 0) m_water += qe * (p.dist - prevDist);
      qe += current_Td + R + spanQ;
      results.push({ Td: current_Td, R, Qe: qe, M_f: m_water });
      prevDist = p.dist;
    });
    return results;
  };

  return { points, resL: calcDir('L'), resR: calcDir('R'), totalL };
};

export const generateFoundationLongTermStressTable = window.generateFoundationLongTermStressTable = function(beam) {
  const fd = floorData[currentFloor];
  if (!fd || !beam) return '';
  
  // computeBeamStress を呼んで最新の longTermSpans を生成・取得
  const stress = window.computeBeamStress(fd, beam);
  const spans = (beam.longTermSpans || (stress ? stress.longTermSpans : [])) || [];
  if (spans.length === 0) return '';

  let rowsHtml = '';
  // 支点の名前（通り名）を取得
  const supports = window.findSupportsOnBeam(beam, fd.nodes, fd.columns);
  const n1 = fd.nodes[beam.n1];
  const n2 = fd.nodes[beam.n2];
  
  const pointNames = [n1?.id || 'Start'];
  supports.forEach(s => pointNames.push(s.col.id));
  pointNames.push(n2?.id || 'End');

  spans.forEach((s, i) => {
    const spanName = `${pointNames[i]}-${pointNames[i+1]}`;
    const sigma = beam.groundPressure || 0;
    const B = beam.tributaryWidth || 0;
    
    rowsHtml += `
      <tr style="text-align:right; border-bottom:1px solid #444;">
        <td style="text-align:center; padding:6px; border-right:1px solid #555; background:rgba(255,255,255,0.03);">${spanName}</td>
        <td style="padding:6px; border-right:1px solid #444;">${(s.L || 0).toFixed(3)}</td>
        <td style="padding:6px; border-right:1px solid #444;">${(sigma || 0).toFixed(3)}</td>
        <td style="padding:6px; border-right:1px solid #444;">${(B || 0).toFixed(3)}</td>
        <td style="padding:6px; border-right:1px solid #444; font-weight:bold; color:#f1c40f;">${(s.M_mid || 0).toFixed(3)}</td>
        <td style="padding:6px; border-right:1px solid #444;">${(s.M_end || 0).toFixed(3)}</td>
        <td style="padding:6px; color:#3498db;">${(s.Q_L || 0).toFixed(3)}</td>
      </tr>
    `;
  });

  return `
    <div style="margin-top:25px; padding:15px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid #555; width:100%; box-sizing:border-box;">
      <div style="color:var(--accent); font-weight:bold; font-size:13px; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
        <span style="font-size:16px;">📉</span> 7-3 基礎梁の断面と配筋の検定 (応力の算定 長期)
      </div>
      <div style="overflow-x:auto; border-radius:4px; border:1px solid #444;">
        <table style="width:100%; border-collapse:collapse; font-size:11px; color:#fff; min-width:600px; table-layout: fixed;">
          <thead>
            <tr style="background:#333; height:32px;">
              <th style="border:1px solid #555; width:120px;">支点間 (スパン)</th>
              <th style="border:1px solid #555;">長さ Lo (m)</th>
              <th style="border:1px solid #555;">σe (kN/m²)</th>
              <th style="border:1px solid #555;">負担幅 B (m)</th>
              <th style="border:1px solid #555; color:#f1c40f;">M中 (kN·m)</th>
              <th style="border:1px solid #555;">M端 (kN·m)</th>
              <th style="border:1px solid #555; color:#3498db;">QL (kN)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
};

export const generateFoundationHorizontalStressTable = window.generateFoundationHorizontalStressTable = function(beam, type, index, isPrinting = false) {
  const fd = floorData['1'];
  if (!fd || currentFloor !== '1') return '';
  
  const data = window.calculateFoundationHorizontalStressData(beam, fd);
  if (!data) return '';
  
  const supports = window.findSupportsOnBeam ? window.findSupportsOnBeam(beam, fd.nodes, fd.columns) : [];
  const ratios = Array.from(new Set(supports.map(s => s.col.inflectionRatio ?? 0.5))).sort();
  const bText = ratios.length > 0 ? ratios.join(', ') : "0.5";

  const { points, resL, resR } = data;
  
  // 印刷用カラースキームの設定
  const styles = {
    bgPanel: isPrinting ? '#fff' : 'rgba(0,0,0,0.25)',
    border: isPrinting ? '#000' : '#555',
    headerBg: isPrinting ? '#eee' : '#34495e',
    headerBg2: isPrinting ? '#f5f5f5' : '#2c3e50',
    rowBg: isPrinting ? '#fff' : 'rgba(255,255,255,0.02)',
    text: isPrinting ? '#000' : '#fff',
    textDim: isPrinting ? '#666' : '#aaa',
    accent: isPrinting ? '#d35400' : '#e67e22',
    longM: isPrinting ? '#000' : '#f1c40f',
    shortQ: isPrinting ? '#000' : '#3498db',
    ngText: '#ff0000',
    okText: isPrinting ? '#008000' : '#2ecc71'
  };

  const borderStyle = `border:1px solid ${styles.border};`;
  const padding = `padding:5px;`;
  
  // スラブ負担データの取得（既存の計算済みプロパティを参照）
  const tribWidth = beam.tributaryWidth || 0;
  const tribArea  = beam.tributaryArea  || (beam.groundPressure > 0 ? (beam.slabLoad / beam.groundPressure) : 0);

  // 印刷用カラースキームに対応したスラブ負担データ表示
  const slabInfoHtml = `
    <div style="font-size: 11px; margin-bottom: 12px; padding: 10px; border-radius: 4px; 
                color: ${isPrinting ? '#000' : styles.text}; 
                background: ${isPrinting ? '#fff' : styles.bgPanel}; 
                border: 1px solid ${isPrinting ? '#000' : styles.border}; 
                display: flex; gap: 20px; align-items: center;">
      <div style="font-weight:bold; border-right: 2px solid ${isPrinting ? '#000' : styles.accent}; padding-right: 15px;">スラブ負担データ</div>
      <div>
        負担面積 = <span style="font-weight:bold; color:${isPrinting ? '#000' : styles.accent};">${tribArea.toFixed(3)}</span> m²
      </div>
      <div style="color:${styles.border};">|</div>
      <div>
        等価負担幅 B = <span style="font-weight:bold; color:${isPrinting ? '#000' : styles.accent};">${tribWidth.toFixed(3)}</span> m (${(tribWidth * 1000).toFixed(0)} mm)
      </div>
    </div>
  `;

  // 1. 水平荷重時応力の算定表
  let rowsHtml = '';
  points.forEach((p, i) => {
    rowsHtml += `
      <tr style="text-align:right; border-bottom:1px solid ${isPrinting ? '#000' : '#444'}; color:${styles.text};">
        <td style="text-align:center; ${padding} ${borderStyle} background:${isPrinting ? '#fff' : 'rgba(255,255,255,0.02)'};">${p.id}</td>
        <td style="text-align:center; ${padding} ${borderStyle}">${(p.dist || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${(resL[i].Td || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${(resL[i].R || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle} background:${isPrinting ? '#eee' : 'rgba(46,204,113,0.05)'};">${(resL[i].Qe || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle} font-weight:bold; color:${styles.longM};">${(resL[i].M_f || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${(resR[i].Td || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${(resR[i].R || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle} background:${isPrinting ? '#eee' : 'rgba(231,76,60,0.05)'};">${(resR[i].Qe || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle} font-weight:bold; color:${styles.longM};">${(resR[i].M_f || 0).toFixed(3)}</td>
      </tr>
    `;
  });

  const stressPointsTable = `
    <div style="margin-top:25px; padding:15px; background:${styles.bgPanel}; border-radius:10px; border:1px solid ${styles.border}; width:100%; box-sizing:border-box;">
      ${slabInfoHtml}
      <div style="color:${styles.accent}; font-weight:bold; font-size:14px; margin-bottom:12px; display:flex; align-items:center; gap:10px; border-bottom:1px solid ${styles.border}; padding-bottom:8px;">
        <span style="font-size:18px;">📊</span> 応力の算定（水平荷重時） 反曲点高比 B = ${bText}
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:11px; color:${styles.text}; min-width:900px; table-layout: fixed;">
          <thead>
            <tr style="background:${styles.headerBg};">
              <th rowspan="2" style="${borderStyle} width:80px;">通り/座標</th>
              <th rowspan="2" style="${borderStyle} width:70px;">位置 (m)</th>
              <th colspan="4" style="${borderStyle} background:${isPrinting ? '#eee' : 'rgba(46,204,113,0.1)'};">地震時：左加力</th>
              <th colspan="4" style="${borderStyle} background:${isPrinting ? '#eee' : 'rgba(231,76,60,0.1)'};">地震時：右加力</th>
            </tr>
            <tr style="background:${styles.headerBg2};">
              <th style="${borderStyle}">Td(kN)</th>
              <th style="${borderStyle}">R(kN)</th>
              <th style="${borderStyle}">Qe(kN)</th>
              <th style="${borderStyle}">M水(kN･m)</th>
              <th style="${borderStyle}">Td(kN)</th>
              <th style="${borderStyle}">R(kN)</th>
              <th style="${borderStyle}">Qe(kN)</th>
              <th style="${borderStyle}">M水(kN･m)</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>
  `;

  const stress = window.computeBeamStress ? window.computeBeamStress(fd, beam) : null;
  const longSpans = (stress ? stress.longTermSpans : []) || [];
  
  const getSProp = (spanIdx, prop, def) => {
    // データ構造の移行: spans を優先、なければ spanProps から取得、なければデフォルト
    if (beam.spans && beam.spans[spanIdx] && beam.spans[spanIdx][prop] !== undefined) {
      return beam.spans[spanIdx][prop];
    }
    // 💡 バックアップとしての spanProps も参照（JSON読込からの復元用）
    if (beam.spanProps && beam.spanProps[spanIdx] && beam.spanProps[spanIdx][prop] !== undefined) {
      if (beam.spans && beam.spans[spanIdx]) {
         beam.spans[spanIdx][prop] = beam.spanProps[spanIdx][prop];
      }
      return beam.spanProps[spanIdx][prop];
    }
    return beam[prop] !== undefined ? beam[prop] : def;
  };

  // 構造の初期化（未構築時またはスパン数変更時）
  const requiredSpanCnt = points.length - 1;
  if (!beam.spans || beam.spans.length !== requiredSpanCnt) {
    if (!beam.spans) beam.spans = [];
    const spanCnt = requiredSpanCnt;
    for (let i = 0; i < spanCnt; i++) {
        if (beam.spans[i]) continue; // 既存データは保持
        const topR = getSProp(i, 'topRebar', '2-D16');
        const botR = getSProp(i, 'bottomRebar', '2-D16');
        const stirrup = getSProp(i, 'stirrup', 'D10');
        beam.spans[i] = {
            topRebar: topR,
            bottomRebar: botR,
            stirrup: stirrup,
            pitch: getSProp(i, 'pitch', 200),
            D: getSProp(i, 'depth', 640),
            b: getSProp(i, 'width', 300),
            dt: getSProp(i, 'dt', 70)
        };
    }
  }

  let table1Rows = '', table2Rows = '', table3Rows = '', table4Rows = '', table5Rows = '';

  // 短期せん断力係数 n（初期設定から取得、デフォルト2.0）
  const shortTermN = parseFloat((fd && fd.shortTermN) || window.shortTermN || 2.0);

  const spansCount = points.length - 1;
  for (let i = 0; i < spansCount; i++) {
    const spanName = `${points[i].id}～${points[i + 1].id}`;
    const spanLen = Math.hypot(points[i+1].x - points[i].x, points[i+1].y - points[i].y) / 1000;
    
    // スパン別プロパティの確定 (spans から取得)
    const s = beam.spans[i] || {};
    const sDepth = s.D || 640;
    const sWidth = s.b || 300;
    const sDt = s.dt || 70;
    const sTopR = s.topRebar || '2-D16';
    const sBotR = s.bottomRebar || '2-D16';
    const sStirrup = s.stirrup || 'D10';
    const sPitch = s.pitch || 200;
    
    // 断面積の自動計算
    const sAt = window.getRebarArea(sTopR);
    const sAtBot = window.getRebarArea(sBotR);
    const sAw = window.getRebarArea(sStirrup);
    
    const material = { ft: beam.ft || 195, fs: 0.7, fts: 295, fss: 1.05 };
    
    // ✅ 長期荷重・応力の算定
    const sB       = beam.tributaryWidth || 0;
    const sSigma   = beam.groundPressure || 0;
    const sW       = (sSigma * sB);
    
    const curM_mid = (sW * spanLen * spanLen) / 24.0;
    const curM_end = (sW * spanLen * spanLen) / 12.0;
    const curQ_L   = (sW * spanLen) / 2.0;

    const absMLongEnd = Math.abs(curM_end);
    const absMLongMid = Math.abs(curM_mid);
    const absQLong = Math.max(0.01, Math.abs(curQ_L));

    // 水平荷重時応力（左加力・右加力の左端/右端）
    const MeL_start = Math.abs(resL[i].M_f), MeL_end = Math.abs(resL[i+1].M_f);
    const QeL_e = Math.max(0.01, Math.abs(resL[i].Qe), Math.abs(resL[i+1].Qe));
    const MeR_start = Math.abs(resR[i].M_f), MeR_end = Math.abs(resR[i+1].M_f);
    const QeR_e = Math.max(0.01, Math.abs(resR[i].Qe), Math.abs(resR[i+1].Qe));

    // 応力の算定（短期）: M端+M水（左側=原点近い側 / 右側=原点遠い側）、Q + n×Qe
    // 左加力
    const Msht_L_left  = absMLongEnd + MeL_start;  // M端+M水 左側
    const Msht_L_right = absMLongEnd + MeL_end;    // M端+M水 右側
    const Qsht_L = absQLong + shortTermN * QeL_e;  // Q + n×Qe
    // 右加力
    const Msht_R_left  = absMLongEnd + MeR_start;
    const Msht_R_right = absMLongEnd + MeR_end;
    const Qsht_R = absQLong + shortTermN * QeR_e;

    // 耐力算定の呼び出し
    const d_m = (sDepth - sDt) / 1000;
    const alphaL = Math.max(1.0, Math.min(2.0, 4 / (absMLongEnd / (absQLong * d_m) + 1)));
    // 短期α: 短期増分のみで算定 α = 4 / ((M端+M水−M端長期) / ((Q+n×Qe)×d) + 1)
    const calcAlphaS = (Msht, Qsht) => {
      const Mshort = Math.max(0.01, Msht - absMLongEnd); // 短期増分のみ
      return Math.max(1.0, Math.min(2.0, 4 / (Mshort / (Qsht * d_m) + 1)));
    };
    const alphaS = Math.max(
      calcAlphaS(Math.max(Msht_L_left, Msht_L_right), Qsht_L),
      calcAlphaS(Math.max(Msht_R_left, Msht_R_right), Qsht_R)
    );

    const resStrength_T = calculateSpanStrength({ D: sDepth, b: sWidth, dt: sDt, at: sAt, aw: sAw, pitch: sPitch, alpha: alphaL }, material);
    const resStrength_B = calculateSpanStrength({ D: sDepth, b: sWidth, dt: sDt, at: sAtBot, aw: sAw, pitch: sPitch, alpha: alphaL }, material);
    const resStrength_S = calculateSpanStrength({ D: sDepth, b: sWidth, dt: sDt, at: sAt, aw: sAw, pitch: sPitch, alpha: alphaS }, material);

    const lMa_t = resStrength_T.Ma;
    const lMa_b = resStrength_B.Ma;
    const sMa_t = resStrength_T.Mas;
    const sMa_b = resStrength_B.Mas;
    const lQa   = resStrength_T.Qa;
    const sQa   = resStrength_S.Qas;
    const j_val = resStrength_T.j;

    table1Rows += `
      <tr style="text-align:right; border-bottom:1px solid ${isPrinting?'#000':'#444'}; color:${styles.text};">
        <td style="text-align:center; ${padding} ${borderStyle} background:${isPrinting?'#fff':'rgba(255,255,255,0.03)'};">${spanName}</td>
        <td style="${padding} ${borderStyle}">${(sSigma || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${(sB || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle} background:${isPrinting?'#eee':'rgba(255,255,255,0.02)'};">${(sW || 0).toFixed(3)}</td>
      </tr>
    `;

    table2Rows += `
      <tr style="text-align:right; border-bottom:1px solid ${isPrinting?'#000':'#444'}; color:${styles.text};">
        <td style="text-align:center; ${padding} ${borderStyle} background:${isPrinting?'#fff':'rgba(255,255,255,0.03)'};">${spanName}</td>
        <td style="${padding} ${borderStyle}">${Msht_L_left.toFixed(2)}</td>
        <td style="${padding} ${borderStyle}">${Msht_L_right.toFixed(2)}</td>
        <td style="${padding} ${borderStyle}">${Qsht_L.toFixed(2)}</td>
        <td style="${padding} ${borderStyle}">${Msht_R_left.toFixed(2)}</td>
        <td style="${padding} ${borderStyle}">${Msht_R_right.toFixed(2)}</td>
        <td style="${padding} ${borderStyle}">${Qsht_R.toFixed(2)}</td>
      </tr>
    `;

    const upProp = (p, v) => `window.updateBeamSpanProp('${type}', ${index}, ${i}, '${p}', ${v})`;
    const dDtInput = isPrinting ? `${sDepth} / ${sDt}` : `
          <input type="number" value="${sDepth}" style="width:40px; background:#000; color:#fff; border:1px solid #555; text-align:right;" onchange="${upProp('D', 'this.value')}">
          <span style="color:#666;">/</span>
          <input type="number" value="${sDt}" style="width:35px; background:#000; color:#aaa; border:1px solid #555; text-align:right;" onchange="${upProp('dt', 'this.value')}">`;
    const rebarSelect = (val, prop) => isPrinting ? val : `
      <select style="width:100%; background:#000; color:#fff; font-size:10px; border:1px solid #555;" onchange="${upProp(prop, 'this.value')}">
        ${['1-D13', '2-D13', '1-D16', '2-D16', '1-D16/1-D13', '1-D19', '2-D19', '1-D19/1-D13', '1-D19/1-D16', '2-D22'].map(o=>`<option value="${o}" ${val===o?'selected':''}>${o}</option>`).join('')}
      </select>`;
    const stirrupSelect = isPrinting ? sStirrup : `<select style="width:100%; background:#000; color:#fff; font-size:10px; border:1px solid #555;" onchange="${upProp('stirrup', 'this.value')}">${['D10', '2-D10', 'D13', '2-D13', 'D10/D13'].map(o=>`<option value="${o}" ${sStirrup===o?'selected':''}>${o}</option>`).join('')}</select>`;
    const pitchInput = isPrinting ? sPitch : `<input type="number" value="${sPitch}" style="width:45px; background:#000; color:#fff; border:1px solid #555; text-align:right;" onchange="${upProp('pitch', 'this.value')}">`;
    const widthInput = isPrinting ? sWidth : `<input type="number" value="${sWidth}" style="width:45px; background:#000; color:#fff; border:1px solid #555; text-align:right;" onchange="${upProp('b', 'this.value')}">`;

    table3Rows += `
      <tr style="text-align:right; border-bottom:1px solid ${isPrinting?'#000':'#444'}; color:${styles.text};">
        <td style="text-align:center; ${padding} ${borderStyle} background:${isPrinting?'#fff':'rgba(255,255,255,0.03)'};">${spanName}</td>
        <td style="${padding} ${borderStyle}">${dDtInput}</td>
        <td style="${padding} ${borderStyle}">${rebarSelect(sTopR, 'topRebar')}</td>
        <td style="${padding} ${borderStyle}">${sAt.toFixed(1)}</td>
        <td style="${padding} ${borderStyle} color:${styles.textDim};">${j_val.toFixed(1)}</td>
        <td style="${padding} ${borderStyle} font-weight:bold; color:${styles.longM};">${lMa_t.toFixed(2)}</td>
        <td style="${padding} ${borderStyle} font-weight:bold; color:${styles.accent};">${sMa_t.toFixed(2)}</td>
        <td style="${padding} ${borderStyle}">${rebarSelect(sBotR, 'bottomRebar')}</td>
        <td style="${padding} ${borderStyle}">${sAtBot.toFixed(1)}</td>
        <td style="${padding} ${borderStyle} color:${styles.textDim};">${j_val.toFixed(1)}</td>
        <td style="${padding} ${borderStyle} font-weight:bold; color:${styles.longM};">${lMa_b.toFixed(2)}</td>
        <td style="${padding} ${borderStyle} font-weight:bold; color:${styles.accent};">${sMa_b.toFixed(2)}</td>
      </tr>
    `;

    table4Rows += `
      <tr style="text-align:right; border-bottom:1px solid ${isPrinting?'#000':'#444'}; color:${styles.text};">
        <td style="text-align:center; ${padding} ${borderStyle} background:${isPrinting?'#fff':'rgba(255,255,255,0.03)'};">${spanName}</td>
        <td style="${padding} ${borderStyle}">${widthInput}</td>
        <td style="${padding} ${borderStyle}">${stirrupSelect}</td>
        <td style="${padding} ${borderStyle}">${sAw.toFixed(1)}</td>
        <td style="${padding} ${borderStyle}">${pitchInput}</td>
        <td style="${padding} ${borderStyle}">${(sAw/(sWidth*sPitch)).toFixed(5)}</td>
        <td style="${padding} ${borderStyle} color:${styles.textDim};">${alphaL.toFixed(2)}</td>
        <td style="${padding} ${borderStyle} font-weight:bold; color:${styles.shortQ};">${lQa.toFixed(2)}</td>
        <td style="${padding} ${borderStyle} color:${styles.textDim};">${alphaS.toFixed(2)}</td>
        <td style="${padding} ${borderStyle} font-weight:bold; color:${isPrinting?'#000':'#e74c3c'};">${sQa.toFixed(2)}</td>
      </tr>
    `;

    // 最新の耐力に基づいた検定比の算出
    const rL_mid = absMLongMid / lMa_b;      // M中（長期）/ 下端Ma
    const rL_end = absMLongEnd / lMa_t;      // M端（長期）/ 上端Ma
    const rL_Q   = absQLong / lQa;           // QL / lQa
    const rSL_M  = Math.max(Msht_L_left, Msht_L_right) / sMa_t;  // M端+M水 / sMa（左加力）
    const rSL_Q  = Qsht_L / sQa;            // Q+nQe / sQa（左加力）
    const rSR_M  = Math.max(Msht_R_left, Msht_R_right) / sMa_t;  // M端+M水 / sMa（右加力）
    const rSR_Q  = Qsht_R / sQa;            // Q+nQe / sQa（右加力）
    const maxR = Math.max(rL_mid || 0, rL_end || 0, rL_Q || 0, rSL_M || 0, rSL_Q || 0, rSR_M || 0, rSR_Q || 0);
    const isOk = maxR <= 1.0;

    table5Rows += `
      <tr style="text-align:right; border-bottom:1px solid ${isPrinting?'#000':'#444'}; color:${styles.text};">
        <td style="text-align:center; ${padding} ${borderStyle} background:${isPrinting?'#fff':'rgba(255,255,255,0.03)'};">${spanName}</td>
        <td style="${padding} ${borderStyle}">${rL_mid.toFixed(2)}</td>
        <td style="${padding} ${borderStyle}">${rL_end.toFixed(2)}</td>
        <td style="${padding} ${borderStyle}">${rL_Q.toFixed(2)}</td>
        <td style="${padding} ${borderStyle}">${rSL_M.toFixed(2)}</td>
        <td style="${padding} ${borderStyle}">${rSL_Q.toFixed(2)}</td>
        <td style="${padding} ${borderStyle}">${rSR_M.toFixed(2)}</td>
        <td style="${padding} ${borderStyle}">${rSR_Q.toFixed(2)}</td>
        <td style="text-align:center; ${padding} ${borderStyle} font-weight:bold; color:${isOk?styles.okText:styles.ngText};">${isOk?'OK':'NG'}</td>
      </tr>
    `;
  }

  const resultMatrix = `
    <div style="margin-top:25px; border-top:1px solid ${styles.border}; padding-top:20px; color:${styles.text};">
      <h4 style="color:${styles.accent}; margin-bottom:15px; border-left:4px solid ${styles.accent}; padding-left:10px;">📉 Architrend準拠 スパン別算定マトリックス</h4>
      
      <p style="color:${styles.textDim}; font-size:10px; margin-bottom:4px;">[表1] 荷重の算定 (長期・スラブ負担荷重)</p>
      <table style="width:100%; border-collapse:collapse; font-size:10px; border:${isPrinting?'1px solid #000':'1px solid #555'}; text-align:center; margin-bottom:20px;">
        <thead style="background:${styles.headerBg}; color:${isPrinting?'#000':'#fff'};">
          <tr><th style="${borderStyle}">対象スパン</th><th style="${borderStyle}">接地圧 q (kN/m²)</th><th style="${borderStyle}">負担幅 B (m)</th><th style="${borderStyle}">等分布荷重 w (kN/m)</th></tr>
        </thead>
        <tbody>${table1Rows}</tbody>
      </table>

      <p style="color:${styles.textDim}; font-size:10px; margin-bottom:4px;">[表2] 応力の算定 (短期) &nbsp; ◆短期せん断力 Q<sub>L</sub>+nQ<sub>e</sub> n= <strong>${shortTermN}</strong></p>
      <table style="width:100%; border-collapse:collapse; font-size:10px; border:${isPrinting?'1px solid #000':'1px solid #555'}; text-align:center; margin-bottom:20px;">
        <thead style="background:${styles.headerBg}; color:${isPrinting?'#000':'#fff'};">
          <tr><th rowspan="2" style="${borderStyle}">柱間</th><th colspan="3" style="${borderStyle} background:${isPrinting?'#eee':'rgba(46,204,113,0.05)'};">短期 左加力（下加力）</th><th colspan="3" style="${borderStyle} background:${isPrinting?'#eee':'rgba(231,76,60,0.05)'};">短期 右加力（上加力）</th></tr>
          <tr><th style="${borderStyle}">M端+M水<br>左側 (kN·m)</th><th style="${borderStyle}">M端+M水<br>右側 (kN·m)</th><th style="${borderStyle}">Q+${shortTermN}Qe<br>(kN)</th><th style="${borderStyle}">M端+M水<br>左側 (kN·m)</th><th style="${borderStyle}">M端+M水<br>右側 (kN·m)</th><th style="${borderStyle}">Q+${shortTermN}Qe<br>(kN)</th></tr>
        </thead>
        <tbody>${table2Rows}</tbody>
      </table>

      <p style="color:${styles.textDim}; font-size:10px; margin-bottom:4px;">[表3] 許容耐力の算定(1) [主筋] ${isPrinting?'':'※スパン別に編集可能'}</p>
      <table style="width:100%; border-collapse:collapse; font-size:10px; border:${isPrinting?'1px solid #000':'1px solid #555'}; text-align:center; margin-bottom:20px;">
        <thead style="background:${styles.headerBg2}; color:${isPrinting?'#000':'#fff'};">
          <tr><th rowspan="2" style="${borderStyle}">柱間</th><th rowspan="2" style="${borderStyle} width:90px;">基礎高さ D/dt</th><th colspan="5" style="${borderStyle} background:${isPrinting?'#f5f5f5':'rgba(241,196,15,0.05)'};">上端主筋</th><th colspan="5" style="${borderStyle} background:${isPrinting?'#f5f5f5':'rgba(241,196,15,0.05)'};">下端主筋</th></tr>
          <tr><th style="${borderStyle}">鉄筋</th><th style="${borderStyle}">at</th><th style="${borderStyle}">j</th><th style="${borderStyle}">長期 lMa</th><th style="${borderStyle}">短期 sMa</th><th style="${borderStyle}">鉄筋</th><th style="${borderStyle}">at</th><th style="${borderStyle}">j</th><th style="${borderStyle}">長期 lMa</th><th style="${borderStyle}">短期 sMa</th></tr>
        </thead>
        <tbody>${table3Rows}</tbody>
      </table>

      <p style="color:${styles.textDim}; font-size:10px; margin-bottom:4px;">[表4] 許容耐力の算定(2) [せん断補強筋] ${isPrinting?'':'※スパン別に編集可能'}</p>
      <table style="width:100%; border-collapse:collapse; font-size:10px; border:${isPrinting?'1px solid #000':'1px solid #555'}; text-align:center; margin-bottom:20px;">
        <thead style="background:${styles.headerBg2}; color:${isPrinting?'#000':'#fff'};">
          <tr><th rowspan="2" style="${borderStyle}">柱間</th><th rowspan="2" style="${borderStyle}">幅b</th><th colspan="3" style="${borderStyle}">スターラップ筋</th><th rowspan="2" style="${borderStyle}">Pw</th><th colspan="2" style="${borderStyle}">せん断長期</th><th colspan="2" style="${borderStyle}">せん断短期</th></tr>
          <tr><th style="${borderStyle}">鉄筋</th><th style="${borderStyle}">at</th><th style="${borderStyle}">ピッチ</th><th style="${borderStyle}">αL</th><th style="${borderStyle}">lQa</th><th style="${borderStyle}">αS</th><th style="${borderStyle}">sQa</th></tr>
        </thead>
        <tbody>${table4Rows}</tbody>
      </table>

      <p style="color:${styles.textDim}; font-size:10px; margin-bottom:4px;">[表5] 判定</p>
      <table style="width:100%; border-collapse:collapse; font-size:10px; border:${isPrinting?'2px solid #000':'2px solid #555'}; text-align:center; margin-bottom:20px;">
        <thead style="background:${isPrinting?'#ddd':'#1a1a1a'}; color:${styles.text};">
          <tr><th rowspan="2" style="${borderStyle}">柱間</th><th colspan="3" style="${borderStyle}">長期</th><th colspan="2" style="${borderStyle}">短期 左加力（下加力）</th><th colspan="2" style="${borderStyle}">短期 右加力（上加力）</th><th rowspan="2" style="${borderStyle}">判定</th></tr>
          <tr><th style="${borderStyle}">M中/<br>下端Ma</th><th style="${borderStyle}">M端/<br>上端Ma</th><th style="${borderStyle}">Q<sub>L</sub>/lQa</th><th style="${borderStyle}">M端+M水/<br>sMa</th><th style="${borderStyle}">Q+${shortTermN}Qe/<br>sQa</th><th style="${borderStyle}">M端+M水/<br>sMa</th><th style="${borderStyle}">Q+${shortTermN}Qe/<br>sQa</th></tr>
        </thead>
        <tbody>${table5Rows}</tbody>
      </table>
    </div>
  `;

  return stressPointsTable + resultMatrix;
};


export const getRebarArea = window.getRebarArea = function(spec) {
  if (!spec) return 0;
  if (typeof spec === 'number') return spec;
  const map = { 10: 71.3, 13: 126.7, 16: 198.6, 19: 286.5, 22: 387.1 };
  let sum = 0;
  String(spec).split('/').forEach(p => {
    const mm = p.match(/(?:(\d+)-)?D(\d+)/);
    if (mm) {
      const count = mm[1] ? parseInt(mm[1]) : 1;
      const size = mm[2];
      sum += count * (map[size] || 0);
    }
  });
  return sum;
};

/**
 * 基礎梁スパン別の許容耐力を算出する（Jozan Ryusui氏指定式）
 */
export const calculateSpanStrength = window.calculateSpanStrength = function(span, material = { ft: 195, fs: 0.7, fts: 295, fss: 1.05 }) {
    const b = span.b || 150;
    const D = span.D || 640;
    const dt = span.dt || 70;
    const at = span.at || 253.4;
    const aw = span.aw || 142.6;
    const p = span.pitch || 200;
    const alpha = span.alpha || 1.0; 

    const d = D - dt;
    const j = 0.875 * d; // 7/8d

    // 【表3】主筋の許容曲げ耐力
    const Ma = material.ft * at * j / 1000000;      // (kN·m)
    const Mas = material.fts * at * j / 1000000;    // (kN·m)

    // 【表4】あばら筋の許容せん断耐力
    const Qa = material.fs * b * j / 1000;           // (kN)
    const Qas = (material.fss * b * j + alpha * material.fts * (aw * j / p)) / 1000; // (kN)

    return { Ma, Mas, Qa, Qas, d, j };
};


