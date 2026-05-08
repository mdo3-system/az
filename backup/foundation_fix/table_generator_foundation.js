import { floorData, currentFloor } from './foundation_cad.js';

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

/**
 * 基礎梁の長期応力算定表（HTML）を生成する
 */
export const generateFoundationLongTermStressTable = window.generateFoundationLongTermStressTable = function(beam) {
  const fd = floorData[currentFloor];
  if (!fd || !beam) return '';
  
  const stress = window.computeBeamStress(fd, beam);
  const spans = (beam.longTermSpans || (stress ? stress.longTermSpans : [])) || [];
  if (spans.length === 0) return '';

  let rowsHtml = '';
  const supports = window.findSupportsOnBeam(beam, fd.nodes, fd.columns);
  const n1 = fd.nodes[beam.n1];
  const n2 = fd.nodes[beam.n2];
  
  const pointNames = [n1?.id || 'Start'];
  supports.forEach(s => pointNames.push(s.col.id));
  pointNames.push(n2?.id || 'End');

  spans.forEach((s, i) => {
    const spanName = `${pointNames[i]}-${pointNames[i+1]}`;
    const sigma = s.sigma_e !== undefined ? s.sigma_e : (beam.groundPressure || 0);
    const B = s.B !== undefined ? s.B : (beam.tributaryWidth || 0);
    
    rowsHtml += `
      <tr style="text-align:right; border-bottom:1px solid #444;">
        <td style="text-align:center; padding:6px; border-right:1px solid #555; background:rgba(255,255,255,0.03);">${spanName}</td>
        <td style="padding:6px; border-right:1px solid #444;">${(s.L || 0).toFixed(3)}</td>
        <td style="padding:6px; border-right:1px solid #444;">${(sigma || 0).toFixed(3)}</td>
        <td style="padding:6px; border-right:1px solid #444;">${(B || 0).toFixed(3)}</td>
        <td style="padding:6px; border-right:1px solid #444; font-weight:bold; color:#f1c40f;">${(s.M_mid || 0).toFixed(3)}</td>
        <td style="padding:6px; border-right:1px solid #444;">${(s.M_end || 0).toFixed(3)}</td>
        <td style="padding:6px; color:#3498db;">${(s.Q_L || 0).toFixed(3)}</td>
      </tr>
    `;
  });

  return `
    <div style="margin-top:25px; padding:15px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid #555; width:100%; box-sizing:border-box;">
      <div style="color:var(--accent); font-weight:bold; font-size:13px; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
        <span style="font-size:16px;">📉</span> 7-3 基礎梁の断面と配筋の検定 (応力の算定 長期)
      </div>
      <div style="overflow-x:auto; border-radius:4px; border:1px solid #444;">
        <table style="width:100%; border-collapse:collapse; font-size:11px; color:#fff; min-width:600px; table-layout: fixed;">
          <thead>
            <tr style="background:#333; height:32px;">
              <th style="border:1px solid #555; width:120px;">支点間 (スパン)</th>
              <th style="border:1px solid #555;">長さ Lo (m)</th>
              <th style="border:1px solid #555;">σe (kN/m²)</th>
              <th style="border:1px solid #555;">負担幅 B (m)</th>
              <th style="border:1px solid #555; color:#f1c40f;">M中 (kN·m)</th>
              <th style="border:1px solid #555;">M端 (kN·m)</th>
              <th style="border:1px solid #555; color:#3498db;">QL (kN)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
};

/**
 * 基礎梁の水平荷重時応力算定表（および検定マトリックス）を生成する
 */
export const generateFoundationHorizontalStressTable = window.generateFoundationHorizontalStressTable = function(beam, type, index, isPrinting = false) {
  const fd = floorData['1'];
  if (!fd) return '';
  
  const data = window.calculateFoundationHorizontalStressData(beam, fd);
  if (!data) return '';
  
  const supports = window.findSupportsOnBeam ? window.findSupportsOnBeam(beam, fd.nodes, fd.columns) : [];
  const ratios = Array.from(new Set(supports.map(s => s.col.inflectionRatio ?? 0.5))).sort();
  const bText = ratios.length > 0 ? ratios.join(', ') : "0.5";

  const { points, resL, resR } = data;
  
  // 印刷用カラースキームの設定
  const styles = {
    bgPanel: isPrinting ? '#fff' : 'rgba(0,0,0,0.25)',
    border: isPrinting ? '#000' : '#555',
    headerBg: isPrinting ? '#eee' : '#34495e',
    headerBg2: isPrinting ? '#f5f5f5' : '#2c3e50',
    rowBg: isPrinting ? '#fff' : 'rgba(255,255,255,0.02)',
    text: isPrinting ? '#000' : '#fff',
    textDim: isPrinting ? '#666' : '#aaa',
    accent: isPrinting ? '#d35400' : '#e67e22',
    longM: isPrinting ? '#000' : '#f1c40f',
    shortQ: isPrinting ? '#000' : '#3498db',
    ngText: '#ff0000',
    okText: isPrinting ? '#008000' : '#2ecc71'
  };

  const borderStyle = `border:1px solid ${styles.border};`;
  const padding = `padding:5px;`;
  
  const tribWidth = beam.tributaryWidth || 0;
  const tribArea  = beam.tributaryArea !== undefined ? beam.tributaryArea : ((beam.groundPressure > 0 && beam.slabLoad !== undefined) ? (beam.slabLoad / beam.groundPressure) : 0);

  const slabInfoHtml = `
    <div style="font-size: 11px; margin-bottom: 12px; padding: 10px; border-radius: 4px; 
                color: ${isPrinting ? '#000' : styles.text}; 
                background: ${isPrinting ? '#fff' : styles.bgPanel}; 
                border: 1px solid ${isPrinting ? '#000' : styles.border}; 
                display: flex; gap: 20px; align-items: center;">
      <div style="font-weight:bold; border-right: 2px solid ${isPrinting ? '#000' : styles.accent}; padding-right: 15px;">スラブ負担データ</div>
      <div>
        負担面積 = <span style="font-weight:bold; color:${isPrinting ? '#000' : styles.accent};">${tribArea.toFixed(3)}</span> m²
      </div>
      <div style="color:${styles.border};">|</div>
      <div>
        等価負担幅 B = <span style="font-weight:bold; color:${isPrinting ? '#000' : styles.accent};">${tribWidth.toFixed(3)}</span> m (${(tribWidth * 1000).toFixed(0)} mm)
      </div>
    </div>
  `;

  let rowsHtml = '';
  points.forEach((p, i) => {
    rowsHtml += `
      <tr style="text-align:right; border-bottom:1px solid ${isPrinting ? '#000' : '#444'}; color:${styles.text};">
        <td style="text-align:center; ${padding} ${borderStyle} background:${isPrinting ? '#fff' : 'rgba(255,255,255,0.02)'};">${p.id}</td>
        <td style="text-align:center; ${padding} ${borderStyle}">${(p.dist || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${(resL[i].Td || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${(resL[i].R || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle} background:${isPrinting ? '#eee' : 'rgba(46,204,113,0.05)'};">${(resL[i].Qe || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle} font-weight:bold; color:${styles.longM};">${(resL[i].M_f || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${(resR[i].Td || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${(resR[i].R || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle} background:${isPrinting ? '#eee' : 'rgba(231,76,60,0.05)'};">${(resR[i].Qe || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle} font-weight:bold; color:${styles.longM};">${(resR[i].M_f || 0).toFixed(3)}</td>
      </tr>
    `;
  });

  const stressPointsTable = `
    <div style="margin-top:25px; padding:15px; background:${styles.bgPanel}; border-radius:10px; border:1px solid ${styles.border}; width:100%; box-sizing:border-box;">
      ${slabInfoHtml}
      <div style="color:${styles.accent}; font-weight:bold; font-size:14px; margin-bottom:12px; display:flex; align-items:center; gap:10px; border-bottom:1px solid ${styles.border}; padding-bottom:8px;">
        <span style="font-size:18px;">📊</span> 応力の算定（水平荷重時） 反曲点高比 B = ${bText}
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:${isPrinting?'9px':'11px'}; color:${styles.text}; min-width:${isPrinting?'unset':'900px'}; table-layout: fixed;">
          <thead>
            <tr style="background:${styles.headerBg};">
              <th rowspan="2" style="${borderStyle} width:80px;">通り/座標</th>
              <th rowspan="2" style="${borderStyle} width:70px;">位置 (m)</th>
              <th colspan="4" style="${borderStyle} background:${isPrinting ? '#eee' : 'rgba(46,204,113,0.1)'};">地震時：左加力</th>
              <th colspan="4" style="${borderStyle} background:${isPrinting ? '#eee' : 'rgba(231,76,60,0.1)'};">地震時：右加力</th>
            </tr>
            <tr style="background:${styles.headerBg2};">
              <th style="${borderStyle}">Td(kN)</th>
              <th style="${borderStyle}">R(kN)</th>
              <th style="${borderStyle}">Qe(kN)</th>
              <th style="${borderStyle}">M水(kN･m)</th>
              <th style="${borderStyle}">Td(kN)</th>
              <th style="${borderStyle}">R(kN)</th>
              <th style="${borderStyle}">Qe(kN)</th>
              <th style="${borderStyle}">M水(kN･m)</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>
  `;

  const stress = window.computeBeamStress ? window.computeBeamStress(fd, beam) : null;
  
  const getSProp = (spanIdx, prop, def) => {
    if (beam.spans && beam.spans[spanIdx] && beam.spans[spanIdx][prop] !== undefined) {
      return beam.spans[spanIdx][prop];
    }
    if (beam.spanProps && beam.spanProps[spanIdx] && beam.spanProps[spanIdx][prop] !== undefined) {
      if (beam.spans && beam.spans[spanIdx]) {
         beam.spans[spanIdx][prop] = beam.spanProps[spanIdx][prop];
      }
      return beam.spanProps[spanIdx][prop];
    }
    return beam[prop] !== undefined ? beam[prop] : def;
  };

  const requiredSpanCnt = points.length - 1;
  if (!beam.spans || beam.spans.length !== requiredSpanCnt) {
    if (!beam.spans) beam.spans = [];
    const spanCnt = requiredSpanCnt;
    for (let i = 0; i < spanCnt; i++) {
        if (beam.spans[i]) continue;
        const topR = getSProp(i, 'topRebar', '2-D16');
        const botR = getSProp(i, 'bottomRebar', '2-D16');
        const stirrup = getSProp(i, 'stirrup', 'D10');
        beam.spans[i] = {
            topRebar: topR,
            bottomRebar: botR,
            stirrup: stirrup,
            pitch: getSProp(i, 'pitch', 200),
            D: getSProp(i, 'depth', 640),
            b: getSProp(i, 'width', 300),
            dt: getSProp(i, 'dt', 70)
        };
    }
  }

  let table1Rows = '', table2Rows = '', table3Rows = '', table4Rows = '', table5Rows = '';
  const shortTermN = parseFloat((fd && fd.shortTermN) || window.shortTermN || 2.0);

  const spansCount = points.length - 1;
  for (let i = 0; i < spansCount; i++) {
    const spanName = `${points[i].id}～${points[i + 1].id}`;
    const spanLen = Math.hypot(points[i+1].x - points[i].x, points[i+1].y - points[i].y) / 1000;
    
    const s = beam.spans[i] || {};
    const sDepth = s.D || 640;
    const sWidth = s.b || 300;
    const sDt = s.dt || 70;
    const sTopR = s.topRebar || '2-D16';
    const sBotR = s.bottomRebar || '2-D16';
    const sStirrup = s.stirrup || 'D10';
    const sPitch = s.pitch || 200;
    
    const sAt = window.getRebarArea(sTopR);
    const sAtBot = window.getRebarArea(sBotR);
    const sAw = window.getRebarArea(sStirrup);
    
    const material = { ft: beam.ft || 195, fs: 0.7, fts: 295, fss: 1.05 };
    
    const sB       = (stress && stress.spans && stress.spans[i]) ? (stress.spans[i].B ?? 0) : (beam.tributaryWidth || 0);
    const sSigma   = (stress && stress.spans && stress.spans[i]) ? (stress.spans[i].sigma_e ?? 0) : (beam.groundPressure || 0);
    const sW       = (sSigma * sB);
    
    const curM_mid = (sW * spanLen * spanLen) / 8.0;
    const curM_end = (sW * spanLen * spanLen) / 12.0;
    const curQ_L   = (sW * spanLen) / 2.0;

    const absMLongEnd = Math.abs(curM_end);
    const absMLongMid = Math.abs(curM_mid);
    const absQLong = Math.max(0.01, Math.abs(curQ_L));

    const MeL_start = Math.abs(resL[i].M_f), MeL_end = Math.abs(resL[i+1].M_f);
    const QeL_e = Math.max(0.01, Math.abs(resL[i].Qe), Math.abs(resL[i+1].Qe));
    const MeR_start = Math.abs(resR[i].M_f), MeR_end = Math.abs(resR[i+1].M_f);
    const QeR_e = Math.max(0.01, Math.abs(resR[i].Qe), Math.abs(resR[i+1].Qe));

    const Msht_L_left  = absMLongEnd + MeL_start;
    const Msht_L_right = absMLongEnd + MeL_end;
    const Qsht_L = absQLong + shortTermN * QeL_e;
    const Msht_R_left  = absMLongEnd + MeR_start;
    const Msht_R_right = absMLongEnd + MeR_end;
    const Qsht_R = absQLong + shortTermN * QeR_e;

    const d_m = (sDepth - sDt) / 1000;
    const alphaL = Math.max(1.0, Math.min(2.0, 4 / (absMLongEnd / (absQLong * d_m) + 1)));
    const calcAlphaS = (Msht, Qsht) => {
      const Mshort = Math.max(0.01, Msht - absMLongEnd);
      return Math.max(1.0, Math.min(2.0, 4 / (Mshort / (Qsht * d_m) + 1)));
    };
    const alphaS = Math.max(
      calcAlphaS(Math.max(Msht_L_left, Msht_L_right), Qsht_L),
      calcAlphaS(Math.max(Msht_R_left, Msht_R_right), Qsht_R)
    );

    const resStrength_T = window.calculateSpanStrength({ D: sDepth, b: sWidth, dt: sDt, at: sAt, aw: sAw, pitch: sPitch, alpha: alphaL }, material);
    const resStrength_B = window.calculateSpanStrength({ D: sDepth, b: sWidth, dt: sDt, at: sAtBot, aw: sAw, pitch: sPitch, alpha: alphaL }, material);
    const resStrength_S = window.calculateSpanStrength({ D: sDepth, b: sWidth, dt: sDt, at: sAt, aw: sAw, pitch: sPitch, alpha: alphaS }, material);

    const lMa_t = resStrength_T.Ma;
    const lMa_b = resStrength_B.Ma;
    const sMa_t = resStrength_T.Mas;
    const sMa_b = resStrength_B.Mas;
    const lQa   = resStrength_T.Qa;
    const sQa   = resStrength_S.Qas;
    const j_val = resStrength_T.j;

    table1Rows += `
      <tr style="text-align:right; border-bottom:1px solid ${isPrinting?'#000':'#444'}; color:${styles.text};">
        <td style="text-align:center; ${padding} ${borderStyle} background:${isPrinting?'#fff':'rgba(255,255,255,0.03)'};">${spanName}</td>
        <td style="${padding} ${borderStyle}">${(sSigma || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${(sB || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${(sW || 0).toFixed(3)}</td>
        <td style="${padding} ${borderStyle} font-weight:bold;">${curM_mid.toFixed(3)}</td>
        <td style="${padding} ${borderStyle} font-weight:bold;">${curM_end.toFixed(3)}</td>
        <td style="${padding} ${borderStyle} background:${isPrinting?'#eee':'rgba(255,255,255,0.02)'};">${curQ_L.toFixed(3)}</td>
      </tr>
    `;

    table2Rows += `
      <tr style="text-align:right; border-bottom:1px solid ${isPrinting?'#000':'#444'}; color:${styles.text};">
        <td style="text-align:center; ${padding} ${borderStyle} background:${isPrinting?'#fff':'rgba(255,255,255,0.03)'};">${spanName}</td>
        <td style="${padding} ${borderStyle}">${Msht_L_left.toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${Msht_L_right.toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${Qsht_L.toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${Msht_R_left.toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${Msht_R_right.toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${Qsht_R.toFixed(3)}</td>
      </tr>
    `;

    const upProp = (p, v) => `window.updateBeamSpanProp('${type}', ${index}, ${i}, '${p}', ${v})`;
    const dDtInput = isPrinting ? `${sDepth} / ${sDt}` : `
          <input type="number" value="${sDepth}" style="width:40px; background:#000; color:#fff; border:1px solid #555; text-align:right;" onchange="${upProp('D', 'this.value')}">
          <span style="color:#666;">/</span>
          <input type="number" value="${sDt}" style="width:35px; background:#000; color:#aaa; border:1px solid #555; text-align:right;" onchange="${upProp('dt', 'this.value')}">`;
    const rebarSelect = (val, prop) => {
      if (isPrinting) return val;
      const match = String(val).match(/(?:(\d+)-)?(D\d+.*)/);
      const count = match ? (match[1] || '1') : '2';
      const dia = match ? match[2] : 'D16';
      const counts = ['1', '2', '3', '4', '5', '6'];
      const dias = ['D10', 'D13', 'D16', 'D19', 'D22', 'D13+D16', 'D16+D19', 'D19+D22', 'Manual'];
      
      const selectHtml = `
        <div style="display:flex; gap:2px; height:20px;">
          <select style="width:32px; background:#000; color:#fff; font-size:10px; border:1px solid #555;" onchange="window.handleBeamRebarPartChange('${type}', ${index}, ${i}, '${prop}', this.value, 'count')">
            ${counts.map(c => `<option value="${c}" ${c === count ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <span style="color:#666; line-height:18px;">-</span>
          <select id="sel_dia_${prop}_${i}" style="flex:1; background:#000; color:#fff; font-size:10px; border:1px solid #555;" onchange="if(this.value==='Manual'){ const v=prompt('配筋を入力(例:D13+D16)', '${dia}'); if(v) window.updateBeamSpanProp('${type}', ${index}, ${i}, '${prop}', v); } else { window.handleBeamRebarPartChange('${type}', ${index}, ${i}, '${prop}', this.value, 'dia'); }">
            ${dias.map(d => `<option value="${d}" ${d === dia ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </div>`;
      return selectHtml;
    };
    const stirrupSelect = isPrinting ? sStirrup : `<select style="width:100%; background:#000; color:#fff; font-size:10px; border:1px solid #555;" onchange="${upProp('stirrup', 'this.value')}">${['D10', '2-D10', 'D13', '2-D13', 'D10/D13'].map(o=>`<option value="${o}" ${sStirrup===o?'selected':''}>${o}</option>`).join('')}</select>`;
    const pitchInput = isPrinting ? sPitch : `<input type="number" value="${sPitch}" style="width:45px; background:#000; color:#fff; border:1px solid #555; text-align:right;" onchange="${upProp('pitch', 'this.value')}">`;
    const widthInput = isPrinting ? sWidth : `<input type="number" value="${sWidth}" style="width:45px; background:#000; color:#fff; border:1px solid #555; text-align:right;" onchange="${upProp('b', 'this.value')}">`;

    table3Rows += `
      <tr style="text-align:right; border-bottom:1px solid ${isPrinting?'#000':'#444'}; color:${styles.text};">
        <td style="text-align:center; ${padding} ${borderStyle} background:${isPrinting?'#fff':'rgba(255,255,255,0.03)'};">${spanName}</td>
        <td style="${padding} ${borderStyle}">${dDtInput}</td>
        <td style="${padding} ${borderStyle}">${rebarSelect(sTopR, 'topRebar')}</td>
        <td style="${padding} ${borderStyle}">${sAt.toFixed(1)}</td>
        <td style="${padding} ${borderStyle} color:${styles.textDim};">${j_val.toFixed(1)}</td>
        <td style="${padding} ${borderStyle} font-weight:bold; color:${styles.longM};">${lMa_t.toFixed(3)}</td>
        <td style="${padding} ${borderStyle} font-weight:bold; color:${styles.accent};">${sMa_t.toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${rebarSelect(sBotR, 'bottomRebar')}</td>
        <td style="${padding} ${borderStyle}">${sAtBot.toFixed(1)}</td>
        <td style="${padding} ${borderStyle} color:${styles.textDim};">${j_val.toFixed(1)}</td>
        <td style="${padding} ${borderStyle} font-weight:bold; color:${styles.longM};">${lMa_b.toFixed(3)}</td>
        <td style="${padding} ${borderStyle} font-weight:bold; color:${styles.accent};">${sMa_b.toFixed(3)}</td>
      </tr>
    `;

    table4Rows += `
      <tr style="text-align:right; border-bottom:1px solid ${isPrinting?'#000':'#444'}; color:${styles.text};">
        <td style="text-align:center; ${padding} ${borderStyle} background:${isPrinting?'#fff':'rgba(255,255,255,0.03)'};">${spanName}</td>
        <td style="${padding} ${borderStyle}">${widthInput}</td>
        <td style="${padding} ${borderStyle}">${stirrupSelect}</td>
        <td style="${padding} ${borderStyle}">${sAw.toFixed(1)}</td>
        <td style="${padding} ${borderStyle}">${pitchInput}</td>
        <td style="${padding} ${borderStyle}">${(sAw/(sWidth*sPitch)).toFixed(5)}</td>
        <td style="${padding} ${borderStyle} color:${styles.textDim};">${alphaL.toFixed(3)}</td>
        <td style="${padding} ${borderStyle} font-weight:bold; color:${styles.shortQ};">${lQa.toFixed(3)}</td>
        <td style="${padding} ${borderStyle} color:${styles.textDim};">${alphaS.toFixed(3)}</td>
        <td style="${padding} ${borderStyle} font-weight:bold; color:${isPrinting?'#000':'#e74c3c'};">${sQa.toFixed(3)}</td>
      </tr>
    `;

    const rL_mid = absMLongMid / lMa_b;
    const rL_end = absMLongEnd / lMa_t;
    const rL_Q   = absQLong / lQa;
    const rSL_M  = Math.max(Msht_L_left, Msht_L_right) / sMa_t;
    const rSL_Q  = Qsht_L / sQa;
    const rSR_M  = Math.max(Msht_R_left, Msht_R_right) / sMa_t;
    const rSR_Q  = Qsht_R / sQa;
    const maxR = Math.max(rL_mid || 0, rL_end || 0, rL_Q || 0, rSL_M || 0, rSL_Q || 0, rSR_M || 0, rSR_Q || 0);
    const isOk = maxR <= 1.0;

    table5Rows += `
      <tr style="text-align:right; border-bottom:1px solid ${isPrinting?'#000':'#444'}; color:${styles.text};">
        <td style="text-align:center; ${padding} ${borderStyle} background:${isPrinting?'#fff':'rgba(255,255,255,0.03)'};">${spanName}</td>
        <td style="${padding} ${borderStyle}">${rL_mid.toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${rL_end.toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${rL_Q.toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${rSL_M.toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${rSL_Q.toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${rSR_M.toFixed(3)}</td>
        <td style="${padding} ${borderStyle}">${rSR_Q.toFixed(3)}</td>
        <td style="text-align:center; ${padding} ${borderStyle} font-weight:bold; color:${isOk?styles.okText:styles.ngText};">${isOk?'OK':'NG'}</td>
      </tr>
    `;
  }

  const resultMatrix = `
    <div style="margin-top:25px; border-top:1px solid ${styles.border}; padding-top:20px; color:${styles.text};">
      <h4 style="color:${styles.accent}; margin-bottom:15px; border-left:4px solid ${styles.accent}; padding-left:10px;">📉 両端支点連続梁モデル</h4>
      
      <p style="color:${styles.textDim}; font-size:${isPrinting?'9px':'10px'}; margin-bottom:4px;">[表1] 荷重の算定 (長期・スラブ負担荷重)</p>
      <table style="width:100%; border-collapse:collapse; font-size:${isPrinting?'9px':'10px'}; border:${isPrinting?'1px solid #000':'1px solid #555'}; text-align:center; margin-bottom:20px;">
        <thead style="background:${styles.headerBg}; color:${isPrinting?'#000':'#fff'};">
          <tr><th style="${borderStyle}">対象スパン</th><th style="${borderStyle}">接地圧 σ<sub>e</sub> (kN/m²)</th><th style="${borderStyle}">負担幅 B (m)</th><th style="${borderStyle}">等分布荷重 w (kN/m)<br>(σ<sub>e</sub>×B)</th><th style="${borderStyle}">M中 (kN·m)</th><th style="${borderStyle}">M端 (kN·m)</th><th style="${borderStyle}">Q<sub>L</sub> (kN)</th></tr>
        </thead>
        <tbody>${table1Rows}</tbody>
      </table>

      <p style="color:${styles.textDim}; font-size:${isPrinting?'9px':'10px'}; margin-bottom:4px;">[表2] 応力の算定 (短期) &nbsp; ◆短期せん断力 Q<sub>L</sub>+nQ<sub>e</sub> n= <strong>${shortTermN}</strong></p>
      <table style="width:100%; border-collapse:collapse; font-size:${isPrinting?'9px':'10px'}; border:${isPrinting?'1px solid #000':'1px solid #555'}; text-align:center; margin-bottom:20px;">
        <thead style="background:${styles.headerBg}; color:${isPrinting?'#000':'#fff'};">
          <tr><th rowspan="2" style="${borderStyle}">柱間</th><th colspan="3" style="${borderStyle} background:${isPrinting?'#eee':'rgba(46,204,113,0.05)'};">短期 左加力（下加力）</th><th colspan="3" style="${borderStyle} background:${isPrinting?'#eee':'rgba(231,76,60,0.05)'};">短期 右加力（上加力）</th></tr>
          <tr><th style="${borderStyle}">M端+M水<br>左側 (kN·m)</th><th style="${borderStyle}">M端+M水<br>右側 (kN·m)</th><th style="${borderStyle}">Q+${shortTermN}Qe<br>(kN)</th><th style="${borderStyle}">M端+M水<br>左側 (kN·m)</th><th style="${borderStyle}">M端+M水<br>右側 (kN·m)</th><th style="${borderStyle}">Q+${shortTermN}Qe<br>(kN)</th></tr>
        </thead>
        <tbody>${table2Rows}</tbody>
      </table>

      <p style="color:${styles.textDim}; font-size:${isPrinting?'9px':'10px'}; margin-bottom:4px;">[表3] 許容耐力の算定(1) [主筋] ${isPrinting?'':'※スパン別に編集可能'}</p>
      <table style="width:100%; border-collapse:collapse; font-size:${isPrinting?'8.5px':'10px'}; border:${isPrinting?'1px solid #000':'1px solid #555'}; text-align:center; margin-bottom:20px;">
        <thead style="background:${styles.headerBg2}; color:${isPrinting?'#000':'#fff'};">
          <tr><th rowspan="2" style="${borderStyle}">柱間</th><th rowspan="2" style="${borderStyle} width:90px;">基礎高さ D/dt</th><th colspan="5" style="${borderStyle} background:${isPrinting?'#f5f5f5':'rgba(241,196,15,0.05)'};">上端主筋</th><th colspan="5" style="${borderStyle} background:${isPrinting?'#f5f5f5':'rgba(241,196,15,0.05)'};">下端主筋</th></tr>
          <tr><th style="${borderStyle}">鉄筋</th><th style="${borderStyle}">at</th><th style="${borderStyle}">j</th><th style="${borderStyle}">長期 lMa</th><th style="${borderStyle}">短期 sMa</th><th style="${borderStyle}">鉄筋</th><th style="${borderStyle}">at</th><th style="${borderStyle}">j</th><th style="${borderStyle}">長期 lMa</th><th style="${borderStyle}">短期 sMa</th></tr>
        </thead>
        <tbody>${table3Rows}</tbody>
      </table>

      <p style="color:${styles.textDim}; font-size:${isPrinting?'9px':'10px'}; margin-bottom:4px;">[表4] 許容耐力の算定(2) [せん断補強筋] ${isPrinting?'':'※スパン別に編集可能'}</p>
      <table style="width:100%; border-collapse:collapse; font-size:${isPrinting?'9px':'10px'}; border:${isPrinting?'1px solid #000':'1px solid #555'}; text-align:center; margin-bottom:20px;">
        <thead style="background:${styles.headerBg2}; color:${isPrinting?'#000':'#fff'};">
          <tr><th rowspan="2" style="${borderStyle}">柱間</th><th rowspan="2" style="${borderStyle}">幅b</th><th colspan="3" style="${borderStyle}">スターラップ筋</th><th rowspan="2" style="${borderStyle}">Pw</th><th colspan="2" style="${borderStyle}">せん断長期</th><th colspan="2" style="${borderStyle}">せん断短期</th></tr>
          <tr><th style="${borderStyle}">鉄筋</th><th style="${borderStyle}">at</th><th style="${borderStyle}">ピッチ</th><th style="${borderStyle}">αL</th><th style="${borderStyle}">lQa</th><th style="${borderStyle}">αS</th><th style="${borderStyle}">sQa</th></tr>
        </thead>
        <tbody>${table4Rows}</tbody>
      </table>

      <p style="color:${styles.textDim}; font-size:${isPrinting?'9px':'10px'}; margin-bottom:4px;">[表5] 判定</p>
      <table style="width:100%; border-collapse:collapse; font-size:${isPrinting?'9px':'10px'}; border:${isPrinting?'2px solid #000':'2px solid #555'}; text-align:center; margin-bottom:20px;">
        <thead style="background:${isPrinting?'#ddd':'#1a1a1a'}; color:${styles.text};">
          <tr><th rowspan="2" style="${borderStyle}">柱間</th><th colspan="3" style="${borderStyle}">長期</th><th colspan="2" style="${borderStyle}">短期 左加力（下加力）</th><th colspan="2" style="${borderStyle}">短期 右加力（上加力）</th><th rowspan="2" style="${borderStyle}">判定</th></tr>
          <tr><th style="${borderStyle}">M中/<br>下端Ma</th><th style="${borderStyle}">M端/<br>上端Ma</th><th style="${borderStyle}">Q<sub>L</sub>/lQa</th><th style="${borderStyle}">M端+M水/<br>sMa</th><th style="${borderStyle}">Q+${shortTermN}Qe/<br>sQa</th><th style="${borderStyle}">M端+M水/<br>sMa</th><th style="${borderStyle}">Q+${shortTermN}Qe/<br>sQa</th></tr>
        </thead>
        <tbody>${table5Rows}</tbody>
      </table>
    </div>
  `;

  return stressPointsTable + resultMatrix;
};

/**
 * 第1章：斜め壁換算壁倍率の算定 HTML を生成する
 * @param {Object} allFloorData 全階層のデータ
 * @returns {string} 生成されたHTML
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
      const groupMx = (g.multiplier * g.count) * Math.pow(Math.sin(rad), 2);
      const groupMy = (g.multiplier * g.count) * Math.pow(Math.cos(rad), 2);
      
      totalMx += groupMx;
      totalMy += groupMy;
      
      const commonStyle = "padding: 12px; border: 1px solid #333; font-size: 14px; line-height: 1.6; color: #000;";
      chap1Rows += `
      <tr style="border-bottom: 1px solid #333; background: #fff;">
        <td style="${commonStyle} text-align: center; font-weight: bold;">${g.axisName}</td>
        <td style="${commonStyle} text-align: center;">${g.multiplier.toFixed(3)} (${g.count}箇所)</td>
        <td style="${commonStyle} text-align: center;">${angle.toFixed(1)}°</td>
        <td style="${commonStyle} text-align: center; font-weight: bold;">${groupMx.toFixed(3)}</td>
        <td style="${commonStyle} text-align: center; font-size: 12px; color: #1a1a1a;">(${(g.multiplier * g.count).toFixed(3)}) × sin²(${angle.toFixed(1)}°)</td>
        <td style="${commonStyle} text-align: center; font-weight: bold;">${groupMy.toFixed(3)}</td>
        <td style="${commonStyle} text-align: center; font-size: 12px; color: #1a1a1a;">(${(g.multiplier * g.count).toFixed(3)}) × cos²(${angle.toFixed(1)}°)</td>
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
 * @param {Object} allFloorData 全階層のデータ
 * @returns {string} 生成されたHTML
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
 * @param {string} axisName 対象の通り芯名
 * @param {Object} allFloorData 全階層のデータ
 * @param {Array} dxfVAxes X方向軸データ
 * @param {Array} dxfHAxes Y方向軸データ
 * @returns {string} 生成されたHTML
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
 * @param {Object} fd 1階のデータ
 * @param {Object} anchorBoltMaster アンカーボルトのマスターデータ
 * @returns {string} 生成されたHTML
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

/**
 * 8. 基礎梁の断面と配筋の検定 HTML を生成する
 */
export const generateFoundationBeamReportHtml = window.generateFoundationBeamReportHtml = function(fd1) {
  if (!fd1) return "";
  
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
  
  let html = `
    <div id="section7-3" style="margin-top: 40px; padding:20px; border:1px solid #eee; background:#fff; color:#000; page-break-inside: auto;">
      <h2 style="font-size: 18px; border-left: 8px solid #f1c40f; padding-left: 15px; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 20px; color:#000;">
        8. 基礎梁の断面と配筋の検定
      </h2>
      <div style="background: #fffcfc; border: 1px solid #e67e22; padding: 12px; margin-bottom: 20px; font-size: 12px; border-radius: 4px; color: #333; line-height: 1.6;">
        <strong>【基礎梁検定の算定根拠】</strong><br>
        本章の検定表は、以下の5ステップで構成されています：<br>
        ①荷重の算定 / ②応力の算定（短期） / ③許容耐力(1)：主筋 / ④許容耐力(2)：せん断補強筋 / ⑤判定
      </div>
  `;

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

  if (sortedAxes.length === 0) {
      html += '<p style="color:#999; font-size:12px;">※出力対象の基礎梁がありません。</p>';
  }
  html += `</div>`;
  return html;
};
