// core/column_calc.js
import { HARDWARE_MASTER, TOLERANCES, isSamePoint } from './constants.js';
import { findSupportsOnBeam } from './beam_calc.js';

/**
 * 壁のプロパティを計算する（純粋関数）
 */
export const calculateWallProps = function(wall, nodes) {
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

        // 10度以内の傾きは水平・垂直にスナップ
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

// 通り芯名を正規化する内部ヘルパー
const normalizeAxisName = (name) => (name || "").replace(/通り$/, "").trim();

/**
 * 柱の引張耐力を計算する（純粋関数）
 * @param {number|string} colIndex 
 * @param {Object} fd - 当該階のデータ
 * @param {string} targetFloorKey - 計算対象の階 (例: '1F')
 * @param {Object} allFloorData - 全階層のデータ
 * @param {string[]} floorList - 階層の並び順 (例: ['PH','R','2F','1F'])
 */
export const calculateColumnT = function(colIndex, fd, targetFloorKey, allFloorData, floorList) {
  if (!targetFloorKey) {
    targetFloorKey = window.currentFloor || (fd && fd.floor) || '1';
  }
  if (!allFloorData) {
    allFloorData = window.floorData || {};
  }
  
  const hasMismatch = floorList && floorList.some(f => !allFloorData[f]);
  if (!floorList || floorList.length === 0 || hasMismatch) {
    floorList = window.FLOORS || Object.keys(allFloorData).filter(k => k !== 'nodes' && k !== 'materials' && k !== 'nextId' && k !== 'settings') || ['PH', 'R', '3', '2', '1'];
  }
  
  if (!floorList.includes(targetFloorKey)) {
    const cleanKey = targetFloorKey.replace('F', '');
    if (floorList.includes(cleanKey)) {
      targetFloorKey = cleanKey;
    } else {
      const fKey = targetFloorKey + 'F';
      if (floorList.includes(fKey)) {
        targetFloorKey = fKey;
      }
    }
  }

  if (!allFloorData || !fd) return { T: 0, metal: '-', ratio: 0, cases: [], criticalCase: { name: '-' } };
  
  const col = fd.columns[colIndex];
  if (!col) return { T: 0, metal: '-', ratio: 0, cases: [], criticalCase: { name: '-' } };

  const nodeIdx = col.nodeIndex;
  const targetNode = fd.nodes[nodeIdx];
  if (!targetNode) return { T: 0, metal: '-', ratio: 0, cases: [], criticalCase: { name: '-' } };

  const getBi = function(fCol) {
    if (!fCol) return { top: 0.5, bot: 0.5 };
    if (fCol.biSetting === '0.8' || fCol.biSetting == 0.8) return { top: 0.5, bot: 0.8 };
    if (fCol.biSetting === '0.5' || fCol.biSetting == 0.5) return { top: 0.5, bot: 0.5 };
    return { top: 0.5, bot: 0.5 };
  };

  const axisResults = {};
  const targetFloorIdx = floorList.indexOf(targetFloorKey);

  for (let i = 0; i <= targetFloorIdx; i++) {
    const fKey = floorList[i];
    const fData = allFloorData[fKey];
    const isCurrentFloor = (fKey === targetFloorKey);
    if (!fData || !fData.nodes || !fData.columns) continue;

    const cIdx = fData.columns.findIndex(function(c) {
      const n = fData.nodes[c.nodeIndex];
      return n && isSamePoint(n, targetNode, TOLERANCES.STRUCTURAL_CONN);
    });
    if (cIdx === -1) continue;

    const fCol = fData.columns[cIdx];
    const fNodeIdx = fCol.nodeIndex;
    const Hi = (fCol.heightOverride || fData.floorHeight || 2730) / 1000;
    
    const biObj = getBi(fCol);
    const currentBiTop = biObj.top;
    const currentBiBot = biObj.bot;

    const allWalls = (fData.walls || []).filter(function(w) { 
        const nW1 = fData.nodes[w.n1], nW2 = fData.nodes[w.n2];
        return (w.n1 === fNodeIdx || w.n2 === fNodeIdx) ||
               (nW1 && isSamePoint(nW1, fData.nodes[fNodeIdx], TOLERANCES.WALL_CONN)) ||
               (nW2 && isSamePoint(nW2, fData.nodes[fNodeIdx], TOLERANCES.WALL_CONN));
    });

    const groups = {};
    allWalls.forEach(function(w) {
      const normalizedName = normalizeAxisName(w.axisName);
      if (!groups[normalizedName]) groups[normalizedName] = [];
      groups[normalizedName].push(w);
    });

    Object.keys(groups).forEach(function(axisName) {
      if (!axisResults[axisName]) {
        axisResults[axisName] = { 
          axisName: axisName, sum_Qail_Hi: 0, sum_Qair_Hi: 0, 
          sum_Ni_upper: 0, sum_Td_upper: 0,
          Ni_top_this: 0, Ni_bot_this: 0, Td_this: 0,
          Bi_top: currentBiTop, Bi_bot: currentBiBot,
          sumX: 0, sumY: 0 
        };
      }
      const res = axisResults[axisName];
      
      let qailX = 0, qairX = 0;
      let qailY = 0, qairY = 0;
      const nCenter = fData.nodes[fNodeIdx];
      
      groups[axisName].forEach(function(w) {
        const onidx = (w.n1 === fNodeIdx) ? w.n2 : w.n1;
        const nRemote = fData.nodes[onidx];
        if (!nRemote || !nCenter) return;

        const q_hi_x = 1.96 * (w.multiplier_x || 0) * Hi;
        const q_hi_y = 1.96 * (w.multiplier_y || 0) * Hi;
        
        res.sumX += (w.multiplier_x || 0) * (w.length_m || 1);
        res.sumY += (w.multiplier_y || 0) * (w.length_m || 1);

        const isRightX = (nRemote.x > nCenter.x + TOLERANCES.CALC_EPSILON);
        const isLeftX  = (nRemote.x < nCenter.x - TOLERANCES.CALC_EPSILON);
        const isUpY    = (nRemote.y > nCenter.y + TOLERANCES.CALC_EPSILON);
        const isDownY  = (nRemote.y < nCenter.y - TOLERANCES.CALC_EPSILON);

        if (isRightX) qairX += q_hi_x; 
        else if (isLeftX) qailX += q_hi_x;

        if (isUpY) qairY += q_hi_y; 
        else if (isDownY) qailY += q_hi_y;
      });

      const isXDominant = (res.sumX >= res.sumY);
      const qail = isXDominant ? qailX : qailY;
      const qair = isXDominant ? qairX : qairY;

      const deltaPower = qair - qail;
      const currentB = parseFloat(fCol.inflectionRatio || 0.5);

      if (isCurrentFloor) {
        res.Ni_top_this = deltaPower * currentBiTop;
        res.Ni_bot_this = deltaPower * currentBiBot;
        res.Td_this = deltaPower * currentB;
        res.sum_Qail_Hi = qail;
        res.sum_Qair_Hi = qair;
        res.Bi_top = currentBiTop;
        res.Bi_bot = currentBiBot;
      } else {
        res.sum_Ni_upper += deltaPower * currentBiBot;
        res.sum_Td_upper += deltaPower * currentB;
      }
    });
  }

  const nw = parseFloat(col.nw !== undefined ? col.nw : (col.longTermAxial || col.axialLoad || 0)) || 0;
  const reduction = nw;

  const getAutoMetal = function(T) {
    const table = HARDWARE_MASTER.filter(function(m) { return !m.isCustom; });
    if (T <= 0.0001) return HARDWARE_MASTER[0]; 
    for (let j = 0; j < table.length; j++) {
      const checkCap = table[j].cap > 0.01 ? table[j].cap - 0.5 : table[j].cap;
      if (T <= checkCap) return table[j];
    }
    return table[table.length - 1];
  };

  const getMetalInfo = function(mode, mId, mCap, mName, aMetal) {
    if (mode === 'manual') {
      const master = HARDWARE_MASTER.find(function(m) { return m.id === mId; });
      return { 
        name: mName || (master ? master.name : (mId === 'custom' ? '任意金物' : '未定義')), 
        cap: parseFloat(mCap) || 0, isManual: true 
      };
    }
    return { name: aMetal.name, cap: aMetal.cap, isManual: false };
  };

  const cases = [];
  Object.keys(axisResults).forEach(function(axisName) {
    const res = axisResults[axisName];
    const axisDirection = (res.sumX >= res.sumY) ? 'X' : 'Y';
    const dirs = [ { name: '左から (→)', sign: 1 }, { name: '右から (←)', sign: -1 } ];

    dirs.forEach(function(d) {
      const sign = d.sign;
      const ni_top_this = res.Ni_top_this * sign;
      const ni_bot_this = res.Ni_bot_this * sign;
      const axisOver = (col.axisOverrides || {})[axisName] || {};
      
      const manualValue = (sign > 0) 
          ? (axisOver.L !== undefined && axisOver.L !== null ? axisOver.L : (col.niUpperOverride_L || null))
          : (axisOver.R !== undefined && axisOver.R !== null ? axisOver.R : (col.niUpperOverride_R || null));

      const ni_upper = (manualValue !== null && manualValue !== "" && !isNaN(parseFloat(manualValue))) 
          ? parseFloat(manualValue) : (res.sum_Ni_upper * sign);
      
      const T_top_raw = (ni_top_this + ni_upper) - reduction;
      const T_bot_raw = (ni_bot_this + ni_upper) - reduction;

      const td_this = res.Td_this * sign;
      const td_upper = res.sum_Td_upper * sign;
      const Td_val = td_this + td_upper;

      const topInfo = getMetalInfo(col.top_metalMode, col.top_metalId, col.top_metalCap, col.top_metalName, getAutoMetal(T_top_raw));
      const baseInfo = getMetalInfo(col.base_metalMode, col.base_metalId, col.base_metalCap, col.base_metalName, getAutoMetal(T_bot_raw));

      cases.push({
        name: axisName + ' ' + d.name,
        axisName: axisName,
        direction: axisDirection, 
        q1_Hi: res.sum_Qail_Hi, q2_Hi: res.sum_Qair_Hi,
        Bi_top: res.Bi_top, Bi_bot: res.Bi_bot,
        Ni_top: ni_top_this, Ni_bot: ni_bot_this, Ni_upper: ni_upper,
        totalNi_top: ni_top_this + ni_upper, totalNi_bot: ni_bot_this + ni_upper,
        T_top: T_top_raw, T_bot: T_bot_raw,
        Td: Td_val,
        topMetal: topInfo, baseMetal: baseInfo,
        isTopOk: (T_top_raw <= 0.0001 || T_top_raw <= (topInfo.cap > 0.01 ? topInfo.cap - 0.5 : topInfo.cap)),
        isBaseOk: (T_bot_raw <= 0.0001 || T_bot_raw <= (baseInfo.cap > 0.01 ? baseInfo.cap - 0.5 : baseInfo.cap))
      });
    });
  });

  if (cases.length === 0) return { T: 0, T_top: 0, metal: '対象外', cases: [], Nw: nw, criticalCase: null, maxTopCase: null, maxBotCase: null };
  
  let maxTopCase = cases[0];
  let maxBotCase = cases[0];
  for (let k = 0; k < cases.length; k++) {
    if (cases[k].T_top > maxTopCase.T_top) maxTopCase = cases[k];
    if (cases[k].T_bot > maxBotCase.T_bot) maxBotCase = cases[k];
  }

  return {
    T: Math.max(0, maxBotCase.T_bot), 
    T_top: Math.max(0, maxTopCase.T_top),
    Nw: nw, 
    cases: cases, 
    criticalCase: (maxBotCase.T_bot >= maxTopCase.T_top) ? maxBotCase : maxTopCase,
    maxTopCase: maxTopCase,
    maxBotCase: maxBotCase,
    topMetal: maxTopCase.topMetal,
    baseMetal: maxBotCase.baseMetal,
    Hi_m: (fd.floorHeight || 2730) / 1000
  };
};

/**
 * 基礎梁の応力データを計算する（純粋関数）
 */
export const calculateFoundationHorizontalStressData = function(fd, beam, currentFloorKey, allFloorData, floorList, model = 'span_supports') {
  if (!fd || !beam) return null;
  
  if (!fd.nodes) {
    console.error('[calculateFoundationHorizontalStressData] fd.nodes is missing!', fd);
    return null;
  }
  
  // すべての壁のプロパティを事前に計算
  if (fd.walls) {
    fd.walls.forEach(w => calculateWallProps(w, fd.nodes));
  }

  const n1 = fd.nodes[beam.n1];
  const n2 = fd.nodes[beam.n2];
  if (!n1 || !n2) {
    console.warn(`[calculateFoundationHorizontalStressData] Node not found for beam ${beam.id}. n1:${beam.n1}, n2:${beam.n2}`);
    return null;
  }

  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const totalL = Math.hypot(dx, dy) / 1000;
  const isBeamHorizontal = Math.abs(dx) > Math.abs(dy);

  const supports = findSupportsOnBeam(beam, fd.nodes, fd.columns);
  
  const rawPoints = [];
  rawPoints.push({ type: 'start', id: n1.id, x: n1.x, y: n1.y, dist: 0 });
  supports.forEach(s => {
    rawPoints.push({ 
      type: 'column', id: s.col.id, x: fd.nodes[s.col.nodeIndex].x, y: fd.nodes[s.col.nodeIndex].y, 
      dist: s.distFromStart, colIndex: fd.columns.indexOf(s.col) 
    });
  });
  rawPoints.push({ type: 'end', id: n2.id, x: n2.x, y: n2.y, dist: totalL });

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
  
  const calcDir = (mode) => {
    const results = [];
    
    // 1. 各点の Td を収集
    const pointsWithTd = points.map(p => {
      let Td = 0;
      let cIdx = -1;
      if (p.type === 'column') {
        cIdx = p.colIndex;
      } else {
        cIdx = fd.columns.findIndex(c => {
          const cn = fd.nodes[c.nodeIndex];
          return cn && isSamePoint(cn, p, TOLERANCES.STRUCTURAL_CONN);
        });
      }

      if (cIdx !== -1) {
        const res = calculateColumnT(cIdx, fd, currentFloorKey, allFloorData, floorList);
        const axisMode = mode === 'L' ? '左から' : '右から';
        const beamAxis = beam.axisName || beam.axis;
        const beamDir = isBeamHorizontal ? 'X' : 'Y';

        let targetCase = null;
        if (beamAxis) {
          const cleanBeamAxis = String(beamAxis).replace('通り', '').trim();
          targetCase = (res.cases || []).find(c => {
             const cleanWallAxis = c.axisName ? String(c.axisName).replace('通り', '').trim() : '';
             return (cleanWallAxis === cleanBeamAxis) && c.name.includes(axisMode) && c.direction === beamDir;
          });
          if (!targetCase) {
             targetCase = (res.cases || []).find(c => c.name.includes(cleanBeamAxis) && c.name.includes(axisMode) && c.direction === beamDir);
          }
        }
        if (!targetCase) {
          const matchingDirs = (res.cases || []).filter(c => c.name.includes(axisMode) && c.direction === beamDir);
          if (matchingDirs.length > 0) {
            targetCase = matchingDirs.reduce((prev, curr) => (Math.abs(curr.Ne_bot) > Math.abs(prev.Ne_bot)) ? curr : prev);
          }
        }
        if (model === 'column_supports') {
          // 柱直下支点モデルでは反曲点高比(B)による低減を行わない軸力(Ni)を使用する
          Td = (targetCase && targetCase.totalNi_bot !== undefined && !isNaN(targetCase.totalNi_bot)) ? targetCase.totalNi_bot : 0;
        } else {
          // 従来の両端支点モデルでは、柱モーダルの判定に合わせ Td を使用
          Td = (targetCase && targetCase.Td !== undefined && !isNaN(targetCase.Td)) ? targetCase.Td : 0;
        }
      }
      return { ...p, Td };
    });

    if (model === 'column_supports') {
      // --- 柱直下支点連続梁モデル ---
      const colPts = pointsWithTd.filter(p => p.type === 'column');
      const sumTd = pointsWithTd.reduce((sum, p) => sum + p.Td, 0);
      const sumMTd = pointsWithTd.reduce((sum, p) => sum + p.Td * p.dist, 0);
      
      let R_map = new Map();
      if (colPts.length >= 2) {
        // R = A + B*x の線形分布で平衡させる (ΣR = -ΣTd, ΣRx = -ΣTdx)
        const n = colPts.length;
        const targetSumR = -sumTd;
        const targetSumMR = -sumMTd;
        const sumX = colPts.reduce((sum, p) => sum + p.dist, 0);
        const sumX2 = colPts.reduce((sum, p) => sum + (p.dist * p.dist), 0);
        
        const det = n * sumX2 - sumX * sumX;
        if (Math.abs(det) > 1e-6) {
          const A = (targetSumR * sumX2 - targetSumMR * sumX) / det;
          const B = (n * targetSumMR - targetSumR * sumX) / det;
          colPts.forEach(p => {
            R_map.set(p.dist, A + B * p.dist);
          });
        } else {
          colPts.forEach(p => R_map.set(p.dist, targetSumR / n));
        }
      } else if (colPts.length === 1) {
        R_map.set(colPts[0].dist, -sumTd);
      }

      let qe = 0;
      let m_water = 0;
      let prevDist = 0;
      pointsWithTd.forEach((p, i) => {
        const R = R_map.get(p.dist) || 0;
        if (i > 0) m_water += qe * (p.dist - prevDist) / 1000; // mm -> m
        
        qe += (p.Td + R);
        results.push({ Td: p.Td, R, Qe: qe, M_f: m_water });
        prevDist = p.dist;
      });

    } else {
      // --- 従来の両端支点モデル ---
      const colIndices = pointsWithTd.map((p, idx) => p.type === 'column' ? idx : -1).filter(i => i !== -1);
      let supportIdx1, supportIdx2;
      if (colIndices.length === 0) {
        supportIdx1 = 0; supportIdx2 = pointsWithTd.length - 1;
      } else if (colIndices.length === 1) {
        supportIdx1 = colIndices[0]; supportIdx2 = colIndices[0];
      } else {
        supportIdx1 = colIndices[0]; supportIdx2 = colIndices[colIndices.length - 1];
      }

      const sum_Td = pointsWithTd.reduce((sum, p) => sum + p.Td, 0);
      const d1 = pointsWithTd[supportIdx1].dist;
      const d2 = pointsWithTd[supportIdx2].dist;
      const supportL = d2 - d1;
      
      let sum_M_at_s1 = 0;
      pointsWithTd.forEach(p => {
        sum_M_at_s1 += p.Td * (p.dist - d1);
      });

      let R1 = 0, R2 = 0;
      if (supportL > 0.001) {
        R2 = -sum_M_at_s1 / supportL;
        R1 = -sum_Td - R2;
      } else {
        R1 = -sum_Td; R2 = 0;
      }

      let qe = 0;
      let m_water = 0;
      let prevDist = 0;
      pointsWithTd.forEach((p, i) => {
        let R = 0;
        if (i === supportIdx1) R += R1;
        if (i === supportIdx2 && supportIdx1 !== supportIdx2) R += R2;
        
        if (i > 0) m_water += qe * (p.dist - prevDist) / 1000;
        qe += (p.Td + R);
        results.push({ Td: p.Td, R, Qe: qe, M_f: m_water });
        prevDist = p.dist;
      });
    }
    return results;
  };
  return { points, resL: calcDir('L'), resR: calcDir('R'), totalL };
};
