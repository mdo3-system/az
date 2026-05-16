import { floorData, currentFloor, FLOORS } from '../foundation_cad.js';
import { 
  computeBeamStress, 
  findSupportsOnBeam, 
  calculateDetailedBeamCheckResults 
} from '../core/beam_calc.js';
import { calculateFoundationHorizontalStressData } from '../core/column_calc.js';
import { generateSingleBeamNMQStressSvg } from './svg_beam_stress.js';

/**
 * 基礎梁の長期応力算定表（HTML）を生成する
 */
export const generateFoundationLongTermStressTable = window.generateFoundationLongTermStressTable = function(beam) {
  const fd = floorData[currentFloor];
  if (!fd || !beam) return '';
  
  const stress = computeBeamStress(fd, beam);
  const spans = (beam.longTermSpans || (stress ? stress.longTermSpans : [])) || [];
  if (spans.length === 0) return '';

  let rowsHtml = '';
  const supports = findSupportsOnBeam(beam, fd.nodes, fd.columns);
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
  
  const data = calculateFoundationHorizontalStressData(fd, beam, '1', floorData, FLOORS, beam.calcModel || 'span_supports');
  if (!data) return '';
  
  const isColumnModel = (beam.calcModel === 'column_supports');
  const supports = findSupportsOnBeam ? findSupportsOnBeam(beam, fd.nodes, fd.columns) : [];
  const ratios = Array.from(new Set(supports.map(s => s.col.inflectionRatio ?? 0.5))).sort();
  const bText = isColumnModel ? "考慮なし(B=1.0相当)" : (ratios.length > 0 ? ratios.join(', ') : "0.5");
  const tdLabel = isColumnModel ? "ΣNi(kN)" : "Td(kN)";

  const { points, resL, resR } = data;
  const horizontalData = data; // Alias for readability
  
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
        <span style="font-size:18px;">📊</span> 応力の算定（水平荷重時） &nbsp; <span style="background:${styles.accent}; color:#fff; padding:2px 8px; border-radius:4px; font-size:11px;">${isColumnModel ? '柱直下支点連続梁モデル' : '両端支点連続梁モデル'}</span> &nbsp; ${isColumnModel ? '' : `反曲点高比 B = ${bText}`}
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
              <th style="${borderStyle}">${tdLabel}</th>
              <th style="${borderStyle}">R(kN)</th>
              <th style="${borderStyle}">Qe(kN)</th>
              <th style="${borderStyle}">M水(kN･m)</th>
              <th style="${borderStyle}">${tdLabel}</th>
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

  const checkResults = calculateDetailedBeamCheckResults(beam, fd, horizontalData, shortTermN);
  if (!checkResults) return '<p>計算エラー</p>';

  checkResults.forEach((res, i) => {
    const { 
      spanName, sSigma, sB, sW, curM_mid, curM_end, curQ_L,
      Msht_L_left, Msht_L_right, Qsht_L, Msht_R_left, Msht_R_right, Qsht_R,
      sDepth, sDt, sTopR, sBotR, sAt, sAtBot, j_val, lMa_t, sMa_t, lMa_b, sMa_b,
      sWidth, sStirrup, sAw, sPitch, alphaL, lQa, alphaS, sQa, isOk
    } = res;

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
          <input id="modal-beam-span-${i}-D" type="number" value="${sDepth}" style="width:40px; background:#000; color:#fff; border:1px solid #555; text-align:right;" onchange="${upProp('D', 'this.value')}">
          <span style="color:#666;">/</span>
          <input id="modal-beam-span-${i}-dt" type="number" value="${sDt}" style="width:35px; background:#000; color:#aaa; border:1px solid #555; text-align:right;" onchange="${upProp('dt', 'this.value')}">`;
    
    const rebarSelect = (val, prop) => {
      if (isPrinting) return val;
      const match = String(val).match(/(?:(\d+)-)?(D\d+.*)/);
      const count = match ? (match[1] || '1') : '2';
      const dia = match ? match[2] : 'D16';
      const counts = ['1', '2', '3', '4', '5', '6'];
      const dias = ['D10', 'D13', 'D16', 'D19', 'D22', 'D13+D16', 'D16+D19', 'D19+D22', 'Manual'];
      return `
        <div style="display:flex; gap:2px; height:20px;">
          <select id="modal-beam-span-${i}-${prop}-count" style="width:32px; background:#000; color:#fff; font-size:10px; border:1px solid #555;" onchange="window.handleBeamRebarPartChange('${type}', ${index}, ${i}, '${prop}', this.value, 'count')">
            ${counts.map(c => `<option value="${c}" ${c === count ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <span style="color:#666; line-height:18px;">-</span>
          <select id="modal-beam-span-${i}-${prop}-dia" style="flex:1; background:#000; color:#fff; font-size:10px; border:1px solid #555;" onchange="if(this.value==='Manual'){ const v=prompt('配筋を入力(例:D13+D16)', '${dia}'); if(v) window.updateBeamSpanProp('${type}', ${index}, ${i}, '${prop}', v); } else { window.handleBeamRebarPartChange('${type}', ${index}, ${i}, '${prop}', this.value, 'dia'); }">
            ${dias.map(d => `<option value="${d}" ${d === dia ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </div>`;
    };

    const stirrupSelect = isPrinting ? sStirrup : `<select id="modal-beam-span-${i}-stirrup" style="width:100%; background:#000; color:#fff; font-size:10px; border:1px solid #555;" onchange="${upProp('stirrup', 'this.value')}">${['D10', '2-D10', 'D13', '2-D13', 'D10/D13'].map(o=>`<option value="${o}" ${sStirrup===o?'selected':''}>${o}</option>`).join('')}</select>`;
    const pitchInput = isPrinting ? sPitch : `<input id="modal-beam-span-${i}-pitch" type="number" value="${sPitch}" style="width:45px; background:#000; color:#fff; border:1px solid #555; text-align:right;" onchange="${upProp('pitch', 'this.value')}">`;
    const widthInput = isPrinting ? sWidth : `<input id="modal-beam-span-${i}-b" type="number" value="${sWidth}" style="width:45px; background:#000; color:#fff; border:1px solid #555; text-align:right;" onchange="${upProp('b', 'this.value')}">`;

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

    const { rL_mid, rL_end, rL_Q, rSL_M, rSL_Q, rSR_M, rSR_Q } = res.ratios;

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
  });

  const resultMatrix = `
    <div style="margin-top:25px; border-top:1px solid ${styles.border}; padding-top:20px; color:${styles.text};">
      <h4 style="color:${styles.accent}; margin-bottom:15px; border-left:4px solid ${styles.accent}; padding-left:10px;">📉 ${isColumnModel ? '柱直下支点連続梁モデル' : '両端支点連続梁モデル'} による断面検定</h4>
      
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
        本章の検定表は、各梁のプロパティで設定された計算モデル（両端支点 / 柱直下支点）に基づき算定されています。<br>
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
        const detailTables = generateFoundationHorizontalStressTable(b, 'beam', 0, true);

        const stressSvg = generateSingleBeamNMQStressSvg ? generateSingleBeamNMQStressSvg(b) : '';

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
