import { floorData, currentFloor, FLOORS } from './foundation_cad.js';
import { calculateRebarArea, generateOptions, escapeHtml, safeRemoveById } from './ui_utils.js';
import { handlePropChange, updateSlabFromModal } from './state_manager.js';
import { saveBeamPopupData, openBeamStressPopup, closeBeamStressPopup, updateBeamSpanProp } from './beam_ui.js';
import { 
    openSlabDetailModal, openSlabEditor, closeSlabDetailModal, closeSlabEditor, copySlabCalcToClipboard,
    openColumnDetailModal, 
    openWallDetailModal, openDiaphragmDetailModal, drawDiaphragmEquivalentImage, openWallAxialModal, showAxialStressTable, renderAxialElevation, drawAxialElevationOnCanvas
} from './modal_ui.js';
import { updateDataList } from './data_list_ui.js';
import { showCalculationReport, getAxesToReport } from './report_generator.js';
import { generateEnlargedAxialDiagramSvg } from './report/svg_axial_diagram.js';
import { updatePropertyPanel } from './property_panel_builders.js';

// --- Exports ---
export {
    calculateRebarArea, generateOptions, escapeHtml, safeRemoveById,
    handlePropChange, updateSlabFromModal,
    saveBeamPopupData, openBeamStressPopup, closeBeamStressPopup, updateBeamSpanProp,
    openSlabDetailModal, openSlabEditor, closeSlabDetailModal, closeSlabEditor, copySlabCalcToClipboard,
    openColumnDetailModal, 
    openWallDetailModal, openDiaphragmDetailModal, drawDiaphragmEquivalentImage, openWallAxialModal, showAxialStressTable, renderAxialElevation, drawAxialElevationOnCanvas,
    updateDataList,
    showCalculationReport, getAxesToReport,
    generateEnlargedAxialDiagramSvg,
    updatePropertyPanel
};

window.safeRemoveById = safeRemoveById;

// Global registrations have been moved to state_manager.js


// foundation_ui.js - UI・帳票エンジン（スラブ機能はslab_ui.jsに分離済み）

// getAxisName は core/axis_manager.js へ移動しました




// updateAnchorBoltProp は state_manager.js へ移動しました












