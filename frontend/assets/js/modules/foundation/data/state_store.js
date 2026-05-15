// data/state_store.js

export const FLOORS = ['PH', 'R', '3', '2', '1'];

// 階別データストアの初期化
export const floorData = {};
FLOORS.forEach(f => {
  floorData[f] = {
    nodes: [],   
    columns: [], 
    beams: [],   
    slabs: [],   
    diaphragms: [], 
    walls: [], 
    anchorBolts: {}, 
    floorHeight: 2730, 
    dxfLines: [], 
    dxfTexts: [], 
  };
});

// 1階（基礎）データにグローバル設定を初期保持
floorData['1'].globalDiaphragmSpecs = {
  'PH': { roof: 1.96, floor: 7.84 },
  'R':  { roof: 1.96, floor: 7.84 },
  '3':  { roof: 1.96, floor: 7.84 },
  '2':  { roof: 1.96, floor: 7.84 },
  '1':  { roof: 1.96, floor: 7.84 }
};

export let currentFloor = '1';

export function setFloor(f) {
    currentFloor = f;
}

// DXF表示用データの状態
export let dxfLines = [];
export let dxfTexts = [];
export let dxfLayerVisibility = {};
export let dxfVAxes = [];
export let dxfHAxes = [];
export let dxfSkewedAxes = []; 

// 採番用カウンター
export let nextId = { node: 1, beam: 1, slab: 1, diaphragm: 1, wall: 1 };

// --- UI 状態オブジェクト (初期値) ---
export const state = {
  currentTool: 'selectElem',
  hoveredNode: null,
  selectedElement: null,     // {type:'node'|'beam'|'slab'|..., index}
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
  showNw: false,             // 💡 Nw表示フラグ
  showColumnId: true,        // 💡 柱符号表示フラグ
  currentListTab: 'nodes',
  viewMode: 'shape',
  defaultWallMultiplier: 0.0,
  defaultWallAxisName: ""
};

// --- 作図ツールのデフォルト設定 (初期値) ---
export const defaultProperties = {
  fbeam: {
    id: "FG1",
    width: 200,
    depth: 600,
    topRebar: "1-D13",
    bottomRebar: "1-D13",
    stirrupRebar: "D10",
    stirrupPitch: 200,
    dt: 70
  },
  beam: {
    id: "G1",
    width: 120,
    depth: 300
  },
  wall: {
    multiplier: 1.0,
    axisName: ""
  },
  slab: {
    id: "S1",
    thickness: 150,
    rebarX: "D10@200",
    rebarY: "D10@200"
  }
};

window.state = state;
window.defaultProperties = defaultProperties;

export function updateNextId(val) {
  if (val && typeof val === 'object') {
    Object.assign(nextId, val);
  }
}

/**
 * DXFデータの一括更新
 */
export function setDxfData(lines, texts, visibility, vAxes, hAxes, sAxes) {
  // 配列の内容を入れ替え（参照を維持）
  dxfLines.length = 0;
  if (lines) lines.forEach(l => dxfLines.push(l));

  dxfTexts.length = 0;
  if (texts) texts.forEach(t => dxfTexts.push(t));

  // オブジェクトの内容を入れ替え
  for (let key in dxfLayerVisibility) delete dxfLayerVisibility[key];
  if (visibility) Object.assign(dxfLayerVisibility, visibility);

  dxfVAxes.length = 0;
  if (vAxes) vAxes.forEach(a => dxfVAxes.push(a));

  dxfHAxes.length = 0;
  if (hAxes) hAxes.forEach(a => dxfHAxes.push(a));

  dxfSkewedAxes.length = 0;
  if (sAxes) sAxes.forEach(a => dxfSkewedAxes.push(a));
}

/**
 * 階層別データの取得（ヘルパー）
 */
export function getFloorData(f = currentFloor) {
    return floorData[f];
}
