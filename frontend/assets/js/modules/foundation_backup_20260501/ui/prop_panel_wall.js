// ui/prop_panel_wall.js - Ver 2.0 (No Report Mentions)

/**
 * 壁・仮想壁用のプロパティパネル
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
    <div style="padding:4px; border-radius:4px; border:1px solid rgba(255,255,255,0.05);">
      <div style="margin-bottom:12px; font-size:12px; display:flex; align-items:center; gap:8px;">
        ${wIsVirtual
          ? `<span style="background:rgba(180,100,255,0.2); color:#cc88ff; padding:2px 6px; border-radius:3px; font-weight:bold;">仮想壁 (通り線)</span>`
          : `<span style="background:rgba(255,0,255,0.15); color:#ff66ff; padding:2px 6px; border-radius:3px; font-weight:bold;">耐力壁</span>`}
        <span style="color:var(--text-muted); font-family:var(--mono);">L=${autoL}</span>
      </div>

      <div class="prop-group" style="margin-bottom:10px;">
        <label style="display:block; font-size:10px; color:#888; margin-bottom:3px;">符号</label>
        <input class="prop-value" style="width:100%; height:28px;" value="${w.id || ''}" onchange="window.handlePropChange('wall', ${index}, 'id', this.value)">
      </div>

      <div class="prop-group" style="margin-bottom:10px;">
        <label style="display:block; font-size:10px; color:#888; margin-bottom:3px;">通り名称 (構造計算用)</label>
        <input class="prop-value" style="width:100%; height:28px; border-color:var(--accent);" placeholder="例: X1" value="${w.axisName || ''}" onchange="window.handlePropChange('wall', ${index}, 'axisName', this.value)">
      </div>

      <div class="prop-group" style="margin-bottom:10px;">
        <label style="display:block; font-size:10px; color:#888; margin-bottom:3px;">壁倍率</label>
        <input class="prop-value" style="width:100%; height:28px;" type="number" step="0.1" value="${w.multiplier !== undefined ? w.multiplier : 1.0}" onchange="window.handlePropChange('wall', ${index}, 'multiplier', this.value)">
      </div>

      <!-- 🛡️ 外壁設定セクション (視覚的に目立たせる) -->
      <div style="margin:15px 0; padding:12px; background:rgba(91,138,254,0.15); border-radius:8px; border:2px solid var(--accent);">
        <label style="font-size:13px; cursor:pointer; display:flex; align-items:center; gap:10px; color:#fff; font-weight:bold;">
          <input type="checkbox" style="width:20px; height:20px; cursor:pointer; accent-color:var(--accent);" ${w.isExterior ? 'checked' : ''} onchange="window.handlePropChange('wall', ${index}, 'isExterior', this.checked)">
          外壁 (外周部) と指定
        </label>
        <div style="font-size:10px; color:var(--text-secondary); margin-top:8px; line-height:1.5;">
          ※このラインが耐力不足の場合、スパンを2倍にして構面検定を行います。
        </div>
      </div>

      <div class="prop-group" style="margin-bottom:10px;">
        <label style="display:block; font-size:10px; color:#888; margin-bottom:3px;">設計長 L (mm) ※空欄で実長</label>
        <input class="prop-value" style="width:100%; height:28px;" type="number" value="${w.lengthOverride || ''}" placeholder="${autoL}" onchange="window.handlePropChange('wall', ${index}, 'lengthOverride', this.value)">
      </div>

      <div class="prop-group" style="margin-bottom:10px;">
        <label style="display:block; font-size:10px; color:#888; margin-bottom:3px;">階高 H (mm) ※空欄で標準階高</label>
        <input class="prop-value" style="width:100%; height:28px;" type="number" value="${w.heightOverride || ''}" placeholder="標準設定を使用" onchange="window.handlePropChange('wall', ${index}, 'heightOverride', this.value)">
      </div>
    </div>
  `;
};

window.buildWallPanel = buildWallPanel;
