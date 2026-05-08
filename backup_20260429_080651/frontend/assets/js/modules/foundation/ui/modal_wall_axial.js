// ui/modal_wall_axial.js
import { floorData, dxfVAxes, dxfHAxes, dxfSkewedAxes } from '../foundation_cad.js';
import { getAxisReferenceLine, getProjectedPos } from '../rendering_helpers.js';

export const openWallAxialModal = function() {
  const allAxes = new Set();
  Object.values(floorData).forEach(fd => {
    (fd.walls || []).forEach(w => { if (w.axisName) allAxes.add(w.axisName); });
    (fd.beams || []).forEach(b => { if (b.axisName) allAxes.add(b.axisName); });
  });
  
  const skewedAxes = (window.dxfSkewedAxes || dxfSkewedAxes || []);
  skewedAxes.forEach(ax => {
    if (ax.label) allAxes.add(ax.label);
  });

  const sortAxes = (axes) => {
    const getPriority = (name) => {
      // 1. 斜め通り芯 (dxfSkewedAxes)
      const sIdx = (window.dxfSkewedAxes || dxfSkewedAxes || []).findIndex(ax => ax.label === name);
      if (sIdx !== -1) return { cat: 0, val: sIdx };

      // 2. X方向通り芯 (dxfVAxes: 垂直線) -> X座標でソート (左から)
      const vAx = (window.dxfVAxes || dxfVAxes || []).find(ax => ax.label === name);
      if (vAx) return { cat: 1, val: vAx.x };

      // 3. Y方向通り芯 (dxfHAxes: 水平線) -> Y座標でソート (下から)
      const hAx = (window.dxfHAxes || dxfHAxes || []).find(ax => ax.label === name);
      if (hAx) return { cat: 2, val: hAx.y };

      // 4. その他
      return { cat: 3, val: name };
    };

    return Array.from(axes).sort((a, b) => {
      const pa = getPriority(a);
      const pb = getPriority(b);
      if (pa.cat !== pb.cat) return pa.cat - pb.cat;
      if (pa.cat === 3) return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      return pa.val - pb.val;
    });
  };

  const axisList = sortAxes(allAxes);

  if (axisList.length === 0) {
    alert('通り名が設定された耐力壁が見つかりません。属性パネルで通り名（X1, Y2等）を設定してください。');
    return;
  }

  const existing = document.getElementById('wallAxialModal');
  if (existing && existing.parentNode) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'wallAxialModal';
  modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:3000; display:flex; align-items:center; justify-content:center;';

  const inner = document.createElement('div');
  inner.style.cssText = 'background:var(--bg-panel); width:90%; height:90%; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; border:1px solid var(--border);';
  
  const headerHtml = `
    <div style="padding:15px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:#252a3a;">
      <h3 style="margin:0; font-size:16px;">🧱 耐力壁の許容耐力時 軸力図 (立面フレーム)</h3>
      <div style="display:flex; gap:10px; align-items:center;">
        <label style="font-size:12px;">通り選択: </label>
        <select id="axialAxisSelect" onchange="window.renderAxialElevation()" style="padding:4px 8px; background:var(--bg-input); color:#fff; border:1px solid var(--border); border-radius:4px;">
          ${axisList.map(a => `<option value="${a}">${a}</option>`).join('')}
        </select>
        <button onclick="{ const el = document.getElementById('wallAxialModal'); if (el) el.remove(); }" style="background:none; border:none; color:#fff; font-size:24px; cursor:pointer; margin-left:15px;">&times;</button>
      </div>
    </div>
  `;

  const canvasArea = `
    <div style="flex:1; padding:20px; overflow:auto; display:flex; gap:20px; background:#14161d;">
      <div style="flex:1; display:flex; flex-direction:column; align-items:center;">
        <div style="font-size:14px; font-weight:bold; color:var(--accent); margin-bottom:10px;">◀ 左加力時 (Rightward Push)</div>
        <canvas id="axialCanvasL" width="1000" height="600" style="background:#0a0c10; border:1px solid #333;"></canvas>
      </div>
      <div style="flex:1; display:flex; flex-direction:column; align-items:center;">
        <div style="font-size:14px; font-weight:bold; color:var(--warn); margin-bottom:10px;">▶ 右加力時 (Leftward Push)</div>
        <canvas id="axialCanvasR" width="1000" height="600" style="background:#0a0c10; border:1px solid #333;"></canvas>
      </div>
    </div>
  `;

  inner.innerHTML = headerHtml + canvasArea + `<div id="axialStressTableContainer" style="padding:20px; background:#1e1e1e; border-top:1px solid #333; overflow-y:auto; max-height:300px;"></div>`;
  modal.appendChild(inner);
  document.body.appendChild(modal);

  renderAxialElevation();
};

export const showAxialStressTable = function(data) {
  const container = document.getElementById('axialStressTableContainer');
  if (!container) return;
  
  if (data.length === 0) {
    container.innerHTML = '<div style="color:#888; text-align:center;">算定データがありません。</div>';
    return;
  }

  let html = `
    <h4 style="color:#fff; margin-top:0; margin-bottom:10px; font-size:14px; border-left:4px solid var(--accent); padding-left:8px;">応力の算定表 (水平荷重時)</h4>
    <table style="width:100%; border-collapse:collapse; color:#eee; font-size:11px;">
      <thead>
        <tr style="background:#2c3e50; text-align:center;">
          <th style="padding:6px; border:1px solid #444;">通り</th>
          <th style="padding:6px; border:1px solid #444;">階</th>
          <th style="padding:6px; border:1px solid #444;">壁符号</th>
          <th style="padding:6px; border:1px solid #444;">α</th>
          <th style="padding:6px; border:1px solid #444;">P (N)</th>
          <th style="padding:6px; border:1px solid #444;">N (N)</th>
          <th style="padding:6px; border:1px solid #444;">M (N·m)</th>
          <th style="padding:6px; border:1px solid #444;">Q (N)</th>
        </tr>
      </thead>
      <tbody>
  `;

  data.forEach(d => {
    html += `
      <tr style="text-align:right; background:rgba(255,255,255,0.02);">
        <td style="padding:5px; border:1px solid #444; text-align:center;">${d.axisName}</td>
        <td style="padding:5px; border:1px solid #444; text-align:center;">${d.floor}</td>
        <td style="padding:5px; border:1px solid #444; text-align:center;">${d.wallId}</td>
        <td style="padding:5px; border:1px solid #444; text-align:center;">${d.alpha}</td>
        <td style="padding:5px; border:1px solid #444;">${d.P.toLocaleString()}</td>
        <td style="padding:5px; border:1px solid #444;">${d.N.toLocaleString()}</td>
        <td style="padding:5px; border:1px solid #444;">${d.M.toLocaleString()}</td>
        <td style="padding:5px; border:1px solid #444;">${d.Q.toLocaleString()}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
};

export const renderAxialElevation = function() {
  const axialAxisSelect = document.getElementById('axialAxisSelect');
  if (!axialAxisSelect) return;
  const axisName = axialAxisSelect.value;
  const floors = ['PH', 'R', '3', '2', '1'];
  
  const refLine = getAxisReferenceLine(axisName);
  if (!refLine) return;

  const floorDataMap = [];
  
  let maxRelIdx = 4;
  floors.forEach((f, idx) => {
    const fd = (window.allFloorData && window.allFloorData[f]) || (window.floorData && window.floorData[f]) || floorData[f];
    if (fd && (fd.walls || []).length > 0) {
      if (idx < maxRelIdx) maxRelIdx = idx;
    }
  });

  floors.forEach((floor, idx) => {
    const fd = (window.allFloorData && window.allFloorData[floor]) || (window.floorData && window.floorData[floor]) || floorData[floor];
    if (!fd) return;

    const wallsOnAxis = (fd.walls || []).filter(w => {
      if (!w.axisName || w.axisName.trim() !== axisName.trim()) return false;
      const n1 = fd.nodes[w.n1], n2 = fd.nodes[w.n2];
      if (!n1 || !n2) return false;
      const o1 = getProjectedPos(n1, refLine).offset;
      const o2 = getProjectedPos(n2, refLine).offset;
      return Math.abs(o1) < 100 && Math.abs(o2) < 100;
    });
    
    const columnsOnAxis = (fd.columns || []).filter(c => {
      const n = fd.nodes[c.nodeIndex];
      if (!n) return false;
      const offset = getProjectedPos(n, refLine).offset;
      return Math.abs(offset) < 100;
    });

    if (wallsOnAxis.length === 0 && columnsOnAxis.length === 0) {
      if (idx >= maxRelIdx) {
        floorDataMap.push({ floor, walls: [], columns: [], fd });
      }
      return;
    }
    floorDataMap.push({ floor, walls: wallsOnAxis, columns: columnsOnAxis, fd });
  });

  if (floorDataMap.length === 0) return;
  
  const getPos = (n) => getProjectedPos(n, refLine).L;
  const pValues = [];
  floorDataMap.forEach(fm => {
    fm.walls.forEach(w => {
      if (fm.fd.nodes[w.n1]) pValues.push(getPos(fm.fd.nodes[w.n1]));
      if (fm.fd.nodes[w.n2]) pValues.push(getPos(fm.fd.nodes[w.n2]));
    });
    fm.columns.forEach(c => {
      if (fm.fd.nodes[c.nodeIndex]) pValues.push(getPos(fm.fd.nodes[c.nodeIndex]));
    });
  });

  let startPos = 0, totalLength = 1000;
  if (pValues.length >= 2) {
    const minP = Math.min(...pValues), maxP = Math.max(...pValues);
    startPos = minP;
    totalLength = maxP - minP;
  } else if (pValues.length === 1) {
    startPos = pValues[0] - 500;
    totalLength = 1000;
  }

  const isXHorizontal = Math.abs(Math.cos(refLine.angle)) > 0.5;

  const forceMap = {};
  floors.forEach(f => forceMap[f] = {});
  const tableData = [];

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

    fm.walls.forEach(w => {
      const n1 = fm.fd.nodes[w.n1], n2 = fm.fd.nodes[w.n2];
      const p1 = getPos(n1), p2 = getPos(n2);
      const L_mm = Math.abs(p2 - p1);
      const L = L_mm / 1000;
      if (L < 0.01) return;
      
      const alpha = w.multiplier || 0;
      const P_kN = alpha * 1.96 * L;
      const H_mm = (w.heightOverride || fm.fd.floorHeight || 2730);
      const H = H_mm / 1000;
      const N_kN = P_kN * H / L;
      const M_kN_m = P_kN * H * 0.5;

      const leftP = Math.min(p1, p2), rightP = Math.max(p1, p2);
      forceMap[f][leftP] = forceMap[f][leftP] || { L:0, R:0 };
      forceMap[f][rightP] = forceMap[f][rightP] || { L:0, R:0 };
      
      forceMap[f][leftP].L -= N_kN; forceMap[f][rightP].L += N_kN;
      forceMap[f][leftP].R += N_kN; forceMap[f][rightP].R -= N_kN;
      
      w._calc_P_N = Math.round(P_kN * 1000);
      w._calc_N_N = Math.round(N_kN * 1000);
      w._calc_M_N = Math.round(M_kN_m * 1000);
      
      tableData.push({ axisName, floor: f, wallId: w.id || '', alpha, P: w._calc_P_N, N: w._calc_N_N, M: w._calc_M_N, Q: w._calc_P_N, leftPos: leftP });
    });
  });

  tableData.sort((a, b) => {
    const fMap = {'PH':0, 'R':1, '3':2, '2':3, '1':4};
    const fa = fMap[a.floor] !== undefined ? fMap[a.floor] : 99;
    const fb = fMap[b.floor] !== undefined ? fMap[b.floor] : 99;
    if (fa !== fb) return fa - fb;
    return a.leftPos - b.leftPos;
  });

  drawAxialElevationOnCanvas('axialCanvasL', floorDataMap, forceMap, 'L', startPos, totalLength, isXHorizontal, refLine);
  drawAxialElevationOnCanvas('axialCanvasR', floorDataMap, forceMap, 'R', startPos, totalLength, isXHorizontal, refLine);
  showAxialStressTable(tableData);
};

export const drawAxialElevationOnCanvas = function(canvasId, floorDataMap, forceMap, mode, startPos, totalLength, isXHorizontal, refLine) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  
  const padding = 60;
  const totalHeight = floorDataMap.reduce((sum, fm) => sum + (fm.fd.floorHeight || 2730), 0);
  
  const scaleX = (W - padding * 2) / Math.max(totalLength, 1);
  const scaleZ = (H - padding * 2) / Math.max(totalHeight, 1);
  const scale = Math.min(scaleX, scaleZ, 0.1); 

  const getX = (pos) => padding + (pos - startPos) * scale;
  
  const floorYMap = {};
  let currentY = H - 80;
  [...floorDataMap].reverse().forEach(fm => {
    floorYMap[fm.floor] = currentY;
    currentY -= (fm.fd.floorHeight || 2730) * scale;
  });
  const topFloor = floorDataMap[0];
  if (topFloor) {
    floorYMap['TOP'] = floorYMap[topFloor.floor] - (topFloor.fd.floorHeight || 2730) * scale;
  }

  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  Object.entries(floorYMap).forEach(([f, y]) => {
    ctx.beginPath(); ctx.moveTo(padding-20, y); ctx.lineTo(W-padding+20, y); ctx.stroke();
    if (f !== 'TOP') {
      ctx.fillStyle = '#888'; ctx.font = '10px sans-serif';
      ctx.fillText(f + (f==='1'?'F/GL':'F'), 5, y + 3);
    }
  });

  floorDataMap.forEach((fm, idx) => {
    const yBot = floorYMap[fm.floor];
    const nextFm = floorDataMap[idx - 1];
    const yTop = nextFm ? floorYMap[nextFm.floor] : floorYMap['TOP'];
    
    const axisPositionsMap = new Map();
    fm.walls.forEach(w => {
      const n1 = fm.fd.nodes[w.n1], n2 = fm.fd.nodes[w.n2];
      const getPos = (n) => getProjectedPos(n, refLine).L;
      if (n1) axisPositionsMap.set(getPos(n1), n1);
      if (n2) axisPositionsMap.set(getPos(n2), n2);
    });
    fm.columns.forEach(c => {
      const n = fm.fd.nodes[c.nodeIndex];
      const getPos = (n) => getProjectedPos(n, refLine).L;
      if (n) axisPositionsMap.set(getPos(n), n);
    });
    
    ctx.strokeStyle = '#555';
    Array.from(axisPositionsMap.entries()).sort((a,b)=>a[0]-b[0]).forEach(([p, node]) => {
      const x = getX(p);
      ctx.beginPath(); ctx.moveTo(x, yBot); ctx.lineTo(x, yTop); ctx.stroke();

      if (node && String(fm.floor) === '1') {
        let labelStrs = [];
        const vAx = (window.dxfVAxes || dxfVAxes || []).find(ax => Math.abs(ax.x - node.x) < 15);
        if (vAx && vAx.label) labelStrs.push(vAx.label);
        const hAx = (window.dxfHAxes || dxfHAxes || []).find(ax => Math.abs(ax.y - node.y) < 15);
        if (hAx && hAx.label && !vAx) labelStrs.push(hAx.label);
        else if (hAx && hAx.label && vAx) labelStrs.push(hAx.label);

        const labelToDraw = labelStrs.join('・');
        if (labelToDraw) {
          ctx.fillStyle = '#888'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(labelToDraw, x, yBot + 25);
        }
      }

      const getPos = (n) => getProjectedPos(n, refLine).L;
      const cIdx = fm.columns.findIndex(c => Math.abs(getPos(fm.fd.nodes[c.nodeIndex]) - p) < 5);
      if (cIdx !== -1 && window.calculateColumnT) {
        const res = window.calculateColumnT(cIdx, fm.fd, fm.floor);
        const caseName = mode === 'L' ? '左から' : '右から';
        const targetCase = (res.cases || []).find(c => c.name.includes(caseName));
        const td_val = targetCase ? targetCase.T_bot : 0;
        const td_N = Math.round(td_val * 1000);
        if (td_N > 0) {
          ctx.fillStyle = '#f5a623'; ctx.font = 'bold 9px sans-serif';
          ctx.fillText(`Td:${td_N}N`, x + 4, yBot - 5);
        }
      }
    });


    fm.walls.forEach(w => {
      const n1 = fm.fd.nodes[w.n1], n2 = fm.fd.nodes[w.n2];
      const getPos = (n) => getProjectedPos(n, refLine).L;
      const x1 = getX(getPos(n1)), x2 = getX(getPos(n2));
      const leftX = Math.min(x1, x2), rightX = Math.max(x1, x2);
      
      ctx.fillStyle = 'rgba(91,138,254,0.1)';
      ctx.fillRect(leftX, yTop, rightX - leftX, yBot - yTop);
      ctx.strokeStyle = w.multiplier > 0 ? '#5b8afe' : '#444';
      ctx.setLineDash(w.multiplier > 0 ? [] : [4, 4]);
      ctx.strokeRect(leftX, yTop, rightX - leftX, yBot - yTop);
      ctx.beginPath(); ctx.moveTo(leftX, yTop); ctx.lineTo(rightX, yBot); ctx.moveTo(rightX, yTop); ctx.lineTo(leftX, yBot); ctx.stroke(); ctx.setLineDash([]);
      
      if (w.multiplier > 0) {
        ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif';
        ctx.fillText(`α:${w.multiplier}`, leftX + 5, yTop + 12);
        ctx.fillText(`P:${w._calc_P_N}N`, leftX + 5, yTop + 24);
        ctx.fillText(`N:${w._calc_N_N}N`, leftX + 5, yTop + 36);
      }
    });

    const nodeIdsOnAxis = new Set(fm.walls.flatMap(w => [w.n1, w.n2]));
    nodeIdsOnAxis.forEach(nId => {
      const beamsAtNode = (fm.fd.beams || []).filter(b => b.n1 === nId || b.n2 === nId);
      const isOrthogonal = beamsAtNode.some(b => {
        const otherNodeId = b.n1 === nId ? b.n2 : b.n1;
        const otherNode = fm.fd.nodes[otherNodeId];
        if (!otherNode) return false;
        const distPerp = isXHorizontal ? Math.abs(otherNode.y - fm.fd.nodes[nId].y) : Math.abs(otherNode.x - fm.fd.nodes[nId].x);
        return distPerp > 10;
      });
      if (isOrthogonal) {
        const getPos = (n) => getProjectedPos(n, refLine).L;
        const x = getX(getPos(fm.fd.nodes[nId]));
        ctx.fillStyle = '#f5a623'; ctx.font = '12px sans-serif';
        ctx.fillText('△', x - 6, yBot + 12);
      }
    });
  });

  ctx.font = 'bold 10px monospace';
  floorDataMap.forEach((fm) => {
    const f = fm.floor;
    const forces = forceMap[f] || {};
    Object.entries(forces).forEach(([pos, val]) => {
      const x = getX(parseFloat(pos));
      const n_kN = mode === 'L' ? val.L : val.R;
      if (Math.abs(n_kN) < 0.01) return;
      const n_N = Math.round(n_kN * 1000);
      ctx.fillStyle = n_N > 0 ? '#f25c5c' : '#34c77b';
      ctx.fillText((n_N > 0 ? '+' : '') + n_N, x - 15, floorYMap[f] + (n_N > 0 ? 15 : -5));
    });
  });
};

window.openWallAxialModal = openWallAxialModal;
window.renderAxialElevation = renderAxialElevation;
window.drawAxialElevationOnCanvas = drawAxialElevationOnCanvas;
window.showAxialStressTable = showAxialStressTable;
