/**
 * 選択要素がない場合のデフォルト表示（ツールごとの操作設定など）を生成する
 */
export function buildDefaultToolPanel(currentTool) {
  const dp = window.defaultProperties || {};
  let title = '操作ガイド';
  let content = '';

  switch (currentTool) {
    case 'wall':
      title = '🧱 耐力壁 設定';
      content = `
        <div class="prop-group" style="margin-bottom:12px;">
          <label style="display:block; font-size:11px; color:#888; margin-bottom:4px;">デフォルト倍率</label>
          <input type="number" step="0.1" value="${(dp.wall && dp.wall.multiplier !== undefined) ? dp.wall.multiplier : 1.0}" 
                 onchange="window.updateDefaultProperty('wall', 'multiplier', this.value)"
                 style="width:100%; background:var(--bg-input); border:1px solid var(--border); color:#fff; padding:5px; border-radius:4px;">
        </div>
        <div class="prop-group" style="margin-bottom:12px;">
          <label style="display:block; font-size:11px; color:#888; margin-bottom:4px;">通り名称 (構造計算用)</label>
          <input type="text" value="${(dp.wall && dp.wall.axisName) || ''}" 
                 onchange="window.updateDefaultProperty('wall', 'axisName', this.value)"
                 placeholder="例: X1"
                 style="width:100%; background:var(--bg-input); border:1px solid var(--border); color:#fff; padding:5px; border-radius:4px;">
        </div>
        <div class="prop-group" style="margin-top:15px; padding:10px; background:rgba(91,138,254,0.15); border-radius:6px; border:1px solid var(--accent);">
          <label style="font-size:12px; cursor:pointer; display:flex; align-items:center; gap:8px; color:var(--accent); font-weight:bold;">
            <input type="checkbox" style="width:16px; height:16px;" ${(dp.wall && dp.wall.isExterior) ? 'checked' : ''} 
                   onchange="window.updateDefaultProperty('wall', 'isExterior', this.checked)">
            新規作成時に「外壁」とする
          </label>
        </div>
        <p style="font-size:11px; color:#aaa; margin-top:10px;">クリックして壁（または通り芯）を配置します。</p>
      `;
      break;

    case 'column':
      title = '📍 柱 設定';
      content = `
        <div class="prop-group" style="margin-bottom:12px;">
          <label style="display:block; font-size:11px; color:#888; margin-bottom:4px;">長期軸力 Nw (kN)</label>
          <input type="number" value="${(dp.column && dp.column.nw) || 0}" 
                 onchange="window.updateDefaultProperty('column', 'nw', this.value)"
                 style="width:100%; background:var(--bg-input); border:1px solid var(--border); color:#fff; padding:5px; border-radius:4px;">
        </div>
        <p style="font-size:11px; color:#aaa; margin-top:10px;">グリッド交点などをクリックして柱を配置します。</p>
      `;
      break;

    case 'fbeam':
      title = '🏗️ 基礎梁 設定';
      content = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
          <div class="prop-group">
            <label style="font-size:10px; color:#888;">幅 B (mm)</label>
            <input type="number" value="${(dp.fbeam && dp.fbeam.width) || 150}" 
                   onchange="window.updateDefaultProperty('fbeam', 'width', this.value)"
                   style="width:100%; background:var(--bg-input); border:1px solid var(--border); color:#fff; padding:4px; border-radius:4px;">
          </div>
          <div class="prop-group">
            <label style="font-size:10px; color:#888;">成 D (mm)</label>
            <input type="number" value="${(dp.fbeam && dp.fbeam.depth) || 640}" 
                   onchange="window.updateDefaultProperty('fbeam', 'depth', this.value)"
                   style="width:100%; background:var(--bg-input); border:1px solid var(--border); color:#fff; padding:4px; border-radius:4px;">
          </div>
        </div>
        <div class="prop-group" style="margin-bottom:12px;">
          <label style="display:block; font-size:11px; color:#888; margin-bottom:4px;">主筋 (上端/下端)</label>
          <div style="display:flex; gap:4px;">
            <input type="text" value="${(dp.fbeam && dp.fbeam.topRebar) || '1-D13'}" 
                   onchange="window.updateDefaultProperty('fbeam', 'topRebar', this.value)"
                   style="flex:1; background:var(--bg-input); border:1px solid var(--border); color:#fff; padding:4px; border-radius:4px; font-size:11px;">
            <input type="text" value="${(dp.fbeam && dp.fbeam.bottomRebar) || '1-D13'}" 
                   onchange="window.updateDefaultProperty('fbeam', 'bottomRebar', this.value)"
                   style="flex:1; background:var(--bg-input); border:1px solid var(--border); color:#fff; padding:4px; border-radius:4px; font-size:11px;">
          </div>
        </div>
        <p style="font-size:11px; color:#aaa;">ノードを2点クリックして基礎梁を配置します。</p>
      `;
      break;

    case 'slab':
      title = '📐 スラブ 設定';
      content = `
        <div class="prop-group" style="margin-bottom:12px;">
          <label style="display:block; font-size:11px; color:#888; margin-bottom:4px;">許容地耐力 (kN/㎡)</label>
          <input type="number" value="${(dp.slab && dp.slab.groundPressure) || 30.0}" 
                 onchange="window.updateDefaultProperty('slab', 'groundPressure', this.value)"
                 style="width:100%; background:var(--bg-input); border:1px solid var(--border); color:#fff; padding:5px; border-radius:4px;">
        </div>
        <p style="font-size:11px; color:#aaa;">ノードを順にクリックしてスラブ領域を定義します。</p>
      `;
      break;
    
    case 'diaphragm':
      title = '💠 構面 設定';
      content = `
        <div class="prop-group" style="margin-bottom:12px;">
          <label style="display:block; font-size:11px; color:#888; margin-bottom:4px;">構面仕様 (デフォルト)</label>
          <select onchange="window.updateDefaultProperty('diaphragm', 'subType', this.value)"
                  style="width:100%; background:var(--bg-input); border:1px solid var(--border); color:#fff; padding:5px; border-radius:4px;">
            <option value="roof" ${(dp.diaphragm && dp.diaphragm.subType === 'roof') ? 'selected' : ''}>屋根</option>
            <option value="floor" ${(dp.diaphragm && dp.diaphragm.subType === 'floor') ? 'selected' : ''}>床</option>
          </select>
        </div>
        <p style="font-size:11px; color:#aaa;">ノードを順にクリックして構面領域を定義します。</p>
      `;
      break;

    case 'select':
      title = '🔍 選択・編集';
      content = '<p>要素をクリックして選択すると、個別の詳細プロパティが表示されます。</p>';
      break;

    default:
      title = '⚙️ ツール未選択';
      content = '<p>ツールバーから機能を選択して、操作を開始してください。</p>';
  }

  return `
    <div style="padding:15px; color:#eee; font-size:12px; line-height:1.6;">
      <div style="margin-bottom:15px; color:var(--accent); font-weight:bold; border-bottom:1px solid #444; padding-bottom:8px; font-size:14px; display:flex; align-items:center; gap:8px;">
        ${title}
      </div>
      <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
        ${content}
      </div>
      <div style="margin-top:20px; font-size:10px; color:#666; padding:10px; border-top:1px solid #333;">
        <i class="fas fa-mouse-pointer"></i> 右クリックで要素を削除できます。
      </div>
    </div>
  `;
}

window.buildDefaultToolPanel = buildDefaultToolPanel;
