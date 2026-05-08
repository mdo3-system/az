/**
 * report/svg_diaphragm.js
 * 水平構面 等価矩形図 SVG生成モジュール
 */

export function generateDiaphragmEquivalentSvg(dia, fd, direction) {
  if (!dia || !fd || !fd.nodes) return '';
  const pts = (dia.nodeIds || []).map(nid => fd.nodes[nid]).filter(Boolean);
  if (pts.length < 3) return '';
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  pts.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
  const bW = Math.max(1, maxX - minX), bH = Math.max(1, maxY - minY), padding = 20, svgW = 200, svgH = 200;
  const scale = Math.min((svgW - padding * 2) / bW, (svgH - padding * 2) / bH);
  const tx = (x) => {
    const val = padding + (x - minX) * scale;
    return isNaN(val) ? 0 : val;
  };
  const ty = (y) => {
    const val = svgH - padding - (y - minY) * scale;
    return isNaN(val) ? 0 : val;
  };
  let svg = `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="background:#fff;">`;
  let d = `M ${tx(pts[0].x)} ${ty(pts[0].y)}`;
  pts.forEach((p, i) => { if(i>0) d += ` L ${tx(p.x)} ${ty(p.y)}`; }); d += ' Z';
  svg += `<path d="${d}" fill="rgba(0,0,0,0.05)" stroke="#666" stroke-width="1" />`;
  const S = dia.area || (bW * bH / 1000000);
  if (direction === 'X') {
    const B = (dia.BBox_Y || 0) * 1000, L = (S / (dia.BBox_Y || 0.1)) * 1000;
    svg += `<rect x="${tx(minX)}" y="${ty(minY) - B * scale}" width="${L * scale}" height="${B * scale}" fill="none" stroke="#3498db" stroke-width="2" stroke-dasharray="4,4" />`;
  } else {
    const B = (dia.BBox_X || 0) * 1000, L = (S / (dia.BBox_X || 0.1)) * 1000;
    svg += `<rect x="${tx(minX)}" y="${ty(minY) - L * scale}" width="${B * scale}" height="${L * scale}" fill="none" stroke="#2ecc71" stroke-width="2" stroke-dasharray="4,4" />`;
  }
  svg += `</svg>`;
  return svg;
}

window.generateDiaphragmEquivalentSvg = generateDiaphragmEquivalentSvg;
