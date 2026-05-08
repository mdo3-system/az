/**
 * report/report_diaphragm.js
 * 水平構面検討 帳票HTML生成モジュール
 *
 * 対応モデル:
 *   - 等価置き換えモデル  (showReportEquiv が true の構面)
 *   - 斜め軸回転モデル    (showReportSkew  が true の構面)
 *
 * 呼び出し方:
 *   import { generateDiaphragmReportHtml } from './report_diaphragm.js';
 *   const html = generateDiaphragmReportHtml(allFloorData);
 */

import { calcSkewedDiaphragmModel } from '../core/diaphragm_skew_calc.js';
import { getFloorBelow } from '../foundation_cad.js';

// ── 共通スタイル ────────────────────────────────────────────────────────────
const TD  = 'border:1px solid #333;padding:8px 10px;';
const TH  = `${TD}background:#f0f0f0;font-weight:bold;color:#000;`;
const SEC = 'margin-bottom:30px;page-break-inside:avoid;';

// ── 等価置き換えモデルの帳票 ────────────────────────────────────────────────

function _equivTable(dia) {
  const rows = ['X', 'Y'].map(dir => {
    const isX = dir === 'X';
    const bmax = isX ? (dia.BBox_Y || 0) : (dia.BBox_X || 0);
    const leq  = isX ? (dia.Lx_eq  || 0) : (dia.Ly_eq  || 0);
    const lmax = isX ? (dia.BBox_X || 0) : (dia.BBox_Y || 0);
    const eta  = isX ? (dia.eta_x  || 0) : (dia.eta_y  || 0);
    const lred = isX ? (dia.W_design_x || 0) : (dia.W_design_y || 0);
    const col  = isX ? '#2980b9' : '#27ae60';
    return `<tr>
      <td style="${TD}text-align:center;font-weight:bold;color:${col};">${dir}方向</td>
      <td style="${TD}text-align:right;">${bmax.toFixed(3)}</td>
      <td style="${TD}text-align:right;">${leq.toFixed(3)}</td>
      <td style="${TD}text-align:right;">${lmax.toFixed(3)}</td>
      <td style="${TD}text-align:center;">${eta.toFixed(3)}</td>
      <td style="${TD}text-align:right;font-weight:bold;color:${col};">${lred.toFixed(3)}</td>
    </tr>`;
  }).join('');

  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#000;border:2px solid #333;">
      <thead>
        <tr style="background:#ddd;">
          <th style="${TH}">検討方向</th>
          <th style="${TH}">支持幅 Bmax(m)</th>
          <th style="${TH}">等価奥行 Leq(m)</th>
          <th style="${TH}">最大奥行 Lmax(m)</th>
          <th style="${TH}">形状低減 η</th>
          <th style="${TH}">有効奥行 Lred(m)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── 斜め軸回転モデルの帳票 ──────────────────────────────────────────────────

function _skewDirSection(dirResult, dirLabel, color) {
  // 有効耐力壁線一覧
  const wallLineRows = (dirResult.wallLines || []).map(wl => {
    const mark = wl.isEffective ? '◎' : (wl.judge1 && wl.judge2 ? '○' : '×');
    const markColor = wl.isEffective ? '#27ae60' : '#e74c3c';
    const wallSymbolStr = (wl.wallSymbols || []).join('+') || '-';
    
    return `<tr>
      <td style="${TD}text-align:center;font-weight:bold;">${wl.axisName || '-'}</td>
      <td style="${TD}text-align:center;font-size:10px;">${wallSymbolStr}</td>
      <td style="${TD}text-align:center;">${(wl.pos / 1000).toFixed(2)} m</td>
      <td style="${TD}text-align:right;">${(wl.pa || 0).toFixed(2)}</td>
      <td style="${TD}text-align:right;">${(wl.threshold1 || 0).toFixed(2)}</td>
      <td style="${TD}text-align:center;color:${wl.judge1 ? '#27ae60' : '#e74c3c'};font-weight:bold;">${wl.judge1 ? '○' : '×'}</td>
      <td style="${TD}text-align:center;color:${wl.judge2 ? '#27ae60' : '#e74c3c'};font-weight:bold;">${wl.judge2 ? '○' : '×'}</td>
      <td style="${TD}text-align:center;color:${markColor};font-weight:bold;font-size:16px;font-family:'MS Gothic','Meiryo',sans-serif;">${mark}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="8" style="${TD}color:#999;text-align:center;">耐力壁なし</td></tr>`;

  // 区間検定一覧
  const spanRows = (dirResult.spans || []).map(iv => {
    const okColor = iv.isOK ? '#27ae60' : '#e74c3c';
    const rowBg = iv.isCantilever ? '#fffbf2' : 'transparent';
    const spanLabel = iv.isCantilever ? `<span style="color:#e67e22;font-weight:bold;">${iv.span_l_m.toFixed(3)} (×2)</span>` : iv.span_l_m.toFixed(3);
    return `<tr style="background:${rowBg};">
      <td style="${TD}">${iv.lineALabel} ～ ${iv.lineBLabel}${iv.isCantilever ? ' <small style="color:#d35400;">(外端)</small>' : ''}</td>
      <td style="${TD}text-align:right;">${spanLabel}</td>
      <td style="${TD}text-align:right;">${iv.depth_h_m.toFixed(3)}</td>
      <td style="${TD}text-align:right;">${iv.avgDeltaQa.toFixed(3)}</td>
      <td style="${TD}text-align:right;font-weight:bold;">${((iv.avgDeltaQa || 1.96) * iv.depth_h_m).toFixed(3)}</td>
      <td style="${TD}text-align:center;">${iv.alpha}</td>
      <td style="${TD}text-align:right;">${(iv.QE || 0).toFixed(3)}</td>
      <td style="${TD}text-align:right;">${(iv.QW || 0).toFixed(3)}</td>
      <td style="${TD}text-align:center;font-weight:bold;color:${okColor};">${iv.isOK ? 'OK' : 'NG'}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="9" style="${TD}color:#999;text-align:center;">有効なスパンを算出できませんでした</td></tr>`;

  const overallBadge = dirResult.isOK
    ? '<span style="color:#27ae60;font-weight:bold;font-size:14px;">OK</span>'
    : '<span style="color:#e74c3c;font-weight:bold;font-size:14px;">NG</span>';

  return `
    <div style="margin-bottom:18px;">
      <h5 style="margin:0 0 8px;font-size:13px;color:${color};border-left:4px solid ${color};padding-left:8px;">
        ${dirLabel} 加力検討 &nbsp; ${overallBadge}
      </h5>

      <p style="font-size:11px;font-weight:bold;color:#444;margin:0 0 4px;">① 有効耐力壁線の判定 (Pa基準)</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px;color:#000;border:1px solid #333;margin-bottom:10px;">
        <thead>
          <tr style="background:#eee;">
            <th style="${TH}">軸名</th><th style="${TH}">壁符号</th><th style="${TH}">位置</th><th style="${TH}">Pa(kN)</th><th style="${TH}">判定1</th><th style="${TH}">判定2</th><th style="${TH}">判定3</th><th style="${TH}">有効</th>
          </tr>
        </thead>
        <tbody>${wallLineRows}</tbody>
      </table>

      <p style="font-size:11px;font-weight:bold;color:#444;margin:0 0 4px;">② 地震力・風圧力に対する検定 (ΔQa×h ≥ QE, QW)</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px;color:#000;border:1px solid #333;">
        <thead>
          <tr style="background:#eee;">
            <th style="${TH}">区間</th>
            <th style="${TH}">スパンl</th>
            <th style="${TH}">奥行h</th>
            <th style="${TH}">ΔQa</th>
            <th style="${TH}">ΔQa×h</th>
            <th style="${TH}">α</th>
            <th style="${TH}">QE</th>
            <th style="${TH}">QW</th>
            <th style="${TH}">判定</th>
          </tr>
        </thead>
        <tbody>${spanRows}</tbody>
      </table>
    </div>`;
}

function _skewSection(dia, fd, skewAxes, floorSpecs, currentFloor, allFloorData) {
  const axIdx = dia.skewAxisIndex;
  const ax    = (axIdx !== undefined && axIdx !== null) ? skewAxes[axIdx] : null;
  if (!ax) {
    return `<div style="color:#e74c3c;font-size:12px;margin-bottom:10px;">⚠ 基準軸が未選択です。</div>`;
  }

  // 💡 支持点となる耐力壁は「直下の階」のものを参照する
  const belowKey = getFloorBelow(currentFloor);
  const wallFd = (belowKey && allFloorData[belowKey]) ? allFloorData[belowKey] : null;

  if (!wallFd || !wallFd.walls || wallFd.walls.length === 0) {
    return `<div style="color:#e67e22;font-size:12px;margin-bottom:10px;">直下の階に耐力壁が存在しないため、支持点（耐力壁線）を算出できません。</div>`;
  }

  const result = calcSkewedDiaphragmModel({
    diaphragm: dia,
    allDiaphragms: fd.diaphragms,
    nodes: fd.nodes,
    walls: wallFd.walls,
    wallNodes: wallFd.nodes, // 💡 追加: 下の階の節点を使用
    hasIntermediateWall: dia.hasIntermediateWall || false,
    skewedAxis: ax,
    floorSpecs: floorSpecs,
    floorKey: currentFloor
  });

  if (!result) {
    return `<div style="color:#e74c3c;font-size:12px;margin-bottom:10px;">計算できませんでした（頂点数不足など）。</div>`;
  }

  const overallBadge = result.isOK
    ? '<span style="background:#27ae60;color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;">総合 OK</span>'
    : '<span style="background:#e74c3c;color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;">総合 NG</span>';

  return `
    <div style="background:#f9f6ff;border:1px solid #9b59b6;padding:12px;border-radius:6px;margin-bottom:10px;">
      <div style="font-size:12px;color:#555;margin-bottom:10px;">
        基準軸: <strong>${result.axisLabel}</strong> (θ = ${result.thetaDeg.toFixed(1)}°) &nbsp;
        ΔQa = ${result.deltaQa.toFixed(3)} kN/m &nbsp; ${overallBadge}
      </div>
      ${_skewDirSection(result.xDir, "X'方向", '#2980b9')}
      ${_skewDirSection(result.yDir, "Y'方向", '#27ae60')}
      
      <div style="margin-top:15px; text-align:center; page-break-inside:avoid;">
        <div style="font-size:11px; color:#666; margin-bottom:5px;">【検討モデル概念図：${result.axisLabel}軸基準】</div>
        ${_skewDiaphragmSvg(dia, fd, result)}
      </div>
    </div>`;
}

/**
 * 斜め軸回転モデルの簡易SVG図面を生成
 */
function _skewDiaphragmSvg(dia, fd, result) {
  if (!dia || !fd || !fd.nodes || !result) return '';
  const pts = (dia.nodeIds || []).map(nid => fd.nodes[nid]).filter(n => n && typeof n.x === 'number' && typeof n.y === 'number');
  if (pts.length < 3) return '';

  const theta = (typeof result.thetaRad === 'number' && !isNaN(result.thetaRad)) ? result.thetaRad : 0;
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const rotPts = pts.map(p => ({
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos
  }));

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  rotPts.forEach(p => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });

  const { outerMinX, outerMaxX, outerMinY, outerMaxY } = result;
  const bW = Math.max(1, maxX - minX), bH = Math.max(1, maxY - minY);
  const pad = 120, svgW = 750, svgH = 550; // 💡 十分な余白を確保
  const scale = Math.min((svgW - pad * 2) / bW, (svgH - pad * 2) / bH, 50);

  const tx = (x) => pad + (x - minX) * scale + (svgW - pad * 2 - bW * scale) / 2;
  const ty = (y) => svgH - pad - (y - minY) * scale; 

  let svg = `<svg width="100%" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="background:#fff; border:1px solid #eee; border-radius:4px; font-family:sans-serif;">`;
  
  // 1. 構面ポリゴン
  let polyD = `M ${tx(rotPts[0].x)} ${ty(rotPts[0].y)}`;
  rotPts.forEach((p, i) => { if(i > 0) polyD += ` L ${tx(p.x)} ${ty(p.y)}`; });
  polyD += ' Z';
  svg += `<path d="${polyD}" fill="#f8f9fa" stroke="#ccc" stroke-width="1.2" />`;

  // 2. 耐力壁線の描画
  const drawLines = (lines, isVertical) => {
    (lines || []).forEach(wl => {
        const symbol = wl.isExterior ? "〇" : (wl.isEffective ? "◎" : "×");
        const color = wl.isExterior ? "#00d4ff" : (wl.isEffective ? "#27ae60" : "#ff4444");
        const labelText = wl.label || "";

        if (isVertical) {
            const posX = tx(wl.pos);
            const yStart = ty(outerMinY - 1500), yEnd = ty(outerMaxY + 1500);
            svg += `<line x1="${posX}" y1="${yStart}" x2="${posX}" y2="${yEnd}" stroke="${color}" stroke-width="${wl.isEffective ? 1.5 : 0.8}" stroke-dasharray="10,2,2,2" />`;
            // 上端にラベル (yEndが上)
            svg += `<text x="${posX}" y="${yEnd - 30}" font-size="13" fill="${color}" text-anchor="middle" font-weight="bold">${symbol}</text>`;
            svg += `<text x="${posX}" y="${yEnd - 12}" font-size="11" fill="${color}" text-anchor="middle">${labelText}</text>`;
        } else {
            const posY = ty(wl.pos);
            const xStart = tx(outerMinX - 1500), xEnd = tx(outerMaxX + 1500);
            svg += `<line x1="${xStart}" y1="${posY}" x2="${xEnd}" y2="${posY}" stroke="${color}" stroke-width="${wl.isEffective ? 1.5 : 0.8}" stroke-dasharray="10,2,2,2" />`;
            // 左端にラベル (xStartが左)
            svg += `<text x="${xStart - 15}" y="${posY - 10}" font-size="13" fill="${color}" text-anchor="end" font-weight="bold">${symbol}</text>`;
            svg += `<text x="${xStart - 15}" y="${posY + 10}" font-size="11" fill="${color}" text-anchor="end">${labelText}</text>`;
        }
    });
  };

  // xDir は X'方向加力に対する支持点（X'軸に平行な水平線）
  drawLines(result.xDir?.wallLines || [], false);
  // yDir は Y'方向加力に対する支持点（Y'軸に平行な垂直線）
  drawLines(result.yDir?.wallLines || [], true);

  svg += `</svg>`;
  return svg;
}

// ── メイン関数 ──────────────────────────────────────────────────────────────

/**
 * 水平構面検討の帳票HTMLを生成する。
 *
 * @param {object} allFloorData - 全階データ ({ '1': fd, '2': fd, ... })
 * @returns {string} HTML文字列
 */
export const generateDiaphragmReportHtml = window.generateDiaphragmReportHtml = function(allFloorData) {
  const skewAxes = window.dxfSkewedAxes || [];
  const floorKeys = Object.keys(allFloorData || {}).sort((a, b) => b.localeCompare(a));

  let bodyHtml = '';

  for (const fk of floorKeys) {
    const fd = allFloorData[fk];
    const diaphs = fd.diaphragms || [];
    if (diaphs.length === 0) continue;

    let floorHtml = '';

    diaphs.forEach((dia, idx) => {
      // 等価プロパティを最新化
      if (typeof window.calculateDiaphragmProps === 'function') {
        window.calculateDiaphragmProps(dia, fd.nodes);
      }

      const showEquiv = dia.showReportEquiv !== false;
      const showSkew  = dia.showReportSkew  === true;
      if (!showEquiv && !showSkew) return;

      const S = dia.area || 0;
      let sectionHtml = `
        <div style="${SEC}">
          <div style="font-weight:bold;font-size:14px;color:#2c3e50;margin-bottom:10px;border-bottom:1px solid #ccc;padding-bottom:5px;">
            構面 ${dia.id || `D-${idx+1}`} &nbsp; (実面積 S = ${S.toFixed(3)} m²)
          </div>`;

      if (showEquiv) {
        sectionHtml += `
          <p style="font-size:12px;font-weight:bold;color:#444;margin:0 0 6px;">【等価置き換えモデル】 形状低減係数 η の算定</p>
          ${_equivTable(dia)}
          <div style="font-size:10px;color:#777;text-align:right;margin-top:3px;">Leq = S / Bmax, η = Leq / Lmax, Lred = Leq × η</div>`;
      }

      if (showSkew) {
        const fd1 = allFloorData['1'];
        const floorSpecs = (fd1 && fd1.globalDiaphragmSpecs) ? fd1.globalDiaphragmSpecs[fk] : null;
        sectionHtml += `
          <p style="font-size:12px;font-weight:bold;color:#9b59b6;margin:${showEquiv ? '16px' : '0'} 0 6px;">
            【斜め軸回転モデル】 グレー本 3-7節 単純梁モデルによる検討
          </p>
          ${_skewSection(dia, fd, skewAxes, floorSpecs, fk, allFloorData)}`;
      }

      sectionHtml += `</div>`;
      floorHtml += sectionHtml;
    });

    if (floorHtml) {
      bodyHtml += `
        <h3 style="font-size:14px;border-left:5px solid #e67e22;padding-left:10px;color:#e67e22;margin-top:28px;">${fk} 階</h3>
        ${floorHtml}`;
    }
  }

  if (!bodyHtml) {
    bodyHtml = '<p style="color:#999;font-size:13px;">帳票出力対象の水平構面がありません。<br>構面プロパティから「帳票出力」にチェックを入れてください。</p>';
  }

  return `
    <div id="section-diaphragm-report" style="font-family:'MS Gothic','Courier New',monospace;color:#000;padding:0;">
      <h2 style="font-size:17px;border-left:8px solid #e67e22;padding-left:14px;border-bottom:2px solid #333;padding-bottom:5px;margin-bottom:18px;color:#000;">
        水平構面の地震力・風圧力に対する検定
      </h2>
      <div style="background:#fffcf9;border:1px solid #d35400;padding:12px;margin-bottom:20px;font-size:11px;line-height:1.6;border-radius:4px;color:#333;">
        <strong style="color:#a04000;">【計算方針】</strong><br>
        等価置き換えモデル: 不整形な水平構面を形状低減係数 η を用いて長方形に置き換えて評価します。<br>
        斜め軸回転モデル: 指定した斜め軸を主軸として座標回転し、グレー本 3-7節の単純梁モデルで有効耐力壁線間の検討を行います。
      </div>
      ${bodyHtml}
    </div>`;
};
