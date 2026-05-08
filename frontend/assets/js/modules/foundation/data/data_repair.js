// data/data_repair.js

/**
 * プロジェクトデータの不備を修復・初期化する
 */
export function repairFoundationData(data) {
  if (!data) return;
  
  // グローバル設定の欠落を補完 (1Fに保持)
  if (data['1'] && !data['1'].globalDiaphragmSpecs) {
    data['1'].globalDiaphragmSpecs = {
      'PH': { roof: 1.96, floor: 7.84 },
      'R':  { roof: 1.96, floor: 7.84 },
      '3':  { roof: 1.96, floor: 7.84 },
      '2':  { roof: 1.96, floor: 7.84 },
      '1':  { roof: 1.96, floor: 7.84 }
    };
  }
  
  // 各階層のデータ修復
  Object.keys(data).forEach(f => {
    const fd = data[f];
    if (fd && fd.nodes) {
      // ノードのインデックス再割り当て
      fd.nodes.forEach((n, i) => { 
          if (n && n.index === undefined) n.index = i; 
      });
    }
  });
}
