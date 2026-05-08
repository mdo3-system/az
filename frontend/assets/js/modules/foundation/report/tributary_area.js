/**
 * report/tributary_area.js
 * 7-2 基礎梁負担面積・負担幅図 HTML生成モジュール
 */

export const generateTributaryAreaHtml = function(fd1, globalBbox) {
  if (!fd1) return "";
  const tributarySvg = window.generateFoundationTributarySvg ? window.generateFoundationTributarySvg(fd1, globalBbox) : '';
  return `
    <div id="section7-2" style="margin-top: 40px; padding:20px; border:1px solid #eee; background:#fff; color:#000; page-break-inside: avoid;">
      <h2 style="font-size: 18px; border-left: 8px solid #3498db; padding-left: 15px; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 20px; color:#000;">
        7-2 基礎梁負担面積・負担幅図
      </h2>
      <div class="diagram-container" style="text-align: center; margin-bottom: 10px;">
          ${tributarySvg || '<p style="color:#999; font-size:12px;">※スラブデータがありません。</p>'}
      </div>
      <p style="color:#666; font-size:11px; text-align:center;">※破線：亀甲分割（45度分配）による負担境界線</p>
    </div>
  `;
};

// Global for legacy support
window.generateTributaryAreaHtml = generateTributaryAreaHtml;
