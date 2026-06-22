// core/column_calc.js
import { HARDWARE_MASTER, TOLERANCES, isSamePoint } from './constants.js';
import { findSupportsOnBeam } from './beam_calc.js';
import { calculateAxialForcesForAxis } from './axial_force_calculator.js';
import { getAxisReferenceLine, getProjectedPos } from '../rendering/projection_utils.js';
import { dxfVAxes, dxfHAxes, dxfSkewedAxes } from '../foundation_cad.js';

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

        // 10度以内の傾きは水平・垂直にスナップ（斜め通り芯に載っている場合はバイパス）
        const skewAxes = window.dxfSkewedAxes || [];
        const normalizedAxis = (wall.axisName || "").replace(/通り$/, "").trim();
        const isSkewed = skewAxes.some(ax => (ax.label || "").replace(/通り$/, "").trim() === normalizedAxis);

        if (!isSkewed) {
          if (thetaDeg < 10 || thetaDeg > 170) thetaDeg = 0;
          else if (Math.abs(90 - thetaDeg) < 10) thetaDeg = 90;
        }

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

  // 1. 全ての通り芯名リストを抽出
  const allAxes = new Set();
  const vAxes = window.dxfVAxes || dxfVAxes || [];
  const hAxes = window.dxfHAxes || dxfHAxes || [];
  const skewedAxes = window.dxfSkewedAxes || dxfSkewedAxes || [];
  vAxes.forEach(a => { if (a.label) allAxes.add(a.label); });
  hAxes.forEach(a => { if (a.label) allAxes.add(a.label); });
  skewedAxes.forEach(a => { if (a.label) allAxes.add(a.label); });
  Object.values(allFloorData).forEach(fData => {
    (fData.walls || []).forEach(w => { if (w.axisName) allAxes.add(w.axisName); });
    (fData.beams || []).forEach(b => { if (b.axisName) allAxes.add(b.axisName); });
  });

  // 2. 柱が載っている通り芯を検出
  const matchingAxes = [];
  allAxes.forEach(axisName => {
    const refLine = getAxisReferenceLine(axisName, allFloorData);
    if (!refLine) return;
    const { offset } = getProjectedPos(targetNode, refLine);
    if (Math.abs(offset) < 15) { // 余裕を見て 15mm
      matchingAxes.push(axisName);
    }
  });

  const axisResults = {};
  const targetFloorIdx = floorList.indexOf(targetFloorKey);

  matchingAxes.forEach(axisName => {
    // 3. 通り芯上の累積軸力を計算
    const calcResult = calculateAxialForcesForAxis(axisName, allFloorData, floorList);
    if (!calcResult) return;

    const { pValues, forceMap, refLine } = calcResult;
    const colL = getProjectedPos(targetNode, refLine).L;

    // 投影座標 colL に最も近い節点 p を探す (150mm 以内)
    const p = pValues.find(ex => Math.abs(ex - colL) < 150);
    if (p === undefined) return; // この通り芯上の節点に柱が位置していない場合は無視

    // 4. 加力方向（L, R）ごとに、最上階から対象階までの軸力履歴を集計
    // 各階 f における累積軸力 S_f を取得し、単階増分 D_f を算出する
    const getIncrements = (mode) => {
      const increments = {}; // floor -> increment
      let prevS = 0;
      for (let i = 0; i <= targetFloorIdx; i++) {
        const fKey = floorList[i];
        const S_f = (forceMap[fKey] && forceMap[fKey][p]) ? (forceMap[fKey][p][mode] || 0) : 0;
        increments[fKey] = S_f - prevS;
        prevS = S_f;
      }
      return increments;
    };

    const incrementsL = getIncrements('L');
    const incrementsR = getIncrements('R');

    // 5. 各階の Bi_bot, Bi_top, inflectionRatio (B) を用いて、柱頭・柱脚・Tdの引抜力を計算
    const calculateForMode = (increments, mode) => {
      let sum_Ni_upper = 0;
      let sum_Td_upper = 0;
      let Ni_top_this = 0;
      let Ni_bot_this = 0;
      let Td_this = 0;
      let Bi_top = 0.5;
      let Bi_bot = 0.5;

      for (let i = 0; i <= targetFloorIdx; i++) {
        const fKey = floorList[i];
        const isCurrentFloor = (fKey === targetFloorKey);
        const fData = allFloorData[fKey];
        if (!fData) continue;

        // 同一座標にある他階の柱を取得
        const cIdx = fData.columns.findIndex(c => {
          const n = fData.nodes[c.nodeIndex];
          return n && isSamePoint(n, targetNode, TOLERANCES.STRUCTURAL_CONN);
        });
        const fCol = cIdx !== -1 ? fData.columns[cIdx] : null;
        const biObj = getBi(fCol);
        const currentB = parseFloat(fCol?.inflectionRatio || 0.5);

        const incVal = increments[fKey] || 0;

        if (isCurrentFloor) {
          Bi_top = biObj.top;
          Bi_bot = biObj.bot;
          Ni_top_this = incVal * biObj.top;
          Ni_bot_this = incVal * biObj.bot;
          Td_this = incVal * currentB;
        } else {
          sum_Ni_upper += incVal * biObj.bot;
          sum_Td_upper += incVal * currentB;
        }
      }

      return { Ni_top_this, Ni_bot_this, Td_this, sum_Ni_upper, sum_Td_upper, Bi_top, Bi_bot };
    };

    const resL = calculateForMode(incrementsL, 'L');
    const resR = calculateForMode(incrementsR, 'R');

    // qail_Hi, qair_Hi 用の集計
    // 対象階 targetFloorKey において、柱の左右にある壁倍率 * 1.96 * Hi の合計値
    let qail_Hi = 0;
    let qair_Hi = 0;
    const currentFd = allFloorData[targetFloorKey];
    if (currentFd) {
      const Hi = (fd.floorHeight || 2730) / 1000;
      const wallsOnAxis = (currentFd.walls || []).filter(w => {
        if (!w.axisName || w.axisName.trim() !== axisName.trim()) return false;
        const n1 = currentFd.nodes[w.n1], n2 = currentFd.nodes[w.n2];
        if (!n1 || !n2) return false;
        const o1 = getProjectedPos(n1, refLine).offset;
        const o2 = getProjectedPos(n2, refLine).offset;
        return Math.abs(o1) < 15 && Math.abs(o2) < 15;
      });

      wallsOnAxis.forEach(w => {
        const n1 = currentFd.nodes[w.n1], n2 = currentFd.nodes[w.n2];
        const p1 = getProjectedPos(n1, refLine).L;
        const p2 = getProjectedPos(n2, refLine).L;
        const maxP = Math.max(p1, p2);
        const minP = Math.min(p1, p2);
        const M = w.multiplier || 0;
        const val = 1.96 * M * Hi;

        if (maxP <= colL + 0.1) {
          qail_Hi += val;
        } else if (minP >= colL - 0.1) {
          qair_Hi += val;
        }
      });
    }

    axisResults[axisName] = {
      axisName,
      resL,
      resR,
      qail_Hi,
      qair_Hi,
      refLine
    };
  });

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
      if (mId === 'custom') {
        return { 
          name: mName || '任意金物', 
          cap: parseFloat(mCap) || 0, 
          isManual: true 
        };
      } else if (master) {
        return {
          name: master.name,
          cap: master.cap,
          isManual: true
        };
      } else {
        return { name: '未定義', cap: 0, isManual: true };
      }
    }
    return { name: aMetal.name, cap: aMetal.cap, isManual: false };
  };

  const cases = [];
  Object.keys(axisResults).forEach(function(axisName) {
    const res = axisResults[axisName];
    // 角度から X/Y 方向を判定
    const dx = Math.cos(res.refLine.angle);
    const dy = Math.sin(res.refLine.angle);
    const axisDirection = (Math.abs(dx) >= Math.abs(dy)) ? 'X' : 'Y';

    const dirs = [ 
      { name: '左から (→)', mode: 'L', data: res.resL }, 
      { name: '右から (←)', mode: 'R', data: res.resR } 
    ];

    dirs.forEach(function(d) {
      const calcData = d.data;
      const axisOver = (col.axisOverrides || {})[axisName] || {};
      
      const manualValue = (d.mode === 'L') 
          ? (axisOver.L !== undefined && axisOver.L !== null ? axisOver.L : (col.niUpperOverride_L || null))
          : (axisOver.R !== undefined && axisOver.R !== null ? axisOver.R : (col.niUpperOverride_R || null));

      const ni_upper = (manualValue !== null && manualValue !== "" && !isNaN(parseFloat(manualValue))) 
          ? parseFloat(manualValue) : calcData.sum_Ni_upper;
      
      const T_top_raw = (calcData.Ni_top_this + ni_upper) - reduction;
      const T_bot_raw = (calcData.Ni_bot_this + ni_upper) - reduction;
      const Td_val = calcData.Td_this + calcData.sum_Td_upper;

      const topInfo = getMetalInfo(col.top_metalMode, col.top_metalId, col.top_metalCap, col.top_metalName, getAutoMetal(T_top_raw));
      const baseInfo = getMetalInfo(col.base_metalMode, col.base_metalId, col.base_metalCap, col.base_metalName, getAutoMetal(T_bot_raw));

      cases.push({
        name: axisName + ' ' + d.name,
        axisName: axisName,
        direction: axisDirection, 
        q1_Hi: res.qail_Hi, q2_Hi: res.qair_Hi,
        Bi_top: calcData.Bi_top, Bi_bot: calcData.Bi_bot,
        Ni_top: calcData.Ni_top_this, Ni_bot: calcData.Ni_bot_this, Ni_upper: ni_upper,
        totalNi_top: calcData.Ni_top_this + ni_upper, totalNi_bot: calcData.Ni_bot_this + ni_upper,
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
