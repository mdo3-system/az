import { floorData, currentFloor, FLOORS, dxfVAxes, dxfHAxes, dxfSkewedAxes } from './foundation_cad.js';
import { calculateRebarArea, generateOptions, escapeHtml } from './ui_utils.js';
import { handlePropChange } from './state_manager.js';
import { getAxisReferenceLine, getProjectedPos } from './rendering_helpers.js';

// modal_ui.js - 各種要素の詳細設定モーダルUIを一元管理

/**
 * --- 1. 柱 (Column) モーダル ---
 */
export const openColumnDetailModal = function(index) {
  const existingModal = document.getElementById('column-modal-overlay');
  if (existingModal && existingModal.parentNode) existingModal.remove();

  if (window.state) window.state.selectedElement = { type: 'column', index };
  if (typeof window.callRender === 'function') window.callRender();

  const fd = floorData[currentFloor];
  if (!fd || !fd.columns) return;
  const c = fd.columns[index];
  const n = fd.nodes[c.nodeIndex];
  if (!c || !n) return;

  const res = window.calculateColumnT ? window.calculateColumnT(index, fd) : {};
  const topOk = res.criticalCase?.isTopOk;
  const baseOk = res.criticalCase?.isBaseOk;

  const modal = document.createElement('div');
  modal.id = 'column-modal-overlay';
  modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; justify-content:center; align-items:center; z-index:10000;';
  modal.addEventListener('click', (e) => {
      if (e.target === modal && modal.parentNode) modal.remove();
  });

  const metalOptions = (typeof HARDWARE_MASTER !== 'undefined' ? HARDWARE_MASTER : []).map(m => `<option value="${m.id}" ${c.top_metalId===m.id?'selected':''}>${m.name}</option>`).join('');
  const baseMetalOptions = (typeof HARDWARE_MASTER !== 'undefined' ? HARDWARE_MASTER : []).map(m => `<option value="${m.id}" ${c.base_metalId===m.id?'selected':''}>${m.name}</option>`).join('');

  modal.innerHTML = `
    <div class="modal-content" style="width:90%; max-width:600px; max-height:85vh; background:#1e1e1e; color:#fff; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5); display:flex; flex-direction:column; overflow:hidden; border: 1px solid #444;">
      <div style="background:#2c3e50; padding:15px; border-bottom:1px solid #444; display:flex; justify-content:space-between; align-items:center;">
        <h3 style="margin:0; font-size:16px; color:#fff;">柱 (${n.id}) - プロパティ詳細</h3>
        <button onclick="{ const el = document.getElementById('column-modal-overlay'); if (el) el.remove(); }" style="background:none; border:none; color:#ddd; font-size:24px; cursor:pointer;">&times;</button>
      </div>
      <div style="padding:20px; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="flex:1; margin-right:10px;">
            <label style="color:#aaa; font-size:12px;">符号:</label><br>
            <input value="${c.id || ''}" onchange="window.handlePropChange('column', ${index}, 'id', this.value); { const el = document.getElementById('column-modal-overlay'); if (el) el.remove(); }; window.openColumnDetailModal(${index});" style="width:100%; padding:6px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
          </div>
          <div style="width:100px; text-align:right;">
            <label style="color:#2ecc71; font-size:11px; cursor:pointer;">
              <input type="checkbox" ${c.showReport ? 'checked' : ''} onchange="window.handlePropChange('column', ${index}, 'showReport', this.checked)" style="vertical-align:middle;"> 帳票出力
            </label>
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="color:#aaa; font-size:12px;">引張耐力検討用軸力 Nw (kN):</label><br>
          <input type="number" step="0.001" value="${c.nw !== undefined ? c.nw : (c.longTermAxial || 0)}" onchange="window.handlePropChange('column', ${index}, 'nw', this.value); { const el = document.getElementById('column-modal-overlay'); if (el) el.remove(); }; window.openColumnDetailModal(${index});" style="width:100%; padding:6px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
        </div>
        <div style="display:flex; gap:10px; margin-bottom:12px;">
          <div style="flex:1;">
            <label style="color:#aaa; font-size:12px;">Bi係数設定 (隅柱0.8/中柱0.5/自動):</label><br>
            <select onchange="window.handlePropChange('column', ${index}, 'biSetting', this.value); { const el = document.getElementById('column-modal-overlay'); if (el) el.remove(); }; window.openColumnDetailModal(${index});" style="width:100%; padding:6px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
              <option value="auto" ${!c.biSetting || c.biSetting==='auto'?'selected':''}>自動判定</option>
              <option value="0.8" ${c.biSetting==='0.8'?'selected':''}>隅柱 (0.8)</option>
              <option value="0.5" ${c.biSetting==='0.5'?'selected':''}>中柱 (0.5)</option>
            </select>
          </div>
          <div style="flex:1;">
            <label style="color:#aaa; font-size:12px;">個別階高 Hi (mm):</label><br>
            <input type="number" placeholder="自動(${fd.floorHeight || 2730})" value="${c.heightOverride || ''}" onchange="window.handlePropChange('column', ${index}, 'heightOverride', this.value); { const el = document.getElementById('column-modal-overlay'); if (el) el.remove(); }; window.openColumnDetailModal(${index});" style="width:100%; padding:6px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
          </div>
        </div>
        <div style="margin-bottom:15px;">
          <label style="color:#aaa; font-size:12px;">反曲点高比 B:</label><br>
          <input type="number" step="0.05" min="0" max="1.0" value="${c.inflectionRatio !== undefined ? c.inflectionRatio : 0.5}" onchange="window.handlePropChange('column', ${index}, 'inflectionRatio', this.value); { const el = document.getElementById('column-modal-overlay'); if (el) el.remove(); }; window.openColumnDetailModal(${index});" style="width:100%; padding:6px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
        </div>
        
        <h4 style="border-bottom:1px solid #555; padding-bottom:5px; margin-bottom:10px; color:#3498db;">金物選定 (引張判定)</h4>
        
        <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:6px; margin-bottom:10px;">
          <div style="color:#aaa; font-size:12px; margin-bottom:5px;">■ 柱頭 (Top) 金物</div>
          <select onchange="window.handlePropChange('column', ${index}, 'top_metalMode', this.value); { const el = document.getElementById('column-modal-overlay'); if (el) el.remove(); }; window.openColumnDetailModal(${index});" style="width:100%; margin-bottom:5px; padding:6px; background:#333; color:#fff; border:1px solid #444; border-radius:4px;">
            <option value="auto" ${c.top_metalMode==='auto'?'selected':''}>自動選定</option>
            <option value="manual" ${c.top_metalMode==='manual'?'selected':''}>手動選定</option>
          </select>
          ${c.top_metalMode==='manual' ? `<select onchange="window.handlePropChange('column', ${index}, 'top_metalId', this.value); { const el = document.getElementById('column-modal-overlay'); if (el) el.remove(); }; window.openColumnDetailModal(${index});" style="width:100%; padding:6px; background:#333; color:#fff; border:1px solid #444; border-radius:4px;">${metalOptions}</select>` : ''}
          <div style="margin-top:8px; display:flex; justify-content:space-between; background:#222; padding:8px; border-radius:4px; border:1px solid ${topOk?'#2ecc71':'#e74c3c'};">
             <div>必要引力 T: <b>${(res.T_top || 0).toFixed(3)} kN</b></div>
             <div>金物耐力 Ra: ${(res.criticalCase?.topMetal?.cap || 0).toFixed(3)} kN</div>
             <div style="color:${topOk?'#2ecc71':'#e74c3c'}; font-weight:bold;">${topOk?'OK':'NG'}</div>
          </div>
        </div>
        
        <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:6px;">
          <div style="color:#aaa; font-size:12px; margin-bottom:5px;">■ 柱脚 (Base) 金物</div>
          <select onchange="window.handlePropChange('column', ${index}, 'base_metalMode', this.value); { const el = document.getElementById('column-modal-overlay'); if (el) el.remove(); }; window.openColumnDetailModal(${index});" style="width:100%; margin-bottom:5px; padding:6px; background:#333; color:#fff; border:1px solid #444; border-radius:4px;">
            <option value="auto" ${c.base_metalMode==='auto'?'selected':''}>自動選定</option>
            <option value="manual" ${c.base_metalMode==='manual'?'selected':''}>手動選定</option>
          </select>
          ${c.base_metalMode==='manual' ? `<select onchange="window.handlePropChange('column', ${index}, 'base_metalId', this.value); { const el = document.getElementById('column-modal-overlay'); if (el) el.remove(); }; window.openColumnDetailModal(${index});" style="width:100%; padding:6px; background:#333; color:#fff; border:1px solid #444; border-radius:4px;">${baseMetalOptions}</select>` : ''}
          <div style="margin-top:8px; display:flex; justify-content:space-between; background:#222; padding:8px; border-radius:4px; border:1px solid ${baseOk?'#2ecc71':'#e74c3c'};">
             <div>必要引力 T: <b>${(res.T || 0).toFixed(3)} kN</b></div>
             <div>金物耐力 Ra: ${(res.criticalCase?.baseMetal?.cap || 0).toFixed(3)} kN</div>
             <div style="color:${baseOk?'#2ecc71':'#e74c3c'}; font-weight:bold;">${baseOk?'OK':'NG'}</div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
};

/**
 * --- 2. 壁 (Wall) & 水平構面 (Diaph) モーダル ---
 */
export const openWallDetailModal = function(index) {
  const existingModal = document.getElementById('wall-modal-overlay');
  if (existingModal && existingModal.parentNode) existingModal.remove();

  if (window.state) window.state.selectedElement = { type: 'wall', index };
  if (typeof window.callRender === 'function') window.callRender();

  const fd = floorData[currentFloor];
  if (!fd || !fd.walls) return;
  const w = fd.walls[index];
  if (!w) return;

  const n1 = fd.nodes[w.n1], n2 = fd.nodes[w.n2];
  if (typeof window.calculateWallProps === 'function') window.calculateWallProps(w, fd.nodes);

  const autoL = n1 && n2 ? Math.round(Math.hypot(n2.x - n1.x, n2.y - n1.y)) : 0;
  const wMult = w.multiplier !== undefined ? w.multiplier : 1.0;
  const isVirtual = wMult === 0;

  const modal = document.createElement('div');
  modal.id = 'wall-modal-overlay';
  modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; justify-content:center; align-items:center; z-index:10000;';
  modal.addEventListener('click', (e) => {
      if (e.target === modal && modal.parentNode) modal.remove();
  });

  const headerTitle = isVirtual ? '仮想壁 (通り定義線)' : '耐力壁';
  const headerColor = isVirtual ? '#9b59b6' : '#e67e22';

  const pAngle = w.angle || 0;
  const pMultX = (w.multiplier_x || 0).toFixed(3);
  const pMultY = (w.multiplier_y || 0).toFixed(3);

  modal.innerHTML = `
    <div class="modal-content" style="width:90%; max-width:500px; background:#1e1e1e; color:#fff; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5); display:flex; flex-direction:column; overflow:hidden; border: 1px solid #444;">
      <div style="background:${headerColor}; padding:15px; border-bottom:1px solid #444; display:flex; justify-content:space-between; align-items:center;">
        <h3 style="margin:0; font-size:16px; color:#fff;">${headerTitle} - プロパティ詳細</h3>
        <button onclick="{ const el = document.getElementById('wall-modal-overlay'); if (el) el.remove(); }" style="background:none; border:none; color:#fff; font-size:24px; cursor:pointer;">&times;</button>
      </div>
      <div style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="flex:1; margin-right:10px;">
            <label style="color:#aaa; font-size:12px;">符号:</label><br>
            <input value="${w.id || ''}" onchange="window.handlePropChange('wall', ${index}, 'id', this.value); { const el = document.getElementById('wall-modal-overlay'); if (el) el.remove(); }; window.openWallDetailModal(${index});" style="width:100%; padding:8px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
          </div>
          <div style="width:100px; text-align:right;">
            <label style="color:#e67e22; font-size:11px; cursor:pointer;">
              <input type="checkbox" ${w.showReport ? 'checked' : ''} onchange="window.handlePropChange('wall', ${index}, 'showReport', this.checked)" style="vertical-align:middle;"> 帳票出力
            </label>
          </div>
        </div>
        <div style="display:flex; gap:10px; margin-bottom:12px;">
          <div style="flex:1;">
            <label style="color:#aaa; font-size:12px;">通り名 (axisName):</label><br>
            <input value="${w.axisName || ''}" onchange="window.handlePropChange('wall', ${index}, 'axisName', this.value); { const el = document.getElementById('wall-modal-overlay'); if (el) el.remove(); }; window.openWallDetailModal(${index});" placeholder="例: X1" style="width:100%; padding:8px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
          </div>
          <div style="flex:1;">
            <label style="color:#aaa; font-size:12px;">壁倍率:</label><br>
            <input type="number" step="0.1" min="0" max="7" value="${w.multiplier !== undefined ? w.multiplier : 1.0}" onchange="window.handlePropChange('wall', ${index}, 'multiplier', this.value); { const el = document.getElementById('wall-modal-overlay'); if (el) el.remove(); }; window.openWallDetailModal(${index});" style="width:100%; padding:8px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="color:#aaa; font-size:12px;">設計長 L (mm) ※空欄で実長使用:</label><br>
          <input type="number" step="1" placeholder="実長: ${autoL}" value="${w.lengthOverride || ''}" onchange="window.handlePropChange('wall', ${index}, 'lengthOverride', this.value); { const el = document.getElementById('wall-modal-overlay'); if (el) el.remove(); }; window.openWallDetailModal(${index});" style="width:100%; padding:8px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
        </div>

        ${!isVirtual ? `
        <div style="margin-top:20px; padding:15px; background:rgba(230,126,34,0.1); border:1px solid rgba(230,126,34,0.3); border-radius:8px;">
          <h4 style="margin:0 0 10px 0; font-size:13px; color:#e67e22; border-bottom:1px solid rgba(230,126,34,0.2); padding-bottom:5px;">📐 斜め耐力壁の有効倍率換算</h4>
          <div style="font-size:11px; margin-bottom:10px; color:#ccc;">公式：グレー本（屋根・床の面内剛性/斜め耐力壁の寄与算出）</div>
          <table style="width:100%; font-size:12px; color:#eee;">
            <tr><td style="color:#aaa;">配置実長 L</td><td style="text-align:right;">${(w.length_m ? w.length_m*1000 : autoL).toFixed(0)} mm</td></tr>
            <tr><td style="color:#aaa;">配置角度 θ (基準:垂直)</td><td style="text-align:right;">${pAngle.toFixed(1)} °</td></tr>
            <tr style="border-top:1px solid #444;"><td colspan="2" style="padding-top:8px;"></td></tr>
            <tr>
              <td style="color:#3498db; font-weight:bold;">X方向有効(P・sin²θ)</td>
              <td style="text-align:right; font-size:14px; font-weight:bold; color:#3498db;">${pMultX}</td>
            </tr>
            <tr>
              <td style="color:#2ecc71; font-weight:bold;">Y方向有効(P・cos²θ)</td>
              <td style="text-align:right; font-size:14px; font-weight:bold; color:#2ecc71;">${pMultY}</td>
            </tr>
          </table>
          <p style="font-size:10px; color:#888; margin-top:8px; line-height:1.4;">※角度 θ ≦ 10° または θ ≧ 170° の場合は Y方向専用、|90°- θ| ≦ 10° の場合は X方向専用としてスナップ演算します。</p>
        </div>` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
};

export const openDiaphragmDetailModal = function(index) {
  const existingModal = document.getElementById('diaph-modal-overlay');
  if (existingModal && existingModal.parentNode) existingModal.remove();

  if (window.state) window.state.selectedElement = { type: 'diaphragm', index };
  if (typeof window.callRender === 'function') window.callRender();

  const fd = floorData[currentFloor];
  if (!fd || !fd.diaphragms || !fd.diaphragms[index]) return;
  const dia = fd.diaphragms[index];

  if (typeof window.calculateDiaphragmProps === 'function') window.calculateDiaphragmProps(dia, fd.nodes);

  const S = dia.area || 0;
  const X = dia.BBox_X || 1;
  const Y = dia.BBox_Y || 1;

  const modal = document.createElement('div');
  modal.id = 'diaph-modal-overlay';
  modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; justify-content:center; align-items:center; z-index:10000;';
  modal.addEventListener('click', (e) => { if (e.target === modal && modal.parentNode) modal.remove(); });

  modal.innerHTML = `
    <div style="background:#1e1e1e; color:#fff; border-radius:12px; max-width:550px; width:95%; max-height:90vh; overflow-y:auto; padding:0; box-shadow:0 20px 60px rgba(0,0,0,0.5); border:1px solid #444;">
      <div style="padding:15px; border-bottom:1px solid #444; display:flex; justify-content:space-between; align-items:center;">
        <h3 style="margin:0; font-size:16px; display:flex; align-items:center; gap:6px;">🏠 水平構面 ${dia.id || `D-${index+1}`} 詳細</h3>
        <button onclick="{ const el = document.getElementById('diaph-modal-overlay'); if (el) el.remove(); }" style="background:none; border:none; color:#aaa; font-size:22px; cursor:pointer;">&times;</button>
      </div>
      <div style="padding:20px; display:flex; flex-direction:column; overflow:hidden;">
        <div style="margin-bottom:15px; font-size:13px; color:#aaa;">
          <label style="color:#aaa; font-size:12px;">符号:</label> <span style="font-weight:bold;">${dia.id || ''}</span>
          &nbsp;&nbsp;
          <label style="color:#aaa; font-size:12px;">実面積 S:</label> <span style="color:#0f0; font-weight:bold;">${S.toFixed(3)} m²</span>
        </div>
        
        <div style="background:rgba(230,126,34,0.1); border-left:3px solid #e67e22; padding:10px; margin-bottom:15px; font-size:11px; color:#eee; line-height:1.5;">
          <strong>【形状減歩係数 η の算定ロジック】</strong><br>
          等価置換後の各方向奥行（Lx_eq, Ly_eq）を、元の図形の最大幅（X, Y）で除して η を求めます。<br>
          設計用有効幅 $W_{eq}$ は、等価奥行に η を乗じて算出し、不整形な形状による剛性・耐力の低減を安全側に評価します（最大 1.0）。
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:15px;">
          <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:8px; border:1px solid #333;">
            <h4 style="margin:0 0 10px 0; font-size:13px; color:#3498db; border-bottom:1px solid #3498db; padding-bottom:4px;">X方向検討</h4>
            <div style="font-size:11px; margin-bottom:5px; color:#bbb;">最大幅 X: ${ X.toFixed(2) } m / Y: ${ Y.toFixed(2) } m</div>
            <div style="font-size:12px; color:#eee;">等価奥行 Lx_eq (S/Y) = ${(dia.Lx_eq || 0).toFixed(3)} m</div>
            <div style="font-weight:bold; color:#f1c40f; font-size:12px;">減歩係数 ηx (Lx_eq/X) = ${(dia.eta_x || 0).toFixed(3)}</div>
            <div style="margin-top:8px; padding:5px; background:rgba(52,152,219,0.1); border-radius:4px;">
              <div style="font-size:10px; color:#888;">設計用有効幅 $W_{eq\_x}$</div>
              <div style="font-size:15px; font-weight:bold; color:#3498db;">${(dia.W_design_x || 0).toFixed(3)} m</div>
            </div>
          </div>
          <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:8px; border:1px solid #333;">
            <h4 style="margin:0 0 10px 0; font-size:13px; color:#2ecc71; border-bottom:1px solid #2ecc71; padding-bottom:4px;">Y方向検討</h4>
            <div style="font-size:11px; margin-bottom:5px; color:#bbb;">最大幅 X: ${ X.toFixed(2) } m / Y: ${ Y.toFixed(2) } m</div>
            <div style="font-size:12px; color:#eee;">等価奥行 Ly_eq (S/X) = ${(dia.Ly_eq || 0).toFixed(3)} m</div>
            <div style="font-weight:bold; color:#f1c40f; font-size:12px;">減歩係数 ηy (Ly_eq/Y) = ${(dia.eta_y || 0).toFixed(3)}</div>
            <div style="margin-top:8px; padding:5px; background:rgba(46,204,113,0.1); border-radius:4px;">
              <div style="font-size:10px; color:#888;">設計用有効幅 $W_{eq\_y}$</div>
              <div style="font-size:15px; font-weight:bold; color:#2ecc71;">${(dia.W_design_y || 0).toFixed(3)} m</div>
            </div>
          </div>
        </div>
        <div style="color:#555; margin-top:10px; text-align:right; font-size:11px;">※計算式: 実面積 S / スパン / 最大幅 による形状低減評価</div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
};

export const drawDiaphragmEquivalentImage = function(canvas, diaph, direction) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const padding = 60;

  const fd = floorData[currentFloor];
  const pts = (diaph.nodeIds || []).map(nid => fd.nodes[nid]).filter(Boolean);
  if (pts.length < 3) return;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  pts.forEach(p => {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  });

  const cx = diaph.cx;
  const cy = diaph.cy;
  
  let rectX1 = minX, rectY1 = minY;
  let rectX2 = 0, rectY2 = 0;

  if (direction === 'X') {
    rectX2 = minX + (diaph.Lex * 1000);
    rectY2 = maxY;
  } else {
    rectX2 = maxX;
    rectY2 = minY + (diaph.Ley * 1000);
  }

  const finalMinX = Math.min(minX, rectX1, rectX2);
  const finalMaxX = Math.max(maxX, rectX1, rectX2);
  const finalMinY = Math.min(minY, rectY1, rectY2);
  const finalMaxY = Math.max(maxY, rectY1, rectY2);

  const bW = finalMaxX - finalMinX;
  const bH = finalMaxY - finalMinY;
  const scale = Math.min((w - padding * 2) / (bW || 1), (h - padding * 2) / (bH || 1));

  const worldToScreen = (x, y) => ({
    x: w / 2 + (x - (finalMinX + finalMaxX) / 2) * scale,
    y: h / 2 - (y - (finalMinY + finalMaxY) / 2) * scale
  });

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  ctx.beginPath();
  pts.forEach((p, i) => {
    const s = worldToScreen(p.x, p.y);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });
  ctx.closePath();
  ctx.fillStyle = '#f8f9fa';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.setLineDash([4, 4]);     
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);         

  const rP1 = worldToScreen(rectX1, rectY1);
  const rP2 = worldToScreen(rectX2, rectY2);
  const rx = Math.min(rP1.x, rP2.x);
  const ry = Math.min(rP1.y, rP2.y);
  const rw = Math.abs(rP2.x - rP1.x);
  const rh = Math.abs(rP2.y - rP1.y);

  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  const isX = direction === 'X';
  ctx.strokeStyle = isX ? '#2980b9' : '#27ae60'; 
  ctx.fillStyle = isX ? 'rgba(41,128,185,0.3)' : 'rgba(39,174,96,0.3)';
  ctx.lineWidth = 2.5;
  ctx.fill();
  ctx.stroke();

  if (cx !== undefined && cy !== undefined) {
      const sc = worldToScreen(cx, cy);
      ctx.beginPath();
      ctx.moveTo(sc.x - 8, sc.y); ctx.lineTo(sc.x + 8, sc.y);
      ctx.moveTo(sc.x, sc.y - 8); ctx.lineTo(sc.x, sc.y + 8);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
  }

  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';
  ctx.fillText(isX ? '【X方向 等価面積】' : '【Y方向 等価面積】', 20, 35);
};

export const openWallAxialModal = function() {
  const allAxes = new Set();
  Object.values(floorData).forEach(fd => {
    (fd.walls || []).forEach(w => { if (w.axisName) allAxes.add(w.axisName); });
    (fd.beams || []).forEach(b => { if (b.axisName) allAxes.add(b.axisName); });
  });
  
  // 手動で定義された斜め通り芯を明示的に追加
  const skewedAxes = window.dxfSkewedAxes || dxfSkewedAxes || [];
  skewedAxes.forEach(ax => {
    if (ax.label) allAxes.add(ax.label);
  });

  const axisList = Array.from(allAxes).sort((a, b) => {
    // 数値が含まれる通り名（X1, X10等）を自然順にソート
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });

  if (axisList.length === 0) {
    alert('通り名が設定された耐力壁が見つかりません。属性パネルで通り名（X1, Y2等）を設定してください。');
    return;
  }

  const existing = document.getElementById('wallAxialModal');
  if (existing && existing.parentNode) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'wallAxialModal';
  modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:3000; display:flex; align-items:center; justify-content:center;';

  const inner = document.createElement('div');
  inner.style.cssText = 'background:var(--bg-panel); width:90%; height:90%; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; border:1px solid var(--border);';
  
  const headerHtml = `
    <div style="padding:15px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:#252a3a;">
      <h3 style="margin:0; font-size:16px;">🧱 耐力壁の許容耐力時 軸力図 (立面フレーム)</h3>
      <div style="display:flex; gap:10px; align-items:center;">
        <label style="font-size:12px;">通り選択: </label>
        <select id="axialAxisSelect" onchange="window.renderAxialElevation()" style="padding:4px 8px; background:var(--bg-input); color:#fff; border:1px solid var(--border); border-radius:4px;">
          ${axisList.map(a => `<option value="${a}">${a}</option>`).join('')}
        </select>
        <button onclick="{ const el = document.getElementById('wallAxialModal'); if (el) el.remove(); }" style="background:none; border:none; color:#fff; font-size:24px; cursor:pointer; margin-left:15px;">&times;</button>
      </div>
    </div>
  `;

  const canvasArea = `
    <div style="flex:1; padding:20px; overflow:auto; display:flex; gap:20px; background:#14161d;">
      <div style="flex:1; display:flex; flex-direction:column; align-items:center;">
        <div style="font-size:14px; font-weight:bold; color:var(--accent); margin-bottom:10px;">◀ 左加力時 (Rightward Push)</div>
        <canvas id="axialCanvasL" width="1000" height="600" style="background:#0a0c10; border:1px solid #333;"></canvas>
      </div>
      <div style="flex:1; display:flex; flex-direction:column; align-items:center;">
        <div style="font-size:14px; font-weight:bold; color:var(--warn); margin-bottom:10px;">▶ 右加力時 (Leftward Push)</div>
        <canvas id="axialCanvasR" width="1000" height="600" style="background:#0a0c10; border:1px solid #333;"></canvas>
      </div>
    </div>
  `;

  inner.innerHTML = headerHtml + canvasArea + `<div id="axialStressTableContainer" style="padding:20px; background:#1e1e1e; border-top:1px solid #333; overflow-y:auto; max-height:300px;"></div>`;
  modal.appendChild(inner);
  document.body.appendChild(modal);

  renderAxialElevation();
};

export const showAxialStressTable = function(data) {
  const container = document.getElementById('axialStressTableContainer');
  if (!container) return;
  
  if (data.length === 0) {
    container.innerHTML = '<div style="color:#888; text-align:center;">算定データがありません。</div>';
    return;
  }

  let html = `
    <h4 style="color:#fff; margin-top:0; margin-bottom:10px; font-size:14px; border-left:4px solid var(--accent); padding-left:8px;">応力の算定表 (水平荷重時)</h4>
    <table style="width:100%; border-collapse:collapse; color:#eee; font-size:11px;">
      <thead>
        <tr style="background:#2c3e50; text-align:center;">
          <th style="padding:6px; border:1px solid #444;">通り</th>
          <th style="padding:6px; border:1px solid #444;">階</th>
          <th style="padding:6px; border:1px solid #444;">壁符号</th>
          <th style="padding:6px; border:1px solid #444;">α</th>
          <th style="padding:6px; border:1px solid #444;">P (N)</th>
          <th style="padding:6px; border:1px solid #444;">N (N)</th>
          <th style="padding:6px; border:1px solid #444;">M (N·m)</th>
          <th style="padding:6px; border:1px solid #444;">Q (N)</th>
        </tr>
      </thead>
      <tbody>
  `;

  data.forEach(d => {
    html += `
      <tr style="text-align:right; background:rgba(255,255,255,0.02);">
        <td style="padding:5px; border:1px solid #444; text-align:center;">${d.axisName}</td>
        <td style="padding:5px; border:1px solid #444; text-align:center;">${d.floor}</td>
        <td style="padding:5px; border:1px solid #444; text-align:center;">${d.wallId}</td>
        <td style="padding:5px; border:1px solid #444; text-align:center;">${d.alpha}</td>
        <td style="padding:5px; border:1px solid #444;">${d.P.toLocaleString()}</td>
        <td style="padding:5px; border:1px solid #444;">${d.N.toLocaleString()}</td>
        <td style="padding:5px; border:1px solid #444;">${d.M.toLocaleString()}</td>
        <td style="padding:5px; border:1px solid #444;">${d.Q.toLocaleString()}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
};

export const renderAxialElevation = function() {
  const axisName = document.getElementById('axialAxisSelect').value;
  const floors = ['PH', 'R', '3', '2', '1'];
  
  // 💡 通り芯のリファレンスライン（剛体投影用）を取得
  const refLine = getAxisReferenceLine(axisName);
  if (!refLine) return;

  const floorDataMap = [];
  
  // 💡 プロジェクト全体で耐力壁が存在する最高階を特定
  let maxRelIdx = 4;
  floors.forEach((f, idx) => {
    const fd = (window.allFloorData && window.allFloorData[f]) || (window.floorData && window.floorData[f]) || floorData[f];
    if (fd && (fd.walls || []).length > 0) {
      if (idx < maxRelIdx) maxRelIdx = idx;
    }
  });

  floors.forEach((floor, idx) => {
    const fd = (window.allFloorData && window.allFloorData[floor]) || (window.floorData && window.floorData[floor]) || floorData[floor];
    if (!fd) return;

    // 足切り（剛体投影で 15mm 以上離れているものは除外）
    const wallsOnAxis = (fd.walls || []).filter(w => {
      if (!w.axisName || w.axisName.trim() !== axisName.trim()) return false;
      const n1 = fd.nodes[w.n1], n2 = fd.nodes[w.n2];
      if (!n1 || !n2) return false;
      const o1 = getProjectedPos(n1, refLine).offset;
      const o2 = getProjectedPos(n2, refLine).offset;
      return Math.abs(o1) < 100 && Math.abs(o2) < 100;
    });
    
    // 💡 壁に接している柱、または投影ライン上にある柱を抽出
    const columnsOnAxis = (fd.columns || []).filter(c => {
      const n = fd.nodes[c.nodeIndex];
      if (!n) return false;
      const offset = getProjectedPos(n, refLine).offset;
      return Math.abs(offset) < 100;
    });

    // 💡 その軸にオブジェクトがない場合でも、プロジェクト全体の最高階以下の階であれば含める（階ライン描画のため）
    if (wallsOnAxis.length === 0 && columnsOnAxis.length === 0) {
      if (idx >= maxRelIdx) {
        floorDataMap.push({ floor, walls: [], columns: [], fd });
      }
      return;
    }
    floorDataMap.push({ floor, walls: wallsOnAxis, columns: columnsOnAxis, fd });
  });

  if (floorDataMap.length === 0) return;
  
  // 💡 描画範囲の決定（投影距離 L で計算）
  const getPos = (n) => getProjectedPos(n, refLine).L;
  const pValues = [];
  floorDataMap.forEach(fm => {
    fm.walls.forEach(w => {
      if (fm.fd.nodes[w.n1]) pValues.push(getPos(fm.fd.nodes[w.n1]));
      if (fm.fd.nodes[w.n2]) pValues.push(getPos(fm.fd.nodes[w.n2]));
    });
    fm.columns.forEach(c => {
      if (fm.fd.nodes[c.nodeIndex]) pValues.push(getPos(fm.fd.nodes[c.nodeIndex]));
    });
  });

  let startPos = 0, totalLength = 1000;
  if (pValues.length >= 2) {
    const minP = Math.min(...pValues), maxP = Math.max(...pValues);
    startPos = minP;
    totalLength = maxP - minP;
  } else if (pValues.length === 1) {
    startPos = pValues[0] - 500;
    totalLength = 1000;
  }

  // 💡 通り芯の主方向判定（ラベルアンカーなどの微調整用）
  const isXHorizontal = Math.abs(Math.cos(refLine.angle)) > 0.5;

  const forceMap = {};
  floors.forEach(f => forceMap[f] = {});
  const tableData = [];

  floorDataMap.forEach((fm, idx) => {
    const f = fm.floor;
    const prevFloorData = floorDataMap[idx - 1];
    
    if (prevFloorData && forceMap[prevFloorData.floor]) {
      Object.entries(forceMap[prevFloorData.floor]).forEach(([pos, forces]) => {
        const d = parseFloat(pos);
        const currentNodes = Array.from(new Set(fm.walls.flatMap(w => [getPos(fm.fd.nodes[w.n1]), getPos(fm.fd.nodes[w.n2])]))).sort((a,b)=>a-b);
        if (currentNodes.length > 0) {
          let leftIdx = -1;
          for(let i=0; i<currentNodes.length; i++) {
            if (currentNodes[i] <= d) leftIdx = i;
          }
          if (leftIdx === -1) {
            const p = currentNodes[0];
            forceMap[f][p] = forceMap[f][p] || { L:0, R:0 };
            forceMap[f][p].L += forces.L; forceMap[f][p].R += forces.R;
          } else if (leftIdx === currentNodes.length - 1) {
            const p = currentNodes[currentNodes.length -1];
            forceMap[f][p] = forceMap[f][p] || { L:0, R:0 };
            forceMap[f][p].L += forces.L; forceMap[f][p].R += forces.R;
          } else {
            const d1 = currentNodes[leftIdx], d2 = currentNodes[leftIdx+1];
            const ratio2 = (d - d1) / (d2 - d1);
            const ratio1 = 1 - ratio2;
            forceMap[f][d1] = forceMap[f][d1] || { L:0, R:0 };
            forceMap[f][d2] = forceMap[f][d2] || { L:0, R:0 };
            forceMap[f][d1].L += forces.L * ratio1; forceMap[f][d1].R += forces.R * ratio1;
            forceMap[f][d2].L += forces.L * ratio2; forceMap[f][d2].R += forces.R * ratio2;
          }
        }
      });
    }

    fm.walls.forEach(w => {
      const n1 = fm.fd.nodes[w.n1], n2 = fm.fd.nodes[w.n2];
      const p1 = getPos(n1), p2 = getPos(n2);
      const L_mm = Math.abs(p2 - p1);
      const L = L_mm / 1000;
      if (L < 0.01) return;
      
      const alpha = w.multiplier || 0;
      const P_kN = alpha * 1.96 * L;
      const H_mm = (w.heightOverride || fm.fd.floorHeight || 2730);
      const H = H_mm / 1000;
      const N_kN = P_kN * H / L;
      const M_kN_m = P_kN * H * 0.5;

      const leftP = Math.min(p1, p2), rightP = Math.max(p1, p2);
      forceMap[f][leftP] = forceMap[f][leftP] || { L:0, R:0 };
      forceMap[f][rightP] = forceMap[f][rightP] || { L:0, R:0 };
      
      forceMap[f][leftP].L -= N_kN; forceMap[f][rightP].L += N_kN;
      forceMap[f][leftP].R += N_kN; forceMap[f][rightP].R -= N_kN;
      
      w._calc_P_N = Math.round(P_kN * 1000);
      w._calc_N_N = Math.round(N_kN * 1000);
      w._calc_M_N = Math.round(M_kN_m * 1000);
      
      tableData.push({ axisName, floor: f, wallId: w.id || '', alpha, P: w._calc_P_N, N: w._calc_N_N, M: w._calc_M_N, Q: w._calc_P_N });
    });
  });

  drawAxialElevationOnCanvas('axialCanvasL', floorDataMap, forceMap, 'L', startPos, totalLength, isXHorizontal, refLine);
  drawAxialElevationOnCanvas('axialCanvasR', floorDataMap, forceMap, 'R', startPos, totalLength, isXHorizontal, refLine);
  showAxialStressTable(tableData);
};

export const drawAxialElevationOnCanvas = function(canvasId, floorDataMap, forceMap, mode, startPos, totalLength, isXHorizontal, refLine) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  
  const getPos = (n) => getProjectedPos(n, refLine).L;
  const padding = 60;
  const totalHeight = floorDataMap.reduce((sum, fm) => sum + (fm.fd.floorHeight || 2730), 0);
  
  const scaleX = (W - padding * 2) / Math.max(totalLength, 1);
  const scaleZ = (H - padding * 2) / Math.max(totalHeight, 1);
  const scale = Math.min(scaleX, scaleZ, 0.1); 

  const getX = (pos) => padding + (pos - startPos) * scale;
  
  const floorYMap = {};
  let currentY = H - 80;
  [...floorDataMap].reverse().forEach(fm => {
    floorYMap[fm.floor] = currentY;
    currentY -= (fm.fd.floorHeight || 2730) * scale;
  });
  const topFloor = floorDataMap[0];
  if (topFloor) {
    floorYMap['TOP'] = floorYMap[topFloor.floor] - (topFloor.fd.floorHeight || 2730) * scale;
  }

  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  Object.entries(floorYMap).forEach(([f, y]) => {
    ctx.beginPath(); ctx.moveTo(padding-20, y); ctx.lineTo(W-padding+20, y); ctx.stroke();
    if (f !== 'TOP') {
      ctx.fillStyle = '#888'; ctx.font = '10px sans-serif';
      ctx.fillText(f + (f==='1'?'F/GL':'F'), 5, y + 3);
    }
  });

  floorDataMap.forEach((fm, idx) => {
    const yBot = floorYMap[fm.floor];
    const nextFm = floorDataMap[idx - 1];
    const yTop = nextFm ? floorYMap[nextFm.floor] : floorYMap['TOP'];
    
    const axisPositionsMap = new Map();
    fm.walls.forEach(w => {
      const n1 = fm.fd.nodes[w.n1], n2 = fm.fd.nodes[w.n2];
      if (n1) axisPositionsMap.set(getPos(n1), n1);
      if (n2) axisPositionsMap.set(getPos(n2), n2);
    });
    fm.columns.forEach(c => {
      const n = fm.fd.nodes[c.nodeIndex];
      if (n) axisPositionsMap.set(getPos(n), n);
    });
    
    ctx.strokeStyle = '#555';
    Array.from(axisPositionsMap.entries()).sort((a,b)=>a[0]-b[0]).forEach(([p, node]) => {
      const x = getX(p);
      ctx.beginPath(); ctx.moveTo(x, yBot); ctx.lineTo(x, yTop); ctx.stroke();

      // 💡 構造ノード位置でのグリッドラベル探索と表示
      if (node && String(fm.floor) === '1') {
        let labelStrs = [];
        const vAx = (window.dxfVAxes || dxfVAxes || []).find(ax => Math.abs(ax.x - node.x) < 15);
        if (vAx && vAx.label) labelStrs.push(vAx.label);
        const hAx = (window.dxfHAxes || dxfHAxes || []).find(ax => Math.abs(ax.y - node.y) < 15);
        if (hAx && hAx.label && !vAx) labelStrs.push(hAx.label);
        else if (hAx && hAx.label && vAx) labelStrs.push(hAx.label);

        const labelToDraw = labelStrs.join('・');
        if (labelToDraw) {
          ctx.fillStyle = '#888'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(labelToDraw, x, yBot + 25);
        }
      }

      // 柱の引抜力 (Td) の表示
      const cIdx = fm.columns.findIndex(c => Math.abs(getPos(fm.fd.nodes[c.nodeIndex]) - p) < 5);
      if (cIdx !== -1 && window.calculateColumnT) {
        const res = window.calculateColumnT(cIdx, fm.fd, fm.floor);
        const caseName = mode === 'L' ? '左から' : '右から';
        const targetCase = (res.cases || []).find(c => c.name.includes(caseName));
        const td_val = targetCase ? targetCase.T_bot : 0;
        const td_N = Math.round(td_val * 1000);
        if (td_N > 0) {
          ctx.fillStyle = '#f5a623'; ctx.font = 'bold 9px sans-serif';
          ctx.fillText(`Td:${td_N}N`, x + 4, yBot - 5);
        }
      }
    });


    fm.walls.forEach(w => {
      const n1 = fm.fd.nodes[w.n1], n2 = fm.fd.nodes[w.n2];
      const x1 = getX(getPos(n1)), x2 = getX(getPos(n2));
      const leftX = Math.min(x1, x2), rightX = Math.max(x1, x2);
      
      ctx.fillStyle = 'rgba(91,138,254,0.1)';
      ctx.fillRect(leftX, yTop, rightX - leftX, yBot - yTop);
      ctx.strokeStyle = w.multiplier > 0 ? '#5b8afe' : '#444';
      ctx.setLineDash(w.multiplier > 0 ? [] : [4, 4]);
      ctx.strokeRect(leftX, yTop, rightX - leftX, yBot - yTop);
      ctx.beginPath(); ctx.moveTo(leftX, yTop); ctx.lineTo(rightX, yBot); ctx.moveTo(rightX, yTop); ctx.lineTo(leftX, yBot); ctx.stroke(); ctx.setLineDash([]);
      
      if (w.multiplier > 0) {
        ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif';
        ctx.fillText(`α:${w.multiplier}`, leftX + 5, yTop + 12);
        ctx.fillText(`P:${w._calc_P_N}N`, leftX + 5, yTop + 24);
        ctx.fillText(`N:${w._calc_N_N}N`, leftX + 5, yTop + 36);
      }
    });

    const nodeIdsOnAxis = new Set(fm.walls.flatMap(w => [w.n1, w.n2]));
    nodeIdsOnAxis.forEach(nId => {
      const beamsAtNode = (fm.fd.beams || []).filter(b => b.n1 === nId || b.n2 === nId);
      const isOrthogonal = beamsAtNode.some(b => {
        const otherNodeId = b.n1 === nId ? b.n2 : b.n1;
        const otherNode = fm.fd.nodes[otherNodeId];
        if (!otherNode) return false;
        const distPerp = isXHorizontal ? Math.abs(otherNode.y - fm.fd.nodes[nId].y) : Math.abs(otherNode.x - fm.fd.nodes[nId].x);
        return distPerp > 10;
      });
      if (isOrthogonal) {
        const x = getX(getPos(fm.fd.nodes[nId]));
        ctx.fillStyle = '#f5a623'; ctx.font = '12px sans-serif';
        ctx.fillText('△', x - 6, yBot + 12);
      }
    });
  });

  ctx.font = 'bold 10px monospace';
  floorDataMap.forEach((fm) => {
    const f = fm.floor;
    const forces = forceMap[f] || {};
    Object.entries(forces).forEach(([pos, val]) => {
      const x = getX(parseFloat(pos));
      const n_kN = mode === 'L' ? val.L : val.R;
      if (Math.abs(n_kN) < 0.01) return;
      const n_N = Math.round(n_kN * 1000);
      ctx.fillStyle = n_N > 0 ? '#f25c5c' : '#34c77b';
      ctx.fillText((n_N > 0 ? '+' : '') + n_N, x - 15, floorYMap[f] + (n_N > 0 ? 15 : -5));
    });
  });
};

/**
 * --- 3. スラブ (Slab) モーダル & エディタ ---
 */
export const openSlabDetailModal = (index) => {
    const existingModal = document.getElementById('slab-modal-overlay');
    if (existingModal && existingModal.parentNode) existingModal.remove();

    window.highlightedSlabIndex = index;
    if (typeof window.callRender === 'function') window.callRender();

    const fd = floorData[currentFloor];
    if (!fd || !fd.slabs) return;
    const sl = fd.slabs[index];
    if (!sl) return;

    // 💡 断面検定データの一元管理参照
    if (!sl.aijData && typeof window.calculateAndSetSlabAIJStress === 'function') {
        window.calculateAndSetSlabAIJStress(sl, fd.nodes);
    }
    const data = sl.aijData || {};

    const resultText = data.isOK ? "判定：OK" : "判定：NG";
    const badgeColor = data.isOK ? "#27ae60" : "#e74c3c";
    const color_s = (data.ratioX > 1.0) ? "#e74c3c" : "#aaa";
    const color_l = (data.ratioY > 1.0) ? "#e74c3c" : "#aaa";

    const modal = document.createElement('div');
    modal.id = 'slab-modal-overlay';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; justify-content:center; align-items:center; z-index:10000;';
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal && modal.parentNode) {
            window.closeSlabDetailModal();
        }
    });

    const calcHtml = `
      <style>
        .calc-container { background: #f8f9fa; padding:20px; border-radius:10px; border:1px solid #dee2e6; color: #333; }
        .calc-section-title { margin: 20px 0 10px 0; font-size:15px; color:#27ae60; border-bottom:2px solid #27ae60; padding-bottom:5px; }
        .calc-section-title:first-child { margin-top: 0; }
        .calc-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; background: white; }
        .calc-table th, .calc-table td { border: 1px solid #dee2e6; padding: 10px 12px; text-align: left; }
        .calc-table th { background: #f1f3f5; color: #495057; width: 25%; }
        .calc-table td { color: #212529; }
        .calc-status { font-weight: bold; font-size: 14px; }
      </style>
      <div class="calc-container">
        <h3 class="calc-section-title">🔍 [1] 設計条件</h3>
        <table class="calc-table">
          <tr><th>スラブ厚 (t)</th><td>${data.t || 0} mm</td><th>有効高 (d)</th><td>${((data.t||0)-(data.dt||0)).toFixed(1)} mm</td></tr>
          <tr><th>基準強度 (Ft)</th><td>${data.ft || 0} kN/m²</td><th>単位荷重 (w)</th><td>${(data.w||0).toFixed(2)} kN/m²</td></tr>
        </table>

        <h3 class="calc-section-title">🔍 [2] 応力算定</h3>
        <table class="calc-table">
          <tr><th>短辺スパン (lx)</th><td>${(data.lx||0).toFixed(3)} m</td><th>長辺スパン (ly)</th><td>${(data.ly||0).toFixed(3)} m</td></tr>
          <tr><th>辺長比 (λ=ly/lx)</th><td>${(data.lambda||0).toFixed(3)}</td><th>支持条件</th><td>${data.cond || ''}</td></tr>
          <tr>
            <th>${data.shortLabel} モーメント (M)</th><td>端部: ${(data.Mx1||0).toFixed(2)} / 中央: ${(data.Mx2||0).toFixed(2)} <small>kN・m</small></td>
            <th>${data.longLabel} モーメント (M)</th><td>端部: ${(data.My1||0).toFixed(2)} / 中央: ${(data.My2||0).toFixed(2)} <small>kN・m</small></td>
          </tr>
        </table>

        <h3 class="calc-section-title">🔍 [3] 断面検定 (必要鉄筋量 at vs 現行配筋量 At)</h3>
        <table class="calc-table">
          <thead>
            <tr style="background: #e9ecef;">
              <th style="width:20%;">検討区分</th>
              <th style="width:20%;">必要 at <small>(mm²/m)</small></th>
              <th style="width:20%;">現行 At <small>(mm²/m)</small></th>
              <th style="width:20%;">検定比</th>
              <th style="width:20%;">最終判定</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${data.shortLabel}方向</td>
              <td>${(data.reqAtX||0).toFixed(1)}</td>
              <td>${(data.actualAtX||0).toFixed(1)}</td>
              <td style="color:${color_s === '#aaa' ? '#333' : color_s};" class="calc-status">${(data.ratioX||0).toFixed(3)}</td>
              <td style="color:${color_s === '#aaa' ? '#27ae60' : color_s};" class="calc-status">${data.ratioX <= 1.0 ? 'OK' : 'NG'}</td>
            </tr>
            <tr>
              <td>${data.longLabel}方向</td>
              <td>${(data.reqAtY||0).toFixed(1)}</td>
              <td>${(data.actualAtY||0).toFixed(1)}</td>
              <td style="color:${color_l === '#aaa' ? '#333' : color_l};" class="calc-status">${(data.ratioY||0).toFixed(3)}</td>
              <td style="color:${color_l === '#aaa' ? '#27ae60' : color_l};" class="calc-status">${data.ratioY <= 1.0 ? 'OK' : 'NG'}</td>
            </tr>
          </tbody>
        </table>
        <div style="font-size:11px; color:#6c757d; text-align:right;">※計算式: AIJ略算式 (C・w・lx²) 準拠 / 有効せい d=${((data.t||0)-(data.dt||0)).toFixed(1)}mm / j=7/8d</div>
      </div>
    `;

    const thicknesses = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];
    const fts = [180, 195, 210, 225, 240];

    modal.innerHTML = `
      <div class="modal-content" style="width:90%; max-width:1000px; height:85%; background:white; border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,0.3); display:flex; flex-direction:column; overflow:hidden; color:#333; border: 1px solid #ccc;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:20px 25px; border-bottom:1px solid #eee; background:#f8f9fa; flex-shrink:0;">
          <h2 style="margin:0; font-size:20px; display:flex; align-items:center; gap:12px; color:#2c3e50;">
            <span style="font-size:24px;">📄</span> スラブ符号: 
            <input type="text" 
                   value="${escapeHtml(sl.id)}" 
                   onchange="window.handlePropChange('slab', ${index}, 'id', this.value)" 
                   style="font-size:18px; padding:4px 8px; width:140px; border:1px solid #ccc; border-radius:4px; background:white; color:#333;">
            の断面検定
            <span style="background:${badgeColor}; color:white; padding:2px 10px; border-radius:20px; font-size:14px; margin-left:15px; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                ${resultText}
            </span>
          </h2>
          <div style="display:flex; align-items:center; gap:20px;">
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer; background:#fff; padding:6px 12px; border:1px solid #ccc; border-radius:4px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <input type="checkbox" ${sl.showReport !== false ? 'checked' : ''} 
                     onchange="window.handlePropChange('slab', ${index}, 'showReport', this.checked)" 
                     style="transform:scale(1.2); margin:0;">
              <strong style="color:#c0392b; font-size:14px;">帳票出力</strong>
            </label>
            <button onclick="window.closeSlabDetailModal()" style="background:transparent; border:none; color:#999; font-size:28px; cursor:pointer; line-height:1;">&times;</button>
          </div>
        </div>

        <div style="flex-grow:1; overflow-y:auto; padding:25px;">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:25px; margin-bottom:30px;">
            <div style="background:#f8f9fa; padding:20px; border-radius:10px; border:1px solid #e9ecef;">
              <h3 style="margin-top:0; font-size:14px; color:#495057; border-bottom:2px solid #dee2e6; padding-bottom:8px; margin-bottom:15px; display:flex; align-items:center; gap:8px;">🛠️ 基本設計条件</h3>
              <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <tr><td style="padding:6px 0; color:#6c757d;">計算式</td><td style="text-align:right; color:#212529;">AIJ 略算式 (4辺固定等)</td></tr>
                <tr><td style="padding:6px 0; color:#6c757d;">支持条件</td><td style="text-align:right;">
                    <select onchange="window.handlePropChange('slab', ${index}, 'supportCondition', this.value)" style="background:#fff; color:#333; border:1px solid #ced4da; border-radius:4px; padding:3px 8px; font-size:12px; max-width:140px;">
                        ${generateOptions(['自動判定', '4辺固定', '3辺固定1辺ピン（長辺ピン）', '3辺固定1辺ピン（短辺ピン）', '2辺隣辺固定2辺ピン', '2辺長辺固定2辺ピン', '2辺短辺固定2辺ピン', '1辺固定3辺ピン（長辺固定）', '4辺ピン', '片持ち（跳出し）'], window.normalizeSupportCondition ? window.normalizeSupportCondition(data.cond || '4辺固定') : (data.cond || '4辺固定'))}
                    </select>
                </td></tr>
                <tr><td style="padding:6px 0; color:#6c757d;">有効スパン</td><td style="text-align:right; color:#212529;">lx = ${(data.lx||0).toFixed(3)} m / ly = ${(data.ly||0).toFixed(3)} m</td></tr>
                <tr><td style="padding:6px 0; color:#6c757d; width:120px;">スラブ厚 (t)</td><td style="text-align:right;">
                    <select onchange="window.handlePropChange('slab', ${index}, 't', this.value)" style="background:#fff; color:#333; border:1px solid #ced4da; border-radius:4px; padding:3px 8px; font-size:13px;">${generateOptions(thicknesses, data.t || 150)}</select> <span style="color:#666;">mm</span>
                </td></tr>
                <tr><td style="padding:6px 0; color:#6c757d;">鉄筋重心 (dt)</td><td style="text-align:right;">
                    <input type="number" step="5" value="${data.dt !== undefined ? data.dt : 70}" onchange="window.handlePropChange('slab', ${index}, 'dt', this.value)" style="width:60px; text-align:right; background:#fff; color:#333; border:1px solid #ced4da; border-radius:4px; padding:3px 8px; font-size:13px;"> <span style="color:#666;">mm</span>
                </td></tr>
              </table>
            </div>
            <div style="background:#f8f9fa; padding:20px; border-radius:10px; border:1px solid #e9ecef;">
              <h3 style="margin-top:0; font-size:14px; color:#495057; border-bottom:2px solid #dee2e6; padding-bottom:8px; margin-bottom:15px; display:flex; align-items:center; gap:8px;">📐 設計荷重・材料</h3>
              <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <tr><td style="padding:6px 0; color:#6c757d;">設計接地圧 (q)</td><td style="text-align:right;">
                    <input type="number" step="0.001" value="${(data.w !== undefined ? data.w : 30.0).toFixed(3)}" onchange="window.handlePropChange('slab', ${index}, 'groundPressure', this.value)" style="width:90px; text-align:right; background:#fff; color:#333; border:1px solid #ced4da; border-radius:4px; padding:3px 8px; font-size:13px; font-weight:bold; color:#007bff;"> <span style="color:#666; font-size:10px;">kN/m²</span>
                </td></tr>
                <tr><td style="padding:4px 0; color:#6c757d;">鉄筋材料 (ft)</td><td style="text-align:right;">
                    <select onchange="window.handlePropChange('slab', ${index}, 'ft', this.value)" style="background:#fff; color:#333; border:1px solid #ced4da; border-radius:4px; padding:3px 8px; font-size:13px;">${generateOptions(fts, data.ft || 195)}</select>
                </td></tr>
                <tr><td style="padding:8px 0; color:#6c757d;">${data.shortLabel}配筋</td><td style="text-align:right;">
                    <select onchange="window.handlePropChange('slab', ${index}, 'shortRebar', this.value)" style="background:#fff; border:1px solid #ced4da; border-radius:4px; padding:2px;">${generateOptions(['D10','D13','D16','D10+D13','D13+D16'], data.sR)}</select>
                    @<select onchange="window.handlePropChange('slab', ${index}, 'shortPitch', this.value)" style="background:#fff; border:1px solid #ced4da; border-radius:4px; padding:2px;">${generateOptions([75,100,150,200,300], data.sP)}</select>
                    <div style="color:${data.ratioX > 1.0 ? '#e74c3c' : '#27ae60'}; font-weight:bold; font-size:11px; margin-top:4px;">検定比: ${(data.ratioX||0).toFixed(2)} (NG:${data.ratioX > 1.0 ? '有' : '無'})</div>
                </td></tr>
                <tr><td style="padding:8px 0; color:#6c757d;">${data.longLabel}配筋</td><td style="text-align:right;">
                    <select onchange="window.handlePropChange('slab', ${index}, 'longRebar', this.value)" style="background:#fff; border:1px solid #ced4da; border-radius:4px; padding:2px;">${generateOptions(['D10','D13','D16','D10+D13','D13+D16'], data.lR)}</select>
                    @<select onchange="window.handlePropChange('slab', ${index}, 'longPitch', this.value)" style="background:#fff; border:1px solid #ced4da; border-radius:4px; padding:2px;">${generateOptions([75,100,150,200,300], data.lP)}</select>
                    <div style="color:${data.ratioY > 1.0 ? '#e74c3c' : '#27ae60'}; font-weight:bold; font-size:11px; margin-top:4px;">検定比: ${(data.ratioY||0).toFixed(2)} (NG:${data.ratioY > 1.0 ? '有' : '無'})</div>
                </td></tr>
              </table>
            </div>
          </div>

          <div style="text-align: right; margin-bottom: 5px;">
            <button id="copy-btn" 
                    onclick="window.copySlabCalcToClipboard()" 
                    style="padding:8px 15px; background:#34495e; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px; display:inline-flex; align-items:center; gap:5px; transition: background 0.2s;">
                📋 計算結果をコピー
            </button>
          </div>

          ${calcHtml}
        </div>

        <div style="padding:15px 25px; border-top:1px solid #eee; background:#f8f9fa; text-align:right; flex-shrink:0;">
          <button onclick="window.closeSlabDetailModal()" style="padding:10px 30px; background:#495057; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px; transition: background 0.2s;">閉じる</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
};

export const openSlabEditor = (index) => {
    const existing = document.getElementById('slab-editor-modal');
    if(existing && existing.parentNode) existing.remove();

    const currentFloorKey = window.currentFloor || '1';
    const fd = (window.allFloorData && window.allFloorData[currentFloorKey]) || (window.floorData && window.floorData[currentFloorKey]);
    if (!fd || !fd.slabs || !fd.slabs[index]) return;
    const sl = fd.slabs[index];

    // 💡 断面検定データの一元管理参照（常に最新を計算）
    if (typeof window.calculateAndSetSlabAIJStress === 'function') {
        window.calculateAndSetSlabAIJStress(sl, fd.nodes);
    }
    const data = sl.aijData || {};

    const thicknesses = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];
    const rebars = ['D10', 'D13', 'D16', 'D10+D13', 'D13+D16'];
    const pitches = [75, 100, 150, 200, 300];

    const actualArea_x = data.actualAtX || 0;
    const actualArea_y = data.actualAtY || 0;

    const MaX = actualArea_x * (data.ft || 195) * (data.j || 1) * 1e-6;
    const MaY = actualArea_y * (data.ft || 195) * (data.j || 1) * 1e-6;

    let calcHtml = '<div style="color:#c0392b; padding:20px; font-weight:bold;">応力計算不可</div>';
    if (data.lx) {
        calcHtml = `
          <div style="background:#fff; padding:20px; border:1.5px solid #000; border-radius:6px; height:100%; color:#000; overflow-y:auto;">
            <div style="margin-bottom:15px; line-height:1.7; font-size:14px; border-left:5px solid #2980b9; padding-left:15px; background:#f9f9f9;">
              <strong>【グレー本準拠 断面検定】</strong><br>
              支持：<span style="color:#2980b9; font-weight:bold;">${data.cond}</span> / lx=${data.lx.toFixed(3)}m, ly=${data.ly.toFixed(3)}m<br>
              w=${data.w.toFixed(3)} kN/m², 有効せい d=${(data.t - data.dt).toFixed(1)}mm, j=${data.j.toFixed(2)}mm
            </div>
            
            <div style="margin-bottom:15px; font-weight:bold; border-bottom:2px solid #333; color:#34495e;">■ ${data.shortLabel}方向</div>
            <div style="border:1.5px solid #ccc; padding:12px; border-radius:4px; background:#fff; margin-bottom:20px;">
                <div style="color:#2980b9; font-size:12px; font-weight:bold;">配筋: ${data.sR}@${data.sP}</div>
                <div style="font-size:13px; margin:4px 0;">端部(x1) = ${data.Mx1.toFixed(2)} / 中央(x2) = ${data.Mx2.toFixed(2)} <small>kN･m</small></div>
                <div style="font-size:13px;">Ma = ${MaX.toFixed(2)} kN･m</div>
                <div style="margin-top:5px; text-align:right;">検定比 = <strong style="color:${data.ratioX<=1?'#27ae60':'#c0392b'}; font-size:18px;">${data.ratioX.toFixed(2)}</strong></div>
            </div>

            <div style="margin-bottom:15px; font-weight:bold; border-bottom:2px solid #333; color:#34495e;">■ ${data.longLabel}方向</div>
            <div style="border:1.5px solid #ccc; padding:12px; border-radius:4px; background:#fff;">
                <div style="color:#27ae60; font-size:12px; font-weight:bold;">配筋: ${data.lR}@${data.lP}</div>
                <div style="font-size:13px; margin:4px 0;">端部(y1) = ${data.My1.toFixed(2)} / 中央(y2) = ${data.My2.toFixed(2)} <small>kN･m</small></div>
                <div style="font-size:13px;">Ma = ${MaY.toFixed(2)} kN･m</div>
                <div style="margin-top:5px; text-align:right;">検定比 = <strong style="color:${data.ratioY<=1?'#27ae60':'#c0392b'}; font-size:18px;">${data.ratioY.toFixed(2)}</strong></div>
            </div>
          </div>
        `;
    }

    const overlay = document.createElement('div');
    overlay.id = 'slab-editor-modal';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:10000; display:flex; justify-content:center; align-items:center;';
    const content = document.createElement('div');
    content.style.cssText = 'background:#eee; width:1000px; max-width:98vw; height:700px; border-radius:8px; box-shadow:0 20px 40px rgba(0,0,0,0.6); display:flex; flex-direction:column; overflow:hidden; color:#000;';
    
    // 支持条件の正規化を呼ぶ（プルダウンの初期選択がズレないように保護）
    const normalizedCond = (typeof window.normalizeSupportCondition === 'function') ? window.normalizeSupportCondition(sl.supportCondition || '自動判定') : (sl.supportCondition || '自動判定');

    content.innerHTML = `
      <div style="background:#34495e; color:#fff; padding:15px 25px; display:flex; justify-content:space-between; align-items:center;">
        <h2 style="margin:0; font-size:20px;">基礎スラブ 断面検定エディタ [${sl.id || 'S'}]</h2>
        <button onclick="window.closeSlabEditor();" style="background:#c0392b; color:#fff; border:none; padding:10px 20px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:16px;">✕ 閉じる</button>
      </div>
      <div style="display:flex; flex:1; overflow:hidden;">
        <div style="flex:0 0 380px; border-right:2px solid #ccc; padding:15px; overflow-y:auto; background:#fff; color:#000; font-size:13px;">
          <div style="margin-bottom:12px; padding:10px; background:#f9ebea; border:1px solid #e6b0aa; border-radius:4px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" ${sl.showReport !== false ? 'checked' : ''} onchange="window.handlePropChange('slab', ${index}, 'showReport', this.checked)" style="transform:scale(1.2);">
              <strong style="color:#c0392b;">計算書に出力する</strong>
            </label>
          </div>
          <div style="margin-bottom:12px;"><span style="display:inline-block; width:90px; font-weight:bold;">符号 (ID)</span>
            <input value="${escapeHtml(sl.id)}" onchange="window.handlePropChange('slab', ${index}, 'id', this.value)" style="width:230px; padding:6px; border:1px solid #333; color:#000;"></div>
          <div style="margin-bottom:12px;"><span style="display:inline-block; width:90px; font-weight:bold;">支持条件</span>
            <select onchange="window.handlePropChange('slab', ${index}, 'supportCondition', this.value)" style="width:230px; padding:6px; border:1px solid #333; color:#000;">${generateOptions(['自動判定', '4辺固定', '3辺固定1辺ピン（長辺ピン）', '3辺固定1辺ピン（短辺ピン）', '2辺隣辺固定2辺ピン', '2辺長辺固定2辺ピン', '2辺短辺固定2辺ピン', '1辺固定3辺ピン（長辺固定）', '4辺ピン', '片持ち（跳出し）'], normalizedCond)}</select></div>
          
          <div style="border:1.5px solid #2980b9; padding:10px; background:#f0f7ff; border-radius:6px; margin-bottom:15px;">
            <div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid #2980b9; color:#2980b9;">断面寸法</div>
            <div style="margin-bottom:8px;"><span style="display:inline-block; width:100px;">厚さ D</span><select onchange="window.handlePropChange('slab', ${index}, 'D', this.value)" style="width:90px; padding:4px; border:1px solid #333;">${generateOptions(thicknesses, data.t || 150)}</select> mm</div>
            <div><span style="display:inline-block; width:100px;">有効高 dt</span><input type="number" value="${data.dt}" onchange="window.handlePropChange('slab', ${index}, 'dt', this.value)" style="width:90px; padding:4px; border:1px solid #333; text-align:right;"> mm</div>
          </div>

          <div style="border:1.5px solid #8e44ad; padding:10px; background:#f9f0ff; border-radius:6px; margin-bottom:15px;">
            <div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid #8e44ad; color:#8e44ad;">配筋設定：短辺方向</div>
            <div style="display:flex; gap:10px; margin-bottom:8px;">
               <div style="flex:1;">
                 <div style="font-size:11px; color:#666;">径</div>
                 <select onchange="window.handlePropChange('slab', ${index}, 'shortRebar', this.value)" style="width:100%; padding:3px; border:1px solid #333; margin-bottom:4px;">${generateOptions(rebars, data.sR)}</select>
               </div>
               <div style="flex:1;">
                 <div style="font-size:11px; color:#666;">ピッチ</div>
                 <select onchange="window.handlePropChange('slab', ${index}, 'shortPitch', this.value)" style="width:100%; padding:3px; border:1px solid #333;">${generateOptions(pitches, data.sP)}</select>
               </div>
            </div>
          </div>

          <div style="border:1.5px solid #27ae60; padding:10px; background:#f4fdf7; border-radius:6px;">
            <div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid #27ae60; color:#27ae60;">配筋設定：長辺方向</div>
            <div style="display:flex; gap:10px;">
               <div style="flex:1;">
                 <div style="font-size:11px; color:#666;">径</div>
                 <select onchange="window.handlePropChange('slab', ${index}, 'longRebar', this.value)" style="width:100%; padding:3px; border:1px solid #333; margin-bottom:4px;">${generateOptions(rebars, data.lR)}</select>
               </div>
               <div style="flex:1;">
                 <div style="font-size:11px; color:#666;">ピッチ</div>
                 <select onchange="window.handlePropChange('slab', ${index}, 'longPitch', this.value)" style="width:100%; padding:3px; border:1px solid #333;">${generateOptions(pitches, data.lP)}</select>
               </div>
            </div>
          </div>

        </div>
        <div style="flex:1; padding:20px; overflow-y:auto; background:#ddd;">${calcHtml}</div>
      </div>
    `;
    overlay.appendChild(content);
    document.body.appendChild(overlay);
};

export const closeSlabDetailModal = () => {
    const modal = document.getElementById('slab-modal-overlay');
    if (modal && modal.parentNode) {
        modal.remove();
        window.highlightedSlabIndex = null;
        if (typeof window.callRender === 'function') window.callRender();
    }
};

export const closeSlabEditor = () => {
    const modal = document.getElementById('slab-editor-modal');
    if (modal && modal.parentNode) modal.remove();
    document.querySelectorAll('.property-panel, #property-panel, .ui-dialog').forEach(el => {
        el.style.visibility = 'visible';
        el.style.pointerEvents = 'auto';
    });
    if (typeof window.deselectElement === 'function') window.deselectElement();
};

export const copySlabCalcToClipboard = () => {
    const calcArea = document.querySelector('#slab-modal-overlay [style*="overflow-y:auto"]');
    if (!calcArea) return;
    const text = calcArea.innerText;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('copy-btn');
        if (btn) {
            const originalText = btn.innerText;
            btn.innerText = '✅ コピー完了！';
            btn.style.background = '#27ae60';
            setTimeout(() => {
                btn.innerText = originalText;
                btn.style.background = '#34495e';
            }, 2000);
        }
    }).catch(err => {
        console.error('コピー失敗:', err);
        alert('コピーに失敗しました。');
    });
};

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeSlabDetailModal();
        closeSlabEditor();
    }
});

// --- グローバル登録 ---
window.openColumnDetailModal = openColumnDetailModal;
window.openWallDetailModal = openWallDetailModal;
window.openDiaphragmDetailModal = openDiaphragmDetailModal;
window.openSlabDetailModal = openSlabDetailModal;
window.openWallAxialModal = openWallAxialModal;
window.openSlabEditor = openSlabEditor;
window.closeSlabDetailModal = closeSlabDetailModal;
window.closeSlabEditor = closeSlabEditor;
window.copySlabCalcToClipboard = copySlabCalcToClipboard;
window.drawDiaphragmEquivalentImage = drawDiaphragmEquivalentImage;
window.showAxialStressTable = showAxialStressTable;
window.renderAxialElevation = renderAxialElevation;
window.drawAxialElevationOnCanvas = drawAxialElevationOnCanvas;
