// events/main_setup.js
import { 
  floorData, FLOORS, currentFloor, setFloor, render, 
  findSnapNode, findBeamNear, findSlabAt, findDiaphragmAt, pushHistory, undo, redo,
  dxfLines, dxfTexts, dxfLayerVisibility, dxfVAxes, dxfHAxes, dxfSkewedAxes, nextId, updateNextId, setDxfData, getCurrentFloorData, repairFoundationData
} from '../foundation_cad.js';
import { parseDxfFile } from '../foundation_dxf.js';
import { callRender, fitAll } from '../rendering_helpers.js';
import { handleMouseHover, finishPolygon, handleSlabDraw, handleSkewedAxisDraw, handleWallDraw, handleBeamDraw, handleColumnPlace, handleSelect, handleDeleteSelected, handleDelete } from '../tool_handlers.js';
import '../events/load_sync.js';

// バックエンドURL: Live Server(5500)、file://プロトコル、その他いずれの場合もlocalhost:8000を使用
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

/**
 * 階層別の下絵表示チェックボックスを、現在のデータの有無に合わせて更新する
 * (JSON復元時や、DXF新規読み込み時に使用)
 */
export function updateUnderlayCheckboxes(underlayVisibility = null) {
  FLOORS.forEach(f => {
    const cb = document.getElementById(`vis-underlay-${f.toLowerCase()}`);
    if (!cb) return;
    if (underlayVisibility && underlayVisibility[f] !== undefined) {
      cb.checked = underlayVisibility[f];
    } else {
      // データの有無で判定 (既存ファイル互換)
      const hasDxf = floorData[f] && floorData[f].dxfLines && floorData[f].dxfLines.length > 0;
      cb.checked = hasDxf;
    }
  });
}

/**
 * UI 設定とイベント登録の全ロジック
 */
export const setupEventHandlers = function(canvas, state) {
  window.state = state || window.state || { currentTool: 'selectGrid', selectedElements: [], currentPolygon: [] };
  
  try {
      delete window.currentFloor;
      delete window.floorData;
  } catch(e) {}
  
  window.floorData = floorData;
  window.currentFloor = currentFloor;

  // --- 内部ヘルパー: 壁クリーンアップ ---
  window.cleanupOrphanWalls = function(floorKey) {
    const fk = floorKey || currentFloor;
    const fdata = floorData[fk];
    if (!fdata || !fdata.walls) return 0;
    const colNodeIndices = new Set(fdata.columns.map(c => c.nodeIndex));
    const before = fdata.walls.length;
    fdata.walls = fdata.walls.filter(w => {
      const n1Valid = w.n1 !== undefined && w.n1 !== null && colNodeIndices.has(w.n1);
      const n2Valid = w.n2 !== undefined && w.n2 !== null && colNodeIndices.has(w.n2);
      return n1Valid && n2Valid;
    });
    const removed = before - fdata.walls.length;
    if (removed > 0) console.log(`[cleanupOrphanWalls] ${fk}階: ${removed}件の孤立した壁を除去しました。`);
    return removed;
  };

  // --- Toolbar Events ---
  document.getElementById('btnUndo')?.addEventListener('click', () => { 
    if(undo()) { 
      state.selectedElement = null;
      state.selectedElements = [];
      window.updateDataList?.(); 
      window.updatePropertyPanel?.(); 
      callRender(); 
    } 
  });
  document.getElementById('btnRedo')?.addEventListener('click', () => { 
    if(redo()) { 
      state.selectedElement = null;
      state.selectedElements = [];
      window.updateDataList?.(); 
      window.updatePropertyPanel?.(); 
      callRender(); 
    } 
  });

  // --- Floor Tabs ---
  document.querySelectorAll('#floorTabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.dataset.floor) return; // 階層属性がないボタン（「全体」など）は無視
      document.querySelector('#floorTabs button.active')?.classList.remove('active');
      btn.classList.add('active');
      setFloor(btn.dataset.floor);
      window.currentFloor = btn.dataset.floor; 
      
      // 💡 ユーザー要望：階切り替え時に自動でONにせず、手動設定を維持できるようにする
      // (以前はここで underlayCheckbox.checked = true にしていたが削除)
      
      const floorInput = document.getElementById('floorHeight');
      if (floorInput) floorInput.value = floorData[currentFloor].floorHeight || 2730;
      state.selectedElement = null;
      state.beamStartNode = null;
      state.currentPolygon = [];
      updateLayerCheckboxes();
      window.updatePropertyPanel?.();
      window.updateDataList?.();
      
      // 階切り替え時に拡大率をリセットしないように変更
      /*
      if (typeof window.fitAll === 'function') {
          window.fitAll();
      }
      */
      
      if (window.state) {
        window.state.floorData = floorData[currentFloor];
      }

      setTimeout(() => {
          callRender();
      }, 50);
    });
  });

  // --- Tool Tabs ---
  const setTool = (t) => {
    state.currentTool = t;
    document.querySelectorAll('#toolGroup .tool-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`#toolGroup .tool-btn[data-tool="${t}"]`)?.classList.add('active');
    canvas.style.cursor = (t === 'selectGrid' || t === 'selectElem') ? 'default' : t === 'delete' ? 'not-allowed' : 'crosshair';
    state.beamStartNode = null;
    state.currentPolygon = [];
    state.selectedElement = null;
    state.selectedElements = [];
    window.updatePropertyPanel?.();
    callRender();
  };
  document.querySelectorAll('#toolGroup .tool-btn').forEach(btn => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  // --- DXF Upload (Legacy Fix & New Flow) ---
  const dxfFileNameEl = document.getElementById('dxfFileName');
  
  document.getElementById('dxfFileInput')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = getCurrentFloorData();
    const hasData = fd.nodes.length > 0 || fd.columns.length > 0 || fd.walls.length > 0 || fd.beams.length > 0 || fd.slabs.length > 0;
    let keepExisting = true;
    if (hasData) keepExisting = window.confirm("既存データを残して追加しますか？\n[OK]追加 [キャンセル]上書き");
    if (!keepExisting) { fd.nodes = []; fd.columns = []; fd.walls = []; fd.beams = []; fd.slabs = []; fd.diaphragms = []; }
    
    import('../foundation_dxf.js').then(({ parseDxfFile }) => {
      parseDxfFile(file, keepExisting, (err, dxf) => {
        if (!err) {
          if (dxfFileNameEl) dxfFileNameEl.textContent = '✓ ' + file.name;
          document.getElementById('dxfUploadArea')?.classList.add('loaded');
          window.updateLayerCheckboxes?.();
          window.updatePropertyPanel?.();
          window.updateDataList?.();
          window.fitAll?.();
          window.cleanupOrphanWalls?.(currentFloor);
        }
        e.target.value = '';
      });
    });
  });

  // --- Multi-Floor Merge & Analyze Flow ---
  const floors = ['1f', '2f', '3f', 'ph'];
  floors.forEach(f => {
    document.getElementById(`dxf-input-${f}`)?.addEventListener('change', e => {
      const statusEl = document.getElementById(`status-${f}`);
      if (statusEl && e.target.files[0]) {
        statusEl.textContent = '✓ ' + e.target.files[0].name;
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
      if (input && input.files[0]) {
        formData.append(`file_${f}`, input.files[0]);
      }
    });

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⌛ 統合・解析中...";

    try {
      console.log(`[Step 1] Fetching merged DXF from backend... (${new Date().toLocaleTimeString()})`);
      const response = await fetch(`${API_BASE_URL}/api/v1/merge-floors`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("[Step 1 ERROR] Merge API failed:", errText);
        throw new Error(`結合処理に失敗しました (HTTP ${response.status}):\n${errText}`);
      }

      const blob = await response.blob();
      console.log(`[Step 2] Blob received. Size: ${blob.size} bytes`);
      const downloadName = `merged_structural_${new Date().getTime()}.dxf`;
      console.log("[Step 4] Initializing DXF Auto-Load...");
      const file = new File([blob], downloadName, { type: "application/dxf" });
      
      const { parseDxfFile, extractDxfSymbols } = await import('../foundation_dxf.js');
      const { showWallSymbolModal } = await import('../wall_import_ui.js');

      // ✅ 修正: 自動ダウンロードはせず、ボタンを表示する
      const dlBtn = document.getElementById('btnDownloadMergedDxf');
      if (dlBtn) {
          dlBtn.style.display = 'block';
          dlBtn.onclick = () => {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = downloadName;
              console.log(`[Step 3] Manual download triggered: ${a.download}`);
              alert("【注意】Live Server等の自動リロードを防ぐため、このファイルを「data」フォルダや「assets」フォルダなど、プロジェクト内のフォルダには保存しないでください（デスクトップ等への保存を推奨します）。");
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
          };
      }

      console.log("[Step 5] Starting Symbol Extraction...");
      extractDxfSymbols(file, async (err, symbols) => {
          if (err) {
              console.error("[Step 5 ERROR] Symbol extraction failed", err);
              console.log("[Step 5.1] Falling back to direct parse...");
              parseDxfFile(file, false, (e) => { 
                  if (!e) {
                      console.log("[Step 6] Finalizing load (Fallback)");
                      finalizeLoad(); 
                  }
                  else {
                      console.error("[Step 6 ERROR] Fallback parse failed", e);
                      alert("解析エラー(フォールバック): " + e.message);
                      btn.disabled = false;
                      btn.textContent = originalText;
                  }
              });
              return;
          }
          console.log(`[Step 5 SUCCESS] Symbols found: ${symbols.length}`, symbols);

          // 解析実行

          // 4c. 解析実行 (既存データを保持して統合)
          parseDxfFile(file, true, (err) => {
              if (!err) {
                  finalizeLoad();
              }
              else {
                  console.error("[Step 6 ERROR] Parse failed", err);
                  alert("解析エラー: " + err.message);
                  btn.disabled = false;
                  btn.textContent = originalText;
              }
          });
      });

      function finalizeLoad() {
          if (dxfFileNameEl) dxfFileNameEl.textContent = '✓ ' + file.name;
          updateUnderlayCheckboxes(); // 下絵チェックボックスを更新
          window.updateLayerCheckboxes?.();
          window.updateSkewedVizDropdown?.(); // 💡 斜め軸リストを更新
          window.updatePropertyPanel?.();
          window.updateDataList?.();
          window.fitAll?.();
          btn.disabled = false;
          btn.textContent = originalText;
      }

    } catch (err) {
      console.error(err);
      let msg = err.message;
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        msg = "バックエンドサーバーに接続できません。start_server.bat を実行してサーバーが起動しているか確認してください。";
      }
      alert(msg);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });

  // --- JSON Save / Load ---
  document.getElementById('btn-save-json')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const underlayVisibility = {};
    ['PH', 'R', '3', '2', '1'].forEach(f => {
      underlayVisibility[f] = document.getElementById(`vis-underlay-${f.toLowerCase()}`)?.checked || false;
    });
    const data = { floorData, nextId, dxfLines, dxfTexts, dxfLayerVisibility, dxfVAxes, dxfHAxes, dxfSkewedAxes, underlayVisibility };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'foundation_data.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  });

  document.getElementById('json-upload')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.floorData) {
          Object.keys(data.floorData).forEach(f => {
            if (floorData[f]) {
                // 💡 修正: 参照を維持したまま中身を入れ替える (UI同期のため)
                Object.keys(floorData[f]).forEach(k => delete floorData[f][k]);
                Object.assign(floorData[f], data.floorData[f]);
            }
          });
          repairFoundationData(floorData);
        }
        if (data.nextId) updateNextId(data.nextId);
        setDxfData(
          data.dxfLines || [], 
          data.dxfTexts || [], 
          data.dxfLayerVisibility || {}, 
          data.dxfVAxes || [], 
          data.dxfHAxes || [], 
          data.dxfSkewedAxes || []
        );

        // 💡 下絵表示設定の復元 (同期的に実行)
        updateUnderlayCheckboxes(data.underlayVisibility);
        
        // 全体の下絵表示フラグを同期
        if (data.showDxf !== undefined) {
          state.showDxf = data.showDxf;
          const visDxfCb = document.getElementById('vis-dxf');
          if (visDxfCb) visDxfCb.checked = data.showDxf;
        } else {
          // 既存ファイルでデータがある場合は ON にする
          const hasAnyDxf = FLOORS.some(f => floorData[f] && floorData[f].dxfLines && floorData[f].dxfLines.length > 0);
          if (hasAnyDxf) {
            state.showDxf = true;
            const visDxfCb = document.getElementById('vis-dxf');
            if (visDxfCb) visDxfCb.checked = true;
          }
        }
        
        setFloor('1');
        state.selectedElement = null;
        state.selectedElements = [];
        
        updateLayerCheckboxes();
        if (typeof window.updateAllFloorHeightInputs === 'function') window.updateAllFloorHeightInputs();
        if (typeof window.updateAllDiaphragmSpecsInputs === 'function') window.updateAllDiaphragmSpecsInputs();
        window.updateSkewedVizDropdown?.(); // 💡 斜め軸リストを更新
        
        // 【重要】復元したデータを現在のグリッド設定に強制整合させる
        import('../foundation_cad.js').then(cad => {
          if (typeof cad.generateNodesForSkewedAxis === 'function') {
            cad.dxfSkewedAxes.forEach(ax => cad.generateNodesForSkewedAxis(ax));
          }
          if (typeof cad.rebuildAllColumnIds === 'function') {
            cad.rebuildAllColumnIds();
            console.log("[JSON Restore] Column IDs rebuilt to match grid.");
          }
          window.updatePropertyPanel?.();
          window.updateDataList?.();
          callRender();
        });

        fitAll();
        if (typeof window.syncSlabDataToBeams === 'function') window.syncSlabDataToBeams();
        callRender();
        
        if (typeof pushHistory === 'function') pushHistory();
        alert('全階層のデータを復旧・統合しました。');
      } catch (err) { 
        console.error('JSON読込失敗:', err);
        alert('JSON読込失敗'); 
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  // --- Display Toggles ---
  document.getElementById('showGrid')?.addEventListener('change', e => { state.showGrid = e.target.checked; callRender(); });

  // --- Canvas Events ---
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

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('mousedown', async e => {
    if (e.button === 2) {
      state.isPanning = true;
      state.panStartMouse = {x: e.offsetX, y: e.offsetY};
      import('../foundation_cad.js').then(cad => { state.panStartOffset = {x: cad.viewState.panX, y: cad.viewState.panY}; });
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (e.button !== 0) return;
    const cad = await import('../foundation_cad.js');
    const fd = getCurrentFloorData();
    const wc = cad.screenToWorld(e.offsetX, e.offsetY);
    if (state.currentTool === 'delete') { if (await handleDelete(state, fd, wc, cad)) return; return; }
    const snapIdx = state.currentTool === 'column' ? cad.findSnapNode(wc.x, wc.y, 300) : cad.findSnapNode(wc.x, wc.y);
    switch (state.currentTool) {
      case 'selectGrid': case 'selectElem': handleSelect(state, fd, wc, snapIdx, cad, e.shiftKey || e.ctrlKey); break;
      case 'column': handleColumnPlace(state, fd, snapIdx); break;
      case 'beam': handleBeamDraw(state, fd, snapIdx, 'beam'); break;
      case 'fbeam': handleBeamDraw(state, fd, snapIdx, 'fbeam'); break;
      case 'wall': handleWallDraw(state, fd, snapIdx); break;
      case 'skewedGrid': handleSkewedAxisDraw(state, snapIdx); break;
      case 'slab': case 'diaphragm': handleSlabDraw(state, snapIdx); break;
    }
  });

  canvas.addEventListener('mousemove', async e => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const cad = await import('../foundation_cad.js');
    if (state.isPanning) {
      const dx = sx - state.panStartMouse.x, dy = sy - state.panStartMouse.y;
      cad.setPanScale(state.panStartOffset.x + dx, state.panStartOffset.y + dy, cad.viewState.scale);
      callRender();
    } else {
      const fd = getCurrentFloorData();
      handleMouseHover(state, fd, cad.screenToWorld(sx, sy), cad);
    }
  });

  canvas.addEventListener('mouseup', e => {
    if (e.button === 2) {
      state.isPanning = false;
      canvas.style.cursor = ['selectGrid','selectElem'].includes(state.currentTool) ? 'default' : state.currentTool === 'delete' ? 'not-allowed' : 'crosshair';
    }
  });

  canvas.addEventListener('contextmenu', e => {
    if (!state.isPanning) {
      e.preventDefault();
      if (state.beamStartNode !== null || state.currentPolygon.length > 0) {
        state.beamStartNode = null;
        state.currentPolygon = [];
        window.updatePropertyPanel?.();
        callRender();
      }
    }
  });

  window.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      if (e.shiftKey) { if (redo()) { window.updatePropertyPanel?.(); window.updateDataList?.(); callRender(); } }
      else { if (undo()) { state.selectedElement = null; window.updatePropertyPanel?.(); window.updateDataList?.(); callRender(); } }
      e.preventDefault();
    }
    const moveRaw = 20;
    import('../foundation_cad.js').then(cad => {
      const dWorld = moveRaw / cad.viewState.scale;
      let handled = false;
      if (e.key === 'ArrowUp') { cad.panCanvas(0, dWorld); handled = true; }
      if (e.key === 'ArrowDown') { cad.panCanvas(0, -dWorld); handled = true; }
      if (e.key === 'ArrowLeft') { cad.panCanvas(dWorld, 0); handled = true; }
      if (e.key === 'ArrowRight') { cad.panCanvas(-dWorld, 0); handled = true; }
      if (handled) { e.preventDefault(); callRender(); }
    });
  });

  document.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
    const tools = { V:'selectGrid', A:'selectElem', C:'column', B:'beam', F:'fbeam', S:'slab', H:'diaphragm', W:'wall', G:'skewedGrid' };
    const tool = tools[e.key.toUpperCase()];
    if (tool) setTool(tool);
    else if (e.key.toUpperCase() === 'ENTER' && ['slab','diaphragm'].includes(state.currentTool)) finishPolygon(state, floorData[currentFloor]);
    else if (e.key === 'Escape') { state.beamStartNode = null; state.currentPolygon = []; state.selectedElement = null; window.updatePropertyPanel?.(); callRender(); }
    else if (e.key === 'Delete') handleDeleteSelected(state, floorData[currentFloor]);
    else if (e.key.toUpperCase() === 'F') fitAll();
  });

  setTimeout(() => {
    window.fitAll?.();
    try { 
        if (typeof window.updateDataList === 'function') window.updateDataList(); 
        if (typeof window.updatePropertyPanel === 'function') window.updatePropertyPanel();
        if (typeof window.updateAllFloorHeightInputs === 'function') window.updateAllFloorHeightInputs();
    } catch(e) { console.error('初期リスト更新エラー:', e); }
    window.callRender?.();
  }, 150);
};

window.updateSkewedVizDropdown = function() {
    const select = document.getElementById('vis-skewed-axis-select');
    const container = document.getElementById('skewed-viz-container');
    const exteriorVizCb = document.getElementById('vis-exterior-viz');
    if (!select || !container) return;

    if (!exteriorVizCb?.checked) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';

    const currentVal = select.value;
    select.innerHTML = '<option value="">-- 全体(標準) --</option>';
    
    // window.dxfSkewedAxes または cad モジュールから取得
    const skewedAxes = window.dxfSkewedAxes || [];
    skewedAxes.forEach(ax => {
        if (!ax.label) return;
        const opt = document.createElement('option');
        opt.value = ax.label;
        opt.textContent = `${ax.label} (斜め軸モデル)`;
        if (ax.label === currentVal) opt.selected = true;
        select.appendChild(opt);
    });
};

window.setupEventHandlers = setupEventHandlers;
window.updateLayerCheckboxes = updateLayerCheckboxes;
