/**
 * report/svg_axial_diagram.js
 * 拡大軸力図 (立面図) SVG生成モジュール
 */
import { floorData, dxfVAxes, dxfHAxes } from '../foundation_cad.js';
import { getAxisReferenceLine, getProjectedPos } from '../rendering_helpers.js';

export function generateEnlargedAxialDiagramSvg(axisName, loadDirection = 'left') {
  const floors = ['PH', 'R', '3', '2', '1'];
  const floorDataMap = [];

  let maxRelIdx = 4;
  floors.forEach((f, idx) => {
    const fd = (window.allFloorData && window.allFloorData[f]) || (window.floorData && window.floorData[f]) || floorData[f];
    if (fd && (fd.walls || []).length > 0) {
      if (idx < maxRelIdx) maxRelIdx = idx;
    }
  });

  const refLine = getAxisReferenceLine(axisName);
  if (!refLine) return '';

  floors.forEach((f, idx) => {
    const fd = (window.allFloorData && window.allFloorData[f]) || (window.floorData && window.floorData[f]) || floorData[f];
    if (!fd) return;
    
    const cleanAxisName = axisName.replace('通り', '').trim();

    const walls = (fd.walls || []).filter(w => {
      const wAxis = w.axisName ? w.axisName.replace('通り', '').trim() : '';
      if (wAxis !== cleanAxisName) return false;
      const n1 = fd.nodes[w.n1], n2 = fd.nodes[w.n2];
      if (!n1 || !n2) return false;
      const o1 = getProjectedPos(n1, refLine).offset;
      const o2 = getProjectedPos(n2, refLine).offset;
      return Math.abs(o1) < 100 && Math.abs(o2) < 100;
    });
    
    const columns = (fd.columns || []).filter(c => {
      const n = fd.nodes[c.nodeIndex];
      if (!n) return false;
      const offset = getProjectedPos(n, refLine).offset;
      return Math.abs(offset) < 100;
    });

    if (walls.length === 0 && columns.length === 0) {
      if (idx >= maxRelIdx) {
        floorDataMap.push({ floor: f, walls: [], columns: [], fd });
      }
      return;
    }
    floorDataMap.push({ floor: f, walls, columns, fd });
  });

  if (floorDataMap.length === 0) return '';

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

  const padding = 60;
  const svgW = 800;
  const floorHeightsMap = floorDataMap.map(fm => fm.fd.floorHeight || 2730);
  const totalH = floorHeightsMap.reduce((a, b) => a + b, 0);

  const scaleVal = Math.min((svgW - padding * 2) / Math.max(totalLength, 1), 500 / Math.max(totalH, 1));

  const W = svgW;
  const H = totalH * scaleVal + padding * 2;
  const getX = (pos) => padding + (pos - startPos) * scaleVal + (W - totalLength * scaleVal - padding * 2) / 2;

  const floorYMap_Top = {};
  const floorYMap_Bot = {};
  const groundY = H - padding;
  let currentAccH = 0;
  for (let i = floorDataMap.length - 1; i >= 0; i--) {
      const fm = floorDataMap[i];
      const h = fm.fd.floorHeight || 2730;
      floorYMap_Bot[fm.floor] = groundY - (currentAccH * scaleVal);
      currentAccH += h;
      floorYMap_Top[fm.floor] = groundY - (currentAccH * scaleVal);
  }

  let svg = `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; font-family: sans-serif;">`;
  
  floorDataMap.forEach(fm => {
    const y = floorYMap_Bot[fm.floor];
    svg += `<line x1="${padding/2}" y1="${y}" x2="${W-padding/2}" y2="${y}" stroke="#ccc" stroke-width="1" />`;
    svg += `<text x="5" y="${y+4}" font-size="12" fill="#666">${fm.floor}${fm.floor==='1'?'F/GL':'F'}</text>`;
  });
  const topY = floorYMap_Top[floorDataMap[0].floor];
  svg += `<line x1="${padding/2}" y1="${topY}" x2="${W-padding/2}" y2="${topY}" stroke="#ccc" stroke-width="1" />`;
  svg += `<text x="5" y="${topY+4}" font-size="12" fill="#666">${floorDataMap[0].floor === 'PH' ? 'PH屋上' : 'R/屋根'}</text>`;
  svg += `<line x1="${padding/2}" y1="${groundY}" x2="${W-padding/2}" y2="${groundY}" stroke="#333" stroke-width="2" />`;

  floorDataMap.forEach((fm, fIdx) => {
    const yTop = floorYMap_Top[fm.floor];
    const yBot = floorYMap_Bot[fm.floor];
    const Hi = (fm.fd.floorHeight || 2730) / 1000;
    
    fm.walls.forEach(w => {
      const n1 = fm.fd.nodes[w.n1], n2 = fm.fd.nodes[w.n2];
      if (!n1 || !n2) return;
      const x1 = getX(getPos(n1)), x2 = getX(getPos(n2));
      const leftX = Math.min(x1, x2), rightX = Math.max(x1, x2), width = rightX - leftX;
      const fill = w.multiplier > 0 ? "rgba(91,138,254,0.08)" : "none";
      const stroke = w.multiplier > 0 ? "#5b8afe" : "#999";
      const dash = w.multiplier > 0 ? "" : 'stroke-dasharray="4,4"';
      
      svg += `<rect x="${leftX}" y="${yTop}" width="${width}" height="${yBot - yTop}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" ${dash} />`;
      svg += `<line x1="${leftX}" y1="${yTop}" x2="${rightX}" y2="${yBot}" stroke="${stroke}" stroke-width="0.5" ${dash} opacity="0.5" />`;
      svg += `<line x1="${rightX}" y1="${yTop}" x2="${leftX}" y2="${yBot}" stroke="${stroke}" stroke-width="0.5" ${dash} opacity="0.5" />`;

      if (w.multiplier > 0) {
        const mult = parseFloat(w.multiplier) || 0;
        const P = 1.96 * mult * Hi;
        let Bi = 0.5;
        const adjCol = fm.columns.find(c => c.nodeIndex === w.n1 || c.nodeIndex === w.n2);
        if (adjCol) {
            Bi = (adjCol.biSetting === '0.8') ? 0.8 : 0.5;
        }
        const N = P * Bi;
        const centerX_wall = (leftX + rightX) / 2;
        const textY_wall = (yTop + yBot) / 2 - 12;
        svg += `
          <text x="${centerX_wall}" y="${textY_wall}" font-size="10" fill="#2c3e50" font-weight="bold" text-anchor="middle">
            <tspan x="${centerX_wall}" dy="0">α = ${mult.toFixed(2)}</tspan>
            <tspan x="${centerX_wall}" dy="12">P = ${P.toFixed(3)} kN</tspan>
            <tspan x="${centerX_wall}" dy="12">N = ${N.toFixed(3)} kN</tspan>
          </text>
        `;
      }
    });

    const axisPositionsMap = new Map();
    fm.walls.forEach(w => {
        const n1 = fm.fd.nodes[w.n1], n2 = fm.fd.nodes[w.n2];
        if (n1) axisPositionsMap.set(getPos(n1), n1);
        if (n2) axisPositionsMap.set(getPos(n2), n2);
    });
    fm.columns.forEach(c => {
        const n = fm.fd.nodes[c.nodeIndex];
        if (n) axisPositionsMap.set(getPos(n), n);
    });

    Array.from(axisPositionsMap.entries()).sort((a,b)=>a[0]-b[0]).forEach(([p, node], pIdx) => {
      const x = getX(p);
      svg += `<line x1="${x}" y1="${yTop}" x2="${x}" y2="${yBot}" stroke="#666" stroke-width="1" stroke-dasharray="2,2" />`;

      if (node && String(fm.floor) === '1') {
        let labelStrs = [];
        const vAx = (window.dxfVAxes || []).find(ax => Math.abs(ax.x - node.x) < 15);
        if (vAx && vAx.label) labelStrs.push(vAx.label);
        const hAx = (window.dxfHAxes || []).find(ax => Math.abs(ax.y - node.y) < 15);
        if (hAx && hAx.label) labelStrs.push(hAx.label);

        const labelToDraw = labelStrs.join('・');
        if (labelToDraw) {
          svg += `<text x="${x}" y="${groundY + 40}" font-size="12" fill="#999" font-weight="bold" text-anchor="middle">${labelToDraw}</text>`;
        }
      }

      const localCol = fm.columns.find(c => Math.abs(getPos(fm.fd.nodes[c.nodeIndex]) - p) < 5);
      const globalCIdx = localCol ? fm.fd.columns.findIndex(c => c.nodeIndex === localCol.nodeIndex) : -1;

      if (globalCIdx !== -1 && window.calculateColumnT) {
          let res = null;
          try { res = window.calculateColumnT(globalCIdx, fm.fd, fm.floor); } catch(e) {}

          if (res && res.cases) {
              const lCase = res.cases.find(c => c.name.includes('左から'));
              const rCase = res.cases.find(c => c.name.includes('右から'));
              const targetCase = (loadDirection === 'left') ? lCase : rCase;

              if (targetCase) {
                  const niVal = Number(targetCase.Ne_bot !== undefined ? targetCase.Ne_bot : (targetCase.totalNi_bot !== undefined ? targetCase.totalNi_bot : (targetCase.totalNi || 0))) || 0;
                  const color = (niVal > 0) ? '#e74c3c' : '#3498db';
                  const anchor = (loadDirection === 'left') ? 'end' : 'start';
                  const dx = (loadDirection === 'left') ? -5 : 5;
                  const staggerOffsetTop = (pIdx % 2 === 0) ? 12 : 22;
                  svg += `<text x="${x + dx}" y="${yTop + staggerOffsetTop}" font-size="9" fill="${color}" font-weight="bold" text-anchor="${anchor}">${loadDirection==='left'?'←':' '}Ni:${niVal.toFixed(3)}${loadDirection==='right'?'→':''}</text>`;

                  if (String(fm.floor) === '1') {
                      const T_val = Number(targetCase.T_bot !== undefined ? targetCase.T_bot : (targetCase.Ne_bot !== undefined ? targetCase.Ne_bot : niVal)) || 0;
                      const forceColor = T_val > 0 ? '#e74c3c' : '#3498db';
                      const forceText = T_val > 0 ? `(+) ${T_val.toFixed(3)}` : `- ${Math.abs(T_val).toFixed(3)}`;
                      const textX_col = (loadDirection === 'left') ? x - 6 : x + 6;
                      const textAnchor_col = (loadDirection === 'left') ? 'end' : 'start';
                      const staggerOffset = (pIdx % 2 === 0) ? 12 : -8;
                      svg += `<text x="${textX_col}" y="${yBot + staggerOffset}" font-size="11" fill="${forceColor}" font-weight="bold" text-anchor="${textAnchor_col}">${forceText}</text>`;
                  }
              }
          }
      }
    });
  });

  svg += `</svg>`;
  return svg;
}

window.generateEnlargedAxialDiagramSvg = generateEnlargedAxialDiagramSvg;
