// property_panel_builders.js - Facade
// プロパティパネルの生成ロジックを機能別に分割されたモジュールから再エクスポートします。

export * from './ui/prop_panel_node.js';
export * from './ui/prop_panel_column.js';
export * from './ui/prop_panel_beam.js';
export * from './ui/prop_panel_wall.js';
export * from './ui/prop_panel_slab.js';
export * from './ui/prop_panel_diaphragm.js';
export * from './ui/prop_panel_axis.js';
export * from './ui/prop_panel_multi.js';
export * from './ui/prop_panel_default.js';
export * from './ui/prop_panel_main.js';

// ※ window.* への登録は各サブモジュール内で行われています。
