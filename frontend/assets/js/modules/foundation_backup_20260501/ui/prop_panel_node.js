// ui/prop_panel_node.js

/**
 * ノード（交点）用のパネル
 */
export const buildNodePanel = (el, fd) => {
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

window.buildNodePanel = buildNodePanel;
