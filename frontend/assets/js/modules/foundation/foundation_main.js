import { 
  callRender, fitAll, initCanvas, resizeCanvas, setPanScale, worldToScreen, screenToWorld 
} from './rendering_helpers.js';

// --- コア機能の早期グローバル登録 ---
window.callRender = callRender;
window.fitAll = fitAll;
window.initCanvas = initCanvas;
window.resizeCanvas = resizeCanvas;
window.setPanScale = setPanScale;
window.worldToScreen = worldToScreen;
window.screenToWorld = screenToWorld;

// UIモジュールは巨大なため非同期でロードし、初期化をブロックしないようにする
const loadUI = async () => {
  try {
    const UI = await import('./foundation_ui.js');
    window.UI = UI;
    if (typeof window.onUILoaded === 'function') window.onUILoaded(UI);
  } catch (err) {
    console.error("Critical: Failed to load foundation_ui.js", err);
  }
};
loadUI();

import * as Calc from './foundation_calc.js';
import './table_generator_foundation.js';
import './report/svg_generator.js';
import './state_manager.js';
import './core/axis_manager.js';
import './events/global_bridge.js';
import './stress_display.js';
import { 
  floorData, FLOORS, currentFloor, setFloor, render, 
  findSnapNode, findBeamNear, findSlabAt, findDiaphragmAt, pushHistory, undo, redo,
  dxfLines, dxfTexts, dxfLayerVisibility, dxfVAxes, dxfHAxes, dxfSkewedAxes, nextId, setDxfData,
  rebuildAllColumnIds
} from './foundation_cad.js';
import { setupEventHandlers } from './event_handlers.js';

// --- グローバル変数 (HTML/UIからのアクセス用) ---
window.floorData = floorData;
window.currentFloor = currentFloor;
window.render = render;
window.dxfLines = dxfLines;
window.dxfTexts = dxfTexts;
window.dxfLayerVisibility = dxfLayerVisibility;
window.dxfVAxes = dxfVAxes;
window.dxfHAxes = dxfHAxes;
window.dxfSkewedAxes = dxfSkewedAxes;
window.nextId = nextId;

// 階層データのエイリアス登録
window.allFloorData = floorData;
window.rebuildAllColumnIds = rebuildAllColumnIds;
import { state, defaultProperties } from './foundation_cad.js';

// 互換性維持のためのグローバル登録
window.state = state;
window.defaultProperties = defaultProperties;
window.floorData = floorData;
window.allFloorData = floorData;
state.floorData = floorData[currentFloor]; 

window.addEventListener('DOMContentLoaded', () => {
  const canvasEl = document.getElementById('cadCanvas');
  initCanvas(canvasEl);
  
  const wrap = document.getElementById('canvasWrap');
  resizeCanvas(wrap.clientWidth, wrap.clientHeight);
  window.addEventListener('resize', () => {
    resizeCanvas(wrap.clientWidth, wrap.clientHeight);
    callRender();
  });

  setupEventHandlers(canvasEl, state);
  window.updateDataList?.();
  callRender();
});

// Note: Axis and Default property handlers have been moved to axis_manager.js and state_manager.js

// --- JWW to DXF 変換ツール起動 ---
window.openJwwModal = function() {
  import('./ui/modal_jww.js').then(module => {
    module.showJwwModal();
  }).catch(err => {
    console.error("Failed to load JWW modal:", err);
    alert("JWW変換ツールの読み込みに失敗しました。サーバーが起動しているか確認してください。");
  });
};
