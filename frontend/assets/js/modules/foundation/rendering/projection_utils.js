// rendering/projection_utils.js
import { dxfVAxes, dxfHAxes, dxfSkewedAxes, floorData } from '../foundation_cad.js';

/**
 * 特定の通り名を持つ全ての壁・梁から、通り芯の「パス（連続する線分リスト）」を構築する
 */
export function getAxisSegments(axisName) {
  const vAxis = (dxfVAxes || []).find(a => a.label === axisName);
  const hAxis = (dxfHAxes || []).find(a => a.label === axisName);
  
  if (vAxis || hAxis) {
    const isV = !!vAxis;
    const coord = isV ? vAxis.x : hAxis.y;
    return [{
       p1: isV ? {x: coord, y: -100000} : {x: -100000, y: coord},
       p2: isV ? {x: coord, y: 100000} : {x: 100000, y: coord},
       isGrid: true,
       angle: isV ? Math.PI/2 : 0
    }];
  }

  const rawSegments = [];
  const floors = ['PH', 'R', '3', '2', '1'];
  floors.forEach(f => {
    const fd = (window.allFloorData && window.allFloorData[f]) || (window.floorData && window.floorData[f]) || floorData[f];
    if (!fd) return;
    [...(fd.walls || []), ...(fd.beams || []), ...(fd.perimeterBeams || [])].forEach(it => {
      if (it.axisName === axisName) {
        const n1 = fd.nodes[it.n1], n2 = fd.nodes[it.n2];
        if (n1 && n2) rawSegments.push({p1: n1, p2: n2});
      }
    });
  });

  if (rawSegments.length === 0) return [];

  const uniqueSegs = [];
  rawSegments.forEach(s => {
    const exists = uniqueSegs.some(u => 
      (Math.hypot(u.p1.x-s.p1.x, u.p1.y-s.p1.y)<10 && Math.hypot(u.p2.x-s.p2.x, u.p2.y-s.p2.y)<10) ||
      (Math.hypot(u.p1.x-s.p2.x, u.p1.y-s.p2.y)<10 && Math.hypot(u.p2.x-s.p1.x, u.p2.y-s.p1.y)<10)
    );
    if (!exists) uniqueSegs.push(s);
  });

  const isXDirection = Math.abs(uniqueSegs[0].p1.x - uniqueSegs[0].p2.x) > Math.abs(uniqueSegs[0].p1.y - uniqueSegs[0].p2.y);
  uniqueSegs.sort((a, b) => {
    const minA = isXDirection ? Math.min(a.p1.x, a.p2.x) : Math.min(a.p1.y, a.p2.y);
    const minB = isXDirection ? Math.min(b.p1.x, b.p2.x) : Math.min(b.p1.y, b.p2.y);
    return minA - minB;
  });

  let currentAccumulated = 0;
  return uniqueSegs.map((s, i) => {
    const dx = s.p2.x - s.p1.x, dy = s.p2.y - s.p1.y;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const res = { ...s, length: len, angle, startL: currentAccumulated };
    currentAccumulated += len;
    return res;
  });
}

/**
 * パスに沿った累積座標を算出する
 */
export function getPosAlongPath(node, segments) {
  if (!segments || segments.length === 0) return 0;
  if (!node) return 0;

  if (segments[0].isGrid) {
    const s = segments[0];
    const cosA = Math.cos(s.angle), sinA = Math.sin(s.angle);
    return node.x * cosA + node.y * sinA;
  }

  let bestDist = Infinity;
  let bestL = 0;

  segments.forEach(seg => {
    const dx = seg.p2.x - seg.p1.x, dy = seg.p2.y - seg.p1.y;
    const l2 = dx*dx + dy*dy;
    if (l2 < 1) return;
    
    const t = ((node.x - seg.p1.x) * dx + (node.y - seg.p1.y) * dy) / l2;
    const tc = Math.max(0, Math.min(1, t));
    const px = seg.p1.x + tc * dx, py = seg.p1.y + tc * dy;
    const d = Math.hypot(node.x - px, node.y - py);
    
    if (d < bestDist) {
      bestDist = d;
      bestL = seg.startL + tc * seg.length;
    }
  });

  return bestL;
}

/**
 * 通り芯の主方向（水平寄りか垂直寄りか）を判定する
 */
export function getAxisPrimaryDirection(segments) {
  if (!segments || segments.length === 0) return true;
  let dxTotal = 0, dyTotal = 0;
  segments.forEach(s => {
    dxTotal += Math.abs(s.p2.x - s.p1.x);
    dyTotal += Math.abs(s.p2.y - s.p1.y);
  });
  return dxTotal >= dyTotal;
}

/**
 * 軸パス（折れ線）が世界座標のグリッド線と交差するポイントを全て算出する
 */
export function getAxisIntersections(segments) {
  if (!segments || segments.length === 0) return [];
  const intersections = [];
  
  (window.dxfVAxes || dxfVAxes || []).forEach(ax => {
    segments.forEach(seg => {
      const xMin = Math.min(seg.p1.x, seg.p2.x), xMax = Math.max(seg.p1.x, seg.p2.x);
      if (ax.x >= xMin - 0.1 && ax.x <= xMax + 0.1) {
        if (Math.abs(seg.p2.x - seg.p1.x) > 1) {
          const t = (ax.x - seg.p1.x) / (seg.p2.x - seg.p1.x);
          if (t >= -0.001 && t <= 1.001) {
            intersections.push({ L: seg.startL + Math.max(0, Math.min(1, t)) * seg.length, label: ax.label });
          }
        } else if (Math.abs(ax.x - seg.p1.x) < 15) {
          intersections.push({ L: seg.startL, label: ax.label });
          intersections.push({ L: seg.startL + seg.length, label: ax.label });
        }
      }
    });
  });

  (window.dxfHAxes || dxfHAxes || []).forEach(ax => {
    segments.forEach(seg => {
      const yMin = Math.min(seg.p1.y, seg.p2.y), yMax = Math.max(seg.p1.y, seg.p2.y);
      if (ax.y >= yMin - 0.1 && ax.y <= yMax + 0.1) {
        if (Math.abs(seg.p2.y - seg.p1.y) > 1) {
          const t = (ax.y - seg.p1.y) / (seg.p2.y - seg.p1.y);
          if (t >= -0.001 && t <= 1.001) {
            intersections.push({ L: seg.startL + Math.max(0, Math.min(1, t)) * seg.length, label: ax.label });
          }
        } else if (Math.abs(ax.y - seg.p1.y) < 15) {
          intersections.push({ L: seg.startL, label: ax.label });
          intersections.push({ L: seg.startL + seg.length, label: ax.label });
        }
      }
    });
  });

  const unique = [];
  const seen = new Set();
  intersections.sort((a,b) => a.L - b.L).forEach(it => {
    const key = `${it.label}_${Math.round(it.L)}`;
    if (!seen.has(key)) {
      unique.push(it);
      seen.add(key);
    }
  });
  return unique;
}

/**
 * 対象通り名を構成する要素から「基準となる代表直線」を算出する（剛体投影用）
 */
export function getAxisReferenceLine(axisName, optAllFloorData) {
  if (!axisName) return null;
  const targetLabel = axisName.trim();

  const vAxis = (dxfVAxes || []).find(a => a.label && a.label.trim() === targetLabel);
  const hAxis = (dxfHAxes || []).find(a => a.label && a.label.trim() === targetLabel);
  
  if (vAxis || hAxis) {
    const isV = !!vAxis;
    const coord = isV ? vAxis.x : hAxis.y;
    return {
       p1: isV ? {x: coord, y: 0} : {x: 0, y: coord},
       p2: isV ? {x: coord, y: 1000} : {x: 1000, y: coord},
       isGrid: true,
       angle: isV ? Math.PI/2 : 0,
       dx: isV ? 0 : 1000,
       dy: isV ? 1000 : 0
     };
  }

  const sList = window.dxfSkewedAxes || dxfSkewedAxes || [];
  const sAxis = sList.find(a => a.label && a.label.trim() === targetLabel);
  if (sAxis) {
    const dx = sAxis.p2.x - sAxis.p1.x, dy = sAxis.p2.y - sAxis.p1.y;
    return {
      p1: sAxis.p1,
      p2: sAxis.p2,
      isGrid: true,
      angle: Math.atan2(dy, dx),
      dx, dy
    };
  }

  const rawSegments = [];
  const floors = ['PH', 'R', '3', '2', '1'];
  floors.forEach(f => {
    const fd = (optAllFloorData && optAllFloorData[f]) || (window.allFloorData && window.allFloorData[f]) || (window.floorData && window.floorData[f]) || floorData[f];
    if (!fd) return;
    [...(fd.walls || []), ...(fd.beams || []), ...(fd.perimeterBeams || [])].forEach(it => {
      if (it.axisName === axisName) {
        const n1 = fd.nodes[it.n1], n2 = fd.nodes[it.n2];
        if (n1 && n2) {
          const dx = n2.x - n1.x, dy = n2.y - n1.y;
          rawSegments.push({ p1: n1, p2: n2, length: Math.hypot(dx, dy), dx, dy });
        }
      }
    });
  });

  if (rawSegments.length === 0) return null;

  rawSegments.sort((a, b) => b.length - a.length);
  const rep = rawSegments[0];
  const angle = Math.atan2(rep.dy, rep.dx);
  
  return {
    p1: rep.p1,
    p2: rep.p2,
    isGrid: false,
    angle,
    dx: rep.dx,
    dy: rep.dy
  };
}

/**
 * ノード座標を基準直線に投影し、直線上の距離(`L`)と、直交方向のズレ(`offset`)を返す
 */
export function getProjectedPos(node, refLine) {
  if (!refLine || !node) return { L: 0, offset: 0 };
  
  const dx = Math.cos(refLine.angle);
  const dy = Math.sin(refLine.angle);
  
  const nx = node.x - refLine.p1.x;
  const ny = node.y - refLine.p1.y;
  
  const L = nx * dx + ny * dy;
  const offset = nx * (-dy) + ny * dx;
  
  return { L, offset };
}

window.getAxisSegments = getAxisSegments;
window.getPosAlongPath = getPosAlongPath;
window.getAxisPrimaryDirection = getAxisPrimaryDirection;
window.getAxisIntersections = getAxisIntersections;
window.getAxisReferenceLine = getAxisReferenceLine;
window.getProjectedPos = getProjectedPos;
