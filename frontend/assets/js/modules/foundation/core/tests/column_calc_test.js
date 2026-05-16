/**
 * core/tests/column_calc_test.js
 */
import runner from '../test_runner.js';
import { calculateColumnT } from '../column_calc.js';

runner.test('calculateColumnT - Direction Tolerance (1mm buffer)', (t) => {
  const floorData = {
    nodes: {
      'node-c': { x: 1000, y: 1000 },
      'node-r': { x: 2000.5, y: 1000 }, // 0.5mm ズレ (Right)
      'node-l': { x: 0, y: 1000 }
    },
    walls: [
      { n1: 'node-c', n2: 'node-r', multiplier: 1.0, multiplier_x: 1.0, multiplier_y: 0, axisName: 'X1', length_m: 1.0 }
    ],
    columns: [{ id: 'C1', nodeIndex: 'node-c' }]
  };

  const allFloorData = { '1': floorData };
  const res = calculateColumnT(0, floorData, '1', allFloorData, ['1']);

  t.assertEquals(res.cases[0].q2_Hi, 0, '0.5mm shift should not be counted as Right due to 1mm buffer');
});

runner.test('calculateColumnT - Multi-floor Axial Summation', (t) => {
  // 2階建てのデータをシミュレート
  const floorList = ['2', '1'];
  const allFloorData = {
    '2': {
      nodes: { 'n2': { x: 1000, y: 1000 }, 'n2-r': { x: 2000, y: 1000 } },
      walls: [
        // 2階に 1.0倍の壁 (X方向) -> Ni = 1.96 * 1.0 * 2.73 * 0.5(Bi) = 2.6754 kN
        { n1: 'n2', n2: 'n2-r', multiplier: 1.0, multiplier_x: 1.0, multiplier_y: 0, axisName: 'X1', length_m: 1.0 }
      ],
      columns: [{ id: 'C2', nodeIndex: 'n2', heightOverride: 2730 }],
      floorHeight: 2730
    },
    '1': {
      nodes: { 'n1': { x: 1000, y: 1000 } },
      walls: [], // 1階には壁なし
      columns: [{ id: 'C1', nodeIndex: 'n1', heightOverride: 2730 }],
      floorHeight: 2730
    }
  };

  const res = calculateColumnT(0, allFloorData['1'], '1', allFloorData, floorList);
  
  // 1階の X1通りのケースを取得
  const xCase = res.cases.find(c => c.axisName === 'X1' && c.name.includes('右から'));
  
  // 2階の壁による Ni_upper の期待値: 
  // deltaPower = qair - qail = (1.96 * 1.0 * 2.73) - 0 = 5.3508
  // Ni_upper (1階) = Σ (deltaPower_upper * Bi_bot_upper * sign)
  // sign = -1 (右から) なので、 -5.3508 * 0.5 = -2.6754
  t.assertAlmostEqual(xCase.Ni_upper, -2.6754, 0.0001, 'Upper floor wall axial load should be accumulated correctly');
});
