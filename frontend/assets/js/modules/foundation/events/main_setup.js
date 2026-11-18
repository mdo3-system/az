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
 * DXF 統合・解析完了時の検収サマリー通知モーダルを表示する
 */
function _showDxfImportSummaryModal(summary) {
  if (!summary) {
    alert('DXF の統合・解析が完了しました。');
    return;
  }

  document.getElementById('dxfImportSummaryModal')?.remove();

  const floorLabels = { '1': '1F', '2': '2F', '3': '3F', 'PH': 'PH', 'R': 'R' };
  const floorRows = ['1', '2', '3', 'PH', 'R']
    .filter(f => summary.floors && summary.floors[f] && (summary.floors[f].columns > 0 || summary.floors[f].walls > 0))
    .map(f => {
      const s = summary.floors[f];
      return `<tr><td style="padding:4px 8px;border-bottom:1px solid var(--border);">${floorLabels[f] || f}</td><td style="padding:4px 8px;border-bottom:1px solid var(--border);text-align:right;">${s.columns}</td><td style="padding:4px 8px;border-bottom:1px solid var(--border);text-align:right;">${s.walls}</td></tr>`;
    }).join('');

  const skewedText = summary.skewedAxesCount > 0
    ? `${summary.skewedAxesCount}本 (${(summary.skewedAxisLabels || []).join(', ')})`
    : '0本';

  const unmatched = summary.unmatchedWalls || [];
  const defaultMult = summary.defaultMultiplierWalls || [];
  const hasWarnings = unmatched.length > 0 || defaultMult.length > 0;

  let warningHtml = '';
  if (hasWarnings) {
    const unmatchedItems = unmatched.map(u =>
      `<li>[${u.floor}F] (${u.x1}, ${u.y1}) - (${u.x2}, ${u.y2}) 倍率:${u.multiplier} — ${u.reason}</li>`
    ).join('');
    const defaultItems = defaultMult.map(d =>
      `<li>[${d.floor}F] (${d.x1}, ${d.y1}) - (${d.x2}, ${d.y2}) — 倍率テキスト未検出のためデフォルト値(${d.multiplier})を適用</li>`
    ).join('');

    warningHtml = `
      <div style="margin-top:12px;padding:10px;background:rgba(245,166,35,0.12);border:1px solid var(--warn);border-radius:6px;">
        <div style="font-weight:bold;color:var(--warn);margin-bottom:6px;">⚠️ 要確認（スナップ未到達: ${unmatched.length}件 / デフォルト倍率: ${defaultMult.length}件）</div>
        <ul style="margin:0;padding-left:18px;max-height:140px;overflow-y:auto;font-size:11px;line-height:1.5;">
          ${unmatchedItems}
          ${defaultItems}
        </ul>
      </div>
    `;
  } else {
    warningHtml = `
      <div style="margin-top:12px;padding:8px 10px;background:rgba(52,199,123,0.12);border:1px solid var(--success);border-radius:6px;font-size:11px;color:var(--success);">
        ✓ すべての耐力壁が正常にノードへスナップされ、倍率も取得されました。
      </div>
    `;
  }

  const modal = document.createElement('div');
  modal.id = 'dxfImportSummaryModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:var(--bg-panel);color:var(--text-primary);border:1px solid var(--border);border-radius:8px;width:min(480px,92vw);padding:18px;box-shadow:0 12px 32px rgba(0,0,0,0.5);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;font-size:14px;">✅ DXF 統合・解析 完了（検収サマリー）</h3>
        <button id="btnCloseDxfSummaryX" style="background:none;border:none;color:var(--text-secondary);font-size:18px;cursor:pointer;">&times;</button>
      </div>
      <div style="font-size:12px;margin-bottom:10px;line-height:1.6;">
        <div><strong>通り芯:</strong> 垂直 ${summary.vAxesCount}本 / 水平 ${summary.hAxesCount}本 / 斜め ${skewedText}</div>
        ${summary.auxAxisCount > 0 ? `<div style="font-size:11px;color:var(--text-secondary);">※ 斜め軸用補助通り芯 ${summary.auxAxisCount}本は斜め軸交点にのみ使用（直交グリッドから除外済み）</div>` : ''}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:var(--bg-panel-alt);">
            <th style="padding:4px 8px;text-align:left;border-bottom:1px solid var(--border);">階</th>
            <th style="padding:4px 8px;text-align:right;border-bottom:1px solid var(--border);">柱 (本)</th>
            <th style="padding:4px 8px;text-align:right;border-bottom:1px solid var(--border);">耐力壁 (枚)</th>
          </tr>
        </thead>
        <tbody>${floorRows || '<tr><td colspan="3" style="padding:8px;text-align:center;color:var(--text-muted);">検出要素なし</td></tr>'}</tbody>
      </table>
      ${warningHtml}
      <div style="margin-top:14px;text-align:right;">
        <button id="btnCloseDxfSummaryOk" class="side-btn" style="padding:6px 18px;background:var(--accent);color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#btnCloseDxfSummaryX')?.addEventListener('click', close);
  modal.querySelector('#btnCloseDxfSummaryOk')?.addEventListener('click', close);
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
      alert('1F平面図は必須です。');
      return;
    }

    const filesByFloor = {};
    floors.forEach(f => {
      const input = document.getElementById(`dxf-input-${f}`);
      if (input && input.files[0]) {
        filesByFloor[f.toUpperCase()] = input.files[0];
      }
    });

    const originalText = btn.textContent;
    btn.disabled = true; btn.textContent = '⌛ 統合・解析中...';

    try {
      // Step 1 & 2: ブラウザ完結型で複数階 DXF 統合・INSERTブロック展開・Shift-JIS自動判別・正規化を実行
      console.log('[MergeFloors] Step 1: ブラウザ内で複数階 DXF 統合・解析中 (DxfImportService)...');
      const { DxfImportService } = await import('../core/services/dxf_import_service.js');
      const dxfImportService = new DxfImportService();
      await dxfImportService.importMultipleFloors(filesByFloor);

      // Step 3: UI 更新（正規化完了後なので正確なデータで描画される）
      console.log('[MergeFloors] Step 2: UI 更新中...');
      updateUnderlayCheckboxes();
      updateLayerCheckboxes();
      window.updatePropertyPanel?.();
      window.updateDataList?.();
      window.fitAll?.();
      callRender();
      console.log('[MergeFloors] 完了 ✅');
      _showDxfImportSummaryModal(dxfImportService.getLastSummary?.());

    } catch (err) {
      console.error('[MergeFloors] エラー:', err);
      alert(err.message || 'DXF 読み込み中にエラーが発生しました。');
    } finally {
      btn.disabled = false; btn.textContent = originalText;
    }
  });


  // --- JSON Save / Load ---
  document.getElementById('btn-save-json')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const underlayVisibility = {};
    ['PH', 'R', '3', '2', '1'].forEach(f => { underlayVisibility[f] = document.getElementById(`vis-underlay-${f.toLowerCase()}`)?.checked || false; });
    
    const { ProjectService } = await import('../core/services/project_service.js');
    const projectService = new ProjectService();
    const jsonStr = projectService.exportProject(underlayVisibility);
    
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'foundation_data.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  });

  document.getElementById('json-upload')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;

    // 💡 DXFファイルが選択された場合は JSON.parse せず自動で DXF インポートへ振り分ける
    if (file.name.toLowerCase().endsWith('.dxf')) {
      try {
        console.log('[File Load] DXFファイルが選択されたため DXF インポートとして処理します:', file.name);
        const { DxfImportService } = await import('../core/services/dxf_import_service.js');
        const dxfImportService = new DxfImportService();
        await dxfImportService.importMultipleFloors({ '1F': file });
        const status1f = document.getElementById('status-1f');
        if (status1f) {
          status1f.textContent = '✓ ' + file.name;
          status1f.style.color = 'var(--success)';
        }
        updateUnderlayCheckboxes();
        updateLayerCheckboxes();
        window.updatePropertyPanel?.();
        window.updateDataList?.();
        fitAll();
        if (typeof recalcAllTributaries === 'function') recalcAllTributaries();
        callRender();
        _showDxfImportSummaryModal(dxfImportService.getLastSummary?.());
      } catch (err) {
        console.error('[DXF Load Error]', err);
        alert('DXF読込失敗: ' + err.message);
      }
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const rawStr = String(ev.target.result || '');
        // 先頭が DXF セクションヘッダ ("0" + "SECTION") の場合も DXF として処理
        if (/^\s*0\s+SECTION\b/i.test(rawStr.slice(0, 64))) {
          const { DxfImportService } = await import('../core/services/dxf_import_service.js');
          const dxfImportService = new DxfImportService();
          await dxfImportService.importMultipleFloors({ '1F': file });
          updateUnderlayCheckboxes();
          updateLayerCheckboxes();
          window.updatePropertyPanel?.();
          window.updateDataList?.();
          fitAll();
          if (typeof recalcAllTributaries === 'function') recalcAllTributaries();
          callRender();
          e.target.value = '';
          return;
        }

        const data = JSON.parse(rawStr);
        const { ProjectService } = await import('../core/services/project_service.js');
        const projectService = new ProjectService();
        await projectService.importProject(data);
        
        updateUnderlayCheckboxes(data.underlayVisibility);
        updateLayerCheckboxes();
        const { updateAllFloorHeightInputs, updateAllDiaphragmSpecsInputs } = await import('../state_manager.js');
        updateAllFloorHeightInputs();
        updateAllDiaphragmSpecsInputs();
        window.updatePropertyPanel?.(); window.updateDataList?.();
        fitAll(); 
        if (typeof recalcAllTributaries === 'function') recalcAllTributaries();
        callRender();
        alert('データを復元しました。');
      } catch (err) { 
        console.error('[JSON Load Error]', err);
        alert('JSON読込失敗: ' + err.message); 
      }
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
              if (window.safeRemoveById) window.safeRemoveById(el.id);
              else if (el.parentNode) el.remove();
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
      if (handled) { 
        e.preventDefault(); 
        if (typeof window.callRender === 'function') window.callRender();
        else if (typeof cad.render === 'function') cad.render();
      }
    });
  });

  setTimeout(() => { window.fitAll?.(); window.callRender?.(); }, 150);
};

window.setupEventHandlers = setupEventHandlers;
window.updateLayerCheckboxes = updateLayerCheckboxes;
