/**
 * report/svg_foundation.js
 * 基礎反力図・負担面積図 SVG生成モジュール
 */
import { getFloorBoundingBox, appendAxesBackground } from './svg_utils.js';

/**
 * べた基礎反力図 (平面図) を SVG で生成する
 */
export function generateFoundationReactionSvg(fd, unifiedBbox = null) {
  if (!fd || !fd.nodes || fd.nodes.length === 0) return '';
  
  const bbox = unifiedBbox || getFloorBoundingBox(fd);
  const minX = bbox.minX, maxX = bbox.maxX, minY = bbox.minY, maxY = bbox.maxY;
  
  const padding = 100;
  const svgW = 600;
  const scale = Math.min((svgW - padding * 2) / (bbox.width || 1), 600 / (bbox.height || 1));
  const svgH = bbox.height * scale + padding * 2;

  const w2s = (x, y) => {
      const sx = padding + (x - minX) * scale;
      const sy = svgH - padding - (y - minY) * scale;
      return { x: isNaN(sx) ? 0 : sx, y: isNaN(sy) ? 0 : sy };
  };

  let svg = `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; font-family: sans-serif; border: 1px solid #ddd; max-height: 1000px; width: 100%; max-width: 1600px; margin: 0 auto; display: block;">`;

  svg += appendAxesBackground(w2s, bbox, svgW, svgH);

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
  svg += appendAxesBackground(w2s, bbox, svgW, svgH);

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

window.generateFoundationReactionSvg = generateFoundationReactionSvg;
window.generateFoundationTributarySvg = generateFoundationTributarySvg;
