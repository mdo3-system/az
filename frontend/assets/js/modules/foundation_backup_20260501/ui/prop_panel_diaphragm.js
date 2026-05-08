// ui/prop_panel_diaphragm.js

/**
 * 水平構面用のパネル
 */
export const buildDiaphragmPanel = (el, fd) => {
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
    <div class="prop-row">
      <span class="prop-label">構面仕様</span>
      <select class="prop-value" onchange="window.handlePropChange('diaphragm', ${index}, 'subType', this.value)">
        <option value="roof" ${diaph.subType === 'roof' ? 'selected' : ''}>屋根</option>
        <option value="floor" ${diaph.subType === 'floor' ? 'selected' : ''}>床</option>
      </select>
    </div>
    <div class="prop-row">
      <span class="prop-label">ΔQa</span>
      <span class="prop-value" style="border:none; background:none; font-weight:bold; color:#f39c12;">
        ${(() => {
          const fd1 = window.floorData ? window.floorData['1'] : null;
          const specs = fd1 ? fd1.globalDiaphragmSpecs : null;
          const fKey = Object.keys(window.floorData || {}).find(k => window.floorData[k] === fd) || '1';
          const val = (specs && specs[fKey]) ? specs[fKey][diaph.subType || 'roof'] : 1.96;
          return val.toFixed(2);
        })()} kN/m
      </span>
    </div>
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

window.buildDiaphragmPanel = buildDiaphragmPanel;
