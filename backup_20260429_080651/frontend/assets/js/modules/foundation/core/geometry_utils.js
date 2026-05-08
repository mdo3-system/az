// core/geometry_utils.js
import { STRESS_TOLERANCE } from './constants.js';

/**
 * 2つのセグメントが同一線上にあるか判定
 */
export function checkCollinear(p1, p2, p3, p4) {
  const area1 = Math.abs((p2.x - p1.x)*(p3.y - p1.y) - (p2.y - p1.y)*(p3.x - p1.x));
  const area2 = Math.abs((p2.x - p1.x)*(p4.y - p1.y) - (p2.y - p1.y)*(p4.x - p1.x));
  const eps = 20.0; // 20mm以内の誤差を許容（手作図の微差を吸収）
  return area1 < eps * 1000 && area2 < eps * 1000;
}

/**
 * 共線上の2つのセグメント [p1,p2] と [p3,p4] の重複タイプを返す
 */
export function getSegmentOverlap(p1, p2, p3, p4) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const l1 = dist(p1, p2);
  const l2 = dist(p3, p4);
  
  // 1次元座標に変換（p1を原点とする）
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const project = (p) => {
    if (l1 < 1) return 0;
    return ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / l1;
  };

  const s1 = 0, e1 = l1;
  let s2 = project(p3), e2 = project(p4);
  if (s2 > e2) [s2, e2] = [e2, s2];

  const eps = 10.0; // 10mm
  
  // 完全一致
  if (Math.abs(s1 - s2) < eps && Math.abs(e1 - e2) < eps) return { type: 'identical', l1, l2 };

  // 包含
  if (s1 <= s2 + eps && e1 >= e2 - eps) return { type: 'contains', l1, l2 };
  if (s2 <= s1 + eps && e2 >= e1 - eps) return { type: 'containedBy', l1, l2 };

  // 部分重複判定
  const intersect = Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
  if (intersect > eps) return { type: 'partialOverflow', l1, l2 };

  return { type: 'none' };
}

export function clipPolygonStrict(poly, a, b, c) {
    const res = [];
    if (!poly || poly.length === 0) return [];
    
    for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];

        const d1 = a * p1.x + b * p1.y + c;
        const d2 = a * p2.x + b * p2.y + c;

        const in1 = d1 <= 1e-8;
        const in2 = d2 <= 1e-8;

        if (in1) {
            if (in2) {
                res.push(p2);
            } else {
                // 出点
                const t = d1 / (d1 - d2);
                res.push({ x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) });
            }
        } else if (in2) {
            // 入点
            const t = d1 / (d1 - d2);
            res.push({ x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) });
            res.push(p2);
        }
    }
    return res;
}

export function dedupPolygon(poly, eps = 5) {
    if (!poly || poly.length < 3) return poly;
    const out = [];
    for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        const prev = out.length > 0 ? out[out.length - 1] : null;
        if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) < eps) continue;
        out.push(p);
    }
    // 末尾と先頭の重複チェック
    if (out.length > 1) {
        const first = out[0], last = out[out.length - 1];
        if (Math.hypot(last.x - first.x, last.y - first.y) < eps) out.pop();
    }
    return out;
}

export function calcPolygonAreaStrict(poly) {
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
        area += (p1.x * p2.y - p2.x * p1.y);
    }
    return Math.abs(area) / 2;
}

export function distToBeamLine(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
