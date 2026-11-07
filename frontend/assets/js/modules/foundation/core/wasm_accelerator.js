// frontend/assets/js/modules/foundation/core/wasm_accelerator.js
/**
 * WasmAccelerator: WebAssembly 幾何・構造計算アクセラレーター
 * 
 * 【設計方針】
 * 1. ゼロインパクト設計: Wasm の有無に関わらず、既存の JavaScript 処理と 100% 互換動作します。
 * 2. 透過的フォールバック: ロード失敗・非対応環境・無効化時は自動的に純粋な JS 実装へフォールバックします。
 * 3. 開発容易性: `window.WasmAccelerator.enabled = false` や URL に `?wasm=0` を付与することで、
 *    開発・デバッグ時はいつでも即座に JS 実行へ切り替え可能です。
 */

class WasmAcceleratorService {
  constructor() {
    this.isSupported = typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiate === 'function';
    this.isReady = false;
    this.enabled = true;
    this.exports = null;
    this.memory = null;
    this.memoryF64 = null;
    this.memoryPtr = 0; // スクラッチ領域オフセット (バイト)
    this.loadPromise = null;

    // URLパラメータ (?wasm=0) による無効化チェック
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      if (window.location.search.includes('wasm=0') || window.location.search.includes('nowasm')) {
        this.enabled = false;
        console.log('[WasmAccelerator] Disabled via URL query parameter.');
      }
    }
  }

  /**
   * Wasm バイナリを非同期ロードして初期化
   * @param {string} wasmUrl 
   */
  async init(wasmUrl = './assets/wasm/az_geometry.wasm') {
    if (!this.isSupported || !this.enabled) {
      console.log('[WasmAccelerator] WebAssembly not supported or disabled. Using pure JS engine.');
      return false;
    }

    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        let response;
        // 相対パスの柔軟な解決（呼び出し階層に応じたフォールバック）
        const candidateUrls = [
          wasmUrl,
          './assets/wasm/az_geometry.wasm',
          '../assets/wasm/az_geometry.wasm',
          '/assets/wasm/az_geometry.wasm',
          'frontend/assets/wasm/az_geometry.wasm'
        ];

        let fetched = null;
        let wasmBuffer = null;

        // Node.js テスト環境サポート
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
          try {
            const fs = await import('fs');
            const path = await import('path');
            const searchPaths = [
              path.resolve('frontend/assets/wasm/az_geometry.wasm'),
              path.resolve('../assets/wasm/az_geometry.wasm'),
              path.resolve('./assets/wasm/az_geometry.wasm')
            ];
            for (const p of searchPaths) {
              if (fs.existsSync(p)) {
                wasmBuffer = fs.readFileSync(p);
                break;
              }
            }
          } catch (_) {}
        }

        if (!wasmBuffer) {
          for (const url of candidateUrls) {
            try {
              response = await fetch(url);
              if (response.ok) {
                fetched = response;
                break;
              }
            } catch (_) {
              // 次の候補を試行
            }
          }
        }

        if (!fetched && !wasmBuffer) {
          console.warn('[WasmAccelerator] Could not load az_geometry.wasm from candidates. Gracefully using JS fallback.');
          return false;
        }

        let wasmModule;
        if (wasmBuffer) {
          wasmModule = await WebAssembly.instantiate(wasmBuffer);
        } else if (WebAssembly.instantiateStreaming) {
          try {
            wasmModule = await WebAssembly.instantiateStreaming(fetched.clone());
          } catch (_) {
            const buffer = await fetched.arrayBuffer();
            wasmModule = await WebAssembly.instantiate(buffer);
          }
        } else {
          const buffer = await fetched.arrayBuffer();
          wasmModule = await WebAssembly.instantiate(buffer);
        }

        this.exports = wasmModule.instance.exports;
        this.memory = this.exports.memory;
        this.memoryF64 = new Float64Array(this.memory.buffer);
        this.isReady = true;

        console.log('%c⚡ [WasmAccelerator] WebAssembly Core Initialized Successfully (az_geometry.wasm)', 'color: #27ae60; font-weight: bold;');
        return true;
      } catch (err) {
        console.warn('[WasmAccelerator] Wasm initialization failed. Fallback to JS.', err);
        this.isReady = false;
        return false;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Wasm 加速の有効/無効切り替え
   */
  setEnabled(val) {
    this.enabled = !!val;
    console.log(`[WasmAccelerator] Enabled state changed to: ${this.enabled}`);
  }

  // ==========================================
  // 高速幾何計算インターフェース (Wasm / JS ハイブリッド)
  // ==========================================

  /**
   * 4点からなる2線分が共線（同一直線上）にあるか高速判定
   */
  checkCollinear(p1, p2, p3, p4, eps = 20.0) {
    if (this.isReady && this.enabled) {
      return this.exports.check_collinear(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y, eps) === 1;
    }
    // JS フォールバック
    const area1 = Math.abs((p2.x - p1.x)*(p3.y - p1.y) - (p2.y - p1.y)*(p3.x - p1.x));
    const area2 = Math.abs((p2.x - p1.x)*(p4.y - p1.y) - (p2.y - p1.y)*(p4.x - p1.x));
    return area1 < eps * 1000 && area2 < eps * 1000;
  }

  /**
   * 高速2点間距離 (hypot)
   */
  fastHypot(dx, dy) {
    if (this.isReady && this.enabled) {
      return this.exports.fast_hypot(dx, dy);
    }
    return Math.hypot(dx, dy);
  }

  /**
   * 多角形ポリゴンの厳密面積計算 (Shoelace)
   */
  calcPolygonAreaStrict(poly) {
    if (!poly || poly.length < 3) return 0;

    if (this.isReady && this.enabled && poly.length <= 2048) {
      // 共有メモリへ座標を展開
      const count = poly.length;
      if (this.memoryF64.buffer !== this.memory.buffer) {
        this.memoryF64 = new Float64Array(this.memory.buffer);
      }
      for (let i = 0; i < count; i++) {
        this.memoryF64[i * 2] = poly[i].x;
        this.memoryF64[i * 2 + 1] = poly[i].y;
      }
      return this.exports.calc_polygon_area(0, count);
    }

    // JS フォールバック
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      area += (p1.x * p2.y - p2.x * p1.y);
    }
    return Math.abs(area) * 0.5;
  }

  /**
   * 点と線分の最短距離
   */
  pointToSegmentDist(p, segStart, segEnd) {
    if (this.isReady && this.enabled) {
      return this.exports.point_to_segment_dist(p.x, p.y, segStart.x, segStart.y, segEnd.x, segEnd.y);
    }
    const dx = segEnd.x - segStart.x;
    const dy = segEnd.y - segStart.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-12) return Math.hypot(p.x - segStart.x, p.y - segStart.y);
    const t = Math.max(0, Math.min(1, ((p.x - segStart.x) * dx + (p.y - segStart.y) * dy) / lenSq));
    return Math.hypot(p.x - (segStart.x + t * dx), p.y - (segStart.y + t * dy));
  }

  /**
   * 点の多角形内包判定 (Ray casting)
   */
  pointInPolygon(p, poly) {
    if (!poly || poly.length < 3) return false;

    if (this.isReady && this.enabled && poly.length <= 2048) {
      const count = poly.length;
      if (this.memoryF64.buffer !== this.memory.buffer) {
        this.memoryF64 = new Float64Array(this.memory.buffer);
      }
      for (let i = 0; i < count; i++) {
        this.memoryF64[i * 2] = poly[i].x;
        this.memoryF64[i * 2 + 1] = poly[i].y;
      }
      return this.exports.point_in_polygon(p.x, p.y, 0, count) === 1;
    }

    // JS フォールバック
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
}

export const WasmAccelerator = new WasmAcceleratorService();
if (typeof window !== 'undefined') {
  window.WasmAccelerator = WasmAccelerator;
}
export default WasmAccelerator;
