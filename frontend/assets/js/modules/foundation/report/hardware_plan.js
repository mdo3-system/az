/**
 * report/hardware_plan.js
 * 4. 金物配置伏図 (5-8) HTML生成モジュール
 */

export const generateHardwarePlanHtml = function(allFloorData, globalBbox) {
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

// Global for legacy support
window.generateHardwarePlanHtml = generateHardwarePlanHtml;
