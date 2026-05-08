import { 
  canvas, ctx, W, H, scale, panX, panY,
  worldToScreen, screenToWorld, setPanScale, initCanvas, resizeCanvas
} from './foundation_cad.js';

export { 
  canvas, ctx, W, H, scale, panX, panY,
  worldToScreen, screenToWorld, setPanScale, initCanvas, resizeCanvas
};

import { 
  floorData, FLOORS, currentFloor,
  dxfLines, dxfTexts, dxfVAxes, dxfHAxes, dxfSkewedAxes, dxfLayerVisibility
} from './foundation_cad.js';

// --- 幾何計算ユーティリティ (foundation_cad.js から移植) ---

/**
 * 点 (px, py) から線分 (ax, ay)-(bx, by) への最短距離を返す
 */
export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * 点 (x, y) が多角形 pts 内にあるか判定する (Winding Number / Ray Casting)
 */
export function pointInPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// --- 基礎梁応力図サブ描画 (foundation_cad.js から移植) ---

/**
 * 梁の応力図を描画するヘルパー
 */
export function drawDiagram(ctx, n1, n2, stress, mode, isSel) {
  const base_s1 = worldToScreen(n1.x, n1.y);
  const base_s2 = worldToScreen(n2.x, n2.y);
  const total_dx = base_s2.x - base_s1.x;
  const total_dy = base_s2.y - base_s1.y;
  const total_len = Math.hypot(total_dx, total_dy);
  if (total_len < 1) return;
  
  const nx = -total_dy / total_len;
  const ny = total_dx / total_len;
  
  ctx.save();
  const baseScale = typeof window !== 'undefined' && window.panScale ? window.panScale : 1;
  const originalScale = 4.0 * baseScale;

  ctx.font = 'bold 11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const spansToDraw = (stress.spans && stress.spans.length > 0) ? stress.spans : [
    { startFraction: 0, endFraction: 1, M1: stress.M1, M2: stress.M2, Mc: stress.Mc, Q1: stress.Q1, Q2: stress.Q2 }
  ];

  let maxVal = 0.1;
  if (mode === 'load') {
      maxVal = Math.max(0.1, stress.w);
  } else if (mode === 'moment' || mode === 'M') {
      const maxM = Math.max(...spansToDraw.map(s => Math.max(Math.abs(s.M1), Math.abs(s.M2), Math.abs(s.Mc))));
      maxVal = Math.max(0.1, maxM);
  } else if (mode === 'shear' || mode === 'Q') {
      const maxQ = Math.max(...spansToDraw.map(s => Math.max(Math.abs(s.Q1), Math.abs(s.Q2))));
      maxVal = Math.max(0.1, maxQ);
  }

  let drawScale = 1.0;
  if (mode === 'load') drawScale = 30.0;
  if (mode === 'moment' || mode === 'M') drawScale = 40.0;
  if (mode === 'shear' || mode === 'Q') drawScale = 30.0;
  
  const maxScaleLimit = (total_len * 2.0) / maxVal;
  drawScale = Math.min(drawScale, maxScaleLimit);

  const drawTextOutline = (text, x, y, color) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  };

  spansToDraw.forEach(span => {
    const s1 = { x: base_s1.x + total_dx * span.startFraction, y: base_s1.y + total_dy * span.startFraction };
    const s2 = { x: base_s1.x + total_dx * span.endFraction, y: base_s1.y + total_dy * span.endFraction };
    const dx = s2.x - s1.x;
    const dy = s2.y - s1.y;

    if (mode === 'load') {
       const h = stress.w * drawScale;
       ctx.fillStyle = isSel ? 'rgba(241, 196, 15, 0.5)' : 'rgba(241, 196, 15, 0.3)';
       ctx.beginPath();
       ctx.moveTo(s1.x, s1.y);
       ctx.lineTo(s1.x + nx * h, s1.y + ny * h);
       ctx.lineTo(s2.x + nx * h, s2.y + ny * h);
       ctx.lineTo(s2.x, s2.y);
       ctx.closePath();
       ctx.fill();
       ctx.strokeStyle = '#f39c12';
       ctx.lineWidth = 1;
       ctx.stroke();
       if (span.endFraction - span.startFraction > 0.3 || spansToDraw.length === 1) {
           drawTextOutline(`${stress.w.toFixed(1)}`, s1.x + dx/2 + nx*h*1.5, s1.y + dy/2 + ny*h*1.5, '#d35400');
       }
    } else if (mode === 'moment' || mode === 'M') {
       const h1 = span.M1 * drawScale;
       const h2 = span.M2 * drawScale;
       const hc = -span.Mc * drawScale;
       const p1x = s1.x + nx * h1, p1y = s1.y + ny * h1;
       const p2x = s2.x + nx * h2, p2y = s2.y + ny * h2;
       const mx = s1.x + dx/2 + nx * hc;
       const my = s1.y + dy/2 + ny * hc;
       const cx_c = 2 * mx - (p1x + p2x) / 2;
       const cy_c = 2 * my - (p1y + p2y) / 2;
       ctx.fillStyle = isSel ? 'rgba(231, 76, 60, 0.4)' : 'rgba(231, 76, 60, 0.2)';
       ctx.beginPath();
       ctx.moveTo(s1.x, s1.y); ctx.lineTo(p1x, p1y);
       ctx.quadraticCurveTo(cx_c, cy_c, p2x, p2y);
       ctx.lineTo(s2.x, s2.y); ctx.closePath(); ctx.fill();
       ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 1.5;
       ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(p1x, p1y);
       ctx.quadraticCurveTo(cx_c, cy_c, p2x, p2y);
       ctx.lineTo(s2.x, s2.y); ctx.stroke();
       const txtColor = '#c0392b';
       if (Math.abs(span.M1) > 0.1) drawTextOutline(`${span.M1.toFixed(1)}`, p1x + nx*12, p1y + ny*12, txtColor);
       if (Math.abs(span.M2) > 0.1) drawTextOutline(`${span.M2.toFixed(1)}`, p2x + nx*12, p2y + ny*12, txtColor);
       drawTextOutline(`${span.Mc.toFixed(1)}`, mx - nx*12, my - ny*12, txtColor);
    } else if (mode === 'shear' || mode === 'Q') {
       const h1 = span.Q1 * drawScale;
       const h2 = -span.Q2 * drawScale;
       const p1x = s1.x + nx * h1, p1y = s1.y + ny * h1;
       const p2x = s2.x + nx * h2, p2y = s2.y + ny * h2;
       ctx.fillStyle = isSel ? 'rgba(52, 152, 219, 0.4)' : 'rgba(52, 152, 219, 0.2)';
       ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(p1x, p1y);
       ctx.lineTo(p2x, p2y); ctx.lineTo(s2.x, s2.y); ctx.closePath(); ctx.fill();
       ctx.strokeStyle = '#3498db'; ctx.lineWidth = 1.5;
       ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(p1x, p1y);
       ctx.lineTo(p2x, p2y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
       const txtColor = '#2980b9';
       drawTextOutline(`${span.Q1.toFixed(1)}`, p1x + nx*12, p1y + ny*12, txtColor);
       drawTextOutline(`${span.Q2.toFixed(1)}`, p2x - nx*12, p2y - ny*12, txtColor);
    }
  });
  ctx.restore();
}

// --- フィット・描画管理 (foundation_main.js から移植) ---

/**
 * キャンバス上の図形全体が収まるようにズーム・パンを調整する
 */
export const fitAll = function() {
    const cvs = document.getElementById('cadCanvas');
    const wrap = document.getElementById('canvasWrap');
    if (!cvs) return;

    // 💡 修正1：Canvas単体ではなく、親要素(canvasWrap)の表示サイズを絶対に信用する
    const c_w = wrap ? wrap.clientWidth : (cvs.width || 800);
    const c_h = wrap ? wrap.clientHeight : (cvs.height || 600);
    
    const fd = floorData[currentFloor];
    if (!fd || !fd.nodes || fd.nodes.length === 0) {
        console.log("[fitAll] 図面が空のためフィットをスキップしました");
        return;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let validNodesCount = 0;

    fd.nodes.forEach(n => {
        if (!n || isNaN(n.x) || isNaN(n.y)) return;
        if (n.x < minX) minX = n.x;
        if (n.x > maxX) maxX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.y > maxY) maxY = n.y;
        validNodesCount++;
    });

    if (validNodesCount === 0) {
        console.warn("[fitAll] 有効な座標を持つノードが見つかりません。");
        return;
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const dx = Math.max(maxX - minX, 1000);
    const dy = Math.max(maxY - minY, 1000);

    const s = Math.min(c_w / dx, c_h / dy) * 0.8 || 1;
    const px = c_w / 2 - cx * s;
    const py = c_h / 2 + cy * s;

    if (typeof setPanScale === 'function') {
        setPanScale(px, py, s);
    }
};

/**
 * 描画更新要求 (現在のアクティブな描画関数を呼び出す)
 */
export const callRender = function() {
  const cvs = document.getElementById('cadCanvas');
  const wrap = document.getElementById('canvasWrap');
  if (!cvs || !wrap) return;

  // 💡 修正2：親要素(canvasWrap)のサイズでCanvasの解像度を強制同期
  const cw = wrap.clientWidth || 800;
  const ch = wrap.clientHeight || 600;
  
  if (cvs.width !== cw || cvs.height !== ch) {
    resizeCanvas(cw, ch);
    // サイズが変動した直後は必ずフィットし直す
    if (typeof window.fitAll === 'function' && floorData && floorData[currentFloor] && floorData[currentFloor].nodes && floorData[currentFloor].nodes.length > 0) {
      window.fitAll();
    }
  }

  ctx.clearRect(0, 0, cvs.width, cvs.height);

  const fd = floorData[currentFloor];
  if (!fd) return;

  // 💡 修正3：DOM要素(id="scale"等)との衝突を防ぐため、確実に「数値(number)」のみを受け入れる
  let curPanX = panX, curPanY = panY, curScale = scale;
  if (typeof window.panX === 'number' && !isNaN(window.panX)) curPanX = window.panX;
  if (typeof window.panY === 'number' && !isNaN(window.panY)) curPanY = window.panY;
  if (typeof window.scale === 'number' && !isNaN(window.scale)) curScale = window.scale;
  setPanScale(curPanX, curPanY, curScale);

  // ステート情報の取得
  const state = window.state || {};
  const { currentTool, hoveredNode, selectedElement, selectedElements = [], viewMode } = state;

  const isMultiSel = (type, idx) => {
    if (selectedElement && selectedElement.type === type && selectedElement.index === idx) return true;
    return selectedElements.some(el => el.type === type && el.index === idx);
  };

  const showCol   = document.getElementById('vis-col')   ? document.getElementById('vis-col').checked   : true;
  const showBeam  = document.getElementById('vis-beam')  ? document.getElementById('vis-beam').checked  : true;
  const showFbeam = document.getElementById('vis-fbeam') ? document.getElementById('vis-fbeam').checked : true;
  const showSlab  = document.getElementById('vis-slab')  ? document.getElementById('vis-slab').checked  : true;
  const showDiaph = document.getElementById('vis-diaph') ? document.getElementById('vis-diaph').checked : true;
  const showWall  = document.getElementById('vis-wall')  ? document.getElementById('vis-wall').checked  : true;

  const isSlabDivideMode = (currentTool === 'slabDivide');

  // 各描画コンポーネントの実行 (常に最新座標 pX, pY, s を参照する worldToScreen が内部で使われる)
  drawDxf(ctx, isSlabDivideMode);
  drawSlabs(ctx, fd, isMultiSel, showSlab);
  drawDiaphragms(ctx, fd, isMultiSel, showDiaph, isSlabDivideMode);
  drawBeams(ctx, fd, isMultiSel, showBeam, showFbeam, viewMode);
  drawPreviews(ctx, state, fd);
  drawWalls(ctx, fd, selectedElement, showWall, isSlabDivideMode);
  drawNodes(ctx, fd, hoveredNode, isSlabDivideMode);
  drawColumns(ctx, fd, hoveredNode, selectedElement, showCol, isSlabDivideMode);
  drawGrid(ctx, selectedElement, state.showGrid !== false);

  if (isSlabDivideMode && typeof window.drawSlabDivideOverlay === 'function') {
    window.drawSlabDivideOverlay();
  }
}

// --- 描画コンポーネント (foundation_cad.js から抽出) ---

/**
 * DXFレイヤーの描画
 */
export function drawDxf(ctx, isSlabDivideMode) {
  dxfLines.forEach(l => {
    if (l.type && !['LINE', 'TEXT', 'MTEXT', 'POINT', 'CIRCLE', 'ARC'].includes(l.type)) return;
    if (dxfLayerVisibility[l.layer] === false) return;
    if (l.layer.toUpperCase().includes("COL") || l.layer.includes("柱")) return;

    const s1 = worldToScreen(l.x1, l.y1);
    const s2 = worldToScreen(l.x2, l.y2);
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.globalAlpha = isSlabDivideMode ? 0.05 : 0.15;
    ctx.strokeStyle = '#7f8c8d';
    ctx.lineWidth = 1.0;
    ctx.stroke();
  });

  dxfTexts.forEach(t => {
    if (dxfLayerVisibility[t.layer] === false) return;
    if (t.layer.toUpperCase().includes("COL") || t.layer.includes("柱")) return;

    const s = worldToScreen(t.x, t.y);
    ctx.globalAlpha = isSlabDivideMode ? 0.05 : 0.15;
    ctx.fillStyle = '#7f8c8d';
    const fsize = Math.max(10, Math.round(90 * scale));
    ctx.font = `${fsize}px Arial`;
    ctx.textBaseline = 'middle';
    ctx.fillText(t.text, s.x, s.y);
  });
  ctx.globalAlpha = 1.0;
}

/**
 * スラブの描画
 */
export function drawSlabs(ctx, fd, isMultiSel, showSlab) {
  if (!showSlab || !fd.slabs) return;

  fd.slabs.forEach((sl, si) => {
    const pts = sl.nodeIds.map(ni => fd.nodes[ni]).filter(Boolean);
    if (pts.length < 3) return;
    
    const isSel = isMultiSel('slab', si) || (window.highlightedSlabIndex === si);

    ctx.fillStyle = isSel ? 'rgba(230, 126, 34, 0.4)' : 'rgba(52, 152, 219, 0.1)';
    ctx.beginPath();
    pts.forEach((p, i) => {
      const sp = worldToScreen(p.x, p.y);
      if (i === 0) ctx.moveTo(sp.x, sp.y);
      else ctx.lineTo(sp.x, sp.y);
    });
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = isSel ? '#ff0000' : 'rgba(44, 62, 80, 0.8)';
    ctx.lineWidth = isSel ? 6 : 3;
    if (isSel) ctx.setLineDash([10, 5]); else ctx.setLineDash([]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (sl.tributaryPolygons && Array.isArray(sl.tributaryPolygons) && sl.tributaryPolygons.length > 0) {
        sl.tributaryPolygons.forEach((poly, i) => {
            if (!poly || poly.length < 3) return;
            ctx.beginPath();
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#00FFFF';
            const pt0 = poly[0].x !== undefined ? poly[0] : {x: poly[0][0], y: poly[0][1]};
            const sp0 = worldToScreen(pt0.x, pt0.y);
            ctx.moveTo(sp0.x, sp0.y);
            for (let idx = 1; idx < poly.length; idx++) {
                const pt = poly[idx].x !== undefined ? poly[idx] : {x: poly[idx][0], y: poly[idx][1]};
                const sp = worldToScreen(pt.x, pt.y);
                ctx.lineTo(sp.x, sp.y);
            }
            ctx.closePath();
            ctx.stroke();

            const area = sl.edgeAreas ? sl.edgeAreas[i] : 0;
            const L = sl.edgeLs ? (sl.edgeLs[i] || 0) : 0;
            if (L > 0) {
              let cx = 0, cy = 0, sa = 0;
              poly.forEach((pt, k) => {
                const p1 = pt;
                const p2 = poly[(k+1)%poly.length];
                const p1x = p1.x !== undefined ? p1.x : p1[0];
                const p1y = p1.y !== undefined ? p1.y : p1[1];
                const p2x = p2.x !== undefined ? p2.x : p2[0];
                const p2y = p2.y !== undefined ? p2.y : p2[1];
                const v = p1x * p2y - p2x * p1y;
                sa += v; cx += (p1x + p2x) * v; cy += (p1y + p2y) * v;
              });
              sa *= 0.5;
              cx /= (6 * sa || 1); cy /= (6 * sa || 1);
              const slp = worldToScreen(cx, cy);
              ctx.font = 'bold 10px Inter, sans-serif';
              const txtArea = `${area.toFixed(3)}m²`;
              const isTri = sl.edgeIsTriangle ? sl.edgeIsTriangle[i] : (poly.length === 3);
              const txtL = `${isTri?'*':''}L=${L.toFixed(3)}m`;
              ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              const tw = Math.max(ctx.measureText(txtArea).width, ctx.measureText(txtL).width);
              const th = 26;
              ctx.fillStyle = 'rgba(255,255,255,0.85)';
              ctx.fillRect(slp.x - tw/2 - 5, slp.y - th/2, tw + 10, th);
              ctx.fillStyle = '#2c3e50'; ctx.fillText(txtArea, slp.x, slp.y - 7);
              ctx.fillStyle = '#16a085'; ctx.fillText(txtL, slp.x, slp.y + 7);
            }
        });
    }

    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      const p1 = pts[i];
      const p2 = pts[j];
      const cond = sl.edgeConditions[i] || 'fixed';
      const sa = worldToScreen(p1.x, p1.y);
      const sb = worldToScreen(p2.x, p2.y);
      const midW = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      
      let skipDrawing = false;
      const myLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      fd.slabs.forEach((otherSl, otherSi) => {
        if (skipDrawing || otherSi === si) return;
        const otherPts = otherSl.nodeIds.map(ni => fd.nodes[ni]).filter(Boolean);
        for (let k = 0; k < otherPts.length; k++) {
          const ok1 = otherPts[k], ok2 = otherPts[(k+1) % otherPts.length];
          const dist = distToSegment(midW.x, midW.y, ok1.x, ok1.y, ok2.x, ok2.y);
          if (dist < 50) {
            const otherLen = Math.hypot(ok2.x - ok1.x, ok2.y - ok1.y);
            if (otherLen > myLen + 1) { skipDrawing = true; break; }
            else if (Math.abs(otherLen - myLen) < 1) { if (otherSl.id < sl.id) { skipDrawing = true; break; } }
          }
        }
      });

      if (!skipDrawing) {
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        const offsetDist = 200;
        const ox = (dy / len) * offsetDist;
        const oy = (-dx / len) * offsetDist;
        const labelPos = worldToScreen(midW.x + ox, midW.y + oy);
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillStyle = 'yellow'; ctx.strokeStyle = 'black'; ctx.lineWidth = 2;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const labelText = `${sl.id}-B${i+1}`;
        ctx.strokeText(labelText, labelPos.x, labelPos.y);
        ctx.fillText(labelText, labelPos.x, labelPos.y);
      }

      if (cond === 'free') {
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y);
        ctx.strokeStyle = 'rgba(242,92,92,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.setLineDash([]);
      } else if (cond === 'pin') {
        ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y);
        ctx.strokeStyle = 'rgba(52,199,123,0.5)'; ctx.lineWidth = 1.0; ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  });
}

/**
 * 水平構面の描画
 */
export function drawDiaphragms(ctx, fd, isMultiSel, showDiaph, isSlabDivideMode) {
  if (!showDiaph || !fd.diaphragms) return;
  if (isSlabDivideMode) ctx.globalAlpha = 0.1;
  fd.diaphragms.forEach((dia, di) => {
    const pts = dia.nodeIds.map(ni => fd.nodes[ni]).filter(Boolean);
    if (pts.length < 3) return;
    const isSel = isMultiSel('diaphragm', di);
    ctx.fillStyle = isSel ? 'rgba(91,138,254,0.15)' : 'rgba(230, 126, 34, 0.25)';
    ctx.beginPath();
    pts.forEach((p, i) => {
      const sp = worldToScreen(p.x, p.y);
      if (i === 0) ctx.moveTo(sp.x, sp.y); else ctx.lineTo(sp.x, sp.y);
    });
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = isSel ? '#5b8afe' : '#e67e22'; ctx.lineWidth = isSel ? 2 : 1.5;
    ctx.stroke();

    let mx = 0, my = 0; pts.forEach(p => { mx += p.x; my += p.y; });
    const sm = worldToScreen(mx / pts.length, my / pts.length);
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.fillStyle = '#e67e22';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(dia.id || `D-${di+1}`, sm.x, sm.y - 14);

    if (dia.Lx !== undefined && dia.qx !== undefined) {
        ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#e74c3c';
        ctx.fillText(`Lx=${dia.Lx.toFixed(2)}m X耐力=${dia.qx.toFixed(3)}`, sm.x, sm.y);
    }
    if (dia.Ly !== undefined && dia.qy !== undefined) {
        ctx.font = '9px Inter, sans-serif'; ctx.fillStyle = '#3498db';
        ctx.fillText(`Ly=${dia.Ly.toFixed(2)}m Y耐力=${dia.qy.toFixed(3)}`, sm.x, sm.y + 12);
    }
  });
  ctx.globalAlpha = 1.0;
}

/**
 * 梁の描画
 */
export function drawBeams(ctx, fd, isMultiSel, showBeam, showFbeam, viewMode) {
  fd.beams.forEach((b, bi) => {
    const isFbeam = (b.type === 'foundation_beam' || b.tributaryWidth !== undefined || b.groundPressure !== undefined);
    if (isFbeam && !showFbeam) return;
    if (!isFbeam && !showBeam) return;

    const n1 = fd.nodes[b.n1];
    const n2 = fd.nodes[b.n2];
    if (!n1 || !n2) return;
    const s1 = worldToScreen(n1.x, n1.y);
    const s2 = worldToScreen(n2.x, n2.y);
    const isSel = isMultiSel('beam', bi);

    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y);
    const isHighlight = (window.highlightedBeamType === 'beam' && window.highlightedBeamIndex === bi);
    if (isHighlight) { ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 15; }
    else if (isFbeam) { ctx.strokeStyle = isSel ? '#ff4500' : '#27ae60'; ctx.lineWidth = isSel ? 12 : 6; }
    else { ctx.strokeStyle = isSel ? '#ff4500' : '#f5a623'; ctx.lineWidth = isSel ? 8 : 2; }
    ctx.stroke();
 
    const vm = viewMode || 'shape';
    if (vm !== 'shape' && isFbeam && typeof window.computeBeamStress === 'function') {
      const stress = window.computeBeamStress(fd, b);
      if (stress && stress.w > 0) drawDiagram(ctx, n1, n2, stress, vm, isSel);
    }

    const mx = (s1.x + s2.x)/2, my = (s1.y + s2.y)/2;
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillStyle = isSel ? '#e74c3c' : (isFbeam ? '#27ae60' : 'rgba(245,166,35,0.7)');
    ctx.textAlign = 'center'; ctx.fillText(b.id, mx, my - 8);
  });
 
  if (showFbeam && fd.perimeterBeams) {
    fd.perimeterBeams.forEach((pb, pi) => {
      const n1 = fd.nodes[pb.n1], n2 = fd.nodes[pb.n2];
      if (!n1 || !n2) return;
      const s1 = worldToScreen(n1.x, n1.y), s2 = worldToScreen(n2.x, n2.y);
      // 外周梁は単独選択 index のみチェック (selectedElement.type === 'perimeterbeam')
      // ここでは isMultiSel が selectedElement をチェックしている前提
      const isSel = isMultiSel('perimeterbeam', pi);
      ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y);
      const isHighlight = (window.highlightedBeamType === 'perimeterBeam' && window.highlightedBeamIndex === pi);
      if (isHighlight) { ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 15; }
      else if (isSel) { ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 10; }
      else { ctx.strokeStyle = '#27ae60'; ctx.lineWidth = 4; }
      ctx.stroke();
      const mx = (s1.x + s2.x)/2, my = (s1.y + s2.y)/2;
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillStyle = isSel ? '#ff0000' : '#27ae60';
      ctx.textAlign = 'center'; ctx.fillText(pb.id, mx, my + 12);
    });
  }
}

/**
 * 耐力壁の描画
 */
export function drawWalls(ctx, fd, selectedElement, showWall, isSlabDivideMode) {
  if (!showWall || !fd.walls) return;
  if (isSlabDivideMode) ctx.globalAlpha = 0.1;
  fd.walls.forEach((w, wi) => {
    const n1 = fd.nodes[w.n1], n2 = fd.nodes[w.n2];
    if (!n1 || !n2) return;
    const isSel = selectedElement && selectedElement.type === 'wall' && selectedElement.index === wi;
    const sp = worldToScreen(n1.x, n1.y), ep = worldToScreen(n2.x, n2.y);
    if (isSel) {
      ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(ep.x, ep.y);
      ctx.strokeStyle = '#00BFFF'; ctx.lineWidth = 10; ctx.globalAlpha = 0.8; ctx.stroke(); ctx.globalAlpha = 1.0;
    }
    const mult = w.multiplier !== undefined ? w.multiplier : 1.0;
    const isVirtual = mult === 0;
    ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(ep.x, ep.y);
    if (isVirtual) { ctx.setLineDash([8, 5]); ctx.strokeStyle = isSel ? '#cc88ff' : 'rgba(255, 0, 255, 0.55)'; ctx.lineWidth = isSel ? 3 : 1.5; }
    else { ctx.setLineDash([]); ctx.strokeStyle = isSel ? '#ff66ff' : '#ff00ff'; ctx.lineWidth = isSel ? 6 : 4; }
    ctx.stroke(); ctx.setLineDash([]);
    const mx = (sp.x + ep.x) / 2, my = (sp.y + ep.y) / 2;
    ctx.font = 'bold 11px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const multText = isVirtual ? `通り` : `x${parseFloat(mult).toFixed(1)}`;
    const tw = ctx.measureText(multText).width;
    ctx.fillStyle = isVirtual ? 'rgba(160, 100, 200, 0.75)' : 'rgba(255,0,255,0.8)';
    ctx.fillRect(mx - tw/2 - 4, my - 8, tw + 8, 16);
    ctx.fillStyle = '#ffffff'; ctx.fillText(multText, mx, my);
  });
  ctx.globalAlpha = 1.0;
}

/**
 * ノード（交点）の描画
 */
export function drawNodes(ctx, fd, hoveredNode, isSlabDivideMode) {
  if (isSlabDivideMode) ctx.globalAlpha = 0.1;
  fd.nodes.forEach((n, ni) => {
     if (hoveredNode !== ni) return;
     const sp = worldToScreen(n.x, n.y);
     ctx.beginPath(); ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2);
     ctx.fillStyle = 'rgba(231,76,60,0.8)'; ctx.fill();
  });
  ctx.globalAlpha = 1.0;
}

/**
 * 柱の描画
 */
export function drawColumns(ctx, fd, hoveredNode, selectedElement, showCol, isSlabDivideMode) {
  const COL_SIZE = 120;
  if (!showCol) return;
  if (isSlabDivideMode) ctx.globalAlpha = 0.1;
  fd.columns.forEach((c, ci) => {
    const n = fd.nodes[c.nodeIndex];
    if (!n) return;
    const sp = worldToScreen(n.x, n.y);
    const isHovered = hoveredNode === c.nodeIndex;
    const isSel = selectedElement && selectedElement.type === 'column' && selectedElement.index === ci;
    const r = (COL_SIZE / 2) * scale;
    const padding = isSel ? 4 * scale : isHovered ? 2 * scale : 0;
    const drawR = Math.max(3, r + padding);
    ctx.beginPath(); ctx.rect(sp.x - drawR, sp.y - drawR, drawR*2, drawR*2);
    ctx.fillStyle = isSel ? '#ff4500' : '#2c3e50'; ctx.fill();
    ctx.strokeStyle = isSel ? '#fff' : 'rgba(255,255,255,1.0)'; ctx.lineWidth = isSel ? 4 : 1.5;
    ctx.stroke();
    ctx.font = 'bold 12px Inter, sans-serif'; ctx.fillStyle = '#000000'; ctx.textAlign = 'left';
    ctx.fillText(c.id, sp.x + drawR + 4, sp.y - drawR - 4);
    if (c.longTermAxial !== undefined && c.longTermAxial !== "" && c.longTermAxial !== 0) {
      const pText = `ΣP: ${parseFloat(c.longTermAxial).toFixed(1)}`;
      ctx.font = 'bold 12px Inter, sans-serif';
      const tw = ctx.measureText(pText).width, th = 14;
      const tx = sp.x + drawR + 4, ty = sp.y + drawR + 4;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.fillRect(tx, ty, tw + 8, th + 6);
      ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 1.5; ctx.strokeRect(tx, ty, tw + 8, th + 6);
      ctx.fillStyle = '#e74c3c'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(pText, tx + 4, ty + 3);
    }
  });
  ctx.globalAlpha = 1.0;
}

/**
 * システムグリッド（軸線）の描画
 */
export function drawGrid(ctx, selectedElement, showGrid) {
  if (!showGrid) return;
  let selAxis = null; if (selectedElement && selectedElement.type === 'axis') selAxis = selectedElement.index;
  dxfVAxes.forEach((a, i) => {
    const isSel = selAxis && selAxis.dir === 'v' && selAxis.index === i;
    ctx.beginPath();
    const start = worldToScreen(a.x, -50000), end = worldToScreen(a.x, 50000);
    ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = isSel ? '#e74c3c' : '#3498db'; ctx.lineWidth = isSel ? 3 : 1;
    ctx.globalAlpha = isSel ? 1.0 : 0.6; ctx.stroke();
    if (a.label) {
      const s = worldToScreen(a.x, 0); const sx = Math.max(20, Math.min(W - 20, s.x));
      const fsize = Math.max(10, Math.round(90 * scale));
      ctx.font = `${fsize}px Arial`; ctx.fillStyle = ctx.strokeStyle; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(a.label, sx, 20);
    }
  });
  dxfHAxes.forEach((a, i) => {
    const isSel = selAxis && selAxis.dir === 'h' && selAxis.index === i;
    ctx.beginPath();
    const start = worldToScreen(-50000, a.y), end = worldToScreen(50000, a.y);
    ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = isSel ? '#e74c3c' : '#3498db'; ctx.lineWidth = isSel ? 3 : 1;
    ctx.globalAlpha = isSel ? 1.0 : 0.6; ctx.stroke();
    if (a.label) {
      const s = worldToScreen(0, a.y); const sy = Math.max(20, Math.min(H - 20, s.y));
      const fsize = Math.max(10, Math.round(90 * scale));
      ctx.font = `${fsize}px Arial`; ctx.fillStyle = ctx.strokeStyle; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(a.label, 20, sy);
    }
  });

  const skewedAxesList = window.dxfSkewedAxes || dxfSkewedAxes || [];
  skewedAxesList.forEach((ax, i) => {
    const isSel = selAxis && selAxis.dir === 's' && selAxis.index === i;
    const s1 = worldToScreen(ax.p1.x, ax.p1.y), s2 = worldToScreen(ax.p2.x, ax.p2.y);
    const dx = ax.p2.x - ax.p1.x, dy = ax.p2.y - ax.p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx/len, uy = dy/len;
    const start = worldToScreen(ax.p1.x - ux * 50000, ax.p1.y - uy * 50000);
    const end = worldToScreen(ax.p2.x + ux * 50000, ax.p2.y + uy * 50000);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = isSel ? '#e74c3c' : '#27ae60';
    ctx.lineWidth = isSel ? 3 : 1.5;
    ctx.setLineDash([15, 5, 2, 5]);
    ctx.globalAlpha = isSel ? 1.0 : 0.7; ctx.stroke();
    ctx.setLineDash([]);
    if (ax.label) {
      const sp1 = worldToScreen(ax.p1.x, ax.p1.y);
      const fsize = Math.max(10, Math.round(90 * scale));
      ctx.font = `bold ${fsize}px Arial`; ctx.fillStyle = ctx.strokeStyle;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(ax.label, sp1.x, sp1.y - 10);
    }
  });

  ctx.globalAlpha = 1.0;
}

/**
 * 描画前のプレビュー（ゴムバンド）の描画
 */
export function drawPreviews(ctx, state, fd) {
  const { currentTool, beamStartNode, currentPolygon, mouseWorld } = state;
  // 多角形（スラブ・構面）
  if (currentPolygon.length > 0) {
    ctx.beginPath();
    const s0 = worldToScreen(fd.nodes[currentPolygon[0]].x, fd.nodes[currentPolygon[0]].y);
    ctx.moveTo(s0.x, s0.y);
    for (let i = 1; i < currentPolygon.length; i++) {
      const sp = worldToScreen(fd.nodes[currentPolygon[i]].x, fd.nodes[currentPolygon[i]].y);
      ctx.lineTo(sp.x, sp.y);
    }
    const sm = worldToScreen(mouseWorld.x, mouseWorld.y);
    ctx.lineTo(sm.x, sm.y);
    ctx.strokeStyle = 'rgba(167,139,250,0.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([6,3]);
    ctx.stroke(); ctx.setLineDash([]);
  }
  // 直線（梁・壁）
  if ((currentTool === 'beam' || currentTool === 'fbeam' || currentTool === 'wall') && beamStartNode !== null) {
    const n = fd.nodes[beamStartNode]; if (!n) return;
    const sp = worldToScreen(n.x, n.y), sm = worldToScreen(mouseWorld.x, mouseWorld.y);
    ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(sm.x, sm.y);
    ctx.strokeStyle = currentTool === 'wall' ? 'rgba(255,0,255,0.6)' : currentTool === 'skewedGrid' ? 'rgba(39,174,96,0.6)' : currentTool === 'fbeam' ? 'rgba(44,62,80,0.5)' : 'rgba(245,166,35,0.5)';
    ctx.lineWidth = currentTool === 'wall' ? 4 : (currentTool === 'fbeam' || currentTool === 'skewedGrid') ? 2 : 1.5;
    ctx.setLineDash([6,3]); ctx.stroke(); ctx.setLineDash([]);
  }
}

/**
 * --- 追加: 展開図方式（正対表示）用ユーティリティ ---
 */

/**
 * 特定の通り名を持つ全ての壁・梁から、通り芯の「パス（連続する線分リスト）」を構築する
 */
export function getAxisSegments(axisName) {
  const vAxis = (dxfVAxes || []).find(a => a.label === axisName);
  const hAxis = (dxfHAxes || []).find(a => a.label === axisName);
  
  // 1. グリッド通り（垂直・水平）の場合
  if (vAxis || hAxis) {
    const isV = !!vAxis;
    const coord = isV ? vAxis.x : hAxis.y;
    // 極端に長い仮想線分を1つ返す
    return [{
       p1: isV ? {x: coord, y: -100000} : {x: -100000, y: coord},
       p2: isV ? {x: coord, y: 100000} : {x: 100000, y: coord},
       isGrid: true,
       angle: isV ? Math.PI/2 : 0
    }];
  }

  // 2. 斜め壁等の非グリッド通り
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

  // 重複除去（ほぼ同じ座標のセット）
  const uniqueSegs = [];
  rawSegments.forEach(s => {
    const exists = uniqueSegs.some(u => 
      (Math.hypot(u.p1.x-s.p1.x, u.p1.y-s.p1.y)<10 && Math.hypot(u.p2.x-s.p2.x, u.p2.y-s.p2.y)<10) ||
      (Math.hypot(u.p1.x-s.p2.x, u.p1.y-s.p2.y)<10 && Math.hypot(u.p2.x-s.p1.x, u.p2.y-s.p1.y)<10)
    );
    if (!exists) uniqueSegs.push(s);
  });

  // 線分を並び替える（簡易的なソート：端点を探して順に繋ぐ）
  // ※ここでは簡単のため、XまたはYの小さい順に並べる
  const isXDirection = Math.abs(uniqueSegs[0].p1.x - uniqueSegs[0].p2.x) > Math.abs(uniqueSegs[0].p1.y - uniqueSegs[0].p2.y);
  uniqueSegs.sort((a, b) => {
    const minA = isXDirection ? Math.min(a.p1.x, a.p2.x) : Math.min(a.p1.y, a.p2.y);
    const minB = isXDirection ? Math.min(b.p1.x, b.p2.x) : Math.min(b.p1.y, b.p2.y);
    return minA - minB;
  });

  // 各セグメントの長さを計算
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
 * node がパス上にない場合は、最も近い線分への投影位置を返す
 */
export function getPosAlongPath(node, segments) {
  if (!segments || segments.length === 0) return 0;
  if (!node) return 0;

  // 1. グリッド通り（isGrid）の場合は単純投影
  if (segments[0].isGrid) {
    const s = segments[0];
    const cosA = Math.cos(s.angle), sinA = Math.sin(s.angle);
    return node.x * cosA + node.y * sinA;
  }

  // 2. 各セグメントへの投影を試み、最も近いものを探す
  let bestDist = Infinity;
  let bestL = 0;

  segments.forEach(seg => {
    const dx = seg.p2.x - seg.p1.x, dy = seg.p2.y - seg.p1.y;
    const l2 = dx*dx + dy*dy;
    if (l2 < 1) return;
    
    // 投影係数 t (点Pから始点へのベクトルと線分ベクトルの内積)
    const t = ((node.x - seg.p1.x) * dx + (node.y - seg.p1.y) * dy) / l2;
    // クランプして最短距離を算出
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
 * @returns {boolean} true: 水平寄りの軸 (X1, X2..., または横に長い連続壁), false: 垂直寄りの軸 (Y1, Y2..., または縦に長い連続壁)
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
  
  // 垂直グリッド(X軸の通り芯)との交差
  (window.dxfVAxes || dxfVAxes || []).forEach(ax => {
    segments.forEach(seg => {
      const xMin = Math.min(seg.p1.x, seg.p2.x), xMax = Math.max(seg.p1.x, seg.p2.x);
      // セグメントの X 範囲内にグリッド線があるか
      if (ax.x >= xMin - 0.1 && ax.x <= xMax + 0.1) {
        if (Math.abs(seg.p2.x - seg.p1.x) > 1) {
          const t = (ax.x - seg.p1.x) / (seg.p2.x - seg.p1.x);
          if (t >= -0.001 && t <= 1.001) {
            intersections.push({ L: seg.startL + Math.max(0, Math.min(1, t)) * seg.length, label: ax.label });
          }
        } else if (Math.abs(ax.x - seg.p1.x) < 15) {
          // 垂直なセグメント自体が垂直グリッド上にある場合
          intersections.push({ L: seg.startL, label: ax.label });
          intersections.push({ L: seg.startL + seg.length, label: ax.label });
        }
      }
    });
  });

  // 水平グリッド(Y軸の通り芯)との交差
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

  // 重複除去とソート
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
 * --- 追加: 剛体投影（単一基準角）用ユーティリティ ---
 */

/**
 * 対象通り名を構成する要素から「基準となる代表直線」を算出する（剛体投影用）
 */
export function getAxisReferenceLine(axisName) {
  if (!axisName) return null;
  const targetLabel = axisName.trim();

  // 1. グリッド通り（垂直・水平）の場合を優先してチェック
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

  // 2. 次に、手動定義された斜め通り芯をチェック
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

  // 3. 斜め壁等の非グリッド通りの場合
  const rawSegments = [];
  const floors = ['PH', 'R', '3', '2', '1'];
  floors.forEach(f => {
    const fd = (window.allFloorData && window.allFloorData[f]) || (window.floorData && window.floorData[f]) || floorData[f];
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

  // 最も長いセグメントを「代表直線」として選ぶ
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
  
  // 基準点 (p1) から node へのベクトル
  const nx = node.x - refLine.p1.x;
  const ny = node.y - refLine.p1.y;
  
  // 直線方向への内積 (=距離 L)
  const L = nx * dx + ny * dy;
  
  // 直交方向への内積 (=オフセット distance)
  // 法線ベクトルは (-dy, dx)
  const offset = nx * (-dy) + ny * dx;
  
  return { L, offset };
}

// 💡 外部モジュールからの呼び出しを確実にするためのグローバル登録
window.worldToScreen = worldToScreen;
window.screenToWorld = screenToWorld;
window.setPanScale = setPanScale;
window.fitAll = fitAll;
window.callRender = callRender;

window.getAxisSegments = getAxisSegments;
window.getPosAlongPath = getPosAlongPath;
window.getAxisPrimaryDirection = getAxisPrimaryDirection;
window.getAxisIntersections = getAxisIntersections;
window.getAxisReferenceLine = getAxisReferenceLine;
window.getProjectedPos = getProjectedPos;
