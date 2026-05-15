// ui/prop_panel_column.js
import { HARDWARE_MASTER } from '../core/constants.js';
import { calculateColumnT } from '../core/column_calc.js';
import { handlePropChange } from '../state_manager.js';

/**
 * 柱用のパネル
 */
export const buildColumnPanel = (el, fd) => {
  if (!fd || !fd.columns || !fd.nodes) return '<p style="color:red; padding:10px;">データ不整合: nodes/columns が見つかりません</p>';
  const index = el.index;
  const c = fd.columns[index];
  if (!c) return '<p style="color:#888; padding:10px;">選択された柱データが見つかりません</p>';
  const n = fd.nodes[c.nodeIndex];
  if (!n) return '<p style="color:#888; padding:10px;">交点データ (Node) が見つかりません</p>';
  
  return `
    <div style="margin-bottom:12px; font-size:12px;">
      <strong style="color:var(--success);">柱 (Column)</strong>
      <span style="color:var(--text-muted); margin-left:8px;">交点: ${n.id}</span>
    </div>
    <div style="margin-bottom:8px;">
      <div style="margin-bottom:4px; color:var(--text-secondary); font-size:11px;"><strong>符号:</strong></div>
      <input class="prop-value" style="width:100%;" value="${c.id || ''}" onchange="window.handlePropChange('column', ${index}, 'id', this.value)">
    </div>
    <div style="margin-bottom:8px;">
      <div style="margin-bottom:4px; color:var(--text-secondary); font-size:11px;"><strong>引張耐力検討用軸力 Nw (kN):</strong></div>
      <div style="display:flex; align-items:center; gap:4px;">
        <input class="prop-value" style="flex:1;" type="number" step="0.001" value="${(c.nw !== undefined ? parseFloat(c.nw) : (parseFloat(c.longTermAxial) || 0)).toFixed(3)}" onchange="window.handlePropChange('column', ${index}, 'nw', this.value)" placeholder="0.000">
        <span style="color:var(--text-muted); font-size:11px;">kN</span>
      </div>
    </div>

    <hr style="border-color:#444; margin:12px 0;">
    <div style="margin-bottom:12px;">
      <strong style="color:var(--accent); font-size:12px;">🔩 引抜・金物判定</strong>
    </div>

    <div style="display:flex; gap:8px; margin-bottom:12px;">
      <div style="flex:1;">
        <div style="margin-bottom:4px; color:var(--text-secondary); font-size:11px;"><strong>N値計算用 Bi係数:</strong></div>
        <select class="prop-value" style="width:100%;" onchange="window.handlePropChange('column', ${index}, 'biSetting', this.value)">
          <option value="auto" ${!c.biSetting || c.biSetting==='auto'?'selected':''}>自動判定</option>
          <option value="0.8" ${c.biSetting==='0.8'?'selected':''}>隅柱 (0.8)</option>
          <option value="0.5" ${c.biSetting==='0.5'?'selected':''}>中柱 (0.5)</option>
        </select>
      </div>
      <div style="flex:1;">
        <div style="margin-bottom:4px; color:var(--text-secondary); font-size:11px;"><strong>個別階高 Hi:</strong></div>
        <input class="prop-value" style="width:100%; border-color:${c.heightOverride ? 'var(--accent)' : 'var(--border)'};" 
               type="number" placeholder="自動(${fd.floorHeight || 2730})" 
               value="${c.heightOverride || ''}" 
               onchange="window.handlePropChange('column', ${index}, 'heightOverride', this.value)">
      </div>
    </div>

    <div style="margin-bottom:12px; padding:8px; background:rgba(231, 76, 60, 0.05); border:1px dashed rgba(231, 76, 60, 0.3); border-radius:4px;">
      <div style="margin-bottom:6px; color:var(--text-secondary); font-size:11px;"><strong>上階累積軸力 ΣNi (kN) [手入力]:</strong></div>
      <div style="display:flex; gap:6px;">
        <div style="flex:1;">
          <div style="font-size:9px; color:#aaa; margin-bottom:2px;">左加力(+)</div>
          <input class="prop-value" style="width:100%; border-color:${c.niUpperOverride_L ? '#e74c3c' : 'var(--border)'};" 
                 type="number" step="0.001" placeholder="加算" autocomplete="off" 
                 value="${c.niUpperOverride_L || ''}" 
                 onchange="window.handlePropChange('column', ${index}, 'niUpperOverride_L', this.value)">
        </div>
        <div style="flex:1;">
          <div style="font-size:9px; color:#aaa; margin-bottom:2px;">右加力(-)</div>
          <input class="prop-value" style="width:100%; border-color:${c.niUpperOverride_R ? '#e74c3c' : 'var(--border)'};" 
                 type="number" step="0.001" placeholder="加算" autocomplete="off" 
                 value="${c.niUpperOverride_R || ''}" 
                 onchange="window.handlePropChange('column', ${index}, 'niUpperOverride_R', this.value)">
        </div>
      </div>
    </div>

    <div style="margin-bottom:12px;">
      <div style="margin-bottom:4px; color:var(--text-secondary); font-size:11px;"><strong>基礎梁算定用 反曲点高比 B (0.5):</strong></div>
      <div style="display:flex; align-items:center; gap:8px;">
        <input class="prop-value" style="flex:1;" type="number" step="0.05" min="0" max="1.0" 
               value="${c.inflectionRatio !== undefined ? c.inflectionRatio : 0.5}" 
               onchange="window.handlePropChange('column', ${index}, 'inflectionRatio', this.value)">
        <span style="font-size:10px; color:var(--text-muted);">※Td算定に使用</span>
      </div>
    </div>

    ${(() => {
      const res = calculateColumnT(index, fd);
      const topOk = res.criticalCase?.isTopOk;
      const baseOk = res.criticalCase?.isBaseOk;
      
      const currentHardwareMaster = HARDWARE_MASTER || window.HARDWARE_MASTER || [];

      return `
        <div style="background:rgba(0,0,0,0.25); border-radius:6px; padding:10px; border:1px solid #484848; margin-bottom:10px;">
          <div style="font-size:11px; color:#aaa; margin-bottom:10px; border-bottom:1px solid #444; padding-bottom:4px;"><strong>柱頭 (Top) 金物設定</strong></div>
          <div class="prop-row">
            <span class="prop-label" style="width:60px;">選定</span>
            <select class="prop-value" style="flex:1;" onchange="window.handlePropChange('column', ${index}, 'top_metalMode', this.value)">
              <option value="auto" ${c.top_metalMode==='auto'?'selected':''}>自動選定</option>
              <option value="manual" ${c.top_metalMode==='manual'?'selected':''}>手動選定</option>
            </select>
          </div>
          <div style="display:${c.top_metalMode==='manual'?'block':'none'}; margin-top:6px; padding-left:8px; border-left:2px solid var(--accent);">
            <div class="prop-row">
              <span class="prop-label" style="width:60px;">金物</span>
              <select class="prop-value" style="flex:1;" onchange="window.handlePropChange('column', ${index}, 'top_metalId', this.value)">
                ${currentHardwareMaster.map(m => `<option value="${m.id}" ${c.top_metalId===m.id?'selected':''}>${m.name}</option>`).join('')}
              </select>
            </div>
            <div class="prop-row">
              <span class="prop-label" style="width:60px;">名称</span>
              <input type="text" class="prop-value" style="flex:1;" placeholder="${c.top_metalId==='custom'?'任意金物':(currentHardwareMaster.find(m=>m.id===c.top_metalId)?.name||'')}" value="${c.top_metalName || ''}" onblur="window.handlePropChange('column', ${index}, 'top_metalName', this.value)">
            </div>
            <div class="prop-row">
              <span class="prop-label" style="width:60px;">耐力(kN)</span>
              <input type="number" step="any" class="prop-value" style="flex:1;" value="${c.top_metalCap || 0}" onblur="window.handlePropChange('column', ${index}, 'top_metalCap', this.value)">
            </div>
          </div>
          <div style="margin-top:8px; padding:6px; background:rgba(0,0,0,0.2); border-radius:4px; border:1px solid ${topOk?'rgba(46,204,113,0.3)':'rgba(231,76,60,0.5)'};">
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:2px;">
              <span style="font-size:10px; color:var(--text-muted);">必要引力 T：</span>
              <span style="font-size:13px; font-weight:bold; color:${topOk?'#fff':'#ff7675'};">${(res.T_top || 0).toFixed(3)} <small style="font-size:9px; font-weight:normal;">kN</small></span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:baseline;">
              <span style="font-size:10px; color:var(--text-muted);">金物耐力 Ra：</span>
              <span style="font-size:11px; color:#aaa;">${(res.criticalCase?.topMetal?.cap || 0).toFixed(3)} <small style="font-size:9px;">kN</small></span>
            </div>
            <div style="margin-top:4px; text-align:right; font-size:11px; font-weight:bold; color:${topOk?'#2ecc71':'#ff4d4d'}; border-top:1px solid rgba(255,255,255,0.05); padding-top:4px;">
              ${topOk ? '✅ OK' : '❌ NG (耐力不足)'}
            </div>
          </div>
        </div>

        <div style="background:rgba(0,0,0,0.25); border-radius:6px; padding:10px; border:1px solid #484848; margin-bottom:10px;">
          <div style="font-size:11px; color:#aaa; margin-bottom:10px; border-bottom:1px solid #444; padding-bottom:4px;"><strong>柱脚 (Base) 金物設定</strong></div>
          <div class="prop-row">
            <span class="prop-label" style="width:60px;">選定</span>
            <select class="prop-value" style="flex:1;" onchange="window.handlePropChange('column', ${index}, 'base_metalMode', this.value)">
              <option value="auto" ${c.base_metalMode==='auto'?'selected':''}>自動選定</option>
              <option value="manual" ${c.base_metalMode==='manual'?'selected':''}>手動選定</option>
            </select>
          </div>
          <div style="display:${c.base_metalMode==='manual'?'block':'none'}; margin-top:6px; padding-left:8px; border-left:2px solid var(--accent);">
            <div class="prop-row">
              <span class="prop-label" style="width:60px;">金物</span>
              <select class="prop-value" style="flex:1;" onchange="window.handlePropChange('column', ${index}, 'base_metalId', this.value)">
                ${currentHardwareMaster.map(m => `<option value="${m.id}" ${c.base_metalId===m.id?'selected':''}>${m.name}</option>`).join('')}
              </select>
            </div>
            <div class="prop-row">
              <span class="prop-label" style="width:60px;">名称</span>
              <input type="text" class="prop-value" style="flex:1;" placeholder="${c.base_metalId=== 'custom'?'任意金物':(currentHardwareMaster.find(m=>m.id===c.base_metalId)?.name||'')}" value="${c.base_metalName || ''}" onblur="window.handlePropChange('column', ${index}, 'base_metalName', this.value)">
            </div>
            <div class="prop-row">
              <span class="prop-label" style="width:60px;">耐力(kN)</span>
              <input type="number" step="any" class="prop-value" style="flex:1;" value="${c.base_metalCap || 0}" onblur="window.handlePropChange('column', ${index}, 'base_metalCap', this.value)">
            </div>
          </div>
          <div style="margin-top:8px; padding:6px; background:rgba(0,0,0,0.2); border-radius:4px; border:1px solid ${baseOk?'rgba(46,204,113,0.3)':'rgba(231,76,60,0.5)'};">
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:2px;">
              <span style="font-size:10px; color:var(--text-muted);">必要引力 T：</span>
              <span style="font-size:13px; font-weight:bold; color:${baseOk?'#fff':'#ff7675'};">${(res.T || 0).toFixed(3)} <small style="font-size:9px; font-weight:normal;">kN</small></span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:baseline;">
              <span style="font-size:10px; color:var(--text-muted);">金物耐力 Ra：</span>
              <span style="font-size:11px; color:#aaa;">${(res.criticalCase?.baseMetal?.cap || 0).toFixed(3)} <small style="font-size:9px;">kN</small></span>
            </div>
            <div style="margin-top:4px; text-align:right; font-size:11px; font-weight:bold; color:${baseOk?'#2ecc71':'#ff4d4d'}; border-top:1px solid rgba(255,255,255,0.05); padding-top:4px;">
              ${baseOk ? '✅ OK' : '❌ NG (耐力不足)'}
            </div>
          </div>
        </div>

        <div style="margin-top:10px; padding:10px; background:rgba(0,100,60,0.12); border:1px solid rgba(0,200,120,0.3); border-radius:6px;">
          <div style="font-size:11px; color:#2ecc71; font-weight:bold; margin-bottom:8px;">🏗 基礎設計用データ</div>
          <div style="font-size:10.5px; color:var(--text-muted); line-height:1.9; font-family:'Roboto Mono', monospace;">
            <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
              <span>最大引抜力 T<sub>max</sub></span>
              <span style="color:#f39c12; font-weight:bold;">${(res.T || 0).toFixed(3)} kN</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span>最大押込み力 C<sub>max</sub></span>
              <span style="color:#3498db; font-weight:bold;">${(res.criticalCase ? (Math.abs(res.criticalCase.Ni_this) + Math.abs(res.criticalCase.Ni_upper) + res.Nw) : res.Nw).toFixed(3)} kN</span>
            </div>
          </div>
        </div>
      `;
    })()}
  `;
};

window.buildColumnPanel = buildColumnPanel;
