// ui/prop_panel_slab.js
import { generateOptions } from '../ui_utils.js';
import { handlePropChange } from '../state_manager.js';

/**
 * スラブ用のパネル
 */
export const buildSlabPanel = (el, fd) => {
    const index = el.index;
    const slab = fd.slabs[index];
    if (!slab) return '<p style="color:var(--text-muted);">スラブが見つかりません</p>';

    const t = slab.thickness || slab.D || slab.t || 150;
    const level = slab.level || 0;
    const dt = slab.dt !== undefined ? slab.dt : 70;
    const sR = slab.shortRebar || 'D13'; 
    const sP = slab.shortPitch || 200; 
    const lR = slab.longRebar || 'D13'; 
    const lP = slab.longPitch || 200; 
    const groundPressure = slab.groundPressure !== undefined ? slab.groundPressure : 30.0;
    const rebarList = ['D10', 'D13', 'D16', 'D10+D13', 'D13+D16'];

    let html = `
      <div class="prop-row"><span class="prop-label">種別</span><span style="color:#a78bfa; font-weight:600;">スラブ (Slab)</span></div>
      <div class="prop-row"><span class="prop-label">符号</span><input class="prop-value" value="${slab.id || ''}" onchange="window.handlePropChange('slab', ${index}, 'id', this.value)"></div>
      <div class="prop-row"><span class="prop-label">厚さ t(mm)</span><input class="prop-value" type="number" step="10" value="${t}" onchange="window.handlePropChange('slab', ${index}, 'thickness', this.value)"></div>
      <div class="prop-row"><span class="prop-label">天端レベル</span><input class="prop-value" type="number" step="10" value="${level}" onchange="window.handlePropChange('slab', ${index}, 'level', this.value)"></div>
      
      <hr style="border-color:#444; margin: 12px 0;">
      <div style="margin-bottom:8px;">
        <strong style="color:var(--text-secondary); font-size:11px;">構造・配筋設定</strong>
      </div>
      <div class="prop-row"><span class="prop-label">鉄筋重心 dt</span><input class="prop-value" type="number" step="5" value="${dt}" onchange="window.handlePropChange('slab', ${index}, 'dt', this.value)"></div>
      <div class="prop-row"><span class="prop-label">接地圧 σe</span>
        <div style="display:flex; align-items:center; gap:4px; flex:1;">
          <input class="prop-value" style="flex:1;" type="number" step="0.1" value="${groundPressure}" onchange="window.handlePropChange('slab', ${index}, 'groundPressure', this.value)">
          <span style="color:var(--text-muted); font-size:11px;">kN/m²</span>
        </div>
      </div>
      <div class="prop-row"><span class="prop-label">短辺方向鉄筋</span>
        <select class="prop-value" style="flex:1;" onchange="window.handlePropChange('slab', ${index}, 'shortRebar', this.value)">${generateOptions(rebarList, sR)}</select>
        <input class="prop-value" style="width:50px; text-align:right;" type="number" step="50" value="${sP}" onchange="window.handlePropChange('slab', ${index}, 'shortPitch', this.value)">
      </div>
      <div class="prop-row"><span class="prop-label">長辺方向鉄筋</span>
        <select class="prop-value" style="flex:1;" onchange="window.handlePropChange('slab', ${index}, 'longRebar', this.value)">${generateOptions(rebarList, lR)}</select>
        <input class="prop-value" style="width:50px; text-align:right;" type="number" step="50" value="${lP}" onchange="window.handlePropChange('slab', ${index}, 'longPitch', this.value)">
      </div>

      <hr style="border-color:#444; margin: 12px 0;">
      <div style="margin-bottom:8px;">
        <strong style="color:var(--accent); font-size:12px;">各辺の支持条件</strong>
      </div>
    `;

    if (slab.nodeIds && slab.nodeIds.length > 0) {
        for (let i = 0; i < slab.nodeIds.length; i++) {
            const cond = (slab.edgeConditions && slab.edgeConditions[i]) ? slab.edgeConditions[i] : 'fixed';
            html += `
            <div class="prop-row">
                <span class="prop-label">辺 ${i + 1} (B${i + 1})</span>
                <select class="prop-value" onchange="window.handlePropChange('slab', ${index}, 'edgeCondition_${i}', this.value)">
                    <option value="fixed" ${cond === 'fixed' ? 'selected' : ''}>固定端</option>
                    <option value="pin" ${cond === 'pin' ? 'selected' : ''}>ピン端</option>
                    <option value="free" ${cond === 'free' ? 'selected' : ''}>自由端</option>
                </select>
            </div>
            `;
        }
    }

    html += `
      <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
        <button style="width:100%; padding:8px; background:var(--success); color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.openSlabEditor(${index})">🧮 断面検定エディタを開く</button>
      </div>
    `;

    return html;
};

window.buildSlabPanel = buildSlabPanel;
