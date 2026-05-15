// ui_utils.js - 共通定数・ユーティリティ・XSS対策
export const REBAR_AREA = { 'D10': 71.3, 'D13': 126.7, 'D16': 198.6, 'D19': 286.5, 'D22': 387.1 };

export const calculateRebarArea = (rebarStr, pitchValue) => {
    if (!rebarStr) return 0;
    const areas = { 10: 71.33, 13: 126.67, 16: 198.64, 19: 286.52, 22: 387.12 };
    let str = rebarStr.toUpperCase().replace(/\s+/g, '');
    let pitch = parseFloat(pitchValue);

    // 文字列内に @ がある場合は、それを優先してパース
    const atMatch = str.match(/@(\d+)$/);
    if (atMatch) {
        pitch = parseFloat(atMatch[1]);
        str = str.split('@')[0];
    }

    if (!pitch || pitch <= 0) return 0;

    // パターン1: 交互配筋 (例: D10D13, D10+D13, D10/D13, D10・D13)
    const altMatch = str.match(/D(\d+)(?:[・+／\/]+D?|D)(\d+)/);
    if (altMatch) {
        const d1 = parseInt(altMatch[1]);
        const d2 = parseInt(altMatch[2]);
        const a1 = areas[d1] || 0;
        const a2 = areas[d2] || 0;
        // 💡 BUGFIX: 交互配筋は2つの鉄筋の「平均面積」で計算する
        return ((a1 + a2) / 2) * (1000 / pitch);
    }

    // パターン2: 単一配筋 (例: D13)
    const singleMatch = str.match(/D(\d+)/);
    if (singleMatch) {
        const d = parseInt(singleMatch[1]);
        const a = areas[d] || 0;
        return a * (1000 / pitch);
    }

    return 0;
};

export const generateOptions = (arr, val) => arr.map(a => `<option value="${a}" ${String(a) === String(val) ? 'selected' : ''}>${a}</option>`).join('');

export const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') return String(str);
    return str.replace(/[&<>'"]/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[match]);
};

/**
 * 指定した要素をドラッグ可能にする
 * @param {HTMLElement} element 移動させる要素
 * @param {HTMLElement} handle ドラッグを開始するハンドル要素
 */
export const makeDraggable = (element, handle) => {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  const dragMouseDown = (e) => {
    e = e || window.event;
    // テキスト選択や画像ドラッグを防止
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
    
    if (handle) handle.style.cursor = 'grabbing';
  };

  const elementDrag = (e) => {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
    // 中央寄せを解除
    element.style.transform = 'none';
    element.style.margin = '0';
  };

  const closeDragElement = () => {
    document.onmouseup = null;
    document.onmousemove = null;
    if (handle) handle.style.cursor = 'grab';
  };

  if (handle) {
    handle.style.cursor = 'grab';
    handle.onmousedown = dragMouseDown;
  } else {
    element.onmousedown = dragMouseDown;
  }
};

/**
 * ID指定で安全に要素を削除する
 */
export const safeRemoveById = (id) => {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) {
    try {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      } else {
        el.remove();
      }
    } catch (e) {
      // 既に別のプロセス（blurイベント等）で削除されている場合は無視する
      console.warn('[safeRemoveById] Error during removal (already detached?):', id, e);
    }
  }
};
