/**
 * core/event_bus.js
 * モジュール間通信を管理するシンプルなイベントバス。
 * 疎結合なアーキテクチャを実現するために使用します。
 */
class EventBus {
  constructor() {
    this.listeners = {};
  }

  /**
   * イベントを購読する
   * @param {string} eventName 
   * @param {Function} callback 
   */
  on(eventName, callback) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(callback);
    return () => this.off(eventName, callback);
  }

  /**
   * イベントの購読を解除する
   */
  off(eventName, callback) {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName] = this.listeners[eventName].filter(cb => cb !== callback);
  }

  /**
   * イベントを発火する
   * @param {string} eventName 
   * @param {any} data 
   */
  emit(eventName, data) {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName].forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`Error in event listener for ${eventName}:`, err);
      }
    });
  }
}

// シングルトンとしてエクスポート
const bus = new EventBus();
export default bus;

// グローバルアクセス用（移行期間用）
window.AppEventBus = bus;
