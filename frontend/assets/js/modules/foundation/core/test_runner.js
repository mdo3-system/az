/**
 * core/test_runner.js
 * 開発用ユニットテストランナー。
 * ブラウザのコンソールで `AppTestRunner.runAll()` を実行することで検証を行います。
 */
class TestRunner {
  constructor() {
    this.tests = [];
  }

  /**
   * テストケースを登録する
   * @param {string} name 
   * @param {Function} fn 
   */
  test(name, fn) {
    this.tests.push({ name, fn });
  }

  /**
   * 値の等価性を検証する
   */
  assertEquals(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message || 'Assertion failed'}: expected ${expected}, but got ${actual}`);
    }
  }

  /**
   * 数値の近似等価性を検証する (浮動小数点用)
   */
  assertAlmostEqual(actual, expected, epsilon = 0.0001, message) {
    if (Math.abs(actual - expected) > epsilon) {
      throw new Error(`${message || 'Assertion failed'}: expected near ${expected}, but got ${actual}`);
    }
  }

  /**
   * すべてのテストを実行する
   */
  async runAll() {
    console.log('%c🚀 Starting App Unit Tests...', 'color: #3498db; font-weight: bold; font-size: 14px;');
    let passed = 0;
    let failed = 0;

    for (const { name, fn } of this.tests) {
      try {
        await fn(this);
        console.log(`%c✅ PASS: ${name}`, 'color: #27ae60;');
        passed++;
      } catch (err) {
        console.error(`%c❌ FAIL: ${name}`, 'color: #e74c3c; font-weight: bold;');
        console.error(err);
        failed++;
      }
    }

    const summaryColor = failed === 0 ? '#27ae60' : '#e74c3c';
    console.log(`%c---------------------------------------`, `color: ${summaryColor};`);
    console.log(`%cSummary: ${passed} passed, ${failed} failed.`, `color: ${summaryColor}; font-weight: bold;`);
    return { passed, failed };
  }
}

const runner = new TestRunner();
export default runner;

// グローバル公開
window.AppTestRunner = runner;
