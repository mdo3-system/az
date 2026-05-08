/**
 * Foundation Table Generator Facade
 * 各種計算表・レポート生成関数のラッパー。本体は ./report/ 配下に分割。
 */

export * from './report/report_slab.js';
export * from './report/report_beam.js';
export * from './report/report_summary.js';

// window.* 登録は各サブモジュール内で行われています。
