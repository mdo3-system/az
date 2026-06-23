import { FLOORS } from '../foundation_cad.js';
import { getAxisReferenceLine, getProjectedPos } from '../rendering/projection_utils.js';

/**
 * report/column_tension.js
 * 5-7 柱頭柱脚の引張耐力の検定 HTML生成モジュール
 */

export const generateColumnTensionReportHtml = function(axisName, allFloorData, dxfVAxes, dxfHAxes) {
  const floorsList = FLOORS;

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
    const refLine = typeof getAxisReferenceLine === 'function' ? getAxisReferenceLine(axisName, allFloorData) : null;
    floorDataObj.columns.forEach((col, idx) => {
      const n = floorDataObj.nodes[col.nodeIndex];
      if (!n) return;

      const walls = (floorDataObj.walls || []).filter(w => (w.n1 === col.nodeIndex || w.n2 === col.nodeIndex) && w.axisName === axisName);
      if (walls.length > 0) {
        colsOnAxis.push({ col, idx });
        return;
      }

      if (gridCoord !== null) {
        const d = isVerticalGrid ? n.x : n.y;
        if (Math.abs(d - gridCoord) < 15) {
          colsOnAxis.push({ col, idx });
          return;
        }
      }

      if (refLine && typeof getProjectedPos === 'function') {
        const { offset } = getProjectedPos(n, refLine);
        if (Math.abs(offset) < 15) {
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

    const normalizedTargetAxis = (axisName || "").replace(/通り$/, "").trim();
    colsOnAxis.forEach(item => {
      const res = (window.calculateColumnT ? window.calculateColumnT(item.idx, floorDataObj, floorKey, allFloorData, FLOORS) : {});
      if (!res || !res.cases) return;
      
      const colNode = floorDataObj.nodes[item.col.nodeIndex];
      const va = (dxfVAxes || []).find(ax => Math.abs(ax.x - colNode.x) < 15);
      const ha = (dxfHAxes || []).find(ax => Math.abs(ax.y - colNode.y) < 15);
      const xLabel = va ? va.label : (item.col.id ? item.col.id.substring(0, item.col.id.indexOf('Y')) : '-');
      const yLabel = ha ? ha.label : (item.col.id ? item.col.id.substring(item.col.id.indexOf('Y')) : '-');
      const coordLabel = `${xLabel}<br>${yLabel}`;

      // 💡 計算エンジンと同じ正規化を行い、完全一致でフィルタリングする
      const axisCases = res.cases.filter(c => {
        const normalizedCaseAxis = (c.axisName || "").replace(/通り$/, "").trim();
        return normalizedCaseAxis === normalizedTargetAxis;
      });
      
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

// Global for legacy support
window.generateColumnTensionReportHtml = generateColumnTensionReportHtml;
