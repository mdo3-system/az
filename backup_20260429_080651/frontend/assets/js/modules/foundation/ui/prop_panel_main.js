// ui/prop_panel_main.js
import { floorData, currentFloor } from '../foundation_cad.js';
import { buildNodePanel } from './prop_panel_node.js';
import { buildColumnPanel } from './prop_panel_column.js';
import { buildBeamPanel } from './prop_panel_beam.js';
import { buildWallPanel } from './prop_panel_wall.js';
import { buildSlabPanel } from './prop_panel_slab.js';
import { buildDiaphragmPanel } from './prop_panel_diaphragm.js';
import { buildAxisPanel } from './prop_panel_axis.js';
import { buildMultiSelectPanel } from './prop_panel_multi.js';
import { buildDefaultToolPanel } from './prop_panel_default.js';

/**
 * プロパティパネル全体を更新・再描画する
 */
export const updatePropertyPanel = function() {
  const cont = document.getElementById('property-panel') || document.querySelector('.property-panel');
  if (!cont) return;

  const state = window.state || {};
  const fd = floorData[currentFloor];

  // スラブ詳細モーダル表示中（window.selectedType === 'SLAB'）以外なら、サイドバーを確実に見せる
  if (window.selectedType !== 'SLAB') {
    const sidebar = document.getElementById('right-sidebar');
    if (sidebar) sidebar.style.display = 'flex';
    cont.style.visibility = 'visible';
    cont.style.pointerEvents = 'auto';
  }

  // 要素未選択時の処理（ツールのデフォルト値を表示）
  if (!state.selectedElement && (!state.selectedElements || state.selectedElements.length === 0)) {
    cont.innerHTML = buildDefaultToolPanel(state.currentTool);
    return;
  }

  // 複数選択時の処理
  if (state.selectedElements && state.selectedElements.length >= 2) {
    cont.innerHTML = buildMultiSelectPanel(state.selectedElements);
    return;
  }

  // 単一選択時の処理
  const el = state.selectedElement;
  if (!el) return;

  let html = '';
  switch (el.type) {
    case 'node':          html = buildNodePanel(el, fd); break;
    case 'column':        html = buildColumnPanel(el, fd); break;
    case 'beam':      
    case 'perimeterBeam': html = buildBeamPanel(el, fd); break;
    case 'wall':          html = buildWallPanel(el, fd); break;
    case 'slab':          html = buildSlabPanel(el, fd); break;
    case 'diaphragm':     html = buildDiaphragmPanel(el, fd); break;
    case 'axis':          html = buildAxisPanel(el); break;
    default:              html = `<p style="color:#888; font-size:11px; padding:10px;">未対応の要素です (${el.type})</p>`;
  }

  cont.innerHTML = html;

  // UI生成後、必要に応じて再描画をキック
  if (typeof window.callRender === 'function') window.callRender();
};

window.updatePropertyPanel = updatePropertyPanel;
