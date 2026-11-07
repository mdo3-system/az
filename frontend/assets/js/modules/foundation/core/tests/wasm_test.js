// core/tests/wasm_test.js
import AppTestRunner from '../test_runner.js';
import WasmAccelerator from '../wasm_accelerator.js';
import { checkCollinear, calcPolygonAreaStrict, distToSegment, pointInPolygon } from '../geometry_utils.js';

AppTestRunner.test('Wasm: Initialization and Engine Availability', async (t) => {
  const ready = await WasmAccelerator.init();
  console.log(`[Test] Wasm ready status: ${ready}`);
  // WebAssembly対応環境であれば ready は true、Node/非対応環境でもエラーなく判定可能
  t.assertEquals(typeof WasmAccelerator.isReady, 'boolean', 'isReady should be boolean');
});

AppTestRunner.test('Wasm vs JS: checkCollinear Equality', (t) => {
  const p1 = { x: 0, y: 0 };
  const p2 = { x: 1000, y: 0 };
  const p3 = { x: 200, y: 0 };
  const p4 = { x: 800, y: 0 };

  const isCol = checkCollinear(p1, p2, p3, p4);
  t.assertEquals(isCol, true, 'Collinear segments should return true');

  const pFar = { x: 200, y: 500 };
  const isNotCol = checkCollinear(p1, p2, pFar, p4);
  t.assertEquals(isNotCol, false, 'Non-collinear segments should return false');
});

AppTestRunner.test('Wasm vs JS: calcPolygonAreaStrict Precision', (t) => {
  // 1000mm x 2000mm = 2,000,000 mm^2
  const rect = [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 2000 },
    { x: 0, y: 2000 }
  ];
  const area = calcPolygonAreaStrict(rect);
  t.assertEquals(area, 2000000, 'Rectangle area should be exactly 2,000,000');

  // Triangle (0,0)-(100,0)-(0,100) -> 5,000
  const tri = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 100 }
  ];
  const triArea = calcPolygonAreaStrict(tri);
  t.assertEquals(triArea, 5000, 'Triangle area should be 5000');
});

AppTestRunner.test('Wasm vs JS: distToSegment Precision', (t) => {
  const dist = distToSegment(50, 50, 0, 0, 100, 0);
  t.assertAlmostEqual(dist, 50, 0.001, 'Distance to segment should be 50');
});

AppTestRunner.test('Wasm vs JS: pointInPolygon Test', (t) => {
  const poly = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 }
  ];
  t.assertEquals(pointInPolygon(50, 50, poly), true, 'Inside point should return true');
  t.assertEquals(pointInPolygon(150, 50, poly), false, 'Outside point should return false');
});
