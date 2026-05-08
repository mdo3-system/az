import sys
import re

file_path = r'd:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\frontend\assets\js\modules\foundation\foundation_main.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 補助項目の定義
# ---------------------------------------------------------
new_update_func = r"""
window.updateBeamSpanProp = function(type, index, spanIdx, prop, value) {
  const fd = floorData[currentFloor];
  const beam = type === 'beam' ? fd.beams[index] : fd.perimeterBeams[index];
  if (!beam) return;
  if (!beam.spanProps) beam.spanProps = {};
  if (!beam.spanProps[spanIdx]) beam.spanProps[spanIdx] = {};
  
  const numVal = parseFloat(value);
  beam.spanProps[spanIdx][prop] = isNaN(numVal) ? value : numVal;
  
  window.openBeamStressPopup(type, index);
};
"""

common_html_func = r"""
/**
 * 基礎梁の算定レポート（算定書）HTMLを生成する共通関数
 */
window.getFoundationBeamReportHtml = function(beam, type, index, isPrinting = false) {
  const fd = floorData[currentFloor];
  const fd1 = floorData['1'] || fd;
  const sData = window.calculateFoundationHorizontalStressData ? window.calculateFoundationHorizontalStressData(beam, fd1) : null;
  const res = window.calcBeamResult(beam);
  const numSpans = sData ? sData.resL.length : 1;

  const bgColor = isPrinting ? '#ffffff' : '#121212';
  const textColor = isPrinting ? '#000' : '#ccc';
  const borderCol = isPrinting ? '#000' : '#444';
  const sectionBorder = isPrinting ? '4px solid #000' : '4px solid';
  
  const axialId = isPrinting ? `axial_p_${type}_${index}` : 'foundationAxialReactionCanvas';
  const momentId = isPrinting ? `moment_p_${type}_${index}` : 'foundationHorizontalStressCanvas';

  const calcSpanCap = (spanIdx) => {
    const sp = (beam.spanProps && beam.spanProps[spanIdx]) ? beam.spanProps[spanIdx] : { D:600, mainRebar:'2-D13', b:300, stirrup:'1-D10', pitch:200 };
    const ft = beam.ft || 195;
    const d = (sp.D || 600) - 70;
    const j = (7/8) * d;
    const getArea = (spec) => {
        if (!spec) return 253.4;
        const m = spec.match(/(\d+)-D(\d+)/);
        const map = { 10:71.3, 13:126.7, 16:198.6, 19:286.5 };
        if (spec.includes('/')) {
           const pts = spec.split('/');
           let sum = 0;
           pts.forEach(p => { 
             const mm = p.match(/(\d+)-D(\d+)/); 
             if(mm) sum += parseInt(mm[1]) * (map[mm[2]]||0);
           });
           return sum;
        }
        return m ? (parseInt(m[1]) * (map[m[2]]||0)) : 253.4;
    };
    const at = getArea(sp.mainRebar);
    const Ma = at * ft * j * 1e-6;
    const Qa = 0.5 * (sp.b || 300) * d * 0.1 * 1.5; 
    return { Ma: Ma * 1.5, Qa: Qa };
  };

  const chartScale = isPrinting ? 'width:100%; max-width:800px; height:auto;' : 'width:100%; height:auto;';

  return `
    <div style="padding:15px; font-size:11px; font-family:'MS Gothic', monospace; background:${bgColor}; color:${textColor}; border:${isPrinting?'1px solid #000':'none'}; margin-bottom:40px; page-break-after: always; text-align:left;">
      
      <div style="background:${isPrinting?'#eee': 'rgba(255,255,255,0.03)'}; padding:15px; border-radius:8px; margin-bottom:20px; border:1px solid ${borderCol}; display:flex; gap:30px; color:${isPrinting?'#000':'#fff'};">
        <div>通り番号: <span style="font-size:14px; font-weight:bold;">${beam.axis || '-'}</span></div>
        <div>符号: <span style="font-size:14px; font-weight:bold;">${beam.id}</span></div>
        <div>Lo: <b>${(res.Lo||0).toFixed(3)}</b>m</div>
        <div>負担幅 B: <b>${(res.B||0).toFixed(3)}</b>m</div>
      </div>

      <div style="margin-bottom:25px;">
        <div style="border-left:${sectionBorder} #fab1a0; padding-left:10px; margin-bottom:10px; font-weight:bold; color:#f0932b;">📉 短期軸力・反力図（加力方向別）</div>
        <div style="background:#000; padding:15px; text-align:center; border-radius:8px;">
          <canvas id="${axialId}" width="1000" height="300" style="${chartScale}"></canvas>
        </div>
      </div>

      <div style="margin-bottom:25px;">
        <div style="border-left:${sectionBorder} #a29bfe; padding-left:10px; margin-bottom:10px; font-weight:bold; color:#686de0;">📈 短期M図（地震時）</div>
        <div style="background:#000; padding:15px; text-align:center; border-radius:8px;">
          <canvas id="${momentId}" width="1000" height="220" style="${chartScale}"></canvas>
        </div>
      </div>

      <div style="margin-bottom:20px;">
        ${window.generateFoundationHorizontalStressTable ? window.generateFoundationHorizontalStressTable(beam) : ''}
      </div>

      <div style="margin-bottom:25px;">
        <div style="border-left:${sectionBorder} #e67e22; padding-left:10px; margin-bottom:10px; font-weight:bold; color:#e67e22;">梁の断面と許容耐力（詳細設定）</div>
        <table style="width:100%; border-collapse:collapse; text-align:center; border:1px solid ${borderCol};">
          <thead style="background:${isPrinting?'#f2f2f2':'#2d3436'}; color:${isPrinting?'#000':'#fff'};">
            <tr>
              <th style="border:1px solid ${borderCol}; padding:4px;">スパン</th>
              <th style="border:1px solid ${borderCol};">寸法(D/b)mm</th>
              <th style="border:1px solid ${borderCol};">主筋</th>
              <th style="border:1px solid ${borderCol};">スターラップ</th>
              <th style="border:1px solid ${borderCol};">短期Ma(kNm)</th>
              <th style="border:1px solid ${borderCol};">短期Qa(kN)</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              let rows = '';
              for(let i=0; i<numSpans; i++) {
                const sp = (beam.spanProps && beam.spanProps[i]) ? beam.spanProps[i] : { D:600, mainRebar:'2-D13', b:300, stirrup:'1-D10', pitch:200 };
                const cap = calcSpanCap(i);
                const dims = isPrinting ? `<span>${sp.D}/${sp.b}</span>` : `<input type="number" value="${sp.D}" style="width:40px;"> / <input type="number" value="${sp.b}" style="width:40px;">`;
                rows += `<tr>
                  <td style="border:1px solid ${borderCol};">スパン${i+1}</td>
                  <td style="border:1px solid ${borderCol};">${dims}</td>
                  <td style="border:1px solid ${borderCol};">${sp.mainRebar}</td>
                  <td style="border:1px solid ${borderCol};">${sp.stirrup}@${sp.pitch}</td>
                  <td style="border:1px solid ${borderCol}; font-weight:bold;">${cap.Ma.toFixed(2)}</td>
                  <td style="border:1px solid ${borderCol}; font-weight:bold;">${cap.Qa.toFixed(2)}</td>
                </tr>`;
              }
              return rows;
            })()}
          </tbody>
        </table>
      </div>

      <div style="margin-top:20px;">
        <div style="border-left:${sectionBorder} #fdcb6e; padding-left:10px; margin-bottom:10px; font-weight:bold; color:#e67e22;">⚖ 判定表（ARCHITREND形式）</div>
        <table style="width:100%; border-collapse:collapse; text-align:center; border:1px solid ${borderCol};">
          <thead style="background:${isPrinting?'#f2f2f2':'#2d3436'};">
            <tr style="height:35px;">
              <th style="border:1px solid ${borderCol};">柱間</th>
              <th style="border:1px solid ${borderCol};">長期(M/Ma)</th>
              <th style="border:1px solid ${borderCol};">短期左(M/Ma)</th>
              <th style="border:1px solid ${borderCol};">短期右(M/Ma)</th>
              <th style="border:1px solid ${borderCol};">判定</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              let rows = '';
              for(let i=0; i<numSpans; i++) {
                const sl = sData ? sData.resL[i] : {spanL:res.Lo, M_f:0, Qe:0};
                const sr = sData ? sData.resR[i] : {spanL:res.Lo, M_f:0, Qe:0};
                const cap = calcSpanCap(i);
                const spanLo = sl.spanL || res.Lo;
                const mLong = (1/8)*(beam.groundPressure||0)*(beam.tributaryWidth||0)*(spanLo**2);
                const ratLong = mLong / (cap.Ma/1.5 || 1);
                const ratL = Math.abs(sl.M_f) / (cap.Ma || 1);
                const ratR = Math.abs(sr.M_f) / (cap.Ma || 1);
                const maxRat = Math.max(ratLong, ratL, ratR);
                const color = maxRat >= 1.0 ? '#e74c3c' : (isPrinting ? '#000' : '#55efc4');
                rows += `
                  <tr style="height:35px;">
                    <td style="border:1px solid ${borderCol};">スパン${i+1}</td>
                    <td style="border:1px solid ${borderCol}; color:${ratLong>=1?'#e74c3c':''}">${ratLong.toFixed(2)}</td>
                    <td style="border:1px solid ${borderCol}; color:${ratL>=1?'#e74c3c':''}">${ratL.toFixed(2)}</td>
                    <td style="border:1px solid ${borderCol}; color:${ratR>=1?'#e74c3c':''}">${ratR.toFixed(2)}</td>
                    <td style="border:1px solid ${borderCol}; color:${color}; font-weight:bold;">${maxRat<=1.0?'OK':'NG 🔴'}</td>
                  </tr>`;
              }
              return rows;
            })()}
          </tbody>
        </table>
      </div>
    </div>
  `;
};
"""

new_popup_func = r"""
window.openBeamStressPopup = function(type, index) {
  const fd = floorData[currentFloor];
  const beam = type === 'beam' ? fd.beams[index] : fd.perimeterBeams[index];
  if (!beam) return;
  const existing = document.getElementById('beamStressModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'beamStressModal';
  modal.style.cssText = 'position:fixed; top:4vh; left:50%; transform:translateX(-50%); width:96%; max-width:1150px; max-height:92vh; background:#1e1e1e; color:#fff; border-radius:12px; z-index:9999; box-shadow:0 15px 50px rgba(0,0,0,0.8); border:1px solid #444; display:flex; flex-direction:column; overflow:hidden;';
  const reportHtml = window.getFoundationBeamReportHtml(beam, type, index, false);
  modal.innerHTML = `
    <div style="background:#1a1a2e; padding:12px 18px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333;">
      <h3 style="margin:0; font-size:15px; font-weight:bold; color:#a29bfe;">📋 基礎梁 断面検定・算定書 [${beam.id}]</h3>
      <button onclick="this.closest('#beamStressModal').remove()" style="background:none; border:none; color:#fff; font-size:24px; cursor:pointer;">&times;</button>
    </div>
    <div id="modalBody" style="flex:1; overflow-y:auto; background:#121212;">${reportHtml}</div>
    <div style="padding:15px; border-top:1px solid #333; background:#1a1a2e; text-align:right;">
       <button onclick="this.closest('#beamStressModal').remove()" style="padding:8px 25px; background:#444; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">閉じる</button>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => {
    if (window.drawFoundationBeamAxialReactionDiagram) window.drawFoundationBeamAxialReactionDiagram('foundationAxialReactionCanvas', beam);
    if (window.drawFoundationBeamHorizontalStressDiagram) window.drawFoundationBeamHorizontalStressDiagram('foundationHorizontalStressCanvas', beam);
  }, 100);
};
"""

new_report_body = r"""
  // --- 7. 基礎梁の全算定レポート (beams & perimeterBeams) ---
  let beamReportHtml = "";
  const drawCommands = [];
  const allFoundBeams = [
    ...(fd.beams || []).map((b, i) => ({ beam: b, type: 'beam', index: i })),
    ...(fd.perimeterBeams || []).map((b, i) => ({ beam: b, type: 'perimeterBeam', index: i }))
  ];
  allFoundBeams.forEach(item => {
    beamReportHtml += window.getFoundationBeamReportHtml(item.beam, item.type, item.index, true);
    drawCommands.push(() => {
       const axialId = `axial_p_${item.type}_${item.index}`;
       const momentId = `moment_p_${item.type}_${item.index}`;
       if (window.drawFoundationBeamAxialReactionDiagram) window.drawFoundationBeamAxialReactionDiagram(axialId, item.beam);
       if (window.drawFoundationBeamHorizontalStressDiagram) window.drawFoundationBeamHorizontalStressDiagram(momentId, item.beam);
    });
  });
  document.getElementById('reportContent').innerHTML = `
    <div style="padding: 20px; background: #fff;">
       <h1 style="text-align:center; border-bottom:3px solid #000; padding:10px;">構造計算書（基礎梁 算定）</h1>
       ${allTablesHtml}
       <div style="margin-top:50px;">
          <h2 style="border-left:10px solid #000; padding-left:15px; background:#eee;">7. 基礎梁の断面検定（アーキトレンド形式）</h2>
          ${beamReportHtml}
       </div>
       ${footerHtml}
    </div>
  `;
  document.getElementById('reportModal').style.display = 'flex';
  setTimeout(() => {
    drawCommands.forEach(cmd => cmd());
  }, 300);
"""

# Regex replacement
content = re.sub(r'window\.updateBeamSpanProp\s*=\s*function\(.*?\)\s*\{.*?\}\s*;', new_update_func, content, flags=re.DOTALL)

# Use simple search and replace for the parts that are difficult with regex
# First, replace the popup function
pattern_open = re.compile(r'window\.openBeamStressPopup\s*=\s*function\(type, index\)\s*\{.*?\}\s*;', re.DOTALL)
content = pattern_open.sub(new_popup_func + common_html_func, content)

# Second, replace the report logic
pattern_report = re.compile(r'// --- 基礎梁の長期応力算定セクション.*?document\.getElementById\(\'reportModal\'\)\.style\.display = \'flex\';', re.DOTALL)
content = pattern_report.sub(new_report_body, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully synced Calculation Report with new ARCHITREND beam UI.")
