/**
 * report/foundation_check.js
 * 7-1 べた基礎の検定 HTML生成モジュール
 */

export const generateFoundationCheckHtml = function(fd1, globalBbox) {
  if (!fd1) return "";
  const reactionSvgContent = window.generateFoundationReactionSvg ? window.generateFoundationReactionSvg(fd1, globalBbox) : '';

  let section71Html = `
    <div id="section7-1" style="margin-top: 60px; padding:20px; border:1px solid #333; background:#fff; color:#000; page-break-inside: auto;">
      <h2 style="font-size: 18px; border-left: 8px solid #2ecc71; padding-left: 15px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 20px; color:#000;">
        7-1 べた基礎の検定
      </h2>
      
      <div id="foundation-reaction" style="text-align: center; margin-bottom: 10px; page-break-inside: avoid;">
          <h3 style="font-size: 14px; margin-bottom: 10px; color: #2c3e50;">【基礎反力図 および 接地圧 σe 分布図】</h3>
          ${reactionSvgContent || '<p style="color:#999; font-size:12px;">※1階（基礎）のデータがありません。</p>'}
          <p style="color:#666; font-size:11px; margin-top: 10px;">※緑色破線領域：スラブ（接地圧 σe）、実線：基礎梁（線荷重 w = σe × B）</p>
      </div>

      <div style="margin-top: 30px;">
  `;

  if (fd1.slabs) {
      const targetSlabs = fd1.slabs.filter(sl => sl.showReport !== false);
      targetSlabs.forEach((sl, idx) => {
          section71Html += `
            <div class="slab-set" style="margin-bottom: 40px; page-break-inside: avoid;">
              <h3 style="font-size: 15px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 15px; color:#000; background:#f8f9fa; padding:10px; font-weight: bold;">
                📄 スラブ断面検定表: ${sl.id || `SL-${idx+1}`}
              </h3>
              ${window.generateSingleSlabCalcHtml ? window.generateSingleSlabCalcHtml(sl, fd1) : ''}
            </div>
          `;
      });
      if (targetSlabs.length === 0) {
          section71Html += `<p style="color:#666; font-size:12px;">※断面検定対象のスラブがありません。</p>`;
      }
  }
  section71Html += `</div></div>`;
  return section71Html;
};

// Global for legacy support
window.generateFoundationCheckHtml = generateFoundationCheckHtml;
