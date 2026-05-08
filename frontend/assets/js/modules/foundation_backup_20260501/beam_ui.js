import { floorData, currentFloor } from './foundation_cad.js';
import { handlePropChange } from './state_manager.js';
import { makeDraggable } from './ui_utils.js';

// 1. 梁ポップアップの一時データ保存
export const saveBeamPopupData = function(type, index, field, value) {
    const fd = floorData[currentFloor];
    if (!fd) return;
    
    if (field === 'anchorJType') {
        fd.anchorJType = value;
    } else {
        const b = type === 'beam' ? fd.beams[index] : fd.perimeterBeams[index];
        if (!b) return;
        
        if (field === 'axisName') {
            b.axisName = value;
            b.axis = value; // 💡 BUGFIX: 応力計算エンジンが参照する古いプロパティ名(axis)にも同時に保存する
            if (typeof window.handlePropChange === 'function') window.handlePropChange(type, index, 'axisName', value);
        } else if (field === 'anchorM12') {
            b.anchorM12 = parseInt(value) || 0;
        } else if (field === 'anchorM16') {
            b.anchorM16 = parseInt(value) || 0;
        } else if (field === 'showReport') {
            b.showReport = (value === true || value === 'true');
        }
    }

    if (typeof window.updatePropertyPanel === 'function') window.updatePropertyPanel();
    setTimeout(() => { window.openBeamStressPopup(type, index); }, 50);
};

// 2. 梁の応力詳細ポップアップを開く
export const openBeamStressPopup = function(type, index) {
  window.floorData = floorData;
  window.currentFloor = currentFloor;

  window.highlightedBeamType = type;
  window.highlightedBeamIndex = index;
  if (typeof window.callRender === 'function') window.callRender();

  const fd = floorData[currentFloor];
  const beam = type === 'beam' ? fd.beams[index] : fd.perimeterBeams[index];
  if (!beam) return;

  if (!fd.anchorJType) fd.anchorJType = 'J1';
  if (beam.anchorM12 === undefined) beam.anchorM12 = 0;
  if (beam.anchorM16 === undefined) beam.anchorM16 = 0;
  if (beam.showReport === undefined) beam.showReport = true;

  const ANCHOR_MASTER = {
      'J1': { M12: 9.180, M16: 16.320 },
      'J2': { M12: 8.620, M16: 15.330 },
      'J3': { M12: 8.020, M16: 14.260 }
  };
  const jData = ANCHOR_MASTER[fd.anchorJType] || ANCHOR_MASTER['J1'];
  
  const n1Obj = fd.nodes[beam.n1];
  const n2Obj = fd.nodes[beam.n2];
  const axisCoord = (n1Obj && n2Obj) ? `${n1Obj.id} - ${n2Obj.id}` : (beam.axis || '不明');
  
  let lastScroll = 0;
  const existing = document.getElementById('beamStressModal');
  if (existing) {
    const scrollContent = document.getElementById('beamStressModalContent');
    if (scrollContent) lastScroll = scrollContent.scrollTop;
    existing.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'beamStressModal';
  modal.style.cssText = 'position:fixed; top:5vh; left:50%; transform:translateX(-50%); width:94%; max-width:1200px; max-height:90vh; background:#1e1e1e; color:#fff; border-radius:10px; z-index:9999; box-shadow:0 10px 40px rgba(0,0,0,0.6); border:1px solid #444; display:flex; flex-direction:column; overflow:hidden;';

  window.updatePopupValue = function(prop, value) {
     if (prop === 'width' || prop === 'depth' || prop === 'dt' || prop === 'ft') {
        beam[prop === 'depth' ? 'depth' : (prop === 'width' ? 'width' : prop)] = parseFloat(value);
        window.handlePropChange(type, index, prop === 'depth' ? 'depth' : (prop === 'width' ? 'width' : (prop === 'ft' ? 'ft' : prop)), parseFloat(value));
     } else if (prop === 'topRebar' || prop === 'bottomRebar') {
        beam[prop] = value;
        window.handlePropChange(type, index, prop, value);
     } else if (prop === 'stirrup' || prop === 'pitch') {
        if (prop === 'stirrup') beam.stirrupRebar = value;
        if (prop === 'pitch') beam.stirrupPitch = parseInt(value) || 200;
        window.handlePropChange(type, index, prop === 'stirrup' ? 'stirrupRebar' : 'stirrupPitch', prop === 'stirrup' ? value : beam.stirrupPitch);
     }
     if (typeof window.syncSlabDataToBeams === 'function') window.syncSlabDataToBeams();
     window.openBeamStressPopup(type, index);
  };

  const headerHtml = `
  <div id="beam-modal-header" style="background:#2c3e50; padding:10px 15px; display:flex; justify-content:space-between; align-items:center; cursor:grab;">
    <div style="display:flex; align-items:center; gap:20px; pointer-events:none;">
      <h3 style="margin:0; font-size:14px; text-shadow:1px 1px #000;">🔍 通り芯: ${axisCoord} (${beam.id}) - 応力詳細・算定書</h3>
      <label style="font-size:11px; color:#e67e22; cursor:pointer; display:flex; align-items:center; gap:4px; pointer-events:auto;">
        <input type="checkbox" ${beam.showReport ? 'checked' : ''} 
               onchange="window.saveBeamPopupData('${type}', ${index}, 'showReport', this.checked)" 
               style="margin:0; width:14px; height:14px;"> 帳票出力
      </label>
    </div>
    <button onclick="window.closeBeamStressPopup()" style="background:none; border:none; color:#fff; font-size:18px; cursor:pointer; pointer-events:auto;">&times;</button>
  </div>
`;

  const mainRebars = typeof REBAR_MASTER !== 'undefined' ? REBAR_MASTER.mainRows : [ {value:'D13',label:'2-D13'} ];
  const stirrups = typeof REBAR_MASTER !== 'undefined' ? REBAR_MASTER.stirrups : [ {value:'D10',label:'D10'} ];

  const res = window.calcBeamResult ? window.calcBeamResult(beam) : {};

  const contentHtml = `
    <div id="beamStressModalContent" style="padding:15px; flex:1; overflow-y:auto; font-size:11px; font-family:var(--mono); color:#fff; background:#1e1e1e;">
      
      <!-- 1. ヘッダー情報 -->
      <div style="background:rgba(255,255,255,0.05); padding:10px 15px; border-radius:6px; margin-bottom:15px; border-left:4px solid var(--accent); display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span>通り芯: <span style="color:var(--accent); font-weight:bold;">${axisCoord}</span></span>
          <span>符号: <span style="color:var(--accent); font-weight:bold;">${beam.id}</span></span>
          <span style="margin-left: 10px; font-size:11px; color:#aaa;">通り名(壁と連動):</span>
          <input type="text" value="${beam.axisName || beam.axis || ''}" onchange="window.saveBeamPopupData('${type}', ${index}, 'axisName', this.value)" placeholder="例: X1" style="width:80px; padding:4px; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
        </div>
        <div style="text-align:right;">
          スパン Lo: <b>${(res.Lo || 0).toFixed(3)}</b> m　
          負担幅 B (最大): <b>${(res.B || 0).toFixed(3)}</b> m　
          負担面積 Area: <b>${(beam.tributaryArea || 0).toFixed(3)}</b> ㎡　
          接地圧 σe (最大): <b>${(res.sigma || 0).toFixed(3)}</b> kN/m²
        </div>
      </div>


      <!-- 2. 短期応力 Canvas -->
      <div style="margin-bottom:20px;">
        <div style="color:var(--accent); font-weight:bold; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
          <span style="font-size:16px;">📈</span> 水平荷重時応力図 (短期)
        </div>
        <div style="background:#000; border:1px solid #444; border-radius:8px; padding:15px;">
          <canvas id="foundationHorizontalStressCanvas" width="1000" height="420" style="background:#000; width:100%; height:auto;"></canvas>
        </div>
      </div>

      <!-- 3. 短期応力算定表 (Td, R, Qe, Mf) -->
      ${window.generateFoundationHorizontalStressTable ? window.generateFoundationHorizontalStressTable(beam, type, index) : ''}

      <!-- 4. アンカーボルト設定と通り別検定 (Task 4.6) -->
      <div style="margin-top:20px; padding:15px; background:rgba(46,204,113,0.1); border:1px solid rgba(46,204,113,0.3); border-radius:8px;">
        <h4 style="margin:0 0 10px 0; font-size:13px; color:#2ecc71; border-bottom:1px solid rgba(46,204,113,0.2); padding-bottom:5px;">⚓ アンカーボルト設定・検定 (${beam.axisName || beam.axis || '通り名未設定'})</h4>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; margin-bottom:15px;">
          <div>
            <label style="color:#aaa; font-size:10px;">土台樹種 (全体連動):</label><br>
            <select onchange="window.saveBeamPopupData('${type}', ${index}, 'anchorJType', this.value)" style="width:100%; padding:6px; background:#333; color:#fff; border:1px solid #555; border-radius:4px; font-size:11px;">
              <option value="J1" ${fd.anchorJType === 'J1' ? 'selected' : ''}>J1 (ヒノキ等)</option>
              <option value="J2" ${fd.anchorJType === 'J2' ? 'selected' : ''}>J2 (ツガ等)</option>
              <option value="J3" ${fd.anchorJType === 'J3' ? 'selected' : ''}>J3 (スギ等)</option>
            </select>
          </div>
          <div>
            <label style="color:#aaa; font-size:10px;">M12本数 (この梁):</label><br>
            <input type="number" value="${beam.anchorM12}" onchange="window.saveBeamPopupData('${type}', ${index}, 'anchorM12', this.value)" style="width:100%; padding:6px; background:#333; color:#fff; border:1px solid #555; border-radius:4px; font-size:11px;">
          </div>
          <div>
            <label style="color:#aaa; font-size:10px;">M16本数 (この梁):</label><br>
            <input type="number" value="${beam.anchorM16}" onchange="window.saveBeamPopupData('${type}', ${index}, 'anchorM16', this.value)" style="width:100%; padding:6px; background:#333; color:#fff; border:1px solid #555; border-radius:4px; font-size:11px;">
          </div>
        </div>

        ${(() => {
          const axis = beam.axisName || beam.axis;
          if (!axis) return '<div style="font-size:11px; color:#888;">※通り名が設定されていないため、集計検定を行えません。</div>';

          let totalM12 = 0, totalM16 = 0;
          [...(fd.beams||[]), ...(fd.perimeterBeams||[])].forEach(b => {
             if ((b.axisName || b.axis) === axis) {
               totalM12 += (b.anchorM12 || 0);
               totalM16 += (b.anchorM16 || 0);
             }
          });
          const sumQaa = (totalM12 * jData.M12) + (totalM16 * jData.M16);

          let qaX = 0, qaY = 0;
          fd.walls.forEach(wall => {
            if (wall.axisName === axis) {
              const len = wall.lengthOverride ? parseFloat(wall.lengthOverride) : (wall.length_m ? wall.length_m * 1000 : 0);
              qaX += (wall.multiplier_x || 0) * 1.96 * (len / 1000);
              qaY += (wall.multiplier_y || 0) * 1.96 * (len / 1000);
            }
          });
          const sumQa = Math.max(qaX, qaY);
          const ratio = sumQaa > 0 ? (sumQa / sumQaa) : (sumQa > 0 ? 9.999 : 0);
          const isOk = ratio <= 1.0;

          return `
            <div style="background:rgba(0,0,0,0.3); padding:12px; border-radius:6px; font-size:11px; border:1px solid rgba(255,255,255,0.05);">
              <div style="font-weight:bold; color:#2ecc71; margin-bottom:8px; border-bottom:1px solid rgba(46,204,113,0.2); padding-bottom:4px;">📊 ${axis} 通り全体での集計検定</div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:#aaa;">検討方向 (壁耐力最大):</span>
                <span>${qaX >= qaY ? 'X方向' : 'Y方向'}</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:#aaa;">壁せん断力合計 ΣQa:</span>
                <span style="font-weight:bold;">${sumQa.toFixed(3)} kN</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:#aaa;">アンカー耐力合計 ΣQaa (${totalM12} / ${totalM16}):</span>
                <span style="font-weight:bold; color:#2ecc71;">${sumQaa.toFixed(3)} kN</span>
              </div>
              <div style="border-top:1px solid #444; margin-top:8px; padding-top:8px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:bold;">検定比 (ΣQa / ΣQaa):</span>
                <span style="font-size:16px; font-weight:bold; color:${isOk?'#2ecc71':'#e74c3c'};">${ratio.toFixed(3)}</span>
                <span style="background:${isOk?'#2ecc71':'#e74c3c'}; color:white; padding:2px 10px; border-radius:12px; font-size:11px; font-weight:bold;">${isOk?'OK':'NG'}</span>
              </div>
            </div>
          `;
        })()}
      </div>

    </div>
    <div style="padding:10px; border-top:1px solid #444; display:flex; justify-content:flex-end; background:#252525;">
      <button style="padding:6px 20px; background:#444; color:#fff; border:none; border-radius:4px; cursor:pointer;" onclick="window.closeBeamStressPopup()">閉じる</button>
    </div>
  `;

  modal.innerHTML = headerHtml + contentHtml;
  document.body.appendChild(modal);
  
  // ドラッグ機能を有効化
  makeDraggable(modal, modal.querySelector('#beam-modal-header'));
  
  if (lastScroll > 0) {
    const scrollContent = document.getElementById('beamStressModalContent');
    if (scrollContent) scrollContent.scrollTop = lastScroll;
  }

  setTimeout(() => {
    if (window.drawBeamStressOnCanvas) {
       window.drawBeamStressOnCanvas('foundationHorizontalStressCanvas', beam);
    }
  }, 50);
};


// 4. 梁ポップアップを閉じる
export const closeBeamStressPopup = function() {
    const existing = document.getElementById('beamStressModal');
    if (existing) existing.remove();

    window.highlightedBeamType = null;
    window.highlightedBeamIndex = null;
    if (typeof window.callRender === 'function') window.callRender();
};

// 5. 梁スパンプロパティ更新
export const updateBeamSpanProp = function(type, index, spanIndex, prop, value) {
  const fd = floorData[currentFloor];
  const beam = type === 'beam' ? fd.beams[index] : fd.perimeterBeams[index];
  if (!beam) return;

  if (!beam.spans && beam.spanProps) {
      beam.spans = JSON.parse(JSON.stringify(beam.spanProps));
  }
  if (!beam.spans) beam.spans = [];
  if (!beam.spans[spanIndex]) beam.spans[spanIndex] = {};

  const parsedValue = (prop === 'topRebar' || prop === 'bottomRebar' || prop === 'stirrup') ? value : parseFloat(value);
  beam.spans[spanIndex][prop] = parsedValue;

  // 💡 保存（JSON永続化）用に spanProps にも同期
  if (!beam.spanProps) beam.spanProps = [];
  beam.spanProps[spanIndex] = Object.assign({}, beam.spans[spanIndex]);

  if (prop === 'D') beam.depth = parsedValue;
  if (prop === 'b') beam.width = parsedValue;
  if (prop === 'dt') beam.dt = parsedValue;

  console.log(`[スパン更新] ${type}[${index}] Span[${spanIndex}] ${prop} = ${value}`);

  if (['b', 'D', 'dt'].includes(prop)) {
    if (typeof window.syncSlabDataToBeams === 'function') window.syncSlabDataToBeams();
  }

  window.openBeamStressPopup(type, index);
};

// 6. 梁主筋の分割更新ハンドラ
export const handleBeamRebarPartChange = function(type, index, spanIndex, prop, newValue, part) {
    const fd = floorData[currentFloor];
    const beam = type === 'beam' ? fd.beams[index] : fd.perimeterBeams[index];
    if (!beam || !beam.spans || !beam.spans[spanIndex]) return;

    const currentVal = beam.spans[spanIndex][prop] || '2-D16';
    // 💡 既存の組合せ配筋（+を含む）がある場合でも、分割して現在の本数と径を推測
    const match = String(currentVal).match(/(?:(\d+)-)?(D\d+.*)/);
    let count = match ? (match[1] || '1') : '2';
    let dia = match ? match[2] : 'D16';

    if (part === 'count') count = newValue;
    if (part === 'dia') dia = newValue;

    // 💡 dia 自体に '+' が含まれる場合でも ${count}-${dia} 形式にする
    // 例: count=1, dia=D13+D16 -> 1-D13+D16
    const combined = `${count}-${dia}`;
    window.updateBeamSpanProp(type, index, spanIndex, prop, combined);
};

// グローバル登録
window.saveBeamPopupData = saveBeamPopupData;
window.openBeamStressPopup = openBeamStressPopup;
window.closeBeamStressPopup = closeBeamStressPopup;
window.updateBeamSpanProp = updateBeamSpanProp;
window.handleBeamRebarPartChange = handleBeamRebarPartChange;
