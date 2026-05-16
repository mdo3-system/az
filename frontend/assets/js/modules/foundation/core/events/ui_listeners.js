/**
 * core/events/ui_listeners.js
 * UIの更新要求（再描画、パネル更新等）を管理するイベントリスナー群
 */
import AppEventBus from '../event_bus.js';

export const initUIListeners = () => {
    
    // UI更新要求に対するリスナー
    AppEventBus.on('UI_REFRESH_REQUIRED', ({ type, index }) => {
        if (typeof window.callRender === 'function') window.callRender();
        
        if (typeof window.updatePropertyPanel === 'function') {
            requestAnimationFrame(() => window.updatePropertyPanel());
        }
        
        if (typeof window.updateDataList === 'function') {
            window.updateDataList();
        }

        // モーダル類の再描画が必要な場合、ここにロジックを集約可能
    });

};
