import { floorData, currentFloor, pushHistory } from './foundation_cad.js';
import { 
    normalizeWall, normalizeColumn, normalizeBeam, 
    normalizeSlab, normalizeDiaphragm 
} from './data/data_normalizer.js';
import AppEventBus from './core/event_bus.js';
import { 
  syncSlabDataToBeams, recalcAllTributaries 
} from './core/data_synchronizer.js';

export const handlePropChange = (type, arg2, arg3, arg4) => {
    let index, prop, value;

    // 4引数(旧形式)と3引数(新形式)の判定
    if (arg4 !== undefined) {
        index = arg2; prop = arg3; value = arg4;
    } else {
        const { selectedElement } = window.state || {};
        if (!selectedElement || selectedElement.type !== type) return;
        index = selectedElement.index; prop = arg2; value = arg3;
    }

    const fd = (typeof floorData !== 'undefined' ? floorData : window.floorData)[currentFloor];
    if (!fd) return;

    let targetArray = null;
    let normalizeFn = null;

    if (['slab', 'slabs'].includes(type)) {
        targetArray = fd.slabs;
        normalizeFn = normalizeSlab;
    } else if (['beam', 'beams', 'perimeterBeam', 'perimeterbeam'].includes(type)) {
        targetArray = (type === 'perimeterBeam' || type === 'perimeterbeam') ? fd.perimeterBeams : fd.beams;
        normalizeFn = normalizeBeam;
    } else if (['column', 'columns'].includes(type)) {
        targetArray = fd.columns;
        normalizeFn = normalizeColumn;
    } else if (['wall', 'walls'].includes(type)) {
        targetArray = fd.walls;
        normalizeFn = normalizeWall;
    } else if (['diaphragm', 'diaphragms'].includes(type)) {
        targetArray = fd.diaphragms;
        normalizeFn = normalizeDiaphragm;
    }

    if (!targetArray || !targetArray[index]) return;
    
    // --- プロパティ更新 ---
    const targetObj = targetArray[index];

    // スラブの辺条件などは特殊処理
    if (type === 'slab' && typeof prop === 'string' && prop.startsWith('edgeCondition_')) {
        const edgeIndex = parseInt(prop.split('_')[1], 10);
        if (!targetObj.edgeConditions) targetObj.edgeConditions = [];
        targetObj.edgeConditions[edgeIndex] = value;
    } else {
        targetObj[prop] = value;
        
        // 特殊な連動ロジック
        if (prop === 'axisName') targetObj['axis'] = value;
        
        if (type === 'wall' && prop === 'heightOverride') {
            const n1 = targetObj.n1, n2 = targetObj.n2;
            if (fd.columns) {
                fd.columns.forEach(col => {
                    if (col.nodeIndex === n1 || col.nodeIndex === n2) {
                        col.heightOverride = value;
                        fd.columns[fd.columns.indexOf(col)] = normalizeColumn(col);
                    }
                });
            }
        }

        // 💡 基礎梁の span プロパティも同期する（モーダルとの不整合修正）
        if (['beam', 'perimeterBeam', 'perimeterbeam'].includes(type) && targetObj.spans) {
            targetObj.spans.forEach(span => {
                if (prop === 'width') span.b = parseFloat(value) || span.b;
                if (prop === 'depth') span.D = parseFloat(value) || span.D;
                if (prop === 'dt') span.dt = parseFloat(value) || span.dt;
                if (prop === 'topRebar') span.topRebar = value;
                if (prop === 'bottomRebar') span.bottomRebar = value;
                if (prop === 'stirrupRebar') span.stirrup = value;
                if (prop === 'stirrupPitch') span.pitch = parseFloat(value) || span.pitch;
            });
            if (!targetObj.spanProps) targetObj.spanProps = [];
            targetObj.spans.forEach((span, i) => {
                if (!targetObj.spanProps[i]) targetObj.spanProps[i] = {};
                Object.assign(targetObj.spanProps[i], span);
            });
        }
    }

    // --- データの健全化（正規化）の実行 ---
    if (normalizeFn) {
        targetArray[index] = normalizeFn(targetObj);
    }

    // --- UI更新と履歴保存 ---
    AppEventBus.emit('ELEMENT_CHANGED', { type, index, prop, value });

    if (typeof window.pushHistory === 'function') window.pushHistory();
    else if (typeof pushHistory === 'function') pushHistory();

    AppEventBus.emit('DATA_SYNC_REQUIRED', { type, fd });
    AppEventBus.emit('UI_REFRESH_REQUIRED', { type, index });
    
    // スラブモーダルの再描画（スクロール位置保持）
    const existingModal = document.getElementById('slab-modal-overlay');
    if (existingModal && typeof window.openSlabDetailModal === 'function' && window.highlightedSlabIndex === index) {
        const scrollArea = existingModal.querySelector('div[style*="overflow"]');
        const scrollTop = scrollArea ? scrollArea.scrollTop : 0;
        window.openSlabDetailModal(index);
        const newModal = document.getElementById('slab-modal-overlay');
        if (newModal) {
            const newScrollArea = newModal.querySelector('div[style*="overflow"]');
            if (newScrollArea) newScrollArea.scrollTop = scrollTop;
        }
    }

    // スラブ断面検定エディタの再描画
    const existingEditor = document.getElementById('slab-editor-modal');
    if (existingEditor && typeof window.openSlabEditor === 'function') {
        window.openSlabEditor(index);
    }

    // 💡 柱詳細モーダルの再描画（追加）
    const existingColModal = document.getElementById('column-modal-overlay');
    if (existingColModal && typeof window.openColumnDetailModal === 'function' && type === 'column') {
        window.openColumnDetailModal(index);
    }
};

/** 通り芯(軸)ごとの手動補正値を更新する */
export const handleAxisOverrideChange = function(colIndex, axisName, dir, value) {
    const fd = floorData[currentFloor];
    if (!fd || !fd.columns || !fd.columns[colIndex]) return;
    
    const col = fd.columns[colIndex];
    if (!col.axisOverrides) col.axisOverrides = {};
    if (!col.axisOverrides[axisName]) col.axisOverrides[axisName] = {};
    
    // 💡 空文字なら null（自動計算へ戻す）、そうでなければ数値化
    const val = (value === '' || value === undefined) ? null : parseFloat(value);
    col.axisOverrides[axisName][dir] = isNaN(val) ? null : val;
    
    // 履歴保存とUI更新
    if (typeof window.pushHistory === 'function') window.pushHistory();
    if (typeof window.updatePropertyPanel === 'function') {
        requestAnimationFrame(() => window.updatePropertyPanel());
    }
    
    // モーダル再描画
    if (typeof window.openColumnDetailModal === 'function') {
        window.openColumnDetailModal(colIndex);
    }
};
window.handleAxisOverrideChange = handleAxisOverrideChange;

// 互換レイヤー（ポップアップ・モーダル内のハンドラを新パイプラインへ繋ぐ）
export const updateSlabFromModal = (index, prop, element) => {
    let val;
    // チェックボックスの場合は checked の状態を取得
    if (element && element.type === 'checkbox') {
        val = element.checked;
    } else {
        // 通常の input や select の場合は value を取得（文字列の場合はそのまま）
        val = (element && element.value !== undefined) ? element.value : element;
    }
    handlePropChange('slab', index, prop, val);
};

/**
 * リストアイテム選択時の処理
 */
export const selectListItem = function(type, index) {
  state.selectedElement = { type: type, index: index };
  state.selectedElements = [{ type: type, index: index }];
  state.shouldScrollList = true; // 💡 選択時はスクロールさせる
  
  const visIdMap = { 
    column:'vis-col', beam:'vis-beam', perimeterbeam:'vis-fbeam', perimeterBeam:'vis-fbeam', 
    slab:'vis-slab', diaphragm:'vis-diaph', wall:'vis-wall' 
  };
  const visId = visIdMap[type];
  if (visId) {
    const el = document.getElementById(visId);
    if (el && !el.checked) { 
      el.checked = true; 
      // dispatchEvent を使うと callRender 等が走るはず
      el.dispatchEvent(new Event('change')); 
    }
  }

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
  callRender();
};

/**
 * リスト表示のタブ切り替え
 */
export const switchMenuTab = function(btn) {
  document.querySelectorAll('[data-list]').forEach(b => b.classList.remove('active'));
  if (btn && btn.classList) {
    btn.classList.add('active');
    state.currentListTab = btn.dataset.list;
  }
  if (typeof window.updateDataList === 'function') window.updateDataList();
};

// グローバル登録（既存HTMLの onclick/onchange 互換）
/**
 * 階高の更新
 */
export const updateFloorHeight = function(floorKey, val) {
  const fd = floorData[floorKey];
  if (fd) {
    fd.floorHeight = parseInt(val) || 2730;
    AppEventBus.emit('DATA_SYNC_REQUIRED', { type: 'floor_height', floorKey });
    AppEventBus.emit('UI_REFRESH_REQUIRED', { type: 'floor_height' });
  }
};

/**
 * 全階高入力欄の値を現在のデータに同期する
 */
export const updateAllFloorHeightInputs = function() {
  if (!floorData) return;
  ['PH', 'R', '3', '2', '1'].forEach(f => {
    const input = document.getElementById(`defaultHeight-${f}`);
    if (input && floorData[f]) {
      input.value = floorData[f].floorHeight || 2730;
    }
  });
};

/**
 * 全体設計条件の更新
 */
export const updateGlobalDesignSettings = function() {
  const fcSelect = document.getElementById('globalFc');
  const sdSelect = document.getElementById('globalSD');
  if (!fcSelect || !sdSelect) return;

  const fcVal = parseInt(fcSelect.value) || 21;
  const sdVal = parseInt(sdSelect.value) || 295;
  
  const fd = floorData['1'];
  if (!fd) return;
  
  fd.globalFc = fcVal;
  fd.globalSD = sdVal;

  const fc_long = fcVal / 3.0;
  const fs_long = fcVal / 30.0;
  const ft_long = sdVal === 345 ? 215 : 195;
  const ft_short = sdVal === 345 ? 345 : 295;

  const updateBeam = (b) => {
    b.ft = ft_long;
    b.fts = ft_short;
    b.fc = fc_long;
    b.fs = fs_long;
    b.fcs = fc_long * 1.5;
    b.fss = fs_long * 1.5;
  };

  if (fd.beams) fd.beams.forEach(updateBeam);
  if (fd.perimeterBeams) fd.perimeterBeams.forEach(updateBeam);

  console.log(`[Global Settings] Updated: Fc=${fcVal}, SD=${sdVal} -> ft=${ft_long}, fs=${fs_long}`);
  
  AppEventBus.emit('DATA_SYNC_REQUIRED', { type: 'global_settings', fd });
  AppEventBus.emit('UI_REFRESH_REQUIRED', { type: 'global_settings' });
};

/**
 * 構面共通仕様の更新
 */
export const updateGlobalDiaphragmSpecs = function(floorKey, subType, val) {
  const fd1 = floorData['1'];
  if (!fd1) return;
  
  if (!fd1.globalDiaphragmSpecs) {
    fd1.globalDiaphragmSpecs = {
      'PH': { roof: 1.96, floor: 7.84 },
      'R':  { roof: 1.96, floor: 7.84 },
      '3':  { roof: 1.96, floor: 7.84 },
      '2':  { roof: 1.96, floor: 7.84 },
      '1':  { roof: 1.96, floor: 7.84 }
    };
  }
  
  const parsed = parseFloat(val);
  if (!isNaN(parsed)) {
    fd1.globalDiaphragmSpecs[floorKey][subType] = parsed;
  }
  
  AppEventBus.emit('UI_REFRESH_REQUIRED', { type: 'diaph_specs' });
};

/**
 * 構面共通仕様入力欄の同期
 */
export const updateAllDiaphragmSpecsInputs = function() {
  const fd1 = floorData['1'];
  if (!fd1) return;

  const fcSelect = document.getElementById('globalFc');
  if (fcSelect && fd1.globalFc) fcSelect.value = fd1.globalFc;
  
  const sdSelect = document.getElementById('globalSD');
  if (sdSelect && fd1.globalSD) sdSelect.value = fd1.globalSD;

  if (!fd1.globalDiaphragmSpecs) return;
  
  ['PH', 'R', '3', '2', '1'].forEach(f => {
    const spec = fd1.globalDiaphragmSpecs[f];
    if (!spec) return;
    
    const roofInp = document.getElementById(`diaphQa-${f}-roof`);
    if (roofInp) roofInp.value = spec.roof;
    
    const floorInp = document.getElementById(`diaphQa-${f}-floor`);
    if (floorInp) floorInp.value = spec.floor;
  });
};

/**
 * アンカーボルトのプロパティ更新（axisName 単位）
 */
export const updateAnchorBoltProp = function(axisName, field, value) {
  if (!axisName) return;
  const fd = floorData[currentFloor];
  if (!fd.anchorBolts) fd.anchorBolts = {};
  if (!fd.anchorBolts[axisName]) {
    fd.anchorBolts[axisName] = { species: 'J1', m12: 0, m16: 0 };
  }
  
  if (field === 'species') fd.anchorBolts[axisName].species = value;
  if (field === 'm12') fd.anchorBolts[axisName].m12 = parseInt(value) || 0;
  if (field === 'm16') fd.anchorBolts[axisName].m16 = parseInt(value) || 0;
  
  AppEventBus.emit('UI_REFRESH_REQUIRED', { type: 'anchor_bolt' });
};

/**
 * デフォルトプロパティの更新
 */
export const updateDefaultProperty = function(type, key, val) {
  if (defaultProperties[type]) {
    let parsed = val;
    const numericProps = ['multiplier', 'nw', 'width', 'depth', 'stirrupPitch', 'dt', 'groundPressure', 'triangleMultiplier', 'Qa'];
    if (numericProps.includes(key)) {
      parsed = parseFloat(val) || 0;
    }
    defaultProperties[type][key] = parsed;
    
    // state側の互換プロパティも更新
    if (type === 'wall' && key === 'multiplier') state.defaultWallMultiplier = parsed;
    if (type === 'wall' && key === 'axisName') state.defaultWallAxisName = parsed;
    
    console.log(`[DefaultProp] Updated ${type}.${key} = ${parsed}`);
  }
};

/**
 * 壁の標準倍率の更新
 */
/**
 * 壁の標準倍率の更新
 */
export const updateDefaultWallMultiplier = function(val) {
  const parsed = parseFloat(val);
  if (state && !isNaN(parsed)) {
    state.defaultWallMultiplier = Math.min(7.0, Math.max(0, parsed));
  }
};

// Side effects are handled via global window calls or direct calls where appropriate
const callRender = () => { if(typeof window.callRender === 'function') window.callRender(); };
const updatePropertyPanel = () => { if(typeof window.updatePropertyPanel === 'function') window.updatePropertyPanel(); };
const updateDataList = () => { if(typeof window.updateDataList === 'function') window.updateDataList(); };

/**
 * 複数選択された要素のプロパティを一括変更する
 */
export const handleMultiPropChange = function(field, value) {
  if (state && state.selectedElements) {
    state.selectedElements.forEach(({type, index}) => {
      handlePropChange(type, index, field, value);
    });
  }
  AppEventBus.emit('UI_REFRESH_REQUIRED', { type: 'multi_select' });
};
