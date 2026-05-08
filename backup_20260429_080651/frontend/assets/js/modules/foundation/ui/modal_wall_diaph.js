// ui/modal_wall_diaph.js
import { floorData, currentFloor } from '../foundation_cad.js';

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

window.openWallDetailModal = openWallDetailModal;
window.openDiaphragmDetailModal = openDiaphragmDetailModal;
window.drawDiaphragmEquivalentImage = drawDiaphragmEquivalentImage;
