import { floorData, currentFloor, FLOORS, dxfVAxes, dxfHAxes } from './foundation_cad.js';
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

/**
 * 基礎梁の重複クリーンアップ (Mission 12)
 * 重複または包含関係にある梁のうち、最も長いセグメントを残して他を削除する。
 */
export const cleanupOverlappingBeams = window.cleanupOverlappingBeams = function(fd) {
  if (!fd) return;
  
  // 1. 全ての梁（手動・自動）を一旦フラットなリストとして抽出（元の配列への参照を保持）
  const allBeams = [
    ...(fd.beams || []).map((b, i) => ({ ...b, source: 'beams', originalIndex: i })),
    ...(fd.perimeterBeams || []).map((b, i) => ({ ...b, source: 'perimeterBeams', originalIndex: i }))
  ];

  if (allBeams.length < 2) return;

  const toRemove = { beams: new Set(), perimeterBeams: new Set() };

  // 2. 二重ループで重複・包含判定
  for (let i = 0; i < allBeams.length; i++) {
    for (let j = i + 1; j < allBeams.length; j++) {
      const b1 = allBeams[i];
      const b2 = allBeams[j];
      
      const n1a = fd.nodes[b1.n1], n1b = fd.nodes[b1.n2];
      const n2a = fd.nodes[b2.n1], n2b = fd.nodes[b2.n2];
      if (!n1a || !n1b || !n2a || !n2b) continue;

      // 同一線上かどうかの判定 (外積による共線判定)
      const isCollinear = checkCollinear(n1a, n1b, n2a, n2b);
      if (!isCollinear) continue;

      // 包含・重複関係の取得
      const overlap = getSegmentOverlap(n1a, n1b, n2a, n2b);
      
      if (overlap.type === 'contains') {
        // b1 が b2 を含んでいる場合 -> b2 を削除
        toRemove[b2.source].add(b2.originalIndex);
      } else if (overlap.type === 'containedBy') {
        // b2 が b1 を含んでいる場合 -> b1 を削除
        toRemove[b1.source].add(b1.originalIndex);
      } else if (overlap.type === 'identical') {
        // 全く同じ位置 -> perimeterBeams 側を優先的に消す（手動設定を優先）
        if (b1.source === 'perimeterBeams' && b2.source === 'beams') toRemove.perimeterBeams.add(b1.originalIndex);
        else if (b1.source === 'beams' && b2.source === 'perimeterBeams') toRemove.perimeterBeams.add(b2.originalIndex);
        else toRemove[b2.source].add(b2.originalIndex); // 両方同じ属性なら片方消す
      } else if (overlap.type === 'partialOverflow') {
         // 部分的な重複の場合（ユーザー指定：一部分は削除 -> 短い方を消す）
         if (overlap.l1 > overlap.l2) toRemove[b2.source].add(b2.originalIndex);
         else toRemove[b1.source].add(b1.originalIndex);
      }
    }
  }

  // 3. 実際の削除処理（インデックスがずれないよう降順で削除）
  const bList = Array.from(toRemove.beams).sort((a, b) => b - a);
  bList.forEach(idx => fd.beams.splice(idx, 1));

  const pList = Array.from(toRemove.perimeterBeams).sort((a, b) => b - a);
  pList.forEach(idx => fd.perimeterBeams.splice(idx, 1));

  if (bList.length > 0 || pList.length > 0) {
    console.log(`[cleanupOverlappingBeams] 重複除去: beams=${bList.length}, perimeterBeams=${pList.length}`);
  }
};

/**
 * 同一の軸名（通り芯）を持つ基礎梁を一本の連続した梁に自動統合する
 */
export const autoMergeCollinearBeams = window.autoMergeCollinearBeams = function(fd) {
    if (!fd || !fd.nodes) return;

    // 1. 全ての基礎梁を収集
    const allBeamRefs = [
        ...(fd.beams || []).map((b, i) => ({ ...b, source: 'beams', originalIndex: i })),
        ...(fd.perimeterBeams || []).map((b, i) => ({ ...b, source: 'perimeterBeams', originalIndex: i }))
    ].filter(b => b.axisName && (b.type === 'foundation_beam' || !b.type || b.source === 'perimeterBeams'));

    if (allBeamRefs.length === 0) return;

    // 💡 文脈に応じた端点判定の拡張
    const colNodeSet = new Set((fd.columns || []).map(c => c.nodeIndex));
    const slabNodeSet = new Set((fd.slabs || []).flatMap(s => s.nodeIds || []));
    
    // 全要素の接続数をカウント（交差点判定用）
    const nodeConnCount = {};
    const nodeAxes = {}; // 各ノードに接続されている軸名のセット
    [...(fd.beams || []), ...(fd.perimeterBeams || []), ...(fd.walls || [])].forEach(it => {
        [it.n1, it.n2].forEach(nid => {
            if (nid === undefined) return;
            nodeConnCount[nid] = (nodeConnCount[nid] || 0) + 1;
            if (!nodeAxes[nid]) nodeAxes[nid] = new Set();
            if (it.axisName) nodeAxes[nid].add(it.axisName);
        });
    });

    const isValidEndpoint = (nid) => {
        if (colNodeSet.has(nid)) return true; // 柱がある
        if (slabNodeSet.has(nid)) return true; // スラブの角
        if ((nodeConnCount[nid] || 0) >= 3) return true; // T字路以上の交差点
        if (nodeAxes[nid] && nodeAxes[nid].size >= 2) return true; // 異なる軸が交差している
        return false;
    };

    // 2. 軸名ごとにグループ化
    const groups = {};
    allBeamRefs.forEach(b => {
        if (!groups[b.axisName]) groups[b.axisName] = [];
        groups[b.axisName].push(b);
    });

    const toRemove = { beams: new Set(), perimeterBeams: new Set() };
    const newBeamsToAdd = [];

    Object.keys(groups).forEach(axName => {
        const group = groups[axName];
        if (group.length < 2) return;

        const subgroups = [];
        const processed = new Set();
        for (let i = 0; i < group.length; i++) {
            if (processed.has(i)) continue;
            const currentSubgroup = [group[i]];
            processed.add(i);
            const n1 = fd.nodes[group[i].n1], n2 = fd.nodes[group[i].n2];
            for (let j = i + 1; j < group.length; j++) {
                if (processed.has(j)) continue;
                const n3 = fd.nodes[group[j].n1], n4 = fd.nodes[group[j].n2];
                if (checkCollinear(n1, n2, n3, n4)) {
                    currentSubgroup.push(group[j]);
                    processed.add(j);
                }
            }
            subgroups.push(currentSubgroup);
        }

        subgroups.forEach(sub => {
            if (sub.length < 2) return;
            const n0a = fd.nodes[sub[0].n1], n0b = fd.nodes[sub[0].n2];
            const isHorizontal = Math.abs(n0b.x - n0a.x) > Math.abs(n0b.y - n0a.y);
            const getVal = (nid) => isHorizontal ? fd.nodes[nid].x : fd.nodes[nid].y;

            const items = sub.map(b => {
                const v1 = getVal(b.n1), v2 = getVal(b.n2);
                return { b, s: Math.min(v1, v2), e: Math.max(v1, v2) };
            }).sort((a, b) => a.s - b.s);

            let currentCluster = [items[0]];
            const clusters = [currentCluster];
            for (let k = 1; k < items.length; k++) {
                const prev = currentCluster[currentCluster.length - 1];
                const curr = items[k];
                if (curr.s > (currentCluster.reduce((max, it) => Math.max(max, it.e), -Infinity) + 50)) {
                    currentCluster = [curr];
                    clusters.push(currentCluster);
                } else {
                    currentCluster.push(curr);
                }
            }

            clusters.forEach(cluster => {
                if (cluster.length < 2) return;
                let minV = Infinity, maxV = -Infinity;
                let startNode = null, endNode = null;
                let bestRep = cluster[0].b;
                let maxLen = -1;
                cluster.forEach(item => {
                    const b = item.b;
                    const n1 = fd.nodes[b.n1], n2 = fd.nodes[b.n2];
                    const len = Math.hypot(n1.x - n2.x, n1.y - n2.y);
                    if (len > maxLen) { maxLen = len; bestRep = b; }
                    [b.n1, b.n2].forEach(nid => {
                        const v = getVal(nid);
                        if (v < minV) { minV = v; startNode = nid; }
                        if (v > maxV) { maxV = v; endNode = nid; }
                    });
                    toRemove[b.source].add(b.originalIndex);
                });
                if (startNode !== null && endNode !== null && startNode !== endNode) {
                    // 💡 BUG FIX (Bug3): 端点ノードが柱またはスラブ頂点でなければ統合をスキップ
                    // これにより基礎梁がスラブ外周外に飛び出すことを防止する
                    if (!isValidEndpoint(startNode) || !isValidEndpoint(endNode)) {
                        console.warn(`[autoMergeCollinearBeams] ${axName}: 端点ノード[${startNode},${endNode}]が柱/スラブ外 → 統合をスキップ`);
                        // 削除予定から除外（元の梁を温存）
                        cluster.forEach(item => {
                            toRemove[item.b.source].delete(item.b.originalIndex);
                        });
                        return;
                    }
                    newBeamsToAdd.push({
                        ...bestRep,
                        type: 'foundation_beam',
                        n1: startNode,
                        n2: endNode,
                        id: axName + "_merged_" + Date.now().toString(36)
                    });
                }
            });
        });
    });

    // 6. 削除と追加の実行
    if (newBeamsToAdd.length > 0) {
        // 削除（降順）
        const bList = Array.from(toRemove.beams).sort((a, b) => b - a);
        bList.forEach(idx => fd.beams.splice(idx, 1));
        const pList = Array.from(toRemove.perimeterBeams).sort((a, b) => b - a);
        pList.forEach(idx => fd.perimeterBeams.splice(idx, 1));

        // 追加
        newBeamsToAdd.forEach(nb => fd.beams.push(nb));
        console.log(`[autoMergeCollinearBeams] 統合完了: ${newBeamsToAdd.length}本のマスター梁を生成`);
    }
};

/**
 * 2つのセグメントが同一線上にあるか判定
 */
function checkCollinear(p1, p2, p3, p4) {
  const area1 = Math.abs((p2.x - p1.x)*(p3.y - p1.y) - (p2.y - p1.y)*(p3.x - p1.x));
  const area2 = Math.abs((p2.x - p1.x)*(p4.y - p1.y) - (p2.y - p1.y)*(p4.x - p1.x));
  const eps = 20.0; // 20mm以内の誤差を許容（手作図の微差を吸収）
  return area1 < eps * 1000 && area2 < eps * 1000;
}

/**
 * 共線上の2つのセグメント [p1,p2] と [p3,p4] の重複タイプを返す
 */
function getSegmentOverlap(p1, p2, p3, p4) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const l1 = dist(p1, p2);
  const l2 = dist(p3, p4);
  
  // 1次元座標に変換（p1を原点とする）
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const project = (p) => {
    if (l1 < 1) return 0;
    return ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / l1;
  };

  const s1 = 0, e1 = l1;
  let s2 = project(p3), e2 = project(p4);
  if (s2 > e2) [s2, e2] = [e2, s2];

  const eps = 10.0; // 10mm
  
  // 完全一致
  if (Math.abs(s1 - s2) < eps && Math.abs(e1 - e2) < eps) return { type: 'identical', l1, l2 };

  // 包含
  if (s1 <= s2 + eps && e1 >= e2 - eps) return { type: 'contains', l1, l2 };
  if (s2 <= s1 + eps && e2 >= e1 - eps) return { type: 'containedBy', l1, l2 };

  // 部分重複判定
  const intersect = Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
  if (intersect > eps) return { type: 'partialOverflow', l1, l2 };

  return { type: 'none' };
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
  
  const w_slab_total = beam.slabLoadW !== undefined ? beam.slabLoadW : ((beam.tributaryWidth || 0) * (beam.groundPressure || 0));
  const w_self = ((beam.width || 0) / 1000) * ((beam.depth || 0) / 1000) * 24;
  let w_total = w_slab_total + w_self; 
  if (w_total < 0.1) w_total = 10.0;
  beam.totalLoad = w_total;
  
  const c1 = beam.startCondition || 'fixed';
  const c2 = beam.endCondition || 'fixed';
  
  // 支点の検索・ソート
  const supports = window.findSupportsOnBeam(beam, fd.nodes, fd.columns);
  
  const spans = [];
  let currentT = 0;
  
  for(let i = 0; i <= supports.length; i++) {
      const isFirst = (i === 0);
      const isLast = (i === supports.length);
      const startT = currentT;
      const endT = isLast ? 1.0 : supports[i].t;
      
      const spanL = (endT - startT) * totalL;
      if (spanL < 0.01) { currentT = endT; continue; }
      
      // 💡 スパンごとの荷重を取得 (event_handlers.js で作成された spanLoads)
      let currentW = w_total;
      let currentWSlab = w_slab_total;
      let currentB = beam.tributaryWidth || 0;
      let currentSigma = beam.groundPressure || 0;

      if (beam.spanLoads && beam.spanLoads.length > 0) {
          // 中央付近の t でマッチング
          const midT = (startT + endT) / 2;
          const sLoad = beam.spanLoads.find(sl => midT >= sl.sT && midT <= sl.eT) || beam.spanLoads[Math.min(i, beam.spanLoads.length-1)];
          if (sLoad) {
              currentWSlab = (sLoad.B || 0) * (sLoad.sigma_e || 0);
              currentW = currentWSlab + w_self;
              currentB = sLoad.B || 0;
              currentSigma = sLoad.sigma_e || 0;
          }
      }

      const spanC1 = isFirst ? c1 : 'fixed';
      const spanC2 = isLast ? c2 : 'fixed';
      
      const res = calculateSingleSpanStress({ w: currentW, L: spanL, c1: spanC1, c2: spanC2 });
      res.startFraction = startT;
      res.endFraction = endT;
      res.w_slab = currentWSlab; // スパンごとのスラブ荷重を保持
      res.B = currentB;           // スパンごとの負担幅を保持
      res.sigma_e = currentSigma; // スパンごとの接地圧を保持
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
    // スパン固有の w_slab を使用
    const targetW = s.w_slab !== undefined ? s.w_slab : w_slab_total;
    const M_mid = targetW * s.L * s.L / 8;
    const M_end = targetW * s.L * s.L / 12;
    const Q_L = targetW * s.L / 2;
    longTermSpans.push({ L: s.L, M_mid, M_end, Q_L, w_slab: targetW, B: s.B, sigma_e: s.sigma_e });
  });
  beam.longTermSpans = longTermSpans;

  return { w: w_total, L: totalL, M1: M1_total, M2: M2_total, Mc: Mc_total, Q1: Q1_total, Q2: Q2_total, w_slab: w_slab_total, w_self, spans, longTermSpans };
};

export function calculateSingleSpanStress({w, L, c1, c2}) {
  let M1 = 0, M2 = 0, Mc = 0, Q1 = 0, Q2 = 0;
  if (c1 === 'pin') c1 = 'pin'; else if (c1 !== 'cantilever') c1 = 'fixed';
  if (c2 === 'pin') c2 = 'pin'; else if (c2 !== 'cantilever') c2 = 'fixed';

  if (c1 === 'fixed' && c2 === 'fixed') {
    M1 = w * L * L / 12;
    M2 = w * L * L / 12;
    // 💡 資料の式に基づき M中 = wL^2/8 を適用
    Mc = w * L * L / 8;
    Q1 = w * L / 2;
    Q2 = w * L / 2;
  } else if ((c1 === 'pin' && c2 === 'fixed') || (c1 === 'fixed' && c2 === 'pin')) {
    const isFixedStart = (c1 === 'fixed');
    M1 = isFixedStart ? (w * L * L / 12) : 0; // 固定端は1/12
    M2 = isFixedStart ? 0 : (w * L * L / 12);
    // 💡 資料の式に基づき M中 = wL^2/8 を適用
    Mc = w * L * L / 8;
    Q1 = w * L / 2;
    Q2 = w * L / 2;
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

    const origPolygons = new Array(NUM_PTS).fill([]);
    const origAreas = new Array(NUM_PTS).fill(0);
    const origLs = new Array(NUM_PTS).fill(0);
    const origLengths = new Array(NUM_PTS).fill(0);

    for (let i = 0; i < NUM_PTS; i++) {
        // CW（右回り）で入力されていた場合、i番目のCCW辺は元配列のどの辺に対応するか逆算
        // 元 [A,B,C,D] (CW) -> 反転 [D,C,B,A] (CCW)
        // CCWの0番目(D->C) は 元の2番目(C->D) に対応する
        const origIdx = (signedArea > 0) ? i : (NUM_PTS - 2 - i + NUM_PTS) % NUM_PTS;
        origPolygons[origIdx] = slab.tributaryPolygons[i];
        origAreas[origIdx] = slab.edgeAreas[i];
        origLs[origIdx] = slab.edgeLs[i];
        origLengths[origIdx] = slab.edgeLengths[i];
    }

    slab.tributaryPolygons = origPolygons;
    slab.edgeAreas = origAreas;
    slab.edgeLs = origLs;
    slab.edgeLengths = origLengths;

    // [Debug] 計算結果をコンソールで検証
    console.log(`[Debug] ${slab.id} triangleMultiplier=${slab.triangleMultiplier}, edgeLs=`, slab.edgeLs);

    // 5. 以前の直接加算ロジックは、一元化(edgeMap方式)との競合を避けるため無効化
    // ※N値計算用にが必要な場合は、マスター梁の集計結果から参照されるように event_handlers.js 側で管理
    /*
    const pressure = slab.groundPressure || 20.0;
    for (let i = 0; i < slab.edgeLs.length; i++) {
        const L_val = slab.edgeLs[i];
        const length_m = edgeLines[i].len / 1000;
        if (L_val <= 0) continue;
        const totalLoad_kN = L_val * length_m * pressure;
        // beams.forEach(...) // 削除
    }
    */
};


/**
 * 支持条件の文字列を正規化する（全角括弧への統一など）
 */
export const normalizeSupportCondition = window.normalizeSupportCondition = function(cond) {
    if (!cond) return '4辺固定';
    // 半角括弧を全角に変換し、空白を除去
    let normalized = cond.replace(/\(/g, '（').replace(/\)/g, '）').replace(/\s+/g, '').trim();
    
    // 文字列の正規化（これらがあれば統一したものに変換する）
    const standardMap = {
        '3辺固定1辺ピン(長辺ピン)': '3辺固定1辺ピン（長辺ピン）',
        '3辺固定1辺ピン(短辺ピン)': '3辺固定1辺ピン（短辺ピン）',
        '3辺固定1辺ピン': '3辺固定1辺ピン（長辺ピン）',
        '1辺固定3辺ピン': '1辺固定3辺ピン（長辺固定）',
        '1辺固定3辺ピン(長辺固定)': '1辺固定3辺ピン（長辺固定）',
        '1辺固定3辺ピン(短辺固定)': '1辺固定3辺ピン（短辺固定）',
        '片持ち': '片持ち（跳出し）',
        '片持ち(跳出し)': '片持ち（跳出し）'
    };
    if (standardMap[normalized]) return standardMap[normalized];
    return normalized;
};

/**
 * 個別の辺の条件から支持条件パターンを自動判定する
 */
function autoDetectSlabSupportPattern(slab, nodes) {
    if (!slab || !slab.edgeConditions || slab.edgeConditions.length < 3) return '4辺固定';
    
    const conditions = slab.edgeConditions;
    const numEdges = conditions.length;
    
    let fixedCount = 0;
    let pinCount = 0;
    let freeCount = 0;
    
    conditions.forEach(c => {
        if (c === 'pin') pinCount++;
        else if (c === 'free') freeCount++;
        else fixedCount++; // デフォルトは固定
    });

    if (fixedCount === numEdges) return '4辺固定';
    if (pinCount === numEdges) return '4辺ピン';
    
    // 片持ち判定（1辺固定、他が自由）
    if (fixedCount === 1 && freeCount >= 2) return '片持ち(跳出し)';

    // 3辺固定1辺ピン
    if (fixedCount === 3 && pinCount === 1) {
        // 本来は長辺か短辺かを判定すべきだが、簡易的に一旦「長辺ピン」とするか、
        // 辺の長さを比較して判定する
        return '3辺固定1辺ピン（長辺ピン）';
    }

    // 2辺固定
    if (fixedCount === 2) {
        return '2隣辺固定2隣辺ピン';
    }
    
    // 1辺固定
    if (fixedCount === 1) {
        return '1辺固定3辺ピン（長辺固定）';
    }

    return '4辺固定';
}

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
    const D = slab ? (slab.thickness || slab.D || slab.t || 150) : 150;
    
    // 応力中心間距離 j (有効せい d = D - 70.0mm 固定)
    const j = (7/8) * (D - 70.0);

    let cond = slab ? (slab.supportCondition || '4辺固定') : '4辺固定';
    
    // --- 追加：自動判定の実行 ---
    if (cond === '自動判定' && slab) {
        cond = autoDetectSlabSupportPattern(slab, nodes);
    }
    
    // 文字列の揺れを吸収
    cond = normalizeSupportCondition(cond);

    const migrationMap = {
      '1辺ピン端': '3辺固定1辺ピン（長辺ピン）',
      '4辺ピン端': '4辺ピン',
      '3辺ピン（長辺接続）': '1辺固定3辺ピン（長辺固定）',
      '3辺ピン（短辺接続）': '1辺固定3辺ピン（短辺固定）',
      '2隣辺固定2隣辺ピン': '2辺隣辺固定2辺ピン',
      '長辺2辺固定短辺2辺ピン': '2辺長辺固定2辺ピン',
      '短辺2辺固定長辺2辺ピン': '2辺短辺固定2辺ピン'
    };
    if (migrationMap[cond]) cond = migrationMap[cond];
    else cond = normalizeSupportCondition(cond); // 再度正規化を掛けて不一致を防ぐ

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
        case '2辺隣辺固定2辺ピン':
            Mx1 = (1/8) * sigma_ex * lx2;
            Mx2 = (1/18) * sigma_ex * lx2;
            My1 = (1/12) * sigma_e * lx2;
            My2 = (1/36) * sigma_e * lx2;
            break;
        case '2辺長辺固定2辺ピン':
            Mx1 = 0;
            Mx2 = 0;
            My1 = (1/12) * sigma_e * lx2;
            My2 = (1/24) * sigma_e * lx2;
            break;
        case '2辺短辺固定2辺ピン':
            Mx1 = (1/12) * sigma_e * lx2;
            Mx2 = (1/24) * sigma_e * lx2;
            My1 = 0;
            My2 = 0;
            break;
        case '1辺固定3辺ピン（長辺固定）':
            Mx1 = (1/12) * sigma_ex * lx2; 
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
        case '片持ち（跳出し）':
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
    const t = slab.thickness !== undefined ? slab.thickness : (slab.t !== undefined ? slab.t : (slab.D !== undefined ? slab.D : 150));
    const dt = slab.dt !== undefined ? slab.dt : 70;
    const ft = slab.ft !== undefined ? slab.ft : 195;
    const w = slab.groundPressure !== undefined ? slab.groundPressure : 30.0;
    
    const j = Math.max(stress.j, 1);

    // 短辺方向 (X) - Mx1は端部(下端引張), Mx2は中央(上端引張)
    const reqAtX_End = stress.Mx1 * 1e6 / (ft * j);
    const reqAtX_Center = stress.Mx2 * 1e6 / (ft * j);
    // 長辺方向 (Y) - My1は端部(下端引張), My2は中央(上端引張)
    const reqAtY_End = stress.My1 * 1e6 / (ft * j);
    const reqAtY_Center = stress.My2 * 1e6 / (ft * j);
    
    // 鉄筋情報の取得（シングル配筋に一本化。上端・下端のプロパティがある場合は優先的に読むが、まずは単一配筋を想定）
    const sR = slab.shortRebar || 'D13';
    const sP = slab.shortPitch !== undefined ? slab.shortPitch : 200;
    const lR = slab.longRebar || 'D13';
    const lP = slab.longPitch !== undefined ? slab.longPitch : 200;

    // 断面積の計算 (mm2/m)
    const actualAtX = window.getRebarArea(sR, 'average') * (1000 / Math.max(sP, 1));
    const actualAtY = window.getRebarArea(lR, 'average') * (1000 / Math.max(lP, 1));

    // 検定比（Mx1, My1が端部、Mx2, My2が中央。シングル配筋では両方の最大値をチェック）
    const ratioX1 = reqAtX_End / Math.max(actualAtX, 1);
    const ratioX2 = reqAtX_Center / Math.max(actualAtX, 1);
    const ratioY1 = reqAtY_End / Math.max(actualAtY, 1);
    const ratioY2 = reqAtY_Center / Math.max(actualAtY, 1);

    const ratioX = Math.max(ratioX1, ratioX2);
    const ratioY = Math.max(ratioY1, ratioY2);
    
    slab.aijData = {
        lx: stress.lx,
        ly: stress.ly,
        lambda: stress.ly / stress.lx,
        cond: stress.cond,
        w: w, t: t, dt: dt, ft: ft,
        Mx1: stress.Mx1, Mx2: stress.Mx2, 
        My1: stress.My1, My2: stress.My2,
        shortLabel: '短辺',
        longLabel: '長辺',
        j: j,
        // 旧互換・表示用プロパティ
        reqAtX: Math.max(reqAtX_End, reqAtX_Center),
        actualAtX: actualAtX,
        ratioX: ratioX,
        reqAtY: Math.max(reqAtY_End, reqAtY_Center),
        actualAtY: actualAtY,
        ratioY: ratioY,
        isOK: (ratioX <= 1.0 && ratioY <= 1.0),
        // 表示用データ (Single)
        sR, sP, lR, lP
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
    var isCorner = (fCol && (fCol.biSetting === '0.8' || fCol.biSetting == 0.8));
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
          Bi_top: currentBiTop, Bi_bot: currentBiBot,
          sumX: 0, sumY: 0 // 💡 方向判定用
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
        
        // 💡 軸の方向判定用に成分を集計 (w.multiplier_x/y は calculateWallProps で計算済み)
        res.sumX += (w.multiplier_x || 0) * (w.length_m || 1);
        res.sumY += (w.multiplier_y || 0) * (w.length_m || 1);

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
  var reduction = nw;

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
    // 💡 通り芯自体の方向を決定
    const axisDirection = (res.sumX >= res.sumY) ? 'X' : 'Y';
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
        direction: axisDirection, // 💡 方向タグを追加
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

  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const isBeamHorizontal = Math.abs(dx) > Math.abs(dy);
  
  // 💡 壁の水平せん断力 (Q) を集計するループを追加
  let wallShearLoads = [];
  (fd.walls || []).forEach(w => {
    const wn1 = fd.nodes[w.n1], wn2 = fd.nodes[w.n2];
    if (!wn1 || !wn2) return;
    const wMidX = (wn1.x + wn2.x) / 2, wMidY = (wn1.y + wn2.y) / 2;
    
    // 梁の線分に対する壁中点の距離と位置係数tを算出
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
        
        // 💡 梁の主方向を判定 (すでに関数冒頭で計算済みの isBeamHorizontal を使用)
        const beamDir = isBeamHorizontal ? 'X' : 'Y';

        let targetCase = null;
        if (beamAxis) {
          // 通り芯名の完全一致または部分一致をより柔軟に判定
          targetCase = (res.cases || []).find(c => {
             const cleanAxis = beamAxis.replace('通り', '').trim();
             // 💡 通り芯名が一致し、かつ方向タグが梁の方向と一致するものを優先
             return c.name.includes(cleanAxis) && c.name.includes(axisMode) && c.direction === beamDir;
          });
        }
        
        if (!targetCase) {
          // 💡 フォールバック：通り芯名が一致しなくても、梁と同じ方向の加力ケースから最大値を探す
          const matchingDirs = (res.cases || []).filter(c => c.name.includes(axisMode) && c.direction === beamDir);
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

// 💡 HTMLテーブル生成関数(generateFoundationLongTermStressTable, generateFoundationHorizontalStressTable)は
// table_generator_foundation.js へ分離・移行しました。


export const getRebarArea = window.getRebarArea = function(spec, mode = 'sum') {
  if (!spec) return 0;
  if (typeof spec === 'number') return spec;
  const map = { 10: 71.3, 13: 126.7, 16: 198.6, 19: 286.5, 22: 387.1 };
  let sum = 0;
  let countTotal = 0;

  // 区切り文字として '+', '/', '・' を許容し、スペースを除去
  const parts = String(spec).toUpperCase().replace(/\s+/g, '').split(/[+／\/・]+/);
  
  parts.forEach(p => {
    const mm = p.match(/(?:(\d+)-)?D(\d+)/);
    if (mm) {
      const count = mm[1] ? parseInt(mm[1]) : 1;
      const size = mm[2];
      sum += count * (map[size] || 0);
      countTotal += count;
    }
  });

  if (countTotal === 0) return 0;
  
  // 💡 交互配筋（例: D10+D13）等のスラブ用計算では 'average' モードを使用
  if (mode === 'average') {
    return sum / countTotal;
  }
  
  // デフォルト（梁の主筋等）では合計断面積を返す
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

/**
 * 基礎CADデータ整合性修復エンジン (Physical Restorer)
 * 座標の微細なズレ、ノードIDの重複、孤立データの蓄積を物理的に洗浄する。
 */
export const repairFoundationData = window.repairFoundationData = function() {
    const fd = floorData[currentFloor];
    if (!fd || !fd.nodes) return { success: false, message: "データが見つかりません" };

    console.log("%c--- 修復エンジン起動: 物理洗浄を開始します ---", "color: #e67e22; font-weight: bold;");
    const startTime = Date.now();
    
    const initialNodeCount = fd.nodes.length;
    const initialBeamCount = (fd.beams? fd.beams.length : 0) + (fd.perimeterBeams? fd.perimeterBeams.length : 0);

    // 1. グリッド座標の抽出
    const uniqueX = [...new Set(dxfVAxes.map(a => Math.round(a.x)))].sort((a,b) => a-b);
    const uniqueY = [...new Set(dxfHAxes.map(a => Math.round(a.y)))].sort((a,b) => a-b);

    // 2. ノードの座標スナップ
    const SNAP_TOLERANCE = 100; // 100mm以内なら吸着
    fd.nodes.forEach(node => {
        // X座標のスナップ
        const closeX = uniqueX.find(gx => Math.abs(gx - node.x) < SNAP_TOLERANCE);
        if (closeX !== undefined) node.x = closeX;

        // Y座標のスナップ
        const closeY = uniqueY.find(gy => Math.abs(gy - node.y) < SNAP_TOLERANCE);
        if (closeY !== undefined) node.y = closeY;
    });

    // 3. 重複ノードの統合マッピング作成
    // (座標に基づき、同一地点のノードをマージ)
    const locMap = new Map(); // "x_y" -> firstNodeIndex
    const indexMap = new Array(fd.nodes.length); // oldIndex -> newIndex
    const newNodes = [];

    fd.nodes.forEach((node, oldIdx) => {
        const key = `${Math.round(node.x)}_${Math.round(node.y)}`;
        if (locMap.has(key)) {
            indexMap[oldIdx] = locMap.get(key);
        } else {
            const newIdx = newNodes.length;
            locMap.set(key, newIdx);
            indexMap[oldIdx] = newIdx;
            
            // IDの重複もここで解消（最初の1つを採用し、IDが空なら採番）
            if (!node.id || node.id === 'NEW') node.id = "N" + (newIdx + 1);
            newNodes.push(node);
        }
    });

    // 4. 全構造要素の参照（nodeIndex）を書き換え
    const remap = (idx) => (idx !== undefined && indexMap[idx] !== undefined) ? indexMap[idx] : idx;

    // 梁の再接続
    const processBeams = (beams) => {
        if (!beams) return [];
        return beams.map(b => ({
            ...b,
            n1: remap(b.n1),
            n2: remap(b.n2)
        })).filter(b => {
             // 長さ0の梁を排除
             if (b.n1 === b.n2) return false;
             return true;
        });
    };
    fd.beams = processBeams(fd.beams);
    fd.perimeterBeams = processBeams(fd.perimeterBeams);

    // 柱の再接続
    if (fd.columns) {
        fd.columns.forEach(col => {
            col.nodeIndex = remap(col.nodeIndex);
        });
        // 同一ノードに複数の柱がある場合の重複排除
        const colSet = new Set();
        fd.columns = fd.columns.filter(col => {
            if (colSet.has(col.nodeIndex)) return false;
            colSet.add(col.nodeIndex);
            return true;
        });
    }

    // 壁の再接続
    if (fd.walls) {
        fd.walls = fd.walls.map(w => ({
            ...w,
            n1: remap(w.n1),
            n2: remap(w.n2)
        })).filter(w => w.n1 !== w.n2);
    }

    // スラブの再接続
    if (fd.slabs) {
        fd.slabs.forEach(slab => {
            if (slab.nodeIds) {
                slab.nodeIds = [...new Set(slab.nodeIds.map(nid => remap(nid)))];
            }
        });
        // 頂点数が足りなくなったスラブを排除
        fd.slabs = fd.slabs.filter(s => s.nodeIds && s.nodeIds.length >= 3);
    }

    // 床構面の再接続
    if (fd.diaphragms) {
        fd.diaphragms.forEach(di => {
            if (di.nodeIds) {
                di.nodeIds = [...new Set(di.nodeIds.map(nid => remap(nid)))];
            }
        });
        fd.diaphragms = fd.diaphragms.filter(d => d.nodeIds && d.nodeIds.length >= 3);
    }

    // 5. データの反映（ノードリストの差し替え）
    fd.nodes = newNodes;

    // 6. 重複した梁の最終排除
    const beamKeySet = new Set();
    fd.beams = fd.beams.filter(b => {
        const key = [b.n1, b.n2].sort().join('-');
        if (beamKeySet.has(key)) return false;
        beamKeySet.add(key);
        return true;
    });

    const duration = Date.now() - startTime;
    const resultMsg = `修復完了 (${duration}ms):
    - ノード: ${initialNodeCount} -> ${fd.nodes.length}
    - 梁: ${initialBeamCount} -> ${fd.beams.length + (fd.perimeterBeams? fd.perimeterBeams.length : 0)}
    - 重複・ズレ・不整合を全て物理洗浄しました。`;

    console.log(`%c${resultMsg}`, "color: #27ae60; font-weight: bold;");
    
    // 履歴に保存（修復後の状態をUndo可能にする）
    if (window.pushHistory) window.pushHistory();

    return { success: true, message: resultMsg };
};



/**
 * スラブ外周外に飛び出した孤立基礎梁の緊急クリーンアップ
 * ─────────────────────────────────────────────────────────
 * 用途: JSONロード後や修復作業後に、スラブ外周の外に配置されてしまった
 *       基礎梁（beams / perimeterBeams の両方）を一括除去する。
 * 使い方: ブラウザコンソールで → window.cleanupOutOfSlabBeams()
 *
 * 判定ロジック:
 *   梁の両端ノードが「いずれかのスラブの頂点ノード」または「柱のノード」
 *   のどちらにも属さない場合、スラブ外の孤立梁とみなして削除候補とする。
 */
export const cleanupOutOfSlabBeams = window.cleanupOutOfSlabBeams = function(options = {}) {
    const fd = floorData[currentFloor];
    if (!fd || !fd.nodes) {
        console.warn('[cleanupOutOfSlabBeams] データが見つかりません');
        return;
    }

    // 柱ノード集合 & スラブ頂点ノード集合
    const colNodeSet = new Set((fd.columns || []).map(c => c.nodeIndex));
    const slabNodeSet = new Set((fd.slabs || []).flatMap(s => s.nodeIds || []));

    // 有効な端点かどうか
    const isValidEndpoint = (nid) => colNodeSet.has(nid) || slabNodeSet.has(nid);

    // beams の確認
    const removedBeams = [];
    fd.beams = (fd.beams || []).filter((b, i) => {
        const ok = isValidEndpoint(b.n1) && isValidEndpoint(b.n2);
        if (!ok) removedBeams.push({ index: i, id: b.id, n1: b.n1, n2: b.n2 });
        return ok;
    });

    // perimeterBeams の確認
    const removedPerimeterBeams = [];
    if (fd.perimeterBeams) {
        fd.perimeterBeams = fd.perimeterBeams.filter((b, i) => {
            const ok = isValidEndpoint(b.n1) && isValidEndpoint(b.n2);
            if (!ok) removedPerimeterBeams.push({ index: i, id: b.id, n1: b.n1, n2: b.n2 });
            return ok;
        });
    }

    const totalRemoved = removedBeams.length + removedPerimeterBeams.length;
    if (totalRemoved > 0) {
        console.log(`%c[cleanupOutOfSlabBeams] ${totalRemoved} 本のスラブ外基礎梁を除去しました。`, 'color:#e74c3c; font-weight:bold;');
        if (removedBeams.length > 0) console.log('  除去した beams:', removedBeams);
        if (removedPerimeterBeams.length > 0) console.log('  除去した perimeterBeams:', removedPerimeterBeams);

        // 履歴に保存し、UIを更新
        if (window.pushHistory) window.pushHistory();
        if (window.syncSlabDataToBeams) window.syncSlabDataToBeams();
        if (window.callRender) window.callRender();
        if (window.updateDataList) window.updateDataList();
        if (window.updatePropertyPanel) window.updatePropertyPanel();

        alert(`✅ クリーンアップ完了: ${totalRemoved} 本のスラブ外基礎梁を除去しました。\n詳細はコンソールを確認してください。`);
    } else {
        console.log('%c[cleanupOutOfSlabBeams] スラブ外の孤立梁なし。データは正常です。', 'color:#27ae60;');
        if (!options.silent) alert('✅ スラブ外の孤立梁は見つかりませんでした。データは正常です。');
    }

    return { removedBeams, removedPerimeterBeams };
};
