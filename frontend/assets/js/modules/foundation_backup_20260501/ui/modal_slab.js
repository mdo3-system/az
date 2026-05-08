// ui/modal_slab.js
import { floorData, currentFloor } from '../foundation_cad.js';
import { generateOptions, escapeHtml, makeDraggable } from '../ui_utils.js';

/**
 * --- 3. スラブ (Slab) モーダル & エディタ ---
 */
export const openSlabDetailModal = (index) => {
    const existingModal = document.getElementById('slab-modal-overlay');
    if (existingModal && existingModal.parentNode) existingModal.remove();

    window.highlightedSlabIndex = index;
    if (typeof window.callRender === 'function') window.callRender();

    const fd = (window.allFloorData && window.allFloorData[currentFloor]) || (window.floorData && window.floorData[currentFloor]) || floorData[currentFloor];
    if (!fd || !fd.slabs) return;
    const sl = fd.slabs[index];
    if (!sl) return;

    if (!sl.aijData && typeof window.calculateAndSetSlabAIJStress === 'function') {
        window.calculateAndSetSlabAIJStress(sl, fd.nodes);
    }
    const data = sl.aijData || {};

    const resultText = data.isOK ? "判定：OK" : "判定：NG";
    const badgeColor = data.isOK ? "#27ae60" : "#e74c3c";
    const color_s = (data.ratioX > 1.0) ? "#e74c3c" : "#aaa";
    const color_l = (data.ratioY > 1.0) ? "#e74c3c" : "#aaa";

    const modal = document.createElement('div');
    modal.id = 'slab-modal-overlay';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); display:flex; justify-content:center; align-items:center; z-index:10000;';
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal && modal.parentNode) {
            window.closeSlabDetailModal();
        }
    });

    const content = document.createElement('div');
    content.className = 'modal-content';
    content.style.cssText = 'width:90%; max-width:1000px; height:85%; background:white; border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,0.3); display:flex; flex-direction:column; overflow:hidden; color:#333; border: 1px solid #ccc; position:fixed;';

    const thicknesses = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];
    const fts = [180, 195, 210, 225, 240];

    content.innerHTML = `
        <div id="slab-modal-header" style="display:flex; justify-content:space-between; align-items:center; padding:20px 25px; border-bottom:1px solid #eee; background:#f8f9fa; flex-shrink:0; cursor:grab;">
          <h2 style="margin:0; font-size:20px; display:flex; align-items:center; gap:12px; color:#2c3e50; pointer-events:none;">
            <span style="font-size:24px;">📄</span> スラブ符号: 
            <input type="text" 
                   value="${escapeHtml(sl.id)}" 
                   onchange="window.handlePropChange('slab', ${index}, 'id', this.value)" 
                   style="font-size:18px; padding:4px 8px; width:140px; border:1px solid #ccc; border-radius:4px; background:white; color:#333; pointer-events:auto;">
            の断面検定
            <span style="background:${badgeColor}; color:white; padding:2px 10px; border-radius:20px; font-size:14px; margin-left:15px; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                ${resultText}
            </span>
          </h2>
          <div style="display:flex; align-items:center; gap:20px;">
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer; background:#fff; padding:6px 12px; border:1px solid #ccc; border-radius:4px; box-shadow:0 1px 3px rgba(0,0,0,0.1); pointer-events:auto;">
              <input type="checkbox" ${sl.showReport !== false ? 'checked' : ''} 
                     onchange="window.handlePropChange('slab', ${index}, 'showReport', this.checked)" 
                     style="transform:scale(1.2); margin:0;">
              <strong style="color:#c0392b; font-size:14px;">帳票出力</strong>
            </label>
            <button onclick="window.closeSlabDetailModal()" style="background:transparent; border:none; color:#999; font-size:28px; cursor:pointer; line-height:1; pointer-events:auto;">&times;</button>
          </div>
        </div>

        <div style="flex-grow:1; overflow-y:auto; padding:25px;">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:25px; margin-bottom:30px;">
            <div style="background:#f8f9fa; padding:20px; border-radius:10px; border:1px solid #e9ecef;">
              <h3 style="margin-top:0; font-size:14px; color:#495057; border-bottom:2px solid #dee2e6; padding-bottom:8px; margin-bottom:15px; display:flex; align-items:center; gap:8px;">🛠️ 基本設計条件</h3>
              <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <tr><td style="padding:6px 0; color:#6c757d;">計算式</td><td style="text-align:right; color:#212529;">AIJ 略算式 (4辺固定等)</td></tr>
                <tr><td style="padding:6px 0; color:#6c757d;">支持条件</td><td style="text-align:right;">
                    <select onchange="window.handlePropChange('slab', ${index}, 'supportCondition', this.value)" style="background:#fff; color:#333; border:1px solid #ced4da; border-radius:4px; padding:3px 8px; font-size:12px; max-width:140px;">
                        ${generateOptions(['自動判定', '4辺固定', '3辺固定1辺ピン（長辺ピン）', '3辺固定1辺ピン（短辺ピン）', '2辺隣辺固定2辺ピン', '2辺長辺固定2辺ピン', '2辺短辺固定2辺ピン', '1辺固定3辺ピン（長辺固定）', '4辺ピン', '片持ち（跳出し）'], (window.normalizeSupportCondition ? window.normalizeSupportCondition(data.cond || '4辺固定') : (data.cond || '4辺固定')))}
                    </select>
                </td></tr>
                <tr><td style="padding:6px 0; color:#6c757d;">有効スパン</td><td style="text-align:right; color:#212529;">lx = ${(data.lx||0).toFixed(3)} m / ly = ${(data.ly||0).toFixed(3)} m</td></tr>
                <tr><td style="padding:6px 0; color:#6c757d; width:120px;">スラブ厚 (t)</td><td style="text-align:right;">
                    <select onchange="window.handlePropChange('slab', ${index}, 't', this.value)" style="background:#fff; color:#333; border:1px solid #ced4da; border-radius:4px; padding:3px 8px; font-size:13px;">${generateOptions(thicknesses, (data.t || 150))}</select> <span style="color:#666;">mm</span>
                </td></tr>
                <tr><td style="padding:6px 0; color:#6c757d;">鉄筋重心 (dt)</td><td style="text-align:right;">
                    <input type="number" step="5" value="${data.dt !== undefined ? data.dt : 70}" onchange="window.handlePropChange('slab', ${index}, 'dt', this.value)" style="width:60px; text-align:right; background:#fff; color:#333; border:1px solid #ced4da; border-radius:4px; padding:3px 8px; font-size:13px;"> <span style="color:#666;">mm</span>
                </td></tr>
              </table>
            </div>
            <div style="background:#f8f9fa; padding:20px; border-radius:10px; border:1px solid #e9ecef;">
              <h3 style="margin-top:0; font-size:14px; color:#495057; border-bottom:2px solid #dee2e6; padding-bottom:8px; margin-bottom:15px; display:flex; align-items:center; gap:8px;">📐 設計荷重・材料</h3>
              <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <tr><td style="padding:6px 0; color:#6c757d;">設計接地圧 (q)</td><td style="text-align:right;">
                    <input type="number" step="0.001" value="${(data.w !== undefined ? data.w : 30.0).toFixed(3)}" onchange="window.handlePropChange('slab', ${index}, 'groundPressure', this.value)" style="width:90px; text-align:right; background:#fff; color:#333; border:1px solid #ced4da; border-radius:4px; padding:3px 8px; font-size:13px; font-weight:bold; color:#007bff;"> <span style="color:#666; font-size:10px;">kN/m²</span>
                </td></tr>
                <tr><td style="padding:4px 0; color:#6c757d;">鉄筋材料 (ft)</td><td style="text-align:right;">
                    <select onchange="window.handlePropChange('slab', ${index}, 'ft', this.value)" style="background:#fff; color:#333; border:1px solid #ced4da; border-radius:4px; padding:3px 8px; font-size:13px;">${generateOptions(fts, (data.ft || 195))}</select>
                </td></tr>
                <tr><td style="padding:8px 0; color:#6c757d;">${data.shortLabel}配筋</td><td style="text-align:right;">
                    <select onchange="window.handlePropChange('slab', ${index}, 'shortRebar', this.value)" style="background:#fff; border:1px solid #ced4da; border-radius:4px; padding:2px;">${generateOptions(['D10','D13','D16','D10+D13','D13+D16'], data.sR)}</select>
                    @<select onchange="window.handlePropChange('slab', ${index}, 'shortPitch', this.value)" style="background:#fff; border:1px solid #ced4da; border-radius:4px; padding:2px;">${generateOptions([75,100,150,200,300], data.sP)}</select>
                    <div style="color:${data.ratioX > 1.0 ? '#e74c3c' : '#27ae60'}; font-weight:bold; font-size:11px; margin-top:4px;">検定比: ${(data.ratioX||0).toFixed(2)} (NG:${data.ratioX > 1.0 ? '有' : '無'})</div>
                </td></tr>
                <tr><td style="padding:8px 0; color:#6c757d;">${data.longLabel}配筋</td><td style="text-align:right;">
                    <select onchange="window.handlePropChange('slab', ${index}, 'longRebar', this.value)" style="background:#fff; border:1px solid #ced4da; border-radius:4px; padding:2px;">${generateOptions(['D10','D13','D16','D10+D13','D13+D16'], data.lR)}</select>
                    @<select onchange="window.handlePropChange('slab', ${index}, 'longPitch', this.value)" style="background:#fff; border:1px solid #ced4da; border-radius:4px; padding:2px;">${generateOptions([75,100,150,200,300], data.lP)}</select>
                    <div style="color:${data.ratioY > 1.0 ? '#e74c3c' : '#27ae60'}; font-weight:bold; font-size:11px; margin-top:4px;">検定比: ${(data.ratioY||0).toFixed(2)} (NG:${data.ratioY > 1.0 ? '有' : '無'})</div>
                </td></tr>
              </table>
            </div>
          </div>

          <div style="text-align: right; margin-bottom: 5px;">
            <button id="copy-btn" 
                    onclick="window.copySlabCalcToClipboard()" 
                    style="padding:8px 15px; background:#34495e; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px; display:inline-flex; align-items:center; gap:5px; transition: background 0.2s;">
                📋 計算結果をコピー
            </button>
          </div>

          <style>
            .calc-container { background: #f8f9fa; padding:20px; border-radius:10px; border:1px solid #dee2e6; color: #333; }
            .calc-section-title { margin: 20px 0 10px 0; font-size:15px; color:#27ae60; border-bottom:2px solid #27ae60; padding-bottom:5px; }
            .calc-section-title:first-child { margin-top: 0; }
            .calc-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; background: white; }
            .calc-table th, .calc-table td { border: 1px solid #dee2e6; padding: 10px 12px; text-align: left; }
            .calc-table th { background: #f1f3f5; color: #495057; width: 25%; }
            .calc-table td { color: #212529; }
            .calc-status { font-weight: bold; font-size: 14px; }
          </style>
          <div class="calc-container">
            <h3 class="calc-section-title">🔍 [1] 設計条件</h3>
            <table class="calc-table">
              <tr><th>スラブ厚 (t)</th><td>${data.t || 0} mm</td><th>有効高 (d)</th><td>${((data.t||0)-(data.dt||0)).toFixed(1)} mm</td></tr>
              <tr><th>基準強度 (Ft)</th><td>${data.ft || 0} kN/m²</td><th>単位荷重 (w)</th><td>${(data.w||0).toFixed(2)} kN/m²</td></tr>
            </table>

            <h3 class="calc-section-title">🔍 [2] 応力算定</h3>
            <table class="calc-table">
              <tr><th>短辺スパン (lx)</th><td>${(data.lx||0).toFixed(3)} m</td><th>長辺スパン (ly)</th><td>${(data.ly||0).toFixed(3)} m</td></tr>
              <tr><th>辺長比 (λ=ly/lx)</th><td>${(data.lambda||0).toFixed(3)}</td><th>支持条件</th><td>${data.cond || ''}</td></tr>
              <tr>
                <th>${data.shortLabel} モーメント (M)</th><td>端部: ${(data.Mx1||0).toFixed(2)} / 中央: ${(data.Mx2||0).toFixed(2)} <small>kN・m</small></td>
                <th>${data.longLabel} モーメント (M)</th><td>端部: ${(data.My1||0).toFixed(2)} / 中央: ${(data.My2||0).toFixed(2)} <small>kN・m</small></td>
              </tr>
            </table>

            <h3 class="calc-section-title">🔍 [3] 断面検定 (必要鉄筋量 at vs 現行配筋量 At)</h3>
            <table class="calc-table">
              <thead>
                <tr style="background: #e9ecef;">
                  <th style="width:20%;">検討区分</th>
                  <th style="width:20%;">必要 at <small>(mm²/m)</small></th>
                  <th style="width:20%;">現行 At <small>(mm²/m)</small></th>
                  <th style="width:20%;">検定比</th>
                  <th style="width:20%;">最終判定</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${data.shortLabel}方向</td>
                  <td>${(data.reqAtX||0).toFixed(1)}</td>
                  <td>${(data.actualAtX||0).toFixed(1)}</td>
                  <td style="color:${color_s === '#aaa' ? '#333' : color_s};" class="calc-status">${(data.ratioX||0).toFixed(3)}</td>
                  <td style="color:${color_s === '#aaa' ? '#27ae60' : color_s};" class="calc-status">${data.ratioX <= 1.0 ? 'OK' : 'NG'}</td>
                </tr>
                <tr>
                  <td>${data.longLabel}方向</td>
                  <td>${(data.reqAtY||0).toFixed(1)}</td>
                  <td>${(data.actualAtY||0).toFixed(1)}</td>
                  <td style="color:${color_l === '#aaa' ? '#333' : color_l};" class="calc-status">${(data.ratioY||0).toFixed(3)}</td>
                  <td style="color:${color_l === '#aaa' ? '#27ae60' : color_l};" class="calc-status">${data.ratioY <= 1.0 ? 'OK' : 'NG'}</td>
                </tr>
              </tbody>
            </table>
            <div style="font-size:11px; color:#6c757d; text-align:right;">※計算式: AIJ略算式 (C・w・lx²) 準拠 / 有効せい d=${((data.t||0)-(data.dt||0)).toFixed(1)}mm / j=7/8d</div>
          </div>
        </div>

        <div style="padding:15px 25px; border-top:1px solid #eee; background:#f8f9fa; text-align:right; flex-shrink:0;">
          <button onclick="window.closeSlabDetailModal()" style="padding:10px 30px; background:#495057; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px; transition: background 0.2s; pointer-events:auto;">閉じる</button>
        </div>
    `;
    modal.appendChild(content);
    document.body.appendChild(modal);
    makeDraggable(content, content.querySelector('#slab-modal-header'));
};

export const openSlabEditor = (index) => {
    const existing = document.getElementById('slab-editor-modal');
    if(existing && existing.parentNode) existing.remove();

    const currentFloorKey = (window.currentFloor || '1');
    const fd = (window.allFloorData && window.allFloorData[currentFloorKey]) || (window.floorData && window.floorData[currentFloorKey]);
    if (!fd || !fd.slabs || !fd.slabs[index]) return;
    const sl = fd.slabs[index];

    if (typeof window.calculateAndSetSlabAIJStress === 'function') {
        window.calculateAndSetSlabAIJStress(sl, fd.nodes);
    }
    const data = sl.aijData || {};

    const thicknesses = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];
    const rebars = ['D10', 'D13', 'D16', 'D10+D13', 'D13+D16'];
    const pitches = [75, 100, 150, 200, 300];

    const actualArea_x = (data.actualAtX || 0);
    const actualArea_y = (data.actualAtY || 0);

    const MaX = actualArea_x * (data.ft || 195) * (data.j || 1) * 1e-6;
    const MaY = actualArea_y * (data.ft || 195) * (data.j || 1) * 1e-6;

    let calcHtml = '<div style="color:#c0392b; padding:20px; font-weight:bold;">応力計算不可</div>';
    if (data.lx) {
        calcHtml = `
          <div style="background:#fff; padding:20px; border:1.5px solid #000; border-radius:6px; height:100%; color:#000; overflow-y:auto;">
            <div style="margin-bottom:15px; line-height:1.7; font-size:14px; border-left:5px solid #2980b9; padding-left:15px; background:#f9f9f9;">
              <strong>【グレー本準拠 断面検定】</strong><br>
              支持：<span style="color:#2980b9; font-weight:bold;">${data.cond}</span> / lx=${data.lx.toFixed(3)}m, ly=${data.ly.toFixed(3)}m<br>
              w=${data.w.toFixed(3)} kN/m², 有効せい d=${(data.t - data.dt).toFixed(1)}mm, j=${data.j.toFixed(2)}mm
            </div>
            
            <div style="margin-bottom:15px; font-weight:bold; border-bottom:2px solid #333; color:#34495e;">■ ${data.shortLabel}方向</div>
            <div style="border:1.5px solid #ccc; padding:12px; border-radius:4px; background:#fff; margin-bottom:20px;">
                <div style="color:#2980b9; font-size:12px; font-weight:bold;">配筋: ${data.sR}@${data.sP}</div>
                <div style="font-size:13px; margin:4px 0;">端部(x1) = ${data.Mx1.toFixed(2)} / 中央(x2) = ${data.Mx2.toFixed(2)} <small>kN･m</small></div>
                <div style="font-size:13px;">Ma = ${MaX.toFixed(2)} kN･m</div>
                <div style="margin-top:5px; text-align:right;">検定比 = <strong style="color:${data.ratioX<=1?'#27ae60':'#c0392b'}; font-size:18px;">${data.ratioX.toFixed(2)}</strong></div>
            </div>

            <div style="margin-bottom:15px; font-weight:bold; border-bottom:2px solid #333; color:#34495e;">■ ${data.longLabel}方向</div>
            <div style="border:1.5px solid #ccc; padding:12px; border-radius:4px; background:#fff;">
                <div style="color:#27ae60; font-size:12px; font-weight:bold;">配筋: ${data.lR}@${data.lP}</div>
                <div style="font-size:13px; margin:4px 0;">端部(y1) = ${data.My1.toFixed(2)} / 中央(y2) = ${data.My2.toFixed(2)} <small>kN･m</small></div>
                <div style="font-size:13px;">Ma = ${MaY.toFixed(2)} kN･m</div>
                <div style="margin-top:5px; text-align:right;">検定比 = <strong style="color:${data.ratioY<=1?'#27ae60':'#c0392b'}; font-size:18px;">${data.ratioY.toFixed(2)}</strong></div>
            </div>
          </div>
        `;
    }

    const overlay = document.createElement('div');
    overlay.id = 'slab-editor-modal';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:10000; display:flex; justify-content:center; align-items:center;';
    
    const content = document.createElement('div');
    content.className = 'modal-content';
    content.style.cssText = 'background:#eee; width:1000px; max-width:98vw; height:700px; border-radius:8px; box-shadow:0 20px 40px rgba(0,0,0,0.6); display:flex; flex-direction:column; overflow:hidden; color:#000; position:fixed;';
    
    const normalizedCond = (typeof window.normalizeSupportCondition === 'function') ? window.normalizeSupportCondition(sl.supportCondition || '自動判定') : (sl.supportCondition || '自動判定');

    content.innerHTML = `
      <div id="slab-editor-header" style="background:#34495e; color:#fff; padding:15px 25px; display:flex; justify-content:space-between; align-items:center; cursor:grab;">
        <h2 style="margin:0; font-size:20px; pointer-events:none;">基礎スラブ 断面検定エディタ [${sl.id || 'S'}]</h2>
        <button onclick="window.closeSlabEditor();" style="background:#c0392b; color:#fff; border:none; padding:10px 20px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:16px; pointer-events:auto;">✕ 閉じる</button>
      </div>
      <div style="display:flex; flex:1; overflow:hidden;">
        <div style="flex:0 0 380px; border-right:2px solid #ccc; padding:15px; overflow-y:auto; background:#fff; color:#000; font-size:13px;">
          <div style="margin-bottom:12px; padding:10px; background:#f9ebea; border:1px solid #e6b0aa; border-radius:4px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" ${sl.showReport !== false ? 'checked' : ''} onchange="window.handlePropChange('slab', ${index}, 'showReport', this.checked)" style="transform:scale(1.2);">
              <strong style="color:#c0392b;">計算書に出力する</strong>
            </label>
          </div>
          <div style="margin-bottom:12px;"><span style="display:inline-block; width:90px; font-weight:bold;">符号 (ID)</span>
            <input value="${escapeHtml(sl.id)}" onchange="window.handlePropChange('slab', ${index}, 'id', this.value)" style="width:230px; padding:6px; border:1px solid #333; color:#000;"></div>
          <div style="margin-bottom:12px;"><span style="display:inline-block; width:90px; font-weight:bold;">支持条件</span>
            <select onchange="window.handlePropChange('slab', ${index}, 'supportCondition', this.value)" style="width:230px; padding:6px; border:1px solid #333; color:#000;">${generateOptions(['自動判定', '4辺固定', '3辺固定1辺ピン（長辺ピン）', '3辺固定1辺ピン（短辺ピン）', '2辺隣辺固定2辺ピン', '2辺長辺固定2辺ピン', '2辺短辺固定2辺ピン', '1辺固定3辺ピン（長辺固定）', '4辺ピン', '片持ち（跳出し）'], normalizedCond)}</select></div>
          
          <div style="border:1.5px solid #2980b9; padding:10px; background:#f0f7ff; border-radius:6px; margin-bottom:15px;">
            <div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid #2980b9; color:#2980b9;">断面寸法</div>
            <div style="margin-bottom:8px;"><span style="display:inline-block; width:100px;">厚さ D</span><select onchange="window.handlePropChange('slab', ${index}, 'D', this.value)" style="width:90px; padding:4px; border:1px solid #333;">${generateOptions(thicknesses, (data.t || 150))}</select> mm</div>
            <div><span style="display:inline-block; width:100px;">有効高 dt</span><input type="number" value="${data.dt}" onchange="window.handlePropChange('slab', ${index}, 'dt', this.value)" style="width:90px; padding:4px; border:1px solid #333; text-align:right;"> mm</div>
          </div>

          <div style="border:1.5px solid #8e44ad; padding:10px; background:#f9f0ff; border-radius:6px; margin-bottom:15px;">
            <div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid #8e44ad; color:#8e44ad;">配筋設定：短辺方向</div>
            <div style="display:flex; gap:10px; margin-bottom:8px;">
               <div style="flex:1;">
                 <div style="font-size:11px; color:#666;">径</div>
                 <select onchange="window.handlePropChange('slab', ${index}, 'shortRebar', this.value)" style="width:100%; padding:3px; border:1px solid #333; margin-bottom:4px;">${generateOptions(['D10', 'D13', 'D16', 'D10+D13', 'D13+D16'], data.sR)}</select>
               </div>
               <div style="flex:1;">
                 <div style="font-size:11px; color:#666;">ピッチ</div>
                 <select onchange="window.handlePropChange('slab', ${index}, 'shortPitch', this.value)" style="width:100%; padding:3px; border:1px solid #333;">${generateOptions([75, 100, 150, 200, 300], data.sP)}</select>
               </div>
            </div>
          </div>

          <div style="border:1.5px solid #27ae60; padding:10px; background:#f4fdf7; border-radius:6px;">
            <div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid #27ae60; color:#27ae60;">配筋設定：長辺方向</div>
            <div style="display:flex; gap:10px;">
               <div style="flex:1;">
                 <div style="font-size:11px; color:#666;">径</div>
                 <select onchange="window.handlePropChange('slab', ${index}, 'longRebar', this.value)" style="width:100%; padding:3px; border:1px solid #333; margin-bottom:4px;">${generateOptions(['D10', 'D13', 'D16', 'D10+D13', 'D13+D16'], data.lR)}</select>
               </div>
               <div style="flex:1;">
                 <div style="font-size:11px; color:#666;">ピッチ</div>
                 <select onchange="window.handlePropChange('slab', ${index}, 'longPitch', this.value)" style="width:100%; padding:3px; border:1px solid #333;">${generateOptions([75, 100, 150, 200, 300], data.lP)}</select>
               </div>
            </div>
          </div>

        </div>
        <div style="flex:1; padding:20px; overflow-y:auto; background:#ddd;">${calcHtml}</div>
      </div>
    `;
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    makeDraggable(content, content.querySelector('#slab-editor-header'));
};

export const closeSlabDetailModal = () => {
    const modal = document.getElementById('slab-modal-overlay');
    if (modal && modal.parentNode) {
        modal.remove();
        window.highlightedSlabIndex = null;
        if (typeof window.callRender === 'function') window.callRender();
    }
};

export const closeSlabEditor = () => {
    const modal = document.getElementById('slab-editor-modal');
    if (modal && modal.parentNode) modal.remove();
    document.querySelectorAll('.property-panel, #property-panel, .ui-dialog').forEach(el => {
        el.style.visibility = 'visible';
        el.style.pointerEvents = 'auto';
    });
    if (typeof window.deselectElement === 'function') window.deselectElement();
};

export const copySlabCalcToClipboard = () => {
    const calcArea = document.querySelector('#slab-modal-overlay [style*="overflow-y:auto"]');
    if (!calcArea) return;
    const text = calcArea.innerText;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('copy-btn');
        if (btn) {
            const originalText = btn.innerText;
            btn.innerText = '✅ コピー完了！';
            btn.style.background = '#27ae60';
            setTimeout(() => {
                btn.innerText = originalText;
                btn.style.background = '#34495e';
            }, 2000);
        }
    }).catch(err => {
        console.error('コピー失敗:', err);
        alert('コピーに失敗しました。');
    });
};

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeSlabDetailModal();
        closeSlabEditor();
    }
});

window.openSlabDetailModal = openSlabDetailModal;
window.openSlabEditor = openSlabEditor;
window.closeSlabDetailModal = closeSlabDetailModal;
window.closeSlabEditor = closeSlabEditor;
window.copySlabCalcToClipboard = copySlabCalcToClipboard;
