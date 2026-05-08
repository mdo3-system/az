// state_manager.js - 状態変更とデータ同期の一元管理
import { floorData, currentFloor, pushHistory } from './foundation_cad.js';

export const handlePropChange = (type, arg2, arg3, arg4) => {
    let index, prop, value;

    // 4引数(旧形式)と3引数(新形式)の判定
    if (arg4 !== undefined) {
        // 旧形式: handlePropChange(type, index, prop, value)
        index = arg2;
        prop = arg3;
        value = arg4;
    } else {
        // 新形式: handlePropChange(type, prop, value) ※indexは選択中のものを自動取得
        const { selectedElement } = window.state || {};
        if (!selectedElement || selectedElement.type !== type) return;
        index = selectedElement.index;
        prop = arg2;
        value = arg3;
    }

    const fd = (typeof floorData !== 'undefined' ? floorData : window.floorData)[currentFloor];
    if (!fd) return;

    let targetArray = null;
    if (['slab', 'slabs'].includes(type)) {
        targetArray = fd.slabs;
    } else if (['beam', 'beams', 'perimeterBeam', 'perimeterbeam'].includes(type)) {
        targetArray = (type === 'perimeterBeam' || type === 'perimeterbeam') ? fd.perimeterBeams : fd.beams;
    } else if (['column', 'wall', 'diaphragm'].includes(type)) {
        const key = type === 'diaphragm' ? 'diaphragms' : `${type}s`;
        targetArray = fd[key];
    }

    if (!targetArray || !targetArray[index]) return;
    const targetObj = targetArray[index];

    // --- プロパティ保存処理 ---
    if (type === 'slab') {
        if (typeof prop === 'string' && prop.startsWith('edgeCondition_')) {
            const edgeIndex = parseInt(prop.split('_')[1], 10);
            if (!targetObj.edgeConditions) targetObj.edgeConditions = [];
            targetObj.edgeConditions[edgeIndex] = value;
        } 
        else if (prop === 'thickness' || prop === 'D' || prop === 't') {
            targetObj.thickness = targetObj.D = targetObj.t = parseFloat(value) || 0;
        }
        else if (prop === 'id' || prop === 'shortRebar' || prop === 'longRebar' || prop === 'rebarX' || prop === 'rebarY') {
            targetObj[prop] = value;
        } 
        else if (prop === 'shortPitch' || prop === 'longPitch' || prop === 'level' || prop === 'dt' || prop === 'groundPressure' || prop === 'thickness' || prop === 'ft') {
            targetObj[prop] = parseFloat(value) || 0;
        } 
        else if (prop === 'supportCondition') {
            targetObj[prop] = value;
            // 💡 支持条件の一括設定に合わせて個別辺の条件も同期させる
            if (value === '4辺固定') {
                targetObj.edgeConditions = Array((targetObj.nodeIds || []).length).fill('fixed');
            } else if (value === '4辺ピン') {
                targetObj.edgeConditions = Array((targetObj.nodeIds || []).length).fill('pin');
            }
        } else {
            targetObj[prop] = value;
        }
    } else {
        let parsedValue = value;
        // 💡 BUGFIX: stringProps に 'axis' およびスラブ用上下筋を追加
        const stringProps = [
            'name', 'id', 'shortRebar', 'longRebar', 'topRebar', 'bottomRebar', 
            'shortTopRebar', 'shortBottomRebar', 'longTopRebar', 'longBottomRebar',
            'axisName', 'axis', 'top_metalId', 'base_metalId', 'startCondition', 'endCondition',
            'biSetting'
        ];
        if (typeof value === 'string' && !stringProps.includes(prop)) {
            const num = Number(value);
            if (!Number.isNaN(num)) parsedValue = num;
        }
        targetObj[prop] = parsedValue;
        
        // 💡 BUGFIX: axisName が更新されたら、応力計算用に axis も同時に書き換える
        if (prop === 'axisName') {
            targetObj['axis'] = parsedValue;
        }
    }

    // --- 依存する再計算のトリガー ---
    if (['slab', 'slabs'].includes(type)) {
        if (typeof window.syncSlabDataToBeams === 'function') window.syncSlabDataToBeams();
        
        // 💡 断面検定用の一元化ロジックを実行（aijDataのみを更新）
        if (typeof window.calculateAndSetSlabAIJStress === 'function') {
            window.calculateAndSetSlabAIJStress(targetObj, fd.nodes);
        }
    }

    // 基礎梁の応力再計算（水平荷重時）
    if (['beam', 'perimeterBeam', 'perimeterbeam'].includes(type)) {
        if (typeof window.updateAllBeamsShortTermStress === 'function') {
            window.updateAllBeamsShortTermStress(fd);
        }
    }

    // --- UI更新と履歴保存 ---
    if (typeof window.pushHistory === 'function') window.pushHistory();
    else if (typeof pushHistory === 'function') pushHistory();

    if (typeof window.callRender === 'function') window.callRender();
    if (typeof window.updatePropertyPanel === 'function') window.updatePropertyPanel();
    if (typeof window.updateDataList === 'function') window.updateDataList();
    
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
};

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

// グローバル登録（既存HTMLの onclick/onchange 互換）
window.handlePropChange = handlePropChange;
window.updateSlabFromModal = updateSlabFromModal;
