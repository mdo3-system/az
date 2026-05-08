import { floorData, currentFloor, state } from './foundation_cad.js';

// data_list_ui.js - 画面下部のデータリスト生成・更新ロジック

/**
 * 下部データリスト（要素一覧）の更新
 */
export const updateDataList = function() {
  const container = document.getElementById('dataListContainer');
  const fd = floorData[currentFloor];

  if (!container || !fd || !state) return;

  if (state.currentListTab === 'columns') {
    container.innerHTML = fd.columns.map((c, i) => {
      const n = fd.nodes[c.nodeIndex];
      const isSel = state.selectedElement && state.selectedElement.type === 'column' && state.selectedElement.index === i;
      
      return `
        <div class="list-item${isSel ? ' selected' : ''}" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 8px; cursor:pointer;" onclick="selectListItem('column', ${i})">
          <div style="margin-bottom: 4px;">
            <strong style="color:var(--text-primary); font-size:12px;">符号: ${c.id || ''}</strong>
            <span style="font-size:0.85em; color:var(--text-muted); margin-left:6px;">(交点: ${n ? n.id : '?'})</span>
          </div>
          <div style="font-size:0.9em; display:flex; gap:6px;">
            <span style="color:#e74c3c;">長期(ΣP): ${(parseFloat(c.longTermAxial) || 0).toFixed(3)} kN</span>
            <span style="color:var(--text-muted);">|</span>
            <span style="color:#3498db;">短期: ${c.shortTermAxial || 0} kN</span>
          </div>
        </div>
      `;
    }).join('');
  } else if (state.currentListTab === 'beams') {
    const beamsHtml = fd.beams.map((b, i) => {
      const n1 = fd.nodes[b.n1], n2 = fd.nodes[b.n2];
      const len = n1 && n2 ? Math.round(Math.hypot(n2.x-n1.x, n2.y-n1.y)) : '-';
      const sel = state.selectedElement && state.selectedElement.type === 'beam' && state.selectedElement.index === i ? ' class="selected"' : '';
      return `<tr${sel} onclick="selectListItem('beam', ${i})"><td>${b.id}</td><td>${n1?n1.id:'?'}</td><td>${n2?n2.id:'?'}</td><td>${len}</td></tr>`;
    }).join('');

    const pBeamsHtml = (fd.perimeterBeams || []).map((pb, i) => {
      const sel = state.selectedElement && state.selectedElement.type === 'perimeterBeam' && state.selectedElement.index === i ? ' class="selected"' : '';
      const lenStr = pb.length_m ? (pb.length_m).toFixed(2) + 'm' : '-';
      return `<tr${sel} onclick="selectListItem('perimeterBeam', ${i})">
        <td style="color:var(--success); font-weight:bold;">[外周] ${pb.id}</td>
        <td colspan="2" style="text-align:center; color:var(--text-muted); font-size:10px;">(スラブ外周)</td>
        <td>${lenStr}</td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <table id="dataListTable">
        <thead id="dataListHead"><tr><th>符号</th><th>始端</th><th>終端</th><th>長さ</th></tr></thead>
        <tbody id="dataListBody">
          ${beamsHtml}
          ${pBeamsHtml}
        </tbody>
      </table>
    `;
  } else if (state.currentListTab === 'slabs') {
    let okCount = 0;
    let ngCount = 0;
    
    fd.slabs.forEach(sl => {
        // aijData が存在しない、または最新でない場合は計算を促す
        if (!sl.aijData && typeof window.calculateAndSetSlabAIJStress === 'function') {
            window.calculateAndSetSlabAIJStress(sl, fd.nodes);
        }
        
        if (sl.aijData && sl.aijData.isOK) {
            okCount++;
        } else {
            ngCount++;
        }
    });

    const summaryHtml = `
      <div style="padding:10px; background:#2c3e50; border-radius:6px; margin-bottom:10px; display:flex; justify-content:space-around; font-size:12px; border:1px solid #444;">
        <span style="color:#2ecc71; font-weight:bold;">✅ OK: ${okCount}</span>
        <span style="color:${ngCount > 0 ? '#e74c3c' : '#aaa'}; font-weight:bold;">⚠️ NG: ${ngCount}</span>
      </div>
    `;

    container.innerHTML = summaryHtml + `
      <table id="dataListTable">
        <thead id="dataListHead"><tr><th>符号</th><th>頂点</th></tr></thead>
        <tbody id="dataListBody">
          ${fd.slabs.map((sl, i) => {
            const sel = state.selectedElement && state.selectedElement.type === 'slab' && state.selectedElement.index === i ? ' class="selected"' : '';
            return `<tr${sel} onclick="selectListItem('slab', ${i})"><td>${sl.id}</td><td>${sl.nodeIds.length}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  } else if (state.currentListTab === 'diaphragms') {
    container.innerHTML = `
      <table id="dataListTable">
        <thead id="dataListHead"><tr><th>符号</th><th>面積(㎡)</th><th>Lx(m)</th><th>Ly(m)</th></tr></thead>
        <tbody id="dataListBody">
          ${(fd.diaphragms||[]).map((dia, i) => {
            const sel = state.selectedElement && state.selectedElement.type === 'diaphragm' && state.selectedElement.index === i ? ' class="selected"' : '';
            return `<tr${sel} onclick="selectListItem('diaphragm', ${i})"><td>${dia.id || `D-${i+1}`}</td><td>${dia.S ? dia.S.toFixed(1) : '-'}</td><td>${dia.Lx ? dia.Lx.toFixed(1) : '-'}</td><td>${dia.Ly ? dia.Ly.toFixed(1) : '-'}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  } else if (state.currentListTab === 'walls') {
    const walls = fd.walls || [];
    if (walls.length === 0) {
      container.innerHTML = '<div style="padding:15px; color:#999; font-size:12px; text-align:center;">壁データがありません</div>';
    } else {
      container.innerHTML = walls.map((w, idx) => {
        const n1 = fd.nodes[w.n1], n2 = fd.nodes[w.n2];
        const L = (w.lengthOverride || (n1 && n2 ? Math.hypot(n2.x - n1.x, n2.y - n1.y) : 0)) / 1000;
        const mX = w.multiplier_x !== undefined ? w.multiplier_x.toFixed(3) : '-';
        const mY = w.multiplier_y !== undefined ? w.multiplier_y.toFixed(3) : '-';
        const isSel = state.selectedElement && state.selectedElement.type === 'wall' && state.selectedElement.index === idx;

        return `
          <div class="list-item${isSel ? ' selected' : ''}" onclick="selectListItem('wall', ${idx})" style="padding:10px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer; font-size:12px;">
            <div style="font-weight:bold; color:var(--text-primary); margin-bottom:4px;">
              ${w.id || 'W' + (idx + 1)} <span style="font-weight:normal; color:var(--text-muted); margin-left:8px;">(L=${L.toFixed(3)}m)</span>
            </div>
            <div style="color:var(--text-secondary); font-size:11px;">
              倍率: <span style="color:var(--accent); font-weight:bold;">${w.multiplier || 0}</span> 
              <span style="margin-left:8px; color:var(--text-muted);">(X:${mX}, Y:${mY})</span>
            </div>
          </div>`;
      }).join('');
    }
  }

  // 選択要素への自動スクロール (Bi-directional Link)
  // 💡 プロパティ変更（handlePropChange）時はスクロールさせない
  if (window.state && window.state.shouldScrollList) {
    setTimeout(() => {
      const activeRow = container.querySelector('.selected');
      if (activeRow) {
        activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      window.state.shouldScrollList = false;
    }, 100);
  }
};

// グローバル登録
window.updateDataList = updateDataList;
