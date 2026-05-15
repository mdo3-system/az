/**
 * report/anchor_bolt.js
 * 5-9 アンカーボルトと土台の検定 HTML生成モジュール
 */

export const generateAnchorBoltReportHtml = function(fd, anchorBoltMaster) {
  if (!fd) return "";

  const anchorAxes = Array.from(window.getAxesToReport ? window.getAxesToReport() : (typeof getAxesToReport === 'function' ? getAxesToReport() : []));
  let anchorRowsX = "", anchorRowsY = "";
  
  anchorAxes.forEach(axis => {
    const jType = fd.anchorJType || 'J1';
    const am = (anchorBoltMaster || {})[jType] || (anchorBoltMaster || {})['J1'];
    if (!am) return;
    
    // 斜め軸かどうかの判定
    const sList = window.dxfSkewedAxes || [];
    const isSkewed = sList.some(ax => ax.label === axis);

    let totalM12 = 0, totalM16 = 0;
    [...(fd.beams||[]), ...(fd.perimeterBeams||[])].forEach(b => {
      if ((b.axisName || b.axis) === axis) {
        totalM12 += (b.anchorM12 || 0);
        totalM16 += (b.anchorM16 || 0);
      }
    });

    const qaa = (totalM12 * am.m12) + (totalM16 * am.m16);
    
    let sumQaX = 0, sumQaY = 0, sumQaSkew = 0;
    (fd.walls || []).forEach(w => {
      if (w.axisName === axis) {
        const len = w.lengthOverride ? parseFloat(w.lengthOverride) : (w.length_m ? w.length_m * 1000 : 0);
        const qaTotal = (w.multiplier || 0) * 1.96 * (len / 1000);
        if (isSkewed) {
          sumQaSkew += qaTotal;
        } else {
          sumQaX += (w.multiplier_x || 0) * 1.96 * (len / 1000);
          sumQaY += (w.multiplier_y || 0) * 1.96 * (len / 1000);
        }
      }
    });

    // 💡 ΣT (引張力合計) の算出
    let sumT = 0;
    (fd.columns || []).forEach((col, cIdx) => {
      const res = (window.calculateColumnT ? window.calculateColumnT(cIdx, fd, '1') : null);
      if (res && res.cases) {
        const axisCases = res.cases.filter(cs => cs.name.includes(axis));
        // 各方向のうち最大のT値を合算
        if (axisCases.length > 0) {
          const maxT = Math.max(...axisCases.map(cs => cs.T_bot || 0));
          sumT += maxT;
        }
      }
    });

    const isX = isSkewed ? (sumQaSkew > 0) : (sumQaX >= sumQaY);
    const targetQa = isSkewed ? sumQaSkew : (isX ? sumQaX : sumQaY);
    const ratio = qaa > 0 ? (targetQa / qaa) : (targetQa > 0 ? 9.999 : 0);
    const isOk = ratio <= 1.0;
    
    const row = `
      <tr>
        <td style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold; background: #fafafa;">${axis}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: center;">${jType}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: center;">${totalM12}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: center;">${totalM16}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right; background: #e8f4f8; font-weight: bold;">${sumT.toFixed(3)}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right; background: #f0fdf4; font-weight: bold;">${qaa.toFixed(3)}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right; background: #fef2f2;">${targetQa.toFixed(3)}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold; color: ${isOk?'#000':'#e74c3c'};">${ratio.toFixed(3)}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold; color: ${isOk?'#27ae60':'#e74c3c'};">${isOk?'OK':'NG'}</td>
      </tr>
    `;
    // 斜め軸の場合は、より耐力が大きい方、またはデフォルトでX方向に分類
    if (isX || isSkewed) anchorRowsX += row;
    else anchorRowsY += row;
  });

  return `
    <div id="section5-9" style="margin-top: 40px; font-family: 'MS Gothic', 'Courier New', monospace; color: #000; page-break-inside: avoid;">
      <h2 style="font-size: 16px; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px;">
        5-9 アンカーボルトと土台の検定（1階）
      </h2>
      
      <p style="font-size: 11px; font-weight: bold; margin-bottom: 5px; color: #3498db;">■ X方向・斜め軸 (sin系有効耐力集計)</p>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 11px; margin-bottom: 25px;">
        <thead>
          <tr style="background: #eee;">
            <th style="border: 1px solid #000; padding: 6px;">通り名</th>
            <th style="border: 1px solid #000; padding: 6px;">樹種</th>
            <th style="border: 1px solid #000; padding: 6px;">M12</th>
            <th style="border: 1px solid #000; padding: 6px;">M16</th>
            <th style="border: 1px solid #000; padding: 6px; background: #e8f4f8;">ΣT (kN)</th>
            <th style="border: 1px solid #000; padding: 6px;">ΣQaa (kN)</th>
            <th style="border: 1px solid #000; padding: 6px;">ΣQa (kN)</th>
            <th style="border: 1px solid #000; padding: 6px;">検定比</th>
            <th style="border: 1px solid #000; padding: 6px;">判定</th>
          </tr>
        </thead>
        <tbody>
          ${anchorRowsX || '<tr><td colspan="9" style="border: 1px solid #000; padding: 15px; text-align: center; color: #999;">対象なし</td></tr>'}
        </tbody>
      </table>

      <p style="font-size: 11px; font-weight: bold; margin-bottom: 5px; color: #2ecc71;">■ Y方向 (cos系有効耐力集計)</p>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 11px; margin-bottom: 30px;">
        <thead>
          <tr style="background: #eee;">
            <th style="border: 1px solid #000; padding: 6px;">通り名</th>
            <th style="border: 1px solid #000; padding: 6px;">樹種</th>
            <th style="border: 1px solid #000; padding: 6px;">M12</th>
            <th style="border: 1px solid #000; padding: 6px;">M16</th>
            <th style="border: 1px solid #000; padding: 6px; background: #e8f4f8;">ΣT (kN)</th>
            <th style="border: 1px solid #000; padding: 6px;">ΣQaa (kN)</th>
            <th style="border: 1px solid #000; padding: 6px;">ΣQa (kN)</th>
            <th style="border: 1px solid #000; padding: 6px;">検定比</th>
            <th style="border: 1px solid #000; padding: 6px;">判定</th>
          </tr>
        </thead>
        <tbody>
          ${anchorRowsY || '<tr><td colspan="9" style="border: 1px solid #000; padding: 15px; text-align: center; color: #999;">対象なし</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
};

// Global for legacy support
window.generateAnchorBoltReportHtml = generateAnchorBoltReportHtml;
