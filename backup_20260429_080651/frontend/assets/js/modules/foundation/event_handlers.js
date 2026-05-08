// event_handlers.js - Facade
// イベントハンドラとUI同期ロジックを機能別に分割されたモジュールから再エクスポートします。

export * from './events/main_setup.js';
export * from './events/load_sync.js';
export * from './events/beam_ui_handlers.js';
export * from './events/global_handlers.js';

// ※ window.* への登録は各サブモジュール内で行われています。
