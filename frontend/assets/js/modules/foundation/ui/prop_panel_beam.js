// ui/prop_panel_beam.js
import { currentFloor } from '../foundation_cad.js';
import { syncSlabDataToBeams } from '../core/data_synchronizer.js';
import { handlePropChange } from '../state_manager.js';

/**
 * 梁・外周梁用のパネル
 */
export const buildBeamPanel = (el, fd) => {
  const index = el.index;
  const isPerimeter = el.type === 'perimeterBeam';
  
  syncSlabDataToBeams();

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
      <div class="prop-row"><span class="prop-label">符号</span><input id="prop-fbeam-id-${index}" class="prop-value" value="${pb.id}" readonly style="background:rgba(0,0,0,0.2); color:var(--text-muted); cursor:not-allowed;"></div>
      <div class="prop-row"><span class="prop-label">通り名</span><input id="prop-fbeam-axisName-${index}" class="prop-value" value="${pb.axisName || pb.axis || ''}" placeholder="壁と連動(例: X1)" onchange="window.handlePropChange('perimeterBeam', ${index}, 'axisName', this.value)"></div>
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
            <input id="prop-fbeam-width-${index}" class="prop-value" type="number" step="10" style="width:60px; margin-left:2px;" value="${pb.width || ''}" onchange="window.handlePropChange('perimeterBeam', ${index}, 'width', this.value)" placeholder="mm">
          </label>
          <label style="font-size:11px; color:var(--text-muted);">せい D:
            <input id="prop-fbeam-depth-${index}" class="prop-value" type="number" step="10" style="width:60px; margin-left:2px;" value="${pb.depth || ''}" onchange="window.handlePropChange('perimeterBeam', ${index}, 'depth', this.value)" placeholder="mm">
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
      <div class="prop-row"><span class="prop-label">符号</span><input id="prop-beam-id-${index}" class="prop-value" value="${b.id}" onchange="window.handlePropChange('beam', ${index}, 'id', this.value)"></div>
      <div class="prop-row"><span class="prop-label">通り名</span><input id="prop-beam-axisName-${index}" class="prop-value" value="${b.axisName || b.axis || ''}" placeholder="壁と連動(例: X1)" onchange="window.handlePropChange('beam', ${index}, 'axisName', this.value)"></div>
      <div class="prop-row"><span class="prop-label">始端(nodeStart)</span><span class="prop-value" style="border:none; background:none;">${n1 ? n1.id : '?'}</span></div>
      <div class="prop-row"><span class="prop-label">終端(nodeEnd)</span><span class="prop-value" style="border:none; background:none;">${n2 ? n2.id : '?'}</span></div>
      <div class="prop-row"><span class="prop-label">長さ (mm)</span><span class="prop-value" style="border:none; background:none;">${n1 && n2 ? Math.round(Math.hypot(n2.x-n1.x, n2.y-n1.y)) : '-'}</span></div>
    `;
    
    if (isFbeam) {
      html += `
      <hr style="border-color:#444; margin: 10px 0;">
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
            <input id="prop-beam-width-${index}" class="prop-value" type="number" step="10" style="width:60px; margin-left:2px;" value="${b.width || ''}" onchange="window.handlePropChange('beam', ${index}, 'width', this.value)" placeholder="mm">
          </label>
          <label style="font-size:11px; color:var(--text-muted);">せい D:
            <input id="prop-beam-depth-${index}" class="prop-value" type="number" step="10" style="width:60px; margin-left:2px;" value="${b.depth || ''}" onchange="window.handlePropChange('beam', ${index}, 'depth', this.value)" placeholder="mm">
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

window.buildBeamPanel = buildBeamPanel;
