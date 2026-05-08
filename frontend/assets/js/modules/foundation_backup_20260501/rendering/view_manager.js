// rendering/view_manager.js
import { 
  canvas, ctx, W, H, viewState,
  worldToScreen, screenToWorld, setPanScale, initCanvas, resizeCanvas,
  floorData, FLOORS, currentFloor
} from '../foundation_cad.js';

import { 
  drawDxf, drawSlabs, drawDiaphragms, drawBeams, drawPreviews, drawWalls, drawNodes, drawColumns, drawGrid 
} from './diagram_renderer.js';
import { renderExteriorWallViz } from './exterior_wall_viz.js';

/**
 * キャンバス上の図形全体が収まるようにズーム・パンを調整する
 */
export const fitAll = function() {
    const wrap = document.getElementById('canvasWrap');
    const cvs = document.getElementById('cadCanvas');
    if (!cvs) return;

    const c_w = (wrap && wrap.clientWidth > 0) ? wrap.clientWidth : (cvs.width || 800);
    const c_h = (wrap && wrap.clientHeight > 0) ? wrap.clientHeight : (cvs.height || 600);
    
    const fd = (window.allFloorData && window.allFloorData[currentFloor]) || (window.floorData && window.floorData[currentFloor]) || floorData[currentFloor];
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let validCount = 0;

    // 1. ノードから範囲計算
    if (fd && fd.nodes && fd.nodes.length > 0) {
        fd.nodes.forEach(n => {
            if (!n) return;
            const nx = parseFloat(n.x), ny = parseFloat(n.y);
            if (!isFinite(nx) || !isFinite(ny)) return;
            if (nx < minX) minX = nx; if (nx > maxX) maxX = nx;
            if (ny < minY) minY = ny; if (ny > maxY) maxY = ny;
            validCount++;
        });
    }

    // 2. ノードがない場合は DXF 線分から範囲計算 (Fallback)
    if (validCount === 0) {
        const lines = fd.dxfLines || [];
        lines.forEach(l => {
            [l.x1, l.x2].forEach(x => { if (x < minX) minX = x; if (x > maxX) maxX = x; });
            [l.y1, l.y2].forEach(y => { if (y < minY) minY = y; if (y > maxY) maxY = y; });
            validCount += 2;
        });

        if (validCount > 0) {
            console.log(`[fitAll] Fitting to ${validCount} lines/nodes. Bounds: (${minX}, ${minY}) to (${maxX}, ${maxY})`);
            applyFit(minX, maxX, minY, maxY, c_w, c_h);
        } else {
            let reason = "全データ（構造ノードおよびDXF下絵）が空です。";
            console.log(`%c[fitAll SKIP] ${reason}`, "color: #e67e22; font-weight: bold;");
        }
        return;
    }

    applyFit(minX, maxX, minY, maxY, c_w, c_h);
};

function applyFit(minX, maxX, minY, maxY, c_w, c_h) {

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
    if (typeof window.callRender === 'function') {
        window.callRender();
    }
};

/**
 * 描画更新要求 (現在のアクティブな描画関数を呼び出す)
 */
export const callRender = function() {
  const cvs = document.getElementById('cadCanvas');
  const wrap = document.getElementById('canvasWrap');
  if (!cvs || !wrap) return;

  const cw = wrap.clientWidth || 800;
  const ch = wrap.clientHeight || 600;
  
  if (cvs.width !== cw || cvs.height !== ch) {
    resizeCanvas(cw, ch);
    const fd = (window.allFloorData && window.allFloorData[currentFloor]) || (window.floorData && window.floorData[currentFloor]) || floorData[currentFloor];
    if (typeof window.fitAll === 'function' && fd && fd.nodes && fd.nodes.length > 0) {
      window.fitAll();
      return; 
    }
  }

  ctx.clearRect(0, 0, cvs.width, cvs.height);

  const fd = (window.allFloorData && window.allFloorData[currentFloor]) || (window.floorData && window.floorData[currentFloor]) || floorData[currentFloor];
  if (!fd) {
    console.warn(`[callRender] Floor data not found for floor: ${currentFloor}`);
    return;
  }

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

  // ─── 下絵（DXF）の描画 ───
  if (state.showDxf !== false) {
    FLOORS.forEach(f => {
      const showUnderlay = document.getElementById(`vis-underlay-${f.toLowerCase()}`)?.checked;
      if (showUnderlay) {
        // window.floorData または import された floorData を使用
        const targetFd = (window.allFloorData && window.allFloorData[f]) || (window.floorData && window.floorData[f]) || floorData[f];
        if (targetFd) {
          drawDxf(ctx, targetFd, isSlabDivideMode);
        }
      }
    });
  }
  drawSlabs(ctx, fd, isMultiSel, showSlab);
  drawDiaphragms(ctx, fd, isMultiSel, showDiaph, isSlabDivideMode);
  drawBeams(ctx, fd, isMultiSel, showBeam, showFbeam, viewMode);
  drawPreviews(ctx, state, fd);
  drawWalls(ctx, fd, selectedElement, showWall, isSlabDivideMode);
  drawNodes(ctx, fd, hoveredNode, isSlabDivideMode);
  drawColumns(ctx, fd, hoveredNode, selectedElement, showCol, isSlabDivideMode);
  drawGrid(ctx, selectedElement, state.showGrid !== false);
  
  // ─── 外壁線の確認可視化 ───
  const showExteriorViz = document.getElementById('vis-exterior-viz')?.checked;
  if (showExteriorViz) {
    renderExteriorWallViz(ctx, fd, { worldToScreen }, selectedElement);
  }

  if (isSlabDivideMode && typeof window.drawSlabDivideOverlay === 'function') {
    window.drawSlabDivideOverlay();
  }
}

window.fitAll = fitAll;
window.callRender = callRender;

export { 
  canvas, ctx, W, H, viewState,
  worldToScreen, screenToWorld, setPanScale, initCanvas, resizeCanvas
};
