import runner from '../test_runner.js';
import { calcSkewedDiaphragmModel } from '../diaphragm_skew_calc.js';

runner.test('Diaphragm: Skewed Model (QE, QW Calculation)', (t) => {
  // テスト用データ (矩形の水平構面を想定)
  const nodes = [
    { x: 0, y: 0 },
    { x: 5000, y: 0 },
    { x: 5000, y: 4000 },
    { x: 0, y: 4000 }
  ];
  const diaphragm = { id: 'D1', nodeIds: [0, 1, 2, 3], delta_qa: 2.0 };
  const allDiaphragms = [diaphragm];
  
  // 耐力壁線 (x=0, x=5000)
  const wallNodes = [
    { x: 0, y: 0 }, { x: 0, y: 4000 },
    { x: 5000, y: 0 }, { x: 5000, y: 4000 }
  ];
  const walls = [
    { n1: 0, n2: 1, multiplier: 5.0, axisName: 'Y1', isExterior: true },
    { n1: 2, n2: 3, multiplier: 5.0, axisName: 'Y2', isExterior: true }
  ];

  const skewedAxis = { angle: 0, label: 'Standard', p1: { x: 0, y: 0 }, p2: { x: 5000, y: 0 } };
  
  const result = calcSkewedDiaphragmModel({
    diaphragm, allDiaphragms, nodes, walls, wallNodes,
    skewedAxis, hasIntermediateWall: false,
    allSkewedAxes: [skewedAxis]
  });

  // h = 4.0m, L = 5.0m
  // alpha = h >= 12 ? 1.0 : (h >= 8 ? 0.8 : 0.6) -> 0.6
  const alpha = 0.6;
  const dqa = 2.0;
  const h = 4.0;
  const L = 5.0;

  // QE = 0.24 * alpha * dqa * h * L
  const expectedQE = 0.24 * alpha * dqa * h * L; // 0.24 * 0.6 * 2.0 * 4.0 * 5.0 = 2.88
  // QW = 1.7 * alpha * L
  const expectedQW = 1.7 * alpha * L; // 1.7 * 0.6 * 5.0 = 5.1

  t.assertEquals(result.axisLabel, 'Standard', 'Axis label match');
  t.assertAlmostEqual(result.xDir.spans[0].QE, expectedQE, 0.01, 'QE calculation');
  t.assertAlmostEqual(result.xDir.spans[0].QW, expectedQW, 0.01, 'QW calculation');
});
