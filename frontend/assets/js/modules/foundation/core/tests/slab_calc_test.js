import runner from '../test_runner.js';
import { calculateSlabStress, calculateSlabTributary } from '../slab_calc.js';

runner.test('Slab: Stress Calculation (AIJ Coefficients)', (t) => {
  const sigma_e = 30.0;
  const lx = 2.0; // 2m
  const ly = 3.0; // 3m
  
  // lx < ly なので lx=2.0, ly=3.0
  // sigma_ex = (ly^4 / (lx^4 + ly^4)) * sigma_e
  const sigma_ex = (Math.pow(ly, 4) / (Math.pow(lx, 4) + Math.pow(ly, 4))) * sigma_e;
  // (81 / (16 + 81)) * 30 = (81 / 97) * 30 = 25.0515...

  // 4辺固定
  const resFixed = calculateSlabStress(sigma_e, lx, ly, 'fixed_all');
  // Mx1 (端部X) = 1/12 * sigma_ex * lx^2
  // Mx2 (中央X) = 1/18 * sigma_ex * lx^2
  // My1 (端部Y) = 1/24 * sigma_e  * lx^2
  // My2 (中央Y) = 1/36 * sigma_e  * lx^2
  
  t.assertAlmostEqual(resFixed.Mx1, (1/12) * sigma_ex * lx * lx, 0.001, '4-side fixed Mx1');
  t.assertAlmostEqual(resFixed.Mx2, (1/18) * sigma_ex * lx * lx, 0.001, '4-side fixed Mx2');
  t.assertAlmostEqual(resFixed.My1, (1/24) * sigma_e  * lx * lx, 0.001, '4-side fixed My1');
  t.assertAlmostEqual(resFixed.My2, (1/36) * sigma_e  * lx * lx, 0.001, '4-side fixed My2');
});

runner.test('Slab: Tributary Multiplier (1.33 for Triangles)', (t) => {
  const nodes = [
    { x: 0, y: 0 },
    { x: 2000, y: 0 },
    { x: 1000, y: 2000 }
  ];
  const slab = {
    nodeIds: [0, 1, 2],
    triangleMultiplier: 1.33 // 明示的に指定 (default 1.33)
  };
  const beams = []; // 荷重受け渡し用

  // 面積 = (2 * 2) / 2 = 2 m2
  calculateSlabTributary(slab, nodes, beams);

  // 辺0-1 (長さ 2.0m)
  // 負担幅 B = (Area * 1.33) / L = (2 * 1.33) / 2 = 1.33
  t.assertAlmostEqual(slab.edgeLs[0], 1.33, 0.01, 'Triangle base tributary width');
});
