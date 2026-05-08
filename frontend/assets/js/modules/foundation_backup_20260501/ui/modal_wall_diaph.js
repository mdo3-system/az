// ui/modal_wall_diaph.js
import { floorData, currentFloor, getFloorBelow } from '../foundation_cad.js';
import { calcSkewedDiaphragmModel } from '../core/diaphragm_skew_calc.js';
import { renderSkewedModelViz } from '../rendering/exterior_wall_viz.js';
import { makeDraggable } from '../ui_utils.js';

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
  modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:10000; display:flex; justify-content:center; align-items:center;';
  modal.addEventListener('click', (e) => {
      if (e.target === modal && modal.parentNode) modal.remove();
  });

  const headerTitle = isVirtual ? '仮想壁 (通り定義線)' : '耐力壁';
  const headerColor = isVirtual ? '#9b59b6' : '#e67e22';

  const pAngle = w.angle || 0;
  const pMultX = (w.multiplier_x || 0).toFixed(3);
  const pMultY = (w.multiplier_y || 0).toFixed(3);

  const content = document.createElement('div');
  content.className = 'modal-content';
  content.style.cssText = 'width:90%; max-width:500px; background:#1e1e1e; color:#fff; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5); display:flex; flex-direction:column; overflow:hidden; border: 1px solid #444; position:fixed;';
  
  content.innerHTML = `
      <div id="wall-modal-header" style="background:${headerColor}; padding:15px; border-bottom:1px solid #444; display:flex; justify-content:space-between; align-items:center; cursor:grab;">
        <h3 style="margin:0; font-size:16px; color:#fff; pointer-events:none;">${headerTitle} - プロパティ詳細</h3>
        <button onclick="{ const el = document.getElementById('wall-modal-overlay'); if (el) el.remove(); }" style="background:none; border:none; color:#fff; font-size:24px; cursor:pointer;">&times;</button>
      </div>
      <div style="padding:20px; max-height:80vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="flex:1;">
            <label style="color:#aaa; font-size:12px;">符号:</label><br>
            <input value="${w.id || ''}" onchange="window.handlePropChange('wall', ${index}, 'id', this.value); { const el = document.getElementById('wall-modal-overlay'); if (el) el.remove(); }; window.openWallDetailModal(${index});" style="width:100%; padding:8px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
          </div>
        </div>

        <div style="margin-bottom:15px; padding:12px; background:rgba(91,138,254,0.15); border:1px solid var(--accent); border-radius:8px;">
          <label style="font-size:13px; cursor:pointer; display:flex; align-items:center; gap:10px; color:var(--accent); font-weight:bold;">
            <input type="checkbox" style="width:20px; height:20px; cursor:pointer;" ${w.isExterior ? 'checked' : ''} onchange="window.handlePropChange('wall', ${index}, 'isExterior', this.checked); { const el = document.getElementById('wall-modal-overlay'); if (el) el.remove(); }; window.openWallDetailModal(${index});">
            外壁 (外周部) として扱う
          </label>
        </div>

        <div style="display:flex; gap:10px; margin-bottom:12px;">
          <div style="flex:1;">
            <label style="color:#aaa; font-size:12px;">通り名 (axisName):</label><br>
            <input value="${w.axisName || ''}" onchange="window.handlePropChange('wall', ${index}, 'axisName', this.value); { const el = document.getElementById('wall-modal-overlay'); if (el) el.remove(); }; window.openWallDetailModal(${index});" placeholder="例: X1" style="width:100%; padding:8px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
          </div>
          <div style="flex:1;">
            <label style="color:#aaa; font-size:12px;">階高 H (mm):</label><br>
            <input type="number" step="1" value="${w.heightOverride || ''}" placeholder="${fd.floorHeight || 2730}" onchange="window.handlePropChange('wall', ${index}, 'heightOverride', this.value); { const el = document.getElementById('wall-modal-overlay'); if (el) el.remove(); }; window.openWallDetailModal(${index});" style="width:100%; padding:8px; background:#333; color:var(--accent); font-weight:bold; border:1px solid var(--accent); border-radius:4px;">
          </div>
        </div>
        <div style="display:flex; gap:10px; margin-bottom:12px;">
          <div style="flex:1;">
            <label style="color:#aaa; font-size:12px;">壁倍率:</label><br>
            <input type="number" step="0.1" min="0" max="7" value="${w.multiplier !== undefined ? w.multiplier : 1.0}" onchange="window.handlePropChange('wall', ${index}, 'multiplier', this.value); { const el = document.getElementById('wall-modal-overlay'); if (el) el.remove(); }; window.openWallDetailModal(${index});" style="width:100%; padding:8px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
          </div>
          <div style="flex:1;">
            <label style="color:#aaa; font-size:12px;">設計長 L (mm) ※空欄で実長:</label><br>
            <input type="number" step="1" placeholder="実長: ${autoL}" value="${w.lengthOverride || ''}" onchange="window.handlePropChange('wall', ${index}, 'lengthOverride', this.value); { const el = document.getElementById('wall-modal-overlay'); if (el) el.remove(); }; window.openWallDetailModal(${index});" style="width:100%; padding:8px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
          </div>
        </div>

        ${!isVirtual ? `
        <div style="margin-top:20px; padding:15px; background:rgba(230,126,34,0.1); border:1px solid rgba(230,126,34,0.3); border-radius:8px;">
          <h4 style="margin:0 0 10px 0; font-size:13px; color:#e67e22; border-bottom:1px solid rgba(230,126,34,0.2); padding-bottom:5px;">📐 斜め耐力壁の有効倍率換算</h4>
          <table style="width:100%; font-size:12px; color:#eee;">
            <tr><td style="color:#aaa;">配置角度 θ</td><td style="text-align:right;">${pAngle.toFixed(1)} °</td></tr>
            <tr><td style="color:#3498db; font-weight:bold;">X'方向有効(P・sin²θ)</td><td style="text-align:right; font-size:14px; color:#3498db;">${pMultX}</td></tr>
            <tr><td style="color:#2ecc71; font-weight:bold;">Y'方向有効(P・cos²θ)</td><td style="text-align:right; font-size:14px; color:#2ecc71;">${pMultY}</td></tr>
          </table>
        </div>` : ''}
      </div>
  `;
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  // ドラッグ機能を有効化
  makeDraggable(content, content.querySelector('#wall-modal-header'));
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
  const skewAxes = window.dxfSkewedAxes || [];
  const skewOptions = skewAxes.map((ax, i) =>
    `<option value="${i}" ${dia.skewAxisIndex === i ? 'selected' : ''}>${ax.label || `斜め軸${i+1}`}</option>`
  ).join('');

  const modal = document.createElement('div');
  modal.id = 'diaph-modal-overlay';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);display:flex;justify-content:center;align-items:center;z-index:10000;';
  modal.addEventListener('click', (e) => { if (e.target === modal && modal.parentNode) modal.remove(); });

  const content = document.createElement('div');
  content.className = 'modal-content';
  content.style.cssText = 'background:#1e1e1e;color:#fff;border-radius:12px;max-width:800px;width:96%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;padding:0;box-shadow:0 20px 60px rgba(0,0,0,0.5);border:1px solid #444;position:fixed;';

  content.innerHTML = `
      <div id="diaph-modal-header" style="padding:14px 18px;border-bottom:1px solid #444;display:flex;justify-content:space-between;align-items:center;cursor:grab;background:#2c3e50;">
        <h3 style="margin:0;font-size:15px;pointer-events:none;">🏠 水平構面 ${dia.id || `D-${index+1}`} 詳細</h3>
        <button onclick="{ const el=document.getElementById('diaph-modal-overlay'); if(el) el.remove(); }" style="background:none;border:none;color:#aaa;font-size:22px;cursor:pointer;">&times;</button>
      </div>

      <div style="padding:14px 18px 0; overflow-y:auto; flex:1;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div style="font-size:12px;color:#aaa;">符号: <strong>${dia.id || ''}</strong> &nbsp; 実面積 S: <span style="color:#0f0;font-weight:bold;">${S.toFixed(3)} m²</span></div>
          <div>
            <select onchange="window.handlePropChange('diaphragm', ${index}, 'subType', this.value); { const el=document.getElementById('diaph-modal-overlay'); if(el) el.remove(); }; window.openDiaphragmDetailModal(${index});"
              style="padding:4px 8px; background:#2c3e50; color:#fff; border:1px solid #555; border-radius:4px; font-size:12px;">
              <option value="roof" ${dia.subType === 'roof' ? 'selected' : ''}>屋根</option>
              <option value="floor" ${dia.subType === 'floor' ? 'selected' : ''}>床</option>
            </select>
          </div>
        </div>

        <div style="display:flex;gap:6px;margin-bottom:0;">
          <button id="tab-equiv" onclick="window._diaphTabSwitch('equiv',${index})" style="padding:7px 16px;border-radius:6px 6px 0 0;border:1px solid #555;border-bottom:none;cursor:pointer;font-size:12px;background:#e67e22;color:#fff;">等価置き換えモデル</button>
          <button id="tab-skew" onclick="window._diaphTabSwitch('skew',${index})" style="padding:7px 16px;border-radius:6px 6px 0 0;border:1px solid #555;border-bottom:none;cursor:pointer;font-size:12px;background:#2c3e50;color:#aaa;">斜め軸回転モデル (グレー本準拠)</button>
        </div>
      </div>

      <div id="diaph-tab-equiv" style="padding:16px 18px;border-top:2px solid #e67e22;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
          <div style="background:rgba(255,255,255,0.03);padding:11px;border-radius:7px;border:1px solid #333;">
            <h4 style="margin:0 0 8px;font-size:12px;color:#3498db;">X方向検討</h4>
            <div style="font-size:11px;">等価奥行 Lx_eq = ${(dia.Lx_eq||0).toFixed(3)} m</div>
            <div style="font-size:14px;font-weight:bold;color:#3498db;">W_eq_x = ${(dia.W_design_x||0).toFixed(3)} m</div>
          </div>
          <div style="background:rgba(255,255,255,0.03);padding:11px;border-radius:7px;border:1px solid #333;">
            <h4 style="margin:0 0 8px;font-size:12px;color:#2ecc71;">Y方向検討</h4>
            <div style="font-size:11px;">等価奥行 Ly_eq = ${(dia.Ly_eq||0).toFixed(3)} m</div>
            <div style="font-size:14px;font-weight:bold;color:#2ecc71;">W_eq_y = ${(dia.W_design_y||0).toFixed(3)} m</div>
          </div>
        </div>
      </div>

      <div id="diaph-tab-skew" style="display:none;padding:16px 18px;border-top:2px solid #9b59b6;">
        ${skewAxes.length === 0 ? `<div style="color:#e74c3c;font-size:12px;">⚠ 斜め軸を登録してください。</div>` : `
        <div style="display:flex; gap:10px; margin-bottom:12px; align-items:flex-end;">
          <div style="flex:1;">
            <label style="font-size:11px;color:#aaa;">回転基準軸</label>
            <select onchange="window.handlePropChange('diaphragm',${index},'skewAxisIndex',parseInt(this.value)); window._diaphTabSwitch('skew',${index});"
              style="width:100%;padding:7px;background:#2c3e50;color:#fff;border:1px solid #555;border-radius:4px;font-size:12px;">
              <option value="">-- 選択してください --</option>
              ${skewOptions}
            </select>
          </div>
          <div style="flex:1;">
            <label style="font-size:11px;color:#aaa;display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" ${dia.hasIntermediateWall ? 'checked' : ''} onchange="window.handlePropChange('diaphragm',${index},'hasIntermediateWall',this.checked); window._diaphTabSwitch('skew',${index});">
              中間に上階耐力壁線あり (α=1.6)
            </label>
          </div>
        </div>
        <div id="diaph-skew-result-${index}" style="font-size:12px;"></div>
        `}
      </div>
  `;
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  // ドラッグ機能を有効化
  makeDraggable(content, content.querySelector('#diaph-modal-header'));

  if (skewAxes.length > 0 && dia.skewAxisIndex !== undefined) _renderSkewResult(index);
};

window._diaphTabSwitch = function(tab, index) {
  document.getElementById('diaph-tab-equiv').style.display = tab === 'equiv' ? 'block' : 'none';
  document.getElementById('diaph-tab-skew').style.display = tab === 'skew' ? 'block' : 'none';
  document.getElementById('tab-equiv').style.background = tab === 'equiv' ? '#e67e22' : '#2c3e50';
  document.getElementById('tab-skew').style.background = tab === 'skew' ? '#9b59b6' : '#2c3e50';
  if (tab === 'skew') _renderSkewResult(index);
};

function _renderSkewResult(index) {
  const el = document.getElementById(`diaph-skew-result-${index}`);
  if (!el) return;
  const fd = floorData[currentFloor];
  const dia = fd?.diaphragms?.[index];
  const skewAxes = window.dxfSkewedAxes || [];
  const axIdx = dia?.skewAxisIndex;
  if (axIdx === undefined || axIdx === null || !skewAxes[axIdx]) return;

  const fd1 = floorData['1'];
  const floorSpecs = (fd1 && fd1.globalDiaphragmSpecs) ? fd1.globalDiaphragmSpecs[currentFloor] : null;

  // 💡 支持点となる耐力壁は常に「直下の階」のものを参照する
  const belowKey = getFloorBelow(currentFloor);
  const wallFd = (belowKey && floorData[belowKey]) ? floorData[belowKey] : null;

  if (!wallFd || !wallFd.walls || wallFd.walls.length === 0) {
    el.innerHTML = `<div style="color:#e67e22;padding:10px;">⚠ 直下の階に耐力壁が存在しないため、支持点（耐力壁線）を算出できません。</div>`;
    return;
  }

  const result = calcSkewedDiaphragmModel({
    diaphragm: dia, allDiaphragms: fd.diaphragms, nodes: fd.nodes,
    walls: wallFd.walls, wallNodes: wallFd.nodes, // 💡 追加
    skewedAxis: skewAxes[axIdx], hasIntermediateWall: dia.hasIntermediateWall || false, floorSpecs: floorSpecs,
    floorKey: currentFloor
  });
  if (!result) return;

  const dirHtml = (dirKey, title, color) => {
    const d = result[dirKey];
    if (!d || !d.spans) return '';
    
    // 💡 テーブル1: ΔQaの算定
    let rows1 = d.spans.flatMap(span => (span.elements || []).map((el, i) => `
      <tr style="border-bottom:1px solid #444;">
        ${i===0 ? `<td rowspan="${span.elements.length}" style="padding:4px;border-right:1px solid #444;">${span.lineALabel}～${span.lineBLabel}</td>` : ''}
        <td style="padding:4px;text-align:center;">${el.id || '構面'}</td>
        <td style="padding:4px;text-align:right;">${el.deltaQa.toFixed(2)}</td>
        <td style="padding:4px;text-align:right;">${el.depth_m.toFixed(3)}</td>
        <td style="padding:4px;text-align:right;">${el.pa.toFixed(2)}</td>
        ${i===0 ? `
          <td rowspan="${span.elements.length}" style="padding:4px;text-align:right;border-left:1px solid #444;">${span.capacity.toFixed(2)}</td>
          <td rowspan="${span.elements.length}" style="padding:4px;text-align:right;">${span.depth_h_m.toFixed(3)}</td>
          <td rowspan="${span.elements.length}" style="padding:4px;text-align:right;font-weight:bold;color:var(--accent);">${span.avgDeltaQa.toFixed(2)}</td>
        ` : ''}
      </tr>
    `)).join('');

    // 💡 テーブル2: 検定表
    let rows2 = d.spans.map(iv => {
      const qeOK = iv.capacity >= iv.QE;
      const qwOK = iv.capacity >= iv.QW;
      return `
        <tr style="border-bottom:1px solid #444; background:${iv.isOK ? 'transparent' : 'rgba(231,76,60,0.15)'}">
          <td style="padding:4px;">${iv.lineALabel}～${iv.lineBLabel}</td>
          <td style="padding:4px;text-align:right;">${iv.span_l_m.toFixed(3)}</td>
          <td style="padding:4px;text-align:right;">${iv.depth_h_m.toFixed(3)}</td>
          <td style="padding:4px;text-align:right;">${iv.avgDeltaQa.toFixed(3)}</td>
          <td style="padding:4px;text-align:right;font-weight:bold;">${iv.capacity.toFixed(3)}</td>
          <td style="padding:4px;text-align:center;">${iv.alpha.toFixed(1)}</td>
          <td style="padding:4px;text-align:right;font-weight:bold;">${iv.QE.toFixed(3)}</td>
          <td style="padding:4px;text-align:center;font-weight:bold;color:${qeOK ? '#2ecc71' : '#e74c3c'}">${qeOK ? 'OK' : 'NG'}</td>
          <td style="padding:4px;text-align:right;font-weight:bold;">${iv.QW.toFixed(3)}</td>
          <td style="padding:4px;text-align:center;font-weight:bold;color:${qwOK ? '#2ecc71' : '#e74c3c'}">${qwOK ? 'OK' : 'NG'}</td>
        </tr>
      `;
    }).join('');

    const rowsX = (d.wallLines || []).map(grp => {
      return `
        <tr style="border-bottom:1px solid #444; color:${grp.isEffective ? '#fff' : '#888'}">
          <td style="padding:4px;">${grp.axisName}</td>
          <td style="padding:4px;text-align:right;">${grp.pos.toFixed(0)}</td>
          <td style="padding:4px;text-align:center;">${grp.walls.length}</td>
          <td style="padding:4px;text-align:right;">${(grp.pa || 0).toFixed(2)}</td>
          <td style="padding:4px;text-align:center;">${grp.judge1 ? 'OK' : 'NG'}</td>
          <td style="padding:4px;text-align:center;">${grp.judge2 ? 'OK' : 'NG'}</td>
          <td style="padding:4px;text-align:center;font-weight:bold;color:${grp.isEffective ? '#2ecc71' : '#e74c3c'}">${grp.isEffective ? '◎' : (grp.isExterior ? '〇' : '×')}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <div style="margin-top:10px; padding-right:5px;">
        <div style="color:${color}; font-weight:bold; font-size:13px; border-left:4px solid ${color}; padding-left:8px; margin-bottom:10px;">
          ${title}判定: <span style="color:${d.isOK ? '#2ecc71' : '#e74c3c'}">${d.isOK ? 'OK' : 'NG'}</span>
        </div>
        
        <div style="font-size:10px; color:#aaa; margin-bottom:4px;">① 支持点（耐力壁線）の抽出・有効判定 (Pa基準)</div>
        <table style="width:100%; border-collapse:collapse; border:1px solid #444; margin-bottom:15px; font-size:10px;">
          <tr style="background:#333;"><th>軸名</th><th>位置</th><th>壁数</th><th>Pa(kN)</th><th>判1</th><th>判2</th><th>有効</th></tr>
          ${rowsX || '<tr><td colspan="7">データなし</td></tr>'}
        </table>

        <div style="font-size:10px; color:#aaa; margin-bottom:4px;">② 区間 ΔQa の算定</div>
        <table style="width:100%; border-collapse:collapse; border:1px solid #444; margin-bottom:15px; font-size:10px;">
          <tr style="background:#333;"><th>区間</th><th>構面</th><th>ΔQa</th><th>奥行</th><th>Pa</th><th>ΣPa</th><th>h</th><th>平均ΔQa</th></tr>
          ${rows1 || '<tr><td colspan="8">データなし</td></tr>'}
        </table>
        
        <div style="font-size:10px; color:#aaa; margin-bottom:4px;">③ 地震力・風圧力に対する検定表 (ΔQa×h ≥ QE, QW)</div>
        <table style="width:100%; border-collapse:collapse; border:1px solid #444; font-size:10px;">
          <tr style="background:#333;">
            <th>区間</th>
            <th>スパンl</th>
            <th>奥行h</th>
            <th>ΔQa</th>
            <th>ΔQa×h</th>
            <th>α</th>
            <th>QE</th>
            <th>判定</th>
            <th>QW</th>
            <th>判定</th>
          </tr>
          ${rows2 || '<tr><td colspan="10">データなし</td></tr>'}
        </table>
      </div>
    `;

    return html;
  };

  el.innerHTML = `
    <div style="max-height:80vh; overflow-y:auto; padding-right:10px; scrollbar-width:thin;">
      <div style="margin-bottom:8px;font-size:11px;color:#aaa;">基準軸: ${result.axisLabel} (θ=${result.thetaDeg.toFixed(1)}°) ΔQa=${result.deltaQa.toFixed(3)} kN/m</div>
      
      ${dirHtml('xDir', "X'方向", '#3498db')}
      ${dirHtml('yDir', "Y'方向", '#2ecc71')}
      
      <div style="margin-top:15px; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; font-size:10px; color:#888;">
        📖 グレー本 3-7節 準拠: QE = 0.24αhL / QW = 1.7αL<br>
        ※ 外壁線が非有効な場合はスパン L を2倍として計算しています。
      </div>
    </div>
  `;
}

window.openWallDetailModal = openWallDetailModal;
window.openDiaphragmDetailModal = openDiaphragmDetailModal;

/**
 * 等価置き換えモデルのプレビュー描画 (キャンバス)
 */
export const drawDiaphragmEquivalentImage = function(canvas, diaph, direction) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const padding = 60;

  const fd = floorData[currentFloor];
  const pts = (diaph.nodeIds || []).map(nid => {
    const n = fd.nodes[nid];
    if (n) return n;
    return (fd.nodes || []).find(node => node && (node.id == nid || node.index == nid));
  }).filter(Boolean);
  
  if (pts.length < 3) return;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  pts.forEach(p => {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  });

  const bW = maxX - minX;
  const bH = maxY - minY;
  const scale = Math.min((w - padding * 2) / (bW || 1), (h - padding * 2) / (bH || 1));

  const worldToScreen = (x, y) => ({
    x: w / 2 + (x - (minX + maxX) / 2) * scale,
    y: h / 2 - (y - (minY + maxY) / 2) * scale
  });

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // 外形描画
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
  ctx.stroke();
  ctx.setLineDash([]);

  // 等価矩形の描画
  const Lex = diaph.Lex || (bW / 1000);
  const Ley = diaph.Ley || (bH / 1000);
  
  let rectX1 = minX, rectY1 = minY;
  let rectX2 = direction === 'X' ? minX + (Lex * 1000) : maxX;
  let rectY2 = direction === 'Y' ? minY + (Ley * 1000) : maxY;

  const rP1 = worldToScreen(rectX1, rectY1);
  const rP2 = worldToScreen(rectX2, rectY2);
  const rx = Math.min(rP1.x, rP2.x);
  const ry = Math.min(rP1.y, rP2.y);
  const rw = Math.abs(rP2.x - rP1.x);
  const rh = Math.abs(rP2.y - rP1.y);

  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  const isX = direction === 'X';
  ctx.strokeStyle = isX ? '#3498db' : '#2ecc71';
  ctx.fillStyle = isX ? 'rgba(52,152,219,0.3)' : 'rgba(46,204,113,0.3)';
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#000';
  ctx.textAlign = 'left';
  ctx.fillText(isX ? '【X方向 等価面積】' : '【Y方向 等価面積】', 10, 25);
};

window.drawDiaphragmEquivalentImage = drawDiaphragmEquivalentImage;
