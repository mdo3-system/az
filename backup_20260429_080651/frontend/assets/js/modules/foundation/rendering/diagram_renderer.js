// rendering/diagram_renderer.js
import { 
  worldToScreen, viewState, W, H,
  dxfVAxes, dxfHAxes, dxfSkewedAxes, dxfLayerVisibility,
  distToSegment
} from '../foundation_cad.js';

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
  const baseScale = (viewState && viewState.scale !== undefined) ? viewState.scale : 1;
  // const originalScale = 4.0 * baseScale; // Unused in original but kept for context

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

/**
 * DXFレイヤーの描画
 */
export function drawDxf(ctx, fd, isSlabDivideMode) {
  const lines = fd.dxfLines || [];
  const texts = fd.dxfTexts || [];

  // ✅ レンダリング診断ログ (データがある時だけ100回に1回出力)
  if ((lines.length > 0 || texts.length > 0) && Math.random() < 0.01) {
      console.log(`[Renderer Debug] Drawing Underlay for floor: ${window.currentFloor}. Lines: ${lines.length}, Texts: ${texts.length}`);
  }

  lines.forEach(l => {
    if (l.type && !['LINE', 'TEXT', 'MTEXT', 'POINT', 'CIRCLE', 'ARC'].includes(l.type)) return;
    if (dxfLayerVisibility[l.layer] === false) return;
    if (l.layer.toUpperCase().includes("COL") || l.layer.includes("柱")) return;

    const s1 = worldToScreen(l.x1, l.y1);
    const s2 = worldToScreen(l.x2, l.y2);
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    // 透明度を 0.15 -> 0.45 に引き上げて視認性を確保
    ctx.globalAlpha = isSlabDivideMode ? 0.1 : 0.45;
    ctx.strokeStyle = '#7f8c8d';
    ctx.lineWidth = 1.0;
    ctx.stroke();
  });

  texts.forEach(t => {
    if (dxfLayerVisibility[t.layer] === false) return;
    if (t.layer.toUpperCase().includes("COL") || t.layer.includes("柱")) return;

    const s = worldToScreen(t.x, t.y);
    ctx.globalAlpha = isSlabDivideMode ? 0.1 : 0.45;
    ctx.fillStyle = '#7f8c8d';
    const fsize = Math.max(10, Math.round(90 * (viewState?.scale || 1.0)));
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
      const cond = (sl.edgeConditions && sl.edgeConditions[i]) || 'fixed';
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
    const r = (COL_SIZE / 2) * viewState.scale;
    const padding = isSel ? 4 * viewState.scale : isHovered ? 2 * viewState.scale : 0;
    const drawR = Math.max(3, r + padding);
    ctx.beginPath(); ctx.rect(sp.x - drawR, sp.y - drawR, drawR*2, drawR*2);
    ctx.fillStyle = isSel ? '#ff4500' : '#2c3e50'; ctx.fill();
    ctx.strokeStyle = isSel ? '#fff' : 'rgba(255,255,255,1.0)'; ctx.lineWidth = isSel ? 4 : 1.5;
    ctx.stroke();
    ctx.font = 'bold 12px Inter, sans-serif'; ctx.fillStyle = '#000000'; ctx.textAlign = 'left';
    ctx.fillText(c.id, sp.x + drawR + 4, sp.y - drawR - 4);
    if (c.longTermAxial !== undefined && c.longTermAxial !== "" && c.longTermAxial !== 0) {
      const pText = `ΣP: ${parseFloat(c.longTermAxial).toFixed(3)}`;
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
      const fsize = Math.max(10, Math.round(90 * viewState.scale));
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
      const fsize = Math.max(10, Math.round(90 * viewState.scale));
      ctx.font = `${fsize}px Arial`; ctx.fillStyle = ctx.strokeStyle; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(a.label, 20, sy);
    }
  });

  const skewedAxesList = (window.dxfSkewedAxes || dxfSkewedAxes || []);
  skewedAxesList.forEach((ax, i) => {
    const isSel = selAxis && selAxis.dir === 's' && selAxis.index === i;
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
      const fsize = Math.max(10, Math.round(90 * viewState.scale));
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
