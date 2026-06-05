// core/beam_calc.js
import { TOLERANCES } from './constants.js';
import { checkCollinear, getSegmentOverlap } from './geometry_utils.js';

/**
 * 基礎梁の重複クリーンアップ
 * 重複または包含関係にある梁のうち、最も長いセグメントを残して他を削除する。
 */
export const cleanupOverlappingBeams = function(fd) {
  if (!fd) return;
  
  const allBeams = [
    ...(fd.beams || []).map((b, i) => ({ ...b, source: 'beams', originalIndex: i })),
    ...(fd.perimeterBeams || []).map((b, i) => ({ ...b, source: 'perimeterBeams', originalIndex: i }))
  ];

  if (allBeams.length < 2) return;

  const toRemove = { beams: new Set(), perimeterBeams: new Set() };

  for (let i = 0; i < allBeams.length; i++) {
    for (let j = i + 1; j < allBeams.length; j++) {
      const b1 = allBeams[i];
      const b2 = allBeams[j];
      
      const n1a = fd.nodes[b1.n1], n1b = fd.nodes[b1.n2];
      const n2a = fd.nodes[b2.n1], n2b = fd.nodes[b2.n2];
      if (!n1a || !n1b || !n2a || !n2b) continue;

      const isCollinear = checkCollinear(n1a, n1b, n2a, n2b);
      if (!isCollinear) continue;

      const overlap = getSegmentOverlap(n1a, n1b, n2a, n2b);
      
      if (overlap.type === 'contains') {
        toRemove[b2.source].add(b2.originalIndex);
      } else if (overlap.type === 'containedBy') {
        toRemove[b1.source].add(b1.originalIndex);
      } else if (overlap.type === 'identical') {
        if (b1.source === 'perimeterBeams' && b2.source === 'beams') toRemove.perimeterBeams.add(b1.originalIndex);
        else if (b1.source === 'beams' && b2.source === 'perimeterBeams') toRemove.perimeterBeams.add(b2.originalIndex);
        else toRemove[b2.source].add(b2.originalIndex);
      } else if (overlap.type === 'partialOverflow') {
         if (overlap.l1 > overlap.l2) toRemove[b2.source].add(b2.originalIndex);
         else toRemove[b1.source].add(b1.originalIndex);
      }
    }
  }

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
export const autoMergeCollinearBeams = function(fd) {
    if (!fd || !fd.nodes) return;

    const allBeamRefs = [
        ...(fd.beams || []).map((b, i) => ({ ...b, source: 'beams', originalIndex: i })),
        ...(fd.perimeterBeams || []).map((b, i) => ({ ...b, source: 'perimeterBeams', originalIndex: i }))
    ].filter(b => b.axisName && (b.type === 'foundation_beam' || !b.type || b.source === 'perimeterBeams'));

    if (allBeamRefs.length === 0) return;

    const colNodeSet = new Set((fd.columns || []).map(c => c.nodeIndex));
    const slabNodeSet = new Set((fd.slabs || []).flatMap(s => s.nodeIds || []));
    
    const nodeConnCount = {};
    const nodeAxes = {}; 
    [...(fd.beams || []), ...(fd.perimeterBeams || []), ...(fd.walls || [])].forEach(it => {
        [it.n1, it.n2].forEach(nid => {
            if (nid === undefined) return;
            nodeConnCount[nid] = (nodeConnCount[nid] || 0) + 1;
            if (!nodeAxes[nid]) nodeAxes[nid] = new Set();
            if (it.axisName) nodeAxes[nid].add(it.axisName);
        });
    });

    const isValidEndpoint = (nid) => {
        if (colNodeSet.has(nid)) return true;
        if (slabNodeSet.has(nid)) return true;
        if ((nodeConnCount[nid] || 0) >= 3) return true;
        if (nodeAxes[nid] && nodeAxes[nid].size >= 2) return true;
        return false;
    };

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
                    if (!isValidEndpoint(startNode) || !isValidEndpoint(endNode)) {
                        console.warn(`[autoMergeCollinearBeams] ${axName}: 端点ノード[${startNode},${endNode}]が柱/スラブ外 → 統合をスキップ`);
                        cluster.forEach(item => {
                            toRemove[item.b.source].delete(item.b.originalIndex);
                        });
                        return;
                    }

                    // マージ対象の梁の中で、デフォルト値から変更されているプロパティを優先して抽出
                    const dp = (window.defaultProperties && window.defaultProperties['fbeam']) || {};
                    const defW = dp.width || 300;
                    const defD = dp.depth || 640;
                    const defDt = dp.dt || 70;
                    const defTop = dp.topRebar || '1-D13';
                    const defBot = dp.bottomRebar || '1-D13';
                    const defStirrup = dp.stirrupRebar || 'D10';
                    const defPitch = dp.stirrupPitch || 200;

                    let mergedProps = { ...bestRep };
                    cluster.forEach(item => {
                        const b = item.b;
                        if (b.width !== undefined && b.width !== defW) mergedProps.width = b.width;
                        if (b.depth !== undefined && b.depth !== defD) mergedProps.depth = b.depth;
                        if (b.dt !== undefined && b.dt !== defDt) mergedProps.dt = b.dt;
                        if (b.topRebar !== undefined && b.topRebar !== defTop) mergedProps.topRebar = b.topRebar;
                        if (b.bottomRebar !== undefined && b.bottomRebar !== defBot) mergedProps.bottomRebar = b.bottomRebar;
                        if (b.stirrupRebar !== undefined && b.stirrupRebar !== defStirrup) mergedProps.stirrupRebar = b.stirrupRebar;
                        if (b.stirrupPitch !== undefined && b.stirrupPitch !== defPitch) mergedProps.stirrupPitch = b.stirrupPitch;
                    });

                    newBeamsToAdd.push({
                        ...mergedProps,
                        type: 'foundation_beam',
                        n1: startNode,
                        n2: endNode,
                        id: `${axName}_merged_${startNode}_${endNode}`
                    });
                }
            });
        });
    });

    if (newBeamsToAdd.length > 0) {
        const bList = Array.from(toRemove.beams).sort((a, b) => b - a);
        bList.forEach(idx => fd.beams.splice(idx, 1));
        const pList = Array.from(toRemove.perimeterBeams).sort((a, b) => b - a);
        pList.forEach(idx => fd.perimeterBeams.splice(idx, 1));

        newBeamsToAdd.forEach(nb => fd.beams.push(nb));
        console.log(`[autoMergeCollinearBeams] 統合完了: ${newBeamsToAdd.length}本のマスター梁を生成`);
    }
};

/**
 * 梁上の支点を検索する（柱との距離判定）
 */
export const findSupportsOnBeam = function(beam, nodes, columns) {
    const n1 = nodes[beam.n1];
    const n2 = nodes[beam.n2];
    const supports = [];
    if(!n1 || !n2) return [];
    
    const dx = n2.x - n1.x, dy = n2.y - n1.y;
    const L2 = dx * dx + dy * dy;
    if(L2 === 0) return [];
    
    columns.forEach(col => {
        const cn = nodes[col.nodeIndex];
        if(!cn) return;
        const t = ((cn.x - n1.x) * dx + (cn.y - n1.y) * dy) / L2;

        if(t >= -0.05 && t <= 1.05) {
            const projX = n1.x + t * dx;
            const projY = n1.y + t * dy;
            const dist = Math.hypot(cn.x - projX, cn.y - projY);
            if (dist < TOLERANCES.STRUCTURAL_CONN) { 
                supports.push({ col, distFromStart: t * Math.sqrt(L2) / 1000, t });
            }
        }
    });
    supports.sort((a,b) => a.t - b.t);
    beam.internalSupports = supports;
    return supports;
};

/**
 * 単一スパンの応力計算
 */
export function calculateSingleSpanStress({w, L, c1, c2}) {
  let M1 = 0, M2 = 0, Mc = 0, Q1 = 0, Q2 = 0;
  if (c1 === 'pin') c1 = 'pin'; else if (c1 !== 'cantilever') c1 = 'fixed';
  if (c2 === 'pin') c2 = 'pin'; else if (c2 !== 'cantilever') c2 = 'fixed';

  if (c1 === 'fixed' && c2 === 'fixed') {
    M1 = w * L * L / 12;
    M2 = w * L * L / 12;
    Mc = w * L * L / 8;
    Q1 = w * L / 2;
    Q2 = w * L / 2;
  } else if ((c1 === 'pin' && c2 === 'fixed') || (c1 === 'fixed' && c2 === 'pin')) {
    const isFixedStart = (c1 === 'fixed');
    M1 = isFixedStart ? (w * L * L / 12) : 0;
    M2 = isFixedStart ? 0 : (w * L * L / 12);
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
    M1 = 0; M2 = 0;
    Mc = w * L * L / 8;
    Q1 = w * L / 2;
    Q2 = w * L / 2;
  }
  return { L, M1, M2, Mc, Q1, Q2 };
}

/**
 * 基礎梁の全応力を計算する
 */
export const computeBeamStress = function(fd, beam) {
  if (!beam || (!beam.n1 && !beam.n2)) return null;
  const n1 = fd.nodes[beam.n1];
  const n2 = fd.nodes[beam.n2];
  if (!n1 || !n2) return null;
  
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const totalL = Math.hypot(dx, dy) / 1000; 
  if (totalL < 0.01) return null;
  
  const w_slab_total = beam.slabLoadW !== undefined ? beam.slabLoadW : ((beam.tributaryWidth || 0) * (beam.groundPressure || 0));
  const w_self = ((beam.width || 0) / 1000) * ((beam.depth || 0) / 1000) * 24;
  let w_total = w_slab_total + w_self; 
  if (w_total < 0.1) w_total = 10.0;
  beam.totalLoad = w_total;
  
  const c1 = beam.startCondition || 'fixed';
  const c2 = beam.endCondition || 'fixed';
  
  const supports = findSupportsOnBeam(beam, fd.nodes, fd.columns);
  
  const spans = [];
  let currentT = 0;
  
  for(let i = 0; i <= supports.length; i++) {
      const isFirst = (i === 0);
      const isLast = (i === supports.length);
      const startT = currentT;
      const endT = isLast ? 1.0 : supports[i].t;
      
      const spanL = (endT - startT) * totalL;
      if (spanL < 0.01) { currentT = endT; continue; }
      
      let currentW = w_total;
      let currentWSlab = w_slab_total;
      let currentB = beam.tributaryWidth || 0;
      let currentSigma = beam.groundPressure || 0;

      if (beam.spanLoads && beam.spanLoads.length > 0) {
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
      res.w_slab = currentWSlab;
      res.B = currentB;           
      res.sigma_e = currentSigma; 
      spans.push(res);
      
      currentT = endT;
  }
  
  if (spans.length === 0) return null;

  const M1_total = spans[0].M1;
  const M2_total = spans[spans.length - 1].M2;
  const Mc_total = Math.max(...spans.map(s => s.Mc));
  const Q1_total = spans[0].Q1;
  const Q2_total = spans[spans.length - 1].Q2;

  const longTermSpans = [];
  spans.forEach(s => {
    const targetW = s.w_slab !== undefined ? s.w_slab : w_slab_total;
    const M_mid = targetW * s.L * s.L / 8;
    const M_end = targetW * s.L * s.L / 12;
    const Q_L = targetW * s.L / 2;
    longTermSpans.push({ L: s.L, M_mid, M_end, Q_L, w_slab: targetW, B: s.B, sigma_e: s.sigma_e });
  });
  beam.longTermSpans = longTermSpans;

  return { w: w_total, L: totalL, M1: M1_total, M2: M2_total, Mc: Mc_total, Q1: Q1_total, Q2: Q2_total, w_slab: w_slab_total, w_self, spans, longTermSpans };
};

/**
 * 鉄筋面積を取得
 */
export const getRebarArea = function(spec, mode = 'sum') {
  if (!spec) return 0;
  if (typeof spec === 'number') return spec;
  const map = { 10: 71.3, 13: 126.7, 16: 198.6, 19: 286.5, 22: 387.1 };
  let sum = 0;
  let countTotal = 0;

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
  if (mode === 'average') return sum / countTotal;
  return sum;
};

/**
 * 基礎梁スパン別の許容耐力を算出する
 */
export const calculateSpanStrength = function(span, material = { ft: 195, fs: 0.7, fts: 295, fss: 1.05 }) {
    const b = span.b || 150;
    const D = span.D || 640;
    const dt = span.dt || 70;
    const at = span.at || 253.4;
    const aw = span.aw || 142.6;
    const p = span.pitch || 200;
    const alpha = span.alpha || 1.0; 

    const d = D - dt;
    const j = 0.875 * d; 

    const Ma = material.ft * at * j / 1000000;      
    const Mas = material.fts * at * j / 1000000;    

    const Qa = material.fs * b * j / 1000;           
    const Qas = (material.fss * b * j + alpha * material.fts * (aw * j / p)) / 1000; 

    return { Ma, Mas, Qa, Qas, d, j };
};

/**
 * 基礎梁の詳細な断面検定を一括計算する
 */
export const calculateDetailedBeamCheckResults = function(beam, fd, horizontalData, shortTermN = 2.0) {
    if (!beam || !horizontalData) return null;
    const { points, resL, resR } = horizontalData;
    const stress = computeBeamStress(fd, beam);
    const spansCount = points.length - 1;
    const results = [];

    const material = { ft: beam.ft || 195, fs: 0.7, fts: 295, fss: 1.05 };

    for (let i = 0; i < spansCount; i++) {
        const spanName = `${points[i].id}～${points[i + 1].id}`;
        const spanLen = Math.hypot(points[i+1].x - points[i].x, points[i+1].y - points[i].y) / 1000;
        
        const s = (beam.spans && beam.spans[i]) || {};
        const sDepth = s.D || 640;
        const sWidth = s.b || 300;
        const sDt = s.dt || 70;
        const sTopR = s.topRebar || '2-D16';
        const sBotR = s.bottomRebar || '2-D16';
        const sStirrup = s.stirrup || 'D10';
        const sPitch = s.pitch || 200;
        
        const sAt = getRebarArea(sTopR);
        const sAtBot = getRebarArea(sBotR);
        const sAw = getRebarArea(sStirrup);
        
        const sB       = (stress && stress.spans && stress.spans[i]) ? (stress.spans[i].B ?? 0) : (beam.tributaryWidth || 0);
        const sSigma   = (stress && stress.spans && stress.spans[i]) ? (stress.spans[i].sigma_e ?? 0) : (beam.groundPressure || 0);
        const sW       = (sSigma * sB);
        
        const curM_mid = (sW * spanLen * spanLen) / 8.0;
        const curM_end = (sW * spanLen * spanLen) / 12.0;
        const curQ_L   = (sW * spanLen) / 2.0;

        const absMLongEnd = Math.abs(curM_end);
        const absMLongMid = Math.abs(curM_mid);
        const absQLong = Math.max(0.01, Math.abs(curQ_L));

        let MeL_start = Math.abs(resL[i].M_f), MeL_end = Math.abs(resL[i+1].M_f);
        let QeL_e = Math.max(0.01, Math.abs(resL[i].Qe), Math.abs(resL[i+1].Qe));
        let MeR_start = Math.abs(resR[i].M_f), MeR_end = Math.abs(resR[i+1].M_f);
        let QeR_e = Math.max(0.01, Math.abs(resR[i].Qe), Math.abs(resR[i+1].Qe));

        // 単純梁モデルの場合、スパン内のローカルモーメント M水 を考慮する
        if (beam.calcModel === 'simple_beam') {
          const n1Idx = points[i].nodeIndex, n2Idx = points[i+1].nodeIndex;
          const hasWall = (fd.walls || []).some(w => (w.n1 === n1Idx && w.n2 === n2Idx) || (w.n1 === n2Idx && w.n2 === n1Idx));
          if (hasWall) {
            const Mw_L = Math.abs((resL[i].Td - resL[i+1].Td) * spanLen * 0.5);
            const Mw_R = Math.abs((resR[i].Td - resR[i+1].Td) * spanLen * 0.5);
            // グローバルモーメントと M水 の大きい方を検定に採用
            MeL_start = Math.max(MeL_start, Mw_L);
            MeL_end = Math.max(MeL_end, Mw_L);
            MeR_start = Math.max(MeR_start, Mw_R);
            MeR_end = Math.max(MeR_end, Mw_R);
          }
        }

        const Msht_L_left  = absMLongEnd + MeL_start;
        const Msht_L_right = absMLongEnd + MeL_end;
        const Qsht_L = absQLong + shortTermN * QeL_e;
        const Msht_R_left  = absMLongEnd + MeR_start;
        const Msht_R_right = absMLongEnd + MeR_end;
        const Qsht_R = absQLong + shortTermN * QeR_e;

        const d_m = (sDepth - sDt) / 1000;
        const alphaL = Math.max(1.0, Math.min(2.0, 4 / (absMLongEnd / (absQLong * d_m) + 1)));
        const calcAlphaS = (Msht, Qsht) => {
            const Mshort = Math.max(0.01, Msht - absMLongEnd);
            return Math.max(1.0, Math.min(2.0, 4 / (Mshort / (Qsht * d_m) + 1)));
        };
        const alphaS = Math.max(
            calcAlphaS(Math.max(Msht_L_left, Msht_L_right), Qsht_L),
            calcAlphaS(Math.max(Msht_R_left, Msht_R_right), Qsht_R)
        );

        const resT = calculateSpanStrength({ D: sDepth, b: sWidth, dt: sDt, at: sAt, aw: sAw, pitch: sPitch, alpha: alphaL }, material);
        const resB = calculateSpanStrength({ D: sDepth, b: sWidth, dt: sDt, at: sAtBot, aw: sAw, pitch: sPitch, alpha: alphaL }, material);
        const resS = calculateSpanStrength({ D: sDepth, b: sWidth, dt: sDt, at: sAt, aw: sAw, pitch: sPitch, alpha: alphaS }, material);

        const ratios = {
            rL_mid: absMLongMid / resT.Ma,  // 長期中央モーメント (上部引張) vs 上端主筋許容耐力
            rL_end: absMLongEnd / resB.Ma,  // 長期端部モーメント (下部引張) vs 下端主筋許容耐力
            rL_Q  : absQLong / resT.Qa,
            rSL_M : Math.max(Msht_L_left, Msht_L_right) / Math.min(resT.Mas, resB.Mas), // 左加力短期曲げ vs 短期主筋耐力 (上端・下端の安全側)
            rSL_Q : Qsht_L / resS.Qas,
            rSR_M : Math.max(Msht_R_left, Msht_R_right) / Math.min(resT.Mas, resB.Mas), // 右加力短期曲げ vs 短期主筋耐力 (上端・下端の安全側)
            rSR_Q : Qsht_R / resS.Qas
        };
        const maxR = Math.max(...Object.values(ratios));

        results.push({
            spanName, spanLen,
            sDepth, sWidth, sDt, sTopR, sBotR, sStirrup, sPitch, sAt, sAtBot, sAw,
            sB, sSigma, sW, curM_mid, curM_end, curQ_L,
            Msht_L_left, Msht_L_right, Qsht_L, Msht_R_left, Msht_R_right, Qsht_R,
            alphaL, alphaS,
            lMa_t: resT.Ma, lMa_b: resB.Ma, sMa_t: resT.Mas, sMa_b: resB.Mas,
            lQa: resT.Qa, sQa: resS.Qas, j_val: resT.j,
            ratios, maxR, isOk: maxR <= 1.0
        });
    }
    return results;
};


