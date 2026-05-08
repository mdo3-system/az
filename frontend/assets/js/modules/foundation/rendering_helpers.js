// rendering_helpers.js - Facade
// 描画関連のヘルパー関数を機能別に分割されたモジュールから再エクスポートします。

export * from './rendering/view_manager.js';
export * from './rendering/diagram_renderer.js';
export * from './rendering/projection_utils.js';

// viewport_manager.js からのエクスポート
export { 
  canvas, ctx, W, H, viewState,
  worldToScreen, screenToWorld, setPanScale, initCanvas, resizeCanvas
} from './rendering/viewport_manager.js';

// geometry_utils.js からのエクスポート
export {
  distToSegment, pointInPolygon
} from './core/geometry_utils.js';

// ※ window.* への登録は各サブモジュール内で行われています。
