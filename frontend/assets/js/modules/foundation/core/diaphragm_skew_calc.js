/**
 * diaphragm_skew_calc.js
 * 水平構面 斜め軸回転モデル 計算エンジン (グレー本 3-7節 単純梁モデル)
 */

// ── ユーティリティ ──────────────────────────────────────────────────────────

function _getNode(nodes, nid) {
  if (!nodes || nid === undefined || nid === null) return null;
  const idx = parseInt(nid);
  if (!isNaN(idx) && idx >= 0 && idx < nodes.length) {
    const n = nodes[idx];
    if (n) return n;
  }
  const nidStr = String(nid);
  return nodes.find(n => n && (n.index == nid || n.id == nidStr || String(n.id) === nidStr)) || null;
}

export function rotatePoint(x, y, thetaRad) {
  const cos = Math.cos(thetaRad);
  const sin = Math.sin(thetaRad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function wallLength_mm(wall, nodes) {
  if (wall.lengthOverride && parseFloat(wall.lengthOverride) > 0) return parseFloat(wall.lengthOverride);
  const n1 = _getNode(nodes, wall.n1), n2 = _getNode(nodes, wall.n2);
  if (!n1 || !n2) return 0;
  return Math.hypot(n2.x - n1.x, n2.y - n1.y);
}

// ── 耐力壁線の検出 ──────────────────────────────────────────────────────────

const AXIS_CLUSTER_TOL_MM = 50;

export function extractWallLines(walls, nodes, thetaRad) {
  const xDirMap = {}, yDirMap = {};
  (walls || []).forEach(w => {
    const m = w.multiplier ?? 0;
    if (m <= 0) return;
    const n1 = _getNode(nodes, w.n1), n2 = _getNode(nodes, w.n2);
    if (!n1 || !n2) return;
    const r1 = rotatePoint(n1.x, n1.y, thetaRad), r2 = rotatePoint(n2.x, n2.y, thetaRad);
    const dxp = r2.x - r1.x, dyp = r2.y - r1.y;
    const wallAngleRad = Math.atan2(dyp, dxp);
    
    const cos2 = Math.pow(Math.cos(wallAngleRad), 2);
    const sin2 = Math.pow(Math.sin(wallAngleRad), 2);

    // X'方向（軸方向）への寄与
    if (cos2 > 0.001) {
      const yp = (r1.y + r2.y) / 2;
      const key = _clusterKey(xDirMap, yp);
      if (!xDirMap[key]) {
        xDirMap[key] = { pos: yp, walls: [], axisName: w.axisName || "", isExterior: false };
      } else if (!xDirMap[key].axisName && w.axisName) {
        xDirMap[key].axisName = w.axisName;
      }
      xDirMap[key].walls.push({ ...w, effMultFactor: cos2, _rotPos: yp });
      if (w.isExterior) xDirMap[key].isExterior = true;
    }
    
    // Y'方向（軸直交方向）への寄与
    if (sin2 > 0.001) {
      const xp = (r1.x + r2.x) / 2;
      const key = _clusterKey(yDirMap, xp);
      if (!yDirMap[key]) {
        yDirMap[key] = { pos: xp, walls: [], axisName: w.axisName || "", isExterior: false };
      } else if (!yDirMap[key].axisName && w.axisName) {
        yDirMap[key].axisName = w.axisName;
      }
      yDirMap[key].walls.push({ ...w, effMultFactor: sin2, _rotPos: xp });
      if (w.isExterior) yDirMap[key].isExterior = true;
    }
  });
  return {
    xDir: Object.values(xDirMap).sort((a, b) => a.pos - b.pos),
    yDir: Object.values(yDirMap).sort((a, b) => a.pos - b.pos),
  };
}

function _clusterKey(map, pos) {
  for (const k in map) if (Math.abs(map[k].pos - pos) < AXIS_CLUSTER_TOL_MM) return k;
  return String(pos.toFixed(0));
}

// ── 有効耐力壁線の判定 ──────────────────────────────────────────────────────

/**
 * 支持点（耐力壁線）の有効性判定と命名を行う
 * 優先順位: 幾何学的な基準軸一致 > 壁符号 > 既存の名称
 */
export function judgeEffectiveWallLines(lineGroups, nodes, depthM, deltaQa, allowedAxisMap = new Map()) {
  const dQa = deltaQa || 1.96;
  return lineGroups.map(grp => {
    let pa = 0;
    // 💡 壁符号 (W1, W2等) の収集
    const wallSymbols = [...new Set(grp.walls.map(w => w.symbol || w.id || "").filter(Boolean))];
    grp.walls.forEach(w => {
      pa += (w.multiplier ?? 0) * (wallLength_mm(w, nodes)/1000) * dQa * (w.effMultFactor ?? 1.0);
    });
    const threshold1 = depthM * 0.6 * dQa;
    const isEffective = (pa >= threshold1) && (pa >= 7.0);
    
    // 💡 ラベル判定（幾何学的な座標一致を最優先）
    let baseAxisName = "";
    const TOL = 120; // 💡 120mm 許容誤差に緩和 (壁厚分程度のズレを許容し、確実に通り芯名を拾う)

    for (const [name, theoreticalPos] of allowedAxisMap.entries()) {
        // グループ内の全壁を幾何チェック
        const hasGeomMatch = grp.walls.some(w => Math.abs((w._rotPos || 0) - theoreticalPos) < TOL);
        
        // 💡 属性チェック (w.axisName が一致するか)
        const hasAttrMatch = grp.walls.some(w => w.axisName === name);

        if (hasGeomMatch || hasAttrMatch || Math.abs(grp.pos - theoreticalPos) < TOL) {
            baseAxisName = name;
            break;
        }
    }
    
    // 基準軸でない場合、壁符号の有無を確認
    let label = "";
    if (baseAxisName) {
      label = baseAxisName;
    } else if (wallSymbols.length > 0) {
      label = wallSymbols.join('+');
    } else {
      label = grp.axisName || `${(grp.pos/1000).toFixed(2)}m`;
    }
    
    if (grp.isExterior) label = `(外)${label}`;
    
    return { 
      ...grp, 
      label, 
      axisName: label, 
      wallSymbols, 
      pa, 
      threshold1, 
      isEffective,
      judge1: pa >= threshold1,
      judge2: pa >= 7.0
    };
  });
}

export function mergeAdjacentWallLines(lineGroups) {
  if (lineGroups.length <= 1) return lineGroups;
  // 💡 ポジション順にソート
  const sorted = [...lineGroups].sort((a, b) => a.pos - b.pos);
  const result = [];
  
  for (const current of sorted) {
    if (result.length === 0) {
      result.push({ ...current });
      continue;
    }
    const last = result[result.length - 1];
    
    // 💡 1P (910mm) 以内であれば合算対象
    const isAdjacent = Math.abs(current.pos - last.pos) < 910;
    
    // 💡 ユーザー指摘: 外壁線が絡む場合は合算しない
    const canMerge = isAdjacent && !current.isExterior && !last.isExterior;

    if (canMerge) {
      // 合算処理
      last.walls = [...last.walls, ...current.walls];
      // 代表位置を平均にするか（ここでは維持）
      // 軸名を維持（もし片方が空なら補完）
      if (!last.axisName && current.axisName) last.axisName = current.axisName;
    } else {
      result.push({ ...current });
    }
  }
  return result;
}

// ── 区間解析ヘルパー ────────────────────────────────────────────────────────

function analyzeIntervalRange(posA, posB, allDiaphragms, nodes, thetaRad, loadDir, floorSpecs) {
    const pStart = Math.min(posA, posB), pEnd = Math.max(posA, posB);
  
    const getNodes = (d) => {
      if (d.nodeIds && d.nodeIds.length >= 3) {
        return d.nodeIds.map(nid => _getNode(nodes, nid)).filter(Boolean);
      }
      if (d.x !== undefined && d.y !== undefined && d.w !== undefined && d.h !== undefined) {
        return [
          { x: d.x, y: d.y },
          { x: d.x + d.w, y: d.y },
          { x: d.x + d.w, y: d.y + d.h },
          { x: d.x, y: d.y + d.h }
        ];
      }
      return [];
    };

    const relevantDiaphs = (allDiaphragms || []).filter(d => {
      const pts = getNodes(d);
      if (pts.length < 3) return false;
      const rotated = pts.map(p => rotatePoint(p.x, p.y, thetaRad));
      const coords = rotated.map(r => (loadDir === 'xDir' ? r.y : r.x));
      return Math.max(...coords) > pStart + 0.1 && Math.min(...coords) < pEnd - 0.1;
    });

    if (relevantDiaphs.length === 0) return { minTotalPa: 0, avgDepth: 0, avgDeltaQa: 0, elements: [] };

    const criticalPoints = new Set([pStart, pEnd]);
    relevantDiaphs.forEach(d => {
      getNodes(d).forEach(p => {
        const r = rotatePoint(p.x, p.y, thetaRad);
        const c = (loadDir === 'xDir' ? r.y : r.x);
        if (c > pStart && c < pEnd) criticalPoints.add(c);
      });
    });
    const sortedPoints = Array.from(criticalPoints).sort((a, b) => a - b);
    const totalSpanWidth = pEnd - pStart;
    if (totalSpanWidth <= 0.1) return { minTotalPa: 0, avgDepth: 0, avgDeltaQa: 0, elements: [] };

    const samples = [];
    for (let i = 0; i < sortedPoints.length - 1; i++) {
        const c1 = sortedPoints[i], c2 = sortedPoints[i+1];
        if (c2 - c1 > 0.01) samples.push((c1 + c2) / 2);
    }
    if (samples.length === 0) samples.push((pStart + pEnd) / 2);

    let maxTotalPa = 0;
    let finalElements = [];

    // 💡 ユーザー要望: 斜め形状ではなく「整形な四角形」を拾い出す
    // ロジック: 区間内の各断面を走査し、最大の合計奥行き(h)を持つ断面を代表とする
    samples.forEach(scanC => {
      let currentTotalPa = 0, currentElements = [];
      relevantDiaphs.forEach(d => {
        const pts = getNodes(d);
        const rotated = pts.map(p => rotatePoint(p.x, p.y, thetaRad));
        const intersections = [];
        for (let k = 0; k < rotated.length; k++) {
          const p1 = rotated[k], p2 = rotated[(k + 1) % rotated.length];
          const x1 = (loadDir === 'xDir' ? p1.y : p1.x), x2 = (loadDir === 'xDir' ? p2.y : p2.x);
          const y1 = (loadDir === 'xDir' ? p1.x : p1.y), y2 = (loadDir === 'xDir' ? p2.x : p2.y);
          if (Math.abs(x1 - x2) < 0.001) continue;
          if ((x1 <= scanC && scanC < x2) || (x2 <= scanC && scanC < x1)) {
            intersections.push(y1 + (y2 - y1) * (scanC - x1) / (x2 - x1));
          }
        }
        intersections.sort((a, b) => a - b);
        let depth = 0;
        for (let k = 0; k < intersections.length - 1; k += 2) depth += Math.max(0, intersections[k+1] - intersections[k]);
        
        const dqa = (floorSpecs && (floorSpecs[d.subType || 'roof'] ?? floorSpecs['roof'])) ?? (d.delta_qa || 0);
        const pa = (depth / 1000) * dqa;
        currentTotalPa += pa;
        if (depth > 0) {
          currentElements.push({ id: d.id, deltaQa: dqa, depth_m: depth / 1000, pa: pa });
        }
      });

      if (currentTotalPa > maxTotalPa) {
        maxTotalPa = currentTotalPa;
        finalElements = currentElements;
      }
    });

    const totalDepth = finalElements.reduce((sum, e) => sum + e.depth_m, 0);
    return {
      minTotalPa: maxTotalPa,
      avgDepth: totalDepth,
      avgDeltaQa: totalDepth > 0 ? (maxTotalPa / totalDepth) : 0,
      elements: finalElements
    };
}

// ── メイン計算 ──────────────────────────────────────────────────────────────

export function calcSpanIntervals(lineGroups, allDiaphragms, nodes, thetaRad, loadDir, floorSpecs = null) {
  const allSupports = lineGroups.filter(g => g.isEffective || g.isExterior).sort((a, b) => a.pos - b.pos);
  if (allSupports.length < 2) return [];

  const intervals = [];
  for (let i = 0; i < allSupports.length - 1; i++) {
    const la = allSupports[i], lb = allSupports[i + 1];
    
    let spanMultiplier = 1.0;
    let note = "";
    if (la.isExterior && !la.isEffective) { spanMultiplier = 2.0; note = "外壁起算(2L)"; }
    if (lb.isExterior && !lb.isEffective) { spanMultiplier = 2.0; note = "外壁起算(2L)"; }

    const analysis = analyzeIntervalRange(la.pos, lb.pos, allDiaphragms, nodes, thetaRad, loadDir, floorSpecs);
    
    const h_m = analysis.avgDepth;
    const dqa = analysis.avgDeltaQa || 1.96;
    const span_l_m = (Math.abs(lb.pos - la.pos) / 1000) * spanMultiplier;
    const alpha = h_m >= 12.0 ? 1.0 : (h_m >= 8.0 ? 0.8 : 0.6);
    const QE = 0.24 * alpha * dqa * h_m * span_l_m;
    const QW = 1.7 * alpha * span_l_m;
    const capacity = analysis.minTotalPa;

    intervals.push({
      lineALabel: la.axisName || `L${i+1}`,
      lineBLabel: lb.axisName || `L${i+2}`,
      span_l_m,
      depth_h_m: h_m,
      avgDeltaQa: dqa,
      capacity,
      elements: analysis.elements,
      isCantilever: spanMultiplier > 1.0,
      note,
      alpha,
      QE,
      QW,
      isOK: (capacity >= QE && capacity >= QW)
    });
  }
  return intervals;
}

export function verifyIntervals(intervals, hasIntermediateWall) {
  return intervals.map(iv => {
    const alpha = hasIntermediateWall ? 1.6 : 1.0;
    const reqQ = iv.avgDeltaQa * iv.depth_h_m;
    const QE = 0.24 * alpha * iv.depth_h_m * iv.span_l_m;
    const QW = 1.7 * alpha * iv.span_l_m;
    const isOK = iv.capacity >= QE && iv.capacity >= QW;
    return { ...iv, alpha, reqQ, QE, QW, isOK };
  });
}

export function calcSkewedDiaphragmModel({ diaphragm, allDiaphragms, nodes, walls, wallNodes, skewedAxis, hasIntermediateWall, floorSpecs, floorKey }) {
  let thetaDeg = skewedAxis.angle;
  if (thetaDeg === undefined && skewedAxis.p1 && skewedAxis.p2) {
    const dx = skewedAxis.p2.x - skewedAxis.p1.x;
    const dy = skewedAxis.p2.y - skewedAxis.p1.y;
    thetaDeg = Math.atan2(dy, dx) * 180 / Math.PI;
  }
  if (thetaDeg === undefined) thetaDeg = 0;
  // 💡 修正: 角度 theta の軸を水平(0°)にするには、座標系を -theta 回転させる必要がある
  const thetaRad = (-thetaDeg * Math.PI) / 180;

  // 💡 支持点判定用の節点 (wallNodes) がない場合は自階の nodes を予備とする
  const wNodes = wallNodes || nodes;

  // 💡 修正: 奥行きhの算出。階に含まれる「全ての構面」の範囲を合算する
  const allDiaNodes = (allDiaphragms || []).flatMap(d => d.nodeIds || []);
  let pts = [...new Set(allDiaNodes)].map(nid => _getNode(nodes, nid)).filter(Boolean);
  
  // フォールバック: 構面データがない場合は階全体の節点を使用
  if (pts.length < 3) {
      pts = nodes.filter(n => n && typeof n.x === 'number' && typeof n.y === 'number');
  }
  if (pts.length < 3) return null;

  const rotPts = pts.map(p => rotatePoint(p.x, p.y, thetaRad));
  const minX = Math.min(...rotPts.map(p => p.x)), maxX = Math.max(...rotPts.map(p => p.x));
  const minY = Math.min(...rotPts.map(p => p.y)), maxY = Math.max(...rotPts.map(p => p.y));

  // 💡 方向の定義: 加力方向と「直交」する方向の長さが奥行き h となる
  // 💡 【重要・FIX】奥行きhの算出。
  // グレー本に基づき、奥行き h は「加力方向」の広がりとする。
  const depthX_m = (maxX - minX) / 1000; // X'方向の広がり (X'方向加力の際の奥行きh)
  const depthY_m = (maxY - minY) / 1000; // Y'方向の広がり (Y'方向加力の際の奥行きh)

  let deltaQa = diaphragm.delta_qa ?? 0;
  if (floorSpecs) {
    const subType = diaphragm.subType || 'roof';
    if (floorSpecs[subType] !== undefined) deltaQa = floorSpecs[subType];
    else if (floorKey && floorSpecs[floorKey] && floorSpecs[floorKey][subType] !== undefined) deltaQa = floorSpecs[floorKey][subType];
  }

  // 💡 方向別に許可される通り芯マップを作成
  const allowedXMap = new Map(); // X'軸に平行な軸 (X'方向加力の支持点になる)
  const allowedYMap = new Map(); // Y'軸に平行な軸 (Y'方向加力の支持点になる)

  const getRotatedPos = (ax) => {
      if (!ax.p1) return null;
      return rotatePoint(ax.p1.x, ax.p1.y, thetaRad);
  };

  const allSkewed = window.state?.dxfSkewedAxes || [];
  
  // 💡 基準となる斜め軸そのものを確実にマップに登録 (最優先)
  const primaryP = getRotatedPos(skewedAxis);
  if (primaryP && skewedAxis.label) {
      allowedXMap.set(skewedAxis.label, primaryP.y);
  }

  allSkewed.forEach(ax => {
    if (!ax.label) return;
    const dThetaDeg = (ax.angle || 0) - (skewedAxis.angle || 0);
    const dThetaRad = (dThetaDeg * Math.PI) / 180;
    
    const p = getRotatedPos(ax);
    if (!p) return;

    if (Math.abs(Math.sin(dThetaRad)) < 0.01) {
        // X'軸に平行 (dTheta = 0 or 180)
        allowedXMap.set(ax.label, p.y); // 位置はY'座標
    } else if (Math.abs(Math.cos(dThetaRad)) < 0.01) {
        // Y'軸に平行 (dTheta = 90 or 270)
        allowedYMap.set(ax.label, p.x); // 位置はX'座標
    }
  });

  const { xDir: xDirLines, yDir: yDirLines } = extractWallLines(walls, wNodes, thetaRad);

  // 💡 外壁線のみの境界を取得（延長線の基準にするため）
  let outerMinX = minX, outerMaxX = maxX, outerMinY = minY, outerMaxY = maxY;
  const extWalls = [...xDirLines, ...yDirLines].filter(l => l.isExterior);
  if (extWalls.length > 0) {
      outerMinX = Math.min(...extWalls.flatMap(l => l.walls.flatMap(w => [rotatePoint(_getNode(wNodes, w.n1).x, _getNode(wNodes, w.n1).y, thetaRad).x, rotatePoint(_getNode(wNodes, w.n2).x, _getNode(wNodes, w.n2).y, thetaRad).x])));
      outerMaxX = Math.max(...extWalls.flatMap(l => l.walls.flatMap(w => [rotatePoint(_getNode(wNodes, w.n1).x, _getNode(wNodes, w.n1).y, thetaRad).x, rotatePoint(_getNode(wNodes, w.n2).x, _getNode(wNodes, w.n2).y, thetaRad).x])));
      outerMinY = Math.min(...extWalls.flatMap(l => l.walls.flatMap(w => [rotatePoint(_getNode(wNodes, w.n1).x, _getNode(wNodes, w.n1).y, thetaRad).y, rotatePoint(_getNode(wNodes, w.n2).x, _getNode(wNodes, w.n2).y, thetaRad).y])));
      outerMaxY = Math.max(...extWalls.flatMap(l => l.walls.flatMap(w => [rotatePoint(_getNode(wNodes, w.n1).x, _getNode(wNodes, w.n1).y, thetaRad).y, rotatePoint(_getNode(wNodes, w.n2).x, _getNode(wNodes, w.n2).y, thetaRad).y])));
  }
  
  // 💡 まずマージ（1P以内の近接線を統合）
  const mergedX = mergeAdjacentWallLines(xDirLines);
  const mergedY = mergeAdjacentWallLines(yDirLines);

  // 💡 【重要・FIX】通り芯判定ロジック：
  // 誤差許容範囲 120mm を維持し、幾何判定と属性判定を併用する。安易に変更禁止。

  // X'方向検討 (加力X'に平行なX'系軸が支持点。奥行きhは加力方向のX'広がり)
  const judgedXDir = judgeEffectiveWallLines(mergedX, wNodes, depthX_m, deltaQa, allowedXMap);
  // Y'方向検討 (加力Y'に平行なY'系軸が支持点。奥行きhは加力方向のY'広がり)
  const judgedYDir = judgeEffectiveWallLines(mergedY, wNodes, depthY_m, deltaQa, allowedYMap);

  const effectiveXCount = judgedXDir.filter(g => g.isEffective).length;
  const effectiveYCount = judgedYDir.filter(g => g.isEffective).length;

  const spansX = calcSpanIntervals(judgedXDir, allDiaphragms, nodes, thetaRad, 'xDir', floorSpecs);
  const spansY = calcSpanIntervals(judgedYDir, allDiaphragms, nodes, thetaRad, 'yDir', floorSpecs);
  const verifiedX = verifyIntervals(spansX, hasIntermediateWall);
  const verifiedY = verifyIntervals(spansY, hasIntermediateWall);

  const isOKX = verifiedX.length > 0 && verifiedX.every(v => v.isOK);
  const isOKY = verifiedY.length > 0 && verifiedY.every(v => v.isOK);

  return {
    axisLabel: skewedAxis.label, thetaDeg, thetaRad, deltaQa,
    minX, maxX, minY, maxY,
    outerMinX, outerMaxX, outerMinY, outerMaxY,
    xDir: { wallLines: judgedXDir, effectiveCount: effectiveXCount, spans: verifiedX, isOK: isOKX },
    yDir: { wallLines: judgedYDir, effectiveCount: effectiveYCount, spans: verifiedY, isOK: isOKY },
    isOK: isOKX && isOKY
  };
}

window.calcSkewedDiaphragmModel = calcSkewedDiaphragmModel;
window.rotatePoint = rotatePoint;
