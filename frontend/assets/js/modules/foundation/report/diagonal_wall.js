/**
 * report/diagonal_wall.js
 * 第1章：斜め壁換算壁倍率の算定 HTML生成モジュール
 */

export const generateDiagonalWallSummaryHtml = function(allFloorData) {
  let totalMx = 0;
  let totalMy = 0;
  const diagSummary = {}; // axisName + multiplier で集約
  const axisAngles = {}; // 通り芯ごとの代表角度を保持
  
  Object.values(allFloorData || {}).forEach(fd => {
    (fd.walls || []).forEach(w => {
      const m = w.multiplier || 0;
      if (m > 0 && w.multiplier_x !== undefined && w.axisName) {
        const normalizedAngle = ((w.angle % 180) + 180) % 180;
        
        // 垂直・水平（0°, 90°, 180°...）の通常の壁は非表示にする
        const isOrthogonal = Math.abs(normalizedAngle % 90) < 0.01;
        if (isOrthogonal) return;

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
      const unitMx = Math.floor(g.multiplier * Math.pow(Math.sin(rad), 2) * 1000) / 1000;
      const unitMy = Math.floor(g.multiplier * Math.pow(Math.cos(rad), 2) * 1000) / 1000;
      
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

// Global for legacy support
window.generateDiagonalWallSummaryHtml = generateDiagonalWallSummaryHtml;
