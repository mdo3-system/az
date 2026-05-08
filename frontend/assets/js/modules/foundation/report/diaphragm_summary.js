/**
 * report/diaphragm_summary.js
 * 第2章：水平構面等価面積 (形状低減係数ηの算定) HTML生成モジュール
 */

export const generateDiaphragmSummaryHtml = function(allFloorData) {
  let chap2Html = `
    <div id="chapter2" class="chapter-section">
      <h2 style="font-size: 18px; border-left: 8px solid #e67e22; padding-left: 15px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 20px; color: #000;">
        2. 水平構面等価面積 (形状低減係数ηの算定)
      </h2>
      <div style="background: #fffcf9; border: 1px solid #d35400; padding: 15px; margin-bottom: 20px; font-size: 12px; line-height: 1.6; border-radius: 4px; color: #333;">
        <strong style="color: #a04000;">【物理定義に基づく等価算定の保証】</strong><br>
        本章では、不整形な水平構面を長方形に置き換えて評価します。実面積 $S$、最大幅 $B_{max}$ に対し、等価奥行 $L_{eq} = S / B_{max}$ と定義することで、描画される面積が実面積 $S$ と数学的に一致することを保証しています。
      </div>`;

  const revFloorKeys = Object.keys(allFloorData || {}).sort((a,b) => b.localeCompare(a));

  for (const fk of revFloorKeys) {
    const fd = allFloorData[fk];
    const diaphragms = fd.diaphragms || [];
    if (diaphragms.length === 0) continue;
    
    let floorChapterVisible = false;
    let floorRowsHtml = "";

    diaphragms.forEach((dia, idx) => {
      if (typeof window.calculateDiaphragmProps === 'function') {
        window.calculateDiaphragmProps(dia, fd.nodes);
      }
      
      const ex = dia.eta_x || 1.0;
      const ey = dia.eta_y || 1.0;
      // η=1.0（整形スラブ）は除外
      if (ex >= 0.999 && ey >= 0.999) return;
      
      floorChapterVisible = true;
      const S = dia.area || 0;
      const svgX = window.generateDiaphragmEquivalentSvg ? window.generateDiaphragmEquivalentSvg(dia, fd, 'X') : '';
      const svgY = window.generateDiaphragmEquivalentSvg ? window.generateDiaphragmEquivalentSvg(dia, fd, 'Y') : '';

      floorRowsHtml += `
        <div style="margin-bottom: 25px; border: 1px solid #eee; padding: 15px; background: #fafafa; page-break-inside: avoid;">
          <div style="font-weight: bold; margin-bottom: 15px; font-size:15px; color:#2c3e50;">符号: ${dia.id || `D-${idx+1}`} (実面積 S = ${S.toFixed(3)} m²)</div>
          
          <div style="display: flex; gap: 20px; justify-content: flex-start; align-items: flex-start; margin-bottom:15px; background:#fff; border:1px solid #ddd; padding:15px; border-radius:8px;">
            <div style="width: 28%; text-align:center;">
              <div style="font-size:11px; margin-bottom:5px; color:#3498db; font-weight:bold;">[ X方向検討 ]</div>
              ${svgX}
            </div>
            <div style="width: 28%; text-align:center;">
              <div style="font-size:11px; margin-bottom:5px; color:#2ecc71; font-weight:bold;">[ Y方向検討 ]</div>
              ${svgY}
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 14px; background: #fff; line-height: 1.6; border: 2px solid #333; color: #000;">
            <thead>
              <tr style="background: #eee;">
                <th style="border:1px solid #333; padding:10px 12px; width:120px; color: #000;">検討方向</th>
                <th style="border:1px solid #333; padding:10px 12px; color: #000;">支持幅 Bmax(m)</th>
                <th style="border:1px solid #333; padding:10px 12px; color: #000;">等価奥行 Leq(m)</th>
                <th style="border:1px solid #333; padding:10px 12px; color: #000;">最大奥行 Lmax(m)</th>
                <th style="border:1px solid #333; padding:10px 12px; color: #000;">形状低減 eta</th>
                <th style="border:1px solid #333; padding:10px 12px; color: #000;">有効奥行 Lred(m)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border:1px solid #333; padding:10px 12px; text-align:center; font-weight:bold; color:#2980b9;">X方向</td>
                <td style="border:1px solid #333; padding:10px 12px; text-align:right; color: #000;">${(dia.BBox_Y||0).toFixed(3)}</td>
                <td style="border:1px solid #333; padding:10px 12px; text-align:right; color: #000;">${(dia.Lx_eq||0).toFixed(3)}</td>
                <td style="border:1px solid #333; padding:10px 12px; text-align:right; color: #000;">${(dia.BBox_X||0).toFixed(3)}</td>
                <td style="border:1px solid #333; padding:10px 12px; text-align:center; color: #000;">
                  <div style="font-weight:bold;">${(dia.eta_x||0).toFixed(3)}</div>
                  <div style="font-size:10px; color:#333;">(${(dia.Lx_eq||0).toFixed(3)}/${(dia.BBox_X||0).toFixed(3)})</div>
                </td>
                <td style="border:1px solid #333; padding:10px 12px; text-align:right; font-weight:bold; color:#2980b9;">${(dia.W_design_x||0).toFixed(3)}</td>
              </tr>
              <tr>
                <td style="border:1px solid #333; padding:10px 12px; text-align:center; font-weight:bold; color:#27ae60;">Y方向</td>
                <td style="border:1px solid #333; padding:10px 12px; text-align:right; color: #000;">${(dia.BBox_X||0).toFixed(3)}</td>
                <td style="border:1px solid #333; padding:10px 12px; text-align:right; color: #000;">${(dia.Ly_eq||0).toFixed(3)}</td>
                <td style="border:1px solid #333; padding:10px 12px; text-align:right; color: #000;">${(dia.BBox_Y||0).toFixed(3)}</td>
                <td style="border:1px solid #333; padding:10px 12px; text-align:center; color: #000;">
                  <div style="font-weight:bold;">${(dia.eta_y||0).toFixed(3)}</div>
                  <div style="font-size:10px; color:#333;">(${(dia.Ly_eq||0).toFixed(3)}/${(dia.BBox_Y||0).toFixed(3)})</div>
                </td>
                <td style="border:1px solid #333; padding:10px 12px; text-align:right; font-weight:bold; color:#27ae60;">${(dia.W_design_y||0).toFixed(3)}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    });

    if (floorChapterVisible) {
      chap2Html += `<h3 style="font-size: 15px; border-bottom: 1px solid #ccc; padding-bottom: 4px; color: #d35400; margin-top:30px;">【 ${fk}階 】</h3>`;
      chap2Html += floorRowsHtml;
    }
  }
  chap2Html += "</div>";
  return chap2Html;
};

// Global for legacy support
window.generateDiaphragmSummaryHtml = generateDiaphragmSummaryHtml;
