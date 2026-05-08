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
import './stress_display.js';
import { 
  floorData, FLOORS, currentFloor, setFloor, render, 
  findSnapNode, findBeamNear, findSlabAt, findDiaphragmAt, pushHistory, undo, redo,
  dxfLines, dxfTexts, dxfLayerVisibility, dxfVAxes, dxfHAxes, nextId, setDxfData,
  rebuildAllColumnIds
} from './foundation_cad.js';
import { setupEventHandlers } from './event_handlers.js';

// --- グローバル変数 (HTML/UIからのアクセス用) ---
window.currentFloor = currentFloor;
window.render = render;
window.rebuildAllColumnIds = rebuildAllColumnIds;
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
  defaultWallMultiplier: 0.0,
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
  wall: { multiplier: 0.0, axisName: "" },
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
        const oldLabel = axis.label;
        axis.label = finalName;
        
        cad.rebuildAllColumnIds();
        
        // 耐力壁の通り芯名更新 (同期)
        FLOORS.forEach(f => {
          if (floorData[f] && floorData[f].walls) {
            floorData[f].walls.forEach(w => {
              if (w.axisName === oldLabel) {
                w.axisName = finalName;
              }
            });
          }
        });
        
        window.updatePropertyPanel?.();
        window.updateDataList?.();
        cad.pushHistory();
        callRender();
    });
};


window.updateDefaultProperty = function(type, key, val) {
  if (window.defaultProperties[type]) {
    let parsed = val;
    const numericProps = ['multiplier', 'nw', 'width', 'depth', 'stirrupPitch', 'dt', 'groundPressure', 'triangleMultiplier', 'Qa'];
    if (numericProps.includes(key)) {
      parsed = parseFloat(val) || 0;
    }
    window.defaultProperties[type][key] = parsed;
    
    // state側の互換プロパティも更新
    if (type === 'wall' && key === 'multiplier') window.state.defaultWallMultiplier = parsed;
    if (type === 'wall' && key === 'axisName') window.state.defaultWallAxisName = parsed;
    
    console.log(`[DefaultProp] Updated ${type}.${key} = ${parsed}`);
  }
};

window.deleteAxis = function(dir, idx) {
    import('./foundation_cad.js').then(cad => {
      const axes = dir === 'v' ? cad.dxfVAxes : (dir === 'h' ? cad.dxfHAxes : cad.dxfSkewedAxes);
      const axis = axes[idx];
      const label = axis ? (axis.label || '無名') : '';
      
      const counts = cad.getAffectedElementsCount(dir, idx);
      let details = '';
      if (counts && counts.nodes > 0) {
        const parts = [];
        if (counts.nodes) parts.push(`節点 ${counts.nodes}個`);
        if (counts.columns) parts.push(`柱 ${counts.columns}本`);
        if (counts.beams) parts.push(`梁 ${counts.beams}本`);
        if (counts.walls) parts.push(`壁 ${counts.walls}枚`);
        if (counts.slabs) parts.push(`スラブ ${counts.slabs}枚`);
        if (counts.diaphragms) parts.push(`構面 ${counts.diaphragms}枚`);
        details = `\nこの操作により、関連する以下の要素が削除されます：\n・${parts.join('\n・')}\n`;
      }

      const msg = `通り芯「${label}」を削除しますか？${details}\nこの操作は元に戻せません（履歴で Undo は可能です）。`;
      if (!confirm(msg)) return;

      cad.removeAxis(dir, idx);
      cad.rebuildAllColumnIds(); // 軸削除後もID再構成
      
      window.state.selectedElement = null;
      window.state.selectedElements = [];
      window.updatePropertyPanel?.();
      window.updateDataList?.();
      cad.pushHistory();
      callRender();
    });
};

window.addAxisNear = function(dir, idx, dist) {
  // 文字列連結バグを防ぐため、UI入力値を即座に数値化する
  const dVal = parseFloat(dist || document.getElementById('axisOffsetDist')?.value || 0);
  if (isNaN(dVal)) {
    alert("有効な数値を入力してください。");
    return;
  }

  import('./foundation_cad.js').then(cad => {
     cad.addAxis(dir, idx, dVal);
      cad.rebuildAllColumnIds(); // 軸追加後もID再構成
      window.updatePropertyPanel?.();
      window.updateDataList?.();
      cad.pushHistory();
      callRender();
  });
};

window.updateDefaultWallMultiplier = function(val) {
  const parsed = parseFloat(val);
  if (state && !isNaN(parsed)) {
    state.defaultWallMultiplier = Math.min(7.0, Math.max(0, parsed));
  }
};

// --- JWW to DXF 変換ツール起動 ---
window.openJwwModal = function() {
  import('./ui/modal_jww.js').then(module => {
    module.showJwwModal();
  }).catch(err => {
    console.error("Failed to load JWW modal:", err);
    alert("JWW変換ツールの読み込みに失敗しました。サーバーが起動しているか確認してください。");
  });
};
