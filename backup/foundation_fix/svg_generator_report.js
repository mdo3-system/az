import { floorData, dxfVAxes, dxfHAxes } from './foundation_cad.js';
import { getAxisReferenceLine, getProjectedPos, getAxisPrimaryDirection } from './rendering_helpers.js';

/**
 * 床ごとの共通バウンディングボックス（描画範囲）を算出する
 */
export function getFloorBoundingBox(fd) {
  const nodes = new Set();
  (fd.columns || []).forEach(c => nodes.add(c.nodeIndex));
  (fd.walls || []).forEach(w => { nodes.add(w.n1); nodes.add(w.n2); });
  (fd.beams || []).forEach(b => { nodes.add(b.n1); nodes.add(b.n2); });
  (fd.perimeterBeams || []).forEach(b => { nodes.add(b.n1); nodes.add(b.n2); });
  (fd.slabs || []).forEach(s => (s.nodeIds || []).forEach(id => nodes.add(id)));
  
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  nodes.forEach(nid => {
    const n = fd.nodes[nid];
    if (!n) return;
    if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
  });
  
  if (minX === Infinity) return { minX: 0, maxX: 1000, minY: 0, maxY: 1000, width: 1000, height: 1000 };
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}
window.getFloorBoundingBox = getFloorBoundingBox;

/**
 * レポートに含まれる全階層の共通バウンディングボックスを算出する
 */
export function getGlobalBoundingBox(fdList) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  
  fdList.forEach(fd => {
    if (!fd) return;
    const bbox = getFloorBoundingBox(fd);
    if (bbox.minX === 0 && bbox.maxX === 1000) return; // データなし階は無視
    minX = Math.min(minX, bbox.minX);
    maxX = Math.max(maxX, bbox.maxX);
    minY = Math.min(minY, bbox.minY);
    maxY = Math.max(maxY, bbox.maxY);
  });

  if (minX === Infinity) return { minX: 0, maxX: 1000, minY: 0, maxY: 1000, width: 1000, height: 1000 };
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}
window.getGlobalBoundingBox = getGlobalBoundingBox;

/**
 * 特定の通りの拡大軸力図（立面）を SVG で生成する
 */
export function generateEnlargedAxialDiagramSvg(axisName, loadDirection = 'left') {
  const floors = ['PH', 'R', '3', '2', '1'];
  const floorDataMap = [];

  // 💡 プロジェクト全体で耐力壁が存在する最高階を特定
  let maxRelIdx = 4;
  floors.forEach((f, idx) => {
    const fd = (window.allFloorData && window.allFloorData[f]) || (window.floorData && window.floorData[f]) || floorData[f];
    if (fd && (fd.walls || []).length > 0) {
      if (idx < maxRelIdx) maxRelIdx = idx;
    }
  });

  // 💡 通り芯のリファレンスライン（剛体投影用）を取得
  const refLine = getAxisReferenceLine(axisName);
  if (!refLine) return '';

  floors.forEach((f, idx) => {
    const fd = (window.allFloorData && window.allFloorData[f]) || (window.floorData && window.floorData[f]) || floorData[f];
    if (!fd) return;
    
    // 足切り（剛体投影で 15mm 以上離れているものは除外）
    const walls = (fd.walls || []).filter(w => {
      if (!w.axisName || w.axisName.trim() !== axisName.trim()) return false;
      const n1 = fd.nodes[w.n1], n2 = fd.nodes[w.n2];
      if (!n1 || !n2) return false;
      const o1 = getProjectedPos(n1, refLine).offset;
      const o2 = getProjectedPos(n2, refLine).offset;
      return Math.abs(o1) < 100 && Math.abs(o2) < 100;
    });
    
    // 💡 壁に接している柱、または投影ライン上にある柱を抽出
    const columns = (fd.columns || []).filter(c => {
      const n = fd.nodes[c.nodeIndex];
      if (!n) return false;
      const offset = getProjectedPos(n, refLine).offset;
      return Math.abs(offset) < 100;
    });

    // 💡 その軸にオブジェクトがない場合でも、最高階以下の階であれば表示に含める（階ライン描画のため）
    if (walls.length === 0 && columns.length === 0) {
      if (idx >= maxRelIdx) {
        floorDataMap.push({ floor: f, walls: [], columns: [], fd });
      }
      return;
    }
    floorDataMap.push({ floor: f, walls, columns, fd });
  });

  if (floorDataMap.length === 0) return '';

  // 💡 描画範囲の決定（投影距離 L で計算）
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

  // 💡 通り芯の主方向判定（ラベルアンカーなどの微調整用）
  const isXHorizontal = Math.abs(Math.cos(refLine.angle)) > 0.5;

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

      // 💡 構造ノード位置でのグリッドラベル探索と表示
      if (node && String(fm.floor) === '1') {
        let labelStrs = [];
        const vAx = (window.dxfVAxes || dxfVAxes || []).find(ax => Math.abs(ax.x - node.x) < 15);
        if (vAx && vAx.label) labelStrs.push(vAx.label);
        const hAx = (window.dxfHAxes || dxfHAxes || []).find(ax => Math.abs(ax.y - node.y) < 15);
        if (hAx && hAx.label && !vAx) labelStrs.push(hAx.label); // vAxがあれば主要一つに絞るか、併記するか
        else if (hAx && hAx.label && vAx) labelStrs.push(hAx.label);

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
                  const color = (targetCase.totalNi > 0) ? '#e74c3c' : '#3498db';
                  const anchor = (loadDirection === 'left') ? 'end' : 'start';
                  const dx = (loadDirection === 'left') ? -5 : 5;
                  const staggerOffsetTop = (pIdx % 2 === 0) ? 12 : 22;
                  svg += `<text x="${x + dx}" y="${yTop + staggerOffsetTop}" font-size="9" fill="${color}" font-weight="bold" text-anchor="${anchor}">${loadDirection==='left'?'←':' '}Ni:${(targetCase.totalNi||0).toFixed(3)}${loadDirection==='right'?'→':''}</text>`;

                  if (String(fm.floor) === '1') {
                      const T_val = Number(targetCase.T_bot !== undefined ? targetCase.T_bot : (targetCase.T !== undefined ? targetCase.T : (targetCase.totalNi || 0))) || 0;
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

/**
 * べた基礎反力図 (平面図) を SVG で生成する
 */
export function generateFoundationReactionSvg(fd, unifiedBbox = null) {
  if (!fd || !fd.nodes || fd.nodes.length === 0) return '';
  
  const bbox = unifiedBbox || getFloorBoundingBox(fd);
  const minX = bbox.minX, maxX = bbox.maxX, minY = bbox.minY, maxY = bbox.maxY;
  
  const gridXs = [], gridYs = [];
  const activeNodes = new Set();
  (fd.columns || []).forEach(c => activeNodes.add(c.nodeIndex));
  (fd.walls || []).forEach(w => { activeNodes.add(w.n1); activeNodes.add(w.n2); });
  (fd.slabs || []).forEach(s => s.nodeIds.forEach(id => activeNodes.add(id)));
  activeNodes.forEach(nid => {
      const n = fd.nodes[nid];
      if (!n) return;
      if (!gridXs.some(gx => Math.abs(gx - n.x) < 50)) gridXs.push(n.x);
      if (!gridYs.some(gy => Math.abs(gy - n.y) < 50)) gridYs.push(n.y);
  });

  const padding = 100;
  const svgW = 600;
  const scale = Math.min((svgW - padding * 2) / (bbox.width || 1), 600 / (bbox.height || 1));
  const svgH = bbox.height * scale + padding * 2;

  const w2s = (x, y) => ({ 
      x: padding + (x - minX) * scale, 
      y: svgH - padding - (y - minY) * scale 
  });

  let svg = `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; font-family: sans-serif; border: 1px solid #ddd; max-height: 1000px; width: 100%; max-width: 1600px; margin: 0 auto; display: block;">`;

  gridXs.forEach(gx => {
      const p1 = w2s(gx, minY), p2 = w2s(gx, maxY);
      svg += `<line x1="${p1.x}" y1="${p1.y + 20}" x2="${p2.x}" y2="${p2.y - 20}" stroke="#bdc3c7" stroke-width="1" stroke-dasharray="4,4" />`;
  });
  gridYs.forEach(gy => {
      const p1 = w2s(minX, gy), p2 = w2s(maxX, gy);
      svg += `<line x1="${p1.x - 20}" y1="${p1.y}" x2="${p2.x + 20}" y2="${p2.y}" stroke="#bdc3c7" stroke-width="1" stroke-dasharray="4,4" />`;
  });

  (fd.slabs || []).forEach(slab => {
      if (!slab.nodeIds || slab.nodeIds.length < 3) return;
      const pts = slab.nodeIds.map(nid => fd.nodes[nid]).filter(Boolean);
      if (pts.length < 3) return;
      
      let d = `M ${w2s(pts[0].x, pts[0].y).x} ${w2s(pts[0].x, pts[0].y).y}`;
      let cx = 0, cy = 0;
      pts.forEach((p, i) => {
          const sp = w2s(p.x, p.y);
          if (i > 0) d += ` L ${sp.x} ${sp.y}`;
          cx += sp.x; cy += sp.y;
      });
      d += ' Z';
      cx /= pts.length; cy /= pts.length;
      
      svg += `<path d="${d}" fill="rgba(46, 204, 113, 0.1)" stroke="#27ae60" stroke-width="1.5" stroke-dasharray="4,4" />`;
      const sigma = (slab.groundPressure || 0).toFixed(3);
      svg += `<text x="${cx}" y="${cy}" font-size="16" fill="#2c3e50" font-weight="bold" text-anchor="middle">σe=${sigma} kN/㎡</text>`;
      svg += `<text x="${cx}" y="${cy+18}" font-size="13" fill="#7f8c8d" text-anchor="middle">${slab.id}</text>`;
  });

  const allBeams = [...(fd.beams || []).filter(b => b.type === 'foundation_beam' || !b.type), ...(fd.perimeterBeams || [])];
  allBeams.forEach(b => {
      const n1 = fd.nodes[b.n1], n2 = fd.nodes[b.n2];
      if (!n1 || !n2) return;
      const p1 = w2s(n1.x, n1.y), p2 = w2s(n2.x, n2.y);
      const beamColor = b.isShared ? '#e67e22' : '#34495e';
      
      svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${beamColor}" stroke-width="3" />`;
      const w_val = ((b.groundPressure || 0) * (b.tributaryWidth || 0)).toFixed(3);
      const cx = (p1.x + p2.x) / 2, cy = (p1.y + p2.y) / 2;
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
      const rotAngle = (angle > 90 || angle < -90) ? angle + 180 : angle;
      svg += `<text x="${cx}" y="${cy - 5}" font-size="10" fill="${beamColor}" font-weight="bold" text-anchor="middle" transform="rotate(${rotAngle}, ${cx}, ${cy})">w=${w_val} kN/m</text>`;
  });

  (fd.columns || []).forEach(c => {
      const n = fd.nodes[c.nodeIndex]; if (!n) return;
      const p = w2s(n.x, n.y);
      svg += `<rect x="${p.x - 4}" y="${p.y - 4}" width="8" height="8" fill="#333" />`;
  });

  svg += `</svg>`;
  return svg;
}
window.generateFoundationReactionSvg = generateFoundationReactionSvg;

/**
 * 単一の基礎梁の応力図（M図・Q図）をSVGで生成する
 */
export function generateSingleBeamStressSvg(beam, calcRes) {
    if (!beam || !calcRes) return '';
    const svgW = 600, svgH = 250, padX = 50, padY = 50;
    const drawW = svgW - padX * 2, drawH = (svgH - padY * 2) / 2;
    const M_mid = calcRes.M_mid || 0, M_end = calcRes.M_end || 0, Q = calcRes.Q_L || 0;
    const w = calcRes.w_load || 0, L = calcRes.Lo || 0;

    const maxM = Math.max(Math.abs(M_mid), Math.abs(M_end), 0.1), maxQ = Math.max(Math.abs(Q), 0.1);
    const scaleM = (drawH * 0.8) / maxM, scaleQ = (drawH * 0.8) / maxQ;
    const yAxisM = padY + drawH, yAxisQ = padY + drawH * 1.5;

    let svg = `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; font-family: sans-serif; border: 1px solid #ddd; margin-bottom: 20px; max-width: 800px;">`;
    svg += `<text x="10" y="20" font-size="14" fill="#000" font-weight="bold">【${beam.id}】 通り: ${beam.axisName || beam.axis || '-'} / スパン: ${L.toFixed(3)} m</text>`;
    svg += `<text x="10" y="38" font-size="12" fill="#555">負担荷重 w = ${w.toFixed(3)} kN/m, 端部モーメント = ${M_end.toFixed(2)} kN·m</text>`;
    
    svg += `<line x1="${padX}" y1="${yAxisM}" x2="${padX + drawW}" y2="${yAxisM}" stroke="#ccc" stroke-width="2" />`;
    const mStartX = padX, mStartY = yAxisM + M_end * scaleM, mMidX = padX + drawW / 2, mEndX = padX + drawW, mEndY = yAxisM + M_end * scaleM;
    const mPath = `M ${mStartX} ${mStartY} Q ${mMidX} ${yAxisM + (M_mid + (M_mid - M_end)) * scaleM} ${mEndX} ${mEndY}`;
    svg += `<path d="${mPath}" fill="rgba(192, 57, 43, 0.1)" stroke="#c0392b" stroke-width="2" />`;
    svg += `<text x="${mMidX}" y="${mMidY > yAxisM ? mMidY + 15 : mMidY - 5}" font-size="11" fill="#c0392b" text-anchor="middle" font-weight="bold">${M_mid.toFixed(2)}</text>`;
    
    svg += `<line x1="${padX}" y1="${yAxisQ}" x2="${padX + drawW}" y2="${yAxisQ}" stroke="#ccc" stroke-width="2" />`;
    const qStartY = yAxisQ - Q * scaleQ, qEndY = yAxisQ + Q * scaleQ;
    const qPath = `M ${padX} ${yAxisQ} L ${padX} ${qStartY} L ${padX + drawW} ${qEndY} L ${padX + drawW} ${yAxisQ} Z`;
    svg += `<path d="${qPath}" fill="rgba(41, 128, 185, 0.1)" stroke="#2980b9" stroke-width="2" />`;
    svg += `</svg>`;
    return svg;
}
window.generateSingleBeamStressSvg = generateSingleBeamStressSvg;

/**
 * 基礎梁負担面積・負担幅図 (亀甲分割図) を SVG で生成する
 */
export function generateFoundationTributarySvg(fd, unifiedBbox = null) {
  if (!fd || !fd.nodes || fd.nodes.length === 0) return '';
  const bbox = unifiedBbox || getFloorBoundingBox(fd);
  const minX = bbox.minX, maxX = bbox.maxX, minY = bbox.minY, maxY = bbox.maxY;
  const padding = 100, svgW = 600, scale = Math.min((svgW - padding * 2) / (bbox.width || 1), 600 / (bbox.height || 1)), svgH = bbox.height * scale + padding * 2;
  const w2s = (x, y) => ({ x: padding + (x - minX) * scale, y: svgH - padding - (y - minY) * scale });

  let svg = `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; font-family: sans-serif; border: 1px solid #ddd; max-height: 1000px; width: 100%; max-width: 1600px; margin: 0 auto; display: block;">`;
  const activeNodes = new Set();
  (fd.slabs || []).forEach(s => s.nodeIds.forEach(id => activeNodes.add(id)));
  const gridXs = [...new Set(Array.from(activeNodes).map(id => fd.nodes[id]?.x))].sort((a,b)=>a-b);
  const gridYs = [...new Set(Array.from(activeNodes).map(id => fd.nodes[id]?.y))].sort((a,b)=>a-b);
  gridXs.forEach(gx => { svg += `<line x1="${w2s(gx, minY).x}" y1="${w2s(gx, minY).y}" x2="${w2s(gx, maxY).x}" y2="${w2s(gx, maxY).y}" stroke="#eee" stroke-width="1" />`; });
  gridYs.forEach(gy => { svg += `<line x1="${w2s(minX, gy).x}" y1="${w2s(minX, gy).y}" x2="${w2s(maxX, gy).x}" y2="${w2s(maxX, gy).y}" stroke="#eee" stroke-width="1" />`; });

  (fd.slabs || []).forEach(slab => {
      if (!slab.nodeIds || slab.nodeIds.length < 3) return;
      const pts = slab.nodeIds.map(nid => fd.nodes[nid]).filter(Boolean);
      let outlineD = `M ${w2s(pts[0].x, pts[0].y).x} ${w2s(pts[0].x, pts[0].y).y}`;
      pts.forEach((p, i) => { if(i>0) outlineD += ` L ${w2s(p.x, p.y).x} ${w2s(p.x, p.y).y}`; });
      outlineD += " Z";
      svg += `<path d="${outlineD}" fill="none" stroke="#2c3e50" stroke-width="2" />`;

      if (!slab.tributaryPolygons || slab.tributaryPolygons.length === 0) {
          if (typeof window.calculateSlabTributary === 'function') window.calculateSlabTributary(slab, fd.nodes, fd.beams || []);
      }
      (slab.tributaryPolygons || []).forEach((poly, idx) => {
          if (!poly || poly.length < 3) return;
          let polyD = `M ${w2s(poly[0].x, poly[0].y).x} ${w2s(poly[0].x, poly[0].y).y}`;
          poly.forEach((p, i) => { if(i>0) polyD += ` L ${w2s(p.x, p.y).x} ${w2s(p.x, p.y).y}`; });
          polyD += " Z";
          svg += `<path d="${polyD}" fill="none" stroke="#7f8c8d" stroke-width="1" stroke-dasharray="2,2" />`;
          let cx = 0, cy = 0; poly.forEach(p => { cx += p.x; cy += p.y; }); cx /= poly.length; cy /= poly.length;
          const sp = w2s(cx, cy);
          const A = (slab.edgeAreas && slab.edgeAreas[idx]) ? slab.edgeAreas[idx] : 0;
          const B = (slab.edgeLs && slab.edgeLs[idx]) ? slab.edgeLs[idx] : 0;
          if (A > 0) {
              svg += `<text x="${sp.x}" y="${sp.y - 7}" font-size="11" fill="#2980b9" font-weight="bold" text-anchor="middle">A=${A.toFixed(3)}㎡</text>`;
              svg += `<text x="${sp.x}" y="${sp.y + 7}" font-size="11" fill="#c0392b" font-weight="bold" text-anchor="middle">B=${B.toFixed(3)}m</text>`;
          }
      });
  });
  svg += `</svg>`;
  return svg;
}
window.generateFoundationTributarySvg = generateFoundationTributarySvg;

/**
 * 基礎梁の応力図 SVG を生成する
 */
export function generateSingleBeamNMQStressSvg(beam) {
  const fd = floorData['1'];
  if (!fd || !window.calculateFoundationHorizontalStressData) return '';
  const data = window.calculateFoundationHorizontalStressData(beam, fd);
  if (!data) return '';
  const { points, resL, resR, totalL } = data;
  const svgW = 1000, svgH = 1100, marginX = 80, marginY = 40, plotW = svgW - marginX * 2, scaleX = plotW / (totalL || 1);

  let svg = `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; font-family: sans-serif; border: 1px solid #ddd; margin-bottom: 20px; max-width: 1000px; display: block; margin-left: auto; margin-right: auto;">`;
  const drawDiagramSet = (yTop, results, groupTitle) => {
    const layerH = 140, spacing = 20;
    svg += `<text x="${marginX}" y="${yTop - 15}" font-size="14" fill="#000" font-weight="bold">${groupTitle}</text>`;
    const drawCommon = (yCenter, title) => {
      points.forEach(p => { svg += `<line x1="${marginX + p.dist * scaleX}" y1="${yCenter - layerH/2}" x2="${marginX + p.dist * scaleX}" y2="${yCenter + layerH/2}" stroke="#eee" stroke-width="1" stroke-dasharray="2,2" />`; });
      svg += `<line x1="${marginX}" y1="${yCenter}" x2="${marginX + plotW}" y2="${yCenter}" stroke="#000" stroke-width="1.5" />`;
      svg += `<text x="${marginX - 10}" y="${yCenter + 4}" font-size="11" fill="#666" text-anchor="end">${title}</text>`;
    };
    const yN = yTop + layerH/2; drawCommon(yN, "N/R");
    const scaleF = (layerH * 0.3) / Math.max(...results.map(r => Math.max(Math.abs(r.Td), Math.abs(r.R))), 0.1);
    points.forEach((p, i) => {
      const x = marginX + p.dist * scaleX;
      [ {v:results[i].Td, c:"#e67e22", l:"N"}, {v:results[i].R, c:"#2ecc71", l:"R"} ].forEach(d => {
        if (Math.abs(d.v) < 0.01) return;
        const len = Math.max(Math.abs(d.v) * scaleF, 15);
        const yTip = d.v > 0 ? yN - len : yN + len;
        svg += `<line x1="${x}" y1="${yN}" x2="${x}" y2="${yTip}" stroke="${d.c}" stroke-width="2" />`;
        svg += `<text x="${x + 6}" y="${yTip}" font-size="9" fill="${d.c}" font-weight="bold">${d.l}:${d.v.toFixed(2)}</text>`;
      });
    });
    const yM = yTop + layerH + spacing + layerH/2; drawCommon(yM, "M");
    const scaleM = (layerH * 0.35) / Math.max(...results.map(r => Math.abs(r.M_f)), 0.1);
    let mPath = `M ${marginX + points[0].dist * scaleX} ${yM + results[0].M_f * scaleM}`;
    points.forEach((p, i) => {
      const x = marginX + p.dist * scaleX, y = yM + results[i].M_f * scaleM;
      if (i > 0) mPath += ` L ${x} ${y}`;
      if (Math.abs(results[i].M_f) > 0.1) svg += `<text x="${x}" y="${y > yM ? y + 10 : y - 4}" font-size="9" fill="#d4ac0d" text-anchor="middle" font-weight="bold">${results[i].M_f.toFixed(2)}</text>`;
    });
    svg += `<path d="${mPath}" fill="none" stroke="#f1c40f" stroke-width="2" />`;
    const yQ = yTop + (layerH + spacing) * 2 + layerH/2; drawCommon(yQ, "Q");
    const scaleQ = (layerH * 0.35) / Math.max(...results.map(r => Math.abs(r.Qe)), 0.1);
    let qPath = `M ${marginX} ${yQ} L ${marginX} ${yQ - results[0].Qe * scaleQ}`;
    points.forEach((p, i) => {
      const x = marginX + p.dist * scaleX, qy = yQ - results[i].Qe * scaleQ;
      if (i > 0) qPath += ` L ${x} ${yQ - results[i-1].Qe * scaleQ} L ${x} ${qy}`;
      if (i === points.length - 1) qPath += ` L ${x} ${yQ}`;
      if (Math.abs(results[i].Qe) > 0.1) svg += `<text x="${x + (i===0?5:-5)}" y="${qy - 5}" font-size="9" fill="#2980b9" text-anchor="${i===0?'start':'end'}" font-weight="bold">${results[i].Qe.toFixed(2)}</text>`;
    });
    svg += `<path d="${qPath}" fill="none" stroke="#3498db" stroke-width="1.5" />`;
  };
  drawDiagramSet(marginY + 30, resL, '【左加力時の応力状態 (L)】');
  drawDiagramSet(marginY + 530, resR, '【右加力時の応力状態 (R)】');
  svg += `</svg>`;
  return svg;
}
window.generateSingleBeamNMQStressSvg = generateSingleBeamNMQStressSvg;

/**
 * 水平構面等の等価矩形を算出・描画する SVG 関数
 */
export function generateDiaphragmEquivalentSvg(dia, fd, direction) {
  if (!dia || !fd || !fd.nodes) return '';
  const pts = (dia.nodeIds || []).map(nid => fd.nodes[nid]).filter(Boolean);
  if (pts.length < 3) return '';
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  pts.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
  const bW = maxX - minX, bH = maxY - minY, padding = 20, svgW = 200, svgH = 200, scale = Math.min((svgW - padding * 2) / (bW || 1000), (svgH - padding * 2) / (bH || 1000));
  const tx = (x) => padding + (x - minX) * scale, ty = (y) => svgH - padding - (y - minY) * scale;
  let svg = `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="background:#fff;">`;
  let d = `M ${tx(pts[0].x)} ${ty(pts[0].y)}`;
  pts.forEach((p, i) => { if(i>0) d += ` L ${tx(p.x)} ${ty(p.y)}`; }); d += ' Z';
  svg += `<path d="${d}" fill="rgba(0,0,0,0.05)" stroke="#666" stroke-width="1" />`;
  const S = dia.area || (bW * bH / 1000000);
  if (direction === 'X') {
    const B = dia.BBox_Y * 1000, L = (S / (dia.BBox_Y || 0.1)) * 1000;
    svg += `<rect x="${tx(minX)}" y="${ty(minY) - B * scale}" width="${L * scale}" height="${B * scale}" fill="none" stroke="#3498db" stroke-width="2" stroke-dasharray="4,4" />`;
  } else {
    const B = dia.BBox_X * 1000, L = (S / (dia.BBox_X || 0.1)) * 1000;
    svg += `<rect x="${tx(minX)}" y="${ty(minY) - L * scale}" width="${B * scale}" height="${L * scale}" fill="none" stroke="#2ecc71" stroke-width="2" stroke-dasharray="4,4" />`;
  }
  svg += `</svg>`;
  return svg;
}
window.generateDiaphragmEquivalentSvg = generateDiaphragmEquivalentSvg;

/**
 * 金物名の記号化ロジック
 */
export const makeShortName = (name) => {
    if (!name || name === '対象外' || name === '不要' || name.includes('標準')) return '';
    const n = name.toUpperCase();
    if (n.includes('CP-L') || n.includes('CP・L')) return 'L';
    if (n.includes('CP-T') || n.includes('CP・T')) return 'T';
    if (n.includes('VP')) return 'V';
    if (n.includes('SB-F2') || n.includes('SB・F2')) return 'Is';
    if (n.includes('SB-F') || n.includes('SB・F')) return 'Ps';
    if (n.includes('HD-B10')) return '2';
    if (n.includes('HD-B15×2') || n.includes('HD-B15X2')) return '32';
    if (n.includes('HD-B15')) return '3';
    if (n.includes('HD-B20')) return '4';
    if (n.includes('HD-B25')) return '5';
    if (n.includes('U25')) return '25';
    if (n.includes('U35')) return 'U3';
    if (n.includes('HI43')) return 'H4';
    if (n.includes('HI68')) return '68';
    return name.substring(0, 2).replace(/[^\x00-\x7F]/g, '');
};
window.makeShortName = makeShortName;

/**
 * 金物配置図の生成
 */
export function generateHardwarePlanSvg(floorKey, fd, unifiedBbox = null) {
  if (!fd || !fd.nodes) return {svg:''};
  const bbox = unifiedBbox || getFloorBoundingBox(fd);
  const minX = bbox.minX, maxX = bbox.maxX, minY = bbox.minY, maxY = bbox.maxY;
  const pad = 100, svgW = 600, scale = Math.min((svgW-pad*2)/(bbox.width||100), 600/(bbox.height||100)), svgH = (bbox.height)*scale + pad*2;
  const w2s = (x,y) => ({ x: pad+(x-minX)*scale, y: svgH-pad-(y-minY)*scale });

  let bufGrid = "", bufWalls = "", bufEmptyPosts = "", bufHardwarePosts = "";
  const gridX = new Set(), gridY = new Set(), diagAxes = [];
  (fd.columns || []).forEach(c => { const n = fd.nodes[c.nodeIndex]; if(n){ gridX.add(Math.round(n.x)); gridY.add(Math.round(n.y)); } });
  (fd.walls || []).forEach(w => {
      const n1 = fd.nodes[w.n1], n2 = fd.nodes[w.n2];
      if(n1){ gridX.add(Math.round(n1.x)); gridY.add(Math.round(n1.y)); }
      if(n2){ gridX.add(Math.round(n2.x)); gridY.add(Math.round(n2.y)); }
      const modAngle = Math.abs((w.angle || 0) % 90);
      if(modAngle>0.1 && modAngle<89.9 && n1 && n2) diagAxes.push({ n1, n2, angle:w.angle, axisName:w.axisName||'' });
  });

  Array.from(gridX).sort((a,b)=>a-b).forEach((x, idx) => { bufGrid += `<line x1="${w2s(x, minY).x}" y1="${w2s(x, minY).y}" x2="${w2s(x, maxY).x}" y2="${w2s(x, maxY).y}" stroke="#eee" stroke-width="1" />`; });
  Array.from(gridY).sort((a,b)=>a-b).forEach((y, idx) => { bufGrid += `<line x1="${w2s(minX, y).x}" y1="${w2s(minX, y).y}" x2="${w2s(maxX, y).x}" y2="${w2s(maxX, y).y}" stroke="#eee" stroke-width="1" />`; });

  (fd.walls || []).forEach(w => {
      const n1 = fd.nodes[w.n1], n2 = fd.nodes[w.n2]; if(!n1||!n2)return;
      bufWalls += `<line x1="${w2s(n1.x,n1.y).x}" y1="${w2s(n1.x,n1.y).y}" x2="${w2s(n2.x,n2.y).x}" y2="${w2s(n2.x,n2.y).y}" stroke="#000" stroke-width="2" />`;
  });

  (fd.columns || []).forEach((p, idx) => {
      const n = fd.nodes[p.nodeIndex]; if(!n) return;
      const pos = w2s(n.x, n.y);
      let tName = '', bName = '';
      const res = window.calculateColumnT ? window.calculateColumnT(idx, fd, floorKey) : null;
      if (res && res.cases) {
          res.cases.forEach(c => {
              const tm = c.topMetal?.name, bm = c.baseMetal?.name;
              const isReal = (m) => m && m !== '-' && !m.includes('不要') && !m.includes('対象外') && !m.includes('標準');
              if (isReal(tm)) tName = tm; if (isReal(bm)) bName = bm;
          });
      }
      const sT = tName ? makeShortName(tName) : '', sB = bName ? makeShortName(bName) : '';
      if (sT || sB) {
          bufHardwarePosts += `<rect x="${pos.x - 7.2}" y="${pos.y - 7.2}" width="14.4" height="14.4" fill="#fff9c4" stroke="#e67e22" stroke-width="2" />`;
          if (sT) bufHardwarePosts += `<text x="${pos.x}" y="${pos.y - 0.6}" font-size="9" fill="#000" text-anchor="middle" font-weight="bold">${sT}</text>`;
          if (sB) bufHardwarePosts += `<text x="${pos.x}" y="${pos.y + 6.0}" font-size="9" fill="#000" text-anchor="middle" font-weight="bold">${sB}</text>`;
      } else {
          bufEmptyPosts += `<rect x="${pos.x - 6}" y="${pos.y - 6}" width="12" height="12" fill="#fff" stroke="#ccc" stroke-width="1" />`;
      }
  });

  return { svg: `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; font-family: sans-serif; border: 1px solid #ddd;">` + bufGrid + bufWalls + bufEmptyPosts + bufHardwarePosts + `</svg>`, legendHtml: '' };
}
window.generateHardwarePlanSvg = generateHardwarePlanSvg;
