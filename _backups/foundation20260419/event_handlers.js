import { 
  floorData, FLOORS, currentFloor, setFloor, render, 
  findSnapNode, findBeamNear, findSlabAt, findDiaphragmAt, pushHistory, undo, redo,
  dxfLines, dxfTexts, dxfLayerVisibility, dxfVAxes, dxfHAxes, dxfSkewedAxes, nextId, updateNextId, setDxfData 
} from './foundation_cad.js';
import { parseDxfFile } from './foundation_dxf.js';
import { callRender, fitAll } from './rendering_helpers.js';
import { 
  handleDelete, handleDeleteSelected, handleSelect, handleColumnPlace, handleBeamDraw, handleWallDraw, handleSlabDraw, handleSkewedAxisDraw, finishPolygon, handleMouseHover 
} from './tool_handlers.js';
import { drawBeamStressOnCanvas, updateAllBeamsShortTermStress } from './stress_display.js';

// --- 定数とヘルパー ---
const API_BASE_URL = window.location.port === '5500' ? 'http://127.0.0.1:8000' : window.location.origin;
const STRESS_TOLERANCE = 50;
const isSamePoint = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y) < STRESS_TOLERANCE;

/**
 * foundation_main.js から移設された UI 設定とイベント登録の全ロジック
 */
export const setupEventHandlers = function(canvas, state) {
  // 💡 BUGFIX: window.state の安全な初期化
  window.state = state || window.state || { currentTool: 'selectGrid', selectedElements: [], currentPolygon: [] };
  
  // 💡 BUGFIX: 既存のゲッターがあれば削除し、読み書き自由なプロパティとして再定義（TypeError防止）
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
  document.getElementById('btnUndo')?.addEventListener('click', () => { if(undo()) { window.updateDataList?.(); window.updatePropertyPanel?.(); callRender(); } });
  document.getElementById('btnRedo')?.addEventListener('click', () => { if(redo()) { window.updateDataList?.(); window.updatePropertyPanel?.(); callRender(); } });

  // --- Floor Tabs ---
  document.querySelectorAll('#floorTabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('#floorTabs button.active')?.classList.remove('active');
      btn.classList.add('active');
      setFloor(btn.dataset.floor);
      // 💡 内部変数とグローバル変数の両方を最新状態に更新
      window.currentFloor = btn.dataset.floor; 
      const floorInput = document.getElementById('floorHeight');
      if (floorInput) floorInput.value = floorData[currentFloor].floorHeight || 2730;
      state.selectedElement = null;
      state.beamStartNode = null;
      state.currentPolygon = [];
      updateLayerCheckboxes();
      window.updatePropertyPanel?.();
      window.updateDataList?.();
      callRender();
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

  // --- DXF Upload ---
  document.getElementById('dxfFileInput')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = floorData[currentFloor];
    const hasData = fd.nodes.length > 0 || fd.columns.length > 0 || fd.walls.length > 0 || fd.beams.length > 0 || fd.slabs.length > 0;
    let keepExisting = true;
    if (hasData) keepExisting = window.confirm("既存データを残して追加しますか？\n[OK]追加 [キャンセル]上書き");
    if (!keepExisting) { fd.nodes = []; fd.columns = []; fd.walls = []; fd.beams = []; fd.slabs = []; fd.diaphragms = []; }
    parseDxfFile(file, keepExisting, (err, dxf) => {
      if (!err) {
        document.getElementById('dxfFileName').textContent = '✓ ' + file.name;
        document.getElementById('dxfUploadArea')?.classList.add('loaded');
        updateLayerCheckboxes();
        window.updatePropertyPanel?.();
        window.updateDataList?.();
        fitAll();
        window.cleanupOrphanWalls(currentFloor);
        window.updateDataList?.();
      }
      e.target.value = '';
    });
  });

  // --- JSON Save / Load ---
  document.getElementById('btn-save-json')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation(); // 💡 バブリングによる意図しない挙動を阻止
    const data = { floorData, nextId, dxfLines, dxfTexts, dxfLayerVisibility, dxfVAxes, dxfHAxes, dxfSkewedAxes };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'foundation_data.json'; a.click();
    console.log("%c[SAVE] データの保存を実行しました。※もし画面が初期化される場合は、Live Server等の自動更新機能を停止するか、保存先をプロジェクト外（デスクトップ等）にしてください。", "color: #f1c40f; font-weight: bold;");
    setTimeout(() => URL.revokeObjectURL(url), 100);
  });

  document.getElementById('json-upload')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.floorData) Object.keys(data.floorData).forEach(f => { if (floorData[f]) floorData[f] = data.floorData[f]; });
        if (data.nextId) updateNextId(data.nextId);
        setDxfData(data.dxfLines || [], data.dxfTexts || [], data.dxfLayerVisibility || {}, data.dxfVAxes || [], data.dxfHAxes || [], data.dxfSkewedAxes || []);
        
        setFloor('1');
        state.selectedElement = null;
        state.selectedElements = [];
        
        updateLayerCheckboxes();
        window.updatePropertyPanel?.();
        window.updateDataList?.();
        
        fitAll();
        window.syncSlabDataToBeams?.();
        callRender();
        
        console.log(`[JSON Load] data restored. nextId: ${data.nextId}`);
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
    import('./foundation_cad.js').then(cad => {
      const w0 = cad.screenToWorld(sx, sy);
      const newS = Math.max(0.001, Math.min(50, cad.scale * (e.deltaY < 0 ? 1.12 : 1/1.12)));
      cad.setPanScale(sx - w0.x * newS, sy + w0.y * newS, newS);
      callRender();
    });
  }, {passive:false});

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('mousedown', async e => {
    if (e.button === 2) {
      state.isPanning = true;
      state.panStartMouse = {x: e.offsetX, y: e.offsetY};
      import('./foundation_cad.js').then(cad => { state.panStartOffset = {x: cad.panX, y: cad.panY}; });
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (e.button !== 0) return;
    const cad = await import('./foundation_cad.js');
    const fd = floorData[currentFloor];
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
    const cad = await import('./foundation_cad.js');
    if (state.isPanning) {
      const dx = sx - state.panStartMouse.x, dy = sy - state.panStartMouse.y;
      cad.setPanScale(state.panStartOffset.x + dx, state.panStartOffset.y + dy, cad.scale);
      callRender();
    } else {
      const fd = floorData[currentFloor];
      handleMouseHover(state, fd, cad.screenToWorld(sx, sy), cad);
    }
  });

  canvas.addEventListener('mouseup', e => {
    if (e.button === 2) {
      state.isPanning = false;
      canvas.style.cursor = ['selectGrid','selectElem'].includes(state.currentTool) ? 'default' : state.currentTool === 'delete' ? 'not-allowed' : 'crosshair';
    }
  });

  // 💡 操作改善: 右クリックで入力をキャンセル
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

  // --- Keyboard Events ---
  window.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      if (e.shiftKey) { if (redo()) { window.updatePropertyPanel?.(); window.updateDataList?.(); callRender(); } }
      else { if (undo()) { state.selectedElement = null; window.updatePropertyPanel?.(); window.updateDataList?.(); callRender(); } }
      e.preventDefault();
    }
    const moveRaw = 20;
    import('./foundation_cad.js').then(cad => {
      const dWorld = moveRaw / cad.scale;
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

  // 初期化完了時に一回描画
  setTimeout(() => {
    window.fitAll?.(); // キャンバスを新しいサイズにフィット
    try { 
        if (typeof window.updateDataList === 'function') window.updateDataList(); 
        if (typeof window.updatePropertyPanel === 'function') window.updatePropertyPanel();
    } catch(e) { console.error('初期リスト更新エラー:', e); }
    window.callRender?.();
    console.log('[UI] 初期描画完了：右パネル閉鎖・キャンバス最大化');
  }, 150);
};

// --- グローバルハンドラ群 (event_handlers.js モジュール内で定義) ---

window.updateDefaultWallMultiplier = function(val) {
  if (window.state) window.state.defaultWallMultiplier = Math.min(7.0, Math.max(0, parseFloat(val) || 1.0));
};

window.updateFloorHeight = function(val) {
  const fd = floorData[currentFloor];
  if (fd) {
    fd.floorHeight = parseInt(val) || 2730;
    window.updatePropertyPanel?.();
    window.updateDataList?.();
    callRender();
  }
};



window.handleMultiPropChange = function(field, value) {
  if (window.state && window.state.selectedElements) {
    window.state.selectedElements.forEach(({type, index}) => window.handlePropChange(type, index, field, value));
  }
  callRender();
};

window.selectListItem = function(type, index) {
  if (!window.state) window.state = {}; // 強制復旧
  
  // 💡 BUGFIX: 右パネル(property_panel_builders)が小文字を期待している可能性があるため、typeはそのままstateへ渡す
  window.state.selectedElement = { type: type, index: index };
  window.state.selectedElements = [{ type: type, index: index }];
  
  const visIdMap = { 
    column:'vis-col', beam:'vis-beam', perimeterbeam:'vis-fbeam', perimeterBeam:'vis-fbeam', 
    slab:'vis-slab', diaphragm:'vis-diaph', wall:'vis-wall' 
  };
  const visId = visIdMap[type];
  if (visId) {
    const el = document.getElementById(visId);
    if (el && !el.checked) { el.checked = true; el.dispatchEvent(new Event('change')); }
  }

  // 💡 モーダル呼び出し用には正規化（キャメルケース）を使用
  const popupType = type === 'perimeterbeam' ? 'perimeterBeam' : type;
  if (popupType === 'column') {
    if (typeof window.openColumnDetailModal === 'function') window.openColumnDetailModal(index);
  } else if (['beam','perimeterBeam'].includes(popupType)) {
    if (typeof window.openBeamStressPopup === 'function') window.openBeamStressPopup(popupType, index);
  } else if (popupType === 'slab') {
    if (typeof window.openSlabDetailModal === 'function') window.openSlabDetailModal(index);
  } else if (popupType === 'wall') {
    if (typeof window.openWallDetailModal === 'function') window.openWallDetailModal(index);
  } else if (popupType === 'diaphragm') {
    if (typeof window.openDiaphragmDetailModal === 'function') window.openDiaphragmDetailModal(index);
  }
  
  if (typeof window.updatePropertyPanel === 'function') window.updatePropertyPanel();
  if (typeof window.updateDataList === 'function') window.updateDataList();
  if (typeof window.callRender === 'function') window.callRender();
};

window.switchMenuTab = function(btn) {
  if (!window.state) window.state = { currentListTab: null };
  
  // アクティブ表示の切り替え
  document.querySelectorAll('[data-list]').forEach(b => b.classList.remove('active'));
  if (btn && btn.classList) {
      btn.classList.add('active');
      window.state.currentListTab = btn.dataset.list;
  }
  
  // 💡 リスト表示の更新を try-catch で保護し、確実に実行
  console.log(`[UI] タブ切り替え: ${window.state.currentListTab}`);
  try {
    if (typeof window.updateDataList === 'function') {
        window.updateDataList();
    } else {
        console.warn('updateDataList が未定義です。UIモジュールのロードを待機中...');
    }
  } catch(e) {
    console.error('updateDataList 実行エラー:', e);
  }
};

window.handleNwPdfUpload = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('pdfStatus');
  if (statusEl) statusEl.textContent = "読込中...";
  const formData = new FormData(); formData.append('file', file);
  try {
    const resp = await fetch(`${API_BASE_URL}/api/v1/upload-nw-pdf`, { method:'POST', body:formData });
    if (!resp.ok) throw new Error('解析失敗');
    const data = await resp.json();
    const nw_dict = data.nw_dict || {};
    const fd = floorData[currentFloor];
    let count = 0;
    fd.columns.forEach(col => {
      const val = (nw_dict[currentFloor] && nw_dict[currentFloor][col.id]) ?? nw_dict[col.id];
      if (val !== undefined && val !== null) { col.nw = parseFloat(val); count++; }
    });
    if (statusEl) statusEl.textContent = `✓ ${count}件完了`;
    callRender(); window.updatePropertyPanel?.(); window.updateDataList?.();
  } catch (err) { if (statusEl) statusEl.textContent = "⚠ エラー"; }
  event.target.value = '';
};

window.syncSlabDataToBeams = function() {
    const fd = (typeof floorData !== 'undefined' ? floorData : (window.floorData || {}))[currentFloor];
    if (!fd || !fd.nodes) return;

    // 0. 通り芯上の基礎梁を自動統合（一本化）
    if (window.autoMergeCollinearBeams) {
        window.autoMergeCollinearBeams(fd);
    }

    // 1. 各スラブの負担領域計算（三角形・四角形分割）を最新状態にする
    if (typeof window.calculateSlabTributary === 'function') {
        (fd.slabs || []).forEach(slab => {
            window.calculateSlabTributary(slab, fd.nodes, fd.beams);
        });
    }

    // 2. 梁（手動・外周自動）の荷重プロパティを初期化
    const allBeamRefs = [
        ...(fd.beams || []),
        ...(fd.perimeterBeams || [])
    ];
    allBeamRefs.forEach(b => {
        b.tributaryWidth = 0;
        b.B = 0;
        b.groundPressure = 0;
        b.sigma_e = 0;
        b.spanLoads = [];
    });

    // 補助関数：幾何学的判定
    const getTOnBeam = (p, n1, n2) => {
        const dx = n2.x - n1.x, dy = n2.y - n1.y;
        const L2 = dx*dx + dy*dy;
        if (L2 < 1) return 0;
        return ((p.x - n1.x)*dx + (p.y - n1.y)*dy) / L2;
    };
    const distToLine = (p, n1, n2) => {
        const dx = n2.x - n1.x, dy = n2.y - n1.y;
        const L2 = dx*dx + dy*dy;
        if (L2 < 1) return Math.hypot(p.x - n1.x, p.y - n1.y);
        const t = Math.max(0, Math.min(1, getTOnBeam(p, n1, n2)));
        return Math.hypot(p.x - (n1.x + t*dx), p.y - (n1.y + t*dy));
    };

    // 3. スラブ辺と梁の対応付け（マッピング：左右判定付き）
    const beamMapping = new Map();

    (fd.slabs || []).forEach((slab, sIdx) => {
        if (!slab.nodeIds || !slab.edgeLs) return;
        const nids = slab.nodeIds;
        for (let i = 0; i < nids.length; i++) {
            const p1 = fd.nodes[nids[i]];
            const p2 = fd.nodes[nids[(i + 1) % nids.length]];
            if (!p1 || !p2) continue;

            const edgeB = slab.edgeLs[i] || 0;
            const edgeSigma = slab.groundPressure || 20.0;
            if (edgeB <= 0) continue;

            // スラブの中心（平均座標）を側の判定に使用
            let centerX = 0, centerY = 0;
            nids.forEach(nid => { 
                const n = fd.nodes[nid];
                if (n) { centerX += n.x; centerY += n.y; }
            });
            centerX /= nids.length; centerY /= nids.length;

            allBeamRefs.forEach(b => {
                const bn1 = fd.nodes[b.n1];
                const bn2 = fd.nodes[b.n2];
                if (!bn1 || !bn2) return;

                const d1 = distToLine(p1, bn1, bn2);
                const d2 = distToLine(p2, bn1, bn2);

                if (d1 < 15 && d2 < 15) {
                    const t1 = getTOnBeam(p1, bn1, bn2);
                    const t2 = getTOnBeam(p2, bn1, bn2);
                    const minT = Math.max(0, Math.min(t1, t2));
                    const maxT = Math.min(1, Math.max(t1, t2));

                    if (maxT - minT > 0.005) {
                        // 外積によりスラブが梁のどちら側(1 or -1)にあるか判定
                        const bdx = bn2.x - bn1.x, bdy = bn2.y - bn1.y;
                        const vcx = centerX - bn1.x, vcy = centerY - bn1.y;
                        const cross = bdx * vcy - bdy * vcx;
                        const side = cross >= 0 ? 1 : -1;

                        if (!beamMapping.has(b)) beamMapping.set(b, []);
                        beamMapping.get(b).push({
                            minT, maxT, B: edgeB, sigma: edgeSigma, side
                        });
                    }
                }
            });
        }
    });

    // 4. 各梁に対して、スパンごとの詳細集計を実施
    allBeamRefs.forEach(b => {
        const edges = beamMapping.get(b) || [];
        const supports = window.findSupportsOnBeam ? window.findSupportsOnBeam(b, fd.nodes, fd.columns) : [];
        
        const spanLoads = [];
        let cursorT = 0;

        for (let i = 0; i <= supports.length; i++) {
            const sT = cursorT;
            const eT = (i === supports.length) ? 1.0 : supports[i].t;
            if (eT - sT < 0.005) { 
                cursorT = Math.max(cursorT, eT);
                continue; 
            }

            const spanLen = eT - sT;

            // 左右（side: 1 or -1）ごとに寄与スラブを分離
            const sideConts = { "1": [], "-1": [] };
            edges.forEach(edge => {
                const overlapStart = Math.max(sT, edge.minT);
                const overlapEnd = Math.min(eT, edge.maxT);
                const overlapLen = Math.max(0, overlapEnd - overlapStart);
                if (overlapLen > 1e-4) {
                    sideConts[edge.side].push({ ...edge, overlapLen });
                }
            });

            let combinedB = 0;
            let weightedSigmaSum = 0;

            [1, -1].forEach(sideKey => {
                const contribs = sideConts[sideKey];
                if (contribs.length === 0) return;

                let sideB = 0;
                let sideSigma = 0;

                if (contribs.length === 1) {
                    // 1枚のスラブにのみ接する場合：亀甲分割の算出結果をそのまま採用
                    sideB = contribs[0].B;
                    sideSigma = contribs[0].sigma;
                } else {
                    // 複数のスラブが連続する場合：スパン長で按分（均し）
                    let sideSumBLen = 0;
                    let sideSumSigmaBLen = 0;
                    contribs.forEach(c => {
                        sideSumBLen += (c.B * c.overlapLen);
                        sideSumSigmaBLen += (c.sigma * c.B * c.overlapLen);
                    });
                    sideB = sideSumBLen / spanLen;
                    sideSigma = sideSumBLen > 0 ? (sideSumSigmaBLen / sideSumBLen) : 0;
                }

                combinedB += sideB;
                weightedSigmaSum += (sideSigma * sideB);
            });

            const finalSigma = combinedB > 0 ? (weightedSigmaSum / combinedB) : 0;
            spanLoads.push({ sT, eT, B: combinedB, sigma_e: finalSigma });
            cursorT = eT;
        }

        b.spanLoads = spanLoads;

        if (spanLoads.length > 0) {
            const representative = spanLoads.reduce((prev, curr) => (curr.B > prev.B) ? curr : prev, spanLoads[0]);
            b.tributaryWidth = representative.B;
            b.B = representative.B;
            b.groundPressure = representative.sigma_e;
            b.sigma_e = representative.sigma_e;
        }
    });

    // 5. クロールアップと後続処理
    if (window.cleanupOverlappingBeams) { window.cleanupOverlappingBeams(fd); }
    if (currentFloor === '1' && window.updateAllBeamsShortTermStress) {
        window.updateAllBeamsShortTermStress(fd);
    }
    if (typeof callRender === 'function') callRender();
};


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

window.calcBeamResult = function(beam) {
  let Lo=beam.length_m||2, B=beam.tributaryWidth||0, sigma=beam.groundPressure||0;
  const fd = floorData[currentFloor];
  
  if (beam.type === 'foundation_beam' && fd) {
    const n1 = fd.nodes[beam.n1], n2 = fd.nodes[beam.n2];
    if (n1 && n2) Lo = Math.hypot(n2.x - n1.x, n2.y - n1.y) / 1000;
  }

  const stress = (beam.type === 'foundation_beam' && fd) ? window.computeBeamStress(fd, beam) : null;
  
  // スパンごとの計算結果がある場合は、その中の最大値を「代表値」として採用
  let w = sigma * B;
  let Mmid = beam.Mc || (w * Lo * Lo) / 8;
  let Mend = Math.max(beam.M1 || 0, beam.M2 || 0) || (w * Lo * Lo) / 12;
  let Q = (w * Lo) / 2;

  if (stress) {
    Mmid = stress.Mc || Mmid;
    Mend = Math.max(stress.M1 || 0, stress.M2 || 0) || Mend;
    Q = Math.max(stress.Q1 || 0, stress.Q2 || 0) || Q;
    // 荷重wについてもスパン間の最大値を採用
    if (stress.spans && stress.spans.length > 0) {
      w = Math.max(...stress.spans.map(s => s.w_slab + (stress.w_self || 0)));
    }
  }
  
  const at_t = window.getRebarArea(beam.topRebar || '2-D13');
  const at_b = window.getRebarArea(beam.bottomRebar || '2-D13');
  const aw = window.getRebarArea(beam.stirrupRebar || 'D10');
  const s = beam.stirrupPitch || 200;
  const bw = beam.width || 300;
  const depth = beam.depth || 640;
  const dt = beam.dt || 70;
  const ft = beam.ft || 195;
  const fts = beam.fts || 295;
  const fs = beam.fs || 0.7;
  const fss = beam.fss || 1.05;

  // 統一された計算ロジックを呼び出す
  const material = { ft, fs, fts, fss };
  const resStrength = window.calculateSpanStrength({ D: depth, b: bw, dt, at: at_t, aw, pitch: s, alpha: 1.0 }, material);
  const resStrengthBot = window.calculateSpanStrength({ D: depth, b: bw, dt, at: at_b, aw, pitch: s, alpha: 1.0 }, material);

  return { 
    Lo, B, sigma, w_load: w, M_mid: Mmid, M_end: Mend, Q_L: Q, 
    at_top: at_t, at_bot: at_b, b_width: bw, d_depth: resStrength.d, j: resStrength.j, ft: ft,
    Ma_top: resStrength.Ma, Ma_bot: resStrengthBot.Ma, Qa: resStrength.Qa 
  };
};

window.closeBeamStressPopup = () => document.getElementById('beamStressModal')?.remove();
window.updateBeamRebar = (type, index) => {
  const beam = type === 'beam' ? floorData[currentFloor].beams[index] : floorData[currentFloor].perimeterBeams[index];
  beam.width = parseFloat(document.getElementById('inp_w').value) || 150;
  beam.depth = parseFloat(document.getElementById('inp_d').value) || 640;
  beam.topRebar = document.getElementById('inp_topBar').value;
  beam.bottomRebar = document.getElementById('inp_botBar').value;
  window.handlePropChange(type, index, 'width', beam.width);
  window.handlePropChange(type, index, 'depth', beam.depth);
  window.handlePropChange(type, index, 'topRebar', beam.topRebar);
  window.handlePropChange(type, index, 'bottomRebar', beam.bottomRebar);
  window.openBeamStressPopup?.(type, index);
};
window.updateStirrup = (type, index) => {
  const beam = type === 'beam' ? floorData[currentFloor].beams[index] : floorData[currentFloor].perimeterBeams[index];
  beam.stirrupRebar = document.getElementById('inp_stp').value;
  beam.stirrupPitch = parseInt(document.getElementById('inp_pitch').value) || 200;
  window.handlePropChange(type, index, 'stirrupRebar', beam.stirrupRebar);
  window.handlePropChange(type, index, 'stirrupPitch', beam.stirrupPitch);
  window.openBeamStressPopup?.(type, index);
};

window.drawBeamStressCanvas = (cid,res) => {
  const cv=typeof cid==='string'?document.getElementById(cid):cid; if(!cv)return;
  const ctx=cv.getContext('2d'),w=cv.width,h=cv.height; ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='#555'; ctx.beginPath(); ctx.moveTo(30,h/2); ctx.lineTo(w-30,h/2); ctx.stroke();
  if(res.M_mid>0||res.M_end>0){
    ctx.beginPath(); ctx.strokeStyle='#3498db'; ctx.lineWidth=2; const sm=(h/2-20)/Math.max(res.M_mid*2,res.M_end*1.5,1);
    ctx.moveTo(30,h/2-res.M_end*sm); ctx.quadraticCurveTo(w/2,h/2+res.M_mid*sm*2,w-30,h/2-res.M_end*sm); ctx.stroke();
    ctx.fillStyle='#fff'; ctx.font='10px monospace'; ctx.fillText('端M='+res.M_end.toFixed(1),30,h/2-res.M_end*sm-5); ctx.fillText('中M='+res.M_mid.toFixed(1),w/2-25,h/2+res.M_mid*sm+15);
  }
};
window.updateGlobalDesignSettings = function() {
  const fcSelect = document.getElementById('globalFc');
  const sdSelect = document.getElementById('globalSD');
  if (!fcSelect || !sdSelect) return;

  const fcVal = parseInt(fcSelect.value) || 21;
  const sdVal = parseInt(sdSelect.value) || 295;
  
  const fd = floorData['1'];
  if (!fd) return;
  
  fd.globalFc = fcVal;
  fd.globalSD = sdVal;

  // Fc に応じた許容応力度 (長期)
  const fc_long = fcVal / 3.0;
  const fs_long = fcVal / 30.0;
  
  // SD に応じた許容応力度
  const ft_long = sdVal === 345 ? 215 : 195;
  const ft_short = sdVal === 345 ? 345 : 295;

  const updateBeam = (b) => {
    b.ft = ft_long;
    b.fts = ft_short;
    b.fc = fc_long;
    b.fs = fs_long;
    // 短期は長期の1.5倍
    b.fcs = fc_long * 1.5;
    b.fss = fs_long * 1.5;
  };

  if (fd.beams) fd.beams.forEach(updateBeam);
  if (fd.perimeterBeams) fd.perimeterBeams.forEach(updateBeam);

  console.log(`[Global Settings] Updated: Fc=${fcVal}, SD=${sdVal} -> ft=${ft_long}, fs=${fs_long}`);
  
  // 再計算のトリガー
  if (window.syncSlabDataToBeams) {
    window.syncSlabDataToBeams(); 
  } else if (window.updateAllBeamsShortTermStress) {
    window.updateAllBeamsShortTermStress(fd);
  }
  
  if (typeof window.callRender === 'function') window.callRender();
  if (typeof window.updatePropertyPanel === 'function') window.updatePropertyPanel();
  if (typeof window.updateDataList === 'function') window.updateDataList();
};
