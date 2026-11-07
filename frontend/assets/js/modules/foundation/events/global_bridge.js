// events/global_bridge.js - レガシーHTML(onclick/onchange)とモジュールを繋ぐ架け橋
import * as StateManager from '../state_manager.js';
import * as UI from '../foundation_ui.js';
import * as Sync from '../core/data_synchronizer.js';
import * as Report from '../report_generator.js';
import * as Axis from '../core/axis_manager.js';
import * as BeamUI from '../beam_ui.js';
import * as ModalUI from '../modal_ui.js';
import { updateDataList } from '../data_list_ui.js';
import { updatePropertyPanel } from '../property_panel_builders.js';
import * as BeamCalc from '../core/beam_calc.js';
import * as SlabCalc from '../core/slab_calc.js';
import * as ColumnCalc from '../core/column_calc.js';
import * as DiaphSkew from '../core/diaphragm_skew_calc.js';

// State Manager
window.handlePropChange = StateManager.handlePropChange;
window.handleMultiPropChange = StateManager.handleMultiPropChange;
window.updateSlabFromModal = StateManager.updateSlabFromModal;
window.selectListItem = StateManager.selectListItem;
window.switchMenuTab = StateManager.switchMenuTab;
window.updateFloorHeight = StateManager.updateFloorHeight;
window.updateAllFloorHeightInputs = StateManager.updateAllFloorHeightInputs;
window.updateGlobalDesignSettings = StateManager.updateGlobalDesignSettings;
window.updateGlobalDiaphragmSpecs = StateManager.updateGlobalDiaphragmSpecs;
window.updateAllDiaphragmSpecsInputs = StateManager.updateAllDiaphragmSpecsInputs;
window.updateAnchorBoltProp = StateManager.updateAnchorBoltProp;
window.updateDefaultProperty = StateManager.updateDefaultProperty;
window.updateDefaultWallMultiplier = StateManager.updateDefaultWallMultiplier;

// Sync
window.syncSlabDataToBeams = Sync.syncSlabDataToBeams;
window.autoGenerateBeamsFromSlabs = Sync.autoGenerateBeamsFromSlabs;
window.recalcAllTributaries = Sync.recalcAllTributaries;
window.getAxisNameForSegment = Sync.getAxisNameForSegment;

// Report
window.showCalculationReport = Report.showCalculationReport;
window.getAxesToReport = Report.getAxesToReport;

// Axis
window.getAxisName = Axis.getAxisName;
window.renameAxis = Axis.renameAxis;
window.deleteAxis = Axis.deleteAxis;
window.addAxisNear = Axis.addAxisNear;
window.forceSyncAllSymbols = Axis.forceSyncAllSymbols;
window.updateSkewedVizDropdown = Axis.updateSkewedVizDropdown;

// UI Helpers
window.calculateRebarArea = UI.calculateRebarArea;
window.generateOptions = UI.generateOptions;
window.escapeHtml = UI.escapeHtml;
window.updateDataList = updateDataList;
window.updatePropertyPanel = updatePropertyPanel;

// Beam UI
window.saveBeamPopupData = BeamUI.saveBeamPopupData;
window.openBeamStressPopup = BeamUI.openBeamStressPopup;
window.closeBeamStressPopup = BeamUI.closeBeamStressPopup;
window.updateBeamSpanProp = BeamUI.updateBeamSpanProp;

// Modals
window.openSlabDetailModal = ModalUI.openSlabDetailModal;
window.openSlabEditor = ModalUI.openSlabEditor;
window.closeSlabDetailModal = ModalUI.closeSlabDetailModal;
window.closeSlabEditor = ModalUI.closeSlabEditor;
window.copySlabCalcToClipboard = ModalUI.copySlabCalcToClipboard;
window.openColumnDetailModal = ModalUI.openColumnDetailModal;
window.openWallDetailModal = ModalUI.openWallDetailModal;
window.openDiaphragmDetailModal = ModalUI.openDiaphragmDetailModal;
window.drawDiaphragmEquivalentImage = ModalUI.drawDiaphragmEquivalentImage;
window.openWallAxialModal = ModalUI.openWallAxialModal;
window.showAxialStressTable = ModalUI.showAxialStressTable;
window.renderAxialElevation = ModalUI.renderAxialElevation;
window.drawAxialElevationOnCanvas = ModalUI.drawAxialElevationOnCanvas;

// Beam Calc
window.cleanupOverlappingBeams = Sync.cleanupOverlappingBeams || BeamUI.cleanupOverlappingBeams; 
window.autoMergeCollinearBeams = Sync.autoMergeCollinearBeams || BeamUI.autoMergeCollinearBeams;
window.findSupportsOnBeam = Sync.findSupportsOnBeam || BeamUI.findSupportsOnBeam;

window.computeBeamStress = BeamCalc.computeBeamStress;
window.getRebarArea = BeamCalc.getRebarArea;
window.calculateSpanStrength = BeamCalc.calculateSpanStrength;
window.calculateDetailedBeamCheckResults = BeamCalc.calculateDetailedBeamCheckResults;

// Slab Calc
window.calculateSlabTributary = SlabCalc.calculateSlabTributary;
window.normalizeSupportCondition = SlabCalc.normalizeSupportCondition;
window.calculateSlabStress = SlabCalc.calculateSlabStress;
window.calculateAndSetSlabAIJStress = SlabCalc.calculateAndSetSlabAIJStress;
window.calculateDiaphragmProps = SlabCalc.calculateDiaphragmProps;

// Column & Wall
window.calculateWallProps = ColumnCalc.calculateWallProps;
window.calculateColumnT = ColumnCalc.calculateColumnT;
window.calculateFoundationHorizontalStressData = ColumnCalc.calculateFoundationHorizontalStressData;

// Diaphragm Skew
window.calcSkewedDiaphragmModel = DiaphSkew.calcSkewedDiaphragmModel;
window.rotatePoint = DiaphSkew.rotatePoint;

console.log("[GlobalBridge] Legacy window object bindings completed (v3.2.9 Optimized).");
