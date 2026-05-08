// foundation_calc.js - Facade (薄いラッパー)
// 既存のインポート元や window.* 登録を維持しつつ、機能別に分割されたモジュールを再エクスポートします。

export * from './core/constants.js';
export * from './core/geometry_utils.js';
export * from './core/beam_calc.js';
export * from './core/slab_calc.js';
export * from './core/column_calc.js';
export * from './core/data_tools.js';
export * from './core/diaphragm_skew_calc.js';

// ※ window.* への登録は各サブモジュール内で行われています。
