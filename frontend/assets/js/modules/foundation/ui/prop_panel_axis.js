/**
 * ui/prop_panel_axis.js
 */
import { handlePropChange } from '../state_manager.js';

/**
 * 通り芯（Axis）のプロパティパネルを構築する
 */
export function buildAxisPanel(el) {
  if (!el || el.type !== 'axis') return '';
  
  // selectedElement.index = { dir: 'v'|'h'|'s', index: number }
  const dir = el.index.dir;
  const idx = el.index.index;
  const axis = el.data || {};
  
  if (!axis) return '<p style="padding:10px; color:#888;">軸データが見つかりません</p>';

  const axisTypeLabel = dir === 'v' ? '垂直軸 (X)' : (dir === 'h' ? '水平軸 (Y)' : '斜め軸');

  return `
    <div style="padding:12px;">
      <div style="color:var(--accent); font-weight:bold; font-size:13px; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
        <i class="fas fa-arrows-alt"></i> ${axisTypeLabel} プロパティ
      </div>
      
      <div class="prop-group" style="margin-bottom:15px;">
        <label style="display:block; font-size:11px; color:#888; margin-bottom:4px;">ラベル</label>
        <div style="display:flex; gap:5px;">
          <input type="text" id="axisLabelInput" value="${axis.label || ''}" 
                 style="flex:1; background:var(--bg-input); border:1px solid var(--border); color:#fff; padding:5px; border-radius:4px;"
                 onchange="window.renameAxis('${dir}', ${idx}, this.value)">
        </div>
      </div>

      <div class="prop-group" style="margin-bottom:15px;">
        <label style="display:block; font-size:11px; color:#888; margin-bottom:4px;">座標 (mm)</label>
        <input type="number" value="${axis.x !== undefined ? axis.x : (axis.y !== undefined ? axis.y : '-')}" 
               style="width:100%; background:var(--bg-input); border:1px solid var(--border); color:#fff; padding:5px; border-radius:4px;"
               readonly>
      </div>

      <div class="prop-group" style="margin-bottom:15px; padding:10px; background:rgba(255,255,255,0.05); border-radius:4px; border:1px dashed #555;">
        <label style="display:block; font-size:11px; color:var(--accent); margin-bottom:6px; font-weight:bold;">✨ 通りを追加 (オフセット)</label>
        <div style="display:flex; gap:5px; align-items:center;">
          <input type="number" id="axisOffsetDist" placeholder="距離(mm)" value="910" 
                 style="flex:1; background:var(--bg-input); border:1px solid var(--border); color:#fff; padding:5px; border-radius:4px; font-size:12px;">
          <button onclick="window.addAxisNear('${dir}', ${idx}, document.getElementById('axisOffsetDist').value)" 
                  style="background:var(--success); color:#fff; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:11px; white-space:nowrap;">
            <i class="fas fa-plus"></i> 追加
          </button>
        </div>
        <p style="font-size:9px; color:#aaa; margin-top:5px;">※ 負の値で反対側に追加</p>
      </div>

      <div style="margin-top:20px; padding-top:10px; border-top:1px solid #444;">
        <button onclick="window.deleteAxis('${dir}', ${idx})" 
                style="width:100%; background:#c0392b; color:#fff; border:none; padding:8px; border-radius:4px; cursor:pointer; font-size:12px;">
          <i class="fas fa-trash-alt"></i> この通りを削除
        </button>
      </div>
    </div>
  `;
}

window.buildAxisPanel = buildAxisPanel;
