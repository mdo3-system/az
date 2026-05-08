// data/state_handlers.js - 状態更新のみを担当する（UIには依存しない）
import { floorData, currentFloor, state } from './state_store.js';
import { render } from '../rendering/view_manager.js';

/**
 * 単一プロパティの更新
 */
export const handlePropChange = function(type, index, field, value) {
  const fd = floorData[currentFloor];
  let target = null;
  
  if (type === 'column') target = fd.columns[index];
  else if (type === 'wall') target = fd.walls[index];
  else if (type === 'beam') target = fd.beams[index];
  else if (type === 'perimeterBeam') target = fd.perimeterBeams[index];
  else if (type === 'slab') target = fd.slabs[index];
  else if (type === 'diaphragm') target = fd.diaphragms[index];
  else if (type === 'node') target = fd.nodes[index];

  if (!target) return;

  let parsed = value;
  const numericFields = ['multiplier', 'nw', 'width', 'depth', 'stirrupPitch', 'dt', 'groundPressure', 'triangleMultiplier', 'Qa', 'x', 'y'];
  if (numericFields.includes(field)) parsed = parseFloat(value) || 0;
  
  if (field === 'showReport' || field === 'isExterior' || field === 'isIndependent') {
    parsed = (value === 'true' || value === true);
  }

  target[field] = parsed;
  console.log(`[PropChange] ${type}[${index}].${field} = ${parsed}`);

  // サイドエフェクト
  render();
};

/**
 * 複数要素の一括更新
 */
export const handleMultiPropChange = function(field, value) {
  if (!state.selectedElements || state.selectedElements.length === 0) return;
  
  state.selectedElements.forEach(el => {
    handlePropChange(el.type, el.index, field, value);
  });
  
  render();
};
