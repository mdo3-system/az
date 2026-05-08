import { handleMultiPropChange } from '../state_manager.js';

/**
 * 複数選択時のパネル
 */
export const buildMultiSelectPanel = (elements) => {
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

window.buildMultiSelectPanel = buildMultiSelectPanel;
