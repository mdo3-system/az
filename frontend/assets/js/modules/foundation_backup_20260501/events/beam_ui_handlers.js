// events/beam_ui_handlers.js
import { floorData, currentFloor } from '../foundation_cad.js';

/**
 * 梁の計算結果（検定用データ）を取得する
 */
export const calcBeamResult = function(beam) {
  let Lo = beam.length_m || 2, B = beam.tributaryWidth || 0, sigma = beam.groundPressure || 0;
  const fd = (window.allFloorData && window.allFloorData[currentFloor]) || (window.floorData && window.floorData[currentFloor]) || floorData[currentFloor];
  
  if (beam.type === 'foundation_beam' && fd) {
    const n1 = fd.nodes[beam.n1], n2 = fd.nodes[beam.n2];
    if (n1 && n2) Lo = Math.hypot(n2.x - n1.x, n2.y - n1.y) / 1000;
  }

  const stress = (beam.type === 'foundation_beam' && fd && typeof window.computeBeamStress === 'function') ? window.computeBeamStress(fd, beam) : null;
  
  let w = sigma * B;
  let Mmid = beam.Mc || (w * Lo * Lo) / 8;
  let Mend = Math.max(beam.M1 || 0, beam.M2 || 0) || (w * Lo * Lo) / 12;
  let Q = (w * Lo) / 2;

  if (stress) {
    Mmid = stress.Mc || Mmid;
    Mend = Math.max(stress.M1 || 0, stress.M2 || 0) || Mend;
    Q = Math.max(stress.Q1 || 0, stress.Q2 || 0) || Q;
    if (stress.spans && stress.spans.length > 0) {
      w = Math.max(...stress.spans.map(s => s.w_slab + (stress.w_self || 0)));
    }
  }
  
  const getArea = (r) => (typeof window.getRebarArea === 'function' ? window.getRebarArea(r) : 0);
  const at_t = getArea(beam.topRebar || '2-D13');
  const at_b = getArea(beam.bottomRebar || '2-D13');
  const aw = getArea(beam.stirrupRebar || 'D10');
  const s = beam.stirrupPitch || 200;
  const bw = beam.width || 300;
  const depth = beam.depth || 640;
  const dt = beam.dt || 70;
  const ft = beam.ft || 195;
  const fts = beam.fts || 295;
  const fs = beam.fs || 0.7;
  const fss = beam.fss || 1.05;

  const material = { ft, fs, fts, fss };
  let resStrength = { d: 0, j: 0, Ma: 0, Qa: 0 };
  let resStrengthBot = { Ma: 0 };

  if (typeof window.calculateSpanStrength === 'function') {
      resStrength = window.calculateSpanStrength({ D: depth, b: bw, dt, at: at_t, aw, pitch: s, alpha: 1.0 }, material);
      resStrengthBot = window.calculateSpanStrength({ D: depth, b: bw, dt, at: at_b, aw, pitch: s, alpha: 1.0 }, material);
  }

  return { 
    Lo, B, sigma, w_load: w, M_mid: Mmid, M_end: Mend, Q_L: Q, 
    at_top: at_t, at_bot: at_b, b_width: bw, d_depth: resStrength.d, j: resStrength.j, ft: ft,
    Ma_top: resStrength.Ma, Ma_bot: resStrengthBot.Ma, Qa: resStrength.Qa 
  };
};

export const closeBeamStressPopup = () => {
    const modal = document.getElementById('beamStressModal');
    if (modal && modal.parentNode) modal.remove();
};

export const updateBeamRebar = (type, index) => {
  const fd = (window.allFloorData && window.allFloorData[currentFloor]) || (window.floorData && window.floorData[currentFloor]) || floorData[currentFloor];
  const beam = type === 'beam' ? fd.beams[index] : fd.perimeterBeams[index];
  beam.width = parseFloat(document.getElementById('inp_w').value) || 150;
  beam.depth = parseFloat(document.getElementById('inp_d').value) || 640;
  beam.topRebar = document.getElementById('inp_topBar').value;
  beam.bottomRebar = document.getElementById('inp_botBar').value;
  if (typeof window.handlePropChange === 'function') {
      window.handlePropChange(type, index, 'width', beam.width);
      window.handlePropChange(type, index, 'depth', beam.depth);
      window.handlePropChange(type, index, 'topRebar', beam.topRebar);
      window.handlePropChange(type, index, 'bottomRebar', beam.bottomRebar);
  }
  if (typeof window.openBeamStressPopup === 'function') window.openBeamStressPopup(type, index);
};

export const updateStirrup = (type, index) => {
  const fd = (window.allFloorData && window.allFloorData[currentFloor]) || (window.floorData && window.floorData[currentFloor]) || floorData[currentFloor];
  const beam = type === 'beam' ? fd.beams[index] : fd.perimeterBeams[index];
  beam.stirrupRebar = document.getElementById('inp_stp').value;
  beam.stirrupPitch = parseInt(document.getElementById('inp_pitch').value) || 200;
  if (typeof window.handlePropChange === 'function') {
      window.handlePropChange(type, index, 'stirrupRebar', beam.stirrupRebar);
      window.handlePropChange(type, index, 'stirrupPitch', beam.stirrupPitch);
  }
  if (typeof window.openBeamStressPopup === 'function') window.openBeamStressPopup(type, index);
};

export const drawBeamStressCanvas = (cid, res) => {
  const cv = typeof cid === 'string' ? document.getElementById(cid) : cid; 
  if (!cv) return;
  const ctx = cv.getContext('2d'), w = cv.width, h = cv.height; 
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#555'; ctx.beginPath(); ctx.moveTo(30, h/2); ctx.lineTo(w-30, h/2); ctx.stroke();
  if (res.M_mid > 0 || res.M_end > 0) {
    ctx.beginPath(); ctx.strokeStyle = '#3498db'; ctx.lineWidth = 2; 
    const sm = (h/2 - 20) / Math.max(res.M_mid * 2, res.M_end * 1.5, 1);
    ctx.moveTo(30, h/2 - res.M_end * sm); 
    ctx.quadraticCurveTo(w/2, h/2 + res.M_mid * sm * 2, w-30, h/2 - res.M_end * sm); 
    ctx.stroke();
    ctx.fillStyle = '#333'; ctx.font = '10px monospace'; 
    ctx.fillText('端M=' + res.M_end.toFixed(1), 30, h/2 - res.M_end * sm - 5); 
    ctx.fillText('中M=' + res.M_mid.toFixed(1), w/2 - 25, h/2 + res.M_mid * sm + 15);
  }
};

window.calcBeamResult = calcBeamResult;
window.closeBeamStressPopup = closeBeamStressPopup;
window.updateBeamRebar = updateBeamRebar;
window.updateStirrup = updateStirrup;
window.drawBeamStressCanvas = drawBeamStressCanvas;
