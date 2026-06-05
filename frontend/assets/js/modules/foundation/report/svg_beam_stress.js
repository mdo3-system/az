/**
 * report/svg_beam_stress.js
 * 基礎梁 応力図 (M/Q/N) SVG生成モジュール
 */
import { floorData, FLOORS } from '../foundation_cad.js';

/**
 * 単一の基礎梁の応力図（M図・Q図）をSVGで生成する (短期/長期)
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
    const mMidY = yAxisM + M_mid * scaleM;
    svg += `<text x="${mMidX}" y="${mMidY > yAxisM ? mMidY + 15 : mMidY - 5}" font-size="11" fill="#c0392b" text-anchor="middle" font-weight="bold">${M_mid.toFixed(2)}</text>`;
    
    svg += `<line x1="${padX}" y1="${yAxisQ}" x2="${padX + drawW}" y2="${yAxisQ}" stroke="#ccc" stroke-width="2" />`;
    const qStartY = yAxisQ - Q * scaleQ, qEndY = yAxisQ + Q * scaleQ;
    const qPath = `M ${padX} ${yAxisQ} L ${padX} ${qStartY} L ${padX + drawW} ${qEndY} L ${padX + drawW} ${yAxisQ} Z`;
    svg += `<path d="${qPath}" fill="rgba(41, 128, 185, 0.1)" stroke="#2980b9" stroke-width="2" />`;
    svg += `</svg>`;
    return svg;
}

/**
 * 基礎梁の応力図 (N/M/Q) SVG を生成する (水平荷重時)
 */
export function generateSingleBeamNMQStressSvg(beam) {
  const fd = floorData['1'];
  if (!fd || !window.calculateFoundationHorizontalStressData) return '';
  const data = window.calculateFoundationHorizontalStressData(fd, beam, '1', floorData || {}, FLOORS || [], beam.calcModel || 'span_supports');
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

window.generateSingleBeamStressSvg = generateSingleBeamStressSvg;
window.generateSingleBeamNMQStressSvg = generateSingleBeamNMQStressSvg;
