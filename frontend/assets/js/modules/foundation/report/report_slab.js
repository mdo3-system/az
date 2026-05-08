import { floorData, currentFloor } from '../foundation_cad.js';

/**
 * 単独の基礎スラブに対する詳細計算表 (HTML) を生成する
 */
export const generateSingleSlabCalcHtml = window.generateSingleSlabCalcHtml = function(sl, fd) {
    if (!sl) return '';

    // 断面検定データの一元管理参照
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
          <tr><th>基準強度 (Ft)</th><td>${data.ft || 0} kN/m²</td><th>単位荷重 (w)</th><td>${(data.w||0).toFixed(3)} kN/m²</td></tr>
        </table>

        <h3 class="calc-section-title">🔍 [2] 応力算定</h3>
        <table class="calc-table">
          <tr><th>短辺スパン (lx)</th><td>${(data.lx||0).toFixed(3)} m</td><th>長辺スパン (ly)</th><td>${(data.ly||0).toFixed(3)} m</td></tr>
          <tr><th>辺長比 (λ=ly/lx)</th><td>${(data.lambda||0).toFixed(3)}</td><th>支持条件</th><td>${data.cond || ''}</td></tr>
          <tr>
            <th>${data.shortLabel} モーメント (M)</th><td>端部: ${(data.Mx1||0).toFixed(3)} / 中央: ${(data.Mx2||0).toFixed(3)} <small>kN・m</small></td>
            <th>${data.longLabel} モーメント (M)</th><td>端部: ${(data.My1||0).toFixed(3)} / 中央: ${(data.My2||0).toFixed(3)} <small>kN・m</small></td>
          </tr>
        </table>

        <h3 class="calc-section-title">🔍 [3] 断面検定 (必要 at vs 現行 At)</h3>
        <table class="calc-table">
          <thead>
            <tr style="background: #e9ecef;">
              <th style="width:15%;">方向</th>
              <th style="width:20%;">検討部位</th>
              <th style="width:15%;">必要 at <small>(mm²/m)</small></th>
              <th style="width:25%;">現行 At <small>(mm²/m)</small></th>
              <th style="width:12.5%;">検定比</th>
              <th style="width:12.5%;">判定</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td rowspan="2" style="text-align:center; font-weight:bold; vertical-align:middle;">${data.shortLabel}</td>
              <td>中央 (上端筋)</td>
              <td>${(data.reqAtX_Top||0).toFixed(1)}</td>
              <td>${data.sTR}@${data.sTP} (${(data.actualAtX_Top||0).toFixed(1)})</td>
              <td style="color:${data.ratioX_Top > 1.0 ? "#e74c3c" : "#333"};" class="calc-status">${(data.ratioX_Top||0).toFixed(3)}</td>
              <td style="color:${data.ratioX_Top <= 1.0 ? '#27ae60' : '#e74c3c'}; font-weight:bold;">${data.ratioX_Top <= 1.0 ? 'OK' : 'NG'}</td>
            </tr>
            <tr>
              <td>端部 (下端筋)</td>
              <td>${(data.reqAtX_Bottom||0).toFixed(1)}</td>
              <td>${data.sBR}@${data.sBP} (${(data.actualAtX_Bottom||0).toFixed(1)})</td>
              <td style="color:${data.ratioX_Bottom > 1.0 ? "#e74c3c" : "#333"};" class="calc-status">${(data.ratioX_Bottom||0).toFixed(3)}</td>
              <td style="color:${data.ratioX_Bottom <= 1.0 ? '#27ae60' : '#e74c3c'}; font-weight:bold;">${data.ratioX_Bottom <= 1.0 ? 'OK' : 'NG'}</td>
            </tr>
            <tr>
              <td rowspan="2" style="text-align:center; font-weight:bold; vertical-align:middle;">${data.longLabel}</td>
              <td>中央 (上端筋)</td>
              <td>${(data.reqAtY_Top||0).toFixed(1)}</td>
              <td>${data.lTR}@${data.lTP} (${(data.actualAtY_Top||0).toFixed(1)})</td>
              <td style="color:${data.ratioY_Top > 1.0 ? "#e74c3c" : "#333"};" class="calc-status">${(data.ratioY_Top||0).toFixed(3)}</td>
              <td style="color:${data.ratioY_Top <= 1.0 ? '#27ae60' : '#e74c3c'}; font-weight:bold;">${data.ratioY_Top <= 1.0 ? 'OK' : 'NG'}</td>
            </tr>
            <tr>
              <td>端部 (下端筋)</td>
              <td>${(data.reqAtY_Bottom||0).toFixed(1)}</td>
              <td>${data.lBR}@${data.lBP} (${(data.actualAtY_Bottom||0).toFixed(1)})</td>
              <td style="color:${data.ratioY_Bottom > 1.0 ? "#e74c3c" : "#333"};" class="calc-status">${(data.ratioY_Bottom||0).toFixed(3)}</td>
              <td style="color:${data.ratioY_Bottom <= 1.0 ? '#27ae60' : '#e74c3c'}; font-weight:bold;">${data.ratioY_Bottom <= 1.0 ? 'OK' : 'NG'}</td>
            </tr>
          </tbody>
        </table>
        <div style="font-size:11px; color:#6c757d; text-align:right;">※計算式: AIJ略算式 (C・w・lx²) 準拠 / 有効せい d=${((data.t||0)-(data.dt||0)).toFixed(1)}mm / j=7/8d</div>
      </div>
    `;
};
