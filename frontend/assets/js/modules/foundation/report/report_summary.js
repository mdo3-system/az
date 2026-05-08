/**
 * report/report_summary.js
 * 帳票HTML生成用ファサードモジュール
 */

export { generateDiagonalWallSummaryHtml } from './diagonal_wall.js';
export { generateDiaphragmSummaryHtml } from './diaphragm_summary.js';
export { generateColumnTensionReportHtml } from './column_tension.js';
export { generateAnchorBoltReportHtml } from './anchor_bolt.js';
export { generateHardwarePlanHtml } from './hardware_plan.js';
export { generateFoundationCheckHtml } from './foundation_check.js';
export { generateTributaryAreaHtml } from './tributary_area.js';

import { generateDiaphragmReportHtml } from './report_diaphragm.js';
export { generateDiaphragmReportHtml };

/**
 * 第3章：水平構面の検定 (斜め軸回転モデル含む) HTML を生成する
 */
export const generateDiaphragmCheckReportHtml = window.generateDiaphragmCheckReportHtml = function(allFloorData) {
  return `
    <div id="chapter3" class="chapter-section">
      ${generateDiaphragmReportHtml(allFloorData)}
    </div>
  `;
};
