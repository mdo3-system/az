/**
 * report/svg_utils.js
 * 帳票SVG生成用 共通ユーティリティ
 */
import { dxfVAxes, dxfHAxes, dxfSkewedAxes } from '../foundation_cad.js';

/**
 * 床ごとの共通バウンディングボックス（描画範囲）を算出する
 */
export function getFloorBoundingBox(fd) {
  const nodes = new Set();
  (fd.columns || []).forEach(c => { if(c.nodeIndex !== undefined) nodes.add(c.nodeIndex); });
  (fd.walls || []).forEach(w => { if(w.n1 !== undefined) nodes.add(w.n1); if(w.n2 !== undefined) nodes.add(w.n2); });
  (fd.beams || []).forEach(b => { if(b.n1 !== undefined) nodes.add(b.n1); if(b.n2 !== undefined) nodes.add(b.n2); });
  (fd.perimeterBeams || []).forEach(b => { if(b.n1 !== undefined) nodes.add(b.n1); if(b.n2 !== undefined) nodes.add(b.n2); });
  (fd.slabs || []).forEach(s => (s.nodeIds || []).forEach(id => { if(id !== undefined) nodes.add(id); }));
  
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  nodes.forEach(nid => {
    const n = fd.nodes[nid];
    if (!n || typeof n.x !== 'number' || typeof n.y !== 'number' || isNaN(n.x) || isNaN(n.y)) return;
    if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
  });
  
  if (minX === Infinity || isNaN(minX)) return { minX: 0, maxX: 1000, minY: 0, maxY: 1000, width: 1000, height: 1000 };
  return { minX, maxX, minY, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

/**
 * レポートに含まれる全階層の共通バウンディングボックスを算出する
 */
export function getGlobalBoundingBox(fdList) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  
  fdList.forEach(fd => {
    if (!fd) return;
    const bbox = getFloorBoundingBox(fd);
    if (bbox.minX === 0 && bbox.maxX === 1000) return; 
    minX = Math.min(minX, bbox.minX);
    maxX = Math.max(maxX, bbox.maxX);
    minY = Math.min(minY, bbox.minY);
    maxY = Math.max(maxY, bbox.maxY);
  });

  if (minX === Infinity) return { minX: 0, maxX: 1000, minY: 0, maxY: 1000, width: 1000, height: 1000 };
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * 帳票の各図面（SVG）の背景に通り芯（グリッド）を描画する
 */
export function appendAxesBackground(w2s, bbox, svgW, svgH) {
  let res = "";
  const { minX, maxX, minY, maxY } = bbox;
  const vAxes = window.dxfVAxes || dxfVAxes || [];
  const hAxes = window.dxfHAxes || dxfHAxes || [];
  const sAxes = window.dxfSkewedAxes || dxfSkewedAxes || [];

  vAxes.forEach(ax => {
    const p1 = w2s(ax.x, minY), p2 = w2s(ax.x, maxY);
    res += `<line x1="${p1.x}" y1="${p1.y + 20}" x2="${p2.x}" y2="${p2.y - 20}" stroke="#f0f0f0" stroke-width="1" />`;
    if (ax.label) {
      res += `<text x="${p1.x}" y="${p1.y + 35}" font-size="10" fill="#bbb" text-anchor="middle" font-family="sans-serif">${ax.label}</text>`;
      res += `<text x="${p2.x}" y="${p2.y - 25}" font-size="10" fill="#bbb" text-anchor="middle" font-family="sans-serif">${ax.label}</text>`;
    }
  });

  hAxes.forEach(ax => {
    const p1 = w2s(minX, ax.y), p2 = w2s(maxX, ax.y);
    res += `<line x1="${p1.x - 20}" y1="${p1.y}" x2="${p2.x + 20}" y2="${p2.y}" stroke="#f0f0f0" stroke-width="1" />`;
    if (ax.label) {
      res += `<text x="${p1.x - 25}" y="${p1.y + 4}" font-size="10" fill="#bbb" text-anchor="end" font-family="sans-serif">${ax.label}</text>`;
      res += `<text x="${p2.x + 25}" y="${p2.y + 4}" font-size="10" fill="#bbb" text-anchor="start" font-family="sans-serif">${ax.label}</text>`;
    }
  });

  sAxes.forEach(ax => {
    const p1 = w2s(ax.p1.x, ax.p1.y), p2 = w2s(ax.p2.x, ax.p2.y);
    res += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#f5f5f5" stroke-width="1" stroke-dasharray="2,2" />`;
  });

  return res;
}

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

// Global registration
window.getFloorBoundingBox = getFloorBoundingBox;
window.getGlobalBoundingBox = getGlobalBoundingBox;
window.makeShortName = makeShortName;
