import { floorData, currentFloor } from '../foundation_cad.js';

/**
 * XLSXからNw(引張耐力検討用軸力)を読み込む
 */
export function handleNwExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('excelFileName');
  if (statusEl) statusEl.textContent = "読込中...";
  
  const reader = new FileReader();
  reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 💡 全角英数字を半角に変換し、不要な記号を除去して大文字化する
        const normalize = (s) => {
          if (!s) return "";
          let res = String(s).replace(/[！-～]/g, (ss) => String.fromCharCode(ss.charCodeAt(0) - 0xFEE0));
          return res.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        };

        const normalized_nw = {};
        
        const normalizeFloor = (f) => {
          const s = String(f).trim();
          if (!s) return "";
          if (s.includes('1')) return '1';
          if (s.includes('2')) return '2';
          if (s.includes('3')) return '3';
          if (s.includes('R') || s.includes('屋') || s.includes('小屋')) return 'R';
          if (s.includes('PH')) return 'PH';
          return s;
        };
        const targetFloor = normalizeFloor(currentFloor);
        
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          
          let lastSeenId = "";
          let lastSeenFloor = "";
          rows.forEach((row) => {
            if (!row || row.length === 0) return;
            
            const rawId = row[0] ? String(row[0]).trim() : "";
            // 💡 数値で始まる符号（2C2c等）も許容するように修正
            if (rawId && (isNaN(parseFloat(rawId)) || /^[0-9]/.test(rawId))) { 
              lastSeenId = rawId;
            }
            
            const rawFloor = row[1] ? String(row[1]).trim() : "";
            if (rawFloor) {
              lastSeenFloor = normalizeFloor(rawFloor);
            }
            
            const val = parseFloat(row[7]);
            
            if (lastSeenId && lastSeenFloor && !isNaN(val)) {
              if (lastSeenFloor === targetFloor) {
                const nid = normalize(lastSeenId);
                if (nid) normalized_nw[nid] = val; 
              }
            }
          });
        });
        
        console.log(`[Excel Import] Target Floor: ${targetFloor}, Dict size: ${Object.keys(normalized_nw).length}`);
        
        // 💡 符号を最新の通り芯ラベルに基づいて強制再生成
        if (typeof window.rebuildAllColumnIds === 'function') {
          window.rebuildAllColumnIds();
          console.log("[Excel Import] Column IDs rebuilt from grid labels.");
        }

        const fd = floorData[currentFloor];
        
        // 💡 読込前に一旦リセット
        if (fd && fd.columns) {
          fd.columns.forEach(col => {
            col.nw = 0;
            col.longTermAxial = 0;
          });
        }

        let matchCount = 0;
        if (fd && fd.columns) {
          fd.columns.forEach(col => {
            const targetId = normalize(col.id || "");
            if (!targetId) return; 

            let matchedVal = normalized_nw[targetId];
            if (matchedVal !== undefined) {
              col.nw = matchedVal;
              col.longTermAxial = matchedVal;
              matchCount++;
            }
          });
        }
        
        const cFloor = currentFloor || window.currentFloor || "1";
        const floorName = String(cFloor).includes('PH') ? 'PH' : (cFloor + 'F');
        const totalColumns = fd ? fd.columns.length : 0;
        
        // 💡 符号が一致しなかった柱を特定
        const unmatchedIds = [];
        if (fd && fd.columns) {
          fd.columns.forEach(col => {
            const targetId = normalize(col.id || "");
            if (targetId && normalized_nw[targetId] === undefined) {
              unmatchedIds.push(col.id || "(不明)");
            }
          });
        }

        const reportMsg = `✓ 符号一致: ${matchCount} / 全体: ${totalColumns} (${floorName})`;
        
        console.log(`[Excel Import] ${reportMsg}`, { 
          matchCount, 
          totalColumns, 
          unmatchedCount: unmatchedIds.length,
          unmatchedList: unmatchedIds 
        });
        
        if (statusEl) {
          statusEl.innerHTML = `<strong>${reportMsg}</strong>`;
          statusEl.style.color = (matchCount === totalColumns && totalColumns > 0) ? "#2ecc71" : "#f39c12"; 
          statusEl.style.fontSize = "11px";
        }

        if (typeof window.pushHistory === 'function') window.pushHistory();
        if (typeof window.updatePropertyPanel === 'function') window.updatePropertyPanel();
        if (typeof window.updateDataList === 'function') window.updateDataList();
        if (typeof window.callRender === 'function') window.callRender();

      } catch (err) {
        console.error("[Excel Import ERROR]", err);
        if (statusEl) {
          statusEl.textContent = "⚠ 読込エラー: " + err.message;
          statusEl.style.color = "#e74c3c";
        }
      }
  };
  reader.onerror = (err) => {
    console.error("[FileReader ERROR]", err);
    if (statusEl) statusEl.textContent = "⚠ ファイル読込失敗";
  };
  reader.readAsArrayBuffer(file);
  event.target.value = '';
}

// 💡 グローバル登録 (HTMLのonchangeから呼び出すため)
window.handleNwExcelUpload = handleNwExcelUpload;
