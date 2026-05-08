import { floorData, currentFloor, FLOORS } from './foundation_cad.js';
import { calculateRebarArea, generateOptions, escapeHtml } from './ui_utils.js';
import { handlePropChange, updateSlabFromModal } from './state_manager.js';
import { saveBeamPopupData, openBeamStressPopup, closeBeamStressPopup, updateBeamSpanProp } from './beam_ui.js';
import { 
    openSlabDetailModal, openSlabEditor, closeSlabDetailModal, closeSlabEditor, copySlabCalcToClipboard,
    openColumnDetailModal, 
    openWallDetailModal, openDiaphragmDetailModal, drawDiaphragmEquivalentImage, openWallAxialModal, showAxialStressTable, renderAxialElevation, drawAxialElevationOnCanvas
} from './modal_ui.js';
import { updateDataList } from './data_list_ui.js';
import { showCalculationReport, getAxesToReport } from './report_generator.js';
import { generateEnlargedAxialDiagramSvg } from './svg_generator_report.js';
import { updatePropertyPanel } from './property_panel_builders.js';


// foundation_ui.js - UI・帳票エンジン（スラブ機能はslab_ui.jsに分離済み）

export function getAxisName(colIndex, fd) {
  const col = fd.columns[colIndex];
  if (!col) return '—';
  const startNodeIdx = col.nodeIndex;
  const walls = fd.walls || [];
  const nodes = fd.nodes || [];
  const TOL_DEG = 2; // 許容角度誤差（度）

  // 指定ノードから接続されている壁一覧
  const getConnectedWalls = (nodeIdx) =>
    walls.map((w, wi) => ({
      wi, w,
      otherNode: w.n1 === nodeIdx ? w.n2 : (w.n2 === nodeIdx ? w.n1 : -1),
    })).filter(({ otherNode }) => otherNode >= 0);

  // 一直線上の壁を一方向にたどる
  // fromNode: 前のノード（向きを決める）, curNode: 現在位置
  const traceDir = (fromNode, curNode, visitedWalls) => {
    const fromN = nodes[fromNode];
    const curN = nodes[curNode];
    if (!fromN || !curN) return curNode;

    // 入ってきた角度
    const inAngle = Math.atan2(curN.y - fromN.y, curN.x - fromN.x) * 180 / Math.PI;

    const candidates = getConnectedWalls(curNode).filter(({ wi }) => !visitedWalls.has(wi));
    for (const { wi, w, otherNode } of candidates) {
      const nextN = nodes[otherNode];
      if (!nextN) continue;
      const outAngle = Math.atan2(nextN.y - curN.y, nextN.x - curN.x) * 180 / Math.PI;
      // ほぼ同じ方向（前向き継続）かどうか
      let diff = Math.abs(inAngle - outAngle) % 360;
      if (diff > 180) diff = 360 - diff;
      if (diff < TOL_DEG) {
        visitedWalls.add(wi);
        return traceDir(curNode, otherNode, visitedWalls);
      }
    }
    return curNode; // これ以上進めない
  };

  // 接続されている全壁から「通り」ごとに端点を取得
  const usedWalls = new Set();
  const axes = [];

  const connectedAtStart = getConnectedWalls(startNodeIdx);
  connectedAtStart.forEach(({ wi, w, otherNode }) => {
    if (usedWalls.has(wi)) return;
    usedWalls.add(wi);

    // この壁の方向で順方向・逆方向の端点をトレース
    const fwdVisited = new Set([wi]);
    const endFwd = traceDir(startNodeIdx, otherNode, fwdVisited);

    const revVisited = new Set([wi]);
    const endRev = traceDir(otherNode, startNodeIdx, revVisited);

    // 使用済みとしてマーク
    fwdVisited.forEach(id => usedWalls.add(id));
    revVisited.forEach(id => usedWalls.add(id));

    const nameStart = nodes[endRev]?.id || `N${endRev}`;
    const nameEnd = nodes[endFwd]?.id || `N${endFwd}`;
    if (nameStart !== nameEnd) {
      axes.push(`${nameStart}〜${nameEnd}軸`);
    }
  });

  return axes.length > 0 ? axes.join(' / ') : '（通り未検出）';
}




/**
 * アンカーボルトのプロパティ更新（axisName 単位）
 */
window.updateAnchorBoltProp = function(axisName, field, value) {
  if (!axisName) return;
  const fd = floorData[currentFloor];
  if (!fd.anchorBolts) fd.anchorBolts = {};
  if (!fd.anchorBolts[axisName]) {
    fd.anchorBolts[axisName] = { species: 'J1', m12: 0, m16: 0 };
  }
  
  if (field === 'species') fd.anchorBolts[axisName].species = value;
  if (field === 'm12') fd.anchorBolts[axisName].m12 = parseInt(value) || 0;
  if (field === 'm16') fd.anchorBolts[axisName].m16 = parseInt(value) || 0;
  
  if (typeof window.callRender === 'function') window.callRender();
};












