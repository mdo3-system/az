import { floorData, currentFloor } from '../foundation_cad.js';

/**
 * 第1章：斜め壁換算壁倍率の算定 HTML を生成する
 */
export const generateDiagonalWallSummaryHtml = window.generateDiagonalWallSummaryHtml = function(allFloorData) {
  let totalMx = 0;
  let totalMy = 0;
  const diagSummary = {}; // axisName + multiplier で集約
  const axisAngles = {}; // 通り芯ごとの代表角度を保持
  
  Object.values(allFloorData || {}).forEach(fd => {
    (fd.walls || []).forEach(w => {
      const m = w.multiplier || 0;
      if (m > 0 && w.multiplier_x !== undefined && w.axisName) {
        const normalizedAngle = ((w.angle % 180) + 180) % 180;
        
        // 💡 修正: 垂直・水平（0°, 90°, 180°...）の通常の壁は非表示にする
        const isOrthogonal = Math.abs(normalizedAngle % 90) < 0.01;
        if (isOrthogonal) return;

        // 通り芯ごとの角度を統一
        if (axisAngles[w.axisName] === undefined) {
           axisAngles[w.axisName] = normalizedAngle;
        }

        const key = `${w.axisName}_${m.toFixed(3)}`;
        if (!diagSummary[key]) {
          diagSummary[key] = { 
            axisName: w.axisName, 
            multiplier: m, 
            count: 0 
          };
        }
        diagSummary[key].count++;
      }
    });
  });

  let chap1Rows = "";
  Object.values(diagSummary)
    .sort((a,b) => a.axisName.localeCompare(b.axisName) || a.multiplier - b.multiplier)
    .forEach(g => {
      const angle = axisAngles[g.axisName];
      const rad = (angle * Math.PI) / 180;
      
      // 💡 修正：換算壁倍率は「小数点第4位切り捨て」で算出する
      const unitMx = Math.floor(g.multiplier * Math.pow(Math.sin(rad), 2) * 1000) / 1000;
      const unitMy = Math.floor(g.multiplier * Math.pow(Math.cos(rad), 2) * 1000) / 1000;
      
      // 集計値としては箇所数を考慮する
      totalMx += unitMx * g.count;
      totalMy += unitMy * g.count;
      
      const commonStyle = "padding: 12px; border: 1px solid #333; font-size: 14px; line-height: 1.6; color: #000;";
      chap1Rows += `
      <tr style="border-bottom: 1px solid #333; background: #fff;">
        <td style="${commonStyle} text-align: center; font-weight: bold;">${g.axisName}</td>
        <td style="${commonStyle} text-align: center;">${g.multiplier.toFixed(3)} (${g.count}箇所)</td>
        <td style="${commonStyle} text-align: center;">${angle.toFixed(1)}°</td>
        <td style="${commonStyle} text-align: center; font-weight: bold;">${unitMx.toFixed(3)}</td>
        <td style="${commonStyle} text-align: center; font-size: 12px; color: #1a1a1a;">${g.multiplier.toFixed(3)} × sin²(${angle.toFixed(1)}°)</td>
        <td style="${commonStyle} text-align: center; font-weight: bold;">${unitMy.toFixed(3)}</td>
        <td style="${commonStyle} text-align: center; font-size: 12px; color: #1a1a1a;">${g.multiplier.toFixed(3)} × cos²(${angle.toFixed(1)}°)</td>
      </tr>`;
    });

  return `
    <div id="chapter1" class="chapter-section active">
      <h2 style="font-size: 18px; border-left: 8px solid #9b59b6; padding-left: 15px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 20px; color: #000;">
        1. 斜め壁換算壁倍率の算定
      </h2>
      <p style="font-size: 13px; color: #000; margin-bottom: 15px; background: #f8f9fa; padding: 12px; border-left: 4px solid #9b59b6; line-height: 1.6;">
        (注) 各通り芯における配置角度に基づき、有効な壁倍率を X方向・Y方向に換算して集計します。<br>
        換算式：Px = P・sin²θ / Py = P・cos²θ （θは垂直軸からの角度）
      </p>
      
      <table style="width: 100%; border-collapse: collapse; border: 2px solid #333; font-size: 14px; margin-bottom: 30px; line-height: 1.6; color: #000;">
        <thead>
          <tr style="background: #f1f3f5; font-weight: bold;">
            <th style="border: 1px solid #333; padding: 12px;">通り芯</th>
            <th style="border: 1px solid #333; padding: 12px;">設定倍率 (箇所数)</th>
            <th style="border: 1px solid #333; padding: 12px;">取付角度</th>
            <th style="border: 1px solid #333; padding: 12px;">X換算倍率</th>
            <th style="border: 1px solid #333; padding: 12px;">X算出根拠</th>
            <th style="border: 1px solid #333; padding: 12px;">Y換算倍率</th>
            <th style="border: 1px solid #333; padding: 12px;">Y算出根拠</th>
          </tr>
        </thead>
        <tbody>
          ${chap1Rows || '<tr><td colspan="7" style="text-align:center; padding:30px;">対象データなし（倍率0は除外）</td></tr>'}
        </tbody>
      </table>
      
      <h3 style="font-size: 15px; margin: 30px 0 10px 0; border-left: 4px solid #2c3e50; padding-left: 10px; color: #2c3e50;">【 柱頭柱脚・横架材金物 凡例 】</h3>
      <table style="width: 100%; max-width: 650px; border-collapse: collapse; border: 2px solid #000; font-size: 12px; margin-bottom: 20px; text-align: center; color: #000;">
        <thead>
          <tr style="background: #eee;">
            <th style="border: 1px solid #000; padding: 6px;">仕様</th>
            <th style="border: 1px solid #000; padding: 6px;">記号</th>
            <th style="border: 1px solid #000; padding: 6px;">金物</th>
            <th style="border: 1px solid #000; padding: 6px;">Ta (kN)</th>
            <th style="border: 1px solid #000; padding: 6px;">検定用 Ta (kN)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="border: 1px solid #000; padding: 4px;">L字型金物</td><td style="border: 1px solid #000;">L</td><td style="border: 1px solid #000;">CP・L</td><td style="border: 1px solid #000;">3.38</td><td style="border: 1px solid #000;">2.88</td></tr>
          <tr><td style="border: 1px solid #000; padding: 4px;">T字型金物</td><td style="border: 1px solid #000;">T</td><td style="border: 1px solid #000;">CP・T</td><td style="border: 1px solid #000;">5.07</td><td style="border: 1px solid #000;">4.57</td></tr>
          <tr><td style="border: 1px solid #000; padding: 4px;">V字型金物</td><td style="border: 1px solid #000;">V</td><td style="border: 1px solid #000;">VP</td><td style="border: 1px solid #000;">5.88</td><td style="border: 1px solid #000;">5.38</td></tr>
          <tr><td style="border: 1px solid #000; padding: 4px;">羽子板ボルト</td><td style="border: 1px solid #000;">Is</td><td style="border: 1px solid #000;">SB・F2</td><td style="border: 1px solid #000;">7.50</td><td style="border: 1px solid #000;">7.00</td></tr>
          <tr><td style="border: 1px solid #000; padding: 4px;">羽子板ボルト+スクリュー釘50</td><td style="border: 1px solid #000;">Ps</td><td style="border: 1px solid #000;">SB・F</td><td style="border: 1px solid #000;">8.50</td><td style="border: 1px solid #000;">8.00</td></tr>
          <tr><td style="border: 1px solid #000; padding: 4px;">10kNホールダウン金物</td><td style="border: 1px solid #000;">2</td><td style="border: 1px solid #000;">HD-B10</td><td style="border: 1px solid #000;">10.0</td><td style="border: 1px solid #000;">9.5</td></tr>
          <tr><td style="border: 1px solid #000; padding: 4px;">15kNホールダウン金物</td><td style="border: 1px solid #000;">3</td><td style="border: 1px solid #000;">HD-B15</td><td style="border: 1px solid #000;">15.0</td><td style="border: 1px solid #000;">14.5</td></tr>
          <tr><td style="border: 1px solid #000; padding: 4px;">20kNホールダウン金物</td><td style="border: 1px solid #000;">4</td><td style="border: 1px solid #000;">HD-B20</td><td style="border: 1px solid #000;">20.0</td><td style="border: 1px solid #000;">19.5</td></tr>
          <tr><td style="border: 1px solid #000; padding: 4px;">25kNホールダウン金物</td><td style="border: 1px solid #000;">5</td><td style="border: 1px solid #000;">HD-B25</td><td style="border: 1px solid #000;">25.0</td><td style="border: 1px solid #000;">24.5</td></tr>
          <tr><td style="border: 1px solid #000; padding: 4px;">ビスどめホールダウン金物U25</td><td style="border: 1px solid #000; font-weight: bold;">U2</td><td style="border: 1px solid #000;">U25</td><td style="border: 1px solid #000;">28.7</td><td style="border: 1px solid #000;">28.2</td></tr>
          <tr><td style="border: 1px solid #000; padding: 4px;">15kNホールダウン金物×2</td><td style="border: 1px solid #000; font-weight: bold;">32</td><td style="border: 1px solid #000;">HD-B15×2</td><td style="border: 1px solid #000;">30.0</td><td style="border: 1px solid #000;">29.5</td></tr>
          <tr><td style="border: 1px solid #000; padding: 4px;">ビスどめホールダウン金物U35</td><td style="border: 1px solid #000; font-weight: bold;">U3</td><td style="border: 1px solid #000;">U35</td><td style="border: 1px solid #000;">35.4</td><td style="border: 1px solid #000;">34.9</td></tr>
          <tr><td style="border: 1px solid #000; padding: 4px;">ビスどめホールダウン金物Hi43</td><td style="border: 1px solid #000;">H4</td><td style="border: 1px solid #000;">Hi43</td><td style="border: 1px solid #000;">43.7</td><td style="border: 1px solid #000;">43.2</td></tr>
          <tr><td style="border: 1px solid #000; padding: 4px;">高耐力ホールダウン金物Hi68</td><td style="border: 1px solid #000;">68</td><td style="border: 1px solid #000;">Hi68</td><td style="border: 1px solid #000;">68.1</td><td style="border: 1px solid #000;">67.6</td></tr>
        </tbody>
      </table>
    </div>`;
};

/**
 * 第2章：水平構面等価面積 (形状低減係数ηの算定) HTML を生成する
 */
export const generateDiaphragmSummaryHtml = window.generateDiaphragmSummaryHtml = function(allFloorData) {
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

/**
 * 5-7 柱頭柱脚の引張耐力の検定（特定の通り芯）HTML を生成する
 */
export const generateColumnTensionReportHtml = window.generateColumnTensionReportHtml = function(axisName, allFloorData, dxfVAxes, dxfHAxes) {
  const floorsList = ['PH', 'R', '3', '2', '1'];

  // 💡 通り名からグリッド座標（xまたはy）を特定する
  const vAxis = (dxfVAxes || []).find(a => a.label === axisName);
  const hAxis = (dxfHAxes || []).find(a => a.label === axisName);
  const isVerticalGrid = !!vAxis;
  const gridCoord = vAxis ? vAxis.x : (hAxis ? hAxis.y : null);

  let axisHtml = `
    <div style="margin-bottom: 40px; font-family: 'MS Gothic', 'Courier New', monospace; color: #000; page-break-inside: avoid;">
      <h2 style="font-size: 16px; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px;">
        5-7 柱頭柱脚の引張耐力の検定（${axisName}通り）
      </h2>
      
      <div style="display: flex; flex-direction: row; justify-content: space-between; width: 100%; page-break-inside: avoid; margin-top: 10px; margin-bottom: 20px;">
        <div style="width: 48%; text-align: center; border: 1px solid #eee; padding: 10px; background: #fafafa;">
          <h4 style="margin-bottom: 8px; font-size: 11px; color: #2c3e50; border-bottom: 1px solid #ddd; padding-bottom: 4px;">【 ${axisName}：左加力 (→) 】</h4>
          ${(window.generateEnlargedAxialDiagramSvg ? window.generateEnlargedAxialDiagramSvg(axisName, 'left') : '')}
        </div>
        <div style="width: 48%; text-align: center; border: 1px solid #eee; padding: 10px; background: #fafafa;">
          <h4 style="margin-bottom: 8px; font-size: 11px; color: #2c3e50; border-bottom: 1px solid #ddd; padding-bottom: 4px;">【 ${axisName}：右加力 (←) 】</h4>
          ${(window.generateEnlargedAxialDiagramSvg ? window.generateEnlargedAxialDiagramSvg(axisName, 'right') : '')}
        </div>
      </div>
  `;

  let hasData = false;

  floorsList.forEach(floorKey => {
    const floorDataObj = allFloorData[floorKey];
    if (!floorDataObj || !floorDataObj.columns) return;

    const colsOnAxis = [];
    floorDataObj.columns.forEach((col, idx) => {
      const n = floorDataObj.nodes[col.nodeIndex];
      if (!n) return;

      // 1. 壁に直接紐付いているノード
      const walls = (floorDataObj.walls || []).filter(w => (w.n1 === col.nodeIndex || w.n2 === col.nodeIndex) && w.axisName === axisName);
      if (walls.length > 0) {
        colsOnAxis.push({ col, idx });
        return;
      }

      // 2. グリッド座標に一致するノード (許容誤差 15mm)
      if (gridCoord !== null) {
        const d = isVerticalGrid ? n.x : n.y;
        if (Math.abs(d - gridCoord) < 15) {
          colsOnAxis.push({ col, idx });
        }
      }
    });

    if (colsOnAxis.length === 0) return;
    hasData = true;

    colsOnAxis.sort((a, b) => {
      const nA = floorDataObj.nodes[a.col.nodeIndex];
      const nB = floorDataObj.nodes[b.col.nodeIndex];
      if (!nA || !nB) return 0;
      return Math.abs(nA.x - nB.x) > 1.0 ? nA.x - nB.x : nA.y - nB.y;
    });

    axisHtml += `
      <h3 style="font-size: 14px; margin-top: 20px; margin-bottom: 8px; border-left: 4px solid #3498db; padding-left: 8px;">【${floorKey}階】</h3>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 10px; line-height: 1.3; margin-bottom: 20px;">
        <thead>
          <tr style="background: #eee;">
            <th rowspan="2" style="border: 1px solid #000; padding: 4px; width: 30px;">通り</th>
            <th rowspan="2" style="border: 1px solid #000; padding: 4px; width: 45px;">柱座標</th>
            <th rowspan="2" style="border: 1px solid #000; padding: 4px; width: 40px;">加力<br>方向</th>
            <th rowspan="2" style="border: 1px solid #000; padding: 4px; width: 60px;">ΣΔQaiL<br>×Hi</th>
            <th rowspan="2" style="border: 1px solid #000; padding: 4px; width: 60px;">ΣΔQaiR<br>×Hi</th>
            <th colspan="2" style="border: 1px solid #000; padding: 4px;">Bi<br>(曲げ戻し)</th>
            <th colspan="2" style="border: 1px solid #000; padding: 4px;">本階 Ni<br>(kN)</th>
            <th rowspan="2" style="border: 1px solid #000; padding: 4px; width: 45px;">上階<br>ΣNi</th>
            <th rowspan="2" style="border: 1px solid #000; padding: 4px; width: 40px;">軸力<br>Nw</th>
            <th colspan="2" style="border: 1px solid #000; padding: 4px; background:#e8f4f8;">柱頭 (kN)</th>
            <th colspan="2" style="border: 1px solid #000; padding: 4px; background:#fef5e7;">柱脚 (kN)</th>
          </tr>
          <tr style="background: #eee;">
            <th style="border: 1px solid #000; padding: 2px; width: 30px;">柱頭</th><th style="border: 1px solid #000; padding: 2px; width: 30px;">柱脚</th>
            <th style="border: 1px solid #000; padding: 2px; width: 35px;">柱頭</th><th style="border: 1px solid #000; padding: 2px; width: 35px;">柱脚</th>
            <th style="border: 1px solid #000; padding: 2px; width: 35px;">T値</th><th style="border: 1px solid #000; padding: 2px; width: 40px;">金物</th>
            <th style="border: 1px solid #000; padding: 2px; width: 35px;">T値</th><th style="border: 1px solid #000; padding: 2px; width: 40px;">金物</th>
          </tr>
        </thead>
        <tbody>
    `;

    colsOnAxis.forEach(item => {
      const res = (window.calculateColumnT ? window.calculateColumnT(item.idx, floorDataObj, floorKey) : {});
      if (!res || !res.cases) return;
      
      const colNode = floorDataObj.nodes[item.col.nodeIndex];
      const va = (dxfVAxes || []).find(ax => Math.abs(ax.x - colNode.x) < 15);
      const ha = (dxfHAxes || []).find(ax => Math.abs(ax.y - colNode.y) < 15);
      const xLabel = va ? va.label : (item.col.id ? item.col.id.substring(0, item.col.id.indexOf('Y')) : '-');
      const yLabel = ha ? ha.label : (item.col.id ? item.col.id.substring(item.col.id.indexOf('Y')) : '-');
      const coordLabel = `${xLabel}<br>${yLabel}`;

      const axisCases = res.cases.filter(c => c.name.includes(axisName));
      
      axisCases.forEach((c, cIdx) => {
        const isFirst = cIdx === 0;
        const topT = c.T_top || 0;
        const botT = c.T_bot || 0;
        
        axisHtml += `
          <tr>
            ${isFirst ? `<td rowspan="${axisCases.length}" style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold; background: #fafafa;">${axisName}</td>` : ''}
            ${isFirst ? `<td rowspan="${axisCases.length}" style="border: 1px solid #000; padding: 4px; text-align: center; font-size: 10px; line-height: 1.2;">${coordLabel}</td>` : ''}
            <td style="border: 1px solid #000; padding: 4px; text-align: center;">${c.name?.replace(axisName,"").trim() || '-'}</td>
            <td style="border: 1px solid #000; padding: 4px; text-align: right;">${(c.q1_Hi || 0).toFixed(3)}</td>
            <td style="border: 1px solid #000; padding: 4px; text-align: right;">${(c.q2_Hi || 0).toFixed(3)}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: center;">${(c.Bi_top || 0.5).toFixed(1)}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: center; font-weight:bold;">${(c.Bi_bot || 0.5).toFixed(1)}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: right; color: #7f8c8d;">${(c.Ni_top || 0).toFixed(3)}</td>
            <td style="border: 1px solid #000; padding: 2px; text-align: right; color: #3498db; font-weight:bold;">${(c.Ni_bot || 0).toFixed(3)}</td>
            <td style="border: 1px solid #000; padding: 4px; text-align: right;">${(c.Ni_upper || 0).toFixed(3)}</td>
            <td style="border: 1px solid #000; padding: 4px; text-align: right;">${(c.Nw || res.Nw || 0).toFixed(3)}</td>
            
            <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold; background:#f0f8ff;">${topT.toFixed(3)}</td>
            <td style="border: 1px solid #000; padding: 4px; text-align: center; color: ${c.isTopOk ? '#000' : '#e74c3c'}; font-size: 9px; background:#f0f8ff;">
              ${(window.makeShortName ? window.makeShortName(c.topMetal?.name) : '') || '-'}<br>(${c.isTopOk ? 'OK' : 'NG'})
            </td>
            
            <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold; background:#fffcf0;">${botT.toFixed(3)}</td>
            <td style="border: 1px solid #000; padding: 4px; text-align: center; color: ${c.isBaseOk ? '#000' : '#e74c3c'}; font-size: 9px; background:#fffcf0;">
              ${(window.makeShortName ? window.makeShortName(c.baseMetal?.name) : '') || '-'}<br>(${c.isBaseOk ? 'OK' : 'NG'})
            </td>
          </tr>
        `;
      });
    });

    axisHtml += `</tbody></table>`;
  });

  return hasData ? axisHtml + `</div>` : "";
};

/**
 * 5-9 アンカーボルトと土台の検定 HTML を生成する
 */
export const generateAnchorBoltReportHtml = window.generateAnchorBoltReportHtml = function(fd, anchorBoltMaster) {
  if (!fd) return "";

  const anchorAxes = Array.from(window.getAxesToReport ? window.getAxesToReport() : (typeof getAxesToReport === 'function' ? getAxesToReport() : []));
  let anchorRowsX = "", anchorRowsY = "";
  
  anchorAxes.forEach(axis => {
    const jType = fd.anchorJType || 'J1';
    const am = (anchorBoltMaster || {})[jType] || (anchorBoltMaster || {})['J1'];
    if (!am) return;

    let totalM12 = 0, totalM16 = 0;
    [...(fd.beams||[]), ...(fd.perimeterBeams||[])].forEach(b => {
      if ((b.axisName || b.axis) === axis) {
        totalM12 += (b.anchorM12 || 0);
        totalM16 += (b.anchorM16 || 0);
      }
    });

    const qaa = (totalM12 * am.m12) + (totalM16 * am.m16);
    
    let sumQaX = 0, sumQaY = 0;
    (fd.walls || []).forEach(w => {
      if (w.axisName === axis) {
        const len = w.lengthOverride ? parseFloat(w.lengthOverride) : (w.length_m ? w.length_m * 1000 : 0);
        sumQaX += (w.multiplier_x || 0) * 1.96 * (len / 1000);
        sumQaY += (w.multiplier_y || 0) * 1.96 * (len / 1000);
      }
    });

    const isX = sumQaX >= sumQaY;
    const targetQa = isX ? sumQaX : sumQaY;
    const ratio = qaa > 0 ? (targetQa / qaa) : (targetQa > 0 ? 9.999 : 0);
    const isOk = ratio <= 1.0;
    
    const row = `
      <tr>
        <td style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold; background: #fafafa;">${axis}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: center;">${jType}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: center;">${totalM12}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: center;">${totalM16}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right; background: #f0fdf4; font-weight: bold;">${qaa.toFixed(3)}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right; background: #fef2f2;">${targetQa.toFixed(3)}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold; color: ${isOk?'#000':'#e74c3c'};">${ratio.toFixed(3)}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold; color: ${isOk?'#27ae60':'#e74c3c'};">${isOk?'OK':'NG'}</td>
      </tr>
    `;
    if (isX) anchorRowsX += row;
    else anchorRowsY += row;
  });

  return `
    <div id="section5-9" style="margin-top: 40px; font-family: 'MS Gothic', 'Courier New', monospace; color: #000; page-break-inside: avoid;">
      <h2 style="font-size: 16px; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px;">
        5-9 アンカーボルトと土台の検定（1階）
      </h2>
      
      <p style="font-size: 11px; font-weight: bold; margin-bottom: 5px; color: #3498db;">■ X方向 (sin系有効耐力集計)</p>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 11px; margin-bottom: 25px;">
        <thead>
          <tr style="background: #eee;">
            <th style="border: 1px solid #000; padding: 6px;">通り名</th>
            <th style="border: 1px solid #000; padding: 6px;">土台樹種</th>
            <th style="border: 1px solid #000; padding: 6px;">M12</th>
            <th style="border: 1px solid #000; padding: 6px;">M16</th>
            <th style="border: 1px solid #000; padding: 6px;">ΣQaa (kN)</th>
            <th style="border: 1px solid #000; padding: 6px;">ΣQa (kN)</th>
            <th style="border: 1px solid #000; padding: 6px;">検定比</th>
            <th style="border: 1px solid #000; padding: 6px;">判定</th>
          </tr>
        </thead>
        <tbody>
          ${anchorRowsX || '<tr><td colspan="8" style="border: 1px solid #000; padding: 15px; text-align: center; color: #999;">対象なし（X方向の耐力壁未配置）</td></tr>'}
        </tbody>
      </table>

      <p style="font-size: 11px; font-weight: bold; margin-bottom: 5px; color: #2ecc71;">■ Y方向 (cos系有効耐力集計)</p>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 11px; margin-bottom: 30px;">
        <thead>
          <tr style="background: #eee;">
            <th style="border: 1px solid #000; padding: 6px;">通り名</th>
            <th style="border: 1px solid #000; padding: 6px;">土台樹種</th>
            <th style="border: 1px solid #000; padding: 6px;">M12</th>
            <th style="border: 1px solid #000; padding: 6px;">M16</th>
            <th style="border: 1px solid #000; padding: 6px;">ΣQaa (kN)</th>
            <th style="border: 1px solid #000; padding: 6px;">ΣQa (kN)</th>
            <th style="border: 1px solid #000; padding: 6px;">検定比</th>
            <th style="border: 1px solid #000; padding: 6px;">判定</th>
          </tr>
        </thead>
        <tbody>
          ${anchorRowsY || '<tr><td colspan="8" style="border: 1px solid #000; padding: 15px; text-align: center; color: #999;">対象なし（Y方向の耐力壁未配置）</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
};

/**
 * 4. 金物配置伏図 (5-8) HTML を生成する
 */
export const generateHardwarePlanHtml = window.generateHardwarePlanHtml = function(allFloorData, globalBbox) {
  let section58Html = `
    <div id="chapter4" style="margin-top: 60px; padding:20px; border:1px solid #333; background:#fff; color:#000; page-break-inside: auto;">
      <h2 style="font-size: 18px; border-left: 8px solid #9b59b6; padding-left: 15px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 20px; color:#000;">
        4. 金物配置伏図 (5-8)
      </h2>
      <div style="background:#fff; border:1px solid #000; padding:10px; font-size:11px; margin-bottom:15px; color: #000;">
        ※記号の上段は柱頭金物、下段は柱脚金物を示します。金物の仕様および許容耐力については、第1章の【 柱頭柱脚・横架材金物 凡例 】を参照してください。
      </div>
  `;
  
  let has58Data = false;
  ['PH', 'R', '3', '2', '1'].forEach(floorKey => {
      const floorDataObj = allFloorData[floorKey];
      if (!floorDataObj || !floorDataObj.columns || floorDataObj.columns.length === 0) return;
      
      has58Data = true;
      const hwData = window.generateHardwarePlanSvg ? window.generateHardwarePlanSvg(floorKey, floorDataObj, globalBbox) : {svg:'', legendHtml:''};
      
      section58Html += `
          <h3 style="font-size: 14px; margin-top: 30px; margin-bottom: 15px; border-left: 4px solid #9b59b6; padding-left: 8px; color:#000; background:#fff;">【 ${floorKey}階 金物配置図 】</h3>
          <div style="text-align: center; margin-bottom: 30px; page-break-inside: avoid; color:#000;">
              <div style="width: 100%; max-width: 1600px; margin: 0 auto; border: 1px solid #eee; padding: 10px; background: #fff;">${hwData.svg}</div>
          </div>
      `;
  });
  
  if (!has58Data) {
      section58Html += `<p style="color:#666; font-size:12px;">※柱データがありません。</p>`;
  }
  section58Html += `</div>`;
  return section58Html;
};

/**
 * 7-1 べた基礎の検定 HTML を生成する
 */
export const generateFoundationCheckHtml = window.generateFoundationCheckHtml = function(fd1, globalBbox) {
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

/**
 * 7-2 基礎梁負担面積・負担幅図 HTML を生成する
 */
export const generateTributaryAreaHtml = window.generateTributaryAreaHtml = function(fd1, globalBbox) {
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
