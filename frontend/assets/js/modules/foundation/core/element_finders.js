// core/element_finders.js
import { floorData, currentFloor, dxfVAxes, dxfHAxes, dxfSkewedAxes } from '../data/state_store.js';
import { viewState } from '../rendering/viewport_manager.js';
import { distToSegment, pointInPolygon } from './geometry_utils.js';

/**
 * 最寄りのスナップ点を探す
 */
export function findSnapNode(wx, wy, tolWorld = null) {
  const SNAP_RADIUS_WORLD = tolWorld !== null ? tolWorld : (10 / viewState.scale);
  const fd = floorData[currentFloor];
  if (!fd || !fd.nodes) return null;
  let best = null, bestD = SNAP_RADIUS_WORLD;
  fd.nodes.forEach((n, i) => {
    const d = Math.hypot(n.x - wx, n.y - wy);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/**
 * マウス座標付近の梁（基礎梁含む）を探す
 */
export function findBeamNear(wx, wy) {
  const fd = floorData[currentFloor];
  if (!fd || !fd.beams || !fd.nodes) return null;
  const TOL_WORLD = 10 / viewState.scale;
  const showBeam = document.getElementById('vis-beam')?.checked ?? true;
  const showFbeam = document.getElementById('vis-fbeam')?.checked ?? true;

  for (let i = 0; i < fd.beams.length; i++) {
    const b = fd.beams[i];
    const isFbeam = (b.type === 'foundation_beam' || b.tributaryWidth !== undefined || b.groundPressure !== undefined);
    if (isFbeam && !showFbeam) continue;
    if (!isFbeam && !showBeam) continue;

    const n1 = fd.nodes[b.n1], n2 = fd.nodes[b.n2];
    if (!n1 || !n2) continue;
    if (distToSegment(wx, wy, n1.x, n1.y, n2.x, n2.y) < TOL_WORLD) return { type: 'beam', index: i };
  }

  if (showFbeam && fd.perimeterBeams) {
    for (let i = 0; i < fd.perimeterBeams.length; i++) {
        const b = fd.perimeterBeams[i];
        const n1 = fd.nodes[b.n1], n2 = fd.nodes[b.n2];
        if (!n1 || !n2) continue;
        if (distToSegment(wx, wy, n1.x, n1.y, n2.x, n2.y) < TOL_WORLD) return { type: 'perimeterBeam', index: i };
    }
  }
  return null;
}

/**
 * 指定座標が内部にあるスラブを探す
 */
export function findSlabAt(wx, wy) {
  const showSlab = document.getElementById('vis-slab')?.checked ?? true;
  if (!showSlab) return null;
  const fd = floorData[currentFloor];
  for (let i = fd.slabs.length - 1; i >= 0; i--) {
    const sl = fd.slabs[i];
    const pts = sl.nodeIds.map(ni => fd.nodes[ni]).filter(Boolean);
    if (pts.length >= 3 && pointInPolygon(wx, wy, pts)) return i;
  }
  return null;
}

/**
 * 通り芯を探す
 */
export function findAxisNear(wcX, wcY, tolerance = 400) {
  let closest = null;
  let minDistance = tolerance;

  dxfVAxes.forEach((ax, i) => {
    const d = Math.abs(ax.x - wcX);
    if (d < minDistance) { minDistance = d; closest = { dir: 'v', index: i }; }
  });
  dxfHAxes.forEach((ax, i) => {
    const d = Math.abs(ax.y - wcY);
    if (d < minDistance) { minDistance = d; closest = { dir: 'h', index: i }; }
  });
  dxfSkewedAxes.forEach((ax, i) => {
    const dx = ax.p2.x - ax.p1.x, dy = ax.p2.y - ax.p1.y;
    const l2 = dx*dx + dy*dy;
    if (l2 >= 1) {
      const dist = Math.abs(dy * wcX - dx * wcY + ax.p2.x * ax.p1.y - ax.p2.y * ax.p1.x) / Math.sqrt(l2);
      if (dist < minDistance) { minDistance = dist; closest = { dir: 's', index: i }; }
    }
  });
  return closest;
}

/**
 * 指定座標が内部にある水平構面を探す
 */
export function findDiaphragmAt(wx, wy) {
  const showDiaph = document.getElementById('vis-diaph')?.checked ?? true;
  if (!showDiaph) return null;
  const fd = floorData[currentFloor];
  if (!fd.diaphragms) return null;
  for (let i = fd.diaphragms.length - 1; i >= 0; i--) {
    const d = fd.diaphragms[i];
    const pts = d.nodeIds.map(ni => fd.nodes[ni]).filter(Boolean);
    if (pts.length >= 3 && pointInPolygon(wx, wy, pts)) return i;
  }
  return null;
}

/**
 * 最寄りの耐力壁を探す
 */
export function findWallNear(wx, wy) {
    const fd = floorData[currentFloor];
    if (!fd || !fd.walls || !fd.nodes) return null;
    const TOL_WORLD = 15 / viewState.scale;
    const showWall = document.getElementById('vis-wall')?.checked ?? true;
    if (!showWall) return null;

    for (let i = 0; i < fd.walls.length; i++) {
        const w = fd.walls[i];
        const n1 = fd.nodes[w.n1], n2 = fd.nodes[w.n2];
        if (!n1 || !n2) continue;
        if (distToSegment(wx, wy, n1.x, n1.y, n2.x, n2.y) < TOL_WORLD) return i;
    }
    return null;
}
