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

  t.assertEquals(res.cases[0].q1_Hi, 0, 'Left side should be 0 because the wall is on the right');
  t.assertAlmostEqual(res.cases[0].q2_Hi, 5.3508, 0.0001, '0.5mm shift should be tolerated and wall should be counted as Right');
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

runner.test('calculateColumnT - 105mm Close Columns (X6b/X7) and Wall heightOverride', (t) => {
  // Y15通り上で 1F に X6b(x=2622), 2F に X7(x=2727) と 105mm 離れた別柱があるケース
  const floorList = ['2', '1'];
  const allFloorData = {
    '2': {
      nodes: {
        'x7': { x: 2727, y: 3636 },
        'x8': { x: 3636, y: 3636 }
      },
      walls: [
        { n1: 'x7', n2: 'x8', multiplier: 6.8, heightOverride: 1691, axisName: 'Y15' }
      ],
      columns: [
        { id: 'X7Y15', nodeIndex: 'x7', nw: 2.727 }
      ],
      floorHeight: 2730
    },
    '1': {
      nodes: {
        'x6':  { x: 1818, y: 3636 },
        'x6b': { x: 2622, y: 3636 }
      },
      walls: [
        { n1: 'x6', n2: 'x6b', multiplier: 4.3, axisName: 'Y15' }
      ],
      columns: [
        { id: 'X6bY15', nodeIndex: 'x6b', nw: 0 }
      ],
      floorHeight: 2730
    }
  };

  const res = calculateColumnT(0, allFloorData['2'], '2', allFloorData, floorList);
  const y15L = res.cases.find(c => c.axisName === 'Y15' && c.name.includes('左から'));
  const y15R = res.cases.find(c => c.axisName === 'Y15' && c.name.includes('右から'));

  // q2_Hi = 1.96 * 6.8 * 1.691 = 22.537648
  t.assertAlmostEqual(y15L.q2_Hi, 22.5376, 0.001, 'Wall heightOverride (1691mm) should be used for q2_Hi');
  // 左から加力時: X7 は壁の左端 -> N = +22.5376 * 0.5 = +11.2688, T = 11.2688 - 2.727 = 8.5418
  t.assertAlmostEqual(y15L.Ni_bot, 11.2688, 0.001, 'X7Y15 Ni_bot (Left push) should not be zeroed by X6b clustering');
  t.assertAlmostEqual(y15L.T_bot, 8.5418, 0.001, 'X7Y15 T_bot (Left push) should match 8.542 kN');
  t.assertAlmostEqual(y15R.Ni_bot, -11.2688, 0.001, 'X7Y15 Ni_bot (Right push) should be compression');
});
