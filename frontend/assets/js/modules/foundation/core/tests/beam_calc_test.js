import runner from '../test_runner.js';
import { calculateSpanStrength, calculateSingleSpanStress } from '../beam_calc.js';

runner.test('Foundation Beam: Span Strength (Ma, Qa, Qas)', (t) => {
  // マテリアル定数 (FIXED_LOGICS.md / constants.js 準拠)
  const material = { ft: 195, fs: 0.7, fts: 295, fss: 1.05 };
  
  // ケース1: 標準的な断面
  // b=300, D=640, dt=70 -> d=570, j=498.75
  // at=253.4 (2-D13)
  // aw=142.6 (D10@200)
  // alpha=1.0 (固定値テスト)
  const span = { b: 300, D: 640, dt: 70, at: 253.4, aw: 142.6, pitch: 200, alpha: 1.0 };
  const res = calculateSpanStrength(span, material);

  const expectedD = 570;
  const expectedJ = 570 * 0.875; // 498.75
  const expectedMa = (195 * 253.4 * expectedJ) / 1000000; // 24.64 kN·m
  const expectedQa = (0.7 * 300 * expectedJ) / 1000;      // 104.74 kN
  
  // Qas = (fss*b*j + alpha*fts*(aw*j/p)) / 1000
  const term1 = (1.05 * 300 * expectedJ);
  const term2 = (1.0 * 295 * (142.6 * expectedJ / 200));
  const expectedQas = (term1 + term2) / 1000; // 261.35 kN

  t.assertAlmostEqual(res.d, expectedD, 0.1, 'Effective depth d');
  t.assertAlmostEqual(res.j, expectedJ, 0.1, 'Lever arm j');
  t.assertAlmostEqual(res.Ma, expectedMa, 0.01, 'Allowable moment Ma');
  t.assertAlmostEqual(res.Qa, expectedQa, 0.01, 'Allowable shear Qa');
  t.assertAlmostEqual(res.Qas, expectedQas, 0.01, 'Short-term shear Qas');
});

runner.test('Foundation Beam: Stress Formulas (Single Span)', (t) => {
  const w = 10.0; // 10 kN/m
  const L = 4.0;  // 4 m
  
  // 固定-固定 (M = wL^2/12 = 13.33)
  const resFF = calculateSingleSpanStress({ w, L, c1: 'fixed', c2: 'fixed' });
  t.assertAlmostEqual(resFF.M1, (w * L * L / 12), 0.01, 'Fixed-Fixed End Moment M1');
  t.assertAlmostEqual(resFF.M2, (w * L * L / 12), 0.01, 'Fixed-Fixed End Moment M2');
  t.assertAlmostEqual(resFF.Q1, (w * L / 2), 0.01, 'Fixed-Fixed Shear Q1');

  // ピン-ピン (M_mid = wL^2/8 = 20.0, M_end = 0)
  const resPP = calculateSingleSpanStress({ w, L, c1: 'pin', c2: 'pin' });
  t.assertAlmostEqual(resPP.M1, 0, 0.01, 'Pin-Pin End Moment M1');
  t.assertAlmostEqual(resPP.Mc, (w * L * L / 8), 0.01, 'Pin-Pin Center Moment Mc');
});
