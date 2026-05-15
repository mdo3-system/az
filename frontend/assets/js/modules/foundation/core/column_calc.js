// core/column_calc.js
import { floorData, currentFloor, FLOORS } from '../foundation_cad.js';
import { HARDWARE_MASTER, STRESS_TOLERANCE, isSamePoint } from './constants.js';
import { findSupportsOnBeam } from './beam_calc.js';

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

  var getBi = function(fCol, fData) {
    if (!fCol) return { top: 0.5, bot: 0.5 };
    
    // 手動設定が優先
    if (fCol.biSetting === '0.8' || fCol.biSetting == 0.8) {
      return { top: 0.5, bot: 0.8 };
    }
    if (fCol.biSetting === '0.5' || fCol.biSetting == 0.5) {
      return { top: 0.5, bot: 0.5 };
    }

    // 自動判定 (auto) - ジオメトリから判定
    const nIdx = fCol.nodeIndex;
    const walls = (fData.walls || []).filter(w => w.n1 === nIdx || w.n2 === nIdx);
    if (walls.length === 0) return { top: 0.5, bot: 0.5 };

    // 💡 簡易的な角判定: 1枚しか壁がない（端点）か、異なる方向の壁が2つ以上接している（角）
    const axes = new Set();
    walls.forEach(w => {
      if (w.axisName) axes.add(w.axisName.replace(/通り$/, "").trim());
    });

    const isCorner = (axes.size >= 2 || walls.length === 1);
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
    
    var biObj = getBi(fCol, fData);
    var currentBiTop = biObj.top;
    var currentBiBot = biObj.bot;

    var allWalls = (fData.walls || []).filter(function(w) { 
        var nW1 = fData.nodes[w.n1], nW2 = fData.nodes[w.n2];
        var isLinked = (w.n1 === fNodeIdx || w.n2 === fNodeIdx) ||
                       (nW1 && isSamePoint(nW1, fData.nodes[fNodeIdx], STRESS_TOLERANCE)) ||
                       (nW2 && isSamePoint(nW2, fData.nodes[fNodeIdx], STRESS_TOLERANCE));
        return isLinked; // 💡 通り芯名がなくても物理的に接していれば計算対象に含める
    });
    var groups = {};
    allWalls.forEach(function(w) {
      // 💡 通り芯名を正規化（「通り」を除去してトリム）してグループ化
      var normalizedName = (w.axisName || "").replace(/通り$/, "").trim();
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
        
        res.sumX += (w.multiplier_x || 0) * (w.length_m || 1);
        res.sumY += (w.multiplier_y || 0) * (w.length_m || 1);

        var isRight = (nRemote.x > nCenter.x) || (nRemote.x === nCenter.x && nRemote.y > nCenter.y);
        if (isRight) qair += deltaQ_Hi; else qail += deltaQ_Hi;
      });

      var deltaPower = qair - qail;
      var currentB = 0.5;
      if (fCol.inflectionRatio !== undefined) {
        var parsedB = parseFloat(fCol.inflectionRatio);
        if (!isNaN(parsedB)) currentB = parsedB;
      }

      // 💡 デバッグログ: Td算出の基礎数値を記録
      if (Math.abs(deltaPower) > 0) {
        // console.log(`[TdCalc] Axis:${axisName} Floor:${fKey} deltaPower:${deltaPower.toFixed(3)}`);
      }

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

  var nw = parseFloat(col.nw !== undefined ? col.nw : (col.longTermAxial !== undefined ? col.longTermAxial : (col.axialLoad !== undefined ? col.axialLoad : 0))) || 0;
  var reduction = nw;

  var getAutoMetal = function(T) {
    var table = HARDWARE_MASTER.filter(function(m) { return !m.isCustom; });
    if (T <= 0.0001) return HARDWARE_MASTER[0]; 
    for (var j = 0; j < table.length; j++) {
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
    const axisDirection = (res.sumX >= res.sumY) ? 'X' : 'Y';
    var dirs = [ { name: '左から (→)', sign: 1 }, { name: '右から (←)', sign: -1 } ];

    dirs.forEach(function(d) {
      const sign = d.sign;
      var ni_top_this = res.Ni_top_this * sign;
      var ni_bot_this = res.Ni_bot_this * sign;
      var ni_upper = res.sum_Ni_upper * sign;
      
      var T_top_raw = (ni_top_this + ni_upper) - reduction;
      var T_bot_raw = (ni_bot_this + ni_upper) - reduction;

      var td_this = res.Td_this * sign;
      var td_upper = res.sum_Td_upper * sign;
      var Td_val = td_this + td_upper;

      var topInfo = getMetalInfo(col.top_metalMode, col.top_metalId, col.top_metalCap, col.top_metalName, getAutoMetal(T_top_raw));
      var baseInfo = getMetalInfo(col.base_metalMode, col.base_metalId, col.base_metalCap, col.base_metalName, getAutoMetal(T_bot_raw));

      cases.push({
        name: axisName + ' ' + d.name,
        direction: axisDirection, 
        q1_Hi: res.sum_Qail_Hi, q2_Hi: res.sum_Qair_Hi,
        Bi_top: res.Bi_top, Bi_bot: res.Bi_bot,
        Ni_top: ni_top_this, Ni_bot: ni_bot_this, Ni_upper: ni_upper,
        totalNi_top: ni_top_this + ni_upper, totalNi_bot: ni_bot_this + ni_upper,
        T_top: T_top_raw, T_bot: T_bot_raw,
        Ne_top: ni_top_this + ni_upper, 
        Ne_bot: ni_bot_this + ni_upper, 
        Td: Td_val,
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
  // すべての壁のプロパティを事前に計算（multiplier_x/y が未設定の場合への対策）
  if (fd && fd.walls && fd.nodes) {
    fd.walls.forEach(w => calculateWallProps(w, fd.nodes));
  }

  const n1 = fd.nodes[beam.n1];
  const n2 = fd.nodes[beam.n2];
  if (!n1 || !n2) return null;

  const supports = findSupportsOnBeam(beam, fd.nodes, fd.columns);
  const totalL = Math.hypot(n2.x - n1.x, n2.y - n1.y) / 1000;

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

  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const isBeamHorizontal = Math.abs(dx) > Math.abs(dy);
  
  const calcDir = (mode) => {
    const results = [];
    let sum_Td = 0;
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
        // 💡 修正: calculateColumnT 内で既に反力点高比Bが考慮された Td を取得
        const res = calculateColumnT(cIdx, fd, currentFloor);
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

        Td = (targetCase && targetCase.Td !== undefined && !isNaN(targetCase.Td)) ? targetCase.Td : 0;
      }
      p[`temp_Td_${mode}`] = Td;
      sum_Td += Td;
      sum_M_at_start += Td * p.dist;
    });

    // 💡 修正: 耐力壁の直接的な荷重(sum_Q_wall)は、すでにTdに含まれているため削除
    const colIndices = points.map((p, idx) => p.type === 'column' ? idx : -1).filter(i => i !== -1);
    
    let supportIdx1, supportIdx2;
    if (colIndices.length === 0) {
      supportIdx1 = 0; supportIdx2 = points.length - 1;
    } else if (colIndices.length === 1) {
      supportIdx1 = colIndices[0]; supportIdx2 = colIndices[0];
    } else {
      supportIdx1 = colIndices[0]; supportIdx2 = colIndices[colIndices.length - 1];
    }

    const d1 = points[supportIdx1].dist;
    const d2 = points[supportIdx2].dist;
    const supportL = d2 - d1;

    let sum_M_at_s1 = 0;
    points.forEach(p => {
      sum_M_at_s1 += p[`temp_Td_${mode}`] * (p.dist - d1);
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

    points.forEach((p, i) => {
      let R = 0;
      if (i === supportIdx1) R += R1;
      if (i === supportIdx2 && supportIdx1 !== supportIdx2) R += R2;
      
      const current_Td = p[`temp_Td_${mode}`];
      
      if (i > 0) m_water += qe * (p.dist - prevDist);
      qe += current_Td + R;
      results.push({ Td: current_Td, R, Qe: qe, M_f: m_water });
      prevDist = p.dist;
    });
    return results;
  };
  return { points, resL: calcDir('L'), resR: calcDir('R'), totalL };
};
