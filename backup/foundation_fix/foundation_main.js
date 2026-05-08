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
import './svg_generator_report.js';
import { 
  floorData, FLOORS, currentFloor, setFloor, render, 
  findSnapNode, findBeamNear, findSlabAt, findDiaphragmAt, pushHistory, undo, redo,
  dxfLines, dxfTexts, dxfLayerVisibility, dxfVAxes, dxfHAxes, nextId, setDxfData
} from './foundation_cad.js';
import { setupEventHandlers } from './event_handlers.js';

// --- グローバル変数 (HTML/UIからのアクセス用) ---
window.currentFloor = currentFloor;
window.render = render;
window.state = null; // 後ほど定義

// --- アプリケーション状態 ---
let state = {
  currentTool: 'selectGrid',
  hoveredNode: null,
  selectedElement: null,     // {type:'node'|'beam'|'slab', index}
  selectedElements: [],      // 複数選択用配列 [{type, index}, ...]
  beamStartNode: null,       // node index for beam drawing
  currentPolygon: [],        // node indices for slab drawing
  isPanning: false,
  panStartMouse: {x:0, y:0},
  panStartOffset: {x:0, y:0},
  mouseWorld: {x:0, y:0},
  showGrid: true,
  showDxf: true,
  showLabels: true,
  currentListTab: 'nodes',
  viewMode: 'shape',
  defaultWallMultiplier: 1.0,
  defaultWallAxisName: ""
};

// --- 作図ツールのデフォルト設定 (初期値) ---
window.defaultProperties = {
  fbeam: {
    width: 150, depth: 640,
    topRebar: '1-D13', bottomRebar: '1-D13',
    stirrupRebar: 'D10', stirrupPitch: 200, dt: 70,
    startCondition: 'pin', endCondition: 'pin'
  },
  beam: {},
  wall: { multiplier: 1.0, axisName: "" },
  column: { nw: 0 },
  slab: { groundPressure: 30.0, triangleMultiplier: 1.33 },
  diaphragm: { Qa: 0 }
};

window.state = state;
window.floorData = floorData;
state.floorData = floorData[currentFloor]; // ユーザー支給コードとの互換性のため同期

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

// 外部からのプロパティ更新用
window.renameAxis = function(dir, idx, newName) {
   const finalName = (typeof newName !== 'undefined') ? newName : (document.getElementById('axisLabelInput')?.value || "");
    import('./foundation_cad.js').then(cad => {
       const axis = dir === 'v' ? cad.dxfVAxes[idx] : (dir === 'h' ? cad.dxfHAxes[idx] : cad.dxfSkewedAxes[idx]);
       if (!axis) return;
       axis.label = finalName;
      cad.rebuildNodeIds();
      FLOORS.forEach(f => {
        if (!floorData[f] || !floorData[f].columns) return;
        floorData[f].columns.forEach(c => {
          const nearestNodeIdx = cad.findSnapNode(c.x, c.y);
          if (nearestNodeIdx !== null) {
            c.id = (floorData[f].nodes[nearestNodeIdx] && floorData[f].nodes[nearestNodeIdx].id) ? floorData[f].nodes[nearestNodeIdx].id.replace(/_[0-9]+$/, "") : c.id;
          }
        });
      });
      window.updatePropertyPanel?.();
      window.updateDataList?.();
      callRender();
   });
};

window.deleteAxis = function(dir, idx) {
   if (!confirm('この通り芯を削除しますか？関連するノードや柱も削除される場合があります。')) return;
   import('./foundation_cad.js').then(cad => {
      cad.removeAxis(dir, idx);
      window.selectedElement = null;
      window.updatePropertyPanel?.();
      window.updateDataList?.();
      callRender();
   });
};

window.addAxisNear = function(dir, idx, dist) {
  const dVal = (typeof dist !== 'undefined') ? dist : (parseFloat(document.getElementById('axisOffsetDist')?.value || document.getElementById('addAxisOffset')?.value) || 0);
  import('./foundation_cad.js').then(cad => {
     cad.addAxis(dir, idx, dVal);
     cad.rebuildNodeIds();
     window.updatePropertyPanel?.();
     window.updateDataList?.();
     callRender();
  });
};

window.updateDefaultWallMultiplier = function(val) {
  if (state) state.defaultWallMultiplier = Math.min(7.0, Math.max(0, parseFloat(val) || 1.0));
};
