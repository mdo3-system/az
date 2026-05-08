// ui/prop_panel_wall.js

/**
 * 壁・仮想壁用のパネル
 */
export const buildWallPanel = (el, fd) => {
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

window.buildWallPanel = buildWallPanel;
