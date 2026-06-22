// core/axial_force_calculator.js
import { getAxisReferenceLine, getProjectedPos } from '../rendering/projection_utils.js';
import { dxfVAxes, dxfHAxes, dxfSkewedAxes, floorData, FLOORS } from '../foundation_cad.js';

/**
 * 指定された通り芯上の各柱の累積軸力（低減前・加力方向別）をグローバルにつり合い計算する
 * 
 * @param {string} axisName - 通り芯名 (例: "X1", "Y2", "S1")
 * @param {Object} allFloorData - 全階層のデータ
 * @param {string[]} floorList - 階層リスト (例: ['PH','R','3','2','1'])
 * @returns {Object|null} { pValues, forceMap, refLine }
 */
export function calculateAxialForcesForAxis(axisName, allFloorData, floorList) {
  if (!axisName) return null;

  if (!allFloorData) allFloorData = window.floorData || {};
  if (!floorList || floorList.length === 0) floorList = window.FLOORS || ['PH','R','3','2','1'];

  const refLine = getAxisReferenceLine(axisName, allFloorData);
  if (!refLine) return null;

  const floorDataMap = [];
  let maxRelIdx = floorList.length - 1;
  floorList.forEach((f, idx) => {
    const fd = allFloorData[f];
    if (fd && (fd.walls || []).length > 0) {
      if (idx < maxRelIdx) maxRelIdx = idx;
    }
  });

  floorList.forEach((floor, idx) => {
    const fd = allFloorData[floor];
    if (!fd) return;

    // 通り芯上に載っている壁をフィルタリング
    const wallsOnAxis = (fd.walls || []).filter(w => {
      if (!w.axisName || w.axisName.trim() !== axisName.trim()) return false;
      const n1 = fd.nodes[w.n1], n2 = fd.nodes[w.n2];
      if (!n1 || !n2) return false;
      const o1 = getProjectedPos(n1, refLine).offset;
      const o2 = getProjectedPos(n2, refLine).offset;
      return Math.abs(o1) < 10 && Math.abs(o2) < 10;
    });
    
    // 通り芯上にある柱をフィルタリング
    const columnsOnAxis = (fd.columns || []).filter(c => {
      const n = fd.nodes[c.nodeIndex];
      if (!n) return false;
      const offset = getProjectedPos(n, refLine).offset;
      return Math.abs(offset) < 10;
    });

    if (wallsOnAxis.length === 0 && columnsOnAxis.length === 0) {
      if (idx >= maxRelIdx) {
        floorDataMap.push({ floor, walls: [], columns: [], fd });
      }
      return;
    }
    floorDataMap.push({ floor, walls: wallsOnAxis, columns: columnsOnAxis, fd });
  });

  if (floorDataMap.length === 0) return null;
  
  const getPos = (n) => getProjectedPos(n, refLine).L;
  const rawPValues = [];
  floorDataMap.forEach(fm => {
    fm.walls.forEach(w => {
      if (fm.fd.nodes[w.n1]) rawPValues.push(getPos(fm.fd.nodes[w.n1]));
      if (fm.fd.nodes[w.n2]) rawPValues.push(getPos(fm.fd.nodes[w.n2]));
    });
    fm.columns.forEach(c => {
      if (fm.fd.nodes[c.nodeIndex]) rawPValues.push(getPos(fm.fd.nodes[c.nodeIndex]));
    });
  });

  // 近接する節点をクラスタリング（150mm以内の遊び）
  const pValues = [];
  rawPValues.sort((a, b) => a - b).forEach(v => {
    const existing = pValues.find(ex => Math.abs(ex - v) < 150);
    if (existing === undefined) pValues.push(v);
  });

  const forceMap = {};
  floorList.forEach(f => forceMap[f] = {});

  // 各階の軸力流し込み・累積計算（立面フレームと完全同一ロジック）
  floorDataMap.forEach((fm, idx) => {
    const f = fm.floor;
    const prevFloorData = floorDataMap[idx - 1];
    
    if (prevFloorData && forceMap[prevFloorData.floor]) {
      Object.entries(forceMap[prevFloorData.floor]).forEach(([pos, forces]) => {
        const d = parseFloat(pos);
        const currentNodes = Array.from(new Set(fm.walls.flatMap(w => [getPos(fm.fd.nodes[w.n1]), getPos(fm.fd.nodes[w.n2])]))).sort((a,b)=>a-b);
        if (currentNodes.length > 0) {
          let leftIdx = -1;
          for(let i=0; i<currentNodes.length; i++) {
            if (currentNodes[i] <= d) leftIdx = i;
          }
          if (leftIdx === -1) {
            const p = currentNodes[0];
            forceMap[f][p] = forceMap[f][p] || { L:0, R:0 };
            forceMap[f][p].L += forces.L; forceMap[f][p].R += forces.R;
          } else if (leftIdx === currentNodes.length - 1) {
            const p = currentNodes[currentNodes.length -1];
            forceMap[f][p] = forceMap[f][p] || { L:0, R:0 };
            forceMap[f][p].L += forces.L; forceMap[f][p].R += forces.R;
          } else {
            const d1 = currentNodes[leftIdx], d2 = currentNodes[leftIdx+1];
            const ratio2 = (d - d1) / (d2 - d1);
            const ratio1 = 1 - ratio2;
            forceMap[f][d1] = forceMap[f][d1] || { L:0, R:0 };
            forceMap[f][d2] = forceMap[f][d2] || { L:0, R:0 };
            forceMap[f][d1].L += forces.L * ratio1; forceMap[f][d1].R += forces.R * ratio1;
            forceMap[f][d2].L += forces.L * ratio2; forceMap[f][d2].R += forces.R * ratio2;
          }
        }
      });
    }

    // 当該階の壁による軸力 N_kN = P * H / L を計算して流し込む
    fm.walls.forEach(w => {
      const n1 = fm.fd.nodes[w.n1], n2 = fm.fd.nodes[w.n2];
      const p1 = getPos(n1), p2 = getPos(n2);
      const L_geo = Math.abs(p2 - p1);
      const L_mm = parseFloat(w.lengthOverride) || L_geo;
      const L = L_mm / 1000;
      if (L < 0.01) return;
      
      const alpha = w.multiplier || 0;
      const P_kN = alpha * 1.96 * L;
      const H_mm = parseFloat(w.heightOverride) || parseFloat(fm.fd.floorHeight) || 2730;
      const H = H_mm / 1000;
      const N_kN = P_kN * H / L;

      const leftP = Math.min(p1, p2), rightP = Math.max(p1, p2);
      forceMap[f][leftP] = forceMap[f][leftP] || { L:0, R:0 };
      forceMap[f][rightP] = forceMap[f][rightP] || { L:0, R:0 };
      
      forceMap[f][leftP].L += N_kN; forceMap[f][rightP].L -= N_kN;
      forceMap[f][leftP].R -= N_kN; forceMap[f][rightP].R += N_kN;
    });
  });

  return { pValues, forceMap, refLine, floorDataMap };
}
