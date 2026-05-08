// events/global_handlers.js
import { floorData, currentFloor } from '../foundation_cad.js';
import { callRender } from '../rendering_helpers.js';

// バックエンドURL: Live Server(5500)、file://プロトコル、その他いずれの場合もlocalhost:8000を使用
const API_BASE_URL = (window.location.protocol === 'file:' || window.location.port !== '8000')
    ? 'http://127.0.0.1:8000'
    : window.location.origin;

export const updateDefaultWallMultiplier = function(val) {
  if (state) state.defaultWallMultiplier = Math.min(7.0, Math.max(0, parseFloat(val) || 1.0));
};

export const handleNwPdfUpload = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('pdfStatus');
  if (statusEl) statusEl.textContent = "読込中...";
  const formData = new FormData(); formData.append('file', file);
  try {
    const resp = await fetch(`${API_BASE_URL}/api/v1/upload-nw-pdf`, { method:'POST', body:formData });
    if (!resp.ok) throw new Error('解析失敗');
    const data = await resp.json();
    const nw_dict = data.nw_dict || {};
    const fd = (window.allFloorData && window.allFloorData[currentFloor]) || (window.floorData && window.floorData[currentFloor]) || floorData[currentFloor];
    let count = 0;
    fd.columns.forEach(col => {
      const val = (nw_dict[currentFloor] && nw_dict[currentFloor][col.id]) ?? nw_dict[col.id];
      if (val !== undefined && val !== null) { col.nw = parseFloat(val); count++; }
    });
    if (statusEl) statusEl.textContent = `✓ ${count}件完了`;
    callRender(); 
    if (typeof window.updatePropertyPanel === 'function') window.updatePropertyPanel();
    if (typeof window.updateDataList === 'function') window.updateDataList();
  } catch (err) { if (statusEl) statusEl.textContent = "⚠ エラー"; }
  event.target.value = '';
};

export const handleNwExcelUpload = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const statusEl = document.getElementById('excelFileName');
  if (statusEl) statusEl.textContent = "読込中...";
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const normalize = (s) => String(s).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const normalized_nw = {};
      
      // 全シートをループしてデータを収集
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        let lastSeenId = "";
        rows.forEach((row) => {
          if (!row || row.length === 0) return;
          
          // A列(0)にIDがあれば更新。なければ直前のIDを維持
          const rawId = row[0] ? String(row[0]).trim() : "";
          if (rawId && isNaN(parseFloat(rawId))) { 
            lastSeenId = rawId;
          }
          
          // B列(1)に階数情報があるかチェック
          const rowFloor = row[1] ? String(row[1]).trim() : "";
          
          // H列(7)に集計値(ΣP)があるかチェック
          const val = parseFloat(row[7]);
          
          if (lastSeenId && !isNaN(val)) {
            // 現在の階と一致するか、または階情報がない場合のみ採用
            if (!rowFloor || rowFloor === currentFloor) {
              normalized_nw[normalize(lastSeenId)] = val;
            }
          }
        });
      });
      
      console.log(`[Excel Import] Floor: ${currentFloor}, Scanned ${workbook.SheetNames.length} sheets. Dict size: ${Object.keys(normalized_nw).length}`);
      
      // マッチング前に最新のIDに更新
      if (typeof window.rebuildAllColumnIds === 'function') {
        window.rebuildAllColumnIds();
      }

      const fd = floorData[currentFloor];
      let count = 0;
      fd.columns.forEach(col => {
        const targetId = normalize(col.id || "");
        let matchedVal = normalized_nw[targetId];
        
        if (matchedVal === undefined) {
          // 部分一致試行
          for (let key in normalized_nw) {
            if (targetId.endsWith(key) || key.endsWith(targetId)) {
               matchedVal = normalized_nw[key];
               break;
            }
          }
        }

        if (matchedVal !== undefined) {
          col.nw = matchedVal;
          col.longTermAxial = matchedVal; // 表示用プロパティにも反映
          count++;
        }
      });
      
      console.log(`[Excel Import] Match count: ${count} / Total columns: ${fd.columns.length}`);
      
      if (statusEl) statusEl.textContent = `✓ ${count}件のNwを更新しました (${currentFloor}F)`;
      
      // 表示と履歴の更新
      if (typeof window.pushHistory === 'function') window.pushHistory();
      if (typeof window.updatePropertyPanel === 'function') window.updatePropertyPanel();
      if (typeof window.updateDataList === 'function') window.updateDataList();
      if (typeof window.callRender === 'function') window.callRender();
    } catch (err) {
      console.error('Excel読込失敗:', err);
      if (statusEl) statusEl.textContent = "⚠ エラー";
    }
  };
  reader.readAsArrayBuffer(file);
  event.target.value = '';
};

window.handleNwPdfUpload = handleNwPdfUpload;
window.handleNwExcelUpload = handleNwExcelUpload;
