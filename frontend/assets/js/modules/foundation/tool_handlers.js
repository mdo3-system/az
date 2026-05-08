import { 
  floorData, currentFloor, nextId, pushHistory, 
  findSnapNode, findBeamNear, findSlabAt, findDiaphragmAt, dxfSkewedAxes,
  removeAxis, findNearestAxisName, generateNodesForSkewedAxis
} from './foundation_cad.js';
import { callRender } from './rendering_helpers.js';
import { 
  normalizeWall, normalizeColumn, normalizeBeam, 
  normalizeSlab, normalizeDiaphragm 
} from './data/data_normalizer.js';

/**
 * 削除ツール処理
 */
export async function handleDelete(state, fd, wc, cad) {
  const finishDelete = () => {
    pushHistory();
    state.selectedElement = null;
    state.selectedElements = [];
    window.updatePropertyPanel?.();
    window.updateDataList?.();
    callRender();
  };

  const colIdx = fd.columns.findIndex(c => {
    const n = fd.nodes[c.nodeIndex];
    return n && Math.hypot(n.x - wc.x, n.y - wc.y) < 300;
  });
  if (colIdx !== -1) { fd.columns.splice(colIdx, 1); finishDelete(); return true; }

  const bHit = cad.findBeamNear(wc.x, wc.y);
  if (bHit !== null) {
    if (bHit.type === 'perimeterBeam' || bHit.type === 'perimeterbeam') {
      if (fd.perimeterBeams) fd.perimeterBeams.splice(bHit.index, 1);
    } else if (bHit.type === 'beam' || bHit.type === 'beams') {
      if (fd.beams) fd.beams.splice(bHit.index, 1);
    } else if (fd[bHit.type]) {
      fd[bHit.type].splice(bHit.index, 1);
    }
    if (typeof window.syncSlabDataToBeams === 'function') window.syncSlabDataToBeams();
    finishDelete();
    return true;
  }

  const wIdx = typeof cad.findWallNear === 'function' ? cad.findWallNear(wc.x, wc.y) : null;
  if (wIdx !== null) { fd.walls.splice(wIdx, 1); finishDelete(); return true; }

  const sIdx = cad.findSlabAt(wc.x, wc.y);
  if (sIdx !== null) { 
    fd.slabs.splice(sIdx, 1); 
    if (typeof window.recalcAllTributaries === 'function') window.recalcAllTributaries();
    finishDelete(); 
    return true; 
  }

  const dIdx = typeof cad.findDiaphragmAt === 'function' ? cad.findDiaphragmAt(wc.x, wc.y) : null;
  if (dIdx !== null) { fd.diaphragms.splice(dIdx, 1); finishDelete(); return true; }

  const axHit = typeof cad.findAxisNear === 'function' ? cad.findAxisNear(wc.x, wc.y) : null;
  if (axHit !== null) {
      removeAxis(axHit.dir, axHit.index);
      finishDelete();
      return true;
  }
  return false;
}

/**
 * 選択中要素の削除 (Deleteキー用)
 */
export function handleDeleteSelected(state, fd) {
  if (!state.selectedElement) return;
  const { type, index } = state.selectedElement;
  if (type === 'column') fd.columns.splice(index, 1);
  else if (type === 'beam') fd.beams.splice(index, 1);
  else if (type === 'slab') { fd.slabs.splice(index, 1); if (typeof window.recalcAllTributaries === 'function') window.recalcAllTributaries(); }
  else if (type === 'diaphragm') fd.diaphragms.splice(index, 1);
  else if (type === 'wall') fd.walls.splice(index, 1);
  else if (type === 'axis' && index && index.dir) {
      removeAxis(index.dir, index.index);
  }
  else if ((type === 'perimeterBeam' || type === 'perimeterbeam') && fd.perimeterBeams) {
    fd.perimeterBeams.splice(index, 1);
  }

  if (['beam', 'perimeterBeam', 'perimeterbeam'].includes(type)) {
    if (typeof window.syncSlabDataToBeams === 'function') window.syncSlabDataToBeams();
  }

  pushHistory();
  state.selectedElement = null; state.selectedElements = [];
  window.updatePropertyPanel?.(); window.updateDataList?.();
  callRender();
}

/**
 * 選択ツール処理
 */
export function handleSelect(state, fd, wc, snapIdx, cad, isShiftOrCtrl) {
  if (state.currentTool === 'selectGrid') {
    const axResult = cad.findAxisNear(wc.x, wc.y);
    if (axResult !== null) {
      let axData = null;
      if (axResult.dir === 'v') axData = (window.dxfVAxes || [])[axResult.index];
      else if (axResult.dir === 'h') axData = (window.dxfHAxes || [])[axResult.index];
      else if (axResult.dir === 's') axData = (window.dxfSkewedAxes || [])[axResult.index];
      state.selectedElement = { type: 'axis', index: axResult, data: axData };
    } else if (snapIdx !== null) {
      state.selectedElement = {type:'node', index: snapIdx};
    } else {
      state.selectedElement = null;
    }
    state.selectedElements = [];
    window.updatePropertyPanel?.(); callRender(); return;
  }

  if (state.currentTool === 'selectElem') {
    const showCol = document.getElementById('vis-col')?.checked ?? true;
    const showBeam = document.getElementById('vis-beam')?.checked ?? true;
    const showWall = document.getElementById('vis-wall')?.checked ?? true;
    const showSlab = document.getElementById('vis-slab')?.checked ?? true;
    const showDiaph = document.getElementById('vis-diaph')?.checked ?? true;

    let hit = null;
    const tolerance = 300;

    if (showCol && snapIdx !== null) {
      const colIdx = fd.columns.findIndex(c => c.nodeIndex === snapIdx);
      if (colIdx !== -1) hit = {type:'column', index: colIdx};
    }
    if (!hit) hit = cad.findBeamNear(wc.x, wc.y);
    if (!hit && showWall && fd.walls) {
      for (let i = fd.walls.length - 1; i >= 0; i--) {
        const w = fd.walls[i];
        const n1 = fd.nodes[w.n1], n2 = fd.nodes[w.n2];
        if (!n1 || !n2) continue;
        const l2 = (n1.x - n2.x)**2 + (n1.y - n2.y)**2;
        let t_hat = (l2 > 0) ? Math.max(0, Math.min(1, ((wc.x - n1.x) * (n2.x - n1.x) + (wc.y - n1.y) * (n2.y - n1.y)) / l2)) : 0;
        if (Math.hypot(wc.x - (n1.x + t_hat * (n2.x - n1.x)), wc.y - (n1.y + t_hat * (n2.y - n1.y))) < tolerance) { hit = {type:'wall', index: i}; break; }
      }
    }
    if (!hit && showSlab) {
      const sIdx = cad.findSlabAt(wc.x, wc.y);
      if (sIdx !== null) hit = {type:'slab', index: sIdx};
    }
    if (!hit && showDiaph) {
      const dIdx = typeof cad.findDiaphragmAt === 'function' ? cad.findDiaphragmAt(wc.x, wc.y) : null;
      if (dIdx !== null) hit = {type:'diaphragm', index: dIdx};
    }

    if (hit && isShiftOrCtrl) {
      const exists = state.selectedElements.findIndex(el => el.type === hit.type && el.index === hit.index);
      if (exists !== -1) state.selectedElements.splice(exists, 1); else state.selectedElements.push(hit);
      state.selectedElement = state.selectedElements.length > 0 ? state.selectedElements[state.selectedElements.length - 1] : null;
    } else {
      state.selectedElement = hit; state.selectedElements = hit ? [hit] : [];
    }

    if (hit && !isShiftOrCtrl) window.selectListItem?.(hit.type, hit.index);
    else { window.updatePropertyPanel?.(); window.updateDataList?.(); callRender(); }
  }
}

/**
 * 柱配置ツール処理
 */
export function handleColumnPlace(state, fd, snapIdx) {
  if (snapIdx !== null) {
    const colIdx = fd.columns.findIndex(c => c.nodeIndex === snapIdx);
    if (colIdx !== -1) {
      state.selectedElement = { type: 'column', index: colIdx };
    } else {
      const n = fd.nodes[snapIdx];
      fd.columns.push(normalizeColumn({ id: (n.id || "").replace(/_[0-9]+$/, ""), nodeIndex: snapIdx }));
      state.selectedElement = { type: 'column', index: fd.columns.length - 1 };
    }
    pushHistory(); window.updatePropertyPanel?.(); window.updateDataList?.(); callRender();
  }
}

/**
 * 梁・基礎梁作図ツール処理
 */
export function handleBeamDraw(state, fd, snapIdx, type = 'beam') {
  if (snapIdx === null) return;
  if (state.beamStartNode === null) {
    state.beamStartNode = snapIdx;
  } else {
    if (state.beamStartNode !== snapIdx) {
      const isDuplicate = fd.beams.some(b => (b.n1 === state.beamStartNode && b.n2 === snapIdx) || (b.n1 === snapIdx && b.n2 === state.beamStartNode));
      if (!isDuplicate) {
        if (type === 'fbeam') {
          const dp = (window.defaultProperties && window.defaultProperties['fbeam']) || {};
          fd.beams.push(normalizeBeam({ 
            id: 'FB' + nextId.beam++, 
            type: 'foundation_beam',
            n1: state.beamStartNode, 
            n2: snapIdx, 
            depth: dp.depth || 600, 
            width: dp.width || 150 
          }));
        } else {
          fd.beams.push(normalizeBeam({ id: 'B' + nextId.beam++, n1: state.beamStartNode, n2: snapIdx }));
        }
        state.selectedElement = { type: 'beam', index: fd.beams.length - 1 };
        pushHistory(); window.updatePropertyPanel?.(); window.updateDataList?.();
      }
      state.beamStartNode = snapIdx;
    } else {
      state.beamStartNode = null;
    }
  }
  callRender();
}

/**
 * 壁作図ツール処理
 */
export function handleWallDraw(state, fd, snapIdx) {
  if (snapIdx === null) return;
  if (state.beamStartNode === null) {
    state.beamStartNode = snapIdx;
  } else {
    if (state.beamStartNode !== snapIdx) {
      const n1 = fd.nodes[state.beamStartNode], n2 = fd.nodes[snapIdx];
      const autoAxis = findNearestAxisName((n1.x + n2.x) / 2, (n1.y + n2.y) / 2);
      fd.walls.push(normalizeWall({ id: 'W' + nextId.wall++, n1: state.beamStartNode, n2: snapIdx, multiplier: state.defaultWallMultiplier ?? 0, axisName: state.defaultWallAxisName || autoAxis || "" }));
      state.selectedElement = { type: 'wall', index: fd.walls.length - 1 };
      pushHistory(); window.updatePropertyPanel?.(); window.updateDataList?.();
      state.beamStartNode = snapIdx;
    } else {
      state.beamStartNode = null;
    }
  }
  callRender();
}

/**
 * スラブ・剛床頂点追加
 */
export function handleSlabDraw(state, snapIdx) {
  if (snapIdx === null) return;
  if (state.currentPolygon.length > 0 && snapIdx === state.currentPolygon[0]) {
    finishPolygon(state, floorData[currentFloor]);
  } else {
    if (!state.currentPolygon.includes(snapIdx)) state.currentPolygon.push(snapIdx);
  }
  callRender();
}

/**
 * ポリゴン確定
 */
export function finishPolygon(state, fd) {
  if (state.currentPolygon.length < 3) { state.currentPolygon = []; callRender(); return; }
  if (state.currentTool === 'slab') {
    fd.slabs.push(normalizeSlab({ id: 'SL' + nextId.slab++, nodeIds: [...state.currentPolygon] }));
    state.selectedElement = {type:'slab', index: fd.slabs.length - 1};
    window.recalcAllTributaries?.();
  } else if (state.currentTool === 'diaphragm') {
    if (!fd.diaphragms) fd.diaphragms = [];
    fd.diaphragms.push(normalizeDiaphragm({ id: 'D' + nextId.diaphragm++, nodeIds: [...state.currentPolygon] }));
    state.selectedElement = {type:'diaphragm', index: fd.diaphragms.length - 1};
  }
  pushHistory(); window.updatePropertyPanel?.(); window.updateDataList?.(); state.currentPolygon = []; callRender();
}

/**
 * 斜め通り芯作図ツール処理
 */
export function handleSkewedAxisDraw(state, snapIdx) {
  if (snapIdx === null) return;
  if (state.beamStartNode === null) {
    state.beamStartNode = snapIdx;
  } else {
    if (state.beamStartNode !== snapIdx) {
      const fd = floorData[currentFloor];
      const n1 = fd.nodes[state.beamStartNode], n2 = fd.nodes[snapIdx];
      if (n1 && n2) {
        dxfSkewedAxes.push({ p1: { x: n1.x, y: n1.y }, p2: { x: n2.x, y: n2.y }, label: `G${dxfSkewedAxes.length + 1}` });
        generateNodesForSkewedAxis(dxfSkewedAxes[dxfSkewedAxes.length - 1]);
        state.selectedElement = { type: 'axis', index: { dir: 's', index: dxfSkewedAxes.length - 1 } };
        pushHistory(); window.updatePropertyPanel?.();
      }
      state.beamStartNode = null;
    } else {
      state.beamStartNode = null;
    }
  }
  callRender();
}

/**
 * ホバー・スナップ処理
 */
export function handleMouseHover(state, fd, wc, cad) {
  state.mouseWorld = wc;
  state.hoveredNode = state.currentTool === 'column' ? cad.findSnapNode(wc.x, wc.y, 300) : cad.findSnapNode(wc.x, wc.y);
  const indicator = document.getElementById('snapIndicator');
  if (state.hoveredNode !== null && indicator) {
    const n = fd.nodes[state.hoveredNode], sp = cad.worldToScreen(n.x, n.y);
    indicator.style.display = 'block'; indicator.style.left = sp.x + 'px'; indicator.style.top = sp.y + 'px';
  } else if (indicator) indicator.style.display = 'none';
  const hud = document.getElementById('canvasHud');
  if (hud) hud.textContent = `X: ${wc.x.toFixed(0)}  Y: ${wc.y.toFixed(0)}  |  Scale: ${cad.viewState.scale.toFixed(3)}`;
  if ((state.currentTool === 'beam' && state.beamStartNode !== null) || (['slab','diaphragm'].includes(state.currentTool) && state.currentPolygon.length > 0)) callRender();
}

// グローバル登録
window.handleDelete = handleDelete;
window.handleSelect = handleSelect;
window.handleColumnPlace = handleColumnPlace;
window.handleBeamDraw = handleBeamDraw;
window.handleWallDraw = handleWallDraw;
window.handleSkewedAxisDraw = handleSkewedAxisDraw;
window.handleSlabDraw = handleSlabDraw;
window.finishPolygon = finishPolygon;
window.handleMouseHover = handleMouseHover;
window.handleDeleteSelected = handleDeleteSelected;
