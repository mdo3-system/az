// ui/modal_column.js
import { floorData, currentFloor } from '../foundation_cad.js';
import { makeDraggable } from '../ui_utils.js';
import { calculateColumnT } from '../core/column_calc.js';
import { HARDWARE_MASTER } from '../core/constants.js';
import { handlePropChange } from '../state_manager.js';
import { render as callRender } from '../rendering/view_manager.js';

/**
 * --- 1. 柱 (Column) モーダル ---
 */
export const openColumnDetailModal = function(index) {
  const existingModal = document.getElementById('column-modal-overlay');
  if (existingModal && existingModal.parentNode) existingModal.remove();

  if (window.state) window.state.selectedElement = { type: 'column', index };
  callRender();

  const fd = floorData[currentFloor];
  if (!fd || !fd.columns) return;
  const c = fd.columns[index];
  const n = fd.nodes[c.nodeIndex];
  if (!c || !n) return;

  const res = calculateColumnT(index, fd);
  const topOk = res.criticalCase?.isTopOk;
  const baseOk = res.criticalCase?.isBaseOk;

  const modal = document.createElement('div');
  modal.id = 'column-modal-overlay';
  modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); display:flex; justify-content:center; align-items:center; z-index:10000;';
  modal.addEventListener('click', (e) => {
      if (e.target === modal && modal.parentNode) modal.remove();
  });

  const metalOptions = (HARDWARE_MASTER || []).map(m => `<option value="${m.id}" ${c.top_metalId===m.id?'selected':''}>${m.name}</option>`).join('');
  const baseMetalOptions = (HARDWARE_MASTER || []).map(m => `<option value="${m.id}" ${c.base_metalId===m.id?'selected':''}>${m.name}</option>`).join('');

  const content = document.createElement('div');
  content.className = 'modal-content';
  content.style.cssText = 'width:95%; max-width:900px; max-height:90vh; background:#1e1e1e; color:#fff; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5); display:flex; flex-direction:column; overflow:hidden; border: 1px solid #444; position:fixed;';

  content.innerHTML = `
      <div id="column-modal-header" style="background:#2c3e50; padding:15px; border-bottom:1px solid #444; display:flex; justify-content:space-between; align-items:center; cursor:grab;">
        <h3 style="margin:0; font-size:16px; color:#fff; pointer-events:none;">柱 (${n.id}) - プロパティ詳細</h3>
        <button onclick="window.safeRemoveById('column-modal-overlay')" style="background:none; border:none; color:#ddd; font-size:24px; cursor:pointer;">&times;</button>
      </div>
      <div style="padding:20px; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="flex:1; margin-right:10px;">
            <label style="color:#aaa; font-size:12px;">符号:</label><br>
            <input value="${c.id || ''}" onchange="window.handlePropChange('column', ${index}, 'id', this.value)" style="width:100%; padding:6px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
          </div>
          <div style="width:100px; text-align:right;">
            <label style="color:#2ecc71; font-size:11px; cursor:pointer;">
              <input type="checkbox" ${c.showReport ? 'checked' : ''} onchange="window.handlePropChange('column', ${index}, 'showReport', this.checked)" style="vertical-align:middle;"> 帳票出力
            </label>
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="color:#aaa; font-size:12px;">引張耐力検討用軸力 Nw (kN):</label><br>
          <input type="number" step="0.001" value="${(c.nw !== undefined ? parseFloat(c.nw) : (parseFloat(c.longTermAxial) || 0)).toFixed(3)}" onchange="window.handlePropChange('column', ${index}, 'nw', this.value)" style="width:100%; padding:6px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
        </div>
        <div style="display:flex; gap:10px; margin-bottom:12px;">
          <div style="flex:1;">
            <label style="color:#aaa; font-size:12px;">Bi係数設定 (隅柱0.8/中柱0.5/自動):</label><br>
            <select onchange="window.handlePropChange('column', ${index}, 'biSetting', this.value)" style="width:100%; padding:6px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
              <option value="auto" ${!c.biSetting || c.biSetting==='auto'?'selected':''}>自動判定</option>
              <option value="0.8" ${c.biSetting==='0.8'?'selected':''}>隅柱 (0.8)</option>
              <option value="0.5" ${c.biSetting==='0.5'?'selected':''}>中柱 (0.5)</option>
            </select>
          </div>
          <div style="flex:1;">
            <label style="color:#aaa; font-size:12px;">個別階高 Hi (mm):</label><br>
            <input type="number" placeholder="自動(${fd.floorHeight || 2730})" value="${c.heightOverride || ''}" onchange="window.handlePropChange('column', ${index}, 'heightOverride', this.value)" style="width:100%; padding:6px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
          </div>
        </div>
        <div style="margin-bottom:15px;">
          <label style="color:#aaa; font-size:12px;">反曲点高比 B:</label><br>
          <input type="number" step="0.05" min="0" max="1.0" value="${c.inflectionRatio !== undefined ? c.inflectionRatio : 0.5}" onchange="window.handlePropChange('column', ${index}, 'inflectionRatio', this.value)" style="width:100%; padding:6px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
        </div>

        <div style="background:rgba(231, 76, 60, 0.08); padding:12px; border-radius:8px; border:1px dashed rgba(231, 76, 60, 0.4); margin-bottom:15px;">
          <div style="color:#e74c3c; font-size:12px; font-weight:bold; margin-bottom:8px;">🏗 上階累積軸力 ΣNi (kN) [通り芯別 手入力上書き]</div>
          
          ${(() => {
            // 現在の計算結果から軸名を抽出
            const axes = [...new Set(res.cases.map(cs => cs.name.split(' ')[0]))];
            return axes.map(axisName => {
              const displayAxisName = axisName.trim() || "(名称未設定)";
              const safeAxisName = axisName.replace(/[^a-zA-Z0-9]/g, '_');
              const escapedAxisName = JSON.stringify(axisName).replace(/"/g, "&quot;");
              
              const axisOver = (c.axisOverrides || {})[axisName] || {};
              const valL = (axisOver.L !== undefined && axisOver.L !== null) ? axisOver.L : '';
              const valR = (axisOver.R !== undefined && axisOver.R !== null) ? axisOver.R : '';
              
              return `
              <div style="margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid rgba(231,76,60,0.1);">
                <div style="font-size:11px; color:#e74c3c; font-weight:bold; margin-bottom:5px;">■ ${displayAxisName} 通り</div>
                <div style="display:flex; gap:10px;">
                  <div style="flex:1;">
                    <label style="color:#aaa; font-size:10px;">左加力時 (+) 上書き指定</label>
                    <input id="niUpper_L_${safeAxisName}_${index}" name="niUpper_L_${safeAxisName}" autocomplete="off" type="number" step="0.001" placeholder="自動計算" 
                           value="${valL}" 
                           onchange="window.handleAxisOverrideChange(${index}, ${escapedAxisName}, 'L', this.value)" 
                           style="width:100%; padding:6px; background:#222; color:#fff; border:1px solid #444; border-radius:4px;">
                  </div>
                  <div style="flex:1;">
                    <label style="color:#aaa; font-size:10px;">右加力時 (-) 上書き指定</label>
                    <input id="niUpper_R_${safeAxisName}_${index}" name="niUpper_R_${safeAxisName}" autocomplete="off" type="number" step="0.001" placeholder="自動計算" 
                           value="${valR}" 
                           onchange="window.handleAxisOverrideChange(${index}, ${escapedAxisName}, 'R', this.value)" 
                           style="width:100%; padding:6px; background:#222; color:#fff; border:1px solid #444; border-radius:4px;">
                  </div>
                </div>
              </div>
              `;
            }).join('');
          })()}
          
          <p style="font-size:9px; color:#888; margin-top:6px; margin-bottom:0;">※数値を入力すると自動計算を上書きします。空欄にすると自動計算に戻ります。</p>
        </div>
        
        <h4 style="border-bottom:1px solid #555; padding-bottom:5px; margin-bottom:10px; color:#3498db;">金物選定 (引張判定)</h4>
        
        <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:6px; margin-bottom:10px;">
          <div style="color:#aaa; font-size:12px; margin-bottom:5px;">■ 柱頭 (Top) 金物</div>
          <select onchange="window.handlePropChange('column', ${index}, 'top_metalMode', this.value)" style="width:100%; margin-bottom:5px; padding:6px; background:#333; color:#fff; border:1px solid #444; border-radius:4px;">
            <option value="auto" ${c.top_metalMode==='auto'?'selected':''}>自動選定</option>
            <option value="manual" ${c.top_metalMode==='manual'?'selected':''}>手動選定</option>
          </select>
          ${c.top_metalMode==='manual' ? `<select onchange="window.handlePropChange('column', ${index}, 'top_metalId', this.value)" style="width:100%; padding:6px; background:#333; color:#fff; border:1px solid #444; border-radius:4px;">${metalOptions}</select>` : ''}
          <div style="margin-top:8px; display:flex; justify-content:space-between; background:#222; padding:8px; border-radius:4px; border:1px solid ${topOk?'#2ecc71':'#e74c3c'};">
             <div>必要引力 T: <b>${(res.T_top || 0).toFixed(3)} kN</b></div>
             <div>金物耐力 Ra: ${(res.topMetal?.cap || 0).toFixed(3)} kN</div>
             <div style="color:${topOk?'#2ecc71':'#e74c3c'}; font-weight:bold;">${topOk?'OK':'NG'}</div>
          </div>
        </div>
        
        <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:6px;">
          <div style="color:#aaa; font-size:12px; margin-bottom:5px;">■ 柱脚 (Base) 金物</div>
          <select onchange="window.handlePropChange('column', ${index}, 'base_metalMode', this.value)" style="width:100%; margin-bottom:5px; padding:6px; background:#333; color:#fff; border:1px solid #444; border-radius:4px;">
            <option value="auto" ${c.base_metalMode==='auto'?'selected':''}>自動選定</option>
            <option value="manual" ${c.base_metalMode==='manual'?'selected':''}>手動選定</option>
          </select>
          ${c.base_metalMode==='manual' ? `<select onchange="window.handlePropChange('column', ${index}, 'base_metalId', this.value)" style="width:100%; padding:6px; background:#333; color:#fff; border:1px solid #444; border-radius:4px;">${baseMetalOptions}</select>` : ''}
          <div style="margin-top:8px; display:flex; justify-content:space-between; background:#222; padding:8px; border-radius:4px; border:1px solid ${baseOk?'#2ecc71':'#e74c3c'};">
             <div>必要引力 T: <b>${(res.T || 0).toFixed(3)} kN</b></div>
             <div>金物耐力 Ra: ${(res.baseMetal?.cap || 0).toFixed(3)} kN</div>
             <div style="color:${baseOk?'#2ecc71':'#e74c3c'}; font-weight:bold;">${baseOk?'OK':'NG'}</div>
          </div>
        </div>

        <div style="margin-top:20px;">
          <h4 style="border-bottom:1px solid #555; padding-bottom:5px; margin-bottom:10px; color:#f39c12; font-size:13px;">📊 引張力 算定根拠詳細</h4>
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:10px; color:#eee; background:rgba(0,0,0,0.2);">
              <thead>
                <tr style="background:#2c3e50; color:#fff;">
                  <th style="border:1px solid #444; padding:4px;">通り</th>
                  <th style="border:1px solid #444; padding:4px;">加力方向</th>
                  <th style="border:1px solid #444; padding:4px;">ΣΔQiL×Hi</th>
                  <th style="border:1px solid #444; padding:4px;">ΣΔQiR×Hi</th>
                  <th style="border:1px solid #444; padding:4px;">Bi(頭/脚)</th>
                  <th style="border:1px solid #444; padding:4px;">Ni(頭/脚)</th>
                  <th style="border:1px solid #444; padding:4px;">上階ΣNi</th>
                  <th style="border:1px solid #444; padding:4px;">軸力Nw</th>
                  <th style="border:1px solid #444; padding:4px; background:rgba(52,152,219,0.2);">T値(柱頭)</th>
                  <th style="border:1px solid #444; padding:4px; background:rgba(230,126,34,0.2);">T値(柱脚)</th>
                </tr>
              </thead>
              <tbody>
                ${(res.cases || []).map(cs => `
                  <tr>
                    <td style="border:1px solid #444; padding:4px; text-align:center;">${cs.name.split(' ')[0]}</td>
                    <td style="border:1px solid #444; padding:4px; text-align:center;">${cs.name.split(' ').slice(1).join(' ')}</td>
                    <td style="border:1px solid #444; padding:4px; text-align:right;">${(cs.q1_Hi || 0).toFixed(3)}</td>
                    <td style="border:1px solid #444; padding:4px; text-align:right;">${(cs.q2_Hi || 0).toFixed(3)}</td>
                    <td style="border:1px solid #444; padding:4px; text-align:center;">
                      ${(cs.Bi_top || 0.5).toFixed(1)} / ${(cs.Bi_bot || 0.5).toFixed(1)}${c.biSetting && c.biSetting !== 'auto' ? '<span style="font-size:8px; color:#f39c12; margin-left:2px;">(手)</span>' : '<span style="font-size:8px; color:#aaa; margin-left:2px;">(デ)</span>'}
                    </td>
                    <td style="border:1px solid #444; padding:4px; text-align:center;">${(cs.Ni_top || 0).toFixed(3)} / ${(cs.Ni_bot || 0).toFixed(3)}</td>
                    <td style="border:1px solid #444; padding:4px; text-align:right;">${(cs.Ni_upper || 0).toFixed(3)}</td>
                    <td style="border:1px solid #444; padding:4px; text-align:right;">${(res.Nw || 0).toFixed(3)}</td>
                    <td style="border:1px solid #444; padding:4px; text-align:right; font-weight:bold; color:#5b8afe;">${(cs.T_top || 0).toFixed(3)}</td>
                    <td style="border:1px solid #444; padding:4px; text-align:right; font-weight:bold; color:#f39c12;">${(cs.T_bot || 0).toFixed(3)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  `;
  modal.appendChild(content);
  document.body.appendChild(modal);
  makeDraggable(content, content.querySelector('#column-modal-header'));
};

window.openColumnDetailModal = openColumnDetailModal;
