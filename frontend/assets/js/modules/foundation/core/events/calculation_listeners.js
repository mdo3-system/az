import AppEventBus from '../event_bus.js';
import { syncSlabDataToBeams, recalcAllTributaries } from '../data_synchronizer.js';
import { calculateAndSetSlabAIJStress } from '../slab_calc.js';
import { getCurrentFloorData } from '../../foundation_cad.js';

export const initCalculationListeners = () => {
    
    // 特定の要素プロパティ変更に対するリスナー
    AppEventBus.on('ELEMENT_CHANGED', ({ type, index }) => {
        if (['slab', 'slabs'].includes(type)) {
            const fd = getCurrentFloorData();
            const slab = fd.slabs[index];
            if (slab) {
                calculateAndSetSlabAIJStress(slab, fd.nodes);
            }
        }
    });

    // データ同期要求に対するリスナー
    AppEventBus.on('DATA_SYNC_REQUIRED', ({ type, fd, floorKey }) => {
        console.log(`[EventBus] DATA_SYNC_REQUIRED received for type: ${type}`);
        
        // スラブ変更時は梁への荷重同期をトリガー
        if (['slab', 'slabs', 'global_settings'].includes(type)) {
            syncSlabDataToBeams(fd);
        }

        // 基礎梁の変更時は短期応力更新をトリガー
        if (['beam', 'perimeterBeam', 'global_settings'].includes(type)) {
            if (typeof window.updateAllBeamsShortTermStress === 'function') {
                window.updateAllBeamsShortTermStress(fd);
            }
        }

        // 階高や全体的な変更時は全再計算をトリガー
        if (['floor_height', 'recalc_all'].includes(type)) {
            recalcAllTributaries();
        }
    });

};
