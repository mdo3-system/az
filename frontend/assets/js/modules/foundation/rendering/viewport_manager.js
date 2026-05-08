// rendering/viewport_manager.js

export let canvas = null;
export let ctx = null;
export let W = 800;
export let H = 600;

export const viewState = {
  scale: 1.0,
  panX: 0,
  panY: 0
};

export function initCanvas(el) { 
    canvas = el; 
    ctx = el.getContext('2d'); 
}

export function resizeCanvas(w, h) { 
    W = w; 
    H = h; 
    if (canvas) { 
        canvas.width = w; 
        canvas.height = h; 
    } 
}

export function setPanScale(px, py, s) { 
  viewState.panX = px; 
  viewState.panY = py; 
  viewState.scale = s; 
}

/**
 * ワールド座標からスクリーン座標へ変換
 */
export function worldToScreen(wx, wy) {
  return { 
    x: wx * viewState.scale + viewState.panX, 
    y: -wy * viewState.scale + viewState.panY 
  };
}

/**
 * スクリーン座標からワールド座標へ変換
 */
export function screenToWorld(sx, sy) {
  return { 
    x: (sx - viewState.panX) / viewState.scale, 
    y: (viewState.panY - sy) / viewState.scale 
  };
}

export function panCanvas(dx, dy) {
  setPanScale(viewState.panX + dx, viewState.panY + dy, viewState.scale);
}
