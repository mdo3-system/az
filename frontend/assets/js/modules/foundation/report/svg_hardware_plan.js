/**
 * report/svg_hardware_plan.js
 * 金物配置伏図 SVG生成モジュール
 */
import { getFloorBoundingBox, appendAxesBackground, makeShortName } from './svg_utils.js';

export function generateHardwarePlanSvg(floorKey, fd, unifiedBbox = null) {
  if (!fd || !fd.nodes) return {svg:''};
  const bbox = unifiedBbox || getFloorBoundingBox(fd);
  const minX = bbox.minX, maxX = bbox.maxX, minY = bbox.minY, maxY = bbox.maxY;
  const pad = 100, svgW = 600, scale = Math.min((svgW-pad*2)/(bbox.width||100), 600/(bbox.height||100)), svgH = (bbox.height)*scale + pad*2;
  const w2s = (x,y) => ({ x: pad+(x-minX)*scale, y: svgH-pad-(y-minY)*scale });

  let bufGrid = appendAxesBackground(w2s, bbox, svgW, svgH);
  let bufWalls = "", bufEmptyPosts = "", bufHardwarePosts = "";

  (fd.walls || []).forEach(w => {
      const n1 = fd.nodes[w.n1], n2 = fd.nodes[w.n2]; if(!n1||!n2)return;
      bufWalls += `<line x1="${w2s(n1.x,n1.y).x}" y1="${w2s(n1.x,n1.y).y}" x2="${w2s(n2.x,n2.y).x}" y2="${w2s(n2.x,n2.y).y}" stroke="#000" stroke-width="2" />`;
  });

  (fd.columns || []).forEach((p, idx) => {
      const n = fd.nodes[p.nodeIndex]; if(!n) return;
      const pos = w2s(n.x, n.y);
      let tName = '', bName = '';
      const allFd = window.allFloorData || window.floorData || {};
      const floors = window.FLOORS || ['PH', 'R', '3', '2', '1'];
      const res = window.calculateColumnT ? window.calculateColumnT(idx, fd, floorKey, allFd, floors) : null;
      if (res) {
          const isReal = (m) => m && m !== '-' && !m.includes('不要') && !m.includes('対象外') && !m.includes('標準');
          const tm = res.topMetal?.name;
          const bm = res.baseMetal?.name;
          if (isReal(tm)) tName = tm;
          if (isReal(bm)) bName = bm;
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
