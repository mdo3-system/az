import { floorData, currentFloor, dxfVAxes, dxfHAxes, dxfSkewedAxes } from './foundation_cad.js';
import { HARDWARE_MASTER } from './foundation_calc.js';
import { generateOptions } from './ui_utils.js';

/**
 * ノード（交点）用のパネル
 */
const buildNodePanel = (el, fd) => {
  const index = el.index;
  const n = fd.nodes[index];
  if (!n) return '';
  return `
    <div class="prop-row"><span class="prop-label">種別</span><span style="color:#fff; font-weight:600;">交点 (Grid Node)</span></div>
    <div class="prop-row"><span class="prop-label">符号</span><span class="prop-value" style="border:none; background:none;">${n.id}</span></div>
    <div class="prop-row"><span class="prop-label">X (mm)</span><span class="prop-value" style="border:none; background:none;">${Math.round(n.x)}</span></div>
    <div class="prop-row"><span class="prop-label">Y (mm)</span><span class="prop-value" style="border:none; background:none;">${Math.round(n.y)}</span></div>
  `;
};

/**
 * 柱用のパネル
 */
const buildColumnPanel = (el, fd) => {
  const index = el.index;
  const c = fd.columns[index];
  const n = fd.nodes[c.nodeIndex];
  if (!c) return '';
  
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
        <input class="prop-value" style="flex:1;" type="number" step="0.01" value="${c.nw !== undefined ? c.nw : (c.longTermAxial !== undefined && c.longTermAxial !== 0 ? c.longTermAxial : '0.00')}" onchange="window.handlePropChange('column', ${index}, 'nw', this.value)" placeholder="0.00">
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
      const res = typeof window.calculateColumnT === 'function' ? window.calculateColumnT(index, fd) : {};
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

/**
 * 梁・外周梁用のパネル
 */
const buildBeamPanel = (el, fd) => {
  const index = el.index;
  const isPerimeter = el.type === 'perimeterBeam';
  
  if (typeof window.syncSlabDataToBeams === 'function') {
    window.syncSlabDataToBeams();
  }

  if (isPerimeter) {
    const pb = fd.perimeterBeams[index];
    if (!pb) return '';
    const titleStr = `<span style="color:var(--success); font-weight:600;">外周基礎梁 (Perimeter Beam)</span>`;
    return `
      <div style="margin-bottom:10px; padding:8px; background:rgba(46,204,113,0.1); border-left:4px solid var(--success);">
        <div style="font-size:12px; font-weight:bold; color:var(--success);">スラブ外周辺データ</div>
        <div style="font-size:10px; color:var(--text-muted);">スラブ形状から自動計算された基礎梁です。</div>
      </div>
      <div class="prop-row"><span class="prop-label">種別</span>${titleStr}</div>
      <div class="prop-row"><span class="prop-label">符号</span><input class="prop-value" value="${pb.id}" readonly style="background:rgba(0,0,0,0.2); color:var(--text-muted); cursor:not-allowed;"></div>
      <div class="prop-row"><span class="prop-label">通り名</span><input class="prop-value" value="${pb.axisName || pb.axis || ''}" placeholder="壁と連動(例: X1)" onchange="window.handlePropChange('perimeterBeam', ${index}, 'axisName', this.value)"></div>
      <div class="prop-row"><span class="prop-label">長さ (m)</span><span class="prop-value" style="border:none; background:none;">${(pb.length_m || 0).toFixed(3)}</span></div>
      <hr style="border-color:#444; margin: 10px 0;">
      
      <div style="margin-bottom:8px;">
        <div style="margin-bottom:4px; color:var(--text-secondary); font-size:11px;"><strong>自動算出：接地圧 (σe) <small style="color:#888;">[全スパン内最大]</small>:</strong></div>
        <div style="display:flex; align-items:center; gap:4px;">
          <input class="prop-value" style="flex:1; background:rgba(0,0,0,0.2); color:var(--accent);" type="number" value="${(pb.groundPressure || 0).toFixed(3)}" readonly>
          <span style="color:var(--text-muted); font-size:11px;">kN/m²</span>
        </div>
      </div>
      <div style="margin-bottom:8px;">
        <div style="margin-bottom:4px; color:var(--text-secondary); font-size:11px;"><strong>自動算出：負担幅 (B) <small style="color:#888;">[全スパン内最大]</small>:</strong></div>
        <div style="display:flex; align-items:center; gap:4px;">
          <input class="prop-value" style="flex:1; background:rgba(0,0,0,0.2); color:var(--accent);" type="number" value="${(pb.tributaryWidth || 0).toFixed(3)}" readonly>
          <span style="color:var(--text-muted); font-size:11px;">m</span>
        </div>
      </div>

      <div style="margin-top:10px; padding:8px; background:rgba(0,0,0,0.15); border-radius:5px; border:1px solid #555;">
        <strong style="font-size:11px; color:var(--text-secondary);">断面寸法・配筋設定 (編集可)</strong>
        <div style="display:flex; gap:8px; margin-top:6px;">
          <label style="font-size:11px; color:var(--text-muted);">幅 W:
            <input class="prop-value" type="number" step="10" style="width:60px; margin-left:2px;" value="${pb.width || ''}" onchange="window.handlePropChange('perimeterBeam', ${index}, 'width', this.value)" placeholder="mm">
          </label>
          <label style="font-size:11px; color:var(--text-muted);">せい D:
            <input class="prop-value" type="number" step="10" style="width:60px; margin-left:2px;" value="${pb.depth || ''}" onchange="window.handlePropChange('perimeterBeam', ${index}, 'depth', this.value)" placeholder="mm">
          </label>
        </div>
        <div style="display:flex; gap:6px; margin-top:5px; align-items:center;">
          <label style="font-size:11px; color:var(--text-muted);">dt:
            <input class="prop-value" type="number" step="1" style="width:50px; margin-left:2px;" value="${pb.dt || 70}" onchange="window.handlePropChange('perimeterBeam', ${index}, 'dt', this.value)" placeholder="mm">
          </label>
          <span style="font-size:10px; color:#666;">mm</span>
        </div>
        <div style="display:flex; gap:8px; margin-top:5px;">
          <label style="font-size:11px; color:var(--text-muted);">上端筋:
            <select class="prop-value" style="margin-left:2px;" onchange="window.handlePropChange('perimeterBeam', ${index}, 'topRebar', this.value)">
              <option value="" ${!pb.topRebar ? 'selected' : ''}>未設定</option>
              <option value="1-D13" ${pb.topRebar==='1-D13'?'selected':''}>1-D13</option>
              <option value="2-D13" ${pb.topRebar==='2-D13'?'selected':''}>2-D13</option>
              <option value="1-D16" ${pb.topRebar==='1-D16'?'selected':''}>1-D16</option>
              <option value="2-D16" ${pb.topRebar==='2-D16'?'selected':''}>2-D16</option>
              <option value="2-D19" ${pb.topRebar==='2-D19'?'selected':''}>2-D19</option>
            </select>
          </label>
        </div>
        <div style="display:flex; gap:8px; margin-top:5px;">
          <label style="font-size:11px; color:var(--text-muted);">下端筋:
            <select class="prop-value" style="margin-left:2px;" onchange="window.handlePropChange('perimeterBeam', ${index}, 'bottomRebar', this.value)">
              <option value="" ${!pb.bottomRebar ? 'selected' : ''}>未設定</option>
              <option value="1-D13" ${pb.bottomRebar==='1-D13'?'selected':''}>1-D13</option>
              <option value="2-D13" ${pb.bottomRebar==='2-D13'?'selected':''}>2-D13</option>
              <option value="1-D16" ${pb.bottomRebar==='1-D16'?'selected':''}>1-D16</option>
              <option value="2-D16" ${pb.bottomRebar==='2-D16'?'selected':''}>2-D16</option>
              <option value="2-D19" ${pb.bottomRebar==='2-D19'?'selected':''}>2-D19</option>
            </select>
          </label>
        </div>
        <div style="display:flex; gap:8px; margin-top:5px; align-items:center;">
          <label style="font-size:11px; color:var(--text-muted);">STP:
            <select class="prop-value" style="margin-left:2px;" onchange="window.handlePropChange('perimeterBeam', ${index}, 'stirrupRebar', this.value)">
              <option value="" ${!pb.stirrupRebar ? 'selected' : ''}>未設定</option>
              <option value="D10" ${pb.stirrupRebar === 'D10' ? 'selected' : ''}>D10</option>
              <option value="D13" ${pb.stirrupRebar === 'D13' ? 'selected' : ''}>D13</option>
            </select>
          </label>
          <label style="font-size:11px; color:var(--text-muted);">@
            <select class="prop-value" style="margin-left:2px;" onchange="window.handlePropChange('perimeterBeam', ${index}, 'stirrupPitch', this.value)">
              <option value="0" ${!pb.stirrupPitch ? 'selected' : ''}>未設定</option>
              <option value="100" ${pb.stirrupPitch == 100 ? 'selected' : ''}>100</option>
              <option value="150" ${pb.stirrupPitch == 150 ? 'selected' : ''}>150</option>
              <option value="200" ${pb.stirrupPitch == 200 ? 'selected' : ''}>200</option>
              <option value="250" ${pb.stirrupPitch == 250 ? 'selected' : ''}>250</option>
              <option value="300" ${pb.stirrupPitch == 300 ? 'selected' : ''}>300</option>
            </select>
          </label>
        </div>
      </div>
      <div style="margin-top:10px;">
        <button style="width:100%; padding:8px; background:var(--accent); color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.openBeamStressPopup('perimeterBeam', ${index})">🔍 応力詳細・検定</button>
      </div>
    `;
  } else {
    const b = fd.beams[index];
    if (!b) return '';
    const n1 = fd.nodes[b.n1], n2 = fd.nodes[b.n2];
    const isFbeam = b.type === 'foundation_beam';
    let titleStr = isFbeam ? `<span style="color:var(--success); font-weight:600;">基礎梁 (Foundation Beam)</span>` : `<span style="color:var(--warn); font-weight:600;">梁 (Beam)</span>`;
    
    let html = `
      <div class="prop-row"><span class="prop-label">種別</span>${titleStr}</div>
      <div class="prop-row"><span class="prop-label">符号</span><input class="prop-value" value="${b.id}" onchange="window.handlePropChange('beam', ${index}, 'id', this.value)"></div>
      <div class="prop-row"><span class="prop-label">通り名</span><input class="prop-value" value="${b.axisName || b.axis || ''}" placeholder="壁と連動(例: X1)" onchange="window.handlePropChange('beam', ${index}, 'axisName', this.value)"></div>
      <div class="prop-row"><span class="prop-label">始端(nodeStart)</span><span class="prop-value" style="border:none; background:none;">${n1 ? n1.id : '?'}</span></div>
      <div class="prop-row"><span class="prop-label">終端(nodeEnd)</span><span class="prop-value" style="border:none; background:none;">${n2 ? n2.id : '?'}</span></div>
      <div class="prop-row"><span class="prop-label">長さ (mm)</span><span class="prop-value" style="border:none; background:none;">${n1 && n2 ? Math.round(Math.hypot(n2.x-n1.x, n2.y-n1.y)) : '-'}</span></div>
    `;
    
    if (isFbeam) {
      html += `
      <hr style="border-color:#444; margin: 10px 0;">
      <!-- 内部基礎梁では長期応力を考慮しないため接地圧・負担幅を非表示化 -->
      <div style="display:none;">
        <div style="margin-bottom:8px; margin-top:8px;">
          <div style="margin-bottom:4px; color:var(--text-secondary); font-size:11px;"><strong>接地圧 (groundPressure):</strong></div>
          <div style="display:flex; align-items:center; gap:4px;">
            <input class="prop-value" style="flex:1;" type="number" step="0.001" value="${(b.groundPressure || 0).toFixed(3)}" onchange="window.handlePropChange('beam', ${index}, 'groundPressure', this.value)" placeholder="0.000">
            <span style="color:var(--text-muted); font-size:11px;">kN/m²</span>
          </div>
        </div>
        <div style="margin-bottom:8px;">
          <div style="margin-bottom:4px; color:var(--text-secondary); font-size:11px;"><strong>負担幅 (tributaryWidth):</strong></div>
          <div style="display:flex; align-items:center; gap:4px;">
            <input class="prop-value" style="flex:1;" type="number" step="0.001" value="${(b.tributaryWidth || 0).toFixed(3)}" onchange="window.handlePropChange('beam', ${index}, 'tributaryWidth', this.value)" placeholder="0.000">
            <span style="color:var(--text-muted); font-size:11px;">m</span>
          </div>
        </div>
      </div>
      <div style="margin-top:10px; padding:8px; background:rgba(0,0,0,0.15); border-radius:5px; border:1px solid #555;">
        <strong style="font-size:11px; color:var(--text-secondary);">断面寸法・配筋設定</strong>
        <div style="display:flex; gap:8px; margin-top:6px;">
          <label style="font-size:11px; color:var(--text-muted);">幅 W:
            <input class="prop-value" type="number" step="10" style="width:60px; margin-left:2px;" value="${b.width || ''}" onchange="window.handlePropChange('beam', ${index}, 'width', this.value)" placeholder="mm">
          </label>
          <label style="font-size:11px; color:var(--text-muted);">せい D:
            <input class="prop-value" type="number" step="10" style="width:60px; margin-left:2px;" value="${b.depth || ''}" onchange="window.handlePropChange('beam', ${index}, 'depth', this.value)" placeholder="mm">
          </label>
        </div>
        <div style="display:flex; gap:6px; margin-top:5px; align-items:center;">
          <label style="font-size:11px; color:var(--text-muted);">dt:
            <input class="prop-value" type="number" step="1" style="width:50px; margin-left:2px;" value="${b.dt || 70}" onchange="window.handlePropChange('beam', ${index}, 'dt', this.value)" placeholder="mm">
          </label>
          <span style="font-size:10px; color:#666;">mm</span>
        </div>
        <div style="display:flex; gap:8px; margin-top:5px;">
          <label style="font-size:11px; color:var(--text-muted);">上端筋:
            <select class="prop-value" style="margin-left:2px;" onchange="window.handlePropChange('beam', ${index}, 'topRebar', this.value)">
              <option value="" ${!b.topRebar ? 'selected' : ''}>未設定</option>
              <option value="1-D13" ${b.topRebar==='1-D13'?'selected':''}>1-D13</option>
              <option value="2-D13" ${b.topRebar==='2-D13'?'selected':''}>2-D13</option>
              <option value="1-D16" ${b.topRebar==='1-D16'?'selected':''}>1-D16</option>
              <option value="2-D16" ${b.topRebar==='2-D16'?'selected':''}>2-D16</option>
              <option value="2-D19" ${b.topRebar==='2-D19'?'selected':''}>2-D19</option>
            </select>
          </label>
        </div>
        <div style="display:flex; gap:8px; margin-top:5px;">
          <label style="font-size:11px; color:var(--text-muted);">下端筋:
            <select class="prop-value" style="margin-left:2px;" onchange="window.handlePropChange('beam', ${index}, 'bottomRebar', this.value)">
              <option value="" ${!b.bottomRebar ? 'selected' : ''}>未設定</option>
              <option value="1-D13" ${b.bottomRebar==='1-D13'?'selected':''}>1-D13</option>
              <option value="2-D13" ${b.bottomRebar==='2-D13'?'selected':''}>2-D13</option>
              <option value="1-D16" ${b.bottomRebar==='1-D16'?'selected':''}>1-D16</option>
              <option value="2-D16" ${b.bottomRebar==='2-D16'?'selected':''}>2-D16</option>
              <option value="2-D19" ${b.bottomRebar==='2-D19'?'selected':''}>2-D19</option>
            </select>
          </label>
        </div>
        <div style="display:flex; gap:8px; margin-top:5px; align-items:center;">
          <label style="font-size:11px; color:var(--text-muted);">STP:
            <select class="prop-value" style="margin-left:2px;" onchange="window.handlePropChange('beam', ${index}, 'stirrupRebar', this.value)">
              <option value="" ${!b.stirrupRebar ? 'selected' : ''}>未設定</option>
              <option value="D10" ${b.stirrupRebar === 'D10' ? 'selected' : ''}>D10</option>
              <option value="D13" ${b.stirrupRebar === 'D13' ? 'selected' : ''}>D13</option>
            </select>
          </label>
          <label style="font-size:11px; color:var(--text-muted);">@
            <select class="prop-value" style="margin-left:2px;" onchange="window.handlePropChange('beam', ${index}, 'stirrupPitch', this.value)">
              <option value="0" ${!b.stirrupPitch ? 'selected' : ''}>未設定</option>
              <option value="100" ${b.stirrupPitch == 100 ? 'selected' : ''}>100</option>
              <option value="150" ${b.stirrupPitch == 150 ? 'selected' : ''}>150</option>
              <option value="200" ${b.stirrupPitch == 200 ? 'selected' : ''}>200</option>
            </select>
          </label>
        </div>
      </div>
      `;

      // --- 短期応力の表示 ---
      if (currentFloor === '1' && b.shortTermQ_L_load !== undefined) {
        html += `
          <div style="margin-top:10px; padding:10px; background:rgba(46,204,113,0.05); border-radius:6px; border:1px solid rgba(46,204,113,0.2);">
            <div style="font-size:11px; color:#2ecc71; font-weight:bold; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px;">🏗 水平荷重時応力 (短期)</div>
            <div style="font-size:10px; line-height:1.6;">
              <div style="color:#aaa; border-left:2px solid #2ecc71; padding-left:6px; margin-bottom:4px;">左加力時:</div>
              <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                <span>Q: <span style="color:#fff;">${(b.shortTermQ_L_load||0).toFixed(2)}</span> kN</span>
                <span>M(始): <span style="color:#fff;">${(b.shortTermM_start_L_load||0).toFixed(2)}</span> kN·m</span>
                <span>M(終): <span style="color:#fff;">${(b.shortTermM_end_L_load||0).toFixed(2)}</span> kN·m</span>
              </div>
              <div style="color:#aaa; border-left:2px solid #e74c3c; padding-left:6px; margin-top:6px; margin-bottom:4px;">右加力時:</div>
              <div style="display:flex; justify-content:space-between;">
                <span>Q: <span style="color:#fff;">${(b.shortTermQ_R_load||0).toFixed(2)}</span> kN</span>
                <span>M(始): <span style="color:#fff;">${(b.shortTermM_start_R_load||0).toFixed(2)}</span> kN·m</span>
                <span>M(終): <span style="color:#fff;">${(b.shortTermM_end_R_load||0).toFixed(2)}</span> kN·m</span>
              </div>
            </div>
          </div>
        `;
      }

      html += `
      <div style="margin-top:10px;">
        <button style="width:100%; padding:8px; background:var(--accent); color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.openBeamStressPopup('beam', ${index})">🔍 応力詳細・検定</button>
      </div>
      `;
    }
    return html;
  }
};

/**
 * 壁・仮想壁用のパネル
 */
const buildWallPanel = (el, fd) => {
  const index = el.index;
  const w = fd.walls[index];
  if (!w) return '';
  const n1 = fd.nodes[w.n1], n2 = fd.nodes[w.n2];
  const autoL = n1 && n2 ? Math.round(Math.hypot(n2.x - n1.x, n2.y - n1.y)) : 0;
  const wMult = w.multiplier !== undefined ? w.multiplier : 1.0;
  const wIsVirtual = wMult === 0;
  return `
    <div style="margin-bottom:12px; font-size:12px;">
      ${wIsVirtual
        ? `<strong style="color:rgba(180,100,255,0.9);">仮想壁 (通り定義線)</strong>`
        : `<strong style="color:#ff00ff;">耐力壁 (Wall)</strong>`}
      <span style="color:var(--text-muted); margin-left:8px;">実長: ${autoL} mm</span>
    </div>
    <div style="margin-bottom:8px;">
      <div style="margin-bottom:4px; color:var(--text-secondary); font-size:11px;"><strong>符号:</strong></div>
      <input class="prop-value" style="width:100%;" value="${w.id || ''}" onchange="window.handlePropChange('wall', ${index}, 'id', this.value)">
    </div>
    <div style="margin-bottom:8px;">
      <div style="margin-bottom:4px; color:var(--text-secondary); font-size:11px;"><strong>通り名 (axisName):</strong></div>
      <input class="prop-value" style="width:100%; border-color:var(--accent);" placeholder="例: 斜めA軸, X1" value="${w.axisName || ''}" onchange="window.handlePropChange('wall', ${index}, 'axisName', this.value)">
      <div style="font-size:9px; color:var(--accent); margin-top:2px;">※入力するとN値計算・帳票の対象になります</div>
    </div>
    <div style="margin-bottom:8px;">
      <div style="margin-bottom:4px; color:var(--text-secondary); font-size:11px;"><strong>壁倍率:</strong></div>
      <input class="prop-value" style="width:100%;" type="number" step="0.1" min="0" max="7" value="${w.multiplier !== undefined ? w.multiplier : 1.0}" onchange="window.handlePropChange('wall', ${index}, 'multiplier', this.value)">
    </div>
    <div style="margin-bottom:8px;">
      <div style="margin-bottom:4px; color:var(--text-secondary); font-size:11px;"><strong>設計長 L (mm):</strong></div>
      <input class="prop-value" style="width:100%;" type="number" step="1" value="${w.lengthOverride || ''}" placeholder="${autoL}" onchange="window.handlePropChange('wall', ${index}, 'lengthOverride', this.value)">
      <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">空欄の場合は実長を使用します</div>
    </div>
  `;
};

/**
 * スラブ用のパネル
 */
const buildSlabPanel = (el, fd) => {
    const index = el.index;
    const slab = fd.slabs[index];
    if (!slab) return '<p style="color:var(--text-muted);">スラブが見つかりません</p>';

    // デフォルト値のフォールバック
    const t = slab.thickness || slab.D || slab.t || 150;
    const level = slab.level || 0;
    const dt = slab.dt !== undefined ? slab.dt : 70;
    const sR = slab.shortRebar || 'D13'; 
    const sP = slab.shortPitch || 200; 
    const lR = slab.longRebar || 'D13'; 
    const lP = slab.longPitch || 200; 
    const groundPressure = slab.groundPressure !== undefined ? slab.groundPressure : 30.0;
    const rebarList = ['D10', 'D13', 'D16', 'D10+D13', 'D13+D16'];

    // 前半：基本情報・配筋・接地圧
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

    // 中盤：各辺の支持条件を動的生成
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

    // 後半：アクションボタン
    html += `
      <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
        <button style="width:100%; padding:8px; background:var(--success); color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.openSlabEditor(${index})">🧮 断面検定エディタを開く</button>
      </div>
    `;

    return html;
};

/**
 * 水平構面用のパネル
 */
const buildDiaphragmPanel = (el, fd) => {
  const index = el.index;
  const diaph = fd.diaphragms[index];
  if (!diaph) return '';
  
  if (typeof window.calculateDiaphragmProps === 'function') window.calculateDiaphragmProps(diaph, fd.nodes);

  let warningHtml = '';
  if (diaph.error) {
     warningHtml = `<div style="margin-top:10px; padding:10px; background:rgba(231, 76, 60, 0.15); border-left:4px solid #e74c3c; color:#ff4444; font-weight:bold; font-size:12px;">
       ⚠ 計算エラー：形状が複雑すぎるか、線が交差しています。
     </div>`;
  } else if (diaph.has_reentrant) {
     warningHtml = `<div style="margin-top:10px; padding:10px; background:rgba(231, 76, 60, 0.15); border-left:4px solid #e74c3c; color:#ff4444; font-weight:bold; font-size:12px;">
       ⚠ 不整形な構面です（入隅あり）。ブロック分割を検討してください。
     </div>`;
  }

  return `
    <div class="prop-row"><span class="prop-label">種別</span><span style="color:#2ecc71; font-weight:600;">水平構面 (Diaphragm)</span></div>
    <div class="prop-row"><span class="prop-label">符号</span><input class="prop-value" value="${diaph.id || ''}" onchange="window.handlePropChange('diaphragm', ${index}, 'id', this.value)"></div>
    <div class="prop-row"><span class="prop-label">頂点数</span><span class="prop-value" style="border:none; background:none;">${(diaph.nodeIds||[]).length}</span></div>
    
    ${warningHtml}

    <div style="margin-top:12px; padding:10px; background:rgba(0,0,0,0.2); border-radius:5px; border:1px solid #444;">
      <strong style="font-size:12px; color:#fff;">構面解析結果</strong>
      
      <div style="font-size:11px; margin-top:8px;">
         <span style="color:var(--text-secondary);">面積 S:</span> <strong style="color:#fff; font-size:13px; margin-left:4px;">${(diaph.S||0).toFixed(2)}</strong> ㎡
      </div>
      
      <div style="margin-top:10px; padding-top:10px; border-top:1px dashed #555;">
         <div style="margin-bottom:6px; color:var(--accent); font-weight:bold; font-size:11px;">幅 (バウンディングボックス投影)</div>
         <div style="font-size:11px; margin-bottom:4px;"><span style="color:var(--text-secondary);">X方向投影 Wx:</span> <strong>${(diaph.Wx||0).toFixed(2)}</strong> m</div>
         <div style="font-size:11px;"><span style="color:var(--text-secondary);">Y方向投影 Wy:</span> <strong>${(diaph.Wy||0).toFixed(2)}</strong> m</div>
      </div>
      
      <div style="margin-top:10px; padding-top:10px; border-top:1px solid #444;">
         <div style="margin-bottom:6px; color:#f39c12; font-weight:bold; font-size:11px;">等価奥行き L</div>
         <div style="font-size:11px; margin-bottom:4px;"><span style="color:var(--text-secondary);">X加力時 Lx (S/Wy):</span> <strong style="color:#fff; font-size:12px; margin-left:4px;">${(diaph.Lx||0).toFixed(2)}</strong> m</div>
         <div style="font-size:11px;"><span style="color:var(--text-secondary);">Y加力時 Ly (S/Wx):</span> <strong style="color:#fff; font-size:12px; margin-left:4px;">${(diaph.Ly||0).toFixed(2)}</strong> m</div>
      </div>
    </div>
  `;
};

/**
 * グリッド軸用のパネル
 */
const buildAxisPanel = (el) => {
  const index = el.index;
  let axis;
  if (index.dir === 'v') axis = dxfVAxes[index.index];
  else if (index.dir === 'h') axis = dxfHAxes[index.index];
  else if (index.dir === 's') axis = dxfSkewedAxes[index.index];

  if (!axis) return '';

  const labelPrefix = (index.dir === 's' ? '斜め' : 'グリッド');

  return `
    <div class="prop-row"><span class="prop-label">種別</span><span style="color:#e74c3c; font-weight:600;">${labelPrefix}軸 (Axis)</span></div>
    <div class="prop-row"><span class="prop-label">現在の名称</span><span class="prop-value" style="border:none; background:none;">${axis.label || ''}</span></div>
    <div class="prop-row"><span class="prop-label">新しい名称</span><input class="prop-value" id="axisLabelInput" value="${axis.label || ''}"></div>
    <button style="margin-top:10px; width:100%; border:1px solid #444; background:#2c2c2c; color:#fff; padding:6px; cursor:pointer;" onclick="window.renameAxis('${index.dir}', ${index.index})">変更を適用</button>
    <hr style="border-color:#444; margin: 15px 0;">
    <button style="margin-bottom:10px; width:100%; border:1px solid #e74c3c; background:none; color:#e74c3c; padding:6px; cursor:pointer;" onclick="window.deleteAxis('${index.dir}', ${index.index})">軸全体を削除</button>
    <div class="prop-row"><span class="prop-label">オフセット(mm)</span><input class="prop-value" id="addAxisOffset" type="number" value="2000"></div>
    <button style="margin-top:5px; width:100%; border:1px solid #3498db; background:none; color:#3498db; padding:6px; cursor:pointer;" onclick="window.addAxisNear('${index.dir}', ${index.index})">+ オフセット位置に並行軸を追加</button>
  `;
};




/**
 * 複数選択時のパネル
 */
const buildMultiSelectPanel = (elements) => {
    const types = [...new Set(elements.map(e => e.type))];
    if (types.length > 1) {
      return `<div style="color:var(--warn); font-size:12px; padding:15px; text-align:center;">
        <strong>${elements.length}個</strong>の異なる種類の要素を選択中<br>
        <span style="font-size:10px; color:var(--text-muted);">同種の要素のみを選択すると一括変更できます</span>
      </div>`;
    }
    const commonType = types[0];
    const count = elements.length;
    const typeLabel = {column:'柱', beam:'梁/基礎梁', slab:'スラブ'}[commonType] || commonType;
    let html = `<div style="padding:8px; background:rgba(91,138,254,0.1); border:1px solid var(--accent); border-radius:5px; margin-bottom:10px;">
      <strong style="color:var(--accent); font-size:12px;">${count}個の${typeLabel}を一括編集中</strong>
      <div style="font-size:10px; color:var(--text-muted); margin-top:3px;">変更は全選択要素に適用されます</div>
    </div>`;
    if (commonType === 'beam') {
      html += `
        <div style="padding:8px; background:rgba(0,0,0,0.15); border-radius:5px; border:1px solid #555;">
          <strong style="font-size:11px; color:var(--text-secondary);">断面・配筋 一括設定</strong>
          <div style="display:flex; gap:8px; margin-top:6px;">
            <label style="font-size:11px; color:var(--text-muted);">幅 W: <input class="prop-value" type="number" step="10" style="width:60px;" onchange="window.handleMultiPropChange('width', this.value)" placeholder="mm"></label>
            <label style="font-size:11px; color:var(--text-muted);">せい D: <input class="prop-value" type="number" step="10" style="width:60px;" onchange="window.handleMultiPropChange('depth', this.value)" placeholder="mm"></label>
          </div>
          <div style="display:flex; gap:6px; margin-top:5px; align-items:center;">
            <label style="font-size:11px; color:var(--text-muted);">dt: <input class="prop-value" type="number" step="1" style="width:50px;" onchange="window.handleMultiPropChange('dt', this.value)" placeholder="mm"></label>
          </div>
          <div style="display:flex; gap:8px; margin-top:5px;">
            <label style="font-size:11px; color:var(--text-muted);">上端筋: <select class="prop-value" onchange="window.handleMultiPropChange('topRebar', this.value)"><option value="">--</option><option>1-D13</option><option>2-D13</option><option>1-D16</option><option>1-D13+1-D16</option><option>2-D16</option><option>3-D16</option><option>2-D19</option><option>3-D19</option><option>2-D22</option></select></label>
          </div>
          <div style="display:flex; gap:8px; margin-top:5px;">
            <label style="font-size:11px; color:var(--text-muted);">下端筋: <select class="prop-value" onchange="window.handleMultiPropChange('bottomRebar', this.value)"><option value="">--</option><option>1-D13</option><option>2-D13</option><option>1-D16</option><option>1-D13+1-D16</option><option>2-D16</option><option>3-D16</option><option>2-D19</option><option>3-D19</option><option>2-D22</option></select></label>
          </div>
          <div style="display:flex; gap:8px; margin-top:5px; align-items:center;">
            <label style="font-size:11px; color:var(--text-muted);">STP: <select class="prop-value" onchange="window.handleMultiPropChange('stirrupRebar', this.value)"><option value="">--</option><option>D10</option><option>D13</option></select></label>
            <label style="font-size:11px; color:var(--text-muted);">@ <select class="prop-value" onchange="window.handleMultiPropChange('stirrupPitch', this.value)"><option value="0">--</option><option>100</option><option>150</option><option>200</option><option>250</option><option>300</option></select></label>
          </div>
        </div>`;
    } else if (commonType === 'column') {
      html += `
        <div style="padding:10px; background:rgba(0,0,0,0.15); border-radius:6px; border:1px solid #555;">
          <strong style="font-size:11px; color:var(--text-secondary);">柱プロパティ 一括設定</strong>
          <div style="margin-top:10px;">
            <div style="margin-bottom:8px;">
              <span style="font-size:11px; color:var(--text-muted);">Nw (kN): </span>
              <input class="prop-value" type="number" step="0.01" style="width:70px;" onchange="window.handleMultiPropChange('nw', this.value)">
            </div>
            <div style="margin-bottom:8px;">
              <span style="font-size:11px; color:var(--text-muted);">Bi係数: </span>
              <select class="prop-value" onchange="window.handleMultiPropChange('biSetting', this.value)">
                <option value="">--</option>
                <option value="auto">自動判定</option>
                <option value="0.8">隅柱 (0.8)</option>
                <option value="0.5">中柱 (0.5)</option>
              </select>
            </div>
            <div style="margin-bottom:8px;">
              <span style="font-size:11px; color:var(--text-muted);">反曲点高比 B: </span>
              <input class="prop-value" type="number" step="0.05" style="width:60px;" onchange="window.handleMultiPropChange('inflectionRatio', this.value)" placeholder="0.5">
            </div>
            <div style="margin-bottom:8px;">
              <span style="font-size:11px; color:var(--text-muted);">個別階高 Hi: </span>
              <input class="prop-value" type="number" style="width:80px;" onchange="window.handleMultiPropChange('heightOverride', this.value)" placeholder="mm">
            </div>
          </div>
        </div>`;
    }
    return html;
};

/**
 * ツール選択時のデフォルト設定パネル
 */
const buildDefaultToolPanel = (tool) => {
    if (!['beam', 'fbeam', 'column', 'slab', 'wall', 'diaphragm'].includes(tool)) return '<div style="color:var(--text-muted); font-size:11px; padding:20px 0; text-align:center;">要素を選択してください</div>';
    
    if (!window.defaultProperties) window.defaultProperties = {};
    if (!window.defaultProperties[tool]) window.defaultProperties[tool] = {};
    const dp = window.defaultProperties[tool];

    const toolLabel = { 
      fbeam: '基礎梁', beam: '梁(将来用)', column: '柱', slab: 'スラブ', 
      wall: '耐力壁', diaphragm: '水平構面', delete: '削除' 
    }[tool] || tool;
    const colorMap  = { 
      fbeam: '#e67e22', beam: '#95a5a6', column: 'var(--success)', 
      slab: '#a78bfa', wall: '#00BFFF', diaphragm: '#3498db' 
    };

    let fieldsHtml = '';
    
    // 💡 基礎梁 (fbeam) と 梁 (beam) を厳密に分離
    if (tool === 'fbeam') {
      if (!window.defaultProperties['fbeam']) {
          // beamから移行、または新規作成
          window.defaultProperties['fbeam'] = JSON.parse(JSON.stringify(window.defaultProperties['beam'] || {}));
      }
      const dp = window.defaultProperties['fbeam'];
      const w     = dp.width    !== undefined ? dp.width    : 150;
      const d     = dp.depth    !== undefined ? dp.depth    : 640;
      const tR    = dp.topRebar || '1-D13';
      const bR    = dp.bottomRebar || '1-D13';
      const sR    = dp.stirrupRebar || 'D10';
      const sP    = dp.stirrupPitch || 200;
      const dt    = dp.dt || 70;
      const sc    = dp.startCondition || 'pin';
      const ec    = dp.endCondition   || 'pin';

      const rebarOptions = ['1-D13', '2-D13', '1-D16', '1-D13+1-D16', '2-D16', '3-D16', '2-D19', '3-D19', '2-D22'];
      
      fieldsHtml = `
        <div class="prop-row" style="margin-top:6px;"><span class="prop-label">幅 W</span>
          <input class="prop-value" type="number" step="10" value="${w}" oninput="window.defaultProperties['fbeam'].width=+this.value"></div>
        <div class="prop-row"><span class="prop-label">せい D</span>
          <input class="prop-value" type="number" step="10" value="${d}" oninput="window.defaultProperties['fbeam'].depth=+this.value"></div>
        <div class="prop-row"><span class="prop-label">上端筋</span>
          <select class="prop-value" onchange="window.defaultProperties['fbeam'].topRebar=this.value">
            ${rebarOptions.map(o => `<option value="${o}" ${tR===o?'selected':''}>${o}</option>`).join('')}
          </select></div>
        <div class="prop-row"><span class="prop-label">下端筋</span>
          <select class="prop-value" onchange="window.defaultProperties['fbeam'].bottomRebar=this.value">
            ${rebarOptions.map(o => `<option value="${o}" ${bR===o?'selected':''}>${o}</option>`).join('')}
          </select></div>
        <div class="prop-row"><span class="prop-label">あばら筋</span>
          <div style="display:flex; gap:4px; flex:1;">
            <select class="prop-value" style="width:60px;" onchange="window.defaultProperties['fbeam'].stirrupRebar=this.value">
              <option value="D10" ${sR==='D10'?'selected':''}>D10</option><option value="D13" ${sR==='D13'?'selected':''}>D13</option>
            </select>
            <span style="color:#666; line-height:22px;">@</span>
            <select class="prop-value" style="flex:1;" onchange="window.defaultProperties['fbeam'].stirrupPitch=+this.value">
              ${[100, 150, 200, 250, 300].map(p => `<option value="${p}" ${sP===p?'selected':''}>${p}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="prop-row"><span class="prop-label">かぶり dt</span>
          <input class="prop-value" type="number" value="${dt}" oninput="window.defaultProperties['fbeam'].dt=+this.value"></div>`;
    } else if (tool === 'beam') {
      fieldsHtml = `
        <div style="padding:15px; text-align:center; color:var(--text-muted); font-style:italic;">
          通常の「梁」ツールは現在未実装です。<br>柱間の梁を入力する場合は「基礎梁」を使用してください。
        </div>`;
    } else if (tool === 'wall') {
      const wp = window.defaultProperties['wall'] || { multiplier: 1.0, axisName: "" };
      fieldsHtml = `
        <div class="prop-row" style="margin-top:6px;"><span class="prop-label">壁倍率</span>
          <input class="prop-value" type="number" step="0.1" min="0" max="7.0" value="${wp.multiplier}"
            oninput="window.defaultProperties['wall'].multiplier=+this.value; window.state.defaultWallMultiplier=+this.value;"></div>
        <div class="prop-row"><span class="prop-label">通り名</span>
          <input class="prop-value" type="text" value="${wp.axisName||''}" placeholder="未設定"
            oninput="window.defaultProperties['wall'].axisName=this.value; window.state.defaultWallAxisName=this.value;"></div>`;
    } else if (tool === 'column') {
      const nw = dp.nw !== undefined ? dp.nw : '0.00';
      fieldsHtml = `
        <div class="prop-row" style="margin-top:6px;">
          <span class="prop-label">検討用軸力 Nw(kN)</span>
          <input class="prop-value" type="number" step="0.01" value="${nw}"
            oninput="window.defaultProperties['column'].nw=+this.value" placeholder="0.00">
        </div>`;
    } else if (tool === 'slab') {
      const gp  = dp.groundPressure !== undefined ? dp.groundPressure : 30.0;
      const tm  = dp.triangleMultiplier !== undefined ? dp.triangleMultiplier : 1.33;
      fieldsHtml = `
        <div class="prop-row" style="margin-top:6px;">
          <span class="prop-label">接地圧 σe(kN/m²)</span>
          <input class="prop-value" type="number" step="0.5" value="${gp}"
            oninput="window.defaultProperties['slab'].groundPressure=+this.value" placeholder="30.0">
        </div>
        <div class="prop-row">
          <span class="prop-label">三角割増し係数</span>
          <input class="prop-value" type="number" step="0.01" value="${tm}"
            oninput="window.defaultProperties['slab'].triangleMultiplier=+this.value" placeholder="1.33">
        </div>`;
    } else if (tool === 'diaphragm') {
      const dpd = window.defaultProperties['diaphragm'] || { Qa: 0 };
      fieldsHtml = `
        <div class="prop-row" style="margin-top:6px;">
          <span class="prop-label">基本許容力 Qa</span>
          <input class="prop-value" type="number" value="${dpd.Qa}"
            oninput="window.defaultProperties['diaphragm'].Qa=+this.value">
        </div>
        <div style="font-size:10px; color:var(--text-muted); padding:8px;">
          ※剛床・構面の初期強度(kN/m)を設定します
        </div>`;
    } else if (tool === 'skewedGrid') {
      fieldsHtml = `
        <div style="font-size:11px; color:var(--text-secondary); padding:8px;">
          画面上の2点をクリックして「斜め通り芯」を定義します。<br>
          定義した通り名は、立面図の基準線として選択可能です。
        </div>`;
    }

    return `
      <div style="margin-bottom:10px; font-size:12px;">
        <strong style="color:${colorMap[tool] || 'var(--accent)'};">デフォルト設定：${toolLabel}</strong><br>
        <span style="font-size:10px; color:var(--text-muted);">このツールで作図する要素の初期値です</span>
      </div>
      <hr style="border-color:#444; margin:8px 0;">
      ${fieldsHtml}
      ${['fbeam', 'beam', 'wall', 'diaphragm', 'skewedGrid'].includes(tool) ? `
        <div style="margin-top:12px; padding:8px; background:rgba(91,138,254,0.05); border:1px solid rgba(91,138,254,0.2); border-radius:4px; font-size:10px; color:var(--accent);">
          💡 <strong>ヒント</strong><br>
          右クリック、または Esc キーで作図（始点）を解除できます。
        </div>` : ''}
    `;

};

// --- メインの更新関数 ---
export const updatePropertyPanel = function() {
  const cont = document.getElementById('property-panel') || document.querySelector('.property-panel');
  if (!cont) return;

  const state = window.state || {};
  const fd = floorData[currentFloor];

  // スラブ選択以外なら、表示状態を復元
  if (window.selectedType !== 'SLAB') {
    const sidebar = document.getElementById('right-sidebar');
    if (sidebar) sidebar.style.display = 'flex';
    cont.style.visibility = 'visible';
    cont.style.pointerEvents = 'auto';
  }

  // 要素未選択時の処理
  if (!state.selectedElement && (!state.selectedElements || state.selectedElements.length === 0)) {
    // ツール別デフォルト設定
    cont.innerHTML = buildDefaultToolPanel(state.currentTool);
    return;
  }

  // 複数選択
  if (state.selectedElements && state.selectedElements.length >= 2) {
    cont.innerHTML = buildMultiSelectPanel(state.selectedElements);
    return;
  }

  // 単一選択
  const el = state.selectedElement;
  if (!el) return;

  let html = '';
  switch (el.type) {
    case 'node':      html = buildNodePanel(el, fd); break;
    case 'column':    html = buildColumnPanel(el, fd); break;
    case 'beam':      
    case 'perimeterBeam': html = buildBeamPanel(el, fd); break;
    case 'wall':      html = buildWallPanel(el, fd); break;
    case 'slab':      html = buildSlabPanel(el, fd); break;
    case 'diaphragm': html = buildDiaphragmPanel(el, fd); break;
    case 'axis':      html = buildAxisPanel(el); break;
    default:          html = `<p class="text-gray-400">未対応の要素です (${el.type})</p>`;
  }

  cont.innerHTML = html;

  // プロパティUI生成後に最新の応力情報を強制描画（M図/Q図即時反映）
  if (typeof window.callRender === 'function') window.callRender();
};

// グローバル登録
window.updatePropertyPanel = updatePropertyPanel;
