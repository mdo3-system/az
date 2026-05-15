import { floorData, currentFloor, FLOORS, dxfVAxes, dxfHAxes, dxfSkewedAxes } from './foundation_cad.js';
import { ANCHOR_BOLT_MASTER } from './foundation_calc.js';

/**
 * 構造計算書（HTMLレポート）の生成と表示
 */
export const showCalculationReport = function() {
  const reportContent = document.getElementById('reportContent');
  if (!reportContent) return;

  // 0. 全階層共通の描画範囲（スケール）を確定させる
  const relevantFloors = ['PH', 'R', '3', '2', '1'];
  const allFloorsList = relevantFloors.map(f => (window.allFloorData && window.allFloorData[f]) || (window.floorData && window.floorData[f]) || floorData[f]).filter(Boolean);
  const globalBbox = window.getGlobalBoundingBox ? window.getGlobalBoundingBox(allFloorsList) : { minX: 0, maxX: 1000, minY: 0, maxY: 1000, width: 1000, height: 1000 };

  // 1. 斜め壁の換算倍率算定詳細 (第1章用集計)
  const allFloorData = window.floorData || floorData || {};
  const chap1Html = window.generateDiagonalWallSummaryHtml ? window.generateDiagonalWallSummaryHtml(allFloorData) : '';
  // 2. 水平構面等価面積算定 (第2章用)
  const chap2Html = window.generateDiaphragmSummaryHtml ? window.generateDiaphragmSummaryHtml(allFloorData) : '';
  // 3. 水平構面検定 (斜め軸回転モデル含む) (第3章用)
  const chap3Html = window.generateDiaphragmCheckReportHtml ? window.generateDiaphragmCheckReportHtml(allFloorData) : '';

  if (typeof window.syncSlabDataToBeams === 'function') {
    // 💡 BUGFIX: 閲覧中の階に関わらず、基礎(1F)のデータを確実に同期させる
    window.syncSlabDataToBeams(allFloorData['1']);
  }

  let allTablesHtml = `
    <div style="margin-top: 60px;">
    </div>
  `;

  // 💡 BUGFIX: 特定の階だけでなく、建物全体の全階層を対象にループする
  const reportAxes = Array.from(window.getAxesToReport ? window.getAxesToReport() : getAxesToReport());
  const floorsList = ['PH', 'R', '3', '2', '1'];

  reportAxes.forEach(axisName => {
    allTablesHtml += window.generateColumnTensionReportHtml ? window.generateColumnTensionReportHtml(axisName, allFloorData, dxfVAxes, dxfHAxes) : '';
  });

  // 💡 BUGFIX: 後続のアンカーボルト・基礎梁計算（常に1階）のために、変数 fk と fd を1F固定で再定義する
  const fk = '1';
  const fd = (typeof allFloorData !== 'undefined' && allFloorData[fk]) || 
             (typeof window.floorData !== 'undefined' && window.floorData[fk]) || 
             (typeof floorData !== 'undefined' ? floorData[fk] : null);
             
  if (!fd) {
      console.warn('基礎階のデータが見つかりません。');
      return;
  }

  // 5-9 アンカーボルトと土台の検定 HTML
  const anchorTableHtml = window.generateAnchorBoltReportHtml ? window.generateAnchorBoltReportHtml(fd, ANCHOR_BOLT_MASTER) : '';

  const footerHtml = `
    <div style="font-size: 10px; color: #333; line-height: 1.6; font-family: 'MS Gothic', 'Courier New', monospace; border: 1px solid #000; padding: 15px; background: #fff; page-break-inside: avoid; margin-top: 30px;">
      <div style="font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 10px; font-size: 12px; color: #000;">
        【 5-7 柱頭柱脚の引張耐力の検定 (N値計算法準拠) 注記 】
      </div>
      <div style="display: flex; gap: 40px; justify-content: space-between;">
        <div style="flex: 1;">
          <strong style="color: #000; border-bottom: 1px solid #ccc;">■ 算定式</strong><br>
          ・T (kN) = Ni + 上階の Ni - Nw<br>
          ・Ni = (ΣΔQair×Hi - ΣΔQail×Hi) × Bi &nbsp; <span style="color:#666;">(X方向:左加力 / Y方向:下加力)</span><br>
          ・Ni = (ΣΔQail×Hi - ΣΔQair×Hi) × Bi &nbsp; <span style="color:#666;">(X方向:右加力 / Y方向:上加力)</span><br>
          ・ΔQ = 1.96 × 壁倍率 <span style="color:#666;">(kN/m)</span>
        </div>
        <div style="flex: 1;">
          <strong style="color: #000; border-bottom: 1px solid #ccc;">■ 記号の説明</strong><br>
          ・ΔQail / ΔQair: 柱の左側(下側) / 右側(上側)の耐力壁の短期許容せん断耐力<br>
          ・Hi: 階高 (m)<br>
          ・Bi: 補正係数 (出隅柱脚: 0.8 / その他: 0.5)<br>
          ・Nw: 柱の有効軸力 (長期鉛直荷重による圧縮力)<br>
          ・Ta: 金物許容耐力 (カタログ値 － 0.5kN の安全余裕を考慮)
        </div>
      </div>
      <div style="margin-top: 12px; border-top: 1px dashed #bbb; padding-top: 6px; font-size: 9px; color: #555; text-align: right;">
        ※本計算書は、壁プロパティで「通り名」が設定された軸のみを抽出して出力しています。 | 解析基準日: ${new Date().toLocaleDateString()}
      </div>
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
        section, .report-section, .page-break-avoid, .diagram-container, .axis-group, .beam-set { 
          page-break-inside: avoid !important; 
          margin-bottom: 20px; 
          display: block; 
          clear: both;
        }

        /* 章ごとの改ページを明示的に指定 */
        .chapter-section, #chapter4, #section5-9, #section7-1, #section7-2, #section7-3 { 
          page-break-before: always !important; 
        }

        h2, h3 { page-break-after: avoid; color: #000 !important; }
        table { page-break-inside: auto; width: 100% !important; border: 1px solid #000 !important; }
        tr { page-break-inside: avoid; page-break-after: auto; }
        td, th { border: 1px solid #000 !important; color: #000 !important; }

        /* スケール統一に伴うSVGの収まり調整 */
        svg { max-width: 100% !important; height: auto !important; }
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

  const showSkewReport = (window.state?.showSkewReport !== false);
  const navHtml = `
    <div class="no-print" style="position: sticky; top: 0; background: #252a3a; z-index: 1000; border-bottom: 2px solid #5b8afe; padding: 10px; display: flex; flex-wrap: wrap; gap: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); margin-bottom:20px; align-items:center;">
      <div style="display:flex; gap:8px; flex:1;">
        <a href="#chapter1" style="text-decoration: none; color: #fff; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #34495e;">第1章 斜め壁</a>
        <a href="#chapter2" style="text-decoration: none; color: #fff; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #34495e;">第2章 等価面積</a>
        <a href="#chapter3" style="text-decoration: none; color: #fff; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #e67e22; font-weight:bold;">第3章 構面検定</a>
        <a href="#section5-7" style="text-decoration: none; color: #fff; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #34495e;">5-7 引張検定</a>
        <a href="#chapter4" style="text-decoration: none; color: #fff; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #34495e;">第4章 金物伏図</a>
        <a href="#section5-9" style="text-decoration: none; color: #fff; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #34495e;">5-9 アンカー</a>
        <a href="#section7-1" style="text-decoration: none; color: #fff; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #34495e;">7-1 べた基礎</a>
        <a href="#section7-2" style="text-decoration: none; color: #fff; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #34495e;">7-2 基礎梁負担</a>
        <a href="#section7-3" style="text-decoration: none; color: #fff; font-size: 11px; padding: 4px 8px; border-radius: 4px; border: 1px solid #444; background: #e74c3c;">8. 基礎梁断面検定</a>
      </div>
      <div style="background: rgba(255,255,255,0.1); padding: 4px 12px; border-radius: 20px; display: flex; align-items: center; gap: 8px; border: 1px solid rgba(255,255,255,0.2);">
        <label style="color: #fff; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
          <input type="checkbox" ${showSkewReport ? 'checked' : ''} 
                 onchange="window.state.showSkewReport = this.checked; requestAnimationFrame(() => window.showCalculationReport());" 
                 style="cursor: pointer; width: 14px; height: 14px;">
          斜め軸回転モデルを出力する
        </label>
      </div>
    </div>
  `;

  // 各セクションの HTML 生成（モジュール化された関数を呼び出し）
  const section58Html = window.generateHardwarePlanHtml ? window.generateHardwarePlanHtml(allFloorData, globalBbox) : '';
  const section71Html = window.generateFoundationCheckHtml ? window.generateFoundationCheckHtml(fd, globalBbox) : '';
  const section72Html = window.generateTributaryAreaHtml ? window.generateTributaryAreaHtml(fd, globalBbox) : '';
  const section8Html = window.generateFoundationBeamReportHtml ? window.generateFoundationBeamReportHtml(fd) : '';

  // 最終的な計算書 HTML の組み立て
  document.getElementById('reportContent').innerHTML = navHtml + `<div style="width:100%; word-break:break-all;">${(window.premiseHtml || '')}</div>` + printStyles + `
    <div style="padding: 20px; background: #fff;">
      <h1 style="text-align: center; font-size: 24px; border-bottom: 3px double #333; padding-bottom: 10px; margin-bottom: 40px; color: #000; width:100%; word-break:break-all;">平面斜め部別紙計算書</h1>
      ${chap1Html}
      ${chap2Html}
      ${chap3Html}
      <div id="section5-7">
        ${allTablesHtml}
        ${footerHtml}
      </div>
      ${section58Html}
      ${anchorTableHtml}
      ${section71Html}
      ${section72Html}
      ${section8Html}
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

  // 手動で定義された斜め通り芯を明示的に追加 (window経由もチェック)
  const skewedAxes = window.dxfSkewedAxes || dxfSkewedAxes || [];
  skewedAxes.forEach(ax => {
    if (ax.label) reportAxes.add(ax.label);
  });

  const getPriority = (name) => {
    // 1. 斜め通り芯 (dxfSkewedAxes)
    const isSkewed = (window.dxfSkewedAxes || dxfSkewedAxes || []).some(ax => ax.label === name);
    if (isSkewed) return { cat: 0, val: name };

    // 2. X方向通り芯 (dxfVAxes: 垂直線) -> X座標でソート (左から)
    const vAx = (window.dxfVAxes || dxfVAxes || []).find(ax => ax.label === name);
    if (vAx) return { cat: 1, val: vAx.x };

    // 3. Y方向通り芯 (dxfHAxes: 水平線) -> Y座標でソート (下から)
    const hAx = (window.dxfHAxes || dxfHAxes || []).find(ax => ax.label === name);
    if (hAx) return { cat: 2, val: hAx.y };

    // 4. その他
    return { cat: 3, val: name };
  };

  return Array.from(reportAxes).sort((a, b) => {
    const pa = getPriority(a);
    const pb = getPriority(b);
    if (pa.cat !== pb.cat) return pa.cat - pb.cat;
    // 斜め通り芯(0)とその他(3)は名前で数値ソート
    if (pa.cat === 0 || pa.cat === 3) return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    // X方向(1)とY方向(2)は座標値でソート
    return pa.val - pb.val;
  });
}

// Global registrations have been moved to state_manager.js
