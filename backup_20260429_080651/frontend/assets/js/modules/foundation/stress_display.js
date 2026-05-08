import { floorData, currentFloor } from './foundation_cad.js';
// 💡 既存の計算関数を calc.js からインポート
import { calculateFoundationHorizontalStressData } from './foundation_calc.js';

/**
 * 基礎梁の水平荷重時応力図の描画
 * @param {string|HTMLCanvasElement} canvasId - キャンバスIDまたは要素
 * @param {Object} beam - 梁オブジェクト
 * @param {boolean} isPrinting - 印刷用フラグ
 */
export const drawBeamStressOnCanvas = function(canvasId, beam, isPrinting = false) {
  const canvas = (typeof canvasId === 'string') ? document.getElementById(canvasId) : canvasId;
  if (!canvas || !(canvas instanceof HTMLCanvasElement)) return;
  const fd = floorData['1'];
  const data = calculateFoundationHorizontalStressData(beam, fd);
  if (!data) return;

  const ctx = canvas.getContext('2d');
  const CW = canvas.width;
  canvas.height = 600; // スペース確保のため拡張
  const CH = canvas.height;
  ctx.clearRect(0, 0, CW, CH);

  const { points, resL, resR, totalL } = data;
  const marginX = 80;
  const marginY = 50;
  const plotW = CW - marginX * 2;
  const plotH = (CH - marginY * 3) / 2; // 上下2段 (Left, Right)

  const scaleX = plotW / (totalL || 1);

  const drawRow = (yCenter, results, title, modeColor) => {
    // 基準線
    ctx.strokeStyle = '#555';
    if (isPrinting) { ctx.strokeStyle = '#000000'; ctx.fillStyle = '#000000'; ctx.lineWidth = 2; }
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(marginX, yCenter);
    ctx.lineTo(marginX + plotW, yCenter);
    ctx.stroke();

    // スケール計算 (Q, M, Force) - 0.1 未満の場合は 0.1 に補正してゼロ除算を防止
    let maxQ = Math.max(...results.map(r => Math.abs(r.Qe)), 0.1);
    if (!isFinite(maxQ) || maxQ < 0.1) maxQ = 0.1;

    let maxM = Math.max(...results.map(r => Math.abs(r.M_f)), 0.1);
    if (!isFinite(maxM) || maxM < 0.1) maxM = 0.1;

    let maxF = Math.max(...results.map(r => Math.max(Math.abs(r.Td), Math.abs(r.R))), 0.1);
    if (!isFinite(maxF) || maxF < 0.1) maxF = 0.1;
    
    const scaleQ = (plotH * 0.35) / maxQ;
    const scaleM = (plotH * 0.35) / maxM;
    const scaleF = 40 / maxF; // 最大矢印長さを調整

    // 【NEW】デバッグログ
    console.log("【Canvas描画】梁ID:", beam?.id, "maxM:", maxM, "maxQ:", maxQ);

    // 通り芯の描画
    points.forEach(p => {
      const x = marginX + p.dist * scaleX;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      if (isPrinting) { ctx.strokeStyle = '#000000'; ctx.fillStyle = '#000000'; ctx.lineWidth = 2; }
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, yCenter - plotH/2);
      ctx.lineTo(x, yCenter + plotH/2);
      ctx.stroke();
      
      ctx.fillStyle = '#aaa';
      if (isPrinting) { ctx.strokeStyle = '#000000'; ctx.fillStyle = '#000000'; ctx.lineWidth = 2; }
      ctx.font = '9px sans-serif';
      ctx.fillText(p.id, x - 5, yCenter + plotH/2 + 12);
    });

    // M図 (折れ線) - 資料準拠: 引張側(下)へプラス
    ctx.setLineDash([]);
    ctx.strokeStyle = '#f1c40f';
    if (isPrinting) { ctx.strokeStyle = '#000000'; ctx.fillStyle = '#000000'; ctx.lineWidth = 2; }
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = marginX + p.dist * scaleX;
      const my = yCenter + results[i].M_f * scaleM;
      if (i === 0) ctx.moveTo(x, my); else ctx.lineTo(x, my);
    });
    ctx.stroke();

    // Q図 (階段状)
    ctx.strokeStyle = '#3498db';
    if (isPrinting) { ctx.strokeStyle = '#000000'; ctx.fillStyle = '#000000'; ctx.lineWidth = 2; }
    ctx.lineWidth = 1;
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = marginX + p.dist * scaleX;
      const qy = yCenter - results[i].Qe * scaleQ;
      if (i === 0) {
        ctx.moveTo(x, yCenter);
        ctx.lineTo(x, qy);
      } else {
        const prevX = marginX + points[i-1].dist * scaleX;
        const prevQy = yCenter - results[i-1].Qe * scaleQ;
        ctx.lineTo(x, prevQy);
        ctx.lineTo(x, qy);
      }
      if (i === points.length - 1) ctx.lineTo(x, yCenter);
    });
    ctx.stroke();

    // N, R (矢印) の描画
    points.forEach((p, i) => {
      const x = marginX + p.dist * scaleX;
      ctx.lineWidth = 1.5;
      ctx.font = '9px sans-serif';
      
      // 1. 柱からの短期軸力 N (Td) - 梁の上側に表示
      const N = results[i].Td || 0;
      if (Math.abs(N) > 0.01) {
        const len = Math.max(Math.abs(N) * scaleF, 10);
        const yBase = yCenter - 30;
        const yTip = N > 0 ? yBase : yBase - len; // 正なら梁(yBase)へ向かう
        const yRoot = N > 0 ? yBase - len : yBase;
        
        ctx.strokeStyle = modeColor;
        if (isPrinting) { ctx.strokeStyle = '#000000'; ctx.fillStyle = '#000000'; ctx.lineWidth = 2; }
        ctx.beginPath(); ctx.moveTo(x, yRoot); ctx.lineTo(x, yTip); ctx.stroke();
        
        const headDir = N > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(x - 3, yTip - 5 * headDir);
        ctx.lineTo(x, yTip);
        ctx.lineTo(x + 3, yTip - 5 * headDir);
        ctx.stroke();
        
        ctx.fillStyle = modeColor;
        if (isPrinting) { ctx.strokeStyle = '#000000'; ctx.fillStyle = '#000000'; ctx.lineWidth = 2; }
        ctx.fillText(`N:${N.toFixed(2)}`, x + 4, yRoot);
      }

      // 2. 支点反力 R - 梁の下側に表示
      const R = results[i].R || 0;
      if (Math.abs(R) > 0.01) {
        const len = Math.max(Math.abs(R) * scaleF, 10);
        const yBase = yCenter + 30;
        const yTip = R > 0 ? yBase : yBase + len; // 正なら梁(yBase)へ向かう
        const yRoot = R > 0 ? yBase + len : yBase;
        
        ctx.strokeStyle = modeColor;
        if (isPrinting) { ctx.strokeStyle = '#000000'; ctx.fillStyle = '#000000'; ctx.lineWidth = 2; }
        ctx.beginPath(); ctx.moveTo(x, yRoot); ctx.lineTo(x, yTip); ctx.stroke();
        
        const headDir = R > 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(x - 3, yTip - 5 * headDir);
        ctx.lineTo(x, yTip);
        ctx.lineTo(x + 3, yTip - 5 * headDir);
        ctx.stroke();
        
        ctx.fillStyle = modeColor;
        if (isPrinting) { ctx.strokeStyle = '#000000'; ctx.fillStyle = '#000000'; ctx.lineWidth = 2; }
        ctx.fillText(`R:${R.toFixed(2)}`, x + 4, yRoot);
      }
    });

    ctx.fillStyle = '#fff';
    if (isPrinting) { ctx.strokeStyle = '#000000'; ctx.fillStyle = '#000000'; ctx.lineWidth = 2; }
    ctx.font = '11px sans-serif';
    ctx.fillText(title, marginX - 60, yCenter);
  };

  drawRow(marginY + plotH/2, resL, '左加力 (L)', '#2ecc71');
  drawRow(CH - marginY - plotH/2, resR, '右加力 (R)', '#e74c3c');

  // 凡例
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#f1c40f'; ctx.fillText('■ M図 (kN·m)', CW - 100, 20);
  ctx.fillStyle = '#3498db'; ctx.fillText('■ Q図 (kN)', CW - 100, 35);
  ctx.fillStyle = '#2ecc71'; ctx.fillText('↑↓ 短期軸力・反力 (L)', CW - 130, 50);
  ctx.fillStyle = '#e74c3c'; ctx.fillText('↑↓ 短期軸力・反力 (R)', CW - 130, 65);
};

/**
 * 1階の全基礎梁（内部・外周）に対し、水平荷重時応力（Qe, M水f）を一括算定してプロパティに格納する
 * @param {Object} fd - 階層データ
 */
export const updateAllBeamsShortTermStress = function(fd) {
  if (!fd || currentFloor !== '1') return;
  
  let count = 0;
  let failedCount = 0;

  const processBeams = (beams) => {
    beams.forEach(b => {
      const data = calculateFoundationHorizontalStressData(b, fd);
      if (!data) {
        failedCount++;
        return;
      }
      const { resL, resR } = data;
      const lastIdx = resL.length - 1;
      
      // 左加力時 (kN, kN·m)
      b.shortTermQ_L_load = Math.max(...resL.map(r => Math.abs(r.Qe)));
      b.shortTermM_start_L_load = resL[0].M_f;
      b.shortTermM_end_L_load = resL[lastIdx].M_f;
      
      // 右加力時
      b.shortTermQ_R_load = Math.max(...resR.map(r => Math.abs(r.Qe)));
      b.shortTermM_start_R_load = resR[0].M_f;
      b.shortTermM_end_R_load = resR[lastIdx].M_f;
      
      count++;
    });
  };

  processBeams(fd.beams || []);
  processBeams(fd.perimeterBeams || []);
  
  if (failedCount > 0) {
    console.warn(`[updateAllBeamsShortTermStress] ${failedCount} 本の梁でマッピング用データ取得に失敗しました。座標定義を確認してください。`);
  }
};

// グローバル登録（既存HTML・他モジュールからの互換用）
window.drawBeamStressOnCanvas = drawBeamStressOnCanvas;
window.drawFoundationBeamHorizontalStressDiagram = drawBeamStressOnCanvas; // 互換性維持用のエイリアス
window.updateAllBeamsShortTermStress = updateAllBeamsShortTermStress;
