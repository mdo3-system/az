import { floorData, currentFloor, FLOORS, dxfVAxes, dxfHAxes } from './foundation_cad.js';
import { ANCHOR_BOLT_MASTER } from './foundation_calc.js';

/**
 * 構造計算書（HTMLレポート）の生成と表示
 */
export const showCalculationReport = function() {
  const reportContent = document.getElementById('reportContent');
  if (!reportContent) return;

  // 1. 斜め壁の換算倍率算定詳細 (第1章用集計)
  let totalMx = 0;
  let totalMy = 0;
  const diagSummary = {}; // axisName + multiplier + angle で集約
  
  Object.values(window.floorData || floorData || {}).forEach(fd => {
    (fd.walls || []).forEach(w => {
      // 🚨 デバッグログ：梁オブジェクトの構造とデータを可視化
      if (fd.beams && fd.beams.length > 0) {
        console.log("[Debug] Beam properties:", Object.keys(fd.beams[0]), fd.beams[0]);
      }
      const m = w.multiplier || 0;
      if (m > 0 && w.multiplier_x !== undefined && w.axisName) {
        const normalizedAngle = ((w.angle % 180) + 180) % 180;
        // 🚨 集計キーに角度を含めることで算出根拠との一致を保証
        const key = `${w.axisName}_${m.toFixed(2)}_${normalizedAngle.toFixed(1)}`;
        
        if (!diagSummary[key]) {
          diagSummary[key] = { 
            axisName: w.axisName, 
            normalizedAngle: normalizedAngle, 
            multiplier: m, 
            count: 0 
          };
        }
        diagSummary[key].count++;
      }
    });
  });

  // レポート用行の生成
  let chap1Rows = "";
  Object.values(diagSummary)
    .sort((a,b) => a.axisName.localeCompare(b.axisName) || a.multiplier - b.multiplier || a.normalizedAngle - b.normalizedAngle)
    .forEach(g => {
      // 🚨 純粋な換算倍率を再計算 (1.96等の係数を排除)
      const rad = (g.normalizedAngle * Math.PI) / 180;
      const groupMx = (g.multiplier * g.count) * Math.pow(Math.sin(rad), 2);
      const groupMy = (g.multiplier * g.count) * Math.pow(Math.cos(rad), 2);
      
      totalMx += groupMx;
      totalMy += groupMy;
      
      const commonStyle = "padding: 12px; border: 1px solid #333; font-size: 14px; line-height: 1.6; color: #000;";
      chap1Rows += `
      <tr style="border-bottom: 1px solid #333; background: #fff;">
        <td style="${commonStyle} text-align: center; font-weight: bold;">${g.axisName}</td>
        <td style="${commonStyle} text-align: center;">${g.multiplier.toFixed(2)} (${g.count}箇所)</td>
        <td style="${commonStyle} text-align: center;">${g.normalizedAngle.toFixed(1)}°</td>
        <td style="${commonStyle} text-align: center; font-weight: bold;">${groupMx.toFixed(3)}</td>
        <td style="${commonStyle} text-align: center; font-size: 12px; color: #1a1a1a;">(${(g.multiplier * g.count).toFixed(2)}) × sin²(${g.normalizedAngle.toFixed(1)}°)</td>
        <td style="${commonStyle} text-align: center; font-weight: bold;">${groupMy.toFixed(3)}</td>
        <td style="${commonStyle} text-align: center; font-size: 12px; color: #1a1a1a;">(${(g.multiplier * g.count).toFixed(2)}) × cos²(${g.normalizedAngle.toFixed(1)}°)</td>
      </tr>`;
    });

  const chap1Html = `
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
  const allFloorData = window.floorData || floorData || {};
  const revFloorKeys = Object.keys(allFloorData).sort((a,b) => b.localeCompare(a));

  // 2. 水平構面等価面積算定 (第2章用)
  let chap2Html = `
    <div id="chapter2" class="chapter-section">
      <h2 style="font-size: 18px; border-left: 8px solid #e67e22; padding-left: 15px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 20px; color: #000;">
        2. 水平構面等価面積 (形状低減係数ηの算定)
      </h2>
      <div style="background: #fffcf9; border: 1px solid #d35400; padding: 15px; margin-bottom: 20px; font-size: 12px; line-height: 1.6; border-radius: 4px; color: #333;">
        <strong style="color: #a04000;">【物理定義に基づく等価算定の保証】</strong><br>
        本章では、不整形な水平構面を長方形に置き換えて評価します。実面積 $S$、最大幅 $B_{max}$ に対し、等価奥行 $L_{eq} = S / B_{max}$ と定義することで、描画される面積が実面積 $S$ と数学的に一致することを保証しています。
      </div>`;

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
          <div style="font-weight: bold; margin-bottom: 15px; font-size:15px; color:#2c3e50;">符号: ${dia.id || `D-${idx+1}`} (実面積 S = ${S.toFixed(2)} m²)</div>
          
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
                  <div style="font-size:10px; color:#333;">(${(dia.Lx_eq||0).toFixed(2)}/${(dia.BBox_X||0).toFixed(2)})</div>
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
                  <div style="font-size:10px; color:#333;">(${(dia.Ly_eq||0).toFixed(2)}/${(dia.BBox_Y||0).toFixed(2)})</div>
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

  if (typeof window.syncSlabDataToBeams === 'function') {
    window.syncSlabDataToBeams();
  }

  let allTablesHtml = `
    <div style="margin-top: 60px;">
    </div>
  `;

  // 💡 BUGFIX: 特定の階だけでなく、建物全体の全階層を対象にループする
  const reportAxes = Array.from(window.getAxesToReport ? window.getAxesToReport() : getAxesToReport());
  const floorsList = ['PH', 'R', '3', '2', '1'];

  reportAxes.forEach(axisName => {
    let axisHtml = `
      <div style="margin-bottom: 40px; font-family: 'MS Gothic', 'Courier New', monospace; color: #000; page-break-inside: avoid;">
        <h2 id="${allTablesHtml.length < 100 ? 'section5-7' : `section5-7-${axisName}`}" style="font-size: 16px; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px;">
          5-7 柱頭柱脚の引張耐力の検定（${axisName}通り）
        </h2>
        
        <div style="display: flex; flex-direction: row; justify-content: space-between; width: 100%; page-break-inside: avoid; margin-top: 10px; margin-bottom: 20px;">
          <div style="width: 48%; text-align: center; border: 1px solid #eee; padding: 10px; background: #fafafa;">
            <h4 style="margin-bottom: 8px; font-size: 11px; color: #2c3e50; border-bottom: 1px solid #ddd; padding-bottom: 4px;">【 ${axisName}：左加力 (→) 】</h4>
            ${(window.generateEnlargedAxialDiagramSvg ? window.generateEnlargedAxialDiagramSvg(axisName, 'left') : generateEnlargedAxialDiagramSvg(axisName, 'left'))}
          </div>
          <div style="width: 48%; text-align: center; border: 1px solid #eee; padding: 10px; background: #fafafa;">
            <h4 style="margin-bottom: 8px; font-size: 11px; color: #2c3e50; border-bottom: 1px solid #ddd; padding-bottom: 4px;">【 ${axisName}：右加力 (←) 】</h4>
            ${(window.generateEnlargedAxialDiagramSvg ? window.generateEnlargedAxialDiagramSvg(axisName, 'right') : generateEnlargedAxialDiagramSvg(axisName, 'right'))}
          </div>
        </div>
    `;

    let hasData = false;

    floorsList.forEach(floorKey => {
      const floorDataObj = (window.allFloorData && window.allFloorData[floorKey]) || (window.floorData && window.floorData[floorKey]) || floorData[floorKey];
      if (!floorDataObj || !floorDataObj.columns) return;

      const colsOnAxis = [];
      floorDataObj.columns.forEach((col, idx) => {
        const walls = (floorDataObj.walls || []).filter(w => (w.n1 === col.nodeIndex || w.n2 === col.nodeIndex) && w.axisName === axisName);
        if (walls.length > 0) colsOnAxis.push({ col, idx });
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
              <th rowspan="2" style="border: 1px solid #000; padding: 4px;">通り</th>
              <th rowspan="2" style="border: 1px solid #000; padding: 4px;">柱座標</th>
              <th rowspan="2" style="border: 1px solid #000; padding: 4px;">加力方向</th>
              <th rowspan="2" style="border: 1px solid #000; padding: 4px;">ΣΔQail×Hi</th>
              <th rowspan="2" style="border: 1px solid #000; padding: 4px;">ΣΔQair×Hi</th>
              <th colspan="2" style="border: 1px solid #000; padding: 4px;">Bi (曲げ戻し)</th>
              <th colspan="2" style="border: 1px solid #000; padding: 4px;">本階 Ni (kN)</th>
              <th rowspan="2" style="border: 1px solid #000; padding: 4px;">上階 ΣNi</th>
              <th rowspan="2" style="border: 1px solid #000; padding: 4px;">軸力 Nw</th>
              <th colspan="2" style="border: 1px solid #000; padding: 4px; background:#e8f4f8;">柱頭 (kN)</th>
              <th colspan="2" style="border: 1px solid #000; padding: 4px; background:#fef5e7;">柱脚 (kN)</th>
            </tr>
            <tr style="background: #eee;">
              <th style="border: 1px solid #000; padding: 2px;">柱頭</th><th style="border: 1px solid #000; padding: 2px;">柱脚</th>
              <th style="border: 1px solid #000; padding: 2px;">柱頭</th><th style="border: 1px solid #000; padding: 2px;">柱脚</th>
              <th style="border: 1px solid #000; padding: 2px;">T値</th><th style="border: 1px solid #000; padding: 2px;">金物</th>
              <th style="border: 1px solid #000; padding: 2px;">T値</th><th style="border: 1px solid #000; padding: 2px;">金物</th>
            </tr>
          </thead>
          <tbody>
      `;

      colsOnAxis.forEach(item => {
        const res = (window.calculateColumnT ? window.calculateColumnT(item.idx, floorDataObj, floorKey) : {});
        if (!res || !res.cases) return;
        
        // ✅ 柱座標のX・Y通り芯ラベルを取得
        const colNode = floorDataObj.nodes[item.col.nodeIndex];
        const va = dxfVAxes.find(ax => Math.abs(ax.x - colNode.x) < 15);
        const ha = dxfHAxes.find(ax => Math.abs(ax.y - colNode.y) < 15);
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
              <td style="border: 1px solid #000; padding: 4px; text-align: right;">${(c.q1_Hi || 0).toFixed(2)}</td>
              <td style="border: 1px solid #000; padding: 4px; text-align: right;">${(c.q2_Hi || 0).toFixed(2)}</td>
              <td style="border: 1px solid #000; padding: 2px; text-align: center;">${(c.Bi_top || 0.5).toFixed(1)}</td>
              <td style="border: 1px solid #000; padding: 2px; text-align: center; font-weight:bold;">${(c.Bi_bot || 0.5).toFixed(1)}</td>
              <td style="border: 1px solid #000; padding: 2px; text-align: right; color: #7f8c8d;">${(c.Ni_top || 0).toFixed(2)}</td>
              <td style="border: 1px solid #000; padding: 2px; text-align: right; color: #3498db; font-weight:bold;">${(c.Ni_bot || 0).toFixed(2)}</td>
              <td style="border: 1px solid #000; padding: 4px; text-align: right;">${(c.Ni_upper || 0).toFixed(2)}</td>
              <td style="border: 1px solid #000; padding: 4px; text-align: right;">${(c.Nw || res.Nw || 0).toFixed(2)}</td>
              
              <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold; background:#f0f8ff;">${topT.toFixed(2)}</td>
              <td style="border: 1px solid #000; padding: 4px; text-align: center; color: ${c.isTopOk ? '#000' : '#e74c3c'}; font-size: 9px; background:#f0f8ff;">
                ${(window.makeShortName ? window.makeShortName(c.topMetal?.name) : (typeof makeShortName==='function'?makeShortName(c.topMetal?.name):'')) || '-'}<br>(${c.isTopOk ? 'OK' : 'NG'})
              </td>
              
              <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold; background:#fffcf0;">${botT.toFixed(2)}</td>
              <td style="border: 1px solid #000; padding: 4px; text-align: center; color: ${c.isBaseOk ? '#000' : '#e74c3c'}; font-size: 9px; background:#fffcf0;">
                ${(window.makeShortName ? window.makeShortName(c.baseMetal?.name) : (typeof makeShortName==='function'?makeShortName(c.baseMetal?.name):'')) || '-'}<br>(${c.isBaseOk ? 'OK' : 'NG'})
              </td>
            </tr>
          `;
        });
      });

      axisHtml += `</tbody></table>`;
    });

    axisHtml += `</div>`;
    if (hasData) {
      allTablesHtml += axisHtml;
    }
  });

  // 💡 BUGFIX: 後続のアンカーボルト・基礎梁計算（主に1階）のために、変数 fk と fd を再定義する
  const fk = typeof currentFloor !== 'undefined' ? currentFloor : '1';
  const fd = (typeof allFloorData !== 'undefined' && allFloorData[fk]) || 
             (typeof window.floorData !== 'undefined' && window.floorData[fk]) || 
             (typeof floorData !== 'undefined' ? floorData[fk] : null);
             
  if (!fd) {
      console.warn('基礎階のデータが見つかりません。');
      return;
  }

  const anchorAxes = Array.from(window.getAxesToReport ? window.getAxesToReport() : getAxesToReport());
  let anchorRowsX = "", anchorRowsY = "";
  
  anchorAxes.forEach(axis => {
    const jType = fd.anchorJType || 'J1';
    const am = ANCHOR_BOLT_MASTER[jType] || ANCHOR_BOLT_MASTER['J1'];

    let totalM12 = 0, totalM16 = 0;
    [...(fd.beams||[]), ...(fd.perimeterBeams||[])].forEach(b => {
      if ((b.axisName || b.axis) === axis) {
        totalM12 += (b.anchorM12 || 0);
        totalM16 += (b.anchorM16 || 0);
      }
    });

    const qaa = (totalM12 * am.m12) + (totalM16 * am.m16);
    
    let sumQaX = 0, sumQaY = 0;
    fd.walls.forEach(w => {
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

  const anchorTableHtml = `
    <div id="section5-9" style="margin-top: 40px; font-family: 'MS Gothic', 'Courier New', monospace; color: #000; page-break-inside: avoid;">
      <h2 style="font-size: 16px; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px;">
        5-9 アンカーボルトと土台の検定（${fk}階）
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

  const footerHtml = `
    <div style="font-size: 10px; color: #333; line-height: 1.5; font-family: monospace; border: 1px solid #ddd; padding: 10px; background: #fefefe;">
      【注記】<br>
      ・T = (ΣNi) - 0.6 × Nw <br>
      ・Ni = (ΣΔQair×Hi - ΣΔQail×Hi) × Bi <br>
      ・ΔQ = 1.96 × multiplier (壁換算前倍率) <br>
      ・Nw: 引張耐力検討用軸力 (kN) / Bi: 隅柱(0.8), 中間柱(0.5) / Hi: 階高 (m) <br>
      ・本計算書は、壁プロパティで「通り名」が設定された軸のみを抽出して出力しています。<br>
      ・解析基準日: ${new Date().toLocaleDateString()}
    </div>
  `;

  // (旧 7-2 負担図テーブルは、新 7-2 応力図 SVG に置き換えられるため削除)





  // 💡 PDF印刷時に全ページが正しく出力されるためのCSS
  const printStyles = `
    <style>
      @media print {
        /* アプリのUI要素を非表示にする */
        header, footer, .panel-left, .panel-right, #canvas-container, .no-print, #report-print-btn-header { display: none !important; }
        
        /* スクロール制限や高さ制限を解除し、全ページを表示可能にする */
        body, html { height: auto !important; overflow: visible !important; margin: 0; padding: 0; background: #fff; }
        
        /* レポート表示領域の制限を解除 */
        #reportContent { 
          position: absolute !important; 
          left: 0; top: 0; 
          width: 100% !important; 
          height: auto !important; 
          overflow: visible !important; 
          display: block !important; 
          color: #000 !important;
          background: #fff !important;
        }
        
        /* モーダル背景や枠線を消す */
        #reportModal { position: static !important; display: block !important; background: none !important; }
        #reportModal > div { box-shadow: none !important; border: none !important; width: 100% !important; height: auto !important; }
        
        /* 図面やセクションがページ途中で切れるのを防ぐ */
        section, .report-section, .page-break-avoid { page-break-inside: avoid; margin-bottom: 20px; }
        h2, h3 { page-break-after: avoid; color: #000 !important; }
        table { page-break-inside: auto; width: 100% !important; border: 1px solid #000 !important; }
        tr { page-break-inside: avoid; page-break-after: auto; }
        td, th { border: 1px solid #000 !important; color: #000 !important; }
      }
    </style>
  `;

  const modalHeader = document.querySelector('#reportModal h2')?.parentElement;
  if (modalHeader && !document.getElementById('report-print-btn-header')) {
    const printBtn = document.createElement('button');
    printBtn.id = 'report-print-btn-header';
    printBtn.className = 'no-print';
    printBtn.onclick = () => window.print();
    printBtn.style.cssText = 'margin-right:15px; padding:8px 15px; background:#27ae60; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;';
    printBtn.innerHTML = '🖨️ PDF印刷 / A4保存';
    modalHeader.insertBefore(printBtn, modalHeader.lastElementChild);
  }

  const navHtml = `
    <div class="no-print" style="position: sticky; top: 0; background: #252a3a; z-index: 1000; border-bottom: 2px solid #5b8afe; padding: 10px; display: flex; flex-wrap: wrap; gap: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); margin-bottom:20px;">
      <a href="#chapter1" style="text-decoration: none; color: #fff; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #34495e;">第1章 斜め壁</a>
      <a href="#chapter2" style="text-decoration: none; color: #fff; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #34495e;">第2章 水平構面</a>
      <a href="#section5-7" style="text-decoration: none; color: #fff; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #34495e;">5-7 引張検定</a>
      <a href="#chapter4" style="text-decoration: none; color: #fff; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #34495e;">第4章 金物伏図</a>
      <a href="#section5-9" style="text-decoration: none; color: #fff; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #34495e;">5-9 アンカー</a>
      <a href="#section7-1" style="text-decoration: none; color: #fff; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #34495e;">7-1 べた基礎</a>
      <a href="#section7-2" style="text-decoration: none; color: #fff; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #34495e;">7-2 基礎梁負担</a>
      <a href="#section7-3" style="text-decoration: none; color: #fff; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #e74c3c;">8. 基礎梁断面検定</a>
    </div>
  `;

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
      const floorDataObj = (window.allFloorData && window.allFloorData[floorKey]) || (window.floorData && window.floorData[floorKey]) || floorData[floorKey];
      if (!floorDataObj || !floorDataObj.columns || floorDataObj.columns.length === 0) return;
      
      has58Data = true;
      const bbox = getFloorBoundingBox(floorDataObj);
      const hwData = window.generateHardwarePlanSvg ? window.generateHardwarePlanSvg(floorKey, floorDataObj, bbox) : {svg:'', legendHtml:''};
      
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

  const fd1 = (typeof allFloorData !== 'undefined' && allFloorData['1']) || (typeof floorData !== 'undefined' ? floorData['1'] : null);
  const bbox1 = fd1 ? getFloorBoundingBox(fd1) : null;
  const reactionSvgContent = (fd1 && window.generateFoundationReactionSvg) ? window.generateFoundationReactionSvg(fd1, bbox1) : '';

  // 7-1 べた基礎の検定（スラブ計算表を統合）
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

  if (fd1 && fd1.slabs) {
      const targetSlabs = fd1.slabs.filter(sl => sl.showReport !== false);
      targetSlabs.forEach((sl, idx) => {
          section71Html += `
            <div class="slab-set" style="margin-bottom: 40px; page-break-inside: avoid;">
              <h3 style="font-size: 15px; border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 15px; color:#000; background:#f8f9fa; padding:10px; font-weight: bold;">
                📄 スラブ断面検定表: ${sl.id || `SL-${idx+1}`}
              </h3>
              ${generateSingleSlabCalcHtml(sl, fd1)}
            </div>
          `;
      });
      if (targetSlabs.length === 0) {
          section71Html += `<p style="color:#666; font-size:12px;">※断面検定対象のスラブがありません。</p>`;
      }
  }
  section71Html += `</div></div>`;

  const tributarySvg = (fd1 && window.generateFoundationTributarySvg) ? window.generateFoundationTributarySvg(fd1, bbox1) : '';
  let section72Html = `
    <div id="section7-2" style="margin-top: 40px; padding:20px; border:1px solid #eee; background:#fff; color:#000; page-break-inside: auto;">
      <h2 style="font-size: 18px; border-left: 8px solid #3498db; padding-left: 15px; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 20px; color:#000;">
        7-2 基礎梁負担面積・負担幅図
      </h2>
      <div style="text-align: center; margin-bottom: 10px; page-break-inside: avoid;">
          ${tributarySvg || '<p style="color:#999; font-size:12px;">※スラブデータがありません。</p>'}
      </div>
      <p style="color:#666; font-size:11px; text-align:center;">※破線：亀甲分割（45度分配）による負担境界線</p>
    </div>
  `;

  document.getElementById('reportContent').innerHTML = navHtml + (window.premiseHtml || '') + printStyles + `
    <div style="padding: 20px; background: #fff;">
      ${chap1Html}
      ${chap2Html}
      ${allTablesHtml}
      ${section58Html}
      ${anchorTableHtml}
      ${section71Html}
      ${section72Html}
      <div id="section7-3" style="margin-top: 40px; padding:20px; border:1px solid #eee; background:#fff; color:#000; page-break-inside: auto;">
        <h2 style="font-size: 18px; border-left: 8px solid #f1c40f; padding-left: 15px; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 20px; color:#000;">
          8. 基礎梁の断面と配筋の検定
        </h2>
        <div style="background: #fffcfc; border: 1px solid #e67e22; padding: 12px; margin-bottom: 20px; font-size: 12px; border-radius: 4px; color: #333; line-height: 1.6;">
          <strong>【基礎梁検定の算定根拠】</strong><br>
          本章の検定表は、以下の5ステップで構成されています：<br>
          ①荷重の算定 / ②応力の算定（短期） / ③許容耐力(1)：主筋 / ④許容耐力(2)：せん断補強筋 / ⑤判定
        </div>
        ${(() => {
          const allBeams = [
            ...(fd1.beams || []).filter(b => b.type === 'foundation_beam' || !b.type),
            ...(fd1.perimeterBeams || [])
          ].filter(b => b.showReport !== false);
          
          const beamsByAxis = new Map();
          allBeams.forEach(b => {
             const ax = b.axisName || b.axis || '不明な軸';
             if (!beamsByAxis.has(ax)) beamsByAxis.set(ax, []);
             beamsByAxis.get(ax).push(b);
          });
          
          const sortedAxes = Array.from(beamsByAxis.keys()).sort((a, b) => {
             return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
          });
          
          let html = '';
          sortedAxes.forEach(axisName => {
             const beamsInAxis = beamsByAxis.get(axisName);
             html += `
               <div class="axis-group" style="margin-bottom: 60px; page-break-inside: auto;">
                 <h3 style="font-size: 16px; border-bottom: 3px solid #f1c40f; padding-bottom: 5px; margin-bottom: 25px; color:#000; background:#fdf9e1; padding:12px; font-weight: bold; border-left: 10px solid #f1c40f;">
                   通り芯: ${axisName}
                 </h3>
             `;
             beamsInAxis.forEach(b => {
                const detailTables = (window.generateFoundationHorizontalStressTable) 
                  ? window.generateFoundationHorizontalStressTable(b, 'beam', 0, true) 
                  : '<p style="color:red;">算定エラー: 計算関数が見つかりません</p>';

                // 応力図（SVG）の再掲
                const stressSvg = window.generateSingleBeamNMQStressSvg ? window.generateSingleBeamNMQStressSvg(b) : '';

                html += `
                  <div class="beam-set" style="margin-bottom: 60px; page-break-inside: auto;">
                    <div style="font-size: 14px; font-weight: bold; color:#2c3e50; margin-bottom: 15px; padding-left: 10px; border-left: 4px solid #2ecc71;">
                      符号: ${b.id}
                    </div>
                    <div style="margin-top: 15px; margin-bottom: 25px; text-align: center; page-break-inside: avoid;">
                      ${stressSvg}
                      <p style="color:#666; font-size:10px; text-align:center; margin-top:5px;">※応力図：黄色＝曲げ(M)、青色＝せん断(Q)、矢印＝短期軸力(N)・反力(R)</p>
                    </div>
                    <div class="foundation-detail-tables">
                      ${detailTables}
                    </div>
                  </div>
                `;
             });
             html += `</div>`;
          });
          return html || '<p style="color:#999; font-size:12px;">※出力対象の基礎梁がありません。</p>';
        })()}
      </div>
      </div>
      ${footerHtml}
    </div>
  `;
  document.getElementById('reportModal').style.display = 'flex';
};

/**
 * 帳票出力対象の通り名リストを取得する
 */
export function getAxesToReport() {
  const reportAxes = new Set();
  Object.values(floorData).forEach(fd => {
    (fd.walls || []).forEach(w => {
      if (w.axisName && w.showReport) reportAxes.add(w.axisName);
    });
    (fd.columns || []).forEach(c => {
      if (c.showReport) {
        const associatedWalls = (fd.walls || []).filter(w => (w.n1 === c.nodeIndex || w.n2 === c.nodeIndex) && w.axisName);
        associatedWalls.forEach(w => reportAxes.add(w.axisName));
      }
    });
    (fd.beams || []).forEach(b => {
      if ((b.axisName || b.axis) && b.showReport) reportAxes.add(b.axisName || b.axis);
    });
    (fd.perimeterBeams || []).forEach(pb => {
      if ((pb.axisName || pb.axis) && pb.showReport) reportAxes.add(pb.axisName || pb.axis);
    });
  });
  return Array.from(reportAxes).sort();
}

/**
 * 特定の通りの拡大軸力図（立面）を SVG で生成する
 * @param {string} axisName - 通り名
 * @param {string} loadDirection - 加力方向 ('left' または 'right')
 */
export function generateEnlargedAxialDiagramSvg(axisName, loadDirection = 'left') {
  const floors = ['PH', 'R', '3', '2', '1'];
  const floorDataMap = [];
  floors.forEach(f => {
    const fd = (window.allFloorData && window.allFloorData[f]) || floorData[f];
    if (!fd) return;
    const walls = (fd.walls || []).filter(w => w.axisName === axisName);
    const nodeIdxs = new Set(walls.flatMap(w => [w.n1, w.n2]));
    const columns = (fd.columns || []).filter(c => nodeIdxs.has(c.nodeIndex));
    if (walls.length > 0 || columns.length > 0) {
      floorDataMap.push({ floor: f, walls, columns, fd });
    }
  });

  if (floorDataMap.length === 0) return '';

  let isXHorizontal = true;
  const allNodes = floorDataMap.flatMap(fm => fm.walls.flatMap(w => [fm.fd.nodes[w.n1], fm.fd.nodes[w.n2]]));
  const minX = Math.min(...allNodes.map(n => n.x)), maxX = Math.max(...allNodes.map(n => n.x));
  const minY = Math.min(...allNodes.map(n => n.y)), maxY = Math.max(...allNodes.map(n => n.y));
  isXHorizontal = (maxX - minX) >= (maxY - minY);

  const getPos = (n) => isXHorizontal ? n.x : n.y;
  const startPos = isXHorizontal ? minX : minY;
  const totalW = Math.max(isXHorizontal ? (maxX - minX) : (maxY - minY), 100);

  const padding = 60;
  const svgW = 800;
  
  // ─── 縦方向のリアル寸法の計算 ───
  let totalH = 0;
  const floorHeightsMap = floorDataMap.map(fm => fm.fd.floorHeight || 2730);
  totalH = floorHeightsMap.reduce((a, b) => a + b, 0);

  // ─── スケール計算 ───
  const rawScaleX = (svgW - padding * 2) / totalW;
  const rawScaleY = 500 / totalH; 
  const scaleVal = Math.min(rawScaleX, rawScaleY);

  const W = svgW;
  const H = totalH * scaleVal + padding * 2;
  const getX = (pos) => padding + (pos - startPos) * scaleVal + (W - totalW * scaleVal - padding * 2) / 2; // 中央寄せ

  const floorYMap_Top = {};
  const floorYMap_Bot = {};
  const groundY = H - padding;
  let currentAccH = 0;
  for (let i = floorDataMap.length - 1; i >= 0; i--) {
      const fm = floorDataMap[i];
      const h = fm.fd.floorHeight || 2730;
      floorYMap_Bot[fm.floor] = groundY - (currentAccH * scaleVal);
      currentAccH += h;
      floorYMap_Top[fm.floor] = groundY - (currentAccH * scaleVal);
  }

  // A4対応: width="100%" と viewBox を設定 (height="auto"はエラーの原因となるため削除)
  let svg = `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; font-family: sans-serif;">`;
  
  floorDataMap.forEach(fm => {
    const y = floorYMap_Bot[fm.floor];
    svg += `<line x1="${padding/2}" y1="${y}" x2="${W-padding/2}" y2="${y}" stroke="#ccc" stroke-width="1" />`;
    svg += `<text x="5" y="${y+4}" font-size="12" fill="#666">${fm.floor}${fm.floor==='1'?'F/GL':'F'}</text>`;
  });
  const topY = floorYMap_Top[floorDataMap[0].floor];
  svg += `<line x1="${padding/2}" y1="${topY}" x2="${W-padding/2}" y2="${topY}" stroke="#ccc" stroke-width="1" />`;
  svg += `<text x="5" y="${topY+4}" font-size="12" fill="#666">${floorDataMap[0].floor === 'PH' ? 'PH屋上' : 'R/屋根'}</text>`;

  svg += `<line x1="${padding/2}" y1="${groundY}" x2="${W-padding/2}" y2="${groundY}" stroke="#333" stroke-width="2" />`;

  floorDataMap.forEach((fm, fIdx) => {
    const yTop = floorYMap_Top[fm.floor];
    const yBot = floorYMap_Bot[fm.floor];
    const Hi = (fm.fd.floorHeight || 2730) / 1000;
    
    fm.walls.forEach(w => {
      const n1 = fm.fd.nodes[w.n1], n2 = fm.fd.nodes[w.n2];
      if (!n1 || !n2) return;
      const x1 = getX(getPos(n1)), x2 = getX(getPos(n2));
      const leftX = Math.min(x1, x2), rightX = Math.max(x1, x2), width = rightX - leftX;
      const fill = w.multiplier > 0 ? "rgba(91,138,254,0.08)" : "none";
      const stroke = w.multiplier > 0 ? "#5b8afe" : "#999";
      const dash = w.multiplier > 0 ? "" : 'stroke-dasharray="4,4"';
      
      svg += `<rect x="${leftX}" y="${yTop}" width="${width}" height="${yBot - yTop}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" ${dash} />`;
      svg += `<line x1="${leftX}" y1="${yTop}" x2="${rightX}" y2="${yBot}" stroke="${stroke}" stroke-width="0.5" ${dash} opacity="0.5" />`;
      svg += `<line x1="${rightX}" y1="${yTop}" x2="${leftX}" y2="${yBot}" stroke="${stroke}" stroke-width="0.5" ${dash} opacity="0.5" />`;

      if (w.multiplier > 0) {
        const mult = parseFloat(w.multiplier) || 0;
        const P = 1.96 * mult * Hi;
        let Bi = 0.5;
        const adjCol = fm.columns.find(c => c.nodeIndex === w.n1 || c.nodeIndex === w.n2);
        if (adjCol) {
            Bi = (adjCol.biSetting === '0.8') ? 0.8 : 0.5;
        }
        const N = P * Bi;
        const centerX_wall = (leftX + rightX) / 2;
        const textY_wall = (yTop + yBot) / 2 - 12;
        svg += `
          <text x="${centerX_wall}" y="${textY_wall}" font-size="10" fill="#2c3e50" font-weight="bold" text-anchor="middle">
            <tspan x="${centerX_wall}" dy="0">α = ${mult.toFixed(2)}</tspan>
            <tspan x="${centerX_wall}" dy="12">P = ${P.toFixed(3)} kN</tspan>
            <tspan x="${centerX_wall}" dy="12">N = ${N.toFixed(3)} kN</tspan>
          </text>
        `;
      }
    });

    const axisPositionsSet = new Set(fm.walls.flatMap(w => {
        const n1 = fm.fd.nodes[w.n1], n2 = fm.fd.nodes[w.n2];
        return n1 && n2 ? [getPos(n1), getPos(n2)] : [];
    }));

    Array.from(axisPositionsSet).sort((a,b)=>a-b).forEach((p, pIdx) => {
      const x = getX(p);
      svg += `<line x1="${x}" y1="${yTop}" x2="${x}" y2="${yBot}" stroke="#666" stroke-width="1" stroke-dasharray="2,2" />`;
      
      // ✅ 通り芯ラベルの描画 (1F/GLラインの下)
      const axis = (isXHorizontal ? dxfVAxes : dxfHAxes).find(ax => Math.abs((isXHorizontal ? ax.x : ax.y) - p) < 5);
      if (axis && axis.label) {
        svg += `<text x="${x}" y="${groundY + 40}" font-size="12" fill="#999" font-weight="bold" text-anchor="middle">${axis.label}</text>`;
      }

      const localCol = fm.columns.find(c => Math.abs(getPos(fm.fd.nodes[c.nodeIndex]) - p) < 5);
      const globalCIdx = localCol ? fm.fd.columns.findIndex(c => c.nodeIndex === localCol.nodeIndex) : -1;

      if (globalCIdx !== -1 && window.calculateColumnT) {
          let res = null;
          try {
              res = window.calculateColumnT(globalCIdx, fm.fd, fm.floor);
          } catch(e) {
              console.error("Column calculation error:", e);
          }

          if (res && res.cases) {
              const lCase = res.cases.find(c => c.name.includes('左から'));
              const rCase = res.cases.find(c => c.name.includes('右から'));
              const targetCase = (loadDirection === 'left') ? lCase : rCase;

              if (targetCase) {
                  const color = (targetCase.totalNi > 0) ? '#e74c3c' : '#3498db';
                  const anchor = (loadDirection === 'left') ? 'end' : 'start';
                  const dx = (loadDirection === 'left') ? -5 : 5;
                  const topY_val = typeof yTop !== 'undefined' ? yTop : 0;
                  const staggerOffsetTop = (pIdx % 2 === 0) ? 12 : 22;
                  svg += `<text x="${x + dx}" y="${topY_val + staggerOffsetTop}" font-size="9" fill="${color}" font-weight="bold" text-anchor="${anchor}">${loadDirection==='left'?'←':' '}Ni:${(targetCase.totalNi||0).toFixed(3)}${loadDirection==='right'?'→':''}</text>`;

                  if (String(fm.floor) === '1') {
                      const rawT = targetCase.T_bot !== undefined ? targetCase.T_bot : (targetCase.T !== undefined ? targetCase.T : (targetCase.totalNi || 0));
                      const T_val = Number(rawT) || 0;
                      const forceColor = T_val > 0 ? '#e74c3c' : '#3498db';
                      const forceText = T_val > 0 ? `(+) ${T_val.toFixed(3)}` : `- ${Math.abs(T_val).toFixed(3)}`;
                      const bottomY = typeof yBot !== 'undefined' ? yBot : (topY_val + 2730);
                      const textX_col = (loadDirection === 'left') ? x - 6 : x + 6;
                      const textAnchor_col = (loadDirection === 'left') ? 'end' : 'start';
                      const staggerOffset = (pIdx % 2 === 0) ? 12 : -8;
                      svg += `<text x="${textX_col}" y="${bottomY + staggerOffset}" font-size="11" fill="${forceColor}" font-weight="bold" text-anchor="${textAnchor_col}">${forceText}</text>`;
                  }
              }
          }
      }
    });
  });

  svg += `</svg>`;
  return svg;
}

/**
 * 金物配置伏図 (平面図) を SVG で生成する
 * @param {string} floorKey 
 * @param {object} fd 
 */


/**
 * べた基礎反力図 (平面図) を SVG で生成する
 * @param {object} fd - 1階のfloorData
 */
/**
 * 床ごとの共通バウンディングボックス（描画範囲）を算出する
 * @param {object} fd - 床データ
 * @returns {object} {minX, maxX, minY, maxY, width, height}
 */
export function getFloorBoundingBox(fd) {
  const nodes = new Set();
  (fd.columns || []).forEach(c => nodes.add(c.nodeIndex));
  (fd.walls || []).forEach(w => { nodes.add(w.n1); nodes.add(w.n2); });
  (fd.beams || []).forEach(b => { nodes.add(b.n1); nodes.add(b.n2); });
  (fd.perimeterBeams || []).forEach(b => { nodes.add(b.n1); nodes.add(b.n2); });
  (fd.slabs || []).forEach(s => (s.nodeIds || []).forEach(id => nodes.add(id)));
  
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  nodes.forEach(nid => {
    const n = fd.nodes[nid];
    if (!n) return;
    if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
  });
  
  if (minX === Infinity) return { minX: 0, maxX: 1000, minY: 0, maxY: 1000, width: 1000, height: 1000 };
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * べた基礎反力図 (平面図) を SVG で生成する
 * @param {object} fd - 1階のfloorData
 * @param {object} unifiedBbox - 共通描画範囲（オプション）
 */
export function generateFoundationReactionSvg(fd, unifiedBbox = null) {
  if (!fd || !fd.nodes || fd.nodes.length === 0) return '';
  
  const bbox = unifiedBbox || getFloorBoundingBox(fd);
  const minX = bbox.minX, maxX = bbox.maxX, minY = bbox.minY, maxY = bbox.maxY;
  
  const gridXs = [], gridYs = [];
  const activeNodes = new Set();
  (fd.columns || []).forEach(c => activeNodes.add(c.nodeIndex));
  (fd.walls || []).forEach(w => { activeNodes.add(w.n1); activeNodes.add(w.n2); });
  (fd.slabs || []).forEach(s => s.nodeIds.forEach(id => activeNodes.add(id)));
  activeNodes.forEach(nid => {
      const n = fd.nodes[nid];
      if (!n) return;
      if (!gridXs.some(gx => Math.abs(gx - n.x) < 50)) gridXs.push(n.x);
      if (!gridYs.some(gy => Math.abs(gy - n.y) < 50)) gridYs.push(n.y);
  });

  const padding = 100;
  const svgW = 600;
  const bW = bbox.width;
  const bH = bbox.height;
  const scale = Math.min((svgW - padding * 2) / (bW || 1), 600 / (bH || 1));
  const svgH = bH * scale + padding * 2;

  // Y軸の反転（CAD座標系から一般的な建築図面座標系へ）
  const w2s = (x, y) => ({ 
      x: padding + (x - minX) * scale, 
      y: svgH - padding - (y - minY) * scale 
  });

  let svg = `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; font-family: sans-serif; border: 1px solid #ddd; max-height: 1000px; width: 100%; max-width: 1600px; margin: 0 auto; display: block;">`;

  // グリッドの描画
  gridXs.forEach(gx => {
      const p1 = w2s(gx, minY), p2 = w2s(gx, maxY);
      svg += `<line x1="${p1.x}" y1="${p1.y + 20}" x2="${p2.x}" y2="${p2.y - 20}" stroke="#bdc3c7" stroke-width="1" stroke-dasharray="4,4" />`;
  });
  gridYs.forEach(gy => {
      const p1 = w2s(minX, gy), p2 = w2s(maxX, gy);
      svg += `<line x1="${p1.x - 20}" y1="${p1.y}" x2="${p2.x + 20}" y2="${p2.y}" stroke="#bdc3c7" stroke-width="1" stroke-dasharray="4,4" />`;
  });

  // スラブ（べた基礎）の描画と接地圧の表示
  (fd.slabs || []).forEach(slab => {
      if (!slab.nodeIds || slab.nodeIds.length < 3) return;
      const pts = slab.nodeIds.map(nid => fd.nodes[nid]).filter(Boolean);
      if (pts.length < 3) return;
      
      let d = `M ${w2s(pts[0].x, pts[0].y).x} ${w2s(pts[0].x, pts[0].y).y}`;
      let cx = 0, cy = 0;
      pts.forEach((p, i) => {
          const sp = w2s(p.x, p.y);
          if (i > 0) d += ` L ${sp.x} ${sp.y}`;
          cx += sp.x; cy += sp.y;
      });
      d += ' Z';
      cx /= pts.length; cy /= pts.length;
      
      svg += `<path d="${d}" fill="rgba(46, 204, 113, 0.1)" stroke="#27ae60" stroke-width="1.5" stroke-dasharray="4,4" />`;
      
      // 接地圧 σe の表示（視認性向上のためフォントを拡大）
      const sigma = (slab.groundPressure || 0).toFixed(3);
      svg += `<text x="${cx}" y="${cy}" font-size="16" fill="#2c3e50" font-weight="bold" text-anchor="middle">σe=${sigma} kN/㎡</text>`;
      svg += `<text x="${cx}" y="${cy+18}" font-size="13" fill="#7f8c8d" text-anchor="middle">${slab.id}</text>`;
  });

  // 基礎梁の描画と線荷重（反力）の表示
  const allBeams = [...(fd.beams || []).filter(b => b.type === 'foundation_beam' || !b.type), ...(fd.perimeterBeams || [])];
  allBeams.forEach(b => {
      const n1 = fd.nodes[b.n1], n2 = fd.nodes[b.n2];
      if (!n1 || !n2) return;
      const p1 = w2s(n1.x, n1.y), p2 = w2s(n2.x, n2.y);
      
      const isShared = b.isShared ? true : false;
      const beamColor = isShared ? '#e67e22' : '#34495e';
      
      svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${beamColor}" stroke-width="3" />`;
      
      // 線荷重 w (σe * B) の計算と表示
      const w_val = ((b.groundPressure || 0) * (b.tributaryWidth || 0)).toFixed(3);
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      
      // 梁の角度に合わせて文字を回転
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
      const rotAngle = (angle > 90 || angle < -90) ? angle + 180 : angle;
      
      svg += `<text x="${cx}" y="${cy - 5}" font-size="10" fill="${beamColor}" font-weight="bold" text-anchor="middle" transform="rotate(${rotAngle}, ${cx}, ${cy})">w=${w_val} kN/m</text>`;
  });

  // 柱の描画（位置の目安として）
  (fd.columns || []).forEach(c => {
      const n = fd.nodes[c.nodeIndex];
      if (!n) return;
      const p = w2s(n.x, n.y);
      svg += `<rect x="${p.x - 4}" y="${p.y - 4}" width="8" height="8" fill="#333" />`;
  });

  svg += `</svg>`;
  return svg;
}

/**
 * 単一の基礎梁の応力図（M図・Q図）をSVGで生成する
 * @param {object} beam - 基礎梁オブジェクト
 * @param {object} calcRes - 梁の計算結果（M_mid, M_end, Q_L 等を含む）
 */
export function generateSingleBeamStressSvg(beam, calcRes) {
    if (!beam || !calcRes) return '';
    
    const svgW = 600;
    const svgH = 250;
    const padX = 50;
    const padY = 50;
    const drawW = svgW - padX * 2;
    const drawH = (svgH - padY * 2) / 2; // 上半分がM図、下半分がQ図
    
    const M_mid = calcRes.M_mid || 0;
    const M_end = calcRes.M_end || 0;
    const Q = calcRes.Q_L || 0;
    const w = calcRes.w_load || 0;
    const L = calcRes.Lo || 0;
    
    // スケール計算（適度な高さに収まるように）
    const maxM = Math.max(Math.abs(M_mid), Math.abs(M_end), 0.1);
    const maxQ = Math.max(Math.abs(Q), 0.1);
    const scaleM = (drawH * 0.8) / maxM;
    const scaleQ = (drawH * 0.8) / maxQ;
    
    const yAxisM = padY + drawH; // M図の基準線（下向きが正）
    const yAxisQ = padY + drawH * 1.5; // Q図の基準線
    
    let svg = `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; font-family: sans-serif; border: 1px solid #ddd; margin-bottom: 20px; max-width: 800px;">`;
    
    // タイトルと梁情報
    svg += `<text x="10" y="20" font-size="14" fill="#000" font-weight="bold">【${beam.id}】 通り: ${beam.axisName || beam.axis || '-'} / スパン: ${L.toFixed(3)} m</text>`;
    svg += `<text x="10" y="38" font-size="12" fill="#555">負担荷重 w = ${w.toFixed(3)} kN/m, 端部モーメント = ${M_end.toFixed(2)} kN·m</text>`;
    
    // --- M図（曲げモーメント）---
    svg += `<line x1="${padX}" y1="${yAxisM}" x2="${padX + drawW}" y2="${yAxisM}" stroke="#ccc" stroke-width="2" />`; // 基準線
    svg += `<text x="${padX - 10}" y="${yAxisM - drawH + 15}" font-size="11" fill="#c0392b" text-anchor="end">M図</text>`;
    
    // 放物線の描画（簡易的に3点で結ぶ）
    const mStartX = padX, mStartY = yAxisM + M_end * scaleM;
    const mMidX = padX + drawW / 2, mMidY = yAxisM + M_mid * scaleM;
    const mEndX = padX + drawW, mEndY = yAxisM + M_end * scaleM;
    
    const mPath = `M ${mStartX} ${mStartY} Q ${mMidX} ${yAxisM + (M_mid + (M_mid - M_end)) * scaleM} ${mEndX} ${mEndY}`;
    svg += `<path d="${mPath}" fill="rgba(192, 57, 43, 0.1)" stroke="#c0392b" stroke-width="2" />`;
    svg += `<line x1="${mStartX}" y1="${yAxisM}" x2="${mStartX}" y2="${mStartY}" stroke="#c0392b" stroke-width="2" stroke-dasharray="2,2"/>`;
    svg += `<line x1="${mEndX}" y1="${yAxisM}" x2="${mEndX}" y2="${mEndY}" stroke="#c0392b" stroke-width="2" stroke-dasharray="2,2"/>`;
    
    // 数値表示
    svg += `<text x="${mMidX}" y="${mMidY > yAxisM ? mMidY + 15 : mMidY - 5}" font-size="11" fill="#c0392b" text-anchor="middle" font-weight="bold">${M_mid.toFixed(2)}</text>`;
    svg += `<text x="${mStartX}" y="${mStartY > yAxisM ? mStartY + 15 : mStartY - 5}" font-size="10" fill="#c0392b" text-anchor="middle">${M_end.toFixed(2)}</text>`;
    
    // --- Q図（せん断力）---
    svg += `<line x1="${padX}" y1="${yAxisQ}" x2="${padX + drawW}" y2="${yAxisQ}" stroke="#ccc" stroke-width="2" />`; // 基準線
    svg += `<text x="${padX - 10}" y="${yAxisQ - drawH*0.4}" font-size="11" fill="#2980b9" text-anchor="end">Q図</text>`;
    
    const qStartY = yAxisQ - Q * scaleQ;
    const qEndY = yAxisQ + Q * scaleQ;
    
    const qPath = `M ${padX} ${yAxisQ} L ${padX} ${qStartY} L ${padX + drawW} ${qEndY} L ${padX + drawW} ${yAxisQ} Z`;
    svg += `<path d="${qPath}" fill="rgba(41, 128, 185, 0.1)" stroke="#2980b9" stroke-width="2" />`;
    
    // 数値表示
    svg += `<text x="${padX}" y="${qStartY - 5}" font-size="11" fill="#2980b9" text-anchor="middle" font-weight="bold">${Q.toFixed(2)}</text>`;
    svg += `<text x="${padX + drawW}" y="${qEndY + 15}" font-size="11" fill="#2980b9" text-anchor="middle" font-weight="bold">-${Q.toFixed(2)}</text>`;
    
    svg += `</svg>`;
    return svg;
}

/**
 * 基礎梁負担面積・負担幅図 (亀甲分割図) を SVG で生成する
 * @param {object} fd - 1階のfloorData
 * @param {object} unifiedBbox - 共通描画範囲（オプション）
 */
export function generateFoundationTributarySvg(fd, unifiedBbox = null) {
  if (!fd || !fd.nodes || fd.nodes.length === 0) return '';
  
  const bbox = unifiedBbox || getFloorBoundingBox(fd);
  const minX = bbox.minX, maxX = bbox.maxX, minY = bbox.minY, maxY = bbox.maxY;
  
  const padding = 100;
  const svgW = 600;
  const bW = bbox.width;
  const bH = bbox.height;
  const scale = Math.min((svgW - padding * 2) / (bW || 1), 600 / (bH || 1));
  const svgH = bH * scale + padding * 2;
  const w2s = (x, y) => ({ x: padding + (x - minX) * scale, y: svgH - padding - (y - minY) * scale });

  let svg = `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; font-family: sans-serif; border: 1px solid #ddd; max-height: 1000px; width: 100%; max-width: 1600px; margin: 0 auto; display: block;">`;

  const activeNodes = new Set();
  (fd.slabs || []).forEach(s => s.nodeIds.forEach(id => activeNodes.add(id)));

  // 通り芯（グリッド）
  const gridXs = [...new Set(Array.from(activeNodes).map(id => fd.nodes[id]?.x))].sort((a,b)=>a-b);
  const gridYs = [...new Set(Array.from(activeNodes).map(id => fd.nodes[id]?.y))].sort((a,b)=>a-b);
  gridXs.forEach(gx => {
      const p1 = w2s(gx, minY), p2 = w2s(gx, maxY);
      svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#eee" stroke-width="1" />`;
  });
  gridYs.forEach(gy => {
      const p1 = w2s(minX, gy), p2 = w2s(maxX, gy);
      svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#eee" stroke-width="1" />`;
  });

  // スラブごとの亀甲分割（ネイティブデータの参照）
  (fd.slabs || []).forEach(slab => {
      if (!slab.nodeIds || slab.nodeIds.length < 3) return;
      
      const pts = slab.nodeIds.map(nid => fd.nodes[nid]).filter(Boolean);
      if (pts.length < 3) return;

      // スラブ外形の描画
      let outlineD = `M ${w2s(pts[0].x, pts[0].y).x} ${w2s(pts[0].x, pts[0].y).y}`;
      for (let i = 1; i < pts.length; i++) {
          const p = w2s(pts[i].x, pts[i].y);
          outlineD += ` L ${p.x} ${p.y}`;
      }
      outlineD += " Z";
      svg += `<path d="${outlineD}" fill="none" stroke="#2c3e50" stroke-width="2" />`;

      // 💡 正確な分割ポリゴンデータ（tributaryPolygons）を取得。なければ計算。
      if (!slab.tributaryPolygons || slab.tributaryPolygons.length === 0) {
          if (typeof window.calculateSlabTributary === 'function') {
              window.calculateSlabTributary(slab, fd.nodes, fd.beams || []);
          }
      }

      const tribPolys = slab.tributaryPolygons;
      if (tribPolys && tribPolys.length > 0) {
          tribPolys.forEach((poly, idx) => {
              if (!poly || poly.length < 3) return;

              // 分割領域の描画（破線）
              const startP = w2s(poly[0].x, poly[0].y);
              let polyD = `M ${startP.x} ${startP.y}`;
              for (let i = 1; i < poly.length; i++) {
                  const p = w2s(poly[i].x, poly[i].y);
                  polyD += ` L ${p.x} ${p.y}`;
              }
              polyD += " Z";
              svg += `<path d="${polyD}" fill="none" stroke="#7f8c8d" stroke-width="1" stroke-dasharray="2,2" />`;
              
              // 図心（重心）の計算
              let cx = 0, cy = 0;
              poly.forEach(p => { cx += p.x; cy += p.y; });
              cx /= poly.length;
              cy /= poly.length;
              const sp = w2s(cx, cy);
              
              // 負担面積 A と 負担幅 B の取得
              const A = (slab.edgeAreas && slab.edgeAreas[idx]) ? slab.edgeAreas[idx] : 0;
              const B = (slab.edgeLs && slab.edgeLs[idx]) ? slab.edgeLs[idx] : 0;
              
              if (A > 0) {
                  svg += `<text x="${sp.x}" y="${sp.y - 7}" font-size="11" fill="#2980b9" font-weight="bold" text-anchor="middle">A=${A.toFixed(3)}㎡</text>`;
                  svg += `<text x="${sp.x}" y="${sp.y + 7}" font-size="11" fill="#c0392b" font-weight="bold" text-anchor="middle">B=${B.toFixed(3)}m</text>`;
              }
          });
      }
  });

  svg += `</svg>`;
  return svg;
}
/**
 * 基礎梁の応力図 SVG を生成する (操作画面の Canvas と完全に同期した2段構成)
 */
export function generateSingleBeamNMQStressSvg(beam) {
  const fd = floorData['1'];
  if (!fd || !window.calculateFoundationHorizontalStressData) return '';
  const data = window.calculateFoundationHorizontalStressData(beam, fd);
  if (!data) return '';

  const { points, resL, resR, totalL } = data;
  const svgW = 1000;
  const svgH = 1100; // 3段化に伴い高さを拡大
  const marginX = 80;
  const marginY = 40;
  const plotW = svgW - marginX * 2;
  const scaleX = plotW / (totalL || 1);

  let svg = `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; font-family: sans-serif; border: 1px solid #ddd; margin-bottom: 20px; max-width: 1000px; display: block; margin-left: auto; margin-right: auto;">`;

  const drawDiagramSet = (yTop, results, groupTitle) => {
    const layerH = 140; // 1つの図面あたりの高さ
    const spacing = 20; // 図面間の余白
    
    // グループタイトル
    svg += `<text x="${marginX}" y="${yTop - 15}" font-size="14" fill="#000" font-weight="bold">${groupTitle}</text>`;

    const drawCommon = (yCenter, title) => {
      // 通り芯（全レイヤー共通）
      points.forEach(p => {
        const x = marginX + p.dist * scaleX;
        svg += `<line x1="${x}" y1="${yCenter - layerH/2}" x2="${x}" y2="${yCenter + layerH/2}" stroke="#eee" stroke-width="1" stroke-dasharray="2,2" />`;
      });
      // 基準線
      svg += `<line x1="${marginX}" y1="${yCenter}" x2="${marginX + plotW}" y2="${yCenter}" stroke="#000" stroke-width="1.5" />`;
      svg += `<text x="${marginX - 10}" y="${yCenter + 4}" font-size="11" fill="#666" text-anchor="end">${title}</text>`;

      // 通り芯名（最下段のみでも良いが、各段にある方が見やすい）
      points.forEach(p => {
        const x = marginX + p.dist * scaleX;
        svg += `<text x="${x}" y="${yCenter + layerH/2 - 5}" font-size="9" fill="#999" text-anchor="middle">${p.id}</text>`;
      });
    };

    // 1. 短期軸力図・反力図 (N, R)
    const yN = yTop + layerH/2;
    drawCommon(yN, "N/R");
    let maxF = Math.max(...results.map(r => Math.max(Math.abs(r.Td), Math.abs(r.R))), 0.1);
    const scaleF = (layerH * 0.3) / maxF;

    points.forEach((p, i) => {
      const x = marginX + p.dist * scaleX;
      const N = results[i].Td || 0;
      const R = results[i].R || 0;
      const drawArrow = (val, yBase, color, labelPrefix) => {
        if (Math.abs(val) < 0.01) return;
        const len = Math.max(Math.abs(val) * scaleF, 15);
        const isUp = val > 0;
        const yTip = isUp ? yBase - len : yBase + len;
        const headDir = isUp ? 1 : -1;
        svg += `<line x1="${x}" y1="${yBase}" x2="${x}" y2="${yTip}" stroke="${color}" stroke-width="2" />`;
        svg += `<path d="M ${x-4} ${yTip + 6*headDir} L ${x} ${yTip} L ${x+4} ${yTip + 6*headDir}" fill="none" stroke="${color}" stroke-width="2" />`;
        svg += `<text x="${x + 6}" y="${yTip}" font-size="9" fill="${color}" font-weight="bold">${labelPrefix}:${val.toFixed(2)}</text>`;
      };
      drawArrow(N, yN, "#e67e22", "N"); // 軸力(橙)
      drawArrow(R, yN, "#2ecc71", "R"); // 反力(緑)
    });

    // 2. M図 (曲げモーメント)
    const yM = yTop + layerH + layerH/2 + spacing;
    drawCommon(yM, "M");
    let maxM = Math.max(...results.map(r => Math.abs(r.M_f)), 0.1);
    const scaleM = (layerH * 0.35) / maxM;
    let mPath = "";
    points.forEach((p, i) => {
      const x = marginX + p.dist * scaleX;
      const y = yM + results[i].M_f * scaleM; // 下向き正
      if (i === 0) mPath = `M ${x} ${y}`; else mPath += ` L ${x} ${y}`;
      if (Math.abs(results[i].M_f) > 0.1) {
        svg += `<text x="${x}" y="${y > yM ? y + 10 : y - 4}" font-size="9" fill="#d4ac0d" text-anchor="middle" font-weight="bold">${results[i].M_f.toFixed(2)}</text>`;
      }
    });
    svg += `<path d="${mPath}" fill="none" stroke="#f1c40f" stroke-width="2" />`;

    // 3. Q図 (せん断力)
    const yQ = yTop + (layerH + spacing) * 2 + layerH/2;
    drawCommon(yQ, "Q");
    let maxQ = Math.max(...results.map(r => Math.abs(r.Qe)), 0.1);
    const scaleQ = (layerH * 0.35) / maxQ;
    let qPath = "";
    points.forEach((p, i) => {
      const x = marginX + p.dist * scaleX;
      const qy = yQ - results[i].Qe * scaleQ;
      if (i === 0) {
        qPath = `M ${x} ${yQ} L ${x} ${qy}`;
      } else {
        const prevX = marginX + points[i-1].dist * scaleX;
        const prevQy = yQ - results[i-1].Qe * scaleQ;
        qPath += ` L ${x} ${prevQy} L ${x} ${qy}`;
      }
      if (i === points.length - 1) qPath += ` L ${x} ${yQ}`;
      if (Math.abs(results[i].Qe) > 0.1) {
        svg += `<text x="${x + (i===0?5:-5)}" y="${qy - 5}" font-size="9" fill="#2980b9" text-anchor="${i===0?'start':'end'}" font-weight="bold">${results[i].Qe.toFixed(2)}</text>`;
      }
    });
    svg += `<path d="${qPath}" fill="none" stroke="#3498db" stroke-width="1.5" />`;
  };

  // 左加力と右加力のセットを描画
  const groupH = 500;
  drawDiagramSet(marginY + 30, resL, '【左加力時の応力状態 (L)】');
  drawDiagramSet(marginY + groupH + 30, resR, '【右加力時の応力状態 (R)】');

  // 凡例
  svg += `<rect x="${svgW - 200}" y="10" width="180" height="75" fill="rgba(255,255,255,0.8)" stroke="#ddd" />`;
  svg += `<text x="${svgW - 190}" y="28" font-size="11" fill="#e67e22" font-weight="bold">■ N:短期軸力 (kN)</text>`;
  svg += `<text x="${svgW - 190}" y="43" font-size="11" fill="#2ecc71" font-weight="bold">■ R:地盤反力 (kN)</text>`;
  svg += `<text x="${svgW - 190}" y="58" font-size="11" fill="#f1c40f" font-weight="bold">■ M:曲げモーメント (kN·m)</text>`;
  svg += `<text x="${svgW - 190}" y="73" font-size="11" fill="#3498db" font-weight="bold">■ Q:せん断力 (kN)</text>`;

  svg += `</svg>`;
  return svg;
}

/**
 * 単独の基礎スラブに対する詳細計算表 (HTML) を生成する
 */
export function generateSingleSlabCalcHtml(sl, fd) {
    if (!sl) return '';

    // 💡 断面検定データの一元管理参照
    if (!sl.aijData && typeof window.calculateAndSetSlabAIJStress === 'function') {
        window.calculateAndSetSlabAIJStress(sl, fd.nodes);
    }
    const data = sl.aijData || {};

    const color_s = (data.ratioX > 1.0) ? "#e74c3c" : "#333";
    const color_l = (data.ratioY > 1.0) ? "#e74c3c" : "#333";

    return `
      <style>
        .calc-container { background: #fff; padding:20px; border:1px solid #eee; color: #000; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .calc-section-title { margin: 20px 0 10px 0; font-size:15px; color:#2c3e50; border-bottom:2px solid #2ecc71; padding-bottom:5px; }
        .calc-section-title:first-child { margin-top: 0; }
        .calc-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; background: white; }
        .calc-table th, .calc-table td { border: 1px solid #ced4da; padding: 10px 12px; text-align: left; color:#000; }
        .calc-table th { background: #f8f9fa; width: 25%; font-weight:bold; }
        .calc-status { font-weight: bold; font-size: 14px; }
      </style>
      <div class="calc-container" style="page-break-inside: avoid;">
        <h3 class="calc-section-title">🔍 [1] 設計条件</h3>
        <table class="calc-table">
          <tr><th>スラブ厚 (t)</th><td>${data.t || 0} mm</td><th>有効高 (d)</th><td>${((data.t||0)-(data.dt||0)).toFixed(1)} mm</td></tr>
          <tr><th>基準強度 (Ft)</th><td>${data.ft || 0} kN/m²</td><th>単位荷重 (w)</th><td>${(data.w||0).toFixed(2)} kN/m²</td></tr>
        </table>

        <h3 class="calc-section-title">🔍 [2] 応力算定</h3>
        <table class="calc-table">
          <tr><th>短辺スパン (lx)</th><td>${(data.lx||0).toFixed(3)} m</td><th>長辺スパン (ly)</th><td>${(data.ly||0).toFixed(3)} m</td></tr>
          <tr><th>辺長比 (λ=ly/lx)</th><td>${(data.lambda||0).toFixed(3)}</td><th>支持条件</th><td>${data.cond || ''}</td></tr>
          <tr>
            <th>${data.shortLabel} モーメント (M)</th><td>端部: ${(data.Mx1||0).toFixed(2)} / 中央: ${(data.Mx2||0).toFixed(2)} <small>kN・m</small></td>
            <th>${data.longLabel} モーメント (M)</th><td>端部: ${(data.My1||0).toFixed(2)} / 中央: ${(data.My2||0).toFixed(2)} <small>kN・m</small></td>
          </tr>
        </table>

        <h3 class="calc-section-title">🔍 [3] 断面検定 (必要鉄筋量 at vs 現行配筋量 At)</h3>
        <table class="calc-table">
          <thead>
            <tr style="background: #e9ecef;">
              <th style="width:20%;">検討区分</th>
              <th style="width:20%;">必要 at <small>(mm²/m)</small></th>
              <th style="width:30%;">現行 At <small>(mm²/m)</small> (<span style="color:#8e44ad;">${data.shortLabel}:${data.sR}@${data.sP} / ${data.longLabel}:${data.lR}@${data.lP}</span>)</th>
              <th style="width:15%;">検定比</th>
              <th style="width:15%;">最終判定</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${data.shortLabel}方向</td>
              <td>${(data.reqAtX||0).toFixed(1)}</td>
              <td>${(data.actualAtX||0).toFixed(1)}</td>
              <td style="color:${color_s};" class="calc-status">${(data.ratioX||0).toFixed(3)}</td>
              <td style="color:${color_s === '#333' ? '#27ae60' : color_s};" class="calc-status">${data.ratioX <= 1.0 ? 'OK' : 'NG'}</td>
            </tr>
            <tr>
              <td>${data.longLabel}方向</td>
              <td>${(data.reqAtY||0).toFixed(1)}</td>
              <td>${(data.actualAtY||0).toFixed(1)}</td>
              <td style="color:${color_l};" class="calc-status">${(data.ratioY||0).toFixed(3)}</td>
              <td style="color:${color_l === '#333' ? '#27ae60' : color_l};" class="calc-status">${data.ratioY <= 1.0 ? 'OK' : 'NG'}</td>
            </tr>
          </tbody>
        </table>
        <div style="font-size:11px; color:#6c757d; text-align:right;">※計算式: AIJ略算式 (C・w・lx²) 準拠 / 有効せい d=${((data.t||0)-(data.dt||0)).toFixed(1)}mm / j=7/8d</div>
      </div>
    `;
}



/**
 * 水平構面等の等価矩形を算出・描画する SVG 関数 (数学的正当性を保証)
 */
export function generateDiaphragmEquivalentSvg(dia, fd, direction) {
  if (!dia || !fd || !fd.nodes) return '';
  const pts = (dia.nodeIds || []).map(nid => fd.nodes[nid]).filter(Boolean);
  if (pts.length < 3) return '';

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  pts.forEach(p => { 
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });

  const bW = maxX - minX, bH = maxY - minY;
  const padding = 20; const svgW = 200; const svgH = 200;
  const scale = Math.min((svgW - padding * 2) / (bW || 1000), (svgH - padding * 2) / (bH || 1000));
  
  const tx = (x) => padding + (x - minX) * scale;
  const ty = (y) => svgH - padding - (y - minY) * scale;

  let svg = `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="background:#fff;">`;
  
  // 実形状
  let d = `M ${tx(pts[0].x)} ${ty(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${tx(pts[i].x)} ${ty(pts[i].y)}`;
  d += ' Z';
  svg += `<path d="${d}" fill="rgba(0,0,0,0.05)" stroke="#666" stroke-width="1" />`;

  const S = dia.area || (bW * bH / 1000000);
  if (direction === 'X') {
    const B = dia.BBox_Y * 1000; 
    const L = (S / (dia.BBox_Y || 0.1)) * 1000;
    // X方向検討: 端部(minX, minY)から、幅B(Y方向)、奥行L(X方向)
    svg += `<rect x="${tx(minX)}" y="${ty(minY) - B * scale}" width="${L * scale}" height="${B * scale}" fill="none" stroke="#3498db" stroke-width="2" stroke-dasharray="4,4" />`;
  } else {
    const B = dia.BBox_X * 1000;
    const L = (S / (dia.BBox_X || 0.1)) * 1000;
    // Y方向検討: 端部(minX, minY)から、幅B(X方向)、奥行L(Y方向)
    svg += `<rect x="${tx(minX)}" y="${ty(minY) - L * scale}" width="${B * scale}" height="${L * scale}" fill="none" stroke="#2ecc71" stroke-width="2" stroke-dasharray="4,4" />`;
  }
  svg += `</svg>`;
  return svg;
}

/**
 * 金物名の記号化ロジック (日本語排除)
 */
export const makeShortName = (name) => {
    if (!name || name === '対象外' || name === '不要' || name.includes('標準')) return '';
    const n = name.toUpperCase();
    if (n.includes('CP-L') || n.includes('CP・L')) return 'L';
    if (n.includes('CP-T') || n.includes('CP・T')) return 'T';
    if (n.includes('VP')) return 'V';
    if (n.includes('SB-F2') || n.includes('SB・F2')) return 'Is';
    if (n.includes('SB-F') || n.includes('SB・F')) return 'Ps';
    if (n.includes('HD-B10')) return '2';
    if (n.includes('HD-B15×2') || n.includes('HD-B15X2') || n.includes('15KNホールダウン金物×2')) return '32';
    if (n.includes('HD-B15')) return '3';
    if (n.includes('HD-B20')) return '4';
    if (n.includes('HD-B25')) return '5';
    if (n.includes('U35')) return 'U3';
    if (n.includes('HI43')) return 'H4';
    if (n.includes('HI68')) return '68';
    if (n.includes('U25')) return '25';
    return name.substring(0, 2).replace(/[^\x00-\x7F]/g, '');
};

/**
 * 金物配置図の生成 (統合表示・レイヤー制限制御)
 */
/**
 * 金物配置図の生成 (統合表示・レイヤー制限制御)
 * @param {string} floorKey 
 * @param {object} fd 
 * @param {object} unifiedBbox - 共通描画範囲（オプション）
 */
export function generateHardwarePlanSvg(floorKey, fd, unifiedBbox = null) {
  if (!fd || !fd.nodes) return {svg:''};
  
  const bbox = unifiedBbox || getFloorBoundingBox(fd);
  const minX = bbox.minX, maxX = bbox.maxX, minY = bbox.minY, maxY = bbox.maxY;

  const pad = 100; const svgW = 600; const scale = Math.min((svgW-pad*2)/(bbox.width||100), 600/(bbox.height||100));
  const svgH = (bbox.height)*scale + pad*2;
  const w2s = (x,y) => ({ x: pad+(x-minX)*scale, y: svgH-pad-(y-minY)*scale });

  const gridX = new Set();
  const gridY = new Set();
  const diagAxes = [];
  (fd.columns || []).forEach(c => {
      const n = fd.nodes[c.nodeIndex];
      if (n) { gridX.add(Math.round(n.x)); gridY.add(Math.round(n.y)); }
  });
  (fd.walls || []).forEach(w => {
      const n1 = fd.nodes[w.n1], n2 = fd.nodes[w.n2];
      if (n1) { gridX.add(Math.round(n1.x)); gridY.add(Math.round(n1.y)); }
      if (n2) { gridX.add(Math.round(n2.x)); gridY.add(Math.round(n2.y)); }
      const modAngle = Math.abs((w.angle || 0) % 90);
      if (modAngle > 0.1 && modAngle < 89.9 && n1 && n2) {
          diagAxes.push({ n1: {x:n1.x, y:n1.y}, n2: {x:n2.x, y:n2.y}, angle: w.angle, axisName: w.axisName || '' });
      }
  });

  const sortedX = Array.from(gridX).sort((a, b) => a - b);
  const sortedY = Array.from(gridY).sort((a, b) => a - b);

  let bufGrid = "";
  let bufWalls = "";
  let bufEmptyPosts = "";
  let bufHardwarePosts = "";

  // 1. 直交背景グリッドの描画
  sortedX.forEach((x, idx) => {
      const p1 = w2s(x, minY), p2 = w2s(x, maxY);
      bufGrid += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#eeeeee" stroke-width="1" />`;
      bufGrid += `<text x="${p1.x}" y="${p2.y - 8}" font-size="10" fill="#999" text-anchor="middle">X${idx+1}</text>`;
  });
  sortedY.forEach((y, idx) => {
      const p1 = w2s(minX, y), p2 = w2s(maxX, y);
      bufGrid += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#eeeeee" stroke-width="1" />`;
      bufGrid += `<text x="${p1.x - 22}" y="${p1.y + 4}" font-size="10" fill="#999" text-anchor="end">Y${idx+1}</text>`;
  });

  // 2. 斜め軸（通り芯）および符号の描画
  diagAxes.forEach(ax => {
      const rad = ax.angle * Math.PI / 180;
      const len = Math.max(maxX - minX, maxY - minY) * 1.5;
      const dx = Math.cos(rad) * len, dy = Math.sin(rad) * len;
      // 基準点を計算（n1とn2の中点）
      const center = { x: (ax.n1.x + ax.n2.x) / 2, y: (ax.n1.y + ax.n2.y) / 2 };
      const p1 = w2s(center.x - dx, center.y - dy), p2 = w2s(center.x + dx, center.y + dy);
      bufGrid += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#eeeeee" stroke-width="1" stroke-dasharray="4,4" />`;
      
      // 斜め符号を壁の端点から少し離れた位置に配置
      const farNode = (ax.n1.x > ax.n2.x || (ax.n1.x === ax.n2.x && ax.n1.y > ax.n2.y)) ? ax.n1 : ax.n2;
      const offsetLen = 30 / scale; // 画面上の30pxをワールド座標系に換算
      const ox = Math.cos(rad) * offsetLen, oy = Math.sin(rad) * offsetLen;
      const pLabel = w2s(farNode.x + ox, farNode.y + oy);
      bufGrid += `<text x="${pLabel.x}" y="${pLabel.y}" font-size="10" fill="#999" transform="rotate(${ax.angle}, ${pLabel.x}, ${pLabel.y})">${ax.axisName}</text>`;
  });

  // 3. 壁要素の描画
  (fd.walls || []).forEach(w => {
      const n1 = fd.nodes[w.n1], n2 = fd.nodes[w.n2]; if(!n1||!n2)return;
      const p1 = w2s(n1.x,n1.y), p2 = w2s(n2.x,n2.y);
      bufWalls += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#000" stroke-width="2" />`;
  });

  // 4. 柱の描画処理（第3章と等価な判定ロジック）
  (fd.columns || []).forEach((p, idx) => {
      const n = fd.nodes[p.nodeIndex]; if(!n) return;
      const pos = w2s(n.x, n.y);
      
      let tName = '', bName = '';
      // 重要：第3章と同じくインデックス idx を渡して計算結果を取得
      const res = window.calculateColumnT ? window.calculateColumnT(idx, fd, floorKey) : null;
      
      console.log("[Debug 4th Chap] Post data:", p);
      console.log("[Debug 4th Chap] Calc result for idx", idx, ":", res);

      if (res && res.cases) {
          res.cases.forEach(c => {
              const tm = c.topMetal?.name;
              const bm = c.baseMetal?.name;
              // 不要、対象外、標準などを弾き、有効な金物名だけを拾う
              const isRealHw = (m) => m && m !== '-' && !m.includes('不要') && !m.includes('対象外') && !m.includes('標準');
              
              if (isRealHw(tm)) tName = tm;
              if (isRealHw(bm)) bName = bm;
          });
      }

      const shortT = tName ? (window.makeShortName ? window.makeShortName(tName) : (typeof makeShortName === 'function' ? makeShortName(tName) : tName)) : '';
      const shortB = bName ? (window.makeShortName ? window.makeShortName(bName) : (typeof makeShortName === 'function' ? makeShortName(bName) : bName)) : '';

      const hasHardware = (shortT !== '' || shortB !== '');

      if (hasHardware) {
          // 金物ありの柱（強調表示・最前面）
          bufHardwarePosts += `<rect x="${pos.x - 7.2}" y="${pos.y - 7.2}" width="14.4" height="14.4" fill="#fff9c4" stroke="#e67e22" stroke-width="2" />`;
          if (shortT) {
              bufHardwarePosts += `<text x="${pos.x}" y="${pos.y - 0.6}" font-size="9" fill="#000" text-anchor="middle" font-weight="bold">${shortT}</text>`;
          }
          if (shortB) {
              bufHardwarePosts += `<text x="${pos.x}" y="${pos.y + 6.0}" font-size="9" fill="#000" text-anchor="middle" font-weight="bold">${shortB}</text>`;
          }
      } else {
          // 金物なしの柱（背景側）
          bufEmptyPosts += `<rect x="${pos.x - 6}" y="${pos.y - 6}" width="12" height="12" fill="#fff" stroke="#ccc" stroke-width="1" />`;
      }
  });

  const svgOpen = `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; font-family: sans-serif; border: 1px solid #ddd; max-height: 1000px; width: 100%; max-width: 1600px; margin: 0 auto; display: block;">`;
  const finalSvg = svgOpen + bufGrid + bufWalls + bufEmptyPosts + bufHardwarePosts + `</svg>`;
  let lHtml = '';
  return { svg: finalSvg, legendHtml: lHtml };
}

// グローバル登録（HTMLのonclickから呼び出すため必須）
window.showCalculationReport = showCalculationReport;

// 過去の依存関係で必要な場合があるため、以下も存在すれば登録しておく
if (typeof getAxesToReport === 'function') window.getAxesToReport = getAxesToReport;
if (typeof generateEnlargedAxialDiagramSvg === 'function') window.generateEnlargedAxialDiagramSvg = generateEnlargedAxialDiagramSvg;
if (typeof generateHardwarePlanSvg === 'function') window.generateHardwarePlanSvg = generateHardwarePlanSvg;
if (typeof generateFoundationReactionSvg === 'function') window.generateFoundationReactionSvg = generateFoundationReactionSvg;
if (typeof generateSingleBeamStressSvg === 'function') window.generateSingleBeamStressSvg = generateSingleBeamStressSvg;
if (typeof generateSingleBeamNMQStressSvg === 'function') window.generateSingleBeamNMQStressSvg = generateSingleBeamNMQStressSvg;
if (typeof generateFoundationTributarySvg === 'function') window.generateFoundationTributarySvg = generateFoundationTributarySvg;
if (typeof generateSingleSlabCalcHtml === 'function') window.generateSingleSlabCalcHtml = generateSingleSlabCalcHtml;
if (typeof generateDiaphragmEquivalentSvg === 'function') window.generateDiaphragmEquivalentSvg = generateDiaphragmEquivalentSvg;
if (typeof makeShortName === 'function') window.makeShortName = makeShortName;
