// foundation_cad.js - Facade for Modularized CAD Engine

// --- Re-exports from State Store ---
export { 
  FLOORS, floorData, currentFloor, setFloor,
  dxfLines, dxfTexts, dxfLayerVisibility, dxfVAxes, dxfHAxes, dxfSkewedAxes,
  nextId, updateNextId, getFloorData, setDxfData, state, defaultProperties
} from './data/state_store.js';

// --- Re-exports from Viewport Manager ---
export { 
  canvas, ctx, W, H, viewState,
  initCanvas, resizeCanvas, setPanScale,
  worldToScreen, screenToWorld, panCanvas
} from './rendering/viewport_manager.js';

// --- Re-exports from History Manager ---
export { 
  history, historyIndex, pushHistory, undo, redo 
} from './core/history_manager.js';

// --- Re-exports from Geometry Utils ---
export {
  distToSegment, pointInPolygon, distToBeamLine
} from './core/geometry_utils.js';

// --- Re-exports from Element Finders ---
export {
  findSnapNode, findBeamNear, findWallNear, findSlabAt, findDiaphragmAt, findAxisNear
} from './core/element_finders.js';

// --- Re-exports from Grid Manager ---
export {
  removeAxis, rebuildNodeIds, rebuildAllColumnIds, findNearestAxisName, addAxis, generateNodesForSkewedAxis, getAffectedElementsCount
} from './core/grid_manager.js';

// --- Local remaining functions ---
import { render } from './rendering/view_manager.js'; 
export { render };

// repairFoundationData など、まだ移行しきれていないものはここに残すか、適宜移動
import { floorData, currentFloor, getFloorData } from './data/state_store.js';

/** 1つ下の階キーを取得する。最下階の場合は null を返す。 */
export function getFloorBelow(floorKey) {
  const FLOORS = ['PH', 'R', '3', '2', '1'];
  const idx = FLOORS.indexOf(floorKey);
  if (idx !== -1 && idx < FLOORS.length - 1) return FLOORS[idx + 1];
  return null;
}

// --- Re-exports from Data Repair ---
export { repairFoundationData } from './data/data_repair.js';

/** 現在の階層データを取得するエイリアス */
export function getCurrentFloorData() {
  return getFloorData(currentFloor);
}

// Initial history record
import { pushHistory as ph } from './core/history_manager.js';
ph();
