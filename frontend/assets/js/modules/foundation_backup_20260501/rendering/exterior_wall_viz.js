import { dxfSkewedAxes, getFloorBelow, floorData, currentFloor } from '../foundation_cad.js';
import { extractWallLines, judgeEffectiveWallLines, mergeAdjacentWallLines, rotatePoint } from '../core/diaphragm_skew_calc.js';

/**
 * 外壁線（外周部フラグ）の可視化レンダラー
 */
export function renderExteriorWallViz(ctx, fd, transform, selectedElement) {
  if (!fd || !fd.walls || !fd.nodes) return;

  const skewedAxisLabel = document.getElementById('vis-skewed-axis-select')?.value;
  if (skewedAxisLabel) {
    const sList = window.dxfSkewedAxes || dxfSkewedAxes || [];
    const skewedAxis = sList.find(a => a.label === skewedAxisLabel);
    if (skewedAxis) {
      const curFloorKey = window.currentFloor || currentFloor || window.state?.currentFloor || '1';
      const belowKey = getFloorBelow(curFloorKey);
      const bFd = belowKey ? (floorData[belowKey] || window.floorData?.[belowKey]) : null;

      console.log(`[SkewedViz] Cur:${curFloorKey}, Below:${belowKey}, Walls:${bFd?.walls?.length || 0}`);

      if (bFd && bFd.walls && bFd.walls.length > 0) {
        renderSkewedModelViz(ctx, fd, transform, skewedAxis, bFd, curFloorKey);
        renderSelectionOnTop(ctx, fd, transform, selectedElement);
        return;
      } else {
        console.log(`[SkewedViz] No supporting walls found below ${curFloorKey}.`);
      }
    }
  }

  ctx.save();
  
  const walls = fd.walls;
  const nodes = fd.nodes;

  // 1. 通常の壁（外壁以外）を描画
  walls.forEach((w, wi) => {
    if (!w || w.isExterior) return;
    
    // 壁倍率が0の壁（通り芯定義など）は表示不要
    if ((w.multiplier === 0 || !w.multiplier) && !w.isExterior) return;

    const n1 = nodes[w.n1];
    const n2 = nodes[w.n2];
    if (!n1 || !n2) return;

    const p1 = transform.worldToScreen(n1.x, n1.y);
    const p2 = transform.worldToScreen(n2.x, n2.y);

    // 通常壁は細い実線で表示
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)'; 
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 符号の表示（ユーザー要望：外壁以外もラベルは青光りさせる）
    if (w.id) {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      
      const label = w.id;
      ctx.font = 'bold 11px sans-serif';
      const metrics = ctx.measureText(label);
      const bgW = metrics.width + 6;
      const bgH = 15;
      
      // 背景ボックス
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(midX - bgW/2, midY - 7, bgW, bgH);
      
      // テキスト（青光り）
      ctx.save();
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#00f2ff';
      ctx.fillStyle = '#00f2ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, midX, midY + 1);
      ctx.restore();
    }
  });

  // 2. 外壁線を強調して描画
  walls.forEach((w, wi) => {
    if (!w || !w.isExterior) return;

    const n1 = nodes[w.n1];
    const n2 = nodes[w.n2];
    if (!n1 || !n2) return;

    const p1 = transform.worldToScreen(n1.x, n1.y);
    const p2 = transform.worldToScreen(n2.x, n2.y);

    // 外壁線のグロー効果
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00f2ff';
    ctx.strokeStyle = '#00f2ff';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 中央の芯（白）
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 外壁符号の強調
    if (w.id) {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      
      const label = w.id;
      ctx.font = 'bold 12px sans-serif';
      const metrics = ctx.measureText(label);
      const bgW = metrics.width + 10;
      const bgH = 18;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(midX - bgW/2, midY - 24, bgW, bgH);
      
      ctx.fillStyle = '#00f2ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(label, midX, midY - 11);
    }
  });

  ctx.restore();
}

/**
 * 斜め軸回転モデルに特化した可視化（投影された耐力壁線を表示）
 * 💡支持点となる耐力壁は「直下の階」のものを参照する
 */
export function renderSkewedModelViz(ctx, fd, transform, skewedAxis, belowFd, curFloorKey) {
  if (!belowFd || !belowFd.walls) return;
  let angleDeg = skewedAxis.angle;
  if (angleDeg === undefined && skewedAxis.p1 && skewedAxis.p2) {
    const dx = skewedAxis.p2.x - skewedAxis.p1.x;
    const dy = skewedAxis.p2.y - skewedAxis.p1.y;
    angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
  }
  // 💡 角度の同期: 斜め軸を水平(0°)にするための回転角 (-thetaDeg)
  const thetaRad = (-angleDeg * Math.PI) / 180;

  // 💡 統一計算エンジンの呼び出し (再計算による不整合を排除)
  const result = calcSkewedDiaphragmModel({
    diaphragm: { nodeIds: Array.from(new Set((fd.slabs || []).flatMap(s => s.nodeIds))) },
    nodes: fd.nodes,
    walls: belowFd.walls,
    wallNodes: belowFd.nodes,
    skewedAxis: skewedAxis,
    floorKey: curFloorKey
  });

  if (!result || !result.xDir || !result.yDir) return;

  const { outerMinX, outerMaxX, outerMinY, outerMaxY } = result;
  const extMinX = outerMinX - 1500;
  const extMaxX = outerMaxX + 1500;
  const extMinY = outerMinY - 1500;
  const extMaxY = outerMaxY + 1500;

  ctx.save();
  // 💡 背景の建物壁は「耐力壁線図」の視認性を優先するため描画しない

  const drawLines = (lineGroups, isXDir) => {
    (lineGroups || []).forEach(grp => {
        const pos = grp.pos;
        const symbol = grp.isEffective ? (grp.isExterior ? "〇" : "◎") : "×";
        
        const p1Rot = isXDir ? { x: extMinX, y: pos } : { x: pos, y: extMinY };
        const p2Rot = isXDir ? { x: extMaxX, y: pos } : { x: pos, y: extMaxY };

        // 回転座標系(aligned)からワールド座標系に戻す際は -thetaRad (つまり +thetaDeg)
        const p1 = rotatePoint(p1Rot.x, p1Rot.y, -thetaRad);
        const p2 = rotatePoint(p2Rot.x, p2Rot.y, -thetaRad);
        const s1 = transform.worldToScreen(p1.x, p1.y);
        const s2 = transform.worldToScreen(p2.x, p2.y);

        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y);

        const color = grp.isExterior ? '#00d4ff' : (grp.isEffective ? '#2ecc71' : '#ff4444');
        ctx.strokeStyle = color;
        ctx.lineWidth = grp.isEffective ? 1.5 : 0.8;
        ctx.setLineDash([10, 2, 2, 2]); // 一点鎖線
        ctx.stroke();
        ctx.setLineDash([]); 

        // ラベル描画 (計算側で決定された label をそのまま使用)
        const label = grp.label || "";
        ctx.font = "bold 11px sans-serif";
        const m = ctx.measureText(label);
        const boxW = Math.max(m.width + 10, 20);
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(s1.x - boxW/2, s1.y - 30, boxW, 25);
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(symbol, s1.x, s1.y - 22);
        ctx.font = "9px sans-serif";
        ctx.fillText(label, s1.x, s1.y - 12);
    });
  };

  drawLines(result.xDir.wallLines, true);
  drawLines(result.yDir.wallLines, false);

  ctx.restore();
}

function renderSelectionOnTop(ctx, fd, transform, selectedElement) {
    const walls = fd.walls;
    const nodes = fd.nodes;
    walls.forEach((w, wi) => {
        const isSel = selectedElement && selectedElement.type === 'wall' && selectedElement.index === wi;
        if (!isSel) return;
        const n1 = nodes[w.n1], n2 = nodes[w.n2];
        if (!n1 || !n2) return;
        const p1 = transform.worldToScreen(n1.x, n1.y), p2 = transform.worldToScreen(n2.x, n2.y);
        const pulse = Math.sin(Date.now() / 200) * 0.5 + 0.5;
        ctx.save();
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.shadowBlur = 20 + (pulse * 15); ctx.shadowColor = '#ff00ff';
        ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 10 + (pulse * 5);
        ctx.lineCap = 'round'; ctx.stroke();
        ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
        ctx.restore();
        if (!window._selectionPulseRequested) {
            window._selectionPulseRequested = true;
            requestAnimationFrame(() => {
              window._selectionPulseRequested = false;
              if (typeof window.callRender === 'function') window.callRender();
            });
        }
    });
}

window.renderExteriorWallViz = renderExteriorWallViz;
