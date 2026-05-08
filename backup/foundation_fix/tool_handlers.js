import { 
  floorData, currentFloor, nextId, pushHistory, 
  findSnapNode, findBeamNear, findSlabAt, findDiaphragmAt, dxfSkewedAxes
} from './foundation_cad.js';
import { callRender } from './rendering_helpers.js';

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

  // 💡 削除優先順位の変更: 梁や柱など、小さい/細い要素を先に判定する
  // 以前はスラブが先に判定されていたため、梁を消そうとしてもスラブが反応してしまっていた。

  // 1. 梁の判定と削除 (通常梁・基礎梁・外周梁)
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

  // 2. 柱の判定と削除
  const colIdx = fd.columns.findIndex(c => Math.hypot(c.x - wc.x, c.y - wc.y) < 300); // 許容範囲を少し広げる
  if (colIdx !== -1) { fd.columns.splice(colIdx, 1); finishDelete(); return true; }

  // 3. 壁の判定と削除
  const wIdx = typeof cad.findWallNear === 'function' ? cad.findWallNear(wc.x, wc.y) : null;
  if (wIdx !== null) { fd.walls.splice(wIdx, 1); finishDelete(); return true; }

  // 4. スラブの判定と削除
  const sIdx = cad.findSlabAt(wc.x, wc.y);
  if (sIdx !== null) { 
    fd.slabs.splice(sIdx, 1); 
    if (typeof window.recalcAllTributaries === 'function') window.recalcAllTributaries();
    finishDelete(); 
    return true; 
  }

  // 5. 水平構面（ダイアフラム）の判定と削除
  const dIdx = typeof cad.findDiaphragmAt === 'function' ? cad.findDiaphragmAt(wc.x, wc.y) : null;
  if (dIdx !== null) { fd.diaphragms.splice(dIdx, 1); finishDelete(); return true; }

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
  // 💡 BUG FIX: perimeterBeam (外周梁) の削除対応
  else if (type === 'perimeterBeam' || type === 'perimeterbeam') {
    if (fd.perimeterBeams) fd.perimeterBeams.splice(index, 1);
  }

  // 梁削除後はスラブ荷重を再同期
  if (['beam', 'perimeterBeam', 'perimeterbeam'].includes(type)) {
    if (typeof window.syncSlabDataToBeams === 'function') window.syncSlabDataToBeams();
  }

  pushHistory();
  state.selectedElement = null;
  state.selectedElements = [];
  window.updatePropertyPanel?.();
  window.updateDataList?.();
  callRender();
}

/**
 * 選択ツール処理
 */
export function handleSelect(state, fd, wc, snapIdx, cad, isShiftOrCtrl) {
  if (state.currentTool === 'selectGrid') {
    const ax = cad.findAxisNear(wc.x, wc.y);
    if (ax !== null && !snapIdx) {
      state.selectedElement = {type:'axis', index: ax};
    } else if (snapIdx !== null) {
      state.selectedElement = {type:'node', index: snapIdx};
    } else {
      state.selectedElement = null;
    }
    state.selectedElements = [];
    window.updatePropertyPanel?.();
    callRender();
    return;
  }

  if (state.currentTool === 'selectElem') {
    const showCol = document.getElementById('vis-col')?.checked ?? true;
    const showBeam = document.getElementById('vis-beam')?.checked ?? true;
    const showFBeam = document.getElementById('vis-fbeam')?.checked ?? true;
    const showWall = document.getElementById('vis-wall')?.checked ?? true;
    const showSlab = document.getElementById('vis-slab')?.checked ?? true;
    const showDiaph = document.getElementById('vis-diaph')?.checked ?? true;

    let hit = null;
    const tolerance = 300;

    if (showCol && snapIdx !== null) {
      const colIdx = fd.columns.findIndex(c => c.nodeIndex === snapIdx);
      if (colIdx !== -1) hit = {type:'column', index: colIdx};
    }
    
    // 梁のヒット判定 (通常および基礎梁、外周梁を統合判定)
    if (!hit) {
      const bHit = cad.findBeamNear(wc.x, wc.y);
      if (bHit) hit = bHit;
    }
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
      state.selectedElement = hit;
      state.selectedElements = hit ? [hit] : [];
    }

    if (hit && !isShiftOrCtrl) {
      window.selectListItem?.(hit.type, hit.index);
    } else {
      window.updatePropertyPanel?.();
      window.updateDataList?.();
      callRender();
    }
  }
}

/**
 * 柱配置ツール処理
 */
export function handleColumnPlace(state, fd, snapIdx) {
  if (snapIdx !== null) {
    const colIdx = fd.columns.findIndex(c => c.nodeIndex === snapIdx);
    if (colIdx !== -1) {
      fd.columns.splice(colIdx, 1);
      state.selectedElement = null;
    } else {
      const n = fd.nodes[snapIdx];
      const cleanId = (n.id || "").replace(/_[0-9]+$/, "");
      const dp_col = (window.defaultProperties && window.defaultProperties['column']) || {};
      fd.columns.push({
        id: cleanId,
        x: n.x, y: n.y,
        nodeIndex: snapIdx,
        longTermAxial: 0,
        shortTermAxial: 0,
        nw: dp_col.nw !== undefined ? dp_col.nw : 0,
        biSetting: dp_col.biSetting || 'auto',
        inflectionRatio: dp_col.inflectionRatio !== undefined ? dp_col.inflectionRatio : 0.5
      });
      state.selectedElement = { type: 'column', index: fd.columns.length - 1 };
    }
    pushHistory();
    window.updatePropertyPanel?.();
    window.updateDataList?.();
    callRender();
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
      const isDuplicate = fd.beams.some(b => 
        (b.n1 === state.beamStartNode && b.n2 === snapIdx) || 
        (b.n1 === snapIdx && b.n2 === state.beamStartNode)
      );
      if (!isDuplicate) {
        if (type === 'fbeam') {
          const dp = (window.defaultProperties && window.defaultProperties['fbeam']) || (window.defaultProperties && window.defaultProperties['beam']) || {};
          fd.beams.push({ 
            id: 'FB' + nextId.beam++, 
            type: 'foundation_beam',
            n1: state.beamStartNode, 
            n2: snapIdx,
            axisName: (window.defaultProperties.wall && window.defaultProperties.wall.axisName) || (window.state && window.state.defaultWallAxisName) || '', 
            startCondition: dp.startCondition || 'pin',
            endCondition: dp.endCondition || 'pin',
            width: dp.width || 300,
            depth: dp.depth || 640,
            topRebar: dp.topRebar || '2-D16',
            bottomRebar: dp.bottomRebar || '2-D16',
            stirrupRebar: dp.stirrupRebar || 'D10',
            stirrupPitch: dp.stirrupPitch || 200,
            dt: dp.dt || 70,
            groundPressure: 0,
            tributaryWidth: 0
          });
        } else {
          fd.beams.push({ id: 'B' + nextId.beam++, n1: state.beamStartNode, n2: snapIdx });
        }
        state.selectedElement = { type: 'beam', index: fd.beams.length - 1 };
        pushHistory();
        window.updatePropertyPanel?.();
        window.updateDataList?.();
      }
      // 💡 継続入力モード: 次の始点として現在の終点をセット
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
  const colExists = fd.columns.some(c => c.nodeIndex === snapIdx);
  if (!colExists) return;
  
  if (state.beamStartNode === null) {
    state.beamStartNode = snapIdx;
  } else {
    if (state.beamStartNode !== snapIdx) {
      if (!fd.walls) fd.walls = [];
      const isDuplicate = fd.walls.some(w => 
        (w.n1 === state.beamStartNode && w.n2 === snapIdx) || 
        (w.n1 === snapIdx && w.n2 === state.beamStartNode)
      );
      if (!isDuplicate) {
        const dpw = (window.defaultProperties && window.defaultProperties['wall']) || {};
        const mult = dpw.multiplier !== undefined ? dpw.multiplier : (state.defaultWallMultiplier || 1.0);
        const axis = dpw.axisName || state.defaultWallAxisName || "";
        const nWall = { 
            id: 'W' + nextId.wall++, 
            type: 'wall', 
            n1: state.beamStartNode, 
            n2: snapIdx, 
            multiplier: mult,
            axisName: axis
        };
        fd.walls.push(nWall);
        window.calculateWallProps?.(nWall, fd.nodes);
        state.selectedElement = { type: 'wall', index: fd.walls.length - 1 };
        pushHistory();
        window.updatePropertyPanel?.();
        window.updateDataList?.();
      }
      // 💡 継続入力モード: 次の始点として現在の終点をセット
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
  if (state.currentPolygon.length < 3) {
    state.currentPolygon = [];
    callRender();
    return;
  }
  if (state.currentTool === 'slab') {
    const ds = window.defaultSlabSettings || {};
    fd.slabs.push({ 
      id: 'SL' + nextId.slab++, 
      nodeIds: [...state.currentPolygon], 
      supportCondition: ds.supportCondition || '4辺固定', 
      groundPressure: 0,
      ft: ds.ft || 195,
      shortRebar: ds.shortRebar || 'D13',
      shortPitch: ds.shortPitch || 150,
      longRebar: ds.longRebar || 'D13',
      longPitch: ds.longPitch || 300,
      t: ds.t || 150,
      D: ds.t || 150
    });
    state.selectedElement = {type:'slab', index: fd.slabs.length - 1};
    window.recalcAllTributaries?.();
  } else if (state.currentTool === 'diaphragm') {
    if (!fd.diaphragms) fd.diaphragms = [];
    const ndia = { 
      id: 'D' + nextId.diaphragm++, 
      nodeIds: [...state.currentPolygon],
      Qa: 0
    };
    fd.diaphragms.push(ndia);
    state.selectedElement = {type:'diaphragm', index: fd.diaphragms.length - 1};
    window.calculateDiaphragmProps?.(ndia, fd.nodes, fd.walls);
  }
  pushHistory();
  window.updatePropertyPanel?.();
  window.updateDataList?.();
  state.currentPolygon = [];
  callRender();
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
        dxfSkewedAxes.push({
          p1: { x: n1.x, y: n1.y },
          p2: { x: n2.x, y: n2.y },
          label: `G${dxfSkewedAxes.length + 1}`
        });
        state.selectedElement = { type: 'axis', index: { dir: 's', index: dxfSkewedAxes.length - 1 } };
        pushHistory();
        window.updatePropertyPanel?.();
      }
      state.beamStartNode = null;
    } else {
      state.beamStartNode = null;
    }
  }
  callRender();
}

/**
 * ホバー・スナップ処理 (MouseMove)
 */
export function handleMouseHover(state, fd, wc, cad) {
  state.mouseWorld = wc;
  state.hoveredNode = state.currentTool === 'column' 
    ? cad.findSnapNode(wc.x, wc.y, 300) 
    : cad.findSnapNode(wc.x, wc.y);

  const indicator = document.getElementById('snapIndicator');
  if (state.hoveredNode !== null && indicator) {
    const n = fd.nodes[state.hoveredNode];
    const sp = cad.worldToScreen(n.x, n.y);
    indicator.style.display = 'block';
    indicator.style.left = sp.x + 'px';
    indicator.style.top = sp.y + 'px';
  } else if (indicator) {
    indicator.style.display = 'none';
  }

  const hud = document.getElementById('canvasHud');
  if (hud) {
    hud.textContent = `X: ${wc.x.toFixed(0)}  Y: ${wc.y.toFixed(0)}  |  Scale: ${cad.scale.toFixed(3)}`;
  }

  if (state.currentTool === 'beam' && state.beamStartNode !== null) callRender();
  if ((state.currentTool === 'slab' || state.currentTool === 'diaphragm') && state.currentPolygon.length > 0) callRender();
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
