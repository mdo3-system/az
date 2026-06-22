/**
 * project_service.js
 * 
 * JSONの保存・読込ロジックを管理するサービス
 */
import { floorData, nextId, dxfLines, dxfTexts, dxfLayerVisibility, dxfVAxes, dxfHAxes, dxfSkewedAxes, updateNextId, setDxfData, setFloor, pushHistory, repairFoundationData } from '../../foundation_cad.js';

export class ProjectService {
  constructor(dependencies = {}) {
    this.floorData = dependencies.floorData || floorData;
    this.updateNextId = dependencies.updateNextId || updateNextId;
    this.setDxfData = dependencies.setDxfData || setDxfData;
    this.setFloor = dependencies.setFloor || setFloor;
    this.pushHistory = dependencies.pushHistory || pushHistory;
  }

  /**
   * プロジェクトデータをJSON文字列に変換
   * @param {Object} underlayVisibility 
   * @returns {string} JSON string
   */
  exportProject(underlayVisibility) {
    const data = {
      floorData: this.floorData,
      nextId,
      dxfLines,
      dxfTexts,
      dxfLayerVisibility,
      dxfVAxes,
      dxfHAxes,
      dxfSkewedAxes,
      underlayVisibility
    };
    return JSON.stringify(data);
  }

  /**
   * JSONデータからプロジェクトを読み込んで復元
   * @param {Object} data 
   * @returns {Promise<void>}
   */
  async importProject(data) {
    const { normalizeAllFloors } = await import('../../data/data_normalizer.js');

    if (data.floorData) {
      Object.keys(data.floorData).forEach(f => {
        if (this.floorData[f]) {
          Object.keys(this.floorData[f]).forEach(k => delete this.floorData[f][k]);
          Object.assign(this.floorData[f], data.floorData[f]);
        }
      });
      normalizeAllFloors(this.floorData);
      repairFoundationData(this.floorData);
    }
    if (data.nextId) this.updateNextId(data.nextId);
    this.setDxfData(
      data.dxfLines || [],
      data.dxfTexts || [],
      data.dxfLayerVisibility || {},
      data.dxfVAxes || [],
      data.dxfHAxes || [],
      data.dxfSkewedAxes || []
    );
    this.setFloor('1');
    this.pushHistory();
  }
}
