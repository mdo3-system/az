// core/history_manager.js
import { floorData, nextId, dxfVAxes, dxfHAxes, dxfSkewedAxes, dxfLayerVisibility, setFloor } from '../data/state_store.js';

export let history = [];
export let historyIndex = -1;

/**
 * 現在の状態をスナップショットとして記録する
 */
export function pushHistory() {
  const cleanFloorData = {};
  Object.keys(floorData).forEach(f => {
    const d = floorData[f];
    cleanFloorData[f] = {
      ...d,
      dxfLines: [], // 重い下絵データは除外
      dxfTexts: []
    };
  });

  const snapshot = {
    floorData: cleanFloorData,
    nextId: { ...nextId },
    dxfVAxes: [...dxfVAxes],
    dxfHAxes: [...dxfHAxes],
    dxfSkewedAxes: [...dxfSkewedAxes],
    dxfLayerVisibility: { ...dxfLayerVisibility }
  };

  const snapshotStr = JSON.stringify(snapshot);

  if (historyIndex < history.length - 1) {
    history = history.slice(0, historyIndex + 1);
  }
  history.push(snapshotStr);
  
  if (history.length > 50) {
    history.shift();
  } else {
    historyIndex++;
  }
  console.log(`[History] Saved. Index: ${historyIndex}`);
}

/**
 * Undo実行
 */
export function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    applySnapshot(JSON.parse(history[historyIndex]));
    return true;
  }
  return false;
}

/**
 * Redo実行
 */
export function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    applySnapshot(JSON.parse(history[historyIndex]));
    return true;
  }
  return false;
}

function applySnapshot(snapshot) {
    // 下絵データ（dxfLines等）を現在の状態から退避
    const currentUnderlays = {};
    Object.keys(floorData).forEach(f => {
      currentUnderlays[f] = { lines: floorData[f].dxfLines, texts: floorData[f].dxfTexts };
    });

    Object.keys(snapshot.floorData).forEach(f => {
      floorData[f] = snapshot.floorData[f];
      floorData[f].dxfLines = currentUnderlays[f].lines;
      floorData[f].dxfTexts = currentUnderlays[f].texts;
    });

    Object.assign(nextId, snapshot.nextId);

    if (snapshot.dxfVAxes) { dxfVAxes.length = 0; dxfVAxes.push(...snapshot.dxfVAxes); }
    if (snapshot.dxfHAxes) { dxfHAxes.length = 0; dxfHAxes.push(...snapshot.dxfHAxes); }
    if (snapshot.dxfSkewedAxes) { dxfSkewedAxes.length = 0; dxfSkewedAxes.push(...snapshot.dxfSkewedAxes); }
    
    if (snapshot.dxfLayerVisibility) {
        Object.keys(dxfLayerVisibility).forEach(k => delete dxfLayerVisibility[k]);
        Object.assign(dxfLayerVisibility, snapshot.dxfLayerVisibility);
    }
}
