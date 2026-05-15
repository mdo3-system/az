// events/main_setup.js
import { 
  floorData, FLOORS, currentFloor, setFloor, render, 
  findSnapNode, findBeamNear, findSlabAt, findDiaphragmAt, pushHistory, undo, redo,
  dxfLines, dxfTexts, dxfLayerVisibility, dxfVAxes, dxfHAxes, dxfSkewedAxes, nextId, updateNextId, setDxfData, getCurrentFloorData, repairFoundationData
} from '../foundation_cad.js';
import { parseDxfFile } from '../foundation_dxf.js';
import { callRender, fitAll } from '../rendering_helpers.js';
import { handleMouseHover, finishPolygon, handleSlabDraw, handleSkewedAxisDraw, handleWallDraw, handleBeamDraw, handleColumnPlace, handleSelect, handleDeleteSelected, handleDelete } from '../tool_handlers.js';
import { recalcAllTributaries } from '../core/data_synchronizer.js';

// バックエンドURL
const API_BASE_URL = (window.location.protocol === 'file:' || window.location.port !== '8000')
    ? 'http://127.0.0.1:8000'
    : window.location.origin;

export function updateLayerCheckboxes() {
  const container = document.getElementById('layerControlContainer');
  if (!container) return;
  container.innerHTML = '';
  const layerNames = Object.keys(dxfLayerVisibility).sort();
  const gridLayers = layerNames.filter(l => l.toUpperCase().includes('GRID') || l.toUpperCase().includes('GLID'));
  const otherLayers = layerNames.filter(l => !gridLayers.includes(l));
  const addRow = (l, isGrid = false) => {
    const row = document.createElement('div');
    row.className = 'prop-row';
    row.innerHTML = `<input type="checkbox" id="layer_${l}" ${dxfLayerVisibility[l]!==false?'checked':''}><label for="layer_${l}" style="font-size:10px;">${isGrid?'通り芯 (GLID/GRID)':l}</label>`;
    row.querySelector('input').addEventListener('change', e => {
      if(isGrid) gridLayers.forEach(gl => dxfLayerVisibility[gl] = e.target.checked);
      else dxfLayerVisibility[l] = e.target.checked;
      callRender();
    });
    container.appendChild(row);
  };
  if (gridLayers.length > 0) addRow('grid_group', true);
  otherLayers.forEach(l => addRow(l));
}

export function updateUnderlayCheckboxes(underlayVisibility = null) {
  FLOORS.forEach(f => {
    const cb = document.getElementById(`vis-underlay-${f.toLowerCase()}`);
    if (!cb) return;
    if (underlayVisibility && underlayVisibility[f] !== undefined) {
      cb.checked = underlayVisibility[f];
    } else {
      const hasDxf = floorData[f] && floorData[f].dxfLines && floorData[f].dxfLines.length > 0;
      cb.checked = hasDxf;
    }
  });
}

/**
 * UI 設定とイベント登録
 */
export const setupEventHandlers = function(canvas, state) {
  window.state = state || window.state || { currentTool: 'selectElem', selectedElements: [], currentPolygon: [] };
  
  window.floorData = floorData;
  window.currentFloor = currentFloor;

  // --- Toolbar Events ---
  document.getElementById('btnUndo')?.addEventListener('click', () => { 
    if(undo()) { state.selectedElement = null; state.selectedElements = []; window.updateDataList?.(); window.updatePropertyPanel?.(); callRender(); } 
  });
  document.getElementById('btnRedo')?.addEventListener('click', () => { 
    if(redo()) { state.selectedElement = null; state.selectedElements = []; window.updateDataList?.(); window.updatePropertyPanel?.(); callRender(); } 
  });

  // --- Display Toggles ---
  document.getElementById('showGrid')?.addEventListener('change', e => { 
    state.showGrid = e.target.checked; 
    callRender(); 
  });
  document.getElementById('showDxf')?.addEventListener('change', e => { 
    state.showDxf = e.target.checked; 
    callRender(); 
  });
  document.getElementById('showLabels')?.addEventListener('change', e => { 
    state.showLabels = e.target.checked; 
    callRender(); 
  });
  document.getElementById('viewMode')?.addEventListener('change', e => { 
    state.viewMode = e.target.value; 
    callRender(); 
  });

  // --- Floor Tabs ---
  document.querySelectorAll('#floorTabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.dataset.floor) return;
      document.querySelector('#floorTabs button.active')?.classList.remove('active');
      btn.classList.add('active');
      setFloor(btn.dataset.floor);
      window.currentFloor = btn.dataset.floor; 
      
      const floorInput = document.getElementById('floorHeight');
      if (floorInput) floorInput.value = floorData[currentFloor].floorHeight || 2730;
      state.selectedElement = null;
      state.beamStartNode = null;
      state.currentPolygon = [];
      updateLayerCheckboxes();
      window.updatePropertyPanel?.();
      window.updateDataList?.();
      if (typeof recalcAllTributaries === 'function') recalcAllTributaries();
      setTimeout(() => callRender(), 50);
    });
  });

  // --- Tool Selection ---
  const setTool = (t) => {
    state.currentTool = t;
    document.querySelectorAll('#toolGroup .tool-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`#toolGroup .tool-btn[data-tool="${t}"]`)?.classList.add('active');
    canvas.style.cursor = (t === 'selectGrid' || t === 'selectElem') ? 'default' : t === 'delete' ? 'not-allowed' : 'crosshair';
    state.beamStartNode = null; state.currentPolygon = []; state.selectedElement = null; state.selectedElements = [];
    window.updatePropertyPanel?.();
    callRender();
  };
  document.querySelectorAll('#toolGroup .tool-btn').forEach(btn => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  // 初期ツールの反映 (カーソル形状、ボタンのactiveクラス等)
  if (state.currentTool) {
    setTool(state.currentTool);
  }

  // --- Multi-Floor Merge & Analyze Flow ---
  const floors = ['1f', '2f', '3f', 'ph'];
  
  // 💡 JS側でクリックイベントを確実に紐付け (HTMLのonclickを補完)
  floors.forEach(f => {
    const item = document.getElementById(`dxf-input-${f}`)?.closest('.floor-upload-item');
    if (item) {
      item.addEventListener('click', () => {
        console.log(`[DXF Selection] Item clicked for ${f}`);
        document.getElementById(`dxf-input-${f}`)?.click();
      });
    }

    document.getElementById(`dxf-input-${f}`)?.addEventListener('change', e => {
      const file = e.target.files[0];
      console.log(`[DXF Selection] File changed for ${f}:`, file?.name);
      const statusEl = document.getElementById(`status-${f}`);
      if (statusEl && file) {
        statusEl.textContent = '✓ ' + file.name;
        statusEl.style.color = 'var(--success)';
      }
    });
  });

  document.getElementById('btnMergeFloors')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnMergeFloors');
    const input1f = document.getElementById('dxf-input-1f');
    if (!input1f || !input1f.files[0]) {
      alert("1F平面図は必須です。");
      return;
    }

    const formData = new FormData();
    floors.forEach(f => {
      const input = document.getElementById(`dxf-input-${f}`);
      if (input && input.files[0]) formData.append(`file_${f}`, input.files[0]);
    });

    const originalText = btn.textContent;
    btn.disabled = true; btn.textContent = "⌛ 統合・解析中...";

    try {
      console.log(`[Step 1] Fetching merged DXF from backend...`);
      const response = await fetch(`${API_BASE_URL}/api/v1/merge-floors`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`結合処理に失敗しました (HTTP ${response.status})`);

      const blob = await response.blob();
      const file = new File([blob], `merged_structural_${Date.now()}.dxf`, { type: "application/dxf" });
      
      const { parseDxfFile } = await import('../foundation_dxf.js');

      console.log(`[Step 2] Parsing merged DXF...`);
      parseDxfFile(file, false, (err) => {
          if (err) {
              console.error("Parse error:", err);
              alert("統合DXFの解析中にエラーが発生しました。");
          } else {
              console.log("[Step 3] Success!");
              updateUnderlayCheckboxes();
              updateLayerCheckboxes();
              window.updatePropertyPanel?.();
              window.updateDataList?.();
              window.fitAll?.();
              
              // 全データの正規化と符号再生成
              import('../data/data_normalizer.js').then(({ normalizeAllFloors }) => {
                  normalizeAllFloors(floorData);
                  if (typeof window.rebuildAllColumnIds === 'function') window.rebuildAllColumnIds();
                  pushHistory();
                  callRender();
              });
          }
          btn.disabled = false; btn.textContent = originalText;
      });

    } catch (err) {
      console.error(err);
      alert(err.message);
      btn.disabled = false; btn.textContent = originalText;
    }
  });

  // --- JSON Save / Load ---
  document.getElementById('btn-save-json')?.addEventListener('click', (e) => {
    e.preventDefault();
    const underlayVisibility = {};
    ['PH', 'R', '3', '2', '1'].forEach(f => { underlayVisibility[f] = document.getElementById(`vis-underlay-${f.toLowerCase()}`)?.checked || false; });
    const data = { floorData, nextId, dxfLines, dxfTexts, dxfLayerVisibility, dxfVAxes, dxfHAxes, dxfSkewedAxes, underlayVisibility };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'foundation_data.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  });

  document.getElementById('json-upload')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result);
        const { normalizeAllFloors } = await import('../data/data_normalizer.js');

        if (data.floorData) {
          Object.keys(data.floorData).forEach(f => {
            if (floorData[f]) {
                Object.keys(floorData[f]).forEach(k => delete floorData[f][k]);
                Object.assign(floorData[f], data.floorData[f]);
            }
          });
          normalizeAllFloors(floorData);
          repairFoundationData(floorData);
        }
        if (data.nextId) updateNextId(data.nextId);
        setDxfData(data.dxfLines||[], data.dxfTexts||[], data.dxfLayerVisibility||{}, data.dxfVAxes||[], data.dxfHAxes||[], data.dxfSkewedAxes||[]);
        updateUnderlayCheckboxes(data.underlayVisibility);
        
        setFloor('1');
        updateLayerCheckboxes();
        const { updateAllFloorHeightInputs, updateAllDiaphragmSpecsInputs } = await import('../state_manager.js');
        updateAllFloorHeightInputs();
        updateAllDiaphragmSpecsInputs();
        window.updatePropertyPanel?.(); window.updateDataList?.();
        fitAll(); 
        if (typeof window.rebuildAllColumnIds === 'function') window.rebuildAllColumnIds();
        pushHistory();
        if (typeof recalcAllTributaries === 'function') recalcAllTributaries();
        callRender();
        alert('データを復元しました。');
      } catch (err) { alert('JSON読込失敗'); }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  // --- Canvas Interaction ---
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    import('../foundation_cad.js').then(cad => {
      const w0 = cad.screenToWorld(sx, sy);
      const curS = cad.viewState.scale;
      const newS = Math.max(0.001, Math.min(50, curS * (e.deltaY < 0 ? 1.12 : 1/1.12)));
      cad.setPanScale(sx - w0.x * newS, sy + w0.y * newS, newS);
      callRender();
    });
  }, {passive:false});

  canvas.addEventListener('mousedown', async e => {
    const cad = await import('../foundation_cad.js');
    const wc = cad.screenToWorld(e.offsetX, e.offsetY);
    if (e.button === 2) {
      state.isPanning = true; state.panStartMouse = {x: e.offsetX, y: e.offsetY};
      state.panStartOffset = {x: cad.viewState.panX, y: cad.viewState.panY};
      canvas.style.cursor = 'grabbing'; return;
    }
    if (e.button !== 0) return;
    const fd = getCurrentFloorData();
    if (state.currentTool === 'delete') { await handleDelete(state, fd, wc, cad); return; }
    const snapIdx = state.currentTool === 'column' ? cad.findSnapNode(wc.x, wc.y, 300) : cad.findSnapNode(wc.x, wc.y);
    switch (state.currentTool) {
      case 'select': case 'selectGrid': case 'selectElem': handleSelect(state, fd, wc, snapIdx, cad, e.shiftKey || e.ctrlKey); break;
      case 'column': handleColumnPlace(state, fd, snapIdx); break;
      case 'beam': handleBeamDraw(state, fd, snapIdx, 'beam'); break;
      case 'fbeam': handleBeamDraw(state, fd, snapIdx, 'fbeam'); break;
      case 'wall': handleWallDraw(state, fd, snapIdx); break;
      case 'skewedGrid': handleSkewedAxisDraw(state, snapIdx); break;
      case 'slab': case 'diaphragm': handleSlabDraw(state, snapIdx); break;
    }
  });

  canvas.addEventListener('mousemove', async e => {
    const cad = await import('../foundation_cad.js');
    if (state.isPanning) {
      cad.setPanScale(state.panStartOffset.x + (e.offsetX - state.panStartMouse.x), state.panStartOffset.y + (e.offsetY - state.panStartMouse.y), cad.viewState.scale);
      callRender();
    } else {
      handleMouseHover(state, getCurrentFloorData(), cad.screenToWorld(e.offsetX, e.offsetY), cad);
    }
  });

  canvas.addEventListener('mouseup', () => { state.isPanning = false; canvas.style.cursor = 'default'; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        if (e.shiftKey) redo(); else undo();
        window.updatePropertyPanel?.(); window.updateDataList?.(); callRender(); e.preventDefault();
    }
    if (e.key === 'Escape') {
      const overlays = document.querySelectorAll('[id*="modal"], [id*="Modal"]');
      overlays.forEach(el => {
          if (el.id.includes('overlay') || el.id.includes('Modal') || el.id.includes('editor')) {
              el.remove();
          }
      });
      if (window.highlightedSlabIndex !== undefined) window.highlightedSlabIndex = null;
      callRender();
    }
    if (e.key === 'Delete') handleDeleteSelected(state, floorData[currentFloor]);

    // 💡 復元: 矢印キーでの画面移動（パン）
    const moveRaw = 20;
    import('../foundation_cad.js').then(cad => {
      const dWorld = moveRaw / cad.viewState.scale;
      let handled = false;
      if (e.key === 'ArrowUp') { cad.panCanvas(0, dWorld); handled = true; }
      if (e.key === 'ArrowDown') { cad.panCanvas(0, -dWorld); handled = true; }
      if (e.key === 'ArrowLeft') { cad.panCanvas(dWorld, 0); handled = true; }
      if (e.key === 'ArrowRight') { cad.panCanvas(-dWorld, 0); handled = true; }
      if (handled) { e.preventDefault(); cad.callRender(); }
    });
  });

  setTimeout(() => { window.fitAll?.(); window.callRender?.(); }, 150);
};

window.setupEventHandlers = setupEventHandlers;
window.updateLayerCheckboxes = updateLayerCheckboxes;
